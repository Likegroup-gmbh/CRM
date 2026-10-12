// CreatorListView.js
// Shell, Werkzeugzeile, Tabellenzeile, Filterspalte, Listen-Events und Tag-Renderer (Prototype-Mixin)

import { CreatorList, ANSICHT_KEY } from './CreatorListCore.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { creatorUtils } from './CreatorUtils.js';
import { GENERATIONEN, GROESSEN } from './creatorProfil.js';
import { icon } from '../../core/icons/IconSystem.js';
import { settleRezensionFilters } from './rezension.js';
import { columnStartsCollapsed, mountCreatorFilterColumn } from './creatorFilterColumn.js';

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

  // Groessen-Chips nutzen den bestehenden View-Umschalter, hier mehrfach waehlbar
  const groesseChips = this.usesFilterColumn() ? '' : ViewModeToggle.render(GROESSEN.map((label) => ({
    buttonId: `creator-groesse-${label}`,
    label,
    active: this.groesseFilter.includes(label)
  })));

  const generationOptions = this.usesFilterColumn() ? '' : ['<option value="">Alle Generationen</option>']
    .concat(GENERATIONEN.map((entry) => `<option value="${entry.label}"${this.generationFilter === entry.label ? ' selected' : ''}>${entry.label}</option>`))
    .join('');
  const generationSelect = generationOptions
    ? `<select id="creator-generation" class="form-input" aria-label="Generation">${generationOptions}</select>`
    : '';

  const ansichtToggle = this.usesFilterColumn() ? ViewModeToggle.render([
    { buttonId: 'creator-ansicht-grid', label: 'Kacheln', icon: 'grid', active: this.ansicht !== 'liste' },
    { buttonId: 'creator-ansicht-liste', label: 'Liste', icon: 'list', active: this.ansicht === 'liste' }
  ]) : '';

  const collapsed = this.usesFilterColumn() && columnStartsCollapsed();
  const filterSlot = this.usesFilterColumn()
    ? `<button type="button" id="creator-filter-toggle" class="mdc-btn mdc-btn--secondary" aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="creator-filter-column">
        <span class="mdc-btn__icon">${icon('adjustments-horizontal')}</span>
        <span class="mdc-btn__label">Sortieren und Filtern</span>
        <span class="filter-count-badge" id="creator-filter-count" hidden></span>
      </button>`
    : '<div id="filter-dropdown-container"></div>';

  const toolbar = `
    <div class="table-filter-wrapper creator-filter-sticky">
      <div class="filter-bar">
        <div class="filter-left">
          ${this.usesFilterColumn() ? filterSlot : ''}
          ${SearchInput.render('creator', {
            placeholder: 'Name oder Handle...',
            currentValue: this.searchQuery
          })}
          ${ansichtToggle}
          ${groesseChips}
          ${generationSelect}
          ${this.usesFilterColumn() ? '' : filterSlot}
        </div>
        <div class="filter-right">
          ${canEdit ? '<button id="btn-creator-new" class="mdc-btn"><span class="mdc-btn__label">Creator anlegen</span></button>' : ''}
        </div>
      </div>
      ${this.usesFilterColumn() ? `
        <div class="creator-toolbar-meta">
          <p class="creator-result-count" id="creator-result-count" aria-live="polite"></p>
          <div class="creator-column-chips" id="creator-column-chips"></div>
        </div>
      ` : ''}
    </div>
  `;

  const actions = `
    <div class="table-filter-wrapper">
      <div class="table-actions">
        ${this.isAdmin ? '<button id="btn-connect-all" class="mdc-btn mdc-btn--secondary">Connect</button>' : ''}
        ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
        <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
        <span id="selected-count" style="display:none;">0 ausgewählt</span>
        <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
      </div>
    </div>
  `;

  const grid = `
    <div class="creator-views view-grid" id="creator-views-${this.mode}">
      ${this.gridView.renderShell()}
    </div>
  `;

  if (!this.usesFilterColumn()) return `${toolbar}${actions}${grid}`;

  return `
    <div class="creator-browser${collapsed ? ' is-column-collapsed' : ''}">
      <div class="creator-filter-backdrop" data-action="close-creator-filters"></div>
      <aside class="creator-filter-column" id="creator-filter-column" aria-label="Sortieren und Filtern">
        <div class="creator-filter-column__head">
          <span class="creator-filter-column__title">Sortieren und Filtern</span>
          <button type="button" class="creator-filter-column__close" data-action="close-creator-filters" aria-label="Sortieren und Filtern schließen">${icon('x-mark')}</button>
        </div>
        <div id="creator-filter-column-body"></div>
      </aside>
      <div class="creator-browser__main">
        ${toolbar}
        ${actions}
        ${grid}
      </div>
    </div>
  `;
};

/**
 * Initialisiert die Filter-Bar mit Creator-spezifischen Einstellungen
 */
CreatorList.prototype.initializeFilterBar = async function() {
  if (this.usesFilterColumn()) {
    try {
      this._filterColumn = await mountCreatorFilterColumn(this);
    } catch (err) {
      console.error('Filterspalte konnte nicht geladen werden', err);
      const body = document.getElementById('creator-filter-column-body');
      if (body) body.textContent = 'Filter konnten nicht geladen werden.';
    }
    return;
  }

  // Filter-Dropdown initialisieren (Management-Creator und andere Listen)
  const filterContainer = document.getElementById('filter-dropdown-container');
  if (filterContainer) {
    await filterDropdown.init('creator', filterContainer, {
      onFilterApply: (filters) => this.onFiltersApplied(settleRezensionFilters(filters)),
      onFilterReset: () => this.onFiltersReset()
    });
  }
};

/**
 * Zusätzliche Events binden (Suche, Creator-New Button)
 */
CreatorList.prototype.bindAdditionalEvents = function(signal) {
  this._filterColumn?.bind(signal);

  // Suchfeld Events über globale Komponente
  SearchInput.bind('creator', (value) => this.handleSearch(value), signal);

  // Groesse: mehrere Chips gleichzeitig, keine Auswahl heisst alle
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[id^="creator-groesse-"]');
    if (!chip) return;
    const label = GROESSEN.find((entry) => chip.id === `creator-groesse-${entry}`);
    if (!label) return;
    e.preventDefault();
    this.groesseFilter = this.groesseFilter.includes(label)
      ? this.groesseFilter.filter((entry) => entry !== label)
      : [...this.groesseFilter, label];
    chip.classList.toggle('active');
    this.loadData();
  }, { signal });

  document.getElementById('creator-generation')?.addEventListener('change', (e) => {
    this.generationFilter = e.target.value;
    this.loadData();
  }, { signal });

  document.addEventListener('click', (e) => {
    const ansicht = e.target.closest('#creator-ansicht-grid, #creator-ansicht-liste');
    if (ansicht) {
      e.preventDefault();
      const next = ansicht.id === 'creator-ansicht-liste' ? 'liste' : 'grid';
      if (next === this.ansicht) return;
      this.ansicht = next;
      try { localStorage.setItem(ANSICHT_KEY, next); } catch { /* privat */ }
      document.getElementById('creator-ansicht-grid')?.classList.toggle('active', next !== 'liste');
      document.getElementById('creator-ansicht-liste')?.classList.toggle('active', next === 'liste');
      this.gridView.setAnsicht(next);
    }
  }, { signal });

  // Grid-spezifische Events (Bio-Toggle, Connect-CTA, Retry)
  this.gridView.bindEvents(signal);
  
  // Neuen Creator anlegen Button
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-creator-new')) {
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
