// castingTableRender.js
// Kopfzeile, Toolbar und gruppierte Casting-Tabelle

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderToolbarMenu, renderToolbarMenuItem, renderToolbarListenKopf } from '../../core/components/ToolbarMenu.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { SOURCING_STATUS_FILTER_TAGS } from './sourcingStatusOptions.js';
import { OHNE_PERSONA_KEY, orderedPersonaGroups } from './castingPersonaGroups.js';
import {
  escapeHtml,
  isColumnVisibleForCustomer,
  getVisibleColumnCount,
  getStickyClasses,
  SOURCING_TABS,
  INSTAGRAM_ICON,
  TIKTOK_ICON,
  NICHT_UMSETZEN_ICON
} from './CreatorAuswahlTemplates.js';
import { getListenTkp, reelsPreisTooltip } from './castingPreisZellen.js';
import { renderItemRow } from './castingItemRow.js';

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

const STATUS_FILTER_ICON = `
  ${icon('filter-alt')}`;

const STATUS_FILTER_CHECK_ICON = `
  ${icon('check-bold')}`;

function renderStatusFilterSubmenu(ctx = {}) {
  const selected = ctx.statusFilter || [];
  const hasActive = selected.length > 0;
  const items = SOURCING_STATUS_FILTER_TAGS.map(tag => {
    const isActive = selected.includes(tag);
    return `
      <button type="button" class="submenu-item" data-status-tag="${escapeHtml(tag)}" role="menuitemcheckbox" aria-checked="${isActive}">
        <span>${escapeHtml(tag)}</span>
        ${isActive ? `<span class="submenu-check">${STATUS_FILTER_CHECK_ICON}</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div class="action-submenu sourcing-status-filter-submenu">
      <button type="button" class="action-item has-submenu${hasActive ? ' active' : ''}" data-submenu="status-filter" role="menuitem" aria-haspopup="true">
        ${STATUS_FILTER_ICON}
        <span>Status filtern</span>
      </button>
      <div class="submenu" data-submenu="status-filter" role="menu">
        ${hasActive ? `
          <button type="button" class="submenu-item sourcing-status-filter-reset" data-status-filter-reset role="menuitem">
            Alle zurücksetzen
          </button>` : ''}
        ${items}
      </div>
    </div>`;
}

const SHARE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
    <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
  </svg>`;

const KUNDEN_CALL_ICON = `
  ${icon('phone')}`;

const TABELLE_ANPASSEN_ICON = `
  ${icon('adjustments-horizontal')}`;

const CUSTOM_COLUMNS_ICON = `
  ${icon('bars-3')}`;

const LINK_ICON = `${icon('link')}`;

function renderAddSectionActions(ctx = {}) {
  const kundenCallActive = ctx.kundenCallActive || false;
  return `
        ${SearchInput.render('sourcing-item', {
          placeholder: 'Name suchen...',
          currentValue: escapeHtml(ctx.searchQuery || '')
        })}
        ${ctx.canCreate ? `
        <button type="button" class="mdc-btn" id="btn-open-add-drawer">
          ${icon('plus-lg')}
          Creator hinzufügen
        </button>
        ` : ''}
        <div id="casting-vorschlag-block"></div>
        ${ctx.canCreate ? `
        ${renderToolbarMenu({
          toggleId: 'btn-sourcing-toolbar-menu',
          itemsHtml: `
            ${renderStatusFilterSubmenu(ctx)}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-konzept-link', title: ctx.liste?.strategie_id ? 'Konzept-Verknüpfung lösen' : 'Konzept verknüpfen', icon: LINK_ICON, label: ctx.liste?.strategie_id ? 'Konzept lösen' : 'Konzept verknüpfen' })}
            ${renderToolbarMenuItem({ id: 'btn-share-sourcing', title: 'Liste per E-Mail teilen', icon: SHARE_ICON, label: 'Teilen' })}
            ${renderToolbarMenuItem({ id: 'btn-kunden-call-toggle', title: 'EK und CPM für Kundenpräsentation ausblenden', icon: KUNDEN_CALL_ICON, label: 'Kunden Call', active: kundenCallActive })}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-tabelle-anpassen', title: 'TKP, Art der Liste und Spalten-Sichtbarkeit', icon: TABELLE_ANPASSEN_ICON, label: 'Tabelle anpassen' })}
            ${renderToolbarMenuItem({ id: 'btn-sourcing-custom-columns', title: 'Eigene Spalten verwalten', icon: CUSTOM_COLUMNS_ICON, label: 'Eigene Spalten' })}
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
  const searchQuery = (ctx.searchQuery || '').trim();
  // Suche aktiv und gar kein Name matcht (unabhaengig vom Reiter)
  if (ctx.items.length === 0 && ctx.hasAnyItems && searchQuery && (ctx.tabCounts?.alle ?? 0) === 0) {
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'search', title: `Keine Treffer für "${searchQuery}"` })}
      </div>
    `;
  }
  const statusFilter = ctx.statusFilter || [];
  if (ctx.items.length === 0 && ctx.hasAnyItems && statusFilter.length > 0) {
    const imReiter = ctx.activeTab && ctx.activeTab !== 'alle'
      ? ` im Reiter "${SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab}"`
      : '';
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'filter', title: `Keine Creator mit Status ${statusFilter.join(' oder ')}${imReiter}` })}
      </div>
    `;
  }
  if (ctx.items.length === 0 && ctx.hasAnyItems && ctx.activeTab && ctx.activeTab !== 'alle') {
    const tabLabel = SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab;
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({ icon: 'creator', title: `Keine Creator im Reiter "${tabLabel}"` })}
      </div>
    `;
  }
  if (ctx.items.length === 0 && !(ctx.personas || []).length) {
    return `
      <div class="table-container table-container--empty">
        ${renderEmptyState({
          icon: 'creator',
          title: 'Noch keine Creator hinzugefügt',
          text: !ctx.isKunde ? 'Fügen Sie oben einen Creator hinzu' : ''
        })}
      </div>
    `;
  }

  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  // Write-Faehigkeiten: Sichtbarkeit interner Spalten bleibt Rollen-Sache
  // (!isKunde), Editierbarkeit ist Capability (Investor: sehen ja, anfassen nein).
  const canWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  const visibleColCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns, { canEdit: canWrite, hasActions }) + customCount;
  const hide = (col) => !vis(col) ? 'style="display:none;"' : '';
  const sticky = getStickyClasses(ctx);
  const tkpLabel = getListenTkp(ctx.liste).toLocaleString('de-DE');
  // Einfuegepunkt fuer eigene Spalten, die hinter dieser Standardspalte
  // verankert sind. Muss in Kopf und Datenzeile an denselben Stellen stehen.
  const customAt = (anchor) => ctx.customManager
    ? ctx.customManager.renderHeadersAt(anchor, ctx.hiddenColumns, ctx.isKunde)
    : '';

  return `
    <div class="table-container creator-pool-table-container">
      <table class="data-table strategie-items-table creator-pool-table${canWrite ? ' has-bulk-select' : ''}">
        <thead>
          <tr>
            ${canWrite ? '<th class="col-drag col-sticky-1 cp-col-drag"><input type="checkbox" class="sourcing-select-all" title="Alle auswählen"></th>' : ''}
            <th class="cp-col-bild ${sticky.bild}" ${hide('cp-col-bild')}></th>
            <th class="${sticky.name} cp-col-name">Name</th>
            <th class="cp-col-notiz" ${hide('cp-col-notiz')} title="Startet mit der Instagram-Bio, sobald der Creator abgerufen wurde">Kurzbeschreibung</th>
            ${customAt('cp-col-notiz')}
            <th class="cp-col-matching" ${hide('cp-col-matching')} title="Gesamtscore aus Fit, Track und Fresh – wie gut der Creator zum Briefing passt">Matching</th>
            ${customAt('cp-col-matching')}
            <th class="cp-col-typ" ${hide('cp-col-typ')}>Creator Art</th>
            ${customAt('cp-col-typ')}
            <th class="cp-col-status" ${hide('cp-col-status')}>Status</th>
            ${customAt('cp-col-status')}
            <th class="cp-col-kunden-feedback" ${hide('cp-col-kunden-feedback')} title="Die Bewertung des Kunden: Prio oder Abgelehnt">Kundenfeedback</th>
            ${customAt('cp-col-kunden-feedback')}
            <th class="cp-col-location" ${hide('cp-col-location')}>Location</th>
            ${customAt('cp-col-location')}
            <th class="cp-col-mail" ${hide('cp-col-mail')} title="Aus der Instagram-Bio gelesen, sofern dort hinterlegt">Mail</th>
            ${customAt('cp-col-mail')}
            <th class="cp-col-telefon" ${hide('cp-col-telefon')} title="Aus der Instagram-Bio gelesen, sofern dort hinterlegt">Telefon</th>
            ${customAt('cp-col-telefon')}
            <th class="cp-col-link-ig" ${hide('cp-col-link-ig')}>Link ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-link-ig')}
            <th class="cp-col-follower-ig" ${hide('cp-col-follower-ig')}>Follower ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-follower-ig')}
            <th class="cp-col-cpm-ig-8" ${hide('cp-col-cpm-ig-8')} title="${escapeHtml(reelsPreisTooltip(tkpLabel, 8))}">Preis 8 Reels ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-cpm-ig-8')}
            <th class="cp-col-cpm-ig-30" ${hide('cp-col-cpm-ig-30')} title="${escapeHtml(reelsPreisTooltip(tkpLabel, 30))}">Preis 30 Reels ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-cpm-ig-30')}
            <th class="cp-col-preis-reels" ${hide('cp-col-preis-reels')} title="Manuell gepflegt – der tatsächlich verhandelte Reel-Preis">Preis Reels ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-preis-reels')}
            <th class="cp-col-reichweite-story" ${hide('cp-col-reichweite-story')} title="Manuell gepflegt – Story-Reichweite liefert die Instagram-API für fremde Accounts nicht">Reichweite Story ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-reichweite-story')}
            <th class="cp-col-preis-story" ${hide('cp-col-preis-story')} title="Manuell gepflegt">Preis Story ${INSTAGRAM_ICON}</th>
            ${customAt('cp-col-preis-story')}
            <th class="cp-col-link-tt" ${hide('cp-col-link-tt')}>Link ${TIKTOK_ICON}</th>
            ${customAt('cp-col-link-tt')}
            <th class="cp-col-follower-tt" ${hide('cp-col-follower-tt')}>Follower ${TIKTOK_ICON}</th>
            ${customAt('cp-col-follower-tt')}
            <th class="cp-col-preis-tt-video" ${hide('cp-col-preis-tt-video')} title="Manuell gepflegt – der verhandelte Preis pro TikTok-Video">Preis Video ${TIKTOK_ICON}</th>
            ${customAt('cp-col-preis-tt-video')}
            <th class="cp-col-preis-tt-story" ${hide('cp-col-preis-tt-story')} title="Manuell gepflegt">Preis Story ${TIKTOK_ICON}</th>
            ${customAt('cp-col-preis-tt-story')}
            <th class="cp-col-pricing" ${hide('cp-col-pricing')} title="Der verhandelte Gesamtpreis">Gesamtpreis</th>
            ${customAt('cp-col-pricing')}
            <th class="cp-col-nutzungsrechte" ${hide('cp-col-nutzungsrechte')} title="Laufzeit, Kanäle und Sonderabsprachen">Nutzungsrechte</th>
            ${customAt('cp-col-nutzungsrechte')}
            <th class="cp-col-reichweite-garantie" ${hide('cp-col-reichweite-garantie')}>RW Garantie</th>
            ${customAt('cp-col-reichweite-garantie')}
            <th class="cp-col-ek" ${hide('cp-col-ek')}>EK</th>
            ${customAt('cp-col-ek')}
            <th class="cp-col-vk" ${hide('cp-col-vk')}>VK</th>
            ${customAt('cp-col-vk')}
            <th class="cp-col-feedback" ${hide('cp-col-feedback')}>Rückmeldung Kunde</th>
            ${customAt('cp-col-feedback')}
            ${ctx.customManager ? ctx.customManager.renderHeaders(ctx.hiddenColumns, ctx.isKunde) : ''}
            ${hasActions ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        ${renderGroupedItems(ctx)}
        ${!ctx.isKunde && (ctx.canCreate ?? true) ? `
        <tfoot>
          <tr class="add-row-footer">
            <td colspan="${visibleColCount}">
              <button type="button" class="add-row-btn" id="btn-add-empty-row" title="Neue Zeile hinzufügen">
                ${icon('plus-lg')}
              </button>
            </td>
          </tr>
        </tfoot>
        ` : ''}
    </div>
  `;
}

function renderPersonaHeaderRow(group, colCount, ctx) {
  const escapedKey = escapeAttr(group.key);
  const escapedLabel = escapeAttr(group.label);
  const personaAttr = group.personaId ? escapeAttr(group.personaId) : '';
  const rowExtra = group.variant === 'rejected' ? ' kategorie-header-row--rejected' : '';
  const headerExtra = group.variant === 'rejected'
    ? ' kategorie-header--rejected'
    : group.variant === 'default'
      ? ' kategorie-header--default'
      : '';
  const label = group.variant === 'rejected'
    ? `${NICHT_UMSETZEN_ICON} ${escapedLabel}`
    : escapedLabel;
  const checkboxTitle = group.key === OHNE_PERSONA_KEY
    ? 'Alle ohne Persona auswählen'
    : `Alle in '${group.label}' auswählen`;
  const checkbox = !ctx.isKunde && (ctx.canEdit ?? true)
    ? `<input type="checkbox" class="sourcing-group-select" data-group-key="${escapedKey}" title="${escapeAttr(checkboxTitle)}">`
    : '';

  return `
      <tr class="kategorie-header-row${rowExtra}" data-group-key="${escapedKey}" data-persona-id="${personaAttr}">
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
  return `<tbody class="persona-group-tbody" data-group-key="${escapeAttr(groupKey || OHNE_PERSONA_KEY)}">${innerHtml}</tbody>`;
}

export function renderGroupedItems(ctx) {
  const personas = ctx.personas || [];
  const items = ctx.items || [];

  if (!personas.length) {
    const orphanGroups = orderedPersonaGroups(items, []);
    if (orphanGroups.length <= 1 && orphanGroups[0]?.key === OHNE_PERSONA_KEY) {
      const rows = items.map((item, index) => renderItemRow(ctx, item, index)).join('');
      return wrapGroupTbody(OHNE_PERSONA_KEY, rows);
    }
  }

  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const canWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  const colCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns, { canEdit: canWrite, hasActions }) + customCount;

  let html = '';
  let globalIndex = 0;
  for (const group of orderedPersonaGroups(items, personas)) {
    let inner = renderPersonaHeaderRow(group, colCount, ctx);
    for (const item of group.items) {
      inner += renderItemRow(ctx, item, globalIndex++);
    }
    html += wrapGroupTbody(group.key, inner);
  }

  return html;
}

