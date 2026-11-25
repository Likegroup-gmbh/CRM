// CustomColumnsDrawer.js
// Verwaltungs-UI fuer Custom Columns: Anlegen, Umbenennen, Loeschen,
// Typ/Ebene/Kunden-Sichtbarkeit, Dropdown-Optionen.

import { renderEmptyState } from '../../../core/components/EmptyState.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { DRAWER_EXIT_MS } from '../../../core/animation/drawer.js';
import { renderDraftOptionsHtml, renderSavedOptionsHtml } from '../../../core/customColumns/dropdownOptionRows.js';
import { mountKampagneColumnEditor } from './kampagneColumnEmbed.js';
import { installKampagneColumnEvents } from './kampagneColumnDrawerEvents.js';
import { installKampagneColumnMutations } from './kampagneColumnMutations.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'comment', label: 'Kommentarfeld' },
  { value: 'link', label: 'Link' },
  { value: 'date', label: 'Datum' },
  { value: 'boolean', label: 'Ja/Nein (Checkbox)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number', label: 'Zahl' },
  { value: 'upload', label: 'Datei-Upload' }
];

// Beim Bearbeiten darf der Typ nur innerhalb dieser Gruppe wechseln: die Werte
// liegen als reiner Text vor, alle anderen Typen haetten inkompatible Daten
// (Checkbox, Datum, Zahl, Dropdown-Optionen, Upload-Assets).
const TEXT_LIKE_TYPES = ['text', 'comment', 'link'];

const ENTITY_TYPES = [
  { value: 'kooperation', label: 'Pro Kooperation (1 Wert pro Zeile)' },
  { value: 'video', label: 'Pro Video (gestapelt)' }
];

export class CustomColumnsDrawer {
  constructor(kampagneId, store, onRefilter) {
    this.kampagneId = kampagneId;
    this.store = store;
    this.onRefilter = onRefilter;
    this.drawerId = 'custom-columns-drawer';
    this._openRequestId = 0;
    this._expandedDropdownColId = null;
    this._newColumnDropdownOptions = [];
    this._editingColumnId = null;
  }

  async open() {
    ++this._openRequestId;
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    panel.appendChild(this._buildHeader());
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = this._renderContent();
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    this._bindEvents(body);
  }

  _buildHeader() {
    const header = document.createElement('div');
    header.className = 'drawer-header';
    const left = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Eigene Spalten';
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Spalten anlegen, bearbeiten und entfernen';
    left.appendChild(title);
    left.appendChild(subtitle);
    const right = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.close());
    right.appendChild(closeBtn);
    header.appendChild(left);
    header.appendChild(right);
    return header;
  }

  // ========================================
  // RENDERING
  // ========================================

  _renderContent() {
    const columns = this.store?.customColumns || [];
    const rows = columns.map(col => this._renderColumnRow(col)).join('');

    return `
      <div class="custom-columns-list">
        ${columns.length > 0
          ? `<table class="custom-columns-table">
              <thead><tr>
                <th>Name</th><th>Typ</th><th>Ebene</th><th>Kunde</th><th>Kunde bearbeitet</th><th>Aktionen</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : renderEmptyState({ title: 'Noch keine eigenen Spalten angelegt', size: 'small' })}
      </div>
      <div class="cc-add-section">
        <button type="button" class="mdc-btn mdc-btn--secondary" id="btn-add-custom-column">
          ${icon('plus')}
          Spalte hinzufügen
        </button>
      </div>
      <div id="custom-column-form-area" style="display:none;">
        ${this._renderAddForm()}
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-custom-columns">Fertig</button>
      </div>
    `;
  }

  _renderColumnRow(col) {
    const typeLabel = FIELD_TYPES.find(t => t.value === col.field_type)?.label || col.field_type;
    const entityLabel = col.entity_type === 'video' ? 'Video' : 'Kooperation';
    const isExpanded = this._expandedDropdownColId === col.id;

    let dropdownRow = '';
    if (col.field_type === 'dropdown') {
      const icon = isExpanded ? '▾' : '▸';
      const cnt = (col._dropdownOptions || []).length;
      dropdownRow = `
        <tr class="cc-dropdown-toggle-row">
          <td colspan="6">
            <button type="button" class="cc-dropdown-toggle" data-column-id="${col.id}">
              ${icon} Optionen (${cnt})
            </button>
            ${isExpanded ? `<div class="cc-dropdown-panel" data-column-id="${col.id}">${renderSavedOptionsHtml(col)}</div>` : ''}
          </td>
        </tr>`;
    }

    return `
      <tr data-column-id="${col.id}">
        <td>
          <input type="text" class="custom-col-name-input" value="${this._esc(col.name)}"
            data-column-id="${col.id}" placeholder="Spaltenname"/>
        </td>
        <td><span class="tag tag--type">${typeLabel}</span></td>
        <td><span class="tag tag--type">${entityLabel}</span></td>
        <td>
          <label class="toggle-switch toggle-switch-small">
            <input type="checkbox" class="custom-col-kunde-toggle"
              data-column-id="${col.id}" ${col.visible_for_kunden ? 'checked' : ''}/>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          ${col.field_type === 'upload' ? '<span class="text-muted">–</span>' : `
          <label class="toggle-switch toggle-switch-small">
            <input type="checkbox" class="custom-col-kunde-edit-toggle"
              data-column-id="${col.id}" ${col.editable_by_kunden && col.visible_for_kunden ? 'checked' : ''}
              ${col.visible_for_kunden ? '' : 'disabled'}/>
            <span class="toggle-slider"></span>
          </label>`}
        </td>
        <td>
          <div class="cc-row-actions">
            <button type="button" class="btn-icon custom-col-edit-btn"
              data-column-id="${col.id}" title="Spalte bearbeiten">
              ${icon('pencil-square')}
            </button>
            <button type="button" class="btn-icon btn-danger-icon custom-col-delete-btn"
              data-column-id="${col.id}" data-column-name="${this._esc(col.name)}" title="Spalte löschen">
              ${icon('trash-alt')}
            </button>
          </div>
        </td>
      </tr>
      ${dropdownRow}`;
  }

  _typeOptionsHtml(allowedValues = null) {
    return FIELD_TYPES
      .filter(t => !allowedValues || allowedValues.includes(t.value))
      .map(t => `<option value="${t.value}">${t.label}</option>`)
      .join('');
  }

  // Formular dient zum Anlegen UND Bearbeiten (siehe _showForm).
  _renderAddForm() {
    const typeOpts = this._typeOptionsHtml();
    const entityOpts = ENTITY_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');

    const newOptsHtml = renderDraftOptionsHtml(this._newColumnDropdownOptions);

    return `
      <div class="cc-add-form">
        <div class="cc-add-form-title" id="cc-form-title">Neue Spalte</div>

        <label class="cc-field-label">Name</label>
        <input type="text" id="cc-new-name" placeholder="z.B. Notiz, Bewertung …" class="cc-field-input"/>

        <label class="cc-field-label">Typ</label>
        <select id="cc-new-type" class="cc-field-select">${typeOpts}</select>
        <p class="cc-field-hint" id="cc-type-hint" style="display:none;">Der Typ lässt sich nur zwischen Text, Kommentarfeld und Link wechseln.</p>

        <div class="cc-new-dd-area" style="display:none;">
          <label class="cc-field-label">Dropdown-Optionen</label>
          <div class="cc-new-dd-list">${newOptsHtml}</div>
          <div class="dd-opts-add-row">
            <input type="text" class="dd-opt-input" id="cc-new-opt-input" placeholder="Option eingeben…"/>
            <button type="button" class="dd-opts-add-btn" id="btn-cc-new-opt-add">+</button>
          </div>
        </div>

        <label class="cc-field-label">Ebene</label>
        <select id="cc-new-entity" class="cc-field-select">${entityOpts}</select>
        <p class="cc-field-hint" id="cc-entity-hint" style="display:none;">Die Ebene lässt sich nachträglich nicht ändern.</p>

        <label class="cc-field-label cc-field-label-row">
          <span>Für Kunden sichtbar</span>
          <label class="toggle-switch">
            <input type="checkbox" id="cc-new-kunde-visible"/>
            <span class="toggle-slider"></span>
          </label>
        </label>

        <label class="cc-field-label cc-field-label-row" id="cc-new-kunde-edit-row">
          <span>Kunde darf ausfüllen</span>
          <label class="toggle-switch">
            <input type="checkbox" id="cc-new-kunde-editable" disabled/>
            <span class="toggle-slider"></span>
          </label>
        </label>

        <div class="cc-add-form-actions">
          <button type="button" class="mdc-btn mdc-btn--secondary" id="btn-cancel-add-column">Abbrechen</button>
          <button type="button" class="mdc-btn" id="btn-confirm-add-column">Anlegen</button>
        </div>
      </div>`;
  }

  // ========================================
  // EVENT BINDING
  // ========================================

  mountIn(host, opts) {
    mountKampagneColumnEditor(this, host, opts);
  }

  // ========================================
  // ADD-FORM HELPERS
  // ========================================

  _onNewTypeChange(val) {
    const area = document.querySelector('.cc-new-dd-area');
    // Optionen bestehender Dropdown-Spalten werden in der Tabellenzeile gepflegt.
    if (area) area.style.display = (val === 'dropdown' && !this._editingColumnId) ? '' : 'none';
    this._syncNewKundeEditRow();
  }

  // "Kunde darf ausfüllen" ist immer sichtbar, aber nur aktiv wenn die Spalte
  // fuer Kunden sichtbar ist und der Typ nicht Upload ist.
  _syncNewKundeEditRow() {
    const cb = document.getElementById('cc-new-kunde-editable');
    if (!cb) return;
    const visible = document.getElementById('cc-new-kunde-visible')?.checked;
    const type = document.getElementById('cc-new-type')?.value;
    const enabled = Boolean(visible) && type !== 'upload';
    cb.disabled = !enabled;
    if (!enabled) cb.checked = false;
  }

  // Formular oeffnen: ohne Argument = neue Spalte, mit Spalte = Bearbeiten.
  _showForm(col = null) {
    this._editingColumnId = col?.id || null;
    this._newColumnDropdownOptions = [];
    const area = document.getElementById('custom-column-form-area');
    if (area) area.style.display = '';
    this._refreshNewOptsList();
    this._applyFormMode(col);
    document.getElementById('cc-new-name')?.focus();
    area?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  // Befuellt/setzt das gemeinsame Formular fuer Anlegen bzw. Bearbeiten.
  _applyFormMode(col) {
    const editing = Boolean(col);
    const $ = (id) => document.getElementById(id);

    $('cc-form-title').textContent = editing ? 'Spalte bearbeiten' : 'Neue Spalte';
    $('btn-confirm-add-column').textContent = editing ? 'Speichern' : 'Anlegen';
    $('cc-new-name').value = col?.name || '';

    const typeSelect = $('cc-new-type');
    const typeLocked = editing && !TEXT_LIKE_TYPES.includes(col.field_type);
    typeSelect.innerHTML = this._typeOptionsHtml(
      editing ? (typeLocked ? [col.field_type] : TEXT_LIKE_TYPES) : null
    );
    typeSelect.value = col?.field_type || FIELD_TYPES[0].value;
    typeSelect.disabled = typeLocked;
    $('cc-type-hint').style.display = editing ? '' : 'none';

    // Ebene bleibt fix: Werte haengen an Kooperation- bzw. Video-IDs.
    const entitySelect = $('cc-new-entity');
    entitySelect.value = col?.entity_type || ENTITY_TYPES[0].value;
    entitySelect.disabled = editing;
    $('cc-entity-hint').style.display = editing ? '' : 'none';

    $('cc-new-kunde-visible').checked = Boolean(col?.visible_for_kunden);
    $('cc-new-kunde-editable').checked = Boolean(col?.editable_by_kunden && col?.visible_for_kunden);

    this._onNewTypeChange(typeSelect.value);
    // _syncNewKundeEditRow setzt "editierbar" bei deaktiviertem Zustand zurueck;
    // beim Bearbeiten den gespeicherten Wert wiederherstellen, falls erlaubt.
    const editCb = $('cc-new-kunde-editable');
    if (editing && !editCb.disabled) editCb.checked = Boolean(col.editable_by_kunden);
  }

  _hideAddForm() {
    if (this._embedded) {
      this._leaveEmbed?.();
      return;
    }
    this._editingColumnId = null;
    const area = document.getElementById('custom-column-form-area');
    if (area) area.style.display = 'none';
    this._applyFormMode(null);
    this._newColumnDropdownOptions = [];
  }

  _refreshContent() {
    if (this._embedded) {
      this._leaveEmbed?.();
      return;
    }
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    // Das Formular wird neu gerendert (versteckt) -> Bearbeiten-Modus verwerfen.
    this._editingColumnId = null;
    body.innerHTML = this._renderContent();
    this._bindEvents(body);
  }

  removeDrawer() {
    clearTimeout(this._closeTimer);
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    this._openRequestId += 1;
    const panel = document.getElementById(this.drawerId);
    if (panel) panel.classList.remove('show');
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
  }

  destroy() {
    this._openRequestId += 1;
    clearTimeout(this._closeTimer);
    this.removeDrawer();
    this._expandedDropdownColId = null;
    this._newColumnDropdownOptions = [];
    this._editingColumnId = null;
  }

  _esc(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
}

installKampagneColumnEvents(CustomColumnsDrawer.prototype);
installKampagneColumnMutations(CustomColumnsDrawer.prototype);
