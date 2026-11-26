// Freigabe-Button im Casting: Puls-Animation
// Entsperren (Prio 1/2 + Zusage), Sperren (Bedingung fällt weg), Freigeben (Klick → Kooperation)
// Nur Bewegung. Farben, Größen und Zustands-Styling kommen aus dem bestehenden CSS.
import { gsap } from './gsap.js';

// Drehpunkt = unteres Ende des rechten Bügel-Beins im Icon-viewBox.
// Schloss aus src/core/icons/schlossIcons.js (24er viewBox, rechtes Bein bei x=16.5 bis y=9).
export const SHACKLE_ORIGIN = '16.5 9';
const OFFEN = { y: -2.2, rotation: 24 };

const reduziert = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const d = (sek) => (reduziert() ? 0.01 : sek);

function teile(btn) {
  return {
    shackle: btn.querySelector('[data-freigabe-shackle]'),
    lockIcon: btn.querySelector('[data-freigabe-lock]'),
    checkIcon: btn.querySelector('[data-freigabe-check]'),
    checkPath: btn.querySelector('[data-freigabe-check] path'),
    label: btn.querySelector('[data-freigabe-label]'),
    ring: btn.parentElement?.querySelector('[data-freigabe-ring]'),
  };
}

/** Nach jedem Render aufrufen: setzt Bügel/Icons ohne Animation auf den Zustand. */
export function initFreigabeButton(btn, zustand /* 'locked' | 'ready' | 'done' */) {
  const { shackle, lockIcon, checkIcon, checkPath } = teile(btn);
  gsap.set(shackle, { svgOrigin: SHACKLE_ORIGIN, ...(zustand === 'locked' ? { y: 0, rotation: 0 } : OFFEN) });
  gsap.set(lockIcon, { opacity: zustand === 'done' ? 0 : 1, scale: 1, transformOrigin: '50% 50%' });
  gsap.set(checkIcon, { opacity: zustand === 'done' ? 1 : 0 });
  gsap.set(checkPath, { strokeDashoffset: 0 });
}

/** Bedingung erfüllt: ein Ring pulsiert einmal nach außen, der Bügel springt auf. */
export function animateFreigabeUnlock(btn, { delay = 0 } = {}) {
  const { shackle, ring } = teile(btn);
  gsap.killTweensOf([shackle, ring]);
  const tl = gsap.timeline({ delay });

  tl.to(shackle, { ...OFFEN, svgOrigin: SHACKLE_ORIGIN, duration: d(0.3), ease: 'power3.out' }, 0);

  if (ring && !reduziert()) {
    // Ring wächst rundum um ca. 6 px, egal wie breit der Button ist
    const w = Math.max(1, btn.offsetWidth);
    const h = Math.max(1, btn.offsetHeight);
    tl.fromTo(
      ring,
      { opacity: 0.5, scaleX: 1, scaleY: 1 },
      { opacity: 0, scaleX: (w + 12) / w, scaleY: (h + 12) / h, duration: d(0.75), ease: 'power2.out' },
      0.05
    );
  }
  return tl;
}

/** Bedingung fällt weg (z. B. Abgelehnt): Bügel schließt wieder. */
export function animateFreigabeLock(btn) {
  const { shackle, ring } = teile(btn);
  gsap.killTweensOf([shackle, ring]);
  if (ring) gsap.set(ring, { opacity: 0 });
  return gsap.to(shackle, { y: 0, rotation: 0, svgOrigin: SHACKLE_ORIGIN, duration: d(0.25), ease: 'power2.inOut' });
}

/**
 * Klick auf Freigeben: Welle vom Klickpunkt, Schloss → Haken (zeichnet sich), Label wechselt,
 * sechs Funken um das Icon. ruhig = true (Serie) lässt die Funken weg.
 */
export function animateFreigabeApprove(btn, { event, ruhig = false, label } = {}) {
  const { lockIcon, checkIcon, checkPath, label: labelEl } = teile(btn);
  gsap.killTweensOf([lockIcon, checkIcon, checkPath, labelEl]);
  const tl = gsap.timeline();

  // 1. Welle ab Klickpunkt (ohne Maus-Event: Mitte)
  if (!reduziert()) {
    const r = btn.getBoundingClientRect();
    const x = event?.clientX ? event.clientX - r.left : r.width / 2;
    const y = event?.clientY ? event.clientY - r.top : r.height / 2;
    const size = Math.hypot(r.width, r.height) * 2;
    const welle = document.createElement('span');
    welle.className = 'freigabe-welle';
    Object.assign(welle.style, {
      width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px`,
    });
    btn.appendChild(welle);
    tl.fromTo(welle, { scale: 0, opacity: 0.3 },
      { scale: 1, opacity: 0, duration: 0.65, ease: 'power2.out', onComplete: () => welle.remove() }, 0);
  }

  // 2. Schloss raus, Haken zeichnet sich
  tl.to(lockIcon, { scale: 0.5, opacity: 0, transformOrigin: '50% 50%', duration: d(0.18) }, 0.05);
  tl.set(checkIcon, { opacity: 1 }, 0.15);
  tl.fromTo(checkPath, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: d(0.38), ease: 'power2.out' }, 0.15);

  // 3. Label überblenden
  if (labelEl && label) {
    tl.to(labelEl, { opacity: 0, duration: d(0.12) }, 0)
      .call(() => { labelEl.textContent = label; }, null, 0.12)
      .to(labelEl, { opacity: 1, duration: d(0.2) }, 0.12);
  }

  // 4. Funken
  if (!ruhig && !reduziert()) funken(checkIcon);
  return tl;
}

/** Fehler beim Anlegen der Kooperation: Icons zurück auf Schloss (Label setzt der Aufrufer). */
export function revertFreigabeApprove(btn) {
  const { lockIcon, checkIcon, checkPath } = teile(btn);
  btn.querySelectorAll('.freigabe-welle').forEach((n) => n.remove());
  gsap.killTweensOf([lockIcon, checkIcon, checkPath]);
  gsap.set(lockIcon, { opacity: 1, scale: 1 });
  gsap.set(checkIcon, { opacity: 0 });
  gsap.set(checkPath, { strokeDashoffset: 0 });
}

function funken(anker) {
  const r = anker.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let k = 0; k < 6; k++) {
    const f = document.createElement('span');
    f.className = 'freigabe-funke';
    f.style.left = `${cx - 2}px`;
    f.style.top = `${cy - 2}px`;
    document.body.appendChild(f);
    const winkel = (k / 6) * Math.PI * 2 + Math.random() * 0.4;
    const weite = 14 + Math.random() * 8;
    gsap.fromTo(f, { opacity: 0.9, scale: 1 }, {
      x: Math.cos(winkel) * weite, y: Math.sin(winkel) * weite, opacity: 0, scale: 0.3,
      duration: 0.55, delay: 0.08, ease: 'power2.out', onComplete: () => f.remove(),
    });
  }
}

/**
 * Serien-Dämpfung (rein, testbar): ab der 3. Freigabe innerhalb von 4 s → ruhig.
 * Pro Casting-Tabelle eine Instanz anlegen.
 */
export function createSerienDaempfung({ fensterMs = 4000, abAnzahl = 2, jetzt = () => performance.now() } = {}) {
  const zeiten = [];
  return {
    naechsteIstRuhig() {
      const t = jetzt();
      while (zeiten.length && t - zeiten[0] > fensterMs) zeiten.shift();
      const ruhig = zeiten.length >= abAnzahl;
      zeiten.push(t);
      return ruhig;
    },
  };
}
