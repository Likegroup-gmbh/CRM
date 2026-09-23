// skriptCreateKontext.js
// Ableitung des Generator-Payloads aus Videoidee → Konzept → Casting-Eintrag.
// Produkt: die ID an der Videoidee. Ohne die bleibt der Persona-Fit
// (genau ein accepted Fit, sonst null) fuer Altbestand vor der Spalte.

export function pickProduktId(produktIds) {
  const ids = [...new Set((produktIds || []).filter(Boolean))];
  return ids.length === 1 ? ids[0] : null;
}

export function resolveSkriptCreatePayload(item, { produktIds = [] } = {}) {
  const strategie = item?.strategie || {};
  const unternehmen = strategie.unternehmen || {};
  const marke = strategie.marke || {};
  const briefing = strategie.briefing || null;
  const eintrag = item?.casting_eintrag || null;

  return {
    unternehmen_id: strategie.unternehmen_id || unternehmen.id || null,
    marke_id: strategie.marke_id || marke.id || null,
    kampagne_id: strategie.kampagne_id || strategie.kampagne?.id || null,
    produktion_id: strategie.produktion_id || null,
    briefing_id: strategie.briefing_id || briefing?.id || null,
    briefing,
    bereich: briefing?.bereich || null,
    branche_id: marke.branche_id || unternehmen.branche_id || null,
    persona_id: eintrag?.persona_id || null,
    produkt_id: item?.produkt_id || pickProduktId(produktIds),
    strategie_item_id: item?.id || null,
    video_idee: (item?.beschreibung || '').trim() || null,
    mit_dna: false
  };
}
