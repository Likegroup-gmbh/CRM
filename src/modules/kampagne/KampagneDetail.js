// KampagneDetail.js (ES6-Modul)
// Kampagnen-Detail-Ansicht – Fassade/Orchestrierung
// Delegiert an: DataLoader, MainRenderer, TabRenderers, SummaryCards, Events, EditHandler

import { KampagneKooperationenVideoTable } from './KampagneKooperationenVideoTable.js';
import { KooperationenKanbanBoard } from './KooperationenKanbanBoard.js';
import { KampagneUtils } from './KampagneUtils.js';
import { loadCriticalData as _loadCriticalData, loadFullTableData } from './KampagneDetailDataLoader.js';
import { renderPageLoading, renderNotFound, renderMainPage } from './KampagneDetailMainRenderer.js';
import { updateSummaryCardsDOM } from './KampagneDetailSummaryCards.js';
import { setupEvents, teardownEvents } from './KampagneDetailEvents.js';
import { showEditForm as _showEditForm } from './KampagneDetailEditHandler.js';
import { KampagneDetailStore } from './KampagneDetailStore.js';

export class KampagneDetail {
  constructor() {
    this.kampagneId = null;
    this.kampagneData = null;
    this.store = null;
    this.creator = [];
    this.notizen = [];
    this.ratings = [];
    this.kooperationen = [];
    this.koopBudgetSum = 0;
    this.koopVideosUsed = 0;
    this.koopCreatorsUsed = 0;
    this.extraKostenVkSum = 0;
    this.sourcingCreators = [];
    this.favoriten = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.kooperationenVideoTable = null;
    this.kanbanBoard = null;
    this.currentView = 'table';
    this.videoColumnVisibilityDrawer = null;
    this.strategien = [];
    this.briefings = [];
    this.isKunde = false;

    this._isMounted = false;
    this._initPromise = null;
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
        const rolle = String(window.currentUser?.rolle || '').trim().toLowerCase();
        const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';

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

        this._mountVideoTable();

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
      this.notizen = data.notizen;
      this.ratings = data.ratings;
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

    const rolle = String(window.currentUser?.rolle || '').trim().toLowerCase();
    this.isKunde = rolle === 'kunde' || rolle === 'kunde_editor';

    const html = renderMainPage({
      kampagneData: this.kampagneData,
      koopBudgetSum: this.koopBudgetSum,
      koopVideosUsed: this.koopVideosUsed,
      koopCreatorsUsed: this.koopCreatorsUsed,
      extraKostenVkSum: this.extraKostenVkSum,
      isKunde: this.isKunde,
      kampagneId: this.kampagneId
    });

    window.setContentSafely(window.content, html);
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
  }

  _mountVideoTable() {
    if (!this.kooperationenVideoTable) return;

    const mainContent = document.querySelector('.main-content');
    mainContent?.classList.add('kampagne-detail-grid-active');

    this.kooperationenVideoTable.containerId = 'kooperationen-videos-container';
    const vtContainer = document.getElementById('kooperationen-videos-container');
    if (vtContainer) {
      vtContainer.innerHTML = this.kooperationenVideoTable.render();
      this.kooperationenVideoTable.bindEvents();
      this.kooperationenVideoTable.initFloatingScrollbar();
      this.kooperationenVideoTable.initRealtimeSubscription();
      this.kooperationenVideoTable.loadColumnWidths();

      if (!this.kooperationenVideoTable._visibilityEventBound) {
        window.addEventListener('video-column-visibility-changed', (e) => {
          if (e.detail.kampagneId === this.kampagneId) {
            this.kooperationenVideoTable.hiddenColumns = e.detail.hiddenColumns;
            this.kooperationenVideoTable.refilter();
          }
        });
        this.kooperationenVideoTable._visibilityEventBound = true;
      }

      if (!this.kooperationenVideoTable._entityUpdatedHandler) {
        this.kooperationenVideoTable._entityUpdatedHandler = async (e) => {
          const evtDetail = e.detail || {};
          if (evtDetail.entity === 'kooperation' && evtDetail.action === 'deleted' && evtDetail.id) {
            await this.kooperationenVideoTable.handleKooperationDeletedById(evtDetail.id, 'entityUpdated');
          }
        };
        window.addEventListener('entityUpdated', this.kooperationenVideoTable._entityUpdatedHandler);
      }

      this.kooperationenVideoTable.updateTabCounts();
    }

    updateSummaryCardsDOM(this.kampagneData, this.koopBudgetSum, this.koopVideosUsed, this.koopCreatorsUsed, this.extraKostenVkSum);

    const videoIds = this._pendingTableData?.videoIds;
    if (videoIds && videoIds.length > 0) {
      this.kooperationenVideoTable.loadAssetsAndCommentsForVisible();
    }
    this._pendingTableData = null;
  }

  switchTab(tabName) {
    if (!['offen', 'abgeschlossen', 'alle'].includes(tabName)) return;

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) activeButton.classList.add('active');

    if (this.currentView === 'table' && this.kooperationenVideoTable) {
      this.kooperationenVideoTable.setFilterTab(tabName);
      this.kooperationenVideoTable.updateTabCounts();
    } else if (this.currentView === 'kanban' && this.kanbanBoard) {
      this.kanbanBoard.setFilterTab(tabName);
      this.kanbanBoard.updateTabCounts();
    }
  }

  switchView(view) {
    if (view === this.currentView) return;
    this.currentView = view;

    const btnTable = document.getElementById('btn-view-table');
    const btnKanban = document.getElementById('btn-view-kanban');
    const btnVisibility = document.getElementById('btn-column-visibility');

    if (btnTable) btnTable.classList.toggle('active', view === 'table');
    if (btnKanban) btnKanban.classList.toggle('active', view === 'kanban');
    if (btnVisibility) btnVisibility.style.display = view === 'table' ? '' : 'none';

    if (view === 'kanban') {
      this._unmountVideoTable();
      this._mountKanban();
    } else {
      this._unmountKanban();
      this._remountVideoTable();
    }
  }

  _unmountVideoTable() {
    if (this.kooperationenVideoTable && typeof this.kooperationenVideoTable.destroy === 'function') {
      this.kooperationenVideoTable.destroy();
      this.kooperationenVideoTable = null;
    }
    const container = document.getElementById('kooperationen-videos-container');
    if (container) container.innerHTML = '';
  }

  _unmountKanban() {
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }
    const container = document.getElementById('kooperationen-videos-container');
    if (container) container.innerHTML = '';
  }

  _mountKanban() {
    const container = document.getElementById('kooperationen-videos-container');
    if (!container) return;

    this.kanbanBoard = new KooperationenKanbanBoard({
      isKunde: this.isKunde,
      store: this.store,
      kampagneId: this.kampagneId
    });

    const activeTab = document.querySelector('.tab-button.active');
    const tabName = activeTab?.dataset?.tab || 'offen';
    this.kanbanBoard.activeFilterTab = tabName;

    this.kanbanBoard.init(container);
    this.kanbanBoard.updateTabCounts();
  }

  _remountVideoTable() {
    if (!this.store) return;
    this.kooperationenVideoTable = new KampagneKooperationenVideoTable(this.kampagneId, this.store);
    this.kooperationenVideoTable.statusOptions = this.store.statusOptions || [];

    const hiddenCols = this.kampagneData?.video_table_hidden_columns;
    if (hiddenCols) {
      this.kooperationenVideoTable.hiddenColumns = hiddenCols;
    }
    this.kooperationenVideoTable._dataLoaded = true;

    this._mountVideoTable();
  }

  showEditForm() {
    _showEditForm(this);
  }

  destroy() {
    console.log('🗑️ KAMPAGNEDETAIL: Destroy aufgerufen');

    this._isMounted = false;
    this._initPromise = null;

    teardownEvents();

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

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('kampagne-detail-grid-active');
    }

    document.querySelectorAll('.floating-scrollbar-kampagne').forEach(scrollbar => {
      if (scrollbar.parentNode) scrollbar.parentNode.removeChild(scrollbar);
    });

    window.setContentSafely('');
    console.log('✅ KAMPAGNEDETAIL: Destroy abgeschlossen');
  }
}

export const kampagneDetail = new KampagneDetail();
