// KampagneDetailKonzept.js
// Mountet das volle Konzept-Worksheet in den Kampagnen-Workflow-Pane.

import { effectiveLinie, leerHinweis, renderListenSwitch, bindListenSwitch, placeListenSwitch, clearListenSwitch } from './linienScope.js';
import { StrategieDetail } from '../strategie/StrategieDetail.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { mountKonzeptEinreichungen } from '../einladung/konzeptEinreichungen.js';
import { istStaff } from '../einladung/EinreichungInbox.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

const LISTE_ATTR = 'data-konzept-liste';
const ANSICHT_KONZEPT = 'konzept';
const ANSICHT_IDEEN = 'ideen';
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
  if (tools) {
    tools.innerHTML = '';
    tools.style.display = '';
  }
  clearListenSwitch();
}

/** Aktive Ansicht: „Creator-Ideen“ gibt es nur für Staff, sonst immer das Konzept. */
function aktuelleAnsicht(detail) {
  return detail._konzeptAnsicht === ANSICHT_IDEEN && istStaff() ? ANSICHT_IDEEN : ANSICHT_KONZEPT;
}

/** Switch „Konzept | Creator-Ideen“ (gleiche Optik wie Liste/Grid-Switch). */
function renderAnsichtSwitch(detail) {
  if (!istStaff()) return '';
  const ideen = aktuelleAnsicht(detail) === ANSICHT_IDEEN;
  return ViewModeToggle.render([
    { buttonId: 'btn-konzept-ansicht-konzept', label: 'Konzept', title: 'Videoideen des Konzepts', active: !ideen },
    {
      buttonId: 'btn-konzept-ansicht-ideen',
      label: 'Creator-Ideen <span class="tab-count" data-ideen-zaehler style="display:none"></span>',
      title: 'Von Creatorn eingereichte Ideen',
      active: ideen
    }
  ]);
}

/** Zeigt je nach Ansicht Worksheet (samt Add-Buttons) oder die Ideen-Tabelle. */
function applyAnsicht(detail, pane) {
  const ideen = aktuelleAnsicht(detail) === ANSICHT_IDEEN;
  const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
  show(pane.querySelector('.kampagne-konzept-worksheet'), !ideen);
  show(pane.querySelector('[data-konzept-ideen]'), ideen);
  show(getKonzeptTools(), !ideen);
  document.querySelectorAll('#btn-konzept-ansicht-konzept, #btn-konzept-ansicht-ideen').forEach((btn) => {
    btn.classList.toggle('active', (btn.id === 'btn-konzept-ansicht-ideen') === ideen);
  });
}

function ladeIdeen(detail, pane) {
  return mountKonzeptEinreichungen(detail, pane.querySelector('[data-konzept-einreichungen]'));
}

function bindAnsichtSwitch(detail, pane, slot) {
  const root = slot || pane;
  root.querySelector('.view-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const ziel = btn.id === 'btn-konzept-ansicht-ideen' ? ANSICHT_IDEEN : ANSICHT_KONZEPT;
    if (ziel === aktuelleAnsicht(detail)) return;
    detail._konzeptAnsicht = ziel;
    applyAnsicht(detail, pane);
    // Ideen frisch laden: es kann seit dem Öffnen des Tabs etwas eingegangen sein.
    if (ziel === ANSICHT_IDEEN) void ladeIdeen(detail, pane);
  });
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
      // Ohne Konzept bleiben die Creator-Ideen trotzdem sichtbar (Prüfen weist auf das fehlende Konzept hin).
      const shell = renderKonzeptShell(detail, [], null, renderEmptyKonzept(detail));
      pane.innerHTML = shell.html;
      bindAnsichtSwitch(detail, pane, shell.slot);
      applyAnsicht(detail, pane);
      void ladeIdeen(detail, pane);
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

    const shell = renderKonzeptShell(detail, listen, selectedId);
    pane.innerHTML = shell.html;
    bindSwitcher(detail, pane, shell.slot);
    bindAnsichtSwitch(detail, pane, shell.slot);
    applyAnsicht(detail, pane);
    void ladeIdeen(detail, pane);
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

/**
 * Ansichts-Switch und Konzept-Dropdown in die Tab-Zeile (ganz rechts); ohne Slot als Zeile im Pane.
 * Darunter das Worksheet und die Tabelle der Creator-Ideen (nur eins davon ist sichtbar).
 */
function renderKonzeptShell(detail, listen, selectedId, worksheetHtml = '') {
  const dropdown = listen.length > 1
    ? renderListenSwitch({ items: listen, activeId: selectedId, itemAttr: LISTE_ATTR, title: 'Konzept wechseln' })
    : '';
  const { slot, inline } = placeListenSwitch(`${renderAnsichtSwitch(detail)}${dropdown}`, 'kampagne-konzept-listen-switcher');

  return {
    slot,
    html: `
    ${inline}
    <div class="kampagne-konzept-worksheet">${worksheetHtml}</div>
    <div class="konzept-ideen" data-konzept-ideen>
      <div class="einreichung-inbox einreichung-inbox--tabelle" data-konzept-einreichungen></div>
    </div>
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
