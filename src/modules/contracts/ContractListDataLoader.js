// ContractListDataLoader.js
// Supabase-Queries fuer Contracting-Auftraege mit Relations

const SUPABASE = () => window.supabase;

const CONTRACT_SELECT = `
  id, titel, auftragsname, status, auftragtype,
  nettobetrag, bruttobetrag, angebotsnummer, po, externe_po,
  start, ende, created_at,
  unternehmen:unternehmen_id (id, firmenname, logo_thumb_url),
  marke:marke_id (id, markenname, logo_thumb_url),
  ansprechpartner:ansprechpartner_id (id, vorname, nachname)
`;

export async function loadContracts(page = 1, limit = 25, { searchQuery = '' } = {}) {
  const supabase = SUPABASE();
  if (!supabase) return { data: [], count: 0 };

  try {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('auftrag')
      .select(CONTRACT_SELECT, { count: 'exact' })
      .eq('auftragtype', 'Contracting')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchQuery) {
      query = query.or(`titel.ilike.%${searchQuery}%,auftragsname.ilike.%${searchQuery}%,angebotsnummer.ilike.%${searchQuery}%,po.ilike.%${searchQuery}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const auftragIds = (data || []).map(a => a.id);
    const rechnungStats = auftragIds.length > 0
      ? await loadRechnungStats(auftragIds)
      : new Map();

    const enriched = (data || []).map(row => ({
      ...row,
      rechnungStats: rechnungStats.get(row.id) || { total: 0, offen: 0, bezahlt: 0, summe_netto: 0 }
    }));

    return { data: enriched, count: count || 0 };
  } catch (e) {
    console.error('❌ loadContracts Fehler:', e);
    return { data: [], count: 0 };
  }
}

async function loadRechnungStats(auftragIds) {
  const supabase = SUPABASE();
  if (!supabase || !auftragIds.length) return new Map();

  try {
    const { data, error } = await supabase
      .from('rechnung')
      .select('auftrag_id, status, nettobetrag')
      .in('auftrag_id', auftragIds)
      .eq('rechnungstyp', 'contracting');
    if (error) throw error;

    const stats = new Map();
    for (const row of (data || [])) {
      if (!stats.has(row.auftrag_id)) {
        stats.set(row.auftrag_id, { total: 0, offen: 0, bezahlt: 0, summe_netto: 0 });
      }
      const s = stats.get(row.auftrag_id);
      s.total++;
      if (row.status === 'Bezahlt') s.bezahlt++;
      else s.offen++;
      s.summe_netto += parseFloat(row.nettobetrag) || 0;
    }
    return stats;
  } catch (e) {
    console.warn('⚠️ loadRechnungStats Fehler:', e);
    return new Map();
  }
}

export async function loadContractRechnungen(auftragId) {
  const supabase = SUPABASE();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('rechnung')
      .select('id, rechnung_nr, nettobetrag, ust_betrag, bruttobetrag, status, gestellt_am, zahlungsziel, bezahlt_am, creator:creator_id(id, vorname, nachname)')
      .eq('auftrag_id', auftragId)
      .eq('rechnungstyp', 'contracting')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('❌ loadContractRechnungen Fehler:', e);
    return [];
  }
}

export async function loadContractDetail(auftragId) {
  const supabase = SUPABASE();
  if (!supabase) return null;

  try {
    const [auftragResult, positionsResult, rechnungen] = await Promise.all([
      supabase
        .from('auftrag')
        .select(CONTRACT_SELECT)
        .eq('id', auftragId)
        .eq('auftragtype', 'Contracting')
        .single(),
      supabase
        .from('contracting_position')
        .select('id, creator_id, beschreibung, betrag_netto, betrag_brutto, rechnung_nr, status, bezahlt_am, created_at')
        .eq('auftrag_id', auftragId)
        .order('created_at', { ascending: true }),
      loadContractRechnungen(auftragId)
    ]);

    if (auftragResult.error) throw auftragResult.error;
    if (positionsResult.error) throw positionsResult.error;

    const positions = positionsResult.data || [];

    const creatorIds = [...new Set(positions.map(p => p.creator_id).filter(Boolean))];
    let creatorMap = {};
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('creator')
        .select('id, vorname, nachname, profile_image_thumb_url')
        .in('id', creatorIds);
      creatorMap = (creators || []).reduce((m, c) => { m[c.id] = c; return m; }, {});
    }

    const enrichedPositions = positions.map(p => ({
      ...p,
      creator: p.creator_id ? (creatorMap[p.creator_id] || null) : null
    }));

    return {
      ...auftragResult.data,
      contracting_position: enrichedPositions,
      rechnungen
    };
  } catch (e) {
    console.error('❌ loadContractDetail Fehler:', e);
    return null;
  }
}
