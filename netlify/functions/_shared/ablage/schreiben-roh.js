// _shared/ablage/schreiben-roh.js
// Rohmaterial im CRM (ADR 0070): Unterordner anlegen und Dateien in eine Feedbackschleife
// verschieben. Aus Rohmaterial wird dabei ein Video oder Bild der Runde (Typ aus der Endung).
// `c` ist der Kontext aus createSchreiben.

const { istUuid } = require('./konfig');
const { TABELLE, dateiSpalten, fachSpalten, upsert, entfernenNachItem } = require('./asset');
const { dateiTyp } = require('./pfad');
const { zielFuerKooperation } = require('./ziel');
const { darfMediaUpload, sichtbar } = require('./zugriff');
const { AblageFehler } = require('./http');
const { nichtKonfiguriert } = require('./schreiben-kontext');
const { SCHLEIFEN } = require('./ordner');

const MAX_TIEFE = 5;
// Je Datei Graph-Move plus DB-Wechsel: mehr passt nicht sicher in ein Function-Timeout
const MAX_VERSCHIEBEN = 20;
const titelAusDateiname = (name) => String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 120) || null;

function createRohSchreiben(c) {
  const { supabase, ablage, sp, driveId, jetzt, passenderName } = c;

  async function sharePointKooperation(caller, kooperationId) {
    if (!(await sichtbar(caller, 'kooperationen', kooperationId))) throw new AblageFehler(404, 'Kooperation nicht gefunden');
    const { ziel, koop } = await zielFuerKooperation(supabase, kooperationId);
    if (!koop) throw new AblageFehler(404, 'Kooperation nicht gefunden');
    if (ziel !== 'sharepoint' || !sp) throw new AblageFehler(409, 'Für diese Kooperation ist SharePoint nicht aktiv', 'nicht_sharepoint');
    return koop;
  }

  // ─── ablage-datei: ordner_anlegen ───────────────────────────

  /** { kooperation_id, name, parent_item_id? } -> { ordner: { item_id, parent_item_id, name, pfad } } */
  async function rohOrdnerAnlegen({ benutzer, caller, body }) {
    const kooperationId = body.kooperation_id;
    if (!istUuid(kooperationId)) throw new AblageFehler(400, 'kooperation_id fehlt');
    if (!String(body.name || '').trim()) throw new AblageFehler(400, 'Ordnername fehlt');
    if (body.parent_item_id != null && typeof body.parent_item_id !== 'string') throw new AblageFehler(400, 'parent_item_id ungültig');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung');
    const koop = await sharePointKooperation(caller, kooperationId);

    const { ordner: wurzel } = await ablage.ordner.zielOrdner({ typ: 'roh', kooperation_id: kooperationId }, { koop });
    let eltern = wurzel;
    if (body.parent_item_id && body.parent_item_id !== wurzel.item_id) {
      eltern = await ablage.ordner.rohOrdnerVon(kooperationId, body.parent_item_id);
      if (!eltern) throw new AblageFehler(404, 'Ordner nicht gefunden');
      const tiefe = String(eltern.pfad || '').slice(String(wurzel.pfad || '').length).split('/').filter(Boolean).length;
      if (tiefe >= MAX_TIEFE) throw new AblageFehler(400, `Höchstens ${MAX_TIEFE} Ordner-Ebenen im Rohmaterial`, 'zu_tief');
    }
    // Wirft pfad_zu_lang, wenn darin keine Datei mehr Platz hätte
    passenderName(`${eltern.pfad || ''}/${String(body.name).trim()}`, 'datei.mov');

    let row;
    try {
      row = await ablage.ordner.rohUnterordner(eltern, body.name);
    } catch (err) {
      if (err.status === 409) throw new AblageFehler(409, err.message, 'name_belegt');
      throw err;
    }
    return { ordner: { item_id: row.item_id, parent_item_id: row.parent_item_id, name: row.name, pfad: row.pfad } };
  }

  // ─── ablage-datei: roh_verschieben ──────────────────────────

  async function einzelnVerschieben(row, { video, version, benutzer, runde }) {
    if (!row) throw new AblageFehler(404, 'Datei nicht gefunden');
    if (row.kooperation_id !== video.kooperation_id) throw new AblageFehler(409, 'Datei gehört zu einer anderen Kooperation');
    if (row.ablage !== 'sharepoint' || !row.item_id) throw new AblageFehler(409, 'Datei liegt nicht in SharePoint', 'nicht_sharepoint');
    if (row.drive_id !== driveId) throw new AblageFehler(409, 'Datei liegt in einer anderen Bibliothek');
    // Ohne Video- oder Bild-Endung zoege der Abgleich die Datei ins Rohmaterial zurueck
    const typ = dateiTyp(row.file_name);
    if (!typ) throw new AblageFehler(422, 'Nur Videos und Bilder können in eine Feedbackschleife', 'dateityp');

    const ordner = await runde();
    const item = await sp.item(row.item_id);
    if (!item) throw new AblageFehler(404, 'Datei ist nicht mehr in SharePoint');
    const ziel = item.parentReference?.id === ordner.item_id
      ? item
      : { ...item, ...(await sp.verschieben(row.item_id, ordner.item_id, { conflict: 'rename' })) };

    const ctx = { kooperation_id: video.kooperation_id, kooperation_video_id: video.id, version_number: version, is_final: false, variant_name: null };
    const werte = {
      ...dateiSpalten(ziel, { driveId, pfad: `${ordner.pfad}/${ziel.name}` }),
      ...fachSpalten(typ, ctx),
      titel: row.titel || titelAusDateiname(ziel.name),
    };
    // Der Abgleich sieht den Move auch und macht denselben Wechsel: upsert und Entfernen sind idempotent
    const { row: neu } = await upsert(supabase, typ, werte, { uploadedBy: row.uploaded_by || benutzer.id || null, jetzt: jetzt().toISOString() });
    await entfernenNachItem(supabase, 'roh', row.drive_id, row.item_id);
    return { typ, asset_id: neu.id, file_name: neu.file_name, file_path: neu.file_path };
  }

  /**
   * { ids: [roh-id], kooperation_video_id, version_number } -> { ergebnisse: [{ id, ok, typ?, asset_id?, fehler?, code? }] }
   * Teilfehler brechen nicht ab; jede Datei bekommt ihr Ergebnis.
   */
  async function rohVerschieben({ benutzer, caller, body }) {
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids : [])];
    if (!ids.length || !ids.every(istUuid)) throw new AblageFehler(400, 'ids fehlen');
    if (ids.length > MAX_VERSCHIEBEN) throw new AblageFehler(400, `Höchstens ${MAX_VERSCHIEBEN} Dateien je Anfrage`);
    if (!istUuid(body.kooperation_video_id)) throw new AblageFehler(400, 'kooperation_video_id fehlt');
    const version = Number(body.version_number);
    if (!SCHLEIFEN.includes(version)) throw new AblageFehler(400, `Feedbackschleife ${SCHLEIFEN[0]} bis ${SCHLEIFEN[SCHLEIFEN.length - 1]}`);
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung');
    if (!sp) throw nichtKonfiguriert();

    const { data: video, error: vErr } = await supabase.from('kooperation_videos').select('id, kooperation_id').eq('id', body.kooperation_video_id).maybeSingle();
    if (vErr) throw vErr;
    if (!video) throw new AblageFehler(404, 'Video nicht gefunden');
    const koop = await sharePointKooperation(caller, video.kooperation_id);

    const { data: rows, error } = await caller.from(TABELLE.roh)
      .select('id, ablage, drive_id, item_id, kooperation_id, file_name, titel, uploaded_by').in('id', ids);
    if (error) throw error;
    const nachId = new Map((rows || []).map((r) => [r.id, r]));

    // Videos und Bilder liegen flach in derselben Runde: Ordner einmal bestimmen
    let rundeOrdner = null;
    const runde = async () => {
      rundeOrdner ??= (await ablage.ordner.zielOrdner({ typ: 'video', kooperation_id: video.kooperation_id, kooperation_video_id: video.id, version_number: version, is_final: false }, { koop })).ordner;
      return rundeOrdner;
    };

    const ergebnisse = [];
    for (const id of ids) {
      try {
        ergebnisse.push({ id, ok: true, ...(await einzelnVerschieben(nachId.get(id), { video, version, benutzer, runde })) });
      } catch (err) {
        if (!(err instanceof AblageFehler)) console.error('[ablage-datei] roh_verschieben:', id, err.message || err);
        ergebnisse.push({ id, ok: false, fehler: err instanceof AblageFehler ? err.message : 'Verschieben fehlgeschlagen', code: err.code || null });
      }
    }
    return { ergebnisse };
  }

  return { rohOrdnerAnlegen, rohVerschieben };
}

module.exports = { createRohSchreiben, MAX_TIEFE, MAX_VERSCHIEBEN };
