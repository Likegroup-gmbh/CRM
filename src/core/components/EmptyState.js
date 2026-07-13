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
  search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
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
