import { VertragUtils } from './VertragUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';

const escapeHtml = (text) => {
  if (!text) return '';
  return window.validatorSystem?.sanitizeHtml(text) || text;
};

export function renderFoldersView(listViewMode, canEdit) {
  const viewToggleHtml = ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: listViewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: listViewMode === 'grid' }
  ]);

  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${viewToggleHtml}
          </div>
        </div>
        <div class="table-actions">
          ${canEdit ? '<button id="btn-vertrag-new" class="mdc-btn">Neuen Vertrag anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        ${listViewMode === 'grid'
          ? `<div class="folders-grid" id="folders-grid">
              <div class="loading-placeholder">Lade Unternehmens-Ordner...</div>
            </div>`
          : renderUnternehmenListTable()
        }
      </div>
    </div>
  `;
}

export function renderUnternehmenListTable() {
  return `
    <table class="data-table vertraege-unternehmen-table">
      <thead>
        <tr>
          <th>Unternehmen</th>
          <th>Verträge</th>
        </tr>
      </thead>
      <tbody id="unternehmen-list-table-body">
        <tr>
          <td colspan="2" class="no-data">Lade Unternehmen...</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function updateFoldersGrid(folders) {
  const grid = document.getElementById('folders-grid');
  if (!grid) return;

  if (!folders || folders.length === 0) {
    grid.innerHTML = `<div class="empty-state-grid-cell">${renderEmptyState({
      icon: 'folder',
      title: 'Keine Verträge vorhanden',
      text: 'Es wurden noch keine Verträge mit Unternehmen verknüpft.'
    })}</div>`;
    return;
  }

  grid.innerHTML = folders.map(folder => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
      <div class="folder-icon">
        ${folder.logo_url
          ? `<img src="${escapeHtml(folder.logo_url)}" alt="${escapeHtml(folder.firmenname)}" class="folder-logo">`
          : `${icon('folder-open')}`
        }
      </div>
      <div class="folder-info">
        <span class="folder-name">${escapeHtml(folder.firmenname)}</span>
        <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Vertrag' : 'Verträge'}</span>
      </div>
    </div>
  `).join('');
  fillFoldersGrid(grid);
}

export function updateUnternehmenListTableBody(folders) {
  const tbody = document.getElementById('unternehmen-list-table-body');
  if (!tbody) return;

  if (!folders || folders.length === 0) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'folder',
      title: 'Keine Verträge vorhanden',
      text: 'Es wurden noch keine Verträge mit Unternehmen verknüpft.'
    }, 2);
    return;
  }

  tbody.innerHTML = folders.map(folder => `
    <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
      <td>
        <div class="flex-center-sm">
          ${folder.logo_url
            ? `<img src="${escapeHtml(folder.logo_url)}" alt="${escapeHtml(folder.firmenname)}" class="table-logo">`
            : ''
          }
          <a href="#" class="table-link unternehmen-link" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">${escapeHtml(folder.firmenname)}</a>
        </div>
      </td>
      <td>${folder.count}</td>
    </tr>
  `).join('');
}

export function renderVertraegeView({ isAdmin, canBulkDelete, canEdit }, activeTypeTab = 'vertraege') {
  const typeTabs = [
    { id: 'vertraege', label: 'Verträge' },
    { id: 'contracting', label: 'Contracting' }
  ].map(t => renderTabButton({
    tab: t.id,
    label: t.label,
    isActive: t.id === activeTypeTab,
    skipPermissionCheck: true
  })).join('');

  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-folders" class="mdc-btn mdc-btn--secondary">
              ${icon('arrow-left')}
              Zurück
            </button>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-vertrag-new" class="mdc-btn">Neuen Vertrag anlegen</button>' : ''}
        </div>
      </div>

      <div class="tab-navigation vertraege-type-tabs">${typeTabs}</div>

      <div class="table-container">
        <table class="data-table data-table--vertraege">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-vertraege"></th>` : ''}
              <th class="col-name">Name</th>
              <th class="col-kampagne">Kontext</th>
              <th class="col-status">Status</th>
              <th class="col-typ">Typ</th>
              <th class="col-creator">Creator</th>
              <th class="col-datei">Datei</th>
              <th class="col-signed">Unterschrieben</th>
              <th class="col-erstellt-am">Erstellt am</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="vertraege-table-body">
            <tr>
              <td colspan="${isAdmin ? '10' : '9'}" class="no-data">Lade Verträge...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-vertraege"></div>
    </div>
  `;
}

export function renderVertraegeTableBody(vertraege, { canBulkDelete, canEdit, isAdmin }) {
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

  return vertraege.map(vertrag => {
    const creator = vertrag.creator || {};
    const creatorName = creator.vorname
      ? `${escapeHtml(creator.vorname)} ${escapeHtml(creator.nachname || '')}`.trim()
      : '-';

    const typClass = vertrag.typ ? `typ-${vertrag.typ.toLowerCase().replace(/\s+/g, '-')}` : '';

    const dateiHtml = vertrag.datei_url
      ? `<a href="${escapeHtml(vertrag.datei_url)}" target="_blank" class="datei-link datei-icon" title="PDF anzeigen">
          ${icon('pdf')}
        </a>`
      : '<span class="text-muted">—</span>';

    const signedUrl = vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url;
    let unterschriebenHtml;
    if (signedUrl) {
      unterschriebenHtml = `<a href="${escapeHtml(signedUrl)}" target="_blank" class="contract-signed-action contract-signed-action--open" title="Unterschriebenen Vertrag anzeigen">
          ${icon('eye')}
          Anzeigen
        </a>`;
    } else if (canEdit) {
      unterschriebenHtml = `<button type="button" class="contract-signed-action contract-signed-action--upload" data-id="${vertrag.id}" title="Unterschriebenen Vertrag hochladen">
            ${icon('upload')}
            Hochladen
          </button>`;
    } else {
      unterschriebenHtml = '<span class="text-muted">—</span>';
    }

    const statusBadge = vertrag.is_draft
      ? '<span class="status-badge status-draft">Entwurf</span>'
      : '<span class="status-badge status-final">Finalisiert</span>';

    const actionsHtml = renderVertragActions(vertrag, isAdmin, canEdit, canBulkDelete);

    return `
      <tr class="table-row-clickable" data-vertrag-id="${vertrag.id}" data-vertrag-draft="${vertrag.is_draft ? '1' : '0'}">
        ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="vertraege-check" data-id="${vertrag.id}"></td>` : ''}
        <td class="col-name">
          ${VertragUtils.renderVertragNameHtml(vertrag, escapeHtml)}
        </td>
        <td class="col-kampagne">
          ${VertragUtils.renderVertragContextHtml(vertrag, escapeHtml)}
        </td>
        <td class="col-status">${statusBadge}</td>
        <td class="col-typ">
          ${vertrag.typ
            ? `<span class="status-badge ${typClass}">${escapeHtml(vertrag.typ)}</span>`
            : '-'}
        </td>
        <td class="col-creator">
          ${creator.id ? `
            <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
              ${creatorName}
            </a>
          ` : '-'}
        </td>
        <td class="col-datei">${dateiHtml}</td>
        <td class="col-signed">${unterschriebenHtml}</td>
        <td class="col-erstellt-am">${formatDate(vertrag.created_at)}</td>
        <td class="col-actions">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');
}

export function renderVertragActions(vertrag, isAdmin, canEdit, canDelete = isAdmin) {
  const isDraft = vertrag.is_draft;

  let actions = '';

  const signedIcon = `${icon('link')}`;

  const hasSignedUrl = !!(vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url);
  const signedActions = hasSignedUrl
    ? `<a href="#" class="action-item" data-action="replace-signed" data-id="${vertrag.id}">
        ${signedIcon}
        Unterschriebenen Vertrag ersetzen
      </a>
      <a href="#" class="action-item action-danger" data-action="remove-signed" data-id="${vertrag.id}">
        ${signedIcon}
        Unterschriebenen Vertrag entfernen
      </a>`
    : `<a href="#" class="action-item" data-action="add-signed" data-id="${vertrag.id}">
        ${signedIcon}
        Unterschriebenen Vertrag hochladen
      </a>`;

  if (isDraft) {
    actions = `
      ${canEdit ? `
      <a href="#" class="action-item" data-action="continue" data-id="${vertrag.id}">
        ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
        Weiter bearbeiten
      </a>` : ''}
      <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
        ${window.ActionsDropdown?.getHeroIcon('view') || ''}
        Details anzeigen
      </a>
      ${signedActions}
    `;
  } else {
    actions = `
      <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
        ${window.ActionsDropdown?.getHeroIcon('view') || ''}
        Details anzeigen
      </a>
      ${canEdit ? `
      <a href="#" class="action-item" data-action="edit" data-id="${vertrag.id}">
        ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
        Bearbeiten
      </a>` : ''}
      ${vertrag.datei_url ? `
        <a href="#" class="action-item" data-action="download" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('download') || ''}
          PDF herunterladen
        </a>
      ` : ''}
      ${signedActions}
    `;
  }

  if (canDelete) {
    actions += `
      <div class="action-separator"></div>
      <a href="#" class="action-item action-danger" data-action="delete" data-id="${vertrag.id}">
        ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
        Löschen
      </a>
    `;
  }

  return `
    <div class="actions-dropdown-container" data-entity-type="vertraege">
      <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
        ${icon('dots-vertical-filled')}
      </button>
      <div class="actions-dropdown">
        ${actions}
      </div>
    </div>
  `;
}
