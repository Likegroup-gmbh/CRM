// BriefingProdukte.js
// Laden und Pflegen der M:N-Zuordnung campaign_briefing_produkt: die Produkte
// einer Linie (ADR 0052). Die Tabelle ist die Liste der Linie; Persona-
// Änderungen und Finalisieren schreiben sie nicht um.

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

/**
 * Hängt vorhandene Produkte an die Linie. Idempotent und rein additiv:
 * bestehende Zeilen bleiben, Personas und Briefing-Daten werden nicht berührt.
 * @returns {Promise<string[]>} die neu verknüpften Produkt-IDs
 */
export async function addBriefingProdukte(briefingId, produktIds) {
  if (!briefingId || !window.supabase) return [];

  const wanted = [...new Set((produktIds || []).filter(Boolean))];
  if (!wanted.length) return [];

  const { data: vorhanden, error: readError } = await window.supabase
    .from('campaign_briefing_produkt')
    .select('produkt_id')
    .eq('briefing_id', briefingId);
  if (readError) throw readError;

  const schon = new Set((vorhanden || []).map(row => row.produkt_id));
  const neu = wanted.filter(id => !schon.has(id));
  if (!neu.length) return [];

  const { error } = await window.supabase
    .from('campaign_briefing_produkt')
    .insert(neu.map(produkt_id => ({ briefing_id: briefingId, produkt_id })));
  if (error) throw error;
  return neu;
}

/**
 * „Von der Linie lösen“: genau diese Verknüpfung fällt weg. Das Produkt und
 * seine Verknüpfungen zu anderen Linien bleiben.
 */
export async function removeBriefingProdukt(briefingId, produktId) {
  if (!briefingId || !produktId || !window.supabase) return;

  const { error } = await window.supabase
    .from('campaign_briefing_produkt')
    .delete()
    .eq('briefing_id', briefingId)
    .eq('produkt_id', produktId);
  if (error) throw error;
}

/**
 * „Produkt übernehmen“: Katalogprodukte des Unternehmens, die an dieser Linie
 * noch fehlen. Marke wie beim Briefing: Produkt ohne Marke oder mit dieser Marke.
 */
export async function loadUebernehmbareProdukte({ briefingId, unternehmenId, markeId = null }) {
  if (!briefingId || !unternehmenId) return [];

  const [katalog, vorhanden] = await Promise.all([
    loadProdukteForBriefing(unternehmenId, markeId),
    loadBriefingProdukte(briefingId)
  ]);
  const schon = new Set(vorhanden.map(p => p.id));
  return katalog.filter(p => !schon.has(p.id));
}

/**
 * Übernimmt Produkte an die Linie. Nur Produkte desselben Unternehmens wie das
 * Briefing werden verknüpft. Personas, Briefings und Skripte der anderen Linie
 * kommen nicht mit (ADR 0052).
 * @returns {Promise<string[]>} die neu verknüpften Produkt-IDs
 */
export async function uebernehmeProdukte(briefingId, produktIds) {
  if (!briefingId || !window.supabase) return [];

  const wanted = [...new Set((produktIds || []).filter(Boolean))];
  if (!wanted.length) return [];

  const { data: briefing, error: bError } = await window.supabase
    .from('campaign_briefings')
    .select('id, unternehmen_id')
    .eq('id', briefingId)
    .maybeSingle();
  if (bError) throw bError;
  if (!briefing) throw new Error('Briefing nicht gefunden');

  const { data: produkte, error: pError } = await window.supabase
    .from('produkt')
    .select('id, unternehmen_id')
    .in('id', wanted);
  if (pError) throw pError;

  const erlaubt = (produkte || [])
    .filter(p => p.unternehmen_id === briefing.unternehmen_id)
    .map(p => p.id);
  return addBriefingProdukte(briefingId, erlaubt);
}
