// CreatorAuswahlDetail.js
// Orchestrierungs-Klasse fuer die Creator-Auswahl Detail-Ansicht

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { strategieService } from '../strategie/StrategieService.js';
import { SourcingTabelleAnpassenDrawer } from './SourcingTabelleAnpassenDrawer.js';
import { normalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import {
  renderAddSection, renderItemsTable, renderTabNavigation, renderItemRow,
  getTeilbereicheFromListe, isColumnVisibleForCustomer, getVisibleColumnCount,
  getSourcingTabForItem, SOURCING_TABS, migrateHiddenColumns,
  SOURCING_ANKER_SPALTEN, SOURCING_SPALTEN_LABELS, DEAKTIVIERTE_SPALTEN,
  repairSourcingItemKategorien
} from './CreatorAuswahlTemplates.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { CreatorAuswahlKategorienDrawer } from './CreatorAuswahlKategorienDrawer.js';
import { CreatorAuswahlAddDrawer } from './CreatorAuswahlAddDrawer.js';
import { autoResizeTextarea } from '../feedback/FeedbackEventHandler.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { tableSelect } from '../../core/components/TableSelect.js';
import { bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { hoverToolbar } from '../../core/hoverToolbar/HoverToolbar.js';
import { registerHoverToolbar, unregisterHoverToolbar } from '../../core/hoverToolbar/HoverToolbarRegistry.js';
import { setChipCellLoading } from '../../core/components/chipCell.js';
import { createSourcingIgToolbarConfig } from './sourcingIgToolbarConfig.js';
import {
  applySourcingIgCellState, findSourcingIgCell, SOURCING_IG_TOOLBAR
} from './sourcingIgCell.js';
import {
  buildSourcingStatusUpdates, isSourcingStatus,
  buildKundenFeedbackUpdates, isKundenFeedback,
  matchesStatusFilter
} from './sourcingStatusOptions.js';
import { SourcingBuchungDrawer } from './SourcingBuchungDrawer.js';
import { CastingVorschlagPanel } from './CastingVorschlagPanel.js';
import { vorschlagToItem } from './CastingVorschlagService.js';
import { preserveScroll } from '../../core/dom/preserveScroll.js';
import {
  ensureCastingEintragHatCreator
} from './ensureCastingEintragHatCreator.js';
import { StrategieVideoideePickerDrawer } from '../strategie/StrategieVideoideePickerDrawer.js';
import { formatCompactNumber, formatExactNumber, parseCompactNumber } from '../../core/format/compactNumber.js';
import { icon } from '../../core/icons/IconSystem.js';

const IG_FETCH_FLASH_MS = 2000;

export class CreatorAuswahlDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this.root = null;
    this.chromeRoot = null;
    this.embedded = false;
    this.liste = null;
    this.items = [];
    this.isKunde = false;
    this.draggedItem = null;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hiddenColumns = [];
    this.kundenCallActive = false;
    this.activeTab = 'alle';
    this.searchQuery = '';
    this.statusFilter = [];
    this.tabelleAnpassenDrawer = null;
    this.kategorienDrawer = new CreatorAuswahlKategorienDrawer(this);
    this.addDrawer = new CreatorAuswahlAddDrawer(this);
    this.buchungDrawer = new SourcingBuchungDrawer(this);
    this.vorschlagPanel = new CastingVorschlagPanel(this);
    this.selectedItems = new Set();
    this.customColumns = new EntityCustomColumnsManager({
      parentType: 'sourcing',
      parentTable: 'creator_auswahl',
      anchorColumns: SOURCING_ANKER_SPALTEN,
      anchorLabels: SOURCING_SPALTEN_LABELS,
      disabledAnchors: DEAKTIVIERTE_SPALTEN
    });
    this._customHeaderDragCleanup = null;
  }

  _getRoot() {
    return this.root || window.content;
  }

  _q(selector) {
    return this._getRoot()?.querySelector(selector)
      || this.chromeRoot?.querySelector(selector)
      || null;
  }

  _qq(selector) {
    const root = this._getRoot();
    const fromRoot = root ? [...root.querySelectorAll(selector)] : [];
    if (!this.chromeRoot) return fromRoot;
    return fromRoot.concat([...this.chromeRoot.querySelectorAll(selector)]);
  }

  // Standalone: main-wrapper ist der horizontale Scrollport (sticky Header).
  // Embedded: der Tabellen-Container, sonst wächst die Kampagnen-View mit.
  _getHScrollTarget(fallback) {
    if (this.embedded) return fallback;
    return document.querySelector('.main-wrapper') || fallback;
  }

  // --- Init & Lifecycle ---

  async init(listeId, { root, chromeRoot, embedded } = {}) {
    this.listeId = listeId;
    this.root = root || window.content;
    this.chromeRoot = chromeRoot || null;
    this.embedded = !!embedded;
    this.isKunde = window.isKunde();
    this.searchQuery = '';
    this.statusFilter = [];

    // Die Hover-Toolbar der Instagram-Spalte laeuft ueber die zentrale Engine.
    // Ihre Abruf-Aktion braucht diese Instanz, also wird die Config hier mit
    // Kontext angemeldet statt global deklariert.
    registerHoverToolbar(SOURCING_IG_TOOLBAR, createSourcingIgToolbarConfig(this));

    if (!this.embedded && this.isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) quickMenuContainer.style.display = 'none';
    }

    try {
      this.liste = await creatorAuswahlService.getListeById(listeId);
      this.items = await creatorAuswahlService.getItems(listeId);
      await this.persistRepairedKategorien();

      await this.customColumns.init(listeId);
      await this.customColumns.loadValues(this.items.map(i => i.id));

      this.loadColumnVisibilitySettings();

      if (!this.embedded && window.breadcrumbSystem && this.liste) {
        window.breadcrumbSystem.updateDetailLabel(this.liste.name);
      }

      if (this.items.length === 0 && !this.isKunde && this._canSourcing('create')) {
        await this.addDrawer.createInitialEmptyRow();
      }

      if (!this.embedded) window.setHeadline('');
      await this.render();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      const rootEl = this._getRoot();
      if (rootEl) {
        rootEl.innerHTML = `
          <div class="error-message">
            <p>Fehler beim Laden der Casting-Liste</p>
          </div>
        `;
      }
    }
  }

  async persistRepairedKategorien() {
    const defined = getTeilbereicheFromListe(this.liste);
    const { items, changed } = repairSourcingItemKategorien(this.items, defined);
    this.items = items;
    if (!changed.length) return;

    const byKategorie = new Map();
    for (const entry of changed) {
      const key = entry.kategorie ?? '__null__';
      if (!byKategorie.has(key)) byKategorie.set(key, []);
      byKategorie.get(key).push(entry.id);
    }

    try {
      for (const [key, ids] of byKategorie) {
        await creatorAuswahlService.updateItemsKategorie(
          ids,
          key === '__null__' ? null : key
        );
      }
    } catch (error) {
      console.error('Kategorie-Repair fehlgeschlagen:', error);
    }
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.addDrawer.remove();
    this.kategorienDrawer.remove();
    this.buchungDrawer.remove();
    this.selectedItems.clear();

    // Die Engine selbst bleibt stehen, sie gehoert der Anwendung. Nur diese
    // Config verweist auf eine Instanz, die es gleich nicht mehr gibt.
    unregisterHoverToolbar(SOURCING_IG_TOOLBAR);
    hoverToolbar.close();

    this.vorschlagPanel?.unmount?.();

    const bulkBar = document.getElementById('sourcing-bulk-bar');
    if (bulkBar) bulkBar.remove();
    this.closePillDropdown();

    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }

    const container = this._q('.table-container');
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

    const btn = this._q('#btn-kunden-call-toggle');
    if (btn) btn.classList.toggle('active', this.kundenCallActive);

    this._qq('[data-blur-target]').forEach(el => {
      el.classList.toggle('kunden-call-blur', this.kundenCallActive);
    });
  }

  // --- Namenssuche & Status-Reiter (Tabs) ---

  kannVorschlaegeSehen() {
    if (this.isKunde) return false;
    if (window.isGastReadonly?.()) return false;
    return true;
  }

  getVorschlagItems() {
    if (!this.kannVorschlaegeSehen()) return [];
    const listeTyp = this.liste?.liste_typ;
    // Streng nach Matching absteigend (ADR 0014); die DB liefert das schon,
    // die Sortierung hier faengt Alt-Daten ohne matching_score ab.
    return (this.vorschlagPanel?.vorschlaege || [])
      .map(v => vorschlagToItem(v, { listeTyp }))
      .sort((a, b) => (b.matching_score ?? -1) - (a.matching_score ?? -1));
  }

  getDisplayItems() {
    return [...this.getVorschlagItems(), ...this.items];
  }

  getSearchFilteredItems() {
    const query = (this.searchQuery || '').trim().toLowerCase();
    const items = this.getDisplayItems();
    if (!query) return items;
    return items.filter(item => (item.name || '').toLowerCase().includes(query));
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
    const counts = Object.fromEntries(SOURCING_TABS.map(t => [t.key, 0]));
    counts.alle = baseItems.length;
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
    const input = this._q('#sourcing-item-search-input');
    if (input) input.value = '';
    const clearBtn = this._q('#sourcing-item-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    this.rerenderTable();
  }

  switchTab(tabName) {
    if (!SOURCING_TABS.some(t => t.key === tabName) || tabName === this.activeTab) return;
    this.activeTab = tabName;

    this._qq('.sourcing-tab-navigation .tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sourcingTab === tabName);
    });

    this.rerenderTable();
  }

  updateTabCounts() {
    const counts = this.getTabCounts();
    this._qq('[data-sourcing-tab-count]').forEach(el => {
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

  // Zentrale Capability-Abfrage fuer diese View: Investor (Klasse Finanzen) ist
  // intern (isKunde=false), aber sourcing.create/edit/delete sind false.
  _canSourcing(verb) {
    return window.permissionSystem?.can('sourcing', verb) ?? false;
  }

  getRenderContext() {
    const can = (verb) => this._canSourcing(verb);
    const canCreate = can('create');
    return {
      items: this.getFilteredItems(),
      hasAnyItems: this.getDisplayItems().length > 0,
      activeTab: this.activeTab,
      searchQuery: this.searchQuery,
      statusFilter: this.statusFilter,
      tabCounts: this.getTabCounts(),
      liste: this.liste,
      isKunde: this.isKunde,
      canCreate,
      canEdit: can('edit'),
      canDelete: can('delete'),
      gastReadonly: window.isGastReadonly?.() || false,
      hiddenColumns: this.hiddenColumns,
      kundenCallActive: this.kundenCallActive,
      teilbereiche: getTeilbereicheFromListe(this.liste),
      customManager: this.customColumns,
      actionsOnly: this.embedded
    };
  }

  async render() {
    const ctx = this.getRenderContext();
    const rootEl = this._getRoot();
    if (!rootEl) return;

    if (this.embedded && this.chromeRoot) {
      this.chromeRoot.innerHTML = renderAddSection(ctx);
      rootEl.innerHTML = `
        ${renderTabNavigation(ctx)}
        ${renderItemsTable(ctx)}
      `;
    } else {
      rootEl.innerHTML = `
        <div id="casting-vorschlag-block"></div>
        ${renderAddSection(ctx)}
        ${renderTabNavigation(ctx)}
        ${renderItemsTable(ctx)}
      `;
    }
    // Eigene Vorschlag-Zeilen ueber der Liste (nie fuer Kunden/Gaeste)
    this.vorschlagPanel?.mount?.();
    this._updateStickyHeights();

    if (!this.isKunde && this._canSourcing('edit')) {
      this.renderBulkBar();
    }
  }

  _updateStickyHeights() {
    const rootEl = this._getRoot();
    if (!rootEl) return;
    const addSection = rootEl.querySelector('.add-item-section--compact');
    const addH = addSection ? addSection.offsetHeight : 0;
    const tabNav = rootEl.querySelector('.sourcing-tab-navigation');
    const tabH = tabNav ? tabNav.offsetHeight : 0;
    rootEl.style.setProperty('--sticky-addbar-height', addH + 'px');
    rootEl.style.setProperty('--sticky-add-section-height', (addH + tabH) + 'px');

    const thead = rootEl.querySelector('.creator-pool-table thead');
    if (thead) {
      rootEl.style.setProperty('--sticky-thead-height', thead.offsetHeight + 'px');
    }
  }

  rerenderTable(movedItemIds = []) {
    const tableContainer = this._q('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = renderItemsTable(this.getRenderContext());
      this.bindEvents();
      this._updateStickyHeights();
      this.updateTabCounts();

      movedItemIds.forEach(id => {
        const row = this._q(`.item-row[data-item-id="${id}"]`);
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

      const kategorienBtn = this._q('#btn-manage-kategorien');
      if (kategorienBtn) {
        const handler = () => this.kategorienDrawer.open();
        kategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kategorienBtn.removeEventListener('click', handler));
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

  // --- Custom Columns (Eigene Spalten) ---

  _bindCustomColumnEvents() {
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

  _buildUploadMetadaten() {
    return {
      unternehmen: this.liste?.unternehmen?.firmenname || '',
      marke: this.liste?.marke?.markenname || '',
      kampagne: this.liste?.kampagne?.kampagnenname || '',
      kooperationName: this.liste?.name || 'Casting',
    };
  }

  // --- Drag & Drop ---

  bindDragAndDropEvents() {
    const rows = this._qq('.item-row.draggable');
    const kategorieHeaders = this._qq('.kategorie-header-row');

    // Drag nur über Handle aktivieren
    const handles = this._qq('.drag-handle');
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
        this._qq('.kategorie-header-row.drag-over').forEach(h => h.classList.remove('drag-over'));
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
    const tbody = this._q('#items-table-body');
    if (!tbody) return;
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
   * Hauptaktion der Instagram-Hover-Toolbar: Profil, Follower und CPM-Werte
   * nachladen und die Zeile aktualisieren.
   *
   * Erster Klick fragt den Creator-Pool: steckt der Handle schon in einer
   * anderen Liste, kommen die Werte von dort. Steht die Zeile danach im
   * Refresh-Zustand, erzwingt der naechste Klick einen echten Meta-Abruf.
   *
   * Die itemId kommt als Argument, weil der Button in der Leiste an
   * document.body haengt - von dort findet closest() keine Zeile mehr.
   */
  async handleInstagramFetch(itemId, button) {
    if (button.disabled) return;

    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    const linkInput = this._q(`input[data-field="link_instagram"][data-item-id="${itemId}"]`);
    const link = linkInput?.value?.trim();
    // canOpen der Config laesst die Leiste ohne Link nicht aufgehen; kommt hier
    // trotzdem keiner an, ist die Zeile inzwischen weg.
    if (!link) return;

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
    button.classList.remove('is-error', 'is-success', 'is-refresh');
    button.classList.add('is-loading');
    // Der Abruf dauert; die Leiste muss offen bleiben, auch wenn der Zeiger sie
    // in der Zwischenzeit verlaesst.
    hoverToolbar.pin();
    setChipCellLoading(findSourcingIgCell(itemId), true);

    try {
      const { item: updated, source, poolFetchedAt, debug } = await creatorAuswahlService
        .fetchInstagramStats(itemId, { force });
      Object.assign(item, updated);
      this.refreshItemRow(itemId);
      // Die Zeile ist per outerHTML ersetzt, die Zelle unter der Leiste also
      // eine andere. rebind() verankert sie neu und zeigt jetzt "Frisch abrufen".
      hoverToolbar.rebind();
      this._flashIgFetchSuccess(itemId);

      if (debug) {
        const handle = debug.username || 'unknown';
        console.group(`[IG-CPM] @${handle} (${debug.source || source})`);
        console.log('Regeln', debug.rules);
        if (debug.skipped?.length) console.table(debug.skipped);
        else console.log('Skipped (zu frisch / manuell ausgeschlossen): keine');
        if (debug.included_8?.length) {
          console.log(`Included 8er (${debug.included_8.length} Reels im Schnitt)`);
          console.table(debug.included_8);
        } else console.log('Included 8er: keine');
        if (debug.included_30?.length) {
          console.log(`Included 30er (${debug.included_30.length} Reels im Schnitt)`);
          console.table(debug.included_30);
        } else console.log('Included 30er: keine');
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
        // Der 30er-Schnitt ist der belastbarste Wert; hat der Creator dafuer zu
        // wenige Feed-Reels, greift der 8er-Schnitt
        const views = updated.ig_views_30 ?? updated.ig_views_8;
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
        setChipCellLoading(findSourcingIgCell(itemId), false);
        hoverToolbar.unpin();
        return;
      }
      item.ig_fetch_error = error.message;
      this.refreshItemRow(itemId);
      // Die Leiste zeigt danach "Erneut versuchen" plus den Fehlertext als Zeile
      hoverToolbar.rebind();
      hoverToolbar.unpin();
      window.toastSystem?.show(error.hint || error.message, error.retryable ? 'info' : 'error');
    }
  }

  /**
   * Kurz gruen quittieren. Der Button aus dem Klick ist nach dem Zeilen-Neuaufbau
   * ein toter Knoten - der Flash muss den treffen, den rebind() gerade neu
   * gerendert hat. Das unpin() haengt hinten dran, damit die Leiste den Flash
   * ueberdauert, auch wenn der Zeiger inzwischen weitergewandert ist.
   */
  _flashIgFetchSuccess(itemId) {
    const button = this._q(`.ig-fetch-btn[data-item-id="${itemId}"]`)
      || document.querySelector('.hover-toolbar [data-hover-action="ig-fetch"]');
    if (!button) {
      hoverToolbar.unpin();
      return;
    }

    button.classList.add('is-success');
    setTimeout(() => {
      button.classList.remove('is-success');
      hoverToolbar.unpin();
    }, IG_FETCH_FLASH_MS);
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

  /**
   * Eine einzelne Tabellenzeile neu rendern, ohne die ganze Tabelle anzufassen.
   * Die Rueckmeldung eines Abrufs uebernimmt die Hover-Toolbar (siehe
   * _flashIgFetchSuccess) - sie liegt ausserhalb der Zeile und uebersteht den
   * Austausch.
   */
  refreshItemRow(itemId) {
    const row = this._q(`.item-row[data-item-id="${itemId}"]`);
    const item = this.items.find(i => i.id === itemId);
    if (!row || !item) return;

    row.outerHTML = renderItemRow(this.getRenderContext(), item, 0);
    this.bindEvents();
  }

  async handleFieldUpdate(element) {
    // Defense in depth: view-only Rollen (Investor) duerfen keine Feld-Updates
    // schreiben - Kunden-Felder (feedback_kunde, kunden_feedback) bleiben
    // ueber den isKunde-Pfad unberuehrt.
    if (!this.isKunde && !this._canSourcing('edit')) return;
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

      // Chip und Status-Punkt gehoeren zum eingetragenen Link. Ohne das bleibt
      // die Zelle nach dem Einfuegen optisch leer und der Punkt, der auf die
      // Aktionen hinweist, unsichtbar.
      if (field === 'link_instagram') {
        applySourcingIgCellState(element.closest('.chip-cell'), item || { link_instagram: value });
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
   * Status-Select der Tabelle: setzt genau eines der Prozess-Flags angefragt /
   * in_verhandlung / preis_zugesagt / zusage / on_hold / gebucht / absage und
   * nimmt die anderen zurueck. Das Kundenfeedback (prio_1 / prio_2 / abgelehnt)
   * bleibt stehen.
   */
  async handleStatusChange(itemId, status) {
    // Der Prozess-Status ist intern. Kunden geben ihr Feedback ueber die
    // eigene Spalte (kunden_feedback), nicht ueber diesen Select.
    if (this.isKunde) return;
    if (!itemId || !isSourcingStatus(status)) return;

    const updates = buildSourcingStatusUpdates(status);

    try {
      // Absage loest die Zuordnung an Videoideen; blockt, wenn eine davon
      // schon ein Skript hat (eingefroren).
      if (status === 'absage') {
        await creatorAuswahlService._loeseVideoideeZuordnungen(itemId, 'abgesagt');
      }

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

      // Gebucht heisst: der Creator geht in die Kampagne. Der Drawer fuehrt
      // durch CRM-Uebernahme, Management und Kooperation - die Buchung selbst
      // ist mit dem Status-Update oben laengst gesichert.
      if (status === 'gebucht' && !this.isKunde && item) {
        this.buchungDrawer.open(item);
      }
    } catch (error) {
      console.error('Fehler beim Status-Update:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /**
   * Kundenfeedback-Select der Tabelle: setzt genau eines der Feedback-Flags
   * prio_1 / prio_2 / abgelehnt und nimmt die anderen zurueck. Der
   * Prozess-Status bleibt stehen.
   */
  async handleKundenFeedbackChange(itemId, feedback) {
    if (!itemId || !isKundenFeedback(feedback)) return;

    const updates = buildKundenFeedbackUpdates(feedback);

    try {
      await creatorAuswahlService.updateItem(itemId, updates);

      const item = this.items.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);

      // Feedback ist Teil des Toolbar-Filters - ein Wechsel kann die Zeile
      // aus der gefilterten Ansicht nehmen, deshalb die ganze Tabelle neu.
      // preserveScroll: vertikal das Fenster, horizontal der Scrollport
      // (main-wrapper standalone, Tabellen-Container embedded).
      const hScroll = this._getHScrollTarget(this._q('.table-container'));
      preserveScroll(() => this.rerenderTable(), { keep: hScroll ? [hScroll] : [] });
    } catch (error) {
      console.error('Fehler beim Feedback-Update:', error);
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

  /**
   * Bestehende Videoidee zuordnen. Fehlt creator_id, wird zuerst der
   * Creator-Drawer geoeffnet (oder ein Instagram-Treffer verknuepft).
   */
  async handleConnectVideoidee(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    if (!this.liste?.strategie_id) {
      window.toastSystem?.show('Dieses Casting ist mit keinem Konzept verknüpft', 'warning');
      return;
    }
    if (!item.zusage && !item.gebucht) {
      window.toastSystem?.show('Nur Einträge mit Status Zusage oder Gebucht können einer Videoidee zugeordnet werden', 'warning');
      return;
    }

    try {
      await ensureCastingEintragHatCreator(item);
      this.rerenderTable();
      const drawer = new StrategieVideoideePickerDrawer();
      await drawer.open({
        eintrag: item,
        strategieId: this.liste.strategie_id,
        onSuccess: () => this.rerenderTable()
      });
    } catch (error) {
      if (error?.cancelled) return;
      console.error('Fehler beim Verbinden mit der Videoidee:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Verbinden', 'error');
    }
  }

  /**
   * Konzept verknuepfen oder loesen (1:1-Paar, ADR 0010). Spiegelbild zu
   * StrategieDetail.handleCastingLink. Picker zeigt nur unverknuepfte
   * Konzepte derselben Kampagne mit gleichem Briefing. Loesen blockt,
   * sobald eine Videoidee einen Casting-Eintrag traegt (Service-Gate).
   */
  async handleKonzeptLink() {
    if (this.liste?.strategie_id) {
      const result = await window.confirmationModal?.open({
        title: 'Konzept-Verknüpfung lösen?',
        message: 'Die Verknüpfung zum Konzept wird gelöst. Videoideen behalten ihre Zuordnung nicht.',
        confirmText: 'Lösen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!result?.confirmed) return;

      try {
        await strategieService.unlinkCasting(this.liste.strategie_id);
        window.toastSystem?.show('Konzept-Verknüpfung gelöst', 'success');
        this.liste = await creatorAuswahlService.getListeById(this.listeId);
        await this.render();
        this.bindEvents();
      } catch (error) {
        console.error('Fehler beim Lösen der Konzept-Verknüpfung:', error);
        window.toastSystem?.show(error.message || 'Fehler beim Lösen', 'error');
      }
      return;
    }

    await this.showKonzeptPicker();
  }

  async showKonzeptPicker() {
    const { data: konzepte, error } = await window.supabase
      .from('strategie')
      .select('id, name, kampagne_id, briefing_id, creator_auswahl_id')
      .eq('kampagne_id', this.liste?.kampagne_id)
      .is('creator_auswahl_id', null)
      .order('name');

    if (error) {
      window.toastSystem?.show('Fehler beim Laden der Konzepte', 'error');
      return;
    }

    const passend = (konzepte || []).filter(s =>
      (s.briefing_id || null) === (this.liste?.briefing_id || null)
    );

    if (passend.length === 0) {
      window.toastSystem?.show('Kein unverknüpftes Konzept mit gleichem Briefing in dieser Kampagne', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'sourcing-konzept-picker-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'sourcing-konzept-picker';

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Konzept verknüpfen</span>
          <p class="drawer-subtitle">Nur unverknüpfte Konzepte dieser Kampagne mit gleichem Briefing</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body">
        <div class="form-field">
          <label for="sourcing-konzept-select">Konzept</label>
          <select id="sourcing-konzept-select" class="form-input">
            <option value="">– Konzept wählen –</option>
            ${passend.map(s => `<option value="${s.id}">${escapeAttr(s.name || 'Ohne Namen')}</option>`).join('')}
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-konzept-link-confirm" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      </div>
    `;

    const close = () => {
      panel.classList.remove('show');
      overlay.classList.remove('active');
      setTimeout(() => { overlay.remove(); panel.remove(); }, 250);
    };

    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close"]').addEventListener('click', close);

    const select = panel.querySelector('#sourcing-konzept-select');
    const confirmBtn = panel.querySelector('#btn-konzept-link-confirm');
    select.addEventListener('change', () => { confirmBtn.disabled = !select.value; });

    confirmBtn.addEventListener('click', async () => {
      if (!select.value) return;
      confirmBtn.disabled = true;
      try {
        await strategieService.linkCasting(select.value, this.listeId);
        window.toastSystem?.show('Konzept verknüpft', 'success');
        close();
        this.liste = await creatorAuswahlService.getListeById(this.listeId);
        await this.render();
        this.bindEvents();
      } catch (error) {
        console.error('Fehler beim Verknüpfen:', error);
        window.toastSystem?.show(error.message || 'Fehler beim Verknüpfen', 'error');
        confirmBtn.disabled = false;
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  }

  /**
   * Creator-zuerst: legt eine Videoidee im verknuepften Konzept an, schon
   * diesem Casting-Eintrag zugeordnet. Nur bei Zusage/Gebucht und nur, wenn
   * das Casting mit einem Konzept verknuepft ist.
   */
  async handleCreateVideoidee(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    if (!this.liste?.strategie_id) {
      window.toastSystem?.show('Dieses Casting ist mit keinem Konzept verknüpft', 'warning');
      return;
    }
    if (!item.zusage && !item.gebucht) {
      window.toastSystem?.show('Nur Einträge mit Status Zusage oder Gebucht können einer Videoidee zugeordnet werden', 'warning');
      return;
    }

    try {
      const existing = await strategieService.getStrategieItems(this.liste.strategie_id);
      const created = await strategieService.createStrategieItem({
        strategie_id: this.liste.strategie_id,
        video_link: null,
        plattform: null,
        sortierung: existing.length,
        teilbereich: null,
        beschreibung: null,
        beschreibung_quelle: null,
        verarbeitung_status: null,
        creator_auswahl_item_id: item.id
      });

      window.toastSystem?.show('Videoidee angelegt', 'success');
      window.dispatchEvent(new CustomEvent('strategieItemCreated', {
        detail: { strategieId: this.liste.strategie_id }
      }));
      window.navigateTo(`/konzepte/${this.liste.strategie_id}`);
      return created;
    } catch (error) {
      console.error('Fehler beim Anlegen der Videoidee:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Anlegen der Videoidee', 'error');
    }
  }

  // --- Scroll & Table UX ---

  initFloatingScrollbar() {
    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }

    const tableWrapper = this._q('.table-container');
    if (!tableWrapper) return;

    const scrollTarget = this._getHScrollTarget(tableWrapper);

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
    const container = this._q('.table-container');
    if (!container) return;

    const scrollTarget = this._getHScrollTarget(container);

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
        e.target.closest('.drag-handle') ||
        // Hand-Griff eigener Spalten: sonst blockiert preventDefault den HTML5-Drag
        e.target.closest('.entity-custom-col-grip')
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
      ...teilbereiche.filter(k => k !== 'Nicht umsetzen').map(k => `<option value="${escapeAttr(k)}">${escapeAttr(k)}</option>`),
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
          <button class="mdc-btn mdc-btn--sm" id="btn-bulk-assign">Zuweisen</button>
          <button class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="btn-bulk-deselect">Auswahl aufheben</button>
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
    const selectAll = this._q('.sourcing-select-all');
    if (selectAll) {
      const handler = (e) => {
        const checked = e.target.checked;
        this._qq('.sourcing-item-check').forEach(cb => {
          cb.checked = checked;
          if (checked) this.selectedItems.add(cb.dataset.itemId);
          else this.selectedItems.delete(cb.dataset.itemId);
        });
        this._qq('.sourcing-group-select').forEach(cb => cb.checked = checked);
        this.updateBulkBar();
      };
      selectAll.addEventListener('change', handler);
      this._boundEventListeners.add(() => selectAll.removeEventListener('change', handler));
    }

    this._qq('.sourcing-group-select').forEach(groupCb => {
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

    this._qq('.sourcing-item-check').forEach(cb => {
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
      const cb = this._q(`.sourcing-item-check[data-item-id="${id}"]`);
      if (cb) cb.checked = true;
    });
    // Remove stale IDs
    const existingIds = new Set(
      Array.from(this._qq('.sourcing-item-check')).map(cb => cb.dataset.itemId)
    );
    this.selectedItems.forEach(id => { if (!existingIds.has(id)) this.selectedItems.delete(id); });

    this.updateBulkBar();
  }

  updateSelectAllState() {
    const all = this._qq('.sourcing-item-check');
    const checked = this._qq('.sourcing-item-check:checked');
    const selectAll = this._q('.sourcing-select-all');
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

  bindToolbarMenu() {
    const menu = this._q('.toolbar-menu');
    const dropdown = menu?.querySelector('.toolbar-menu-dropdown');
    if (!menu || !dropdown) return;

    this._boundEventListeners.add(bindToolbarMenu(menu));

    const statusFilterHandler = (e) => {
      const reset = e.target.closest('[data-status-filter-reset]');
      if (reset) {
        e.preventDefault();
        e.stopPropagation();
        this.statusFilter = [];
        this._syncStatusFilterSubmenu();
        this.rerenderTable();
        return;
      }

      const item = e.target.closest('.submenu-item[data-status-tag]');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();

      const tag = item.dataset.statusTag;
      if (!tag) return;

      if (this.statusFilter.includes(tag)) {
        this.statusFilter = this.statusFilter.filter(t => t !== tag);
      } else {
        this.statusFilter = [...this.statusFilter, tag];
      }
      this._syncStatusFilterSubmenu();
      this.rerenderTable();
    };
    dropdown.addEventListener('click', statusFilterHandler);
    this._boundEventListeners.add(() => dropdown.removeEventListener('click', statusFilterHandler));
  }

  _syncStatusFilterSubmenu() {
    const submenu = this._q('.sourcing-status-filter-submenu');
    if (!submenu) return;

    const trigger = submenu.querySelector('.action-item.has-submenu');
    if (trigger) trigger.classList.toggle('active', this.statusFilter.length > 0);

    const panel = submenu.querySelector('.submenu');
    if (!panel) return;

    let resetBtn = panel.querySelector('[data-status-filter-reset]');
    if (this.statusFilter.length > 0) {
      if (!resetBtn) {
        resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'submenu-item sourcing-status-filter-reset';
        resetBtn.setAttribute('data-status-filter-reset', '');
        resetBtn.setAttribute('role', 'menuitem');
        resetBtn.textContent = 'Alle zurücksetzen';
        panel.prepend(resetBtn);
      }
    } else if (resetBtn) {
      resetBtn.remove();
    }

    const checkHtml = `
      ${icon('check-bold')}`;

    panel.querySelectorAll('.submenu-item[data-status-tag]').forEach(item => {
      const tag = item.dataset.statusTag;
      const isActive = this.statusFilter.includes(tag);
      item.setAttribute('aria-checked', isActive ? 'true' : 'false');
      let check = item.querySelector('.submenu-check');
      if (isActive && !check) {
        check = document.createElement('span');
        check.className = 'submenu-check';
        check.innerHTML = checkHtml;
        item.appendChild(check);
      } else if (!isActive && check) {
        check.remove();
      }
    });
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
        this._qq('.sourcing-item-check').forEach(cb => cb.checked = false);
        this._qq('.sourcing-group-select').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        const selectAll = this._q('.sourcing-select-all');
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
        const row = this._q(`.item-row[data-item-id="${id}"]`);
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

  openPillDropdown(itemId, pillElement) {
    this.closePillDropdown();

    const teilbereiche = getTeilbereicheFromListe(this.liste);
    const categories = [...teilbereiche.filter(k => k !== 'Nicht umsetzen'), 'Ohne Kategorie'];
    const currentItem = this.items.find(i => i.id === itemId);
    const currentKat = currentItem?.kategorie || 'Ohne Kategorie';

    const dropdown = document.createElement('div');
    dropdown.className = 'kategorie-pill-dropdown';
    dropdown.innerHTML = categories.map(k =>
      `<div class="kategorie-pill-option${k === currentKat ? ' active' : ''}" data-kategorie="${escapeAttr(k)}">${escapeAttr(k)}</div>`
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

        const row = this._q(`.item-row[data-item-id="${itemId}"]`);
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
