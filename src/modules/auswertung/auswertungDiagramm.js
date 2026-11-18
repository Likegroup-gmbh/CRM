// auswertungDiagramm.js
// Aufschlüsselung als Balkenzeilen wie „Verteilung“ im Budget-Tab: je Gruppe Label, Anzahl Posts,
// Balken und Wert, absolut nach der Kennzahl sortiert. Auswahl über zwei Segment-Umschalter.

import { renderSegmentSwitch } from '../../core/components/SegmentSwitch.js';
import { DIAGRAMM_KENNZAHLEN } from './auswertungKonfig.js';
import { gruppiere } from './auswertungKennzahlen.js';
import { esc, plural, wertNachArt } from './auswertungFormat.js';

export const DIAGRAMM_SEG_ATTR = 'data-auswertung-seg';

const KENNZAHL_ART = { aufrufe: 'zahl', engagement: 'prozent', wiedergabe: 'sekunden' };

/** Gültige Auswahl für das Modell: unbekannte oder hier nicht verfügbare Werte fallen auf den ersten. */
export function diagrammAuswahl(modell, { nach, kennzahl } = {}) {
  const optionen = modell.aufschluesselungen.map(a => a.value);
  return {
    nach: optionen.includes(nach) ? nach : optionen[0],
    kennzahl: DIAGRAMM_KENNZAHLEN.some(k => k.value === kennzahl) ? kennzahl : DIAGRAMM_KENNZAHLEN[0].value
  };
}

function zeile(g, max, art) {
  const anteil = max > 0 ? Math.max(1.5, (g.wert / max) * 100) : 0;
  return `
    <div class="budget-tab__creator auswertung-balken${g.leer ? ' auswertung-balken--leer' : ''}" data-flip-id="${esc(g.key)}">
      <div class="budget-tab__creator-name">
        <div class="budget-tab__creator-title" title="${esc(g.label)}">${esc(g.label)}</div>
      </div>
      <div class="budget-tab__track">
        <div class="budget-tab__track-fill budget-tab__track-fill--${g.leer ? 'andere' : 'gesamt'}" data-balken style="width: ${anteil.toFixed(3)}%"></div>
      </div>
      <div class="budget-tab__creator-sum">
        <div class="budget-tab__creator-betrag">${esc(wertNachArt(art, g.wert))}</div>
        <div class="budget-tab__creator-sub">${esc(plural(g.posts, 'Post', 'Posts'))}</div>
      </div>
    </div>`;
}

/** Nur die Zeilen, damit ein Wechsel sie ohne die Umschalter neu schreiben kann. */
export function renderDiagrammZeilen(modell, auswahl) {
  const { nach, kennzahl } = diagrammAuswahl(modell, auswahl);
  const gruppen = gruppiere(modell.posts, modell.einheitenById, nach, kennzahl);
  if (!gruppen.length) return '<p class="budget-tab__leer">Keine Daten für diese Kennzahl.</p>';
  const max = gruppen[0].wert;
  return gruppen.map(g => zeile(g, max, KENNZAHL_ART[kennzahl])).join('');
}

function untertitel(modell, { nach, kennzahl }) {
  const k = DIAGRAMM_KENNZAHLEN.find(x => x.value === kennzahl)?.label || '';
  const a = modell.aufschluesselungen.find(x => x.value === nach)?.label || '';
  return `${k} je ${a}`;
}

export function renderDiagramm(modell, auswahlRoh) {
  const auswahl = diagrammAuswahl(modell, auswahlRoh);
  const nach = renderSegmentSwitch({
    id: 'nach',
    label: 'Aufschlüsseln nach',
    options: modell.aufschluesselungen.map(a => ({ value: a.value, label: a.label })),
    value: auswahl.nach,
    attr: DIAGRAMM_SEG_ATTR
  });
  const kennzahl = renderSegmentSwitch({
    id: 'kennzahl',
    label: 'Kennzahl',
    options: DIAGRAMM_KENNZAHLEN,
    value: auswahl.kennzahl,
    attr: DIAGRAMM_SEG_ATTR
  });
  return `
    <div class="budget-tab__section-head">
      <h4 class="budget-tab__section-title">Aufschlüsselung</h4>
      <p class="budget-tab__section-sub" data-diagramm-sub>${esc(untertitel(modell, auswahl))}</p>
    </div>
    <div class="auswertung-diagramm__steuerung">${nach}${kennzahl}</div>
    <div class="budget-tab__creators auswertung-diagramm__zeilen" data-diagramm-zeilen>${renderDiagrammZeilen(modell, auswahl)}</div>`;
}

/** Untertitel nach einem Wechsel nachziehen. */
export function syncDiagrammUntertitel(root, modell, auswahl) {
  const sub = root?.querySelector('[data-diagramm-sub]');
  if (sub) sub.textContent = untertitel(modell, diagrammAuswahl(modell, auswahl));
}
