// KampagneDetailKonzept.js
// Mountet das volle Konzept-Worksheet in den Kampagnen-Workflow-Pane.

import { effectiveLinie, leerHinweis, renderListenSwitch, bindListenSwitch, placeListenSwitch, clearListenSwitch } from './linienScope.js';
import { StrategieDetail } from '../strategie/StrategieDetail.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

const LISTE_ATTR = 'data-konzept-liste';
const SPINNER = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

function getKonzeptTools() {
  return document.getElementById('kampagne-konzept-tools');
}

export function unmountKonzeptWorksheet(detail) {
  bumpPaneGen(detail, 'konzepte');
  if (detail.konzeptWorksheet) {
    detail.konzeptWorksheet.destroy();
    detail.konzeptWorksheet = null;
  }
  const tools = getKonzeptTools();
  if (tools) tools.innerHTML = '';
  clearListenSwitch();
}

function prefetchStillCurrent(detail, gen) {
  return (detail._prefetchGen || 0) === gen && detail._isMounted !== false;
}

function konzeptStillCurrent(detail, gen, pane) {
  return isPaneGenCurrent(detail, 'konzepte', gen) && pane.isConnected;
}

function dropWorksheet(worksheet, detail) {
  if (worksheet && worksheet !== detail.konzeptWorksheet) worksheet.destroy();
}

/**
 * Konzept-Liste und, wenn eins da ist, Strategie plus Items plus Spalten.
 * Fehler wirft der Aufrufer weg. Eine veraltete Generation räumt ab.
 */
export async function loadKonzeptPrefetch(detail, gen) {
  const listen = await loadKonzepte(detail);
  if (!prefetchStillCurrent(detail, gen)) return null;
  if (!listen.length) return { listen, selectedId: null, worksheet: null };

  const selectedId = listen.some(l => l.id === detail._konzeptSelectedId)
    ? detail._konzeptSelectedId
    : listen[0].id;
  const worksheet = new StrategieDetail();
  try {
    await worksheet.prepareEmbedded(selectedId);
  } catch (error) {
    worksheet.destroy();
    throw error;
  }
  if (!prefetchStillCurrent(detail, gen)) {
    worksheet.destroy();
    return null;
  }
  return { listen, selectedId, worksheet };
}

async function takeKonzeptPrefetch(detail) {
  const tracked = detail._konzeptPrefetch;
  if (!tracked) return null;
  tracked.consumed = true;
  detail._konzeptPrefetch = null;
  return tracked.promise;
}

export async function mountKonzeptPane(detail) {
  const pane = document.getElementById('workflow-pane-konzepte');
  if (!pane) return;
  const gen = paneGeneration(detail, 'konzepte');

  const tracked = detail._konzeptPrefetch;
  const warm = !!(tracked?.settled && tracked.value);
  if (!warm) pane.innerHTML = SPINNER;

  let prefetched = null;
  if (tracked) {
    prefetched = await takeKonzeptPrefetch(detail);
    if (!konzeptStillCurrent(detail, gen, pane)) {
      dropWorksheet(prefetched?.worksheet, detail);
      return;
    }
  }

  try {
    const listen = prefetched?.listen || await loadKonzepte(detail);
    if (!konzeptStillCurrent(detail, gen, pane)) {
      dropWorksheet(prefetched?.worksheet, detail);
      return;
    }
    detail.strategien = listen;

    if (!listen.length) {
      dropWorksheet(prefetched?.worksheet, detail);
      clearListenSwitch();
      pane.innerHTML = renderEmptyKonzept(detail);
      return;
    }

    const selectedId = listen.some(l => l.id === detail._konzeptSelectedId)
      ? detail._konzeptSelectedId
      : listen[0].id;
    detail._konzeptSelectedId = selectedId;

    const warmWorksheet = prefetched?.worksheet && prefetched.selectedId === selectedId
      ? prefetched.worksheet
      : null;
    if (prefetched?.worksheet && !warmWorksheet) prefetched.worksheet.destroy();

    const shell = renderKonzeptShell(listen, selectedId);
    pane.innerHTML = shell.html;
    bindSwitcher(detail, pane, shell.slot);
    await mountWorksheet(detail, pane.querySelector('.kampagne-konzept-worksheet'), selectedId, warmWorksheet);
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Konzept-Pane fehlgeschlagen:', error);
    if (pane.isConnected) {
      clearListenSwitch();
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Das Konzept konnte nicht geladen werden.'
      });
    }
  }
}

async function loadKonzepte(detail) {
  let query = window.supabase
    .from('strategie')
    .select('id, name')
    .eq('kampagne_id', detail.kampagneId)
    .order('created_at', { ascending: true });
  if (detail.produktionId) query = query.eq('produktion_id', detail.produktionId);
  const briefingId = effectiveLinie(detail, 'konzepte');
  if (briefingId) query = query.eq('briefing_id', briefingId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

function renderEmptyKonzept(detail) {
  return renderEmptyState({
    icon: 'clipboard',
    title: 'Kein Konzept',
    text: leerHinweis(detail, 'konzepte', 'Für diese Linie wurde noch kein Konzept angelegt.')
  });
}

/** Dropdown in die Tab-Zeile (ganz rechts); ohne Slot als Zeile im Pane. */
function renderKonzeptShell(listen, selectedId) {
  const html = listen.length > 1
    ? renderListenSwitch({ items: listen, activeId: selectedId, itemAttr: LISTE_ATTR, title: 'Konzept wechseln' })
    : '';
  const { slot, inline } = placeListenSwitch(html, 'kampagne-konzept-listen-switcher');

  return {
    slot,
    html: `
    ${inline}
    <div class="kampagne-konzept-worksheet"></div>
  `
  };
}

function bindSwitcher(detail, pane, slot) {
  bindListenSwitch(slot || pane, LISTE_ATTR, async (strategieId) => {
    detail._konzeptSelectedId = strategieId;
    const root = pane.querySelector('.kampagne-konzept-worksheet');
    if (!root) return;
    if (detail.konzeptWorksheet) {
      detail.konzeptWorksheet.destroy();
      detail.konzeptWorksheet = null;
    }
    await mountWorksheet(detail, root, strategieId);
  });
}

async function mountWorksheet(detail, root, strategieId, existing) {
  if (!root) return;
  const gen = paneGeneration(detail, 'konzepte');
  const worksheet = existing || new StrategieDetail();
  detail.konzeptWorksheet = worksheet;
  try {
    await worksheet.init(strategieId, {
      root,
      chromeRoot: getKonzeptTools(),
      embedded: true
    });
  } catch (error) {
    worksheet.destroy();
    if (detail.konzeptWorksheet === worksheet) detail.konzeptWorksheet = null;
    throw error;
  }
  if (!isPaneGenCurrent(detail, 'konzepte', gen) || !root.isConnected) {
    worksheet.destroy();
    if (detail.konzeptWorksheet === worksheet) detail.konzeptWorksheet = null;
  }
}
