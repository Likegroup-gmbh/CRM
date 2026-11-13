// castingPlattformZellen.js
// Gemeinsame Casting-Spalten mit gestapelten Plattformzeilen: Instagram oben,
// TikTok darunter, je Zeile ein kleines graues Plattform-Icon.
//
// Welche Zeilen eine Zelle zeigt, folgt der Liste (hidden_columns aus den
// Presets, siehe sourcingSpaltenSichtbarkeit): Instagram, solange die Zeile
// nicht ausgeblendet ist. TikTok immer dann, wenn die Liste TikTok hat -
// bei reinen Instagram-Spalten als leere Zeile, damit die Hoehen passen.

import { escapeHtml } from '../../core/format.js';
import { socialHref } from '../../core/format/socialLink.js';
import { INSTAGRAM_ICON, TIKTOK_ICON } from './sourcingIcons.js';
import { PLATTFORM_ZEILEN } from './sourcingSpaltenKatalog.js';
import { listeZeigtTiktok, sichtbarePlattformZeilen } from './sourcingSpaltenSichtbarkeit.js';
import { renderSourcingIgCell } from './sourcingIgCell.js';

const PLATTFORMEN = {
  instagram: { icon: INSTAGRAM_ICON, name: 'Instagram' },
  tiktok: { icon: TIKTOK_ICON, name: 'TikTok' }
};

function renderZeile(plattform, inhalt, mitIcon) {
  if (inhalt == null) {
    return `<div class="plattform-zeile plattform-zeile--leer" data-plattform="${plattform}" aria-hidden="true"></div>`;
  }
  const { icon, name } = PLATTFORMEN[plattform];
  const marke = mitIcon
    ? `<span class="plattform-zeile__icon" title="${name}" role="img" aria-label="${name}">${icon}</span>`
    : '';
  return `<div class="plattform-zeile" data-plattform="${plattform}">${marke}<div class="plattform-zeile__inhalt">${inhalt}</div></div>`;
}

/**
 * Zeilen, die eine Zelle in dieser Liste zeigt.
 * @returns {{instagram: boolean, tiktok: boolean, tiktokInhalt: boolean}}
 */
export function plattformZeilenFuer(spalte, hiddenColumns) {
  const gemeinsam = !!PLATTFORM_ZEILEN[spalte];
  const sichtbar = sichtbarePlattformZeilen(spalte, hiddenColumns).map(z => z.plattform);
  return {
    instagram: gemeinsam ? sichtbar.includes('instagram') : true,
    tiktok: listeZeigtTiktok(hiddenColumns),
    tiktokInhalt: gemeinsam && sichtbar.includes('tiktok')
  };
}

/**
 * Zelle einer gemeinsamen Spalte.
 * @param {object} ctx
 * @param {string} spalte Schluessel der Spalte (cp-col-*)
 * @param {{instagram?: string, tiktok?: string}} inhalte HTML je Plattform
 * @param {object} opts
 * @param {(col: string) => string} opts.hide
 * @param {string} [opts.klassen] zusaetzliche td-Klassen
 * @param {boolean} [opts.mitIcon=true] false, wenn der Inhalt die Plattform selbst zeigt (Link)
 */
export function renderPlattformZelle(ctx, spalte, inhalte, { hide, klassen = '', mitIcon = true }) {
  const zeilen = plattformZeilenFuer(spalte, ctx.hiddenColumns);
  const html = [];
  if (zeilen.instagram) html.push(renderZeile('instagram', inhalte.instagram ?? '', mitIcon));
  if (zeilen.tiktok) {
    html.push(renderZeile('tiktok', zeilen.tiktokInhalt ? (inhalte.tiktok ?? '') : null, mitIcon));
  }

  return `
      <td class="${klassen ? `${klassen} ` : ''}plattform-zelle ${spalte}" style="${hide(spalte)}">
        <div class="plattform-zeilen">${html.join('')}</div>
      </td>
  `;
}

/** Instagram-Link: Chip mit Abruf-Button, ohne Schreibrecht nur das Icon als Link. */
export function renderLinkInstagramInhalt(item, canWrite) {
  if (canWrite) return renderSourcingIgCell(item);
  const href = socialHref(item.link_instagram, 'instagram');
  return `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn" title="Instagram">${INSTAGRAM_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
  `;
}

/** TikTok-Link: Eingabefeld mit Link-Button, ohne Schreibrecht nur das Icon als Link. */
export function renderLinkTiktokInhalt(item, canWrite) {
  const href = socialHref(item.link_tiktok, 'tiktok');
  if (canWrite) {
    return `
          <div class="links-compact-row">
            <input type="text" class="links-compact-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="TT Link..." value="${item.link_tiktok || ''}">
            ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn" title="${escapeHtml(item.link_tiktok)}">${TIKTOK_ICON}</a>` : ''}
          </div>
    `;
  }
  return `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn" title="TikTok">${TIKTOK_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
  `;
}

/** Reichweite Story (nur Instagram): Eingabefeld oder Text. */
export function renderReichweiteStoryInhalt(item, canWrite) {
  return canWrite
    ? `<input type="text" class="strategie-textarea" data-field="reichweite_story" data-item-id="${item.id}" placeholder="z.B. 10K" value="${escapeHtml(item.reichweite_story || '')}">`
    : `<div class="cell-text-readonly">${escapeHtml(item.reichweite_story || '-')}</div>`;
}
