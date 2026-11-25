// beschreibung-struktur.js
// Strukturierte Beschreibung einer Videoreferenz: Titel, Angle, Hook, Visual Hook,
// Hauptteil, CTA. Eine Quelle fuer Generator (Netlify) und Drawer (ESM-Reexport in
// src/modules/strategie/videoidee/beschreibungStruktur.js).
// beschreibung (Text) bleibt abgeleitet: Erstzeile = Titel, dann ein Absatz je Feld.

const BESCHREIBUNG_FELDER = Object.freeze([
  { key: 'titel', label: 'Titel' },
  { key: 'angle', label: 'Angle' },
  { key: 'hook', label: 'Hook' },
  { key: 'visual_hook', label: 'Visual Hook' },
  { key: 'hauptteil', label: 'Hauptteil' },
  { key: 'cta', label: 'CTA' }
]);

const FELD_KEYS = BESCHREIBUNG_FELDER.map((f) => f.key);

const ALIASE = {
  title: 'titel',
  visualhook: 'visual_hook',
  'visual hook': 'visual_hook',
  'visual-hook': 'visual_hook',
  visualHook: 'visual_hook',
  main: 'hauptteil',
  call_to_action: 'cta'
};

/** JSON-Schema fuer response_format und Prompt. */
const BESCHREIBUNG_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    titel: { type: 'string', description: 'Kurzer Titel des Videos, ohne Anfuehrungszeichen.' },
    angle: { type: 'string', description: 'Strategischer Blickwinkel des Videos in einem Satz.' },
    hook: { type: 'string', description: 'Der gesprochene Aufmacher, woertlich oder sinngemaess.' },
    visual_hook: { type: 'string', description: 'Was in den ersten Sekunden zu sehen ist. Leer, wenn nichts Besonderes.' },
    hauptteil: { type: 'string', description: 'Was im Hauptteil passiert, beschreibend in zwei bis vier Saetzen.' },
    cta: { type: 'string', description: 'Der Call-to-Action am Ende, woertlich oder sinngemaess.' }
  },
  required: FELD_KEYS
});

/** Trimmt und nimmt eine umschliessende Anfuehrungszeichen-Klammer ab („…“, "…", «…»). */
function saeubern(value) {
  const s = String(value ?? '').replace(/\r\n/g, '\n').trim();
  const klammer = /^[„“”"«»]([^„“”"«»]*)[„“”"«»]$/.exec(s);
  return klammer ? klammer[1].trim() : s;
}

function schluessel(rawKey) {
  const k = String(rawKey || '').trim();
  const lower = k.toLowerCase().replace(/\s+/g, ' ');
  if (FELD_KEYS.includes(lower)) return lower;
  const normalized = lower.replace(/[ -]/g, '_');
  if (FELD_KEYS.includes(normalized)) return normalized;
  return ALIASE[k] || ALIASE[lower] || null;
}

/** Objekt auf genau die sechs Felder (Strings, getrimmt). Leer = null. */
function normalisiereStruktur(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of FELD_KEYS) out[key] = '';
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = schluessel(rawKey);
    if (!key) continue;
    if (value != null && typeof value === 'object') continue;
    out[key] = saeubern(value);
  }
  return FELD_KEYS.some((key) => out[key]) ? out : null;
}

function jsonAusText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const ohneFence = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(ohneFence);
  } catch (_) {
    // weiter mit Klammer-Suche
  }
  const start = ohneFence.indexOf('{');
  const ende = ohneFence.lastIndexOf('}');
  if (start < 0 || ende <= start) return null;
  try {
    return JSON.parse(ohneFence.slice(start, ende + 1));
  } catch (_) {
    return null;
  }
}

/** LLM-Antwort (String oder Objekt) zur Struktur. Null, wenn nicht lesbar. */
function parseStruktur(raw) {
  if (raw == null) return null;
  const obj = typeof raw === 'string' ? jsonAusText(raw) : raw;
  return normalisiereStruktur(obj);
}

const LABEL_REGEX = /(^|\n)[ \t]*(Titel|Angle|Hook|Hauptteil|CTA)[ \t]*:|\bVisual[ -]Hook[ \t]*:/gi;

function labelKey(match) {
  const name = (match[2] || 'visual_hook').toLowerCase();
  return name;
}

/**
 * Altbestand: Fliesstext mit Labels („Titel: …  Hook: …  Hauptteil: …  CTA: …“) in die Felder zerlegen.
 * Labels zaehlen nur am Zeilenanfang; „Visual Hook:“ auch mitten in der Zeile.
 * „Ueberleitung zum CTA: …“ im Hauptteil bleibt dadurch Inhalt. Angle fehlt hier, er bleibt leer.
 * Null, wenn weniger als drei Labels gefunden werden oder Hook/Hauptteil fehlen.
 */
function parseFliesstext(text) {
  const s = String(text || '').replace(/\r\n/g, '\n');
  if (!s.trim()) return null;

  const treffer = [];
  const regex = new RegExp(LABEL_REGEX.source, LABEL_REGEX.flags);
  let m;
  while ((m = regex.exec(s)) !== null) {
    const key = labelKey(m);
    const labelStart = m[1] ? m.index + m[1].length : m.index;
    treffer.push({ key, labelStart, wertStart: regex.lastIndex });
  }

  const keys = new Set(treffer.map((t) => t.key));
  if (treffer.length < 3 || !keys.has('hook') || !keys.has('hauptteil')) return null;

  const out = {};
  treffer.forEach((t, i) => {
    const ende = i + 1 < treffer.length ? treffer[i + 1].labelStart : s.length;
    const wert = s.slice(t.wertStart, ende).replace(/\s*\n\s*/g, ' ').trim();
    if (!(t.key in out)) out[t.key] = wert;
  });
  return normalisiereStruktur(out);
}

/** Abgeleiteter Fliesstext: Titel als Erstzeile, dann `Label: Wert` je Feld, Leerzeile dazwischen. */
function strukturZuText(struktur) {
  const s = normalisiereStruktur(struktur);
  if (!s) return '';
  const bloecke = [s.titel];
  for (const { key, label } of BESCHREIBUNG_FELDER) {
    if (key === 'titel' || !s[key]) continue;
    bloecke.push(`${label}: ${s[key]}`);
  }
  return bloecke.filter(Boolean).join('\n\n');
}

module.exports = {
  BESCHREIBUNG_FELDER,
  BESCHREIBUNG_SCHEMA,
  normalisiereStruktur,
  parseStruktur,
  parseFliesstext,
  strukturZuText
};
