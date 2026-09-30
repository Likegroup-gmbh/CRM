// KampagneDetailCasting.js
// Mountet das volle Casting-Worksheet in den Kampagnen-Workflow-Pane.

import { CreatorAuswahlDetail } from '../creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';

function getCastingTools() {
  return document.getElementById('kampagne-casting-tools');
}

export function unmountCastingWorksheet(detail) {
  bumpPaneGen(detail, 'casting');
  if (detail.castingWorksheet) {
    detail.castingWorksheet.destroy();
    detail.castingWorksheet = null;
  }
  const tools = getCastingTools();
  if (tools) tools.innerHTML = '';
}

const SPINNER = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

function castingStillCurrent(detail, gen, pane) {
  return isPaneGenCurrent(detail, 'casting', gen) && pane.isConnected;
}

function prefetchStillCurrent(detail, gen) {
  return (detail._prefetchGen || 0) === gen && detail._isMounted !== false;
}

async function loadCastingListen(detail) {
  return creatorAuswahlService.getListenByKampagneId(detail.kampagneId, {
    produktionId: detail.produktionId || null
  });
}

/**
 * Listen-Index und, wenn eine Liste da ist, die Worksheet-Daten. Fehler
 * wirft der Aufrufer (trackPrefetch) weg. Eine veraltete Generation räumt
 * das Worksheet ab und liefert null.
 */
export async function loadCastingPrefetch(detail, gen) {
  const listen = await loadCastingListen(detail);
  if (!prefetchStillCurrent(detail, gen)) return null;
  if (!listen.length) return { listen, selectedId: null, worksheet: null };

  const selectedId = listen.some(l => l.id === detail._castingSelectedListeId)
    ? detail._castingSelectedListeId
    : listen[0].id;
  const worksheet = new CreatorAuswahlDetail();
  try {
    worksheet._prefetchPayload = await worksheet._fetchDataStages(selectedId);
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

async function takeCastingPrefetch(detail) {
  const tracked = detail._castingPrefetch;
  if (!tracked) return null;
  tracked.consumed = true;
  detail._castingPrefetch = null;
  return tracked.promise;
}

function dropWorksheet(worksheet, detail) {
  if (worksheet && worksheet !== detail.castingWorksheet) worksheet.destroy();
}

export async function mountCastingPane(detail) {
  const pane = document.getElementById('workflow-pane-casting');
  if (!pane) return;
  const gen = paneGeneration(detail, 'casting');

  const tracked = detail._castingPrefetch;
  const warm = !!(tracked?.settled && tracked.value);
  if (!warm) pane.innerHTML = SPINNER;

  let prefetched = null;
  if (tracked) {
    prefetched = await takeCastingPrefetch(detail);
    if (!castingStillCurrent(detail, gen, pane)) {
      dropWorksheet(prefetched?.worksheet, detail);
      return;
    }
  }

  try {
    const listen = prefetched?.listen || await loadCastingListen(detail);
    if (!castingStillCurrent(detail, gen, pane)) {
      dropWorksheet(prefetched?.worksheet, detail);
      return;
    }
    detail._castingListen = listen;
    detail.sourcingListenCount = listen.length;

    if (!listen.length) {
      dropWorksheet(prefetched?.worksheet, detail);
      pane.innerHTML = renderEmptyCasting();
      return;
    }

    const selectedId = listen.some(l => l.id === detail._castingSelectedListeId)
      ? detail._castingSelectedListeId
      : listen[0].id;
    detail._castingSelectedListeId = selectedId;

    const warmWorksheet = prefetched?.worksheet && prefetched.selectedId === selectedId
      ? prefetched.worksheet
      : null;
    if (prefetched?.worksheet && !warmWorksheet) prefetched.worksheet.destroy();

    pane.innerHTML = renderCastingShell(listen, selectedId);
    bindSwitcher(detail, pane);
    await mountWorksheet(detail, pane.querySelector('.kampagne-casting-worksheet'), selectedId, warmWorksheet);
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Casting-Pane fehlgeschlagen:', error);
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Die Casting-Liste konnte nicht geladen werden.'
      });
    }
  }
}

function renderEmptyCasting() {
  return renderEmptyState({
    icon: 'users',
    title: 'Keine Casting-Liste',
    text: 'Für diese Kampagne wurde noch keine Casting-Liste angelegt.'
  });
}

function renderCastingShell(listen, selectedId) {
  const switcher = listen.length > 1
    ? `<div class="kampagne-casting-listen-switcher">
        <label class="kampagne-casting-listen-switcher__label" for="kampagne-casting-liste">Liste</label>
        <select id="kampagne-casting-liste" class="form-input">
          ${listen.map(l => `
            <option value="${esc(l.id)}"${l.id === selectedId ? ' selected' : ''}>${esc(l.name || 'Unbenannt')}</option>
          `).join('')}
        </select>
      </div>`
    : '';

  return `
    ${switcher}
    <div class="kampagne-casting-worksheet"></div>
  `;
}

function bindSwitcher(detail, pane) {
  const select = pane.querySelector('#kampagne-casting-liste');
  if (!select) return;
  select.addEventListener('change', async () => {
    detail._castingSelectedListeId = select.value;
    const root = pane.querySelector('.kampagne-casting-worksheet');
    if (!root) return;
    if (detail.castingWorksheet) {
      detail.castingWorksheet.destroy();
      detail.castingWorksheet = null;
    }
    await mountWorksheet(detail, root, select.value);
  });
}

async function mountWorksheet(detail, root, listeId, existing) {
  if (!root) return;
  const gen = paneGeneration(detail, 'casting');
  const worksheet = existing || new CreatorAuswahlDetail();
  detail.castingWorksheet = worksheet;
  try {
    await worksheet.init(listeId, {
      root,
      chromeRoot: getCastingTools(),
      embedded: true,
      prefetched: existing?._prefetchPayload || null
    });
  } catch (error) {
    worksheet.destroy();
    if (detail.castingWorksheet === worksheet) detail.castingWorksheet = null;
    throw error;
  }
  if (!isPaneGenCurrent(detail, 'casting', gen) || !root.isConnected) {
    worksheet.destroy();
    if (detail.castingWorksheet === worksheet) detail.castingWorksheet = null;
  }
}
