// KampagneDetailMainRenderer.js
// Haupt-Rendering für die Kampagnen-Detailseite (Page-Layout, Tabs, Skeleton)

import { KampagneUtils } from './KampagneUtils.js';
import { renderSummaryCards } from './KampagneDetailSummaryCards.js';
import { renderAnsprechpartner } from './KampagneDetailTabRenderers.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderToolbarMenu, renderToolbarMenuItem } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';

const SHARE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
    <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z" />
  </svg>`;

const KAMPAGNE_KOOPERATION_SORT_OPTIONS = [
  { value: 'name_asc', label: 'A-Z' },
  { value: 'name_desc', label: 'Z-A' },
  { value: 'created_desc', label: 'Neueste zuerst' },
  { value: 'created_asc', label: 'Älteste zuerst' },
  { value: 'posting_asc', label: 'GoLive früheste zuerst' },
  { value: 'posting_desc', label: 'GoLive späteste zuerst' },
  { value: 'content_deadline_asc', label: 'Content-Deadline früheste zuerst' },
  { value: 'content_deadline_desc', label: 'Content-Deadline späteste zuerst' }
];

const CHECK_ICON = `
  ${icon('check-bold')}`;

const FILTER_ICON = `
  ${icon('filter-alt')}`;

const TAG_ICON = `
  ${icon('tag')}`;

const SORT_ICON = `
  ${icon('arrows-up-down')}`;

const COLUMNS_ICON = `
  ${icon('bars-3')}`;

const EYE_ICON = `
  ${icon('eye-outline')}`;

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitize(str) {
  return window.validatorSystem?.sanitizeHtml(String(str)) || '';
}

// Multi-Select-Submenu (Status/Tags) im Sourcing-Pattern: Hover oeffnet das
// Panel, Auswahl wird per Checkmark angezeigt. Sync nach Klick via
// syncFilterSubmenu in KampagneDetailEvents.js.
function renderFilterSubmenu({ key, label, icon, options = [], selected = [] }) {
  if (!options.length) return '';
  const hasActive = selected.length > 0;
  const items = options.map(opt => {
    const isActive = selected.includes(opt);
    return `
      <button type="button" class="submenu-item" data-filter-key="${key}" data-filter-value="${escapeAttr(opt)}" role="menuitemcheckbox" aria-checked="${isActive}">
        <span>${sanitize(opt)}</span>
        ${isActive ? `<span class="submenu-check">${CHECK_ICON}</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div class="action-submenu" data-filter-submenu="${key}">
      <button type="button" class="action-item has-submenu${hasActive ? ' active' : ''}" role="menuitem" aria-haspopup="true">
        ${icon}
        <span>${label}</span>
      </button>
      <div class="submenu" role="menu">
        ${hasActive ? `
          <button type="button" class="submenu-item submenu-reset" data-filter-reset="${key}" role="menuitem">
            Alle zurücksetzen
          </button>` : ''}
        ${items}
      </div>
    </div>`;
}

function renderSortSubmenu(currentSort) {
  const items = KAMPAGNE_KOOPERATION_SORT_OPTIONS.map(opt => {
    const isActive = opt.value === currentSort;
    return `
      <button type="button" class="submenu-item" data-sort-value="${opt.value}" role="menuitemradio" aria-checked="${isActive}">
        <span>${opt.label}</span>
        ${isActive ? `<span class="submenu-check">${CHECK_ICON}</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div class="action-submenu" data-sort-submenu>
      <button type="button" class="action-item has-submenu" role="menuitem" aria-haspopup="true">
        ${SORT_ICON}
        <span>Sortierung</span>
      </button>
      <div class="submenu" role="menu">
        ${items}
      </div>
    </div>`;
}

export function renderPageLoading() {
  return `
    <div class="table-loading-container table-loading-container--page">
      <div class="table-loading-spinner"></div>
    </div>
  `;
}

export function renderNotFound() {
  window.setHeadline('Kampagne nicht gefunden');
  window.content.innerHTML = `
    <div class="error-message">
      <h2>Kampagne nicht gefunden</h2>
      <p>Die angeforderte Kampagne konnte nicht gefunden werden.</p>
    </div>
  `;
}

export function formatDeadlineBadge(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  let cls = 'tab-deadline';
  if (diffDays < 0) cls += ' tab-deadline--overdue';
  else if (diffDays <= 7) cls += ' tab-deadline--soon';
  const label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `<span class="${cls}">bis ${label}</span>`;
}

/**
 * Rendert die komplette Detailseite.
 * @param {object} state - { kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed, isKunde, kampagneId }
 */
export function renderMainPage(state) {
  const {
    kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed,
    extraKostenVkSum, ekVkMarginSum, kskUmgebucht, videoStats, isKunde, kampagneId, searchQuery,
    availableStatuses = [], availableTags = [], selectedStatuses = [], selectedTags = [],
    kooperationSort = 'created_desc'
  } = state;

  const canCreateKooperation = window.currentUser?.permissions?.kooperation?.can_edit || false;
  const canShare = typeof window.isInternal === 'function' && window.isInternal();

  const kampagneName = KampagneUtils.getDisplayName(kampagneData) || kampagneData?.kampagnenname || '';

  const orgLogoUrl = kampagneData?.marke?.logo_url || kampagneData?.unternehmen?.logo_url || '';
  const orgLogoAlt = kampagneData?.marke?.markenname || kampagneData?.unternehmen?.firmenname || 'Logo';
  const safeLogoUrl = orgLogoUrl ? (window.validatorSystem?.sanitizeUrl(orgLogoUrl) ?? '') : '';

  return `
    ${renderSummaryCards(kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed, extraKostenVkSum, ekVkMarginSum, videoStats, kskUmgebucht)}

    <div class="page-header">
      <div class="page-header-title-group">
        ${safeLogoUrl ? `<img src="${escapeAttr(safeLogoUrl)}" alt="${escapeAttr(orgLogoAlt)}" title="${escapeAttr(orgLogoAlt)}" class="toolbar-entity-logo" loading="lazy" />` : ''}
        <h2 class="page-header-title">${sanitize(kampagneName)}</h2>
      </div>
      <div class="page-header-right">
        ${SearchInput.render('kampagne-koop', {
          placeholder: 'Name suchen...',
          currentValue: escapeAttr(searchQuery || '')
        })}
        ${canCreateKooperation ? `<button id="btn-new-kooperation" class="mdc-btn">Kooperation anlegen</button>` : ''}
        ${renderToolbarMenu({
          toggleId: 'btn-kampagne-toolbar-menu',
          itemsHtml: `
            ${renderFilterSubmenu({ key: 'status', label: 'Status filtern', icon: FILTER_ICON, options: availableStatuses, selected: selectedStatuses })}
            ${renderFilterSubmenu({ key: 'tag', label: 'Tags filtern', icon: TAG_ICON, options: availableTags, selected: selectedTags })}
            ${renderSortSubmenu(kooperationSort)}
            ${canShare ? renderToolbarMenuItem({ id: 'btn-share-kampagne', title: 'Liste per E-Mail teilen', icon: SHARE_ICON, label: 'Teilen' }) : ''}
            ${!isKunde ? `
              ${renderToolbarMenuItem({ id: 'btn-custom-columns', title: 'Eigene Spalten verwalten', icon: COLUMNS_ICON, label: 'Spalten' })}
              ${renderToolbarMenuItem({ id: 'btn-column-visibility', title: 'Spalten-Sichtbarkeit anpassen', icon: EYE_ICON, label: 'Sichtbarkeit anpassen' })}
            ` : ''}
          `
        })}
        <div class="view-toggle">
          <button id="btn-view-table" class="mdc-btn mdc-btn--secondary active" title="Tabelle">
            ${icon('table-grid')}
          </button>
          <button id="btn-view-kanban" class="mdc-btn mdc-btn--secondary" title="Kanban">
            ${icon('bookmark')}
          </button>
        </div>
      </div>
    </div>

    <div class="content-section">
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="offen">
          Offen <span class="tab-count" id="tab-count-offen"></span>
        </button>
        <button class="tab-button" data-tab="abgeschlossen">
          Abgeschlossen <span class="tab-count" id="tab-count-abgeschlossen"></span>
        </button>
        <button class="tab-button" data-tab="alle">
          Alle <span class="tab-count" id="tab-count-alle"></span>
        </button>
      </div>

      <div class="tab-content">
        <div class="detail-section">
          <div id="kooperationen-videos-container"></div>
        </div>
      </div>
    </div>
  `;
}

function renderInfoCards(kampagneData, koopBudgetSum, isKunde) {
  return `
    <div class="detail-card">
      <h3 class="section-title">Kampagnen-Informationen</h3>
      <div class="detail-grid-2">
        <div class="detail-item">
          <label>Kampagnenname:</label>
          <span>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(kampagneData))}</span>
        </div>
        ${kampagneData.eigener_name ? `
        <div class="detail-item">
          <label>Auto-generiert:</label>
          <span class="text-muted">${window.validatorSystem.sanitizeHtml(kampagneData.kampagnenname || '-')}</span>
        </div>` : ''}
        <div class="detail-item">
          <label>Art der Kampagne:</label>
          <span>${KampagneUtils.formatArray(kampagneData.kampagne_art_typen)}</span>
        </div>
        <div class="detail-item">
          <label>Kampagnen-Nummer:</label>
          <span>${kampagneData.kampagnen_nummer || '-'}</span>
        </div>
        <div class="detail-item">
          <label>Start:</label>
          <span>${KampagneUtils.formatDate(kampagneData.start)}</span>
        </div>
        <div class="detail-item">
          <label>Drehort:</label>
          <span>${window.validatorSystem.sanitizeHtml(kampagneData.drehort || '-')}</span>
        </div>
        <div class="detail-item">
          <label>Creator Anzahl:</label>
          <span>${kampagneData.creatoranzahl || 0}</span>
        </div>
        <div class="detail-item">
          <label>Video Anzahl:</label>
          <span>${kampagneData.videoanzahl || 0}</span>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Deadlines</h3>
      <div class="detail-grid">
        <div class="detail-item"><label>Briefing:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_briefing)}</span></div>
        <div class="detail-item"><label>Strategie:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_strategie)}</span></div>
        <div class="detail-item"><label>Skripte:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_skripte)}</span></div>
        <div class="detail-item"><label>Sourcing:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_creator_sourcing)}</span></div>
        <div class="detail-item"><label>Video Produktion:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_video_produktion)}</span></div>
        <div class="detail-item"><label>Post Produktion:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_post_produktion)}</span></div>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Budget</h3>
      <div class="detail-item">
        <label>Budget Info:</label>
        <span>${window.validatorSystem.sanitizeHtml(kampagneData.budget_info || '-')}</span>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Unternehmen</h3>
      <div class="detail-item"><label>Firmenname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.unternehmen?.firmenname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Webseite:</label><span>${kampagneData.unternehmen?.webseite ? `<a href="${kampagneData.unternehmen.webseite}" target="_blank">${kampagneData.unternehmen.webseite}</a>` : '-'}</span></div>
      <div class="detail-item"><label>Branche:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.unternehmen?.branche_id || '-')}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Marke</h3>
      <div class="detail-item"><label>Markenname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.marke?.markenname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Webseite:</label><span>${kampagneData.marke?.webseite ? `<a href="${kampagneData.marke.webseite}" target="_blank">${kampagneData.marke.webseite}</a>` : '-'}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Auftrag</h3>
      <div class="detail-item"><label>Auftragsname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.auftrag?.auftragsname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Status:</label><span>${renderAuftragAmpel(kampagneData.auftrag?.status)}</span></div>
      <div class="detail-item"><label>Gesamt Budget:</label><span>${KampagneUtils.formatCurrency(kampagneData.auftrag?.gesamt_budget)}${koopBudgetSum ? ` (aufgebraucht: ${KampagneUtils.formatCurrency(koopBudgetSum)})` : ''}</span></div>
      <div class="detail-item"><label>Creator Budget:</label><span>${KampagneUtils.formatCurrency(kampagneData.auftrag?.creator_budget)}${koopBudgetSum ? ` (aufgebraucht: ${KampagneUtils.formatCurrency(koopBudgetSum)})` : ''}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Ansprechpartner</h3>
      <div class="detail-item">
        ${renderAnsprechpartner(kampagneData.ansprechpartner)}
      </div>
    </div>
  `;
}
