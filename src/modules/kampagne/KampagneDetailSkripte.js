// KampagneDetailSkripte.js
// Skripte-Tab der Produktion: Tabelle der Skripte der aktiven Linie. Ein Klick
// öffnet das Skript im Editor direkt im Tab (wie das Briefing), die URL trägt
// ?tab=skripte&skript=<id>. „Alle Skripte“ und Löschen führen zurück zur Tabelle.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { renderVerknuepfungPill } from '../../core/ui/verknuepfungPill.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { skripteService } from '../skripte/SkripteService.js';
import { SkriptEditorView } from '../skripte/SkriptEditorView.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { konzeptCreatorFromSkript } from '../skripte/editor/SkriptEditorDocRenderer.js';
import { effectiveLinie } from './linienScope.js';
import { campaignPrefill } from './KampagneWorkflowCreate.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

const TAB_ID = 'skripte';
const URL_PARAM = 'skript';

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
const SPINNER = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

const getPane = () => document.getElementById(`workflow-pane-${TAB_ID}`);

function setUrlSkript(skriptId) {
  if (!window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (skriptId) url.searchParams.set(URL_PARAM, skriptId);
  else url.searchParams.delete(URL_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function skriptIdAusUrl() {
  return new URLSearchParams(window.location.search).get(URL_PARAM);
}

// Jeder Wechsel Tabelle <-> Editor zählt hoch; ein überholter Aufruf räumt nichts mehr an.
function neuerLauf(detail) {
  detail._skripteLauf = (detail._skripteLauf || 0) + 1;
  return detail._skripteLauf;
}

const istAktuell = (detail, lauf, gen) =>
  detail._skripteLauf === lauf && isPaneGenCurrent(detail, TAB_ID, gen);

/** Liegt im Tab gerade der Editor statt der Tabelle? */
export function skriptEditorOffen(detail) {
  return Boolean(detail?._skriptEditor);
}

export function offenesSkriptId(detail) {
  return detail?._skriptOffenId || null;
}

async function zerstoereEditor(detail) {
  const editor = detail._skriptEditor;
  detail._skriptEditor = null;
  detail._skriptOffenId = null;
  if (editor) await editor.cleanup();
}

/** Tab verlassen oder neu aufbauen. `url`: ?skript= entfernen (nur wenn ein Skript offen war). */
export function unmountSkriptePane(detail, { url = false } = {}) {
  bumpPaneGen(detail, TAB_ID);
  const warOffen = skriptEditorOffen(detail);
  void zerstoereEditor(detail);
  if (url && warOffen) setUrlSkript(null);
}

/* ------------------------------------------------------------------ */
/* Tabelle                                                             */
/* ------------------------------------------------------------------ */

// Creator: Foto links, daneben die Verknüpfungs-Pill (für Kunden nur der Name).
function skriptCreatorHtml(detail, skript) {
  const creator = konzeptCreatorFromSkript(skript);
  if (!creator?.name) return '-';
  const nameHtml = detail.isKunde || !creator.id
    ? esc(creator.name)
    : renderVerknuepfungPill({
        kind: 'creator',
        labelHtml: esc(creator.name),
        attrs: `data-table="creator" data-id="${creator.id}"`
      });
  return renderTableIdentity({
    url: creator.profilbild_thumb_url || creator.profilbild_url,
    name: creator.vorname || creator.name,
    nameHtml
  });
}

async function ladeSkripte(detail) {
  detail._workflowData = detail._workflowData || {};
  if (detail._workflowData.skripte === undefined) {
    detail._workflowData.skripte = await skripteService.loadSkripte({
      kampagneId: detail.kampagneId,
      produktionId: detail.produktionId || null,
      briefingId: effectiveLinie(detail, TAB_ID)
    });
  }
  return detail._workflowData.skripte;
}

export async function renderSkriptePane(detail) {
  const skripte = await ladeSkripte(detail);

  if (!skripte.length) {
    return renderEmptyState({
      icon: 'skripte',
      title: 'Keine Skripte vorhanden',
      text: `Für ${effectiveLinie(detail, TAB_ID) ? 'diese Linie' : 'diese Produktion'} wurden noch keine Skripte erstellt.`
    });
  }

  // Status inline editierbar (intern + canEdit), sonst Badge wie bisher.
  const canEditStatus = !detail.isKunde && (window.canEdit?.('skripte') ?? false);
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

  const rows = skripte.map(s => {
    const titel = (s.titel || s.hook || 'Ohne Titel').toString().slice(0, 80);
    const statusLabel = STATUS_LABELS[s.status] || s.status || '–';
    const statusVariant = STATUS_TAG_VARIANT[s.status] || 'tag--type';
    const statusTd = canEditStatus
      ? renderTableSelect({
          field: 'skript_status',
          itemId: s.id,
          value: s.status || '',
          options: statusOptions
        })
      : `<span class="tag tag--status ${statusVariant}">${esc(statusLabel)}</span>`;
    return `
      <tr>
        <td class="col-nr">${s.skript_nr || '–'}</td>
        <td class="col-creator">${skriptCreatorHtml(detail, s)}</td>
        <td class="col-titel">${renderVerknuepfungPill({
          kind: 'skript',
          label: titel,
          href: `/skripte/${s.id}`,
          attrs: `data-table="skripte" data-id="${s.id}"`
        })}</td>
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
            <th class="col-creator">Creator</th>
            <th class="col-titel">Titel</th>
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

async function rendereTabelle(detail, pane, lauf, gen) {
  pane.innerHTML = SPINNER;
  try {
    const html = await renderSkriptePane(detail);
    if (!istAktuell(detail, lauf, gen) || !pane.isConnected) return;
    pane.innerHTML = html;
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Skripte-Pane fehlgeschlagen:', error);
    if (!istAktuell(detail, lauf, gen) || !pane.isConnected) return;
    pane.innerHTML = renderEmptyState({
      icon: 'info',
      title: 'Fehler beim Laden',
      text: 'Die Inhalte konnten nicht geladen werden.'
    });
  }
}

/** Zurück zur Tabelle (Button „Alle Skripte“, Skript gelöscht). Daten laden neu, Titel und Status ändern sich im Editor. */
export async function zeigeSkriptListe(detail) {
  const pane = getPane();
  if (!pane) return;
  const lauf = neuerLauf(detail);
  const gen = paneGeneration(detail, TAB_ID);
  await zerstoereEditor(detail);
  setUrlSkript(null);
  if (detail._workflowData) delete detail._workflowData.skripte;
  if (!istAktuell(detail, lauf, gen)) return;
  await rendereTabelle(detail, pane, lauf, gen);
}

/* ------------------------------------------------------------------ */
/* Editor im Tab                                                       */
/* ------------------------------------------------------------------ */

export async function oeffneSkriptImPane(detail, skriptId) {
  const pane = getPane();
  if (!pane || !skriptId) return;
  const lauf = neuerLauf(detail);
  const gen = paneGeneration(detail, TAB_ID);
  await zerstoereEditor(detail);
  if (!istAktuell(detail, lauf, gen) || !pane.isConnected) return;

  pane.innerHTML = `
    <div class="skripte-pane-bar">
      <button type="button" class="mdc-btn mdc-btn--secondary" data-skripte-zurueck>
        <span class="mdc-btn__icon">${icon('arrow-left')}</span>
        <span class="mdc-btn__label">Alle Skripte</span>
      </button>
    </div>
    <div class="skripte-pane-editor" data-skripte-editor></div>`;
  pane.querySelector('[data-skripte-zurueck]')
    .addEventListener('click', () => { void zeigeSkriptListe(detail); });

  const editor = new SkriptEditorView({ _merkeKontext: () => {} });
  detail._skriptEditor = editor;
  detail._skriptOffenId = skriptId;
  setUrlSkript(skriptId);

  await editor.render(pane.querySelector('[data-skripte-editor]'), skriptId, {
    einbettung: {
      onSkriptChange: (id) => {
        detail._skriptOffenId = id;
        setUrlSkript(id);
      },
      onClose: () => { void zeigeSkriptListe(detail); },
      neuPrefill: () => campaignPrefill(detail)
    }
  });

  // Währenddessen weggeschaltet: render hat nach dem Abbau neu verdrahtet.
  if (detail._skriptEditor !== editor) await editor.cleanup();
}

/** Tab-Start: ?skript= öffnet den Editor, sonst die Tabelle. */
export async function mountSkriptePane(detail) {
  const pane = getPane();
  if (!pane) return;
  const lauf = neuerLauf(detail);
  const gen = paneGeneration(detail, TAB_ID);
  await zerstoereEditor(detail);

  const skriptId = skriptIdAusUrl();
  if (skriptId) {
    pane.innerHTML = SPINNER;
    let skripte = [];
    try {
      skripte = await ladeSkripte(detail);
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Skripte laden fehlgeschlagen:', error);
    }
    if (!istAktuell(detail, lauf, gen) || !pane.isConnected) return;
    // Skripte einer anderen Linie oder Produktion bleiben draußen: zurück zur Tabelle.
    if (skripte.some(s => s.id === skriptId)) {
      await oeffneSkriptImPane(detail, skriptId);
      return;
    }
    setUrlSkript(null);
  }

  await rendereTabelle(detail, pane, lauf, gen);
}
