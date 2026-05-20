// StrategieListEvents.js
// Event-Binding für die Strategie-Listenansicht

export function bindEvents(list) {
  list._boundEventListeners.forEach((cleanup) => cleanup());
  list._boundEventListeners.clear();

  const btnViewList = document.getElementById('btn-view-list');
  if (btnViewList) {
    const handler = (e) => {
      e.preventDefault();
      if (list.listViewMode === 'list') return;
      list.listViewMode = 'list';
      list.loadAndRender();
    };
    btnViewList.addEventListener('click', handler);
    list._boundEventListeners.add(() => btnViewList.removeEventListener('click', handler));
  }

  const btnViewGrid = document.getElementById('btn-view-grid');
  if (btnViewGrid) {
    const handler = (e) => {
      e.preventDefault();
      if (list.listViewMode === 'grid') return;
      list.listViewMode = 'grid';
      list.loadAndRender();
    };
    btnViewGrid.addEventListener('click', handler);
    list._boundEventListeners.add(() => btnViewGrid.removeEventListener('click', handler));
  }

  const btnBackToCompanies = document.getElementById('btn-back-to-companies');
  if (btnBackToCompanies) {
    const handler = (e) => {
      e.preventDefault();
      list.switchToCompaniesView();
    };
    btnBackToCompanies.addEventListener('click', handler);
    list._boundEventListeners.add(() => btnBackToCompanies.removeEventListener('click', handler));
  }

  const btnBackToBrands = document.getElementById('btn-back-to-brands');
  if (btnBackToBrands) {
    const handler = (e) => {
      e.preventDefault();
      list.viewMode = 'brands';
      list.currentMarkeId = null;
      list.currentMarkeName = null;
      list.loadAndRender();
    };
    btnBackToBrands.addEventListener('click', handler);
    list._boundEventListeners.add(() => btnBackToBrands.removeEventListener('click', handler));
  }

  const companiesGrid = document.getElementById('companies-grid');
  if (companiesGrid) {
    const handler = (e) => {
      const folder = e.target.closest('.folder-card');
      if (!folder) return;
      list.switchToBrandsView(folder.dataset.unternehmenId, folder.dataset.unternehmenName);
    };
    companiesGrid.addEventListener('click', handler);
    list._boundEventListeners.add(() => companiesGrid.removeEventListener('click', handler));
  }

  document.querySelectorAll('.company-row').forEach((row) => {
    const handler = (e) => {
      if (e.target.closest('.company-link')) e.preventDefault();
      list.switchToBrandsView(row.dataset.unternehmenId, row.dataset.unternehmenName);
    };
    row.addEventListener('click', handler);
    list._boundEventListeners.add(() => row.removeEventListener('click', handler));
  });

  document.querySelectorAll('.brand-row').forEach((row) => {
    const handler = (e) => {
      if (e.target.closest('.brand-link')) e.preventDefault();
      list.switchToItemsView(row.dataset.markeId, row.dataset.markeName);
    };
    row.addEventListener('click', handler);
    list._boundEventListeners.add(() => row.removeEventListener('click', handler));
  });

  const globalClickHandler = (e) => {
    if (e.target.closest('[data-action="create-strategie"]')) {
      e.preventDefault();
      list.openCreateDrawer();
      return;
    }

    if (e.target.closest('[data-action="how-to-strategie"]')) {
      e.preventDefault();
      list.showHowToModal();
      return;
    }

    const viewBtn = e.target.closest('[data-action="view-strategie"]');
    if (viewBtn) {
      e.preventDefault();
      window.navigateTo(`/strategie/${viewBtn.dataset.id}`);
      return;
    }

    const editBtn = e.target.closest('[data-action="edit-strategie"]');
    if (editBtn) {
      e.preventDefault();
      list.openEditDrawer(editBtn.dataset.id);
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete-strategie"]');
    if (deleteBtn) {
      e.preventDefault();
      list.confirmDeleteStrategie(deleteBtn.dataset.id);
      return;
    }

    if (e.target.classList.contains('table-link') && e.target.dataset.table === 'strategie') {
      e.preventDefault();
      window.navigateTo(`/strategie/${e.target.dataset.id}`);
      return;
    }

    const row = e.target.closest('.table-row-clickable');
    if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
      const id = row.dataset.strategieId;
      if (id) window.navigateTo(`/strategie/${id}`);
    }
  };
  document.addEventListener('click', globalClickHandler);
  list._boundEventListeners.add(() => document.removeEventListener('click', globalClickHandler));
}
