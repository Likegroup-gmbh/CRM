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
 * Normalisiert einen Eintrag aus dem Reihenfolge-Array auf { id, after }.
 * Erlaubt sind reine Strings ("custom:{uuid}", ohne Anker) und Objekte
 * ({ id, after }), bei denen `after` die Standardspalte davor benennt.
 * @returns {{id: string, after: string|null}|null}
 */
export function parseOrderEntry(entry) {
  if (isCustomColumnId(entry)) return { id: entry, after: null };
  if (entry && typeof entry === 'object' && isCustomColumnId(entry.id)) {
    const after = typeof entry.after === 'string' && entry.after ? entry.after : null;
    return { id: entry.id, after };
  }
  return null;
}

/**
 * Liefert Custom-Spalten in der gespeicherten Reihenfolge.
 * Nicht enthaltene Spalten werden nach position hinten angehaengt.
 * Der Anker aus Objekt-Eintraegen landet als `_anchor` an der Spalte.
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
    const parsed = parseOrderEntry(entry);
    if (!parsed) continue;
    const uuid = extractCustomColumnUuid(parsed.id);
    const col = byUuid.get(uuid);
    if (col && !used.has(uuid)) {
      result.push({ ...col, _anchor: parsed.after });
      used.add(uuid);
    }
  }

  const remaining = cols
    .filter(c => !used.has(c.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(c => ({ ...c, _anchor: null }));

  return [...result, ...remaining];
}

/**
 * Gruppiert geordnete Spalten nach ihrem Anker.
 * @param {Array} orderedCols  Ergebnis von orderCustomColumns
 * @param {string[]} [knownAnchors]  gueltige Standardspalten. Unbekannte Anker
 *   fallen ans Tabellenende zurueck, damit entfernte Spalten nichts verstecken.
 * @returns {{byAnchor: Map<string, Array>, trailing: Array}}
 */
export function groupCustomColumnsByAnchor(orderedCols, knownAnchors) {
  const byAnchor = new Map();
  const trailing = [];
  const valid = Array.isArray(knownAnchors) ? new Set(knownAnchors) : null;

  for (const col of orderedCols || []) {
    const anchor = col?._anchor;
    if (!anchor || (valid && !valid.has(anchor))) {
      trailing.push(col);
      continue;
    }
    if (!byAnchor.has(anchor)) byAnchor.set(anchor, []);
    byAnchor.get(anchor).push(col);
  }

  return { byAnchor, trailing };
}

/** Serialisiert eine Spalte zurueck in einen Eintrag fuer custom_column_order. */
export function toOrderEntry(colId, anchor) {
  return anchor ? { id: colId, after: anchor } : colId;
}
