// SkriptListEvents.js
// Toggle, Zurück, Ordner-Klick, Create, Item-Navigation.

import { bindEmptyStateActions } from '../../core/components/EmptyState.js';

export function bindEvents(list) {
  list._boundEventListeners.forEach((cleanup) => cleanup());
  list._boundEventListeners.clear();

  const on = (el, type, handler) => {
    if (!el) return;
    el.addEventListener(type, handler);
    list._boundEventListeners.add(() => el.removeEventListener(type, handler));
  };

  on(document.getElementById('btn-view-list'), 'click', (e) => {
    e.preventDefault();
    if (list.listViewMode === 'list') return;
    list.listViewMode = 'list';
    list.loadAndRender();
  });

  on(document.getElementById('btn-view-grid'), 'click', (e) => {
    e.preventDefault();
    if (list.listViewMode === 'grid') return;
    list.listViewMode = 'grid';
    list.loadAndRender();
  });

  on(document.getElementById('btn-back-to-companies'), 'click', (e) => {
    e.preventDefault();
    list.switchToCompaniesView();
  });

  on(document.getElementById('btn-back-to-brands'), 'click', (e) => {
    e.preventDefault();
    list.switchToBrandsView(list.currentUnternehmenId, list.currentUnternehmenName);
  });

  on(document.getElementById('btn-back-to-campaigns'), 'click', (e) => {
    e.preventDefault();
    list.switchToCampaignsView(list.currentMarkeId, list.currentMarkeName);
  });

  on(document.getElementById('companies-grid'), 'click', (e) => {
    const folder = e.target.closest('.folder-card');
    if (!folder) return;
    list.switchToBrandsView(folder.dataset.unternehmenId, folder.dataset.unternehmenName);
  });

  on(document.getElementById('brands-grid'), 'click', (e) => {
    const folder = e.target.closest('.folder-card');
    if (!folder) return;
    openBrand(list, folder.dataset);
  });

  on(document.getElementById('campaigns-grid'), 'click', (e) => {
    const folder = e.target.closest('.folder-card');
    if (!folder) return;
    list.switchToItemsView(folder.dataset.kampagneId, folder.dataset.kampagneName);
  });

  document.querySelectorAll('.company-row').forEach((row) => {
    on(row, 'click', (e) => {
      if (e.target.closest('.company-link')) e.preventDefault();
      list.switchToBrandsView(row.dataset.unternehmenId, row.dataset.unternehmenName);
    });
  });

  document.querySelectorAll('.brand-row').forEach((row) => {
    on(row, 'click', (e) => {
      if (e.target.closest('.brand-link')) e.preventDefault();
      openBrand(list, row.dataset);
    });
  });

  document.querySelectorAll('.campaign-row').forEach((row) => {
    on(row, 'click', (e) => {
      if (e.target.closest('.campaign-link')) e.preventDefault();
      list.switchToItemsView(row.dataset.kampagneId, row.dataset.kampagneName);
    });
  });

  const globalClickHandler = (e) => {
    if (e.target.id === 'btn-skript-new' || e.target.closest('#btn-skript-new')) {
      e.preventDefault();
      if (window.isKunde?.()) return;
      window.navigateTo('/skripte/new');
      return;
    }

    if (e.target.classList.contains('table-link') && e.target.dataset.table === 'skripte') {
      e.preventDefault();
      window.navigateTo(`/skripte/${e.target.dataset.id}`);
      return;
    }

    const row = e.target.closest('.table-row-clickable[data-id]');
    if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
      window.navigateTo(`/skripte/${row.dataset.id}`);
    }
  };
  document.addEventListener('click', globalClickHandler);
  list._boundEventListeners.add(() => document.removeEventListener('click', globalClickHandler));

  const entityHandler = (e) => {
    if (e.detail?.entity === 'skripte') {
      list._forceReload = true;
      list.loadAndRender();
    }
  };
  window.addEventListener('entityUpdated', entityHandler);
  list._boundEventListeners.add(() => window.removeEventListener('entityUpdated', entityHandler));

  const unbindEmpty = bindEmptyStateActions(document, {
    'reset-filters': () => list.onFiltersReset()
  });
  list._boundEventListeners.add(unbindEmpty);
}

function openBrand(list, dataset) {
  if (dataset.ohneMarke === '1') {
    list.switchToCampaignsView(null, dataset.markeName);
    return;
  }
  list.switchToCampaignsView(dataset.markeId, dataset.markeName);
}
