// liveLinkCell.js
// Chip und Status-Punkt der Live-Link-Zelle. Bewusst als eigenes Modul, weil
// vier Stellen denselben Zustand darstellen muessen: der Renderer beim
// Full-Render, VideoStatsFetcher nach Abruf und Clear, der Realtime-Handler bei
// Fremd-Aenderungen und die LiveLinkToolbar fuer ihre Button-Beschriftung.
// Die Video-Tabelle rendert einzelne Zellen nicht neu, das DOM muss also
// gezielt gepatcht werden - sonst zeigt der Chip nach einem Clear noch den
// alten Link.

import { formatLinkLabel, parseSocialLink } from '../../core/format/socialLink.js';
import { escapeHtml } from '../../core/customColumns/entityColumnUtils.js';

const CHIP_INSTAGRAM_ICON = `<svg class="live-link-chip__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/><path d="M16.95 6.45a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"/><path d="M12 2.8c2.53 0 2.83.01 3.83.06 1 .05 1.68.21 2.28.44.62.24 1.15.56 1.66 1.07.51.51.83 1.04 1.07 1.66.23.6.39 1.28.44 2.28.05 1 .06 1.3.06 3.83s-.01 2.83-.06 3.83c-.05 1-.21 1.68-.44 2.28-.24.62-.56 1.15-1.07 1.66-.51.51-1.04.83-1.66 1.07-.6.23-1.28.39-2.28.44-1 .05-1.3.06-3.83.06s-2.83-.01-3.83-.06c-1-.05-1.68-.21-2.28-.44a4.54 4.54 0 0 1-2.73-2.73c-.23-.6-.39-1.28-.44-2.28C2.81 14.83 2.8 14.53 2.8 12s.01-2.83.06-3.83c.05-1 .21-1.68.44-2.28.24-.62.56-1.15 1.07-1.66.51-.51 1.04-.83 1.66-1.07.6-.23 1.28-.39 2.28-.44 1-.05 1.3-.06 3.83-.06Zm0 1.8c-2.48 0-2.77.01-3.75.06-.9.04-1.39.19-1.71.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.81-.31 1.71-.05.98-.06 1.27-.06 3.75s.01 2.77.06 3.75c.04.9.19 1.39.31 1.71.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.81.27 1.71.31.98.05 1.27.06 3.75.06s2.77-.01 3.75-.06c.9-.04 1.39-.19 1.71-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.81.31-1.71.05-.98.06-1.27.06-3.75s-.01-2.77-.06-3.75c-.04-.9-.19-1.39-.31-1.71-.17-.43-.37-.74-.7-1.07-.33-.33-.64-.53-1.07-.7-.32-.12-.81-.27-1.71-.31-.98-.05-1.27-.06-3.75-.06Z"/></svg>`;

const CHIP_TIKTOK_ICON = `<svg class="live-link-chip__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 3c.4 3.2 2.3 5.1 5.5 5.5v2.3c-1.9 0-3.6-.6-5-1.7v6.4c0 3.1-2.5 5.6-5.6 5.6S3.8 19 3.8 15.9s2.5-5.6 5.6-5.6c.5 0 1 .1 1.5.2v2.6c-.5-.2-1-.4-1.5-.4-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.9Z"/></svg>`;

const CHIP_LINK_ICON = `<svg class="live-link-chip__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

/** Innerer Aufbau des Chips: Plattform-Icon plus Beschriftung. */
export function renderLiveLinkChip(url, handle) {
  if (!url) return '';

  const { platform } = parseSocialLink(url);
  const icon = platform === 'instagram'
    ? CHIP_INSTAGRAM_ICON
    : platform === 'tiktok' ? CHIP_TIKTOK_ICON : CHIP_LINK_ICON;

  const label = formatLinkLabel(url, handle);
  return `${icon}<span class="live-link-chip__label">${escapeHtml(label)}</span>`;
}

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
 * aria-hidden, weil derselbe Text als Hinweiszeile in der Toolbar steht - und
 * die erreicht man per Tastatur ueber den Fokus im Eingabefeld. Der Punkt ist
 * fuer Maus und Touch da.
 */
export function renderLiveLinkDot(video) {
  const { stateClass, title } = liveLinkDotState(video);
  return `<span class="live-link-dot ${stateClass}" data-live-link-dot
    aria-hidden="true" title="${escapeHtml(title)}"></span>`;
}

/**
 * Chip, Dot und Input einer bereits gerenderten Zelle auf den aktuellen
 * Video-Stand bringen. Der Handle steckt im Input, weil die Kooperation an
 * dieser Stelle nicht mehr greifbar ist.
 */
export function applyLiveLinkCellState(cell, video) {
  if (!cell) return;

  const url = video?.link_live || '';
  const input = cell.querySelector('input[data-field="link_live"]');
  if (input) {
    if (document.activeElement !== input) input.value = url;
  }

  const chip = cell.querySelector('[data-live-link-chip]');
  if (chip) {
    chip.innerHTML = renderLiveLinkChip(url, input?.dataset.liveLinkHandle || '');
    chip.hidden = !url;
  }

  const dot = cell.querySelector('[data-live-link-dot]');
  if (dot) {
    const { stateClass, title } = liveLinkDotState(video);
    dot.classList.remove('is-empty', 'is-idle', 'is-fetched', 'is-error', 'is-loading');
    dot.classList.add(stateClass);
    dot.title = title;
  }
}

/** Zelle eines Videos in der Kooperationen-Video-Tabelle finden. */
export function findLiveLinkCell(videoId) {
  if (!videoId) return null;
  return document.querySelector(
    `.kooperation-video-grid .live-link-cell[data-video-id="${videoId}"]`
  );
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
