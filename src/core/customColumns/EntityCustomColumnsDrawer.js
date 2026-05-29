// EntityCustomColumnsDrawer.js
// Verwaltungs-UI fuer generische Custom Columns (Sourcing/Strategie):
// Anlegen, Umbenennen, Loeschen, Typ, Kunden-Sichtbarkeit, Dropdown-Optionen.
// Einstufig (keine Ebenen-Auswahl wie bei der Kampagne).

import { makeCustomColumnId, escapeHtml } from './entityColumnUtils.js';

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
              <thead><tr><th>Name</th><th>Typ</th><th>Kunde</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : '<div class="empty-state-small"><p>Noch keine eigenen Spalten angelegt.</p></div>'}
      </div>
      <div class="cc-add-section">
        <button type="button" class="secondary-btn" id="btn-add-custom-column">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Spalte hinzufügen
        </button>
      </div>
      <div id="entity-custom-column-form-area" style="display:none;">
        ${this._renderAddForm()}
      </div>
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-entity-custom-columns">Fertig</button>
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
            ${isExpanded ? `<div class="cc-dropdown-panel" data-column-id="${col.id}">${this._renderDropdownOptions(col)}</div>` : ''}
          </td>
        </tr>`;
    }

    return `
      <tr data-column-id="${col.id}">
        <td><input type="text" class="custom-col-name-input" value="${escapeHtml(col.name)}" data-column-id="${col.id}" placeholder="Spaltenname"/></td>
        <td><span class="badge badge-muted">${typeLabel}</span></td>
        <td>
          <label class="toggle-switch toggle-switch-small">
            <input type="checkbox" class="custom-col-kunde-toggle" data-column-id="${col.id}" ${col.visible_for_kunden ? 'checked' : ''}/>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button type="button" class="btn-icon btn-danger-icon custom-col-delete-btn" data-column-id="${col.id}" data-column-name="${escapeHtml(col.name)}" title="Spalte löschen">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.327L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916A2.25 2.25 0 0 0 13.5 2.25h-3a2.25 2.25 0 0 0-2.25 2.25v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
          </button>
        </td>
      </tr>
      ${dropdownRow}`;
  }

  _renderDropdownOptions(col) {
    const opts = (col._dropdownOptions || []).slice().sort((a, b) => a.position - b.position);
    const rows = opts.map((opt, idx) => `
      <div class="dd-opt-row" data-option-id="${opt.id}" data-column-id="${col.id}">
        <div class="dd-opt-arrows">
          <button type="button" class="dd-opt-arrow dropdown-opt-move-up" data-option-id="${opt.id}" ${idx === 0 ? 'disabled' : ''} title="Hoch">↑</button>
          <button type="button" class="dd-opt-arrow dropdown-opt-move-down" data-option-id="${opt.id}" ${idx === opts.length - 1 ? 'disabled' : ''} title="Runter">↓</button>
        </div>
        <input type="text" class="dd-opt-input dropdown-opt-label" data-option-id="${opt.id}" data-column-id="${col.id}" value="${escapeHtml(opt.label)}"/>
        <button type="button" class="dd-opt-del dropdown-opt-delete" data-option-id="${opt.id}" data-column-id="${col.id}" title="Entfernen">&times;</button>
      </div>`).join('');

    return `
      <div class="dd-opts-list">${rows || '<p class="dd-opts-empty">Keine Optionen vorhanden.</p>'}</div>
      <div class="dd-opts-add-row">
        <input type="text" class="dd-opt-input dropdown-opt-new-input" data-column-id="${col.id}" placeholder="Neue Option…"/>
        <button type="button" class="dd-opts-add-btn dropdown-opt-add-btn" data-column-id="${col.id}">+</button>
      </div>`;
  }

  _renderAddForm() {
    const typeOpts = FIELD_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    const newOptsHtml = this._newColumnDropdownOptions.map((label, idx) => `
      <div class="dd-opt-row cc-new-opt-row">
        <span class="dd-opt-text">${escapeHtml(label)}</span>
        <button type="button" class="dd-opt-del cc-new-opt-delete" data-new-opt-idx="${idx}" title="Entfernen">&times;</button>
      </div>`).join('');

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
          <button type="button" class="secondary-btn" id="btn-entity-cancel-add-column">Abbrechen</button>
          <button type="button" class="primary-btn" id="btn-entity-confirm-add-column">Anlegen</button>
        </div>
      </div>`;
  }

  _bindEvents(body) {
    body.querySelector('#btn-close-entity-custom-columns')?.addEventListener('click', () => this.close());
    body.querySelector('#btn-add-custom-column')?.addEventListener('click', () => this._showAddForm());
    body.querySelector('#btn-entity-cancel-add-column')?.addEventListener('click', () => this._hideAddForm());
    body.querySelector('#btn-entity-confirm-add-column')?.addEventListener('click', () => this._handleAddColumn());

    const typeSelect = body.querySelector('#entity-cc-new-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this._onNewTypeChange(typeSelect.value));
      this._onNewTypeChange(typeSelect.value);
    }

    body.querySelector('#btn-entity-cc-new-opt-add')?.addEventListener('click', () => this._handleAddNewColumnOption());
    body.querySelector('#entity-cc-new-opt-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._handleAddNewColumnOption(); }
    });

    body.addEventListener('click', (e) => {
      const del = e.target.closest('.custom-col-delete-btn');
      if (del) return this._handleDeleteColumn(del.dataset.columnId, del.dataset.columnName);
      const toggle = e.target.closest('.cc-dropdown-toggle');
      if (toggle) return this._toggleDropdownOptions(toggle.dataset.columnId);
      const addOpt = e.target.closest('.dropdown-opt-add-btn');
      if (addOpt) return this._handleAddDropdownOption(addOpt.dataset.columnId);
      const delOpt = e.target.closest('.dropdown-opt-delete');
      if (delOpt) return this._handleDeleteDropdownOption(delOpt.dataset.optionId, delOpt.dataset.columnId);
      const up = e.target.closest('.dropdown-opt-move-up');
      if (up) return this._handleMoveDropdownOption(up.dataset.optionId, -1);
      const down = e.target.closest('.dropdown-opt-move-down');
      if (down) return this._handleMoveDropdownOption(down.dataset.optionId, 1);
      const delNew = e.target.closest('.cc-new-opt-delete');
      if (delNew) {
        this._newColumnDropdownOptions.splice(parseInt(delNew.dataset.newOptIdx, 10), 1);
        this._refreshNewOptsList();
      }
    });

    body.addEventListener('blur', (e) => {
      if (e.target.classList.contains('custom-col-name-input'))
        this._handleRename(e.target.dataset.columnId, e.target.value.trim());
      if (e.target.classList.contains('dropdown-opt-label'))
        this._handleRenameDropdownOption(e.target.dataset.optionId, e.target.dataset.columnId, e.target.value.trim());
    }, true);

    body.addEventListener('change', (e) => {
      if (e.target.classList.contains('custom-col-kunde-toggle'))
        this._handleKundeToggle(e.target.dataset.columnId, e.target.checked);
    });

    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('dropdown-opt-new-input')) {
        e.preventDefault();
        this._handleAddDropdownOption(e.target.dataset.columnId);
      }
    });
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

  _refreshNewOptsList() {
    const list = document.querySelector('.cc-new-dd-list');
    if (!list) return;
    list.innerHTML = this._newColumnDropdownOptions.map((label, idx) => `
      <div class="dd-opt-row cc-new-opt-row">
        <span class="dd-opt-text">${escapeHtml(label)}</span>
        <button type="button" class="dd-opt-del cc-new-opt-delete" data-new-opt-idx="${idx}" title="Entfernen">&times;</button>
      </div>`).join('');
  }

  _showAddForm() {
    this._newColumnDropdownOptions = [];
    const area = document.getElementById('entity-custom-column-form-area');
    if (area) area.style.display = '';
    this._refreshNewOptsList();
    document.getElementById('entity-cc-new-name')?.focus();
  }

  _hideAddForm() {
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
      const orderIdx = this.order.indexOf(makeCustomColumnId(columnId));
      if (orderIdx >= 0) this.order.splice(orderIdx, 1);
      await this.dataLoader.saveColumnOrder(this.order);
      this._refreshContent();
      this.onChange?.();
      window.toastSystem?.show(`Spalte „${columnName}" gelöscht`, 'success');
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

  async _handleAddDropdownOption(columnId) {
    const input = document.querySelector(`.dropdown-opt-new-input[data-column-id="${columnId}"]`);
    const label = input?.value.trim();
    if (!label) { window.toastSystem?.show('Bitte einen Wert eingeben', 'warning'); return; }
    const col = this.columns.find(c => c.id === columnId);
    if (!col) return;
    if ((col._dropdownOptions || []).some(o => o.label === label)) {
      window.toastSystem?.show('Option existiert bereits', 'warning'); return;
    }
    try {
      const newOpt = await this.dataLoader.addDropdownOption(columnId, label);
      (col._dropdownOptions ||= []).push(newOpt);
      this._refreshDropdownPanel(columnId);
      this.onChange?.();
    } catch (error) {
      console.error('❌ Option hinzufügen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }
  }

  async _handleDeleteDropdownOption(optionId, columnId) {
    const col = this.columns.find(c => c.id === columnId);
    if (!col) return;
    try {
      await this.dataLoader.deleteDropdownOption(optionId);
      col._dropdownOptions = (col._dropdownOptions || []).filter(o => o.id !== optionId);
      this._refreshDropdownPanel(columnId);
      this.onChange?.();
    } catch (error) {
      console.error('❌ Option löschen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async _handleRenameDropdownOption(optionId, columnId, newLabel) {
    if (!newLabel) return;
    const col = this.columns.find(c => c.id === columnId);
    if (!col) return;
    const opt = (col._dropdownOptions || []).find(o => o.id === optionId);
    if (!opt || opt.label === newLabel) return;
    try {
      await this.dataLoader.updateDropdownOption(optionId, { label: newLabel });
      opt.label = newLabel;
      this.onChange?.();
    } catch (error) {
      console.error('❌ Option umbenennen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Umbenennen', 'error');
    }
  }

  async _handleMoveDropdownOption(optionId, direction) {
    let col = null, opt = null;
    for (const c of (this.columns || [])) {
      const f = (c._dropdownOptions || []).find(o => o.id === optionId);
      if (f) { col = c; opt = f; break; }
    }
    if (!col || !opt) return;
    const sorted = [...(col._dropdownOptions || [])].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(o => o.id === optionId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      await this.dataLoader.swapDropdownPositions(opt, other);
      const tmp = opt.position; opt.position = other.position; other.position = tmp;
      this._refreshDropdownPanel(col.id);
      this.onChange?.();
    } catch (error) {
      console.error('❌ Option verschieben fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Verschieben', 'error');
    }
  }

  _refreshDropdownPanel(columnId) {
    const panel = document.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`);
    if (!panel) { this._refreshContent(); return; }
    const col = this.columns.find(c => c.id === columnId);
    if (col) panel.innerHTML = this._renderDropdownOptions(col);
  }

  _refreshContent() {
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
    this._closeTimer = setTimeout(() => this.removeDrawer(), 300);
  }
}
