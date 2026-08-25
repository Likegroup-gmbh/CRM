// BriefingFolderRenderer.js
// Grid-Rendering für Briefings: Unternehmen → Marken → Items.

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { OHNE_MARKE_LABEL } from './BriefingFolders.js';

function canCreateBriefing() {
  return !window.isKunde?.() && (window.isAdmin?.() || window.currentUser?.permissions?.briefing?.can_edit);
}

export function briefingCreateButtonHtml() {
  return canCreateBriefing()
    ? '<button id="btn-briefing-new" class="mdc-btn">Neues Briefing anlegen</button>'
    : '';
}

function emptyCreateText() {
  return canCreateBriefing()
    ? 'Legen Sie ein Briefing an, um es hier zu verwalten.'
    : 'Es sind noch keine Briefings vorhanden.';
}

function viewToggleHtml(listViewMode) {
  return ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: listViewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: listViewMode === 'grid' }
  ]);
}

function backButtonHtml(id) {
  return `
    <button id="${id}" class="mdc-btn mdc-btn--secondary">
      ${icon('arrow-left')}
      Zurück
    </button>
  `;
}

function folderToolbar({ backId, listViewMode }) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${backId ? backButtonHtml(backId) : ''}
          ${viewToggleHtml(listViewMode)}
        </div>
      </div>
      <div class="table-actions">${briefingCreateButtonHtml()}</div>
    </div>
  `;
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'Briefing' : 'Briefings'}`;
}

function folderIconHtml(list, folder, name) {
  return folder.logo_url
    ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(name)}" class="folder-logo">`
    : `${icon('folder-open')}`;
}

function emptyFoldersHtml({ title, text }) {
  return `<div class="grid-span-all">${renderEmptyState({
    icon: 'document',
    title,
    text,
    actionsHtml: briefingCreateButtonHtml()
  })}</div>`;
}

function folderCard(list, folder, { name, extraAttrs = '' }) {
  return `
    <div class="folder-card" data-folder-name="${list.sanitize(name)}" ${extraAttrs}>
      <div class="folder-icon">${folderIconHtml(list, folder, name)}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `;
}

export function renderCompaniesView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ listViewMode: list.listViewMode })}
      <div class="table-container">
        <div class="folders-grid" id="companies-grid"></div>
      </div>
    </div>
  `;
}

export function updateCompaniesGrid(list) {
  const grid = document.getElementById('companies-grid');
  if (!grid) return;

  if (!list.companyFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Briefings vorhanden',
      text: emptyCreateText()
    });
    return;
  }

  grid.innerHTML = list.companyFolders.map((folder) => folderCard(list, folder, {
    name: folder.firmenname,
    extraAttrs: `data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}"`
  })).join('');
  fillFoldersGrid(grid);
}

export function renderBrandsView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ backId: 'btn-back-to-companies', listViewMode: list.listViewMode })}
      <div class="table-container">
        <div class="folders-grid" id="brands-grid"></div>
      </div>
    </div>
  `;
}

export function updateBrandsGrid(list) {
  const grid = document.getElementById('brands-grid');
  if (!grid) return;

  if (!list.brandFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Marken mit Briefings',
      text: 'Für dieses Unternehmen gibt es noch keine Briefings.'
    });
    return;
  }

  grid.innerHTML = list.brandFolders.map((folder) => {
    const attrs = folder.virtual
      ? `data-ohne-marke="1" data-marke-name="${list.sanitize(OHNE_MARKE_LABEL)}"`
      : `data-marke-id="${folder.id}" data-marke-name="${list.sanitize(folder.markenname)}"`;
    return folderCard(list, folder, {
      name: folder.markenname,
      extraAttrs: attrs
    });
  }).join('');
  fillFoldersGrid(grid);
}

export function renderItemsView(list) {
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${backButtonHtml('btn-back-to-brands')}
          </div>
        </div>
        <div class="table-actions">${briefingCreateButtonHtml()}</div>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Aktivierung</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Bereich</th>
              <th>Status</th>
              <th>Content Deadline</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-items-body">
            <tr><td colspan="7" class="loading">Lade Briefings...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function updateItemsTable(list) {
  const tbody = document.getElementById('briefings-items-body');
  if (!tbody) return;

  if (!list.currentItems.length) {
    const html = resolveEmptyState({
      hasActiveFilters: false,
      states: {
        default: {
          icon: 'document',
          title: 'Keine Briefings für diese Marke vorhanden',
          text: emptyCreateText(),
          actionsHtml: briefingCreateButtonHtml()
        }
      }
    }, 'default');
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell">${html}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.currentItems.map((b) => list.renderBriefingRow(b, { checkbox: false })).join('');
  window.ActionsDropdown?.init();
}
