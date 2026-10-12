// drawer.js
// Slide-Effekt fuer alle Drawer, die von rechts nach links reinfahren (.drawer-panel).
// Kein Aufruf pro Drawer noetig: initDrawerMotion() beobachtet den DOM einmal zentral.
//   Panel im DOM            -> oeffnen (Backdrop, Slide, Sections, Seite skaliert leicht)
//   'show' vom Panel weg    -> schliessen (bei Panels im Overlay: 'active' am Overlay)
//   'show' wieder gesetzt   -> erneut oeffnen (wiederverwendete Panels)
//   Panel aus dem DOM       -> Timeline abbrechen, Seite zurueck auf Normalgroesse
// Seite = #app-root. Mehrere offene Drawer skalieren die Seite nur einmal (Zaehler ueber active).
// Drawer entfernen sich nach dem Schliessen selbst: Wartezeit = DRAWER_EXIT_MS.
// Startzustand und Fallback bei reduzierter Bewegung liegen in assets/styles/modals-drawers.css.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from './gsap.js';

/** Schliess-Animation (0.3s) plus Puffer. Drawer warten damit vor dem Entfernen. */
export const DRAWER_EXIT_MS = 350;

const PANEL_SELECTOR = '.drawer-panel';
const OVERLAY_SELECTOR = '.drawer-overlay';
const PAGE_ID = 'app-root';
const MAX_SECTIONS = 8;
// Entspricht dem Abstand der Panels zum Viewport-Rand (space-md), damit Schatten und Kante ganz draussen stehen
const OFFSCREEN_GAP = 16;

// Oeffnen
const open = ({ backdrop, drawer, sections, page }) => {
  const timeline = gsap.timeline();
  if (page) timeline.set(page, { transformOrigin: `50% ${window.scrollY + window.innerHeight / 2}px` });
  if (backdrop) timeline.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
  if (page) timeline.fromTo(page, { scale: 1 }, { scale: 0.98, duration: 0.6, ease: 'expo.out' }, 0);
  timeline.fromTo(drawer,
    { xPercent: 100, x: OFFSCREEN_GAP },
    { xPercent: 0, x: 0, duration: 0.55, ease: 'power4.out' }, 0);
  if (sections.length) {
    timeline.fromTo(sections,
      { opacity: 0, x: 24 },
      { opacity: 1, x: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, 0.12);
  }
  return timeline;
};

// Schliessen
const close = ({ backdrop, drawer, page }) => {
  const timeline = gsap.timeline()
    .to(drawer, { xPercent: 100, x: OFFSCREEN_GAP, duration: 0.3, ease: 'power3.in' });
  if (page) timeline.to(page, { scale: 1, duration: 0.35, ease: 'power2.inOut' }, 0);
  if (backdrop) timeline.to(backdrop, { opacity: 0, duration: 0.3 }, 0);
  return timeline;
};

/** Panels, die gerade offen sind oder aufgehen (nicht die schliessenden). */
const active = new Set();

function pageElement() {
  return document.getElementById(PAGE_ID);
}

function findBackdrop(panel) {
  const parent = panel.closest(OVERLAY_SELECTOR);
  if (parent) return parent;
  const previous = panel.previousElementSibling;
  if (previous?.matches(OVERLAY_SELECTOR)) return previous;
  return panel.id ? document.getElementById(`${panel.id}-overlay`) : null;
}

/** Header, direkte Kinder des Bodys und Footer; Fallback: direkte Kinder des Panels. */
function findSections(panel) {
  const children = Array.from(panel.children);
  const header = children.filter((el) => el.classList.contains('drawer-header'));
  const footer = children.filter((el) => el.classList.contains('drawer-footer')
    || el.classList.contains('drawer-actions'));
  const body = children.find((el) => el.classList.contains('drawer-body'));
  const sections = [...header, ...(body ? Array.from(body.children) : []), ...footer];
  const list = sections.length
    ? sections
    : children.filter((el) => !el.classList.contains('drawer-resize-handle'));
  return list.slice(0, MAX_SECTIONS);
}

/** Seite nach einem abgebrochenen Drawer wieder auf Normalgroesse bringen. */
function restorePage() {
  const page = pageElement();
  if (!page) return;
  gsap.killTweensOf(page);
  gsap.to(page, {
    scale: 1,
    duration: 0.35,
    ease: 'power2.inOut',
    clearProps: 'transform,transformOrigin'
  });
}

/**
 * Spielt Oeffnen oder Schliessen am Panel.
 * Mit prefers-reduced-motion keine Timeline: der CSS-Fallback uebernimmt.
 * @param {HTMLElement} panel .drawer-panel
 * @param {boolean} opening true = Oeffnen, false = Schliessen
 * @returns {gsap.core.Timeline|null}
 */
export function playDrawer(panel, opening) { 
  if (!panel || prefersReducedMotion()) return null;
  killRunning(panel);

  const backdrop = findBackdrop(panel);
  const pageEl = pageElement();
  let page = null;
  if (opening) {
    page = active.size === 0 ? pageEl : null;
    active.add(panel);
  } else {
    active.delete(panel);
    page = active.size === 0 ? pageEl : null;
  }
  if (page) gsap.killTweensOf(page);

  // Vor der Timeline setzen: der CSS-Ruhezustand (translateX) darf GSAP nicht als x uebernehmen
  panel.dataset.drawerState = opening ? 'opening' : 'closing';
  const sections = opening ? findSections(panel) : [];

  const timeline = (opening ? open : close)({ backdrop, drawer: panel, sections, page });
  timeline.eventCallback('onComplete', () => {
    if (opening) {
      panel.dataset.drawerState = 'open';
      gsap.set(sections, { clearProps: 'opacity,transform' });
      gsap.set(panel, { clearProps: 'transform' });
      if (backdrop) gsap.set(backdrop, { clearProps: 'opacity' });
    } else if (page) {
      gsap.set(page, { clearProps: 'transform,transformOrigin' });
    }
  });
  return trackRunning(panel, timeline);
}

function handleAdded(panel) {
  // Nur frische Panels. Hat das Panel schon einen Zustand, wurde es nur umgehaengt (z.B. von GSAP beim
  // Messen); Wiederoeffnen laeuft ueber 'show' (handleClass).
  if (panel.dataset.drawerState) return;
  playDrawer(panel, true);
}

function handleRemoved(panel) {
  if (panel.isConnected) return;
  killRunning(panel);
  const wasActive = active.delete(panel);
  delete panel.dataset.drawerState;
  if (wasActive && active.size === 0) restorePage();
}

/** 'show' am Panel; Panels im Overlay (Adressen, Cashflow) schalten stattdessen 'active' am Overlay. */
function isShown(panel) {
  return panel.classList.contains('show')
    || Boolean(panel.closest(OVERLAY_SELECTOR)?.classList.contains('active'));
}

function handleClass(panel) {
  const state = panel.dataset.drawerState;
  const shown = isShown(panel);
  if (!shown && (state === 'opening' || state === 'open')) playDrawer(panel, false);
  else if (shown && state === 'closing') playDrawer(panel, true);
}

function panelsIn(node) {
  if (node.nodeType !== 1) return [];
  const found = node.matches(PANEL_SELECTOR) ? [node] : [];
  return found.concat(Array.from(node.querySelectorAll(PANEL_SELECTOR)));
}

function onMutations(records) {
  for (const record of records) {
    if (record.type === 'attributes') {
      const target = record.target;
      if (target.matches?.(PANEL_SELECTOR)) handleClass(target);
      else if (target.matches?.(OVERLAY_SELECTOR)) target.querySelectorAll(PANEL_SELECTOR).forEach(handleClass);
      continue;
    }
    record.removedNodes.forEach((node) => panelsIn(node).forEach(handleRemoved));
    record.addedNodes.forEach((node) => panelsIn(node).forEach(handleAdded));
  }
}

let observer = null;

/** Startet die zentrale Beobachtung. Mehrfachaufruf startet nichts neu. */
export function initDrawerMotion(root = document.body) {
  if (observer || !root || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(onMutations);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

/** Beendet die Beobachtung (Tests). */
export function stopDrawerMotion() {
  observer?.disconnect();
  observer = null;
  active.clear();
}
