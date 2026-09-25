// videolaenge.js
// Videolänge: geschlossenes Intervall in ganzen Sekunden, von und bis inklusive.
// Leer heißt, es ist keine Videolänge vorgegeben.

export const VIDEOLAENGE_MIN = 1;
export const VIDEOLAENGE_MAX = 180;

const TOKEN_SECONDS = {
  '6s': 6,
  '10s': 10,
  '15s': 15,
  '20s': 20,
  '30s': 30,
  '60s': 60
};

const TOKEN_LABELS = {
  '6s': '6 Sek.',
  '10s': '10 Sek.',
  '15s': '15 Sek.',
  '20s': '20 Sek.',
  '30s': '30 Sek.',
  '60s': '60 Sek.',
  individuell: 'Individuell',
  agenturempfehlung: 'Agenturempfehlung'
};

const OHNE_SEKUNDEN = new Set(['individuell', 'agenturempfehlung']);

export function clampSekunde(n) {
  const x = Math.round(Number(String(n).replace(',', '.')));
  if (!Number.isFinite(x)) return null;
  return Math.min(VIDEOLAENGE_MAX, Math.max(VIDEOLAENGE_MIN, x));
}

export function intervallOderNull(von, bis) {
  if (von == null || bis == null || von === '' || bis === '') return null;
  const a = clampSekunde(von);
  const b = clampSekunde(bis);
  if (a == null || b == null) return null;
  return a <= b ? { von: a, bis: b } : { von: b, bis: a };
}

export function formatVideolaenge(von, bis) {
  const iv = intervallOderNull(von, bis);
  if (!iv) return null;
  if (iv.von === iv.bis) return `${iv.von} Sek.`;
  return `${iv.von}–${iv.bis} Sek.`;
}

export function skriptSchluessel(von, bis) {
  const iv = intervallOderNull(von, bis);
  if (!iv) return null;
  return `${iv.von}-${iv.bis}`;
}

/** Anzeige eines gespeicherten Skript-Schlüssels. Alte Eimer wie 0-15 bleiben Rohtext. */
export function formatVideoLaengeSchluessel(schluessel) {
  if (schluessel == null || schluessel === '') return null;
  const raw = String(schluessel).trim();
  const match = raw.match(/^(\d+)-(\d+)$/);
  if (!match) return raw;
  const von = parseInt(match[1], 10);
  const bis = parseInt(match[2], 10);
  if (von < VIDEOLAENGE_MIN || bis > VIDEOLAENGE_MAX || von > bis) return raw;
  return formatVideolaenge(von, bis);
}

export function tokenLabel(value) {
  return TOKEN_LABELS[value] || String(value);
}

function alsListe(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function sekundenAusText(text) {
  if (text == null) return [];
  const raw = String(text).trim();
  if (!raw || OHNE_SEKUNDEN.has(raw)) return [];
  if (TOKEN_SECONDS[raw] != null) return [TOKEN_SECONDS[raw]];
  const nums = raw.match(/\d+/g);
  if (!nums) return [];
  return nums.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
}

function intervallAusSekunden(secs) {
  const clamped = secs.map(clampSekunde).filter(n => n != null);
  if (!clamped.length) return null;
  return { von: Math.min(...clamped), bis: Math.max(...clamped) };
}

function intervallAusListe(value) {
  const secs = alsListe(value).flatMap(sekundenAusText);
  return intervallAusSekunden(secs);
}

function intervallAusText(value) {
  return intervallAusSekunden(sekundenAusText(value));
}

export function videolaengeAusAlt({
  videolaengen = null,
  pa_videolaengen = null,
  videolaenge_text = null,
  formatText = null
} = {}) {
  return intervallAusListe(videolaengen)
    || intervallAusListe(pa_videolaengen)
    || intervallAusText(videolaenge_text)
    || intervallAusText(formatText)
    || null;
}

function formatTextAusBriefing(briefing) {
  if (briefing.bereich === 'influencer_marketing') return briefing.im_formatvorgaben?.videolaenge ?? null;
  if (briefing.bereich === 'owned_social') return briefing.os_formatvorgaben?.videolaenge ?? null;
  return null;
}

function gespeichertesIntervall(briefing) {
  if (briefing.videolaenge_von == null || briefing.videolaenge_bis == null) return null;
  return intervallOderNull(briefing.videolaenge_von, briefing.videolaenge_bis);
}

export function videolaengeAusBriefing(briefing) {
  if (!briefing) return null;
  return gespeichertesIntervall(briefing) || videolaengeAusAlt({
    videolaengen: briefing.videolaengen,
    pa_videolaengen: briefing.pa_videolaengen,
    videolaenge_text: briefing.videolaenge_text,
    formatText: formatTextAusBriefing(briefing)
  });
}

function ersterText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

/** Doc/PDF: gespeichertes Intervall, sonst die alte Quelle unverändert. */
export function anzeigeWert(briefing) {
  if (!briefing) return null;
  const stored = gespeichertesIntervall(briefing);
  if (stored) return { art: 'intervall', ...stored };

  const tokens = alsListe(briefing.videolaengen);
  if (tokens.length) return { art: 'tokens', values: tokens };
  const legacy = alsListe(briefing.pa_videolaengen);
  if (legacy.length) return { art: 'tokens', values: legacy };

  const text = ersterText(briefing.videolaenge_text) || ersterText(formatTextAusBriefing(briefing));
  if (text) return { art: 'text', text };
  return null;
}

export function sekundeAnPosition(ratio, min = VIDEOLAENGE_MIN, max = VIDEOLAENGE_MAX) {
  const r = Math.min(1, Math.max(0, Number(ratio) || 0));
  return min + Math.round(r * (max - min));
}

export function spreize(origin, jetzt) {
  return intervallOderNull(origin, jetzt);
}

export function zieheGriff({ von, bis, seite, sekunde }) {
  const n = clampSekunde(sekunde);
  if (n == null || von == null || bis == null) return null;
  if (seite === 'von') return { von: Math.min(n, bis), bis };
  return { von, bis: Math.max(n, von) };
}

/**
 * Zahl beim Verlassen des Feldes.
 * Leeres Feld leert das Intervall. Die andere Seite wird nur gesetzt, wenn sie leer ist.
 * Ungültiger Text lässt den bisherigen Stand stehen.
 */
export function commitZahl({ von = null, bis = null, seite, roh }) {
  const text = String(roh ?? '').trim();
  if (!text) return null;
  const n = clampSekunde(text);
  if (n == null) {
    if (von == null || bis == null) return null;
    return { von, bis };
  }
  const otherLeer = seite === 'von' ? bis == null : von == null;
  if (otherLeer) return { von: n, bis: n };
  if (seite === 'von') return { von: Math.min(n, bis), bis };
  return { von, bis: Math.max(n, von) };
}
