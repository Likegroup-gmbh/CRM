// CreatorListView.js
// Shell, Tabellenzeile, Filter-Bar, Listen-Events und Tag-Renderer (Prototype-Mixin)

import { CreatorList } from './CreatorListCore.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { creatorUtils } from './CreatorUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

/**
 * Rendert eine einzelne Creator-Zeile
 */
CreatorList.prototype.renderSingleRow = function(creator) {
  const canBulkDelete = this.canBulkDelete;
  const sanitize = this.sanitize.bind(this);

  const externalLinkIcon = `${icon('external-link')}`;

  const formatLink = (url) => {
    if (!url) return '-';
    const safeUrl = window.validatorSystem?.sanitizeUrl(url);
    if (!safeUrl) return '-';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="table-link-external" title="${sanitize(url)}">${externalLinkIcon}</a>`;
  };

  // Instagram-Connect: ohne Link ausgegraut, nach Connect als Refresh
  const actionOptions = {};
  if (!creator.instagram) actionOptions.disabledActions = ['connect'];
  if (creator.ig_connected_at) actionOptions.igConnected = true;

  // Kleiner Tabellen-Avatar: 128px-Thumb reicht, Fallback fuer Altbestand
  const avatarSource = creator.profilbild_thumb_url || creator.profilbild_url;
  const safeAvatarUrl = avatarSource ? window.validatorSystem?.sanitizeUrl(avatarSource) : null;
  const avatarHtml = safeAvatarUrl
    ? `<img src="${safeAvatarUrl}" alt="${sanitize(`${creator.vorname || ''} ${creator.nachname || ''}`.trim())}" class="table-avatar table-avatar-img" loading="lazy" />`
    : `<span class="table-avatar">${(creator.vorname || '?')[0].toUpperCase()}</span>`;

  return `
    <tr data-id="${creator.id}">
      ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="creator-check" data-id="${creator.id}"></td>` : ''}
      <td class="col-name col-name-with-icon">
        ${avatarHtml}
        <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
          ${sanitize(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || '-')}
        </a>
      </td>
      <td>${this.renderLocationTag(creator.lieferadresse_stadt, 'stadt')}</td>
      <td>${this.renderLocationTag(creator.lieferadresse_land, 'land')}</td>
      <td>${creator.mail ? `<a href="mailto:${sanitize(creator.mail)}">${sanitize(creator.mail)}</a>` : '-'}</td>
      <td>${sanitize(creator.telefonnummer || '-')}</td>
      <td>${this.formatAgeRange(creator.alter_min, creator.alter_max, creator.alter_jahre)}</td>
      <td>${this.renderCreatorTypeTags(creator.creator_types)}</td>
      <td>${this.renderBrancheTags(creator.branchen)}</td>
      <td class="table-cell-center">${formatLink(creator.instagram)}</td>
      <td>${creatorUtils.formatFollowerRange(creator.instagram_follower)}</td>
      <td class="table-cell-center">${formatLink(creator.tiktok)}</td>
      <td>${creatorUtils.formatFollowerRange(creator.tiktok_follower)}</td>
      <td class="col-actions">
        ${actionBuilder.create('creator', creator.id, null, actionOptions)}
      </td>
    </tr>
  `;
};

/**
 * Rendert den Shell-Content (Struktur ohne Daten)
 */
CreatorList.prototype.renderShellContent = function() {
  const canEdit = this.canEdit;
  const canBulkDelete = this.canBulkDelete;

  const viewToggleHtml = ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.viewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.viewMode === 'grid' }
  ]);

  const filterHtml = `<div class="filter-bar">
    <div class="filter-left">
      ${SearchInput.render('creator', {
        placeholder: 'Creator suchen...',
        currentValue: this.searchQuery
      })}
      <div id="sort-dropdown-container"></div>
      <div id="filter-dropdown-container"></div>
    </div>
    <div class="filter-right">
      ${viewToggleHtml}
    </div>
  </div>`;

  return `
    <div class="table-filter-wrapper">
      ${filterHtml}
      <div class="table-actions">
        ${this.isAdmin ? '<button id="btn-connect-all" class="mdc-btn mdc-btn--secondary">Connect</button>' : ''}
        ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
        <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
        <span id="selected-count" style="display:none;">0 ausgewählt</span>
        <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
        ${canEdit ? '<button id="btn-creator-new" class="mdc-btn">Neuen Creator anlegen</button>' : ''}
      </div>
    </div>

    <div class="creator-views view-${this.viewMode}" id="creator-views-${this.mode}">
      <div class="table-container creator-list-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-creators"></th>` : ''}
              <th class="col-name">Name</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Alter</th>
              <th>Typ</th>
              <th>Branche</th>
              <th class="table-cell-center">Insta-Link</th>
              <th>Insta-Follower</th>
              <th class="table-cell-center">TikTok-Link</th>
              <th>TikTok-Follower</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '14' : '13'}" class="no-data">Lade Creator...</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${this.gridView.renderShell()}

      <!-- Pagination Container (nur Listenansicht) -->
      <div class="pagination-container" id="pagination-container-creator"></div>
    </div>
  `;
};

/**
 * Initialisiert die Filter-Bar mit Creator-spezifischen Einstellungen
 */
CreatorList.prototype.initializeFilterBar = async function() {
  // Sort-Dropdown initialisieren
  const sortContainer = document.getElementById('sort-dropdown-container');
  if (sortContainer) {
    sortDropdown.init('creator', sortContainer, {
      nameField: 'nachname',
      defaultSort: 'name_asc',
      onSortChange: (sortConfig) => this.onSortChange(sortConfig)
    });
  }

  // Filter-Dropdown initialisieren
  const filterContainer = document.getElementById('filter-dropdown-container');
  if (filterContainer) {
    await filterDropdown.init('creator', filterContainer, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });
  }
};

/**
 * Zusätzliche Events binden (Suche, Creator-New Button)
 */
CreatorList.prototype.bindAdditionalEvents = function(signal) {
  // Suchfeld Events über globale Komponente
  SearchInput.bind('creator', (value) => this.handleSearch(value), signal);

  // View-Switch (Liste/Grid)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-view-list')) {
      e.preventDefault();
      this.switchView('list');
    } else if (e.target.closest('#btn-view-grid')) {
      e.preventDefault();
      this.switchView('grid');
    }
  }, { signal });

  // Grid-spezifische Events (Bio-Toggle, Connect-CTA, Retry)
  this.gridView.bindEvents(signal);

  // Neuen Creator anlegen Button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-creator-new') {
      e.preventDefault();
      window.navigateTo('/creator/new');
    }
  }, { signal });

  // Delete Selected Button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-delete-selected') {
      e.preventDefault();
      this.showDeleteSelectedConfirmation();
    }
  }, { signal });

  // Bulk Instagram Connect
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-connect-all')) {
      e.preventDefault();
      this.runBulkConnect();
    }
  }, { signal });

  this._updateConnectAllCount();
};

// Generische Tag-Render-Methode
CreatorList.prototype._renderTags = function(items, tagClass) {
  if (!items || items.length === 0) return '-';
  const arr = Array.isArray(items) ? items : [items];
  const sanitize = this.sanitize.bind(this);
  const tags = arr.map(item => {
    const label = typeof item === 'object' ? (item.name || item.label || item) : item;
    return `<span class="tag ${tagClass}">${sanitize(String(label).trim())}</span>`;
  }).join('');
  return `<div class="tags tags-compact">${tags}</div>`;
};

CreatorList.prototype.renderSprachenTags = function(sprachen) {
  return this._renderTags(sprachen, 'tag--lang');
};

CreatorList.prototype.renderBrancheTags = function(branchen) {
  return this._renderTags(branchen, 'tag--branche');
};

CreatorList.prototype.renderCreatorTypeTags = function(typen) {
  return this._renderTags(typen, 'tag--type');
};

CreatorList.prototype.renderLocationTag = function(value, type) {
  if (!value || (typeof value === 'string' && !value.trim())) return '-';
  const sanitized = this.sanitize(value);
  return `<span class="tag tag--${type}">${sanitized}</span>`;
};

CreatorList.prototype.formatAgeRange = function(min, max, legacy) {
  // Fallback auf altes alter_jahre Feld
  if (!min && !max && legacy) {
    return `${legacy}`;
  }
  if (!min && !max) return '-';
  if (min && max && min !== max) {
    return `${min}-${max}`;
  }
  return `${min || max}`;
};
