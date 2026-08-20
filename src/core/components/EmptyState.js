// EmptyState.js
// Zentrales Empty-State-System fuer Tabellen/Listen/Boards.
//
// APIs:
//   renderEmptyState(state)            -> HTML-String (memoized)
//   renderEmptyStateRow(state, cols)   -> HTML-String als <tr><td colspan>
//   resolveEmptyState(context, key)    -> filter-aware Auswahl + Rendering
//   createEmptyState(state)            -> DOM-Node (template-clone, kein HTML-Parse)
//   insertEmptyState(target, state)    -> schreibt direkt in tbody (auto-colspan) oder Container
//   bindEmptyStateActions(el, map, {signal}) -> delegiertes Click-Handling fuer [data-empty-action]
//   renderSectionHeader({title, actionsHtml}) -> Header-Zeile fuer Detail-Tabs
//
// State-Objekt: { icon, title, text, actions, actionsHtml, size }
//   icon:        Icon-Key aus EMPTY_ICON_MAP oder beliebiger String (z.B. Emoji)
//   actions:     [{ label, action, variant: 'primary'|'secondary' }]
//                Buttons tragen data-empty-action; Klicks via bindEmptyStateActions delegieren.
//   actionsHtml: Alternativ fertiges HTML (nicht escaped!)
//   size:        'small' fuer Sidebar-/Drawer-Kontexte
//
// Performance: Render-Ergebnisse sind gecacht (LRU), Icons leben in einem
// einmalig injizierten SVG-Sprite (<use>), createEmptyState klont geparste
// Templates statt HTML zu parsen.

// Vordefinierte States, die auf allen Seiten gleich aussehen sollen.
const PRESETS = {
  filtered: {
    icon: 'filter',
    title: 'Keine Treffer',
    text: 'Keine Einträge entsprechen den aktuellen Filtern.',
    actions: [{ label: 'Filter zurücksetzen', action: 'reset-filters', variant: 'secondary' }]
  }
};

// Generischer Fallback, wenn resolveEmptyState einen unbekannten Key bekommt.
// Bewusst ohne Reset-Button (keine Filter aktiv).
const DEFAULT_STATE = {
  icon: 'list',
  title: 'Keine Einträge vorhanden'
};

/* ------------------------------------------------------------------ */
/* Escaping                                                            */
/* ------------------------------------------------------------------ */
import { icon, hasIcon } from '../icons/IconSystem.js';

// EmptyState-Key -> IconSystem-Key (Feather-Stil auf Heroicons gemappt)
const EMPTY_ICON_MAP = {
  filter: 'adjustments-horizontal',
  check: 'check-circle',
  clipboard: 'clipboard',
  film: 'film',
  search: 'search',
  building: 'building',
  users: 'users',
  creator: 'creator',
  megaphone: 'campaign',
  handshake: 'handshake',
  invoice: 'rechnung',
  document: 'document',
  list: 'list-bullet',
  'map-pin': 'map-pin',
  tag: 'tag',
  cube: 'cube',
  instagram: 'instagram',
  video: 'video',
  inbox: 'inbox',
  calendar: 'calendar',
  'file-text': 'document',
  kanban: 'squares-2x2',
  wallet: 'wallet',
  gift: 'gift',
  info: 'information-circle',
  folder: 'folder',
};

const NEEDS_ESCAPE = /[&<>"]/;

function escHtml(str) {
  const s = String(str ?? '');
  if (!NEEDS_ESCAPE.test(s)) return s;
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  const s = String(str ?? '');
  if (!NEEDS_ESCAPE.test(s)) return s;
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Rendering (intern)                                                  */
/* ------------------------------------------------------------------ */
function renderIcon(iconKey) {
  if (!iconKey) return '';
  // Bekannte Keys laufen ueber das zentrale IconSystem (Sprite).
  const mapped = EMPTY_ICON_MAP[iconKey];
  if (mapped) {
    return `<div class="empty-icon empty-icon--svg">${icon(mapped, { stroke: 1.5 })}</div>`;
  }
  if (hasIcon(iconKey)) {
    return `<div class="empty-icon empty-icon--svg">${icon(iconKey, { stroke: 1.5 })}</div>`;
  }
  // Fallback: beliebiger String (z.B. Emoji) wird unveraendert angezeigt
  return `<div class="empty-icon">${escHtml(iconKey)}</div>`;
}

function renderActions(actions, actionsHtml) {
  if (actionsHtml) return `<div class="empty-state-actions">${actionsHtml}</div>`;
  if (!actions || actions.length === 0) return '';
  const buttons = actions.map(a => {
    const cls = a.variant === 'primary' ? 'primary-btn' : 'secondary-btn';
    return `<button class="${cls}" data-empty-action="${escAttr(a.action)}">${escHtml(a.label)}</button>`;
  }).join('');
  return `<div class="empty-state-actions">${buttons}</div>`;
}

function buildEmptyStateHtml(state) {
  const { icon, title, text, actions, actionsHtml, size } = state;
  const cls = size === 'small' ? 'empty-state empty-state-small' : 'empty-state';
  return `
    <div class="${cls}">
      ${renderIcon(icon)}
      ${title ? `<h3>${escHtml(title)}</h3>` : ''}
      ${text ? `<p>${escHtml(text)}</p>` : ''}
      ${renderActions(actions, actionsHtml)}
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* LRU-Cache: gleiche States (z.B. filtered-Preset bei jeder Filter-   */
/* Eingabe) werden nicht neu ge-rendert.                               */
/* ------------------------------------------------------------------ */
const CACHE_LIMIT = 50;
const htmlCache = new Map();

function cacheKey(state) {
  try {
    return JSON.stringify(state ?? {});
  } catch {
    return null;
  }
}

function cacheGet(key) {
  const hit = htmlCache.get(key);
  if (hit !== undefined) {
    // LRU: ans Ende schieben
    htmlCache.delete(key);
    htmlCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key, value) {
  htmlCache.set(key, value);
  if (htmlCache.size > CACHE_LIMIT) {
    htmlCache.delete(htmlCache.keys().next().value);
  }
}

/**
 * Rendert einen Empty-State als HTML-String (memoized).
 *
 * @param {Object} state
 * @param {string} [state.icon] - Icon-Key (siehe EMPTY_ICON_MAP) oder Fallback-String (z.B. Emoji)
 * @param {string} state.title - Ueberschrift
 * @param {string} [state.text] - Beschreibungstext
 * @param {Array<{label: string, action: string, variant?: 'primary'|'secondary'}>} [state.actions]
 * @param {string} [state.actionsHtml] - Alternativ: fertiges HTML (nicht escaped!)
 * @param {string} [state.size] - 'small' fuer kompakte Darstellung
 * @returns {string} HTML
 */
export function renderEmptyState(state = {}) {
  const key = cacheKey(state);
  if (key !== null) {
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
  }
  const html = buildEmptyStateHtml(state);
  if (key !== null) cacheSet(key, html);
  return html;
}

/**
 * Empty-State als Tabellenzeile.
 * @param {Object} state - siehe renderEmptyState
 * @param {number} [colspan=1]
 * @returns {string} HTML `<tr><td colspan>`
 */
export function renderEmptyStateRow(state = {}, colspan = 1) {
  const cols = Number.isFinite(colspan) && colspan > 0 ? colspan : 1;
  return `<tr><td colspan="${cols}" class="empty-state-cell">${renderEmptyState(state)}</td></tr>`;
}

/**
 * Filter-aware Aufloesung: Sind Filter aktiv, wird immer der "filtered"-State
 * gerendert (Standard-Preset, ueberschreibbar via context.states.filtered),
 * sonst der kontextspezifische State unter `key`.
 *
 * @param {Object} context
 * @param {boolean} [context.hasActiveFilters] - z.B. store.hasActiveFilters()
 * @param {Object<string, Object>} [context.states] - benannte States (inkl. optional eigenem `filtered`)
 * @param {string} key - welcher State ohne aktive Filter gilt
 * @returns {string} HTML
 */
export function resolveEmptyState(context = {}, key) {
  const states = context.states || {};
  if (context.hasActiveFilters) {
    return renderEmptyState({ ...PRESETS.filtered, ...(states.filtered || {}) });
  }
  const state = states[key];
  if (!state) return renderEmptyState(DEFAULT_STATE);
  return renderEmptyState(state);
}

/* ------------------------------------------------------------------ */
/* DOM-APIs                                                            */
/* ------------------------------------------------------------------ */
let templateEl = null;
const nodeCache = new Map();

/**
 * Rendert einen Empty-State als DOM-Node. Geparste Templates werden gecacht
 * und geklont (kein wiederholtes HTML-Parsen).
 * @param {Object} state - siehe renderEmptyState
 * @returns {HTMLElement}
 */
export function createEmptyState(state = {}) {
  const key = cacheKey(state);
  let node = key !== null ? nodeCache.get(key) : undefined;
  if (!node) {
    if (!templateEl) templateEl = document.createElement('template');
    templateEl.innerHTML = renderEmptyState(state);
    node = templateEl.content.firstElementChild;
    if (key !== null) {
      nodeCache.set(key, node);
      if (nodeCache.size > CACHE_LIMIT) {
        nodeCache.delete(nodeCache.keys().next().value);
      }
    }
  }
  return node.cloneNode(true);
}

/**
 * Schreibt einen Empty-State direkt in ein Ziel-Element.
 * Bei TBODY wird automatisch die Spaltenanzahl aus dem thead ermittelt
 * (bewusst live gelesen: Spalten koennen zur Laufzeit ein-/ausgeblendet werden).
 * Ersetzt das alte FilterUI.renderEmptyState.
 *
 * @param {HTMLElement} target - tbody oder beliebiger Container
 * @param {Object} state - siehe renderEmptyState
 */
export function insertEmptyState(target, state = {}) {
  if (!target) return;
  if (target.tagName === 'TBODY') {
    const colspan = target.closest('table')?.querySelector('thead tr')?.children?.length || 1;
    target.innerHTML = renderEmptyStateRow(state, colspan);
  } else {
    target.innerHTML = renderEmptyState(state);
  }
}

/**
 * Delegiertes Click-Handling fuer Empty-State-Buttons. Ein Listener am
 * Container ueberlebt Re-Renders des Empty States.
 *
 * @param {HTMLElement} container - stabiler Container (z.B. Tab-Wrapper)
 * @param {Object<string, (event: MouseEvent, button: HTMLElement) => void>} handlers
 *        Mapping von data-empty-action auf Handler
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - zum automatischen Loeschen des Listeners
 * @returns {() => void} unbind
 */
export function bindEmptyStateActions(container, handlers = {}, { signal } = {}) {
  if (!container) return () => {};
  const listener = (event) => {
    const button = event.target.closest?.('[data-empty-action]');
    if (!button || !container.contains(button)) return;
    const handler = handlers[button.dataset.emptyAction];
    if (handler) handler(event, button);
  };
  container.addEventListener('click', listener, { signal });
  return () => container.removeEventListener('click', listener);
}

/**
 * Einheitliche Header-Zeile fuer Detail-Tabs: Titel links, Aktions-Buttons rechts.
 * Wird nur gerendert, wenn die Tabelle Inhalte hat; im leeren Zustand gehoeren
 * die Aktionen stattdessen in den Empty State (actions/actionsHtml).
 *
 * @param {Object} config
 * @param {string} config.title - Tab-/Sektions-Titel
 * @param {string} [config.actionsHtml] - fertiges Button-HTML (nicht escaped!)
 * @returns {string} HTML
 */
export function renderSectionHeader({ title, actionsHtml } = {}) {
  return `
    <div class="section-header tab-section-header">
      <h3>${escHtml(title)}</h3>
      ${actionsHtml ? `<div class="section-header-actions">${actionsHtml}</div>` : ''}
    </div>
  `;
}
