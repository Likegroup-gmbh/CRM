// CreatorAuswahlTemplates.js
// Reine Render-Funktionen und Shared Helpers fuer die Creator-Auswahl Detail-Ansicht

import { CREATOR_TYP_OPTIONS } from './creatorTypeOptions.js';

// --- Shared Helpers ---

export function getTeilbereicheFromListe(liste) {
  if (!liste?.teilbereich) return [];
  return liste.teilbereich.split(',').map(tb => tb.trim()).filter(tb => tb);
}

export function groupItemsByKategorie(items) {
  const groups = {};
  let globalIndex = 0;

  items.forEach(item => {
    const kategorie = item.kategorie || 'Ohne Kategorie';
    if (!groups[kategorie]) {
      groups[kategorie] = [];
    }
    groups[kategorie].push({ ...item, globalIndex: globalIndex++ });
  });

  return groups;
}

export function isColumnVisibleForCustomer(columnClass, isKunde, hiddenColumns) {
  if (columnClass === 'cp-col-name' || columnClass === 'cp-col-actions' || columnClass === 'cp-col-drag') {
    return true;
  }

  if (isKunde && columnClass === 'cp-col-vk') return false;

  return !hiddenColumns.includes(columnClass);
}

export function getVisibleColumnCount(isKunde, hiddenColumns) {
  const allColumns = [
    'cp-col-drag', 'cp-col-name', 'cp-col-typ', 'cp-col-links', 'cp-col-follower-ig',
    'cp-col-follower-tt', 'cp-col-ek', 'cp-col-vk', 'cp-col-pricing',
    'cp-col-reichweite-ig', 'cp-col-reichweite-tt', 'cp-col-reichweite-garantie',
    'cp-col-cpm-ig', 'cp-col-cpm-tt',
    'cp-col-location', 'cp-col-notiz',
    'cp-col-feedback', 'cp-col-anfragen', 'cp-col-onhold', 'cp-col-buchen', 'cp-col-prio1', 'cp-col-prio2', 'cp-col-absagen', 'cp-col-check', 'cp-col-actions'
  ];

  let count = 0;
  for (const col of allColumns) {
    if (col === 'cp-col-drag' && isKunde) continue;
    if (col === 'cp-col-actions' && isKunde) continue;
    if (isColumnVisibleForCustomer(col, isKunde, hiddenColumns)) count++;
  }
  return count;
}

// --- SVG Icons ---

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;

const INSTAGRAM_ICON = `<svg class="platform-icon platform-icon--instagram" viewBox="0 0 24 24" aria-label="Instagram" role="img" focusable="false"><path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/><path d="M16.95 6.45a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"/><path d="M12 2.8c2.53 0 2.83.01 3.83.06 1 .05 1.68.21 2.28.44.62.24 1.15.56 1.66 1.07.51.51.83 1.04 1.07 1.66.23.6.39 1.28.44 2.28.05 1 .06 1.3.06 3.83s-.01 2.83-.06 3.83c-.05 1-.21 1.68-.44 2.28-.24.62-.56 1.15-1.07 1.66-.51.51-1.04.83-1.66 1.07-.6.23-1.28.39-2.28.44-1 .05-1.3.06-3.83.06s-2.83-.01-3.83-.06c-1-.05-1.68-.21-2.28-.44a4.54 4.54 0 0 1-2.73-2.73c-.23-.6-.39-1.28-.44-2.28C2.81 14.83 2.8 14.53 2.8 12s.01-2.83.06-3.83c.05-1 .21-1.68.44-2.28.24-.62.56-1.15 1.07-1.66.51-.51 1.04-.83 1.66-1.07.6-.23 1.28-.39 2.28-.44 1-.05 1.3-.06 3.83-.06Zm0 1.8c-2.48 0-2.77.01-3.75.06-.9.04-1.39.19-1.71.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.81-.31 1.71-.05.98-.06 1.27-.06 3.75s.01 2.77.06 3.75c.04.9.19 1.39.31 1.71.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.81.27 1.71.31.98.05 1.27.06 3.75.06s2.77-.01 3.75-.06c.9-.04 1.39-.19 1.71-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.81.31-1.71.05-.98.06-1.27.06-3.75s-.01-2.77-.06-3.75c-.04-.9-.19-1.39-.31-1.71-.17-.43-.37-.74-.7-1.07-.33-.33-.64-.53-1.07-.7-.32-.12-.81-.27-1.71-.31-.98-.05-1.27-.06-3.75-.06Z"/></svg>`;

const TIKTOK_ICON = `<svg class="platform-icon platform-icon--tiktok" viewBox="0 0 24 24" aria-label="TikTok" role="img" focusable="false"><path d="M14.5 3c.4 3.2 2.3 5.1 5.5 5.5v2.3c-1.9 0-3.6-.6-5-1.7v6.4c0 3.1-2.5 5.6-5.6 5.6S3.8 19 3.8 15.9s2.5-5.6 5.6-5.6c.5 0 1 .1 1.5.2v2.6c-.5-.2-1-.4-1.5-.4-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.9Z"/></svg>`;

const NICHT_UMSETZEN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>`;

// --- Status-Reiter (Tabs) ---

export const SOURCING_TABS = [
  { key: 'offen', label: 'Offen' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'gebucht', label: 'Gebucht' },
  { key: 'nicht_buchen', label: 'Nicht buchen' },
  { key: 'alle', label: 'Alle' }
];

export function getSourcingTabForItem(item) {
  if (item.absage) return 'nicht_buchen';
  if (item.gebucht) return 'gebucht';
  if (item.on_hold) return 'on_hold';
  return 'offen';
}

export function renderTabNavigation(ctx) {
  const activeTab = ctx.activeTab || 'offen';
  const counts = ctx.tabCounts || {};
  return `
    <div class="tab-navigation sourcing-tab-navigation">
      ${SOURCING_TABS.map(tab => `
        <button type="button" class="tab-button${tab.key === activeTab ? ' active' : ''}" data-sourcing-tab="${tab.key}">
          ${tab.label} <span class="tab-count" data-sourcing-tab-count="${tab.key}">${counts[tab.key] ?? 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// --- Render-Funktionen ---
// ctx = { items, liste, isKunde, hiddenColumns }

export function renderAddSection(ctx = {}) {
  const kundenCallActive = ctx.kundenCallActive || false;
  return `
    <div class="add-item-section add-item-section--compact">
      <div class="add-item-actions-right">
        <button type="button" class="secondary-btn" id="btn-share-sourcing" title="Liste per E-Mail teilen">
          Teilen
        </button>
        <button type="button" class="secondary-btn${kundenCallActive ? ' active' : ''}" id="btn-kunden-call-toggle" title="EK und CPM für Kundenpräsentation ausblenden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
          Kunden Call
        </button>
        <button type="button" class="secondary-btn" id="btn-sourcing-detail-column-visibility">
          Sichtbarkeit anpassen
        </button>
        <button type="button" class="secondary-btn" id="btn-sourcing-custom-columns" title="Eigene Spalten verwalten">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Eigene Spalten
        </button>
        <button type="button" class="secondary-btn" id="btn-manage-kategorien" title="Kategorien verwalten">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
          Kategorien
        </button>
        <button type="button" class="primary-btn" id="btn-open-add-drawer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Creator hinzufügen
        </button>
      </div>
    </div>
  `;
}

export function renderItemsTable(ctx) {
  if (ctx.items.length === 0 && ctx.hasAnyItems && ctx.activeTab && ctx.activeTab !== 'alle') {
    const tabLabel = SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab;
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <p>Keine Creator im Reiter "${tabLabel}"</p>
      </div>
    `;
  }
  if (ctx.items.length === 0) {
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        <p>Noch keine Creator hinzugefügt</p>
        ${!ctx.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben einen Creator hinzu</p>' : ''}
      </div>
    `;
  }

  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const visibleColCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns) + customCount;
  const hide = (col) => !vis(col) ? 'style="display:none;"' : '';

  return `
    <div class="table-container creator-pool-table-container">
      <table class="data-table strategie-items-table creator-pool-table${!ctx.isKunde ? ' has-bulk-select' : ''}">
        <thead>
          <tr>
            ${!ctx.isKunde ? '<th class="col-drag col-sticky-1 cp-col-drag"><input type="checkbox" class="sourcing-select-all" title="Alle auswählen"></th>' : ''}
            <th class="${ctx.isKunde ? 'col-sticky-1' : 'col-sticky-2'} cp-col-name">Name</th>
            <th class="cp-col-typ" ${hide('cp-col-typ')}>Creator Art</th>
            <th class="cp-col-links" ${hide('cp-col-links')}>Links</th>
            <th class="cp-col-follower-ig" ${hide('cp-col-follower-ig')}>Follower ${INSTAGRAM_ICON}</th>
            <th class="cp-col-follower-tt" ${hide('cp-col-follower-tt')}>Follower ${TIKTOK_ICON}</th>
            <th class="cp-col-ek" ${hide('cp-col-ek')}>EK</th>
            <th class="cp-col-vk" ${hide('cp-col-vk')}>VK</th>
            <th class="cp-col-pricing" ${hide('cp-col-pricing')}>Pricing</th>
            <th class="cp-col-reichweite-ig" ${hide('cp-col-reichweite-ig')}>Reichweite ${INSTAGRAM_ICON}</th>
            <th class="cp-col-reichweite-tt" ${hide('cp-col-reichweite-tt')}>Reichweite ${TIKTOK_ICON}</th>
            <th class="cp-col-reichweite-garantie" ${hide('cp-col-reichweite-garantie')}>RW Garantie</th>
            <th class="cp-col-cpm-ig" ${hide('cp-col-cpm-ig')}>CPM ${INSTAGRAM_ICON}</th>
            <th class="cp-col-cpm-tt" ${hide('cp-col-cpm-tt')}>CPM ${TIKTOK_ICON}</th>
            <th class="cp-col-location" ${hide('cp-col-location')}>Location</th>
            <th class="cp-col-notiz" ${hide('cp-col-notiz')}>Kurzbeschreibung</th>
            <th class="cp-col-feedback" ${hide('cp-col-feedback')}>Rückmeldung Kunde</th>
            <th class="cp-col-anfragen" ${hide('cp-col-anfragen')}>Anfragen</th>
            <th class="cp-col-onhold" ${hide('cp-col-onhold')}>On Hold</th>
            <th class="cp-col-buchen" ${hide('cp-col-buchen')}>Buchen</th>
            <th class="cp-col-prio1" ${hide('cp-col-prio1')}>Prio 1</th>
            <th class="cp-col-prio2" ${hide('cp-col-prio2')}>Prio 2</th>
            <th class="cp-col-absagen" ${hide('cp-col-absagen')}>Absagen</th>
            <th class="cp-col-check" ${hide('cp-col-check')}>Rückmeldung</th>
            ${ctx.customManager ? ctx.customManager.renderHeaders(ctx.hiddenColumns, ctx.isKunde) : ''}
            ${!ctx.isKunde ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="items-table-body">
          ${renderGroupedItems(ctx)}
        </tbody>
        ${!ctx.isKunde ? `
        <tfoot>
          <tr class="add-row-footer">
            <td colspan="${visibleColCount}">
              <button type="button" class="add-row-btn" id="btn-add-empty-row" title="Neue Zeile hinzufügen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </td>
          </tr>
        </tfoot>
        ` : ''}
      </table>
    </div>
  `;
}

export function renderGroupedItems(ctx) {
  const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
  const definierteKategorien = getTeilbereicheFromListe(ctx.liste);
  const hatDefinierteKategorien = definierteKategorien.length > 0;

  if (!hatDefinierteKategorien) {
    return ctx.items.map((item, index) => renderItemRow(ctx, item, index)).join('');
  }

  const groupedItems = groupItemsByKategorie(ctx.items);
  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const colCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns) + customCount;

  let html = '';
  let globalIndex = 0;

  const normaleKategorien = definierteKategorien.filter(k => k !== NICHT_UMSETZEN_KATEGORIE);

  for (const kategorie of normaleKategorien) {
    const items = groupedItems[kategorie] || [];
    html += `
      <tr class="kategorie-header-row" data-kategorie="${kategorie}">
        <td colspan="${colCount}" class="kategorie-header">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="${kategorie}" title="Alle in '${kategorie}' auswählen">` : ''}
            <span class="kategorie-label">${kategorie}</span>
            <span class="kategorie-count">(${items.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of items) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  const ohneKategorie = groupedItems['Ohne Kategorie'] || [];
  if (ohneKategorie.length > 0 || normaleKategorien.length > 0) {
    html += `
      <tr class="kategorie-header-row" data-kategorie="Ohne Kategorie">
        <td colspan="${colCount}" class="kategorie-header kategorie-header--default">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="Ohne Kategorie" title="Alle ohne Kategorie auswählen">` : ''}
            <span class="kategorie-label">Ohne Kategorie</span>
            <span class="kategorie-count">(${ohneKategorie.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of ohneKategorie) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  const nichtUmsetzenItems = groupedItems[NICHT_UMSETZEN_KATEGORIE] || [];
  if (nichtUmsetzenItems.length > 0 || definierteKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
    html += `
      <tr class="kategorie-header-row kategorie-header-row--rejected" data-kategorie="${NICHT_UMSETZEN_KATEGORIE}">
        <td colspan="${colCount}" class="kategorie-header kategorie-header--rejected">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="${NICHT_UMSETZEN_KATEGORIE}" title="Alle in 'Nicht umsetzen' auswählen">` : ''}
            <span class="kategorie-label">${NICHT_UMSETZEN_ICON} ${NICHT_UMSETZEN_KATEGORIE}</span>
            <span class="kategorie-count">(${nichtUmsetzenItems.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of nichtUmsetzenItems) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  return html;
}

export function renderItemRow(ctx, item, index) {
  const isLinkedToCRM = !!item.creator_id;
  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const hide = (col) => !vis(col) ? ' display:none;' : '';

  const formatFollower = (count) => {
    if (!count) return '';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toLocaleString('de-DE');
  };

  const typOptionsHtml = CREATOR_TYP_OPTIONS
    .map(typ => `<option value="${typ}" ${item.typ === typ ? 'selected' : ''}>${typ}</option>`)
    .join('');

  const isBooked = !!item.gebucht;

  return `
    <tr class="item-row ${!ctx.isKunde ? 'draggable' : ''} ${isBooked ? 'item-gebucht' : ''}" data-item-id="${item.id}" draggable="false">
      ${!ctx.isKunde ? `
        <td class="col-drag drag-handle col-sticky-1">
          <div class="drag-cell-content">
            <input type="checkbox" class="sourcing-item-check" data-item-id="${item.id}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </div>
        </td>
      ` : ''}
      <td class="cell-textarea cp-col-name ${ctx.isKunde ? 'col-sticky-1' : 'col-sticky-2'}">
        ${!ctx.isKunde ? `
          <div class="cp-name-cell-inner">
            <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
          </div>
        ` : `<div class="cell-text-readonly">${item.name || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-typ" style="${hide('cp-col-typ')}">
        ${!ctx.isKunde ? `
          <select class="strategie-textarea" data-field="typ" data-item-id="${item.id}" style="border: none; background: transparent; cursor: pointer;">
            <option value="">-</option>
            ${typOptionsHtml}
          </select>
        ` : `<div class="cell-text-readonly">${item.typ || '-'}</div>`}
      </td>
      <td class="cp-col-links" style="${hide('cp-col-links')}">
        ${!ctx.isKunde ? `
          <div class="links-compact-cell">
            <div class="links-compact-row">
              ${INSTAGRAM_ICON}
              <input type="text" class="links-compact-input" data-field="link_instagram" data-item-id="${item.id}" placeholder="IG Link..." value="${item.link_instagram || ''}">
              ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${EXTERNAL_LINK_ICON}</a>` : ''}
            </div>
            <div class="links-compact-row">
              ${TIKTOK_ICON}
              <input type="text" class="links-compact-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="TT Link..." value="${item.link_tiktok || ''}">
              ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${EXTERNAL_LINK_ICON}</a>` : ''}
            </div>
          </div>
        ` : `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="Instagram">${INSTAGRAM_ICON}</a>` : ''}
            ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="TikTok">${TIKTOK_ICON}</a>` : ''}
            ${!item.link_instagram && !item.link_tiktok ? '<span class="cell-text-readonly">-</span>' : ''}
          </div>
        `}
      </td>
      <td class="cell-textarea cp-col-follower-ig" style="${hide('cp-col-follower-ig')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="follower_instagram" data-item-id="${item.id}" placeholder="0">${item.follower_instagram || ''}</textarea>
        ` : `<div class="cell-text-readonly">${formatFollower(item.follower_instagram) || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-follower-tt" style="${hide('cp-col-follower-tt')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="follower_tiktok" data-item-id="${item.id}" placeholder="0">${item.follower_tiktok || ''}</textarea>
        ` : `<div class="cell-text-readonly">${formatFollower(item.follower_tiktok) || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-ek" style="${hide('cp-col-ek')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea${ctx.kundenCallActive ? ' kunden-call-blur' : ''}" data-field="preis_ek" data-item-id="${item.id}" data-blur-target placeholder="0" value="${item.preis_ek ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">${item.preis_ek != null ? Number(item.preis_ek).toLocaleString('de-DE', {minimumFractionDigits: 0}) + ' €' : '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-vk" style="${hide('cp-col-vk')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea" data-field="preis_vk" data-item-id="${item.id}" placeholder="0" value="${item.preis_vk ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">-</div>`}
      </td>
      <td class="cell-textarea cp-col-pricing" style="${hide('cp-col-pricing')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="pricing" data-item-id="${item.id}" placeholder="Preis...">${item.pricing || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.pricing || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-reichweite-ig" style="${hide('cp-col-reichweite-ig')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_instagram" data-item-id="${item.id}" placeholder="z.B. 10K" value="${item.reichweite_instagram || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_instagram || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-reichweite-tt" style="${hide('cp-col-reichweite-tt')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_tiktok" data-item-id="${item.id}" placeholder="z.B. 10K" value="${item.reichweite_tiktok || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_tiktok || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-reichweite-garantie" style="${hide('cp-col-reichweite-garantie')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_garantie" data-item-id="${item.id}" placeholder="z.B. 50K" value="${item.reichweite_garantie || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_garantie || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-cpm-ig" style="${hide('cp-col-cpm-ig')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea${ctx.kundenCallActive ? ' kunden-call-blur' : ''}" data-field="cpm_instagram" data-item-id="${item.id}" data-blur-target placeholder="0" value="${item.cpm_instagram ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">${item.cpm_instagram != null ? Number(item.cpm_instagram).toLocaleString('de-DE', {minimumFractionDigits: 2}) + ' €' : '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-cpm-tt" style="${hide('cp-col-cpm-tt')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea${ctx.kundenCallActive ? ' kunden-call-blur' : ''}" data-field="cpm_tiktok" data-item-id="${item.id}" data-blur-target placeholder="0" value="${item.cpm_tiktok ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">${item.cpm_tiktok != null ? Number(item.cpm_tiktok).toLocaleString('de-DE', {minimumFractionDigits: 2}) + ' €' : '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-location" style="${hide('cp-col-location')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="wohnort" data-item-id="${item.id}" placeholder="Location...">${item.wohnort || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.wohnort || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-notiz" style="${hide('cp-col-notiz')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="notiz" data-item-id="${item.id}" placeholder="Kurzbeschreibung...">${item.notiz || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.notiz || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-feedback" style="${hide('cp-col-feedback')}">
        <textarea
          class="strategie-textarea auto-resize-textarea ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly-textarea'}"
          data-field="feedback_kunde"
          data-item-id="${item.id}"
          placeholder="${(ctx.isKunde && !ctx.gastReadonly) ? 'Ihr Feedback...' : 'Rückmeldung Kunde...'}"
          ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly'}
        >${item.feedback_kunde || ''}</textarea>
        ${item.feedback_kunde && item.feedback_kunde_author_name ? `
          <div class="feedback-author-meta" style="font-size:0.72rem;color:var(--text-secondary,#999);padding:2px 4px;">
            ${item.feedback_kunde_author_name}${item.feedback_kunde_updated_at ? ` · ${new Date(item.feedback_kunde_updated_at).toLocaleDateString('de-DE')}` : ''}
          </div>` : ''}
      </td>
      <td class="cp-col-anfragen" style="${hide('cp-col-anfragen')}">
        <div class="angefragt-cell">
          <input
            type="checkbox"
            ${item.angefragt ? 'checked' : ''}
            data-field="angefragt"
            data-item-id="${item.id}"
            class="cp-checkbox${ctx.isKunde ? ' cp-checkbox--readonly' : ''}"
            ${ctx.isKunde ? 'disabled' : ''}
          >
          ${item.angefragt_am ? `<span class="angefragt-datum">${new Date(item.angefragt_am).toLocaleDateString('de-DE')}</span>` : ''}
        </div>
      </td>
      <td class="cp-col-onhold" style="${hide('cp-col-onhold')}">
        <div class="onhold-cell">
          <input type="checkbox" ${item.on_hold ? 'checked' : ''} data-field="on_hold" data-item-id="${item.id}" class="cp-checkbox${(item.absage || ctx.gastReadonly) ? ' cp-checkbox--disabled' : ''}" ${(item.absage || ctx.gastReadonly) ? 'disabled' : ''}>
          ${item.on_hold_am ? `<span class="onhold-datum">${new Date(item.on_hold_am).toLocaleDateString('de-DE')}</span>` : ''}
        </div>
      </td>
      <td class="cp-col-buchen" style="${hide('cp-col-buchen')}">
        <input type="checkbox" ${item.gebucht ? 'checked' : ''} data-field="gebucht" data-item-id="${item.id}" class="cp-checkbox${(item.absage || ctx.gastReadonly) ? ' cp-checkbox--disabled' : ''}" ${(item.absage || ctx.gastReadonly) ? 'disabled' : ''}>
      </td>
      <td class="cp-col-prio1" style="${hide('cp-col-prio1')}">
        <input type="checkbox" ${item.prio_1 ? 'checked' : ''} data-field="prio_1" data-item-id="${item.id}" class="cp-checkbox${(item.absage || ctx.gastReadonly) ? ' cp-checkbox--disabled' : ''}" ${(item.absage || ctx.gastReadonly) ? 'disabled' : ''}>
      </td>
      <td class="cp-col-prio2" style="${hide('cp-col-prio2')}">
        <input type="checkbox" ${item.prio_2 ? 'checked' : ''} data-field="prio_2" data-item-id="${item.id}" class="cp-checkbox${(item.absage || ctx.gastReadonly) ? ' cp-checkbox--disabled' : ''}" ${(item.absage || ctx.gastReadonly) ? 'disabled' : ''}>
      </td>
      <td class="cp-col-absagen" style="${hide('cp-col-absagen')}">
        <div class="absage-cell">
          <input
            type="checkbox"
            ${item.absage ? 'checked' : ''}
            data-field="absage"
            data-item-id="${item.id}"
            class="cp-checkbox${ctx.isKunde ? ' cp-checkbox--readonly' : ''}"
            ${ctx.isKunde ? 'disabled' : ''}
          >
          ${item.absage_am ? `<span class="absage-datum">${new Date(item.absage_am).toLocaleDateString('de-DE')}</span>` : ''}
        </div>
      </td>
      <td class="cp-col-check" style="${hide('cp-col-check')}">
        <input
          type="checkbox"
          ${item.rueckmeldung_creator ? 'checked' : ''}
          data-field="rueckmeldung_creator"
          data-item-id="${item.id}"
          class="cp-checkbox${ctx.isKunde ? ' cp-checkbox--readonly' : ''}"
          ${ctx.isKunde ? 'disabled' : ''}
        >
      </td>
      ${ctx.customManager ? ctx.customManager.renderCells(item.id, ctx.hiddenColumns, ctx.isKunde) : ''}
      ${!ctx.isKunde ? `
        <td class="col-actions">
          <div class="actions-dropdown-container" data-entity-type="creator_auswahl_item">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              ${''}
              <!-- CRM-Uebernahme vorerst ausgeblendet -->
              <a href="#" class="action-item action-danger" data-action="delete-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                Löschen
              </a>
            </div>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}
