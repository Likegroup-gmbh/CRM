// Workflow-Tabs auf der Produktions-Detailseite:
// Briefing, Casting, Konzepte, Skripte, Verträge, Produktion (Default), Videos, Auswertung.
//
// Der Tab „Produktion“ ist die Kooperationstabelle. Auf der Kampagne gibt es diese Tabs nicht.

import { canViewTab, syncTabQueryParam, getTabQueryParam } from '../../core/TabUtils.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderVertraegeTableBody } from '../vertrag/VertraegeListRenderers.js';
import {
  bindTableDelegation,
  downloadVertrag,
  deleteVertrag,
  openVertragUploadDrawer
} from '../vertrag/VertraegeListHandlers.js';
import { skripteService } from '../skripte/SkripteService.js';
import { scopeByProduktion } from '../produktion/ProduktionService.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { konzeptCreatorFromSkript } from '../skripte/editor/SkriptEditorDocRenderer.js';
import { renderCreatorNameCell } from '../creator/CreatorTable.js';
import { VideoDataLoader } from '../video/VideoDataLoader.js';
import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { mountCastingPane, unmountCastingWorksheet } from './KampagneDetailCasting.js';
import { mountKonzeptPane, unmountKonzeptWorksheet } from './KampagneDetailKonzept.js';
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
  const normalized = fromUrl === 'kooperation' ? 'produktion' : fromUrl;
  const visible = getVisibleWorkflowTabs().map(t => t.id);
  return visible.includes(normalized) ? normalized : DEFAULT_WORKFLOW_TAB;
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

  if (tabId === 'konzepte') {
    detail._workflowLoaded = detail._workflowLoaded || {};
    if (detail._workflowLoaded.konzepte) return;
    await mountKonzeptPane(detail);
    detail._workflowLoaded.konzepte = true;
    syncWorkflowCreateChrome(detail, 'konzepte');
    return;
  }

  const renderer = PANE_RENDERERS[tabId];
  if (!renderer) return;

  detail._workflowLoaded = detail._workflowLoaded || {};
  if (detail._workflowLoaded[tabId]) return;
  detail._workflowLoaded[tabId] = true;

  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  if (tabId === 'vertraege') unmountVertraegePane(detail);

  try {
    const html = await renderer(detail);
    if (pane.isConnected) {
      pane.innerHTML = html;
      if (tabId === 'vertraege') mountVertraegePane(detail);
    }
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
export async function reloadWorkflowPane(detail, tabId) {
  if (detail._workflowLoaded) detail._workflowLoaded[tabId] = false;
  if (detail._workflowData) delete detail._workflowData[tabId];
  await loadWorkflowPane(detail, tabId);
}

export function refreshWorkflowAfterRender(detail) {
  unmountCastingWorksheet(detail);
  unmountKonzeptWorksheet(detail);
  unmountVertraegePane(detail);
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
  if (field === 'sourcing_status' || field === 'kunden_feedback' || field === 'strategie_prio') return;

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

async function loadVertraege(detail) {
  const query = scopeByProduktion(
    window.supabase
      .from('vertraege')
      .select(`
        id, name, typ, is_draft, status, gesendet_am,
        datei_url, datei_path,
        unterschriebener_vertrag_url, unterschriebener_vertrag_path,
        dropbox_file_url, dropbox_file_path,
        kooperation_id, created_at,
        kunde_unternehmen_id, kampagne_id, creator_id, contracting_auftrag_id,
        kunde:kunde_unternehmen_id (id, firmenname),
        kampagne:kampagne_id (id, kampagnenname, eigener_name, marke:marke_id (id, markenname)),
        kooperation:kooperation_id (id, name),
        creator:creator_id (id, vorname, nachname, mail),
        contracting_auftrag:contracting_auftrag_id (id, auftragsname, titel)
      `)
      .eq('kampagne_id', detail.kampagneId)
      .order('created_at', { ascending: false }),
    detail.produktionId
  );
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

function getKampagneVertragPermissions(detail) {
  const isKunde = Boolean(detail.isKunde);
  const isAdmin = !isKunde && window.isAdmin?.() === true;
  const canEdit = !isKunde && (isAdmin || window.currentUser?.permissions?.vertraege?.can_edit === true);
  const canDelete = !isKunde && window.canBulkDelete?.() === true;
  return { isKunde, isAdmin, canEdit, canDelete };
}

export function createKampagneVertragListAdapter(detail) {
  const adapter = {
    get vertraege() { return detail._workflowData?.vertraege || []; },
    get currentUnternehmenName() { return detail.kampagneData?.unternehmen?.firmenname || ''; },
    _boundEventListeners: new Set(),
    reloadData: () => reloadWorkflowPane(detail, 'vertraege'),
    getVertragPermissions() {
      const { isAdmin, canEdit, canDelete } = getKampagneVertragPermissions(detail);
      return {
        isAdmin,
        canBulkDelete: canDelete,
        canView: !detail.isKunde,
        canEdit
      };
    },
    downloadVertrag(id) { downloadVertrag(adapter, id); },
    deleteVertrag(id) { return deleteVertrag(adapter, id); },
    openVertragUploadDrawer(id) { return openVertragUploadDrawer(adapter, id); }
  };
  return adapter;
}

export function unmountVertraegePane(detail) {
  const adapter = detail._vertragListAdapter;
  if (!adapter) return;
  adapter._boundEventListeners.forEach((cleanup) => cleanup());
  adapter._boundEventListeners.clear();
  detail._vertragListAdapter = null;
}

export function mountVertraegePane(detail) {
  unmountVertraegePane(detail);
  const adapter = createKampagneVertragListAdapter(detail);
  detail._vertragListAdapter = adapter;
  bindTableDelegation(adapter);
}

/* ------------------------------------------------------------------ */
/* Pane-Renderer                                                       */
/* ------------------------------------------------------------------ */

// Briefing der Produktion: direkt oder über Casting, Konzept, Skripte, Kooperationen.
function renderBriefingPane(detail) {
  const briefings = detail.briefings || [];

  if (!briefings.length) {
    return renderEmptyState({
      icon: 'document',
      title: 'Keine Briefings vorhanden',
      text: 'Für diese Produktion wurde noch kein Briefing zugeordnet.'
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

async function renderSkriptePane(detail) {
  const skripte = await getWorkflowData(detail, 'skripte', () =>
    skripteService.loadSkripte({
      kampagneId: detail.kampagneId,
      produktionId: detail.produktionId || null
    })
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

export async function renderVertraegePane(detail) {
  const vertraege = await getWorkflowData(detail, 'vertraege', () => loadVertraege(detail));

  if (!vertraege.length) {
    return renderEmptyState({
      icon: 'document',
      title: 'Keine Verträge vorhanden',
      text: 'Für diese Kampagne wurden noch keine Verträge erfasst.'
    });
  }

  const { isAdmin, canEdit, canDelete } = getKampagneVertragPermissions(detail);
  const rows = renderVertraegeTableBody(vertraege, {
    canBulkDelete: false,
    canEdit,
    isAdmin,
    canDelete
  });

  return `
    <div class="data-table-container">
      <table class="data-table data-table--vertraege">
        <thead>
          <tr>
            <th class="col-name">Name</th>
            <th class="col-kampagne">Kontext</th>
            <th class="col-status">Status</th>
            <th class="col-typ">Typ</th>
            <th class="col-creator">Creator</th>
            <th class="col-datei">Datei</th>
            <th class="col-signed">Unterschrieben</th>
            <th class="col-erstellt-am">Erstellt am</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody id="vertraege-table-body">${rows}</tbody>
      </table>
    </div>
  `;
}

// Live/posted-Assets dieser Kampagne — schlanke Tabelle analog /videos,
// ohne Kampagne-Spalte und ohne Ordner-Nav.
async function renderVideosPane(detail) {
  const { videos } = await getWorkflowData(detail, 'videos', () =>
    VideoDataLoader.loadVideos({
      kampagneId: detail.kampagneId,
      produktionId: detail.produktionId || null,
      from: 0,
      to: 199
    })
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
    text: 'Für diese Produktion liegt noch keine Auswertung vor.'
  });
}

const PANE_RENDERERS = {
  briefing: renderBriefingPane,
  skripte: renderSkriptePane,
  vertraege: renderVertraegePane,
  videos: renderVideosPane,
  auswertung: renderAuswertungPane
};
