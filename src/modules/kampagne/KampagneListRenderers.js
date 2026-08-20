// KampagneListRenderers.js
// Tabellen-Rendering-Funktionen für KampagneList

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { KampagneUtils } from './KampagneUtils.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

/**
 * Erzeugt das komplette Seiten-HTML für die Kampagnenliste (Filter, View-Toggle, Tabelle/Kanban/Kalender).
 */
export function renderPageHtml({ currentView, searchQuery }) {
  const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
  const isKunde = window.isKunde();
  const isMitarbeiter = window.isMitarbeiter();
  const isAdmin = window.isAdmin();
  const canBulkDelete = window.canBulkDelete();

  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${SearchInput.render('kampagne', { 
            placeholder: 'Kampagne suchen...', 
            currentValue: searchQuery 
          })}
          <div class="view-toggle">
            <button id="btn-view-list" class="mdc-btn mdc-btn--secondary ${currentView === 'list' ? 'active' : ''}">
              ${icon('table-grid')}
              Liste
            </button>
            ${!isKunde ? `<button id="btn-view-calendar" class="mdc-btn mdc-btn--secondary ${currentView === 'calendar' ? 'active' : ''}">
              ${icon('calendar-days')}
              Kalender
            </button>` : ''}
          </div>
          ${!isKunde ? '<div id="filter-dropdown-container"></div>' : ''}
        </div>
      </div>
      ${!isKunde ? `<div class="table-actions">
        ${currentView === 'list' && canBulkDelete ? '<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>' : ''}
        ${currentView === 'list' && canBulkDelete ? '<button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>' : ''}
        ${currentView === 'list' && canBulkDelete ? '<span id="selected-count" style="display:none;">0 ausgewählt</span>' : ''}
        ${currentView === 'list' && canBulkDelete ? '<button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>' : ''}
        ${canEdit && !isMitarbeiter ? '<button id="btn-kampagne-new" class="mdc-btn">Neue Kampagne anlegen</button>' : ''}
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
  const isKunde = window.isKunde();
  const isAdmin = window.isAdmin();
  const canBulkDelete = window.canBulkDelete();
  
  return `
    <div class="data-table-container kampagne-table-container">
      <table class="data-table data-table--nowrap data-table--kampagne">
        <thead>
          <tr>
            ${!isKunde && canBulkDelete ? `<th class="col-checkbox">
              <input type="checkbox" id="select-all-kampagnen">
            </th>` : ''}
            <th class="col-name">Kampagnenname</th>
            <th class="col-unternehmen">Unternehmen</th>
            <th class="col-marke">Marke</th>
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
            <td colspan="${isKunde ? '7' : '12'}" class="loading">Lade Kampagnen...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination-container" id="pagination-kampagne"></div>
  `;
}

export async function updateTable(kampagnen, { bindDragToScroll, hasActiveFilters = false }) {
  const tbody = document.getElementById('kampagnen-table-body');
  if (!tbody) return;

  const isKunde = window.isKunde();
  const isAdmin = window.isAdmin();
  const canBulkDelete = window.canBulkDelete();

  await TableAnimationHelper.animatedUpdate(tbody, async () => {
    if (!kampagnen || kampagnen.length === 0) {
      const colspan = tbody.closest('table')?.querySelector('thead tr')?.children?.length || 10;
      const html = resolveEmptyState({
        hasActiveFilters,
        states: {
          default: isKunde
            ? { icon: 'megaphone', title: 'Keine Kampagnen vorhanden', text: 'Es wurden noch keine Kampagnen für Sie angelegt.' }
            : {
                icon: 'megaphone',
                title: 'Keine Kampagnen vorhanden',
                text: 'Legen Sie ein Projekt an, um Ihre erste Kampagne zu starten.',
                actionsHtml: '<button class="mdc-btn" onclick="window.navigateTo(\'/projekt-erstellen\')">Projekt anlegen</button>'
              }
        }
      }, 'default');
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
      return;
    }

    tbody.innerHTML = kampagnen.map(kampagne => `
      <tr data-id="${kampagne.id}">
        ${!isKunde && canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="kampagne-check" data-id="${kampagne.id}"></td>` : ''}
        <td class="col-name">
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(kampagne))}
          </a>
        </td>
        <td class="col-unternehmen">${renderUnternehmen(kampagne.unternehmen)}</td>
        <td class="col-marke">${renderMarke(kampagne.marke)}</td>
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
  
  const items = users
    .filter(u => u && (u.name || u.email))
    .map(u => ({
      name: u.name || u.email,
      type: 'person',
      id: u.id,
      entityType: 'mitarbeiter',
      profile_image_url: u.profile_image_url
    }));
  
  return avatarBubbles.renderBubbles(items);
}
