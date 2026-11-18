// KampagneDetailSkripte.js
// Tab Skripte der Produktion (ADR 0074): Die Tabelle der Linie ist der Einstieg,
// ein Klick öffnet den Skript-Editor im selben Tab. ?skript= hält das offene Skript,
// die Skriptwahl sitzt rechts in der Tab-Zeile, die Breadcrumb hängt den Titel an.
// Öffnen und Schließen laufen ohne Neuaufbau der Seite (handleRouteInPlace).

import { SkriptEditorView } from '../skripte/SkriptEditorView.js';
import { skripteService } from '../skripte/SkripteService.js';
import { skriptFlowUrl } from '../skripte/skriptFlowZiel.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { skriptStatusOptions } from '../skripte/skriptStatusOptions.js';
import { konzeptCreatorFromSkript } from '../skripte/editor/SkriptEditorDocRenderer.js';
import { renderCreatorNameCell } from '../creator/CreatorTable.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { pathOf, replaceRoute } from '../../core/breadcrumbTrail.js';
import { bindListenSwitch, clearListenSwitch, effectiveLinie, placeListenSwitch } from './linienScope.js';
import { renderSkriptWahl, skriptTitel, SKRIPT_WAHL_ATTR } from './skriptWahlSwitch.js';
import {
  activateWorkflowTab, bumpPaneGen, getVisibleWorkflowTabs, getWorkflowData,
  isPaneGenCurrent, loadWorkflowPane, paneGeneration, reloadWorkflowPane
} from './KampagneDetailWorkflow.js';

export const SKRIPTE_TAB = 'skripte';

const SPINNER = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';
const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

/** ?skript= aus der URL (Startzustand beim Öffnen der Produktion). */
export function skriptParam(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  return new URLSearchParams(search).get('skript') || null;
}

export function skriptOffen(detail) {
  return detail?.activeWorkflowTab === SKRIPTE_TAB && Boolean(detail.skriptOffenId);
}

/** Adresse des Skripte-Tabs dieser Produktion; ohne skriptId die Tabelle. */
export function skripteTabUrl(detail, skriptId = null) {
  return skriptFlowUrl({
    produktionId: detail.produktionId,
    linieId: effectiveLinie(detail, SKRIPTE_TAB),
    skriptId
  });
}

function syncSkriptParam(skriptId) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (skriptId) url.searchParams.set('skript', skriptId);
  else url.searchParams.delete('skript');
  replaceRoute(`${url.pathname}${url.search}${url.hash}`);
}

function markiereSkriptOffen(offen) {
  const body = document.querySelector('.kampagne-detail-body[data-workflow]');
  if (!body) return;
  if (offen) body.dataset.skriptOffen = '';
  else delete body.dataset.skriptOffen;
}

/* ------------------------------------------------------------------ */
/* Tabelle                                                             */
/* ------------------------------------------------------------------ */

export async function renderSkripteTabelle(detail) {
  const skripte = await getWorkflowData(detail, SKRIPTE_TAB, () =>
    skripteService.loadSkripte({
      kampagneId: detail.kampagneId,
      produktionId: detail.produktionId || null,
      briefingId: effectiveLinie(detail, SKRIPTE_TAB)
    })
  );

  if (!skripte.length) {
    return renderEmptyState({
      icon: 'skripte',
      title: 'Keine Skripte vorhanden',
      text: `Für ${effectiveLinie(detail, SKRIPTE_TAB) ? 'diese Linie' : 'diese Produktion'} wurden noch keine Skripte erstellt.`
    });
  }

  // Status inline editierbar (intern + canEdit), sonst Badge.
  const canEditStatus = !detail.isKunde && (window.canEdit?.('skripte') ?? false);

  const rows = skripte.map(s => {
    const titel = (s.titel || s.hook || 'Ohne Titel').toString().slice(0, 80);
    const statusLabel = STATUS_LABELS[s.status] || s.status || '–';
    const statusVariant = STATUS_TAG_VARIANT[s.status] || 'tag--type';
    const statusTd = canEditStatus
      ? renderTableSelect({ field: 'skript_status', itemId: s.id, value: s.status || '', options: skriptStatusOptions(s.status) })
      : `<span class="tag tag--status ${statusVariant}">${esc(statusLabel)}</span>`;
    return `
      <tr>
        <td>${s.skript_nr || '–'}</td>
        <td class="col-name">
          <a href="${esc(skripteTabUrl(detail, s.id))}" class="table-link" data-table="skripte" data-id="${s.id}">
            ${esc(titel)}
          </a>
        </td>
        ${renderCreatorNameCell(konzeptCreatorFromSkript(s))}
        <td>${statusTd}</td>
        <td>${formatDate(s.created_at)}</td>
        <td class="col-actions">${actionBuilder.create('skripte', s.id)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Titel</th>
            <th>Creator</th>
            <th>Status</th>
            <th>Erstellt am</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Editor im Tab                                                       */
/* ------------------------------------------------------------------ */

function einbettungFuer(detail) {
  return {
    zeigeSkript(skript) {
      detail._updateBreadcrumb({ produktionUrl: skripteTabUrl(detail) });
      window.breadcrumbSystem?.showEditLeaf(skript ? skriptTitel(skript) : 'Skript');
    },
    skriptGewechselt(skriptId) {
      detail.skriptOffenId = skriptId;
      syncSkriptParam(skriptId);
    },
    zeigeListe(items, { aktivId, verknuepfungenFuer }) {
      const { slot } = placeListenSwitch(renderSkriptWahl({ items, aktivId, verknuepfungenFuer }), 'kampagne-skript-wahl');
      if (!slot) return;
      bindListenSwitch(slot, SKRIPT_WAHL_ATTR, (skriptId) => {
        if (!skriptId) {
          window.navigateTo?.(skripteTabUrl(detail));
          return;
        }
        void detail.skriptEditor?.switchSkript(skriptId);
      });
    }
  };
}

async function mountEditor(detail, pane, gen) {
  const view = new SkriptEditorView(detail, { einbettung: einbettungFuer(detail) });
  detail.skriptEditor = view;
  markiereSkriptOffen(true);
  syncSkriptParam(detail.skriptOffenId);
  pane.innerHTML = '<div class="skripte-editor-host"></div>';
  await view.render(pane.firstElementChild, detail.skriptOffenId);
  if (!isPaneGenCurrent(detail, SKRIPTE_TAB, gen) || !pane.isConnected) {
    if (detail.skriptEditor === view) detail.skriptEditor = null;
    void view.cleanup();
  }
}

/** Pane füllen: offenes Skript im Editor, sonst die Tabelle der Linie. */
export async function mountSkriptePane(detail) {
  const pane = document.getElementById(`workflow-pane-${SKRIPTE_TAB}`);
  if (!pane) return;
  const gen = paneGeneration(detail, SKRIPTE_TAB);
  try {
    if (detail.skriptOffenId) {
      await mountEditor(detail, pane, gen);
      return;
    }
    pane.innerHTML = SPINNER;
    const html = await renderSkripteTabelle(detail);
    if (!isPaneGenCurrent(detail, SKRIPTE_TAB, gen) || !pane.isConnected) return;
    pane.innerHTML = html;
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Skripte-Pane fehlgeschlagen:', error);
    if (!pane.isConnected) return;
    pane.innerHTML = renderEmptyState({
      icon: 'info',
      title: 'Fehler beim Laden',
      text: 'Die Skripte konnten nicht geladen werden.'
    });
  }
}

/**
 * Editor abbauen (Tab verlassen, Neurendern, Destroy). Das offene Skript bleibt
 * gemerkt (skriptOffenId), damit der Tab es beim nächsten Besuch wieder öffnet.
 */
export function unmountSkriptePane(detail) {
  bumpPaneGen(detail, SKRIPTE_TAB);
  const view = detail.skriptEditor;
  detail.skriptEditor = null;
  markiereSkriptOffen(false);
  if (!view) return Promise.resolve();
  clearListenSwitch();
  // Status und Titel können sich im Editor geändert haben
  if (detail._workflowData) delete detail._workflowData[SKRIPTE_TAB];
  if (detail._isMounted) detail._updateBreadcrumb?.();
  return view.cleanup().catch((error) => console.warn('⚠️ Skript-Editor-Abbau:', error?.message || error));
}

/** Skripte-Tab verlassen: Editor weg, ?skript= aus der URL. */
export function suspendSkriptePane(detail) {
  unmountSkriptePane(detail);
  if (detail.skriptOffenId) syncSkriptParam(null);
}

async function remountSkriptePane(detail) {
  if (detail.skriptEditor && detail.skriptEditor.skript?.id === detail.skriptOffenId) return;
  // Der alte Editor räumt fertig ab, bevor der neue dieselben Element-IDs belegt
  await unmountSkriptePane(detail);
  if (detail._workflowLoaded) detail._workflowLoaded[SKRIPTE_TAB] = false;
  await loadWorkflowPane(detail, SKRIPTE_TAB);
}

/** Linie gewechselt: Editor schließt, die Tabelle der neuen Linie folgt. */
export function vergissOffenesSkript(detail) {
  if (!detail.skriptOffenId) return;
  detail.skriptOffenId = null;
  syncSkriptParam(null);
}

/** Klick auf den schon aktiven Skripte-Tab: zurück zur Tabelle. */
export function zeigeSkripteTabelle(detail) {
  window.navigateTo?.(skripteTabUrl(detail));
}

/**
 * Navigation auf den Skripte-Tab derselben Produktion und Linie ohne Neuaufbau.
 * push: Klick (neuer History-Eintrag); sonst Zurück/Vor, die URL ist schon das Ziel.
 * @returns {boolean} true = erledigt, der Router macht nichts mehr
 */
export function routeImSkripteTab(detail, route, { push = false } = {}) {
  if (detail.mode !== 'workflow' || !detail._isMounted || !detail.produktionId) return false;
  if (window.guestShare) return false;
  let url;
  try {
    url = new URL(route, window.location.origin);
  } catch {
    return false;
  }
  if (pathOf(url.pathname) !== `/produktion/${detail.produktionId}`) return false;
  if (url.searchParams.get('tab') !== SKRIPTE_TAB) return false;
  const linie = url.searchParams.get('linie');
  if (linie && linie !== detail.linieId) return false;
  if (!getVisibleWorkflowTabs().some(t => t.id === SKRIPTE_TAB)) return false;

  const ziel = `${url.pathname}${url.search}${url.hash}`;
  if (push) window.history.pushState({ ...(window.history.state || {}), route: ziel }, '', ziel);
  detail.skriptOffenId = url.searchParams.get('skript') || null;

  if (detail.activeWorkflowTab !== SKRIPTE_TAB) {
    void activateWorkflowTab(detail, SKRIPTE_TAB, { syncUrl: false });
  } else {
    void remountSkriptePane(detail);
  }
  return true;
}

/** Skript gelöscht (Menü, Editor, anderer Tab): Tabelle auffrischen, offenes Skript schließen. */
export function skriptGeloescht(detail, skriptId) {
  const hatteDaten = Boolean(detail._workflowData?.[SKRIPTE_TAB]);
  if (detail._workflowData) delete detail._workflowData[SKRIPTE_TAB];
  if (detail.skriptOffenId === skriptId) {
    vergissOffenesSkript(detail);
    if (detail.activeWorkflowTab === SKRIPTE_TAB) void remountSkriptePane(detail);
    return;
  }
  // Der offene Editor nimmt das Skript selbst aus seiner Liste
  if (skriptOffen(detail)) return;
  if (hatteDaten) void reloadWorkflowPane(detail, SKRIPTE_TAB);
}
