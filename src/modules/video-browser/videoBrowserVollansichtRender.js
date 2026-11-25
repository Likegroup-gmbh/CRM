// videoBrowserVollansichtRender.js
// HTML der Vollansicht: Kopf (Blättern, Kontext, Titel, Aktionen), Bühne mit dem Player, Spalte
// "Feedback" (Video-Kommentare) und Spalte "Details", darunter über beide Spalten die Final-Leiste
// bzw. Kunden-Freigabe. Bei einem Ausstehenden Video zeigt die Bühne die Upload-Zone (Team) bzw.
// "In Produktion".
// Regionen (`data-vb-voll-region`) ersetzt der Controller einzeln, ohne den Player neu zu starten.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { FINAL_NAME, collectDownloadItems, formatDatum, schleifeName } from './videoBrowserLogic.js';
import { iconButton } from './videoBrowserRenderParts.js';
import { finalBarHtml } from './videoBrowserRenderItem.js';
import { commentsOf, commentsPanelHtml } from './videoBrowserRenderComments.js';
import { sourceFolder } from './videoBrowserRenderTabs.js';
import { ausstehendHinweis } from './videoBrowserRenderShowcase.js';
import { uploadZiel } from './videoBrowserShowcaseUpload.js';
import { vollDetailsHtml } from './videoBrowserVollansichtDetails.js';

export const VOLL_TABS = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'details', label: 'Details' }
];

function contextText({ koop, row, folder, item }) {
  if (!item) return [koop.name, row.label, 'Ausstehend'].join(' · ');
  const tail = item.isFinal
    ? `${FINAL_NAME}${sourceFolder(row, item) ? ` · aus ${sourceFolder(row, item).name}` : ''}`
    : schleifeName(item.version || folder?.number || 1);
  return [koop.name, row.label, tail].filter(Boolean).join(' · ');
}

/** Kopf ohne Schließen-Knopf (den setzt die MediaLightbox oben rechts). */
export function headHtml(ctx, { index, total }) {
  const { item, row } = ctx.resolved;
  const editable = ctx.canUpload && !!item;
  const actions = [];
  if (editable) actions.push(iconButton('pencil-square', 'Titel bearbeiten', 'data-vb-edit'));
  if (item && ctx.canDownload && collectDownloadItems('item', ctx.resolved).length) {
    actions.push(iconButton('download', 'Herunterladen', 'data-vb-download="item"'));
  }
  actions.push(`<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-vb-voll-folder>${icon('folder-open')}<span>Im Ordner öffnen</span></button>`);
  const nav = total > 1 ? `
      <div class="vb-voll__nav">
        <button type="button" class="vb-icon-btn" data-vb-voll-step="-1" aria-label="Vorheriges (Pfeil links)" title="Vorheriges (←)">${icon('chevron-left')}</button>
        <span class="vb-voll__count">${index + 1} / ${total}</span>
        <button type="button" class="vb-icon-btn" data-vb-voll-step="1" aria-label="Nächstes (Pfeil rechts)" title="Nächstes (→)">${icon('chevron-right')}</button>
      </div>` : '';
  const title = item ? item.name : (row.title || row.label);
  return `
      ${nav}
      <div class="vb-voll__titles">
        <p class="vb-voll__context">${esc(contextText(ctx.resolved))}</p>
        <h3 class="vb-voll__title${editable ? ' is-editable' : ''}"${editable ? ' data-vb-asset-title role="button" tabindex="0" title="Titel bearbeiten (E)"' : ''}>${esc(title)}</h3>
      </div>
      <div class="vb-voll__actions">${actions.join('')}</div>`;
}

/** Bühne eines Ausstehenden Videos: Upload-Zone mit Ziel-Schleife (Team) oder der Hinweis. */
function ausstehendStageHtml(ctx) {
  const { koop, row } = ctx.resolved;
  const ziel = ctx.canUpload ? uploadZiel(row) : null;
  const datum = formatDatum(row.postingDatum);
  const hinweis = ausstehendHinweis({ hatRohmaterial: (koop.rohmaterialCount || 0) > 0 }, ctx.team);
  if (!ziel) {
    return `
      <div class="vb-voll-aus">
        <span class="vb-voll-aus__icon" aria-hidden="true">${icon('film')}</span>
        <p class="vb-voll-aus__title">${esc(row.label)} ist ${ctx.team ? 'noch nicht hochgeladen' : 'in Produktion'}</p>
        <p class="vb-voll-aus__text">${esc(ctx.team ? hinweis : (datum ? `Geplant für ${datum}` : 'Sobald die erste Version da ist, erscheint sie hier.'))}</p>
      </div>`;
  }
  return `
      <div class="vb-voll-aus vb-voll-aus--upload" data-vb-aus-upload="${esc(row.id)}" data-koop-id="${esc(koop.id)}" data-vb-voll-drop>
        <span class="vb-voll-aus__icon" aria-hidden="true">${icon('upload')}</span>
        <p class="vb-voll-aus__title">Datei für ${esc(row.label)} hierher ziehen</p>
        <p class="vb-voll-aus__text">oder <button type="button" class="dropzone-browse-btn" data-vb-voll-browse>vom Rechner wählen</button> · landet in ${esc(ziel.name)}</p>
        <p class="vb-voll-aus__hint">${esc(hinweis)}</p>
        <input type="file" multiple hidden accept="video/*,image/*" data-vb-voll-file />
        <progress class="vb-voll-aus__progress" data-vb-aus-progress max="100" value="0" hidden></progress>
      </div>`;
}

export function stageHtml(ctx) {
  const { item } = ctx.resolved;
  if (!item) return ausstehendStageHtml(ctx);
  return `<div class="vb-voll__player" data-vb-player-host data-asset-id="${esc(item.id)}"></div>`;
}

/** Final-Leiste bzw. Kunden-Freigabe als Fuß der Seitenspalten, unabhängig vom Tab sichtbar. */
const finalHtml = (ctx) => (ctx.resolved.item
  ? `<div class="vb-voll__final" data-vb-voll-region="final">${finalBarHtml(ctx)}</div>`
  : '');

export function feedbackHtml(ctx) {
  const { item } = ctx.resolved;
  if (!item) return '<p class="vb-empty">Feedback gibt es, sobald die erste Version hochgeladen ist.</p>';
  return commentsPanelHtml(ctx);
}

export const feedbackCount = (ctx) => (ctx.resolved.item ? commentsOf(ctx.resolved.row, ctx.resolved.item).length : 0);

/** Tab-Leiste für mittlere Breiten (CSS blendet sie bei drei Spalten und gestapelt aus). */
function tabsHtml(ctx, tab) {
  return `
      <div class="tab-navigation vb-voll__tabs" role="tablist" aria-label="Bereiche" data-vb-voll-tabs>
        ${VOLL_TABS.map(t => `<button type="button" role="tab" class="tab-button${t.id === tab ? ' active' : ''}" aria-selected="${t.id === tab}" tabindex="${t.id === tab ? '0' : '-1'}" data-vb-voll-tab="${t.id}">${esc(t.label)}${t.id === 'feedback' ? `<span class="tab-count" data-vb-tab-count>${feedbackCount(ctx)}</span>` : ''}</button>`).join('')}
      </div>`;
}

export function bodyHtml(ctx, { index, total, tab }) {
  return `
    <div class="vb-voll" data-vb-voll data-tab="${esc(tab)}" tabindex="-1">
      <header class="vb-voll__head" data-vb-voll-region="head">${headHtml(ctx, { index, total })}</header>
      <div class="vb-voll__body">
        <section class="vb-voll__stage" data-vb-voll-stage aria-label="Vorschau">${stageHtml(ctx)}</section>
        <div class="vb-voll__side">
          ${tabsHtml(ctx, tab)}
          <section class="vb-voll__feedback" data-vb-voll-panel="feedback" data-vb-voll-scroll aria-label="Feedback">
            <div data-vb-voll-region="feedback">${feedbackHtml(ctx)}</div>
          </section>
          <aside class="vb-voll__details" data-vb-voll-panel="details" aria-label="Details">
            <div data-vb-voll-region="details">${vollDetailsHtml(ctx)}</div>
          </aside>
          ${finalHtml(ctx)}
        </div>
      </div>
    </div>`;
}
