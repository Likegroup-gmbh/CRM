const config = {
  table: 'unternehmen',
  displayField: 'firmenname',
  fields: [
    { name: 'firmenname', type: 'string' },
    { name: 'internes_kuerzel', type: 'string' },
    { name: 'branche', type: 'string' },
    { name: 'branche_id', type: 'uuid', relationTable: 'unternehmen_branchen', relationField: 'branche_id' },
    { name: 'ansprechpartner', type: 'string' },
    { name: 'telefonnummer', type: 'string' },
    { name: 'invoice_email', type: 'string' },
    { name: 'rechnungsadresse_strasse', type: 'string' },
    { name: 'rechnungsadresse_hausnummer', type: 'string' },
    { name: 'rechnungsadresse_plz', type: 'string' },
    { name: 'rechnungsadresse_stadt', type: 'string' },
    { name: 'rechnungsadresse_land', type: 'string' },
    { name: 'webseite', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'notiz', type: 'string' },
    { name: 'logo_url', type: 'string' },
    { name: 'logo_path', type: 'string' }
  ],
  relations: {
    branche: { table: 'branchen', foreignKey: 'branche_id', displayField: 'name' }
  },
  manyToMany: {
    branchen: {
      table: 'branchen',
      junctionTable: 'unternehmen_branchen',
      localKey: 'unternehmen_id',
      foreignKey: 'branche_id',
      displayField: 'name'
    },
    ansprechpartner: {
      table: 'ansprechpartner',
      junctionTable: 'ansprechpartner_unternehmen',
      localKey: 'unternehmen_id',
      foreignKey: 'ansprechpartner_id',
      displayField: 'vorname'
    }
  },
  filters: ['firmenname', 'branche_id', 'status', 'rechnungsadresse_stadt', 'rechnungsadresse_land'],
  sortBy: 'created_at',
  sortOrder: 'desc'
};

function buildSelectClause(context) {
  if (context === 'list' || context === 'pagination') {
    return `*,
unternehmen_branchen (
  branche_id,
  branchen (id, name)
)`;
  }
  return '*';
}

async function applyJunctionFilters(query, filters, supabase) {
  try {
    const getIdFromFilter = (val) => {
      if (val == null) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        return val.value || val.id || null;
      }
      return String(val);
    };

    if (filters && filters.branche_id) {
      const selectedId = getIdFromFilter(filters.branche_id);
      console.log('🔍 Filtere Unternehmen nach Branche:', selectedId);

      const { data: links, error: lerr } = await supabase
        .from('unternehmen_branchen')
        .select('unternehmen_id')
        .eq('branche_id', selectedId);

      if (lerr) {
        console.error('❌ Fehler beim Laden der Branchen-Verknüpfungen:', lerr);
      } else {
        const unternehmenIds = (links || []).map(r => r.unternehmen_id).filter(Boolean);
        console.log(`✅ ${unternehmenIds.length} Unternehmen mit Branche ${selectedId} gefunden`);

        if (unternehmenIds.length === 0) {
          return { query, filters, shortCircuit: true };
        }

        query = query.in('id', unternehmenIds);
      }

      delete filters.branche_id;
    }
  } catch (e) {
    console.warn('⚠️ Konnte Unternehmen-Junction-Filter nicht anwenden:', e);
  }
  return { query, filters, shortCircuit: false };
}

function transformResult(data) {
  if (!data) return data;
  data.forEach(unternehmen => {
    if (unternehmen.unternehmen_branchen) {
      unternehmen.branchen = unternehmen.unternehmen_branchen
        .map(ub => ub.branchen)
        .filter(Boolean);
      delete unternehmen.unternehmen_branchen;
      console.log(`📋 Unternehmen ${unternehmen.firmenname}: ${unternehmen.branchen?.length || 0} Branchen geladen`);
    } else {
      unternehmen.branchen = [];
    }
  });
  return data;
}

function skipFieldForSupabase(field, value, entities) {
  if (field === 'branche_id') {
    console.log(`🏷️ Verarbeite ${field}:`, value);
    const fieldConfig = entities?.unternehmen?.fields?.find(f => f.name === field);
    const isRelationField = fieldConfig?.relationTable && fieldConfig?.relationField;
    if (isRelationField) {
      console.log(`🔧 ${field} ist Relation-Field - wird von RelationTables verarbeitet`);
      return true;
    }
  }
  return false;
}

async function transformFieldForSupabase(field, value, supabaseData, supabase) {
  if (field === 'branche_id' && value) {
    supabaseData.branche_id = value;
    console.log(`✅ branche_id gesetzt: ${value}`);

    try {
      const { data: branche, error } = await supabase
        .from('branchen')
        .select('id, name')
        .eq('id', value)
        .single();

      if (!error && branche) {
        supabaseData.branche = branche.name;
        console.log(`✅ branche Namen gesetzt: ${supabaseData.branche}`);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Branche-Namen:', error);
    }
    return true;
  }
  return false;
}

async function extractFilterOptions(data, supabase) {
  const filterOptions = {};

  const allBranchen = new Set();
  data.forEach(item => {
    if (item.branche) {
      allBranchen.add(item.branche);
    }
  });
  filterOptions.branche = Array.from(allBranchen).sort();

  const allStatus = new Set();
  data.forEach(item => {
    if (item.status) {
      allStatus.add(item.status);
    }
  });
  filterOptions.status = Array.from(allStatus).sort();

  const allStaedte = new Set();
  data.forEach(item => {
    if (item.rechnungsadresse_stadt) {
      allStaedte.add(item.rechnungsadresse_stadt);
    }
  });
  filterOptions.rechnungsadresse_stadt = Array.from(allStaedte).sort();

  const allLaender = new Set();
  data.forEach(item => {
    if (item.rechnungsadresse_land) {
      allLaender.add(item.rechnungsadresse_land);
    }
  });
  filterOptions.rechnungsadresse_land = Array.from(allLaender).sort();

  return filterOptions;
}

async function loadExtraFilterData(filterOptions, supabase) {
  try {
    const { data: branchen, error: brError } = await supabase
      .from('branchen')
      .select('id, name, beschreibung')
      .order('name');

    if (!brError && branchen) {
      filterOptions.branche_id = branchen.map(b => ({
        id: b.id,
        name: b.name,
        description: b.beschreibung
      }));
      console.log(`✅ ${branchen.length} Branchen für Unternehmen-Filter geladen`);
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Unternehmen-Filter-Optionen:', error);
  }
  return filterOptions;
}

export default {
  config,
  buildSelectClause,
  applyJunctionFilters,
  transformResult,
  skipFieldForSupabase,
  transformFieldForSupabase,
  extractFilterOptions,
  loadExtraFilterData
};
