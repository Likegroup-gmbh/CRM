// _shared/ablage/lesen.js
// Lesepfad: kurzlebige Links fuer Wiedergabe und Download (ablage-link), freie Ordner fuers Team.
// Sichtbarkeit ueber die Asset-ID mit dem JWT des Aufrufers (RLS), bei Mitarbeitern zusaetzlich
// die Zuordnung zur Kooperation. Dropbox-Zeilen bekommen wie bisher einen Temp-Link.

const { istUuid } = require('./konfig');
const { TABELLE } = require('./asset');
const { systemdatei } = require('./pfad');
const { istStaff, erlaubteKooperationen } = require('./zugriff');
const { AblageFehler } = require('./http');
const { createDropboxAblage } = require('./dropbox');
const dokument = require('./dokument');

const MAX_ITEMS = 100;
// Graph-downloadUrls gelten etwa eine Stunde; der Client erneuert 5 min vorher
const SP_GUELTIG_MS = 55 * 60 * 1000;
const DROPBOX_PARALLEL = 6;
const FREI_TIEFE = 3;
const FREI_MAX_DATEIEN = 300;
const VORFAHREN_MAX = 8;

const SPALTEN = {
  video: 'id, ablage, drive_id, item_id, file_path, video_id',
  story: 'id, ablage, drive_id, item_id, file_path, video_id',
  still: 'id, ablage, drive_id, item_id, file_path, kooperation_id, video_id',
  roh: 'id, ablage, drive_id, item_id, file_path, kooperation_id',
};

async function parallel(liste, n, fn) {
  let i = 0;
  const lauf = async () => {
    while (i < liste.length) {
      const idx = i++;
      await fn(liste[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, lauf));
}

/**
 * @param {{ supabase: object, ablage: object|null, dropbox?: object, jetzt?: () => number }} deps
 */
function createLesen({ supabase, ablage, dropbox = createDropboxAblage(), jetzt = () => Date.now() }) {
  const sp = ablage?.sp || null;
  const iso = (ms) => new Date(ms).toISOString();

  /** Kooperation je Zeile: Videos und Storys ueber video_id, Bilder/Rohmaterial direkt. */
  async function kooperationJeZeile(zeilen) {
    const videoIds = [...new Set(zeilen.filter((z) => !z.row.kooperation_id && z.row.video_id).map((z) => z.row.video_id))];
    const videoKoop = new Map();
    if (videoIds.length) {
      const { data, error } = await supabase.from('kooperation_videos').select('id, kooperation_id').in('id', videoIds);
      if (error) throw error;
      for (const v of data || []) videoKoop.set(v.id, v.kooperation_id);
    }
    return zeilen.map((z) => z.row.kooperation_id || videoKoop.get(z.row.video_id) || null);
  }

  /** Sichtbare Zeilen (RLS + Zuordnung) in der Reihenfolge der Anfrage. */
  async function sichtbareZeilen({ benutzer, caller }, items) {
    const jeTyp = new Map();
    for (const it of items) {
      if (!jeTyp.has(it.typ)) jeTyp.set(it.typ, []);
      jeTyp.get(it.typ).push(it.id);
    }
    const zeilen = [];
    for (const [typ, ids] of jeTyp) {
      const { data, error } = await caller.from(TABELLE[typ]).select(SPALTEN[typ]).in('id', [...new Set(ids)]);
      // Fehler einer Tabelle (z. B. Gast ohne Policy) heisst: nichts sichtbar
      if (error) continue;
      for (const row of data || []) zeilen.push({ typ, row });
    }
    if (!benutzer || !(benutzer.rolle === 'admin' || benutzer.rolle === 'mitarbeiter')) return zeilen;

    const koops = await kooperationJeZeile(zeilen);
    const erlaubt = await erlaubteKooperationen({ benutzer, caller }, koops);
    return zeilen.filter((_, i) => koops[i] && erlaubt.has(koops[i]));
  }

  // ─── Dokumente (ADR 0068): Sichtbarkeit nur ueber RLS der Fach-Zeile, keine Gaeste ───

  /** Kurzlebiger Link je Dokument-Zeile: SharePoint downloadUrl, Dropbox Temp-Link, Storage Signed URL. */
  async function dokumentLinks(zeilen) {
    const out = new Map();
    const ablauf = iso(jetzt() + SP_GUELTIG_MS);
    const mitQuelle = zeilen.map((z) => ({ ...z, q: dokument.quelleVon(z.typ, z.row) })).filter((z) => z.q);
    const spZeilen = mitQuelle.filter((z) => z.q.quelle === 'sharepoint' && sp && z.q.drive_id === sp.driveId);
    if (spZeilen.length) {
      const urls = await sp.downloadUrls([...new Set(spZeilen.map((z) => z.q.item_id))]);
      for (const z of spZeilen) {
        const url = urls.get(z.q.item_id);
        if (url) out.set(z.key, { url, laeuft_ab: ablauf });
      }
    }
    await parallel(mitQuelle.filter((z) => z.q.quelle !== 'sharepoint'), DROPBOX_PARALLEL, async (z) => {
      try {
        if (z.q.quelle === 'dropbox') {
          const l = await dropbox.downloadUrl(z.q.pfad);
          if (l?.url) out.set(z.key, { url: l.url, laeuft_ab: l.ablauf });
        } else if (z.q.quelle === 'storage') {
          const { data, error } = await supabase.storage.from(z.q.bucket).createSignedUrl(z.q.pfad, SP_GUELTIG_MS / 1000);
          if (!error && data?.signedUrl) out.set(z.key, { url: data.signedUrl, laeuft_ab: ablauf });
        } else if (z.q.url) {
          out.set(z.key, { url: z.q.url, laeuft_ab: null });
        }
      } catch (err) {
        console.warn('[ablage-link] Dokument:', z.typ, z.row.id, err.message);
      }
    });
    return out;
  }

  /** Sichtbare Dokument-Zeilen (Aufrufer-JWT). key = `${typ}:${id}` (Vertrag hat zwei Dateien). */
  async function sichtbareDokumente({ benutzer, caller }, items) {
    if (!benutzer || !caller || !items.length) return [];
    const jeTyp = new Map();
    for (const it of items) {
      if (!jeTyp.has(it.typ)) jeTyp.set(it.typ, new Set());
      jeTyp.get(it.typ).add(it.id);
    }
    const zeilen = [];
    for (const [typ, ids] of jeTyp) {
      const { data, error } = await caller.from(dokument.DOKUMENT[typ].tabelle).select(dokument.spaltenSelect(typ)).in('id', [...ids]);
      if (error) continue;
      for (const row of data || []) zeilen.push({ typ, row, key: `${typ}:${row.id}` });
    }
    return zeilen;
  }

  /**
   * { dokument_urls: [url] } -> { links: { [url]: { url, laeuft_ab } }, fehlend: [url] }
   * Fuer Render-Stellen, die nur die gespeicherte URL kennen (DocumentUrlHelper).
   */
  async function dokumentNachUrl({ benutzer, caller, body }) {
    const urls = [...new Set((body.dokument_urls || []).filter((u) => typeof u === 'string' && u))];
    if (!urls.length) throw new AblageFehler(400, 'dokument_urls fehlen');
    if (urls.length > 20) throw new AblageFehler(400, 'Hoechstens 20 Dokumente je Anfrage');
    if (!benutzer || !caller) return { links: {}, fehlend: urls };
    const zeilen = [];
    for (const typ of dokument.TYPEN) {
      const def = dokument.DOKUMENT[typ];
      const { data, error } = await caller.from(def.tabelle).select(dokument.spaltenSelect(typ))
        .in(def.spalten.url, urls).eq(def.spalten.ablage, 'sharepoint');
      if (error) continue;
      for (const row of data || []) zeilen.push({ typ, row, key: row[def.spalten.url] });
    }
    const gefunden = await dokumentLinks(zeilen);
    const out = {};
    for (const [key, link] of gefunden) out[key] = link;
    return { links: out, fehlend: urls.filter((u) => !out[u]) };
  }

  /**
   * { items: [{ typ, id }] } -> { links: { [id]: { url, laeuft_ab } }, fehlend: [id] }
   * Dokument-Typen: Schluessel `${typ}:${id}`.
   */
  async function links({ benutzer, caller, body }) {
    if (benutzer && (benutzer.rolle === 'admin' || benutzer.rolle === 'mitarbeiter') && !istStaff(benutzer)) {
      throw new AblageFehler(403, 'Konto nicht freigeschaltet');
    }
    if (body.dokument_urls) return dokumentNachUrl({ benutzer, caller, body });
    const items = body.items;
    if (!Array.isArray(items) || !items.length) throw new AblageFehler(400, 'items fehlen');
    if (items.length > MAX_ITEMS) throw new AblageFehler(400, `Hoechstens ${MAX_ITEMS} Dateien je Anfrage`);
    for (const it of items) {
      if (!it || !(TABELLE[it.typ] || dokument.istDokument(it.typ)) || !istUuid(it.id)) throw new AblageFehler(400, 'typ und id je Datei noetig');
    }

    const dokItems = items.filter((it) => dokument.istDokument(it.typ));
    const out = {};
    for (const [key, link] of await dokumentLinks(await sichtbareDokumente({ benutzer, caller }, dokItems))) out[key] = link;
    const medienItems = items.filter((it) => TABELLE[it.typ]);
    const zeilen = medienItems.length ? await sichtbareZeilen({ benutzer, caller }, medienItems) : [];

    const spZeilen = zeilen.filter((z) => z.row.ablage === 'sharepoint' && z.row.item_id);
    if (sp && spZeilen.length) {
      const eigene = spZeilen.filter((z) => z.row.drive_id === sp.driveId);
      const urls = await sp.downloadUrls([...new Set(eigene.map((z) => z.row.item_id))]);
      const ablauf = iso(jetzt() + SP_GUELTIG_MS);
      for (const z of eigene) {
        const url = urls.get(z.row.item_id);
        if (url) out[z.row.id] = { url, laeuft_ab: ablauf };
      }
    }

    const dbZeilen = zeilen.filter((z) => z.row.ablage !== 'sharepoint' && z.row.file_path);
    const proPfad = new Map();
    await parallel([...new Set(dbZeilen.map((z) => z.row.file_path))], DROPBOX_PARALLEL, async (pfad) => {
      proPfad.set(pfad, await dropbox.downloadUrl(pfad).catch((err) => {
        console.warn('[ablage-link] Dropbox:', pfad, err.message);
        return null;
      }));
    });
    for (const z of dbZeilen) {
      const l = proPfad.get(z.row.file_path);
      if (l?.url) out[z.row.id] = { url: l.url, laeuft_ab: l.ablauf };
    }

    const schluessel = (it) => (dokument.istDokument(it.typ) ? `${it.typ}:${it.id}` : it.id);
    const fehlend = [...new Set(items.map(schluessel))].filter((k) => !out[k]);
    return { links: out, fehlend };
  }

  async function nurStaffMitKooperation({ benutzer, caller }, kooperationId) {
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    const erlaubt = await erlaubteKooperationen({ benutzer, caller }, [kooperationId]);
    if (!erlaubt.has(kooperationId)) throw new AblageFehler(404, 'Kooperation nicht gefunden');
  }

  /** Inhalt eines freien Ordners, rekursiv bis FREI_TIEFE. */
  async function freiSammeln(wurzel, ordner, zaehler) {
    const stapel = [{ item: wurzel, pfad: wurzel.pfad, tiefe: 0 }];
    while (stapel.length) {
      const { item, pfad, tiefe } = stapel.shift();
      const eintrag = { item_id: item.id, name: item.name, pfad, web_url: item.webUrl || null, dateien: [] };
      ordner.push(eintrag);
      for (const k of await sp.kinder(item.id)) {
        if (k.folder) {
          if (tiefe + 1 <= FREI_TIEFE) stapel.push({ item: k, pfad: `${pfad}/${k.name}`, tiefe: tiefe + 1 });
          continue;
        }
        if (systemdatei(k.name) || zaehler.n >= FREI_MAX_DATEIEN) continue;
        zaehler.n++;
        eintrag.dateien.push({
          item_id: k.id, name: k.name, groesse: k.size ?? null, web_url: k.webUrl || null, geaendert_at: k.lastModifiedDateTime || null,
        });
      }
    }
  }

  /** { frei: { kooperation_id } } -> { ordner: [...] } (im Finder angelegte Ordner, nur intern) */
  async function frei({ benutzer, caller, body }) {
    const kooperationId = body.frei?.kooperation_id;
    if (!istUuid(kooperationId)) throw new AblageFehler(400, 'kooperation_id fehlt');
    await nurStaffMitKooperation({ benutzer, caller }, kooperationId);
    if (!sp) return { ordner: [] };

    const { data, error } = await supabase.from('ablage_ordner').select('item_id, parent_item_id, name, pfad')
      .eq('drive_id', sp.driveId).eq('art', 'frei').eq('kooperation_id', kooperationId)
      .is('geloescht_at', null).not('item_id', 'is', null);
    if (error) throw error;
    const ids = new Set((data || []).map((o) => o.item_id));
    // Unterordner eines freien Ordners kommen ueber dessen Rekursion
    const wurzeln = (data || []).filter((o) => !ids.has(o.parent_item_id)).sort((a, b) => String(a.pfad).localeCompare(String(b.pfad)));

    const ordner = [];
    const zaehler = { n: 0 };
    for (const w of wurzeln) {
      const item = await sp.item(w.item_id, 'id,name,webUrl,folder');
      if (!item?.folder) continue;
      await freiSammeln({ ...item, pfad: w.pfad || `/${w.name}` }, ordner, zaehler);
    }
    return { ordner };
  }

  /** Kooperation des naechsten freien Ordners ueber der Datei, sonst null. */
  async function freieKooperation(item) {
    let parentId = item.parentReference?.id;
    for (let i = 0; parentId && i < VORFAHREN_MAX; i++) {
      const { data: reg, error } = await supabase.from('ablage_ordner').select('art, kooperation_id')
        .eq('drive_id', sp.driveId).eq('item_id', parentId).is('geloescht_at', null).maybeSingle();
      if (error) throw error;
      if (reg) return reg.art === 'frei' ? reg.kooperation_id : null;
      const p = await sp.item(parentId, 'id,parentReference');
      parentId = p?.parentReference?.id;
    }
    return null;
  }

  /** { frei_datei: { item_id } } -> { url } */
  async function freiDatei({ benutzer, caller, body }) {
    const itemId = body.frei_datei?.item_id;
    if (typeof itemId !== 'string' || !itemId) throw new AblageFehler(400, 'item_id fehlt');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    if (!sp) throw new AblageFehler(404, 'Nicht gefunden');
    const item = await sp.item(itemId, 'id,name,file,parentReference');
    if (!item?.file) throw new AblageFehler(404, 'Nicht gefunden');
    const kooperationId = await freieKooperation(item);
    if (!kooperationId) throw new AblageFehler(404, 'Nicht gefunden');
    await nurStaffMitKooperation({ benutzer, caller }, kooperationId);
    const dl = await sp.downloadUrl(itemId);
    if (!dl?.url) throw new AblageFehler(404, 'Nicht gefunden');
    return { url: dl.url };
  }

  return { links, frei, freiDatei };
}

module.exports = { createLesen, MAX_ITEMS, SP_GUELTIG_MS };
