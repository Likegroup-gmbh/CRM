const LINK_PAGE = 1000;

export default {
  skipM2MForPagination: true,
  countMode: 'estimated',

  buildSelectClause(context) {
    if (context === 'list') {
      return '*';
    }
    if (context === 'pagination') {
      return `id,vorname,nachname,mail,telefonnummer,telefon_nicht_vorhanden,geschlecht,alter_jahre,alter_min,alter_max,geburtsdatum,hauptplattform,stilbeschreibung,groesse,
instagram,instagram_follower,tiktok,tiktok_follower,ig_connected_at,profilbild_url,profilbild_thumb_url,
portfolio_link,ig_biography,ig_engagement_rate,ig_media_count,ig_recent_posts,ig_brand_mentions,
lieferadresse_stadt,lieferadresse_land,rezension_schnitt,
creator_creator_type(creator_type_id(id,name)),
creator_branchen(branche_id(id,name)),
creator_sprachen(sprachen!sprache_id(id,name)),
creator_management(ist_aktiv, management:management_id(id, firmenname))`;
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
      const idList = (raw) => (Array.isArray(raw) ? raw : [getIdFromFilter(raw)]).filter(Boolean);
      // Mehrere Werte eines Filters: der Creator hat einen davon
      const linkFilter = async (key, table, column, active = false) => {
        const ids = idList(filters?.[key]);
        delete filters[key];
        if (!ids.length) return;
        const found = new Set();
        for (let from = 0; ; from += LINK_PAGE) {
          let linkQuery = supabase.from(table).select('creator_id').in(column, ids);
          if (active) linkQuery = linkQuery.eq('ist_aktiv', true);
          const { data: links, error: lerr } = await linkQuery.order('creator_id').range(from, from + LINK_PAGE - 1);
          if (lerr) return;
          (links || []).forEach(r => found.add(r.creator_id));
          if (!links || links.length < LINK_PAGE) break;
        }
        idSets.push(found);
      };
      if (filters) {
        if (filters.branche && !filters.branche_id) filters.branche_id = filters.branche;
        delete filters.branche;
        await linkFilter('sprache_id', 'creator_sprachen', 'sprache_id');
        await linkFilter('branche_id', 'creator_branchen', 'branche_id');
        await linkFilter('creator_type_id', 'creator_creator_type', 'creator_type_id');
        // Kunde: Creator mit mind. einer Kooperation fuer das Unternehmen
        // (kooperationen.unternehmen_id ist zu 100% befuellt)
        await linkFilter('kunde_id', 'kooperationen', 'unternehmen_id');
        // Management/Firma: nur aktive Verknuepfungen zaehlen
        await linkFilter('management_id', 'creator_management', 'management_id', true);
        await linkFilter('firma_id', 'creator_firma', 'firma_id', true);
      }
      if (filters && filters.besitz_id) {
        for (const selectedId of idList(filters.besitz_id)) {
          const { data: links, error: lerr } = await supabase
            .from('creator_besitz')
            .select('creator_id')
            .eq('besitz_id', selectedId);
          if (!lerr) idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.besitz_id;
      }
      if (filters && filters.favorit_von) {
        const userIds = idList(filters.favorit_von);
        delete filters.favorit_von;
        if (userIds.length) {
          const { data: links, error: lerr } = await supabase
            .from('creator_favoriten')
            .select('creator_id')
            .in('user_id', userIds);
          if (!lerr) idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
      }
      if (filters && filters.creator_tag_id) {
        const tagIds = idList(filters.creator_tag_id);
        delete filters.creator_tag_id;
        for (const selectedId of tagIds) {
          const { data: links, error: lerr } = await supabase
            .from('creator_tags')
            .select('creator_id')
            .eq('tag_id', selectedId);
          if (!lerr) idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
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

  finalizeResult(data) {
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
      // Sprachen aus Junction-Table extrahieren
      if (c.creator_sprachen && Array.isArray(c.creator_sprachen)) {
        c.sprachen = c.creator_sprachen
          .map(j => j.sprachen?.name)
          .filter(Boolean);
        delete c.creator_sprachen;
      } else {
        c.sprachen = c.sprachen || [];
      }
      
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

      if (Array.isArray(c.creator_management)) {
        c.managements = c.creator_management
          .filter(row => row?.ist_aktiv !== false && row?.management?.firmenname)
          .map(row => row.management.firmenname);
        delete c.creator_management;
      } else {
        c.managements = c.managements || [];
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
    if (field === 'management_id' || field === 'management_ids' || field === 'management_ids[]') {
      return true;
    }
    if (field === 'firma_ids' || field === 'firma_ids[]') {
      return true;
    }
    if (field === 'besitz_ids' || field === 'besitz_ids[]') {
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

  async loadFilterDataOverride(supabase) {
    const filterOptions = {};

    try {
      const [creatorResult, ctResult, spResult, brResult, unResult] = await Promise.all([
        supabase.from('creator').select('lieferadresse_stadt,lieferadresse_land,instagram_follower'),
        supabase.from('creator_type').select('id, name').order('name'),
        supabase.from('sprachen').select('id, name').order('name'),
        supabase.from('branchen_creator').select('id, name').order('name'),
        supabase.from('unternehmen').select('id, firmenname').order('firmenname'),
      ]);

      if (!ctResult.error && ctResult.data) {
        const options = ctResult.data.map(ct => ({ id: ct.id, name: ct.name }));
        filterOptions.creator_type = options;
        filterOptions.creator_type_id = options;
      }
      if (!spResult.error && spResult.data) {
        const options = spResult.data.map(s => ({ id: s.id, name: s.name }));
        filterOptions.sprache = options;
        filterOptions.sprache_id = options;
      }
      if (!brResult.error && brResult.data) {
        const options = brResult.data.map(b => ({ id: b.id, name: b.name }));
        filterOptions.branche = options;
        filterOptions.branche_id = options;
      }
      if (!unResult.error && unResult.data) {
        // Analog zu Sprache/Branche: der Filter-Dropdown liest opt.name.
        // firmenname wird deshalb als name abgelegt.
        filterOptions.kunde_id = unResult.data.map(u => ({ id: u.id, name: u.firmenname }));
      }

      const data = creatorResult.data || [];

      const followerValues = data
        .map(item => item.instagram_follower)
        .filter(follower => follower && follower > 0)
        .sort((a, b) => a - b);

      if (followerValues.length > 0) {
        filterOptions.instagram_follower_min = Math.min(...followerValues);
        filterOptions.instagram_follower_max = Math.max(...followerValues);
      }

      const allStaedte = new Set();
      data.forEach(item => {
        if (item.lieferadresse_stadt) allStaedte.add(item.lieferadresse_stadt);
      });
      filterOptions.lieferadresse_stadt = Array.from(allStaedte).sort();

      const allLaender = new Set();
      data.forEach(item => {
        if (item.lieferadresse_land) allLaender.add(item.lieferadresse_land);
      });
      filterOptions.lieferadresse_land = Array.from(allLaender).sort();
    } catch (error) {
      console.error('❌ Fehler beim Laden der Creator-Filter-Optionen:', error);
    }

    return filterOptions;
  },
};
