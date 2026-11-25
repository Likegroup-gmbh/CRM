// auswertungReport.js
// Report-Ansicht (Spec 5) im Stil des Budget-Tabs: Kennzahlen mit Formel-Hinweis und darunter die
// Post-Tabelle mit ihren Filtern. Zahlen mit data-count zählen beim Wechsel hoch.

import { renderCardHintHtml } from '../../core/budget/cardHints.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { esc, kompakt, prozent, wertNachArt } from './auswertungFormat.js';
import { KACHELN, kachelSub, kachelWert } from './auswertungKacheln.js';
import { renderTabelle } from './auswertungTabelle.js';

const zaehl = (key, wert, art) => `data-count="${key}" data-count-value="${wert}" data-count-format="${art}"`;

function zielFortschritt(k) {
  if (k.zielQuote == null) return '';
  const breite = Math.min(100, k.zielQuote * 100);
  return `
    <div class="summary-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(breite)}" aria-label="Ziel-Erreichung">
      <div class="summary-progress-fill${k.zielQuote >= 1 ? ' summary-progress-fill--success' : ''}" style="width: ${breite.toFixed(1)}%"></div>
    </div>
    <div class="budget-tab__stat-sub">${esc(`${prozent(k.zielQuote, 0)} von ${kompakt(k.zielAufrufe)} Ziel`)}</div>`;
}

/** Ohne Wert steht „–“ ohne Zähler da, die Unterzeile nennt, woher der Wert käme. */
function renderKarte(karte, k) {
  const wert = kachelWert(karte, k);
  const sub = kachelSub(karte, k);
  const wertHtml = wert == null
    ? `<div class="budget-tab__stat-value auswertung-stat__leer">${esc(wertNachArt(karte.art, null))}</div>`
    : `<div class="budget-tab__stat-value" ${zaehl(karte.key, wert, karte.art)}>${esc(wertNachArt(karte.art, wert))}</div>`;
  return `
    <div class="budget-tab__stat auswertung-stat">
      <div class="budget-tab__stat-label">${esc(karte.label)}</div>
      ${renderCardHintHtml(karte.hint)}
      ${wertHtml}
      <div class="budget-tab__stat-sub" title="${esc(sub)}">${esc(sub)}</div>
      ${karte.key === 'aufrufe' ? zielFortschritt(k) : ''}
    </div>`;
}

/**
 * Alle Kacheln stehen immer da, auch ohne Grundlage (dann mit „–“), damit der Aufbau des Reports
 * gleich bleibt. Kosten nur mit Preis-Sicht. Zwei gleich breite Reihen (`--4` oder `--5`).
 */
export function renderKennzahlen(modell, { zeigeKosten = false } = {}) {
  const k = modell.kennzahlen;
  const karten = KACHELN.filter(karte => !karte.preis || zeigeKosten);
  const spalten = Math.ceil(karten.length / 2);
  return `<div class="budget-tab__stats auswertung-stats auswertung-stats--${spalten}">${karten.map(karte => renderKarte(karte, k)).join('')}</div>`;
}

function leer(team) {
  return renderEmptyState({
    icon: 'info',
    title: team ? 'Noch keine Posts' : 'Noch keine Zahlen',
    text: team ? 'Sobald die Produktion Kooperationen mit Videos hat, stehen sie hier.' : 'Der Report wird vorbereitet.'
  });
}

/**
 * Inhalt unter den Unterreitern für die Report-Ansicht. Ohne bestätigten Post sieht das Team schon
 * Kacheln und alle möglichen Posts, nur ohne Zahlen.
 * @param {object} modell - baueModell
 * @param {{ sort?: object, filter?: object, team?: boolean, zeigeKosten?: boolean }} opts
 */
export function renderReport(modell, { sort, filter, team = false, zeigeKosten = false } = {}) {
  const bestaetigt = modell.fortschritt.bestaetigt > 0;
  if (!bestaetigt && (!team || !modell.einheiten.length)) return leer(team);
  return `
    ${renderKennzahlen(modell, { zeigeKosten })}
    <section class="auswertung-posts" data-auswertung-tabelle>${renderTabelle(modell, { sort, filter, team })}</section>`;
}
