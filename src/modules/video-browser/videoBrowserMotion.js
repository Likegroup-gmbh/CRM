// videoBrowserMotion.js
// GSAP-Animationen des Videos-Tabs (A1 bis A3, A6 bis A11). GSAP kommt nur über
// core/animation/gsap.js. Alle Effekte laufen in einem gsap.context mit dem
// Tab-Root als Scope, destroy() räumt alles ab. Animiert wird nur bei echtem
// Navigationswechsel (animateFromDepth), nie bei einem Re-Render durch Kommentare.
// prefers-reduced-motion: Dauern 0, keine Endlos-Animation.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from '../../core/animation/gsap.js';

const d = (seconds) => (prefersReducedMotion() ? 0 : seconds);
const CLEAR = 'transform,opacity';

export function createMotion(root) {
  const ctx = gsap.context(() => {}, root);

  const run = (fn) => ctx.add(fn);

  function tweenFrom(targets, vars) {
    const list = Array.from(targets || []).filter(Boolean);
    if (!list.length) return null;
    return gsap.from(list, { ...vars, clearProps: CLEAR });
  }

  return {
    /** A1/A2: neue Spalten gleiten herein, danach ihre Zeilen gestaffelt, danach nach rechts scrollen. */
    columnsIn(columns, { fromDepth = 0, scroller = null } = {}) {
      run(() => {
        const fresh = Array.from(columns || []).filter(col => Number(col.dataset.depth) >= fromDepth);
        fresh.forEach((col, i) => {
          killRunning(col);
          const tl = gsap.timeline();
          // Nur Opacity: ein x-Versatz der Spalte vergrößert kurz die Scrollbreite (Scrollbalken blitzt, Spalten springen).
          tl.from(col, { opacity: 0, duration: d(0.42), delay: d(i * 0.07), ease: 'power3.out', clearProps: CLEAR }, 0);
          const rows = col.querySelectorAll('.vb-row, .vb-group__head');
          if (rows.length) {
            tl.from(rows, {
              x: 12, opacity: 0, duration: d(0.32), delay: d(i * 0.07 + 0.06),
              stagger: d(0.025), ease: 'power2.out', clearProps: CLEAR
            }, 0);
          }
          trackRunning(col, tl);
        });
        if (scroller && fresh.length) {
          const left = scroller.scrollWidth;
          if (prefersReducedMotion()) scroller.scrollLeft = left;
          else scroller.scrollTo({ left, behavior: 'smooth' });
        }
      });
    },

    /** A3: Detailbereich wechselt. */
    detailIn(detailEl) {
      run(() => {
        const inner = detailEl?.querySelector('[data-vb-detail-inner]');
        if (!inner) return;
        tweenFrom(inner.children, { y: 12, opacity: 0, duration: d(0.38), stagger: d(0.05), ease: 'power2.out' });
        const frame = inner.querySelector('[data-vb-frame]');
        if (frame) gsap.from(frame, { scale: 0.94, duration: d(0.5), ease: 'power3.out', clearProps: 'transform' });
        const tiles = inner.querySelectorAll('.vb-tile');
        tiles.forEach((tile, i) => {
          gsap.from(tile, { y: 10, opacity: 0, duration: d(0.3), delay: d(0.15 + i * 0.03), clearProps: CLEAR });
        });
      });
    },

    /** A6: Vorschau-Rahmen auf neues Seitenverhältnis. */
    frameTo(frame, { w, h }, { animate = true } = {}) {
      run(() => {
        if (!frame) return;
        killRunning(frame);
        if (!animate || prefersReducedMotion()) {
          gsap.set(frame, { width: w, height: h });
          return;
        }
        trackRunning(frame, gsap.timeline().to(frame, { width: w, height: h, duration: 0.6, ease: 'power3.inOut' }));
      });
    },

    /** Rendition nachgeladen: Medienfläche blendet sanft ein (Crossfade). */
    crossfade(el) {
      run(() => {
        if (!el) return;
        gsap.fromTo(el, { opacity: 0.2 }, { opacity: 1, duration: d(0.4), ease: 'power2.out', clearProps: 'opacity' });
      });
    },

    /** A7: Play-Button blendet beim Abspielen nach 0,6 s aus, beim Pausieren wieder ein. */
    playButton(btn, playing) {
      run(() => {
        if (!btn) return;
        gsap.killTweensOf(btn);
        if (playing) {
          gsap.to(btn, { opacity: 0, delay: d(0.6), duration: d(0.25), onComplete: () => { btn.style.pointerEvents = 'none'; } });
        } else {
          btn.style.pointerEvents = '';
          gsap.to(btn, { opacity: 1, duration: d(0.2) });
        }
      });
    },

    /** A8: Indikator im Segment-Umschalter gleitet zur aktiven Taste. */
    segmentThumb(group, { animate = true } = {}) {
      run(() => {
        const thumb = group?.querySelector('[data-vb-thumb]');
        const active = group?.querySelector('input:checked')?.closest('.vb-formats__btn');
        if (!thumb || !active) return;
        const vars = { x: active.offsetLeft, width: active.offsetWidth };
        if (!animate || prefersReducedMotion()) gsap.set(thumb, vars);
        else gsap.to(thumb, { ...vars, duration: 0.35, ease: 'power3.out' });
      });
    },

    /** A9: neuer Kommentar und neuer Marker, ohne Spalten-Animation. */
    commentIn(commentEl, markerEl) {
      run(() => {
        if (commentEl) gsap.from(commentEl, { y: 14, opacity: 0, duration: d(0.4), ease: 'power3.out', clearProps: CLEAR });
        if (markerEl) gsap.from(markerEl, { scale: 0, duration: d(0.6), ease: 'back.out(4)', clearProps: 'transform' });
      });
    },

    /** A10: neue Upload-Zeile. */
    uploadRowIn(rowEl, index = 0) {
      run(() => {
        if (rowEl) gsap.from(rowEl, { x: -16, opacity: 0, duration: d(0.35), delay: d(index * 0.06), clearProps: CLEAR });
      });
    },

    /** A11: Zahl im Badge ändert sich. */
    badgeBump(badgeEl) {
      run(() => {
        if (badgeEl) gsap.fromTo(badgeEl, { scale: 1.5 }, { scale: 1, duration: d(0.5), ease: 'back.out(3)', clearProps: 'transform' });
      });
    },

    /** A7-Fallback: Wiedergabe ohne echte Datei über einen Tween steuern. */
    simulate(state, { duration, onUpdate, onComplete }) {
      let tween = null;
      run(() => {
        tween = gsap.to(state, {
          t: duration,
          duration: Math.max(0.01, duration - state.t),
          ease: 'none',
          onUpdate,
          onComplete
        });
      });
      return tween;
    },

    destroy() {
      ctx.revert();
    }
  };
}
