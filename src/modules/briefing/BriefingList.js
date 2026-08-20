// BriefingList.js (ES6-Modul)
// Liste der Campaign Briefings (campaign_briefings).
// RLS: intern voll, Kunden nur eigener Scope (kunde_unternehmen / kunde_marke).
// Keine zusaetzliche Client-Filterlogik.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { resolveEmptyState, bindEmptyStateActions } from '../../core/components/EmptyState.js';
import { BEREICH_LABELS } from './create/fieldConfig.js';

export class BriefingList {
  constructor() {
    this.selectedBriefings = new Set();
    this._boundEventListeners = new Set();
    this._abortController = null;
  }

  async init(id) {
    if (id && id !== 'new' && window.moduleRegistry) {
      return window.navigateTo(`/briefing/${id}`);
    }

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
      await this.render();
      await this.initializeFilterBar();

      const currentFilters = filterSystem.getFilters('briefing');
      const briefings = await this.loadBriefings(currentFilters);
      await this.updateTable(briefings);
    } catch (error) {
      window.ErrorHandler.handle(error, 'BriefingList.loadAndRender');
    }
  }

  async loadBriefings(filters = {}) {
    if (!window.supabase) return [];

    let query = window.supabase
      .from('campaign_briefings')
      .select(`
        id, aktivierung_name, bereich, is_draft, ansatz,
        content_deadline, go_live, created_at, updated_at,
        unternehmen_id, marke_id, assignee_id,
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url),
        assignee:assignee_id(id, name, profile_image_url)
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
    apply('assignee_id', filters.assignee_id, 'uuid');
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
              <th>Zugewiesen</th>
              <th>Content Deadline</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="${canBulkDelete ? '9' : '8'}" class="loading">Lade Briefings...</td>
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

  renderAssignee(assignee) {
    if (!assignee?.name) return '-';

    return avatarBubbles.renderBubbles([{
      name: assignee.name,
      type: 'person',
      id: assignee.id,
      entityType: 'mitarbeiter',
      profile_image_url: assignee.profile_image_url
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

  async updateTable(items) {
    const tbody = document.getElementById('briefings-table-body');
    if (!tbody) return;

    const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;
    const canBulkDelete = window.canBulkDelete();
    const escapeHtml = (s) => window.validatorSystem.sanitizeHtml(s || '—');

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!items || items.length === 0) {
        const colspan = tbody.closest('table')?.querySelector('thead tr')?.children?.length || 9;
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

      tbody.innerHTML = items.map(b => `
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
          <td>${this.renderAssignee(b.assignee)}</td>
          <td>${b.content_deadline ? new Date(b.content_deadline).toLocaleDateString('de-DE') : '-'}</td>
          <td class="col-actions">
            ${actionBuilder.create('briefing', b.id)}
          </td>
        </tr>
      `).join('');
    });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
  }
}

export const briefingList = new BriefingList();
