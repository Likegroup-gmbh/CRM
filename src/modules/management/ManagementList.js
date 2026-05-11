// ManagementList.js (ES6-Modul)
// Management-Liste mit Filtersystem und Pagination
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class ManagementList extends BasePaginatedList {
  constructor() {
    super('management', {
      itemsPerPage: 25,
      headline: 'Management Übersicht',
      breadcrumbLabel: 'Management',
      sortField: 'firmenname',
      sortAscending: true,
      paginationContainerId: 'pagination-management',
      tbodySelector: '.data-table tbody',
      tableColspan: 7,
      checkboxClass: 'management-check',
      selectAllId: 'select-all-management'
    });

    this.selectedManagement = this.selectedItems;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════

  async loadPageData(page, limit, filters) {
    try {
      if (!window.supabase) {
        return { data: [], total: 0 };
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = window.supabase
        .from('management')
        .select('*', { count: 'exact' })
        .order(this.currentSort.field, { ascending: this.currentSort.ascending });

      // Suchfilter: firmenname, stadt, email
      if (filters.name) {
        const search = filters.name;
        query = query.or(`firmenname.ilike.%${search}%,stadt.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (filters.firmenname) {
        query = query.ilike('firmenname', `%${filters.firmenname}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.stadt) {
        query = query.ilike('stadt', `%${filters.stadt}%`);
      }
      if (filters.land) {
        query = query.ilike('land', `%${filters.land}%`);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0
      };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Managements:', error);
      throw error;
    }
  }

  renderSingleRow(m) {
    const canBulkDelete = this.canBulkDelete;
    const sanitize = this.sanitize.bind(this);

    const creatorCount = m._creatorCount || 0;

    return `
      <tr data-id="${m.id}">
        ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="management-check" data-id="${m.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          ${m.logo_url
            ? `<img src="${m.logo_url}" class="table-logo" width="24" height="24" alt="" />`
            : `<span class="table-avatar">${(m.firmenname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="management" data-id="${m.id}">
            ${sanitize(m.firmenname || '')}
          </a>
        </td>
        <td class="col-stadt">${sanitize(m.stadt || '-')}</td>
        <td>${sanitize(m.land || '-')}</td>
        <td class="col-webseite table-cell-center">${m.webseite ? `<a href="${this.sanitizeUrl(m.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${sanitize(m.webseite)}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>` : '-'}</td>
        <td>${sanitize(m.email || '-')}</td>
        <td class="table-cell-center">${creatorCount > 0 ? `<span class="tag tag--branche">${creatorCount}</span>` : '-'}</td>
        <td class="col-actions">
          ${actionBuilder.create('management', m.id)}
        </td>
      </tr>
    `;
  }

  renderShellContent() {
    const canBulkDelete = this.canBulkDelete;

    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('management', {
              placeholder: 'Management suchen...',
              currentValue: this.searchQuery
            })}
            <div id="sort-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${this.canEdit ? '<button id="btn-management-new" class="primary-btn">Neues Management anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table data-table--management">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-management"></th>` : ''}
              <th class="col-name">Name</th>
              <th class="col-stadt">Stadt</th>
              <th>Land</th>
              <th class="col-webseite table-cell-center">Webseite</th>
              <th>E-Mail</th>
              <th class="table-cell-center">Creator</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '8' : '7'}" class="no-data">Lade Managements...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-management"></div>
    `;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════

  async initializeFilterBar() {
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('management', sortContainer, {
        nameField: 'firmenname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
  }

  bindAdditionalEvents(signal) {
    SearchInput.bind('management', (value) => this.handleSearch(value), signal);

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-management-new') {
        e.preventDefault();
        window.navigateTo('/management/new');
      }
    }, { signal });
  }

  async updateTable(managements) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!managements || managements.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      // Creator-Counts fuer alle Managements laden
      const managementIds = managements.map(m => m.id).filter(Boolean);
      const creatorCountMap = await this.loadCreatorCountMap(managementIds);

      managements.forEach(m => {
        m._creatorCount = creatorCountMap.get(m.id) || 0;
      });

      tbody.innerHTML = managements.map(m => this.renderSingleRow(m)).join('');
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANAGEMENT-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════

  async loadCreatorCountMap(managementIds) {
    const map = new Map();
    try {
      if (!window.supabase || !Array.isArray(managementIds) || managementIds.length === 0) {
        return map;
      }

      const { data, error } = await window.supabase
        .from('creator_management')
        .select('management_id')
        .in('management_id', managementIds)
        .eq('ist_aktiv', true);

      if (error) {
        console.warn('⚠️ Konnte Creator-Counts nicht laden:', error);
        return map;
      }

      (data || []).forEach(item => {
        const id = item.management_id;
        map.set(id, (map.get(id) || 0) + 1);
      });

    } catch (e) {
      console.warn('⚠️ loadCreatorCountMap Fehler:', e);
    }
    return map;
  }

  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }
}

export const managementList = new ManagementList();
