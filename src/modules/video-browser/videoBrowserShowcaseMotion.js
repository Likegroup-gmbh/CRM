// videoBrowserShowcaseMotion.js
// GSAP-Effekte der Showcase-Ansicht (A1, A2, A4 bis A7). Wird in createMotion (videoBrowserMotion.js)
// eingehängt und läuft damit im selben gsap.context: destroy() räumt alles ab.
// prefers-reduced-motion: Dauern 0, keine Flüge, keine Hover-Animation.

import { gsap, Flip, prefersReducedMotion } from '../../core/animation/gsap.js';
import { FLIP_LIMIT } from './videoBrowserShowcaseLogic.js';

const CLEAR = 'transform,opacity';

/** Verschiebung und Skalierung, die ein Element von `from` nach `to` bringt (Ursprung oben links). */
function flightVars(from, to) {
  return {
    x: from.left - to.left,
    y: from.top - to.top,
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
    transformOrigin: '0 0'
  };
}

const usable = (rect) => !!rect && rect.width > 0 && rect.height > 0;

/**
 * @param {{ run: (fn: Function) => void, d: (seconds: number) => number }} deps
 *   run: Effekt im gsap.context ausführen, d: Dauer (0 bei reduzierter Bewegung)
 */
export function showcaseEffects({ run, d }) {
  return {
    /**
     * A1: Einflug beim Umschalten Ordner → Showcase. Kacheln, deren Datei vorher in der
     * Inhalte-Spalte stand (`fromRects`: Datei-Id → Rect), fliegen per manuellem FLIP von dort ein,
     * alle anderen kommen gestaffelt. Leiste und Gruppenköpfe blenden von oben ein.
     */
    showcaseIn(root, fromRects = new Map()) {
      run(() => {
        if (!root) return;
        const head = root.querySelectorAll('.vb-sc-bar__controls, [data-vb-sc-chips] > *, [data-vb-sc-grouphead]');
        if (head.length) gsap.from(head, { y: 8, opacity: 0, duration: d(0.3), stagger: d(0.03), clearProps: CLEAR });

        let i = 0;
        root.querySelectorAll('[data-vb-sc-tile]').forEach((tile) => {
          const frame = tile.querySelector('[data-vb-sc-frame]');
          const from = fromRects.get(tile.dataset.itemId);
          const to = frame?.getBoundingClientRect();
          if (!prefersReducedMotion() && usable(from) && usable(to)) {
            gsap.from(frame, { ...flightVars(from, to), duration: 0.75, ease: 'power3.inOut', clearProps: 'transform' });
            gsap.from(tile.querySelectorAll('.vb-sc-tile__title, .vb-sc-tile__sub'), { opacity: 0, duration: 0.3, delay: 0.55, clearProps: 'opacity' });
            return;
          }
          gsap.from(tile, { y: 18, opacity: 0, duration: d(0.45), delay: d(0.1 + Math.min(i, 40) * 0.014), ease: 'power2.out', clearProps: CLEAR });
          i += 1;
        });
      });
    },

    /**
     * A3: Datenmenge wechselt (Inhalt). Die alten Kacheln blenden gestaffelt aus. Gibt ein Promise zurück, das
     * danach auflöst, oder `null`, wenn nichts auszublenden ist (leer, reduzierte Bewegung): dann sofort rendern.
     */
    swapOut(grid) {
      const tiles = grid ? [...grid.querySelectorAll('[data-vb-sc-tile]')] : [];
      if (prefersReducedMotion() || !tiles.length) return null;
      return new Promise((resolve) => {
        run(() => {
          gsap.to(tiles, {
            opacity: 0, y: -8, scale: 0.96, duration: 0.2, ease: 'power1.in',
            stagger: { amount: Math.min(0.16, tiles.length * 0.006) },
            onComplete: resolve,
            onInterrupt: resolve
          });
        });
      });
    },

    /** A3: nach dem Neu-Rendern kommen Leiste-Chips, Gruppenköpfe und die neuen Kacheln gestaffelt herein. */
    swapIn(root) {
      run(() => {
        if (!root) return;
        const head = root.querySelectorAll('[data-vb-sc-chips] > *, [data-vb-sc-grouphead]');
        if (head.length) gsap.from(head, { y: 8, opacity: 0, duration: d(0.3), stagger: d(0.03), clearProps: CLEAR });
        const tiles = [...root.querySelectorAll('[data-vb-sc-tile], .vb-sc-empty, .vb-empty--filter')];
        tiles.forEach((tile, i) => {
          gsap.from(tile, { y: 14, opacity: 0, duration: d(0.4), delay: d(0.08 + Math.min(i, 40) * 0.014), ease: 'power2.out', clearProps: CLEAR });
        });
      });
    },

    /**
     * A2: Zustand der Kacheln vor einer Änderung merken (Flip). `null`, wenn nicht animiert wird
     * (reduzierte Bewegung, mehr als FLIP_LIMIT Kacheln).
     */
    flipState(grid) {
      const tiles = grid ? [...grid.querySelectorAll('[data-flip-id]')] : [];
      if (prefersReducedMotion() || !tiles.length || tiles.length > FLIP_LIMIT) return null;
      return Flip.getState(tiles);
    },

    /** A2: nach dem Neu-Rendern vom gemerkten Zustand in den neuen morphen, neue Kacheln poppen ein. */
    flipFrom(state, grid) {
      run(() => {
        if (!grid) return;
        const tiles = [...grid.querySelectorAll('[data-flip-id]')];
        if (!state || !tiles.length) {
          if (tiles.length) gsap.from(tiles, { opacity: 0, duration: d(0.3), clearProps: 'opacity' });
          return;
        }
        Flip.from(state, {
          targets: tiles,
          duration: 0.6,
          ease: 'power3.inOut',
          stagger: 0.006,
          scale: false,
          absolute: false,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 },
            { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)', clearProps: CLEAR }),
          onComplete: () => gsap.set(tiles, { clearProps: 'transform' })
        });
      });
    },

    /** A4: Hover-Vorschau. Fortschrittsbalken bei Video und Story, leichter Zoom bei Bildern. */
    hoverIn(tile, { duration = 8 } = {}) {
      if (prefersReducedMotion() || !tile) return;
      run(() => {
        const bar = tile.querySelector('[data-vb-sc-progress]');
        const media = tile.querySelector('[data-vb-sc-media]');
        if (bar) {
          gsap.killTweensOf(bar);
          gsap.fromTo(bar, { width: '0%' }, { width: '100%', duration: Math.min(8, duration), ease: 'none', repeat: -1 });
        } else if (media) {
          gsap.to(media, { scale: 1.07, duration: 4, ease: 'power1.out' });
        }
      });
    },

    hoverOut(tile) {
      if (!tile) return;
      run(() => {
        const bar = tile.querySelector('[data-vb-sc-progress]');
        const media = tile.querySelector('[data-vb-sc-media]');
        if (bar) { gsap.killTweensOf(bar); gsap.set(bar, { width: '0%' }); }
        if (media) {
          gsap.killTweensOf(media);
          gsap.to(media, { scale: 1, duration: d(0.4), clearProps: 'transform' });
        }
      });
    },

    /** A6: Blättern, das neue Medium gleitet aus der Richtung ein (dir = ±1). */
    slideIn(frame, dir) {
      run(() => {
        if (frame) gsap.fromTo(frame, { x: dir * 60, opacity: 0 }, { x: 0, opacity: 1, duration: d(0.4), ease: 'power3.out', clearProps: CLEAR });
      });
    },

    /** A7: Vollansicht schließt, das Overlay blendet kurz aus. Löst auf, wenn es entfernt werden kann. */
    lightboxOut({ overlay }) {
      return new Promise((resolve) => {
        if (!overlay || prefersReducedMotion()) { resolve(); return; }
        run(() => {
          gsap.to(overlay, { opacity: 0, duration: 0.18, ease: 'power1.out', onComplete: resolve, onInterrupt: resolve });
        });
      });
    }
  };
}
