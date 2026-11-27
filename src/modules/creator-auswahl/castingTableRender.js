// castingTableRender.js
// Kopfzeile, Toolbar und gruppierte Casting-Tabelle

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderToolbarMenu, renderToolbarMenuItem, renderToolbarListenKopf } from '../../core/components/ToolbarMenu.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { escapeHtml } from '../../core/format.js';
import { OHNE_KATEGORIE_KEY, orderedKategorieGroups } from './castingKategorien.js';
import {
  isColumnVisibleForCustomer,
  getVisibleColumnCount,
  getStickyClasses
} from './sourcingSpaltenSichtbarkeit.js';
import { SOURCING_TABS } from './sourcingTabs.js';
import { NICHT_UMSETZEN_ICON } from './sourcingIcons.js';
import { getListenTkp, reelsPreisTooltip, tkpAlsEingabe, viewsTooltip } from './castingPreisZellen.js';
import { SOURCING_SPALTEN_LABELS } from './sourcingSpaltenKatalog.js';
import { renderItemRow } from './castingItemRow.js';
import { zeigtFreigabeSpalte } from './castingFreigabeLogik.js';
import { hatEigeneReihenfolge, ordneSourcingTabellenHtml, spaltenfolgeFuerKontext } from './sourcingSpaltenfolge.js';
import { renderBewerbungTable } from './bewerbungTab.js';

// --- Render-Funktionen ---
// ctx = { items, liste, isKunde, hiddenColumns }

/** Logo und Name der Liste - der linke Teil der Kopfzeile */
function renderListenKopf(ctx) {
  const unternehmen = ctx.liste?.unternehmen;
  return renderToolbarListenKopf({
    name: ctx.liste?.name || '',
    logoUrl: unternehmen?.logo_url || '',
    logoAlt: unternehmen?.firmenname || 'Unternehmen'
  });
}

const SHARE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
    <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
  </svg>`;

const KUNDEN_CALL_ICON = `
  ${icon('phone')}`;

const TABELLE_ANPASSEN_ICON = `
  ${icon('adjustments-horizontal')}`;

const LINK_ICON = `${icon('link')}`;

const KATEGORIEN_ICON = `${icon('tag')}`;

/** TKP der Liste, oben im Plus-Menü. Klicks hier schließen das Menü nicht. */
function renderTkpZeile(ctx) {
  return `
    <label class="action-submenu toolbar-tkp-zeile">
      <span class="toolbar-tkp-label">
        ${icon('currency-euro')}
        <span>TKP</span>
      </span>
      <span class="toolbar-tkp-eingabe">
        <input id="sourcing-listen-tkp" class="toolbar-tkp-feld" type="text" inputmode="decimal"
          autocomplete="off" spellcheck="false"
          value="${escapeHtml(tkpAlsEingabe(getListenTkp(ctx.liste)))}"
          title="Euro pro 1.000 Views"
          aria-label="TKP in Euro pro 1.000 Views">
        <span>€</span>
      </span>
    </label>`;
}

function renderAddSectionActions(ctx = {}) {
  const kundenCallActive = ctx.kundenCallActive || false;
  return `
        ${SearchInput.render('sourcing-item', {
          placeholder: 'Name suchen...',
          currentValue: ctx.searchQuery || ''
        })}
        ${ctx.filterToggleHtml || ''}
        ${ctx.canCreate ? `
        <button type="button" class="mdc-btn mdc-btn--secondary" id="btn-management-anfrage">
          Managements anfragen
        </button>
        ` : ''}
        <div id="casting-vorschlag-block"></div>
        ${ctx.canCreate ? `
        ${renderToolbarMenu({
          toggleId: 'btn-sourcing-toolbar-menu',
          itemsHtml: `
            ${renderTkpZeile(ctx)}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-konzept-link', title: ctx.liste?.strategie_id ? 'Konzept-Verknüpfung lösen' : 'Konzept verknüpfen', icon: LINK_ICON, label: ctx.liste?.strategie_id ? 'Konzept lösen' : 'Konzept verknüpfen' })}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-kategorien', title: 'Kategorien verwalten', icon: KATEGORIEN_ICON, label: 'Kategorien' })}
            ${renderToolbarMenuItem({ id: 'btn-share-sourcing', title: 'Liste per E-Mail teilen', icon: SHARE_ICON, label: 'Teilen' })}
            ${renderToolbarMenuItem({ id: 'btn-kunden-call-toggle', title: 'EK und CPM für Kundenpräsentation ausblenden', icon: KUNDEN_CALL_ICON, label: 'Kunden Call', active: kundenCallActive })}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-tabelle-anpassen', title: 'Spaltenreihenfolge und Sichtbarkeit', icon: TABELLE_ANPASSEN_ICON, label: 'Tabelle anpassen' })}
          `
        })}
        ` : ''}
  `;
}

export function renderAddSection(ctx = {}) {
  if (ctx.actionsOnly) {
    return renderAddSectionActions(ctx);
  }
  return `
    <div class="add-item-section add-item-section--compact">
      <div class="add-item-actions-left">
        ${renderListenKopf(ctx)}
      </div>
      <div class="add-item-actions-right">
        ${renderAddSectionActions(ctx)}
      </div>
    </div>
  `;
}

export function renderItemsTable(ctx) {
  if (ctx.activeTab === 'bewerbung' && !ctx.isKunde) return renderBewerbungTable(ctx.bewerbungen || []);
  const searchQuery = (ctx.searchQuery || '').trim();
  const gesamtTreffer = (ctx.tabCounts?.alle ?? 0) + (ctx.tabCounts?.abgelehnt ?? 0);
  // Suche aktiv und gar kein Name matcht (unabhaengig vom Reiter)
  if (ctx.items.length === 0 && ctx.hasAnyItems && searchQuery && gesamtTreffer === 0) {
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'search', title: `Keine Treffer für "${searchQuery}"` })}
      </div>
    `;
  }
  if (ctx.items.length === 0 && ctx.hasAnyItems && ctx.filterActive) {
    const imReiter = ctx.activeTab && ctx.activeTab !== 'alle'
      ? ` im Reiter "${SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab}"`
      : '';
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'filter', title: `Keine Creator für die gewählten Filter${imReiter}` })}
      </div>
    `;
  }
  if (ctx.items.length === 0 && ctx.hasAnyItems && ctx.activeTab) {
    const tabLabel = SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab;
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'creator', title: `Keine Creator im Reiter "${tabLabel}"` })}
      </div>
    `;
  }
  if (ctx.items.length === 0 && !(ctx.teilbereiche || []).length) {
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({
          icon: 'creator',
          title: 'Noch keine Creator hinzugefügt',
          text: !ctx.isKunde ? 'Fügen Sie unten einen Profil-Link oder @Handle ein' : ''
        })}
      </div>
    `;
  }

  const canWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  const mitKategorien = hatKategorieGruppen(ctx);
  const tableClasses = [
    'data-table',
    'strategie-items-table',
    'creator-pool-table',
    canWrite ? 'has-bulk-select' : '',
    mitKategorien ? 'has-kategorie-headers' : '',
    hasActions ? '' : 'ohne-aktionen'
  ].filter(Boolean).join(' ');

  const html = `
    <div class="table-container creator-pool-table-container">
      <table class="${tableClasses}">
        ${mitKategorien ? '' : `
        <thead>
          <tr>
            ${renderColumnHeaderCells(ctx, { includeSelectAll: true })}
          </tr>
        </thead>`}
        ${renderGroupedItems(ctx)}
      </table>
    </div>
  `;
  if (!hatEigeneReihenfolge(ctx.columnOrder)) return html;
  return ordneSourcingTabellenHtml(html, spaltenfolgeFuerKontext(ctx));
}

function hatKategorieGruppen(ctx) {
  const teilbereiche = ctx.teilbereiche || [];
  if (teilbereiche.length > 0) return true;
  const gruppen = orderedKategorieGroups(ctx.items || [], []);
  return !(gruppen.length <= 1 && gruppen[0]?.key === OHNE_KATEGORIE_KEY);
}

function renderColumnHeaderCells(ctx, { includeSelectAll = true } = {}) {
  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  // Write-Faehigkeiten: Sichtbarkeit interner Spalten bleibt Rollen-Sache
  // (!isKunde), Editierbarkeit ist Capability (Investor: sehen ja, anfassen nein).
  const canWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  const hide = (col) => !vis(col) ? 'style="display:none;"' : '';
  const sticky = getStickyClasses(ctx);
  const tkpLabel = getListenTkp(ctx.liste).toLocaleString('de-DE');
  // Einfuegepunkt fuer eigene Spalten, die hinter dieser Standardspalte
  // verankert sind. Muss in Kopf und Datenzeile an denselben Stellen stehen.
  const customAt = (anchor) => ctx.customManager
    ? ctx.customManager.renderHeadersAt(anchor, ctx.hiddenColumns, ctx.isKunde)
    : '';
  const dragCell = canWrite
    ? `<th class="col-drag col-sticky-1 cp-col-drag">${includeSelectAll ? '<input type="checkbox" class="sourcing-select-all" title="Alle auswählen">' : ''}</th>`
    : '';

  return `
            ${dragCell}
            <th class="${sticky.name} cp-col-name">Name</th>
            <th class="cp-col-link" ${hide('cp-col-link')}>Link</th>
            ${customAt('cp-col-link')}
            <th class="cp-col-follower" ${hide('cp-col-follower')}>Follower</th>
            ${customAt('cp-col-follower')}
            <th class="cp-col-engagement" ${hide('cp-col-engagement')} title="Likes und Kommentare je Post. Instagram: geteilt durch Follower, zweite Zeile ohne Trial-Reels, wenn das Gate greift. TikTok: geteilt durch Views. Ohne Werbung, Posts jünger als 4 Tage und Ausreißer.">Engagement</th>
            ${customAt('cp-col-engagement')}
            ${[12, 30].map(fenster => `
            <th class="cp-col-views-${fenster}" ${hide(`cp-col-views-${fenster}`)} title="${escapeHtml(viewsTooltip(fenster))}">${SOURCING_SPALTEN_LABELS[`cp-col-views-${fenster}`]}</th>
            ${customAt(`cp-col-views-${fenster}`)}
            <th class="cp-col-cpm-${fenster}" ${hide(`cp-col-cpm-${fenster}`)} title="${escapeHtml(reelsPreisTooltip(tkpLabel, fenster))}">${SOURCING_SPALTEN_LABELS[`cp-col-cpm-${fenster}`]}</th>
            ${customAt(`cp-col-cpm-${fenster}`)}`).join('')}
            <th class="cp-col-preis-video" ${hide('cp-col-preis-video')} title="Manuell gepflegt – der tatsächlich verhandelte Preis pro Video (Reel bzw. TikTok-Video)">Preis Video</th>
            ${customAt('cp-col-preis-video')}
            <th class="cp-col-reichweite-story" ${hide('cp-col-reichweite-story')} title="Manuell gepflegt – Story-Reichweite liefert die Instagram-API für fremde Accounts nicht">Reichweite Story</th>
            ${customAt('cp-col-reichweite-story')}
            <th class="cp-col-story-preis" ${hide('cp-col-story-preis')} title="Manuell gepflegt">Preis Story</th>
            ${customAt('cp-col-story-preis')}
            <th class="cp-col-pricing" ${hide('cp-col-pricing')} title="Der verhandelte Gesamtpreis">Gesamtpreis</th>
            ${customAt('cp-col-pricing')}
            <th class="cp-col-notiz" ${hide('cp-col-notiz')} title="Startet mit der Instagram-Bio, sobald der Creator abgerufen wurde">Kurzbeschreibung</th>
            ${customAt('cp-col-notiz')}
            <th class="cp-col-kunden-feedback" ${hide('cp-col-kunden-feedback')} title="Die Bewertung des Kunden: Prio oder Abgelehnt">Kundenfeedback</th>
            ${customAt('cp-col-kunden-feedback')}
            <th class="cp-col-feedback" ${hide('cp-col-feedback')}>Rückmeldung Kunde</th>
            ${customAt('cp-col-feedback')}
            <th class="cp-col-status" ${hide('cp-col-status')}>Status</th>
            ${customAt('cp-col-status')}
            <th class="cp-col-location" ${hide('cp-col-location')}>Location</th>
            ${customAt('cp-col-location')}
            <th class="cp-col-mail" ${hide('cp-col-mail')} title="Aus der Instagram-Bio gelesen, sofern dort hinterlegt">Mail</th>
            ${customAt('cp-col-mail')}
            <th class="cp-col-typ" ${hide('cp-col-typ')}>Creator Art</th>
            ${customAt('cp-col-typ')}
            <th class="cp-col-ek" ${hide('cp-col-ek')}>EK</th>
            ${customAt('cp-col-ek')}
            <th class="cp-col-vk" ${hide('cp-col-vk')}>VK</th>
            ${customAt('cp-col-vk')}
            ${ctx.customManager ? ctx.customManager.renderHeaders(ctx.hiddenColumns, ctx.isKunde) : ''}
            ${zeigtFreigabeSpalte(ctx) ? '<th class="cp-col-freigabe">Freigabe</th>' : ''}
            ${hasActions ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
  `;
}

function renderKategorieHeaderRow(group, colCount, ctx) {
  const escapedKey = escapeAttr(group.key);
  const escapedLabel = escapeAttr(group.label);
  const rowExtra = group.variant === 'rejected' ? ' kategorie-header-row--rejected' : '';
  const headerExtra = group.variant === 'rejected'
    ? ' kategorie-header--rejected'
    : group.variant === 'default'
      ? ' kategorie-header--default'
      : '';
  const label = group.variant === 'rejected'
    ? `${NICHT_UMSETZEN_ICON} ${escapedLabel}`
    : escapedLabel;
  const checkboxTitle = group.key === OHNE_KATEGORIE_KEY
    ? 'Alle ohne Kategorie auswählen'
    : `Alle in '${group.label}' auswählen`;
  const checkbox = !ctx.isKunde && (ctx.canEdit ?? true)
    ? `<input type="checkbox" class="sourcing-group-select" data-group-key="${escapedKey}" title="${escapeAttr(checkboxTitle)}">`
    : '';

  return `
      <tr class="kategorie-header-row${rowExtra}" data-group-key="${escapedKey}">
        <td colspan="${colCount}" class="kategorie-header${headerExtra}">
          <div class="kategorie-header-content">
            ${checkbox}
            <span class="kategorie-label">${label}</span>
            <span class="kategorie-count">(${group.items.length})</span>
          </div>
        </td>
      </tr>
    `;
}

function wrapGroupTbody(groupKey, innerHtml) {
  return `<tbody class="kategorie-group-tbody" data-group-key="${escapeAttr(groupKey || OHNE_KATEGORIE_KEY)}">${innerHtml}</tbody>`;
}

export function renderGroupedItems(ctx) {
  const teilbereiche = ctx.teilbereiche || [];
  const items = ctx.items || [];

  // Ohne definierte Kategorien und ohne Kategorie an den Zeilen: flache Liste ohne Gruppenkopf
  if (!hatKategorieGruppen(ctx)) {
    const rows = items.map((item, index) => renderItemRow(ctx, item, index)).join('');
    return wrapGroupTbody(OHNE_KATEGORIE_KEY, rows);
  }

  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const canWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  const colCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns, {
    canEdit: canWrite,
    hasActions,
    hasFreigabe: zeigtFreigabeSpalte(ctx)
  }) + customCount;
  const colHeaderRow = `<tr class="kategorie-col-header-row">${renderColumnHeaderCells(ctx, { includeSelectAll: false })}</tr>`;

  let html = '';
  let globalIndex = 0;
  for (const group of orderedKategorieGroups(items, teilbereiche)) {
    let inner = renderKategorieHeaderRow(group, colCount, ctx) + colHeaderRow;
    for (const item of group.items) {
      inner += renderItemRow(ctx, item, globalIndex++);
    }
    html += wrapGroupTbody(group.key, inner);
  }

  return html;
}

export function updateStickyHeights(rootEl) {
  if (!rootEl) return;
  const inShell = Boolean(rootEl.querySelector('.casting-body'));
  const addSection = inShell ? null : rootEl.querySelector('.add-item-section--compact');
  const addH = addSection ? addSection.offsetHeight : 0;
  rootEl.style.setProperty('--sticky-addbar-height', addH + 'px');
  rootEl.style.setProperty('--sticky-add-section-height', addH + 'px');

  const thead = rootEl.querySelector('.creator-pool-table thead');
  if (thead) {
    rootEl.style.setProperty('--sticky-thead-height', thead.offsetHeight + 'px');
  }
  const katHeader = rootEl.querySelector('.creator-pool-table .kategorie-header-row');
  if (katHeader) {
    rootEl.style.setProperty('--sticky-kategorie-header-height', katHeader.offsetHeight + 'px');
  }
}

