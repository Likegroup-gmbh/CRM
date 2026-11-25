// tableStates.js
// Reine Funktionen für Zustandszeilen einer Tabelle (leer / Fehler).
// Geben HTML zurück, fassen weder DOM noch Listen-State an.

import { resolveEmptyState } from '../components/EmptyState.js';

/**
 * Zeile für den Empty-State (filter-aware).
 * @param {Object} params
 * @param {number|string} params.colspan - Spaltenanzahl der Tabelle
 * @param {boolean} params.hasActiveFilters - Filter oder Suche aktiv
 * @param {Object} params.state - Empty-State ohne aktive Filter (siehe EmptyState.js)
 * @returns {string} HTML einer einzelnen <tr>
 */
export function renderEmptyRow({ colspan, hasActiveFilters, state }) {
  const html = resolveEmptyState({
    hasActiveFilters,
    states: { default: state }
  }, 'default');
  return `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
}

/**
 * Zeile für einen Ladefehler.
 * @param {Object} params
 * @param {number|string} params.colspan - Spaltenanzahl der Tabelle
 * @param {string} [params.message] - Fehlermeldung
 * @returns {string} HTML einer einzelnen <tr>
 */
export function renderErrorRow({ colspan, message }) {
  return `
        <tr>
          <td colspan="${colspan}" class="table-state-cell table-state-cell--error">
            Fehler beim Laden: ${message || 'Unbekannter Fehler'}
          </td>
        </tr>
      `;
}
