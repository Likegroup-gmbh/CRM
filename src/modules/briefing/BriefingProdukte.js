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
