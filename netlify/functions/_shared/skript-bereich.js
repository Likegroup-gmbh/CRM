// Bereich am Skript: Auftrag, sonst Briefing der Linie, sonst eindeutige Kampagnenart
// (resolveSkriptBereich). Ist er offen, klaeren ihn die Rueckfragen; die Antwort steht
// danach am Skript, weil der Client seinen beim Oeffnen geladenen Payload schickt.

const { SKRIPT_BEREICHE } = require('./skript-master');

function gueltigerBereich(wert) {
  return SKRIPT_BEREICHE.includes(wert) ? wert : null;
}

/** Briefing des Konzepts, an dem die Videoidee heute haengt. */
async function briefingDesKonzepts(supabase, strategieItemId) {
  if (!strategieItemId) return null;
  const { data } = await supabase.from('strategie_items')
    .select('strategie:strategie_id(briefing_id)').eq('id', strategieItemId).maybeSingle();
  return data?.strategie?.briefing_id || null;
}

/**
 * Leere Bereich- und Briefing-Felder aus dem Stub, das Briefing notfalls vom Konzept:
 * beides kann nach dem Anlegen gesetzt worden sein (Rueckfrage, Konzept an die Linie).
 */
async function bereichVomStub(supabase, params, skript = null) {
  if (params?.bereich && params?.briefing_id) return params;
  let stub = skript;
  if (!stub && params?.skript_id) {
    const { data } = await supabase.from('skripte')
      .select('bereich, briefing_id, strategie_item_id').eq('id', params.skript_id).maybeSingle();
    stub = data;
  }
  if (!stub) return params;

  const out = { ...params };
  if (!out.bereich) out.bereich = gueltigerBereich(stub.bereich);
  if (!out.briefing_id) {
    out.briefing_id = stub.briefing_id
      || await briefingDesKonzepts(supabase, out.strategie_item_id || stub.strategie_item_id)
      || null;
  }
  return out;
}

/** Spalte und generator_payload; das Skript-Objekt wird mitgefuehrt, damit Folge-Updates darauf aufsetzen. */
async function setzeBereichAmSkript(supabase, skript, bereich) {
  const pk = skript.prompt_kontext || {};
  const prompt_kontext = {
    ...pk,
    generator_payload: { ...(pk.generator_payload || {}), bereich }
  };
  const { error } = await supabase.from('skripte')
    .update({ bereich, prompt_kontext }).eq('id', skript.id);
  if (error) throw new Error(`Bereich nicht gesetzt: ${error.message}`);
  skript.bereich = bereich;
  skript.prompt_kontext = prompt_kontext;
}

module.exports = { gueltigerBereich, bereichVomStub, setzeBereichAmSkript };
