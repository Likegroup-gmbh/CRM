// CreatorAuswahlDetail.js
// Orchestrierung der Casting-Detailansicht. Events, Tabellen-UX, Zeilenaenderungen,
// Verknuepfungen und Bulk liegen als Prototype-Mixins daneben.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingTabelleAnpassenDrawer } from './SourcingTabelleAnpassenDrawer.js';
import { renderTabNavigation, getSourcingTabForItem, SOURCING_TABS } from './sourcingTabs.js';
import { migrateHiddenColumns } from './sourcingSpaltenSichtbarkeit.js';
import {
  SOURCING_ANKER_SPALTEN,
  SOURCING_SPALTEN_LABELS,
  DEAKTIVIERTE_SPALTEN
} from './sourcingSpaltenKatalog.js';
import { renderAddSection, renderItemsTable } from './castingTableRender.js';
import { CreatorAuswahlAddDrawer } from './CreatorAuswahlAddDrawer.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { hoverToolbar } from '../../core/hoverToolbar/HoverToolbar.js';
import { registerHoverToolbar, unregisterHoverToolbar } from '../../core/hoverToolbar/HoverToolbarRegistry.js';
import { createSourcingIgToolbarConfig } from './sourcingIgToolbarConfig.js';
import { SOURCING_IG_TOOLBAR } from './sourcingIgCell.js';
import { matchesStatusFilter } from './sourcingStatusOptions.js';
import { CastingVorschlagPanel } from './CastingVorschlagPanel.js';
import { vorschlagToItem } from './CastingVorschlagService.js';
import { castingDetailEventsMethods } from './CastingDetailEvents.js';
import { castingDetailTableUxMethods } from './CastingDetailTableUx.js';
import { castingDetailRowActionsMethods } from './CastingDetailRowActions.js';
import { castingDetailLinksMethods } from './CastingDetailLinks.js';
import { castingDetailBulkMethods } from './CastingDetailBulk.js';
import { showProduktionLeaf } from '../../core/navHerkunft.js';

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
    this.personas = [];
    this.addDrawer = new CreatorAuswahlAddDrawer(this);
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
      this.personas = await creatorAuswahlService.loadBriefingPersonas(this.liste);

      await this.customColumns.init(listeId);
      await this.customColumns.loadValues(this.items.map(i => i.id));

      this.loadColumnVisibilitySettings();

      if (!this.embedded && window.breadcrumbSystem && this.liste) {
        const shown = await showProduktionLeaf(this.liste.name);
        if (!shown) window.breadcrumbSystem.updateDetailLabel(this.liste.name);
      }

      if (this.items.length === 0 && !this.personas.length && !this.isKunde && this._canSourcing('create')) {
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

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.addDrawer.remove();
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
      .map(v => vorschlagToItem(v, {
        listeTyp,
        personaIds: (this.personas || []).map(p => p.id)
      }))
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
      personas: this.personas || [],
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
}

Object.assign(
  CreatorAuswahlDetail.prototype,
  castingDetailEventsMethods,
  castingDetailTableUxMethods,
  castingDetailRowActionsMethods,
  castingDetailLinksMethods,
  castingDetailBulkMethods
);

export const creatorAuswahlDetail = new CreatorAuswahlDetail();
