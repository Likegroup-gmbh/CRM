// auswertungMotion.js
// Bewegung im Report (Spec 12): Kennzahlen zählen vom alten auf den neuen Wert. Beim Filtern und
// Sortieren der Post-Tabelle blenden wegfallende Zeilen aus, danach gleiten die übrigen per Flip an
// ihren Platz, neue blenden ein und die Tabelle folgt der neuen Höhe. Die Erfassen-Liste tauscht
// sofort und gleitet nur. Alles nur bei echten Wechseln und ohne reduzierte Bewegung.

import { gsap, Flip, prefersReducedMotion } from '../../core/animation/gsap.js';
import { cancelCountTo, countTo, liveCountValue } from '../../core/animation/countTo.js';
import { formatCompactNumber } from '../../core/format/compactNumber.js';
import { wertNachArt } from './auswertungFormat.js';

const FLIP_LIMIT = 80;
const DAUER = 0.5;
const AUSBLENDEN = 0.2;
const EINBLENDEN = 0.35;

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
  return { flip: Flip.getState(ziele) };
}

/** Nach dem Neu-Rendern vom gemerkten Zustand in den neuen übergehen. */
export function spieleUebergang(zustand, root) {
  if (prefersReducedMotion() || !root || !zustand) return;
  const ziele = flipZiele(root);
  if (!ziele.length) return;
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

/** Laufender Wechsel je tbody: `ausblenden` vor dem Tausch, `bewegung` danach. */
const laeufe = new WeakMap();

const schluessel = (el) => el.dataset?.flipId || null;

/** Zweite Phase: Positionen und Höhe merken, tauschen, von dort in den neuen Stand gleiten. */
function tausche(root, inhalt, lauf, { huelle, danach }) {
  const ids = new Set([...inhalt.children].map(schluessel).filter(Boolean));
  const alt = [...root.children];
  const bleibenAlt = alt.filter(el => ids.has(schluessel(el)));
  const altIds = new Set(bleibenAlt.map(schluessel));
  lauf.bewegung?.kill();
  // Mit opacity: eine halb ausgeblendete Zeile, die nach einem Gegen-Klick bleibt, blendet von dort wieder auf
  const zustand = bleibenAlt.length ? Flip.getState(bleibenAlt, { props: 'opacity' }) : null;
  const hoeheVorher = huelle?.offsetHeight;

  root.replaceChildren(inhalt);
  danach?.();

  const zeilen = [...root.children];
  const bleiben = zeilen.filter(el => altIds.has(schluessel(el)));
  const kommen = zeilen.filter(el => !altIds.has(schluessel(el)));
  // Lücken schließen und Platz machen landen weich, reines Umsortieren kreuzt sich besser mit inOut
  const nurSortiert = bleibenAlt.length === alt.length && !kommen.length;
  const ease = nurSortiert ? 'power3.inOut' : 'power3.out';

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(zeilen, { clearProps: 'transform,opacity' });
      if (huelle) gsap.set(huelle, { clearProps: 'height,overflowY' });
      if (lauf.bewegung === tl) lauf.bewegung = null;
    }
  });
  if (huelle) {
    gsap.set(huelle, { clearProps: 'height' });
    const hoeheNachher = huelle.offsetHeight;
    // Gleiche Dauer und Kurve wie der Flip: keine Zeile ragt unterwegs aus der Hülle (overflow-x: auto schneidet ab)
    if (hoeheVorher !== hoeheNachher) {
      tl.fromTo(huelle, { height: hoeheVorher, overflowY: 'hidden' }, { height: hoeheNachher, duration: DAUER, ease }, 0);
    }
  }
  if (zustand && bleiben.length) {
    tl.add(Flip.from(zustand, { targets: bleiben, duration: DAUER, ease, scale: false, absolute: false }), 0);
  }
  if (kommen.length) {
    tl.fromTo(kommen, { opacity: 0, y: 6 }, {
      opacity: 1, y: 0, duration: EINBLENDEN, ease: 'power2.out', stagger: Math.min(0.04, 0.24 / kommen.length)
    }, bleiben.length ? 0.1 : 0);
  }
  lauf.bewegung = tl;
}

/**
 * Zeilen von `root` gegen `html` tauschen. Wegfallende Zeilen blenden aus, danach gleiten die
 * übrigen (gleiche data-flip-id) an ihren Platz, neue blenden gestaffelt ein und `huelle` folgt der
 * neuen Höhe. `danach` läuft direkt nach dem Tausch. Ein neuer Wechsel verwirft einen noch nicht
 * getauschten und setzt an den sichtbaren Positionen an.
 * @param {HTMLElement} root - z. B. tbody
 * @param {string} html
 * @param {{ huelle?: HTMLElement|null, danach?: () => void }} [opts]
 */
export function wechsleZeilen(root, html, { huelle = null, danach } = {}) {
  if (!root) return;
  const vorlage = document.createElement('template');
  vorlage.innerHTML = html;
  const inhalt = vorlage.content;
  const alt = [...root.children];
  const lauf = laeufe.get(root) || { ausblenden: null, bewegung: null };
  laeufe.set(root, lauf);
  lauf.ausblenden?.kill();
  lauf.ausblenden = null;

  if (prefersReducedMotion() || Math.max(alt.length, inhalt.children.length) > FLIP_LIMIT) {
    lauf.bewegung?.kill();
    lauf.bewegung = null;
    if (huelle) gsap.set(huelle, { clearProps: 'height,overflowY' });
    root.replaceChildren(inhalt);
    danach?.();
    return;
  }

  const ids = new Set([...inhalt.children].map(schluessel).filter(Boolean));
  const gehen = alt.filter(el => !ids.has(schluessel(el)));
  const weiter = () => {
    lauf.ausblenden = null;
    if (root.isConnected) tausche(root, inhalt, lauf, { huelle, danach });
  };
  if (!gehen.length) { weiter(); return; }
  gsap.set(gehen, { pointerEvents: 'none' });
  lauf.ausblenden = gsap.to(gehen, {
    opacity: 0,
    duration: AUSBLENDEN,
    ease: 'power1.in',
    stagger: { amount: 0.06 },
    overwrite: 'auto',
    onComplete: weiter
  });
}
