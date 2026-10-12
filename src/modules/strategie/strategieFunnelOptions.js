// strategieFunnelOptions.js
// Funnel-Stufe an der Videoidee (strategie_items.funnel_stufe): Source of Truth
// fuer das Skript. Das Briefing nennt die Stufen grob (Mehrfachauswahl), die
// Videoidee hat genau eine oder keine. Leer heisst: keine Vorgabe.
//
// Die Werte sind das Briefing-Vokabular (upper/mid/lower). Das Skript kennt
// top/mid/bottom; funnelFuerSkript() uebersetzt beim Anlegen.

export const FUNNEL_WERTE = Object.freeze(['upper', 'mid', 'lower']);

/** Wert der Option, die die Stufe wieder leert. Gespeichert wird dann null. */
export const STRATEGIE_FUNNEL_OFFEN = 'offen';

export const FUNNEL_LABELS = Object.freeze({
  upper: 'Upper Funnel',
  mid: 'Mid Funnel',
  lower: 'Lower Funnel'
});

const FUNNEL_BADGE_KLASSE = Object.freeze({
  upper: 'info',
  mid: 'warning',
  lower: 'success'
});

export const STRATEGIE_FUNNEL_OPTIONS = Object.freeze([
  { value: STRATEGIE_FUNNEL_OFFEN, label: 'Keine Stufe', color: 'var(--gray-300)' },
  { value: 'upper', label: FUNNEL_LABELS.upper, color: 'var(--color-info)' },
  { value: 'mid', label: FUNNEL_LABELS.mid, color: 'var(--color-warning)' },
  { value: 'lower', label: FUNNEL_LABELS.lower, color: 'var(--color-success)' }
]);

const SKRIPT_FUNNEL = Object.freeze({ upper: 'top', mid: 'mid', lower: 'bottom' });
const BRIEFING_FUNNEL_FELD = Object.freeze({
  paid_creator_ads: 'pa_funnel_stufen',
  influencer_marketing: 'im_funnel_stufen'
});

export function isFunnelWert(value) {
  return FUNNEL_WERTE.includes(value);
}

/** Auswahl im Select (inkl. "Keine Stufe") */
export function isStrategieFunnel(value) {
  return value === STRATEGIE_FUNNEL_OFFEN || isFunnelWert(value);
}

/** Aktueller Wert fuer das Select. Leer bleibt '', dann zeigt es den Platzhalter. */
export function getStrategieFunnel(item) {
  return isFunnelWert(item?.funnel_stufe) ? item.funnel_stufe : '';
}

/** Update-Objekt fuer einen gewaehlten Wert. "Keine Stufe" leert das Feld. */
export function buildStrategieFunnelUpdates(value) {
  return { funnel_stufe: isFunnelWert(value) ? value : null };
}

/** Badge-HTML fuer die lesende Ansicht (Kunde). Leer ist ein Gedankenstrich. */
export function renderFunnelBadge(value) {
  if (!isFunnelWert(value)) return '–';
  return `<span class="status-badge ${FUNNEL_BADGE_KLASSE[value]}">${FUNNEL_LABELS[value]}</span>`;
}

/** Uebersetzt die Stufe der Videoidee in den Wert von skripte.funnel_stufe. */
export function funnelFuerSkript(value) {
  return SKRIPT_FUNNEL[value] || null;
}

const KONZEPT_FUNNEL = Object.freeze({ top: 'upper', mid: 'mid', bottom: 'lower' });

/** Rückrichtung zu funnelFuerSkript: skripte.funnel_stufe (top/mid/bottom) -> upper/mid/lower. */
export function funnelAusSkript(value) {
  return KONZEPT_FUNNEL[value] || null;
}

/**
 * Hinweis im Skript-Editor, wenn die Stufe im Konzept von der des Skripts
 * abweicht (das Skript kopiert sie beim Anlegen, ein spaeteres Aendern im
 * Konzept zieht es nicht nach). Leer, solange beide uebereinstimmen oder das
 * Konzept nicht geladen ist.
 */
export function funnelAbweichungsHinweis(skript) {
  const item = skript?.strategie_item;
  if (!item || !('funnel_stufe' in item)) return '';
  const imKonzept = isFunnelWert(item.funnel_stufe) ? item.funnel_stufe : null;
  const imSkript = KONZEPT_FUNNEL[skript.funnel_stufe] || null;
  if (imKonzept === imSkript) return '';

  const konzeptText = imKonzept ? FUNNEL_LABELS[imKonzept] : 'keine Stufe';
  const skriptText = imSkript ? FUNNEL_LABELS[imSkript] : 'keine Stufe';
  const laengeText = skript.bereich === 'paid_creator_ads' && skript.video_laenge
    ? ' Die Videolänge wurde mit der damaligen Stufe übernommen.'
    : '';
  return `Im Konzept steht jetzt ${konzeptText}, das Skript wurde mit ${skriptText} angelegt.${laengeText}`;
}

function alsListe(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

/** Die im Briefing genannten Stufen (nur bekannte Werte, ohne Doppelte). */
export function briefingFunnelStufen(briefing) {
  const feld = BRIEFING_FUNNEL_FELD[briefing?.bereich];
  if (!feld) return [];
  let raw = alsListe(briefing[feld]);
  // Flow-Briefings spiegeln nach pa_funnel_stufen; die Quellspalte ist der Fallback.
  if (!raw.length && briefing.bereich === 'paid_creator_ads') raw = alsListe(briefing.funnel_stufen);
  return [...new Set(raw.filter(isFunnelWert))];
}

/** Die Stufe fuer eine Vorbelegung: nur wenn das Briefing genau eine nennt. */
export function briefingEinzigeFunnelStufe(briefing) {
  const stufen = briefingFunnelStufen(briefing);
  return stufen.length === 1 ? stufen[0] : null;
}

/**
 * Spaltendefault der Funnel-Stufe: sichtbar in Paid-Linien oder sobald eine
 * Zeile eine Stufe hat (so sieht auch der Kunde, der das Briefing nicht lesen
 * darf, die gesetzten Werte).
 */
export function funnelSpalteStandardSichtbar(strategie, items = []) {
  if (strategie?.briefing?.bereich === 'paid_creator_ads') return true;
  return (items || []).some(item => isFunnelWert(item?.funnel_stufe));
}
