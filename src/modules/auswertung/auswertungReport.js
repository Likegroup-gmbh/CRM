// auswertungReport.js
// Report-Ansicht (Spec 5) im Stil des Budget-Tabs: Kopf mit Lead-Satz, Kennzahlen mit
// Formel-Hinweis, Aufschlüsselung neben der Zusammenfassung und die Post-Tabelle. Zahlen mit data-count zählen beim Wechsel hoch.

import { renderCardHintHtml } from '../../core/budget/cardHints.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { esc, euro, kompakt, plural, prozent, wertNachArt } from './auswertungFormat.js';
import { renderDiagramm } from './auswertungDiagramm.js';
import { renderZusammenfassung } from './auswertungZusammenfassung.js';
import { renderTabelle } from './auswertungTabelle.js';

// `leer`: Unterzeile, solange noch kein Post bestätigt ist
const KARTEN = [
  {
    key: 'aufrufe', label: 'Aufrufe', art: 'zahl', wert: k => k.aufrufe,
    sub: k => `Ø ${kompakt(k.aufrufeProPost)} pro Post`,
    leer: () => 'Summe der bestätigten Posts',
    hint: { formula: 'Σ Aufrufe der bestätigten Posts', hint: 'Ziel-Erreichung = Aufrufe ÷ Ziel' }
  },
  {
    key: 'reach', label: 'Betrachter', art: 'zahl', wert: k => k.reach,
    sub: k => `aus ${plural(k.reachPosts, 'Instagram-Post', 'Instagram-Posts')}`,
    leer: () => 'nur Instagram',
    hint: { formula: 'Σ Betrachter', hint: 'Konten, die den Post gesehen haben, jedes einmal (Aufrufe zählen jede Wiedergabe). Nur Instagram – TikTok weist das nicht aus' }
  },
  {
    key: 'engagement', label: 'Engagement-Rate', art: 'prozent', wert: k => k.engagementRate,
    sub: k => `${kompakt(k.interaktionen)} Interaktionen`,
    leer: () => 'über alle bestätigten Posts',
    hint: { formula: 'Σ Interaktionen ÷ Σ Basis', hint: 'Basis: Betrachter (Instagram) bzw. Aufrufe (TikTok), gewichtet über alle Posts' }
  },
  {
    key: 'wiedergabe', label: 'Ø Wiedergabe', art: 'sekunden', wert: k => k.wiedergabe,
    sub: k => `über ${plural(k.wiedergabePosts, 'Reel oder TikTok', 'Reels & TikToks')}`,
    leer: () => 'Reels & TikToks',
    hint: { formula: 'Mittel der Ø Wiedergabe je Post', hint: 'nur Posts, die den Wert ausweisen' }
  },
  {
    key: 'klicks', label: 'Link-Klicks', art: 'zahl', wert: k => k.linkKlicks,
    sub: k => `aus ${plural(k.linkKlicksStories, 'Story', 'Stories')}`,
    leer: () => 'nur Instagram-Stories',
    hint: { formula: 'Σ Link-Klicks', hint: 'nur Instagram-Stories' }
  },
  {
    key: 'sticker', label: 'Sticker-Taps', art: 'zahl', wert: k => k.stickerTaps,
    sub: k => `aus ${plural(k.stickerTapsStories, 'Story', 'Stories')}`,
    leer: () => 'nur Instagram-Stories',
    hint: { formula: 'Σ „Auf Sticker getippt“', hint: 'nur Instagram-Stories, alle Sticker zusammen (Erwähnung, Hashtag, Ort …). Der Link-Sticker zählt bei den Link-Klicks' }
  },
  {
    key: 'kosten', label: 'Kosten pro 1.000 Aufrufe', art: 'euro', wert: k => k.kostenPro1000, preis: true,
    sub: k => `${euro(k.verbrauch)} Verbrauch`,
    leer: k => (k.verbrauch ? `${euro(k.verbrauch)} Verbrauch` : 'noch kein Verbrauch'),
    hint: { formula: 'Verbrauch ÷ Aufrufe × 1.000', hint: 'Verbrauch: VK netto der Videos plus Zusatzkosten der Kooperationen' }
  }
];

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

function renderKarte(karte, k) {
  const wert = karte.wert(k);
  const sub = karte.sub(k);
  return `
    <div class="budget-tab__stat auswertung-stat">
      <div class="budget-tab__stat-label">${esc(karte.label)}</div>
      ${renderCardHintHtml(karte.hint)}
      <div class="budget-tab__stat-value" ${zaehl(karte.key, wert, karte.art)}>${esc(wertNachArt(karte.art, wert))}</div>
      <div class="budget-tab__stat-sub" title="${esc(sub)}">${esc(sub)}</div>
      ${karte.key === 'aufrufe' ? zielFortschritt(k) : ''}
    </div>`;
}

function renderLeereKarte(karte, k) {
  const sub = karte.leer(k);
  return `
    <div class="budget-tab__stat auswertung-stat">
      <div class="budget-tab__stat-label">${esc(karte.label)}</div>
      ${renderCardHintHtml(karte.hint)}
      <div class="budget-tab__stat-value auswertung-stat__leer">${esc(wertNachArt(karte.art, null))}</div>
      <div class="budget-tab__stat-sub" title="${esc(sub)}">${esc(sub)}</div>
    </div>`;
}

/**
 * Kennzahlen ohne Grundlage fallen weg (Spec 4), Kosten nur mit Preis-Sicht. Ohne bestätigten
 * Post (`leer`) stehen alle Kacheln mit „–“ da, damit der Aufbau des Reports schon sichtbar ist.
 */
export function renderKennzahlen(modell, { zeigeKosten = false, leer = false } = {}) {
  const k = modell.kennzahlen;
  const karten = KARTEN
    .filter(karte => leer || karte.wert(k) != null)
    .filter(karte => !karte.preis || zeigeKosten)
    .map(karte => (leer ? renderLeereKarte(karte, k) : renderKarte(karte, k)));
  return `<div class="budget-tab__stats auswertung-stats">${karten.join('')}</div>`;
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
 * @param {{ auswahl?: object, sort?: object, team?: boolean, zeigeKosten?: boolean }} opts
 */
export function renderReport(modell, { auswahl = {}, sort, team = false, zeigeKosten = false } = {}) {
  if (!modell.fortschritt.bestaetigt) {
    if (!team || !modell.einheiten.length) return leer(team);
    return `
      ${renderKennzahlen(modell, { zeigeKosten, leer: true })}
      <section class="auswertung-posts" data-auswertung-tabelle>${renderTabelle(modell, { sort, team })}</section>`;
  }
  return `
    ${renderKennzahlen(modell, { zeigeKosten })}
    <div class="auswertung-raster">
      <section class="auswertung-diagramm" data-auswertung-diagramm>${renderDiagramm(modell, auswahl)}</section>
      <section class="auswertung-zusammenfassung">${renderZusammenfassung(modell, { team })}</section>
    </div>
    <section class="auswertung-posts" data-auswertung-tabelle>${renderTabelle(modell, { sort, team })}</section>`;
}
