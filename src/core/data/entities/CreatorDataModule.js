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
      // Kunde: Creator, die mind. eine Kooperation fuer dieses Unternehmen
      // haben. kooperationen.unternehmen_id ist zu 100% befuellt, deshalb
      // reicht der direkte Join, kein Fallback ueber kampagne.unternehmen_id
      if (filters && filters.kunde_id) {
        const selectedId = getIdFromFilter(filters.kunde_id);
        const { data: links, error: lerr } = await supabase
          .from('kooperationen')
          .select('creator_id')
          .eq('unternehmen_id', selectedId);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.kunde_id;
      }
      // Management: nur aktive Verknuepfungen zaehlen, damit beendete
      // Vertretungen den Creator nicht mehr im Filter auftauchen lassen
      if (filters && filters.management_id) {
        const selectedId = getIdFromFilter(filters.management_id);
        const { data: links, error: lerr } = await supabase
          .from('creator_management')
          .select('creator_id')
          .eq('management_id', selectedId)
          .eq('ist_aktiv', true);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.management_id;
      }
      // Firma: analog zu Management ueber creator_firma
      if (filters && filters.firma_id) {
        const selectedId = getIdFromFilter(filters.firma_id);
        const { data: links, error: lerr } = await supabase
          .from('creator_firma')
          .select('creator_id')
          .eq('firma_id', selectedId)
          .eq('ist_aktiv', true);
        if (!lerr) {
          idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.firma_id;
      }
      if (filters && filters.besitz_id) {
        const raw = filters.besitz_id;
        const ids = (Array.isArray(raw) ? raw : [getIdFromFilter(raw)]).filter(Boolean);
        for (const selectedId of ids) {
          const { data: links, error: lerr } = await supabase
            .from('creator_besitz')
            .select('creator_id')
            .eq('besitz_id', selectedId);
          if (!lerr) idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
        delete filters.besitz_id;
      }
      if (filters && filters.favorit_von) {
        const raw = filters.favorit_von;
        delete filters.favorit_von;
        const userIds = (Array.isArray(raw) ? raw : [getIdFromFilter(raw)]).filter(Boolean);
        if (userIds.length) {
          const { data: links, error: lerr } = await supabase
            .from('creator_favoriten')
            .select('creator_id')
            .in('user_id', userIds);
          if (!lerr) idSets.push(new Set((links || []).map(r => r.creator_id)));
        }
      }
      if (filters && filters.creator_tag_id) {
        const raw = filters.creator_tag_id;
        delete filters.creator_tag_id;
        const tagIds = (Array.isArray(raw) ? raw : [getIdFromFilter(raw)]).filter(Boolean);
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
