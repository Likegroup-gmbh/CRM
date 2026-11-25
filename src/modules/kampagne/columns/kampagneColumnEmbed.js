// Eingebettete Spaltenpflege der Kampagne im Drawer "Tabelle anpassen".

import { extractCustomColumnUuid, isCustomColumnId } from '../../../core/customColumns/entityColumnUtils.js';
import { renderSavedOptionsHtml } from '../../../core/customColumns/dropdownOptionRows.js';

function columnUuid(columnId) {
  if (!columnId) return null;
  return isCustomColumnId(columnId) ? extractCustomColumnUuid(columnId) : columnId;
}

export function renderKampagneEmbed(drawer) {
  const host = drawer._host;
  if (!host) return;
  const col = drawer._embeddedColumnId
    ? (drawer.store?.customColumns || []).find(item => item.id === drawer._embeddedColumnId)
    : null;
  drawer._editingColumnId = col?.id || null;
  drawer._newColumnDropdownOptions = [];
  const options = col?.field_type === 'dropdown'
    ? `<div id="cc-embedded-options" class="cc-dropdown-panel" data-column-id="${drawer._esc(col.id)}">${renderSavedOptionsHtml(col)}</div>`
    : '<div id="cc-embedded-options"></div>';
  const del = col
    ? `<div class="cc-add-form-actions"><button type="button" class="mdc-btn mdc-btn--secondary custom-col-delete-btn" data-column-id="${drawer._esc(col.id)}" data-column-name="${drawer._esc(col.name)}">Löschen</button></div>`
    : '';
  host.innerHTML = `
    <div class="tabelle-spalten-pflege">
      <button type="button" class="mdc-btn mdc-btn--secondary" data-action="spalten-pflege-zurueck">Zurück</button>
      <div id="custom-column-form-area">${drawer._renderAddForm()}</div>
      ${options}
      ${del}
    </div>`;
  drawer._bindEvents(host);
  drawer._applyFormMode(col);
}

export function leaveKampagneEmbed(drawer) {
  if (!drawer._embedded && !drawer._onBack) return;
  drawer._unbindInteractions?.();
  drawer._embedded = false;
  drawer._embeddedColumnId = null;
  drawer._editingColumnId = null;
  drawer._host = null;
  const back = drawer._onBack;
  drawer._onBack = null;
  back?.();
}

export function mountKampagneColumnEditor(drawer, host, { columnId = null, onBack } = {}) {
  drawer._unbindInteractions?.();
  drawer._embedded = true;
  drawer._host = host;
  drawer._onBack = onBack;
  drawer._embeddedColumnId = columnUuid(columnId);
  drawer._leaveEmbed = () => leaveKampagneEmbed(drawer);
  renderKampagneEmbed(drawer);
}
