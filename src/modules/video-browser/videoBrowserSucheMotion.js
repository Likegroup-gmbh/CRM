// videoBrowserSucheMotion.js
// GSAP-Effekte der Textsuche (videoBrowserSucheAnsicht.js). Wird in createMotion (videoBrowserMotion.js)
// eingehängt und läuft damit im selben gsap.context. Flip zwischen altem und neuem Trefferstand:
// Bleibende gleiten an ihren Platz, neue poppen ein, wegfallende blenden an ihrem alten Platz aus.

import { gsap, Flip, prefersReducedMotion } from '../../core/animation/gsap.js';

const CLEAR = 'transform,opacity';
/** Mehr Elemente ruckeln im Flip, dann wird nur umgeschaltet. */
const FLIP_LIMIT = 240;

/** @param {{ run: (fn: Function) => void, d: (seconds: number) => number }} deps */
export function sucheEffects({ run, d }) {
  return {
    /**
     * `apply` schaltet die Sichtbarkeit um und gibt die zu animierenden Elemente zurück, `targets` sind alle
     * beteiligten (vorher gemessen). `done` läuft am Ende, ohne Animation sofort.
     */
    sucheFlip(targets, apply, { done } = {}) {
      const list = [...targets].filter(Boolean);
      if (prefersReducedMotion() || !list.length || list.length > FLIP_LIMIT) {
        apply();
        done?.();
        return;
      }
      run(() => {
        const state = Flip.getState(list);
        const animated = apply() || list;
        const leaving = [];
        Flip.from(state, {
          targets: animated,
          duration: 0.45,
          ease: 'power3.inOut',
          nested: true,
          prune: true,
          absoluteOnLeave: true,
          onEnter: els => gsap.fromTo(els,
            { opacity: 0, scale: 0.88 },
            { opacity: 1, scale: 1, duration: 0.38, delay: 0.08, stagger: 0.015, ease: 'back.out(1.7)', clearProps: CLEAR }),
          onLeave: (els) => {
            leaving.push(...els);
            return gsap.to(els, { opacity: 0, scale: 0.88, duration: 0.24, ease: 'power1.in' });
          },
          onComplete: () => {
            gsap.set(leaving, { clearProps: CLEAR });
            done?.();
          }
        });
      });
    },

    /** Neu gerenderte Treffer (Kalender) blenden gestaffelt ein. */
    sucheIn(els) {
      run(() => {
        const list = [...(els || [])].filter(Boolean);
        if (!list.length) return;
        gsap.from(list, {
          y: 6, opacity: 0, duration: d(0.28), ease: 'power2.out', clearProps: CLEAR,
          stagger: { amount: d(Math.min(0.24, list.length * 0.02)) }
        });
      });
    }
  };
}
