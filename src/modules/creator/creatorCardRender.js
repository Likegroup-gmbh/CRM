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

function renderIdentity(c, { instagram = true } = {}) {
  return `
    <div class="creator-card__identity">
      <h3 class="creator-card__name">${esc(displayName(c))}</h3>
      ${instagram ? renderInstagramProfilLink(c.instagram) : ''}
    </div>
  `;
}

function renderActions(c) {
  const actionOptions = {};
  if (!c.instagram) actionOptions.disabledActions = ['connect'];
  if (c.ig_connected_at) actionOptions.igConnected = true;
  return actionBuilder.create('creator', c.id, null, actionOptions);
}

export const GROESSE_STUFEN = ['Nano', 'Micro', 'Mid-Tier', 'Macro', 'Hero'];

/** Pill mit Groessen-Label. Leer ohne bekannte Groesse. */
export function renderGroesseBadge(label) {
  if (!GROESSE_STUFEN.includes(label)) return '';
  return `<span class="creator-card__groesse">${esc(label)}</span>`;
}

function renderMedia(c, { overlays = false } = {}) {
  const name = displayName(c);
  // Cover fuellt die Kartenbreite im Quadrat - hier das Hauptbild, kein Thumb
  const safeAvatar = c.profilbild_url ? window.validatorSystem?.sanitizeUrl?.(c.profilbild_url) : null;

  const inner = safeAvatar
    ? `<img src="${safeAvatar}" alt="${esc(name)}" class="creator-card__cover" loading="lazy" />`
    : `<div class="creator-card__cover creator-card__cover--placeholder"><span>${esc((c.vorname || '?')[0].toUpperCase())}</span></div>`;

  const badges = overlays
    ? `<div class="creator-card__badges">${renderGroesseBadge(groesseOf(c))}${renderFavorit(c)}</div>`
    : '';

  return `<div class="creator-card__media">${inner}${badges}</div>`;
}

function renderMeta(c, list) {
  const stadt = c.lieferadresse_stadt
    ? `<span class="creator-card__ort">${icon('map-pin', { className: 'creator-card__ort-icon' })}${list.sanitize(c.lieferadresse_stadt)}</span>`
    : '';
  const age = ageLabel(c);
  const ageHtml = age ? `<span class="creator-card__age">${list.sanitize(age)}</span>` : '';

  if (!stadt && !ageHtml) return '';
  return `<div class="creator-card__meta">${stadt}${ageHtml}</div>`;
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

/** Instagram als Button: Icon, Followerzahl und Pfeil in einem Link. Leer ohne Handle. */
function renderInstagramPill(c) {
  const url = instagramProfilUrl(c.instagram);
  if (!url) return '';
  const follower = formatFollowerShort(c.instagram_follower);
  const label = follower != null ? `<span class="mdc-btn__label">${follower}</span>` : '';
  return `<a class="mdc-btn mdc-btn--secondary mdc-btn--sm creator-ig-pill" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram-Profil öffnen">
    <span class="mdc-btn__icon">${icon('instagram')}</span>${label}<span class="mdc-btn__icon">${icon('external-link')}</span>
  </a>`;
}

function renderStats(c) {
  const stats = [];
  if (darfRezensionSehen()) stats.push(stat(formatRezension(c.rezension_schnitt), 'Rezension'));
  if (typeof c.videos === 'number') stats.push(stat(c.videos, 'Videos'));
  const ig = formatFollowerShort(c.instagram_follower);
  const tt = formatFollowerShort(c.tiktok_follower);
  // Mit Handle steckt die Followerzahl schon im Instagram-Button
  if (ig != null && !instagramProfilUrl(c.instagram)) stats.push(stat(ig, 'Instagram'));
  if (tt != null) stats.push(stat(tt, 'TikTok'));
  stats.push(stat('0', 'Kooperationsvideos', ` data-video-count="${c.id}"`));
  return `<div class="creator-card__stats">${stats.join('')}</div>`;
}

function sektion(name, inhalt) {
  const html = inhalt.filter(Boolean).join('');
  return html.trim() ? `<div class="creator-card__sektion creator-card__sektion--${name}">${html}</div>` : '';
}

export function renderCreatorCard(c, list) {
  const name = displayName(c);
  const id = c.id;

  return `
    <article class="creator-card" role="listitem" data-id="${id}">
      <button type="button" class="creator-card__link" data-id="${id}" aria-label="Akte von ${esc(name)} öffnen"></button>
      ${renderMedia(c, { overlays: true })}
      <div class="creator-card__body creator-card__body--sektionen">
        ${sektion('kopf', [
          `<div class="creator-card__header">
            ${renderIdentity(c, { instagram: false })}
            <div class="creator-card__actions">${renderActions(c)}</div>
          </div>`,
          renderMeta(c, list)
        ])}
        ${sektion('tags', [renderTagRow(c, list), renderTagZeile(c.tags)])}
        ${sektion('kennzahlen', [renderInstagramPill(c), renderStats(c)])}
        ${sektion('cta', [`<button type="button" class="mdc-btn mdc-btn--secondary creator-card__casting creator-card__cta" data-id="${id}">
          <span class="mdc-btn__icon">${icon('plus')}</span>
          <span class="mdc-btn__label">Ins Casting</span>
        </button>`])}
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
