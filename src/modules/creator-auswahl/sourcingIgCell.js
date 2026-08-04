// sourcingIgCell
// Was die Instagram-Zelle der Sourcing-Tabelle aus einem Item macht: Chip mit
// dem Handle und Zustand des Status-Punkts. Das Geruest liegt zentral in
// src/core/components/chipCell.js - dieselbe Struktur nutzt die Live-Link-Spalte
// der Kooperationen-Videos.
//
// Eigenes Modul, weil drei Stellen denselben Zustand darstellen: der Zeilen-
// Renderer, das Nachziehen nach einer Eingabe im Feld und der Abruf-Handler.

import {
  applyChipCellState, findChipCell, renderChipCell, renderPlatformChip
} from '../../core/components/chipCell.js';
import { parseSocialLink } from '../../core/format/socialLink.js';

// Name der Config in der HoverToolbarRegistry. Die Zelle schreibt ihn ins Markup
// und wird darueber auch wiedergefunden.
export const SOURCING_IG_TOOLBAR = 'sourcing-instagram';

/**
 * Handle nach Prioritaet: der beim Abruf bestaetigte Username, sonst der aus der
 * URL geparste. creator_auswahl_items hat keine Username-Spalte, der Handle
 * steckt entweder in ig_stats oder im Link.
 */
export function sourcingIgHandle(item) {
  return item?.ig_stats?.username || parseSocialLink(item?.link_instagram).handle || '';
}

/** Zustand des Status-Punkts, passend zu den drei Zustaenden der Hauptaktion. */
export function sourcingIgDotState(item) {
  if (!item?.link_instagram) {
    return { stateClass: 'is-empty', title: '' };
  }
  if (item.ig_fetch_error) {
    return { stateClass: 'is-error', title: `Abruf fehlgeschlagen: ${item.ig_fetch_error}` };
  }
  if (item.ig_fetched_at) {
    const stand = new Date(item.ig_fetched_at).toLocaleString('de-DE');
    return { stateClass: 'is-fetched', title: `Instagram-Daten abgerufen · Stand: ${stand}` };
  }
  return { stateClass: 'is-idle', title: 'Instagram-Daten noch nicht abgerufen' };
}

/**
 * Instagram-Zelle: sichtbar ist nur der Chip ("@handle") plus ein kleiner
 * Status-Punkt. Abrufen und Profil oeffnen liegen in der schwebenden
 * Hover-Toolbar - data-hover-toolbar genuegt dafuer, die Engine bindet global,
 * die Aktionen stehen in sourcingIgToolbarConfig.
 *
 * Vorher standen Input, Haekchen-Button und Extern-Link in einer Flex-Row; der
 * Input wurde dabei zerdrueckt und sprang in der Breite, sobald ein Link
 * gespeichert war.
 */
export function renderSourcingIgCell(item) {
  const url = item.link_instagram || '';

  return renderChipCell({
    toolbar: SOURCING_IG_TOOLBAR,
    id: item.id,
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
    dot: sourcingIgDotState(item)
  });
}

/**
 * Chip und Punkt nach einer Eingabe im Feld nachziehen. Ohne das bleibt die
 * Zelle nach dem Einfuegen eines Links optisch leer - und der Punkt, der auf die
 * Aktionen hinweist, unsichtbar - bis die Zeile irgendwann neu gerendert wird.
 */
export function applySourcingIgCellState(cell, item) {
  if (!cell) return;

  const url = item?.link_instagram || '';
  applyChipCellState(cell, {
    value: url,
    chip: renderPlatformChip(url, sourcingIgHandle(item)),
    dot: sourcingIgDotState(item)
  });
}

/** Instagram-Zelle eines Items finden. */
export function findSourcingIgCell(itemId) {
  return findChipCell(SOURCING_IG_TOOLBAR, itemId);
}
