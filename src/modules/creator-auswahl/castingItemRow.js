// castingItemRow.js
// Zellen und Zeile eines Casting-Eintrags

import { CREATOR_TYP_SELECT_OPTIONS } from './creatorTypeOptions.js';
import { renderTableSelect, tableSelectDisabled } from '../../core/components/TableSelect.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml } from '../../core/format.js';
import { renderSourcingIgCell } from './sourcingIgCell.js';
import { renderMatchingCell } from './sourcingMatching.js';
import {
  SOURCING_STATUS_OPTIONS,
  KUNDEN_FEEDBACK_OPTIONS,
  getSourcingStatus,
  getSourcingStatusMeta,
  getKundenFeedback,
  getKundenFeedbackMeta,
  castingUmsetzungGate,
  castingCreatorBadge
} from './sourcingStatusOptions.js';
import { icon } from '../../core/icons/IconSystem.js';
import { isColumnVisibleForCustomer, getStickyClasses } from './sourcingSpaltenSichtbarkeit.js';
import { EXTERNAL_LINK_ICON, MAIL_ICON, INSTAGRAM_ICON, TIKTOK_ICON } from './sourcingIcons.js';
import {
  rowCanWrite,
  renderPreisFreitextCell,
  renderAutoCpmCell,
  beschreibeAusreisser
} from './castingPreisZellen.js';

/**
 * Status-Zelle: der interne Prozess (Offen / Angefragt / In Verhandlung /
 * On Hold / Zusage / Gebucht / Abgesagt). Der Status ist intern - Kunden
 * sehen ihn nur, waehlen duerfen sie nicht. Ihr Feedback laeuft ueber die
 * eigene Spalte daneben.
 */
function renderSourcingStatusCell(ctx, item) {
  const status = getSourcingStatus(item);

  return renderTableSelect({
    field: 'sourcing_status',
    itemId: item.id,
    value: status,
    options: SOURCING_STATUS_OPTIONS,
    disabled: tableSelectDisabled({
      gastReadonly: !!ctx.gastReadonly || !!item.isVorschlag,
      isKunde: !!ctx.isKunde,
      canEdit: ctx.canEdit ?? true
    }),
    meta: getSourcingStatusMeta(item, status)
  });
}

/**
 * Kundenfeedback-Zelle: Prio 1 / Prio 2 / Abgelehnt als eigener Select neben
 * dem Prozess-Status. Das ist die Bewertung durch den Kunden - Kunden duerfen
 * sie deshalb selbst setzen, nur Gaeste im Readonly-Modus nicht.
 */
function renderKundenFeedbackCell(ctx, item) {
  const feedback = getKundenFeedback(item);

  return renderTableSelect({
    field: 'kunden_feedback',
    itemId: item.id,
    value: feedback,
    options: KUNDEN_FEEDBACK_OPTIONS,
    disabled: tableSelectDisabled({
      gastReadonly: !!ctx.gastReadonly || !!item.isVorschlag,
      isKunde: !!ctx.isKunde,
      kundeDarfWaehlen: true,
      canEdit: ctx.canEdit ?? true
    }),
    meta: getKundenFeedbackMeta(item, feedback)
  });
}

/**
 * Follower-Zelle: der Rohwert steckt im Input, darueber liegt die kompakte
 * Anzeige (5,5K / 1,39M). Beim Fokussieren blendet CSS das Overlay aus, sodass
 * immer die exakte Zahl bearbeitet wird und beim Speichern nichts gerundet wird.
 */
function renderFollowerCell(ctx, item, columnClass, field, hide) {
  const value = item[field];
  const compact = formatCompactNumber(value);
  const exact = formatExactNumber(value);

  if (!rowCanWrite(ctx, item)) {
    return `
      <td class="${columnClass}" style="${hide(columnClass)}">
        <div class="cell-number__static" title="${exact}">${compact || '-'}</div>
      </td>
    `;
  }

  return `
    <td class="${columnClass}" style="${hide(columnClass)}">
      <div class="cell-number">
        <input type="text"
               inputmode="numeric"
               class="cell-number__input"
               data-field="${field}"
               data-item-id="${item.id}"
               value="${value ?? ''}"
               aria-label="${escapeHtml(FOLLOWER_LABELS[field] || field)}">
        <span class="cell-number__display" data-number-display title="${exact}">${compact || '–'}</span>
      </div>
    </td>
  `;
}

const FOLLOWER_LABELS = {
  follower_instagram: 'Follower Instagram',
  follower_tiktok: 'Follower TikTok'
};

const KONTAKT_FELDER = {
  email: { label: 'E-Mail', placeholder: 'mail@...', typ: 'email' },
  telefon: { label: 'Telefon', placeholder: '+49...', typ: 'tel' }
};

/**
 * Mail- und Telefon-Zelle. Beide Felder sind intern: bei Kunden und Gaesten
 * bleibt die Zelle leer, damit der Wert nicht ueber das Markup abfliesst -
 * ausgeblendet wird sie ohnehin schon von isColumnVisibleForCustomer.
 *
 * Der Wert wird beim Instagram-Fetch aus der Bio vorbefuellt. Telefon bleibt
 * in der Tabelle editierbar, die Mail-Spalte zeigt nur noch das Mail-Icon:
 * die Adresse braucht in der Tabelle keine eigene Spaltenbreite.
 */
function renderKontaktCell(ctx, item, columnClass, field, hide) {
  const meta = KONTAKT_FELDER[field];

  if (ctx.isKunde) {
    return `<td class="cell-textarea ${columnClass}" style="${hide(columnClass)}"><div class="cell-text-readonly">-</div></td>`;
  }

  const value = item[field] || '';
  // Das Schema steht fest, escapeHtml sichert das Attribut - encodeURIComponent
  // wuerde hier das @ der Adresse zerlegen
  const schema = meta.typ === 'email' ? 'mailto:' : 'tel:';
  const link = value
    ? `<a href="${schema}${escapeHtml(value)}" class="link-icon-btn" title="${escapeHtml(value)}">${field === 'email' ? MAIL_ICON : EXTERNAL_LINK_ICON}</a>`
    : '';

  // View-only (Investor oder KI-Vorschlag): Wert bleibt sichtbar, aber kein Input.
  if (!(ctx.canEdit ?? true) || item.isVorschlag) {
    return `
      <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
        <div class="links-compact-row">
          <span class="cell-text-readonly">${escapeHtml(value) || '-'}</span>
          ${link}
        </div>
      </td>
    `;
  }

  if (field === 'email') {
    return `
      <td class="cell-textarea ${columnClass} cell-icon-only" style="${hide(columnClass)}">
        ${link || '<span class="cell-text-readonly">-</span>'}
      </td>
    `;
  }

  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      <div class="links-compact-row">
        <input type="text"
               class="links-compact-input"
               data-field="${field}"
               data-item-id="${item.id}"
               placeholder="${meta.placeholder}"
               value="${escapeHtml(value)}"
               aria-label="${meta.label}">
        ${link}
      </div>
    </td>
  `;
}

/**
 * Profilbild-Zelle. Das Bild kommt beim Instagram-Fetch als AVIF in den Storage,
 * sonst steht der Initial des Namens als Platzhalter - gleiches Muster wie in
 * der CRM-Creator-Tabelle.
 *
 * Fuer den kleinen Avatar reicht das 128px-Thumbnail; Zeilen, die vor der
 * Umstellung abgerufen wurden, haben nur das Hauptbild.
 */
function renderBildCell(ctx, item, sticky, hide) {
  const rawUrl = item.profile_image_thumb_url || item.profile_image_url;
  const safeUrl = rawUrl ? (window.validatorSystem?.sanitizeUrl(rawUrl) ?? rawUrl) : null;
  const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';

  const inner = safeUrl
    ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(item.name || 'Profilbild')}" class="table-avatar table-avatar-img table-avatar--sourcing" loading="lazy" />`
    : `<span class="table-avatar table-avatar--sourcing">${escapeHtml(initial)}</span>`;

  const badge = (!ctx.isKunde && !item.isVorschlag) ? castingCreatorBadge(item) : null;
  const dot = badge === 'green'
    ? '<span class="status-dot status-dot--active sourcing-avatar__dot" title="Als Creator angelegt"></span>'
    : badge === 'red'
      ? '<span class="status-dot status-dot--inactive sourcing-avatar__dot" title="Noch kein Creator"></span>'
      : '';

  return `<td class="cp-col-bild ${sticky.bild}" style="${hide('cp-col-bild')}">
    <div class="sourcing-avatar">${inner}${dot}</div>
  </td>`;
}

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
            <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
          </div>
        ` : `<div class="cell-text-readonly">${escapeHtml(item.name || '-')}</div>`}
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

