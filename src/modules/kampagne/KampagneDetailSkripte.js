// KampagneDetailSkripte.js
// Tab Skripte der Produktion (ADR 0074, 0079): Die Tabelle der Linie ist der Einstieg,
// ein Klick öffnet den Skript-Editor im selben Tab. ?skript= hält das offene Skript
// (produktionTabDetail), die Skriptwahl sitzt rechts in der Tab-Zeile, die Breadcrumb
// hängt den Titel an. Öffnen und Schließen laufen über produktionFlowRoute.

import { SkriptEditorView } from '../skripte/SkriptEditorView.js';
import { skripteService } from '../skripte/SkripteService.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { skriptStatusOptions } from '../skripte/skriptStatusOptions.js';
import { skriptCreatorZelleHtml } from '../skripte/editor/skriptDocCreatorHtml.js';
import { renderCreatorPillName } from '../creator/CreatorTable.js';
import { renderVerknuepfungPill } from '../../core/ui/verknuepfungPill.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { bindListenSwitch, clearListenSwitch, effectiveLinie, placeListenSwitch } from './linienScope.js';
import { renderSkriptWahl, skriptTitel, SKRIPT_WAHL_ATTR } from './skriptWahlSwitch.js';
import {
  bumpPaneGen, getWorkflowData, isPaneGenCurrent, paneGeneration, reloadWorkflowPane
} from './KampagneDetailWorkflow.js';
import { detailOffen, markiereAnsicht, offeneId, setzeOffen, tabUrl } from './produktionTabDetail.js';
import { zeigeImTab, zeigeTabListe } from './produktionFlowRoute.js';

export const SKRIPTE_TAB = 'skripte';

const SPINNER = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';
const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

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
        <td class="col-nr">${s.skript_nr || '–'}</td>
        <td class="col-titel">${renderVerknuepfungPill({
          kind: 'skript',
          label: titel,
          href: tabUrl(detail, SKRIPTE_TAB, s.id),
          attrs: `data-table="skripte" data-id="${s.id}"`
        })}</td>
        ${skriptCreatorZelleHtml(s, renderCreatorPillName, 'col-creator')}
        <td class="col-status">${statusTd}</td>
        <td class="col-erstellt-am">${formatDate(s.created_at)}</td>
        <td class="col-actions">${actionBuilder.create('skripte', s.id)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--skripte">
        <thead>
          <tr>
            <th class="col-nr">Nr.</th>
            <th class="col-titel">Titel</th>
            <th class="col-creator">Creator</th>
            <th class="col-status">Status</th>
            <th class="col-erstellt-am">Erstellt am</th>
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
      detail._updateBreadcrumb({ produktionUrl: tabUrl(detail, SKRIPTE_TAB) });
      window.breadcrumbSystem?.showEditLeaf(skript ? skriptTitel(skript) : 'Skript');
    },
    skriptGewechselt(skriptId) {
      setzeOffen(detail, SKRIPTE_TAB, skriptId);
    },
    zeigeListe(items, { aktivId, verknuepfungenFuer }) {
      const { slot } = placeListenSwitch(renderSkriptWahl({ items, aktivId, verknuepfungenFuer }), 'kampagne-skript-wahl');
      if (!slot) return;
      bindListenSwitch(slot, SKRIPT_WAHL_ATTR, (skriptId) => {
        if (!skriptId) {
          zeigeTabListe(detail, SKRIPTE_TAB);
          return;
        }
        void detail.skriptEditor?.switchSkript(skriptId);
      });
    }
  };
}

async function mountEditor(detail, pane, gen) {
  const skriptId = offeneId(detail, SKRIPTE_TAB);
  const view = new SkriptEditorView(detail, { einbettung: einbettungFuer(detail) });
  detail.skriptEditor = view;
  markiereAnsicht(SKRIPTE_TAB, true);
  setzeOffen(detail, SKRIPTE_TAB, skriptId);
  pane.innerHTML = '<div class="skripte-editor-host"></div>';
  await view.render(pane.firstElementChild, skriptId);
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
    if (offeneId(detail, SKRIPTE_TAB)) {
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
 * gemerkt (detail.offen), damit der Tab es beim nächsten Besuch wieder öffnet.
 */
export function unmountSkriptePane(detail) {
  bumpPaneGen(detail, SKRIPTE_TAB);
  const view = detail.skriptEditor;
  detail.skriptEditor = null;
  markiereAnsicht(SKRIPTE_TAB, false);
  if (!view) return Promise.resolve();
  clearListenSwitch();
  // Status und Titel können sich im Editor geändert haben
  if (detail._workflowData) delete detail._workflowData[SKRIPTE_TAB];
  if (detail._isMounted) detail._updateBreadcrumb?.();
  return view.cleanup().catch((error) => console.warn('⚠️ Skript-Editor-Abbau:', error?.message || error));
}

/** Skript gelöscht (Menü, Editor, anderer Tab): Tabelle auffrischen, offenes Skript schließen. */
export function skriptGeloescht(detail, skriptId) {
  const hatteDaten = Boolean(detail._workflowData?.[SKRIPTE_TAB]);
  if (detail._workflowData) delete detail._workflowData[SKRIPTE_TAB];
  if (offeneId(detail, SKRIPTE_TAB) === skriptId) {
    if (detail.activeWorkflowTab === SKRIPTE_TAB) zeigeImTab(detail, SKRIPTE_TAB, null);
    else setzeOffen(detail, SKRIPTE_TAB, null);
    return;
  }
  // Der offene Editor nimmt das Skript selbst aus seiner Liste
  if (detailOffen(detail, SKRIPTE_TAB)) return;
  if (hatteDaten) void reloadWorkflowPane(detail, SKRIPTE_TAB);
}
