// sourcingIgCell
// Was die Instagram-Zelle der Sourcing-Tabelle aus einem Item macht: Chip mit
// dem Handle und der Abruf-Button rechts daneben. Das Geruest liegt zentral in
// src/core/components/chipCell.js - dieselbe Struktur nutzt die Live-Link-Spalte
// der Kooperationen-Videos, dort mit Status-Punkt statt Button.
//
// Der Button sitzt wieder in der Zelle (wie vor der Hover-Toolbar): Hover zeigt
// direkt "frisch bei Instagram abrufen", Klick holt die Daten. Die Toolbar
// bleibt fuer "Profil oeffnen".

import {
  applyChipCellState, findChipCell, renderChipCell, renderPlatformChip
} from '../../core/components/chipCell.js';
import { parseSocialLink } from '../../core/format/socialLink.js';
import { icon } from '../../core/icons/IconSystem.js';

export const SOURCING_IG_TOOLBAR = 'sourcing-instagram';

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sourcingIgHandle(item) {
  return item?.ig_stats?.username || parseSocialLink(item?.link_instagram).handle || '';
}

/**
 * Haekchen/Refresh neben dem IG-Chip. Immer im Markup, sonst springt die
 * Zellenbreite sobald ein Link gesetzt ist. Ohne Link bleibt er hidden.
 */
export function renderIgFetchButton(item = {}) {
  const hasLink = !!item.link_instagram;
  const hasError = !!item.ig_fetch_error;
  const hasFetched = !hasError && !!item.ig_fetched_at;

  let iconHtml = icon('check');
  let stateClass = '';
  let title = 'Instagram-Daten abrufen (bekannte Creator kommen aus dem Pool)';
  let label = 'Instagram-Daten abrufen';

  if (!hasLink) {
    stateClass = ' is-empty';
    title = '';
  } else if (hasError) {
    iconHtml = icon('exclamation-triangle');
    stateClass = ' is-error';
    title = `Abruf fehlgeschlagen: ${item.ig_fetch_error}`;
    label = 'Erneut versuchen';
  } else if (hasFetched) {
    iconHtml = icon('arrow-path-filled', { className: 'crm-icon--filled' });
    stateClass = ' is-refresh';
    title = `Stand: ${new Date(item.ig_fetched_at).toLocaleString('de-DE')} · frisch bei Instagram abrufen`;
    label = 'Instagram-Daten frisch abrufen';
  }

  return `<button type="button"
    class="ig-fetch-btn${stateClass}"
    data-ig-fetch
    data-item-id="${escapeHtml(item.id)}"
    title="${escapeHtml(title)}"
    aria-label="${escapeHtml(label)}"
    ${hasLink ? '' : 'hidden disabled'}>${iconHtml}</button>`;
}

/** @deprecated Alias - Tests und ältere Call-Sites */
export function sourcingIgDotState(item) {
  if (!item?.link_instagram) {
    return { stateClass: 'is-empty', title: '' };
  }
  if (item.ig_fetch_error) {
    return { stateClass: 'is-error', title: `Abruf fehlgeschlagen: ${item.ig_fetch_error}` };
  }
  if (item.ig_fetched_at) {
    const stand = new Date(item.ig_fetched_at).toLocaleString('de-DE');
    return { stateClass: 'is-refresh', title: `Stand: ${stand} · frisch bei Instagram abrufen` };
  }
  return { stateClass: 'is-idle', title: 'Instagram-Daten abrufen (bekannte Creator kommen aus dem Pool)' };
}

export function renderSourcingIgCell(item) {
  const url = item.link_instagram || '';

  return renderChipCell({
    toolbar: SOURCING_IG_TOOLBAR,
    id: item.id,
    className: 'chip-cell--ig-fetch',
    input: {
      className: 'links-compact-input',
      value: url,
      placeholder: 'IG Link...',
      ariaLabel: 'Instagram-Link',
      attrs: {
        'data-field': 'link_instagram',
        'data-item-id': item.id
      }
    },
    chip: renderPlatformChip(url, sourcingIgHandle(item)),
    action: renderIgFetchButton(item)
  });
}

export function applySourcingIgCellState(cell, item) {
  if (!cell) return;

  const url = item?.link_instagram || '';
  applyChipCellState(cell, {
    value: url,
    chip: renderPlatformChip(url, sourcingIgHandle(item))
  });

  const slot = cell.querySelector('[data-chip-cell-action]');
  if (slot) slot.innerHTML = renderIgFetchButton(item);
}

export function findSourcingIgCell(itemId) {
  return findChipCell(SOURCING_IG_TOOLBAR, itemId);
}
