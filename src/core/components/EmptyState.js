// EmptyState.js
// Wiederverwendbare Empty-State-Komponente fuer Tabellen/Listen.
// Reines Rendering (HTML-String), kein Event-Binding: Aufrufer delegieren
// Clicks auf [data-empty-action] selbst, da Seiten unterschiedliche
// Lifecycles (AbortController etc.) haben.
//
// Verwendung:
//   import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
//
//   // Direkt:
//   renderEmptyState({ icon: 'film', title: 'Keine Videos', text: '...' })
//
//   // Filter-aware (waehlt bei aktiven Filtern automatisch den "filtered"-State):
//   resolveEmptyState({
//     hasActiveFilters: store.hasActiveFilters(),
//     states: {
//       offen: { icon: 'check', title: 'Alles freigegeben', text: '...' },
//       alle: { icon: 'clipboard', title: 'Keine Eintraege', text: '...' }
//     }
//   }, 'offen')

const ICON_SVGS = {
  filter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  clipboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  film: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
  search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  building: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  megaphone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  handshake: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>',
  invoice: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
  document: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  list: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  'map-pin': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  tag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
};

// Vordefinierte States, die auf allen Seiten gleich aussehen sollen.
const PRESETS = {
  filtered: {
    icon: 'filter',
    title: 'Keine Treffer',
    text: 'Keine Einträge entsprechen den aktuellen Filtern.',
    actions: [{ label: 'Filter zurücksetzen', action: 'reset-filters', variant: 'secondary' }]
  }
};

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  return escHtml(str).replace(/"/g, '&quot;');
}

function renderIcon(icon) {
  if (!icon) return '';
  const svg = ICON_SVGS[icon];
  if (svg) return `<div class="empty-icon empty-icon--svg">${svg}</div>`;
  // Fallback: beliebiger String (z.B. Emoji) wird unveraendert angezeigt
  return `<div class="empty-icon">${escHtml(icon)}</div>`;
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

/**
 * Rendert einen Empty-State als HTML-String.
 *
 * @param {Object} state
 * @param {string} [state.icon] - Icon-Key (filter|check|clipboard|film|search) oder Fallback-String (z.B. Emoji)
 * @param {string} state.title - Ueberschrift
 * @param {string} [state.text] - Beschreibungstext
 * @param {Array<{label: string, action: string, variant?: 'primary'|'secondary'}>} [state.actions]
 *        Buttons mit data-empty-action-Attribut; Click-Handling macht der Aufrufer per Delegation.
 * @param {string} [state.actionsHtml] - Alternativ: fertiges HTML fuer den Aktionsbereich (nicht escaped!)
 * @returns {string} HTML
 */
export function renderEmptyState(state = {}) {
  const { icon, title, text, actions, actionsHtml } = state;
  return `
    <div class="empty-state">
      ${renderIcon(icon)}
      ${title ? `<h3>${escHtml(title)}</h3>` : ''}
      ${text ? `<p>${escHtml(text)}</p>` : ''}
      ${renderActions(actions, actionsHtml)}
    </div>
  `;
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
  if (!state) return renderEmptyState(PRESETS.filtered);
  return renderEmptyState(state);
}

export const EMPTY_STATE_PRESETS = PRESETS;

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
