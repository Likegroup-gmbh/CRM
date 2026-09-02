// FilterSelectOptionsRegistry.js
// Registry für entitäts-spezifische Select-Option-Loader.
// Neue Entity-Typen registrieren sich hier (oder in src/modules/{entity}/filters/).

import { ProduktService } from '../../modules/produkt/ProduktService.js';

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

registerSelectOptionsLoader('produkt', 'unternehmen_id', async ({ supabase }) => {
  const scope = await ProduktService.getAllowedProduktScopeForUser(window.currentUser?.id);
  let query = supabase.from('unternehmen').select('id, firmenname').order('firmenname');
  if (!scope.all) {
    const companyIds = new Set(scope.unrestrictedCompanyIds || []);
    if (scope.restrictedBrandIds?.length) {
      const { data: marken } = await supabase
        .from('marke')
        .select('unternehmen_id')
        .in('id', scope.restrictedBrandIds);
      (marken || []).forEach(m => { if (m.unternehmen_id) companyIds.add(m.unternehmen_id); });
    }
    if (!companyIds.size) return [];
    query = query.in('id', [...companyIds]);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(u => ({ value: u.id, label: u.firmenname }));
});

registerSelectOptionsLoader('produkt', 'marke_id', async ({ supabase }) => {
  const scope = await ProduktService.getAllowedProduktScopeForUser(window.currentUser?.id);
  let query = supabase.from('marke').select('id, markenname').order('markenname');
  if (!scope.all) {
    const markeIds = new Set(scope.restrictedBrandIds || []);
    if (scope.unrestrictedCompanyIds?.length) {
      const { data: marken } = await supabase
        .from('marke')
        .select('id')
        .in('unternehmen_id', scope.unrestrictedCompanyIds);
      (marken || []).forEach(m => { if (m.id) markeIds.add(m.id); });
    }
    if (!markeIds.size) return [];
    query = query.in('id', [...markeIds]);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(m => ({ value: m.id, label: m.markenname }));
});
