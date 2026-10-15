// Tabelle und Kanban der Kampagnen-Detailseite: einhaengen, wechseln, abhaengen.

import { KampagneKooperationenVideoTable } from './KampagneKooperationenVideoTable.js';
import { KooperationenKanbanBoard } from './KooperationenKanbanBoard.js';
import { updateSummaryCardsDOM, updateVideoStatsCardDOM } from './KampagneDetailSummaryCards.js';

export async function mountVideoTable() {
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

    if (this._visibilityHandler) {
      window.removeEventListener('video-column-visibility-changed', this._visibilityHandler);
    }
    this._visibilityHandler = (e) => {
      if (e.detail.kampagneId === this.kampagneId) {
        this.kooperationenVideoTable.hiddenColumns = e.detail.hiddenColumns;
        this.kooperationenVideoTable.refilter();
      }
    };
    window.addEventListener('video-column-visibility-changed', this._visibilityHandler);

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

  updateSummaryCardsDOM(this.kampagneData, this.koopBudgetSum, this.koopVideosUsed, this.koopCreatorsUsed, this.extraKostenVkSum, this.ekVkMarginSum, this.kskUmgebucht);
  updateVideoStatsCardDOM(this.videoStats);

  this._pendingTableData = null;
  await this.kooperationenVideoTable.loadAssetsAndCommentsForVisible();
}

export function switchTab(tabName) {
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

export function switchView(view) {
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
    void this._remountVideoTable();
  }
}

export function unmountVideoTable() {
  if (this.kooperationenVideoTable && typeof this.kooperationenVideoTable.destroy === 'function') {
    this.kooperationenVideoTable.destroy();
    this.kooperationenVideoTable = null;
  }
  const container = document.getElementById('kooperationen-videos-container');
  if (container) container.innerHTML = '';
}

export function unmountKanban() {
  if (this.kanbanBoard) {
    this.kanbanBoard.destroy();
    this.kanbanBoard = null;
  }
  const container = document.getElementById('kooperationen-videos-container');
  if (container) container.innerHTML = '';
}

export function mountKanban() {
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

export async function remountVideoTable() {
  if (!this.store) return;
  this.kooperationenVideoTable = new KampagneKooperationenVideoTable(this.kampagneId, this.store);
  this.kooperationenVideoTable.statusOptions = this.store.statusOptions || [];

  const hiddenCols = this.kampagneData?.video_table_hidden_columns;
  if (hiddenCols) {
    this.kooperationenVideoTable.hiddenColumns = hiddenCols;
  }
  this.kooperationenVideoTable._dataLoaded = true;

  await this._mountVideoTable();
}
