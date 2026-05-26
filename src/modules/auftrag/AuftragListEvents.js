// AuftragListEvents.js
// Event-Handling Methoden fuer AuftragList (Prototype-Mixin)

import { AuftragList } from './AuftragListCore.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';

AuftragList.prototype.bindEvents = function() {
  if (this.currentView === 'list') {
    SearchInput.bind('auftrag', (value) => this.handleSearch(value));
  }

  if (this.currentView === 'list') {
    this.initDragToScroll();
  } else if (this._dragToScrollCleanup) {
    this._dragToScrollCleanup();
    this._dragToScrollCleanup = null;
  }

  if (!this._globalEventsBound) {
    this.bindGlobalDelegatedEvents();
    this._globalEventsBound = true;
  }
};

AuftragList.prototype.initDragToScroll = function() {
  const container = document.getElementById('auftrag-table-container');
  if (!container) return;

  if (this._dragToScrollCleanup) {
    this._dragToScrollCleanup();
  }

  this.dragScrollContainer = container;

  const handleMouseDown = (e) => {
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.tagName === 'BUTTON' ||
      e.target.closest('input') ||
      e.target.closest('textarea') ||
      e.target.closest('select') ||
      e.target.tagName === 'A' ||
      e.target.closest('a') ||
      e.target.closest('button') ||
      e.target.closest('.actions-dropdown') ||
      e.target.closest('.actions-dropdown-portal')
    ) {
      return;
    }

    this.isDragging = true;
    this.startX = e.pageX - container.offsetLeft;
    this.scrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!this.isDragging) return;
    e.preventDefault();

    const x = e.pageX - container.offsetLeft;
    const walk = (x - this.startX) * 1.5;
    container.scrollLeft = this.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  };

  container.addEventListener('mousedown', handleMouseDown);
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('mouseleave', handleMouseUp);

  this._dragToScrollCleanup = () => {
    container.removeEventListener('mousedown', handleMouseDown);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseup', handleMouseUp);
    container.removeEventListener('mouseleave', handleMouseUp);
    container.style.cursor = '';
    container.style.userSelect = '';
    this.isDragging = false;
    this.dragScrollContainer = null;
  };

  container.style.cursor = 'grab';
};

AuftragList.prototype.bindGlobalDelegatedEvents = function() {
  this._globalClickHandler = (e) => {
    const tabBtn = e.target.closest('.tab-button[data-tab]');
    if (tabBtn) {
      e.preventDefault();
      this.switchTab(tabBtn.dataset.tab);
      return;
    }

    if (this.activeTab === 'contracts') {
      const contractRow = e.target.closest('.contracts-table tr[data-id]');
      if (contractRow && !e.target.closest('a, button, input, label, .actions-dropdown')) {
        e.preventDefault();
        window.navigateTo(`/contracts/${contractRow.dataset.id}`);
        return;
      }
    }

    if (e.target.id === 'btn-view-list' || e.target.closest('#btn-view-list')) {
      e.preventDefault();
      if (this.activeTab === 'contracts') return;
      if (this.currentView === 'list') return;

      if (this.cashFlowCalendar) {
        this.cashFlowCalendar.destroy();
        this.cashFlowCalendar = null;
      }

      this.currentView = 'list';
      this.renderAuftraegeContent();
      SearchInput.bind('auftrag', (value) => this.handleSearch(value));
      this.initDragToScroll();
      this.loadAuftraegeData();

      document.getElementById('btn-view-list')?.classList.add('active');
      document.getElementById('btn-view-calendar')?.classList.remove('active');
      return;
    }

    if (e.target.id === 'btn-view-calendar' || e.target.closest('#btn-view-calendar')) {
      e.preventDefault();
      if (this.activeTab === 'contracts') return;
      if (this.currentView === 'calendar') return;

      this.currentView = 'calendar';
      this.renderAuftraegeContent();
      this.initCashFlowCalendar();

      document.getElementById('btn-view-list')?.classList.remove('active');
      document.getElementById('btn-view-calendar')?.classList.add('active');
      return;
    }

    if (e.target.id === 'btn-auftrag-new' || e.target.id === 'btn-auftrag-new-filter') {
      e.preventDefault();
      window.navigateTo('/projekt-erstellen');
      return;
    }

    if (e.target.id === 'btn-select-all') {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('.auftrag-check');
      checkboxes.forEach(cb => {
        cb.checked = true;
        if (cb.dataset.id) this.selectedAuftraege.add(cb.dataset.id);
      });
      const selectAllHeader = document.getElementById('select-all-auftraege');
      if (selectAllHeader) {
        selectAllHeader.indeterminate = false;
        selectAllHeader.checked = true;
      }
      this.updateSelection();
      return;
    }

    if (e.target.id === 'btn-deselect-all') {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('.auftrag-check');
      checkboxes.forEach(cb => { cb.checked = false; });
      this.selectedAuftraege.clear();
      const selectAllHeader = document.getElementById('select-all-auftraege');
      if (selectAllHeader) {
        selectAllHeader.indeterminate = false;
        selectAllHeader.checked = false;
      }
      this.updateSelection();
      return;
    }

    if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftrag') {
      e.preventDefault();
      const auftragId = e.target.dataset.id;
      window.navigateTo(`/auftrag/${auftragId}`);
      return;
    }

    if (e.target.classList.contains('tag-x')) {
      e.preventDefault();
      e.stopPropagation();

      const tagElement = e.target.closest('.filter-tag');
      const key = tagElement?.dataset?.key;

      if (key) {
        const currentFilters = window.filterSystem.getFilters('auftrag');
        delete currentFilters[key];
        window.filterSystem.applyFilters('auftrag', currentFilters);
        this.loadAuftraegeData();
      }
      return;
    }
  };

  this._globalChangeHandler = (e) => {
    if (e.target.classList.contains('auftrag-inline-date-input')) {
      this.handleInlineBillingDateChange(e.target);
      return;
    }

    if (e.target.id === 'select-all-auftraege') {
      const checkboxes = document.querySelectorAll('.auftrag-check');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          this.selectedAuftraege.add(cb.dataset.id);
        } else {
          this.selectedAuftraege.delete(cb.dataset.id);
        }
      });
      this.updateSelection();
      return;
    }

    if (e.target.classList.contains('auftrag-check')) {
      if (e.target.checked) {
        this.selectedAuftraege.add(e.target.dataset.id);
      } else {
        this.selectedAuftraege.delete(e.target.dataset.id);
      }
      this.updateSelection();
      return;
    }
  };

  this._entityUpdatedHandler = (e) => {
    const entity = e?.detail?.entity;
    if (entity !== 'auftrag' && entity !== 'auftrag_details' && entity !== 'auftragsdetails') return;

    const isInlineBillingUpdate =
      entity === 'auftrag' &&
      e.detail.action === 'updated' &&
      (e.detail.field === 'rechnung_gestellt_am' || e.detail.field === 'ueberwiesen_am') &&
      e.detail.id;

    if (isInlineBillingUpdate) {
      this.syncInlineBillingUpdate(e.detail.id, e.detail.field, e.detail.value);
      return;
    }

    if (this.activeTab === 'contracts') {
      this.loadContractsData();
    } else {
      this.loadAuftraegeData();
    }
  };

  document.addEventListener('click', this._globalClickHandler);
  document.addEventListener('change', this._globalChangeHandler);
  this._inlineDatePickerCleanup = CustomDatePicker.bind(document);
  window.addEventListener('entityUpdated', this._entityUpdatedHandler);
};

AuftragList.prototype.hasActiveFilters = function() {
  const filters = window.filterSystem.getFilters('auftrag');
  return Object.keys(filters).length > 0;
};

AuftragList.prototype.updateSelection = function() {
  const selectedCount = this.selectedAuftraege.size;
  const selectedCountElement = document.getElementById('selected-count');
  const selectBtn = document.getElementById('btn-select-all');
  const deselectBtn = document.getElementById('btn-deselect-all');
  const deleteBtn = document.getElementById('btn-delete-selected');

  if (selectedCountElement) {
    selectedCountElement.textContent = `${selectedCount} ausgewählt`;
    selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
  }

  if (selectBtn) {
    selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
  }

  if (deselectBtn) {
    deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  if (deleteBtn) {
    deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }
};
