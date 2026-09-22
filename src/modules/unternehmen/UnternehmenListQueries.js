// UnternehmenListQueries.js
// Seiten-Query und Beziehungs-Maps. Kein HTML, kein DOM.

function intersectIds(baseIds, nextIds) {
  if (!Array.isArray(nextIds) || nextIds.length === 0) return [];
  if (!Array.isArray(baseIds)) return [...new Set(nextIds)];
  const nextSet = new Set(nextIds);
  return baseIds.filter(id => nextSet.has(id));
}

/**
 * Lädt die Unternehmen-Daten für eine Seite.
 * Mit komplexer Mitarbeiter-Filterung für Nicht-Admins.
 */
export async function loadUnternehmenPage({ page, limit, filters, sort, isAdmin }) {
  try {
    let allowedUnternehmenIds = null;
    if (!isAdmin && !window.isUnscoped?.()) {
      const { data: mitarbeiterUnternehmen, error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .eq('mitarbeiter_id', window.currentUser?.id);

      if (error) {
        console.error('❌ UNTERNEHMENLISTE: Fehler beim Laden der Zuordnungen:', error);
      }

      allowedUnternehmenIds = (mitarbeiterUnternehmen || [])
        .map(r => r.unternehmen_id)
        .filter(Boolean);

      if (allowedUnternehmenIds.length === 0) {
        return { data: [], total: 0 };
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = window.supabase
      .from('unternehmen')
      .select(`
        *,
        unternehmen_branchen (
          branche_id,
          branchen (id, name)
        )
      `, { count: 'exact' })
      .order(sort.field, { ascending: sort.ascending });

    let constrainedUnternehmenIds = Array.isArray(allowedUnternehmenIds)
      ? [...allowedUnternehmenIds]
      : null;

    if (filters.branche_id) {
      const { data: links } = await window.supabase
        .from('unternehmen_branchen')
        .select('unternehmen_id')
        .eq('branche_id', filters.branche_id);

      const brancheUnternehmenIds = (links || []).map(r => r.unternehmen_id).filter(Boolean);

      if (brancheUnternehmenIds.length === 0) {
        return { data: [], total: 0 };
      }

      constrainedUnternehmenIds = intersectIds(constrainedUnternehmenIds, brancheUnternehmenIds);
    }

    const selectedMitarbeiterIds = Array.isArray(filters.mitarbeiter_ids)
      ? filters.mitarbeiter_ids.map(id => String(id).trim()).filter(Boolean)
      : [];

    if (selectedMitarbeiterIds.length > 0) {
      const { data: mitarbeiterLinks, error: mitarbeiterFilterError } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .in('mitarbeiter_id', selectedMitarbeiterIds);

      if (mitarbeiterFilterError) {
        console.error('❌ UNTERNEHMENLISTE: Fehler beim Mitarbeiter-Filter:', mitarbeiterFilterError);
        throw mitarbeiterFilterError;
      }

      const mitarbeiterUnternehmenIds = [...new Set(
        (mitarbeiterLinks || []).map(row => row.unternehmen_id).filter(Boolean)
      )];

      if (mitarbeiterUnternehmenIds.length === 0) {
        return { data: [], total: 0 };
      }

      constrainedUnternehmenIds = intersectIds(constrainedUnternehmenIds, mitarbeiterUnternehmenIds);
    }

    if (Array.isArray(constrainedUnternehmenIds)) {
      if (constrainedUnternehmenIds.length === 0) {
        return { data: [], total: 0 };
      }
      query = query.in('id', constrainedUnternehmenIds);
    }

    if (filters.name) {
      const search = filters.name;
      const { data: matchM } = await window.supabase
        .from('marke').select('unternehmen_id').ilike('markenname', `%${search}%`);
      const orParts = [
        `firmenname.ilike.%${search}%`,
        `internes_kuerzel.ilike.%${search}%`,
        `webseite.ilike.%${search}%`,
        `invoice_email.ilike.%${search}%`
      ];
      if (matchM?.length) {
        const ids = [...new Set(matchM.map(m => m.unternehmen_id).filter(Boolean))];
        if (ids.length) orParts.push(`id.in.(${ids.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }
    if (filters.firmenname) {
      query = query.ilike('firmenname', `%${filters.firmenname}%`);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.rechnungsadresse_stadt) {
      query = query.ilike('rechnungsadresse_stadt', `%${filters.rechnungsadresse_stadt}%`);
    }
    if (filters.rechnungsadresse_land) {
      query = query.ilike('rechnungsadresse_land', `%${filters.rechnungsadresse_land}%`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const transformedData = (data || []).map(unternehmen => {
      if (unternehmen.unternehmen_branchen) {
        unternehmen.branchen = unternehmen.unternehmen_branchen
          .map(ub => ub.branchen)
          .filter(Boolean);
        delete unternehmen.unternehmen_branchen;
      } else {
        unternehmen.branchen = [];
      }
      return unternehmen;
    });

    return {
      data: transformedData,
      total: count || 0
    };

  } catch (error) {
    console.error('❌ Fehler beim Laden der Unternehmen:', error);
    throw error;
  }
}

export async function loadMarkenMap(unternehmenIds) {
  const map = new Map();
  try {
    if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
      return map;
    }

    const { data, error } = await window.supabase
      .from('marke')
      .select(`
        id, markenname, logo_url, webseite, unternehmen_id,
        branchen:marke_branchen(branche:branche_id(id, name)),
        ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url))
      `)
      .in('unternehmen_id', unternehmenIds);

    if (error) {
      console.warn('⚠️ Konnte Marken nicht laden:', error);
      return map;
    }

    (data || []).forEach(raw => {
      if (!raw?.unternehmen_id) return;
      const marke = {
        ...raw,
        branchen: (raw.branchen || []).map(b => b.branche).filter(Boolean),
        ansprechpartner: (raw.ansprechpartner || []).map(a => a.ansprechpartner).filter(Boolean)
      };
      const list = map.get(marke.unternehmen_id) || [];
      list.push(marke);
      map.set(marke.unternehmen_id, list);
    });

    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.markenname || '').localeCompare(b.markenname || '', 'de', { sensitivity: 'base' })
      );
    }
  } catch (e) {
    console.warn('⚠️ loadMarkenMap Fehler:', e);
  }
  return map;
}

export async function loadMarkeMitarbeiterMap(markeIds) {
  const map = new Map();
  try {
    if (!window.supabase || !Array.isArray(markeIds) || markeIds.length === 0) {
      return map;
    }
    const { data, error } = await window.supabase
      .from('marke_mitarbeiter')
      .select('marke_id, role, benutzer:mitarbeiter_id (id, name, profile_image_url)')
      .in('marke_id', markeIds);
    if (error) {
      console.warn('⚠️ Konnte Marken-Mitarbeiter nicht laden:', error);
      return map;
    }
    (data || []).forEach(item => {
      if (!item.benutzer) return;
      const list = map.get(item.marke_id) || [];
      list.push({ ...item.benutzer, role: item.role || 'mitarbeiter' });
      map.set(item.marke_id, list);
    });
  } catch (e) {
    console.warn('⚠️ loadMarkeMitarbeiterMap Fehler:', e);
  }
  return map;
}

export async function loadAnsprechpartnerMap(unternehmenIds) {
  const map = new Map();
  try {
    if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
      return map;
    }

    const { data, error } = await window.supabase
      .from('ansprechpartner_unternehmen')
      .select(`
        unternehmen_id,
        ansprechpartner:ansprechpartner_id (
          id, vorname, nachname, email, profile_image_url
        )
      `)
      .in('unternehmen_id', unternehmenIds);

    if (error) {
      console.warn('⚠️ Konnte Ansprechpartner nicht laden:', error);
      return map;
    }

    (data || []).forEach(item => {
      if (!item.ansprechpartner) return;

      const unternehmenId = item.unternehmen_id;
      const list = map.get(unternehmenId) || [];
      list.push(item.ansprechpartner);
      map.set(unternehmenId, list);
    });

  } catch (e) {
    console.warn('⚠️ loadAnsprechpartnerMap Fehler:', e);
  }
  return map;
}

export async function loadMitarbeiterMap(unternehmenIds) {
  const map = new Map();
  try {
    if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
      return map;
    }

    const { data, error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select(`
        unternehmen_id,
        role,
        benutzer:mitarbeiter_id (id, name, profile_image_url)
      `)
      .in('unternehmen_id', unternehmenIds);

    if (error) {
      console.warn('⚠️ Konnte Mitarbeiter nicht laden:', error);
      return map;
    }

    (data || []).forEach(item => {
      if (!item.benutzer) return;

      const unternehmenId = item.unternehmen_id;
      const mitarbeiter = { ...item.benutzer, role: item.role || 'mitarbeiter' };

      const list = map.get(unternehmenId) || [];
      list.push(mitarbeiter);
      map.set(unternehmenId, list);
    });

  } catch (e) {
    console.warn('⚠️ loadMitarbeiterMap Fehler:', e);
  }
  return map;
}
