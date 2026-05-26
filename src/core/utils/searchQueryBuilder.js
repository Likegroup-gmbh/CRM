// searchQueryBuilder.js
// Baut Supabase-kompatible OR-Clauses aus der LIST_SEARCH_CONFIG.
// Wird von Services/DataLoaders genutzt um Multi-Spalten-Suche server-seitig auszufuehren.

function escapeIlike(q) {
  if (!q || typeof q !== 'string') return '';
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Wendet einen Suchfilter auf eine Supabase-Query an.
 * Baut eine OR-Clause ueber alle konfigurierten Felder.
 *
 * @param {Object} supabaseQuery - Supabase query builder
 * @param {Object} searchConfig - { query, fields, relations? }
 * @param {string} searchConfig.query - Der Suchbegriff
 * @param {string[]} searchConfig.fields - Direkte Felder der Tabelle
 * @param {Array} [searchConfig.relations] - Verknuepfte Tabellen (werden als embedded filters gebaut)
 * @returns {Object} Modifizierte Supabase-Query
 */
export function applySearchFilter(supabaseQuery, searchConfig) {
  if (!searchConfig?.query || !searchConfig.fields?.length) {
    return supabaseQuery;
  }

  const term = searchConfig.query.trim();
  if (!term) return supabaseQuery;

  const pattern = `%${escapeIlike(term)}%`;

  const directClauses = searchConfig.fields
    .map(f => `${f}.ilike.${pattern}`)
    .join(',');

  const relationClauses = (searchConfig.relations || [])
    .flatMap(rel => {
      const alias = rel.table;
      return rel.fields.map(f => `${alias}.${f}.ilike.${pattern}`);
    });

  const allClauses = relationClauses.length > 0
    ? `${directClauses},${relationClauses.join(',')}`
    : directClauses;

  return supabaseQuery.or(allClauses);
}

/**
 * Baut nur den OR-String (ohne ihn auf eine Query anzuwenden).
 * Nuetzlich fuer RPC-basierte Listen die den Filter anders uebergeben.
 */
export function buildSearchOrClause(searchConfig) {
  if (!searchConfig?.query || !searchConfig.fields?.length) {
    return null;
  }

  const term = searchConfig.query.trim();
  if (!term) return null;

  const pattern = `%${escapeIlike(term)}%`;

  return searchConfig.fields
    .map(f => `${f}.ilike.${pattern}`)
    .join(',');
}

export { escapeIlike };
