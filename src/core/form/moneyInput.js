// Deutsche Euro-Eingabe: Anzeige 12.345,67, im Fokus ohne Tausenderpunkt.
// Das Euro-Zeichen sitzt als Suffix am Feld, nicht im Wert.

import { parseCurrencyInput } from '../utils/parseCurrency.js';

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function asNumber(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return parseCurrencyInput(value);
}

export function formatMoneyInput(value) {
  const n = asNumber(value);
  if (n == null) return '';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function editMoneyInput(value) {
  const n = asNumber(value);
  if (n == null) return '';
  return n.toFixed(2).replace('.', ',');
}

export function setMoneyInputValue(input, value) {
  if (!input) return;
  const editing = document.activeElement === input && !input.readOnly;
  input.value = editing ? editMoneyInput(value) : formatMoneyInput(value);
}

export function bindMoneyInput(input) {
  if (!input || input.readOnly || input.dataset.moneyBound === '1') return;
  input.dataset.moneyBound = '1';
  input.addEventListener('focus', () => {
    input.value = editMoneyInput(input.value);
  });
  input.addEventListener('blur', () => {
    input.value = formatMoneyInput(input.value);
  });
}

export function bindMoneyInputs(root) {
  root?.querySelectorAll('input.money-field__input:not([readonly])').forEach(bindMoneyInput);
}

function attrString(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true || v === '' ? k : `${k}="${escapeAttr(v)}"`))
    .join(' ');
}

export function renderMoneyInput({
  id = '',
  className = '',
  value = '',
  readonly = false,
  name = '',
  attrs = {}
} = {}) {
  const classes = ['money-field__input', className].filter(Boolean).join(' ');
  const extra = attrString(attrs);
  return `<div class="money-field"><input type="text" inputmode="decimal" class="${classes}"${id ? ` id="${escapeAttr(id)}"` : ''}${name ? ` name="${escapeAttr(name)}"` : ''} placeholder="0,00" value="${escapeAttr(formatMoneyInput(value))}"${readonly ? ' readonly' : ''}${extra ? ` ${extra}` : ''}><span class="money-field__suffix" aria-hidden="true">€</span></div>`;
}
