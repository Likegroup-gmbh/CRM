// StrategieDetailRenderer.js
// Tabellen-Rendering für die Strategie-Detail-Ansicht

import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { renderTableSelect, tableSelectDisabled } from '../../core/components/TableSelect.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from './strategiePrioOptions.js';
import { isFixedColumnVisible } from './strategieColumns.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

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
      <div class="table-container table-container--empty">
        ${renderEmptyState({
          icon: 'film',
          title: 'Noch keine Videos hinzugefügt',
          text: !detail.isKunde ? 'Fügen Sie oben eine Video-URL ein, um zu starten' : ''
        })}
      </div>
    `;
  }

  const groupedItems = groupItemsByTeilbereich(detail.items);
  const customCount = detail.customColumns ? detail.customColumns.visibleCount(detail.hiddenColumns, detail.isKunde) : 0;
  const cols = visibleFixedColumns(detail);

  // #, Bild, Plattform sind immer da; Drag und Aktionen nur intern
  const fixedCount = 3
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
 * Beschreibung, Transkript und Caption: Clip mit Mehr/Weniger.
 * Der Quellen-Tag zeigt, ob Whisper transkribiert oder die Untertitel
 * des Posts mitgenommen wurden.
 */
function renderClippedTextCell(detail, item, field, cssClass, placeholder, readonly) {
  const value = item[field] || '';

  const inner = !detail.isKunde
    ? `<textarea
          class="strategie-textarea${readonly ? ' readonly-textarea' : ''}"
          placeholder="${placeholder}"
          data-field="${field}"
          data-item-id="${item.id}"
          ${readonly ? 'readonly' : ''}
        >${escapeHtml(value)}</textarea>`
    : `<div class="cell-text-readonly">${escapeHtml(value) || '-'}</div>`;

  return `
    <td class="cell-textarea ${cssClass}">
      <div class="strategie-text-clip">
        <div class="strategie-text-clip__body">
          ${inner}
        </div>
        <button type="button" class="strategie-text-more" hidden aria-expanded="false" aria-label="Mehr anzeigen" title="Mehr anzeigen">${icon('eye')}</button>
      </div>
    </td>
  `;
}

function renderPlatformCell(item, platformIcon, fallbackIcon) {
  if (item.video_link) {
    const mark = platformIcon || fallbackIcon;
    return `
      <td class="col-platform u-text-center">
        <a href="${escapeAttr(item.video_link)}" target="_blank" rel="noopener noreferrer"
           class="strategie-platform-link" title="${escapeAttr(item.video_link)}">${mark}</a>
      </td>
    `;
  }

  if (platformIcon) {
    return `<td class="col-platform u-text-center">${platformIcon}</td>`;
  }

  return `<td class="col-platform u-text-center"><span class="strategie-cell-muted">-</span></td>`;
}

export function renderItemRow(detail, item, index) {
  const platformIcon = getPlatformIcon(item.plattform);
  const externalLinkIcon = `${icon('external-link', { className: 'icon-20' })}`;
  const ideaIcon = `${icon('light-bulb')}`;
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
          ${icon('bars-3')}
        </td>
      ` : ''}
      ${renderBildCell(item, isIdea, ideaIcon)}
      ${renderPlatformCell(item, platformIcon, externalLinkIcon)}
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
      ${cols.beschreibung ? renderClippedTextCell(detail, item, 'beschreibung', 'col-beschreibung', 'Beschreibung...') : ''}
      ${cols.transkript ? renderClippedTextCell(detail, item, 'transkript', 'col-transkript', 'Transkript...', readonly) : ''}
      ${cols.caption ? renderClippedTextCell(detail, item, 'caption', 'col-caption', 'Caption...', readonly) : ''}
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
            <div class="feedback-author-meta strategie-feedback-meta">
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
            disabled: tableSelectDisabled({
              gastReadonly: readonly,
              isKunde: detail.isKunde,
              kundeDarfWaehlen: true
            })
          })}
        </td>
      ` : ''}
      ${cols.umgesetzt ? `
        <td class="col-umgesetzt u-text-center">
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
              ${icon('dots-vertical-filled')}
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
    youtube: `${icon('youtube', { className: 'icon-20' })}`,
    tiktok: `${icon('tiktok', { className: 'icon-20' })}`,
    instagram: `${icon('instagram', { className: 'icon-20' })}`
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
