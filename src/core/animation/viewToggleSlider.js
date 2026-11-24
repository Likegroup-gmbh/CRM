// viewToggleSlider.js
// Gleitender Hintergrund (Thumb) fuer alle Umschalter .view-toggle (Liste/Grid/Kalender ...).
// Kein Aufruf pro Seite noetig: initViewToggleSlider() beobachtet den DOM einmal zentral.
//   Umschalter neu im DOM               -> Thumb sofort unter den aktiven Button
//   .active wechselt                    -> Thumb gleitet
//   Umschalter beim Klick neu gerendert -> neuer Thumb startet an der alten Position und gleitet
//   Groesse aendert sich                -> Thumb sofort nachziehen (ResizeObserver)
// Neu gerendert heisst: gleiche Buttons, gleicher Pfad, innerhalb von HANDOFF_MS. Beim Seitenwechsel sitzt er sofort.
// Opt-out: data-view-slider="off". .segment-switch hat einen eigenen Thumb (SegmentSwitch.js).
// Optik in assets/styles/motion.css, Tempo und Easing in slideMotion.js.

import { gsap, killRunning, isRunning } from './gsap.js';
import { slideTo, offsetIn } from './slideMotion.js';

const TOGGLE_SELECTOR = '.view-toggle';
const BUTTON_SELECTOR = '.mdc-btn, .secondary-btn';
const TOGGLE_ATTR = 'data-view-slider';
const THUMB_ATTR = 'data-view-slider-thumb';
const HANDOFF_MS = 3000;

/** Letzte Thumb-Position je Umschalter (Element). */
const states = new WeakMap();
/** Signatur -> Position eines entfernten Umschalters, fuer seinen neu gerenderten Nachfolger. */
const handoffs = new Map();
let watched = new WeakSet();

let observer = null;
let resizeObserver = null;

const isElement = (node) => node?.nodeType === 1;
const isThumb = (node) => isElement(node) && node.hasAttribute(THUMB_ATTR);
const isEligible = (toggle) => !toggle.classList.contains('segment-switch') && toggle.getAttribute(TOGGLE_ATTR) !== 'off';

function within(node, selector) {
  if (!isElement(node)) return [];
  const found = node.matches(selector) ? [node] : [];
  return found.concat(Array.from(node.querySelectorAll(selector)));
}

function buttonsOf(toggle) {
  return Array.from(toggle.querySelectorAll(BUTTON_SELECTOR)).filter((btn) => btn.closest(TOGGLE_SELECTOR) === toggle);
}

function thumbOf(toggle) {
  return Array.from(toggle.children).find(isThumb) || null;
}

const signature = (buttons) => buttons.map((btn) => btn.id || btn.textContent.trim()).join('|');

/* ---- ResizeObserver ---- */

function watch(el) {
  if (!resizeObserver || watched.has(el)) return;
  watched.add(el);
  resizeObserver.observe(el);
}

function unwatch(el) {
  if (!watched.has(el)) return;
  watched.delete(el);
  resizeObserver?.unobserve(el);
}

function onResize(entries) {
  const toggles = new Set();
  entries.forEach(({ target }) => {
    if (!target.isConnected) {
      unwatch(target);
      return;
    }
    const toggle = target.closest(TOGGLE_SELECTOR);
    if (toggle) toggles.add(toggle);
  });
  toggles.forEach((toggle) => syncToggle(toggle, { animate: false }));
}

/* ---- Uebergabe beim Neu-Rendern ---- */

/** Entfernter Umschalter: aktuelle Thumb-Position (auch mitten im Gleiten) fuer den Nachfolger merken. */
function retire(toggle) {
  // Im selben Batch nur verschoben: behaelt seinen Zustand
  if (toggle.isConnected) return;
  unwatch(toggle);
  buttonsOf(toggle).forEach(unwatch);
  const state = states.get(toggle);
  const thumb = thumbOf(toggle);
  if (!state || !thumb) return;
  killRunning(thumb);
  if (thumb.style.visibility === 'hidden') return;
  handoffs.set(state.sig, {
    vars: {
      x: gsap.getProperty(thumb, 'x'),
      y: gsap.getProperty(thumb, 'y'),
      width: parseFloat(thumb.style.width) || state.vars.width,
      height: parseFloat(thumb.style.height) || state.vars.height,
      autoAlpha: 1
    },
    path: state.path,
    time: Date.now()
  });
}

function takeHandoff(sig) {
  const entry = handoffs.get(sig);
  if (!entry) return null;
  handoffs.delete(sig);
  const fresh = Date.now() - entry.time <= HANDOFF_MS && entry.path === window.location.pathname;
  return fresh ? entry.vars : null;
}

/* ---- Thumb ---- */

function createThumb(toggle) {
  if (getComputedStyle(toggle).position === 'static') toggle.style.position = 'relative';
  toggle.setAttribute(TOGGLE_ATTR, 'on');
  const thumb = document.createElement('span');
  thumb.setAttribute(THUMB_ATTR, '');
  thumb.setAttribute('aria-hidden', 'true');
  toggle.append(thumb);
  return thumb;
}

/**
 * Thumb unter den aktiven Button des Umschalters setzen.
 * @param {HTMLElement} toggle
 * @param {{ animate?: boolean }} opts animate: gleiten statt springen (nur bei bekannter Vorposition)
 */
function syncToggle(toggle, { animate = true } = {}) {
  if (!toggle?.isConnected || !isEligible(toggle)) return;
  const buttons = buttonsOf(toggle);
  if (!buttons.length) return;

  let state = states.get(toggle);
  let thumb = thumbOf(toggle);
  if (!thumb) {
    thumb = createThumb(toggle);
    if (state) gsap.set(thumb, state.vars);
  }
  watch(toggle);
  buttons.forEach(watch);

  const btn = buttons.find((b) => b.classList.contains('active'));
  if (!btn) {
    killRunning(thumb);
    gsap.set(thumb, { autoAlpha: 0 });
    return;
  }
  const pos = offsetIn(btn, toggle);
  const width = btn.offsetWidth;
  // Umschalter nicht sichtbar: der ResizeObserver meldet sich, sobald er es wird
  if (!pos || !width) return;

  const sig = signature(buttons);
  let glide = Boolean(state) && (animate || isRunning(thumb));
  if (!state) {
    const from = takeHandoff(sig);
    if (from) {
      gsap.set(thumb, from);
      glide = true;
    }
  }
  const vars = { x: pos.x, y: pos.y, width, height: btn.offsetHeight, autoAlpha: 1 };
  slideTo(thumb, vars, { animate: glide });
  states.set(toggle, { vars, sig, path: window.location.pathname });
}

/* ---- MutationObserver ---- */

function mark(dirty, toggle, animate) {
  dirty.set(toggle, dirty.has(toggle) ? dirty.get(toggle) && animate : animate);
}

function onMutations(records) {
  const dirty = new Map();

  for (const record of records) {
    const { target } = record;
    if (record.type === 'attributes') {
      if (target.matches(BUTTON_SELECTOR)) {
        const toggle = target.closest(TOGGLE_SELECTOR);
        if (toggle) mark(dirty, toggle, true);
      }
      continue;
    }

    const added = Array.from(record.addedNodes);
    const removed = Array.from(record.removedNodes);
    // Eigene Thumbs einfuegen/entfernen loest nichts aus
    if (added.concat(removed).every(isThumb)) continue;

    removed.forEach((node) => within(node, TOGGLE_SELECTOR).forEach(retire));
    const toggle = target.closest?.(TOGGLE_SELECTOR);
    if (toggle) mark(dirty, toggle, true);
    added.forEach((node) => within(node, TOGGLE_SELECTOR).forEach((fresh) => mark(dirty, fresh, false)));
  }

  dirty.forEach((animate, toggle) => syncToggle(toggle, { animate }));
}

/** Startet die zentrale Beobachtung. Mehrfachaufruf startet nichts neu. */
export function initViewToggleSlider(root = document.body) {
  if (observer || !root || typeof MutationObserver === 'undefined') return;
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(onResize);
  observer = new MutationObserver(onMutations);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  root.querySelectorAll(TOGGLE_SELECTOR).forEach((toggle) => syncToggle(toggle, { animate: false }));
}

/** Beendet die Beobachtung (Tests). */
export function stopViewToggleSlider() {
  observer?.disconnect();
  observer = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  watched = new WeakSet();
  handoffs.clear();
}
