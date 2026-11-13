// tabSlider.js
// Gleitender Unterstrich fuer alle horizontalen Tab-Leisten (.tab-navigation, .drawer-tab-nav)
// und Einblenden des neuen Inhalts beim Tab-Wechsel. Kein Aufruf pro Leiste noetig:
// initTabSlider() beobachtet den DOM einmal zentral.
//   Leiste neu im DOM                -> Balken sofort unter den aktiven Tab
//   .active / aria-selected wechselt -> Balken gleitet
//   Buttons der Leiste neu gerendert -> neuer Balken startet an der alten Position und gleitet
//   Groesse aendert sich             -> Balken sofort nachziehen (ResizeObserver)
//   .tab-pane bekommt .active, .workflow-pane / [role=tabpanel] verliert hidden -> Inhalt blendet ein
// Zeigt ein Pane beim Wechsel nur einen Spinner (oder nichts), blendet der Inhalt ein, sobald er kommt.
// Opt-out: data-tab-slider="off" an der Leiste, data-tab-fade="off" am Pane.
// Panels des Video-Browsers ([data-vb-panel]) blendet videoBrowserMotion.tabPanelIn ein.
// Optik des Balkens liegt in assets/styles/motion.css.

import { gsap, prefersReducedMotion, killRunning, trackRunning, isRunning } from './gsap.js';

const NAV_SELECTOR = '.tab-navigation, .drawer-tab-nav';
const TAB_SELECTOR = '.tab-button, .drawer-tab-btn, [role="tab"]';
const PANEL_SELECTOR = '.tab-pane, .workflow-pane, [role="tabpanel"]';
const LOADING_SELECTOR = '.table-loading-container';
const SKIP_FADE_SELECTOR = '[data-vb-panel], [data-tab-fade="off"]';
const BAR_ATTR = 'data-tab-slider-bar';
const NAV_ATTR = 'data-tab-slider';
const MAX_ITEMS = 8;
// So lange wartet ein Pane, das beim Wechsel nur einen Spinner zeigt, auf seinen Inhalt
const PENDING_MS = 4000;
const ACTIVE_CLASS = /(^|\s)active(\s|$)/;

/** Letzte Balken-Position je Leiste, damit ein neu gerenderter Balken von dort weggleitet. */
const states = new WeakMap();
/** Pane -> Deadline: wartet auf echten Inhalt. */
const pending = new Map();
/** Pane -> Elemente, die gerade einblenden (zum Aufraeumen bei Abbruch). */
const fading = new WeakMap();
let watched = new WeakSet();

let observer = null;
let resizeObserver = null;

const isElement = (node) => node?.nodeType === 1;
const isBar = (node) => isElement(node) && node.hasAttribute(BAR_ATTR);
const isActiveTab = (tab) => tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';

function within(node, selector) {
  if (!isElement(node)) return [];
  const found = node.matches(selector) ? [node] : [];
  return found.concat(Array.from(node.querySelectorAll(selector)));
}

/* ---- ResizeObserver ---- */

// observe() auf ein schon beobachtetes Element loest erneut eine Meldung aus, deshalb nur einmal
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
  const navs = new Set();
  entries.forEach(({ target }) => {
    if (!target.isConnected) {
      unwatch(target);
      return;
    }
    const nav = target.closest(NAV_SELECTOR);
    if (nav) navs.add(nav);
  });
  navs.forEach((nav) => syncNav(nav, { animate: false }));
}

/* ---- Balken ---- */

function tabsOf(nav) {
  return Array.from(nav.querySelectorAll(TAB_SELECTOR)).filter((tab) => tab.closest(NAV_SELECTOR) === nav);
}

function barOf(nav) {
  return Array.from(nav.children).find(isBar) || null;
}

/** Abstand zum linken Innenrand der Leiste (offsetLeft bleibt bei transform: scale der Seite unverfaelscht). */
function leftIn(el, nav) {
  let x = 0;
  let node = el;
  while (node && node !== nav) {
    x += node.offsetLeft;
    node = node.offsetParent;
  }
  return node === nav ? x : null;
}

function createBar(nav) {
  // Der Balken liegt absolut in der Leiste; sticky/relative bleiben, nur static braucht einen Bezugsrahmen
  if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
  nav.setAttribute(NAV_ATTR, 'on');
  const bar = document.createElement('span');
  bar.setAttribute(BAR_ATTR, '');
  bar.setAttribute('aria-hidden', 'true');
  nav.append(bar);
  return bar;
}

/**
 * Balken unter den aktiven Tab der Leiste setzen.
 * @param {HTMLElement} nav
 * @param {{ animate?: boolean }} opts animate: gleiten statt springen (nur bei bekannter Vorposition)
 */
function syncNav(nav, { animate = true } = {}) {
  if (!nav?.isConnected || nav.getAttribute(NAV_ATTR) === 'off') return;
  const tabs = tabsOf(nav);
  let bar = barOf(nav);
  if (!tabs.length && !bar) return;

  const state = states.get(nav);
  if (!bar) {
    bar = createBar(nav);
    if (state) gsap.set(bar, state.vars);
  }
  watch(nav);
  tabs.forEach(watch);

  const tab = tabs.find(isActiveTab);
  if (!tab) {
    killRunning(bar);
    gsap.set(bar, { autoAlpha: 0 });
    return;
  }
  const x = leftIn(tab, nav);
  const width = tab.offsetWidth;
  // Leiste nicht sichtbar: der ResizeObserver meldet sich, sobald sie es wird
  if (x === null || !width) return;

  const vars = { x, width, autoAlpha: 1 };
  // Laeuft schon ein Gleiten (z. B. Resize mittendrin), wird es umgelenkt statt abgebrochen
  const glide = !prefersReducedMotion() && Boolean(state) && (animate || isRunning(bar));
  killRunning(bar);
  if (glide) trackRunning(bar, gsap.to(bar, { ...vars, duration: 0.3, ease: 'power3.out' }));
  else gsap.set(bar, vars);
  states.set(nav, { vars });
}

/* ---- Inhalt einblenden ---- */

/** Spinner oder leerer Platzhalter, in den der Inhalt erst noch geschrieben wird. */
function isPlaceholder(el) {
  if (el.matches(LOADING_SELECTOR)) return true;
  if (el.childElementCount === 1) return isPlaceholder(el.firstElementChild);
  return el.tagName === 'DIV' && el.childElementCount === 0 && !el.textContent.trim();
}

const isContent = (node) => isElement(node) && !isBar(node) && !isPlaceholder(node);

function contentOf(pane) {
  return Array.from(pane.children).filter(isContent).slice(0, MAX_ITEMS);
}

function stopFade(pane) {
  killRunning(pane);
  const items = fading.get(pane);
  if (!items) return;
  gsap.set(items, { clearProps: 'transform,opacity' });
  fading.delete(pane);
}

function fadePanel(pane, items) {
  stopFade(pane);
  fading.set(pane, items);
  const timeline = gsap.timeline({ onComplete: () => fading.delete(pane) });
  timeline.fromTo(items,
    { y: 6, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.25, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' });
  trackRunning(pane, timeline);
}

function showPanel(pane) {
  if (pane.matches(SKIP_FADE_SELECTOR) || prefersReducedMotion()) return;
  const items = contentOf(pane);
  if (!items.length) {
    pending.set(pane, Date.now() + PENDING_MS);
    return;
  }
  pending.delete(pane);
  fadePanel(pane, items);
}

/** Inhalt kommt in ein wartendes Pane: jetzt einblenden. */
function resolvePending(record) {
  if (!pending.size || !Array.from(record.addedNodes).some(isContent)) return;
  const now = Date.now();
  pending.forEach((deadline, pane) => {
    if (deadline < now || !pane.isConnected) pending.delete(pane);
  });
  for (let pane = record.target.closest?.(PANEL_SELECTOR); pane; pane = pane.parentElement?.closest(PANEL_SELECTOR)) {
    if (!pending.has(pane)) continue;
    pending.delete(pane);
    const items = contentOf(pane);
    if (items.length) fadePanel(pane, items);
    return;
  }
}

const isShown = (pane) => !pane.hidden && (!pane.classList.contains('tab-pane') || pane.classList.contains('active'));

/** Zustand vor dem Batch aus den ersten oldValues: remove + add am selben Pane zaehlt nicht als Wechsel. */
function wasShown(pane, before) {
  const hidden = 'hidden' in before ? before.hidden !== null : pane.hidden;
  if (hidden) return false;
  if (!pane.classList.contains('tab-pane')) return true;
  return ACTIVE_CLASS.test('class' in before ? before.class || '' : pane.className);
}

/* ---- MutationObserver ---- */

function mark(dirty, nav, animate) {
  dirty.set(nav, dirty.has(nav) ? dirty.get(nav) && animate : animate);
}

function forget(node) {
  within(node, NAV_SELECTOR).forEach(unwatch);
  within(node, TAB_SELECTOR).forEach(unwatch);
}

function onMutations(records) {
  const dirty = new Map();
  const panels = new Map();

  for (const record of records) {
    const { target } = record;
    if (record.type === 'attributes') {
      if (target.matches(TAB_SELECTOR)) {
        const nav = target.closest(NAV_SELECTOR);
        if (nav) mark(dirty, nav, true);
      }
      if (record.attributeName !== 'aria-selected' && target.matches(PANEL_SELECTOR)) {
        const before = panels.get(target) || {};
        if (!(record.attributeName in before)) before[record.attributeName] = record.oldValue;
        panels.set(target, before);
      }
      continue;
    }

    const added = Array.from(record.addedNodes);
    const removed = Array.from(record.removedNodes);
    // Eigene Balken einfuegen/entfernen loest nichts aus
    if (added.concat(removed).every(isBar)) continue;

    removed.forEach(forget);
    const nav = target.closest?.(NAV_SELECTOR);
    if (nav) mark(dirty, nav, true);
    added.forEach((node) => within(node, NAV_SELECTOR).forEach((fresh) => mark(dirty, fresh, false)));
    resolvePending(record);
  }

  dirty.forEach((animate, nav) => syncNav(nav, { animate }));
  panels.forEach((before, pane) => {
    if (isShown(pane) && !wasShown(pane, before)) showPanel(pane);
  });
}

/** Startet die zentrale Beobachtung. Mehrfachaufruf startet nichts neu. */
export function initTabSlider(root = document.body) {
  if (observer || !root || typeof MutationObserver === 'undefined') return;
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(onResize);
  observer = new MutationObserver(onMutations);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class', 'aria-selected', 'hidden']
  });
  root.querySelectorAll(NAV_SELECTOR).forEach((nav) => syncNav(nav, { animate: false }));
}

/** Beendet die Beobachtung (Tests). */
export function stopTabSlider() {
  observer?.disconnect();
  observer = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  watched = new WeakSet();
  pending.clear();
}
