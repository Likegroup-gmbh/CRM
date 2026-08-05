// StrategieDetailRenderer.js
// Tabellen-Rendering für die Strategie-Detail-Ansicht

import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from './strategiePrioOptions.js';
import { isFixedColumnVisible } from './strategieColumns.js';

/** Klartext zu verarbeitung_step fuer die Fortschrittsanzeige in der Zeile. */
const VERARBEITUNG_LABELS = {
  browser: 'Browser startet...',
  screenshot: 'Screenshot...',
  navigation: 'Seite laden...',
  captions: 'Untertitel...',
  download: 'Video laden...',
  whisper: 'Transkription...',
  description: 'Beschreibung...',
  done: 'Fertig'
};

const TRANSKRIPT_QUELLE_LABELS = {
  whisper: 'Whisper',
  native_captions: 'Untertitel'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Welche festen Spalten diese Ansicht zeigt. */
function visibleFixedColumns(detail) {
  const visible = (key) => isFixedColumnVisible(detail.hiddenColumns, key);
  return {
    creator: visible('creator'),
    beschreibung: visible('beschreibung'),
    transkript: visible('transkript'),
    caption: visible('caption'),
    anmerkung: visible('anmerkung'),
    prio: visible('prio'),
    umgesetzt: visible('umgesetzt')
  };
}

export function renderItemsTable(detail) {
  if (detail.items.length === 0) {
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
        <p>Noch keine Videos hinzugefügt</p>
        ${!detail.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben eine Video-URL ein, um zu starten</p>' : ''}
      </div>
    `;
  }

  const groupedItems = groupItemsByTeilbereich(detail.items);
  const customCount = detail.customColumns ? detail.customColumns.visibleCount(detail.hiddenColumns, detail.isKunde) : 0;
  const cols = visibleFixedColumns(detail);

  // #, Bild, Plattform, Link sind immer da; Drag und Aktionen nur intern
  const fixedCount = 4
    + (detail.isKunde ? 0 : 2)
    + Object.values(cols).filter(Boolean).length;
  const colCount = fixedCount + customCount;

  return `
    <div class="table-container">
      <table class="data-table strategie-items-table">
        <thead>
          <tr>
            <th class="col-number">#</th>
            ${!detail.isKunde ? '<th class="col-drag"></th>' : ''}
            <th class="col-image">Bild</th>
            <th class="col-platform">Plattform</th>
            <th class="col-link">Link</th>
            ${cols.creator ? '<th class="col-creator">Creator</th>' : ''}
            ${cols.beschreibung ? '<th class="col-beschreibung">Beschreibung</th>' : ''}
            ${cols.transkript ? '<th class="col-transkript">Transkript</th>' : ''}
            ${cols.caption ? '<th class="col-caption">Caption</th>' : ''}
            ${cols.anmerkung ? '<th class="col-anmerkung">Anmerkung Kunde</th>' : ''}
            ${cols.prio ? '<th class="col-prio">Prio</th>' : ''}
            ${cols.umgesetzt ? '<th class="col-umgesetzt">Umgesetzt</th>' : ''}
            ${detail.customColumns ? detail.customColumns.renderHeaders(detail.hiddenColumns, detail.isKunde) : ''}
            ${!detail.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="items-table-body">
          ${renderGroupedItems(detail, groupedItems, colCount)}
        </tbody>
      </table>
    </div>
  `;
}

export function groupItemsByTeilbereich(items) {
  const groups = {};
  let globalIndex = 0;
  
  items.forEach(item => {
    const teilbereich = item.teilbereich || 'Ohne Kategorie';
    if (!groups[teilbereich]) {
      groups[teilbereich] = [];
    }
    groups[teilbereich].push({ ...item, globalIndex: globalIndex++ });
  });
  
  return groups;
}

export function renderGroupedItems(detail, groupedItems, colCount) {
  const definierteKategorien = detail.getTeilbereicheFromStrategie();
  const hatDefinierteKategorien = definierteKategorien.length > 0;
  
  if (!hatDefinierteKategorien && Object.keys(groupedItems).length === 1 && groupedItems['Ohne Kategorie']) {
    return groupedItems['Ohne Kategorie']
      .map(item => renderItemRow(detail, item, item.globalIndex))
      .join('');
  }
  
  const alleKategorien = [...definierteKategorien];
  if (!alleKategorien.includes('Ohne Kategorie')) {
    alleKategorien.push('Ohne Kategorie');
  }
  
  return alleKategorien.map(kategorie => {
    const items = groupedItems[kategorie] || [];
    const isEmpty = items.length === 0;
    
    return `
      <tr class="category-header-row ${isEmpty ? 'category-empty' : ''}" data-kategorie="${escapeAttr(kategorie)}">
        <td colspan="${colCount}" class="category-header-cell">
          <span class="category-name">${escapeAttr(kategorie)}</span>
          ${isEmpty ? '<span class="category-empty-hint">(leer - Videos hierher ziehen)</span>' : ''}
        </td>
      </tr>
      ${items.map(item => renderItemRow(detail, item, item.globalIndex)).join('')}
    `;
  }).join('');
}

/**
 * Bild-Zelle: Screenshot, Ideen-Platzhalter oder der Stand der Verarbeitung.
 * Der Screenshot wird noch vor dem Transkript geschrieben, deshalb kann hier
 * schon das Bild stehen, waehrend Whisper laeuft.
 */
function renderBildCell(item, isIdea, ideaIcon) {
  const status = item.verarbeitung_status;
  const laeuft = status === 'processing' || status === 'pending';

  const bild = item.screenshot_url
    ? `<img src="${escapeAttr(item.screenshot_url)}" alt="Screenshot" class="strategie-screenshot" onclick="window.open('${escapeAttr(item.screenshot_url)}', '_blank')">`
    : isIdea
      ? `<div class="idea-placeholder">${ideaIcon}<span>Idee</span></div>`
      : `<div class="strategie-screenshot-placeholder"><span>${laeuft ? 'Lädt...' : 'Kein Bild'}</span></div>`;

  if (laeuft) {
    const label = status === 'pending'
      ? 'In der Warteschlange'
      : (VERARBEITUNG_LABELS[item.verarbeitung_step] || 'Verarbeitung läuft...');
    return `
      <td class="col-image">
        ${bild}
        <div class="verarbeitung-status verarbeitung-status--laeuft">
          <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="12" height="12">
            <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
          </svg>
          <span>${escapeHtml(label)}</span>
        </div>
      </td>
    `;
  }

  if (status === 'error') {
    return `
      <td class="col-image">
        ${bild}
        <div class="verarbeitung-status verarbeitung-status--fehler" title="${escapeAttr(item.verarbeitung_fehler || 'Unbekannter Fehler')}">
          Verarbeitung fehlgeschlagen
        </div>
      </td>
    `;
  }

  return `<td class="col-image">${bild}</td>`;
}

/**
 * Lange Texte (Transkript, Caption) als zweizeilige Vorschau. Der Volltext waere
 * in einer Tabellenzelle unlesbar und oeffnet sich per Klick in einem Drawer.
 */
function renderLongTextCell(item, field, cssClass) {
  const value = (item[field] || '').trim();
  if (!value) {
    return `<td class="${cssClass}"><span class="cell-empty">–</span></td>`;
  }

  const quelle = field === 'transkript' ? TRANSKRIPT_QUELLE_LABELS[item.transkript_quelle] : null;

  return `
    <td class="${cssClass}">
      <button type="button" class="cell-longtext" data-action="show-longtext"
              data-item-id="${item.id}" data-field="${field}"
              title="Volltext anzeigen">
        <span class="cell-longtext__preview">${escapeHtml(value)}</span>
        <span class="cell-longtext__meta">
          ${value.length} Zeichen${quelle ? ` · ${quelle}` : ''}
        </span>
      </button>
    </td>
  `;
}

export function renderItemRow(detail, item, index) {
  const platformIcon = getPlatformIcon(item.plattform);
  const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;
  const ideaIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; color: var(--amber-500);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`;
  const isIdea = !item.video_link;
  const isLinked = !!item.linked_video;
  const isUmgesetzt = !!item.video_umgesetzt;
  const cols = visibleFixedColumns(detail);
  const readonly = !!window.isGastReadonly?.();

  const rowClasses = [
    'item-row',
    !detail.isKunde ? 'draggable' : '',
    isIdea ? 'idea-row' : '',
    isUmgesetzt ? 'strategie-item-umgesetzt' : '',
    item.nicht_umsetzen ? 'item-nicht-umsetzen' : '',
  ].filter(Boolean).join(' ');

  return `
    <tr class="${rowClasses}" data-item-id="${item.id}" draggable="false">
      <td class="col-number">
        ${index + 1}
      </td>
      ${!detail.isKunde ? `
        <td class="col-drag drag-handle">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </td>
      ` : ''}
      ${renderBildCell(item, isIdea, ideaIcon)}
      <td style="text-align: center;">
        ${isIdea ? `<span style="font-size: var(--text-xs); color: var(--text-muted);">-</span>` : platformIcon}
      </td>
      <td style="text-align: center;">
        ${item.video_link ? `
          <a href="${item.video_link}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); display: inline-flex;" title="${item.video_link}">
            ${externalLinkIcon}
          </a>
        ` : `<span style="font-size: var(--text-xs); color: var(--text-muted);">-</span>`}
      </td>
      ${cols.creator ? `
        <td class="cell-textarea">
          <textarea 
            class="strategie-textarea${readonly ? ' readonly-textarea' : ''}" 
            placeholder="Creator..."
            data-field="creator_name"
            data-item-id="${item.id}"
            ${readonly ? 'readonly' : ''}
          >${item.creator_name || ''}</textarea>
        </td>
      ` : ''}
      ${cols.beschreibung ? `
        <td class="cell-textarea">
          ${item.beschreibung_quelle === 'ki' && item.beschreibung ? `
            <span class="ki-tag" title="Automatisch aus dem Transkript erzeugt – beim Bearbeiten verschwindet die Markierung">KI</span>
          ` : ''}
          ${!detail.isKunde ? `
            <textarea 
              class="strategie-textarea" 
              placeholder="Beschreibung..."
              data-field="beschreibung"
              data-item-id="${item.id}"
            >${item.beschreibung || ''}</textarea>
          ` : `
            <div class="cell-text-readonly">${item.beschreibung || '-'}</div>
          `}
        </td>
      ` : ''}
      ${cols.transkript ? renderLongTextCell(item, 'transkript', 'col-transkript') : ''}
      ${cols.caption ? renderLongTextCell(item, 'caption', 'col-caption') : ''}
      ${cols.anmerkung ? `
        <td class="cell-textarea">
          <textarea 
            class="strategie-textarea ${(detail.isKunde && !readonly) ? '' : 'readonly-textarea'}" 
            placeholder="${(detail.isKunde && !readonly) ? 'Ihre Anmerkung...' : 'Anmerkung Kunde...'}"
            data-field="kunde_anmerkung"
            data-item-id="${item.id}"
            ${(detail.isKunde && !readonly) ? '' : 'readonly'}
          >${item.kunde_anmerkung || ''}</textarea>
          ${item.kunde_anmerkung && item.kunde_anmerkung_author_name ? `
            <div class="feedback-author-meta" style="font-size:0.72rem;color:var(--text-secondary,#999);padding:2px 4px;">
              ${item.kunde_anmerkung_author_name}${item.kunde_anmerkung_updated_at ? ` · ${new Date(item.kunde_anmerkung_updated_at).toLocaleDateString('de-DE')}` : ''}
            </div>` : ''}
        </td>
      ` : ''}
      ${cols.prio ? `
        <td class="col-prio">
          ${renderTableSelect({
            field: 'strategie_prio',
            itemId: item.id,
            value: getStrategiePrio(item),
            options: STRATEGIE_PRIO_OPTIONS,
            disabled: readonly || detail.isKunde
          })}
        </td>
      ` : ''}
      ${cols.umgesetzt ? `
        <td class="col-umgesetzt" style="text-align: center;">
          <label class="toggle-switch strategie-umgesetzt-toggle-wrapper">
            <input type="checkbox"
              class="strategie-umgesetzt-toggle"
              data-field="video_umgesetzt"
              data-item-id="${item.id}"
              ${readonly ? 'disabled' : ''}
              ${isUmgesetzt ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
      ` : ''}
      ${detail.customColumns ? detail.customColumns.renderCells(item.id, detail.hiddenColumns, detail.isKunde) : ''}
      ${!detail.isKunde ? `
        <td class="col-actions">
          <div class="actions-dropdown-container" data-entity-type="strategie_item">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="edit-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                Bearbeiten
              </a>
              ${item.video_link ? `
                <a href="#" class="action-item" data-action="reprocess-item" data-id="${item.id}">
                  ${window.ActionsDropdown?.getHeroIcon('refresh') || ''}
                  Neu verarbeiten
                </a>
              ` : ''}
              ${isLinked ? `
                <a href="#" class="action-item action-warning" data-action="unlink-from-video" data-id="${item.id}" data-video-id="${item.linked_video.id}">
                  ${window.ActionsDropdown?.getHeroIcon('unlink') || ''}
                  Idee von Video entfernen
                </a>
              ` : `
                <a href="#" class="action-item" data-action="add-to-video" data-id="${item.id}">
                  ${window.ActionsDropdown?.getHeroIcon('add-to-list') || ''}
                  Zu Video hinzufügen
                </a>
              `}
              <div class="action-separator"></div>
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

export function getPlatformIcon(platform) {
  const icons = {
    youtube: `<svg style="width: 20px; height: 20px; color: #FF0000;" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    tiktok: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
    instagram: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`
  };
  return icons[platform] || '';
}

/**
 * Nur eine Zeile neu zeichnen - fuer Realtime-Updates aus der Background
 * Function. Ein Komplett-Rerender wuerde offene Textareas mitsamt Eingabe
 * wegwerfen; aus demselben Grund bleibt eine Zeile mit Fokus unangetastet.
 *
 * @returns {boolean} false, wenn die Zeile gerade bearbeitet wird oder fehlt
 */
export function updateItemRow(detail, itemId) {
  const row = document.querySelector(`.strategie-items-table tr.item-row[data-item-id="${itemId}"]`);
  if (!row || row.contains(document.activeElement)) return false;

  const item = detail.items.find(i => i.id === itemId);
  if (!item) return false;

  // Die laufende Nummer haengt an der Gruppierung, nicht am Array-Index
  const angezeigteNummer = parseInt(row.querySelector('.col-number')?.textContent ?? '', 10);
  const index = Number.isFinite(angezeigteNummer) ? angezeigteNummer - 1 : detail.items.indexOf(item);

  row.outerHTML = renderItemRow(detail, item, index);
  detail._bindTableEvents();
  return true;
}

export function rerenderItemsTable(detail) {
  const tableContainer = document.querySelector('.table-container');
  if (!tableContainer) return;

  tableContainer.outerHTML = renderItemsTable(detail);
  
  detail._bindTableEvents();
}
