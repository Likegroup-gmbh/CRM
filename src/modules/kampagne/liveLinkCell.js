// liveLinkCell.js
// Was die Live-Link-Zelle aus einem Video macht: Chip-Beschriftung und Zustand
// des Status-Punkts. Das Geruest der Zelle liegt zentral in
// src/core/components/chipCell.js, hier steht nur die Uebersetzung von
// Video-Feldern (link_live, stats_fetched_at, stats_error) in diese Bausteine.
//
// Bewusst als eigenes Modul, weil vier Stellen denselben Zustand darstellen
// muessen: der Renderer beim Full-Render, VideoStatsFetcher nach Abruf und
// Clear, der Realtime-Handler bei Fremd-Aenderungen und liveLinkToolbarConfig
// fuer ihre Button-Beschriftung. Die Video-Tabelle rendert einzelne Zellen nicht
// neu, das DOM muss also gezielt gepatcht werden - sonst zeigt der Chip nach
// einem Clear noch den alten Link.

import { applyChipCellState, findChipCell, renderPlatformChip } from '../../core/components/chipCell.js';

// Name der Config in der HoverToolbarRegistry. Steht hier und nicht in
// liveLinkToolbarConfig, weil die Zelle ihn ins Markup schreibt und darueber
// auch wiedergefunden wird - die Config importiert aus dieser Datei, andersherum
// waere es ein Zirkel.
export const LIVE_LINK_TOOLBAR = 'kampagne-live-link';

/**
 * Zustand des Status-Punkts. Er ersetzt den frueheren Haekchen-Button als
 * Anzeige und ist gleichzeitig der Hinweis, dass an dieser Zelle Aktionen
 * haengen.
 */
export function liveLinkDotState(video) {
  if (!video?.link_live) {
    return { stateClass: 'is-empty', title: '' };
  }
  if (video.stats_error) {
    return { stateClass: 'is-error', title: `Abruf fehlgeschlagen: ${video.stats_error}` };
  }
  if (video.stats_fetched_at) {
    const stand = new Date(video.stats_fetched_at).toLocaleString('de-DE');
    return { stateClass: 'is-fetched', title: `Statistiken abgerufen · Stand: ${stand}` };
  }
  return { stateClass: 'is-idle', title: 'Statistiken noch nicht abgerufen' };
}

/**
 * Chip, Dot und Input einer bereits gerenderten Zelle auf den aktuellen
 * Video-Stand bringen. Der Handle steckt im Input, weil die Kooperation an
 * dieser Stelle nicht mehr greifbar ist.
 */
export function applyLiveLinkCellState(cell, video) {
  if (!cell) return;

  const url = video?.link_live || '';
  const handle = cell.querySelector('.chip-cell__input')?.dataset.liveLinkHandle || '';

  applyChipCellState(cell, {
    value: url,
    chip: renderPlatformChip(url, handle),
    dot: liveLinkDotState(video)
  });
}

/** Zelle eines Videos in der Kooperationen-Video-Tabelle finden. */
export function findLiveLinkCell(videoId) {
  return findChipCell(LIVE_LINK_TOOLBAR, videoId);
}

/**
 * Video-Objekt zur ID suchen. Die Videos liegen nach Kooperation gruppiert,
 * eine ID allein reicht also nicht fuer den direkten Zugriff.
 */
export function findVideoInTable(table, videoId) {
  const source = table?.store?.videos || table?.videos || {};
  for (const koopId in source) {
    const treffer = (source[koopId] || []).find(v => v.id === videoId);
    if (treffer) return treffer;
  }
  return null;
}
