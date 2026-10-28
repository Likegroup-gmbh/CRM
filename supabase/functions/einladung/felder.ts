/**
 * Erlaubte Felder und Bereinigung einer Einreichung (ADR 0055).
 *
 * Reine Funktionen ohne Deno-Importe, damit Vitest sie testen kann
 * (src/__tests__/Einladung.test.js gleicht die Namen mit fieldConfig.js ab).
 *
 * Nicht erlaubt, weil intern: Zuordnung (unternehmen_id, marke_id, kampagne_id,
 * produktion_id), TKP, Verhandlungshinweis, Personas, Briefing-Verknüpfung.
 */

export type Art = 'produkt' | 'briefing' | 'konzept';

export const BRIEFING_TYPEN = ['paid_creator_ads', 'owned_social', 'influencer_marketing'] as const;

export const BRIEFING_FELDER = [
  'beschreibung',
  'funnel_stufen', 'paid_objectives', 'content_deadline', 'go_live',
  'content_ziele', 'plattformmechanik',
  'veroeffentlichungszeitraum', 'freigabeprozess',
  'nischen', 'creator_merkmale', 'beteiligte_personen', 'creator_groessen',
  'voraussetzungen', 'voraussetzungen_sonstiges', 'produkt_erfahrung', 'hauttyp', 'haartyp',
  'aufgabe', 'art_der_integration', 'setting', 'produktionsvoraussetzungen',
  'umsetzungsideen', 'referenzen', 'learnings_text', 'wichtige_vorgaben',
  'ad_channels', 'publish_channels',
  'videolaenge', 'videolaenge_funnel_upper', 'videolaenge_funnel_mid', 'videolaenge_funnel_lower',
  'cta', 'ziel_url', 'hook_vorgaben', 'unterschiedliche_hooks', 'hooks_anzahl',
  'trendkontext', 'posting_anforderungen',
  'nutzung_markenkanal', 'nutzung_paid_media', 'nutzung_creator_kanal', 'nutzung_whitelisting',
  'nutzungsdauer', 'rohmaterial',
] as const;

export const PRODUKT_FELDER = [
  'name', 'url', 'kurzbeschreibung', 'usp', 'pain_points', 'loesung',
  'preis_von', 'preis_bis', 'preis_uvp',
  'inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise',
  'einsatzsituationen', 'varianten', 'bilder',
] as const;

/** Creator-Sheet (Konzept-Einladung): Textfelder und Links, keine Uploads. */
export const KONZEPT_TEXTFELDER = [
  'arbeitstitel', 'idee', 'hook', 'ablauf', 'marke_integration',
  'eigenes_video_relevanz', 'referenz_aufgreifen', 'alternative_idee',
] as const;
export const KONZEPT_URLFELDER = ['eigenes_video_url', 'referenz_video_url'] as const;
export const KONZEPT_PFLICHT = ['idee', 'hook', 'ablauf'] as const;

export const VARIANTEN_FELDER = ['name', 'farbe', 'modell_kompatibilitaet', 'preis', 'merkmal'] as const;

export const MAX_JSON_BYTES = 150_000;
export const MAX_TEXT = 10_000;
export const MAX_LISTE = 100;
export const MAX_BILDER = 5;
export const MAIL_MAX_EMPFAENGER = 10;
export const MAX_REFERENZEN = 3;
export const MAX_VARIANTEN = 30;

export const UPLOAD_MIME = [
  'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
] as const;
export const BILD_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const;
export const MAX_DATEI_BYTES = 25 * 1024 * 1024;

export interface Datei {
  feld: string;
  pfad: string;
  name: string;
}

export interface Bereinigt {
  formData: Record<string, unknown>;
  dateien: Datei[];
}

const SCHLUESSEL = /^[a-z0-9_]{1,48}$/i;

function text(value: unknown, max = MAX_TEXT): string {
  // eslint-disable-next-line no-control-regex
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function zahl(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** JSON-Wert auf Primitive, Listen und flache Objekte begrenzen. */
export function bereinigeWert(value: unknown, tiefe = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return text(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (tiefe >= 3) return null;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_LISTE).map((v) => bereinigeWert(v, tiefe + 1)).filter((v) => v !== null);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (!SCHLUESSEL.test(key)) continue;
      const clean = bereinigeWert(inner, tiefe + 1);
      if (clean !== null) out[key] = clean;
    }
    return out;
  }
  return null;
}

function leer(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function istUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function eigenerPfad(pfad: unknown, einladungId: string): string | null {
  const p = text(pfad, 300);
  if (!p.startsWith(`${einladungId}/`)) return null;
  if (p.includes('..') || p.includes('//')) return null;
  return p;
}

/** Briefing: nur erlaubte Felder, bereinigte Werte, Referenz-Uploads nur aus dieser Einladung. */
export function bereinigeBriefing(
  eingabe: unknown,
  { einladungId, bereich }: { einladungId: string; bereich: string },
): Bereinigt {
  const src = (eingabe && typeof eingabe === 'object' ? eingabe : {}) as Record<string, unknown>;
  const formData: Record<string, unknown> = {};
  const dateien: Datei[] = [];

  for (const name of BRIEFING_FELDER) {
    if (!(name in src)) continue;
    if (name === 'referenzen') {
      const liste = Array.isArray(src.referenzen) ? src.referenzen.slice(0, MAX_REFERENZEN) : [];
      const sauber = [];
      for (const eintrag of liste) {
        const e = (eintrag && typeof eintrag === 'object' ? eintrag : {}) as Record<string, unknown>;
        if (e.typ === 'upload') {
          const pfad = eigenerPfad(e.value, einladungId);
          if (!pfad) continue;
          const label = text(e.label, 200) || 'Datei';
          sauber.push({ typ: 'upload', value: pfad, label });
          dateien.push({ feld: 'referenzen', pfad, name: label });
        } else {
          const url = text(e.value, 2000);
          if (url && istUrl(url)) sauber.push({ typ: 'url', value: url });
        }
      }
      if (sauber.length) formData.referenzen = sauber;
      continue;
    }
    const clean = bereinigeWert(src[name]);
    if (!leer(clean)) formData[name] = clean;
  }

  formData.bereich = bereich;
  return { formData, dateien };
}

/** Produkt: Pflicht sind Name und Shop-URL; Varianten und Bilder werden einzeln geprüft. */
export function bereinigeProdukt(
  eingabe: unknown,
  { einladungId }: { einladungId: string },
): Bereinigt {
  const src = (eingabe && typeof eingabe === 'object' ? eingabe : {}) as Record<string, unknown>;
  const formData: Record<string, unknown> = {};
  const dateien: Datei[] = [];

  formData.name = text(src.name, 200);
  formData.url = text(src.url, 2000);

  for (const name of [
    'kurzbeschreibung', 'usp', 'pain_points', 'loesung',
    'inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise',
  ] as const) {
    const v = text(src[name]);
    if (v) formData[name] = v;
  }
  for (const name of ['preis_von', 'preis_bis', 'preis_uvp'] as const) {
    const n = zahl(src[name]);
    if (n !== null && n >= 0 && n < 10_000_000) formData[name] = n;
  }

  const situationen = Array.isArray(src.einsatzsituationen) ? src.einsatzsituationen : [];
  const sitSauber = situationen.slice(0, MAX_LISTE).map((s) => text(s, 300)).filter(Boolean);
  if (sitSauber.length) formData.einsatzsituationen = sitSauber;

  const varianten = Array.isArray(src.varianten) ? src.varianten.slice(0, MAX_VARIANTEN) : [];
  const varSauber = [];
  for (const v of varianten) {
    const e = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const name = text(e.name, 200);
    if (!name) continue;
    const eintrag: Record<string, unknown> = { name };
    for (const feld of ['farbe', 'modell_kompatibilitaet', 'merkmal'] as const) {
      const t = text(e[feld], 300);
      if (t) eintrag[feld] = t;
    }
    const preis = zahl(e.preis);
    if (preis !== null && preis >= 0 && preis < 10_000_000) eintrag.preis = preis;
    varSauber.push(eintrag);
  }
  if (varSauber.length) formData.varianten = varSauber;

  const bilder = Array.isArray(src.bilder) ? src.bilder.slice(0, MAX_BILDER) : [];
  const bilderSauber = [];
  for (const b of bilder) {
    const e = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const pfad = eigenerPfad(e.pfad, einladungId);
    if (!pfad) continue;
    const name = text(e.name, 200) || 'Bild';
    bilderSauber.push({ pfad, name });
    dateien.push({ feld: 'bilder', pfad, name });
  }
  if (bilderSauber.length) formData.bilder = bilderSauber;

  return { formData, dateien };
}

/** Creator-Sheet: nur erlaubte Felder, bereinigte Texte, Links nur http/https. Keine Dateien. */
export function bereinigeKonzept(eingabe: unknown): Bereinigt {
  const src = (eingabe && typeof eingabe === 'object' ? eingabe : {}) as Record<string, unknown>;
  const formData: Record<string, unknown> = {};

  for (const name of KONZEPT_TEXTFELDER) {
    const v = text(src[name], name === 'arbeitstitel' ? 200 : MAX_TEXT);
    if (v) formData[name] = v;
  }
  for (const name of KONZEPT_URLFELDER) {
    const url = text(src[name], 2000);
    if (url && istUrl(url)) formData[name] = url;
  }
  return { formData, dateien: [] };
}

/** Fehlertext oder null. Briefing braucht mindestens eine Angabe, Produkt Name und Shop-URL, Konzept Idee, Hook und Ablauf. */
export function pruefeEinreichung(art: Art, formData: Record<string, unknown>): string | null {
  const bytes = new TextEncoder().encode(JSON.stringify(formData)).length;
  if (bytes > MAX_JSON_BYTES) return 'Die Angaben sind zu umfangreich.';

  if (art === 'konzept') {
    if (String(formData.idee ?? '').length < 3) return 'Bitte deine Idee beschreiben (01).';
    if (String(formData.hook ?? '').length < 3) return 'Bitte den Einstieg / Hook beschreiben (02).';
    if (String(formData.ablauf ?? '').length < 3) return 'Bitte den groben Ablauf beschreiben (03).';
    return null;
  }

  if (art === 'produkt') {
    if (String(formData.name ?? '').length < 2) return 'Bitte den Produktnamen eintragen.';
    const url = String(formData.url ?? '');
    if (!url || !istUrl(url)) return 'Bitte eine gültige Produkt-URL mit https:// eintragen.';
    return null;
  }

  const inhalt = Object.keys(formData).filter((k) => k !== 'bereich');
  if (inhalt.length === 0) return 'Bitte mindestens eine Angabe machen.';
  return null;
}

/** Empfängerliste: getrimmt, klein geschrieben, ohne Duplikate. Ungültiges oder zu viel ist ein Fehler. */
export function parseEmpfaenger(raw: unknown): { emails: string[]; fehler?: string } {
  if (raw === undefined || raw === null || raw === '') return { emails: [] };
  if (!Array.isArray(raw)) return { emails: [], fehler: 'Ungültige Empfängerliste.' };
  const emails: string[] = [];
  for (const eintrag of raw) {
    const email = String(eintrag ?? '').trim().toLowerCase();
    if (!email) continue;
    if (email.length > 320 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
      return { emails: [], fehler: `Ungültige E-Mail-Adresse: ${email.slice(0, 80)}` };
    }
    if (!emails.includes(email)) emails.push(email);
  }
  if (emails.length > MAIL_MAX_EMPFAENGER) {
    return { emails: [], fehler: `Höchstens ${MAIL_MAX_EMPFAENGER} Empfänger pro Versand.` };
  }
  return { emails };
}
