// CastingBestandList.js (ES6-Modul)
// Creator Casting (ADR 0044, 0046): paginierte Tabelle der Personen, die schon
// auf Castings standen. Eine Zeile pro Person, auch ohne Creator-Datensatz
// (roter Punkt, kein Link); Zaehler und "Zuletzt" kommen ueber die ganze
// Historie aus der RPC get_casting_bestand. Startsortierung: meiste Produktionen
// zuerst (ADR 0048).

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderSortHeaderCell, bindSortableHeaders, syncSortHeaders } from '../../core/list/sortableHeader.js';
import { creatorUtils } from '../creator/CreatorUtils.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  buildCastingBestandFilters,
  castingBestandSort,
  defaultSortAscending
} from './castingBestandFilters.js';
import {
  CastingBestandAuswahl,
  BUTTON_ID as AUSWAHL_BUTTON_ID,
  ITEM_CHECK_CLASS,
  SELECT_ALL_CLASS
} from './CastingBestandAuswahl.js';
import { bestandKey } from '../creator-auswahl/bestandZuCasting.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';

export const CASTING_BESTAND_ENTITY = 'creator-casting';

const COLSPAN = 16;

const INSTAGRAM_ICON = icon('instagram');
const TIKTOK_ICON = icon('tiktok');

const PROFIL_BASIS = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@'
};

/**
 * Profil-URL aus Handle oder Link. creator.instagram/tiktok halten meist nur den
 * Handle ("lukasgrett", "@lukasgrett"), Zeilen ohne Creator den Link aus dem Casting.
 * @returns {string|null} sichere URL oder null
 */
export function socialProfilUrl(wert, plattform) {
  const raw = String(wert || '').trim();
  if (!raw) return null;
  let url;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else if (/^(www\.)?(instagram|tiktok)\.com\//i.test(raw)) {
    url = `https://${raw}`;
  } else {
    const handle = raw.replace(/^@/, '').trim();
    if (!handle) return null;
    url = `${PROFIL_BASIS[plattform]}${encodeURIComponent(handle)}`;
  }
  const sanitizer = window.validatorSystem?.sanitizeUrl;
  return sanitizer ? (sanitizer.call(window.validatorSystem, url) || null) : url;
}

// Spaltenköpfe: sortierbare Spalten tragen das RPC-Sortierfeld in `field`
const COLUMNS = [
  { label: 'Name', field: 'name', className: 'col-name' },
  { label: 'Branche' },
  { label: 'Typen' },
  { label: 'Alter' },
  { label: 'Insta', className: 'table-cell-center' },
  { label: 'Insta-Follower' },
  { label: 'TikTok', className: 'table-cell-center' },
  { label: 'TikTok-Follower' },
  { label: 'Stadt' },
  { label: 'Castings', field: 'castings', className: 'table-cell-center' },
  { label: 'Prio 1', field: 'prio_1', className: 'table-cell-center' },
  { label: 'Prio 2', field: 'prio_2', className: 'table-cell-center' },
  { label: 'Abgelehnt', field: 'abgelehnt', className: 'table-cell-center' },
  { label: 'Produktion', field: 'produktionen', className: 'table-cell-center' },
  { label: 'Brands', field: 'marken' },
  { label: 'Zuletzt', field: 'zuletzt' }
];

export class CastingBestandList extends BasePaginatedList {
  constructor() {
    super(CASTING_BESTAND_ENTITY, {
      itemsPerPage: 25,
      headline: 'Creator Casting',
      breadcrumbLabel: 'Creator Casting',
      permissionEntity: 'creator',
      sortField: 'produktionen',
      sortAscending: false,
      paginationContainerId: 'pagination-creator-casting',
      tbodySelector: '.data-table tbody',
      tableColspan: COLSPAN
    });

    // Auswahlmodus "Zu Casting hinzufügen" (ADR 0050)
    this.auswahl = new CastingBestandAuswahl({
      getTable: () => this.query('.data-table'),
      reload: () => this.loadDataDebounced(50)
    });
  }

  /** Spaltenzahl inklusive Checkbox-Spalte (die steht mit Recht immer im HTML, der Modus blendet sie ein). */
  getColspan() {
    return COLSPAN + (this.auswahl.canUse() ? 1 : 0);
  }

  renderHeadCells() {
    const checkbox = this.auswahl.canUse()
      ? `<th class="col-checkbox col-auswahl"><input type="checkbox" class="${SELECT_ALL_CLASS}" title="Alle auf der Seite auswählen" aria-label="Alle auf der Seite auswählen"></th>`
      : '';
    return checkbox + COLUMNS.map(col => renderSortHeaderCell(col, this.currentSort)).join('');
  }

  async updateTable(items) {
    await super.updateTable(items);
    this.auswahl.afterRender();
  }

  destroy() {
    this.auswahl.destroy();
    this._rows = [];
    super.destroy();
  }

  getEmptyState() {
    return {
      icon: 'sourcing',
      title: 'Noch kein Creator auf einem Casting',
      text: 'Sobald eine Person auf einem Casting steht, erscheint sie hier, auch ohne Creator-Datensatz.'
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

    this._rows = data?.rows || [];
    this.auswahl.remember(this._rows);

    return {
      data: this._rows,
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

    // Ohne Creator-Datensatz (id null) gibt es kein Detail: Name als Text, roter Punkt.
    const hatCreator = creator.hat_creator !== false && !!creator.id;
    const dot = hatCreator
      ? '<span class="status-dot status-dot--active sourcing-avatar__dot" title="Als Creator angelegt"></span>'
      : '<span class="status-dot status-dot--inactive sourcing-avatar__dot" title="Noch kein Creator"></span>';
    // Im Auswahlmodus ist der Namenslink per CSS klicktot, der Klick markiert die Zeile.
    const nameHtml = hatCreator
      ? `<a href="#" class="table-link" data-table="${CASTING_BESTAND_ENTITY}" data-id="${sanitize(creator.id)}">${sanitize(name)}</a>`
      : `<span class="table-text">${sanitize(name)}</span>`;

    // Die Checkbox-Spalte steht immer im HTML (mit Recht), der Modus blendet sie per CSS ein.
    const auswahlMoeglich = this.auswahl.canUse();
    const key = bestandKey(creator);
    const gewaehlt = !!(key && this.auswahl.has(key));
    const rowAttrs = [
      hatCreator ? `data-id="${sanitize(creator.id)}"` : '',
      auswahlMoeglich && key ? `data-auswahl-key="${escapeAttr(key)}"` : '',
      gewaehlt ? 'class="row-selected"' : ''
    ].filter(Boolean).join(' ');
    const checkboxCell = !auswahlMoeglich
      ? ''
      : key
        ? `<td class="col-checkbox col-auswahl"><input type="checkbox" class="${ITEM_CHECK_CLASS}" data-key="${escapeAttr(key)}" aria-label="${escapeAttr(name)} auswählen"${gewaehlt ? ' checked' : ''}></td>`
        : '<td class="col-checkbox col-auswahl"></td>';

    return `
      <tr${rowAttrs ? ` ${rowAttrs}` : ''}>
        ${checkboxCell}
        <td class="col-name col-name-with-icon">
          <span class="sourcing-avatar">${avatarHtml}${dot}</span>
          ${nameHtml}
        </td>
        <td data-col="branchen">${this.renderTags(creator.branchen, 'tag--branche')}</td>
        <td>${this.renderTags(creator.creator_types, 'tag--type')}</td>
        <td data-col="alter">${this.formatAlter(creator.alter_min, creator.alter_max, creator.alter_jahre)}</td>
        <td class="table-cell-center" data-col="instagram_link">${this.renderSocialLink(creator.instagram, 'instagram')}</td>
        <td>${creatorUtils.formatFollowerRange(creator.instagram_follower, { compact: true })}</td>
        <td class="table-cell-center" data-col="tiktok_link">${this.renderSocialLink(creator.tiktok, 'tiktok')}</td>
        <td>${creatorUtils.formatFollowerRange(creator.tiktok_follower, { compact: true })}</td>
        <td>${creator.lieferadresse_stadt ? sanitize(creator.lieferadresse_stadt) : '-'}</td>
        <td class="table-cell-center" data-col="castings">${this.formatNumber(creator.castings || 0)}</td>
        <td class="table-cell-center" data-col="prio_1">${this.formatNumber(creator.prio_1 || 0)}</td>
        <td class="table-cell-center" data-col="prio_2">${this.formatNumber(creator.prio_2 || 0)}</td>
        <td class="table-cell-center" data-col="abgelehnt">${this.formatNumber(creator.abgelehnt || 0)}</td>
        <td class="table-cell-center" data-col="produktionen">${this.formatNumber(creator.produktionen || 0)}</td>
        <td data-col="brands">${this.renderBrands(creator.marken)}</td>
        <td data-col="zuletzt">${this.formatDatum(creator.zuletzt)}</td>
      </tr>
    `;
  }

  /** Alter wie in der Creator-Liste: Spanne, einzelner Wert oder altes alter_jahre. */
  formatAlter(min, max, legacy) {
    if (!min && !max) return legacy ? `${legacy}` : '-';
    if (min && max && min !== max) return `${min}-${max}`;
    return `${min || max}`;
  }

  /** Nur das Plattform-Icon als Link, kein URL-Text. */
  renderSocialLink(wert, plattform) {
    const url = socialProfilUrl(wert, plattform);
    if (!url) return '-';
    const label = plattform === 'instagram' ? 'Instagram' : 'TikTok';
    const glyph = plattform === 'instagram' ? INSTAGRAM_ICON : TIKTOK_ICON;
    return `<a href="${this.sanitize(url)}" target="_blank" rel="noopener noreferrer" class="table-link-external" title="${label} öffnen">${glyph}</a>`;
  }

  /** Eine Bubble pro Marke, mit der der Creator schon produziert hat. */
  renderBrands(marken) {
    if (!Array.isArray(marken) || marken.length === 0) return '-';
    return avatarBubbles.renderBubbles(marken.map(marke => ({
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null,
      thumb_url: marke.logo_thumb_url || null
    })));
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
    const colspan = this.getColspan();
    this.options.tableColspan = colspan;
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
        ${this.auswahl.canUse() ? `
        <div class="table-actions">
          <button type="button" id="${AUSWAHL_BUTTON_ID}" class="mdc-btn" aria-pressed="false">Zu Casting hinzufügen</button>
        </div>` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${this.renderHeadCells()}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${colspan}" class="no-data">Lade Creator Casting...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-creator-casting"></div>
    `;
  }

  bindAdditionalEvents(signal) {
    SearchInput.bind(CASTING_BESTAND_ENTITY, (value) => this.handleSearch(value), signal);
    this.auswahl.bind({ root: this.eventRoot(), signal });

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
