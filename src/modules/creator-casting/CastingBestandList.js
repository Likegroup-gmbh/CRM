// CastingBestandList.js (ES6-Modul)
// Creator Casting (ADR 0044): paginierte Tabelle der Creator, die schon auf
// Castings standen. Eine Zeile pro Creator; Zaehler und "Zuletzt" kommen ueber
// die ganze Historie aus der RPC get_casting_bestand.

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderSortHeaderCell, bindSortableHeaders, syncSortHeaders } from '../../core/list/sortableHeader.js';
import { creatorUtils } from '../creator/CreatorUtils.js';
import {
  buildCastingBestandFilters,
  castingBestandSort,
  defaultSortAscending
} from './castingBestandFilters.js';

export const CASTING_BESTAND_ENTITY = 'creator-casting';

const COLSPAN = 12;

// Spaltenköpfe: sortierbare Spalten tragen das RPC-Sortierfeld in `field`
const COLUMNS = [
  { label: 'Name', field: 'name', className: 'col-name' },
  { label: 'Branche' },
  { label: 'Typen' },
  { label: 'Instagram' },
  { label: 'TikTok' },
  { label: 'Stadt' },
  { label: 'Castings', field: 'castings', className: 'table-cell-center' },
  { label: 'Prio 1', field: 'prio_1', className: 'table-cell-center' },
  { label: 'Prio 2', field: 'prio_2', className: 'table-cell-center' },
  { label: 'Abgelehnt', field: 'abgelehnt', className: 'table-cell-center' },
  { label: 'Produktion', field: 'produktionen', className: 'table-cell-center' },
  { label: 'Zuletzt', field: 'zuletzt' }
];

export class CastingBestandList extends BasePaginatedList {
  constructor() {
    super(CASTING_BESTAND_ENTITY, {
      itemsPerPage: 25,
      headline: 'Creator Casting',
      breadcrumbLabel: 'Creator Casting',
      permissionEntity: 'creator',
      sortField: 'zuletzt',
      sortAscending: false,
      paginationContainerId: 'pagination-creator-casting',
      tbodySelector: '.data-table tbody',
      tableColspan: COLSPAN
    });
  }

  getEmptyState() {
    return {
      icon: 'sourcing',
      title: 'Noch kein Creator auf einem Casting',
      text: 'Sobald ein Casting-Eintrag mit Creator-Stammdaten existiert, erscheint der Creator hier.'
    };
  }

  resolveDetailRoute(itemId) {
    return `/creator/${itemId}`;
  }

  /**
   * Lädt eine Seite über get_casting_bestand. Zähler sind pro Creator über die
   * ganze Historie gerechnet, die Filter entscheiden nur, wer in der Liste steht.
   */
  async loadPageData(page, limit, filters) {
    if (!window.supabase) return { data: [], total: 0 };

    const { p_sort, p_ascending } = castingBestandSort(this.currentSort);
    const { data, error } = await window.supabase.rpc('get_casting_bestand', {
      p_page: page,
      p_limit: limit,
      p_sort,
      p_ascending,
      p_filters: buildCastingBestandFilters(filters, this.searchQuery)
    });

    if (error) {
      console.error('❌ Fehler beim RPC get_casting_bestand:', error);
      throw error;
    }

    return {
      data: data?.rows || [],
      total: Number(data?.total_count) || 0
    };
  }

  renderSingleRow(creator) {
    const sanitize = this.sanitize.bind(this);
    const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || '-';
    const avatarSource = creator.profilbild_thumb_url || creator.profilbild_url;
    const safeAvatarUrl = avatarSource ? window.validatorSystem?.sanitizeUrl(avatarSource) : null;
    const avatarHtml = safeAvatarUrl
      ? `<img src="${safeAvatarUrl}" alt="${sanitize(name)}" class="table-avatar table-avatar-img" loading="lazy" />`
      : `<span class="table-avatar">${sanitize((creator.vorname || name || '?')[0].toUpperCase())}</span>`;

    return `
      <tr data-id="${sanitize(creator.id)}">
        <td class="col-name col-name-with-icon">
          ${avatarHtml}
          <a href="#" class="table-link" data-table="${CASTING_BESTAND_ENTITY}" data-id="${sanitize(creator.id)}">${sanitize(name)}</a>
        </td>
        <td data-col="branchen">${this.renderTags(creator.branchen, 'tag--branche')}</td>
        <td>${this.renderTags(creator.creator_types, 'tag--type')}</td>
        <td>${creatorUtils.formatFollowerRange(creator.instagram_follower)}</td>
        <td>${creatorUtils.formatFollowerRange(creator.tiktok_follower)}</td>
        <td>${creator.lieferadresse_stadt ? sanitize(creator.lieferadresse_stadt) : '-'}</td>
        <td class="table-cell-center" data-col="castings">${this.formatNumber(creator.castings || 0)}</td>
        <td class="table-cell-center" data-col="prio_1">${this.formatNumber(creator.prio_1 || 0)}</td>
        <td class="table-cell-center" data-col="prio_2">${this.formatNumber(creator.prio_2 || 0)}</td>
        <td class="table-cell-center" data-col="abgelehnt">${this.formatNumber(creator.abgelehnt || 0)}</td>
        <td class="table-cell-center" data-col="produktionen">${this.formatNumber(creator.produktionen || 0)}</td>
        <td data-col="zuletzt">${this.formatDatum(creator.zuletzt)}</td>
      </tr>
    `;
  }

  renderTags(values, tagClass) {
    if (!Array.isArray(values) || values.length === 0) return '-';
    const tags = values
      .map(value => `<span class="tag ${tagClass}">${this.sanitize(String(value).trim())}</span>`)
      .join('');
    return `<div class="tags tags-compact">${tags}</div>`;
  }

  formatDatum(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  renderShellContent() {
    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render(CASTING_BESTAND_ENTITY, {
              placeholder: 'Creator suchen...',
              currentValue: this.searchQuery
            })}
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${COLUMNS.map(col => renderSortHeaderCell(col, this.currentSort)).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${COLSPAN}" class="no-data">Lade Creator Casting...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-creator-casting"></div>
    `;
  }

  bindAdditionalEvents(signal) {
    SearchInput.bind(CASTING_BESTAND_ENTITY, (value) => this.handleSearch(value), signal);

    const thead = document.querySelector('.data-table thead');
    bindSortableHeaders(thead, {
      signal,
      getSort: () => this.currentSort,
      defaultAscending: defaultSortAscending,
      onChange: (sort) => {
        this.onSortChange(sort);
        syncSortHeaders(thead, sort);
      }
    });
  }

  // Es gibt keine Filter-Chips; nur die Suche kann die Liste einschränken.
  hasActiveFilters() {
    return (this.searchQuery || '').trim().length > 0;
  }

  onFiltersReset() {
    this.searchQuery = '';
    const input = document.getElementById(`${CASTING_BESTAND_ENTITY}-search-input`);
    if (input) input.value = '';
    const clearBtn = document.getElementById(`${CASTING_BESTAND_ENTITY}-search-clear`);
    if (clearBtn) clearBtn.style.display = 'none';
    this.pagination.currentPage = 1;
    this.loadDataDebounced(50);
  }
}

export const castingBestandList = new CastingBestandList();
