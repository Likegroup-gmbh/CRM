// KampagneListRenderers.js
// Tabellen-Rendering-Funktionen für KampagneList

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { KampagneUtils } from './KampagneUtils.js';
import { SearchInput } from '../../core/components/SearchInput.js';

/**
 * Erzeugt das komplette Seiten-HTML für die Kampagnenliste (Filter, View-Toggle, Tabelle/Kanban/Kalender).
 */
export function renderPageHtml({ currentView, searchQuery }) {
  const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
  const isKunde = window.currentUser?.rolle === 'kunde';
  const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${SearchInput.render('kampagne', { 
            placeholder: 'Kampagne suchen...', 
            currentValue: searchQuery 
          })}
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${currentView === 'list' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Liste
            </button>
            ${!isKunde ? `<button id="btn-view-calendar" class="secondary-btn ${currentView === 'calendar' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Kalender
            </button>` : ''}
          </div>
          ${!isKunde ? '<div id="filter-dropdown-container"></div>' : ''}
        </div>
      </div>
      ${!isKunde ? `<div class="table-actions">
        ${currentView === 'list' && isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
        ${currentView === 'list' && isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
        ${currentView === 'list' && isAdmin ? '<span id="selected-count" style="display:none;">0 ausgewählt</span>' : ''}
        ${currentView === 'list' && isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
        ${canEdit ? '<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>' : ''}
      </div>` : ''}
    </div>

    <div class="content-section">
      <div id="kampagnen-content-container">
        ${currentView === 'calendar' ? '<div id="calendar-container"></div>' : 
          renderTableWrapper()}
      </div>
    </div>
  `;
}

export function renderTableWrapper() {
  const isKunde = window.currentUser?.rolle === 'kunde';
  const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
  
  return `
    <div class="data-table-container kampagne-table-container">
      <table class="data-table data-table--nowrap data-table--kampagne">
        <thead>
          <tr>
            ${!isKunde && isAdmin ? `<th class="col-checkbox">
              <input type="checkbox" id="select-all-kampagnen">
            </th>` : ''}
            <th class="col-name">Kampagnenname</th>
            <th class="col-unternehmen">Unternehmen</th>
            <th class="col-marke">Marke</th>
            <th class="col-auftrag">Auftragsdetails</th>
            <th class="col-art">Art der Kampagne</th>
            <th class="col-budget">Budget</th>
            <th class="col-creator-anzahl">Creator Anzahl</th>
            <th class="col-video-anzahl">Video Anzahl</th>
            ${!isKunde ? '<th class="col-ansprechpartner">Ansprechpartner</th>' : ''}
            ${!isKunde ? '<th class="col-mitarbeiter">Mitarbeiter</th>' : ''}
            ${!isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="kampagnen-table-body">
          <tr>
            <td colspan="${isKunde ? '8' : '13'}" class="loading">Lade Kampagnen...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination-container" id="pagination-kampagne"></div>
  `;
}

export async function updateTable(kampagnen, { bindDragToScroll }) {
  const tbody = document.getElementById('kampagnen-table-body');
  if (!tbody) return;

  const isKunde = window.currentUser?.rolle === 'kunde';
  const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

  await TableAnimationHelper.animatedUpdate(tbody, async () => {
    if (!kampagnen || kampagnen.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    tbody.innerHTML = kampagnen.map(kampagne => `
      <tr data-id="${kampagne.id}">
        ${!isKunde && isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="kampagne-check" data-id="${kampagne.id}"></td>` : ''}
        <td class="col-name">
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(kampagne))}
          </a>
        </td>
        <td class="col-unternehmen">${renderUnternehmen(kampagne.unternehmen)}</td>
        <td class="col-marke">${renderMarke(kampagne.marke)}</td>
        <td class="col-auftrag">${kampagne.auftrag?.details_id ? `<a href="#" class="table-link" data-table="auftragsdetails" data-id="${kampagne.auftrag.details_id}">${window.validatorSystem.sanitizeHtml(kampagne.auftrag.auftragsname)}</a>` : '-'}</td>
        <td class="col-art">${renderArtTags(kampagne.art_der_kampagne_display || kampagne.art_der_kampagne)}</td>
        <td class="col-budget">${renderBudgetProgress(kampagne)}</td>
        <td class="col-creator-anzahl">${kampagne.creatoranzahl || 0}</td>
        <td class="col-video-anzahl">${kampagne.videoanzahl || 0}</td>
        ${!isKunde ? `<td class="col-ansprechpartner">${renderAnsprechpartner(kampagne.ansprechpartner)}</td>` : ''}
        ${!isKunde ? `<td class="col-mitarbeiter">${renderMitarbeiter(kampagne.mitarbeiter)}</td>` : ''}
        ${!isKunde ? `<td class="col-actions">
          ${actionBuilder.create('kampagne', kampagne.id, window.currentUser)}
        </td>` : ''}
      </tr>
    `).join('');
  });

  bindDragToScroll();
}

export function renderAnsprechpartner(ansprechpartner) {
  if (!ansprechpartner || ansprechpartner.length === 0) {
    return '-';
  }

  const items = ansprechpartner
    .filter(ap => ap && ap.vorname && ap.nachname)
    .map(ap => ({
      name: `${ap.vorname} ${ap.nachname}`,
      type: 'person',
      id: ap.id,
      entityType: 'ansprechpartner',
      profile_image_url: ap.profile_image_url || null
    }));

  return avatarBubbles.renderBubbles(items);
}

export function renderUnternehmen(unternehmen) {
  if (!unternehmen || !unternehmen.firmenname) {
    return '-';
  }

  const items = [{
    name: unternehmen.firmenname,
    label: unternehmen.internes_kuerzel || unternehmen.firmenname,
    type: 'org',
    id: unternehmen.id,
    entityType: 'unternehmen',
    logo_url: unternehmen.logo_url || null
  }];

  return avatarBubbles.renderBubbles(items, { showLabel: true });
}

export function renderMarke(marke) {
  if (!marke || !marke.markenname) {
    return '-';
  }

  const items = [{
    name: marke.markenname,
    type: 'org',
    id: marke.id,
    entityType: 'marke',
    logo_url: marke.logo_url || null
  }];

  return avatarBubbles.renderBubbles(items, { showLabel: true });
}

export function renderBudgetProgress(kampagne) {
  const total = kampagne._budgetTotal || 0;
  const used = kampagne._budgetUsed || 0;
  if (total <= 0) return '<span class="text-muted">-</span>';

  const pct = KampagneUtils.getProgressPercentage(used, total);
  const remainPct = Math.max(0, 100 - pct);
  let colorClass = '';
  if (pct >= 90) colorClass = 'summary-progress-fill--danger';
  else if (pct >= 75) colorClass = 'summary-progress-fill--warning';

  return `
    <div class="budget-progress-cell">
      <div class="summary-progress">
        <div class="summary-progress-fill ${colorClass}" style="width: ${pct}%"></div>
      </div>
      <span class="budget-progress-label">${remainPct}%</span>
    </div>
  `;
}

export function renderArtTags(artArray) {
  if (!artArray || artArray.length === 0) {
    return '-';
  }

  const shortenArt = (art) => {
    if (!art) return art;
    return art.replace(/ Kampagne$/i, '');
  };

  const arr = Array.isArray(artArray) ? artArray : [artArray];
  const inner = arr.map(art => {
    const shortArt = shortenArt(art);
    return `<span class="tag tag--type">${window.validatorSystem?.sanitizeHtml(shortArt) || shortArt}</span>`;
  }).join('');
  return `<div class="tags tags-compact">${inner}</div>`;
}

export function renderMitarbeiter(users) {
  if (!users || users.length === 0) {
    return '-';
  }
  
  console.log('🔍 KampagneList renderMitarbeiter:', users); // Debug
  
  const items = users
    .filter(u => u && (u.name || u.email))
    .map(u => ({
      name: u.name || u.email,
      type: 'person',
      id: u.id,
      entityType: 'mitarbeiter',
      profile_image_url: u.profile_image_url
    }));
  
  console.log('🔍 KampagneList mitarbeiter items:', items); // Debug
  
  return avatarBubbles.renderBubbles(items);
}
