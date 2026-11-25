// Persona am Skript (CONTEXT.md "Persona an Videoidee"): Videoidee, sonst
// Casting-Eintrag. Fehlt beides, klaeren die Rueckfragen die Persona aus den
// Personas des Briefings. Liky waehlt nie selbst.

/** Personas des Briefings als Auswahl, nur wenn das Skript noch keine hat. */
async function ladePersonaOptionen(supabase, { personaId, briefing }) {
  if (personaId) return [];
  const ids = Array.isArray(briefing?.persona_ids) ? briefing.persona_ids.filter(Boolean) : [];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('personas')
    .select('id, name, oberbegriff').in('id', ids);
  if (error) {
    console.warn('[skript-persona] Personas nicht geladen:', error.message);
    return [];
  }
  return data || [];
}

function personaLabel(p) {
  return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : p.name;
}

/** Prompt-Block fuer die Rueckfragen: Persona offen, Auswahl aus dem Briefing. */
function personaOffenBlock(optionen) {
  if (!optionen?.length) return '';
  const liste = optionen.map((p) => `- ${p.id}: ${personaLabel(p)}`).join('\n');
  return '# PERSONA DIESES SKRIPTS: offen\n'
    + 'Weder Videoidee noch Casting-Eintrag nennen eine Persona. Ohne Persona fehlen Pain, Wuensche und '
    + 'Einwaende der Zielgruppe, und das Produkt ist nicht eindeutig. Das Briefing hat diese Personas:\n'
    + `${liste}\n`
    + 'Frage, welche dieser Personas das Video anspricht (Namen zur Auswahl anbieten), ausser der Dialog '
    + 'beantwortet das schon. Waehle nie selbst. Ist die Antwort eindeutig, setze persona_id auf die ID '
    + 'aus der Liste. Solange sie offen ist, ist fertig=false.\n\n';
}

/** Antwort des Modells gegen die Auswahl pruefen; nur IDs aus der Liste gelten. */
function gueltigePersonaId(optionen, personaId) {
  if (!personaId || !optionen?.length) return null;
  return optionen.some((p) => p.id === personaId) ? personaId : null;
}

/**
 * Persona am Skript setzen: Spalte und generator_payload (die Generierung liest
 * den Payload). Produkt nur, wenn noch keins gesetzt ist und die Persona genau
 * einen akzeptierten Fit hat (ADR 0021).
 */
async function setzePersonaAmSkript(supabase, skript, personaId) {
  let produktId = skript.produkt_id || skript.prompt_kontext?.generator_payload?.produkt_id || null;
  if (!produktId) {
    const { data: fits } = await supabase.from('produkt_persona_vorschlag')
      .select('produkt_id').eq('persona_id', personaId).eq('status', 'accepted');
    const ids = [...new Set((fits || []).map((f) => f.produkt_id).filter(Boolean))];
    if (ids.length === 1) produktId = ids[0];
  }

  const pk = skript.prompt_kontext || {};
  const patch = {
    persona_id: personaId,
    prompt_kontext: {
      ...pk,
      generator_payload: {
        ...(pk.generator_payload || {}),
        persona_id: personaId,
        ...(produktId ? { produkt_id: produktId } : {})
      }
    }
  };
  if (produktId && !skript.produkt_id) patch.produkt_id = produktId;

  const { error } = await supabase.from('skripte').update(patch).eq('id', skript.id);
  if (error) throw new Error(`Persona nicht gesetzt: ${error.message}`);
  return { personaId, produktId };
}

/**
 * Generierung: Die Rueckfragen schreiben die Persona an den Stub, der Client
 * schickt aber seinen geladenen Payload. Leere Felder kommen deshalb vom Stub.
 */
async function personaVomStub(supabase, payload) {
  if (!payload?.skript_id || (payload.persona_id && payload.produkt_id)) return payload;
  const { data } = await supabase.from('skripte')
    .select('persona_id, produkt_id').eq('id', payload.skript_id).maybeSingle();
  if (!data) return payload;
  return {
    ...payload,
    persona_id: payload.persona_id || data.persona_id || null,
    produkt_id: payload.produkt_id || data.produkt_id || null
  };
}

module.exports = {
  ladePersonaOptionen,
  personaOffenBlock,
  gueltigePersonaId,
  setzePersonaAmSkript,
  personaVomStub
};
