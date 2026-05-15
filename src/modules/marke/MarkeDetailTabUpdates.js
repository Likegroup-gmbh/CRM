// MarkeDetailTabUpdates.js
// DOM-Update-Funktionen: ersetzen Tab-Inhalte nach Lazy-Load

import { renderKampagnen, renderAuftraege, renderBriefings, renderKooperationen, renderRechnungen, renderStrategien } from './MarkeDetailRendererTables.js';
import { renderKickOff } from './MarkeDetailRendererKickOff.js';

export function updateKampagnenTab(detail) {
  const container = document.querySelector('#tab-kampagnen .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderKampagnen(detail);
  }
}

export function updateAuftraegeTab(detail) {
  const container = document.querySelector('#tab-auftraege .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderAuftraege(detail);
  }
}

export function updateBriefingsTab(detail) {
  const container = document.querySelector('#tab-briefings .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderBriefings(detail);
  }
}

export function updateKooperationenTab(detail) {
  const container = document.querySelector('#tab-kooperationen .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderKooperationen(detail);
  }
}

export function updateRechnungenTab(detail) {
  const container = document.querySelector('#tab-rechnungen .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderRechnungen(detail);
  }
}

export function updateStrategienTab(detail) {
  const container = document.querySelector('#tab-strategien .data-table-container');
  if (container) {
    container.parentElement.innerHTML = renderStrategien(detail);
  }
}

export function updateKickOffTab(detail) {
  const pane = document.querySelector('#tab-kickoff');
  if (pane) {
    pane.innerHTML = renderKickOff(detail);
  }
}
