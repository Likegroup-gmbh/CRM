// KampagneDetailWorkflow.js
// Workflow-Tabs auf der Kampagnen-Detailseite:
// Briefing, Casting, Konzepte, Skripte, Verträge, Produktion (Default), Videos, Auswertung.
//
// Produktion ist die heutige Kooperationstabelle — sie bleibt gemountet und wird
// nur per DOM-hide versteckt. Casting mountet das volle Worksheet
// (CreatorAuswahlDetail). Alle anderen Panes werden lazy beim ersten
// Tab-Besuch gefüllt (kampagnen-gefilterte Listen).

import { canViewTab, syncTabQueryParam, getTabQueryParam } from '../../core/TabUtils.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';
import { VertragUtils } from '../vertrag/VertragUtils.js';
import { skripteService } from '../skripte/SkripteService.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { VideoDataLoader } from '../video/VideoDataLoader.js';
import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { strategieService } from '../strategie/StrategieService.js';
import { getPlatformIcon, renderItemActions } from '../strategie/StrategieDetailRenderer.js';
import { StrategieCreatorDrawer } from '../strategie/StrategieCreatorDrawer.js';
import { showEditItemDrawer } from '../strategie/StrategieDetailEditDrawer.js';
import { AddToVideoDrawer } from '../strategie/AddToVideoDrawer.js';
import { handleReprocessItem } from '../strategie/StrategieDetailTableEvents.js';
import { mountCastingPane, unmountCastingWorksheet } from './KampagneDetailCasting.js';
import { syncWorkflowCreateChrome } from './KampagneWorkflowCreate.js';

export const WORKFLOW_TABS = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'casting', label: 'Casting' },
  { id: 'konzepte', label: 'Konzepte' },
  { id: 'skripte', label: 'Skripte' },
  { id: 'vertraege', label: 'Verträge' },
  { id: 'produktion', label: 'Produktion' },
  { id: 'videos', label: 'Videos' },
  { id: 'auswertung', label: 'Auswertung' }
];

export const DEFAULT_WORKFLOW_TAB = 'produktion';

// table-link[data-table] → Route innerhalb der Workflow-Panes.
// Deckt sich mit den Detailrouten der Nav-Seiten (/castings, /konzepte, ...).
const WORKFLOW_TABLE_ROUTES = {
  briefing: (id) => `/briefing/${id}`,
  sourcing: (id) => `/castings/${id}`,
  strategie: (id) => `/konzepte/${id}`,
  skripte: (id) => `/skripte/${id}`,
  kooperation: (id) => `/kooperation/${id}`,
  creator: (id) => `/creator/${id}`
};

export function getWorkflowTableRoute(table, id) {
  return WORKFLOW_TABLE_ROUTES[table]?.(id) || null;
}

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function getVisibleWorkflowTabs() {
  return WORKFLOW_TABS.filter(t => canViewTab(t.id));
}

/**
 * Initialen Tab bestimmen: ?tab= wenn bekannt + erlaubt, sonst Produktion.
 */
export function resolveInitialWorkflowTab() {
  const fromUrl = getTabQueryParam();
  const visible = getVisibleWorkflowTabs().map(t => t.id);
  return visible.includes(fromUrl) ? fromUrl : DEFAULT_WORKFLOW_TAB;
}

/**
 * Workflow-Tab-Leiste. Bewusst kein renderTabButton aus TabUtils — der
 * schreibt data-tab und würde mit den Offen/Abgeschlossen-Filter-Tabs
 * kollidieren. Hier: data-workflow-tab.
 */
export function renderWorkflowTabBar(activeTab) {
  const buttons = getVisibleWorkflowTabs().map(t => `
    <button class="tab-button${t.id === activeTab ? ' active' : ''}" data-workflow-tab="${t.id}">
      ${t.label}
    </button>
  `).join('');
  return `<div class="tab-navigation kampagne-workflow-tabs">${buttons}</div>`;
}

/**
 * Leere Panes für alle Nicht-Produktions-Tabs. Produktion wird im
 * MainRenderer mit dem bestehenden Inhalt gerendert.
 */
export function renderWorkflowPanes(activeTab) {
  return getVisibleWorkflowTabs()
    .filter(t => t.id !== 'produktion')
    .map(t => `<div class="workflow-pane" data-pane="${t.id}" id="workflow-pane-${t.id}"${t.id === activeTab ? '' : ' hidden'}></div>`)
    .join('');
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

/**
 * Workflow-Tab aktivieren: Wrapper-Attribut (steuert Produktion-Chrome via
 * CSS), Button-States, Panes, URL. Produktion wird nicht neu gemountet.
 */
export function activateWorkflowTab(detail, tabId, { syncUrl = true } = {}) {
  const visible = getVisibleWorkflowTabs().map(t => t.id);
  if (!visible.includes(tabId)) return;

  detail.activeWorkflowTab = tabId;

  const wrapper = document.querySelector('.kampagne-detail-body[data-workflow]');
  if (wrapper) wrapper.dataset.workflow = tabId;

  document.querySelectorAll('.kampagne-workflow-tabs [data-workflow-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.workflowTab === tabId);
  });

  document.querySelectorAll('.workflow-pane').forEach(pane => {
    pane.hidden = pane.dataset.pane !== tabId;
  });

  if (syncUrl) syncTabQueryParam(tabId);

  if (tabId === 'produktion') {
    // Tabelle/Board wurden nur versteckt, nicht zerstört — Counts auffrischen.
    if (detail.currentView === 'kanban') detail.kanbanBoard?.updateTabCounts();
    else detail.kooperationenVideoTable?.updateTabCounts();
    return;
  }

  void loadWorkflowPane(detail, tabId);
}

/**
 * Pane lazy füllen (nur beim ersten Besuch). Bei Fehler landet ein
 * Empty-State im Pane, der Rest der Seite bleibt unberührt.
 */
export async function loadWorkflowPane(detail, tabId) {
  const pane = document.getElementById(`workflow-pane-${tabId}`);
  if (!pane) return;

  if (tabId === 'casting') {
    detail._workflowLoaded = detail._workflowLoaded || {};
    if (detail._workflowLoaded.casting) return;
    await mountCastingPane(detail);
    detail._workflowLoaded.casting = true;
    syncWorkflowCreateChrome(detail, 'casting');
    return;
  }

  const renderer = PANE_RENDERERS[tabId];
  if (!renderer) return;

  detail._workflowLoaded = detail._workflowLoaded || {};
  if (detail._workflowLoaded[tabId]) return;
  detail._workflowLoaded[tabId] = true;

  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  try {
    const html = await renderer(detail);
    if (pane.isConnected) pane.innerHTML = html;
  } catch (error) {
    console.error(`❌ KAMPAGNEDETAIL: Workflow-Pane "${tabId}" fehlgeschlagen:`, error);
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Die Inhalte konnten nicht geladen werden.'
      });
    }
  }
}

/**
 * Nach einem Full-Re-Render (init / softRefresh) sind alle Pane-DOMs und
 * geladenen Daten weg: Flags zurücksetzen und den aktiven Pane neu füllen.
 */
export function refreshWorkflowAfterRender(detail) {
  unmountCastingWorksheet(detail);
  detail._workflowLoaded = {};
  detail._workflowData = {};
  const tab = detail.activeWorkflowTab;
  if (tab && tab !== 'produktion') {
    void loadWorkflowPane(detail, tab);
  }
}

/* ------------------------------------------------------------------ */
/* Inline-Edits (table-select-change + Toggle-Actions)                 */
/* ------------------------------------------------------------------ */

// Item im gecachten Pane-Datensatz patchen und das Pane mit dem vorhandenen
// Renderer neu schreiben — kein Refetch, Daten liegen schon im Cache.
async function patchWorkflowItem(detail, cacheKey, itemId, updates) {
  const list = detail._workflowData?.[cacheKey];
  const item = list?.find(i => i.id === itemId);
  if (item) Object.assign(item, updates);

  const pane = document.getElementById(`workflow-pane-${detail.activeWorkflowTab}`);
  const renderer = PANE_RENDERERS[detail.activeWorkflowTab];
  if (pane && renderer) {
    pane.innerHTML = await renderer(detail);
  }
}

/**
 * Zentraler Handler für table-select-change aus den Workflow-Panes.
 * Casting-Status/Feedback laufen über CreatorAuswahlDetail, nicht hier.
 */
export async function handleWorkflowTableSelect(detail, { field, itemId, value }) {
  if (!itemId) return;
  if (field === 'sourcing_status' || field === 'kunden_feedback') return;

  try {
    if (field === 'skript_status') {
      if (detail.isKunde) return;
      await skripteService.updateSkript(itemId, { status: value });
      await patchWorkflowItem(detail, 'skripte', itemId, { status: value });
      window.toastSystem?.show('Skript-Status aktualisiert', 'success');
    }
  } catch (error) {
    console.error(`❌ KAMPAGNEDETAIL: Inline-Update "${field}" fehlgeschlagen:`, error);
    window.toastSystem?.show(error.message || 'Fehler beim Speichern', 'error');
  }
}

/**
 * Skript-Freigabe einer Videoidee (Konzepte-Pane) umschalten.
 * Der Service wirft deutsche Fehler (kein Casting-Eintrag, nicht_umsetzen,
 * Vorschlag) — die landen direkt im Toast.
 */
export async function handleSkriptFreigabeToggle(detail, itemId) {
  const list = detail._workflowData?.konzepte;
  const item = list?.find(i => i.id === itemId);
  if (!item) return;

  const next = !item.skript_freigabe;
  try {
    await strategieService.setSkriptFreigabe(itemId, next);
    await patchWorkflowItem(detail, 'konzepte', itemId, {
      skript_freigabe: next,
      skript_freigabe_am: next ? new Date().toISOString() : null,
      skript_freigabe_von: next ? (window.currentUser?.id || null) : null
    });
    window.toastSystem?.show(
      next ? 'Für Skript freigegeben' : 'Skript-Freigabe zurückgenommen',
      'success'
    );
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Skript-Freigabe fehlgeschlagen:', error);
    window.toastSystem?.show(error.message || 'Fehler bei der Skript-Freigabe', 'error');
  }
}

function makeKonzeptAdapter(detail, item) {
  return {
    get items() { return detail._workflowData?.konzepte || []; },
    isKunde: detail.isKunde,
    canEdit: !detail.isKunde && (window.canEdit?.('strategie') ?? false),
    strategieId: item?.strategie?.id || null,
    getTeilbereicheFromStrategie() {
      return (item?.strategie?.teilbereich || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    },
    async rerenderItemsTable() {
      const pane = document.getElementById('workflow-pane-konzepte');
      if (pane) pane.innerHTML = await renderKonzeptePane(detail);
    },
    showCreatorDrawer(itemId) {
      const target = this.items.find(i => i.id === itemId);
      if (!target) return;
      new StrategieCreatorDrawer().open(target, {
        onSuccess: () => this.rerenderItemsTable()
      });
    }
  };
}

export async function handleKonzeptPaneAction(detail, actionItem) {
  const action = actionItem.dataset.action;
  const id = actionItem.dataset.id;
  const items = detail._workflowData?.konzepte || [];
  const item = items.find(i => i.id === id);
  if (!item) return;

  const adapter = makeKonzeptAdapter(detail, item);

  switch (action) {
    case 'connect-creator':
      adapter.showCreatorDrawer(id);
      break;
    case 'toggle-skript-freigabe':
      if (actionItem.classList.contains('action-disabled')) return;
      await handleSkriptFreigabeToggle(detail, id);
      break;
    case 'edit-item':
      showEditItemDrawer(adapter, id);
      break;
    case 'reprocess-item':
      await handleReprocessItem(adapter, id);
      break;
    case 'add-to-video':
      await new AddToVideoDrawer().open(item, item.strategie);
      break;
    case 'unlink-from-video':
      window.navigateTo(`/konzepte/${item.strategie?.id}`);
      break;
    case 'delete-item': {
      const result = await window.confirmationModal?.open({
        title: 'Item löschen?',
        message: 'Möchten Sie dieses Video wirklich aus der Strategie entfernen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!result?.confirmed) return;
      try {
        await strategieService.deleteStrategieItem(id);
        detail._workflowData.konzepte = items.filter(i => i.id !== id);
        window.toastSystem?.show('Item erfolgreich gelöscht', 'success');
        const pane = document.getElementById('workflow-pane-konzepte');
        if (pane) pane.innerHTML = await renderKonzeptePane(detail);
      } catch (error) {
        console.error('Fehler beim Löschen des Items:', error);
        window.toastSystem?.show('Fehler beim Löschen', 'error');
      }
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Lazy-Daten (gecacht pro Detail-Instanz, Reset in refreshWorkflow)   */
/* ------------------------------------------------------------------ */

async function getWorkflowData(detail, key, loader) {
  detail._workflowData = detail._workflowData || {};
  if (detail._workflowData[key] === undefined) {
    detail._workflowData[key] = await loader();
  }
  return detail._workflowData[key];
}

// Alle Videoideen aller Konzepte der Kampagne (flach, gemergt).
// Kunde/Gast: keine Vorschläge (ADR 0015).
async function loadKonzeptItems(detail) {
  let q = window.supabase
    .from('strategie_items')
    .select(`*,
      creator:creator_id(id, vorname, nachname),
      casting_eintrag:creator_auswahl_item_id(id, name, creator_id),
      strategie:strategie_id!inner(id, name, kampagne_id, teilbereich)`)
    .eq('strategie.kampagne_id', detail.kampagneId)
    .order('sortierung', { ascending: true });

  if (window.isKunde?.()) q = q.eq('ist_vorschlag', false);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadVertraege(detail) {
  const { data, error } = await window.supabase
    .from('vertraege')
    .select(`
      id, name, typ, is_draft, datei_url, datei_path,
      dropbox_file_url, dropbox_file_path, kooperation_id,
      unterschriebener_vertrag_url, created_at,
      creator:creator_id(id, vorname, nachname),
      kooperation:kooperation_id(id, name)
    `)
    .eq('kampagne_id', detail.kampagneId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/* ------------------------------------------------------------------ */
/* Pane-Renderer                                                       */
/* ------------------------------------------------------------------ */

// Briefing hängt heute am Unternehmen (Loader in KampagneDetailDataLoader),
// nicht an der Kampagne — Produkt/Persona-Umzug kommt später.
function renderBriefingPane(detail) {
  const briefings = detail.briefings || [];

  if (!briefings.length) {
    return renderEmptyState({
      icon: 'document',
      title: 'Keine Briefings vorhanden',
      text: 'Für dieses Unternehmen wurden noch keine Briefings erstellt.'
    });
  }

  const rows = briefings.map(b => `
    <tr>
      <td>
        <a href="/briefing/${b.id}" class="table-link" data-table="briefing" data-id="${b.id}">
          ${esc(b.aktivierung_name) || 'Unbekanntes Briefing'}
        </a>
      </td>
      <td>${b.bereich ? `<span class="tag tag--type">${esc(BEREICH_LABELS[b.bereich] || b.bereich)}</span>` : '-'}</td>
      <td><span class="status-badge ${b.is_draft ? 'status-entwurf' : 'status-final'}">${b.is_draft ? 'Entwurf' : 'Final'}</span></td>
      <td>${formatDate(b.content_deadline)}</td>
      <td>${formatDate(b.created_at)}</td>
      <td class="col-actions">${actionBuilder.create('briefing', b.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Aktivierung</th>
            <th>Bereich</th>
            <th>Status</th>
            <th>Content-Deadline</th>
            <th>Erstellt am</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

const IDEA_ICON = `${icon('light-bulb')}`;
const FREIGABE_ICON = `${icon('document-text')}`;

// Flache Item-Sicht: alle Videoideen der Konzepte dieser Kampagne,
// mit Skript-Freigabe-Toggle wie auf der Konzept-Detailseite.
async function renderKonzeptePane(detail) {
  const items = await getWorkflowData(detail, 'konzepte', () => loadKonzeptItems(detail));

  if (!items.length) {
    const konzept = (detail.strategien || [])[0];
    if (konzept?.id) {
      return renderEmptyState({
        icon: 'clipboard',
        title: 'Keine Videoideen vorhanden',
        text: 'Das Konzept hat noch keine Videoideen.',
        actionsHtml: `<a href="/konzepte/${esc(konzept.id)}" class="mdc-btn table-link" data-table="strategie" data-id="${esc(konzept.id)}">Konzept öffnen</a>`
      });
    }
    return renderEmptyState({
      icon: 'clipboard',
      title: 'Keine Videoideen vorhanden',
      text: 'Für diese Kampagne wurden noch keine Videoideen in Konzepten angelegt.'
    });
  }

  const canToggle = !detail.isKunde && (window.canEdit?.('strategie') ?? false);

  const rows = items.map(item => {
    const isIdea = !item.video_link;

    const bildTd = isIdea
      ? `<div class="idea-placeholder">${IDEA_ICON}<span>Idee</span></div>`
      : item.screenshot_url
        ? `<img src="${esc(item.screenshot_url)}" alt="Screenshot" class="strategie-screenshot" loading="lazy" />`
        : '<div class="strategie-screenshot-placeholder"><span>Kein Bild</span></div>';

    const plattformTd = getPlatformIcon(item.plattform) || '-';

    const beschreibung = (item.beschreibung || item.titel || '').toString();
    const beschreibungTd = beschreibung
      ? `<span title="${esc(beschreibung)}">${esc(beschreibung.slice(0, 80))}${beschreibung.length > 80 ? '…' : ''}</span>`
      : '-';

    const creatorName = item.creator
      ? `${item.creator.vorname || ''} ${item.creator.nachname || ''}`.trim()
      : '';
    const castingName = item.casting_eintrag?.name || '';
    const creatorTd = item.creator?.id
      ? `<a href="/creator/${item.creator.id}" class="table-link" data-table="creator" data-id="${item.creator.id}">${esc(creatorName || '—')}</a>`
      : (castingName ? esc(castingName) : '-');

    const freigabeTd = canToggle
      ? `<button class="mdc-btn mdc-btn--secondary mdc-btn--sm${item.skript_freigabe ? ' is-active' : ''}"
           data-workflow-action="toggle-skript-freigabe" data-id="${item.id}"
           title="${item.skript_freigabe ? 'Skript-Freigabe zurücknehmen' : 'Für Skript freigeben'}">
           ${FREIGABE_ICON}${item.skript_freigabe ? ' Freigegeben' : ''}
         </button>`
      : (item.skript_freigabe
          ? `<span class="strategie-skript-badge" title="Für Skript freigegeben">${FREIGABE_ICON}</span>`
          : '-');

    const konzeptTd = item.strategie?.id
      ? `<a href="/konzepte/${item.strategie.id}" class="table-link" data-table="strategie" data-id="${item.strategie.id}">${esc(item.strategie.name || '—')}</a>`
      : '-';

    const actionsTd = canToggle
      ? `<td class="col-actions">${renderItemActions(detail, item, !!item.linked_video?.id)}</td>`
      : '';

    return `
      <tr data-item-id="${item.id}" class="${item.skript_freigabe ? 'item-skript-freigabe' : ''}">
        <td class="col-image">${bildTd}</td>
        <td>${plattformTd}</td>
        <td class="col-beschreibung">${beschreibungTd}</td>
        <td>${creatorTd}</td>
        <td>${freigabeTd}</td>
        <td>${konzeptTd}</td>
        ${actionsTd}
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-image"></th>
            <th>Plattform</th>
            <th>Beschreibung</th>
            <th>Creator</th>
            <th>Skript-Freigabe</th>
            <th>Konzept</th>
            ${canToggle ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function renderSkriptePane(detail) {
  const skripte = await getWorkflowData(detail, 'skripte', () =>
    skripteService.loadSkripte({ kampagneId: detail.kampagneId })
  );

  if (!skripte.length) {
    return renderEmptyState({
      icon: 'skripte',
      title: 'Keine Skripte vorhanden',
      text: 'Für diese Kampagne wurden noch keine Skripte erstellt.'
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
        <td class="col-name">
          <a href="/skripte/${s.id}" class="table-link" data-table="skripte" data-id="${s.id}">
            ${esc(titel)}
          </a>
        </td>
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
            <th>Titel</th>
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

async function renderVertraegePane(detail) {
  const vertraege = await getWorkflowData(detail, 'vertraege', () => loadVertraege(detail));

  if (!vertraege.length) {
    return renderEmptyState({
      icon: 'document',
      title: 'Keine Verträge vorhanden',
      text: 'Für diese Kampagne wurden noch keine Verträge erfasst.'
    });
  }

  const rows = vertraege.map(v => {
    const creatorName = v.creator ? `${v.creator.vorname || ''} ${v.creator.nachname || ''}`.trim() : '-';
    const statusLabel = v.is_draft ? 'Entwurf' : 'Final';
    const statusClass = v.is_draft ? 'draft' : 'aktiv';
    return `
      <tr>
        <td>${VertragUtils.renderVertragNameHtml(v, esc)}</td>
        <td>${esc(v.typ || '-')}</td>
        <td><span class="status-badge status-${statusClass}">${statusLabel}</span></td>
        <td>${v.creator ? `<a href="/creator/${v.creator.id}" class="table-link" data-table="creator" data-id="${v.creator.id}">${esc(creatorName)}</a>` : '-'}</td>
        <td>${renderPdfLinks(null, v.datei_url)}</td>
        <td>${formatDate(v.created_at)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table vertraege-detail-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Typ</th>
            <th>Status</th>
            <th>Creator</th>
            <th>Datei</th>
            <th>Erstellt am</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// Live/posted-Assets dieser Kampagne — schlanke Tabelle analog /videos,
// ohne Kampagne-Spalte und ohne Ordner-Nav.
async function renderVideosPane(detail) {
  const { videos } = await getWorkflowData(detail, 'videos', () =>
    VideoDataLoader.loadVideos({ kampagneId: detail.kampagneId, from: 0, to: 199 })
  );

  if (!videos.length) {
    return renderEmptyState({
      icon: 'video',
      title: 'Keine Videos vorhanden',
      text: 'Für diese Kampagne wurden noch keine Videos erstellt.'
    });
  }

  const isKunde = detail.isKunde;
  const rows = videos.map(v => renderVideoRow(v, isKunde)).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-name">Thema</th>
            <th>Content</th>
            ${isKunde ? '' : '<th>Kooperation</th>'}
            <th>Creator</th>
            <th>Content Art</th>
            <th>Status</th>
            <th>Posting Datum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

const VIDEO_FOLDER_ICON = `${icon('folder-open')}`;

function renderVideoRow(video, isKunde) {
  const kooperation = video.kooperation || {};
  const creator = kooperation.creator || {};
  const strategieItem = video.strategie_item || {};

  let themaHtml = '-';
  if (strategieItem.screenshot_url) {
    themaHtml = `<img src="${esc(strategieItem.screenshot_url)}" alt="Thema" class="video-list-thumbnail" loading="lazy" />`;
  } else if (video.thema) {
    themaHtml = esc(video.thema);
  } else if (video.titel) {
    themaHtml = esc(video.titel);
  }

  const creatorName = creator.vorname
    ? `${esc(creator.vorname)} ${esc(creator.nachname || '')}`.trim()
    : '-';

  const statusClass = video.status === 'abgeschlossen' ? 'status-abgeschlossen' : 'status-produktion';

  const contentArtHtml = video.content_art
    ? `<div class="tags tags-compact"><span class="tag tag--type">${esc(video.content_art)}</span></div>`
    : '-';

  const folderUrl = video.folder_url || '';
  const contentLinkHtml = folderUrl
    ? `<a href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${VIDEO_FOLDER_ICON}</a>`
    : '–';

  const kooperationTd = isKunde
    ? ''
    : `<td>${kooperation.id ? `<a href="/kooperation/${kooperation.id}" class="table-link" data-table="kooperation" data-id="${kooperation.id}">${esc(kooperation.name || '—')}</a>` : '-'}</td>`;

  const creatorTd = isKunde
    ? `<td>${creatorName}</td>`
    : `<td>${creator.id ? `<a href="/creator/${creator.id}" class="table-link" data-table="creator" data-id="${creator.id}">${creatorName}</a>` : '-'}</td>`;

  return `
    <tr data-id="${video.id}">
      <td class="col-name video-thema-cell">${themaHtml}</td>
      <td>${contentLinkHtml}</td>
      ${kooperationTd}
      ${creatorTd}
      <td>${contentArtHtml}</td>
      <td><span class="status-badge ${statusClass}">${esc(video.status) || 'produktion'}</span></td>
      <td>${formatDate(video.posting_datum)}</td>
    </tr>
  `;
}

// Auswertung: bewusst nur Platzhalter (kein CTA, keine KI-Briefing-Auswertung).
function renderAuswertungPane() {
  return renderEmptyState({
    icon: 'info',
    title: 'Auswertung folgt',
    text: 'Für diese Kampagne liegt noch keine Auswertung vor.'
  });
}

const PANE_RENDERERS = {
  briefing: renderBriefingPane,
  konzepte: renderKonzeptePane,
  skripte: renderSkriptePane,
  vertraege: renderVertraegePane,
  videos: renderVideosPane,
  auswertung: renderAuswertungPane
};
