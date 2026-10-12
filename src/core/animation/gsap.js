// gsap.js
// Einziger Import von GSAP im Projekt. Jeder GSAP-Effekt unter core/animation
// holt gsap, prefersReducedMotion und die Laufzeit-Verwaltung von hier.
// Pro Element laeuft hoechstens eine Timeline: ein neuer Effekt bricht den
// laufenden am selben Knoten ab (Doppelklick stapelt nichts).

import gsap from 'gsap';

export { gsap };

const runningTimelines = new WeakMap();

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Bricht die laufende Timeline am Element ab (ohne Callbacks). */
export function killRunning(el) {
  const running = runningTimelines.get(el);
  if (!running) return;
  running.kill();
  runningTimelines.delete(el);
}

/** Merkt die Timeline am Element und raeumt sich nach dem Ende selbst weg. */
export function trackRunning(el, timeline) {
  runningTimelines.set(el, timeline);
  const previous = timeline.eventCallback('onComplete');
  timeline.eventCallback('onComplete', (...args) => {
    if (runningTimelines.get(el) === timeline) runningTimelines.delete(el);
    previous?.(...args);
  });
  return timeline;
}
