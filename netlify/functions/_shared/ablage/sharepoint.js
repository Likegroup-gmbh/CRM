// _shared/ablage/sharepoint.js
// SharePoint-Implementierung der Ablage ueber Microsoft Graph (driveItems).
// Alle Adressen ueber item_id; Pfade nur fuer Anzeige und Logs.

const { sharePointKonfig } = require('./konfig');
const { createHttp, alleSeiten, batch, GraphError, istNichtGefunden, istKonflikt } = require('./graph');
const { createTokenQuelle, GRAPH_SCOPE } = require('./graph-auth');

const ITEM_FELDER = [
  'id', 'name', 'size', 'eTag', 'cTag', 'webUrl', 'parentReference', 'file', 'folder',
  'video', 'image', 'photo', 'deleted', 'root', 'lastModifiedDateTime', 'lastModifiedBy', 'createdDateTime',
].join(',');

const KIND_FELDER = 'id,name,size,eTag,cTag,webUrl,file,folder,lastModifiedDateTime,parentReference';

// driveItem-Abo: max. 42300 Minuten; 29 Tage lassen Luft
const ABO_TAGE = 29;

const enc = (name) => encodeURIComponent(name);

/** driveItem -> Zeile fuer ablage_eingang (RPC ablage_eingang_aufnehmen). */
function itemZuEingang(item) {
  const breite = item.video?.width ?? item.image?.width ?? null;
  const hoehe = item.video?.height ?? item.image?.height ?? null;
  const von = item.lastModifiedBy?.user || item.lastModifiedBy?.application || {};
  return {
    item_id: item.id,
    parent_item_id: item.parentReference?.id || null,
    name: item.name || null,
    pfad: item.parentReference?.path ? `${item.parentReference.path.replace(/^\/drives?\/[^/]+\/root:?/, '')}/${item.name || ''}` : null,
    ist_ordner: !!(item.folder || item.root),
    geloescht: !!item.deleted,
    groesse: item.size ?? null,
    etag: item.eTag || null,
    ctag: item.cTag || null,
    mime: item.file?.mimeType || null,
    breite,
    hoehe,
    dauer_ms: item.video?.duration ?? null,
    geaendert_at: item.lastModifiedDateTime || null,
    geaendert_von: von.email || von.userPrincipalName || von.displayName || null,
  };
}

/**
 * @param {object} deps
 * @param {object} [deps.http] Graph-Client (createHttp); Standard: App-Token aus graph-auth
 * @param {string} [deps.driveId]
 * @param {string} [deps.siteId]
 */
function createSharePoint({
  konfig = sharePointKonfig(),
  tokenQuelle,
  http,
  fetchImpl = (...a) => fetch(...a),
  schlafen,
  driveId = konfig.driveId,
  siteId = konfig.siteId,
} = {}) {
  const quelle = tokenQuelle || createTokenQuelle({ konfig, fetchImpl });
  const graph = http || createHttp({ token: (o) => quelle(GRAPH_SCOPE, o), fetchImpl, schlafen });
  const d = `/drives/${driveId}`;

  // Upload-URLs sind vorab authentifiziert: KEIN Authorization-Header mitschicken
  const ohneAuth = (url, opts) => graph.anfrage(url, { ...opts, ohneAuth: true });

  return {
    driveId,
    siteId,
    graph,
    tokenQuelle: quelle,

    async wurzel() {
      return graph.get(`${d}/root?$select=id,name,webUrl`);
    },

    async drive() {
      return graph.get(`${d}?$select=id,name,webUrl,quota`);
    },

    async listeId() {
      const l = await graph.get(`${d}/list?$select=id`);
      return l?.id || null;
    },

    async listItemId(itemId) {
      const li = await graph.get(`${d}/items/${itemId}/listItem?$select=id`);
      return li?.id || null;
    },

    async item(itemId, select = ITEM_FELDER) {
      try {
        return await graph.get(`${d}/items/${itemId}?$select=${select}`);
      } catch (err) {
        if (istNichtGefunden(err)) return null;
        throw err;
      }
    },

    async kinder(itemId, select = KIND_FELDER) {
      return alleSeiten(graph, `${d}/items/${itemId}/children?$select=${select}&$top=999`);
    },

    async kindNachName(parentId, name) {
      try {
        return await graph.get(`${d}/items/${parentId}:/${enc(name)}?$select=${KIND_FELDER}`);
      } catch (err) {
        if (istNichtGefunden(err)) return null;
        throw err;
      }
    },

    /** Legt einen Ordner an. Existiert der Name schon: { konflikt: true, item }. */
    async ordnerAnlegen(parentId, name) {
      try {
        const item = await graph.post(`${d}/items/${parentId}/children`, {
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
        return { item, konflikt: false };
      } catch (err) {
        if (!istKonflikt(err)) throw err;
        return { item: await this.kindNachName(parentId, name), konflikt: true };
      }
    },

    /**
     * Upload-Session fuer eine neue Datei. conflict 'rename' haengt " 1" an,
     * 'replace' ueberschreibt (gleiche item_id, neue Version), 'fail' bricht ab.
     */
    async uploadSession(parentId, name, { conflict = 'rename', deferCommit = false } = {}) {
      const res = await graph.post(`${d}/items/${parentId}:/${enc(name)}:/createUploadSession`, {
        item: { '@microsoft.graph.conflictBehavior': conflict, name },
        ...(deferCommit ? { deferCommit: true } : {}),
      });
      return { uploadUrl: res.uploadUrl, ablauf: res.expirationDateTime || null };
    },

    /** Neuer Inhalt fuer ein bestehendes Item (Ersetzen): item_id bleibt, Version +1. */
    async uploadSessionFuerItem(itemId, { deferCommit = false } = {}) {
      const res = await graph.post(`${d}/items/${itemId}/createUploadSession`, {
        item: { '@microsoft.graph.conflictBehavior': 'replace' },
        ...(deferCommit ? { deferCommit: true } : {}),
      });
      return { uploadUrl: res.uploadUrl, ablauf: res.expirationDateTime || null };
    },

    async sessionStatus(uploadUrl) {
      try {
        return await ohneAuth(uploadUrl, { method: 'GET' });
      } catch (err) {
        if (istNichtGefunden(err)) return null;
        throw err;
      }
    },

    /** deferCommit: leerer POST auf die Upload-URL schaltet die Datei frei. */
    async sessionAbschliessen(uploadUrl) {
      return ohneAuth(uploadUrl, { method: 'POST', rawBody: '', headers: { 'Content-Length': '0' } });
    },

    async sessionVerwerfen(uploadUrl) {
      try {
        await ohneAuth(uploadUrl, { method: 'DELETE' });
        return true;
      } catch (err) {
        if (istNichtGefunden(err)) return true;
        throw err;
      }
    },

    /** Ein Chunk (Server-seitig: Creator-Upload, Umzug). Liefert 202-Status oder das fertige Item. */
    async chunkHochladen(uploadUrl, buffer, start, gesamt) {
      const ende = start + buffer.length - 1;
      const resp = await ohneAuth(uploadUrl, {
        method: 'PUT',
        rawBody: buffer,
        headers: { 'Content-Length': String(buffer.length), 'Content-Range': `bytes ${start}-${ende}/${gesamt}` },
        roh: true,
      });
      const body = await resp.json().catch(() => ({}));
      return { status: resp.status, fertig: resp.status === 200 || resp.status === 201, body };
    },

    async umbenennen(itemId, name, { etag } = {}) {
      return graph.patch(`${d}/items/${itemId}?@microsoft.graph.conflictBehavior=fail`, { name }, {
        headers: etag ? { 'If-Match': etag } : {},
      });
    },

    async verschieben(itemId, parentId, { name, conflict = 'rename' } = {}) {
      return graph.patch(`${d}/items/${itemId}?@microsoft.graph.conflictBehavior=${conflict}`, {
        parentReference: { id: parentId },
        ...(name ? { name } : {}),
      });
    },

    /** In den Papierkorb. 404 = schon weg. */
    async loeschen(itemId, { etag } = {}) {
      try {
        await graph.del(`${d}/items/${itemId}`, { headers: etag ? { 'If-Match': etag } : {} });
        return true;
      } catch (err) {
        if (istNichtGefunden(err)) return false;
        throw err;
      }
    },

    /** Endgueltig (DSGVO-Kaskade): am Papierkorb vorbei. */
    async endgueltigLoeschen(itemId) {
      try {
        await graph.anfrage(`${d}/items/${itemId}/permanentDelete`, { method: 'POST', rawBody: '' });
        return true;
      } catch (err) {
        if (istNichtGefunden(err)) return false;
        throw err;
      }
    },

    async downloadUrl(itemId) {
      // Ohne $select: Graph liefert @microsoft.graph.downloadUrl nur im vollen Item, nicht mehr per $select
      let it;
      try {
        it = await graph.get(`${d}/items/${itemId}`);
      } catch (err) {
        if (istNichtGefunden(err)) return null;
        throw err;
      }
      if (!it) return null;
      return { url: it['@microsoft.graph.downloadUrl'] || null, name: it.name, groesse: it.size, etag: it.eTag };
    },

    /** Mehrere downloadUrls per $batch. Ergebnis: Map item_id -> url|null */
    async downloadUrls(itemIds) {
      const res = await batch(graph, itemIds.map((id) => ({
        // Kein $select: die downloadUrl-Annotation kommt nur im vollen Item zurueck
        url: `${d}/items/${id}`,
      })));
      const out = new Map();
      itemIds.forEach((id, i) => {
        const r = res[i];
        out.set(id, r?.status === 200 ? (r.body?.['@microsoft.graph.downloadUrl'] || null) : null);
      });
      return out;
    },

    /**
     * Thumbnails per $batch. Ergebnis in Eingabe-Reihenfolge: { ok, url } | { ok:false, fehler, permanent }.
     */
    async thumbnailUrls(itemIds, groesse = 'c480x480') {
      const res = await batch(graph, itemIds.map((id) => ({
        url: `${d}/items/${id}/thumbnails?$select=${groesse}`,
      })));
      return itemIds.map((_, i) => {
        const r = res[i];
        if (r?.status === 200) {
          const url = r.body?.value?.[0]?.[groesse]?.url;
          return url ? { ok: true, url } : { ok: false, fehler: 'sharepoint:keinThumbnail', permanent: false };
        }
        const code = r?.body?.error?.code || `http${r?.status || 0}`;
        return { ok: false, fehler: `sharepoint:${code}`, permanent: r?.status === 404 };
      });
    },

    /** Eine Seite des Delta-Feeds. link = nextLink/deltaLink oder null (Vollabgleich). */
    async deltaSeite(link) {
      const url = link || `${d}/root/delta?$select=${ITEM_FELDER}`;
      return graph.get(url, { headers: { Prefer: 'deltashowremovedasdeleted, deltatraversepermissiongaps' } });
    },

    /** Nur den aktuellen deltaLink holen, ohne Bestand (token=latest). */
    async deltaJetzt() {
      const res = await graph.get(`${d}/root/delta?token=latest`);
      return res?.['@odata.deltaLink'] || null;
    },

    async aboAnlegen({ notificationUrl, clientState, tage = ABO_TAGE }) {
      return graph.post('/subscriptions', {
        changeType: 'updated',
        notificationUrl,
        resource: `${d}/root`,
        expirationDateTime: new Date(Date.now() + tage * 86400000).toISOString(),
        clientState,
      });
    },

    async aboVerlaengern(aboId, { tage = ABO_TAGE } = {}) {
      return graph.patch(`/subscriptions/${aboId}`, {
        expirationDateTime: new Date(Date.now() + tage * 86400000).toISOString(),
      });
    },

    async aboLoeschen(aboId) {
      try {
        await graph.del(`/subscriptions/${aboId}`);
      } catch (err) {
        if (!istNichtGefunden(err)) throw err;
      }
    },

    /** Kunden-Leselink: "Jeder mit dem Link", nur Ansicht, mit Ablauf. */
    async leselink(itemId, ablauf) {
      const perm = await graph.post(`${d}/items/${itemId}/createLink`, {
        type: 'view',
        scope: 'anonymous',
        expirationDateTime: new Date(ablauf).toISOString(),
        retainInheritedPermissions: true,
      });
      return { permissionId: perm.id, url: perm.link?.webUrl, ablauf: perm.expirationDateTime || new Date(ablauf).toISOString() };
    },

    async freigabeEntfernen(itemId, permissionId) {
      try {
        await graph.del(`${d}/items/${itemId}/permissions/${permissionId}`);
        return true;
      } catch (err) {
        if (istNichtGefunden(err)) return false;
        throw err;
      }
    },

    async quota() {
      const dr = await this.drive();
      return { used: dr?.quota?.used ?? null, total: dr?.quota?.total ?? null };
    },

    /** Freigabelink (z. B. persoenliches OneDrive) -> { driveId, itemId, name, size } */
    async freigabeAufloesen(url) {
      const token = `u!${Buffer.from(url).toString('base64url')}`;
      const it = await graph.get(`/shares/${token}/driveItem?$select=id,name,size,file,folder,parentReference`);
      return { driveId: it.parentReference?.driveId, itemId: it.id, name: it.name, groesse: it.size, ordner: !!it.folder };
    },

    /** Kopie innerhalb des Tenants (asynchron). Liefert die Monitor-URL. */
    async kopieren(quellDriveId, quellItemId, zielParentId, name) {
      const res = await graph.post(
        `/drives/${quellDriveId}/items/${quellItemId}/copy?@microsoft.graph.conflictBehavior=rename`,
        { parentReference: { driveId, id: zielParentId }, ...(name ? { name } : {}) },
      );
      return res?.location || null;
    },

    async kopierStatus(monitorUrl) {
      const res = await ohneAuth(monitorUrl, { method: 'GET' });
      // fertig leitet der Monitor teils auf das neue Item weiter (fetch folgt dem 303)
      if (res?.id && !res.status) return { status: 'completed', itemId: res.id, prozent: 100 };
      return { status: res?.status || null, itemId: res?.resourceId || null, prozent: res?.percentageComplete ?? null };
    },
  };
}

module.exports = { createSharePoint, itemZuEingang, ITEM_FELDER, ABO_TAGE, GraphError };
