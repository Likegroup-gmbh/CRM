// dokumentAblage.js
// Verträge, Rechnungs-PDFs, Belege und Auftragsdokumente in der Ablage (ADR 0068).
// Eine Stelle für Hochladen, Spalten, Quelle, Öffnen und Löschen; die Fachmodule geben nur
// Typ, Bezug und ihren bisherigen Dropbox-Weg mit. Ob SharePoint oder Dropbox entscheidet der
// Server (Weiche je Unternehmen + Notschalter Dokumente), bei DROPBOX_UPLOAD wird nicht gefragt.
// Spiegel von netlify/functions/_shared/ablage/dokument.js (DokumentRegistry.test.js).

import { ablagePost } from './ablageApi.js';
import { ablageZielHolen, hochladenNachSharePoint, uploadVerwerfen } from './ablageUpload.js';
import { DROPBOX_UPLOAD } from './schalter.js';
import { authorizedFetch } from '../auth/getAccessToken.js';

const ZEILEN_SPALTEN = (url, pfad, name, groesse) => ({
  url, pfad, name, groesse, ablage: 'ablage', drive: 'drive_id', item: 'item_id', etag: 'etag', ctag: 'ctag',
});

export const DOKUMENT = {
  vertrag: {
    tabelle: 'vertraege', art: 'feld', bucket: 'vertraege',
    spalten: { url: 'datei_url', pfad: 'datei_path', ablage: 'datei_ablage', drive: 'datei_drive_id', item: 'datei_item_id' },
  },
  vertrag_unterschrieben: {
    tabelle: 'vertraege', art: 'feld', bucket: 'unterschriebene-vertraege',
    spalten: { url: 'dropbox_file_url', pfad: 'dropbox_file_path', ablage: 'signiert_ablage', drive: 'signiert_drive_id', item: 'signiert_item_id' },
    alt: { url: 'unterschriebener_vertrag_url', pfad: 'unterschriebener_vertrag_path' },
  },
  rechnung: {
    tabelle: 'rechnung_pdfs', art: 'zeile', bezugSpalte: 'rechnung_id', bucket: 'rechnungen',
    spalten: ZEILEN_SPALTEN('file_url', 'file_path', 'file_name', 'size'),
  },
  beleg: {
    tabelle: 'rechnung_belege', art: 'zeile', bezugSpalte: 'rechnung_id', bucket: 'rechnung-belege',
    spalten: ZEILEN_SPALTEN('file_url', 'file_path', 'file_name', 'size'),
  },
  auftragsdokument: {
    tabelle: 'auftrag_dokumente', art: 'zeile', bezugSpalte: 'auftrag_id', bucket: 'auftragsbestaetigung',
    spalten: ZEILEN_SPALTEN('dropbox_file_url', 'dropbox_file_path', 'dateiname', 'dateigroesse'),
  },
};

export const DOKUMENT_TYPEN = Object.keys(DOKUMENT);

const NEUE_SPALTEN = ['ablage', 'drive', 'item', 'etag', 'ctag'];

/** Ablage-Spalten eines Typs (Migration 20261210), ohne URL/Pfad. */
export function dokumentAblageSpalten(typ) {
  const s = DOKUMENT[typ].spalten;
  return NEUE_SPALTEN.map((k) => s[k]).filter(Boolean);
}

/** select() plus Ablage-Spalten der Typen; bei DROPBOX_UPLOAD ohne (auf Live evtl. noch nicht migriert). */
export function mitDokumentAblage(spalten, ...typen) {
  if (DROPBOX_UPLOAD) return spalten;
  const extra = [...new Set(typen.flatMap(dokumentAblageSpalten))];
  return extra.length ? `${spalten}, ${extra.join(', ')}` : spalten;
}

const SHAREPOINT_HOST = /^https:\/\/[^/]+\.sharepoint\.com\//i;
const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/;
const DOKUMENT_BEREICH = /\/(Verträge|Rechnungen|Aufträge)\/.+\.[a-z0-9]{2,5}$/i;

export function istSharePointUrl(url) {
  return typeof url === 'string' && SHAREPOINT_HOST.test(url);
}

/** SharePoint-webUrl einer Datei in einem Dokument-Bereich (nicht Ordner, nicht Medien). */
export function istSharePointDokumentUrl(url) {
  if (!istSharePointUrl(url)) return false;
  try {
    return DOKUMENT_BEREICH.test(decodeURIComponent(new URL(url).pathname).normalize('NFC'));
  } catch {
    return false;
  }
}

/**
 * Wo liegt die Datei? Ersetzt alle startsWith('/')-Prüfungen: SharePoint-Pfade beginnen auch mit '/'.
 * @returns {{ quelle: 'sharepoint' } | { quelle: 'dropbox', pfad } | { quelle: 'storage', bucket, pfad } | { quelle: 'link', url } | null}
 */
export function dokumentQuelle(typ, row) {
  const def = DOKUMENT[typ];
  if (!def || !row) return null;
  const s = def.spalten;
  let url = row[s.url];
  let pfad = row[s.pfad];
  if (row[s.ablage] === 'sharepoint') return { quelle: 'sharepoint', url, pfad };
  if (!url && !pfad && def.alt) {
    url = row[def.alt.url];
    pfad = row[def.alt.pfad];
  }
  if (!url && !pfad) return null;
  // Ohne Ablage-Spalte im select (DROPBOX_UPLOAD) erkennt man SharePoint nur an der webUrl
  if (row[s.ablage] === undefined && istSharePointUrl(url)) return { quelle: 'sharepoint', url, pfad };
  if (typeof pfad === 'string' && pfad.startsWith('/')) return { quelle: 'dropbox', pfad, url };
  const m = typeof url === 'string' ? STORAGE_URL.exec(url) : null;
  if (m) return { quelle: 'storage', bucket: decodeURIComponent(m[1]), pfad: pfad || decodeURIComponent(m[2]), url };
  if (pfad) return { quelle: 'storage', bucket: def.bucket, pfad, url };
  return { quelle: 'link', url };
}

export const istSharePointDokument = (typ, row) => dokumentQuelle(typ, row)?.quelle === 'sharepoint';

/**
 * DB-Spalten für das Ergebnis eines Uploads, egal ob SharePoint oder Dropbox.
 * @param {string} typ
 * @param {{ ziel: 'sharepoint', commit: object } | { ziel: 'dropbox', fileUrl: string, filePath: string, file?: File }} e
 */
export function dokumentSpalten(typ, e) {
  const s = DOKUMENT[typ].spalten;
  const out = {};
  if (e.ziel === 'sharepoint') {
    const c = e.commit;
    Object.assign(out, {
      [s.ablage]: 'sharepoint', [s.drive]: c.drive_id, [s.item]: c.item_id, [s.url]: c.file_url ?? null, [s.pfad]: c.file_path,
    });
    if (s.name) out[s.name] = c.file_name ?? null;
    if (s.groesse) out[s.groesse] = c.file_size ?? null;
    if (s.etag) out[s.etag] = c.etag ?? null;
    if (s.ctag) out[s.ctag] = c.ctag ?? null;
    return out;
  }
  Object.assign(out, { [s.url]: e.fileUrl ?? null, [s.pfad]: e.filePath ?? null });
  if (s.name && e.file?.name) out[s.name] = e.file.name;
  if (s.groesse && e.file?.size != null) out[s.groesse] = e.file.size;
  // Ersetzt eine frühere SharePoint-Datei: Ablage-Spalten zurücksetzen (nur wenn migriert)
  if (!DROPBOX_UPLOAD) {
    out[s.ablage] = 'dropbox';
    out[s.drive] = null;
    out[s.item] = null;
    if (s.etag) out[s.etag] = null;
    if (s.ctag) out[s.ctag] = null;
  }
  return out;
}

/**
 * Datei hochladen und Zeile schreiben. Scheitert `speichern`, wird ein SharePoint-Upload
 * verworfen (sonst legte der Abgleich die Zeile nach 10 Minuten doch noch an).
 *
 * @param {object} o
 * @param {keyof DOKUMENT} o.typ
 * @param {string} o.bezugId vertraege.id | rechnung.id | auftrag.id
 * @param {File|Blob} o.file
 * @param {() => Promise<{ fileUrl: string, filePath: string }>} o.dropbox bisheriger Dropbox-Weg
 * @param {(spalten: object, info: { ziel: string }) => Promise<any>} [o.speichern]
 * @param {'auftragsbestaetigung'|'rechnung'} [o.dokumentTyp] nur auftragsdokument
 * @param {string} [o.ersetzenId] bestehende Zeile (zeile-Typen)
 * @returns {Promise<{ ziel: 'sharepoint'|'dropbox', spalten: object, fileUrl: string|null, filePath: string|null, ergebnis: any }>}
 */
export async function dokumentHochladen({ typ, bezugId, file, dropbox, speichern, dokumentTyp, ersetzenId, onProgress, signal }) {
  if (!DOKUMENT[typ]) throw new Error(`Unbekannter Dokument-Typ: ${typ}`);
  if (!file) throw new Error('Keine Datei angegeben');
  const name = file.name || `dokument_${Date.now()}.pdf`;
  const ziel = await ablageZielHolen({
    typ,
    bezug_id: bezugId,
    file_name: name,
    file_size: file.size,
    ...(dokumentTyp ? { dokument_typ: dokumentTyp } : {}),
    ...(ersetzenId ? { ersetzen_id: ersetzenId } : {}),
  });

  if (ziel.ziel === 'dropbox') {
    if (typeof dropbox !== 'function') throw new Error('Dropbox-Weg fehlt');
    const r = await dropbox();
    const spalten = dokumentSpalten(typ, { ziel: 'dropbox', fileUrl: r.fileUrl, filePath: r.filePath, file });
    const ergebnis = speichern ? await speichern(spalten, { ziel: 'dropbox' }) : null;
    return { ziel: 'dropbox', spalten, fileUrl: r.fileUrl ?? null, filePath: r.filePath ?? null, ergebnis };
  }

  const datei = file.name ? file : new File([file], name, { type: file.type || 'application/pdf' });
  const commit = await hochladenNachSharePoint({ ziel, file: datei, signal, onProgress });
  const spalten = dokumentSpalten(typ, { ziel: 'sharepoint', commit });
  let ergebnis = null;
  if (speichern) {
    try {
      ergebnis = await speichern(spalten, { ziel: 'sharepoint' });
    } catch (err) {
      // Ersetzen (gleiches Item) verwirft der Server nie
      await uploadVerwerfen(ziel.upload_id);
      throw err;
    }
  }
  return { ziel: 'sharepoint', spalten, fileUrl: commit.file_url ?? null, filePath: commit.file_path ?? null, ergebnis };
}

/**
 * Datei eines Dokuments entfernen, vor dem Löschen der Zeile bzw. dem Leeren der Spalten.
 * SharePoint: Papierkorb (Server prüft Rechte und weitere Verweise). Dropbox/Storage: wie bisher.
 * Fehler werden geloggt, nicht geworfen: eine verwaiste Datei ist besser als eine hängende Zeile.
 */
export async function dokumentLoeschen(typ, row) {
  const q = dokumentQuelle(typ, row);
  if (!q) return { quelle: null };
  try {
    if (q.quelle === 'sharepoint') {
      if (DROPBOX_UPLOAD) return { quelle: 'sharepoint', uebersprungen: true };
      await ablagePost('ablage-datei', { aktion: 'loeschen', typ, id: row.id });
    } else if (q.quelle === 'dropbox') {
      await authorizedFetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: q.pfad }),
      });
    } else if (q.quelle === 'storage') {
      const { error } = await window.supabase.storage.from(q.bucket).remove([q.pfad]);
      if (error) throw error;
    }
  } catch (err) {
    console.warn(`[dokumentAblage] ${typ} ${row.id}: Datei konnte nicht entfernt werden`, err?.message || err);
    return { quelle: q.quelle, fehler: err?.message || String(err) };
  }
  return { quelle: q.quelle };
}

/** Wie dokumentLoeschen, plus Altbestand (vertrag_unterschrieben: Storage neben Dropbox/SharePoint). */
export async function dokumentDateienLoeschen(typ, row) {
  const def = DOKUMENT[typ];
  const s = def.spalten;
  const out = [await dokumentLoeschen(typ, row)];
  if (def.alt && (row?.[s.url] || row?.[s.pfad]) && (row[def.alt.url] || row[def.alt.pfad])) {
    out.push(await dokumentLoeschen(typ, { ...row, [s.url]: null, [s.pfad]: null, [s.ablage]: 'dropbox' }));
  }
  return out;
}

/** Erzeugtes und unterschriebenes PDF eines Vertrags entfernen, vor dem Löschen der Zeile. */
export async function vertragDateienLoeschen(vertragId) {
  for (const typ of ['vertrag', 'vertrag_unterschrieben']) {
    let row = null;
    try {
      row = await dokumentZeileLaden(typ, vertragId);
    } catch (err) {
      console.warn(`[dokumentAblage] ${typ} ${vertragId}: Zeile nicht lesbar`, err?.message || err);
    }
    if (row) await dokumentDateienLoeschen(typ, row);
  }
}

/**
 * Nach dem Ersetzen: die vorige Datei wegräumen, wenn sie woanders lag (Dropbox/Storage).
 * SharePoint ersetzt per neuer Version desselben Items, da bleibt nichts liegen.
 * @param {object} alt Zeile vor dem Upload, @param {object} neuSpalten Spalten des neuen Uploads
 */
export async function altesDokumentEntfernen(typ, alt, neuSpalten) {
  const a = dokumentQuelle(typ, alt);
  if (!a || a.quelle === 'sharepoint' || a.quelle === 'link') return null;
  const n = dokumentQuelle(typ, { ...alt, ...neuSpalten });
  if (n?.quelle === a.quelle && n.pfad === a.pfad) return null;
  return dokumentLoeschen(typ, alt);
}

const quellSpalten = (typ) => {
  const def = DOKUMENT[typ];
  const s = def.spalten;
  return mitDokumentAblage(['id', s.url, s.pfad, ...(def.alt ? [def.alt.url, def.alt.pfad] : [])].join(', '), typ);
};

/** Spalten einer Fach-Zeile für dokumentQuelle/altesDokumentEntfernen (mit Ablage-Spalten, wenn migriert). */
export async function dokumentZeileLaden(typ, id) {
  const { data, error } = await window.supabase.from(DOKUMENT[typ].tabelle).select(quellSpalten(typ)).eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function zeilenNachBezug(typ, ids) {
  if (!ids.length) return [];
  const def = DOKUMENT[typ];
  const { data, error } = await window.supabase.from(def.tabelle).select(quellSpalten(typ)).in(def.bezugSpalte, ids);
  if (error) throw error;
  return (data || []).map((row) => ({ typ, row }));
}

async function rechnungsDokumente(rechnungIds) {
  return [...(await zeilenNachBezug('rechnung', rechnungIds)), ...(await zeilenNachBezug('beleg', rechnungIds))];
}

// Diese Zeilen fallen per FK-Cascade mit der Entität weg, ihre Dateien nicht
const ENTITAET_DOKUMENTE = {
  rechnung: rechnungsDokumente,
  auftrag: async (ids) => {
    const { data, error } = await window.supabase.from('rechnung').select('id').in('auftrag_id', ids);
    if (error) throw error;
    return [...(await zeilenNachBezug('auftragsdokument', ids)), ...(await rechnungsDokumente((data || []).map((r) => r.id)))];
  },
};

export const hatEntitaetDokumente = (entityType) => Boolean(ENTITAET_DOKUMENTE[entityType]);

/**
 * Vor dem Löschen einer Rechnung/eines Auftrags: deren Dokument-Dateien entfernen
 * (SharePoint → Papierkorb). Fehler werden geloggt, das Löschen der Entität geht weiter.
 */
export async function dokumenteDerEntitaetLoeschen(entityType, ids) {
  const laden = ENTITAET_DOKUMENTE[entityType];
  if (!laden || !ids?.length) return [];
  let zeilen = [];
  try {
    zeilen = await laden(ids);
  } catch (err) {
    console.warn(`[dokumentAblage] Dokumente von ${entityType} nicht lesbar`, err?.message || err);
    return [];
  }
  const out = [];
  for (const { typ, row } of zeilen) out.push(await dokumentLoeschen(typ, row));
  return out;
}

// ─── Lesen ───────────────────────────────────────────────────

const cache = new Map();
const PUFFER_MS = 5 * 60 * 1000;

function ausCache(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  cache.delete(key);
  return null;
}

function merken(key, link) {
  const ablauf = Date.parse(link?.laeuft_ab);
  if (link?.url && Number.isFinite(ablauf)) cache.set(key, { url: link.url, expires: ablauf - PUFFER_MS });
}

export function _clearDokumentCache() {
  cache.clear();
}

/** Kurzlebige Download-URL über (typ, id). null, wenn nicht sichtbar oder ohne Datei. */
export async function dokumentLink(typ, id) {
  const key = `${typ}:${id}`;
  const hit = ausCache(key);
  if (hit) return hit;
  const r = await ablagePost('ablage-link', { items: [{ typ, id }] });
  const link = r?.links?.[key];
  merken(key, link);
  return link?.url || null;
}

/** Kurzlebige Download-URL über die gespeicherte SharePoint-webUrl (Render-Stellen ohne typ/id). */
export async function dokumentLinkNachUrl(url) {
  const hit = ausCache(url);
  if (hit) return hit;
  const r = await ablagePost('ablage-link', { dokument_urls: [url] });
  const link = r?.links?.[url];
  merken(url, link);
  return link?.url || null;
}

const escAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Attribute für <a>: href wie bisher (Dropbox/Storage), bei SharePoint zusätzlich
 * data-ablage-dokument, das der Klick-Interceptor (DocumentUrlHelper) auflöst.
 */
export function dokumentLinkAttrs(typ, row) {
  const q = dokumentQuelle(typ, row);
  if (!q) return '';
  const href = q.url || '#';
  const sp = q.quelle === 'sharepoint' && row?.id ? ` data-ablage-dokument="${escAttr(`${typ}:${row.id}`)}"` : '';
  return `href="${escAttr(href)}" target="_blank" rel="noopener noreferrer"${sp}`;
}

/**
 * PDF/Datei im neuen Tab. Das Fenster öffnet synchron (Popup-Blocker). PDFs gehen als Blob
 * in den Tab, damit sie inline erscheinen statt als Download (Graph liefert attachment; Spekulation).
 * @param {() => Promise<string|null>} holen
 */
export async function inNeuemTabOeffnen(holen, { fallbackUrl = null } = {}) {
  const win = window.open('', '_blank');
  try {
    const url = await holen();
    if (!url) throw new Error('Kein Zugriff auf die Datei');
    if (!win) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Download ${resp.status}`);
      const blob = await resp.blob();
      const typ = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'application/pdf';
      win.location = URL.createObjectURL(new Blob([blob], { type: typ }));
    } catch {
      win.location = url;
    }
  } catch (err) {
    if (win && fallbackUrl) {
      win.location = fallbackUrl;
      return;
    }
    if (win) win.close();
    console.error('❌ Dokument konnte nicht geöffnet werden:', err);
    window.toastSystem?.show('Dokument konnte nicht geöffnet werden (fehlende Berechtigung?)', 'error');
  }
}

/** Dokument öffnen, egal wo es liegt. */
export function dokumentOeffnen(typ, row) {
  const q = dokumentQuelle(typ, row);
  if (!q) return;
  if (q.quelle === 'sharepoint') {
    void inNeuemTabOeffnen(() => (row?.id ? dokumentLink(typ, row.id) : dokumentLinkNachUrl(q.url)));
    return;
  }
  if (q.quelle === 'dropbox' && !q.url) return;
  void import('../DocumentUrlHelper.js').then((m) => m.openDocumentUrl(q.url || ''));
}

/** URL für fetch() (Bulk-Download, PDF-Merge): SharePoint über ablage-link, sonst unverändert. */
export async function dokumentDownloadUrl(typ, row) {
  const q = dokumentQuelle(typ, row);
  if (!q) return null;
  if (q.quelle === 'sharepoint') return row?.id ? dokumentLink(typ, row.id) : dokumentLinkNachUrl(q.url);
  const { resolveDocumentUrl } = await import('../DocumentUrlHelper.js');
  return resolveDocumentUrl(q.url || '');
}
