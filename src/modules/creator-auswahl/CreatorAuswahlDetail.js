// CreatorAuswahlDetail.js
// Orchestrierungs-Klasse fuer die Creator-Auswahl Detail-Ansicht

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingTabelleAnpassenDrawer } from './SourcingTabelleAnpassenDrawer.js';
import { normalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import {
  renderAddSection, renderItemsTable, renderTabNavigation, renderItemRow,
  getTeilbereicheFromListe, isColumnVisibleForCustomer, getVisibleColumnCount,
  getSourcingTabForItem, SOURCING_TABS, migrateHiddenColumns, IG_FETCH_CHECK_ICON
} from './CreatorAuswahlTemplates.js';
import { CreatorAuswahlKategorienDrawer } from './CreatorAuswahlKategorienDrawer.js';
import { CreatorAuswahlAddDrawer } from './CreatorAuswahlAddDrawer.js';
import { autoResizeTextarea } from '../feedback/FeedbackEventHandler.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { tableSelect } from '../../core/components/TableSelect.js';
import { tagFilterDropdown } from '../../core/components/TagFilterDropdown.js';
import {
  buildSourcingStatusUpdates, isSourcingStatus,
  SOURCING_STATUS_FILTER_TAGS, matchesStatusFilter
} from './sourcingStatusOptions.js';
import { formatCompactNumber, formatExactNumber, parseCompactNumber } from '../../core/format/compactNumber.js';

const STATUS_FILTER_ENTITY = 'sourcing-status';

export class CreatorAuswahlDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this.liste = null;
    this.items = [];
    this.isKunde = false;
    this.draggedItem = null;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hiddenColumns = [];
    this.kundenCallActive = false;
    this.activeTab = 'offen';
    this.searchQuery = '';
    this.statusFilter = [];
    this.tabelleAnpassenDrawer = null;
    this.kategorienDrawer = new CreatorAuswahlKategorienDrawer(this);
    this.addDrawer = new CreatorAuswahlAddDrawer(this);
    this.selectedItems = new Set();
    this.customColumns = new EntityCustomColumnsManager({ parentType: 'sourcing', parentTable: 'creator_auswahl' });
    this._customHeaderDragCleanup = null;
  }

  // --- Init & Lifecycle ---

  async init(listeId) {
    this.listeId = listeId;
    this.isKunde = window.isKunde();
    this.searchQuery = '';
    this.statusFilter = [];

    if (this.isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) quickMenuContainer.style.display = 'none';
    }

    try {
      this.liste = await creatorAuswahlService.getListeById(listeId);
      this.items = await creatorAuswahlService.getItems(listeId);

      await this.customColumns.init(listeId);
      await this.customColumns.loadValues(this.items.map(i => i.id));

      this.loadColumnVisibilitySettings();

      if (window.breadcrumbSystem && this.liste) {
        window.breadcrumbSystem.updateDetailLabel(this.liste.name);
      }

      if (this.items.length === 0 && !this.isKunde) {
        await this.addDrawer.createInitialEmptyRow();
      }

      window.setHeadline('');
      await this.render();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      window.content.innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden der Creator-Auswahl</p>
        </div>
      `;
    }
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.addDrawer.remove();
    this.kategorienDrawer.remove();
    this.selectedItems.clear();
    // Ohne Abraeumen uebernimmt init() die Auswahl in die naechste Liste
    tagFilterDropdown.destroy(STATUS_FILTER_ENTITY);

    const bulkBar = document.getElementById('sourcing-bulk-bar');
    if (bulkBar) bulkBar.remove();
    this.closePillDropdown();

    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }

    const container = document.querySelector('.table-container');
    if (container && this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
    }
  }

  // --- Spalten-Sichtbarkeit ---

  loadColumnVisibilitySettings() {
    this.hiddenColumns = migrateHiddenColumns(this.liste?.hidden_columns);
    try {
      const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
      this.kundenCallActive = localStorage.getItem(callKey) === 'true';
    } catch (error) {
      this.kundenCallActive = false;
    }
  }

  async saveColumnVisibilitySettings() {
    try {
      await creatorAuswahlService.updateListe(this.listeId, {
        hidden_columns: this.hiddenColumns
      });
      if (this.liste) this.liste.hidden_columns = this.hiddenColumns;
    } catch (error) {
      console.error('Fehler beim Speichern der Spalten-Sichtbarkeit:', error);
    }
  }

  /**
   * Listeneinstellungen aus dem Drawer speichern: TKP schlaegt direkt auf die
   * Reels-Preise durch, Typ/Plattform/Format kommen mit neu vorbelegten
   * hidden_columns. Deshalb in beiden Faellen die Tabelle neu rendern.
   */
  async saveListenEinstellungen(updates) {
    try {
      await creatorAuswahlService.updateListe(this.listeId, updates);
      Object.assign(this.liste, updates);
      if (updates.hidden_columns) {
        this.hiddenColumns = updates.hidden_columns;
      }
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Speichern der Listeneinstellungen:', error);
      window.toastSystem?.show('Einstellung konnte nicht gespeichert werden', 'error');
    }
  }

  showTabelleAnpassenDrawer() {
    const customColumns = this.customColumns.getOrderedColumns().map(c => ({
      className: makeCustomColumnId(c.id),
      label: c.name
    }));
    // Drawer bei jedem Oeffnen neu bauen, damit neue Custom-Spalten erscheinen
    this.tabelleAnpassenDrawer = new SourcingTabelleAnpassenDrawer({
      liste: this.liste,
      hiddenColumns: this.hiddenColumns,
      customColumns,
      onHiddenColumnsChange: async (newHiddenColumns) => {
        this.hiddenColumns = newHiddenColumns;
        await this.saveColumnVisibilitySettings();
        this.rerenderTable();
      },
      onListeChange: (updates) => this.saveListenEinstellungen(updates)
    });
    this.tabelleAnpassenDrawer.open();
  }

  toggleKundenCall() {
    this.kundenCallActive = !this.kundenCallActive;
    try {
      const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
      localStorage.setItem(callKey, this.kundenCallActive ? 'true' : 'false');
    } catch (error) { /* ignore */ }

    const btn = document.getElementById('btn-kunden-call-toggle');
    if (btn) btn.classList.toggle('active', this.kundenCallActive);

    document.querySelectorAll('[data-blur-target]').forEach(el => {
      el.classList.toggle('kunden-call-blur', this.kundenCallActive);
    });
  }

  // --- Namenssuche & Status-Reiter (Tabs) ---

  getSearchFilteredItems() {
    const query = (this.searchQuery || '').trim().toLowerCase();
    if (!query) return this.items;
    return this.items.filter(item => (item.name || '').toLowerCase().includes(query));
  }

  // Namenssuche und Statusfilter greifen reiteruebergreifend – die Reiter-Zahlen
  // beziehen sich deshalb auf diese Menge, nicht auf alle Items.
  getBaseFilteredItems() {
    return this.getSearchFilteredItems().filter(item => matchesStatusFilter(item, this.statusFilter));
  }

  getFilteredItems() {
    const items = this.getBaseFilteredItems();
    if (this.activeTab === 'alle') return items;
    return items.filter(item => getSourcingTabForItem(item) === this.activeTab);
  }

  getTabCounts() {
    const baseItems = this.getBaseFilteredItems();
    const counts = { offen: 0, on_hold: 0, gebucht: 0, nicht_buchen: 0, alle: baseItems.length };
    baseItems.forEach(item => {
      counts[getSourcingTabForItem(item)]++;
    });
    return counts;
  }

  handleSearch(value) {
    const newQuery = value || '';
    if (newQuery === this.searchQuery) return;
    this.searchQuery = newQuery;
    this.rerenderTable();
  }

  // Aktive Suche zuruecksetzen (z.B. bevor eine neue leere Zeile angelegt wird,
  // die sonst vom Namensfilter ausgeblendet wuerde)
  clearSearch() {
    if (!this.searchQuery) return;
    this.searchQuery = '';
    const input = document.getElementById('sourcing-item-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('sourcing-item-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    this.rerenderTable();
  }

  switchTab(tabName) {
    if (!SOURCING_TABS.some(t => t.key === tabName) || tabName === this.activeTab) return;
    this.activeTab = tabName;

    document.querySelectorAll('.sourcing-tab-navigation .tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sourcingTab === tabName);
    });

    this.rerenderTable();
  }

  updateTabCounts() {
    const counts = this.getTabCounts();
    document.querySelectorAll('[data-sourcing-tab-count]').forEach(el => {
      el.textContent = counts[el.dataset.sourcingTabCount] ?? 0;
    });
  }

  // Nach dem Anlegen eines neuen Items zum "Offen"-Reiter wechseln,
  // damit die neue Zeile sichtbar ist
  ensureNewItemVisible() {
    this.clearSearch();
    if (this.activeTab !== 'offen' && this.activeTab !== 'alle') {
      this.switchTab('offen');
    }
  }

  // --- Rendering ---

  getRenderContext() {
    return {
      items: this.getFilteredItems(),
      hasAnyItems: this.items.length > 0,
      activeTab: this.activeTab,
      searchQuery: this.searchQuery,
      statusFilter: this.statusFilter,
      tabCounts: this.getTabCounts(),
      liste: this.liste,
      isKunde: this.isKunde,
      gastReadonly: window.isGastReadonly?.() || false,
      hiddenColumns: this.hiddenColumns,
      kundenCallActive: this.kundenCallActive,
      teilbereiche: getTeilbereicheFromListe(this.liste),
      customManager: this.customColumns
    };
  }

  async render() {
    const ctx = this.getRenderContext();
    const html = `
      ${renderAddSection(ctx)}
      ${renderTabNavigation(ctx)}
      ${renderItemsTable(ctx)}
    `;
    window.content.innerHTML = html;
    this._updateStickyHeights();
    this._initStatusFilter();

    if (!this.isKunde) {
      this.renderBulkBar();
    }
  }

  _initStatusFilter() {
    const container = document.getElementById('sourcing-status-filter-container');
    if (!container) return;

    tagFilterDropdown.init(STATUS_FILTER_ENTITY, container, {
      tags: [...SOURCING_STATUS_FILTER_TAGS],
      selectedTags: this.statusFilter,
      placeholder: 'Status filtern',
      itemLabelSingular: 'Status',
      itemLabelPlural: 'Status',
      onTagsChange: (selected) => {
        this.statusFilter = selected;
        this.rerenderTable();
      }
    });
  }

  _updateStickyHeights() {
    const addSection = window.content.querySelector('.add-item-section--compact');
    const addH = addSection ? addSection.offsetHeight : 0;
    const tabNav = window.content.querySelector('.sourcing-tab-navigation');
    const tabH = tabNav ? tabNav.offsetHeight : 0;
    window.content.style.setProperty('--sticky-addbar-height', addH + 'px');
    window.content.style.setProperty('--sticky-add-section-height', (addH + tabH) + 'px');

    const thead = window.content.querySelector('.creator-pool-table thead');
    if (thead) {
      window.content.style.setProperty('--sticky-thead-height', thead.offsetHeight + 'px');
    }
  }

  rerenderTable(movedItemIds = []) {
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = renderItemsTable(this.getRenderContext());
      this.bindEvents();
      this._updateStickyHeights();
      this.updateTabCounts();

      movedItemIds.forEach(id => {
        const row = document.querySelector(`.item-row[data-item-id="${id}"]`);
        if (row) {
          row.classList.add('kategorie-moving-in');
          row.addEventListener('animationend', () => row.classList.remove('kategorie-moving-in'), { once: true });
        }
      });
    }
  }

  // --- Event-Binding ---

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    if (!this.isKunde) {
      const actionClickHandler = (e) => {
        const actionItem = e.target.closest('[data-action]');
        if (!actionItem) return;
        const container = actionItem.closest('[data-entity-type="creator_auswahl_item"]');
        if (!container) return;

        const action = actionItem.dataset.action;
        const id = actionItem.dataset.id;

        switch (action) {
          case 'delete-item':
            e.preventDefault();
            this.handleDeleteItem(id);
            break;
          case 'transfer-to-crm':
            e.preventDefault();
            this.handleTransferToCRM(id);
            break;
          case 'view-crm-creator':
            e.preventDefault();
            window.navigateTo(`/creator/${id}`);
            break;
        }
      };
      document.addEventListener('click', actionClickHandler);
      this._boundEventListeners.add(() => document.removeEventListener('click', actionClickHandler));
    }

    if (!this.isKunde) {
      const shareBtn = document.getElementById('btn-share-sourcing');
      if (shareBtn) {
        const handler = () => window.shareListDialog?.open({
          entityType: 'sourcing',
          entityId: this.listeId,
          entityName: this.liste?.name || ''
        });
        shareBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => shareBtn.removeEventListener('click', handler));
      }

      const kundenCallBtn = document.getElementById('btn-kunden-call-toggle');
      if (kundenCallBtn) {
        const handler = () => this.toggleKundenCall();
        kundenCallBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kundenCallBtn.removeEventListener('click', handler));
      }

      const tabelleAnpassenBtn = document.getElementById('btn-sourcing-tabelle-anpassen');
      if (tabelleAnpassenBtn) {
        const handler = () => this.showTabelleAnpassenDrawer();
        tabelleAnpassenBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => tabelleAnpassenBtn.removeEventListener('click', handler));
      }

      const customColumnsBtn = document.getElementById('btn-sourcing-custom-columns');
      if (customColumnsBtn) {
        const handler = () => this.customColumns.openManagementDrawer(() => this.rerenderTable());
        customColumnsBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => customColumnsBtn.removeEventListener('click', handler));
      }

      const kategorienBtn = document.getElementById('btn-manage-kategorien');
      if (kategorienBtn) {
        const handler = () => this.kategorienDrawer.open();
        kategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kategorienBtn.removeEventListener('click', handler));
      }

      const addBtn = document.getElementById('btn-open-add-drawer');
      if (addBtn) {
        const handler = () => this.addDrawer.open();
        addBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addBtn.removeEventListener('click', handler));
      }

      const addEmptyRowBtn = document.getElementById('btn-add-empty-row');
      if (addEmptyRowBtn) {
        const handler = () => {
          this.ensureNewItemVisible();
          this.addDrawer.addEmptyRow();
        };
        addEmptyRowBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addEmptyRowBtn.removeEventListener('click', handler));
      }

      document.querySelectorAll('[data-ig-fetch]').forEach(btn => {
        const handler = () => this.handleInstagramFetch(btn);
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });

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
    document.querySelectorAll('.sourcing-tab-navigation .tab-button').forEach(btn => {
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
    document.querySelectorAll('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
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
      if (!element?.closest('.creator-pool-table')) return;

      if (field === 'sourcing_status') this.handleStatusChange(itemId, value);
      else if (field === 'creator_typ') this.handleTypChange(itemId, value);
    };
    document.addEventListener('table-select-change', selectHandler);
    this._boundEventListeners.add(() => document.removeEventListener('table-select-change', selectHandler));

    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }

    const supportsContentSizing = globalThis.CSS?.supports?.('field-sizing', 'content') === true;
    if (!supportsContentSizing) {
      document.querySelectorAll('.cp-col-feedback textarea.auto-resize-textarea').forEach(el => {
        autoResizeTextarea(el);
        const handler = () => autoResizeTextarea(el);
        el.addEventListener('input', handler);
        this._boundEventListeners.add(() => el.removeEventListener('input', handler));
      });
    }
  }

  // --- Custom Columns (Eigene Spalten) ---

  _bindCustomColumnEvents() {
    if (!this.customColumns?.hasColumns) return;

    // Inline-Edits der Custom-Felder
    document.querySelectorAll('.custom-col-input').forEach(el => {
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
    document.querySelectorAll('.custom-upload-btn').forEach(btn => {
      const handler = () => this.customColumns.openUploadDrawer(btn, this._buildUploadMetadaten(), () => this.rerenderTable());
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Header Drag&Drop (nur Custom-Spalten untereinander)
    if (this._customHeaderDragCleanup) this._customHeaderDragCleanup();
    const thead = document.querySelector('.creator-pool-table thead');
    this._customHeaderDragCleanup = this.customColumns.bindHeaderDragAndDrop(thead, () => this.rerenderTable());
    this._boundEventListeners.add(() => {
      if (this._customHeaderDragCleanup) { this._customHeaderDragCleanup(); this._customHeaderDragCleanup = null; }
    });

    // Datepicker-Popover fuer Datums-Custom-Felder aktivieren
    const table = document.querySelector('.creator-pool-table');
    if (table) {
      const cleanup = CustomDatePicker.bind(table);
      if (cleanup) this._boundEventListeners.add(cleanup);
    }
  }

  _buildUploadMetadaten() {
    return {
      unternehmen: this.liste?.unternehmen?.firmenname || '',
      marke: this.liste?.marke?.markenname || '',
      kampagne: this.liste?.kampagne?.kampagnenname || '',
      kooperationName: this.liste?.name || 'Sourcing',
    };
  }

  // --- Drag & Drop ---

  bindDragAndDropEvents() {
    const rows = document.querySelectorAll('.item-row.draggable');
    const kategorieHeaders = document.querySelectorAll('.kategorie-header-row');

    // Drag nur über Handle aktivieren
    const handles = document.querySelectorAll('.drag-handle');
    handles.forEach(handle => {
      const mousedownHandler = () => {
        const row = handle.closest('.item-row');
        if (row) row.draggable = true;
      };
      handle.addEventListener('mousedown', mousedownHandler);
      this._boundEventListeners.add(() => handle.removeEventListener('mousedown', mousedownHandler));
    });

    const globalMouseup = () => {
      rows.forEach(row => { row.draggable = false; });
    };
    document.addEventListener('mouseup', globalMouseup);
    this._boundEventListeners.add(() => document.removeEventListener('mouseup', globalMouseup));

    rows.forEach(row => {
      const dragstartHandler = (e) => {
        this.draggedItem = row;
        this.draggedItemId = row.dataset.itemId;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.itemId);
      };
      row.addEventListener('dragstart', dragstartHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

      const dragendHandler = () => {
        row.style.opacity = '1';
        row.draggable = false;
        this.draggedItem = null;
        this.draggedItemId = null;
        document.querySelectorAll('.kategorie-header-row.drag-over').forEach(h => h.classList.remove('drag-over'));
      };
      row.addEventListener('dragend', dragendHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

      const dragoverHandler = (e) => {
        e.preventDefault();
        if (row === this.draggedItem) return;

        const tbody = row.parentNode;
        const draggingIndex = Array.from(tbody.children).indexOf(this.draggedItem);
        const targetIndex = Array.from(tbody.children).indexOf(row);

        if (draggingIndex < targetIndex) {
          row.parentNode.insertBefore(this.draggedItem, row.nextSibling);
        } else {
          row.parentNode.insertBefore(this.draggedItem, row);
        }
      };
      row.addEventListener('dragover', dragoverHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragover', dragoverHandler));

      const dropHandler = () => this.handleSortUpdate();
      row.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => row.removeEventListener('drop', dropHandler));
    });

    kategorieHeaders.forEach(header => {
      const dragoverHandler = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      };
      header.addEventListener('dragover', dragoverHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

      const dragleaveHandler = () => header.classList.remove('drag-over');
      header.addEventListener('dragleave', dragleaveHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

      const dropHandler = async (e) => {
        e.preventDefault();
        header.classList.remove('drag-over');

        const itemId = this.draggedItemId;
        const newKategorie = header.dataset.kategorie;
        if (itemId && newKategorie) {
          await this.handleCategoryChange(itemId, newKategorie);
        }
      };
      header.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => header.removeEventListener('drop', dropHandler));
    });
  }

  // --- CRUD-Handler ---

  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const rows = Array.from(tbody.querySelectorAll('.item-row'));
    const hatKategorien = getTeilbereicheFromListe(this.liste).length > 0;

    // Sichtbare (im aktiven Reiter gefilterte) Zeilen mit neuer Reihenfolge/Kategorie aus dem DOM
    const visibleItems = rows.map((row) => {
      const itemId = row.dataset.itemId;
      const item = this.items.find(i => i.id === itemId);

      let kategorie = item.kategorie;

      if (hatKategorien) {
        let currentHeader = row.previousElementSibling;
        while (currentHeader && !currentHeader.classList.contains('kategorie-header-row')) {
          currentHeader = currentHeader.previousElementSibling;
        }
        if (currentHeader) {
          const headerKategorie = currentHeader.dataset.kategorie;
          kategorie = headerKategorie === 'Ohne Kategorie' ? null : headerKategorie;
        }
      }

      return { ...item, kategorie };
    });

    // Nicht sichtbare Items (andere Reiter) behalten ihre Position:
    // Gesamtreihenfolge = bisherige Reihenfolge, sichtbare Items in neuer DOM-Reihenfolge eingesetzt
    const visibleIds = new Set(visibleItems.map(i => i.id));
    const sortedAll = [...this.items].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));
    let visibleIndex = 0;
    const updatedItems = sortedAll
      .map(item => (visibleIds.has(item.id) ? visibleItems[visibleIndex++] : item))
      .map((item, index) => ({ ...item, sortierung: index }));

    try {
      await creatorAuswahlService.updateItemsSortierungWithKategorie(updatedItems);
      this.items = updatedItems;
      window.toastSystem?.show('Sortierung gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Speichern der Sortierung:', error);
      window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
    }
  }

  /**
   * Haekchen-Button neben dem IG-Link: Profil, Follower und CPM-Werte
   * nachladen und die Zeile aktualisieren.
   *
   * Erster Klick fragt den Creator-Pool: steckt der Handle schon in einer
   * anderen Liste, kommen die Werte von dort. Steht die Zeile danach im
   * Refresh-Zustand, erzwingt der naechste Klick einen echten Meta-Abruf.
   */
  async handleInstagramFetch(button) {
    if (button.disabled) return;

    const itemId = button.dataset.itemId;
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    const linkInput = document.querySelector(`input[data-field="link_instagram"][data-item-id="${itemId}"]`);
    const link = linkInput?.value?.trim();
    if (!link) {
      window.toastSystem?.show('Bitte zuerst einen Instagram-Link eintragen', 'error');
      return;
    }

    // Noch nicht gespeicherte Eingabe zuerst persistieren, sonst liest die
    // Function den alten Wert aus der DB
    if (link !== item.link_instagram) {
      try {
        await creatorAuswahlService.updateItem(itemId, { link_instagram: link });
        item.link_instagram = link;
      } catch (error) {
        console.error('Fehler beim Speichern des Instagram-Links:', error);
        window.toastSystem?.show('Instagram-Link konnte nicht gespeichert werden', 'error');
        return;
      }
    }

    // Zeile hat schon Daten -> der Button zeigt Refresh, dieser Klick soll
    // also frisch bei Meta holen statt den Pool-Stand zu wiederholen
    const force = !!item.ig_fetched_at && !item.ig_fetch_error;

    button.disabled = true;
    button.classList.remove('is-error', 'is-success');
    button.classList.add('is-loading');

    try {
      const { item: updated, source, poolFetchedAt, debug } = await creatorAuswahlService
        .fetchInstagramStats(itemId, { force });
      Object.assign(item, updated);
      this.refreshItemRow(itemId, { flashSuccess: true });

      if (debug) {
        const handle = debug.username || 'unknown';
        console.group(`[IG-CPM] @${handle} (${debug.source || source})`);
        console.log('Regeln', debug.rules);
        if (debug.skipped?.length) console.table(debug.skipped);
        else console.log('Skipped (zu frisch / manuell ausgeschlossen): keine');
        if (debug.included?.length) console.table(debug.included);
        else console.log('Included: keine');
        if (debug.outliers?.window_8?.length) console.table(debug.outliers.window_8);
        if (debug.outliers?.window_30?.length) console.table(debug.outliers.window_30);
        console.log('Fenster / Preis', debug.summary);
        if (debug.pool_fetched_at) console.log('Pool-Stand', debug.pool_fetched_at);
        if (debug.image_error) console.warn('Profilbild', debug.image_error);
        console.groupEnd();
      }

      if (source === 'pool') {
        const stand = poolFetchedAt ? new Date(poolFetchedAt).toLocaleDateString('de-DE') : null;
        window.toastSystem?.show(
          stand
            ? `Aus dem Creator-Pool übernommen (Stand ${stand}) – nochmal klicken für frische Instagram-Daten`
            : 'Aus dem Creator-Pool übernommen – nochmal klicken für frische Instagram-Daten',
          'info'
        );
      } else {
        // 30er-Schnitt ohne Ausreisser ist der belastbarste Wert; hat der
        // Creator dafuer zu wenige Feed-Reels, greift der 8er-Schnitt
        const views = updated.ig_views_30_clean ?? updated.ig_views_8_clean;
        window.toastSystem?.show(
          views != null
            ? `Instagram-Daten aktualisiert (${Number(views).toLocaleString('de-DE')} Views im Schnitt)`
            : 'Instagram-Daten aktualisiert – zu wenige Reels für eine CPM-Berechnung',
          views != null ? 'success' : 'info'
        );
      }

      this.warnBeiDoppeltemCreator(item);
    } catch (error) {
      console.error('Fehler beim Instagram-Abruf:', error);
      // Bei toter Session hat authorizedFetch schon Hinweis und Logout uebernommen;
      // der Abbruch gehoert dann nicht als Abruf-Fehler an die Zeile
      if (error.sessionDead) {
        button.disabled = false;
        button.classList.remove('is-loading');
        return;
      }
      item.ig_fetch_error = error.message;
      this.refreshItemRow(itemId);
      window.toastSystem?.show(error.hint || error.message, error.retryable ? 'info' : 'error');
    }
  }

  /**
   * Hinweis, wenn derselbe Creator (gleicher Pool-Eintrag) schon in dieser
   * Liste steht. Blockiert nichts - manchmal ist die Dublette gewollt.
   */
  warnBeiDoppeltemCreator(item) {
    if (!item.sourcing_creator_id) return;

    const doppelt = this.items.filter(i =>
      i.id !== item.id && i.sourcing_creator_id === item.sourcing_creator_id
    );
    if (!doppelt.length) return;

    const name = item.name?.trim() || 'Dieser Creator';
    window.toastSystem?.show(`${name} steht in dieser Liste bereits ein weiteres Mal`, 'warning');
  }

  /** Eine einzelne Tabellenzeile neu rendern, ohne die ganze Tabelle anzufassen */
  refreshItemRow(itemId, { flashSuccess = false } = {}) {
    const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
    const item = this.items.find(i => i.id === itemId);
    if (!row || !item) return;

    row.outerHTML = renderItemRow(this.getRenderContext(), item, 0);
    this.bindEvents();

    if (flashSuccess) {
      const btn = document.querySelector(`[data-ig-fetch][data-item-id="${itemId}"]`);
      if (btn) {
        // Kurz das gruene Haekchen zeigen, danach zurueck auf das gerenderte
        // Refresh-Icon, damit der erneute Abruf sichtbar bleibt
        const finalIcon = btn.innerHTML;
        const wasRefresh = btn.classList.contains('is-refresh');
        btn.innerHTML = IG_FETCH_CHECK_ICON;
        btn.classList.remove('is-refresh');
        btn.classList.add('is-success');
        setTimeout(() => {
          btn.classList.remove('is-success');
          if (wasRefresh) btn.classList.add('is-refresh');
          btn.innerHTML = finalIcon;
        }, 2000);
      }
    }
  }

  async handleFieldUpdate(element) {
    // Custom-Column-Felder werden separat behandelt (CustomDatePicker nutzt ebenfalls data-field)
    if (element.hasAttribute('data-custom-column-id') || element.getAttribute('data-entity') === 'custom') {
      return;
    }
    const itemId = element.dataset.itemId;
    const field = element.dataset.field;
    let value;

    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (field === 'follower_instagram' || field === 'follower_tiktok') {
      value = parseCompactNumber(element.value);
    } else if (field === 'preis_ek' || field === 'preis_vk') {
      const numValue = element.value?.trim();
      value = numValue ? parseFloat(numValue) : null;
    } else {
      value = element.value?.trim() || null;
    }

    try {
      if (field === 'angefragt') {
        const updates = { angefragt: value };
        if (value) updates.angefragt_am = new Date().toISOString();
        await creatorAuswahlService.updateItem(itemId, updates);
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.angefragt = value;
          if (value) item.angefragt_am = updates.angefragt_am;
        }
        this.rerenderTable();
        return;
      }

      const updates = { [field]: value };

      // Kunden-Feedback: Autor + Zeitstempel mitschreiben (Kunde und Gast)
      if (field === 'feedback_kunde' && this.isKunde) {
        const authorName = window.currentUser?.name || 'Unbekannt';
        updates.feedback_kunde_author_name = window.isGast?.() ? `${authorName} (Gast)` : authorName;
        updates.feedback_kunde_updated_at = new Date().toISOString();
      }

      await creatorAuswahlService.updateItem(itemId, updates);

      const item = this.items.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);

      if (field === 'follower_instagram' || field === 'follower_tiktok') {
        this.refreshNumberCell(element, value);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /**
   * Overlay der Follower-Zelle nachziehen: der Input haelt den Rohwert, das
   * Overlay die kompakte Anzeige. Guenstiger als die ganze Zeile neu zu rendern.
   */
  refreshNumberCell(element, value) {
    element.value = value ?? '';

    const display = element.parentElement?.querySelector('[data-number-display]');
    if (!display) return;

    display.textContent = formatCompactNumber(value) || '–';
    display.title = formatExactNumber(value);
  }

  /**
   * Status-Select der Tabelle: setzt genau eines der Flags on_hold / gebucht /
   * prio_1 / prio_2 / absage und nimmt alle anderen inklusive Zeitstempel zurueck.
   */
  async handleStatusChange(itemId, status) {
    if (!itemId || !isSourcingStatus(status)) return;

    const updates = buildSourcingStatusUpdates(status);

    try {
      await creatorAuswahlService.updateItem(itemId, updates);

      const item = this.items.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);

      // Frisch gebuchte Creator wandern an den Anfang ihrer Kategorie
      if (status === 'gebucht') {
        const reorderedItems = this.promoteBookedItemWithinCategory(itemId);
        await creatorAuswahlService.updateItemsSortierungWithKategorie(reorderedItems);
        this.items = reorderedItems.map((entry, index) => ({ ...entry, sortierung: index }));
      }

      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Status-Update:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /** Creator-Art-Select der Tabelle */
  async handleTypChange(itemId, rawValue) {
    const value = normalizeCreatorTyp(rawValue);
    if (!isAllowedCreatorTyp(value)) {
      window.toastSystem?.show('Ungültige Creator Art. Bitte einen gültigen Wert auswählen.', 'error');
      return;
    }

    try {
      await creatorAuswahlService.updateItem(itemId, { typ: value });

      const item = this.items.find(i => i.id === itemId);
      if (item) item.typ = value;

      this.refreshItemRow(itemId);
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Creator Art:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  promoteBookedItemWithinCategory(itemId) {
    const item = this.items.find(entry => entry.id === itemId);
    if (!item) return this.items;

    const getKey = (entry) => entry.kategorie || '__OHNE_KATEGORIE__';
    const targetKey = getKey(item);

    const categoryIndexes = [];
    const categoryItems = [];

    this.items.forEach((entry, index) => {
      if (getKey(entry) === targetKey) {
        categoryIndexes.push(index);
        categoryItems.push(entry);
      }
    });

    if (categoryItems.length <= 1) {
      return this.items.map((entry, index) => ({ ...entry, sortierung: index }));
    }

    const targetItem = categoryItems.find(entry => entry.id === itemId);
    const remaining = categoryItems.filter(entry => entry.id !== itemId);
    const booked = remaining.filter(entry => entry.gebucht);
    const nonBooked = remaining.filter(entry => !entry.gebucht);
    const reordered = [targetItem, ...booked, ...nonBooked];

    const result = [...this.items];
    categoryIndexes.forEach((index, slot) => {
      result[index] = reordered[slot];
    });

    return result.map((entry, index) => ({ ...entry, sortierung: index }));
  }

  async handleNichtUmsetzenChange(itemId, isNichtUmsetzen) {
    const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';

    try {
      if (isNichtUmsetzen) {
        const existingKategorien = getTeilbereicheFromListe(this.liste);
        if (!existingKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
          const updatedKategorien = [...existingKategorien, NICHT_UMSETZEN_KATEGORIE];
          const teilbereichString = updatedKategorien.join(', ');
          await creatorAuswahlService.updateListe(this.listeId, { teilbereich: teilbereichString });
          this.liste.teilbereich = teilbereichString;
        }

        await creatorAuswahlService.updateItem(itemId, {
          nicht_umsetzen: true,
          kategorie: NICHT_UMSETZEN_KATEGORIE
        });

        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = true;
          item.kategorie = NICHT_UMSETZEN_KATEGORIE;
        }

        window.toastSystem?.show('Creator als "Nicht umsetzen" markiert', 'info');
      } else {
        await creatorAuswahlService.updateItem(itemId, {
          nicht_umsetzen: false,
          kategorie: null
        });

        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = false;
          item.kategorie = null;
        }

        window.toastSystem?.show('Creator wieder aktiv', 'success');
      }

      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Ändern von "Nicht umsetzen":', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  async handleCategoryChange(itemId, newKategorie) {
    try {
      const kategorie = newKategorie === 'Ohne Kategorie' ? null : newKategorie;
      await creatorAuswahlService.updateItem(itemId, { kategorie });

      const item = this.items.find(i => i.id === itemId);
      if (item) item.kategorie = kategorie;

      this.rerenderTable([itemId]);
      window.toastSystem?.show('Kategorie aktualisiert', 'success');
    } catch (error) {
      console.error('Fehler beim Ändern der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Ändern der Kategorie', 'error');
    }
  }

  async handleDeleteItem(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Creator entfernen?',
      message: 'Möchten Sie diesen Creator wirklich aus der Liste entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await creatorAuswahlService.deleteItem(itemId);
      this.items = this.items.filter(i => i.id !== itemId);
      window.toastSystem?.show('Creator entfernt', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async handleTransferToCRM(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Ins CRM übernehmen?',
      message: 'Möchten Sie diesen Creator als neuen Eintrag ins CRM übernehmen?',
      confirmText: 'Übernehmen',
      cancelText: 'Abbrechen'
    });

    if (!result?.confirmed) return;

    try {
      const creator = await creatorAuswahlService.transferToCRM(itemId);

      const item = this.items.find(i => i.id === itemId);
      if (item) item.creator_id = creator.id;

      window.toastSystem?.show('Creator erfolgreich ins CRM übernommen', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler bei CRM-Übernahme:', error);
      window.toastSystem?.show('Fehler bei der CRM-Übernahme', 'error');
    }
  }

  // --- Scroll & Table UX ---

  initFloatingScrollbar() {
    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }

    const tableWrapper = document.querySelector('.table-container');
    if (!tableWrapper) return;

    const scrollTarget = document.querySelector('.main-wrapper') || tableWrapper;

    const floatingScrollbar = document.createElement('div');
    floatingScrollbar.id = 'floating-scrollbar-creator-auswahl';
    floatingScrollbar.className = 'floating-scrollbar-kampagne';

    const scrollbarInner = document.createElement('div');
    scrollbarInner.className = 'floating-scrollbar-inner';
    floatingScrollbar.appendChild(scrollbarInner);

    document.body.appendChild(floatingScrollbar);

    const updateScrollbarSize = () => {
      const table = tableWrapper.querySelector('table');
      if (table) scrollbarInner.style.width = table.scrollWidth + 'px';
      const wrapperRect = scrollTarget.getBoundingClientRect();
      floatingScrollbar.style.left = wrapperRect.left + 'px';
      floatingScrollbar.style.width = wrapperRect.width + 'px';
    };

    updateScrollbarSize();

    const handleFloatingScroll = () => {
      if (this._isScrollingFromTable) return;
      this._isScrollingFromFloating = true;
      scrollTarget.scrollLeft = floatingScrollbar.scrollLeft;
      requestAnimationFrame(() => { this._isScrollingFromFloating = false; });
    };

    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);

    const handleTableScroll = () => {
      if (this._isScrollingFromFloating) return;
      this._isScrollingFromTable = true;
      floatingScrollbar.scrollLeft = scrollTarget.scrollLeft;
      requestAnimationFrame(() => { this._isScrollingFromTable = false; });
    };

    scrollTarget.addEventListener('scroll', handleTableScroll);

    const toggleFloatingScrollbar = () => {
      const wrapperRect = tableWrapper.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const isTableVisible = wrapperRect.top < viewportHeight && wrapperRect.bottom > 0;
      const table = tableWrapper.querySelector('table');
      const needsScroll = table && table.scrollWidth > scrollTarget.clientWidth;

      if (isTableVisible && needsScroll && wrapperRect.bottom > viewportHeight) {
        floatingScrollbar.classList.add('visible');
        updateScrollbarSize();
      } else {
        floatingScrollbar.classList.remove('visible');
      }
    };

    toggleFloatingScrollbar();
    window.addEventListener('scroll', toggleFloatingScrollbar);
    const resizeHandler = () => {
      updateScrollbarSize();
      toggleFloatingScrollbar();
    };
    window.addEventListener('resize', resizeHandler);

    this.cleanupFloatingScrollbar = () => {
      floatingScrollbar.classList.remove('visible');
      window.removeEventListener('scroll', toggleFloatingScrollbar);
      window.removeEventListener('resize', resizeHandler);
      floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
      scrollTarget.removeEventListener('scroll', handleTableScroll);
      if (floatingScrollbar.parentNode) floatingScrollbar.parentNode.removeChild(floatingScrollbar);
    };
  }

  bindDragToScroll() {
    const container = document.querySelector('.table-container');
    if (!container) return;

    const scrollTarget = document.querySelector('.main-wrapper') || container;

    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
    }

    this._dragMouseDown = (e) => {
      if (
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'A' ||
        e.target.closest('a') ||
        e.target.closest('.actions-dropdown-container') ||
        e.target.closest('.drag-handle')
      ) {
        return;
      }

      this.isDragging = true;
      this.startX = e.pageX - scrollTarget.offsetLeft;
      this.scrollLeft = scrollTarget.scrollLeft;

      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    };

    this._dragMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - scrollTarget.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      scrollTarget.scrollLeft = this.scrollLeft - walk;
    };

    this._dragMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };

    container.addEventListener('mousedown', this._dragMouseDown);
    document.addEventListener('mousemove', this._dragMouseMove);
    document.addEventListener('mouseup', this._dragMouseUp);

    container.classList.add('drag-scroll-enabled');
    container.style.cursor = 'grab';
  }

  // --- Bulk Selection ---

  renderBulkBar() {
    let bar = document.getElementById('sourcing-bulk-bar');

    const teilbereiche = getTeilbereicheFromListe(this.liste);
    const kategorieOptions = [
      '<option value="">Kategorie zuweisen…</option>',
      ...teilbereiche.filter(k => k !== 'Nicht umsetzen').map(k => `<option value="${k}">${k}</option>`),
      '<option value="Ohne Kategorie">Ohne Kategorie</option>',
      '<option value="Nicht umsetzen">Nicht umsetzen</option>'
    ].join('');

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sourcing-bulk-bar';
      bar.className = 'sourcing-bulk-bar';
      bar.innerHTML = `
        <span class="bulk-count" id="sourcing-bulk-count">0 ausgewählt</span>
        <div class="bulk-bar-actions">
          <select class="bulk-kategorie-select" id="sourcing-bulk-kategorie">
            ${kategorieOptions}
          </select>
          <button class="primary-btn btn-sm" id="btn-bulk-assign">Zuweisen</button>
          <button class="secondary-btn btn-sm" id="btn-bulk-deselect">Auswahl aufheben</button>
        </div>
      `;
      document.body.appendChild(bar);
    } else {
      const select = bar.querySelector('#sourcing-bulk-kategorie');
      if (select) select.innerHTML = kategorieOptions;
    }

    bar.style.display = 'none';
  }

  bindSelectionEvents() {
    const selectAll = document.querySelector('.sourcing-select-all');
    if (selectAll) {
      const handler = (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.sourcing-item-check').forEach(cb => {
          cb.checked = checked;
          if (checked) this.selectedItems.add(cb.dataset.itemId);
          else this.selectedItems.delete(cb.dataset.itemId);
        });
        document.querySelectorAll('.sourcing-group-select').forEach(cb => cb.checked = checked);
        this.updateBulkBar();
      };
      selectAll.addEventListener('change', handler);
      this._boundEventListeners.add(() => selectAll.removeEventListener('change', handler));
    }

    document.querySelectorAll('.sourcing-group-select').forEach(groupCb => {
      const handler = () => {
        const checked = groupCb.checked;
        const headerRow = groupCb.closest('.kategorie-header-row');
        let sibling = headerRow?.nextElementSibling;
        while (sibling && sibling.classList.contains('item-row')) {
          const cb = sibling.querySelector('.sourcing-item-check');
          if (cb) {
            cb.checked = checked;
            if (checked) this.selectedItems.add(cb.dataset.itemId);
            else this.selectedItems.delete(cb.dataset.itemId);
          }
          sibling = sibling.nextElementSibling;
        }
        this.updateSelectAllState();
        this.updateBulkBar();
      };
      groupCb.addEventListener('change', handler);
      this._boundEventListeners.add(() => groupCb.removeEventListener('change', handler));
    });

    document.querySelectorAll('.sourcing-item-check').forEach(cb => {
      const handler = () => {
        if (cb.checked) this.selectedItems.add(cb.dataset.itemId);
        else this.selectedItems.delete(cb.dataset.itemId);
        this.updateGroupSelectState(cb);
        this.updateSelectAllState();
        this.updateBulkBar();
      };
      cb.addEventListener('change', handler);
      this._boundEventListeners.add(() => cb.removeEventListener('change', handler));
    });

    // Restore selection after re-render
    this.selectedItems.forEach(id => {
      const cb = document.querySelector(`.sourcing-item-check[data-item-id="${id}"]`);
      if (cb) cb.checked = true;
    });
    // Remove stale IDs
    const existingIds = new Set(
      Array.from(document.querySelectorAll('.sourcing-item-check')).map(cb => cb.dataset.itemId)
    );
    this.selectedItems.forEach(id => { if (!existingIds.has(id)) this.selectedItems.delete(id); });

    this.updateBulkBar();
  }

  updateSelectAllState() {
    const all = document.querySelectorAll('.sourcing-item-check');
    const checked = document.querySelectorAll('.sourcing-item-check:checked');
    const selectAll = document.querySelector('.sourcing-select-all');
    if (selectAll) {
      selectAll.checked = all.length > 0 && checked.length === all.length;
      selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
    }
  }

  updateGroupSelectState(changedCheckbox) {
    const row = changedCheckbox.closest('.item-row');
    if (!row) return;

    let headerRow = row.previousElementSibling;
    while (headerRow && !headerRow.classList.contains('kategorie-header-row')) {
      headerRow = headerRow.previousElementSibling;
    }
    if (!headerRow) return;

    const groupCb = headerRow.querySelector('.sourcing-group-select');
    if (!groupCb) return;

    let sibling = headerRow.nextElementSibling;
    let total = 0, checkedCount = 0;
    while (sibling && sibling.classList.contains('item-row')) {
      const cb = sibling.querySelector('.sourcing-item-check');
      if (cb) {
        total++;
        if (cb.checked) checkedCount++;
      }
      sibling = sibling.nextElementSibling;
    }

    groupCb.checked = total > 0 && checkedCount === total;
    groupCb.indeterminate = checkedCount > 0 && checkedCount < total;
  }

  updateBulkBar() {
    const bar = document.getElementById('sourcing-bulk-bar');
    if (!bar) return;

    const count = this.selectedItems.size;
    bar.style.display = count > 0 ? 'flex' : 'none';

    const countEl = document.getElementById('sourcing-bulk-count');
    if (countEl) countEl.textContent = `${count} Creator ausgewählt`;
  }

  bindBulkBarEvents() {
    const assignBtn = document.getElementById('btn-bulk-assign');
    if (assignBtn) {
      const handler = () => this.handleBulkKategorieAssign();
      assignBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => assignBtn.removeEventListener('click', handler));
    }

    const deselectBtn = document.getElementById('btn-bulk-deselect');
    if (deselectBtn) {
      const handler = () => {
        this.selectedItems.clear();
        document.querySelectorAll('.sourcing-item-check').forEach(cb => cb.checked = false);
        document.querySelectorAll('.sourcing-group-select').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        const selectAll = document.querySelector('.sourcing-select-all');
        if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
        this.updateBulkBar();
      };
      deselectBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deselectBtn.removeEventListener('click', handler));
    }
  }

  async handleBulkKategorieAssign() {
    const select = document.getElementById('sourcing-bulk-kategorie');
    if (!select || !select.value) {
      window.toastSystem?.show('Bitte eine Kategorie auswählen', 'warning');
      return;
    }

    const newKategorie = select.value === 'Ohne Kategorie' ? null : select.value;
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;

    try {
      if (select.value === 'Nicht umsetzen') {
        const existingKategorien = getTeilbereicheFromListe(this.liste);
        if (!existingKategorien.includes('Nicht umsetzen')) {
          const updatedKategorien = [...existingKategorien, 'Nicht umsetzen'];
          await creatorAuswahlService.updateListe(this.listeId, { teilbereich: updatedKategorien.join(', ') });
          this.liste.teilbereich = updatedKategorien.join(', ');
        }
      }

      itemIds.forEach(id => {
        const row = document.querySelector(`.item-row[data-item-id="${id}"]`);
        if (row) row.classList.add('kategorie-moving-out');
      });

      await creatorAuswahlService.updateItemsKategorie(itemIds, newKategorie);

      this.items.forEach(item => {
        if (itemIds.includes(item.id)) {
          item.kategorie = newKategorie;
          if (select.value === 'Nicht umsetzen') item.nicht_umsetzen = true;
        }
      });

      await new Promise(r => setTimeout(r, 300));

      this.selectedItems.clear();
      select.value = '';
      this.renderBulkBar();
      this.rerenderTable(itemIds);

      window.toastSystem?.show(`${itemIds.length} Creator verschoben`, 'success');
    } catch (error) {
      console.error('Fehler beim Bulk-Zuweisen:', error);
      window.toastSystem?.show('Fehler beim Zuweisen', 'error');
    }
  }

  // --- Kategorie-Pill ---

  bindPillEvents() {
    document.querySelectorAll('.kategorie-pill').forEach(pill => {
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

  openPillDropdown(itemId, pillElement) {
    this.closePillDropdown();

    const teilbereiche = getTeilbereicheFromListe(this.liste);
    const categories = [...teilbereiche.filter(k => k !== 'Nicht umsetzen'), 'Ohne Kategorie'];
    const currentItem = this.items.find(i => i.id === itemId);
    const currentKat = currentItem?.kategorie || 'Ohne Kategorie';

    const dropdown = document.createElement('div');
    dropdown.className = 'kategorie-pill-dropdown';
    dropdown.innerHTML = categories.map(k =>
      `<div class="kategorie-pill-option${k === currentKat ? ' active' : ''}" data-kategorie="${k}">${k}</div>`
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
        const newKat = opt.dataset.kategorie;
        if (newKat === currentKat) {
          this.closePillDropdown();
          return;
        }
        this.closePillDropdown();

        const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
        if (row) row.classList.add('kategorie-moving-out');
        await new Promise(r => setTimeout(r, 300));

        await this.handleCategoryChange(itemId, newKat);
      });
    });
  }

  closePillDropdown() {
    const existing = document.querySelector('.kategorie-pill-dropdown');
    if (existing) existing.remove();
  }
}

export const creatorAuswahlDetail = new CreatorAuswahlDetail();
