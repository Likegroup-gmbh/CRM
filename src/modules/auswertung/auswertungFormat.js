// auswertungFormat.js
// Anzeige der Auswertung: Zahlen kompakt (Kacheln, Diagramm) oder ausgeschrieben (Tabelle, Panel),
// Prozent, Sekunden, Datum und Plattform-Icon. Ein Wert ohne Grundlage wird „–“, nie 0.

import { icon } from '../../core/icons/IconSystem.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatEuro } from '../produktion/budgetTab.js';
import { KI_SCHWELLE, PLATTFORMEN } from './auswertungKonfig.js';

export const LEER = '–';

const ok = (v) => typeof v === 'number' && Number.isFinite(v);

export const kompakt = (v) => (ok(v) ? formatCompactNumber(v) : LEER);
export const exakt = (v) => (ok(v) ? formatExactNumber(v) : LEER);

const dezimal = (v, stellen = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

/** Anteil 0..1 als „4,8 %“. */
export const prozent = (anteil, stellen = 1) => (ok(anteil) ? `${dezimal(anteil * 100, stellen)} %` : LEER);
export const sekunden = (v) => (ok(v) ? `${dezimal(v)} s` : LEER);
export const euro = (v) => (ok(v) ? formatEuro(v) : LEER);

export function datum(iso) {
  if (!iso) return LEER;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? LEER : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const plural = (n, eins, mehr) => `${exakt(n)} ${n === 1 ? eins : mehr}`;

/** Wert einer Kennzahl nach ihrer Art: Zahl, Anteil, Sekunden oder Euro. */
export function wertNachArt(art, v, { kurz = true } = {}) {
  if (art === 'prozent') return prozent(v);
  if (art === 'sekunden') return sekunden(v);
  if (art === 'euro') return euro(v);
  return kurz ? kompakt(v) : exakt(v);
}

export function plattformIcon(plattform, size = 16) {
  const p = PLATTFORMEN[plattform];
  if (!p) return '';
  return icon(p.icon, { size, className: p.icon === 'tiktok' ? 'crm-icon--filled' : '' });
}

/** Icon und Kurzname einer Plattform, z. B. für Tabelle und Panel. */
export function plattformLabel(plattform, { lang = false } = {}) {
  const p = PLATTFORMEN[plattform];
  if (!p) return esc(plattform || LEER);
  return `<span class="auswertung-plattform">${plattformIcon(plattform)}<span>${esc(lang ? p.label : p.kurz)}</span></span>`;
}

/** „Video 1 · 4:5“: Einheit plus Format der geposteten Datei, falls die Einheit mehrere hat. */
/** Format der Datei, nur wenn die Einheit mehrere Dateien hat. */
export function dateiFormat(einheit, dateiId) {
  const dateien = einheit?.dateien || [];
  return dateien.length > 1 ? dateien.find(d => d.id === dateiId)?.ratio || '' : '';
}

export function dateiLabel(einheit, dateiId) {
  if (!einheit) return '';
  return [einheit.label, dateiFormat(einheit, dateiId)].filter(Boolean).join(' · ');
}

/** Felder, die die KI unter der Schwelle gelesen hat. Nach dem Bestätigen gilt keines mehr als unsicher. */
export function unsichereFelder(post) {
  if (!post || post.status === 'confirmed') return [];
  return Object.entries(post.confidence || {}).filter(([, k]) => typeof k === 'number' && k < KI_SCHWELLE).map(([key]) => key);
}

/** „Von der KI aus 2 Screenshots gelesen · 1 Feld unsicher · bestätigt von Mara“ (Spec 7.5). */
export function herkunftText(post) {
  if (!post) return '';
  const unsicher = unsichereFelder(post).length;
  const quelle = {
    api: 'Per Link von Instagram abgerufen',
    ki: `Von der KI aus ${plural(Math.max(post.screenshots || 0, 1), 'Screenshot', 'Screenshots')} gelesen`,
    manuell: 'Manuell eingetragen'
  }[post.source] || 'Manuell eingetragen';
  const bestaetigt = post.status === 'confirmed' ? (post.confirmedBy ? `bestätigt von ${post.confirmedBy}` : 'bestätigt') : '';
  return [quelle, unsicher ? plural(unsicher, 'Feld unsicher', 'Felder unsicher') : '', bestaetigt].filter(Boolean).join(' · ');
}

export { esc };
