// Markup der Creator-Karte (Kacheln) und der Creator-Zeile (Liste).
// Reine Funktionen: Zustand und Events bleiben in CreatorGridView.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ageLabel, cardChips, formatFollowerShort, groesseOf, instagramProfilUrl } from './creatorProfil.js';
import { darfRezensionSehen, formatRezension } from './rezension.js';
import { renderFavorit } from './creatorFavorit.js';
import { renderTagZeile } from './creatorTags.js';

const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');

function displayName(c) {
  return `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Instagram-Icon, das das Profil in einem neuen Tab öffnet. Leer ohne Handle. */
export function renderInstagramProfilLink(instagram) {
  const url = instagramProfilUrl(instagram);
  if (!url) return '';
  return `<a class="creator-ig-link" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram-Profil öffnen">${icon('instagram', { className: 'creator-ig-link__icon' })}</a>`;
}

function renderIdentity(c) {
  return `
    <div class="creator-card__identity">
      <h3 class="creator-card__name">${esc(displayName(c))}</h3>
      ${renderInstagramProfilLink(c.instagram)}
    </div>
  `;
}

function renderActions(c) {
  const actionOptions = {};
  if (!c.instagram) actionOptions.disabledActions = ['connect'];
  if (c.ig_connected_at) actionOptions.igConnected = true;
  return actionBuilder.create('creator', c.id, null, actionOptions);
}

function renderMedia(c) {
  const name = displayName(c);
  // Cover fuellt die Kartenbreite im Quadrat - hier das Hauptbild, kein Thumb
  const safeAvatar = c.profilbild_url ? window.validatorSystem?.sanitizeUrl?.(c.profilbild_url) : null;

  const inner = safeAvatar
    ? `<img src="${safeAvatar}" alt="${esc(name)}" class="creator-card__cover" loading="lazy" />`
    : `<div class="creator-card__cover creator-card__cover--placeholder"><span>${esc((c.vorname || '?')[0].toUpperCase())}</span></div>`;

  return `<div class="creator-card__media">${inner}</div>`;
}

function renderMeta(c, list) {
  const stadt = c.lieferadresse_stadt ? list.renderLocationTag(c.lieferadresse_stadt, 'stadt') : '';
  const age = ageLabel(c);
  const ageHtml = age ? `<span class="creator-card__age">${list.sanitize(age)}</span>` : '';
  const groesse = groesseOf(c);
  const groesseHtml = groesse ? `<span class="creator-card__age">${list.sanitize(groesse)}</span>` : '';

  if (!stadt && !ageHtml && !groesseHtml) return '';
  return `<div class="creator-card__meta">${stadt}${ageHtml}${groesseHtml}</div>`;
}

function renderTagRow(c, list) {
  const chips = cardChips(c.creator_types, c.branchen)
    .map(({ label, art }) => `<span class="tag tag--${art}">${list.sanitize(label)}</span>`)
    .join('');
  if (!chips) return '';
  return `<div class="creator-card__tags tags tags-compact">${chips}</div>`;
}

function stat(value, label, attrs = '') {
  return `<div class="creator-card__stat"><span class="creator-card__stat-value"${attrs}>${value}</span><span class="creator-card__stat-label">${label}</span></div>`;
}

function renderStats(c) {
  const stats = [];
  if (darfRezensionSehen()) stats.push(stat(formatRezension(c.rezension_schnitt), 'Rezension'));
  if (typeof c.videos === 'number') stats.push(stat(c.videos, 'Videos'));
  const ig = formatFollowerShort(c.instagram_follower);
  const tt = formatFollowerShort(c.tiktok_follower);
  if (ig != null) stats.push(stat(ig, 'Instagram'));
  if (tt != null) stats.push(stat(tt, 'TikTok'));
  stats.push(stat('0', 'Kooperationsvideos', ` data-video-count="${c.id}"`));
  return `<div class="creator-card__stats">${stats.join('')}</div>`;
}

export function renderCreatorCard(c, list) {
  const name = displayName(c);
  const id = c.id;

  return `
    <article class="creator-card" role="listitem" data-id="${id}">
      <button type="button" class="creator-card__link" data-id="${id}" aria-label="Akte von ${esc(name)} öffnen"></button>
      ${renderMedia(c)}
      <div class="creator-card__body">
        <div class="creator-card__header">
          ${renderIdentity(c)}
          <div class="creator-card__actions">
            <button type="button" class="mdc-btn mdc-btn--sm creator-card__casting" data-id="${id}">Ins Casting</button>
            ${renderFavorit(c)}
            ${renderActions(c)}
          </div>
        </div>
        ${renderMeta(c, list)}
        ${renderTagRow(c, list)}
        ${renderTagZeile(c.tags)}
        ${renderStats(c)}
      </div>
    </article>
  `;
}

export function renderCreatorZeile(c) {
  const name = displayName(c);
  const id = c.id;
  const stadt = c.lieferadresse_stadt ? esc(c.lieferadresse_stadt) : '';
  const groesse = groesseOf(c);
  const ig = c.instagram_follower ? formatFollowerShort(c.instagram_follower) : '';
  const rezension = darfRezensionSehen() && c.rezension_schnitt != null
    ? formatRezension(c.rezension_schnitt)
    : '';
  const videos = typeof c.videos === 'number' ? String(c.videos) : '';
  const bits = [
    stadt,
    groesse,
    ig ? `${ig} Instagram` : '',
    rezension ? `${rezension} Rezension` : '',
    videos !== '' ? `${videos} Videos` : ''
  ].filter(Boolean);
  return `
    <article class="creator-card creator-card--zeile" role="listitem" data-id="${id}">
      <button type="button" class="creator-card__link" data-id="${id}" aria-label="Akte von ${esc(name)} öffnen"></button>
      ${renderMedia(c)}
      <div class="creator-card__body">
        <div class="creator-card__header">
          ${renderIdentity(c)}
          ${renderFavorit(c)}
        </div>
        <div class="creator-card__meta">${bits.map((bit) => `<span>${bit}</span>`).join('')}</div>
        ${renderTagZeile(c.tags)}
      </div>
    </article>
  `;
}
