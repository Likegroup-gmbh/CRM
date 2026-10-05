/**
 * Alle Strategien abrufen (mit Verknüpfungen)
 * Filtert basierend auf Benutzerrolle und Kampagnen-Zuordnung
 */
export async function getAllStrategien() {
  const user = window.currentUser;

  // Admin und Investor sehen alle Strategien
  if (window.isAdmin() || window.isInvestor?.()) {
    return fetchAllStrategien();
  }

  if (window.isKunde()) {
    const customerScope = await getCustomerAccessScope(user?.id);
    console.log('🔐 Kundenscope Strategie:', customerScope);

    const allStrategien = await fetchAllStrategien();
    const filtered = allStrategien.filter((strategie) => isInCustomerScope(strategie, customerScope));

    console.log(`🔐 Strategien (Kunde) gefiltert: ${filtered.length} von ${allStrategien.length}`);
    return filtered;
  }

  // Für Mitarbeiter: erlaubte Kampagnen ermitteln
  const allowedKampagneIds = await getAllowedKampagneIds(user);
  console.log('🔐 Erlaubte Kampagnen für Benutzer:', allowedKampagneIds);

  const allStrategien = await fetchAllStrategien();
  const filtered = allStrategien.filter(
    (s) => s.kampagne_id && allowedKampagneIds.includes(s.kampagne_id)
  );

  console.log(`🔐 Strategien gefiltert: ${filtered.length} von ${allStrategien.length}`);
  return filtered;
}

/**
 * Interne Methode: Alle Strategien ohne Filter laden
 */
async function fetchAllStrategien() {
  const { data, error } = await window.supabase
    .from('strategie')
    .select(`
      *,
      unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
      marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(internes_kuerzel)),
      kampagne:kampagne_id(id, kampagnenname, eigener_name, start, deadline, auftrag:auftrag_id(start, ende)),
      auftrag:auftrag_id(id, auftragsname),
      created_by_user:created_by(id, name, profile_image_url),
      briefing:briefing_id(id, aktivierung_name),
      creator_auswahl:creator_auswahl_id(id, name),
      strategie_items(skripte(id, titel))
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fehler beim Abrufen der Strategien:', error);
    throw error;
  }

  return data;
}

async function getCustomerAccessScope(userId) {
  if (!userId) {
    return { unternehmenIds: [], markeIds: [], kampagneIds: [] };
  }

  const { data: userUnternehmen } = await window.supabase
    .from('kunde_unternehmen')
    .select('unternehmen_id')
    .eq('kunde_id', userId);

  const unternehmenIds = [...new Set((userUnternehmen || []).map((u) => u.unternehmen_id).filter(Boolean))];

  const { data: userMarken } = await window.supabase
    .from('kunde_marke')
    .select('marke_id')
    .eq('kunde_id', userId);

  const directMarkeIds = (userMarken || []).map((m) => m.marke_id).filter(Boolean);

  let unternehmenMarkeIds = [];
  if (unternehmenIds.length > 0) {
    const { data: markenByUnternehmen } = await window.supabase
      .from('marke')
      .select('id')
      .in('unternehmen_id', unternehmenIds);
    unternehmenMarkeIds = (markenByUnternehmen || []).map((m) => m.id).filter(Boolean);
  }

  const markeIds = [...new Set([...directMarkeIds, ...unternehmenMarkeIds])];
  const kampagneIds = new Set();

  if (unternehmenIds.length > 0) {
    const { data: unternehmensKampagnen } = await window.supabase
      .from('kampagne')
      .select('id')
      .in('unternehmen_id', unternehmenIds);
    (unternehmensKampagnen || []).forEach((k) => kampagneIds.add(k.id));
  }

  if (markeIds.length > 0) {
    const { data: markenKampagnen } = await window.supabase
      .from('kampagne')
      .select('id')
      .in('marke_id', markeIds);
    (markenKampagnen || []).forEach((k) => kampagneIds.add(k.id));
  }

  return {
    unternehmenIds,
    markeIds,
    kampagneIds: Array.from(kampagneIds)
  };
}

function isInCustomerScope(entry, scope) {
  if (!entry || !scope) return false;

  if (entry.kampagne_id && scope.kampagneIds.includes(entry.kampagne_id)) return true;
  if (entry.marke_id && scope.markeIds.includes(entry.marke_id)) return true;
  if (entry.unternehmen_id && scope.unternehmenIds.includes(entry.unternehmen_id)) return true;
  return false;
}

/**
 * Ermittelt alle Kampagnen-IDs, auf die der Benutzer Zugriff hat
 * - Mitarbeiter: via kampagne_mitarbeiter, mitarbeiter_unternehmen, marke_mitarbeiter
 * - Kunden: via kunde_unternehmen, kunde_marke
 */
export async function getAllowedKampagneIds(user) {
  const userId = user?.id;
  if (!userId) return [];

  const kampagneIds = new Set();

  if (window.isMitarbeiter()) {
    // 1. Direkt zugeordnete Kampagnen (kampagne_mitarbeiter)
    const { data: directKampagnen } = await window.supabase
      .from('kampagne_mitarbeiter')
      .select('kampagne_id')
      .eq('mitarbeiter_id', userId);
    (directKampagnen || []).forEach(k => kampagneIds.add(k.kampagne_id));

    // 2. Zugeordnete Marken laden
    const { data: userMarken } = await window.supabase
      .from('marke_mitarbeiter')
      .select('marke_id')
      .eq('mitarbeiter_id', userId);
    const markenIds = (userMarken || []).map(m => m.marke_id).filter(Boolean);

    // 3. Marken-Daten mit Unternehmen-IDs laden
    let markenMitUnternehmen = [];
    if (markenIds.length > 0) {
      const { data: markenData } = await window.supabase
        .from('marke')
        .select('id, unternehmen_id')
        .in('id', markenIds);
      markenMitUnternehmen = (markenData || []).map(m => ({
        marke_id: m.id,
        unternehmen_id: m.unternehmen_id
      }));
    }

    // 4. Zugeordnete Unternehmen laden
    const { data: userUnternehmen } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('unternehmen_id')
      .eq('mitarbeiter_id', userId);
    const unternehmenIds = (userUnternehmen || []).map(u => u.unternehmen_id).filter(Boolean);

    // 5. Erlaubte Marken ermitteln (mit Marke-als-Zwischenfilter Logik)
    const unternehmenMarkenMap = new Map();
    markenMitUnternehmen.forEach(r => {
      if (r.unternehmen_id) {
        if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
          unternehmenMarkenMap.set(r.unternehmen_id, []);
        }
        unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
      }
    });

    let allowedMarkenIds = [];
    for (const unternehmenId of unternehmenIds) {
      const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
      if (explicitMarkenIds && explicitMarkenIds.length > 0) {
        // Mitarbeiter hat explizite Marken-Zuordnung → nur diese Marken
        allowedMarkenIds.push(...explicitMarkenIds);
      } else {
        // Keine Marken-Zuordnung → alle Marken des Unternehmens
        const { data: alleMarken } = await window.supabase
          .from('marke')
          .select('id')
          .eq('unternehmen_id', unternehmenId);
        allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
      }
    }

    // Direkt zugeordnete Marken hinzufügen
    allowedMarkenIds.push(...markenIds);
    allowedMarkenIds = [...new Set(allowedMarkenIds)];

    // 6. Kampagnen für erlaubte Marken laden
    if (allowedMarkenIds.length > 0) {
      const { data: markenKampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .in('marke_id', allowedMarkenIds);
      (markenKampagnen || []).forEach(k => kampagneIds.add(k.id));
    }

    // 7. Kampagnen die DIREKT mit erlaubten Unternehmen verknüpft sind (ohne Marke)
    if (unternehmenIds.length > 0) {
      const { data: direkteUnternehmenKampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .in('unternehmen_id', unternehmenIds);
      (direkteUnternehmenKampagnen || []).forEach(k => kampagneIds.add(k.id));
    }

  } else if (window.isKunde()) {
    const customerScope = await getCustomerAccessScope(userId);
    customerScope.kampagneIds.forEach((id) => kampagneIds.add(id));
  }

  return Array.from(kampagneIds);
}
