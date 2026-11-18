// Verknuepfungs-Pill: die einheitliche Darstellung eines verlinkten Datensatzes
// in Tabellenzellen (Briefing, Persona, Produkt, Creator, Vertrag ...).
//
// Gleicher Look wie die Verknuepfungen im Konzept-Tab (.creator-cell-select):
// Rahmen, vorangestelltes Entity-Icon, Label mit Ellipsis. Das Icon kommt aus
// der Entity-Registry (entityIcons.js), nie von Hand pro Tabelle.
//
// Das Pill ist ein <a class="table-link ..."> und behaelt damit die bestehenden
// Klick-Handler der Seiten (.table-link[data-table][data-id]). Kinder tragen
// pointer-events:none, damit e.target im Handler immer der Anker selbst ist.
//
// Nicht fuer die Namensspalte (Hauptinhalt der Zeile) und nicht fuer
// Unternehmen/Marke - die haben eigene Icons und Bubbles.

import { entityIcon } from '../icons/entityIcons.js';
import { escapeHtml } from '../format.js';

/**
 * @param {object} spec
 * @param {string} spec.kind        Entity-Key fuer das Icon (briefing, persona, creator ...)
 * @param {string} [spec.label]     Klartext, wird escaped und dient als Tooltip
 * @param {string} [spec.labelHtml] Bereits escaptes Markup, wenn der Aufrufer nur das hat
 * @param {string} [spec.href]      Ziel, Standard '#'
 * @param {string} [spec.attrs]     Weitere Attribute (data-table, data-id, onclick ...)
 * @param {string} [spec.className] Zusaetzliche Klassen
 */
export function renderVerknuepfungPill({
  kind,
  label,
  labelHtml,
  href = '#',
  attrs = '',
  className = ''
} = {}) {
  const text = labelHtml ?? escapeHtml(label ?? '');
  if (!text) return '';
  const title = label ? ` title="${escapeHtml(label)}"` : '';
  const klassen = ['table-link', 'verknuepfung-pill', className].filter(Boolean).join(' ');
  return `<a href="${escapeHtml(href)}" class="${klassen}"${title}${attrs ? ` ${attrs}` : ''}>`
    + `${entityIcon(kind, { className: 'verknuepfung-pill__icon' })}`
    + `<span class="verknuepfung-pill__label">${text}</span></a>`;
}

/** Mehrere Pills untereinander in einer Zelle. Ohne Inhalt der Strich. */
export function renderVerknuepfungStack(pillsHtml) {
  const html = (pillsHtml || []).filter(Boolean).join('');
  return html ? `<div class="table-link-stack">${html}</div>` : '-';
}
