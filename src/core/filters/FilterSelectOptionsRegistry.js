// FilterSelectOptionsRegistry.js
// Registry für entitäts-spezifische Select-Option-Loader.
// Neue Entity-Typen registrieren sich hier (oder in src/modules/{entity}/filters/).

const selectOptionsLoaders = new Map();

export function registerSelectOptionsLoader(entityType, filterId, loaderFn) {
  selectOptionsLoaders.set(`${entityType}:${filterId}`, loaderFn);
}

export function getSelectOptionsLoader(entityType, filterId) {
  return selectOptionsLoaders.get(`${entityType}:${filterId}`) || null;
}

/**
 * Factory: Loader für unique Non-Null-Werte eines einzelnen Feldes.
 * Gibt { value, label } zurück, wobei value === label.
 */
export function createUniqueFieldLoader(tableName, fieldName) {
  return async ({ supabase }) => {
    const { data, error } = await supabase
      .from(tableName)
      .select(fieldName)
      .not(fieldName, 'is', null)
      .order(fieldName);

    if (error || !data) return [];

    const unique = new Set();
    data.forEach(item => { if (item[fieldName]) unique.add(item[fieldName]); });

    return Array.from(unique)
      .map(name => ({ value: name, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
}

/**
 * Factory: Loader für Junction-Table-basierte Optionen (z.B. Branchen).
 * @param {string} junctionTable - Name der Junction-Tabelle
 * @param {string} selectQuery - Supabase select()-Query mit Join
 * @param {Function} extractFn - (row) => { id, name } | null
 */
export function createJunctionLoader(junctionTable, selectQuery, extractFn) {
  return async ({ supabase }) => {
    const { data, error } = await supabase
      .from(junctionTable)
      .select(selectQuery);

    if (error || !data) return [];

    const unique = new Map();
    data.forEach(item => {
      const extracted = extractFn(item);
      if (extracted) unique.set(extracted.id, extracted.name);
    });

    return Array.from(unique.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
}

// ---------------------------------------------------------------------------
// Registrierte Loader — ehemals die if/else-Kette in renderFilterSubmenu
// ---------------------------------------------------------------------------

// Unternehmen
registerSelectOptionsLoader('unternehmen', 'branche_id', createJunctionLoader(
  'unternehmen_branchen',
  'branche_id, branchen ( id, name )',
  item => item.branchen ? { id: item.branchen.id, name: item.branchen.name } : null
));
registerSelectOptionsLoader('unternehmen', 'firmenname',
  createUniqueFieldLoader('unternehmen', 'firmenname'));
registerSelectOptionsLoader('unternehmen', 'rechnungsadresse_stadt',
  createUniqueFieldLoader('unternehmen', 'rechnungsadresse_stadt'));
registerSelectOptionsLoader('unternehmen', 'rechnungsadresse_land',
  createUniqueFieldLoader('unternehmen', 'rechnungsadresse_land'));

// Marke
registerSelectOptionsLoader('marke', 'branche_id', createJunctionLoader(
  'marke_branchen',
  'branche_id, branche:branche_id ( id, name )',
  item => item.branche ? { id: item.branche.id, name: item.branche.name } : null
));
registerSelectOptionsLoader('marke', 'markenname',
  createUniqueFieldLoader('marke', 'markenname'));

// Auftrag
registerSelectOptionsLoader('auftrag', 'auftragsname',
  createUniqueFieldLoader('auftrag', 'auftragsname'));

// Auftragsdetails (nutzt dieselbe Tabelle wie Auftrag)
registerSelectOptionsLoader('auftragsdetails', 'auftragsname',
  createUniqueFieldLoader('auftrag', 'auftragsname'));
