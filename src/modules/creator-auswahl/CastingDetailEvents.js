// CastingDetailEvents.js
// Event-Binding, eigene Spalten und Kategorie-Pill (Prototype-Mixin von CreatorAuswahlDetail)

import { autoResizeTextarea } from '../feedback/FeedbackEventHandler.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { tableSelect } from '../../core/components/TableSelect.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import {
  OHNE_PERSONA_KEY,
  personaDisplayLabel,
  personaGroupKey
} from './castingPersonaGroups.js';

export function bindEvents() {
  this._boundEventListeners.forEach(cleanup => cleanup());
  this._boundEventListeners.clear();

  if (!this.isKunde && (this._canSourcing('edit') || this._canSourcing('create') || this._canSourcing('delete'))) {
    const actionClickHandler = (e) => {
      const actionItem = e.target.closest('[data-action]');
      if (!actionItem) return;
      const container = actionItem.closest('[data-entity-type="creator_auswahl_item"], [data-entity-type="casting_vorschlag"]');
      if (!container) return;

      const action = actionItem.dataset.action;
      const id = actionItem.dataset.id;

      switch (action) {
        case 'activate-vorschlag':
          e.preventDefault();
          this.vorschlagPanel?.aktivieren(id);
          break;
        case 'discard-vorschlag':
          e.preventDefault();
          this.vorschlagPanel?.verwerfen(id);
          break;
        case 'delete-item':
          e.preventDefault();
          this.handleDeleteItem(id);
          break;
        case 'create-creator':
          e.preventDefault();
          this.handleCreateCreator(id);
          break;
        case 'create-videoidee':
          e.preventDefault();
          this.handleCreateVideoidee(id);
          break;
        case 'connect-videoidee':
          e.preventDefault();
          this.handleConnectVideoidee(id);
          break;
      }
    };
    document.addEventListener('click', actionClickHandler);
    this._boundEventListeners.add(() => document.removeEventListener('click', actionClickHandler));

    const igFetchHandler = (e) => {
      const btn = e.target.closest('[data-ig-fetch]');
      if (!btn || btn.disabled || btn.hidden) return;
      e.preventDefault();
      this.handleInstagramFetch(btn.dataset.itemId, btn);
    };
    document.addEventListener('click', igFetchHandler);
    this._boundEventListeners.add(() => document.removeEventListener('click', igFetchHandler));
  }

  if (!this.isKunde && this._canSourcing('edit')) {
    this.bindToolbarMenu();

    const shareBtn = this._q('#btn-share-sourcing');
    if (shareBtn) {
      const handler = () => window.shareListDialog?.open({
        entityType: 'sourcing',
        entityId: this.listeId,
        entityName: this.liste?.name || ''
      });
      shareBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => shareBtn.removeEventListener('click', handler));
    }

    const kundenCallBtn = this._q('#btn-kunden-call-toggle');
    if (kundenCallBtn) {
      const handler = () => this.toggleKundenCall();
      kundenCallBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => kundenCallBtn.removeEventListener('click', handler));
    }

    const tabelleAnpassenBtn = this._q('#btn-sourcing-tabelle-anpassen');
    if (tabelleAnpassenBtn) {
      const handler = () => this.showTabelleAnpassenDrawer();
      tabelleAnpassenBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => tabelleAnpassenBtn.removeEventListener('click', handler));
    }

    const customColumnsBtn = this._q('#btn-sourcing-custom-columns');
    if (customColumnsBtn) {
      const handler = () => this.customColumns.openManagementDrawer(() => this.rerenderTable());
      customColumnsBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => customColumnsBtn.removeEventListener('click', handler));
    }

    const konzeptLinkBtn = this._q('#btn-sourcing-konzept-link');
    if (konzeptLinkBtn) {
      const handler = () => this.handleKonzeptLink();
      konzeptLinkBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => konzeptLinkBtn.removeEventListener('click', handler));
    }

    const addBtn = this._q('#btn-open-add-drawer');
    if (addBtn) {
      const handler = () => this.addDrawer.open();
      addBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => addBtn.removeEventListener('click', handler));
    }

    const addEmptyRowBtn = this._q('#btn-add-empty-row');
    if (addEmptyRowBtn) {
      const handler = () => {
        this.ensureNewItemVisible();
        this.addDrawer.addEmptyRow();
      };
      addEmptyRowBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => addEmptyRowBtn.removeEventListener('click', handler));
    }

    this.bindDragAndDropEvents();
    this.bindSelectionEvents();
    this.bindPillEvents();
    this.bindBulkBarEvents();
    this._bindCustomColumnEvents();
  }

  // Namenssuche (auch fuer Kunden/Gaeste sichtbar)
  const searchAbort = new AbortController();
  SearchInput.bind('sourcing-item', (value) => this.handleSearch(value), searchAbort.signal);
  this._boundEventListeners.add(() => searchAbort.abort());

  // Status-Reiter (auch fuer Kunden sichtbar)
  this._qq('.sourcing-tab-navigation .tab-button').forEach(btn => {
    const handler = (e) => {
      e.preventDefault();
      this.switchTab(btn.dataset.sourcingTab);
    };
    btn.addEventListener('click', handler);
    this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
  });

  this.initFloatingScrollbar();
  this.bindDragToScroll();

  // Feld-Updates (Input/Textarea/Select)
  this._qq('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
    const handler = () => this.handleFieldUpdate(el);
    if (el.type === 'checkbox') {
      el.addEventListener('change', handler);
      this._boundEventListeners.add(() => el.removeEventListener('change', handler));
    } else {
      el.addEventListener('blur', handler);
      el.addEventListener('change', handler);
      this._boundEventListeners.add(() => {
        el.removeEventListener('blur', handler);
        el.removeEventListener('change', handler);
      });
    }
  });

  // Select-Spalten der Tabelle (Portal-Dropdown ist global, nur der Change interessiert hier)
  tableSelect.init();
  const selectHandler = (e) => {
    const { field, itemId, value, element } = e.detail || {};
    const table = element?.closest('.creator-pool-table');
    if (!table || !this._getRoot()?.contains(table)) return;

    if (field === 'sourcing_status') this.handleStatusChange(itemId, value);
    else if (field === 'kunden_feedback') this.handleKundenFeedbackChange(itemId, value);
    else if (field === 'creator_typ') this.handleTypChange(itemId, value);
  };
  document.addEventListener('table-select-change', selectHandler);
  this._boundEventListeners.add(() => document.removeEventListener('table-select-change', selectHandler));

  if (window.ActionsDropdown) {
    window.ActionsDropdown.init();
  }

  const supportsContentSizing = globalThis.CSS?.supports?.('field-sizing', 'content') === true;
  if (!supportsContentSizing) {
    this._qq('.cp-col-feedback textarea.auto-resize-textarea').forEach(el => {
      autoResizeTextarea(el);
      const handler = () => autoResizeTextarea(el);
      el.addEventListener('input', handler);
      this._boundEventListeners.add(() => el.removeEventListener('input', handler));
    });
  }
}

export function _bindCustomColumnEvents() {
  if (!this.customColumns?.hasColumns) return;

  // Inline-Edits der Custom-Felder
  this._qq('.custom-col-input').forEach(el => {
    const handler = () => this.customColumns.handleFieldUpdate(el);
    const isChangeOnly = el.type === 'checkbox' || el.tagName === 'SELECT' || el.classList.contains('custom-col-date');
    if (isChangeOnly) {
      el.addEventListener('change', handler);
      this._boundEventListeners.add(() => el.removeEventListener('change', handler));
    } else {
      el.addEventListener('blur', handler);
      el.addEventListener('change', handler);
      this._boundEventListeners.add(() => {
        el.removeEventListener('blur', handler);
        el.removeEventListener('change', handler);
      });
    }
  });

  // Upload-Buttons
  this._qq('.custom-upload-btn').forEach(btn => {
    const handler = () => this.customColumns.openUploadDrawer(btn, this._buildUploadMetadaten(), () => this.rerenderTable());
    btn.addEventListener('click', handler);
    this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
  });

  // Header Drag&Drop ueber Hand-Griff (nur Custom-Spalten)
  if (this._customHeaderDragCleanup) this._customHeaderDragCleanup();
  const thead = this._q('.creator-pool-table thead');
  this._customHeaderDragCleanup = this.customColumns.bindHeaderDragAndDrop(
    thead,
    () => this.rerenderTable()
  );
  this._boundEventListeners.add(() => {
    if (this._customHeaderDragCleanup) { this._customHeaderDragCleanup(); this._customHeaderDragCleanup = null; }
  });

  // Datepicker-Popover fuer Datums-Custom-Felder aktivieren
  const table = this._q('.creator-pool-table');
  if (table) {
    const cleanup = CustomDatePicker.bind(table);
    if (cleanup) this._boundEventListeners.add(cleanup);
  }
}

export function _buildUploadMetadaten() {
  return {
    unternehmen: this.liste?.unternehmen?.firmenname || '',
    marke: this.liste?.marke?.markenname || '',
    kampagne: this.liste?.kampagne?.kampagnenname || '',
    kooperationName: this.liste?.name || 'Casting',
  };
}

export function bindPillEvents() {
  this._qq('.kategorie-pill').forEach(pill => {
    const handler = (e) => {
      e.stopPropagation();
      this.openPillDropdown(pill.dataset.itemId, pill);
    };
    pill.addEventListener('click', handler);
    this._boundEventListeners.add(() => pill.removeEventListener('click', handler));
  });

  const closeHandler = (e) => {
    if (!e.target.closest('.kategorie-pill-dropdown') && !e.target.closest('.kategorie-pill')) {
      this.closePillDropdown();
    }
  };
  document.addEventListener('click', closeHandler);
  this._boundEventListeners.add(() => document.removeEventListener('click', closeHandler));
}

export function openPillDropdown(itemId, pillElement) {
  this.closePillDropdown();

  const options = [
    ...(this.personas || []).map(p => ({ key: p.id, personaId: p.id, label: personaDisplayLabel(p) })),
    { key: OHNE_PERSONA_KEY, personaId: null, label: 'Ohne Persona' }
  ];
  const currentItem = this.items.find(i => i.id === itemId);
  const currentKey = personaGroupKey(currentItem);

  const dropdown = document.createElement('div');
  dropdown.className = 'kategorie-pill-dropdown';
  dropdown.innerHTML = options.map(opt =>
    `<div class="kategorie-pill-option${opt.key === currentKey ? ' active' : ''}" data-group-key="${escapeAttr(opt.key)}" data-persona-id="${escapeAttr(opt.personaId || '')}">${escapeAttr(opt.label)}</div>`
  ).join('');

  const rect = pillElement.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.zIndex = '9999';

  document.body.appendChild(dropdown);

  dropdown.querySelectorAll('.kategorie-pill-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newKey = opt.dataset.groupKey;
      if (newKey === currentKey) {
        this.closePillDropdown();
        return;
      }
      this.closePillDropdown();

      const row = this._q(`.item-row[data-item-id="${itemId}"]`);
      if (row) row.classList.add('kategorie-moving-out');
      await new Promise(r => setTimeout(r, 300));

      await this.handlePersonaChange(itemId, newKey, opt.dataset.personaId || null);
    });
  });
}

export function closePillDropdown() {
  const existing = document.querySelector('.kategorie-pill-dropdown');
  if (existing) existing.remove();
}

export const castingDetailEventsMethods = {
  bindEvents,
  _bindCustomColumnEvents,
  _buildUploadMetadaten,
  bindPillEvents,
  openPillDropdown,
  closePillDropdown
};
