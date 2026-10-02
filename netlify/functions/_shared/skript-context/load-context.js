// skript-context/load-context.js
// DB-Layer des Kontext-Aufbaus (Generierung + Rueckfragen).
// Zwei parallele Query-Wellen statt des frueheren 13-Query-Waterfalls:
// Welle 1 haengt nur an den params-IDs, Welle 2 an den Ergebnissen aus 1.

const { resolveSkriptBereich, loadMasterDocs } = require('../skript-master');
const { attachAudienceSituations } = require('../audience-situation');

// ---------------------------------------------------------------------------
// Kontext-Aufbau
// ---------------------------------------------------------------------------
// Regelquelle ist das Master-Regelwerk (basis + Bereich), keine Skript-DNA mehr.
async function loadContext(supabase, params) {
  const { unternehmen_id, marke_id, kampagne_id, produkt_id, persona_id, branche_id, briefing_id, strategie_item_id } = params;
  const ctx = { master: [], masterVersionen: [] };

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
      .select('id, name, oberbegriff, beschreibung, branche_id, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, pain_points, interessen, beduerfnisse, kaufmotive, einwaende, tonalitaet, plattformen, content_praeferenzen, produkt_loesung, produktvorteile')
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

  // Zugewiesener Creator der Videoidee: Casting-Eintrag + CRM-Creator.
  // Casting-notiz bleibt bewusst draussen (interne Notiz, kein Prompt-Stoff).
  const creatorPromise = strategie_item_id
    ? supabase.from('strategie_items')
      .select('creator_name, casting_eintrag:creator_auswahl_item_id(name, creator:creator_id(vorname, nachname, instagram, tiktok, ig_biography))')
      .eq('id', strategie_item_id).maybeSingle()
    : Promise.resolve({ data: null });

  const [
    { data: unternehmen }, { data: marke }, { data: produkt }, { data: varianten },
    { data: persona }, { data: kampagne }, { data: briefing }, { data: strategieItem }
  ] = await Promise.all([
    unternehmenPromise, markePromise, produktPromise, variantenPromise,
    personaPromise, kampagnePromise, briefingPromise, creatorPromise
  ]);

  ctx.unternehmen = unternehmen;
  ctx.marke = marke;
  ctx.produkt = produkt;
  ctx.produktVarianten = varianten || [];
  ctx.persona = persona;
  if (ctx.persona) await attachAudienceSituations(supabase, ctx.persona);
  ctx.kampagne = kampagne;
  ctx.briefing = briefing || null;

  // Creator der Videoidee (Casting-Eintrag hat Vorrang vor dem Freitext-Feld).
  const eintrag = strategieItem?.casting_eintrag || null;
  const crmCreator = eintrag?.creator || null;
  const creatorName = eintrag?.name
    || [crmCreator?.vorname, crmCreator?.nachname].filter(Boolean).join(' ').trim()
    || strategieItem?.creator_name
    || null;
  ctx.creator = creatorName
    ? {
        name: creatorName,
        instagram: crmCreator?.instagram || null,
        tiktok: crmCreator?.tiktok || null,
        bio: crmCreator?.ig_biography || null
      }
    : null;

  // Branche: explizite Wahl aus der UI hat Vorrang vor Marke/Unternehmen/Persona
  ctx.brancheId = branche_id || ctx.marke?.branche_id || ctx.unternehmen?.branche_id || null;

  ctx.bereich = resolveSkriptBereich(params, ctx.briefing);

  // Welle 2: haengt an den Ergebnissen aus Welle 1 (brancheId, persona.branche_id, bereich)
  const branchePromise = ctx.brancheId
    ? supabase.from('branchen')
      .select('id, name').eq('id', ctx.brancheId).single()
    : Promise.resolve({ data: null });

  // Master-Regelwerk: Basis immer + Bereichs-Doc. Auch der Fragen-Pfad laedt
  // es voll - die Rueckfragen muessen die Ausgabestruktur kennen.
  const masterPromise = loadMasterDocs(supabase, ctx.bereich, { schlank: false });

  const [{ data: branche }, masterResult] = await Promise.all([
    branchePromise, masterPromise
  ]);

  ctx.branche = branche;
  ctx.master = masterResult.master;
  ctx.masterVersionen = masterResult.masterVersionen;

  return ctx;
}

module.exports = { loadContext };
