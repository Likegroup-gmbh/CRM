// chipCell
// Tabellenzelle fuer einen Social-Link. Sichtbar ist ein Chip ("Reel · @handle"
// oder "@handle"), der als Overlay ueber dem Eingabefeld liegt - dasselbe
// Muster wie bei den Stats-Zahlen. Die Roh-URL steckt im Input und erscheint
// beim Fokussieren. Rechts sitzt ein Status-Punkt, der zugleich Hinweis darauf
// ist, dass an der Zelle Aktionen haengen (die schwebende .hover-toolbar).
//
// Zentral, weil zwei Spalten dieselbe Struktur brauchen: der Live-Link der
// Kooperationen-Videos und der Instagram-Link im Sourcing. Ohne dieses Modul
// laege das Muster zweimal im Code und wuerde auseinanderdriften.
//
// Der Aufbau ist bewusst unabhaengig vom Datensatz: was im Chip steht und
// welche Farbe der Punkt hat, entscheidet der Aufrufer und uebergibt es als
// fertigen Wert. Nur das Geruest und das gezielte Nachziehen im DOM liegen hier.

import { formatLinkLabel, parseSocialLink } from '../format/socialLink.js';

/**
 * Eigene Variante statt der aus entityColumnUtils: die escaped ueber
 * textContent und laesst Anfuehrungszeichen stehen. Hier landen Werte in
 * Attributen - vor allem von Hand eingetragene URLs -, ein ungeschuetztes "
 * wuerde das Attribut sprengen.
 */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const INSTAGRAM_ICON = `<svg class="chip-cell__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/><path d="M16.95 6.45a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"/><path d="M12 2.8c2.53 0 2.83.01 3.83.06 1 .05 1.68.21 2.28.44.62.24 1.15.56 1.66 1.07.51.51.83 1.04 1.07 1.66.23.6.39 1.28.44 2.28.05 1 .06 1.3.06 3.83s-.01 2.83-.06 3.83c-.05 1-.21 1.68-.44 2.28-.24.62-.56 1.15-1.07 1.66-.51.51-1.04.83-1.66 1.07-.6.23-1.28.39-2.28.44-1 .05-1.3.06-3.83.06s-2.83-.01-3.83-.06c-1-.05-1.68-.21-2.28-.44a4.54 4.54 0 0 1-2.73-2.73c-.23-.6-.39-1.28-.44-2.28C2.81 14.83 2.8 14.53 2.8 12s.01-2.83.06-3.83c.05-1 .21-1.68.44-2.28.24-.62.56-1.15 1.07-1.66.51-.51 1.04-.83 1.66-1.07.6-.23 1.28-.39 2.28-.44 1-.05 1.3-.06 3.83-.06Zm0 1.8c-2.48 0-2.77.01-3.75.06-.9.04-1.39.19-1.71.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.81-.31 1.71-.05.98-.06 1.27-.06 3.75s.01 2.77.06 3.75c.04.9.19 1.39.31 1.71.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.81.27 1.71.31.98.05 1.27.06 3.75.06s2.77-.01 3.75-.06c.9-.04 1.39-.19 1.71-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.81.31-1.71.05-.98.06-1.27.06-3.75s-.01-2.77-.06-3.75c-.04-.9-.19-1.39-.31-1.71-.17-.43-.37-.74-.7-1.07-.33-.33-.64-.53-1.07-.7-.32-.12-.81-.27-1.71-.31-.98-.05-1.27-.06-3.75-.06Z"/></svg>`;

const TIKTOK_ICON = `<svg class="chip-cell__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 3c.4 3.2 2.3 5.1 5.5 5.5v2.3c-1.9 0-3.6-.6-5-1.7v6.4c0 3.1-2.5 5.6-5.6 5.6S3.8 19 3.8 15.9s2.5-5.6 5.6-5.6c.5 0 1 .1 1.5.2v2.6c-.5-.2-1-.4-1.5-.4-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.9Z"/></svg>`;

const LINK_ICON = `<svg class="chip-cell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

export const CHIP_DOT_STATES = ['is-empty', 'is-idle', 'is-fetched', 'is-error', 'is-loading'];

/**
 * Innerer Inhalt des Chips: Plattform-Icon plus Beschriftung. Die Beschriftung
 * kommt aus formatLinkLabel und unterscheidet sich damit automatisch je Link -
 * "Reel · @handle" bei einem Beitrag, "@handle" bei einem Profil.
 */
export function renderPlatformChip(url, handle) {
  if (!url) return '';

  const { platform } = parseSocialLink(url);
  const icon = platform === 'instagram'
    ? INSTAGRAM_ICON
    : platform === 'tiktok' ? TIKTOK_ICON : LINK_ICON;

  return `${icon}<span class="chip-cell__label">${escapeHtml(formatLinkLabel(url, handle))}</span>`;
}

/**
 * aria-hidden, weil derselbe Text als Hinweiszeile in der Toolbar steht - und
 * die erreicht man per Tastatur ueber den Fokus im Eingabefeld. Der Punkt ist
 * fuer Maus und Touch da; data-hover-toolbar-trigger macht ihn dort, wo es kein
 * Hover gibt, zum Ausloeser der Leiste.
 */
export function renderChipDot({ stateClass = 'is-empty', title = '' } = {}) {
  return `<span class="chip-cell__dot ${stateClass}" data-chip-cell-dot
    data-hover-toolbar-trigger aria-hidden="true" title="${escapeHtml(title)}"></span>`;
}

function inputAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('');
}

/**
 * Geruest der Zelle. Die direkten Kinder sind immer dieselben drei Elemente,
 * egal ob ein Link gesetzt ist - genau das war das Problem der alten Variante,
 * in der Extern-Link und Loesch-Button nur bei gefuellter URL existierten und
 * den Input dabei in der Breite verschoben haben.
 *
 * data-hover-toolbar meldet die Zelle bei der Engine an, data-id ist der Anker,
 * ueber den findChipCell und HoverToolbar.rebind sie nach einem Neuaufbau der
 * Zeile wiederfinden.
 *
 * @param {object}  spec
 * @param {string}  spec.toolbar         Name der Config in der HoverToolbarRegistry
 * @param {string}  spec.id              ID des Datensatzes
 * @param {object}  spec.input           { value, placeholder, className, ariaLabel, attrs }
 * @param {string}  spec.chip            HTML des Chip-Inhalts, meist renderPlatformChip
 * @param {object}  spec.dot             { stateClass, title }
 * @param {string}  spec.className       zusaetzliche Klassen am Wrapper
 */
export function renderChipCell({ toolbar, id, input = {}, chip = '', dot = {}, className = '' } = {}) {
  const inputClass = ['chip-cell__input', input.className].filter(Boolean).join(' ');

  return `
    <div class="chip-cell${className ? ` ${className}` : ''}" data-hover-toolbar="${escapeHtml(toolbar)}" data-id="${escapeHtml(id)}">
      <input type="text" class="${inputClass}"
        value="${escapeHtml(input.value || '')}"
        placeholder="${escapeHtml(input.placeholder || '')}"${input.ariaLabel ? ` aria-label="${escapeHtml(input.ariaLabel)}"` : ''}${inputAttrs(input.attrs)}/>
      <span class="chip-cell__chip" data-chip-cell-chip${chip ? '' : ' hidden'}>${chip}</span>
      ${renderChipDot(dot)}
    </div>
  `;
}

/**
 * Kunden-/Readonly-Ansicht: derselbe Chip, aber ohne Input und Punkt und dafuer
 * als anklickbarer Link. Ohne URL bleibt es beim Platzhalter des Aufrufers.
 */
export function renderStaticChip({ href, chip, title = '' }) {
  if (!href || !chip) return '';
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
    class="chip-cell__chip chip-cell__chip--static" title="${escapeHtml(title)}">${chip}</a>`;
}

/**
 * Bereits gerenderte Zelle nachziehen. Die Tabellen rendern einzelne Zellen
 * nicht neu, das DOM muss also gezielt gepatcht werden - sonst zeigt der Chip
 * nach einem Clear noch den alten Link.
 *
 * Ein fokussiertes Eingabefeld bleibt unangetastet: wer gerade tippt, soll den
 * eigenen Text nicht unter den Haenden weggezogen bekommen.
 */
export function applyChipCellState(cell, { value, chip, dot } = {}) {
  if (!cell) return;

  const input = cell.querySelector('.chip-cell__input');
  if (input && value !== undefined && document.activeElement !== input) {
    input.value = value || '';
  }

  const chipEl = cell.querySelector('[data-chip-cell-chip]');
  if (chipEl && chip !== undefined) {
    chipEl.innerHTML = chip || '';
    chipEl.hidden = !chip;
  }

  const dotEl = cell.querySelector('[data-chip-cell-dot]');
  if (dotEl && dot) {
    dotEl.classList.remove(...CHIP_DOT_STATES);
    dotEl.classList.add(dot.stateClass || 'is-empty');
    dotEl.title = dot.title || '';
  }
}

/**
 * Punkt als Spinner, solange ein Abruf laeuft. Getrennt von
 * applyChipCellState, weil der Ladezustand nicht aus den Daten kommt - er
 * endet mit dem naechsten applyChipCellState von selbst.
 */
export function setChipCellLoading(cell, loading) {
  const dot = cell?.querySelector('[data-chip-cell-dot]');
  if (!dot) return;
  dot.classList.toggle('is-loading', !!loading);
}

/** Zelle eines Datensatzes ueber Config-Name und ID finden. */
export function findChipCell(toolbar, id) {
  if (!toolbar || id == null || id === '') return null;
  return document.querySelector(
    `.chip-cell[data-hover-toolbar="${toolbar}"][data-id="${id}"]`
  );
}
