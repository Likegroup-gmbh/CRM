// _shared/ablage/schreiben-dokument.js
// Schreibpfade fuer Dokumente (ADR 0068): Upload-Ziel, Loeschen, Umbenennen. Commit und
// Verwerfen teilen sich die Medien-Wege ueber ablage_upload. Die Zeile bzw. den Dateisatz
// schreibt der Client nach dem Commit (src/core/ablage/dokumentAblage.js); bleibt das aus,
// traegt der Abgleich die Datei nach 10 Minuten aus dem Upload-Kontext ein.
// Hochladen und Loeschen darf das interne Team (auch Finanzen: Rechnungen sind ihr Kerngeschaeft),
// sichtbar sein muss der Bezug fuer den Aufrufer (RLS).

const { CHUNK_BYTES, istUuid } = require('./konfig');
const { weitereVerweise } = require('./asset');
const { mitZaehler } = require('./pfad');
const { istStaff, sichtbar } = require('./zugriff');
const { AblageFehler } = require('./http');
const { ordnerVon, endung, nichtKonfiguriert } = require('./schreiben-kontext');
const dokument = require('./dokument');

const { DOKUMENT, BEZUG_TABELLE, MAX_BYTES, AUFTRAG_DOKUMENT_TYPEN } = dokument;
const MIB = 1024 * 1024;

function createDokumentSchreiben(c) {
  const { supabase, ablage, sp, driveId, passenderName, webUrl } = c;

  function pruefen(typ, benutzer) {
    if (!dokument.istDokument(typ)) throw new AblageFehler(400, 'Unbekannter Dokument-Typ');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
  }

  // ─── ablage-upload-ziel ─────────────────────────────────────

  /**
   * body: { typ, bezug_id, file_name, file_size, dokument_typ?, ersetzen_id? }
   *   bezug_id: vertraege.id | rechnung.id | auftrag.id
   *   ersetzen_id: bestehende Zeile (nur zeile-Typen); feld-Typen ersetzen ihren Dateisatz immer
   */
  async function uploadZiel({ benutzer, caller, body }) {
    const typ = body.typ;
    pruefen(typ, benutzer);
    const def = DOKUMENT[typ];
    const s = def.spalten;
    if (!istUuid(body.bezug_id)) throw new AblageFehler(400, 'bezug_id fehlt');
    const fileName = String(body.file_name || '').trim();
    const fileSize = Number(body.file_size);
    if (!fileName || !(fileSize > 0)) throw new AblageFehler(400, 'Datei fehlt oder ist leer');
    const dokumentTyp = typ === 'auftragsdokument' ? (body.dokument_typ || 'auftragsbestaetigung') : null;
    if (dokumentTyp && !AUFTRAG_DOKUMENT_TYPEN.has(dokumentTyp)) throw new AblageFehler(400, 'Unbekannter dokument_typ');
    if (!(await sichtbar(caller, BEZUG_TABELLE[def.bezug], body.bezug_id))) throw new AblageFehler(404, 'Bezug nicht gefunden');

    let alt = null;
    if (def.art === 'feld') {
      alt = await sichtbar(caller, def.tabelle, body.bezug_id, dokument.spaltenSelect(typ));
    } else if (body.ersetzen_id != null) {
      if (!istUuid(body.ersetzen_id)) throw new AblageFehler(400, 'ersetzen_id ungültig');
      alt = await sichtbar(caller, def.tabelle, body.ersetzen_id, dokument.spaltenSelect(typ));
      if (!alt || dokument.bezugIdVon(typ, alt) !== body.bezug_id) throw new AblageFehler(404, 'Datei nicht gefunden');
    }
    const altSp = alt?.[s.ablage] === 'sharepoint' && !!alt[s.item];

    const bezug = await dokument.ladeBezug(supabase, typ, body.bezug_id);
    if (!bezug) throw new AblageFehler(404, 'Bezug nicht gefunden');
    // Ohne Unternehmen kein Ordner: bleibt beim alten Weg
    const ziel = await dokument.dokumentZiel(supabase, bezug);
    if (ziel !== 'sharepoint' || !sp) {
      // Eine SharePoint-Datei per Dropbox zu ersetzen hinterliesse ablage=sharepoint mit Dropbox-Pfad
      if (altSp) throw new AblageFehler(503, 'SharePoint ist gerade abgeschaltet – Ersetzen bitte später erneut versuchen', 'notschalter');
      return { ziel: 'dropbox' };
    }
    if (fileSize > MAX_BYTES) {
      throw new AblageFehler(413, `Datei zu groß (max. ${Math.round(MAX_BYTES / MIB)} MB)`, 'zu_gross', { max_bytes: MAX_BYTES });
    }

    // Ersetzen: neue Version desselben Items (Versionsverlauf behaelt die alte, Ort bleibt)
    const altItem = altSp && alt[s.drive] === driveId ? await sp.item(alt[s.item], 'id,name,parentReference,webUrl') : null;
    let ordner;
    if (altItem) {
      const parentId = altItem.parentReference?.id;
      const reg = await ablage.ordner.nachItem(parentId);
      ordner = { item_id: parentId, pfad: reg?.pfad ?? ordnerVon(alt[s.pfad]) };
    } else {
      ordner = await ablage.ordner.dokumentKette(bezug.unternehmen, def.bereich, dokument.dokumentEbenen(typ, bezug, { dokumentTyp }));
    }

    const name = passenderName(ordner.pfad, fileName);
    const session = altItem
      ? await sp.uploadSessionFuerItem(altItem.id)
      : await sp.uploadSession(ordner.item_id, name, { conflict: 'rename' });
    const ordnerUrl = await webUrl(ordner.item_id);

    const kontext = {
      typ,
      bezug_id: body.bezug_id,
      dokument_typ: dokumentTyp,
      ordner_pfad: ordner.pfad,
      link_item_id: ordner.item_id,
      link_url: ordnerUrl,
      ...(alt ? { ersetzen: { typ, id: alt.id } } : {}),
      ...(altItem ? { gleiches_item: true, umbenennen_auf: name !== altItem.name ? name : null } : {}),
    };
    const { data: up, error } = await supabase.from('ablage_upload').insert({
      drive_id: driveId,
      parent_item_id: ordner.item_id,
      name,
      groesse: fileSize,
      typ,
      kontext,
      item_id: altItem?.id || null,
      erstellt_von: benutzer.id,
    }).select('id').single();
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

  // ─── ablage-datei: loeschen / umbenennen ────────────────────

  async function zeileLaden(caller, typ, id) {
    if (!istUuid(id)) throw new AblageFehler(400, 'typ und id fehlen');
    const row = await sichtbar(caller, DOKUMENT[typ].tabelle, id, dokument.spaltenSelect(typ));
    if (!row) throw new AblageFehler(404, 'Datei nicht gefunden');
    return row;
  }

  /**
   * SharePoint-Datei eines Dokuments in den Papierkorb, vor dem Loeschen der Zeile bzw. dem
   * Leeren des Dateisatzes. id: Zeile (zeile-Typen) bzw. vertraege.id (feld-Typen).
   */
  async function dateiLoeschen({ benutzer, caller, body }) {
    pruefen(body.typ, benutzer);
    const row = await zeileLaden(caller, body.typ, body.id);
    const q = dokument.quelleVon(body.typ, row);
    if (q?.quelle !== 'sharepoint') return { geloescht: false, quelle: q?.quelle || null };
    if (!sp) throw nichtKonfiguriert();
    if (q.drive_id !== driveId) throw new AblageFehler(409, 'Datei liegt in einer anderen Bibliothek');
    const andere = (await dokument.verweise(supabase, driveId, q.item_id, { ausser: { typ: body.typ, id: row.id } }))
      + (await weitereVerweise(supabase, driveId, q.item_id));
    if (andere > 0) return { geloescht: false, quelle: 'sharepoint' };
    await sp.loeschen(q.item_id);
    return { geloescht: true, quelle: 'sharepoint' };
  }

  async function dateiUmbenennen({ benutzer, caller, body }) {
    pruefen(body.typ, benutzer);
    if (!String(body.name || '').trim()) throw new AblageFehler(400, 'name fehlt');
    const typ = body.typ;
    const s = DOKUMENT[typ].spalten;
    const row = await zeileLaden(caller, typ, body.id);
    const q = dokument.quelleVon(typ, row);
    if (q?.quelle !== 'sharepoint') throw new AblageFehler(409, 'Datei liegt nicht in SharePoint', 'nicht_sharepoint');
    if (!sp) throw nichtKonfiguriert();

    const aktuell = String(row[s.pfad] || '').split('/').pop();
    let wunsch = String(body.name).trim();
    if (!endung(wunsch) && endung(aktuell)) wunsch += endung(aktuell);
    wunsch = passenderName(ordnerVon(row[s.pfad]), wunsch);
    if (wunsch === aktuell) return { [s.pfad]: row[s.pfad], [s.url]: row[s.url] };

    let item = null;
    for (let n = 1; n <= 20 && !item; n++) {
      try {
        item = await sp.umbenennen(q.item_id, mitZaehler(wunsch, n));
      } catch (err) {
        if (err.status !== 409) throw err;
      }
    }
    if (!item) throw new AblageFehler(409, 'Kein freier Dateiname');
    const patch = dokument.spaltenAusItem(typ, item, { driveId, pfad: `${ordnerVon(row[s.pfad])}/${item.name}` });
    const { error } = await supabase.from(DOKUMENT[typ].tabelle).update(patch).eq('id', row.id);
    if (error) throw error;
    return patch;
  }

  return { uploadZiel, dateiLoeschen, dateiUmbenennen };
}

module.exports = { createDokumentSchreiben };
