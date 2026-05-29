// entityColumnUtils.js
// Gemeinsame Helfer fuer generische Custom Columns (Sourcing/Strategie).
// ID-Konvention: "custom:{uuid}" – identisch zur Kampagne, damit hidden_columns
// und Reihenfolge-Arrays dasselbe Format nutzen.

export const CUSTOM_COL_PREFIX = 'custom:';

export function makeCustomColumnId(uuid) {
  return `${CUSTOM_COL_PREFIX}${uuid}`;
}

export function isCustomColumnId(colId) {
  return typeof colId === 'string' && colId.startsWith(CUSTOM_COL_PREFIX);
}

export function extractCustomColumnUuid(colId) {
  return colId.slice(CUSTOM_COL_PREFIX.length);
}

export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Liefert Custom-Spalten in der gespeicherten Reihenfolge.
 * Reihenfolge-Array enthaelt Eintraege "custom:{uuid}". Nicht enthaltene
 * Spalten werden nach position hinten angehaengt.
 */
export function orderCustomColumns(columns, order) {
  const cols = Array.isArray(columns) ? [...columns] : [];
  if (!Array.isArray(order) || order.length === 0) {
    return cols.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const byUuid = new Map(cols.map(c => [c.id, c]));
  const result = [];
  const used = new Set();

  for (const entry of order) {
    if (!isCustomColumnId(entry)) continue;
    const uuid = extractCustomColumnUuid(entry);
    const col = byUuid.get(uuid);
    if (col) {
      result.push(col);
      used.add(uuid);
    }
  }

  const remaining = cols
    .filter(c => !used.has(c.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return [...result, ...remaining];
}
