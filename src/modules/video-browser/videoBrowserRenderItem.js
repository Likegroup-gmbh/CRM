// videoBrowserRenderItem.js
// Detailbereich einer einzelnen Datei in vier Regionen, die der Controller einzeln ersetzen kann,
// ohne den Player neu zu starten:
//   head     Kontextzeile, Toolbar, Titel, Meta (Region "meta" darin)
//   preview  Player-Host (wird nie ersetzt, solange die Datei gleich bleibt)
//   final    Final-Leiste (nur Team)
//   tabs     Tab-Leiste und Inhalte

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import {
  FINAL_FORMATE,
  FINAL_NAME,
  collectDownloadItems,
  schleifeName
} from './videoBrowserLogic.js';
import { iconButton, statusBadge } from './videoBrowserRenderParts.js';
import { sourceFolder, tabsHtml } from './videoBrowserRenderTabs.js';

export { commentHtml } from './videoBrowserRenderComments.js';

/** Finale Dateien dieses Videos, die aus der gewählten Datei entstanden sind (Verweis über source_asset_id). */
export function markedFinals(row, item) {
  return (row.folders.find(f => f.kind === 'final')?.items || [])
    .filter(f => f.asset?.source_asset_id === item.id && f.type === item.type);
}

/** Kann die Datei als Finale Version markiert werden bzw. ist sie eine markierte? */
export function canMarkFinal(item) {
  if (!item || item.type === 'roh') return false;
  if (item.isFinal) return !!item.asset?.source_asset_id;
  return !!item.asset;
}

/** Ist die Datei final markiert (selbst final mit Quelle oder aus der Schleife freigegeben)? */
export function isMarked(item) {
  return !!item && (item.isFinal ? !!item.asset?.source_asset_id : !!item.finalMarked);
}

/* ---- Kopf ---- */

function contextText(ctx) {
  const { koop, row, folder, item } = ctx.resolved;
  const tail = item.type === 'roh'
    ? [folder.name, item.ordner].filter(Boolean).join(' / ')
    : item.isFinal
      ? `${FINAL_NAME}${sourceFolder(row, item) ? ` · aus ${sourceFolder(row, item).name}` : ''}`
      : schleifeName(item.version || folder.number || 1);
  return [koop.name, row.label, tail].filter(Boolean).join(' · ');
}

function toolbarHtml(ctx) {
  const { item } = ctx.resolved;
  const buttons = [];
  if (ctx.canDownload && collectDownloadItems('item', ctx.resolved).length) {
    buttons.push(iconButton('download', 'Herunterladen', 'data-vb-download="item"'));
  }
  if (ctx.canUpload && item.type === 'roh' && item.verschiebbar) {
    buttons.push(iconButton('arrow-right', 'In Feedbackschleife verschieben', `data-vb-roh-move-item="${esc(item.id)}"`));
  }
  if (ctx.canUpload) {
    buttons.push(iconButton('pencil-square', 'Titel bearbeiten', 'data-vb-edit'));
    // Im Ordner "Finale Version" nimmt der Papierkorb nur die Markierung zurück, die Datei bleibt in ihrer Schleife
    buttons.push(item.isFinal && item.asset?.source_asset_id
      ? iconButton('x-mark', 'Aus Finale Version entfernen', 'data-vb-final-remove')
      : iconButton('trash', 'Löschen', 'data-vb-delete', ' vb-icon-btn--danger'));
  }
  return buttons.length ? `<div class="vb-asset-head__actions">${buttons.join('')}</div>` : '';
}

/** Meta-Zeile: Feedbackschleife bzw. Final, Status und das Final-Badge. Eigene Region für den Teil-Render. */
export function metaHtml(ctx) {
  const { row, item } = ctx.resolved;
  if (item.type === 'roh') {
    return item.meta ? `<span class="vb-version">${esc(item.meta)}</span>` : '';
  }
  const finalLabel = item.type === 'still' ? FINAL_NAME : `${FINAL_NAME} · ${item.ratio}`;
  const version = item.isFinal
    ? `<span class="vb-version" data-vb-asset-version>${esc(finalLabel)}</span>`
    : `<span class="vb-version" data-vb-asset-version>${esc(schleifeName(item.version || 1))}</span>`;
  const marked = item.isFinal ? [] : markedFinals(row, item);
  const badge = marked.length
    ? `<span class="status-badge success vb-status" data-vb-final-badge>${esc(item.type === 'still' ? 'Final' : `Final · ${marked.map(m => m.ratio).join(', ')}`)}</span>`
    : '';
  return `${version}${statusBadge(item.status)}${badge}`;
}

export function headHtml(ctx) {
  const { item } = ctx.resolved;
  const editable = ctx.canUpload;
  return `
      <div class="vb-asset-head__top">
        <p class="vb-asset-head__context" title="${esc(contextText(ctx))}">${esc(contextText(ctx))}</p>
        ${toolbarHtml(ctx)}
      </div>
      <h4 class="vb-detail__title vb-asset-head__title${editable ? ' is-editable' : ''}" data-vb-asset-title${editable ? ' role="button" tabindex="0" title="Titel bearbeiten (E)"' : ''}>${esc(item.name)}</h4>
      <div class="vb-asset-head__meta" data-vb-region="meta">${metaHtml(ctx)}</div>`;
}

/* ---- Final-Leiste ---- */

/**
 * Ein Button in voller Breite mit aria-pressed (Team). Das Format erkennt das System aus der Datei,
 * nur wenn es keins findet, fragt das Menü danach. Kunden sehen die Leiste nicht.
 */
export function finalBarHtml(ctx) {
  const { row, item } = ctx.resolved;
  if (!ctx.canUpload || !canMarkFinal(item)) return '';
  const marked = isMarked(item);
  const ratios = item.isFinal ? [item.ratio] : markedFinals(row, item).map(m => m.ratio);
  const title = marked
    ? (item.type === 'still' ? 'Final' : `Final · ${ratios.join(', ')}`)
    : 'Als final markieren';
  const sub = marked
    ? `Liegt in „${FINAL_NAME}“ · Klick entfernt die Markierung`
    : `Diese Version in die ${FINAL_NAME} übernehmen`;
  const menu = item.type === 'still' || marked ? '' : `
      <div class="vb-promote__menu" data-vb-promote-menu role="menu" hidden>
        <p class="vb-promote__hint">Format nicht erkannt. Welches Seitenverhältnis hat die Datei?</p>
        ${FINAL_FORMATE.map(r => `<button type="button" class="vb-promote__slot" role="menuitem" data-vb-promote-slot="${r}">${r}</button>`).join('')}
      </div>`;
  return `
    <div class="vb-promote vb-finalbar-wrap" data-vb-promote-wrap>
      <button type="button" class="vb-finalbar${marked ? ' is-final' : ''}" data-vb-final-toggle data-vb-promote aria-pressed="${marked}">
        <span class="vb-finalbar__star" data-vb-final-star>${icon('star')}</span>
        <span class="vb-finalbar__text">
          <span class="vb-finalbar__title">${esc(title)}</span>
          <span class="vb-finalbar__sub">${esc(sub)}</span>
        </span>
        <kbd class="vb-finalbar__key" aria-hidden="true">F</kbd>
      </button>${menu}
    </div>`;
}

/* ---- Gesamt ---- */

export function previewHtml(item) {
  return `<div class="vb-player-host" data-vb-player-host data-asset-id="${esc(item.id)}"></div>`;
}

export function detailItem(ctx) {
  const { item } = ctx.resolved;
  return `
    <section class="vb-block vb-asset-head" data-vb-region="head">${headHtml(ctx)}</section>
    <div class="vb-preview" data-vb-region="preview">${previewHtml(item)}</div>
    <div class="vb-final" data-vb-region="final">${finalBarHtml(ctx)}</div>
    <div class="vb-tabs" data-vb-region="tabs">${tabsHtml(ctx)}</div>`;
}
