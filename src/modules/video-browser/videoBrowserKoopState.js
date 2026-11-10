// videoBrowserKoopState.js
// Gruppierung und Klappzustand der Spalte 0 (Alle Linien): Merker je Produktion im localStorage,
// Gruppierung zusätzlich in der URL (?koopgruppe=), Klappen direkt am DOM mit Animation.
// Ein Gruppenkopf ändert nie die Auswahl. Die gewählte Kooperation steht nach dem Öffnen, einem
// Deep Link oder einem Wechsel der Gruppierung nie in einer eingeklappten Gruppe.

import { icon } from '../../core/icons/IconSystem.js';
import { DEFAULT_KOOP_GROUP, cssEscape, groupOfKoop, isKoopGroup, koopEntries, koopGroupFromSearch } from './videoBrowserLogic.js';

const STORAGE_PREFIX = 'crm.videoKoop.';
/** Mehr Gruppen gleichzeitig zu animieren ruckelt nur; der Rest klappt sofort. */
const MAX_ANIMIERT = 20;

function readStored(produktionId) {
  if (!produktionId) return null;
  try {
    return JSON.parse(window.localStorage?.getItem(`${STORAGE_PREFIX}${produktionId}`) || 'null');
  } catch {
    return null;
  }
}

function save(vb) {
  const produktionId = vb.detail?.produktionId;
  if (!produktionId) return;
  try {
    window.localStorage?.setItem(`${STORAGE_PREFIX}${produktionId}`, JSON.stringify({
      gruppe: vb.koopGroup,
      zu: [...vb.collapsed]
    }));
  } catch {
    // Merker ist nur Komfort
  }
}

/** Startzustand: URL vor Merker vor Standard. Kunden gruppieren immer nach Creator. */
export function initKoopState(vb, search = window.location.search) {
  const stored = readStored(vb.detail?.produktionId);
  const fromUrl = koopGroupFromSearch(search);
  const fromStore = isKoopGroup(stored?.gruppe) ? stored.gruppe : null;
  vb.koopGroup = vb.team ? (fromUrl || fromStore || DEFAULT_KOOP_GROUP) : DEFAULT_KOOP_GROUP;
  vb.collapsed = new Set(Array.isArray(stored?.zu) ? stored.zu.filter(id => typeof id === 'string') : []);
}

/** Gruppierung, die in der URL steht: nur für das Team und nur, wenn es Gruppenköpfe gibt. */
export function koopGroupParam(vb, zeigeLinie) {
  return vb.team && zeigeLinie ? vb.koopGroup : null;
}

/**
 * Klappt die Gruppe der Kooperation auf (nur Zustand, vor dem Rendern).
 * @returns {boolean} true, wenn sich etwas geändert hat
 */
export function revealKoop(vb, koopId) {
  if (!koopId || !vb.collapsed?.size) return false;
  const id = groupOfKoop(koopEntries(vb._ctx()), koopId);
  if (!id || !vb.collapsed.has(id)) return false;
  vb.collapsed.delete(id);
  save(vb);
  return true;
}

/** Die gewählte Kooperationszeile in den sichtbaren Bereich der Spalte holen. */
export function scrollSelectedKoop(vb) {
  const id = vb.sel?.kooperationId;
  if (!id) return;
  const row = vb.colsEl?.querySelector(`.vb-col--0 .vb-row[data-id="${cssEscape(String(id))}"]`);
  row?.scrollIntoView?.({ block: 'nearest' });
}

function applyGroupDom(vb, wrap, open, { animate = true, stagger = true } = {}) {
  if (!wrap) return;
  const id = wrap.dataset.vbKoopgroupWrap;
  const head = wrap.querySelector('[data-vb-koopgroup]');
  const body = wrap.querySelector('[data-vb-koopgroup-body]');
  head?.setAttribute('aria-expanded', String(open));
  wrap.classList.toggle('is-collapsed', !open);
  if (!body) return;
  if (open) {
    body.hidden = false;
    if (animate) vb.motion?.koopGroupOpen(body, { stagger });
    return;
  }
  const hide = () => { if (vb.collapsed.has(id)) body.hidden = true; };
  if (animate && vb.motion) vb.motion.koopGroupClose(body, hide);
  else hide();
}

/** Knopf "Alle ein-/aufklappen" an den Zustand angleichen, ohne die Spalte neu zu bauen. */
function syncAllToggle(vb) {
  const btn = vb.colsEl?.querySelector('[data-vb-koopgroup-all]');
  if (!btn) return;
  const ids = [...vb.colsEl.querySelectorAll('[data-vb-koopgroup-wrap]')].map(w => w.dataset.vbKoopgroupWrap);
  const alleZu = ids.length > 0 && ids.every(id => vb.collapsed.has(id));
  const label = alleZu ? 'Alle aufklappen' : 'Alle einklappen';
  btn.dataset.vbKoopgroupAll = alleZu ? 'open' : 'close';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.innerHTML = icon(alleZu ? 'arrows-expand' : 'arrows-collapse');
}

/** Ein Gruppenkopf klappt auf oder zu. Die Auswahl bleibt, wie sie ist. */
export function toggleKoopGroup(vb, id, open) {
  if (!id) return;
  const willOpen = open ?? vb.collapsed.has(id);
  if (willOpen) vb.collapsed.delete(id);
  else vb.collapsed.add(id);
  save(vb);
  applyGroupDom(vb, vb.colsEl?.querySelector(`[data-vb-koopgroup-wrap="${cssEscape(id)}"]`), willOpen);
  syncAllToggle(vb);
}

/** Alle Gruppen auf oder zu, gestaffelt; ab MAX_ANIMIERT ohne Animation. */
export function setAllKoopGroups(vb, open) {
  const wraps = [...(vb.colsEl?.querySelectorAll('[data-vb-koopgroup-wrap]') || [])];
  wraps.forEach((wrap, i) => {
    const id = wrap.dataset.vbKoopgroupWrap;
    if (open === !vb.collapsed.has(id)) return;
    if (open) vb.collapsed.delete(id);
    else vb.collapsed.add(id);
    applyGroupDom(vb, wrap, open, { animate: i < MAX_ANIMIERT, stagger: false });
  });
  save(vb);
  syncAllToggle(vb);
}

/** Gruppierung wechseln: Spalte 0 neu, die Auswahl bleibt, ihre Gruppe ist offen und sichtbar. */
export function setKoopGroup(vb, mode) {
  if (!vb.team || !isKoopGroup(mode) || mode === vb.koopGroup) return;
  vb.koopGroup = mode;
  revealKoop(vb, vb.sel?.kooperationId);
  save(vb);
  vb._syncUrl();
  vb._renderNav();
  vb.colsEl?.querySelector(`[data-vb-seg="koopgruppe"] [data-value="${cssEscape(mode)}"]`)?.focus({ preventScroll: true });
  scrollSelectedKoop(vb);
}

/** Klick-Routing der Spalte 0. @returns {boolean} true, wenn der Klick hierher gehörte */
export function onKoopGroupClick(vb, e) {
  const opt = e.target.closest('[data-vb-seg="koopgruppe"] [data-vb-seg-opt]');
  if (opt) {
    setKoopGroup(vb, opt.dataset.value);
    return true;
  }
  const head = e.target.closest('[data-vb-koopgroup]');
  if (head) {
    toggleKoopGroup(vb, head.dataset.vbKoopgroup);
    return true;
  }
  const all = e.target.closest('[data-vb-koopgroup-all]');
  if (all) {
    setAllKoopGroups(vb, all.dataset.vbKoopgroupAll === 'open');
    return true;
  }
  return false;
}
