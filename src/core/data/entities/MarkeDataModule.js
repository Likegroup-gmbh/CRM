const config = {
  table: 'marke',
  displayField: 'markenname',
  fields: {
    markenname: 'string',
    unternehmen_id: 'uuid',
    webseite: 'string',
    branche: 'string',
    branche_id: 'uuid',
    created_at: 'date',
    updated_at: 'date',
    logo_url: 'string',
    logo_path: 'string'
  },
  relations: {
    unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' }
  },
  manyToMany: {
    branchen: {
      table: 'branchen',
      junctionTable: 'marke_branchen',
      localKey: 'marke_id',
      foreignKey: 'branche_id',
      displayField: 'name'
    },
    ansprechpartner: {
      table: 'ansprechpartner',
      junctionTable: 'ansprechpartner_marke',
      localKey: 'marke_id',
      foreignKey: 'ansprechpartner_id',
      displayField: 'id,vorname,nachname,email'
    }
  },
  filters: ['markenname', 'unternehmen_id', 'branche_id'],
  sortBy: 'created_at',
  sortOrder: 'desc'
};

function buildSelectClause(context) {
  return `*,
unternehmen:unternehmen_id (
  id,
  firmenname,
  logo_url
)`;
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
      console.log('🔍 Filtere Marken nach Branche:', selectedId);

      const { data: links, error: lerr } = await supabase
        .from('marke_branchen')
        .select('marke_id')
        .eq('branche_id', selectedId);

      if (lerr) {
        console.error('❌ Fehler beim Laden der Marken-Branchen-Verknüpfungen:', lerr);
      } else {
        const markeIds = (links || []).map(r => r.marke_id).filter(Boolean);
        console.log(`✅ ${markeIds.length} Marken mit Branche ${selectedId} gefunden`);

        if (markeIds.length === 0) {
          return { query, filters, shortCircuit: true };
        }

        query = query.in('id', markeIds);
      }

      delete filters.branche_id;
    }
  } catch (e) {
    console.warn('⚠️ Konnte Marken-Junction-Filter nicht anwenden:', e);
  }
  return { query, filters, shortCircuit: false };
}

function skipFieldForSupabase(field, value) {
  if (field === 'branche_id' || field === 'branche_id[]') {
    console.log(`🏷️ Verarbeite ${field} für Marke:`, value);
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

  const unternehmenIds = [...new Set(data.map(item => item.unternehmen_id).filter(Boolean))];
  if (unternehmenIds.length > 0) {
    try {
      const { data: unternehmen, error } = await supabase
        .from('unternehmen')
        .select('id, firmenname')
        .in('id', unternehmenIds);

      if (!error && unternehmen) {
        filterOptions.unternehmen_id = unternehmen.map(u => ({
          value: u.id,
          label: u.firmenname
        }));
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen für Marken-Filter:', error);
    }
  }

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
      console.log(`✅ ${branchen.length} Branchen für Marke-Filter geladen`);
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Marke-Filter-Optionen:', error);
  }
  return filterOptions;
}

export default {
  config,
  buildSelectClause,
  applyJunctionFilters,
  skipFieldForSupabase,
  extractFilterOptions,
  loadExtraFilterData
};
