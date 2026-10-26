// Markup der Casting-Schublade: Profil, Felder, Kopf.
// Die Schublade selbst (oeffnen, schliessen, speichern) liegt in castingDetailDrawer.js.

import { renderTableSelect, tableSelectDisabled } from '../../core/components/TableSelect.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderReelsBlock } from '../creator/creatorReels.js';
import { CREATOR_TYP_SELECT_OPTIONS } from './creatorTypeOptions.js';
import { SOURCING_ANKER_SPALTEN } from './sourcingSpaltenKatalog.js';
import {
  KUNDEN_FEEDBACK_OPTIONS,
  SOURCING_STATUS_OPTIONS,
  getKundenFeedback,
  getSourcingStatus
} from './sourcingStatusOptions.js';
import { renderIgFetchButton, sourcingIgHandle } from './sourcingIgCell.js';
import { renderMatchingCell } from './sourcingMatching.js';
import { berechnePreisAusViews, getListenTkp, rowCanWrite } from './castingPreisZellen.js';
import {
  bioDesEintrags,
  engagementDesEintrags,
  formatEngagement,
  mediaCountDesEintrags,
  reelsQuelle
} from './castingEngagement.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listeHatTiktok(liste) {
  const raw = liste?.plattformen;
  const list = (Array.isArray(raw) ? raw : String(raw || '').split(','))
    .map(s => String(s).trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  return list.includes('tiktok');
}

function darfSchreiben(detail, item, { kundeDarf = false } = {}) {
  if (item?.isVorschlag || detail.gastReadonly) return false;
  if (detail.isKunde) return kundeDarf && !detail.gastReadonly;
  return detail.canEdit ?? true;
}

function feld(label, inner) {
  return `<div class="form-field"><label>${esc(label)}</label>${inner}</div>`;
}

function textFeld(item, { label, field, value, schreiben, placeholder = '', rows = 0 }) {
  const text = value ?? '';
  if (!schreiben) {
    return feld(label, `<div class="cell-text-readonly">${esc(text) || '–'}</div>`);
  }
  const attrs = `data-field="${field}" data-item-id="${esc(item.id)}" placeholder="${esc(placeholder)}"`;
  const control = rows
    ? `<textarea class="form-input" rows="${rows}" ${attrs}>${esc(text)}</textarea>`
    : `<input class="form-input" type="text" ${attrs} value="${esc(text)}">`;
  return feld(label, control);
}

function auswahlFeld(item, { label, field, value, options, disabled, meta = '' }) {
  return feld(label, renderTableSelect({
    field,
    itemId: item.id,
    value: value || '',
    options,
    disabled,
    meta,
    matchWidth: true
  }));
}

export function zahl(wert) {
  if (wert == null || wert === '' || Number.isNaN(Number(wert))) return '–';
  return Number(wert).toLocaleString('de-DE');
}

function preisText(views, liste) {
  const tkp = getListenTkp(liste);
  const preis = berechnePreisAusViews(views, tkp);
  if (preis == null) return '–';
  const betrag = preis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reach = views != null ? `${Number(views).toLocaleString('de-DE')} Views` : '';
  return reach ? `${betrag} € · Ø ${reach}` : `${betrag} €`;
}

function profilBild(item) {
  const raw = item.profile_image_url
    || item.profile_image_thumb_url
    || item.creator?.profilbild_url
    || item.creator?.profilbild_thumb_url
    || '';
  const safeUrl = raw ? (window.validatorSystem?.sanitizeUrl(raw) ?? raw) : '';
  const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';
  const inner = safeUrl
    ? `<img src="${esc(safeUrl)}" alt="${esc(item.name || 'Profilbild')}" loading="lazy">`
    : `<span>${esc(initial)}</span>`;
  return `<div class="casting-detail-bild">${inner}</div>`;
}

function profilBlock(detail, item) {
  const engagement = engagementDesEintrags(item);
  const rate = formatEngagement(engagement.rate) || '–';
  const clean = engagement.showClean
    ? `<div class="casting-detail-er-clean">${formatEngagement(engagement.clean)} ohne Trials</div>`
    : '';
  const handle = sourcingIgHandle(item);
  const profilUrl = handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : '';
  const bio = bioDesEintrags(item);
  const count = mediaCountDesEintrags(item);
  const quelle = reelsQuelle(item);
  const hatReels = (quelle.ig_recent_posts?.length || quelle.ig_recent_posts_clean?.length);
  const abgerufen = !!item?.ig_stats && Object.prototype.hasOwnProperty.call(item.ig_stats, 'recent_posts');
  const reels = hatReels || abgerufen
    ? renderReelsBlock(quelle)
    : '<p class="ig-muted">Die letzten Reels erscheinen nach dem nächsten Instagram-Abruf.</p>';

  return `
    <section class="casting-detail-section">
      <div class="casting-detail-profil">
        ${profilBild(item)}
        <div class="ig-stats-row">
        <div class="ig-stat">
          <span class="ig-stat-value" data-casting-follower>${zahl(item.follower_instagram)}</span>
          <span class="ig-stat-label">Follower</span>
        </div>
        <div class="ig-stat">
          <span class="ig-stat-value">${icon('engagement', { className: 'ig-stat-icon' })}${esc(rate)}</span>
          <span class="ig-stat-label">Engagement-Rate</span>
          ${clean}
        </div>
        <div class="ig-stat">
          <span class="ig-stat-value">${zahl(count)}</span>
          <span class="ig-stat-label">Posts</span>
        </div>
        </div>
      </div>
      ${profilUrl ? `<p class="casting-detail-handle"><a href="${esc(profilUrl)}" target="_blank" rel="noopener noreferrer">@${esc(handle)}</a></p>` : ''}
      ${bio ? `<div class="detail-item ig-bio"><label>Bio</label><span>${esc(bio)}</span></div>` : '<p class="ig-muted">Keine Bio gespeichert.</p>'}
      ${reels}
    </section>
  `;
}

function preisBlock(detail, item) {
  const clean8 = item.ig_stats?.ohne_trials?.views_8;
  const clean30 = item.ig_stats?.ohne_trials?.views_30;
  const zeile = (label, views, clean) => {
    const zweit = clean != null && views != null && Number(clean) !== Number(views)
      ? `<div class="casting-detail-er-clean">${preisText(clean, detail.liste)} ohne Trials</div>`
      : '';
    return feld(label, `<div class="cell-text-readonly">${preisText(views, detail.liste)}</div>${zweit}`);
  };
  return `
    ${zeile('Preis 8 Reels', item.ig_views_8, clean8)}
    ${zeile('Preis 30 Reels', item.ig_views_30, clean30)}
  `;
}

function customBlock(detail, item, schreiben) {
  const manager = detail.customColumns;
  if (!manager?.hasColumns) return '';
  const headers = [
    ...SOURCING_ANKER_SPALTEN.map(anchor => manager.renderHeadersAt(anchor, [], detail.isKunde)),
    manager.renderHeaders([], detail.isKunde)
  ].join('');
  const cells = [
    ...SOURCING_ANKER_SPALTEN.map(anchor => manager.renderCellsAt(anchor, item.id, [], detail.isKunde, schreiben)),
    manager.renderCells(item.id, [], detail.isKunde, schreiben)
  ].join('');
  if (!headers.trim()) return '';
  return `
    <section class="casting-detail-section">
      <h4 class="drawer-section-title">Eigene Spalten</h4>
      <div class="casting-detail-custom">
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody><tr>${cells}</tr></tbody></table>
      </div>
    </section>
  `;
}

export function renderBody(detail, item) {
  const schreiben = rowCanWrite(detail, item);
  const feedbackSchreiben = darfSchreiben(detail, item, { kundeDarf: true });
  const internSichtbar = !detail.isKunde;
  const tiktok = listeHatTiktok(detail.liste);
  const blur = detail.kundenCallActive ? ' kunden-call-blur' : '';

  return `
    ${profilBlock(detail, item)}
    <section class="casting-detail-section">
      <h4 class="drawer-section-title">Kurzbeschreibung</h4>
      ${textFeld(item, {
        label: 'Kurzbeschreibung',
        field: 'notiz',
        value: item.notiz,
        schreiben,
        rows: 4,
        placeholder: 'Warum dieser Creator…'
      })}
    </section>
    <section class="casting-detail-section">
      <h4 class="drawer-section-title">Status und Feedback</h4>
      ${auswahlFeld(item, {
        label: 'Creator Art',
        field: 'creator_typ',
        value: item.typ,
        options: CREATOR_TYP_SELECT_OPTIONS,
        disabled: !schreiben
      })}
      ${auswahlFeld(item, {
        label: 'Status',
        field: 'sourcing_status',
        value: getSourcingStatus(item),
        options: SOURCING_STATUS_OPTIONS,
        disabled: tableSelectDisabled({
          gastReadonly: !!detail.gastReadonly || !!item.isVorschlag,
          isKunde: !!detail.isKunde,
          canEdit: detail.canEdit ?? true
        })
      })}
      ${auswahlFeld(item, {
        label: 'Kundenfeedback',
        field: 'kunden_feedback',
        value: getKundenFeedback(item),
        options: KUNDEN_FEEDBACK_OPTIONS,
        disabled: tableSelectDisabled({
          gastReadonly: !!detail.gastReadonly || !!item.isVorschlag,
          isKunde: !!detail.isKunde,
          kundeDarfWaehlen: true,
          canEdit: detail.canEdit ?? true
        })
      })}
      ${textFeld(item, {
        label: 'Rückmeldung Kunde',
        field: 'feedback_kunde',
        value: item.feedback_kunde,
        schreiben: feedbackSchreiben,
        rows: 3,
        placeholder: 'Rückmeldung…'
      })}
    </section>
    <section class="casting-detail-section">
      <h4 class="drawer-section-title">Kontakt</h4>
      ${textFeld(item, { label: 'Location', field: 'wohnort', value: item.wohnort, schreiben, placeholder: 'Stadt' })}
      ${internSichtbar ? textFeld(item, { label: 'Mail', field: 'email', value: item.email, schreiben, placeholder: 'mail@…' }) : ''}
      ${internSichtbar ? textFeld(item, { label: 'Telefon', field: 'telefon', value: item.telefon, schreiben, placeholder: '+49…' }) : ''}
    </section>
    <section class="casting-detail-section">
      <h4 class="drawer-section-title">Konditionen</h4>
      ${textFeld(item, { label: 'Link Instagram', field: 'link_instagram', value: item.link_instagram, schreiben, placeholder: 'https://instagram.com/…' })}
      ${textFeld(item, { label: 'Follower Instagram', field: 'follower_instagram', value: item.follower_instagram ?? '', schreiben })}
      <div class="${blur}">
        ${preisBlock(detail, item)}
      </div>
      ${textFeld(item, { label: 'Preis Reels', field: 'preis_reels', value: item.preis_reels, schreiben, placeholder: 'Preis…' })}
      ${textFeld(item, { label: 'Reichweite Story', field: 'reichweite_story', value: item.reichweite_story, schreiben, placeholder: 'z.B. 10K' })}
      ${textFeld(item, { label: 'Preis Story', field: 'preis_story', value: item.preis_story, schreiben, placeholder: 'Preis…' })}
      ${tiktok ? `
        ${textFeld(item, { label: 'Link TikTok', field: 'link_tiktok', value: item.link_tiktok, schreiben, placeholder: 'https://tiktok.com/…' })}
        ${textFeld(item, { label: 'Follower TikTok', field: 'follower_tiktok', value: item.follower_tiktok ?? '', schreiben })}
        ${textFeld(item, { label: 'Preis Video TikTok', field: 'preis_tiktok_video', value: item.preis_tiktok_video, schreiben })}
        ${textFeld(item, { label: 'Preis Story TikTok', field: 'preis_tiktok_story', value: item.preis_tiktok_story, schreiben })}
      ` : ''}
      ${textFeld(item, { label: 'Gesamtpreis', field: 'pricing', value: item.pricing, schreiben })}
      ${textFeld(item, { label: 'Nutzungsrechte', field: 'nutzungsrechte', value: item.nutzungsrechte, schreiben, rows: 2 })}
      ${textFeld(item, { label: 'Reichweitengarantie', field: 'reichweite_garantie', value: item.reichweite_garantie, schreiben, placeholder: 'z.B. 50K' })}
      ${feld('Matching', renderMatchingCell(item.matching_score, item.matching_scores || item.scores || {}))}
    </section>
    ${customBlock(detail, item, schreiben)}
  `;
}

export function renderHeader(detail, item) {
  const schreiben = rowCanWrite(detail, item);
  const name = schreiben
    ? `<textarea class="casting-detail-name" data-field="name" data-item-id="${esc(item.id)}" placeholder="Name…" rows="1">${esc(item.name || '')}</textarea>`
    : `<span class="drawer-title">${esc(item.name || 'Creator')}</span>`;
  const abruf = schreiben ? renderIgFetchButton(item) : '';
  return `
    <div class="drawer-header casting-detail-drawer__header">
      <div class="casting-detail-drawer__title">${name}</div>
      <div class="casting-detail-drawer__actions" data-casting-header-actions>
        ${abruf}
        <button type="button" class="drawer-close-btn" data-close-casting-detail aria-label="Schließen">&times;</button>
      </div>
    </div>
    <div class="drawer-body" data-casting-detail-body></div>
  `;
}
