// CreatorAuswahlDetail.js
// Orchestrierung der Casting-Detailansicht. Filter, Events, Tabellen-UX,
// Zeilenaenderungen, Status und Bulk liegen als Prototype-Mixins daneben.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingTabelleAnpassenDrawer } from './SourcingTabelleAnpassenDrawer.js';
import { renderTabNavigation } from './sourcingTabs.js';
import { migrateHiddenColumns } from './sourcingSpaltenSichtbarkeit.js';
import {
  SOURCING_ANKER_SPALTEN,
  SOURCING_SPALTEN_LABELS,
  DEAKTIVIERTE_SPALTEN
} from './sourcingSpaltenKatalog.js';
import { renderAddSection, renderItemsTable, updateStickyHeights } from './castingTableRender.js';
import { CreatorAuswahlAddDrawer } from './CreatorAuswahlAddDrawer.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { hoverToolbar } from '../../core/hoverToolbar/HoverToolbar.js';
import { registerHoverToolbar, unregisterHoverToolbar } from '../../core/hoverToolbar/HoverToolbarRegistry.js';
import { createSourcingIgToolbarConfig } from './sourcingIgToolbarConfig.js';
import { SOURCING_IG_TOOLBAR } from './sourcingIgCell.js';
import { verknuepfeOffeneEintraege, verknuepfungsText } from './castingCreatorVerknuepfung.js';
import { CastingVorschlagPanel } from './CastingVorschlagPanel.js';
import { castingDetailEventsMethods } from './CastingDetailEvents.js';
import { castingDetailFilterMethods } from './CastingDetailFilter.js';
import { castingDetailTableUxMethods } from './CastingDetailTableUx.js';
import { castingDetailRowActionsMethods } from './CastingDetailRowActions.js';
import { castingDetailZeilenStatusMethods } from './CastingDetailZeilenStatus.js';
import { castingDetailLinksMethods } from './CastingDetailLinks.js';
import { castingDetailBulkMethods } from './CastingDetailBulk.js';
import { parseTeilbereiche } from './castingKategorien.js';
import { loadBewerbungen } from './bewerbungTab.js';
import { showCastingKategorienDrawer } from './CastingKategorienDrawer.js';

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

  // Stufen-Fetch für init und den Produktions-Prefetch.
  // Stufe 1 braucht nur die listeId, Stufe 2 die liste bzw. die items.
  async _fetchDataStages(listeId) {
    const [liste, items] = await Promise.all([
      creatorAuswahlService.getListeById(listeId),
      creatorAuswahlService.getItems(listeId),
      this.customColumns.init(listeId)
    ]);
    await this.customColumns.loadValues(items.map(i => i.id));
    return { liste, items };
  }

  /** Kategorien des Castings in Anzeigereihenfolge (creator_auswahl.teilbereich). */
  getTeilbereiche() {
    return parseTeilbereiche(this.liste?.teilbereich);
  }

  openKategorienDrawer() {
    showCastingKategorienDrawer(this);
  }

  async init(listeId, { root, chromeRoot, embedded, prefetched } = {}) {
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
    this._hoverRegistered = true;

    if (!this.embedded && this.isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) quickMenuContainer.style.display = 'none';
    }

    try {
      const { liste, items } = prefetched || await this._fetchDataStages(listeId);
      this.liste = liste;
      this.items = items;
      this.bewerbungen = this.isKunde ? [] : await loadBewerbungen(listeId);
      await this._verknuepfeBekannteCreator();

      this.loadColumnVisibilitySettings();

      if (!this.embedded && window.breadcrumbSystem && this.liste) {
        window.breadcrumbSystem.updateDetailLabel(this.liste.name);
      }

      if (this.items.length === 0 && !this.getTeilbereiche().length && !this.isKunde && this._canSourcing('create')) {
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
    if (this._tornDown) return;
    this._tornDown = true;
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.addDrawer.remove();
    this.selectedItems.clear();

    // Die Engine selbst bleibt stehen, sie gehoert der Anwendung. Nur diese
    // Config verweist auf eine Instanz, die es gleich nicht mehr gibt.
    // Prefetch-Instanzen, die nie gemountet wurden, haben nichts angemeldet.
    if (this._hoverRegistered) {
      unregisterHoverToolbar(SOURCING_IG_TOOLBAR);
      this._hoverRegistered = false;
    }
    hoverToolbar.close();

    this.vorschlagPanel?.unmount?.();

    this._selectionAbort?.abort();
    this.selectionBar?.destroy();
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

  // --- Rendering ---

  // Bestehende Zeilen ohne creator_id: gleicher Handle wie ein Creator
  // setzt die Verknuepfung, damit der Punkt am Bild gruen wird.
  async _verknuepfeBekannteCreator() {
    if (this.isKunde || !this._canSourcing('edit')) return;
    try {
      const links = await verknuepfeOffeneEintraege(
        this.items,
        (id, updates) => creatorAuswahlService.updateItem(id, updates)
      );
      const text = verknuepfungsText(links);
      if (text) window.toastSystem?.show(text, 'success');
    } catch (error) {
      console.error('Creator-Verknüpfung fehlgeschlagen:', error);
    }
  }

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
      bewerbungen: this.bewerbungen || [],
      liste: this.liste,
      isKunde: this.isKunde,
      canCreate,
      canEdit: can('edit'),
      canDelete: can('delete'),
      gastReadonly: window.isGastReadonly?.() || false,
      hiddenColumns: this.hiddenColumns,
      kundenCallActive: this.kundenCallActive,
      teilbereiche: this.getTeilbereiche(),
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
    updateStickyHeights(this._getRoot());

    if (!this.isKunde && this._canSourcing('edit')) {
      this.renderBulkBar();
    }
  }

  rerenderTable(movedItemIds = []) {
    const tableContainer = this._q('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = renderItemsTable(this.getRenderContext());
      this.bindEvents();
      updateStickyHeights(this._getRoot());
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
  castingDetailFilterMethods,
  castingDetailEventsMethods,
  castingDetailTableUxMethods,
  castingDetailRowActionsMethods,
  castingDetailZeilenStatusMethods,
  castingDetailLinksMethods,
  castingDetailBulkMethods
);

export const creatorAuswahlDetail = new CreatorAuswahlDetail();
