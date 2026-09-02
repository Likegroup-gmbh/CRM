// BriefingList.js (ES6-Modul)
// Grid: Unternehmen → Marken → Briefings. Liste: bisherige flache Tabelle.
// RLS: intern voll, Kunden nur eigener Scope (kunde_unternehmen / kunde_marke).

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { resolveEmptyState, bindEmptyStateActions } from '../../core/components/EmptyState.js';
import { BEREICH_LABELS } from './create/fieldConfig.js';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  OHNE_MARKE_LABEL,
  OHNE_QUERY
} from './BriefingFolders.js';
import {
  renderCompaniesView, updateCompaniesGrid,
  renderBrandsView, updateBrandsGrid,
  renderItemsView, updateItemsTable as _updateItemsTable
} from './BriefingFolderRenderer.js';

export class BriefingList {
  constructor() {
    this.selectedBriefings = new Set();
    this._boundEventListeners = new Set();
    this._abortController = null;
    this.briefings = [];
    this._forceReload = true;

    this.viewMode = 'companies';
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;

    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }

  applyQueryParams(params) {
    const qUnternehmenId = params.get('unternehmen');
    const qUnternehmenName = params.get('unternehmen_name');
    const qMarke = params.get('marke');
    const qMarkeName = params.get('marke_name');

    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.viewMode = 'companies';

    if (!qUnternehmenId) return;

    this.currentUnternehmenId = qUnternehmenId;
    this.currentUnternehmenName = decodeURIComponent(qUnternehmenName || 'Unternehmen');

    if (qMarke === OHNE_QUERY) {
      this.viewMode = 'items';
      this._ohneMarke = true;
      this.currentMarkeName = decodeURIComponent(qMarkeName || OHNE_MARKE_LABEL);
      return;
    }

    if (qMarke) {
      this.viewMode = 'items';
      this.currentMarkeId = qMarke;
      this.currentMarkeName = decodeURIComponent(qMarkeName || 'Marke');
      return;
    }

    this.viewMode = 'brands';
  }

  listUrl(viewMode = this.viewMode) {
    if (viewMode === 'companies' || !this.currentUnternehmenId) return '/briefing';

    const params = new URLSearchParams();
    params.set('unternehmen', this.currentUnternehmenId);
    params.set('unternehmen_name', this.currentUnternehmenName || '');

    if (viewMode === 'brands') return `/briefing?${params}`;

    if (this._ohneMarke) {
      params.set('marke', OHNE_QUERY);
      params.set('marke_name', this.currentMarkeName || OHNE_MARKE_LABEL);
    } else if (this.currentMarkeId) {
      params.set('marke', this.currentMarkeId);
      params.set('marke_name', this.currentMarkeName || '');
    }
    return `/briefing?${params}`;
  }

  syncListUrl() {
    const url = this.listViewMode === 'list' ? '/briefing' : this.listUrl();
    window.history.replaceState({ route: url }, '', url);
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.listViewMode === 'list' || this.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Briefings', url: '/briefing', clickable: false }
      ]);
      return;
    }

    const crumbs = [
      { label: 'Briefings', url: '/briefing', clickable: true }
    ];

    if (this.viewMode === 'brands') {
      crumbs.push({ label: this.currentUnternehmenName || 'Unternehmen', url: '#', clickable: false });
      window.breadcrumbSystem.updateBreadcrumb(crumbs);
      return;
    }

    crumbs.push({
      label: this.currentUnternehmenName || 'Unternehmen',
      url: this.listUrl('brands'),
      clickable: true
    });
    crumbs.push({
      label: this.currentMarkeName || OHNE_MARKE_LABEL,
      url: '#',
      clickable: false
    });
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  async init(id) {
    if (id && id !== 'new' && window.moduleRegistry) {
      return window.navigateTo(`/briefing/${id}`);
    }

    this.applyQueryParams(new URLSearchParams(window.location.search));
    this._forceReload = true;

    window.setHeadline('Briefings Übersicht');

    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }

    const canView = (window.canViewPage && window.canViewPage('briefing')) || await window.checkUserPermission('briefing', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;
      return;
    }

    window.bulkActionSystem?.registerList('briefing', this);

    this.bindEvents();
    await this.loadAndRender();
  }

  async loadAndRender() {
    try {
      if (this.listViewMode === 'list') {
        this.viewMode = 'companies';
        await this.render();
        await this.initializeFilterBar();
        const currentFilters = filterSystem.getFilters('briefing');
        const briefings = await this.loadBriefings(currentFilters);
        this.briefings = briefings;
        await this.updateTable(briefings);
        this.updateBreadcrumbDisplay();
        this.syncListUrl();
        return;
      }

      if (this.briefings.length === 0 || this._forceReload) {
        this.briefings = await this.loadBriefings({});
        this._forceReload = false;
      }

      this.buildCurrentFolders();
      this.renderFolderView();

      if (this.viewMode === 'items') {
        this.updateItemsTable();
      }
    } catch (error) {
      window.ErrorHandler.handle(error, 'BriefingList.loadAndRender');
    }
  }

  buildCurrentFolders() {
    if (this.viewMode === 'companies') {
      this.companyFolders = buildCompanyFolders(this.briefings);
      return;
    }
    if (this.viewMode === 'brands') {
      this.brandFolders = buildBrandFolders(this.briefings, this.currentUnternehmenId);
      return;
    }
    this.currentItems = buildCurrentItems(this.briefings, {
      unternehmenId: this.currentUnternehmenId,
      markeId: this.currentMarkeId,
      ohneMarke: this._ohneMarke
    });
  }

  renderFolderView() {
    this.updateBreadcrumbDisplay();
    this.syncListUrl();

    let html = '';
    if (this.viewMode === 'companies') html = renderCompaniesView(this);
    else if (this.viewMode === 'brands') html = renderBrandsView(this);
    else html = renderItemsView(this);

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') updateCompaniesGrid(this);
    else if (this.viewMode === 'brands') updateBrandsGrid(this);
  }

  updateItemsTable() { _updateItemsTable(this); }

  switchToCompaniesView() {
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToBrandsView(unternehmenId, unternehmenName) {
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToItemsView(markeId, markeName, { ohneMarke = false } = {}) {
    this.viewMode = 'items';
    this.currentMarkeId = ohneMarke ? null : markeId;
    this.currentMarkeName = markeName;
    this._ohneMarke = ohneMarke;
    this.loadAndRender();
  }

  setListViewMode(mode) {
    if (this.listViewMode === mode && (mode === 'list' || this.viewMode === 'companies')) return;
    this.listViewMode = mode;
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  async loadBriefings(filters = {}) {
    if (!window.supabase) return [];

    let query = window.supabase
      .from('campaign_briefings')
      .select(`
        id, aktivierung_name, bereich, is_draft, ansatz,
        content_deadline, go_live, created_at, updated_at,
        unternehmen_id, marke_id,
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url)
      `)
      .order('created_at', { ascending: false });

    const apply = (field, val, type = 'string') => {
      if (val == null || val === '' || val === '[object Object]') return;
      const v = String(val);
      switch (type) {
        case 'uuid':
          query = query.eq(field, v);
          break;
        case 'bool':
          query = query.eq(field, v === 'true');
          break;
        case 'dateRange':
          if (val.from) query = query.gte(field, val.from);
          if (val.to) query = query.lte(field, val.to);
          break;
        case 'stringIlike':
          query = query.ilike(field, `%${v}%`);
          break;
        default:
          query = query.eq(field, v);
      }
    };

    apply('unternehmen_id', filters.unternehmen_id, 'uuid');
    apply('marke_id', filters.marke_id, 'uuid');
    apply('bereich', filters.bereich);
    apply('is_draft', filters.is_draft, 'bool');
    if (filters.aktivierung_name) apply('aktivierung_name', filters.aktivierung_name, 'stringIlike');
    if (filters.content_deadline) apply('content_deadline', filters.content_deadline, 'dateRange');

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async render() {
    const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;
    const canBulkDelete = window.canBulkDelete();

    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${ViewModeToggle.render([
              { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
              { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
            ])}
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-briefing-new" class="mdc-btn">Neues Briefing anlegen</button>' : ''}
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-briefings"></th>` : ''}
              <th class="col-name">Aktivierung</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Bereich</th>
              <th>Status</th>
              <th>Content Deadline</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="${canBulkDelete ? '8' : '7'}" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('briefing', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('briefing', filters);
    this.loadAndRender();
  }

  onFiltersReset() {
    filterSystem.resetFilters('briefing');
    this.loadAndRender();
  }

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const listBtn = e.target.closest('#btn-view-list');
      if (listBtn) {
        e.preventDefault();
        this.setListViewMode('list');
        return;
      }

      const gridBtn = e.target.closest('#btn-view-grid');
      if (gridBtn) {
        e.preventDefault();
        this.setListViewMode('grid');
        return;
      }

      const backCompanies = e.target.closest('#btn-back-to-companies');
      if (backCompanies) {
        e.preventDefault();
        this.switchToCompaniesView();
        return;
      }

      const backBrands = e.target.closest('#btn-back-to-brands');
      if (backBrands) {
        e.preventDefault();
        this.switchToBrandsView(this.currentUnternehmenId, this.currentUnternehmenName);
        return;
      }

      const companyCard = e.target.closest('#companies-grid .folder-card');
      if (companyCard) {
        this.switchToBrandsView(companyCard.dataset.unternehmenId, companyCard.dataset.unternehmenName);
        return;
      }

      const brandCard = e.target.closest('#brands-grid .folder-card');
      if (brandCard) {
        if (brandCard.dataset.ohneMarke === '1') {
          this.switchToItemsView(null, brandCard.dataset.markeName, { ohneMarke: true });
        } else {
          this.switchToItemsView(brandCard.dataset.markeId, brandCard.dataset.markeName);
        }
        return;
      }

      if (e.target.id === 'btn-briefing-new' || e.target.closest('#btn-briefing-new')) {
        e.preventDefault();
        window.navigateTo('/briefing/new');
      }
    }, { signal });

    bindEmptyStateActions(document, {
      'reset-filters': () => this.onFiltersReset()
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.briefing-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedBriefings.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-briefings');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        document.querySelectorAll('.briefing-check').forEach(cb => { cb.checked = false; });
        this.selectedBriefings.clear();
        const selectAllHeader = document.getElementById('select-all-briefings');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'briefing') {
        e.preventDefault();
        const id = e.target.dataset.id;
        window.navigateTo(`/briefing/${id}`);
      }
    }, { signal });

    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing') {
        this._forceReload = true;
        this.loadAndRender();
      }
    }, { signal });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-briefings') {
        const checkboxes = document.querySelectorAll('.briefing-check');
        const isChecked = e.target.checked;
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) this.selectedBriefings.add(cb.dataset.id);
          else this.selectedBriefings.delete(cb.dataset.id);
        });
        this.updateSelection();
      }
    }, { signal });

    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('briefing-check')) {
        if (e.target.checked) this.selectedBriefings.add(e.target.dataset.id);
        else this.selectedBriefings.delete(e.target.dataset.id);
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    }, { signal });
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('briefing');
    return Object.keys(filters).length > 0;
  }

  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedBriefings.size;
    if (selectedCount === 0) {
      alert('Keine Briefings ausgewählt.');
      return;
    }

    const message = selectedCount === 1
      ? 'Möchten Sie das ausgewählte Briefing wirklich löschen?'
      : `Möchten Sie die ${selectedCount} ausgewählten Briefings wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedBriefings();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedBriefings();
    }
  }

  async deleteSelectedBriefings() {
    if (!window.canBulkDelete()) return;

    const selectedIds = Array.from(this.selectedBriefings);

    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      const { error } = await window.supabase
        .from('campaign_briefings')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      selectedIds.forEach(id => {
        document.querySelector(`tr[data-id="${id}"]`)?.remove();
      });

      window.toastSystem?.show(`${selectedIds.length} Briefing(s) gelöscht.`, 'success');

      this.selectedBriefings.clear();
      this.updateSelection();
      this.updateSelectAllCheckbox();

      const tbody = document.getElementById('briefings-table-body');
      if (tbody && tbody.children.length === 0) {
        this._forceReload = true;
        await this.loadAndRender();
      }

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'briefing', action: 'bulk-deleted', count: selectedIds.length }
      }));
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler beim Löschen: ${error.message}`, 'error');
      this._forceReload = true;
      await this.loadAndRender();
    }
  }

  updateSelection() {
    const selectedCount = this.selectedBriefings.size;
    const selectedCountEl = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');

    if (selectedCountEl) {
      selectedCountEl.textContent = `${selectedCount} ausgewählt`;
      selectedCountEl.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    if (selectBtn) selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    if (deselectBtn) deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-briefings');
    const checkboxes = document.querySelectorAll('.briefing-check');

    if (!selectAllCheckbox || checkboxes.length === 0) return;

    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;

    selectAllCheckbox.checked = checkedCount === totalCount;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  }

  renderUnternehmen(briefing) {
    const unternehmen = briefing.unternehmen;
    if (!unternehmen?.firmenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }]);
  }

  renderMarke(briefing) {
    const marke = briefing.marke;
    if (!marke?.markenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }]);
  }

  renderBereich(bereich) {
    const label = BEREICH_LABELS[bereich] || bereich || '-';
    return `<span class="tag tag--type">${window.validatorSystem.sanitizeHtml(label)}</span>`;
  }

  renderStatus(isDraft) {
    return isDraft
      ? '<span class="tag tag--status tag--warning">Entwurf</span>'
      : '<span class="tag tag--status tag--success">Final</span>';
  }

  renderBriefingRow(b, options = {}) {
    const canBulkDelete = options.checkbox !== false && window.canBulkDelete();
    const escapeHtml = (s) => window.validatorSystem.sanitizeHtml(s || '—');

    return `
      <tr data-id="${b.id}">
        ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="briefing-check" data-id="${b.id}"></td>` : ''}
        <td class="col-name">
          <a href="#" class="table-link" data-table="briefing" data-id="${b.id}">
            ${escapeHtml((b.aktivierung_name || 'Ohne Namen').toString().slice(0, 80))}
          </a>
        </td>
        <td>${this.renderUnternehmen(b)}</td>
        <td>${this.renderMarke(b)}</td>
        <td>${this.renderBereich(b.bereich)}</td>
        <td>${this.renderStatus(b.is_draft)}</td>
        <td>${b.content_deadline ? new Date(b.content_deadline).toLocaleDateString('de-DE') : '-'}</td>
        <td class="col-actions">
          ${actionBuilder.create('briefing', b.id)}
        </td>
      </tr>
    `;
  }

  async updateTable(items) {
    const tbody = document.getElementById('briefings-table-body');
    if (!tbody) return;

    const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!items || items.length === 0) {
        const colspan = tbody.closest('table')?.querySelector('thead tr')?.children?.length || 8;
        const html = resolveEmptyState({
          hasActiveFilters: this.hasActiveFilters(),
          states: {
            default: {
              icon: 'document',
              title: 'Keine Briefings vorhanden',
              text: canEdit
                ? 'Legen Sie ein Briefing an, um es hier zu verwalten.'
                : 'Es sind noch keine Briefings vorhanden.',
              actionsHtml: canEdit
                ? '<button id="btn-briefing-new" class="mdc-btn">Neues Briefing anlegen</button>'
                : ''
            }
          }
        }, 'default');
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map(b => this.renderBriefingRow(b)).join('');
    });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    this.briefings = [];
    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this._forceReload = true;
  }
}

export const briefingList = new BriefingList();
