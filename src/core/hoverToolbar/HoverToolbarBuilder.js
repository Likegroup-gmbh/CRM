// HoverToolbarBuilder
// Baut den Inhalt einer Hover-Toolbar aus ihrer Action-Liste. Pendant zum
// ActionBuilder der Dropdowns, nur fuer eine waagerechte Leiste.
//
// Kern ist resolve(): jedes Feld einer Action darf ein fester Wert oder eine
// Funktion (ctx) => wert sein. Damit braucht eine Spalte, deren Button je nach
// Datenlage anders heisst, keine eigene Klasse mehr - sie schreibt
// label: ctx => ... in ihre Config. Genau das war vorher als _statsButton in der
// LiveLinkToolbar fest verdrahtet.

import { iconRegistry } from '../actions/IconRegistry.js';

/**
 * Eigene Variante statt der aus entityColumnUtils: die escaped ueber
 * textContent und laesst Anfuehrungszeichen stehen. Hier landen Werte in
 * Attributen - vor allem hrefs aus von Hand eingetragenen Links -, ein
 * ungeschuetztes " wuerde das Attribut sprengen.
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

/** Wert oder Resolver-Funktion zu einem Wert machen. */
export function resolve(value, ctx) {
  return typeof value === 'function' ? value(ctx) : value;
}

/**
 * Actions aussortieren, die im aktuellen Zustand nichts zu tun haetten - etwa
 * der Extern-Link ohne URL. Ohne visible muesste jede Config ihre Liste selbst
 * vorfiltern.
 */
export function visibleActions(actions, ctx) {
  return (actions || []).filter(action => {
    if (!action) return false;
    if (action.visible === undefined) return true;
    return !!resolve(action.visible, ctx);
  });
}

function buttonClasses(action, ctx) {
  const classes = ['hover-toolbar__btn'];
  if (action.variant === 'primary') classes.push('hover-toolbar__btn--primary');
  if (action.variant === 'icon') classes.push('hover-toolbar__btn--icon');
  if (action.danger) classes.push('hover-toolbar__btn--danger');

  const extra = resolve(action.className, ctx);
  if (extra) classes.push(extra);

  return classes.join(' ');
}

/**
 * Zusaetzliche data-Attribute. Die ID sitzt immer als data-id drauf, damit
 * Handler den Datensatz auch ohne den ctx wiederfinden.
 */
function datasetAttrs(action, ctx) {
  const extra = resolve(action.dataset, ctx) || {};
  return Object.entries(extra)
    .map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`)
    .join('');
}

function iconHtml(action, ctx) {
  const name = resolve(action.icon, ctx);
  return name ? iconRegistry.get(name) : '';
}

function labelHtml(action, ctx) {
  const label = resolve(action.label, ctx);
  return label ? `<span>${escapeHtml(label)}</span>` : '';
}

function titleAttr(action, ctx) {
  const title = resolve(action.title, ctx);
  return title ? ` title="${escapeHtml(title)}"` : '';
}

/**
 * Icon-Buttons brauchen einen Namen fuer Screenreader. Buttons mit Beschriftung
 * tragen ihn schon im Text.
 */
function ariaLabelAttr(action, ctx) {
  const aria = resolve(action.ariaLabel, ctx);
  if (aria) return ` aria-label="${escapeHtml(aria)}"`;
  if (resolve(action.label, ctx)) return '';
  const title = resolve(action.title, ctx);
  return title ? ` aria-label="${escapeHtml(title)}"` : '';
}

function buildLink(action, ctx) {
  const href = resolve(action.href, ctx) || '';
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
    + ` class="${buttonClasses(action, ctx)}" data-hover-action="${escapeHtml(action.id || '')}"`
    + `${titleAttr(action, ctx)}${ariaLabelAttr(action, ctx)}${datasetAttrs(action, ctx)}>`
    + `${iconHtml(action, ctx)}${labelHtml(action, ctx)}</a>`;
}

function buildButton(action, ctx) {
  const disabled = resolve(action.disabled, ctx) ? ' disabled' : '';
  return `<button type="button" class="${buttonClasses(action, ctx)}"`
    + ` data-hover-action="${escapeHtml(action.id || '')}" data-id="${escapeHtml(ctx?.id ?? '')}"`
    + `${titleAttr(action, ctx)}${ariaLabelAttr(action, ctx)}${datasetAttrs(action, ctx)}${disabled}>`
    + `${iconHtml(action, ctx)}${labelHtml(action, ctx)}</button>`;
}

function buildAction(action, ctx) {
  if (action.type === 'separator') {
    return '<span class="hover-toolbar__divider" aria-hidden="true"></span>';
  }
  if (action.type === 'link') return buildLink(action, ctx);
  return buildButton(action, ctx);
}

/**
 * Hinweis- und Fehlerzeilen unter den Buttons. Fehlertexte standen vorher nur im
 * title-Attribut und waren damit praktisch unsichtbar.
 */
function buildRows(rows, ctx) {
  return (rows || [])
    .map(row => resolve(row, ctx))
    .filter(row => row && row.text)
    .map(row => {
      const kind = row.kind === 'error' ? 'error' : 'hint';
      return `<div class="hover-toolbar__${kind}">${escapeHtml(row.text)}</div>`;
    })
    .join('');
}

/**
 * Kompletter Innenraum der Leiste. Das umgebende Portal-Element baut die Engine,
 * weil sie darauf ihre Listener setzt.
 */
export function buildHoverToolbarContent(config, ctx) {
  const actions = visibleActions(config.actions, ctx);
  const buttons = actions.map(action => buildAction(action, ctx)).join('');

  return `<div class="hover-toolbar__row">${buttons}</div>${buildRows(config.rows, ctx)}`;
}
