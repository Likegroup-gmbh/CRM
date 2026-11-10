// videoBrowserMotion.js
// GSAP-Animationen des Videos-Tabs (A1 bis A3, A6 bis A11). GSAP kommt nur über
// core/animation/gsap.js. Alle Effekte laufen in einem gsap.context mit dem
// Tab-Root als Scope, destroy() räumt alles ab. Animiert wird nur bei echtem
// Navigationswechsel (animateFromDepth), nie bei einem Re-Render durch Kommentare.
// prefers-reduced-motion: Dauern 0, keine Endlos-Animation.

import { gsap, prefersReducedMotion, killRunning, trackRunning } from '../../core/animation/gsap.js';
import { showcaseEffects } from './videoBrowserShowcaseMotion.js';

const d = (seconds) => (prefersReducedMotion() ? 0 : seconds);
const CLEAR = 'transform,opacity';

/** Ist das Element sichtbar und liegt es im sichtbaren Bereich seiner scrollenden Spalte? */
function isVisibleIn(el) {
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return false;
  const inWindow = rect.bottom > 0 && rect.right > 0
    && rect.top < (window.innerHeight || Infinity) && rect.left < (window.innerWidth || Infinity);
  if (!inWindow) return false;
  const body = el.closest('.vb-col__body');
  if (!body) return true;
  const box = body.getBoundingClientRect();
  return rect.bottom > box.top && rect.top < box.bottom;
}

export function createMotion(root) {
  const ctx = gsap.context(() => {}, root);
  // Ghosts des Final-Flugs hängen am body, also außerhalb des Contexts
  const ghosts = new Set();

  const run = (fn) => ctx.add(fn);

  function tweenFrom(targets, vars) {
    const list = Array.from(targets || []).filter(Boolean);
    if (!list.length) return null;
    return gsap.from(list, { ...vars, clearProps: CLEAR });
  }

  return {
    // Showcase-Ansicht (Einflug, Flip, Hover, Vollansicht): eigene Datei, selber Context
    ...showcaseEffects({ run, d }),

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
        // Eigenschaftszeilen des Tabs Details folgen gestaffelt
        const props = inner.querySelectorAll('.vb-prop');
        if (props.length) {
          gsap.from(props, { x: -6, opacity: 0, duration: d(0.3), stagger: d(0.025), delay: d(0.12), ease: 'power2.out', clearProps: CLEAR });
        }
      });
    },

    /** Tab-Wechsel: der Unterstrich gleitet zum aktiven Tab (ohne `animate` sofort, z. B. initial und bei Resize). */
    tabIndicator(listEl, { animate = true } = {}) {
      run(() => {
        const ind = listEl?.querySelector('[data-vb-tab-indicator]');
        // Tabs (aria-selected) und Segment-Umschalter (Radio, aria-checked) teilen sich den Indikator
        const tab = listEl?.querySelector('[role="tab"][aria-selected="true"], [role="radio"][aria-checked="true"]');
        if (!ind || !tab) return;
        const vars = { x: tab.offsetLeft, width: tab.offsetWidth };
        killRunning(ind);
        if (!animate || prefersReducedMotion()) {
          gsap.set(ind, vars);
          return;
        }
        trackRunning(ind, gsap.to(ind, { ...vars, duration: 0.3, ease: 'power3.out' }));
      });
    },

    /** Tab-Wechsel: der neue Inhalt blendet gestaffelt ein. */
    tabPanelIn(panel) {
      run(() => {
        if (!panel) return;
        const items = panel.querySelectorAll('.vb-prop, .vb-admrow, .vb-comments > *, .vb-panel__item');
        const targets = items.length ? items : panel.children;
        tweenFrom(targets, { y: 6, opacity: 0, duration: d(0.25), stagger: d(0.03), ease: 'power2.out' });
      });
    },

    /** Gespeichert-Feedback: die Zeile wird kurz hinterlegt und blendet wieder aus. */
    savedFlash(el) {
      run(() => {
        if (!el || prefersReducedMotion()) return;
        const tint = getComputedStyle(el).getPropertyValue('--gray-100').trim() || '#f3f4f6';
        gsap.fromTo(el, { backgroundColor: tint }, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.9, ease: 'power1.out', clearProps: 'backgroundColor' });
      });
    },

    /** Stern-Pop (Schnell-Stern, Final-Leiste), beim Markieren und beim Abwählen. */
    starPop(...stars) {
      run(() => {
        const list = stars.flat().filter(Boolean);
        if (!list.length || prefersReducedMotion()) return;
        gsap.fromTo(list,
          { scale: 0.4, rotation: -40 },
          { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(3)', clearProps: 'transform' });
      });
    },

    /**
     * Die Miniatur fliegt in den Ordner "Finale Version": zwei getrennte Tweens mit
     * unterschiedlichem Easing ergeben eine Bogenbahn. Der Ghost hängt am body und liegt damit
     * außerhalb des gsap.context, destroy() räumt ihn ab.
     * @returns {boolean} true, wenn der Flug läuft (Ziel sichtbar, Bewegung erlaubt)
     */
    flyToFinal(sourceRect, ghost) {
      const target = root.querySelector('[data-folder-id="final"] [data-slot="icon"]');
      if (!target || !sourceRect || !ghost || prefersReducedMotion() || !isVisibleIn(target)) {
        ghost?.remove();
        return false;
      }
      const t = target.getBoundingClientRect();
      Object.assign(ghost.style, {
        position: 'fixed', zIndex: '70', pointerEvents: 'none', margin: '0',
        left: `${sourceRect.left}px`, top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`, height: `${sourceRect.height}px`
      });
      ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      ghosts.add(ghost);

      const endW = 16;
      const endH = 20;
      const endX = t.left + t.width / 2 - endW / 2;
      const endY = t.top + t.height / 2 - endH / 2;
      const done = () => { ghosts.delete(ghost); ghost.remove(); };
      gsap.to(ghost, { left: endX, width: endW, duration: 0.7, ease: 'power2.inOut' });
      gsap.to(ghost, { top: endY, height: endH, duration: 0.7, ease: 'back.in(1.4)' });
      gsap.to(ghost, { opacity: 0, duration: 0.18, delay: 0.62, onComplete: done });
      // Puls am Ziel, wenn der Ghost ankommt
      gsap.fromTo(target, { scale: 1 },
        { scale: 1.3, duration: 0.16, delay: 0.62, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
      return true;
    },

    /** Neuer Tag-Chip. */
    chipIn(chip) {
      run(() => {
        if (chip) gsap.from(chip, { scale: 0.5, opacity: 0, duration: d(0.4), ease: 'back.out(2.5)', clearProps: 'transform,opacity' });
      });
    },

    /** Tag-Chip schrumpft weg, danach entfernt `onComplete` ihn aus dem DOM. */
    chipOut(chip, onComplete) {
      if (!chip || prefersReducedMotion()) { onComplete?.(); return; }
      run(() => {
        gsap.to(chip, {
          scale: 0.6, opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0, marginLeft: 0, marginRight: 0,
          duration: 0.28, ease: 'power2.in', onComplete: () => onComplete?.()
        });
      });
    },

    /** Gruppenkopf in Spalte 0 klappt auf: die Liste wächst von 0 auf ihre Höhe, die Zeilen folgen gestaffelt. */
    koopGroupOpen(body, { stagger = true } = {}) {
      run(() => {
        if (!body) return;
        // Mitten im Zuklappen: von der aktuellen Höhe weiter, Reste der Zeilen-Staffel weg
        const from = body.style.height ? body.offsetHeight : 0;
        killRunning(body);
        const rows = stagger ? body.querySelectorAll('.vb-row') : [];
        gsap.set(body.querySelectorAll('.vb-row'), { clearProps: CLEAR });
        if (prefersReducedMotion()) {
          gsap.set(body, { clearProps: 'height,opacity,overflow' });
          return;
        }
        const tl = gsap.timeline();
        tl.fromTo(body,
          { height: from, opacity: from ? Number(getComputedStyle(body).opacity) : 0, overflow: 'hidden' },
          { height: 'auto', opacity: 1, duration: 0.28, ease: 'power2.out', clearProps: 'height,opacity,overflow' }, 0);
        if (rows.length && !from) {
          tl.from(rows, { x: 8, opacity: 0, duration: 0.24, stagger: 0.02, ease: 'power2.out', clearProps: CLEAR }, 0.04);
        }
        trackRunning(body, tl);
      });
    },

    /** Gruppenkopf klappt zu. `onComplete` blendet die Liste danach aus (sofort bei reduzierter Bewegung). */
    koopGroupClose(body, onComplete) {
      if (!body || prefersReducedMotion()) {
        onComplete?.();
        return;
      }
      run(() => {
        killRunning(body);
        gsap.set(body.querySelectorAll('.vb-row'), { clearProps: CLEAR });
        gsap.set(body, { overflow: 'hidden' });
        const tl = gsap.timeline({
          onComplete: () => {
            gsap.set(body, { clearProps: 'height,opacity,overflow' });
            onComplete?.();
          }
        });
        tl.to(body, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in' });
        trackRunning(body, tl);
      });
    },

    /** Gefilterte Zeilen blenden gestaffelt ein. */
    filterRowsIn(rows) {
      run(() => tweenFrom(rows, { y: 8, opacity: 0, duration: d(0.3), stagger: d(0.03), ease: 'power2.out' }));
    },

    /** Eingabefeld der Tag-Auswahl wächst von Trigger-Breite auf volle Breite, die Liste kommt von oben. */
    tagInputOpen(input, list) {
      run(() => {
        if (input) gsap.from(input, { width: 60, duration: d(0.25), ease: 'power2.out', clearProps: 'width' });
        if (list) gsap.from(list, { y: -6, opacity: 0, duration: d(0.2), ease: 'power2.out', clearProps: 'transform,opacity' });
      });
    },

    /**
     * Löschen: die Zeile klappt zu (Höhe, Opacity, leicht nach links), das Detail blendet ab.
     * @returns {Promise<void>} löst nach der Animation auf (sofort bei reduzierter Bewegung)
     */
    rowCollapse(rowEl, detailEl) {
      return new Promise((resolve) => {
        if (prefersReducedMotion() || !rowEl) { resolve(); return; }
        run(() => {
          if (detailEl) gsap.to(detailEl, { opacity: 0.35, duration: 0.3, ease: 'power2.in' });
          gsap.set(rowEl, { overflow: 'hidden' });
          gsap.fromTo(rowEl,
            { height: rowEl.offsetHeight },
            { height: 0, opacity: 0, x: -12, duration: 0.3, ease: 'power2.in', onComplete: resolve });
        });
      });
    },

    /** Löschen fehlgeschlagen: Zeile und Detail kommen zurück. */
    rowRestore(rowEl, detailEl) {
      run(() => {
        if (rowEl) gsap.set(rowEl, { clearProps: 'height,opacity,x,overflow' });
        if (detailEl) gsap.set(detailEl, { clearProps: 'opacity' });
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
      ghosts.forEach((ghost) => { gsap.killTweensOf(ghost); ghost.remove(); });
      ghosts.clear();
      ctx.revert();
    }
  };
}
