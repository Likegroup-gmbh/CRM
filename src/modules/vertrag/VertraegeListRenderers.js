import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

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
          ${canEdit ? '<button id="btn-vertrag-new" class="primary-btn">Neuen Vertrag anlegen</button>' : ''}
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
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--space-xxl);">
        <div class="empty-icon">📁</div>
        <h3>Keine Verträge vorhanden</h3>
        <p>Es wurden noch keine Verträge mit Unternehmen verknüpft.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = folders.map(folder => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
      <div class="folder-icon">
        ${folder.logo_url
          ? `<img src="${escapeHtml(folder.logo_url)}" alt="${escapeHtml(folder.firmenname)}" class="folder-logo">`
          : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>`
        }
      </div>
      <div class="folder-info">
        <span class="folder-name">${escapeHtml(folder.firmenname)}</span>
        <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Vertrag' : 'Verträge'}</span>
      </div>
    </div>
  `).join('');
}

export function updateUnternehmenListTableBody(folders) {
  const tbody = document.getElementById('unternehmen-list-table-body');
  if (!tbody) return;

  if (!folders || folders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="no-data">
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <h3>Keine Verträge vorhanden</h3>
            <p>Es wurden noch keine Verträge mit Unternehmen verknüpft.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = folders.map(folder => `
    <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
      <td>
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
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

export function renderVertraegeView({ isAdmin, canBulkDelete, canEdit }) {
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-folders" class="secondary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-vertrag-new" class="primary-btn">Neuen Vertrag anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-vertraege"></th>` : ''}
              <th class="col-name">Name</th>
              <th>Status</th>
              <th>Typ</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Datei</th>
              <th>Unterschrieben</th>
              <th>Erstellt am</th>
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
    const kampagne = vertrag.kampagne || {};

    const creatorName = creator.vorname
      ? `${escapeHtml(creator.vorname)} ${escapeHtml(creator.nachname || '')}`.trim()
      : '-';

    const typClass = vertrag.typ ? `typ-${vertrag.typ.toLowerCase().replace(/\s+/g, '-')}` : '';

    const dateiHtml = vertrag.datei_url
      ? `<a href="${escapeHtml(vertrag.datei_url)}" target="_blank" class="datei-link datei-icon" title="PDF anzeigen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>`
      : '<span class="text-muted">—</span>';

    const signedUrl = vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url;
    let unterschriebenHtml;
    if (signedUrl) {
      unterschriebenHtml = `<a href="${escapeHtml(signedUrl)}" target="_blank" class="contract-signed-action contract-signed-action--open" title="Unterschriebenen Vertrag öffnen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          Öffnen
        </a>`;
    } else if (canEdit) {
      unterschriebenHtml = `<button type="button" class="contract-signed-action contract-signed-action--upload" data-id="${vertrag.id}" title="Unterschriebenen Vertrag hochladen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
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
          <a href="#" class="table-link" data-table="vertrag" data-id="${vertrag.id}">
            ${escapeHtml(vertrag.name) || '—'}
          </a>
        </td>
        <td>${statusBadge}</td>
        <td>
          ${vertrag.typ
            ? `<span class="status-badge ${typClass}">${escapeHtml(vertrag.typ)}</span>`
            : '-'}
        </td>
        <td>
          ${kampagne.id ? `
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${escapeHtml(KampagneUtils.getDisplayName(kampagne))}
            </a>
          ` : '-'}
        </td>
        <td>
          ${creator.id ? `
            <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
              ${creatorName}
            </a>
          ` : '-'}
        </td>
        <td>${dateiHtml}</td>
        <td class="col-signed">${unterschriebenHtml}</td>
        <td>${formatDate(vertrag.created_at)}</td>
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

  const signedIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
  </svg>`;

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
      <div class="actions-dropdown">
        ${actions}
      </div>
    </div>
  `;
}
