export default {
  config: {
    table: 'creator',
    displayField: 'vorname',
    fields: {
      vorname: 'string',
      nachname: 'string',
      instagram: 'string',
      instagram_follower: 'number',
      tiktok: 'string',
      tiktok_follower: 'number',
      telefonnummer: 'string',
      mail: 'string',
      portfolio_link: 'string',
      budget_letzte_buchung: 'number',
      lieferadresse_strasse: 'string',
      lieferadresse_hausnummer: 'string',
      lieferadresse_plz: 'string',
      lieferadresse_stadt: 'string',
      lieferadresse_land: 'string',
      rechnungsadresse_abweichend: 'boolean',
      rechnungsadresse_strasse: 'string',
      rechnungsadresse_hausnummer: 'string',
      rechnungsadresse_plz: 'string',
      rechnungsadresse_stadt: 'string',
      rechnungsadresse_land: 'string',
      notiz: 'string',
      geschlecht: 'string',
      alter_jahre: 'number',
      alter_min: 'number',
      alter_max: 'number',
      hat_haustier: 'boolean',
      umsatzsteuerpflichtig: 'boolean',
      haustier_beschreibung: 'string'
    },
    relations: {},
    manyToMany: {
      sprachen: {
        table: 'sprachen',
        junctionTable: 'creator_sprachen',
        localKey: 'creator_id',
        foreignKey: 'sprache_id',
        displayField: 'name'
      },
      branchen: {
        table: 'branchen_creator',
        junctionTable: 'creator_branchen',
        localKey: 'creator_id',
        foreignKey: 'branche_id',
        displayField: 'name'
      },
      creator_types: {
        table: 'creator_type',
        junctionTable: 'creator_creator_type',
        localKey: 'creator_id',
        foreignKey: 'creator_type_id',
        displayField: 'name'
      }
    },
    filters: ['vorname', 'nachname'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  buildSelectClause(context) {
    if (context === 'list') {
      return '*';
    }
    if (context === 'pagination') {
      return `id,vorname,nachname,mail,telefonnummer,alter_jahre,alter_min,alter_max,
instagram,instagram_follower,tiktok,tiktok_follower,
lieferadresse_stadt,lieferadresse_land,
creator_creator_type(creator_type_id(id,name)),
creator_branchen(branche_id(id,name))`;
    }
    return '*';
  },

  async applyJunctionFilters(query, filters, supabase) {
    try {
      let idSets = [];
      const getIdFromFilter = (val) => {
        if (val == null) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
          return val.value || val.id || null;
        }
        return String(val);
      };
      // Sprache
      if (filters && filters.sprache_id) {
        const selectedId = getIdFromFilter(filters.sprache_id);
        const { data: links, error: lerr } = await supabase
          .from('creator_sprachen')
          .select('creator_id')
          .eq('sprache_id', selectedId);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.sprache_id;
      }
      // Branche
      if (filters && (filters.branche_id || filters.branche)) {
        const selectedId = getIdFromFilter(filters.branche_id || filters.branche);
        const { data: links, error: lerr } = await supabase
          .from('creator_branchen')
          .select('creator_id')
          .eq('branche_id', selectedId);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.branche_id;
        delete filters.branche;
      }
      // Creator-Typ
      if (filters && filters.creator_type_id) {
        const selectedId = getIdFromFilter(filters.creator_type_id);
        const { data: links, error: lerr } = await supabase
          .from('creator_creator_type')
          .select('creator_id')
          .eq('creator_type_id', selectedId);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.creator_type_id;
      }
      // Schnittmenge bilden
      if (idSets.length > 0) {
        let intersection = idSets[0];
        for (let i = 1; i < idSets.length; i++) {
          intersection = new Set([...intersection].filter(x => idSets[i].has(x)));
        }
        const ids = [...intersection];
        if (ids.length === 0) {
          return { query, filters, shortCircuit: true };
        }
        query = query.in('id', ids);
      }
    } catch (e) {
      console.warn('⚠️ Konnte Creator-Junction-Filter nicht anwenden:', e);
    }
    return { query, filters, shortCircuit: false };
  },

  transformResult(data) {
    if (!data) return data;
    data.forEach(c => {
      c.sprachen = c.sprachen || [];
      c.branchen = c.branchen || [];
      c.creator_types = c.creator_types || [];
    });
    return data;
  },

  transformPaginationResult(data) {
    if (!data) return data;
    data.forEach(c => {
      c.sprachen = c.sprachen || [];
      
      // Branchen aus Junction-Table extrahieren
      if (c.creator_branchen && Array.isArray(c.creator_branchen)) {
        c.branchen = c.creator_branchen
          .map(junction => junction.branche_id?.name)
          .filter(Boolean);
        delete c.creator_branchen;
      } else {
        c.branchen = c.branchen || [];
      }
      
      // Creator Types aus Junction-Table extrahieren
      if (c.creator_creator_type && Array.isArray(c.creator_creator_type)) {
        c.creator_types = c.creator_creator_type
          .map(junction => junction.creator_type_id?.name)
          .filter(Boolean);
        delete c.creator_creator_type;
      } else {
        c.creator_types = c.creator_types || [];
      }
    });
    return data;
  },

  skipFieldForSupabase(field, value) {
    // M:N Felder
    if (
      field === 'sprachen_ids' || field === 'sprachen_ids[]' ||
      field === 'branchen_ids' || field === 'branchen_ids[]' ||
      field === 'creator_type_ids' || field === 'creator_type_ids[]'
    ) {
      console.log(`🏷️ Verarbeite ${field} für Creator:`, value);
      return true;
    }
    // Agentur-Felder (werden in separater Tabelle gespeichert)
    if (
      field === 'agentur_vertreten' ||
      field === 'agentur_name' ||
      field === 'agentur_adresse' ||
      field === 'agentur_vertretung'
    ) {
      console.log(`🏢 Überspringe Agentur-Feld ${field} für Haupttabelle (wird in creator_agentur gespeichert)`);
      return true;
    }
    return false;
  },

  transformFieldValue(field, value) {
    if (field === 'instagram_follower' || field === 'tiktok_follower') {
      if (value && typeof value === 'string') {
        const followerRangeToInt = {
          '0-2500': 2500,
          '2500-5000': 5000,
          '5000-10000': 10000,
          '10000-25000': 25000,
          '25000-50000': 50000,
          '50000-100000': 100000,
          '100000-250000': 250000,
          '250000-500000': 500000,
          '500000-1000000': 1000000,
          '1000000+': 1500000
        };
        const converted = followerRangeToInt[value] || null;
        console.log(`🔢 Konvertiere ${field}: "${value}" → ${converted}`);
        return { value: converted, handled: true };
      }
    }
    return { value, handled: false };
  },

  async extractFilterOptions(data, supabase) {
    const filterOptions = {};

    try {
      const { data: creatorTypes, error: ctError } = await supabase
        .from('creator_type')
        .select('id, name')
        .order('name');
      
      if (!ctError && creatorTypes) {
        const options = creatorTypes.map(ct => ({ id: ct.id, name: ct.name }));
        filterOptions.creator_type = options;
        filterOptions.creator_type_id = options;
      }

      const { data: sprachen, error: spError } = await supabase
        .from('sprachen')
        .select('id, name')
        .order('name');
      
      if (!spError && sprachen) {
        const options = sprachen.map(s => ({ id: s.id, name: s.name }));
        filterOptions.sprache = options;
        filterOptions.sprache_id = options;
      }

      const { data: branchen, error: brError } = await supabase
        .from('branchen_creator')
        .select('id, name')
        .order('name');
      
      if (!brError && branchen) {
        const options = branchen.map(b => ({ id: b.id, name: b.name }));
        filterOptions.branche = options;
        filterOptions.branche_id = options;
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Filter-Optionen:', error);
    }

    // Instagram Follower Range
    const followerValues = data
      .map(item => item.instagram_follower)
      .filter(follower => follower && follower > 0)
      .sort((a, b) => a - b);
    
    if (followerValues.length > 0) {
      filterOptions.instagram_follower_min = Math.min(...followerValues);
      filterOptions.instagram_follower_max = Math.max(...followerValues);
    }

    // Stadt
    const allStaedte = new Set();
    data.forEach(item => {
      if (item.lieferadresse_stadt) {
        allStaedte.add(item.lieferadresse_stadt);
      }
    });
    filterOptions.lieferadresse_stadt = Array.from(allStaedte).sort();

    // Land
    const allLaender = new Set();
    data.forEach(item => {
      if (item.lieferadresse_land) {
        allLaender.add(item.lieferadresse_land);
      }
    });
    filterOptions.lieferadresse_land = Array.from(allLaender).sort();

    return filterOptions;
  },

  async loadExtraFilterData(filterOptions, supabase) {
    try {
      const { data: creatorTypes, error: ctError } = await supabase
        .from('creator_type')
        .select('id, name')
        .order('name');
      
      if (!ctError && creatorTypes) {
        filterOptions.creator_type_id = creatorTypes.map(ct => ({ id: ct.id, name: ct.name }));
      }

      const { data: sprachen, error: spError } = await supabase
        .from('sprachen')
        .select('id, name')
        .order('name');
      
      if (!spError && sprachen) {
        filterOptions.sprache_id = sprachen.map(s => ({ id: s.id, name: s.name }));
      }

      const { data: branchen, error: brError } = await supabase
        .from('branchen_creator')
        .select('id, name')
        .order('name');
      
      if (!brError && branchen) {
        filterOptions.branche_id = branchen.map(b => ({ id: b.id, name: b.name }));
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Creator-Filter-Optionen:', error);
    }
    return filterOptions;
  },
};
