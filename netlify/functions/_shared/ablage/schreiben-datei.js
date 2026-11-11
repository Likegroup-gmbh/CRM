// _shared/ablage/schreiben-datei.js
// Schreibpfade auf bestehende SharePoint-Dateien: loeschen, umbenennen, einem anderen Video
// zuordnen (verschieben) und die Loeschkaskade einer Entitaet. `c` ist der Kontext aus
// createSchreiben.

const { istUuid } = require('./konfig');
const { TABELLE, TYPEN, weitereVerweise } = require('./asset');
const { mitZaehler } = require('./pfad');
const { darfMediaUpload, istStaff, sichtbar } = require('./zugriff');
const { AblageFehler } = require('./http');
const { stuecke } = require('./liste');
const { ordnerVon, endung, nichtKonfiguriert, kontextAusZeile, kontextPruefen } = require('./schreiben-kontext');

const ENTITAET = {
  unternehmen: { tabelle: 'unternehmen', art: 'unternehmen', spalte: 'unternehmen_id' },
  kampagne: { tabelle: 'kampagne', art: 'kampagne', spalte: 'kampagne_id' },
  kooperation: { tabelle: 'kooperationen', art: 'kooperation', spalte: 'kooperation_id' },
  video: { tabelle: 'kooperation_videos', art: 'video', spalte: 'kooperation_video_id' },
};

function createDateiSchreiben(c) {
  const { supabase, ablage, sp, driveId, jetzt, passenderName } = c;

  // ─── ablage-datei: loeschen ─────────────────────────────────

  async function dateiLoeschen({ benutzer, caller, body }) {
    const { typ, id } = body;
    if (!TYPEN.includes(typ) || !istUuid(id)) throw new AblageFehler(400, 'typ und id fehlen');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung zum Löschen');
    const row = await sichtbar(caller, TABELLE[typ], id, 'id, ablage, drive_id, item_id');
    if (!row) throw new AblageFehler(404, 'Datei nicht gefunden');
    if (row.ablage !== 'sharepoint' || !row.item_id) return { geloescht: false };
    if (!sp) throw nichtKonfiguriert();
    if (row.drive_id !== driveId) throw new AblageFehler(409, 'Datei liegt in einer anderen Bibliothek');
    if ((await weitereVerweise(supabase, row.drive_id, row.item_id, { ausser: { typ, id } })) > 0) return { geloescht: false };
    // Papierkorb (93 Tage); endgueltig nur ueber die Kaskade
    await sp.loeschen(row.item_id);
    return { geloescht: true };
  }

  // ─── ablage-datei: umbenennen ───────────────────────────────

  async function dateiUmbenennen({ benutzer, caller, body }) {
    const { typ, id } = body;
    if (!TYPEN.includes(typ) || !istUuid(id)) throw new AblageFehler(400, 'typ und id fehlen');
    if (!String(body.name || '').trim()) throw new AblageFehler(400, 'name fehlt');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung');
    const row = await sichtbar(caller, TABELLE[typ], id, 'id, ablage, drive_id, item_id, file_name, file_path');
    if (!row) throw new AblageFehler(404, 'Datei nicht gefunden');
    if (row.ablage !== 'sharepoint' || !row.item_id) throw new AblageFehler(409, 'Datei liegt nicht in SharePoint', 'nicht_sharepoint');
    if (!sp) throw nichtKonfiguriert();

    let wunsch = String(body.name).trim();
    if (!endung(wunsch) && endung(row.file_name)) wunsch += endung(row.file_name);
    wunsch = passenderName(ordnerVon(row.file_path), wunsch);
    if (wunsch === row.file_name) return { file_name: row.file_name, file_path: row.file_path, etag: null };

    let item = null;
    for (let n = 1; n <= 20 && !item; n++) {
      try {
        item = await sp.umbenennen(row.item_id, mitZaehler(wunsch, n));
      } catch (err) {
        if (err.status !== 409) throw err;
      }
    }
    if (!item) throw new AblageFehler(409, 'Kein freier Dateiname');

    const filePath = `${ordnerVon(row.file_path)}/${item.name}`;
    const patch = { file_name: item.name, file_path: filePath, etag: item.eTag || null };
    // Promote-Finals teilen das Item
    await supabase.from(TABELLE[typ]).update(patch).eq('drive_id', row.drive_id).eq('item_id', row.item_id);
    return patch;
  }

  // ─── ablage-datei: verschieben (Bild einem anderen Video zuordnen) ──

  async function dateiVerschieben({ benutzer, caller, body }) {
    const { typ, id } = body;
    if (typ !== 'still' || !istUuid(id)) throw new AblageFehler(400, 'typ still und id noetig');
    if (body.kooperation_video_id != null && !istUuid(body.kooperation_video_id)) throw new AblageFehler(400, 'kooperation_video_id ungültig');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung');
    const row = await sichtbar(caller, TABELLE[typ], id, 'id, ablage, drive_id, item_id, kooperation_id, video_id, version_number, is_final, variant_name, file_path');
    if (!row) throw new AblageFehler(404, 'Datei nicht gefunden');
    if (row.ablage !== 'sharepoint' || !row.item_id) throw new AblageFehler(409, 'Datei liegt nicht in SharePoint', 'nicht_sharepoint');
    if (!sp) throw nichtKonfiguriert();

    const ctx = await kontextPruefen(supabase, { ...kontextAusZeile(typ, row), kooperation_video_id: body.kooperation_video_id || null });
    // Ohne Video landet das Bild beim ersten Video der Kooperation
    const { ordner, kooperation_video_id: videoId } = await ablage.ordner.zielOrdner(ctx);
    ctx.kooperation_video_id = ctx.kooperation_video_id || videoId || null;
    const item = await sp.item(row.item_id, 'id,name,eTag,parentReference');
    if (!item) throw new AblageFehler(404, 'Datei ist nicht mehr in SharePoint');
    let ziel = item;
    if (item.parentReference?.id !== ordner.item_id) ziel = await sp.verschieben(row.item_id, ordner.item_id, { conflict: 'rename' });

    const patch = { file_name: ziel.name, file_path: `${ordner.pfad}/${ziel.name}`, etag: ziel.eTag || null };
    // Zuordnung gleich mit: sonst saehe der Abgleich die Datei im Ordner eines anderen Videos
    const { error } = await supabase.from(TABELLE[typ]).update({ ...patch, video_id: ctx.kooperation_video_id })
      .eq('drive_id', row.drive_id).eq('item_id', row.item_id);
    if (error) throw error;
    return { ...patch, video_id: ctx.kooperation_video_id };
  }

  // ─── ablage-loeschen: Kaskade einer Entitaet ────────────────

  async function ids(tabelle, spalte, werte) {
    const out = [];
    for (const teil of stuecke(werte)) {
      if (!teil.length) continue;
      const { data, error } = await supabase.from(tabelle).select('id').in(spalte, teil);
      if (error) throw error;
      out.push(...(data || []).map((r) => r.id));
    }
    return out;
  }

  async function spDateien(tabelle, spalte, werte) {
    const out = [];
    for (const teil of stuecke(werte)) {
      if (!teil.length) continue;
      const { data, error } = await supabase.from(tabelle).select('id, drive_id, item_id, file_path')
        .in(spalte, teil).eq('ablage', 'sharepoint');
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }

  /** Alle SharePoint-Dateien einer Entitaet, auch ausserhalb ihrer Ordner. */
  async function dateienFuer(entity, id) {
    let koops = [];
    let videos = [];
    if (entity === 'video') videos = [id];
    else {
      if (entity === 'kooperation') koops = [id];
      if (entity === 'kampagne') koops = await ids('kooperationen', 'kampagne_id', [id]);
      if (entity === 'unternehmen') koops = await ids('kooperationen', 'kampagne_id', await ids('kampagne', 'unternehmen_id', [id]));
      videos = await ids('kooperation_videos', 'kooperation_id', koops);
    }
    const listen = await Promise.all([
      spDateien(TABELLE.video, 'video_id', videos),
      spDateien(TABELLE.story, 'video_id', videos),
      entity === 'video' ? spDateien(TABELLE.still, 'video_id', videos) : spDateien(TABELLE.still, 'kooperation_id', koops),
      spDateien(TABELLE.roh, 'kooperation_id', koops),
    ]);
    const gesehen = new Set();
    return listen.flat().filter((r) => r.drive_id === driveId && r.item_id && !gesehen.has(r.item_id) && gesehen.add(r.item_id));
  }

  async function endgueltig(itemId) {
    try {
      return await sp.endgueltigLoeschen(itemId);
    } catch (err) {
      // permanentDelete nicht verfuegbar: wenigstens in den Papierkorb
      if ([400, 403, 405, 501].includes(err.status)) return sp.loeschen(itemId);
      throw err;
    }
  }

  async function alsGeloeschtMarkieren(itemIds) {
    const stand = jetzt().toISOString();
    for (const teil of stuecke(itemIds)) {
      await supabase.from('ablage_ordner').update({ geloescht_at: stand, updated_at: stand }).eq('drive_id', driveId).in('item_id', teil);
      await supabase.from('ablage_eingang').update({ geloescht: true, status: 'erledigt', erledigt_at: stand }).eq('drive_id', driveId).in('item_id', teil);
    }
  }

  async function entityLoeschen({ benutzer, caller, body }) {
    const e = ENTITAET[body.entity];
    if (!e || !istUuid(body.id)) throw new AblageFehler(400, 'entity und id fehlen');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    if (!sp) return { ordner: 0, dateien: 0, fehler: [], nicht_konfiguriert: true };
    if (!(await sichtbar(caller, e.tabelle, body.id))) throw new AblageFehler(404, 'Nicht gefunden');

    const { data: ordner, error } = await supabase.from('ablage_ordner').select('id, item_id, pfad')
      .eq('drive_id', driveId).eq('art', e.art).eq(e.spalte, body.id).is('geloescht_at', null).not('item_id', 'is', null);
    if (error) throw error;
    const dateien = await dateienFuer(body.entity, body.id);

    const fehler = [];
    const weg = [];
    let nOrdner = 0;
    for (const o of ordner || []) {
      try {
        const { data: kinder } = await supabase.rpc('ablage_nachfahren', { p_drive_id: driveId, p_item_id: o.item_id });
        await endgueltig(o.item_id);
        weg.push(o);
        await alsGeloeschtMarkieren([o.item_id, ...(kinder || []).map((k) => k.item_id)]);
        nOrdner++;
      } catch (err) {
        fehler.push({ item_id: o.item_id, pfad: o.pfad, fehler: err.message });
      }
    }

    const unter = (pfad) => weg.some((o) => o.pfad && pfad && (pfad === o.pfad || pfad.startsWith(`${o.pfad}/`)));
    let nDateien = 0;
    const einzeln = [];
    for (const d of dateien) {
      if (unter(d.file_path)) { nDateien++; continue; }
      try {
        await endgueltig(d.item_id);
        einzeln.push(d.item_id);
        nDateien++;
      } catch (err) {
        fehler.push({ item_id: d.item_id, pfad: d.file_path, fehler: err.message });
      }
    }
    if (einzeln.length) await alsGeloeschtMarkieren(einzeln);
    return { ordner: nOrdner, dateien: nDateien, fehler };
  }

  return { dateiLoeschen, dateiUmbenennen, dateiVerschieben, entityLoeschen };
}

module.exports = { createDateiSchreiben };
