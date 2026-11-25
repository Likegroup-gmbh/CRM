// videoBrowserSucheFeld.js
// Suchfeld des Videos-Tabs (CONTEXT.md "Suche (Videos-Tab)"): sitzt vor dem Ansicht-Umschalter in der
// Workflow-Tab-Zeile und gilt für Showcase, Ordner und Kalender. Zustand `vb.suche` (nicht in der URL),
// ein Wechsel der Ansicht behält ihn. Tippen filtert live, "/" springt ins Feld, Escape leert es,
// Enter öffnet den ersten Treffer (Showcase: Vollansicht, Ordner: Kooperation bzw. Video).

import { sucheNormal } from './videoBrowserSuche.js';
import { oeffneErstenOrdnerTreffer, sucheOrdner } from './videoBrowserSucheAnsicht.js';
import { openShowcaseVollansicht, sucheShowcase } from './videoBrowserShowcase.js';
import { renderKalender } from './videoBrowserKalender.js';

const isTyping = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

/** Suche auf die offene Ansicht anwenden. Die anderen ziehen beim Einblenden nach (sie rendern dann). */
export function sucheAnwenden(vb, { animate = false } = {}) {
  if (vb.view === 'showcase') sucheShowcase(vb, { animate });
  else if (vb.view === 'ordner') sucheOrdner(vb, { animate });
  else if (vb.view === 'kalender') {
    renderKalender(vb);
    if (animate) vb.motion?.sucheIn(vb.kalEl?.querySelectorAll('[data-cal-event], [data-vb-kal-card]'));
  }
}

function syncFeld(vb) {
  const input = vb.sucheEl?.querySelector('[data-vb-suche-input]');
  const clear = vb.sucheEl?.querySelector('[data-vb-suche-feld-clear]');
  if (!input || !clear) return;
  if (input.value !== vb.suche) input.value = vb.suche;
  const aktiv = !!vb.suche;
  vb.sucheEl.classList.toggle('is-aktiv', aktiv);
  if (clear.hidden === !aktiv) return;
  clear.hidden = !aktiv;
  if (aktiv) vb.motion?.chipIn(clear);
}

export function setSuche(vb, value, { animate = true } = {}) {
  const next = String(value ?? '');
  const gleich = sucheNormal(next) === sucheNormal(vb.suche);
  vb.suche = next;
  syncFeld(vb);
  if (!gleich) sucheAnwenden(vb, { animate });
}

function ersterTreffer(vb) {
  if (vb.view === 'showcase' && vb.scResult?.list?.length) {
    openShowcaseVollansicht(vb, { index: 0 });
    return true;
  }
  if (vb.view === 'ordner') return oeffneErstenOrdnerTreffer(vb);
  return false;
}

/** Vor dem Gerüst. */
export function initSuche(vb) {
  vb.suche = '';
  vb.sucheEl = null;
}

/** Nach dem Einsetzen des Feldes (mountView): `scope` ist die Tab-Zeile bzw. die eigene Leiste. */
export function mountSuche(vb, scope) {
  vb.sucheEl = scope?.querySelector('[data-vb-suche]') || null;
  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    vb.cleanups.push(() => target.removeEventListener(type, fn));
  };
  if (vb.sucheEl) {
    const input = vb.sucheEl.querySelector('[data-vb-suche-input]');
    on(input, 'input', () => setSuche(vb, input.value));
    on(input, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (vb.suche) setSuche(vb, '');
        else input.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        ersterTreffer(vb);
      }
    });
    on(vb.sucheEl, 'click', (e) => {
      if (!e.target.closest('[data-vb-suche-feld-clear]')) return;
      setSuche(vb, '');
      input.focus();
    });
  }
  // "Suche leeren" im leeren Zustand einer Ansicht
  on(vb.root, 'click', (e) => {
    if (!e.target.closest('[data-vb-suche-clear]')) return;
    setSuche(vb, '');
    vb.sucheEl?.querySelector('[data-vb-suche-input]')?.focus({ preventScroll: true });
  });
  on(document, 'keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (isTyping(e.target) || vb.voll || !vb.root?.isConnected || vb.pane.closest('[hidden]')) return;
    const input = vb.sucheEl?.querySelector('[data-vb-suche-input]');
    if (!input) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
}
