// BriefingProdukte.js
// Laden und Sync der M:N-Zuordnung campaign_briefing_produkt.

export async function loadProdukteForBriefing(unternehmenId, markeId = null) {
  if (!unternehmenId || !window.supabase) return [];

  const { data, error } = await window.supabase
    .from('produkt')
    .select('id, name, unternehmen_id, produkt_marke(marke_id)')
    .eq('unternehmen_id', unternehmenId)
    .order('name');
  if (error) throw error;

  const rows = data || [];
  const filtered = markeId
    ? rows.filter(p => {
      const links = p.produkt_marke || [];
      return links.length === 0 || links.some(l => l.marke_id === markeId);
    })
    : rows;

  return filtered.map(({ produkt_marke: _links, ...produkt }) => produkt);
}

export async function loadBriefingProdukte(briefingId) {
  if (!briefingId || !window.supabase) return [];

  const { data, error } = await window.supabase
    .from('campaign_briefing_produkt')
    .select('produkt_id, produkt:produkt_id(id, name)')
    .eq('briefing_id', briefingId);
  if (error) throw error;

  return (data || [])
    .map(row => row.produkt)
    .filter(Boolean)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

export async function syncBriefingProdukte(briefingId, produktIds) {
  if (!briefingId || !window.supabase) return;

  const ids = [...new Set((produktIds || []).filter(Boolean))];
  const { error: delError } = await window.supabase
    .from('campaign_briefing_produkt')
    .delete()
    .eq('briefing_id', briefingId);
  if (delError) throw delError;
  if (!ids.length) return;

  const { error } = await window.supabase
    .from('campaign_briefing_produkt')
    .insert(ids.map(produkt_id => ({ briefing_id: briefingId, produkt_id })));
  if (error) throw error;
}

/**
 * Das Produkt der Produktion ist das einzige Briefing-Produkt (ADR 0029).
 * Ohne gesetztes Produkt bleibt die Persona-Union für Altbestand (ADR 0021).
 */
export async function recomputeBriefingProdukte(briefingId) {
  if (!briefingId || !window.supabase) return;

  const { data: briefing, error } = await window.supabase
    .from('campaign_briefings')
    .select('persona_ids, produkt_id')
    .eq('id', briefingId)
    .single();
  if (error) throw error;

  if (briefing?.produkt_id) {
    await syncBriefingProdukte(briefingId, [briefing.produkt_id]);
    return;
  }

  const { data: produktion, error: produktionError } = await window.supabase
    .from('produktion')
    .select('produkt_id')
    .eq('briefing_id', briefingId)
    .maybeSingle();
  if (produktionError) throw produktionError;
  if (produktion?.produkt_id) {
    await syncBriefingProdukte(briefingId, [produktion.produkt_id]);
    return;
  }

  const personaIds = Array.isArray(briefing?.persona_ids)
    ? briefing.persona_ids.filter(Boolean)
    : [];
  let produktIds = [];
  if (personaIds.length) {
    const { data: rows, error: vErr } = await window.supabase
      .from('produkt_persona_vorschlag')
      .select('produkt_id')
      .in('persona_id', personaIds)
      .eq('status', 'accepted');
    if (vErr) throw vErr;
    produktIds = [...new Set((rows || []).map(r => r.produkt_id).filter(Boolean))];
  }

  await syncBriefingProdukte(briefingId, produktIds);
}
