// Eingebettete Spaltenpflege im schon offenen Drawer "Tabelle anpassen".
// Kein zweites Overlay: Zurück gibt den Drawer-Inhalt wieder frei.

import { escapeHtml, extractCustomColumnUuid, isCustomColumnId } from './entityColumnUtils.js';
import { renderSavedOptionsHtml } from './dropdownOptionRows.js';

const TYPE_LABELS = {
  text: 'Text',
  link: 'Link',
  date: 'Datum',
  boolean: 'Ja/Nein (Checkbox)',
  dropdown: 'Dropdown',
  number: 'Zahl',
  upload: 'Datei-Upload'
};

function columnUuid(columnId) {
  if (!columnId) return null;
  return isCustomColumnId(columnId) ? extractCustomColumnUuid(columnId) : columnId;
}

function renderEdit(col) {
  const typeLabel = TYPE_LABELS[col.field_type] || col.field_type;
  const options = col.field_type === 'dropdown'
    ? `<label class="cc-field-label">Optionen</label><div class="cc-dropdown-panel" data-column-id="${escapeHtml(col.id)}">${renderSavedOptionsHtml(col)}</div>`
    : '';
  return `
    <div class="cc-add-form">
      <div class="cc-add-form-title">Spalte bearbeiten</div>
      <label class="cc-field-label">Name</label>
      <input type="text" class="custom-col-name-input cc-field-input" value="${escapeHtml(col.name)}" data-column-id="${escapeHtml(col.id)}" placeholder="Spaltenname"/>
      <label class="cc-field-label">Typ</label>
      <span class="tag tag--type">${escapeHtml(typeLabel)}</span>
      <label class="cc-field-label cc-field-label-row">
        <span>Für Kunden sichtbar</span>
        <label class="toggle-switch">
          <input type="checkbox" class="custom-col-kunde-toggle" data-column-id="${escapeHtml(col.id)}" ${col.visible_for_kunden ? 'checked' : ''}/>
          <span class="toggle-slider"></span>
        </label>
      </label>
      ${options}
      <div class="cc-add-form-actions">
        <button type="button" class="mdc-btn mdc-btn--secondary custom-col-delete-btn" data-column-id="${escapeHtml(col.id)}" data-column-name="${escapeHtml(col.name)}">Löschen</button>
      </div>
    </div>`;
}

export function renderEntityEmbed(drawer) {
  const host = drawer._host;
  if (!host) return;
  const col = drawer._embeddedColumnId
    ? (drawer.columns || []).find(item => item.id === drawer._embeddedColumnId)
    : null;
  const back = `<button type="button" class="mdc-btn mdc-btn--secondary" data-action="spalten-pflege-zurueck">Zurück</button>`;
  const form = col ? renderEdit(col) : (drawer._renderAddForm?.() || '');
  host.innerHTML = `<div class="tabelle-spalten-pflege">${back}${form}</div>`;
  drawer._bindInteractions?.(host);
}

export function leaveEntityEmbed(drawer) {
  if (!drawer._embedded && !drawer._onBack) return;
  drawer._unbindInteractions?.();
  drawer._embedded = false;
  drawer._embeddedColumnId = null;
  drawer._host = null;
  const back = drawer._onBack;
  drawer._onBack = null;
  back?.();
}

export function mountEntityColumnEditor(drawer, host, { columnId = null, onBack } = {}) {
  drawer._unbindInteractions?.();
  drawer._embedded = true;
  drawer._host = host;
  drawer._onBack = onBack;
  drawer._embeddedColumnId = columnUuid(columnId);
  drawer._newColumnDropdownOptions = [];
  drawer._leaveEmbed = () => leaveEntityEmbed(drawer);
  renderEntityEmbed(drawer);
}
