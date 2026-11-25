// produktionFlowFokus.js
// Sprungziel im Tab (?fokus=, ADR 0079): im Tab Kooperationen die Zeile bzw. Karte der
// Kooperation, im Tab Konzepte die Videoidee mit offenem Drawer. Die Tabs rendern asynchron,
// deshalb wartet der Sprung kurz auf sein Element. Danach verlässt fokus die URL, damit
// Reload, Zurück und Vor nicht noch einmal springen.

import { replaceRoute } from '../../core/breadcrumbTrail.js';
import { FOKUS_PARAM } from './produktionFlowZiele.js';

const WARTEN_MS = 6000;
const TAKT_MS = 80;
const MARKE = 'is-flow-fokus';
const MARKE_MS = 2400;

const attr = (id) => String(id).replace(/["\\]/g, '\\$&');
const gleicheId = (id) => (row) => String(row?.id) === String(id);

const ZIELE = {
  kooperationen: {
    element: (detail, id) => document.querySelector(detail.currentView === 'kanban'
      ? `.kooperation-card[data-koop-id="${attr(id)}"]`
      : `tr.kooperation-row[data-kooperation-id="${attr(id)}"]`),
    // Abgeschlossene Kooperationen stehen nur unter "Alle"
    nachhelfen(detail, id) {
      const ansicht = detail.currentView === 'kanban' ? detail.kanbanBoard : detail.kooperationenVideoTable;
      if (!ansicht?.activeFilterTab || ansicht.activeFilterTab === 'alle') return false;
      if (!(detail.store?.kooperationen || []).some(gleicheId(id))) return false;
      detail.switchTab?.('alle');
      return true;
    }
  },
  konzepte: {
    element: (detail, id) => ((detail.konzeptWorksheet?.items || []).some(gleicheId(id))
      ? document.querySelector(`#workflow-pane-konzepte tr.item-row[data-item-id="${attr(id)}"]`)
      : null),
    danach: (detail, id) => detail.konzeptWorksheet.showEditItemDrawer(id)
  }
};

function fokusAusUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(FOKUS_PARAM)) return;
  url.searchParams.delete(FOKUS_PARAM);
  replaceRoute(`${url.pathname}${url.search}${url.hash}`);
}

function markiere(el) {
  el.classList.remove(MARKE);
  void el.offsetWidth;
  el.classList.add(MARKE);
  setTimeout(() => el.classList.remove(MARKE), MARKE_MS);
}

function springe(detail, ziel, el, id) {
  fokusAusUrl();
  const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  el.scrollIntoView?.({ block: 'center', behavior: ruhig ? 'auto' : 'smooth' });
  markiere(el);
  ziel.danach?.(detail, id);
}

/** Ziel im Tab anspringen, sobald es gerendert ist. Ein neuer Sprung, Tabwechsel oder Verlassen bricht ab. */
export function fokussiere(detail, tab, id) {
  const ziel = ZIELE[tab];
  const lauf = (detail._fokusLauf || 0) + 1;
  detail._fokusLauf = lauf;
  if (!ziel || !id) {
    fokusAusUrl();
    return;
  }
  const bis = Date.now() + WARTEN_MS;
  let nachgeholfen = false;
  const versuch = () => {
    if (!detail._isMounted || detail._fokusLauf !== lauf) return;
    if (detail.activeWorkflowTab !== tab) {
      fokusAusUrl();
      return;
    }
    const el = ziel.element(detail, id);
    if (el) {
      springe(detail, ziel, el, id);
      return;
    }
    if (!nachgeholfen) nachgeholfen = Boolean(ziel.nachhelfen?.(detail, id));
    if (Date.now() < bis) setTimeout(versuch, TAKT_MS);
    else fokusAusUrl();
  };
  versuch();
}
