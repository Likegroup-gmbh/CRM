// castingPlattformZellen.js
// Gemeinsame Casting-Spalten mit gestapelten Plattformzeilen: Instagram oben,
// TikTok darunter. Das kleine graue Plattform-Icon steht nur in der Link-Spalte,
// in den anderen Spalten zeigt die durchgezogene Trennlinie die Zuordnung.
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
import { renderProfilZelle } from './sourcingProfilZelle.js';
import { profilHandle, profilPlattform } from './sourcingProfilPlattformen.js';
import { renderPlatformChip, renderStaticChip } from '../../core/components/chipCell.js';

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
 * @param {boolean} [opts.mitIcon=false] Plattform-Icon vor dem Wert; nur die Link-Spalte, die
 *   Trennlinie zeigt in den uebrigen Spalten, welche Zeile welche Plattform ist
 */
export function renderPlattformZelle(ctx, spalte, inhalte, { hide, klassen = '', mitIcon = false }) {
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

/** Link-Zelle: Chip mit Abruf-Button, ohne Schreibrecht der Chip als Link. Das Icon setzt die Zeile. */
function renderLinkInhalt(item, canWrite, plattform) {
  if (canWrite) return renderProfilZelle(item, plattform);
  const { linkFeld } = profilPlattform(plattform);
  const { name } = PLATTFORMEN[plattform];
  const url = item[linkFeld];
  const href = socialHref(url, plattform);
  const chip = renderStaticChip({
    href,
    chip: renderPlatformChip(url, profilHandle(item, plattform), { ohneIcon: true }),
    title: name
  });
  return `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${chip || '<span class="cell-text-readonly">-</span>'}
          </div>
  `;
}

export const renderLinkInstagramInhalt = (item, canWrite) => renderLinkInhalt(item, canWrite, 'instagram');
export const renderLinkTiktokInhalt = (item, canWrite) => renderLinkInhalt(item, canWrite, 'tiktok');

/** Reichweite Story (nur Instagram): Eingabefeld oder Text. */
export function renderReichweiteStoryInhalt(item, canWrite) {
  return canWrite
    ? `<input type="text" class="strategie-textarea" data-field="reichweite_story" data-item-id="${item.id}" placeholder="z.B. 10K" value="${escapeHtml(item.reichweite_story || '')}">`
    : `<div class="cell-text-readonly">${escapeHtml(item.reichweite_story || '-')}</div>`;
}
