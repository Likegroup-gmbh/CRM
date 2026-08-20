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
import { icon } from '../../core/icons/IconSystem.js';

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

const INSTAGRAM_ICON = icon('instagram', { className: 'chip-cell__icon' });

const TIKTOK_ICON = icon('tiktok', { className: 'chip-cell__icon crm-icon--filled' });

const LINK_ICON = icon('link', { className: 'chip-cell__icon' });

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
