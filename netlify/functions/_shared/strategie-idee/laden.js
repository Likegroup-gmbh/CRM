// strategie-idee/laden.js
// Eingabe eines Vorschlag-Laufs: Konzept, Briefing, Produkte, Personas und
// die Ideen, die schon im Konzept stehen (Ausschluss, Abgleich verbindlicher Ideen).

const { attachAudienceSituations } = require('../audience-situation');
const { erstzeile } = require('./validierung');

const PRODUKT_FELDER = 'id, name, kurzbeschreibung, usp, pain_points, loesung';
const PERSONA_FELDER = 'id, name, oberbegriff, pain_points, beduerfnisse';

async function loadPersonas(supabase, briefing, produktIds) {
  const personaIds = Array.isArray(briefing?.persona_ids)
    ? briefing.persona_ids.filter(Boolean)
    : [];
  let personas = [];

  if (personaIds.length) {
    const { data: rows } = await supabase.from('personas')
      .select(PERSONA_FELDER)
      .in('id', personaIds);
    const byId = new Map((rows || []).map((p) => [p.id, p]));
    personas = personaIds.map((id) => byId.get(id)).filter(Boolean);
  } else if (produktIds.length) {
    const { data: vorschlaege } = await supabase.from('produkt_persona_vorschlag')
      .select(`persona_id, persona:persona_id(${PERSONA_FELDER})`)
      .in('produkt_id', produktIds)
      .eq('status', 'accepted');
    const gesehen = new Set();
    for (const v of (vorschlaege || [])) {
      const p = v.persona;
      if (p?.id && !gesehen.has(p.id)) {
        gesehen.add(p.id);
        personas.push(p);
      }
    }
  }

  if (personas.length) await attachAudienceSituations(supabase, personas);
  return personas;
}

async function loadIdeeInput(supabase, strategieId) {
  const { data: strategie, error: sErr } = await supabase.from('strategie')
    .select('id, name, briefing_id, marke_id, unternehmen_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
  if (!strategie.briefing_id) throw new Error('Konzept ohne Briefing: ohne Briefing kein Lauf');

  const { data: briefing, error: bErr } = await supabase.from('campaign_briefings')
    .select('*')
    .eq('id', strategie.briefing_id)
    .maybeSingle();
  if (bErr || !briefing) throw new Error('Briefing nicht gefunden');

  const { data: links } = await supabase.from('campaign_briefing_produkt')
    .select('produkt_id')
    .eq('briefing_id', briefing.id);
  const produktIds = [...new Set((links || []).map((l) => l.produkt_id).filter(Boolean))];

  let produkte = [];
  if (produktIds.length) {
    const { data } = await supabase.from('produkt')
      .select(PRODUKT_FELDER)
      .in('id', produktIds);
    produkte = data || [];
  }

  const personas = await loadPersonas(supabase, briefing, produktIds);

  const { data: items } = await supabase.from('strategie_items')
    .select('id, beschreibung, kurzbeschreibung, video_link')
    .eq('strategie_id', strategieId)
    .order('sortierung');

  const ausschluss = (items || [])
    .map((i) => erstzeile(i.beschreibung) || erstzeile(i.kurzbeschreibung))
    .filter(Boolean);

  return { strategie, briefing, produkte, personas, items: items || [], ausschluss, vorhandeneAnzahl: (items || []).length };
}

/**
 * Das am Item verlinkte Produkt (strategie_items.produkt_id), unabhaengig vom Briefing.
 * Null ohne ID oder wenn das Produkt nicht lesbar ist.
 */
async function ladeItemProdukt(supabase, produktId) {
  if (!produktId) return null;
  const { data } = await supabase.from('produkt')
    .select(PRODUKT_FELDER)
    .eq('id', produktId)
    .maybeSingle();
  return data || null;
}

module.exports = { loadIdeeInput, loadPersonas, ladeItemProdukt };
