// thinking.js
// Praesentationaler Thinking-Slot: Liste { step, label } rein, Markup raus.
// Kennt keine Chat-Sorte und keinen Step-Katalog. Wer arbeitet, schickt
// die Labels mit; ein neuer Chat haengt denselben Slot ein.

import { icon } from '../icons/IconSystem.js';

export const DEFAULT_STEP = { step: 'working', label: 'Ich arbeite gerade…' };
export const PENDING_STEP = { step: 'pending', label: 'Auftrag ist unterwegs…' };

const CHECK = icon('check-bold');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asItem(item) {
  const step = String(item?.step || '').trim();
  const label = String(item?.label || '').trim();
  return step && label ? { step, label } : null;
}

/** Reine Liste normalisieren. Leere Eingabe -> Default-Schritt. */
export function normalizeSteps(steps) {
  const list = Array.isArray(steps) ? steps.map(asItem).filter(Boolean) : [];
  return list.length ? list : [{ ...DEFAULT_STEP }];
}

/** Naechsten Schritt anhaengen. Gleicher letzter step ersetzt nur das Label. */
export function pushStep(steps, item) {
  const next = Array.isArray(steps) ? steps.map(asItem).filter(Boolean) : [];
  const add = asItem(item);
  if (!add) return next;
  const last = next[next.length - 1];
  if (last?.step === add.step) {
    next[next.length - 1] = add;
    return next;
  }
  next.push(add);
  return next;
}

export function pendingThinking() {
  return [{ ...PENDING_STEP }];
}

function stepItemHtml(item, active) {
  const mark = active
    ? '<span class="chat-thinking__mark" aria-hidden="true"><i></i><i></i><i></i></span>'
    : `<span class="chat-thinking__mark" aria-hidden="true">${CHECK}</span>`;
  return `<li class="chat-thinking__step${active ? ' is-active' : ''}">${mark}<span class="chat-thinking__text">${escapeHtml(item.label)}</span></li>`;
}

/**
 * Markup fuer den Working-Slot.
 * @param {Array<{step: string, label: string}>} steps
 * @param {{ done?: boolean }} [options] - done: alle Schritte als erledigt (kein aktiver letzter)
 */
export function thinkingHtml(steps, { done = false } = {}) {
  const list = normalizeSteps(steps);
  const items = list.map((item, i) => stepItemHtml(item, !done && i === list.length - 1)).join('');
  return `<ul class="chat-thinking">${items}</ul>`;
}

/** DOM-Consumer, die nicht den ganzen Chat neu bauen. */
export function renderThinking(el, steps, options) {
  if (!el) return;
  el.innerHTML = thinkingHtml(steps, options);
}
