// countTo.js
// Zaehl-Effekt fuer Zahlen im DOM auf GSAP-Basis (Nachfolger von animateNumber,
// vorerst nur im Budget-Tab). Start beim laufenden Zwischenwert, sonst beim
// angezeigten Wert, Ende exakt auf `to`. Pro Element laeuft ein Tween.
// Default-Kurve bewusst nicht expo.out: die erledigt 85 % in den ersten 200 ms
// und wirkt wie ein Sprung statt wie drehende Zahlen.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from './gsap.js';
import { parseDisplayedValue } from './animateNumber.js';

const liveValues = new WeakMap();

/** Aktueller Zwischenwert eines laufenden Tweens, sonst undefined. */
export function liveCountValue(el) {
  return liveValues.get(el)?.value;
}

export function cancelCountTo(el) {
  killRunning(el);
  liveValues.delete(el);
}

/**
 * Zaehlt den Textinhalt eines Elements auf `to`.
 *
 * @param {HTMLElement} el Zielelement (textContent wird geschrieben)
 * @param {number} to Zielwert
 * @param {object} [options]
 * @param {number} [options.duration=1.2] Dauer in Sekunden
 * @param {string} [options.ease='power3.out'] GSAP-Ease
 * @param {(value: number) => string} [options.format] Formatierung pro Frame
 * @param {number} [options.from] Expliziter Startwert (sonst laufender oder angezeigter Wert)
 * @param {() => void} [options.onComplete]
 * @returns {gsap.core.Tween|null} null, wenn direkt gesetzt wurde
 */
export function countTo(el, to, options = {}) {
  if (!el) return null;
  const {
    duration = 1.2,
    ease = 'power3.out',
    format = (v) => String(Math.round(v)),
    from: fromOption,
    onComplete
  } = options;

  const target = Number(to) || 0;
  const live = liveCountValue(el);
  cancelCountTo(el);

  let from = Number.isFinite(fromOption)
    ? fromOption
    : (Number.isFinite(live) ? live : parseDisplayedValue(el));
  if (!Number.isFinite(from)) from = target;

  if (prefersReducedMotion() || duration <= 0 || from === target) {
    el.textContent = format(target);
    onComplete?.();
    return null;
  }

  const proxy = { value: from };
  liveValues.set(el, proxy);
  el.textContent = format(from);

  const tween = gsap.to(proxy, {
    value: target,
    duration,
    ease,
    onUpdate: () => { el.textContent = format(proxy.value); },
    onComplete: () => {
      if (liveValues.get(el) === proxy) liveValues.delete(el);
      el.textContent = format(target);
      onComplete?.();
    }
  });
  return trackRunning(el, tween);
}
