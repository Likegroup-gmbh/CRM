// _shared/ablage/schreiben.js
// Schreibpfade CRM -> SharePoint: Upload-Ziel, Commit, Verwerfen. Datei loeschen/umbenennen/
// verschieben und die Loeschkaskade einer Entitaet liegen in schreiben-datei.js.
// Die Asset-Zeile legt der Client nach dem Commit an; bis dahin haelt ablage_upload die Datei
// fest, damit der Abgleich keine zweite Zeile anlegt.

const { CHUNK_BYTES, MAX_BYTES, GIB, istUuid } = require('./konfig');
const { TABELLE, TYPEN, weitereVerweise } = require('./asset');
const { zielFuerKooperation } = require('./ziel');
const { dateiname, mitZaehler, MAX_PFAD } = require('./pfad');
const { darfMediaUpload, istAdmin, sichtbar } = require('./zugriff');
const { AblageFehler } = require('./http');
const { ordnerVon, endung, nichtKonfiguriert, kontextAusBody, kontextAusZeile, kontextPruefen } = require('./schreiben-kontext');
const { createDateiSchreiben } = require('./schreiben-datei');
const { createDokumentSchreiben } = require('./schreiben-dokument');
const { istDokument, verweise: dokumentVerweise } = require('./dokument');
const { dropboxUpload } = require('./schalter');

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object|null} deps.ablage ablageAusEnv() (null = nicht konfiguriert)
 */
function createSchreiben({ supabase, ablage, jetzt = () => new Date() }) {
  const sp = ablage?.sp;
  const driveId = sp?.driveId;

  // Pfadlaenge zaehlt in SharePoint ab der Site (/sites/<name>/<Bibliothek>/...)
  const sitePfadLaenge = (() => {
    try { return new URL(ablage?.konfig?.siteUrl || 'https://x').pathname.length + '/Videos'.length; } catch { return 30; }
  })();

  async function webUrl(itemId) {
    const it = await sp.item(itemId, 'id,webUrl');
    return it?.webUrl || null;
  }

  async function ladeUpload(id) {
    const { data, error } = await supabase.from('ablage_upload').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Datei eines Uploads ohne bekannte item_id (Antwort aufs letzte Stueck verloren):
   * gleicher Name oder Konflikt-Name "name N.ext", gleiche Groesse, nach dem Upload-Start angelegt.
   */
  async function uploadFinden(up) {
    if (up.item_id) return sp.item(up.item_id);
    const direkt = await sp.kindNachName(up.parent_item_id, up.name);
    if (direkt?.file && Number(direkt.size) === Number(up.groesse) && !vorUpload(direkt, up)) return direkt;
    const ext = endung(up.name);
    const basis = ext ? up.name.slice(0, -ext.length) : up.name;
    const muster = new RegExp(`^${basis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const kinder = await sp.kinder(up.parent_item_id, 'id,name,size,eTag,cTag,webUrl,file,parentReference,createdDateTime');
    const treffer = kinder.filter((k) => k.file && Number(k.size) === Number(up.groesse) && muster.test(k.name) && !vorUpload(k, up));
    return treffer.length === 1 ? sp.item(treffer[0].id) : null;
  }

  function vorUpload(item, up) {
    const angelegt = Date.parse(item.createdDateTime || '');
    const start = Date.parse(up.erstellt_at || '');
    return Number.isFinite(angelegt) && Number.isFinite(start) && angelegt < start - 60000;
  }

  function eigenerUpload(up, benutzer) {
    if (up.erstellt_von && up.erstellt_von !== benutzer?.id && !istAdmin(benutzer)) {
      throw new AblageFehler(403, 'Upload gehört einem anderen Benutzer');
    }
  }

  function passenderName(ordnerPfad, roh) {
    const frei = MAX_PFAD - sitePfadLaenge - String(ordnerPfad || '').length - 1;
    if (frei < 20) throw new AblageFehler(400, 'Ordnerpfad ist zu lang für SharePoint', 'pfad_zu_lang');
    return dateiname(roh, Math.min(frei, 100));
  }

  // ─── ablage-upload-ziel ─────────────────────────────────────

  async function uploadZiel({ benutzer, caller, body }) {
    // Vor zielFuerKooperation: KOOP_SELECT liest unternehmen.ablage_ziel
    if (dropboxUpload()) return { ziel: 'dropbox' };
    if (istDokument(body.typ)) return dok.uploadZiel({ benutzer, caller, body });
    const typ = body.ersetzen?.typ || body.typ;
    if (!TYPEN.includes(typ)) throw new AblageFehler(400, 'Unbekannter Typ');
    if (!istUuid(body.kooperation_id)) throw new AblageFehler(400, 'kooperation_id fehlt');
    const fileName = String(body.file_name || '').trim();
    const fileSize = Number(body.file_size);
    if (!fileName || !(fileSize > 0)) throw new AblageFehler(400, 'Datei fehlt oder ist leer');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung zum Hochladen');
    if (!(await sichtbar(caller, 'kooperationen', body.kooperation_id))) throw new AblageFehler(404, 'Kooperation nicht gefunden');

    let alt = null;
    if (body.ersetzen) {
      if (!istUuid(body.ersetzen.id)) throw new AblageFehler(400, 'ersetzen.id fehlt');
      alt = await sichtbar(caller, TABELLE[typ], body.ersetzen.id, '*');
      if (!alt) throw new AblageFehler(404, 'Datei nicht gefunden');
    }

    const { ziel, koop } = await zielFuerKooperation(supabase, body.kooperation_id);
    if (!koop) throw new AblageFehler(404, 'Kooperation nicht gefunden');
    if (ziel !== 'sharepoint' || !sp) {
      // Eine SharePoint-Datei per Dropbox zu ersetzen hinterliesse eine Zeile mit ablage=sharepoint und Dropbox-Pfad
      if (alt?.ablage === 'sharepoint') {
        throw new AblageFehler(503, 'SharePoint ist gerade abgeschaltet – Ersetzen bitte später erneut versuchen', 'notschalter');
      }
      return { ziel: 'dropbox' };
    }
    if (fileSize > MAX_BYTES[typ]) {
      throw new AblageFehler(413, `Datei zu groß (max. ${Math.round(MAX_BYTES[typ] / GIB)} GB)`, 'zu_gross', { max_bytes: MAX_BYTES[typ] });
    }

    const ctx = await kontextPruefen(supabase, alt ? kontextAusZeile(typ, alt, body.kooperation_id) : kontextAusBody(typ, body));

    // Ersetzen einer SharePoint-Datei: neue Version desselben Items (Versionsverlauf behaelt die alte)
    let altItem = null;
    if (alt?.ablage === 'sharepoint' && alt.drive_id === driveId && alt.item_id) {
      altItem = await sp.item(alt.item_id, 'id,name,parentReference,webUrl');
    }

    let ordner;
    let link;
    if (altItem) {
      const parentId = altItem.parentReference?.id;
      const reg = await ablage.ordner.nachItem(parentId);
      ordner = { item_id: parentId, pfad: reg?.pfad ?? ordnerVon(alt.file_path) };
      ({ link } = await ablage.ordner.zielOrdner(ctx, { koop }));
    } else {
      let videoId;
      ({ ordner, link, kooperation_video_id: videoId } = await ablage.ordner.zielOrdner(ctx, { koop }));
      // Bild ohne Video liegt jetzt im Ordner des ersten Videos und haengt auch dort
      if (ctx.typ === 'still' && !ctx.kooperation_video_id && videoId) ctx.kooperation_video_id = videoId;
    }

    const name = passenderName(ordner.pfad, fileName);
    const session = altItem
      ? await sp.uploadSessionFuerItem(altItem.id)
      : await sp.uploadSession(ordner.item_id, name, { conflict: 'rename' });

    const [ordnerUrl, linkUrl] = await Promise.all([
      webUrl(ordner.item_id),
      link && link.item_id !== ordner.item_id ? webUrl(link.item_id) : Promise.resolve(null),
    ]);

    const kontext = {
      ...ctx,
      ordner_pfad: ordner.pfad,
      link_item_id: link?.item_id || ordner.item_id,
      link_url: linkUrl || ordnerUrl,
      ...(alt ? { ersetzen: { typ, id: alt.id, ablage: alt.ablage, file_path: alt.file_path } } : {}),
      ...(altItem ? { gleiches_item: true, umbenennen_auf: name !== altItem.name ? name : null } : {}),
    };

    const { data: up, error } = await supabase
      .from('ablage_upload')
      .insert({
        drive_id: driveId,
        parent_item_id: ordner.item_id,
        name,
        groesse: fileSize,
        typ,
        kontext,
        item_id: altItem?.id || null,
        erstellt_von: benutzer.id,
      })
      .select('id')
      .single();
    if (error) {
      await sp.sessionVerwerfen(session.uploadUrl).catch(() => {});
      throw error;
    }

    return {
      ziel: 'sharepoint',
      upload_id: up.id,
      upload_url: session.uploadUrl,
      chunk_bytes: CHUNK_BYTES,
      file_name: name,
      ordner: { item_id: ordner.item_id, pfad: ordner.pfad, web_url: ordnerUrl },
    };
  }

  // ─── ablage-upload-commit ───────────────────────────────────

  async function uploadCommit({ benutzer, body }) {
    if (!sp) throw nichtKonfiguriert();
    if (!istUuid(body.upload_id)) throw new AblageFehler(400, 'upload_id fehlt');
    const up = await ladeUpload(body.upload_id);
    if (!up) throw new AblageFehler(404, 'Upload nicht gefunden');
    eigenerUpload(up, benutzer);
    if (up.drive_id !== driveId) throw new AblageFehler(409, 'Upload gehört zu einer anderen Bibliothek');
    if (up.item_id && body.item_id && up.item_id !== body.item_id) throw new AblageFehler(409, 'Upload gehört zu einer anderen Datei');

    // Ohne item_id: Client hat die Antwort aufs letzte Stueck verloren (404 beim Retry)
    let item = body.item_id ? await sp.item(body.item_id) : await uploadFinden(up);
    if (!item || item.deleted) throw new AblageFehler(404, 'Datei ist nicht in SharePoint angekommen');
    if (!item.file) throw new AblageFehler(409, 'Keine Datei');
    if (item.parentReference?.id !== up.parent_item_id) throw new AblageFehler(409, 'Datei liegt nicht im Zielordner');

    const k = up.kontext || {};
    if (k.umbenennen_auf && item.name !== k.umbenennen_auf) {
      for (let n = 1; n <= 5; n++) {
        try {
          item = { ...item, ...(await sp.umbenennen(item.id, mitZaehler(k.umbenennen_auf, n))) };
          break;
        } catch (err) {
          if (err.status !== 409) throw err;
        }
      }
    }

    const filePath = `${k.ordner_pfad || ''}/${item.name}`;
    const { error } = await supabase
      .from('ablage_upload')
      .update({ item_id: item.id, abgeschlossen_at: jetzt().toISOString(), kontext: { ...k, file_path: filePath } })
      .eq('id', up.id);
    if (error) throw error;

    return {
      ablage: 'sharepoint',
      drive_id: driveId,
      item_id: item.id,
      etag: item.eTag || null,
      ctag: item.cTag || null,
      file_path: filePath,
      file_name: item.name,
      file_size: item.size ?? up.groesse,
      file_url: item.webUrl || null,
      folder_url: k.link_url || null,
      video_id: k.kooperation_video_id || null,
      breite: item.video?.width ?? item.image?.width ?? null,
      hoehe: item.video?.height ?? item.image?.height ?? null,
    };
  }

  // ─── ablage-datei: upload_verwerfen ─────────────────────────

  async function uploadVerwerfen({ benutzer, body }) {
    if (!istUuid(body.upload_id)) throw new AblageFehler(400, 'upload_id fehlt');
    const up = await ladeUpload(body.upload_id);
    if (!up) return { ok: true };
    eigenerUpload(up, benutzer);

    // Beim Ersetzen gehoert das Item der bestehenden Zeile: nie loeschen
    if (sp && !up.kontext?.gleiches_item) {
      // Bytes kamen an, der Commit nicht: Datei ueber Name + Groesse finden
      const itemId = up.item_id || (await uploadFinden(up))?.id;
      if (itemId && (await weitereVerweise(supabase, up.drive_id, itemId)) + (await dokumentVerweise(supabase, up.drive_id, itemId)) === 0) {
        await sp.loeschen(itemId);
      }
    }
    await supabase.from('ablage_upload').delete().eq('id', up.id);
    return { ok: true };
  }

  const datei = createDateiSchreiben({ supabase, ablage, sp, driveId, jetzt, passenderName });
  const dok = createDokumentSchreiben({ supabase, ablage, sp, driveId, passenderName, webUrl });

  // Dokument-Typen (ADR 0068) haben eigene Loesch- und Namensregeln
  const dateiLoeschen = (ctx) => (istDokument(ctx.body?.typ) ? dok.dateiLoeschen(ctx) : datei.dateiLoeschen(ctx));
  const dateiUmbenennen = (ctx) => (istDokument(ctx.body?.typ) ? dok.dateiUmbenennen(ctx) : datei.dateiUmbenennen(ctx));

  return { uploadZiel, uploadCommit, uploadVerwerfen, ...datei, dateiLoeschen, dateiUmbenennen };
}

module.exports = { createSchreiben, kontextAusBody, kontextAusZeile };
