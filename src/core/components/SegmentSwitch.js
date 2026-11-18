// SegmentSwitch.js
// Umschalter als Radiogruppe: die Optik von ViewModeToggle, der aktive Hintergrund gleitet als
// Thumb zum gewählten Wert. Pfeiltasten wechseln die Auswahl (Roving Tabindex, Auswahl beim Fokus).
// `attr` ist das data-Attribut der Gruppe, die Optionen tragen `${attr}-opt`. Optik in segment-switch.css.

import { ViewModeToggle } from './ViewModeToggle.js';
import { escapeHtml as esc } from '../format.js';
import { gsap, prefersReducedMotion, killRunning, trackRunning } from '../animation/gsap.js';

export const SEGMENT_ATTR = 'data-seg';

/**
 * @param {{ id: string, label?: string, options: Array<{ value: string, label: string, icon?: string }>, value: string, attr?: string }} cfg
 */
export function renderSegmentSwitch({ id, label = '', options, value, attr = SEGMENT_ATTR }) {
  const labelId = `${attr.replace(/^data-/, '')}-${id}`;
  const group = ViewModeToggle.render(
    options.map(o => ({
      label: esc(o.label),
      icon: o.icon,
      active: o.value === value,
      attrs: `type="button" role="radio" ${attr}-opt data-value="${esc(o.value)}" aria-checked="${o.value === value}" tabindex="${o.value === value ? 0 : -1}"`
    })),
    {
      className: 'segment-switch view-toggle--sm',
      groupAttrs: `role="radiogroup" ${attr}="${esc(id)}" ${label ? `aria-labelledby="${labelId}"` : `aria-label="${esc(id)}"`}`,
      extraHtml: '<span class="segment-switch__thumb" data-seg-thumb aria-hidden="true"></span>'
    }
  );
  if (!label) return group;
  return `<div class="segment-field"><span class="segment-field__label" id="${labelId}">${esc(label)}</span>${group}</div>`;
}

/** Thumb an die gewählte Option schieben, ohne `animate` sofort (initial, Resize, Schrift geladen). */
export function moveSegmentThumb(group, { animate = true } = {}) {
  const thumb = group?.querySelector('[data-seg-thumb]');
  const opt = group?.querySelector('[role="radio"][aria-checked="true"]');
  if (!thumb || !opt) return;
  const vars = { x: opt.offsetLeft, width: opt.offsetWidth };
  killRunning(thumb);
  if (!animate || prefersReducedMotion()) {
    gsap.set(thumb, vars);
    return;
  }
  trackRunning(thumb, gsap.to(thumb, { ...vars, duration: 0.3, ease: 'power3.out' }));
}

/**
 * Auswahl setzen (aria-checked, active, tabindex). Den Thumb bewegt der Aufrufer bzw. `move`.
 * @returns {boolean} true, wenn sich die Auswahl geändert hat
 */
export function setSegmentValue(group, value, { attr = SEGMENT_ATTR } = {}) {
  if (!group || value === undefined) return false;
  let changed = false;
  group.querySelectorAll(`[${attr}-opt]`).forEach((opt) => {
    const on = opt.dataset.value === value;
    if (on && opt.getAttribute('aria-checked') !== 'true') changed = true;
    opt.setAttribute('aria-checked', String(on));
    opt.classList.toggle('active', on);
    opt.tabIndex = on ? 0 : -1;
  });
  return changed;
}

/** Pfeiltasten, Home und End in einer Radiogruppe. @returns {boolean} true, wenn die Taste dem Umschalter gehörte */
export function onSegmentKeydown(e, { attr = SEGMENT_ATTR } = {}) {
  const opt = e.target.closest?.(`[${attr}-opt]`);
  if (!opt) return false;
  const opts = [...opt.closest(`[${attr}]`).querySelectorAll(`[${attr}-opt]`)];
  const i = opts.indexOf(opt);
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % opts.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + opts.length) % opts.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = opts.length - 1;
  if (next < 0) return false;
  e.preventDefault();
  opts[next].focus();
  opts[next].click();
  return true;
}

/**
 * Umschalter außerhalb eines Controllers binden: Klick wählt, Pfeiltasten wechseln, der Thumb folgt.
 * @param {HTMLElement} root - Element, das die Gruppe enthält (Listener per Delegation)
 * @param {(id: string, value: string) => void} onChange
 * @returns {() => void} cleanup
 */
export function bindSegmentSwitches(root, onChange, { attr = SEGMENT_ATTR } = {}) {
  if (!root) return () => {};
  const click = (e) => {
    const opt = e.target.closest(`[${attr}-opt]`);
    if (!opt || !root.contains(opt)) return;
    const group = opt.closest(`[${attr}]`);
    if (!setSegmentValue(group, opt.dataset.value, { attr })) return;
    moveSegmentThumb(group);
    onChange(group.getAttribute(attr), opt.dataset.value);
  };
  const key = (e) => { onSegmentKeydown(e, { attr }); };
  const resync = () => syncSegmentThumbs(root, { attr });
  root.addEventListener('click', click);
  root.addEventListener('keydown', key);
  window.addEventListener('resize', resync);
  resync();
  document.fonts?.ready?.then(resync);
  return () => {
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', key);
    window.removeEventListener('resize', resync);
  };
}

/** Alle Thumbs unter `root` ohne Animation an ihre Auswahl setzen. */
export function syncSegmentThumbs(root, { attr = SEGMENT_ATTR } = {}) {
  if (!root?.isConnected) return;
  root.querySelectorAll(`[${attr}]`).forEach((group) => moveSegmentThumb(group, { animate: false }));
}
