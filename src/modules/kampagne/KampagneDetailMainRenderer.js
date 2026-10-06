// KampagneDetailMainRenderer.js
// Haupt-Rendering für die Kampagnen-Detailseite (Page-Layout, Tabs, Skeleton)

import { KampagneUtils } from './KampagneUtils.js';
import { kampagneBudgetPot, verbrauchZeilen } from '../produktion/produktionsbudget.js';
import { renderSummaryCards } from './KampagneDetailSummaryCards.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderToolbarMenu, renderToolbarMenuItem } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderWorkflowTabBar, renderWorkflowPanes, DEFAULT_WORKFLOW_TAB } from './KampagneDetailWorkflow.js';
import { renderWorkflowCreateChrome } from './KampagneWorkflowCreate.js';

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

export function renderNotFound(entity = 'Kampagne') {
  window.setHeadline(`${entity} nicht gefunden`);
  window.content.innerHTML = `
    <div class="error-message">
      <h2>${entity} nicht gefunden</h2>
      <p>Die angeforderte ${entity} konnte nicht gefunden werden.</p>
    </div>
  `;
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
    kooperationSort = 'created_desc',
    kooperationen = [], videos = [],
    activeWorkflow = DEFAULT_WORKFLOW_TAB,
    strategien = [],
    sourcingListenCount = 0
  } = state;

  const canCreateKooperation = window.canCreate?.('kooperation') ?? false;
  const canShare = typeof window.isInternal === 'function' && window.isInternal();
  const canTableFilter = window.canFeature?.('kampagneTableFilter') ?? false;
  const canTableLayout = window.canFeature?.('kampagneTableLayout') ?? false;

  const kampagneName = KampagneUtils.getDisplayName(kampagneData) || kampagneData?.kampagnenname || '';
  const pageTitle = state.mode === 'workflow' && state.lineTitle ? state.lineTitle : kampagneName;

  const orgLogoUrl = kampagneData?.marke?.logo_url || kampagneData?.unternehmen?.logo_url || '';
  const orgLogoAlt = kampagneData?.marke?.markenname || kampagneData?.unternehmen?.firmenname || 'Logo';
  const safeLogoUrl = orgLogoUrl ? (window.validatorSystem?.sanitizeUrl(orgLogoUrl) ?? '') : '';

  // Plus-Menue nur rendern, wenn mindestens ein Eintrag drin ist — sonst
  // haengt bei Rollen ohne Tabellen-Werkzeuge (Investor) ein leeres Menue.
  const toolbarItemsHtml = `
    ${canTableFilter ? renderFilterSubmenu({ key: 'status', label: 'Status filtern', icon: FILTER_ICON, options: availableStatuses, selected: selectedStatuses }) : ''}
    ${canTableFilter ? renderFilterSubmenu({ key: 'tag', label: 'Tags filtern', icon: TAG_ICON, options: availableTags, selected: selectedTags }) : ''}
    ${canTableFilter ? renderSortSubmenu(kooperationSort) : ''}
    ${canShare ? renderToolbarMenuItem({ id: 'btn-share-kampagne', title: 'Liste per E-Mail teilen', icon: SHARE_ICON, label: 'Teilen' }) : ''}
    ${canTableLayout ? `
      ${renderToolbarMenuItem({ id: 'btn-custom-columns', title: 'Eigene Spalten verwalten', icon: COLUMNS_ICON, label: 'Spalten' })}
      ${renderToolbarMenuItem({ id: 'btn-column-visibility', title: 'Spalten-Sichtbarkeit anpassen', icon: EYE_ICON, label: 'Sichtbarkeit anpassen' })}
    ` : ''}
  `;
  const hasToolbarItems = toolbarItemsHtml.trim().length > 0;

  const createCtx = { strategien, sourcingListenCount };

  if (state.mode === 'overview') {
    return renderKampagneOverview({
      ...state,
      kampagneName,
      safeLogoUrl,
      orgLogoAlt
    });
  }

  return `
    <div class="kampagne-detail-body" data-workflow="${escapeAttr(activeWorkflow)}">
      <div class="page-header">
        <div class="page-header-title-group">
          ${safeLogoUrl ? `<img src="${escapeAttr(safeLogoUrl)}" alt="${escapeAttr(orgLogoAlt)}" title="${escapeAttr(orgLogoAlt)}" class="toolbar-entity-logo" loading="lazy" />` : ''}
          <h2 class="page-header-title">${sanitize(pageTitle)}</h2>
          ${renderProduktionsbudget(state.produktion, state.kampagneData)}
        </div>
        <div class="page-header-right">
          <div class="kampagne-tab-chrome" data-chrome="produktion">
            ${SearchInput.render('kampagne-koop', {
              placeholder: 'Suchen...',
              currentValue: escapeAttr(searchQuery || '')
            })}
            ${(window.canFeature?.('mediaDownload') ?? false) ? `<button id="btn-download-finale" class="mdc-btn mdc-btn--secondary" title="Finale Videos der markierten Kooperationen herunterladen">Finale Videos downloaden</button>` : ''}
            ${canCreateKooperation ? `<button id="btn-new-kooperation" class="mdc-btn">Kooperation anlegen</button>` : ''}
            ${hasToolbarItems ? renderToolbarMenu({
              toggleId: 'btn-kampagne-toolbar-menu',
              itemsHtml: toolbarItemsHtml
            }) : ''}
            <div class="view-toggle">
              <button id="btn-view-table" class="mdc-btn mdc-btn--secondary active" title="Tabelle">
                ${icon('table-grid')}
              </button>
              <button id="btn-view-kanban" class="mdc-btn mdc-btn--secondary" title="Kanban">
                ${icon('bookmark')}
              </button>
            </div>
          </div>
          <div class="kampagne-tab-chrome" data-chrome="briefing">
            ${renderWorkflowCreateChrome('briefing', createCtx)}
          </div>
          <div class="kampagne-tab-chrome" data-chrome="casting">
            ${renderWorkflowCreateChrome('casting', createCtx)}
          </div>
          <div class="kampagne-tab-chrome" data-chrome="konzepte">
            ${renderWorkflowCreateChrome('konzepte', createCtx)}
          </div>
          <div class="kampagne-tab-chrome" data-chrome="skripte">
            ${renderWorkflowCreateChrome('skripte', createCtx)}
          </div>
          <div class="kampagne-tab-chrome" data-chrome="vertraege">
            ${renderWorkflowCreateChrome('vertraege', createCtx)}
          </div>
        </div>
      </div>

      ${state.linienBar || ''}
      ${renderWorkflowTabBar(activeWorkflow)}

      <div class="content-section">
        <div class="workflow-pane" data-pane="produktion" id="workflow-pane-produktion"${activeWorkflow === 'produktion' ? '' : ' hidden'}>
          <div class="tab-navigation kampagne-filter-tabs">
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
        ${renderWorkflowPanes(activeWorkflow)}
      </div>
    </div>
  `;
}

function renderProduktionsbudget(produktion, kampagneData) {
  if (!produktion) return '';
  const verbrauch = parseFloat(produktion.budgetUsed) || 0;
  const eigen = produktion.budget != null && produktion.budget !== '';
  const decke = eigen ? parseFloat(produktion.budget) || 0 : kampagneBudgetPot(kampagneData);
  const label = eigen ? 'Produktionsbudget' : 'Budget der Kampagne';
  return `<p class="text-muted">${label} ${KampagneUtils.formatCurrency(decke)} · Verbrauch ${KampagneUtils.formatCurrency(verbrauch)}</p>`;
}

function renderProduktionBudget(used, total) {
  if (total <= 0) return '<span class="text-muted">–</span>';
  const amount = parseFloat(used) || 0;
  const pct = KampagneUtils.getProgressPercentage(amount, total);
  let colorClass = '';
  if (pct >= 90) colorClass = 'summary-progress-fill--danger';
  else if (pct >= 75) colorClass = 'summary-progress-fill--warning';
  return `
    <div class="budget-progress-cell">
      <div class="summary-progress">
        <div class="summary-progress-fill ${colorClass}" style="width: ${pct}%"></div>
      </div>
      <span class="budget-progress-label">${KampagneUtils.formatCurrency(amount)} · ${pct}%</span>
    </div>`;
}

function renderKampagneOverview({
  kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed,
  extraKostenVkSum, ekVkMarginSum, kskUmgebucht, videoStats, isKunde,
  kooperationen = [], videos = [], produktionen = [],
  kampagneName, safeLogoUrl, orgLogoAlt
}) {
  const canCreateBriefing = window.canCreate?.('briefing') ?? false;
  const zeilen = verbrauchZeilen(produktionen || [], kampagneBudgetPot(kampagneData));
  const rows = (produktionen || []).map((p, index) => {
    const linien = p.linien || [];
    const produkte = [...new Set(linien.flatMap(l =>
      (l.briefing?.produkte || []).map(row => row?.produkt?.name).filter(Boolean)
    ))];
    const produkt = produkte.length ? produkte.join(', ') : (p.produkt?.name || '–');
    const briefing = linien.length
      ? linien.map(l => `${l.name}${l.is_draft ? ' (Entwurf)' : ''}`).join(', ')
      : '–';
    const zeile = zeilen[index] || { eigenesBudget: null, used: null, total: 0 };
    const budgetZelle = zeile.eigenesBudget != null
      ? KampagneUtils.formatCurrency(zeile.eigenesBudget)
      : '<span class="text-muted">–</span>';
    return `
      <tr>
        <td><a href="/produktion/${p.id}" class="table-link" data-table="produktion" data-id="${p.id}">${sanitize(p.name || briefing || 'Produktion')}</a></td>
        <td>${sanitize(produkt)}</td>
        <td>${sanitize(briefing)}${linien.length > 1 ? ` <span class="text-muted">· ${linien.length} Linien</span>` : ''}</td>
        <td>${budgetZelle}</td>
        <td>${renderProduktionBudget(zeile.used, zeile.total)}</td>
        <td>${canCreateBriefing && !linien.length ? `<button type="button" class="mdc-btn mdc-btn--text" data-produktion-loeschen="${p.id}">Löschen</button>` : ''}</td>
      </tr>`;
  }).join('');

  return `
    ${renderSummaryCards(kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed, extraKostenVkSum, ekVkMarginSum, videoStats, kskUmgebucht, { kooperationen, videos, isKunde })}
    <div class="kampagne-detail-body">
      <div class="page-header">
        <div class="page-header-title-group">
          ${safeLogoUrl ? `<img src="${escapeAttr(safeLogoUrl)}" alt="${escapeAttr(orgLogoAlt)}" class="toolbar-entity-logo" loading="lazy" />` : ''}
          <h2 class="page-header-title">${sanitize(kampagneName)}</h2>
        </div>
        <div class="page-header-right">
          ${canCreateBriefing ? `<button type="button" id="btn-new-produktion" class="mdc-btn">Produktion anlegen</button>` : ''}
        </div>
      </div>
      <div class="content-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr><th>Produktion</th><th>Produkt</th><th>Briefings</th><th>Budget</th><th>Verbrauch</th><th></th></tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6">Noch keine Produktion. Produktion anlegen oder im Auftrag eine planen.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}
