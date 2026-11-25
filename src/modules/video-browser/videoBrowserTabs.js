// videoBrowserTabs.js
// Tabs im Detailbereich (Details, Ad Manager, Kommentare). Der gewählte Tab gilt global
// (`vb.detailTab`): wer im Ad Manager ist und mit den Pfeiltasten zur nächsten Datei geht, bleibt dort.
// Ein Wechsel schaltet nur die Sichtbarkeit um, nichts wird neu gerendert, Player und Entwürfe bleiben.

import { resolveSelection } from './videoBrowserLogic.js';
import { availableTabs } from './videoBrowserRenderTabs.js';

function tabsOf(vb) {
  const resolved = resolveSelection(vb.tree, vb.sel);
  return availableTabs({ resolved, canUpload: vb.canUpload });
}

/** Standard-Tab je Rolle: das Team beginnt bei den Details, Kunden beim Feedback. */
export const defaultTab = (team) => (team ? 'details' : 'kommentare');

/**
 * Tab umschalten. Liefert false, wenn die Datei den Tab nicht hat (dann bleibt alles wie es ist).
 * @param {{ animate?: boolean, focus?: boolean }} opts
 */
export function setDetailTab(vb, tab, { animate = true, focus = false } = {}) {
  if (!tabsOf(vb).includes(tab)) return false;
  const inner = vb.detailInner;
  const previous = inner?.querySelector('[role="tabpanel"]:not([hidden])')?.dataset.vbPanel || null;
  vb.detailTab = tab;
  if (!inner) return true;

  const list = inner.querySelector('[data-vb-tablist]');
  list?.querySelectorAll('[role="tab"]').forEach((btn) => {
    const on = btn.dataset.vbTab === tab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  });

  let panel = null;
  inner.querySelectorAll('[role="tabpanel"]').forEach((p) => {
    const on = p.dataset.vbPanel === tab;
    p.hidden = !on;
    if (on) panel = p;
  });

  // Der Unterstrich gleitet über core/animation/tabSlider.js (beobachtet .active / aria-selected)
  if (animate && panel && previous !== tab) vb.motion?.tabPanelIn(panel);
  if (focus) list?.querySelector(`[data-vb-tab="${tab}"]`)?.focus();
  return true;
}

/** Pfeiltasten, Pos1 und Ende innerhalb der Tab-Leiste (Roving Tabindex, Aktivierung beim Fokus). */
export function onTabKeydown(vb, e) {
  const btn = e.target.closest?.('[role="tab"]');
  if (!btn) return false;
  const tabs = [...btn.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const i = tabs.indexOf(btn);
  let next = -1;
  if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  if (next < 0) return false;
  e.preventDefault();
  setDetailTab(vb, tabs[next].dataset.vbTab, { focus: true });
  return true;
}
