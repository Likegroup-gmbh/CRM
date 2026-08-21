// slideHeight.js
// Generischer Hoehen-Slide (auf/zu) per Web Animations API.
// Dauer und Kurve kommen aus CSS-Tokens (--motion-duration, --motion-ease-in-out),
// pro Element ueberschreibbar. Ein neuer Aufruf bricht die laufende Animation ab
// und startet vom aktuellen Zwischenstand (Reverse bei schnellem Re-Toggle).

const runningAnimations = new WeakMap();

const DEFAULT_DURATION = 320;
const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "320ms" | "0.32s" | "320" → Millisekunden. */
export function parseMs(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  if (raw.endsWith('ms')) return parseFloat(raw);
  if (raw.endsWith('s')) return parseFloat(raw) * 1000;
  return parseFloat(raw);
}

export function readMotion(el) {
  const styles = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  const duration = parseMs(styles?.getPropertyValue('--motion-duration')) || DEFAULT_DURATION;
  const easing = styles?.getPropertyValue('--motion-ease-in-out')?.trim() || DEFAULT_EASING;
  return { duration, easing };
}

export function isSliding(el) {
  return runningAnimations.has(el);
}

export function cancelSlideHeight(el) {
  const anim = runningAnimations.get(el);
  if (!anim) return;
  const current = el.offsetHeight;
  try { anim.cancel(); } catch { /* already finished */ }
  el.style.height = `${current}px`;
  el.style.maxHeight = 'none';
  runningAnimations.delete(el);
}

function applyEndState(el, { open, collapsedPx }) {
  if (open) {
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.overflow = '';
    return;
  }
  if (Number.isFinite(collapsedPx)) {
    el.style.height = `${collapsedPx}px`;
    el.style.maxHeight = `${collapsedPx}px`;
  } else {
    el.style.height = '';
    el.style.maxHeight = '';
  }
  el.style.overflow = '';
}

/**
 * Animiert die Hoehe von der aktuellen Pixelhoehe zum offenen Content
 * oder zur angegebenen Collapse-Hoehe.
 *
 * @param {HTMLElement} el
 * @param {object} [options]
 * @param {boolean} [options.open=true]
 * @param {number} [options.collapsedPx] Zielhoehe beim Schliessen
 * @param {number} [options.duration] Override in ms (sonst --motion-duration)
 * @param {string} [options.easing] Override (sonst --motion-ease-in-out)
 * @returns {Promise<void>}
 */
export function slideHeight(el, options = {}) {
  if (!el) return Promise.resolve();

  const open = options.open !== false;
  const collapsedPx = options.collapsedPx;
  const motion = readMotion(el);
  const duration = options.duration ?? motion.duration;
  const easing = options.easing || motion.easing;

  cancelSlideHeight(el);

  const from = el.offsetHeight;
  el.style.overflow = 'hidden';
  el.style.maxHeight = 'none';
  el.style.height = `${from}px`;

  let to;
  if (open) {
    el.style.height = 'auto';
    to = el.scrollHeight;
    el.style.height = `${from}px`;
  } else {
    to = Number.isFinite(collapsedPx) ? Math.max(0, collapsedPx) : 0;
  }

  const snap = prefersReducedMotion()
    || duration <= 0
    || Math.abs(from - to) < 1
    || typeof el.animate !== 'function';

  if (snap) {
    applyEndState(el, { open, collapsedPx });
    return Promise.resolve();
  }

  const anim = el.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    { duration, easing, fill: 'forwards' }
  );
  runningAnimations.set(el, anim);

  return anim.finished.then(() => {
    if (runningAnimations.get(el) !== anim) return;
    anim.cancel();
    runningAnimations.delete(el);
    applyEndState(el, { open, collapsedPx });
  }).catch(() => {
    if (runningAnimations.get(el) === anim) runningAnimations.delete(el);
  });
}
