// auswertungMotion.js
// Bewegung im Report (Spec 12): Kennzahlen zählen vom alten auf den neuen Wert, Balken wachsen ein
// und ordnen sich beim Wechsel von Aufschlüsselung oder Kennzahl per Flip neu, Tabellenzeilen
// ebenso beim Sortieren. Alles nur bei echten Wechseln und ohne reduzierte Bewegung.

import { gsap, Flip, prefersReducedMotion } from '../../core/animation/gsap.js';
import { cancelCountTo, countTo, liveCountValue } from '../../core/animation/countTo.js';
import { formatCompactNumber } from '../../core/format/compactNumber.js';
import { wertNachArt } from './auswertungFormat.js';

const FLIP_LIMIT = 80;
const DAUER = 0.5;

const euroLauf = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function laufFormat(art, ziel) {
  return (v) => {
    if (v === ziel) return wertNachArt(art, ziel);
    if (art === 'euro') return euroLauf.format(v);
    if (art === 'zahl') return formatCompactNumber(Math.round(v));
    return wertNachArt(art, v);
  };
}

/** Angezeigte (oder gerade laufende) Werte aller Zähler unter root, je data-count. */
export function liesZaehler(root) {
  const werte = new Map();
  root?.querySelectorAll('[data-count]').forEach((el) => {
    const live = liveCountValue(el);
    werte.set(el.dataset.count, Number.isFinite(live) ? live : parseFloat(el.dataset.countValue));
    cancelCountTo(el);
  });
  return werte;
}

/** Zähler unter root von `vorher` (sonst 0) auf ihren Wert zählen. */
export function zaehleHoch(root, vorher = new Map()) {
  root?.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.countValue);
    const from = vorher.has(el.dataset.count) ? vorher.get(el.dataset.count) : 0;
    if (!Number.isFinite(to) || !Number.isFinite(from) || from === to) return;
    countTo(el, to, { from, format: laufFormat(el.dataset.countFormat, to) });
  });
}

const flipZiele = (root) => (root ? [...root.querySelectorAll('[data-flip-id]')] : []);

/** Zustand vor einem Neu-Rendern merken. null, wenn nicht animiert wird. */
export function merkeZustand(root) {
  const ziele = flipZiele(root);
  if (prefersReducedMotion() || !ziele.length || ziele.length > FLIP_LIMIT) return null;
  const breiten = new Map();
  ziele.forEach((el) => {
    const fill = el.querySelector('[data-balken]');
    if (fill) breiten.set(el.dataset.flipId, fill.style.width);
  });
  return { flip: Flip.getState(ziele), breiten };
}

/** Nach dem Neu-Rendern vom gemerkten Zustand in den neuen übergehen. Ohne Zustand wachsen die Balken ein. */
export function spieleUebergang(zustand, root) {
  if (prefersReducedMotion() || !root) return;
  const ziele = flipZiele(root);
  if (!ziele.length) return;
  ziele.forEach((el) => {
    const fill = el.querySelector('[data-balken]');
    if (!fill) return;
    const von = zustand?.breiten.get(el.dataset.flipId) || '0%';
    gsap.fromTo(fill, { width: von }, { width: fill.style.width, duration: DAUER + 0.2, ease: 'power3.out' });
  });
  if (!zustand) return;
  Flip.from(zustand.flip, {
    targets: ziele,
    duration: DAUER,
    ease: 'power3.inOut',
    scale: false,
    absolute: false,
    onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' }),
    onComplete: () => gsap.set(ziele, { clearProps: 'transform' })
  });
}
