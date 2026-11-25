// "Spalte hinzufügen" und "Bearbeiten" im Drawer "Tabelle anpassen".

import { escapeHtml, isCustomColumnId } from './entityColumnUtils.js';
import { icon } from '../icons/IconSystem.js';

export function renderSpalteHinzufuegen() {
  return `
    <div class="cc-add-section tabelle-spalte-hinzufuegen">
      <button type="button" class="mdc-btn mdc-btn--secondary" data-action="spalte-hinzufuegen">
        ${icon('plus')}
        Spalte hinzufügen
      </button>
    </div>`;
}

export function renderSpaltenName(label, columnId) {
  const name = escapeHtml(label);
  if (!isCustomColumnId(columnId)) {
    return `<span class="sourcing-spalten-name">${name}</span>`;
  }
  return `<span class="sourcing-spalten-name sourcing-spalten-name--mit-aktion"><span>${name}</span><button type="button" class="btn-icon sourcing-spalte-bearbeiten" data-action="spalte-bearbeiten" data-column="${escapeHtml(columnId)}" title="Spalte bearbeiten" aria-label="Spalte bearbeiten">${icon('pencil-square')}</button></span>`;
}
