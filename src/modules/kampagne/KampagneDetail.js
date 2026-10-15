// KampagneDetail.js (ES6-Modul)
// Kampagnen-Detail-Ansicht – Fassade/Orchestrierung
// Delegiert an: DataLoader, MainRenderer, TabRenderers, SummaryCards, Events, EditHandler

import { KampagneKooperationenVideoTable } from './KampagneKooperationenVideoTable.js';
import { KampagneUtils } from './KampagneUtils.js';
import { loadCriticalData as _loadCriticalData, loadFullTableData } from './KampagneDetailDataLoader.js';
import { renderPageLoading, renderNotFound, renderMainPage } from './KampagneDetailMainRenderer.js';
import { updateSummaryCardsDOM, updateVideoStatsCardDOM } from './KampagneDetailSummaryCards.js';
import { setupEvents, teardownEvents } from './KampagneDetailEvents.js';
import { showEditForm as _showEditForm } from './KampagneDetailEditHandler.js';
import { KampagneDetailStore } from './KampagneDetailStore.js';
import { bindKampagneDockScroll } from './kampagneDockScroll.js';
import {
  mountVideoTable,
  switchTab,
  switchView,
  unmountVideoTable,
  unmountKanban,
  mountKanban,
  remountVideoTable
} from './kampagneDetailViews.js';

export class KampagneDetail {
  constructor() {
    this.kampagneId = null;
    this.kampagneData = null;
    this.store = null;
    this.creator = [];
    this.kooperationen = [];
    this.koopBudgetSum = 0;
    this.koopVideosUsed = 0;
    this.koopCreatorsUsed = 0;
    this.extraKostenVkSum = 0;
    this.ekVkMarginSum = 0;
    this.kskUmgebucht = 0;
    this.videoStats = { views: 0, likes: 0, comments: 0 };
    this.sourcingCreators = [];
    this.favoriten = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.kooperationenVideoTable = null;
    this.kanbanBoard = null;
    this.currentView = 'table';
    this.videoColumnVisibilityDrawer = null;
    this._customColumnsDrawer = null;
    this.strategien = [];
    this.briefings = [];
    this.isKunde = false;

    this._isMounted = false;
    this._initPromise = null;
    this._visibilityHandler = null;
  }

  async init(kampagneId) {
    console.log('🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:', kampagneId);

    const previousKampagneId = this.kampagneId;
    this.kampagneId = kampagneId;

    if (this._initPromise && previousKampagneId === kampagneId) {
      console.log('⚠️ KAMPAGNEDETAIL: Init bereits in Arbeit für diese Kampagne, warte...');
      return this._initPromise;
    }

    this._isMounted = true;
    this._destroyDrawers();

    if (this.kooperationenVideoTable) {
      if (typeof this.kooperationenVideoTable.destroy === 'function') {
        this.kooperationenVideoTable.destroy();
      }
      this.kooperationenVideoTable = null;
    }

    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }
    this.currentView = 'table';

    if (this.store) {
      this.store.destroy();
      this.store = null;
    }

    if (window.moduleRegistry?.currentModule !== this) {
      this._isMounted = false;
      return;
    }

    this.store = new KampagneDetailStore(kampagneId);

    this._showLoading();

    this._initPromise = (async () => {
      const _initStart = performance.now();
      try {
        const isKunde = window.isKunde();

        const [, tableData] = await Promise.all([
          this.loadCriticalData(),
          loadFullTableData(this.kampagneId, this.store, isKunde)
        ]);

        if (!this._isMounted) return;

        if (window.breadcrumbSystem && this.kampagneData) {
          const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
          window.breadcrumbSystem.updateDetailLabel(KampagneUtils.getDisplayName(this.kampagneData), {
            id: 'btn-edit-kampagne',
            canEdit
          });
        }

        this._prepareVideoTable(tableData, isKunde);

        await this.render();

        setupEvents(this);

        await this._mountVideoTable();

        const _renderTime = performance.now() - _initStart;
        console.log(`✅ KAMPAGNEDETAIL: Komplett geladen und gerendert in ${_renderTime.toFixed(0)}ms`);
      } catch (error) {
        console.error('❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:', error);
        window.ErrorHandler.handle(error, 'KampagneDetail.init');
      } finally {
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }

  _showLoading() {
    if (!window.content) return;
    window.content.innerHTML = renderPageLoading();
  }

  async loadCriticalData() {
    console.log('🔄 KAMPAGNEDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    try {
      const data = await _loadCriticalData(this.kampagneId);

      this.kampagneData = data.kampagneData;
      this.strategien = data.strategien;
      this.briefings = data.briefings;
      this.sourcingListenCount = data.sourcingListenCount;
      this.vertraegeCount = data.vertraegeCount;
      this.rechnungenCount = data.rechnungenCount;

      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ KAMPAGNEDETAIL: Kritische Daten geladen in ${loadTime}ms`);
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }

  async render() {
    if (!this.kampagneData) {
      renderNotFound();
      return;
    }

    window.setHeadline(`Kampagne: ${KampagneUtils.getDisplayName(this.kampagneData)}`);

    this.isKunde = window.isKunde();

    const html = renderMainPage({
      kampagneData: this.kampagneData,
      koopBudgetSum: this.koopBudgetSum,
      koopVideosUsed: this.koopVideosUsed,
      koopCreatorsUsed: this.koopCreatorsUsed,
      extraKostenVkSum: this.extraKostenVkSum,
      ekVkMarginSum: this.ekVkMarginSum,
      kskUmgebucht: this.kskUmgebucht,
      videoStats: this.videoStats,
      isKunde: this.isKunde,
      kampagneId: this.kampagneId,
      searchQuery: this.store?.searchQuery || '',
      availableStatuses: this.store?.getAvailableStatuses() || [],
      availableTags: this.store?.getAvailableTags() || [],
      selectedStatuses: this.store?.selectedStatuses || [],
      selectedTags: this.store?.selectedTags || [],
      kooperationSort: this.store?.kooperationSort || 'created_desc'
    });

    window.setContentSafely(window.content, html);
    this._unbindDockScroll?.();
    this._unbindDockScroll = bindKampagneDockScroll();
  }

  _prepareVideoTable(tableData, isKunde) {
    this.kooperationenVideoTable = new KampagneKooperationenVideoTable(this.kampagneId, this.store);
    this.kooperationenVideoTable.statusOptions = tableData?.statusOptions || [];

    const hiddenCols = this.kampagneData?.video_table_hidden_columns;
    if (hiddenCols) {
      this.kooperationenVideoTable.hiddenColumns = hiddenCols;
    }

    this.kooperationenVideoTable._dataLoaded = true;
    this._pendingTableData = tableData;

    const summary = this.store.calculateSummary();
    this.koopBudgetSum = summary.koopBudgetSum;
    this.koopVideosUsed = summary.koopVideosUsed;
    this.koopCreatorsUsed = summary.koopCreatorsUsed;
    this.extraKostenVkSum = summary.extraKostenVkSum;
    this.ekVkMarginSum = summary.ekVkMarginSum;
    this.kskUmgebucht = summary.kskUmgebucht;
    this.videoStats = summary.videoStats;

    this._bindVideoStatsCard();
    this._bindFilteredSummaryCards();
  }

  /**
   * Live-Performance-Karte an den Store haengen: Stats-Abruf, manuelle Korrektur
   * und Realtime laufen alle ueber updateVideo, die Karte zieht dann mit.
   * Die Listener sterben mit store.destroy() beim naechsten init().
   */
  _bindVideoStatsCard() {
    if (!this.store) return;

    const refresh = () => {
      this.videoStats = this.store.calculateVideoStats();
      this._refreshSummaryCards({ animate: true });
    };

    for (const event of ['video-updated', 'video-added', 'videos-changed', 'kooperation-removed']) {
      this.store.on(event, refresh);
    }
  }

  /**
   * Tag-Filter an die Summary-Karten haengen: Bei jeder Tag-Aenderung werden
   * die kooperationsbasierten Kennzahlen live (animiert, ohne Re-Render) auf
   * die gefilterte Menge umgerechnet.
   */
  _bindFilteredSummaryCards() {
    if (!this.store) return;
    this.store.on('tags-filter-changed', () => this._refreshSummaryCards({ animate: true }));
  }

  /**
   * Summary-Karten in-place aktualisieren. Bei aktivem Tag-Filter ueber die
   * gefilterten Kooperationen, sonst global. Schreibt bewusst keine
   * Instanzfelder (this.koopBudgetSum etc.) - die bleiben global fuer Mounts.
   */
  _refreshSummaryCards({ animate = false } = {}) {
    if (!this.store) return;
    const hasTagFilter = (this.store.selectedTags || []).length > 0;
    const summary = hasTagFilter
      ? this.store.calculateFilteredSummary()
      : this.store.calculateSummary();
    updateSummaryCardsDOM(
      this.kampagneData,
      summary.koopBudgetSum,
      summary.koopVideosUsed,
      summary.koopCreatorsUsed,
      summary.extraKostenVkSum,
      summary.ekVkMarginSum,
      summary.kskUmgebucht,
      { animate }
    );
    updateVideoStatsCardDOM(summary.videoStats, { animate });
  }

  showEditForm() {
    _showEditForm(this);
  }

  _destroyDrawers() {
    this.videoColumnVisibilityDrawer?.destroy?.();
    this.videoColumnVisibilityDrawer = null;

    this._customColumnsDrawer?.destroy?.();
    this._customColumnsDrawer = null;
  }

  destroy() {
    console.log('🗑️ KAMPAGNEDETAIL: Destroy aufgerufen');

    this._isMounted = false;
    this._initPromise = null;

    teardownEvents();
    this._destroyDrawers();

    if (this._visibilityHandler) {
      window.removeEventListener('video-column-visibility-changed', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    if (this.kooperationenVideoTable && typeof this.kooperationenVideoTable.destroy === 'function') {
      this.kooperationenVideoTable.destroy();
      this.kooperationenVideoTable = null;
    }

    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }

    if (this.store) {
      this.store.destroy();
      this.store = null;
    }

    this._unbindDockScroll?.();
    this._unbindDockScroll = null;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.remove('kampagne-detail-grid-active');

    document.querySelectorAll('.floating-scrollbar-kampagne').forEach(scrollbar => {
      if (scrollbar.parentNode) scrollbar.parentNode.removeChild(scrollbar);
    });

    window.setContentSafely('');
    console.log('✅ KAMPAGNEDETAIL: Destroy abgeschlossen');
  }
}

Object.assign(KampagneDetail.prototype, {
  _mountVideoTable: mountVideoTable,
  switchTab,
  switchView,
  _unmountVideoTable: unmountVideoTable,
  _unmountKanban: unmountKanban,
  _mountKanban: mountKanban,
  _remountVideoTable: remountVideoTable
});

export const kampagneDetail = new KampagneDetail();
