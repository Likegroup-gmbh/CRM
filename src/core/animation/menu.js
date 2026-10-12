// menu.js
// Auf-/Zuklapp-Effekt fuer Drei-Punkte-Menues (Portal aus ActionsDropdown).
// Tags setzt stampMenu(portal) selbst: data-menu am Portal, data-menu-item an jeder
// direkten Zeile. Wer ein Menue ueber .actions-toggle + .actions-dropdown baut,
// muss nichts taggen.
// Aufruf: playMenu(portal, true) beim Oeffnen, closeMenu(portal) beim Schliessen,
// discardMenu(portal) fuer sofortiges Entfernen (Wechsel, Scroll).
// Startzustand (unsichtbar) liegt in assets/styles/dropdowns.css.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from './gsap.js';

const ROW_SELECTOR = '.action-item, .action-separator, .action-submenu';

// Oeffnen
const open = ({ menu, items }) => gsap.timeline()
  .fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 })
  .fromTo(items,
    { opacity: 0, y: -14 },
    { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'back.out(2.5)' }, 0.04);

// Schliessen
const close = ({ menu, items }) => gsap.timeline()
  .to(items, { opacity: 0, y: -8, duration: 0.12, stagger: { each: 0.02, from: 'end' } })
  .to(menu, { autoAlpha: 0, duration: 0.1 }, '-=0.06');

/**
 * Setzt data-menu am Portal und data-menu-item an die direkten Zeilen.
 * Verschachtelte .submenu-item bleiben ungetaggt (Hover-Submenue ist CSS).
 * @returns {HTMLElement[]} die getaggten Zeilen
 */
export function stampMenu(portal) {
  if (!portal) return [];
  portal.setAttribute('data-menu', '');
  const rows = Array.from(portal.children).filter((child) => child.matches(ROW_SELECTOR));
  rows.forEach((row) => row.setAttribute('data-menu-item', ''));
  return rows;
}

/**
 * Spielt Oeffnen oder Schliessen am Portal.
 * Mit prefers-reduced-motion keine Timeline: Oeffnen macht das Menue sichtbar,
 * Schliessen liefert null (der Aufrufer entfernt sofort).
 * @param {HTMLElement} portal
 * @param {boolean} opening true = Oeffnen, false = Schliessen
 * @param {() => void} [onDone] laeuft nach dem Ende der Timeline
 * @returns {gsap.core.Timeline|null}
 */
export function playMenu(portal, opening, onDone) {
  if (!portal) return null;
  killRunning(portal);
  const items = stampMenu(portal);

  if (prefersReducedMotion()) {
    if (opening) gsap.set(portal, { autoAlpha: 1 });
    return null;
  }

  if (!opening) portal.style.pointerEvents = 'none';

  const timeline = (opening ? open : close)({ menu: portal, items });
  timeline.eventCallback('onComplete', () => {
    if (opening) gsap.set(items, { clearProps: 'opacity,transform' });
    onDone?.();
  });
  return trackRunning(portal, timeline);
}

/** Schliesst animiert und entfernt das Portal am Ende. Ein zweiter Aufruf startet nichts neu. */
export function closeMenu(portal) {
  if (!portal || portal.dataset.menuState === 'closing') return;
  portal.dataset.menuState = 'closing';
  const remove = () => portal.remove();
  if (!playMenu(portal, false, remove)) remove();
}

/** Entfernt das Portal sofort und bricht eine laufende Timeline ab. */
export function discardMenu(portal) {
  if (!portal) return;
  killRunning(portal);
  portal.remove();
}

export function isMenuClosing(portal) {
  return portal?.dataset?.menuState === 'closing';
}
