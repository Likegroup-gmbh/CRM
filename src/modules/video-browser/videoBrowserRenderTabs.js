// videoBrowserRenderTabs.js
// Tabs im Detailbereich einer Datei: Tab-Leiste (ARIA) und die Inhalte Details, Ad Manager, Kommentare.
// Alle Inhalte stehen im DOM, nur der aktive ist sichtbar: Tab-Wechsel rendert nichts neu und
// Entwürfe (Kommentartext, offene Eingaben) bleiben erhalten.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { splitFileName } from '../../core/videoFileNames.js';
import { formatDatum, schleifeName, verlaufFor } from './videoBrowserLogic.js';
import { statusBadge } from './videoBrowserRenderParts.js';
import { commentsOf, commentsPanelHtml } from './videoBrowserRenderComments.js';
import { tagFieldHtml } from './videoBrowserRenderTags.js';

export const TAB_LABEL = { details: 'Details', admanager: 'Ad Manager', kommentare: 'Kommentare' };

/** Welche Tabs die Datei hat: Ad Manager nur fürs Team und nur bei Videos, Kommentare nicht bei Rohmaterial und Finalen. */
export function availableTabs(ctx) {
  const { item } = ctx.resolved;
  if (!item) return [];
  const tabs = ['details'];
  if (ctx.canUpload && item.type === 'video' && item.asset?.file_path) tabs.push('admanager');
  if (item.type !== 'roh' && !item.isFinal) tabs.push('kommentare');
  return tabs;
}

/** Aktiver Tab: der globale Wunsch, sonst der erste, den die Datei hat. */
export function activeTab(ctx) {
  const tabs = availableTabs(ctx);
  return tabs.includes(ctx.detailTab) ? ctx.detailTab : tabs[0];
}

/* ---- Details ---- */

function prop(label, iconName, valueHtml, { action = null, hint = '' } = {}) {
  const attrs = action ? ` role="button" tabindex="0" data-vb-prop-action="${action}"${hint ? ` title="${esc(hint)}"` : ''}` : '';
  return `
    <div class="vb-prop${action ? ' vb-prop--action' : ''}"${attrs}>
      <dt class="vb-prop__label">${icon(iconName)}<span>${esc(label)}</span></dt>
      <dd class="vb-prop__value">${valueHtml}</dd>
    </div>`;
}

/** Feedbackschleife, aus der eine finale Datei stammt. */
export function sourceFolder(row, item) {
  const sourceId = item.asset?.source_asset_id;
  if (!item.isFinal || !sourceId) return null;
  return row.folders.find(f => f.kind === 'schleife' && f.items.some(i => i.id === sourceId)) || null;
}

function decisionText(ctx, folder, item) {
  if (item.isFinal) return 'Freigegeben als Finale Version.';
  if (folder.status?.key === 'wartet') return ctx.team ? wartetKurz(folder) : '';
  if (folder.status?.key === 'freigegeben') return 'Freigegeben.';
  if (folder.status?.key === 'aenderungen') return 'Änderungen angefordert.';
  return '';
}

const wartetKurz = (folder) => (folder.since ? `Wartet seit ${formatDatum(folder.since)} auf den Kunden.` : 'Wartet auf den Kunden.');

function rundeText(row, folder, item) {
  if (item.type === 'roh') return 'Rohmaterial';
  if (item.isFinal) {
    const source = sourceFolder(row, item);
    return source ? `Finale Version · aus ${source.name}` : 'Finale Version';
  }
  const name = schleifeName(item.version || folder.number || 1);
  if (folder.status?.key === 'wartet') return folder.since ? `${name} · seit ${formatDatum(folder.since)} beim Kunden` : `${name} · beim Kunden`;
  if (folder.closed) return `${name} · abgeschlossen`;
  return name;
}

function formatText(folder, item) {
  if (item.isFinal && folder.kind === 'final') {
    const formate = [...new Set(folder.items.filter(i => i.type === item.type).map(i => i.ratio))];
    if (formate.length > 1) return formate.join(' · ');
  }
  return item.type === 'still' || item.type === 'roh' ? '' : item.ratio;
}

function verlaufHtml(row, item) {
  const verlauf = verlaufFor(row, item);
  if (verlauf.length <= 1) return '';
  const markiert = new Set(row.folders.flatMap(f => f.items).filter(i => i.finalMarked).map(i => i.id));
  return `<ul class="vb-chips">${verlauf.map(v => `<li><button type="button" class="vb-chip${v.current ? ' is-current' : ''}" data-goto-folder="${esc(v.folderId)}" data-goto-item="${esc(v.itemId)}"${v.current ? ' aria-current="true"' : ''}><span class="vb-dot vb-dot--${esc(v.status || 'wartet')}" aria-hidden="true"></span>${esc(v.label)}${markiert.has(v.itemId) ? `<span class="vb-chip__star" title="Final markiert">${icon('star')}</span>` : ''}</button></li>`).join('')}</ul>`;
}

export function detailsPanelHtml(ctx) {
  const { row, folder, item } = ctx.resolved;
  const rows = [];

  const text = decisionText(ctx, folder, item);
  if (item.type !== 'roh') {
    rows.push(prop(ctx.team ? 'Kunde' : 'Status', 'eye',
      `${statusBadge(item.status)}${text ? ` <span class="vb-prop__text" data-slot="decision">${esc(text)}</span>` : '<span data-slot="decision"></span>'}`));
  }

  const tags = tagFieldHtml(ctx, item);
  if (tags) rows.push(prop('Tags', 'tag', tags));

  const verlauf = item.type === 'roh' ? '' : verlaufHtml(row, item);
  if (verlauf) rows.push(prop('Verlauf', 'arrow-path', verlauf));

  rows.push(prop('Runde', 'calendar', esc(rundeText(row, folder, item))));

  if (item.type === 'video' || item.type === 'story') {
    rows.push(prop('Dauer', 'clock', '<span data-vb-prop-duration>–</span>'));
  }
  const format = formatText(folder, item);
  if (format) rows.push(prop('Format', 'film', esc(format)));

  const path = item.asset?.file_path;
  if (ctx.canUpload && item.type === 'video' && path) {
    const { stem, ext } = splitFileName(path);
    rows.push(prop('Dateiname', 'document-text',
      `<span class="vb-prop__ellipsis" data-vb-prop-filename>${esc(stem + ext)}</span>`,
      { action: 'filename', hint: 'Im Ad Manager bearbeiten' }));
  }

  return `<dl class="vb-props">${rows.join('')}</dl>`;
}

/* ---- Ad Manager ---- */

/** Videos, deren Dateinamen der Ad Manager bekommt: in der Finalen Version alle Formate, sonst die Datei selbst. */
export function adManagerItems({ resolved }) {
  const { folder, item } = resolved;
  const list = folder?.kind === 'final' ? folder.items : [item];
  return list.filter(i => i?.type === 'video' && i.asset?.file_path);
}

export function adManagerRowHtml(item, { many }) {
  const { stem, ext } = splitFileName(item.asset.file_path);
  const label = many ? `Datei ${item.ratio}` : 'Dateiname';
  return `
    <div class="vb-admrow" data-vb-adm-row="${esc(item.id)}">
      <span class="vb-admrow__label">${esc(label)}</span>
      <div class="vb-admrow__field">
        <span class="vb-admrow__name" data-vb-file-name data-vb-adm-edit="${esc(item.id)}" role="button" tabindex="0" title="Namen bearbeiten"><span class="vb-admrow__stem">${esc(stem)}</span><span class="vb-admrow__ext">${esc(ext)}</span></span>
        <div class="vb-admrow__actions">
          <button type="button" class="vb-icon-btn" data-vb-edit-file="${esc(item.id)}" aria-label="Dateinamen für den Ad Manager bearbeiten" title="Dateinamen für den Ad Manager bearbeiten">${icon('pencil-square')}</button>
          <button type="button" class="vb-icon-btn" data-vb-adm-copy="${esc(item.id)}" aria-label="Dateinamen kopieren" title="Dateinamen kopieren">${icon('clipboard-document')}</button>
        </div>
      </div>
      <p class="vb-admrow__preview" data-vb-adm-preview aria-live="polite" hidden></p>
    </div>`;
}

export function adManagerPanelHtml(ctx) {
  const items = adManagerItems(ctx);
  if (!items.length) return '<p class="vb-empty">Keine Datei mit Dateinamen.</p>';
  const many = items.length > 1;
  const label = many ? `Alle ${items.length} Formate mit Ad-Manager-Namen laden` : 'Datei mit Ad-Manager-Namen laden';
  const download = ctx.canDownload
    ? `<button type="button" class="mdc-btn vb-download" data-vb-download="formats">${icon('download')}<span>${esc(label)}</span></button>`
    : '';
  return `
    <div class="vb-adm">
      <p class="vb-info">Name der Datei im Ad Manager. Die Endung bleibt, Umlaute, Leerzeichen und Sonderzeichen werden beim Speichern ersetzt.</p>
      <div class="vb-adm__rows">${items.map(i => adManagerRowHtml(i, { many })).join('')}</div>
      ${download ? `<div class="vb-adm__download">${download}</div>` : ''}
    </div>`;
}

/* ---- Leiste und Rahmen ---- */

export function tabsHtml(ctx) {
  const { row, item } = ctx.resolved;
  const tabs = availableTabs(ctx);
  const current = activeTab(ctx);
  const count = commentsOf(row, item).length;
  const panels = {
    details: detailsPanelHtml(ctx),
    admanager: tabs.includes('admanager') ? adManagerPanelHtml(ctx) : '',
    kommentare: tabs.includes('kommentare') ? commentsPanelHtml(ctx) : ''
  };

  // Eine einzige Ansicht braucht keine Leiste
  const list = tabs.length < 2 ? '' : `
    <div class="tab-navigation vb-tabs__list" role="tablist" aria-label="Bereiche der Datei" data-vb-tablist>
      ${tabs.map(id => `<button type="button" role="tab" class="tab-button${id === current ? ' active' : ''}" id="vb-tab-${id}" aria-selected="${id === current}" aria-controls="vb-panel-${id}" tabindex="${id === current ? '0' : '-1'}" data-vb-tab="${id}">${esc(TAB_LABEL[id])}${id === 'kommentare' ? `<span class="tab-count" data-vb-tab-count>${count}</span>` : ''}</button>`).join('')}
      <span class="vb-tabs__indicator" data-vb-tab-indicator aria-hidden="true"></span>
    </div>`;

  const body = tabs.map(id => `
    <div class="vb-panel" role="tabpanel" id="vb-panel-${id}" aria-labelledby="vb-tab-${id}" tabindex="0" data-vb-panel="${id}"${id === current ? '' : ' hidden'}>${panels[id]}</div>`).join('');

  return `${list}${body}`;
}
