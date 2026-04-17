const config = {
  table: 'ansprechpartner',
  displayField: 'vorname',
  fields: {
    vorname: 'string',
    nachname: 'string',
    unternehmen_id: 'uuid',
    position_id: 'uuid',
    email: 'string',
    telefonnummer: 'string',
    telefonnummer_land_id: 'uuid',
    telefonnummer_office: 'string',
    telefonnummer_office_land_id: 'uuid',
    linkedin: 'string',
    stadt: 'string',
    land_id: 'uuid',
    geburtsdatum: 'date',
    sprache_id: 'uuid',
    notiz: 'string',
    erlaubt_updates: 'toggle',
    erlaubt_newsletter: 'toggle',
    erlaubt_webinare: 'toggle'
  },
  relations: {
    unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
    sprache: { table: 'sprachen', foreignKey: 'sprache_id', displayField: 'name' },
    position: { table: 'positionen', foreignKey: 'position_id', displayField: 'name' },
    telefonnummer_land: { table: 'eu_laender', foreignKey: 'telefonnummer_land_id', displayField: 'name_de' },
    telefonnummer_office_land: { table: 'eu_laender', foreignKey: 'telefonnummer_office_land_id', displayField: 'name_de' },
    land: { table: 'eu_laender', foreignKey: 'land_id', displayField: 'name_de' }
  },
  manyToMany: {
    unternehmen: {
      table: 'unternehmen',
      junctionTable: 'ansprechpartner_unternehmen',
      localKey: 'ansprechpartner_id',
      foreignKey: 'unternehmen_id',
      displayField: 'firmenname'
    },
    marken: {
      table: 'marke',
      junctionTable: 'ansprechpartner_marke',
      localKey: 'ansprechpartner_id',
      foreignKey: 'marke_id',
      displayField: 'markenname'
    },
    sprachen: {
      table: 'sprachen',
      junctionTable: 'ansprechpartner_sprache',
      localKey: 'ansprechpartner_id',
      foreignKey: 'sprache_id',
      displayField: 'name'
    }
  },
  filters: ['vorname', 'nachname', 'position_id', 'unternehmen_id', 'stadt', 'sprache_id'],
  sortBy: 'created_at',
  sortOrder: 'desc'
};

function buildSelectClause(context) {
  if (context === 'list') {
    return `*,
unternehmen:unternehmen_id (id, firmenname, logo_url),
sprache:sprache_id (id, name),
positionen:position_id (id, name),
telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl),
ansprechpartner_unternehmen (unternehmen:unternehmen_id (id, firmenname, internes_kuerzel, logo_url)),
ansprechpartner_marke (marke:marke_id (id, markenname, logo_url))`;
  }

  if (context === 'pagination') {
    return `*,
sprache:sprache_id (id, name),
positionen:position_id (id, name),
telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl),
land:eu_laender!land_id (id, name_de, iso_code),
ansprechpartner_marke (marke:marke_id (id, markenname, logo_url)),
ansprechpartner_unternehmen (unternehmen:unternehmen_id (id, firmenname, internes_kuerzel, logo_url)),
kunde_ansprechpartner (kunde_id)`;
  }

  return '*';
}

async function applyJunctionFilters(query, filters, supabase) {
  if (filters && filters._allowedIds && Array.isArray(filters._allowedIds)) {
    query = query.in('id', filters._allowedIds);
    delete filters._allowedIds;
  }

  if (filters && filters.sprache_id) {
    const selectedLanguageId = String(filters.sprache_id);
    const { data: apLangLinks, error: apLangErr } = await supabase
      .from('ansprechpartner_sprache')
      .select('ansprechpartner_id')
      .eq('sprache_id', selectedLanguageId);
    if (apLangErr) {
      console.error('❌ Fehler beim Laden der Sprach-Verknüpfungen:', apLangErr);
    }
    const apIds = (apLangLinks || []).map(r => r.ansprechpartner_id).filter(Boolean);
    if (apIds.length === 0) {
      return { query, filters, shortCircuit: true };
    }
    query = query.in('id', apIds);
    delete filters.sprache_id;
  }
  return { query, filters, shortCircuit: false };
}

function transformResult(data) {
  if (!data) return data;
  data.forEach(ap => {
    if (ap.ansprechpartner_unternehmen) {
      ap.unternehmen = ap.ansprechpartner_unternehmen
        .map(au => au.unternehmen)
        .filter(Boolean);
      delete ap.ansprechpartner_unternehmen;
    } else if (!Array.isArray(ap.unternehmen)) {
      ap.unternehmen = ap.unternehmen ? [ap.unternehmen] : [];
    }

    if (ap.ansprechpartner_marke) {
      ap.marken = ap.ansprechpartner_marke
        .map(am => am.marke)
        .filter(Boolean);
      delete ap.ansprechpartner_marke;
    } else {
      ap.marken = [];
    }

    console.log(`📋 Ansprechpartner ${ap.vorname} ${ap.nachname}: ${ap.unternehmen?.length || 0} Unternehmen, ${ap.marken?.length || 0} Marken`);
  });
  return data;
}

function transformPaginationResult(data) {
  if (!data) return data;
  data.forEach(ap => {
    if (ap.ansprechpartner_marke && Array.isArray(ap.ansprechpartner_marke)) {
      ap.marken = ap.ansprechpartner_marke
        .map(junction => junction.marke)
        .filter(Boolean);
      delete ap.ansprechpartner_marke;
    } else {
      ap.marken = [];
    }

    const unternehmenList = [];
    if (ap.ansprechpartner_unternehmen && Array.isArray(ap.ansprechpartner_unternehmen)) {
      ap.ansprechpartner_unternehmen.forEach(junction => {
        if (junction.unternehmen) {
          unternehmenList.push(junction.unternehmen);
        }
      });
      delete ap.ansprechpartner_unternehmen;
    }
    ap.unternehmen = unternehmenList;

    ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
    delete ap.kunde_ansprechpartner;
  });
  return data;
}

function skipFieldForSupabase(field, value) {
  if (field === 'marke_ids' || field === 'marke_ids[]') {
    console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
    return true;
  }
  if (field === 'sprachen_ids' || field === 'sprachen_ids[]') {
    console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
    return true;
  }
  return false;
}

function transformFieldForSupabase(field, value, supabaseData) {
  if (field === 'unternehmen_id') {
    if (Array.isArray(value)) {
      supabaseData.unternehmen_id = value[0];
      console.log(`📦 unternehmen_id war Array, extrahiere für Haupttabelle: ${supabaseData.unternehmen_id}`);
    } else {
      supabaseData.unternehmen_id = value;
    }
    return true;
  }
  return false;
}

async function extractFilterOptions(data, supabase) {
  const filterOptions = {};

  try {
    const { data: positionen, error } = await supabase
      .from('positionen')
      .select('id, name')
      .order('sort_order, name');
    if (!error && positionen) {
      filterOptions.position_id = positionen.map(p => ({
        value: p.id,
        label: p.name
      }));
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Positionen für Ansprechpartner-Filter:', error);
  }

  try {
    const { data: sprachen, error } = await supabase
      .from('sprachen')
      .select('id, name')
      .order('name');
    if (!error && sprachen) {
      filterOptions.sprache_id = sprachen.map(s => ({
        value: s.id,
        label: s.name
      }));
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Sprachen für Ansprechpartner-Filter:', error);
  }

  const allStaedte = new Set();
  data.forEach(item => {
    if (item.stadt) {
      allStaedte.add(item.stadt);
    }
  });
  filterOptions.stadt = Array.from(allStaedte).sort();

  try {
    const { data: unternehmen, error } = await supabase
      .from('unternehmen')
      .select('id, firmenname')
      .order('firmenname');
    if (!error && unternehmen) {
      filterOptions.unternehmen_id = unternehmen.map(u => ({
        value: u.id,
        label: u.firmenname
      }));
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Unternehmen für Ansprechpartner-Filter:', error);
  }

  return filterOptions;
}

export default {
  config,
  buildSelectClause,
  applyJunctionFilters,
  transformResult,
  transformPaginationResult,
  skipFieldForSupabase,
  transformFieldForSupabase,
  extractFilterOptions
};
