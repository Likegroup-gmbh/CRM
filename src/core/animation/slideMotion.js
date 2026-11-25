// slideMotion.js
// Einzige Stelle fuer Tempo und Easing aller gleitenden Umschaltungen:
// Tab-Balken (tabSlider.js), View-Toggle-Thumb (viewToggleSlider.js), SegmentSwitch-Thumb.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from './gsap.js';

export const SLIDE_DURATION = 0.3;
export const SLIDE_EASE = 'power3.out';

/**
 * Element gleiten lassen oder sofort setzen. Ein laufendes Gleiten am Element wird ersetzt.
 * @param {HTMLElement} el
 * @param {object} vars gsap-Zielwerte (z. B. { x, width })
 * @param {{ animate?: boolean }} opts animate: false oder reduzierte Bewegung setzt sofort
 */
export function slideTo(el, vars, { animate = true } = {}) {
  killRunning(el);
  if (!animate || prefersReducedMotion()) {
    gsap.set(el, vars);
    return;
  }
  trackRunning(el, gsap.to(el, { ...vars, duration: SLIDE_DURATION, ease: SLIDE_EASE }));
}

/**
 * Abstand zur linken oberen Innenecke des Containers (offsetLeft/-Top bleiben bei transform: scale der Seite unverfaelscht).
 * @returns {{ x: number, y: number }|null} null, wenn el nicht im Container liegt oder unsichtbar ist
 */
export function offsetIn(el, container) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return node === container ? { x, y } : null;
}
