// skript-context/load-context.js
// DB-Layer des Kontext-Aufbaus (Generierung + Rueckfragen).
// Zwei parallele Query-Wellen statt des frueheren 13-Query-Waterfalls:
// Welle 1 haengt nur an den params-IDs, Welle 2 an den Ergebnissen aus 1.

// ---------------------------------------------------------------------------
// Kontext-Aufbau
// ---------------------------------------------------------------------------
// options.schlank (Fragen-Pfad): keine Beispiel-/Anti-Pattern-Queries und
// DNA nur als Metadaten (Name/Typ/Version) - der Fragen-Prompt braucht die
// Inhalte nicht, nur welche Layer aktiv sind.
async function loadContext(supabase, params, { schlank = false } = {}) {
  const { unternehmen_id, marke_id, kampagne_id, produkt_id, persona_id, branche_id, briefing_id, mit_dna, dna_id } = params;
  const ctx = { dnaVersionen: [], beispiele: [], antiPatterns: [] };

  // Welle 1: alle Quellen, die nur an params-IDs haengen (nicht voneinander)
  const unternehmenPromise = unternehmen_id
    ? supabase.from('unternehmen')
      .select('id, firmenname, webseite, beschreibung, branche_id').eq('id', unternehmen_id).single()
    : Promise.resolve({ data: null });

  const markePromise = marke_id
    ? supabase.from('marke')
      .select('id, markenname, webseite, beschreibung, branche, branche_id').eq('id', marke_id).single()
    : Promise.resolve({ data: null });

  // Produkt = Kollektion. Varianten tragen nur das Unterscheidende und werden
  // separat geladen, damit im Skript die richtige Ausfuehrung gemeint ist.
  const produktPromise = produkt_id
    ? supabase.from('produkt')
      .select('name, url, kurzbeschreibung, usp, pain_points, loesung, einsatzsituation, preis_von, preis_bis, preis_uvp, inhaltsstoffe, erlaubte_claims, verbotene_claims, rechtliche_hinweise')
      .eq('id', produkt_id).single()
    : Promise.resolve({ data: null });

  const variantenPromise = produkt_id
    ? supabase.from('produkt_variante')
      .select('name, farbe, modell_kompatibilitaet, preis, uvp, merkmal')
      .eq('produkt_id', produkt_id).order('position')
    : Promise.resolve({ data: null });

  const personaPromise = persona_id
    ? supabase.from('personas')
      .select('id, name, oberbegriff, beschreibung, branche_id, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, kontext, pain_points, interessen, beduerfnisse, kaufmotive, einwaende, tonalitaet, plattformen, content_praeferenzen, produkt_loesung, produktvorteile')
      .eq('id', persona_id).single()
    : Promise.resolve({ data: null });

  const kampagnePromise = kampagne_id
    ? supabase.from('kampagne')
      .select('kampagnenname, ziele, art_der_kampagne, kampagne_typ').eq('id', kampagne_id).single()
    : Promise.resolve({ data: null });

  // Ausgewaehltes Campaign-Briefing (explizite ID, kein Auto-Pick)
  const briefingPromise = briefing_id
    ? supabase.from('campaign_briefings')
      .select('*').eq('id', briefing_id).single()
    : Promise.resolve({ data: null });

  // Neuester Kickoff (Marken-DNA aus dem Onboarding)
  const kickoffPromise = marke_id
    ? supabase.from('marke_kickoff')
      .select('brand_essenz, mission, zielgruppe, zielgruppen_mindset, marken_usp, tonalitaet_sprachstil, content_charakter, dos_donts, rechtliche_leitplanken, erfolgskriterien, learnings')
      .eq('marke_id', marke_id).order('created_at', { ascending: false }).limit(1)
    : Promise.resolve({ data: null });

  const [
    { data: unternehmen }, { data: marke }, { data: produkt }, { data: varianten },
    { data: persona }, { data: kampagne }, { data: briefing }, { data: kickoffRows }
  ] = await Promise.all([
    unternehmenPromise, markePromise, produktPromise, variantenPromise,
    personaPromise, kampagnePromise, briefingPromise, kickoffPromise
  ]);

  ctx.unternehmen = unternehmen;
  ctx.marke = marke;
  ctx.produkt = produkt;
  ctx.produktVarianten = varianten || [];
  ctx.persona = persona;
  ctx.kampagne = kampagne;
  ctx.briefing = briefing || null;
  ctx.kickoff = kickoffRows?.[0] || null;

  // Branche: explizite Wahl aus der UI hat Vorrang vor Marke/Unternehmen/Persona
  ctx.brancheId = branche_id || ctx.marke?.branche_id || ctx.unternehmen?.branche_id || null;

  // Welle 2: haengt an den Ergebnissen aus Welle 1 (brancheId, persona.branche_id)
  const branchePromise = ctx.brancheId
    ? supabase.from('branchen')
      .select('id, name').eq('id', ctx.brancheId).single()
    : Promise.resolve({ data: null });

  // DNA-Auswahl:
  //   dna_id gesetzt   -> genau DIESES Dokument (gezielte Wahl in der UI)
  //   mit_dna=false    -> keine DNA (Blindvergleich)
  //   sonst            -> automatisch alle passenden aktiven Layer
  //                       (global > branche > zielgruppe > marke)
  const dnaPromise = (async () => {
    if (mit_dna === false) return { dna: [], dnaVersionen: [] };
    const dnaCols = schlank ? 'id, name, layer_typ, version' : 'id, name, layer_typ, version, inhalt';
    if (dna_id) {
      const { data } = await supabase.from('skript_dna')
        .select(dnaCols)
        .eq('id', dna_id).eq('status', 'aktiv').single();
      if (!data) throw new Error('Gewaehlte DNA nicht gefunden oder nicht aktiv');
      return {
        dna: [data],
        dnaVersionen: [{ id: data.id, name: data.name, layer: data.layer_typ, version: data.version }]
      };
    }
    const brancheIdEff = ctx.brancheId || ctx.persona?.branche_id || null;
    const orParts = ['layer_typ.eq.global'];
    if (brancheIdEff) orParts.push(`and(layer_typ.eq.branche,branche_id.eq.${brancheIdEff})`);
    if (persona_id) orParts.push(`and(layer_typ.eq.zielgruppe,persona_id.eq.${persona_id})`);
    if (marke_id) orParts.push(`and(layer_typ.eq.marke,marke_id.eq.${marke_id})`);

    const { data } = await supabase.from('skript_dna')
      .select(dnaCols)
      .eq('status', 'aktiv')
      .or(orParts.join(','));

    const order = { global: 0, branche: 1, zielgruppe: 2, marke: 3 };
    const dna = (data || []).sort((a, b) => order[a.layer_typ] - order[b.layer_typ]);
    return {
      dna,
      dnaVersionen: dna.map((d) => ({ id: d.id, name: d.name, layer: d.layer_typ, version: d.version }))
    };
  })();

  // Positiv-Beispiele: markenspezifisch UND global laufen parallel, danach
  // gemerged (markenspezifisch zuerst, global fuellt auf, max 3, dedupliziert).
  // Kostet eine zusaetzliche Query, spart einen sequentiellen Roundtrip.
  const exampleCols = 'id, titel, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, performance_label, marke_id';
  const beispieleMarkePromise = !schlank && marke_id
    ? supabase.from('skripte').select(exampleCols)
      .in('performance_label', ['erfolgreich', 'viral']).eq('marke_id', marke_id)
      .order('created_at', { ascending: false }).limit(3)
    : Promise.resolve({ data: null });
  const beispieleGlobalPromise = !schlank
    ? supabase.from('skripte').select(exampleCols)
      .in('performance_label', ['erfolgreich', 'viral'])
      .order('created_at', { ascending: false }).limit(6)
    : Promise.resolve({ data: null });

  // Anti-Patterns: max 2 nicht-erfolgreiche
  const antiPatternsPromise = !schlank
    ? supabase.from('skripte').select(exampleCols)
      .eq('performance_label', 'nicht_erfolgreich')
      .order('created_at', { ascending: false }).limit(2)
    : Promise.resolve({ data: null });

  const [
    { data: branche }, dnaResult,
    { data: beispieleMarke }, { data: beispieleGlobal }, { data: antiPatterns }
  ] = await Promise.all([
    branchePromise, dnaPromise, beispieleMarkePromise, beispieleGlobalPromise, antiPatternsPromise
  ]);

  ctx.branche = branche;
  ctx.dna = dnaResult.dna;
  ctx.dnaVersionen = dnaResult.dnaVersionen;

  const beispiele = [...(beispieleMarke || [])];
  for (const s of beispieleGlobal || []) {
    if (beispiele.length >= 3) break;
    if (!beispiele.some((b) => b.id === s.id)) beispiele.push(s);
  }
  ctx.beispiele = beispiele;
  ctx.antiPatterns = antiPatterns || [];

  return ctx;
}

module.exports = { loadContext };
