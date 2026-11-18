// briefingProduktSync.js
// Produkte aus dem Briefing im Hintergrund anlegen oder verknüpfen (ADR 0074).
// - Angelegt wird, sobald ein Eintrag Name oder Link hat, auch im Entwurf.
// - Gleicher Link (mit Pfad) oder gleicher Name im Unternehmen: verknüpfen statt neu anlegen.
// - Eingetipptes gewinnt; Auslesen (Shop-Link, Unterlagen-PDF) füllt nur leere Spalten.
// - Die Verknüpfung campaign_briefing_produkt entsteht erst, wenn die Briefing-Zeile existiert.

import { requestExtractJob, toAbsoluteUrl } from '../../../core/form/ai/SiteExtractHandler.js';

/** Felder, die das Briefing je Produkt erfasst (briefingFelder.json, produkte.fields). */
export const PRODUKT_EINGABE = ['name', 'url', 'kurzbeschreibung', 'usp', 'loesung'];

/** Spalten, die das Auslesen füllen darf (extract-specs.js, produkt). */
const AUSLESE_SPALTEN = [
  'name', 'url', 'kurzbeschreibung', 'usp', 'pain_points', 'loesung', 'einsatzsituation',
  'preis_von', 'preis_bis', 'preis_uvp', 'inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise'
];

const PDF_ENDPOINT = '/.netlify/functions/produkt-pdf-background';
const PLATZHALTER_PRAEFIX = 'Produkt von ';

function leer(v) {
  return v == null || String(v).trim() === '';
}

/** Vergleichsschlüssel für Produktnamen: klein, ohne Akzente und Satzzeichen. */
export function normalizeProduktName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** host + Pfad ohne www, Query, Hash und Schluss-Slash. Ohne Pfad (Startseite): ''. */
export function normalisiereProduktUrl(raw) {
  const abs = toAbsoluteUrl(raw);
  if (!abs) return '';
  const url = new URL(abs);
  const pfad = url.pathname.replace(/\/+$/, '');
  if (!pfad) return '';
  return `${url.hostname.replace(/^www\./, '')}${pfad}`.toLowerCase();
}

/** Vorhandenes Produkt des Unternehmens mit gleichem Link oder Namen, sonst null. */
export function findeDublette(katalog, { name, url } = {}) {
  const list = Array.isArray(katalog) ? katalog : [];
  const link = normalisiereProduktUrl(url);
  if (link) {
    const treffer = list.find(p => normalisiereProduktUrl(p.url) === link);
    if (treffer) return treffer;
  }
  const key = normalizeProduktName(name);
  if (!key) return null;
  return list.find(p => normalizeProduktName(p.name) === key) || null;
}

/** Name, solange nur ein Link da ist. Das Auslesen darf ihn ersetzen. */
export function platzhalterName(url) {
  const abs = toAbsoluteUrl(url);
  return abs ? `${PLATZHALTER_PRAEFIX}${new URL(abs).hostname.replace(/^www\./, '')}` : 'Produkt';
}

export function istPlatzhalter(name) {
  return leer(name) || String(name).startsWith(PLATZHALTER_PRAEFIX) || name === 'Produkt';
}

/**
 * Eingabe gewinnt: gefüllte Felder, die vom Produkt abweichen. Leere Eingaben löschen nichts.
 * Ein Name, der sich nur in Schreibweise unterscheidet, benennt das Produkt nicht um.
 */
export function eingabeAenderungen(produkt, eintrag) {
  const patch = {};
  for (const feld of PRODUKT_EINGABE) {
    const wert = String(eintrag?.[feld] ?? '').trim();
    if (!wert || wert === String(produkt?.[feld] ?? '').trim()) continue;
    if (feld === 'name' && !istPlatzhalter(produkt?.name) && normalizeProduktName(wert) === normalizeProduktName(produkt?.name)) continue;
    patch[feld] = wert;
  }
  return patch;
}

function zahl(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Ausgelesenes nur für leere Spalten. Ein Platzhalter-Name gilt als leer. */
export function auslesenAenderungen(produkt, fields) {
  const patch = {};
  for (const spalte of AUSLESE_SPALTEN) {
    const wert = fields?.[spalte]?.value;
    if (leer(wert)) continue;
    const vorhanden = produkt?.[spalte];
    const frei = spalte === 'name' ? istPlatzhalter(vorhanden) : leer(vorhanden);
    if (!frei) continue;
    const neu = spalte.startsWith('preis_') ? zahl(wert) : String(wert).trim();
    if (neu != null) patch[spalte] = neu;
  }
  return patch;
}

async function ladeKatalog(unternehmenId) {
  const { data, error } = await window.supabase
    .from('produkt')
    .select('id, name, url')
    .eq('unternehmen_id', unternehmenId);
  if (error) throw error;
  return data || [];
}

export async function ladeProdukt(id) {
  const { data, error } = await window.supabase
    .from('produkt')
    .select(`id, ${AUSLESE_SPALTEN.join(', ')}`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function aktualisiere(id, patch) {
  if (!Object.keys(patch).length) return;
  const { error } = await window.supabase.from('produkt').update(patch).eq('id', id);
  if (error) throw error;
}

async function setzeMarke(produktId, markeId) {
  if (!markeId) return;
  const { error } = await window.supabase
    .from('produkt_marke')
    .upsert({ produkt_id: produktId, marke_id: markeId }, { onConflict: 'produkt_id,marke_id', ignoreDuplicates: true });
  if (error) console.warn('Marke am Produkt nicht gesetzt:', error);
}

/**
 * Eintrag -> Produkt-ID. Vorhandene ID: Eingabe schreiben. Sonst Dublette verknüpfen oder neu anlegen.
 * @returns {Promise<{ id: string, art: 'aktualisiert'|'verknuepft'|'angelegt', produkt: object, urlNeu: boolean }|null>}
 */
export async function syncEintrag(eintrag, { unternehmenId, markeId = null }) {
  if (!window.supabase || !unternehmenId) return null;
  if (leer(eintrag?.name) && leer(eintrag?.url) && !eintrag?.produkt_id) return null;

  if (eintrag.produkt_id) {
    const produkt = await ladeProdukt(eintrag.produkt_id);
    if (produkt) {
      const patch = eingabeAenderungen(produkt, eintrag);
      await aktualisiere(produkt.id, patch);
      return { id: produkt.id, art: 'aktualisiert', produkt: { ...produkt, ...patch }, urlNeu: 'url' in patch };
    }
  }

  const dublette = findeDublette(await ladeKatalog(unternehmenId), eintrag);
  if (dublette) {
    const produkt = await ladeProdukt(dublette.id);
    const patch = eingabeAenderungen(produkt, eintrag);
    await aktualisiere(dublette.id, patch);
    return { id: dublette.id, art: 'verknuepft', produkt: { ...produkt, ...patch }, urlNeu: 'url' in patch };
  }

  const zeile = { unternehmen_id: unternehmenId };
  for (const feld of PRODUKT_EINGABE) {
    if (!leer(eintrag[feld])) zeile[feld] = String(eintrag[feld]).trim();
  }
  if (!zeile.name) zeile.name = platzhalterName(zeile.url);
  const { data, error } = await window.supabase.from('produkt').insert(zeile).select('id').single();
  if (error) throw error;
  await setzeMarke(data.id, markeId);
  return { id: data.id, art: 'angelegt', produkt: { id: data.id, ...zeile }, urlNeu: !!zeile.url };
}

async function ladePdfHoch(file) {
  const { data } = await window.supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (!userId) throw new Error('Keine aktive Sitzung');
  const safe = String(file.name || 'produkt.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const name = /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
  const path = `produkt-pdfs/${userId}/${Date.now()}_${name}`;
  const { error } = await window.supabase.storage
    .from('documents')
    .upload(path, file, { upsert: false, contentType: 'application/pdf' });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  return path;
}

/** Shop-Link oder Unterlagen-PDF auslesen. Liefert die Rohfelder { spalte: { value, kind } }. */
export async function liesProduktAus({ url = null, file = null, onStep } = {}) {
  if (file) {
    const path = await ladePdfHoch(file);
    const result = await requestExtractJob({ entity: 'produkt', url: `pdf:${path}`, endpoint: PDF_ENDPOINT, onStep });
    return result.fields || {};
  }
  const abs = toAbsoluteUrl(url);
  if (!abs) return {};
  const result = await requestExtractJob({ entity: 'produkt', url: abs, onStep });
  return result.fields || {};
}

/** Ausgelesenes ans Produkt: nur leere Spalten. @returns {Promise<object>} der Patch */
export async function wendeAuslesenAn(produktId, fields) {
  const produkt = await ladeProdukt(produktId);
  if (!produkt) return {};
  const patch = auslesenAenderungen(produkt, fields);
  await aktualisiere(produktId, patch);
  return patch;
}
