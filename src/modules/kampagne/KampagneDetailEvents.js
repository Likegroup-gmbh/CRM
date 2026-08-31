// KampagneDetailEvents.js
// Event-Binding und -Teardown für die Kampagnen-Detailseite

import { KampagneUtils } from './KampagneUtils.js';
import { navigateToNewKooperationFromKampagne } from '../kooperation/kooperationFromKampagne.js';
import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';
import { CustomColumnsDrawer } from './columns/CustomColumnsDrawer.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';

const CHECK_ICON = `
  ${icon('check-bold')}`;

function initToolbarMenu(signal) {
  const menu = document.querySelector('.page-header-right .toolbar-menu');
  if (!menu) return;
  const cleanup = bindToolbarMenu(menu);
  signal.addEventListener('abort', cleanup, { once: true });
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

  // Plus-Menü: Filter-Submenus (Status/Tags, Multi-Select)
  document.addEventListener('click', (e) => {
    const reset = e.target.closest('[data-filter-reset]');
    if (reset) {
      e.preventDefault();
      applyFilterSelection(detail, reset.dataset.filterReset, []);
      return;
    }

    const item = e.target.closest('.submenu-item[data-filter-key]');
    if (!item) return;
    e.preventDefault();

    const key = item.dataset.filterKey;
    const value = item.dataset.filterValue;
    const store = detail.store;
    if (!key || value == null || !store) return;

    const current = key === 'status' ? store.selectedStatuses : store.selectedTags;
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    applyFilterSelection(detail, key, next);
  }, { signal });

  // Plus-Menü: Sortierung (Single-Select, Menü schliesst nach Wahl)
  document.addEventListener('click', (e) => {
    const sortItem = e.target.closest('.submenu-item[data-sort-value]');
    if (!sortItem) return;
    e.preventDefault();

    const value = sortItem.dataset.sortValue;
    detail.store?.setKooperationSort(value);
    syncSortSubmenu(value);
    refreshKooperationenView(detail);
    closeToolbarMenu(sortItem.closest('.toolbar-menu'));
  }, { signal });

  // Tab Navigation (Offen / Abgeschlossen / Alle)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-button');
    if (btn) {
      e.preventDefault();
      detail.switchTab(btn.dataset.tab);
    }
  }, { signal });

  // Empty-State-Aktion: "Filter zuruecksetzen" (Status- + Tag-Filter + Suche leeren)
  document.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('[data-empty-action="reset-filters"]');
    if (!resetBtn) return;
    e.preventDefault();
    detail.store?.setSelectedStatuses([]);
    detail.store?.setSelectedTags([]);
    syncFilterSubmenu('status', []);
    syncFilterSubmenu('tag', []);
    clearKooperationenSearch(detail);
    refreshKooperationenView(detail);
  }, { signal });

  // Kooperation anlegen
  const btnNewKooperation = document.getElementById('btn-new-kooperation');
  if (btnNewKooperation) {
    btnNewKooperation.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToNewKooperationFromKampagne(detail.kampagneId, detail.kampagneData);
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

  // Bearbeiten Button → Wizard mit auftrag_id
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-edit-kampagne') || e.target.closest('#btn-edit-kampagne-bottom')) {
      e.preventDefault();
      const auftragId = detail.kampagneData?.auftrag_id;
      if (auftragId) {
        window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen&kampagneId=${detail.kampagneId}`);
      } else {
        console.warn('⚠️ Keine auftrag_id auf Kampagne – Fallback auf Wizard-Neuanlage');
        window.navigateTo('/projekt-erstellen');
      }
    }
  }, { signal });

  // Spalten-Sichtbarkeit
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-column-visibility')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showColumnVisibilityDrawer(detail);
    }
  }, { signal });

  // Custom Columns verwalten
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-custom-columns')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showCustomColumnsDrawer(detail);
    }
  }, { signal });

  // View-Switch (Tabelle / Kanban)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-view-table')) {
      e.preventDefault();
      detail.switchView('table');
    } else if (e.target.closest('#btn-view-kanban')) {
      e.preventDefault();
      detail.switchView('kanban');
    }
  }, { signal });

  // Löschen
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-delete-kampagne') {
      e.preventDefault();
      const confirmed = confirm('Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.');
      if (confirmed) deleteKampagne(detail);
    }
  }, { signal });

  // Soft-Refresh
  window.addEventListener('softRefresh', async () => {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) return;
    if (!detail.kampagneId || !location.pathname.includes('/kampagne/')) return;

    console.log('🔄 KAMPAGNEDETAIL: Soft-Refresh - lade Daten neu');
    await detail.loadCriticalData();
    detail.render();
    teardownEvents();
    setupEvents(detail);
  }, { signal });

  // Ansprechpartner entityUpdated
  window.addEventListener('entityUpdated', (e) => {
    if (e.detail.entity === 'ansprechpartner' && e.detail.action === 'added' && e.detail.kampagneId === detail.kampagneId) {
      detail.loadCriticalData().then(() => detail.render());
    }
  }, { signal });
}

export function teardownEvents() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

function showColumnVisibilityDrawer(detail) {
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
  if (window.isKunde()) return;
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
