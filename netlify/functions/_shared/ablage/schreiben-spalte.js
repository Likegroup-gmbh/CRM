// _shared/ablage/schreiben-spalte.js
// Upload-Ziel fuer Upload-Spalten der Kampagne (custom_columns, field_type = 'upload').
// Die Datei landet im Spalten-Ordner der Kooperation (ordner-spalte.js), die Zeile in
// custom_column_assets schreibt der Client nach dem Commit. Kooperation und Video leitet
// der Server aus Spalte und Zeile ab, der Body nennt nur Spalte und Entitaet.

const { MAX_BYTES, GIB, istUuid } = require('./konfig');
const { ladeKooperation } = require('./kooperation');
const { SPALTE_SELECT } = require('./ordner-spalte');
const { darfMediaUpload, sichtbar } = require('./zugriff');
const { AblageFehler } = require('./http');
const { ordnerVon, nichtKonfiguriert } = require('./schreiben-kontext');
const { sessionEroeffnen, ersetzenKontext } = require('./schreiben-session');

function createSpalteSchreiben(c) {
  const { supabase, ablage, sp, driveId, passenderName, webUrl } = c;

  /** Spalte, Kooperation und (Spalte auf Videoebene) Video der Zelle, sichtbar fuer den Aufrufer. */
  async function zelle(caller, body) {
    if (!istUuid(body.custom_column_id) || !istUuid(body.entity_id)) throw new AblageFehler(400, 'custom_column_id und entity_id fehlen');
    const spalte = await sichtbar(caller, 'custom_columns', body.custom_column_id, SPALTE_SELECT);
    if (!spalte) throw new AblageFehler(404, 'Spalte nicht gefunden');
    if (spalte.field_type !== 'upload') throw new AblageFehler(400, 'Spalte ist keine Upload-Spalte');

    let video = null;
    let kooperationId = body.entity_id;
    if (spalte.entity_type === 'video') {
      video = await sichtbar(caller, 'kooperation_videos', body.entity_id, 'id, kooperation_id, position, thema');
      if (!video) throw new AblageFehler(404, 'Video nicht gefunden');
      kooperationId = video.kooperation_id;
    } else if (!(await sichtbar(caller, 'kooperationen', body.entity_id))) {
      throw new AblageFehler(404, 'Kooperation nicht gefunden');
    }
    const koop = await ladeKooperation(supabase, kooperationId);
    if (!koop) throw new AblageFehler(404, 'Kooperation nicht gefunden');
    if (koop.kampagne_id !== spalte.kampagne_id) throw new AblageFehler(400, 'Spalte gehört zu einer anderen Kampagne');
    return { spalte, video, koop };
  }

  async function altLaden(caller, body) {
    if (!body.ersetzen) return null;
    if (!istUuid(body.ersetzen.id)) throw new AblageFehler(400, 'ersetzen.id fehlt');
    const alt = await sichtbar(caller, 'custom_column_assets', body.ersetzen.id, '*');
    if (!alt || alt.custom_column_id !== body.custom_column_id || alt.entity_id !== body.entity_id) {
      throw new AblageFehler(404, 'Datei nicht gefunden');
    }
    return alt;
  }

  /**
   * body: { typ:'spalte', custom_column_id, entity_id, file_name, file_size, ersetzen?: { typ:'spalte', id } }
   *   entity_id: Kooperation bzw. Video, je nach Ebene der Spalte
   */
  async function uploadZiel({ benutzer, caller, body }) {
    if (!sp) throw nichtKonfiguriert();
    const fileName = String(body.file_name || '').trim();
    const fileSize = Number(body.file_size);
    if (!fileName || !(fileSize > 0)) throw new AblageFehler(400, 'Datei fehlt oder ist leer');
    if (!darfMediaUpload(benutzer)) throw new AblageFehler(403, 'Keine Berechtigung zum Hochladen');
    if (fileSize > MAX_BYTES.spalte) {
      throw new AblageFehler(413, `Datei zu groß (max. ${Math.round(MAX_BYTES.spalte / GIB)} GB)`, 'zu_gross', { max_bytes: MAX_BYTES.spalte });
    }

    const { spalte, video, koop } = await zelle(caller, body);
    const alt = await altLaden(caller, body);
    const ctx = {
      typ: 'spalte',
      kooperation_id: koop.id,
      kooperation_video_id: video?.id || null,
      custom_column_id: spalte.id,
      entity_id: body.entity_id,
    };

    // Ersetzen einer SharePoint-Datei: neue Version desselben Items; Altbestand (Dropbox) kommt neu in den Ordner
    const altItem = alt?.ablage === 'sharepoint' && alt.drive_id === driveId && alt.item_id
      ? await sp.item(alt.item_id, 'id,name,parentReference,webUrl')
      : null;
    const { ordner: zielOrdner } = await ablage.ordner.spalteZiel(ctx, { koop, spalte, video });
    let ordner = zielOrdner;
    if (altItem) {
      const parentId = altItem.parentReference?.id;
      const reg = await ablage.ordner.nachItem(parentId);
      ordner = { item_id: parentId, pfad: reg?.pfad ?? ordnerVon(alt.file_path) };
    }

    const name = passenderName(ordner.pfad, fileName);
    const [ordnerUrl, linkUrl] = await Promise.all([
      webUrl(ordner.item_id),
      zielOrdner.item_id !== ordner.item_id ? webUrl(zielOrdner.item_id) : Promise.resolve(null),
    ]);
    const kontext = {
      ...ctx,
      ordner_pfad: ordner.pfad,
      link_item_id: zielOrdner.item_id,
      link_url: linkUrl || ordnerUrl,
      ...(alt ? { ersetzen: { typ: 'spalte', id: alt.id, ablage: alt.ablage, file_path: alt.file_path } } : {}),
      ...ersetzenKontext(altItem, name),
    };
    return sessionEroeffnen(c, { benutzer, typ: 'spalte', ordner, name, groesse: fileSize, kontext, altItem, ordnerUrl });
  }

  return { uploadZiel };
}

module.exports = { createSpalteSchreiben };
