// animateNumber.js
// Generischer Count-Up/Down-Animator fuer Zahlenwerte im DOM (Spielautomaten-Effekt).
// Wiederverwendbar auf jeder Seite: Element + Zielwert + optionaler Format-Callback.
// Laufende Animationen werden pro Element getrackt: ein neuer Aufruf startet
// nahtlos vom aktuell angezeigten Zwischenwert (kein Sprung bei schnellen Updates).

const runningAnimations = new WeakMap();

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Liest den aktuell angezeigten Zahlenwert eines Elements.
 * Versteht deutsches Format ("1.234,56 €"), Compact-Suffixe ("21,6K", "1,2M")
 * und zusammengesetzte Strings wie "5 von 20" (erste Zahl zaehlt).
 */
export function parseDisplayedValue(el) {
  const text = (el?.textContent || '').trim();
  if (!text) return NaN;
  const match = text.match(/(-?[\d.,]+)\s*([KM])?/i);
  if (!match) return NaN;
  let numStr = match[1];
  // de-DE: Tausenderpunkte entfernen, Dezimalkomma in Punkt wandeln
  if (numStr.includes(',')) {
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  }
  let value = parseFloat(numStr);
  if (Number.isNaN(value)) return NaN;
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') value *= 1000;
  else if (suffix === 'M') value *= 1000000;
  return value;
}

export function cancelAnimateNumber(el) {
  const running = runningAnimations.get(el);
  if (running) {
    cancelAnimationFrame(running.rafId);
    runningAnimations.delete(el);
  }
}

/**
 * Animiert den Textinhalt eines Elements von seinem aktuellen Wert zu `to`.
 *
 * @param {HTMLElement} el Zielelement (textContent wird geschrieben)
 * @param {number} to Zielwert
 * @param {object} [options]
 * @param {number} [options.duration=800] Dauer in ms
 * @param {(value: number) => string} [options.format] Formatierung pro Frame
 * @param {(t: number) => number} [options.easing=easeOutExpo] Easing-Funktion
 * @param {number} [options.from] Expliziter Startwert (sonst aus DOM gelesen)
 * @param {() => void} [options.onComplete] Callback am Animationsende
 */
export function animateNumber(el, to, options = {}) {
  if (!el) return;
  const {
    duration = 800,
    format = (v) => String(Math.round(v)),
    easing = easeOutExpo,
    from: fromOption,
    onComplete
  } = options;

  const target = Number(to) || 0;
  const running = runningAnimations.get(el);
  if (running) cancelAnimationFrame(running.rafId);

  let from = Number.isFinite(fromOption)
    ? fromOption
    : (running ? running.currentValue : parseDisplayedValue(el));
  if (!Number.isFinite(from)) from = target;

  if (prefersReducedMotion() || duration <= 0 || from === target) {
    runningAnimations.delete(el);
    el.textContent = format(target);
    onComplete?.();
    return;
  }

  const startTime = performance.now();
  const state = { rafId: 0, currentValue: from };
  runningAnimations.set(el, state);

  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    state.currentValue = from + (target - from) * easing(t);
    if (t < 1) {
      el.textContent = format(state.currentValue);
      state.rafId = requestAnimationFrame(step);
    } else {
      el.textContent = format(target);
      runningAnimations.delete(el);
      onComplete?.();
    }
  };
  state.rafId = requestAnimationFrame(step);
}
