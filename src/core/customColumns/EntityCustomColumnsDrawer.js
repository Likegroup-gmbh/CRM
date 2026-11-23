// EntityCustomColumnsDrawer.js
// Verwaltungs-UI fuer generische Custom Columns (Sourcing/Strategie):
// Anlegen, Umbenennen, Loeschen, Typ, Kunden-Sichtbarkeit, Dropdown-Optionen.
// Einstufig (keine Ebenen-Auswahl wie bei der Kampagne).

import { makeCustomColumnId, escapeHtml, parseOrderEntry } from './entityColumnUtils.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { DRAWER_EXIT_MS } from '../animation/drawer.js';
import { renderDraftOptionsHtml, renderSavedOptionsHtml } from './dropdownOptionRows.js';
import { mountEntityColumnEditor, renderEntityEmbed } from './entityColumnEmbed.js';
import { installEntityColumnEvents } from './entityColumnDrawerEvents.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'link', label: 'Link' },
  { value: 'date', label: 'Datum' },
  { value: 'boolean', label: 'Ja/Nein (Checkbox)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number', label: 'Zahl' },
  { value: 'upload', label: 'Datei-Upload' }
];

export class EntityCustomColumnsDrawer {
  /**
   * @param {object} cfg
   * @param {import('./EntityCustomColumnDataLoader.js').EntityCustomColumnDataLoader} cfg.dataLoader
   * @param {Array} cfg.columns  Referenz auf die Spalten-Liste (wird mutiert)
   * @param {Array} cfg.order    Referenz auf das Order-Array (wird mutiert)
   * @param {() => void} cfg.onChange  wird nach jeder Aenderung aufgerufen (Tabelle neu rendern)
   */
  constructor({ dataLoader, columns, order, onChange }) {
    this.dataLoader = dataLoader;
    this.columns = columns;
    this.order = Array.isArray(order) ? order : [];
    this.onChange = onChange;
    this.drawerId = 'entity-custom-columns-drawer';
    this._expandedDropdownColId = null;
    this._newColumnDropdownOptions = [];
  }

  open() {
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
    requestAnimationFrame(() => { overlay.classList.add('active'); panel.classList.add('show'); });
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

  _renderContent() {
    const rows = (this.columns || []).map(col => this._renderColumnRow(col)).join('');
    return `
      <div class="custom-columns-list">
        ${(this.columns || []).length > 0
          ? `<table class="custom-columns-table">
              <thead><tr><th>Name</th><th>Typ</th><th>Kunde</th><th>Aktionen</th></tr></thead>
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
      <div id="entity-custom-column-form-area" style="display:none;">
        ${this._renderAddForm()}
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-entity-custom-columns">Fertig</button>
      </div>
    `;
  }

  _renderColumnRow(col) {
    const typeLabel = FIELD_TYPES.find(t => t.value === col.field_type)?.label || col.field_type;
    const isExpanded = this._expandedDropdownColId === col.id;

    let dropdownRow = '';
    if (col.field_type === 'dropdown') {
      const icon = isExpanded ? '▾' : '▸';
      const cnt = (col._dropdownOptions || []).length;
      dropdownRow = `
        <tr class="cc-dropdown-toggle-row">
          <td colspan="4">
            <button type="button" class="cc-dropdown-toggle" data-column-id="${col.id}">${icon} Optionen (${cnt})</button>
            ${isExpanded ? `<div class="cc-dropdown-panel" data-column-id="${col.id}">${renderSavedOptionsHtml(col)}</div>` : ''}
          </td>
        </tr>`;
    }

    return `
      <tr data-column-id="${col.id}">
        <td><input type="text" class="custom-col-name-input" value="${escapeHtml(col.name)}" data-column-id="${col.id}" placeholder="Spaltenname"/></td>
        <td><span class="tag tag--type">${typeLabel}</span></td>
        <td>
          <label class="toggle-switch toggle-switch-small">
            <input type="checkbox" class="custom-col-kunde-toggle" data-column-id="${col.id}" ${col.visible_for_kunden ? 'checked' : ''}/>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button type="button" class="btn-icon btn-danger-icon custom-col-delete-btn" data-column-id="${col.id}" data-column-name="${escapeHtml(col.name)}" title="Spalte löschen">
            ${icon('trash-alt')}
          </button>
        </td>
      </tr>
      ${dropdownRow}`;
  }

  _renderAddForm() {
    const typeOpts = FIELD_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    const newOptsHtml = renderDraftOptionsHtml(this._newColumnDropdownOptions);

    return `
      <div class="cc-add-form">
        <div class="cc-add-form-title">Neue Spalte</div>
        <label class="cc-field-label">Name</label>
        <input type="text" id="entity-cc-new-name" placeholder="z.B. Notiz, Bewertung …" class="cc-field-input"/>
        <label class="cc-field-label">Typ</label>
        <select id="entity-cc-new-type" class="cc-field-select">${typeOpts}</select>
        <div class="cc-new-dd-area" style="display:none;">
          <label class="cc-field-label">Dropdown-Optionen</label>
          <div class="cc-new-dd-list">${newOptsHtml}</div>
          <div class="dd-opts-add-row">
            <input type="text" class="dd-opt-input" id="entity-cc-new-opt-input" placeholder="Option eingeben…"/>
            <button type="button" class="dd-opts-add-btn" id="btn-entity-cc-new-opt-add">+</button>
          </div>
        </div>
        <label class="cc-field-label cc-field-label-row">
          <span>Für Kunden sichtbar</span>
          <label class="toggle-switch">
            <input type="checkbox" id="entity-cc-new-kunde-visible"/>
            <span class="toggle-slider"></span>
          </label>
        </label>
        <div class="cc-add-form-actions">
          <button type="button" class="mdc-btn mdc-btn--secondary" id="btn-entity-cancel-add-column">Abbrechen</button>
          <button type="button" class="mdc-btn" id="btn-entity-confirm-add-column">Anlegen</button>
        </div>
      </div>`;
  }

  mountIn(host, opts) {
    mountEntityColumnEditor(this, host, opts);
  }

  unmount() {
    this._unbindInteractions?.();
    this._embedded = false;
    this._onBack = null;
    this._host = null;
  }

  _onNewTypeChange(val) {
    const area = document.querySelector('.cc-new-dd-area');
    if (area) area.style.display = val === 'dropdown' ? '' : 'none';
  }

  _handleAddNewColumnOption() {
    const input = document.getElementById('entity-cc-new-opt-input');
    const label = input?.value.trim();
    if (!label) return;
    if (this._newColumnDropdownOptions.includes(label)) {
      window.toastSystem?.show('Option existiert bereits', 'warning');
      return;
    }
    this._newColumnDropdownOptions.push(label);
    input.value = '';
    this._refreshNewOptsList();
    input.focus();
  }

  _showAddForm() {
    this._newColumnDropdownOptions = [];
    const area = document.getElementById('entity-custom-column-form-area');
    if (area) area.style.display = '';
    this._refreshNewOptsList();
    document.getElementById('entity-cc-new-name')?.focus();
  }

  _hideAddForm() {
    if (this._embedded) {
      this._leaveEmbed?.();
      return;
    }
    const area = document.getElementById('entity-custom-column-form-area');
    if (area) area.style.display = 'none';
    const n = document.getElementById('entity-cc-new-name');
    if (n) n.value = '';
    this._newColumnDropdownOptions = [];
  }

  async _handleAddColumn() {
    const name = document.getElementById('entity-cc-new-name')?.value.trim();
    const fieldType = document.getElementById('entity-cc-new-type')?.value;
    const visibleForKunden = document.getElementById('entity-cc-new-kunde-visible')?.checked || false;
    if (!name) { window.toastSystem?.show('Bitte einen Namen eingeben', 'warning'); return; }

    try {
      const col = await this.dataLoader.createColumn({ name, field_type: fieldType, visible_for_kunden: visibleForKunden });
      if (fieldType === 'dropdown' && this._newColumnDropdownOptions.length > 0) {
        const created = [];
        for (const lbl of this._newColumnDropdownOptions) {
          try { created.push(await this.dataLoader.addDropdownOption(col.id, lbl)); }
          catch (e) { console.warn('⚠️ Option nicht angelegt:', lbl, e); }
        }
        col._dropdownOptions = created;
      }
      this.columns.push(col);
      this.order.push(makeCustomColumnId(col.id));
      await this.dataLoader.saveColumnOrder(this.order);
      this._hideAddForm();
      this._refreshContent();
      this.onChange?.();
      window.toastSystem?.show(`Spalte „${name}" angelegt`, 'success');
    } catch (error) {
      console.error('❌ Spalte anlegen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Anlegen der Spalte', 'error');
    }
  }

  async _handleDeleteColumn(columnId, columnName) {
    const { confirmed } = await window.confirmationModal.open({
      title: 'Spalte löschen',
      message: `Spalte „${columnName}" wirklich löschen? Alle eingegebenen Werte gehen verloren.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!confirmed) return;
    try {
      await this.dataLoader.deleteColumn(columnId);
      const idx = this.columns.findIndex(c => c.id === columnId);
      if (idx >= 0) this.columns.splice(idx, 1);
      const deletedId = makeCustomColumnId(columnId);
      const orderIdx = this.order.findIndex(e => parseOrderEntry(e)?.id === deletedId);
      if (orderIdx >= 0) this.order.splice(orderIdx, 1);
      await this.dataLoader.saveColumnOrder(this.order);
      this.onChange?.();
      window.toastSystem?.show(`Spalte „${columnName}" gelöscht`, 'success');
      if (this._embedded) {
        this._leaveEmbed?.();
        return;
      }
      this._refreshContent();
    } catch (error) {
      console.error('❌ Spalte löschen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async _handleRename(columnId, newName) {
    if (!newName) return;
    const col = this.columns.find(c => c.id === columnId);
    if (!col || col.name === newName) return;
    try {
      await this.dataLoader.updateColumn(columnId, { name: newName });
      col.name = newName;
      this.onChange?.();
    } catch (error) {
      console.error('❌ Umbenennen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Umbenennen', 'error');
    }
  }

  async _handleKundeToggle(columnId, visible) {
    const col = this.columns.find(c => c.id === columnId);
    try {
      await this.dataLoader.updateColumn(columnId, { visible_for_kunden: visible });
      if (col) col.visible_for_kunden = visible;
      this.onChange?.();
    } catch (error) {
      console.error('❌ Kunden-Sichtbarkeit fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Ändern', 'error');
    }
  }

  _toggleDropdownOptions(columnId) {
    this._expandedDropdownColId = this._expandedDropdownColId === columnId ? null : columnId;
    this._refreshContent();
  }

  _refreshContent() {
    if (this._embedded) {
      renderEntityEmbed(this);
      return;
    }
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = this._renderContent();
    this._bindEvents(body);
  }

  removeDrawer() {
    clearTimeout(this._closeTimer);
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    if (panel) panel.classList.remove('show');
    if (overlay) overlay.classList.remove('active');
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
  }
}

installEntityColumnEvents(EntityCustomColumnsDrawer.prototype);
