// _shared/ablage/dokument.js
// Dokumente in der Ablage (ADR 0068): Verträge, Rechnungs-PDFs, Belege, Auftragsdokumente.
// Eine Registry je Dokument-Typ: Tabelle, Spaltensatz, Bezug (wem die Datei gehoert) und Bereich.
//   feld:  die Datei haengt als Spaltensatz an der Fach-Zeile (vertraege: erzeugt + unterschrieben)
//   zeile: eine Zeile je Datei (rechnung_pdfs, rechnung_belege, auftrag_dokumente)
// URL- und Pfad-Spalten bleiben gefuellt (bei SharePoint webUrl + Pfad ab Bibliothekswurzel):
// Status-Ableitungen (sync_vertrag_status, vertragStatus.js) lesen sie weiter.
// Spiegel im Client: src/core/ablage/dokumentAblage.js (DokumentRegistry.test.js prueft Gleichheit).
//
// Ordner: Daten/<Firma>/<Bereich>/[<Marke>/]<Kampagne>/... bzw. .../Contracting/<Auftrag>/...
//   Verträge/[<Marke>/]<Kampagne>/[<Produktion>/]      erzeugt + unterschrieben (Produktion: ADR 0069)
//   Rechnungen/[<Marke>/]<Kampagne>/<Rechnungs-Nr>/    PDFs, darin Belege/
//   Aufträge/[<Marke>/]<Auftrag>/                      Auftragsbestätigung, darin Rechnungen/

const { NAMEN, DOKUMENT_ORDNER } = require('./pfad');
const { dokumenteNotschalterAn, dokumentZielVon } = require('./ziel');

const MIB = 1024 * 1024;

const ZEILEN_SPALTEN = (url, pfad, name, groesse) => ({
  url, pfad, name, groesse, ablage: 'ablage', drive: 'drive_id', item: 'item_id', etag: 'etag', ctag: 'ctag',
});

const DOKUMENT = {
  vertrag: {
    tabelle: 'vertraege', art: 'feld', bezug: 'vertrag', bereich: 'vertraege', bucket: 'vertraege',
    spalten: { url: 'datei_url', pfad: 'datei_path', ablage: 'datei_ablage', drive: 'datei_drive_id', item: 'datei_item_id' },
  },
  vertrag_unterschrieben: {
    tabelle: 'vertraege', art: 'feld', bezug: 'vertrag', bereich: 'vertraege', bucket: 'unterschriebene-vertraege',
    spalten: { url: 'dropbox_file_url', pfad: 'dropbox_file_path', ablage: 'signiert_ablage', drive: 'signiert_drive_id', item: 'signiert_item_id' },
    // Altbestand vor Dropbox: Supabase-Storage
    alt: { url: 'unterschriebener_vertrag_url', pfad: 'unterschriebener_vertrag_path' },
  },
  rechnung: {
    tabelle: 'rechnung_pdfs', art: 'zeile', bezug: 'rechnung', bezugSpalte: 'rechnung_id', bereich: 'rechnungen', bucket: 'rechnungen',
    spalten: ZEILEN_SPALTEN('file_url', 'file_path', 'file_name', 'size'),
  },
  beleg: {
    tabelle: 'rechnung_belege', art: 'zeile', bezug: 'rechnung', bezugSpalte: 'rechnung_id', bereich: 'rechnungen', bucket: 'rechnung-belege',
    spalten: ZEILEN_SPALTEN('file_url', 'file_path', 'file_name', 'size'),
  },
  auftragsdokument: {
    tabelle: 'auftrag_dokumente', art: 'zeile', bezug: 'auftrag', bezugSpalte: 'auftrag_id', bereich: 'auftraege', bucket: 'auftragsbestaetigung',
    spalten: ZEILEN_SPALTEN('dropbox_file_url', 'dropbox_file_path', 'dateiname', 'dateigroesse'),
  },
};

const TYPEN = Object.keys(DOKUMENT);
const BEZUG_TABELLE = { vertrag: 'vertraege', rechnung: 'rechnung', auftrag: 'auftrag' };
const MAX_BYTES = 200 * MIB;
const AUFTRAG_DOKUMENT_TYPEN = new Set(['auftragsbestaetigung', 'rechnung']);

const istDokument = (typ) => Object.prototype.hasOwnProperty.call(DOKUMENT, typ);

/** Spalten des Dateisatzes fuer select(). */
function spaltenSelect(typ, extra = []) {
  const def = DOKUMENT[typ];
  const s = Object.values(def.spalten);
  if (def.alt) s.push(def.alt.url, def.alt.pfad);
  if (def.bezugSpalte) s.push(def.bezugSpalte);
  return [...new Set(['id', ...s, ...extra])].join(', ');
}

/** Zu welcher Fach-Zeile gehoert die Datei? feld: die Zeile selbst. */
function bezugIdVon(typ, row) {
  const def = DOKUMENT[typ];
  return def.art === 'feld' ? row?.id : row?.[def.bezugSpalte];
}

/** Spalten aus dem driveItem (Graph) fuer die Dokument-Zeile. */
function spaltenAusItem(typ, item, { driveId, pfad }) {
  const s = DOKUMENT[typ].spalten;
  const out = {
    [s.ablage]: 'sharepoint',
    [s.drive]: driveId,
    [s.item]: item.id,
    [s.url]: item.webUrl || null,
    [s.pfad]: pfad,
  };
  if (s.name) out[s.name] = item.name;
  if (s.groesse) out[s.groesse] = item.size ?? null;
  if (s.etag) out[s.etag] = item.eTag || null;
  if (s.ctag) out[s.ctag] = item.cTag || null;
  return out;
}

/** feld: Dateisatz leeren (Datei weg). */
function leereSpalten(typ) {
  const s = DOKUMENT[typ].spalten;
  return { [s.ablage]: 'dropbox', [s.drive]: null, [s.item]: null, [s.url]: null, [s.pfad]: null };
}

const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/;

/**
 * Wo liegt die Datei? -> { quelle: 'sharepoint'|'dropbox'|'storage'|'link', ... } | null
 *   sharepoint: { drive_id, item_id }, dropbox: { pfad }, storage: { bucket, pfad }, link: { url }
 */
function quelleVon(typ, row) {
  const def = DOKUMENT[typ];
  const s = def.spalten;
  if (!row) return null;
  if (row[s.ablage] === 'sharepoint' && row[s.item]) return { quelle: 'sharepoint', drive_id: row[s.drive], item_id: row[s.item] };
  let url = row[s.url];
  let pfad = row[s.pfad];
  if (!url && !pfad && def.alt) {
    url = row[def.alt.url];
    pfad = row[def.alt.pfad];
  }
  if (!url && !pfad) return null;
  if (typeof pfad === 'string' && pfad.startsWith('/')) return { quelle: 'dropbox', pfad };
  const m = typeof url === 'string' ? STORAGE_URL.exec(url) : null;
  if (m) return { quelle: 'storage', bucket: decodeURIComponent(m[1]), pfad: pfad || decodeURIComponent(m[2]) };
  if (pfad) return { quelle: 'storage', bucket: def.bucket, pfad };
  return { quelle: 'link', url };
}

// ─── Bezug: Unternehmen, Marke, Kampagne, Auftrag, Rechnung ───

const VERTRAG_SELECT = 'id, name, kunde_unternehmen_id, kampagne_id, produktion_id, contracting_auftrag_id';
const PRODUKTION_SELECT = 'id, name, kampagne_id';
const RECHNUNG_SELECT = 'id, rechnung_nr, unternehmen_id, auftrag_id, kampagne_id';
const AUFTRAG_SELECT = 'id, auftragsname, titel, unternehmen_id, marke_id';
const KAMPAGNE_SELECT = 'id, kampagnenname, eigener_name, unternehmen_id, marke_id';

async function einzeln(supabase, tabelle, select, id) {
  if (!id) return null;
  const { data, error } = await supabase.from(tabelle).select(select).eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Fach-Bezug eines Dokuments (Service-Client).
 * @returns {Promise<{ typ, bezug_id, vertrag, rechnung, auftrag, kampagne, produktion, marke, unternehmen }|null>}
 */
async function ladeBezug(supabase, typ, bezugId) {
  const def = DOKUMENT[typ];
  let vertrag = null;
  let rechnung = null;
  let auftrag = null;
  let kampagne = null;
  let produktion = null;
  let unternehmenId = null;
  if (def.bezug === 'vertrag') {
    vertrag = await einzeln(supabase, 'vertraege', VERTRAG_SELECT, bezugId);
    if (!vertrag) return null;
    kampagne = await einzeln(supabase, 'kampagne', KAMPAGNE_SELECT, vertrag.kampagne_id);
    produktion = await einzeln(supabase, 'produktion', PRODUKTION_SELECT, vertrag.produktion_id);
    auftrag = await einzeln(supabase, 'auftrag', AUFTRAG_SELECT, vertrag.contracting_auftrag_id);
    unternehmenId = vertrag.kunde_unternehmen_id || kampagne?.unternehmen_id || auftrag?.unternehmen_id;
  } else if (def.bezug === 'rechnung') {
    rechnung = await einzeln(supabase, 'rechnung', RECHNUNG_SELECT, bezugId);
    if (!rechnung) return null;
    kampagne = await einzeln(supabase, 'kampagne', KAMPAGNE_SELECT, rechnung.kampagne_id);
    auftrag = await einzeln(supabase, 'auftrag', AUFTRAG_SELECT, rechnung.auftrag_id);
    unternehmenId = rechnung.unternehmen_id || kampagne?.unternehmen_id || auftrag?.unternehmen_id;
  } else {
    auftrag = await einzeln(supabase, 'auftrag', AUFTRAG_SELECT, bezugId);
    if (!auftrag) return null;
    unternehmenId = auftrag.unternehmen_id;
  }
  const unternehmen = await einzeln(supabase, 'unternehmen', 'id, firmenname, ist_test, dokument_ablage_ziel', unternehmenId);
  const marke = await einzeln(supabase, 'marke', 'id, markenname, unternehmen_id', kampagne?.marke_id || auftrag?.marke_id);
  return { typ, bezug_id: bezugId, vertrag, rechnung, auftrag, kampagne, produktion, marke, unternehmen };
}

/** Weiche fuer ein Dokument: 'sharepoint' | 'dropbox'. */
async function dokumentZiel(supabase, bezug) {
  const notschalter = await dokumenteNotschalterAn(supabase);
  return dokumentZielVon(bezug?.unternehmen, { notschalter });
}

/**
 * Ordner-Ebenen unter dem Bereich (rein, ohne I/O).
 * Marke nur, wenn sie zum Unternehmen des Dokuments gehoert (Vertrag mit fremdem Kunden-Unternehmen).
 * @returns {{ ebene, ref, name, extra }[]}
 */
function dokumentEbenen(typ, b, { dokumentTyp = null } = {}) {
  const def = DOKUMENT[typ];
  const uid = b.unternehmen.id;
  const marke = b.marke && (!b.marke.unternehmen_id || b.marke.unternehmen_id === uid) ? b.marke : null;
  const markeId = marke?.id || null;
  const out = [];
  if (marke) out.push({ ebene: 'marke', ref: marke.id, name: NAMEN.marke(marke), extra: { marke_id: marke.id } });

  const auftragEbene = () => out.push({
    ebene: 'auftrag', ref: b.auftrag.id, name: NAMEN.auftrag(b.auftrag), extra: { marke_id: markeId, auftrag_id: b.auftrag.id },
  });

  if (def.bereich === 'auftraege') {
    auftragEbene();
    if (dokumentTyp === 'rechnung') {
      out.push({ ebene: 'rechnungen', ref: b.auftrag.id, name: DOKUMENT_ORDNER.rechnungen, extra: { marke_id: markeId, auftrag_id: b.auftrag.id } });
    }
    return out;
  }

  if (b.kampagne) {
    out.push({ ebene: 'kampagne', ref: b.kampagne.id, name: NAMEN.kampagne(b.kampagne), extra: { marke_id: markeId, kampagne_id: b.kampagne.id } });
    // Gleiche Bedingung in ablage_struktur_offen: nur die Produktion der eigenen Kampagne
    if (def.bezug === 'vertrag' && b.produktion && b.produktion.kampagne_id === b.kampagne.id) {
      out.push({
        ebene: 'produktion', ref: b.produktion.id, name: NAMEN.produktion(b.produktion),
        extra: { marke_id: markeId, kampagne_id: b.kampagne.id, produktion_id: b.produktion.id },
      });
    }
  } else if (b.auftrag) {
    out.push({ ebene: 'contracting', ref: markeId || 'ohne_marke', name: DOKUMENT_ORDNER.contracting, extra: { marke_id: markeId } });
    auftragEbene();
  }

  if (def.bereich === 'rechnungen') {
    const fach = { marke_id: markeId, kampagne_id: b.kampagne?.id || null, auftrag_id: b.auftrag?.id || null, rechnung_id: b.rechnung.id };
    out.push({ ebene: 'rechnung', ref: b.rechnung.id, name: NAMEN.rechnung(b.rechnung), extra: fach });
    if (typ === 'beleg') out.push({ ebene: 'belege', ref: b.rechnung.id, name: DOKUMENT_ORDNER.belege, extra: fach });
  }
  return out;
}

// ─── Suche nach Datei ───

/** Dokument-Zeile zu einem SharePoint-Item. -> { typ, row } | null */
async function findeNachItem(supabase, driveId, itemId) {
  for (const typ of TYPEN) {
    const { tabelle, spalten: s } = DOKUMENT[typ];
    const { data, error } = await supabase.from(tabelle).select('*').eq(s.drive, driveId).eq(s.item, itemId).limit(1);
    if (error) throw error;
    if (data?.[0]) return { typ, row: data[0] };
  }
  return null;
}

/** Wie viele Dokument-Zeilen zeigen auf das Item (ohne `ausser`)? */
async function verweise(supabase, driveId, itemId, { ausser } = {}) {
  let n = 0;
  for (const typ of TYPEN) {
    const { tabelle, spalten: s } = DOKUMENT[typ];
    let q = supabase.from(tabelle).select('id', { count: 'exact', head: true }).eq(s.drive, driveId).eq(s.item, itemId);
    if (ausser?.typ === typ) q = q.neq('id', ausser.id);
    const { count } = await q;
    n += count || 0;
  }
  return n;
}

/** Datei aus der Ablage entfernt: Zeile loeschen bzw. Dateisatz leeren. -> Anzahl */
async function entfernenNachItem(supabase, driveId, itemId) {
  let n = 0;
  for (const typ of TYPEN) {
    const def = DOKUMENT[typ];
    const s = def.spalten;
    const { data, error } = await supabase.from(def.tabelle).select('id').eq(s.drive, driveId).eq(s.item, itemId);
    if (error) throw error;
    const ids = (data || []).map((r) => r.id);
    if (!ids.length) continue;
    const q = def.art === 'feld'
      ? supabase.from(def.tabelle).update(leereSpalten(typ)).in('id', ids)
      : supabase.from(def.tabelle).delete().in('id', ids);
    const { error: e2 } = await q;
    if (e2) throw e2;
    n += ids.length;
  }
  return n;
}

// ─── Inhalt (Anschreiben, Umzug) ───

/**
 * Bytes einer Dokument-Datei, egal wo sie liegt.
 * @param {{ supabase, sp?, dropbox?, fetchImpl? }} deps
 * @returns {Promise<Buffer|null>} null, wenn die Datei fehlt
 */
async function bytes({ supabase, sp = null, dropbox = null, fetchImpl = (...a) => fetch(...a) }, typ, row) {
  const q = quelleVon(typ, row);
  if (!q) return null;
  let url = null;
  if (q.quelle === 'sharepoint') {
    if (!sp || q.drive_id !== sp.driveId) throw new Error('SharePoint-Datei, Ablage nicht konfiguriert');
    url = (await sp.downloadUrl(q.item_id))?.url || null;
  } else if (q.quelle === 'dropbox') {
    url = dropbox ? (await dropbox.downloadUrl(q.pfad))?.url || null : null;
  } else if (q.quelle === 'storage') {
    const { data, error } = await supabase.storage.from(q.bucket).download(q.pfad);
    if (error) {
      if (/not.?found|404/i.test(`${error.message} ${error.statusCode || ''}`)) return null;
      throw new Error(`Storage ${q.bucket}: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  } else {
    url = String(q.url).replace(/[?&]dl=0/, (m) => (m[0] === '?' ? '?raw=1' : '&raw=1'));
  }
  if (!url) return null;
  const resp = await fetchImpl(url);
  if (resp.status === 404 || resp.status === 410) return null;
  if (!resp.ok) throw new Error(`Download ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

module.exports = {
  DOKUMENT,
  TYPEN,
  BEZUG_TABELLE,
  MAX_BYTES,
  AUFTRAG_DOKUMENT_TYPEN,
  istDokument,
  spaltenSelect,
  bezugIdVon,
  spaltenAusItem,
  leereSpalten,
  quelleVon,
  STORAGE_URL,
  ladeBezug,
  dokumentZiel,
  dokumentEbenen,
  findeNachItem,
  verweise,
  entfernenNachItem,
  bytes,
};
