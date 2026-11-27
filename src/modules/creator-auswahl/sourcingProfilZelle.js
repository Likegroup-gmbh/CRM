// sourcingProfilZelle.js
// Link-Zelle der Sourcing-Tabelle fuer Instagram und TikTok: Chip mit dem Handle und rechts der
// Abruf-Button. Das Geruest liegt zentral in src/core/components/chipCell.js - dieselbe Struktur
// nutzt die Live-Link-Spalte der Kooperationen-Videos, dort mit Status-Punkt statt Button.
//
// Der Button sitzt in der Zelle: Hover zeigt direkt "frisch abrufen", Klick holt die Daten.
// Die Hover-Toolbar (sourcingProfilToolbar.js) bleibt fuer "Profil oeffnen" und den Fehlertext.
// Was je Plattform anders ist (Felder, Texte), steht in sourcingProfilPlattformen.js.

import {
  applyChipCellState, findChipCell, renderChipCell, renderPlatformChip
} from '../../core/components/chipCell.js';
import { escapeHtml } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { abrufZustand, formatStand, profilHandle, profilPlattform } from './sourcingProfilPlattformen.js';

function buttonZustand(item, plattform) {
  const { name } = profilPlattform(plattform);
  const { zustand, fehler, stand } = abrufZustand(item, plattform);
  switch (zustand) {
    case 'leer':
      return { iconName: 'check', klasse: ' is-empty', title: '', label: `${name}-Daten abrufen` };
    case 'fehler':
      return { iconName: 'exclamation-triangle', klasse: ' is-error', title: `Abruf fehlgeschlagen: ${fehler}`, label: 'Erneut versuchen' };
    case 'abgerufen':
      return {
        iconName: 'refresh',
        klasse: ' is-refresh',
        title: `Stand: ${formatStand(stand)} · frisch bei ${name} abrufen`,
        label: `${name}-Daten frisch abrufen`,
      };
    default:
      return { iconName: 'check', klasse: '', title: `${name}-Daten abrufen (bekannte Creator kommen aus dem Pool)`, label: `${name}-Daten abrufen` };
  }
}

/**
 * Haekchen/Refresh neben dem Chip. Immer im Markup, sonst springt die Zellenbreite, sobald ein
 * Link gesetzt ist. Ohne Link bleibt er hidden.
 */
export function renderAbrufButton(item = {}, plattform = 'instagram') {
  const hatLink = !!item[profilPlattform(plattform).linkFeld];
  const z = buttonZustand(item, plattform);
  return `<button type="button"
    class="profil-abruf-btn${z.klasse}"
    data-profil-abruf="${plattform}"
    data-item-id="${escapeHtml(item.id)}"
    title="${escapeHtml(z.title)}"
    aria-label="${escapeHtml(z.label)}"
    ${hatLink ? '' : 'hidden disabled'}>${icon(z.iconName)}</button>`;
}

export function renderProfilZelle(item, plattform) {
  const p = profilPlattform(plattform);
  const url = item[p.linkFeld] || '';

  return renderChipCell({
    toolbar: p.toolbar,
    id: item.id,
    className: 'chip-cell--profil-abruf',
    input: {
      className: 'links-compact-input',
      value: url,
      placeholder: p.platzhalter,
      ariaLabel: `${p.name}-Link`,
      attrs: {
        'data-field': p.linkFeld,
        'data-item-id': item.id
      }
    },
    chip: renderPlatformChip(url, profilHandle(item, plattform), { ohneIcon: true }),
    action: renderAbrufButton(item, plattform)
  });
}

export function applyProfilZelleState(cell, item, plattform) {
  if (!cell) return;

  const url = item?.[profilPlattform(plattform).linkFeld] || '';
  applyChipCellState(cell, {
    value: url,
    chip: renderPlatformChip(url, profilHandle(item, plattform), { ohneIcon: true })
  });

  const slot = cell.querySelector('[data-chip-cell-action]');
  if (slot) slot.innerHTML = renderAbrufButton(item, plattform);
}

export function findProfilZelle(itemId, plattform) {
  return findChipCell(profilPlattform(plattform).toolbar, itemId);
}
