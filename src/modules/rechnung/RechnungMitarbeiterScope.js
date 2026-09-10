// RechnungMitarbeiterScope.js
// Loads and caches the set of kampagne/kooperation/unternehmen IDs
// the current Mitarbeiter may see.

let _cache = null;

export async function loadRechnungMitarbeiterScope() {
  if (_cache) return _cache;

  const userId = window.currentUser?.id;
  if (!userId || !window.supabase) {
    return { kampagneIds: [], koopIds: [], unternehmenIds: [] };
  }

  try {
    const [kampagnenResult, markenResult, unternehmenResult] = await Promise.all([
      window.supabase.from('kampagne_mitarbeiter').select('kampagne_id').eq('mitarbeiter_id', userId),
      window.supabase.from('marke_mitarbeiter').select('marke_id, marke:marke_id(unternehmen_id)').eq('mitarbeiter_id', userId),
      window.supabase.from('mitarbeiter_unternehmen').select('unternehmen_id').eq('mitarbeiter_id', userId)
    ]);

    const directKampagnenIds = (kampagnenResult.data || []).map(r => r.kampagne_id).filter(Boolean);

    const markenMitUnternehmen = (markenResult.data || []).map(r => ({
      marke_id: r.marke_id,
      unternehmen_id: r.marke?.unternehmen_id
    })).filter(r => r.marke_id);

    const unternehmenIds = (unternehmenResult.data || []).map(r => r.unternehmen_id).filter(Boolean);

    const unternehmenMarkenMap = new Map();
    markenMitUnternehmen.forEach(r => {
      if (r.unternehmen_id) {
        if (!unternehmenMarkenMap.has(r.unternehmen_id)) unternehmenMarkenMap.set(r.unternehmen_id, []);
        unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
      }
    });

    let allowedMarkenIds = [];
    const unternehmenOhneMarke = [];
    for (const uid of unternehmenIds) {
      const explicit = unternehmenMarkenMap.get(uid);
      if (explicit?.length > 0) {
        allowedMarkenIds.push(...explicit);
      } else {
        unternehmenOhneMarke.push(uid);
      }
    }

    if (unternehmenOhneMarke.length > 0) {
      const { data: alleMarken } = await window.supabase
        .from('marke').select('id').in('unternehmen_id', unternehmenOhneMarke);
      allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
    }

    allowedMarkenIds = [...new Set(allowedMarkenIds)];

    const [kampagnenForMarken, koopsForKampagnen] = await Promise.all([
      allowedMarkenIds.length > 0
        ? window.supabase.from('kampagne').select('id').in('marke_id', allowedMarkenIds)
        : { data: [] },
      directKampagnenIds.length > 0
        ? window.supabase.from('kooperationen').select('id').in('kampagne_id', directKampagnenIds)
        : { data: [] }
    ]);

    const markenKampagnenIds = (kampagnenForMarken.data || []).map(k => k.id).filter(Boolean);
    const allKampagneIds = [...new Set([...directKampagnenIds, ...markenKampagnenIds])];

    let allKoopIds = (koopsForKampagnen.data || []).map(k => k.id);
    if (markenKampagnenIds.length > 0) {
      const { data: extraKoops } = await window.supabase
        .from('kooperationen').select('id').in('kampagne_id', markenKampagnenIds);
      allKoopIds = [...new Set([...allKoopIds, ...(extraKoops || []).map(k => k.id)])];
    }

    _cache = {
      kampagneIds: allKampagneIds,
      koopIds: allKoopIds,
      unternehmenIds: [...unternehmenIds]
    };

    return _cache;
  } catch (error) {
    console.error('❌ Fehler beim Laden der Zuordnungen:', error);
    return { kampagneIds: [], koopIds: [], unternehmenIds: [] };
  }
}

export function clearRechnungMitarbeiterScope() {
  _cache = null;
}
