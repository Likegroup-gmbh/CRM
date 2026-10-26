// Zellen einer Casting-Zeile: Status, Kontakt, Profilbild, Engagement.

import { renderTableSelect, tableSelectDisabled } from '../../core/components/TableSelect.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { escapeHtml } from '../../core/format.js';
import {
  SOURCING_STATUS_OPTIONS,
  KUNDEN_FEEDBACK_OPTIONS,
  getSourcingStatus,
  getSourcingStatusMeta,
  getKundenFeedback,
  getKundenFeedbackMeta,
  castingCreatorBadge
} from './sourcingStatusOptions.js';
import { icon } from '../../core/icons/IconSystem.js';
import { EXTERNAL_LINK_ICON, MAIL_ICON } from './sourcingIcons.js';
import { rowCanWrite } from './castingPreisZellen.js';
import { engagementDesEintrags, formatEngagement } from './castingEngagement.js';

const FOLLOWER_LABELS = {
  follower_instagram: 'Follower Instagram',
  follower_tiktok: 'Follower TikTok'
};

const KONTAKT_FELDER = {
  email: { label: 'E-Mail', placeholder: 'mail@...', typ: 'email' },
  telefon: { label: 'Telefon', placeholder: '+49...', typ: 'tel' }
};

/**
 * Status-Zelle: der interne Prozess (Offen / Angefragt / In Verhandlung /
 * On Hold / Zusage / Gebucht / Abgesagt). Der Status ist intern - Kunden
 * sehen ihn nur, waehlen duerfen sie nicht. Ihr Feedback laeuft ueber die
 * eigene Spalte daneben.
 */
export function renderSourcingStatusCell(ctx, item) {
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
export function renderKundenFeedbackCell(ctx, item) {
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
export function renderFollowerCell(ctx, item, columnClass, field, hide) {
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

/**
 * Mail- und Telefon-Zelle. Beide Felder sind intern: bei Kunden und Gaesten
 * bleibt die Zelle leer, damit der Wert nicht ueber das Markup abfliesst -
 * ausgeblendet wird sie ohnehin schon von isColumnVisibleForCustomer.
 *
 * Der Wert wird beim Instagram-Fetch aus der Bio vorbefuellt. Telefon bleibt
 * in der Tabelle editierbar, die Mail-Spalte zeigt nur noch das Mail-Icon:
 * die Adresse braucht in der Tabelle keine eigene Spaltenbreite.
 */
export function renderKontaktCell(ctx, item, columnClass, field, hide) {
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
export function renderBildCell(ctx, item, sticky, hide) {
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
    <div class="sourcing-avatar">${inner}${dot}${renderDetailOpen(item)}</div>
  </td>`;
}

export function renderDetailOpen(item) {
  return `<button type="button" class="sourcing-avatar__open" data-open-casting-detail="${escapeHtml(item.id)}" aria-label="Details" title="Details">${icon('eye')}</button>`;
}

export function renderEngagementCell(item, hide) {
  const { rate, clean, showClean } = engagementDesEintrags(item);
  const text = formatEngagement(rate);
  const zweit = showClean
    ? `<div class="cpm-auto-reach cpm-auto-reach--clean">${formatEngagement(clean)} ohne Trials</div>`
    : '';
  return `
    <td class="cp-col-engagement-ig" style="${hide('cp-col-engagement-ig')}">
      <div class="cell-text-readonly cpm-auto-value">
        <div>${text || '–'}</div>
        ${zweit}
      </div>
    </td>
  `;
}

export function herkunftZeile(item) {
  if (item.isVorschlag) return '';
  const person = [item.ansprechpartner?.vorname, item.ansprechpartner?.nachname].filter(Boolean).join(' ');
  const management = item.management?.firmenname || '';
  const text = [person, management].filter(Boolean).join(' · ');
  if (!text) return '';
  return `<div class="cell-text-readonly">${escapeHtml(text)}</div>`;
}
