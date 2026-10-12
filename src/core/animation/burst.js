// burst.js
// Icon-agnostischer Funken-Burst fuer An/Aus-Zustaende (Favorit-Stern, Herz, ...).
// Markup: burstLayers(iconKey) in einen Host mit [data-burst] legen.
// Aufruf: playBurst(host, true) beim Merken, playBurst(host, false) beim Entfernen.
// Der Feature-Code entscheidet An/Aus und speichert; hier haengt kein Klick-Listener.
// Layout der Schichten: assets/styles/motion.css

import { icon } from '../icons/IconSystem.js';
import { gsap, prefersReducedMotion, killRunning, trackRunning } from './gsap.js';

const SPARK_COUNT = 8;

/** Glyph, Fill und Funken fuer einen Burst-Host. */
export function burstLayers(iconKey) {
  const sparks = Array.from({ length: SPARK_COUNT }, () => '<i data-burst-spark></i>').join('');
  return `<span data-burst-glyph>${icon(iconKey)}</span>`
    + `<span data-burst-fill>${icon(iconKey)}</span>`
    + `<span data-burst-sparks aria-hidden="true">${sparks}</span>`;
}

// Merken
const on = ({ star, fill, sparks }) => gsap.timeline()
  .set(fill, { opacity: 1 })
  .fromTo(star, { scale: 0.4 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
  .fromTo(sparks,
    { x: 0, y: 0, scale: 1, opacity: 1 },
    {
      x: (i) => Math.cos((i / sparks.length) * Math.PI * 2) * (i % 2 ? 16 : 24),
      y: (i) => Math.sin((i / sparks.length) * Math.PI * 2) * (i % 2 ? 16 : 24),
      scale: 0,
      duration: 0.6,
      ease: 'power3.out'
    }, 0);

// Entfernen
const off = ({ star, fill, sparks }) => gsap.timeline()
  .to(sparks, { opacity: 0, duration: 0.1 })
  .to(fill, { opacity: 0, duration: 0.2 }, 0)
  .fromTo(star, { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'power2.out' }, 0);

function findLayers(host) {
  const glyph = host.querySelector('[data-burst-glyph]');
  const fill = host.querySelector('[data-burst-fill]');
  const sparks = Array.from(host.querySelectorAll('[data-burst-spark]'));
  if (!glyph || !fill || !sparks.length) return null;
  return { glyph, fill, sparks, star: [glyph, fill] };
}

/**
 * Spielt den Burst am Host und setzt dessen Zustand (Klasse `is-on`).
 * Ohne Burst-Schichten oder mit prefers-reduced-motion wird nur die Klasse gesetzt.
 * @param {HTMLElement} host Element mit burstLayers-Markup
 * @param {boolean} turningOn true = Merken, false = Entfernen
 * @returns {gsap.core.Timeline|null}
 */
export function playBurst(host, turningOn) {
  if (!host) return null;
  killRunning(host);

  const layers = findLayers(host);
  if (layers) gsap.set([layers.glyph, layers.fill, ...layers.sparks], { clearProps: 'all' });

  if (!layers || prefersReducedMotion()) {
    host.classList.toggle('is-on', turningOn);
    return null;
  }

  // An: Klasse sofort, damit CSS nach clearProps den Endzustand haelt.
  // Aus: Klasse erst am Ende, damit der Fill sichtbar ausblendet.
  if (turningOn) host.classList.add('is-on');
  else gsap.set(layers.fill, { opacity: 1 });

  const timeline = (turningOn ? on : off)(layers);
  timeline.eventCallback('onComplete', () => {
    if (!turningOn) host.classList.remove('is-on');
    gsap.set([layers.glyph, layers.fill, ...layers.sparks], { clearProps: 'all' });
  });
  return trackRunning(host, timeline);
}
