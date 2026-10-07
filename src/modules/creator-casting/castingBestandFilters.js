// castingBestandFilters.js
// Uebersetzt Suche und Sortierung von Creator Casting in die Argumente der
// RPC get_casting_bestand. Es gibt bewusst keine Filter-Chips mehr; die RPC
// kann p_filters weiterhin vollstaendig, die Liste sendet nur den Namen.

/** Sortierbare Spalten, Schluessel entsprechen p_sort der RPC. */
export const CASTING_BESTAND_SORT_FIELDS = [
  'name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen', 'marken', 'zuletzt'
];

/** Erste Klickrichtung: Namen aufsteigend, Zaehler und Datum absteigend (groesste zuerst). */
export function defaultSortAscending(field) {
  return field === 'name';
}

/**
 * @param {Object} [_activeFilters] - ungenutzt, bleibt fuer die Aufrufer-Signatur
 * @param {string} [searchQuery] - Suchfeld, wirkt wie der Namensfilter
 * @returns {Object} p_filters fuer get_casting_bestand
 */
export function buildCastingBestandFilters(_activeFilters = {}, searchQuery = '') {
  const suche = String(searchQuery || '').trim();
  return suche ? { name: suche } : {};
}

/** currentSort ({ field, ascending }) -> p_sort/p_ascending der RPC. Unbekannte Felder fallen auf "zuletzt". */
export function castingBestandSort(sort = {}) {
  const known = CASTING_BESTAND_SORT_FIELDS.includes(sort.field);
  return {
    p_sort: known ? sort.field : 'zuletzt',
    p_ascending: !!sort.ascending
  };
}
