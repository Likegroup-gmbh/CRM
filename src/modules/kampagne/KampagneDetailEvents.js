// KampagneDetailEvents.js
// Event-Binding und -Teardown für die Kampagnen-Detailseite

import {
  getWorkflowTableRoute,
  handleWorkflowTableSelect,
  reloadWorkflowPane
} from './KampagneDetailWorkflow.js';
import { handleVertragListAction } from '../vertrag/VertraegeListHandlers.js';
import { KampagneUtils } from './KampagneUtils.js';
import { navigateToNewKooperationFromKampagne } from '../kooperation/kooperationFromKampagne.js';
import { handleWorkflowCreate } from './KampagneWorkflowCreate.js';
import { openProduktionBriefingDrawer } from '../produktion/ProduktionBriefingDrawer.js';
import { emptyProduktionId } from '../produktion/ProduktionService.js';
import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';
import { CustomColumnsDrawer } from './columns/CustomColumnsDrawer.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';

const CHECK_ICON = `
  ${icon('check-bold')}`;

function initToolbarMenu(signal) {
  document.querySelectorAll('.page-header-right .toolbar-menu').forEach(menu => {
    const cleanup = bindToolbarMenu(menu);
    signal.addEventListener('abort', cleanup, { once: true });
  });
}

// Filter-Auswahl (Status/Tags) in den Store schreiben, Submenu-DOM syncen
// und die Kooperations-Ansicht neu filtern.
function applyFilterSelection(detail, key, values) {
  const store = detail.store;
  if (!store) return;
  if (key === 'status') store.setSelectedStatuses(values);
  else store.setSelectedTags(values);
  syncFilterSubmenu(key, values);
  refreshKooperationenView(detail);
}

function syncFilterSubmenu(key, selected) {
  const submenu = document.querySelector(`[data-filter-submenu="${key}"]`);
  if (!submenu) return;
  const hasActive = selected.length > 0;

  const trigger = submenu.querySelector('.action-item.has-submenu');
  if (trigger) trigger.classList.toggle('active', hasActive);

  const panel = submenu.querySelector('.submenu');
  if (!panel) return;

  let resetBtn = panel.querySelector('[data-filter-reset]');
  if (hasActive && !resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'submenu-item submenu-reset';
    resetBtn.dataset.filterReset = key;
    resetBtn.setAttribute('role', 'menuitem');
    resetBtn.textContent = 'Alle zurücksetzen';
    panel.prepend(resetBtn);
  } else if (!hasActive && resetBtn) {
    resetBtn.remove();
  }

  syncSubmenuChecks(panel, `.submenu-item[data-filter-value]`, (item) =>
    selected.includes(item.dataset.filterValue)
  );
}

function syncSortSubmenu(currentSort) {
  const submenu = document.querySelector('[data-sort-submenu]');
  if (!submenu) return;
  syncSubmenuChecks(submenu, '.submenu-item[data-sort-value]', (item) =>
    item.dataset.sortValue === currentSort
  );
}

function syncSubmenuChecks(root, selector, isActiveFn) {
  root.querySelectorAll(selector).forEach(item => {
    const isActive = isActiveFn(item);
    item.setAttribute('aria-checked', isActive ? 'true' : 'false');
    let check = item.querySelector('.submenu-check');
    if (isActive && !check) {
      check = document.createElement('span');
      check.className = 'submenu-check';
      check.innerHTML = CHECK_ICON;
      item.appendChild(check);
    } else if (!isActive && check) {
      check.remove();
    }
  });
}

function closeToolbarMenu(root) {
  const dropdown = root?.querySelector('.toolbar-menu-dropdown');
  const toggle = root?.querySelector('.toolbar-menu-toggle');
  if (!dropdown || !toggle) return;
  dropdown.classList.remove('show');
  toggle.setAttribute('aria-expanded', 'false');
  dropdown.setAttribute('aria-hidden', 'true');
}

function refreshKooperationenView(detail) {
  if (detail.currentView === 'table') {
    detail.kooperationenVideoTable?.refilter();
  } else if (detail.currentView === 'kanban') {
    detail.kanbanBoard?.render();
  }
}

function initKooperationenSearch(detail, signal) {
  SearchInput.bind('kampagne-koop', (value) => {
    const newQuery = value || '';
    if (newQuery === (detail.store?.searchQuery || '')) return;
    detail.store?.setSearchQuery(newQuery);
    refreshKooperationenView(detail);
  }, signal);
}

function clearKooperationenSearch(detail) {
  if (!(detail.store?.searchQuery || '')) return;
  detail.store?.setSearchQuery('');
  const input = document.getElementById('kampagne-koop-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('kampagne-koop-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  refreshKooperationenView(detail);
}

let _abortController = null;

export function setupEvents(detail) {
  teardownEvents();
  _abortController = new AbortController();
  const signal = _abortController.signal;

  initToolbarMenu(signal);
  initKooperationenSearch(detail, signal);

  document.getElementById('btn-new-produktion')?.addEventListener('click', () => {
    openProduktionBriefingDrawer(detail, {
      produktionId: emptyProduktionId(detail.produktionen)
    });
  }, { signal });

  document.querySelectorAll('a[data-table="produktion"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.dataset.id) window.navigateTo(`/produktion/${link.dataset.id}`);
    }, { signal });
  });

  // Ein document-Click statt einem Listener pro Aktion. Reihenfolge wie vorher,
  // erster Treffer gewinnt. Selektoren überlappen sich nicht.
  document.addEventListener('click', (e) => {
    const filterReset = e.target.closest('[data-filter-reset]');
    if (filterReset) {
      e.preventDefault();
      applyFilterSelection(detail, filterReset.dataset.filterReset, []);
      return;
    }

    const filterItem = e.target.closest('.submenu-item[data-filter-key]');
    if (filterItem) {
      e.preventDefault();
      const key = filterItem.dataset.filterKey;
      const value = filterItem.dataset.filterValue;
      const store = detail.store;
      if (!key || value == null || !store) return;
      const current = key === 'status' ? store.selectedStatuses : store.selectedTags;
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      applyFilterSelection(detail, key, next);
      return;
    }

    const sortItem = e.target.closest('.submenu-item[data-sort-value]');
    if (sortItem) {
      e.preventDefault();
      const value = sortItem.dataset.sortValue;
      detail.store?.setKooperationSort(value);
      syncSortSubmenu(value);
      refreshKooperationenView(detail);
      closeToolbarMenu(sortItem.closest('.toolbar-menu'));
      return;
    }

    const filterTab = e.target.closest('.kampagne-filter-tabs .tab-button');
    if (filterTab) {
      e.preventDefault();
      detail.switchTab(filterTab.dataset.tab);
      return;
    }

    const workflowTab = e.target.closest('[data-workflow-tab]');
    if (workflowTab) {
      e.preventDefault();
      detail.switchWorkflowTab(workflowTab.dataset.workflowTab);
      return;
    }

    const createBtn = e.target.closest('.kampagne-tab-chrome [data-create-action]');
    if (createBtn) {
      e.preventDefault();
      if (createBtn.disabled || createBtn.getAttribute('aria-disabled') === 'true') return;
      handleWorkflowCreate(detail, createBtn.dataset.createAction);
      return;
    }

    if (e.target.closest('.workflow-pane:not([data-pane="produktion"])')) {
      const vertragEdit = e.target.closest('[data-vertrag-open="edit"]');
      if (vertragEdit?.dataset.id) {
        e.preventDefault();
        window.navigateTo(`/vertraege/${vertragEdit.dataset.id}/edit`);
        return;
      }
      const link = e.target.closest('.table-link[data-table][data-id]');
      const route = link && getWorkflowTableRoute(link.dataset.table, link.dataset.id);
      if (route) {
        e.preventDefault();
        window.navigateTo(route);
        return;
      }
    }

    const emptyReset = e.target.closest('[data-empty-action="reset-filters"]');
    if (emptyReset) {
      e.preventDefault();
      detail.store?.setSelectedStatuses([]);
      detail.store?.setSelectedTags([]);
      syncFilterSubmenu('status', []);
      syncFilterSubmenu('tag', []);
      clearKooperationenSearch(detail);
      refreshKooperationenView(detail);
      return;
    }

    if (e.target.closest('#btn-download-finale')) {
      e.preventDefault();
      detail.kooperationenVideoTable?._finalBulkDownload?.downloadSelected();
      return;
    }

    if (e.target.closest('#btn-edit-kampagne') || e.target.closest('#btn-edit-kampagne-bottom')) {
      e.preventDefault();
      const auftragId = detail.kampagneData?.auftrag_id;
      if (auftragId) {
        window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen&kampagneId=${detail.kampagneId}`);
      } else {
        console.warn('⚠️ Keine auftrag_id auf Kampagne – Fallback auf Wizard-Neuanlage');
        window.navigateTo('/projekt-erstellen');
      }
      return;
    }

    if (e.target.closest('#btn-column-visibility')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showColumnVisibilityDrawer(detail);
      return;
    }

    if (e.target.closest('#btn-custom-columns')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showCustomColumnsDrawer(detail);
      return;
    }

    if (e.target.closest('#btn-view-table')) {
      e.preventDefault();
      detail.switchView('table');
      return;
    }
    if (e.target.closest('#btn-view-kanban')) {
      e.preventDefault();
      detail.switchView('kanban');
      return;
    }

    if (e.target.id === 'btn-delete-kampagne') {
      e.preventDefault();
      const confirmed = confirm('Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.');
      if (confirmed) deleteKampagne(detail);
    }
  }, { signal });

  // Workflow-Panes: Inline-Selects (Skript-Status). Casting/Konzepte laufen über das Worksheet.
  // tableSelect feuert das Event auf document; hier nur die aus unseren Panes.
  document.addEventListener('table-select-change', (e) => {
    const pane = e.detail?.element?.closest('.workflow-pane');
    if (!pane) return;
    if (pane.dataset.pane === 'casting' || pane.dataset.pane === 'konzepte') return;
    handleWorkflowTableSelect(detail, e.detail);
  }, { signal });

  // Kooperation anlegen
  const btnNewKooperation = document.getElementById('btn-new-kooperation');
  if (btnNewKooperation) {
    btnNewKooperation.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToNewKooperationFromKampagne(detail.kampagneId, detail.kampagneData, detail.produktionId);
    }, { signal });
  }

  // Kampagne teilen (Gast-Zugang per E-Mail)
  const btnShareKampagne = document.getElementById('btn-share-kampagne');
  if (btnShareKampagne) {
    btnShareKampagne.addEventListener('click', (e) => {
      e.preventDefault();
      window.shareListDialog?.open({
        entityType: 'kampagne',
        entityId: detail.kampagneId,
        entityName: KampagneUtils.getDisplayName(detail.kampagneData) || detail.kampagneData?.kampagnenname || ''
      });
    }, { signal });
  }

  // Soft-Refresh
  window.addEventListener('softRefresh', async () => {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) return;
    const path = location.pathname;
    if (!detail.kampagneId || (!path.includes('/kampagne/') && !path.includes('/produktion/'))) return;

    console.log('🔄 KAMPAGNEDETAIL: Soft-Refresh - lade Daten neu');
    await detail.loadCriticalData();
    detail.render();
    teardownEvents();
    setupEvents(detail);
    if (detail.mode !== 'overview') {
      if (detail.currentView === 'kanban') {
        detail.kanbanBoard?.destroy();
        detail.kanbanBoard = null;
        detail._mountKanban();
      } else {
        await detail._mountVideoTable();
      }
    }
  }, { signal });

  // Ansprechpartner entityUpdated
  window.addEventListener('entityUpdated', (e) => {
    if (e.detail.entity === 'ansprechpartner' && e.detail.action === 'added' && e.detail.kampagneId === detail.kampagneId) {
      detail.loadCriticalData().then(() => detail.render());
    }
  }, { signal });

  window.addEventListener('vertrag-signed-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, e.detail?.action, e.detail?.vertragId);
  }, { signal });

  window.addEventListener('vertrag-anschreiben-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, 'anschreiben', e.detail?.vertragId);
  }, { signal });

  window.addEventListener('vertrag-list-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, e.detail?.action, e.detail?.vertragId);
  }, { signal });

  window.addEventListener('anschreibenSent', (e) => {
    if (e.detail?.dokumentTyp !== 'vertrag') return;
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void reloadWorkflowPane(detail, 'vertraege');
  }, { signal });
}

export function teardownEvents() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

function showColumnVisibilityDrawer(detail) {
  if (!(window.canFeature?.('kampagneTableLayout') ?? false)) return;
  const drawer = detail.videoColumnVisibilityDrawer;
  if (drawer && (drawer.kampagneId !== detail.kampagneId || drawer.store !== detail.store)) {
    drawer.destroy();
    detail.videoColumnVisibilityDrawer = null;
  }
  if (!detail.videoColumnVisibilityDrawer) {
    detail.videoColumnVisibilityDrawer = new VideoTableColumnVisibilityDrawer(detail.kampagneId, detail.store);
  }
  detail.videoColumnVisibilityDrawer.open();
}

function showCustomColumnsDrawer(detail) {
  if (!(window.canFeature?.('kampagneTableLayout') ?? false)) return;
  const drawer = detail._customColumnsDrawer;
  if (drawer && (drawer.kampagneId !== detail.kampagneId || drawer.store !== detail.store)) {
    drawer.destroy();
    detail._customColumnsDrawer = null;
  }
  if (!detail._customColumnsDrawer) {
    detail._customColumnsDrawer = new CustomColumnsDrawer(
      detail.kampagneId,
      detail.store,
      () => detail.kooperationenVideoTable?.refilter()
    );
  }
  detail._customColumnsDrawer.open();
}

function handleKampagneVertragListAction(detail, action, vertragId) {
  const adapter = detail._vertragListAdapter;
  if (!adapter || !action || !vertragId) return;
  return handleVertragListAction(adapter, action, vertragId);
}

async function deleteKampagne(detail) {
  try {
    const cascade = await deleteDropboxCascade('kampagne', detail.kampagneId);
    if (cascade.failed > 0) {
      console.warn('Dropbox-Cascade: Einige Dateien konnten nicht gelöscht werden:', cascade.failures);
    }
    const { error } = await window.supabase.from('kampagne').delete().eq('id', detail.kampagneId);
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kampagne', action: 'deleted', id: detail.kampagneId }
    }));
    window.navigateTo('/kampagne');
  } catch (error) {
    console.error('❌ Fehler beim Löschen der Kampagne:', error);
    alert('Ein unerwarteter Fehler ist aufgetreten.');
  }
}
