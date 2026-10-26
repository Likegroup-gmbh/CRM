// castingItemRow.js
// Zeile eines Casting-Eintrags. Die einzelnen Zellen liegen in castingItemZellen.js.

import { CREATOR_TYP_SELECT_OPTIONS } from './creatorTypeOptions.js';
import { renderTableSelect, tableSelectDisabled } from '../../core/components/TableSelect.js';
import { escapeHtml } from '../../core/format.js';
import { renderSourcingIgCell } from './sourcingIgCell.js';
import { renderMatchingCell } from './sourcingMatching.js';
import { castingUmsetzungGate } from './sourcingStatusOptions.js';
import { icon } from '../../core/icons/IconSystem.js';
import { isColumnVisibleForCustomer, getStickyClasses } from './sourcingSpaltenSichtbarkeit.js';
import { EXTERNAL_LINK_ICON, INSTAGRAM_ICON, TIKTOK_ICON } from './sourcingIcons.js';
import {
  rowCanWrite,
  renderPreisFreitextCell,
  renderAutoCpmCell,
  beschreibeAusreisser
} from './castingPreisZellen.js';
import { tauschMenuItemHtml } from '../creator-tausch/creatorTauschUi.js';
import {
  renderSourcingStatusCell,
  renderKundenFeedbackCell,
  renderFollowerCell,
  renderKontaktCell,
  renderBildCell,
  renderDetailOpen,
  renderEngagementCell,
  herkunftZeile
} from './castingItemZellen.js';

export function renderItemRow(ctx, item, index) {
  const isLinkedToCRM = !!item.creator_id;
  const isVorschlag = !!item.isVorschlag;
  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const hide = (col) => !vis(col) ? ' display:none;' : '';
  const sticky = getStickyClasses(ctx);
  // Write-Capabilities: interne Spalten bleiben sichtbar (Investor sieht
  // Preise), aber Inputs/Drag/Aktionen nur mit Capability.
  const tableCanWrite = !ctx.isKunde && (ctx.canEdit ?? true);
  const canWrite = rowCanWrite(ctx, item);
  const hasActions = !ctx.isKunde && ((ctx.canCreate ?? true) || (ctx.canDelete ?? true));
  // Gegenstueck zu customAt() im Tabellenkopf - dieselben Anker, dieselbe Stelle.
  const customAt = (anchor) => ctx.customManager
    ? ctx.customManager.renderCellsAt(anchor, item.id, ctx.hiddenColumns, ctx.isKunde, canWrite)
    : '';

  const isBooked = !!item.gebucht;
  const rowClass = [
    'item-row',
    canWrite ? 'draggable' : '',
    isBooked ? 'item-gebucht' : '',
    isVorschlag ? 'item-row--vorschlag' : ''
  ].filter(Boolean).join(' ');

  return `
    <tr class="${rowClass}" data-item-id="${item.id}"${isVorschlag ? ` data-vorschlag-id="${item.vorschlagId || item.id}"` : ''} draggable="false">
      ${tableCanWrite ? `
        <td class="col-drag ${isVorschlag ? '' : 'drag-handle '}col-sticky-1 cp-col-drag">
          ${isVorschlag ? '' : `
          <div class="drag-cell-content">
            <input type="checkbox" class="sourcing-item-check" data-item-id="${item.id}">
            ${icon('bars-3')}
          </div>
          `}
        </td>
      ` : ''}
      ${renderBildCell(ctx, item, sticky, hide)}
      <td class="cell-textarea cp-col-name ${sticky.name}">
        ${canWrite ? `
          <div class="cp-name-cell-inner">
            <div class="cp-name-cell-line">
              ${vis('cp-col-bild') ? '' : renderDetailOpen(item)}
              <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
            </div>
            ${ctx.isKunde ? '' : herkunftZeile(item)}
          </div>
        ` : `
          <div class="cp-name-cell-line">
            ${vis('cp-col-bild') ? '' : renderDetailOpen(item)}
            <div class="cell-text-readonly">${escapeHtml(item.name || '-')}</div>
          </div>
          ${ctx.isKunde ? '' : herkunftZeile(item)}
        `}
      </td>
      <td class="cell-textarea cp-col-notiz" style="${hide('cp-col-notiz')}">
        ${canWrite ? `
          <textarea class="strategie-textarea" data-field="notiz" data-item-id="${item.id}" placeholder="Kurzbeschreibung...">${item.notiz || ''}</textarea>
        ` : `<div class="cell-text-readonly">${escapeHtml(item.notiz || '-')}</div>`}
      </td>
      ${customAt('cp-col-notiz')}
      <td class="cp-col-matching" style="${hide('cp-col-matching')}">
        ${renderMatchingCell(item.matching_score, item.matching_scores || item.scores || {})}
      </td>
      ${customAt('cp-col-matching')}
      <td class="cp-col-typ" style="${hide('cp-col-typ')}">
        ${canWrite ? renderTableSelect({
          field: 'creator_typ',
          itemId: item.id,
          value: item.typ || '',
          options: CREATOR_TYP_SELECT_OPTIONS,
          disabled: tableSelectDisabled({ gastReadonly: !!ctx.gastReadonly })
        }) : `<div class="cell-text-readonly">${item.typ || '-'}</div>`}
      </td>
      ${customAt('cp-col-typ')}
      <td class="cp-col-status" style="${hide('cp-col-status')}">
        ${renderSourcingStatusCell(ctx, item)}
      </td>
      ${customAt('cp-col-status')}
      <td class="cp-col-kunden-feedback" style="${hide('cp-col-kunden-feedback')}">
        ${renderKundenFeedbackCell(ctx, item)}
      </td>
      ${customAt('cp-col-kunden-feedback')}
      <td class="cell-textarea cp-col-location" style="${hide('cp-col-location')}">
        ${canWrite ? `
          <textarea class="strategie-textarea" data-field="wohnort" data-item-id="${item.id}" placeholder="Location...">${item.wohnort || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.wohnort || '-'}</div>`}
      </td>
      ${customAt('cp-col-location')}
      ${renderKontaktCell(ctx, item, 'cp-col-mail', 'email', hide)}
      ${customAt('cp-col-mail')}
      ${renderKontaktCell(ctx, item, 'cp-col-telefon', 'telefon', hide)}
      ${customAt('cp-col-telefon')}
      <td class="cp-col-link-ig" style="${hide('cp-col-link-ig')}">
        ${canWrite ? renderSourcingIgCell(item) : `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="Instagram">${INSTAGRAM_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
        `}
      </td>
      ${customAt('cp-col-link-ig')}
      ${renderFollowerCell(ctx, item, 'cp-col-follower-ig', 'follower_instagram', hide)}
      ${customAt('cp-col-follower-ig')}
      ${renderEngagementCell(item, hide)}
      ${customAt('cp-col-engagement-ig')}
      ${renderAutoCpmCell(ctx, item, 'cp-col-cpm-ig-8', item.ig_views_8, hide, true, beschreibeAusreisser(item, 8), item.ig_stats?.ohne_trials?.views_8)}
      ${customAt('cp-col-cpm-ig-8')}
      ${renderAutoCpmCell(ctx, item, 'cp-col-cpm-ig-30', item.ig_views_30, hide, true, beschreibeAusreisser(item, 30), item.ig_stats?.ohne_trials?.views_30)}
      ${customAt('cp-col-cpm-ig-30')}
      ${renderPreisFreitextCell(ctx, item, 'cp-col-preis-reels', 'preis_reels', hide)}
      ${customAt('cp-col-preis-reels')}
      <td class="cell-textarea cp-col-reichweite-story" style="${hide('cp-col-reichweite-story')}">
        ${canWrite ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_story" data-item-id="${item.id}" placeholder="z.B. 10K" value="${item.reichweite_story || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_story || '-'}</div>`}
      </td>
      ${customAt('cp-col-reichweite-story')}
      ${renderPreisFreitextCell(ctx, item, 'cp-col-preis-story', 'preis_story', hide)}
      ${customAt('cp-col-preis-story')}
      <td class="cp-col-link-tt" style="${hide('cp-col-link-tt')}">
        ${canWrite ? `
          <div class="links-compact-row">
            <input type="text" class="links-compact-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="TT Link..." value="${item.link_tiktok || ''}">
            ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${EXTERNAL_LINK_ICON}</a>` : ''}
          </div>
        ` : `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="TikTok">${TIKTOK_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
        `}
      </td>
      ${customAt('cp-col-link-tt')}
      ${renderFollowerCell(ctx, item, 'cp-col-follower-tt', 'follower_tiktok', hide)}
      ${customAt('cp-col-follower-tt')}
      ${renderPreisFreitextCell(ctx, item, 'cp-col-preis-tt-video', 'preis_tiktok_video', hide)}
      ${customAt('cp-col-preis-tt-video')}
      ${renderPreisFreitextCell(ctx, item, 'cp-col-preis-tt-story', 'preis_tiktok_story', hide)}
      ${customAt('cp-col-preis-tt-story')}
      ${renderPreisFreitextCell(ctx, item, 'cp-col-pricing', 'pricing', hide)}
      ${customAt('cp-col-pricing')}
      <td class="cell-textarea cp-col-nutzungsrechte" style="${hide('cp-col-nutzungsrechte')}">
        ${canWrite ? `
          <textarea class="strategie-textarea" data-field="nutzungsrechte" data-item-id="${item.id}" placeholder="Nutzungsrechte...">${escapeHtml(item.nutzungsrechte || '')}</textarea>
        ` : `<div class="cell-text-readonly">${escapeHtml(item.nutzungsrechte || '-')}</div>`}
      </td>
      ${customAt('cp-col-nutzungsrechte')}
      <td class="cell-textarea cp-col-reichweite-garantie" style="${hide('cp-col-reichweite-garantie')}">
        ${canWrite ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_garantie" data-item-id="${item.id}" placeholder="z.B. 50K" value="${item.reichweite_garantie || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_garantie || '-'}</div>`}
      </td>
      ${customAt('cp-col-reichweite-garantie')}
      <td class="cell-textarea cp-col-ek" style="${hide('cp-col-ek')}">
        ${canWrite ? `
          <div class="cell-euro">
            <input type="number" class="strategie-textarea cell-euro__input${ctx.kundenCallActive ? ' kunden-call-blur' : ''}" data-field="preis_ek" data-item-id="${item.id}" data-blur-target placeholder="0" value="${item.preis_ek ?? ''}" step="0.01">
            <span class="cell-euro__suffix" aria-hidden="true">€</span>
          </div>
        ` : `<div class="cell-text-readonly">${item.preis_ek != null ? Number(item.preis_ek).toLocaleString('de-DE', {minimumFractionDigits: 0}) + ' €' : '-'}</div>`}
      </td>
      ${customAt('cp-col-ek')}
      <td class="cell-textarea cp-col-vk" style="${hide('cp-col-vk')}">
        ${canWrite ? `
          <div class="cell-euro">
            <input type="number" class="strategie-textarea cell-euro__input" data-field="preis_vk" data-item-id="${item.id}" placeholder="0" value="${item.preis_vk ?? ''}" step="0.01">
            <span class="cell-euro__suffix" aria-hidden="true">€</span>
          </div>
        ` : `<div class="cell-text-readonly">${item.preis_vk != null ? Number(item.preis_vk).toLocaleString('de-DE', {minimumFractionDigits: 0}) + ' €' : '-'}</div>`}
      </td>
      ${customAt('cp-col-vk')}
      <td class="cell-textarea cp-col-feedback" style="${hide('cp-col-feedback')}">
        <textarea
          class="strategie-textarea auto-resize-textarea ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly-textarea'}"
          data-field="feedback_kunde"
          data-item-id="${item.id}"
          placeholder="${(ctx.isKunde && !ctx.gastReadonly) ? 'Ihr Feedback...' : 'Rückmeldung Kunde...'}"
          ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly'}
        >${item.feedback_kunde || ''}</textarea>
        ${item.feedback_kunde && item.feedback_kunde_author_name ? `
          <div class="feedback-author-meta">
            ${item.feedback_kunde_author_name}${item.feedback_kunde_updated_at ? ` · ${new Date(item.feedback_kunde_updated_at).toLocaleDateString('de-DE')}` : ''}
          </div>` : ''}
      </td>
      ${customAt('cp-col-feedback')}
      ${ctx.customManager ? ctx.customManager.renderCells(item.id, ctx.hiddenColumns, ctx.isKunde, canWrite) : ''}
      ${hasActions ? `
        <td class="col-actions cp-col-actions">
          <div class="actions-dropdown-container" data-entity-type="${isVorschlag ? 'casting_vorschlag' : 'creator_auswahl_item'}">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('dots-vertical-filled')}
            </button>
            <div class="actions-dropdown">
              ${isVorschlag ? `
                <a href="#" class="action-item" data-action="activate-vorschlag" data-id="${item.vorschlagId || item.id}">
                  ${icon('check-bold')}
                  Aktivieren
                </a>
                <a href="#" class="action-item action-danger" data-action="discard-vorschlag" data-id="${item.vorschlagId || item.id}">
                  ${window.ActionsDropdown?.getHeroIcon('delete') || icon('trash')}
                  Verwerfen
                </a>
              ` : `
              ${ctx.canCreate && castingUmsetzungGate(item) && !isLinkedToCRM ? `
                <a href="#" class="action-item" data-action="create-creator" data-id="${item.id}">
                  ${icon('user-add')}
                  Creator anlegen
                </a>
              ` : ''}
              ${ctx.canCreate && castingUmsetzungGate(item) && isLinkedToCRM ? `
                <a href="#" class="action-item" data-action="create-videoidee" data-id="${item.id}">
                  ${icon('light-bulb')}
                  Videoidee anlegen
                </a>
                <a href="#" class="action-item" data-action="connect-videoidee" data-id="${item.id}">
                  ${icon('user-add')}
                  Mit Videoidee verbinden
                </a>
              ` : ''}
              ${tauschMenuItemHtml(item, ctx)}
              ${ctx.canDelete ? `
              <a href="#" class="action-item action-danger" data-action="delete-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                Löschen
              </a>
              ` : ''}
              `}
            </div>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}

