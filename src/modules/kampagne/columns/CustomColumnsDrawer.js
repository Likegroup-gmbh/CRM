// CustomColumnsDrawer.js
// Verwaltungs-UI fuer Custom Columns: Anlegen, Umbenennen, Loeschen,
// Typ/Ebene/Kunden-Sichtbarkeit, Dropdown-Optionen.

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';
import { buildColumnOrderWithNewCustom, removeFromColumnOrder } from './ColumnRegistry.js';
import { renderEmptyState } from '../../../core/components/EmptyState.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { DRAWER_EXIT_MS } from '../../../core/animation/drawer.js';

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
            ${isExpanded ? `<div class="cc-dropdown-panel" data-column-id="${col.id}">${this._renderDropdownOptions(col)}</div>` : ''}
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

  _renderDropdownOptions(col) {
    const opts = (col._dropdownOptions || []).sort((a, b) => a.position - b.position);
    const rows = opts.map((opt, idx) => `
      <div class="dd-opt-row" data-option-id="${opt.id}" data-column-id="${col.id}">
        <div class="dd-opt-arrows">
          <button type="button" class="dd-opt-arrow dropdown-opt-move-up"
            data-option-id="${opt.id}" ${idx === 0 ? 'disabled' : ''} title="Hoch">↑</button>
          <button type="button" class="dd-opt-arrow dropdown-opt-move-down"
            data-option-id="${opt.id}" ${idx === opts.length - 1 ? 'disabled' : ''} title="Runter">↓</button>
        </div>
        <input type="text" class="dd-opt-input dropdown-opt-label"
          data-option-id="${opt.id}" data-column-id="${col.id}" value="${this._esc(opt.label)}"/>
        <button type="button" class="dd-opt-del dropdown-opt-delete"
          data-option-id="${opt.id}" data-column-id="${col.id}" title="Entfernen">&times;</button>
      </div>`).join('');

    return `
      <div class="dd-opts-list">${rows || '<p class="dd-opts-empty">Keine Optionen vorhanden.</p>'}</div>
      <div class="dd-opts-add-row">
        <input type="text" class="dd-opt-input dropdown-opt-new-input"
          data-column-id="${col.id}" placeholder="Neue Option…"/>
        <button type="button" class="dd-opts-add-btn dropdown-opt-add-btn" data-column-id="${col.id}">+</button>
      </div>`;
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

    const newOptsHtml = this._newColumnDropdownOptions.map((label, idx) => `
      <div class="dd-opt-row cc-new-opt-row">
        <span class="dd-opt-text">${this._esc(label)}</span>
        <button type="button" class="dd-opt-del cc-new-opt-delete" data-new-opt-idx="${idx}" title="Entfernen">&times;</button>
      </div>`).join('');

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

  _bindEvents(body) {
    body.querySelector('#btn-close-custom-columns')?.addEventListener('click', () => this.close());
    body.querySelector('#btn-add-custom-column')?.addEventListener('click', () => this._showForm());
    body.querySelector('#btn-cancel-add-column')?.addEventListener('click', () => this._hideAddForm());
    body.querySelector('#btn-confirm-add-column')?.addEventListener('click', () =>
      (this._editingColumnId ? this._handleUpdateColumn() : this._handleAddColumn()));

    const typeSelect = body.querySelector('#cc-new-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this._onNewTypeChange(typeSelect.value));
      this._onNewTypeChange(typeSelect.value);
    }

    body.querySelector('#cc-new-kunde-visible')?.addEventListener('change', () => this._syncNewKundeEditRow());

    body.querySelector('#btn-cc-new-opt-add')?.addEventListener('click', () => this._handleAddNewColumnOption());
    body.querySelector('#cc-new-opt-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._handleAddNewColumnOption(); }
    });

    body.addEventListener('click', (e) => {
      const edit = e.target.closest('.custom-col-edit-btn');
      if (edit) {
        const col = this.store.customColumns.find(c => c.id === edit.dataset.columnId);
        if (col) this._showForm(col);
        return;
      }

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
      if (e.target.classList.contains('custom-col-kunde-edit-toggle'))
        this._handleKundeEditToggle(e.target.dataset.columnId, e.target.checked);
    });

    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('dropdown-opt-new-input')) {
        e.preventDefault();
        this._handleAddDropdownOption(e.target.dataset.columnId);
      }
    });
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

  _handleAddNewColumnOption() {
    const input = document.getElementById('cc-new-opt-input');
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
        <span class="dd-opt-text">${this._esc(label)}</span>
        <button type="button" class="dd-opt-del cc-new-opt-delete" data-new-opt-idx="${idx}" title="Entfernen">&times;</button>
      </div>`).join('');
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
    this._editingColumnId = null;
    const area = document.getElementById('custom-column-form-area');
    if (area) area.style.display = 'none';
    this._applyFormMode(null);
    this._newColumnDropdownOptions = [];
  }

  async _handleUpdateColumn() {
    const col = this.store.customColumns.find(c => c.id === this._editingColumnId);
    if (!col) { this._hideAddForm(); return; }

    const name = document.getElementById('cc-new-name')?.value.trim();
    const fieldType = document.getElementById('cc-new-type')?.value;
    const visible = document.getElementById('cc-new-kunde-visible')?.checked || false;
    const editable = visible && fieldType !== 'upload'
      && (document.getElementById('cc-new-kunde-editable')?.checked || false);

    if (!name) { window.toastSystem?.show('Bitte einen Namen eingeben', 'warning'); return; }

    const patch = {
      name,
      field_type: fieldType,
      visible_for_kunden: visible,
      editable_by_kunden: editable
    };

    try {
      await CustomColumnDataLoader.updateColumn(col.id, patch);
      this.store.updateCustomColumn(col.id, patch);
      this._hideAddForm();
      this._refreshContent();
      this.onRefilter?.();
      window.toastSystem?.show(`Spalte „${name}" gespeichert`, 'success');
    } catch (error) {
      console.error('❌ Spalte speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Speichern der Spalte', 'error');
    }
  }

  // ========================================
  // COLUMN CRUD
  // ========================================

  async _handleAddColumn() {
    const name = document.getElementById('cc-new-name')?.value.trim();
    const fieldType = document.getElementById('cc-new-type')?.value;
    const entityType = document.getElementById('cc-new-entity')?.value;
    const visibleForKunden = document.getElementById('cc-new-kunde-visible')?.checked || false;
    const editableByKunden = visibleForKunden && fieldType !== 'upload'
      && (document.getElementById('cc-new-kunde-editable')?.checked || false);

    if (!name) { window.toastSystem?.show('Bitte einen Namen eingeben', 'warning'); return; }

    try {
      const col = await CustomColumnDataLoader.createColumn(this.kampagneId, {
        name, field_type: fieldType, entity_type: entityType,
        visible_for_kunden: visibleForKunden, editable_by_kunden: editableByKunden
      });

      if (fieldType === 'dropdown' && this._newColumnDropdownOptions.length > 0) {
        const created = [];
        for (const lbl of this._newColumnDropdownOptions) {
          try { created.push(await CustomColumnDataLoader.addDropdownOption(col.id, lbl)); }
          catch (e) { console.warn('⚠️ Option nicht angelegt:', lbl, e); }
        }
        col._dropdownOptions = created;
      }

      this.store.addCustomColumn(col);
      const newOrder = buildColumnOrderWithNewCustom(this.store.columnOrder, col.id);
      await CustomColumnDataLoader.saveColumnOrder(this.kampagneId, newOrder);
      this.store.setColumnOrder(newOrder);

      this._hideAddForm();
      this._refreshContent();
      this.onRefilter?.();
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
      await CustomColumnDataLoader.deleteColumn(columnId);
      this.store.removeCustomColumn(columnId);
      const newOrder = removeFromColumnOrder(this.store.columnOrder, columnId);
      if (newOrder) {
        await CustomColumnDataLoader.saveColumnOrder(this.kampagneId, newOrder);
        this.store.setColumnOrder(newOrder);
      }
      this._refreshContent();
      this.onRefilter?.();
      window.toastSystem?.show(`Spalte „${columnName}" gelöscht`, 'success');
    } catch (error) {
      console.error('❌ Spalte löschen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async _handleRename(columnId, newName) {
    if (!newName) return;
    const col = this.store.customColumns.find(c => c.id === columnId);
    if (!col || col.name === newName) return;
    try {
      await CustomColumnDataLoader.updateColumn(columnId, { name: newName });
      this.store.updateCustomColumn(columnId, { name: newName });
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Umbenennen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Umbenennen', 'error');
    }
  }

  async _handleKundeToggle(columnId, visible) {
    try {
      // Unsichtbar => auch nicht editierbar
      const patch = visible ? { visible_for_kunden: true } : { visible_for_kunden: false, editable_by_kunden: false };
      await CustomColumnDataLoader.updateColumn(columnId, patch);
      this.store.updateCustomColumn(columnId, patch);
      this._refreshContent();
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Kunden-Sichtbarkeit fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Ändern', 'error');
    }
  }

  async _handleKundeEditToggle(columnId, editable) {
    try {
      await CustomColumnDataLoader.updateColumn(columnId, { editable_by_kunden: editable });
      this.store.updateCustomColumn(columnId, { editable_by_kunden: editable });
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Kunden-Bearbeitbarkeit fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Ändern', 'error');
    }
  }

  // ========================================
  // DROPDOWN OPTION HANDLERS
  // ========================================

  _toggleDropdownOptions(columnId) {
    this._expandedDropdownColId = this._expandedDropdownColId === columnId ? null : columnId;
    this._refreshContent();
  }

  async _handleAddDropdownOption(columnId) {
    const input = document.querySelector(`.dropdown-opt-new-input[data-column-id="${columnId}"]`);
    const label = input?.value.trim();
    if (!label) { window.toastSystem?.show('Bitte einen Wert eingeben', 'warning'); return; }
    const col = this.store.customColumns.find(c => c.id === columnId);
    if (!col) return;
    if ((col._dropdownOptions || []).some(o => o.label === label)) {
      window.toastSystem?.show('Option existiert bereits', 'warning'); return;
    }
    try {
      const newOpt = await CustomColumnDataLoader.addDropdownOption(columnId, label);
      if (!col._dropdownOptions) col._dropdownOptions = [];
      col._dropdownOptions.push(newOpt);
      this._refreshDropdownPanel(columnId);
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Option hinzufügen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }
  }

  async _handleDeleteDropdownOption(optionId, columnId) {
    const col = this.store.customColumns.find(c => c.id === columnId);
    if (!col) return;
    try {
      await CustomColumnDataLoader.deleteDropdownOption(optionId);
      col._dropdownOptions = (col._dropdownOptions || []).filter(o => o.id !== optionId);
      this._refreshDropdownPanel(columnId);
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Option löschen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async _handleRenameDropdownOption(optionId, columnId, newLabel) {
    if (!newLabel) return;
    const col = this.store.customColumns.find(c => c.id === columnId);
    if (!col) return;
    const opt = (col._dropdownOptions || []).find(o => o.id === optionId);
    if (!opt || opt.label === newLabel) return;
    try {
      await CustomColumnDataLoader.updateDropdownOption(optionId, { label: newLabel });
      opt.label = newLabel;
      this.onRefilter?.();
    } catch (error) {
      console.error('❌ Option umbenennen fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Umbenennen', 'error');
    }
  }

  async _handleMoveDropdownOption(optionId, direction) {
    let col = null, opt = null;
    for (const c of (this.store.customColumns || [])) {
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
      await CustomColumnDataLoader.swapDropdownPositions(opt, other);
      const tmp = opt.position; opt.position = other.position; other.position = tmp;
      this._refreshDropdownPanel(col.id);
    } catch (error) {
      console.error('❌ Option verschieben fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Verschieben', 'error');
    }
  }

  // ========================================
  // REFRESH
  // ========================================

  _refreshDropdownPanel(columnId) {
    const panel = document.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`);
    if (!panel) { this._refreshContent(); return; }
    const col = this.store.customColumns.find(c => c.id === columnId);
    if (col) panel.innerHTML = this._renderDropdownOptions(col);
  }

  _refreshContent() {
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
