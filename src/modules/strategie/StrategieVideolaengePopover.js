// StrategieVideolaengePopover.js
// Der Slider fuer die Dauer einer Videoidee als Popover an der Tabellenzelle.
// Schwebt am body (die Tabelle schneidet Overflow ab), schliesst mit Escape oder
// Klick daneben. Gespeichert wird bei jedem abgeschlossenen Zug (onCommit).

import {
  bindSekundenSpanne,
  renderSekundenSpanne,
  sekundenSpanneAttrs,
  setSekundenSpanne
} from '../../core/components/SekundenSpanne.js';

export const VIDEOLAENGE_POPOVER_ID = 'strategie-videolaenge-popover';

let aktiv = null;

export function closeVideolaengePopover() {
  if (!aktiv) return;
  const { el, cleanup } = aktiv;
  aktiv = null;
  cleanup();
  el.remove();
}

function positionieren(el, trigger) {
  const rect = trigger.getBoundingClientRect();
  const breite = el.offsetWidth || 320;
  const maxLeft = Math.max(8, window.innerWidth - breite - 8);
  el.style.left = `${Math.min(Math.max(8, rect.left), maxLeft)}px`;
  el.style.top = `${rect.bottom + 4}px`;
}

/**
 * Oeffnet den Slider unter dem Trigger. Ein zweiter Klick auf denselben Trigger
 * schliesst ihn wieder.
 * @param {{
 *   trigger: HTMLElement,
 *   iv: {von:number,bis:number}|null,
 *   aktuell?: () => {von:number,bis:number}|null,
 *   onCommit: (iv: {von:number,bis:number}|null) => (boolean|Promise<boolean>|void)
 * }} opts
 *   aktuell: optional, liefert den gespeicherten Stand. onCommit liefert false, wenn nicht
 *   gespeichert wurde; der Slider springt dann auf aktuell() zurueck.
 */
export function openVideolaengePopover({ trigger, iv, onCommit, aktuell = null }) {
  const gleicherTrigger = aktiv?.itemId === trigger.dataset.itemId;
  closeVideolaengePopover();
  if (gleicherTrigger) return null;

  const el = document.createElement('div');
  el.id = VIDEOLAENGE_POPOVER_ID;
  el.className = 'strategie-videolaenge-popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Dauer');
  el.innerHTML = `
    <div class="strategie-videolaenge-popover__title">Dauer in Sekunden</div>
    <div class="videoidee-dauer" ${sekundenSpanneAttrs({ name: 'videolaenge', von: iv?.von, bis: iv?.bis })}>
      ${renderSekundenSpanne({ von: iv?.von, bis: iv?.bis })}
    </div>`;
  document.body.appendChild(el);
  positionieren(el, trigger);

  const root = el.querySelector('[data-sekunden-spanne]');
  bindSekundenSpanne(root, {
    onCommit: async (next) => {
      const ok = await onCommit(next);
      if (ok === false && typeof aktuell === 'function') setSekundenSpanne(root, aktuell(), { forceInputs: true });
    }
  });

  const onPointerDown = (e) => {
    if (el.contains(e.target)) return;
    // Der Trigger wird nach jedem Speichern neu gerendert: ueber die Item-ID erkennen, nicht ueber das Element.
    const ziel = e.target.closest?.('[data-videolaenge-trigger]');
    if (ziel && ziel.dataset.itemId === trigger.dataset.itemId) return;
    closeVideolaengePopover();
  };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeVideolaengePopover();
    trigger.focus?.();
  };
  const onScroll = () => closeVideolaengePopover();

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onScroll);
  window.addEventListener('scroll', onScroll, true);

  aktiv = {
    el,
    itemId: trigger.dataset.itemId,
    cleanup: () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    }
  };
  return el;
}
