// Gemeinsamer Kontext-Aufbau fuer Skript-Functions (Generierung + Rueckfragen).
// Alle Quellen per SQL (Pick-and-pull, kein LLM noetig).

// ---------------------------------------------------------------------------
// Kontext-Aufbau
// ---------------------------------------------------------------------------
async function loadContext(supabase, params) {
  const { unternehmen_id, marke_id, kampagne_id, produkt_id, persona_id, branche_id, mit_dna, dna_id } = params;
  const ctx = { dnaVersionen: [], beispiele: [], antiPatterns: [] };

  if (unternehmen_id) {
    const { data } = await supabase.from('unternehmen')
      .select('id, firmenname, webseite, branche_id').eq('id', unternehmen_id).single();
    ctx.unternehmen = data;
  }

  if (marke_id) {
    const { data } = await supabase.from('marke')
      .select('id, markenname, webseite, branche, branche_id').eq('id', marke_id).single();
    ctx.marke = data;
  }

  // Branche: explizite Wahl aus der UI hat Vorrang vor Marke/Unternehmen/Persona
  ctx.brancheId = branche_id || ctx.marke?.branche_id || ctx.unternehmen?.branche_id || null;
  if (ctx.brancheId) {
    const { data } = await supabase.from('branchen')
      .select('id, name').eq('id', ctx.brancheId).single();
    ctx.branche = data;
  }

  if (produkt_id) {
    const { data } = await supabase.from('produkt')
      .select('name, url, kernbotschaft, hauptproblem, kernnutzen, usp_1, usp_2, usp_3, kauf_conversion_trigger, zielnutzer_anwendungskontext')
      .eq('id', produkt_id).single();
    ctx.produkt = data;
  }

  if (persona_id) {
    const { data } = await supabase.from('personas')
      .select('id, name, oberbegriff, beschreibung, branche_id, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, kontext, pain_points')
      .eq('id', persona_id).single();
    ctx.persona = data;
  }

  if (kampagne_id) {
    const { data } = await supabase.from('kampagne')
      .select('kampagnenname, ziele, art_der_kampagne, kampagne_typ').eq('id', kampagne_id).single();
    ctx.kampagne = data;
  }

  // Neuestes Briefing: bevorzugt zur Kampagne, sonst zur Marke
  if (kampagne_id || marke_id) {
    let query = supabase.from('briefings')
      .select('product_service_offer, creator_aufgabe, usp, zielgruppe, zieldetails, must_haves, rechtlicher_hinweis')
      .order('created_at', { ascending: false }).limit(1);
    query = kampagne_id ? query.eq('kampagne_id', kampagne_id) : query.eq('marke_id', marke_id);
    const { data } = await query;
    ctx.briefing = data?.[0] || null;

    if (!ctx.briefing && kampagne_id && marke_id) {
      const { data: fallback } = await supabase.from('briefings')
        .select('product_service_offer, creator_aufgabe, usp, zielgruppe, zieldetails, must_haves, rechtlicher_hinweis')
        .eq('marke_id', marke_id).order('created_at', { ascending: false }).limit(1);
      ctx.briefing = fallback?.[0] || null;
    }
  }

  // Neuester Kickoff (Marken-DNA aus dem Onboarding)
  if (marke_id) {
    const { data } = await supabase.from('marke_kickoff')
      .select('brand_essenz, mission, zielgruppe, zielgruppen_mindset, marken_usp, tonalitaet_sprachstil, content_charakter, dos_donts, rechtliche_leitplanken, erfolgskriterien, learnings')
      .eq('marke_id', marke_id).order('created_at', { ascending: false }).limit(1);
    ctx.kickoff = data?.[0] || null;
  }

  // DNA-Auswahl:
  //   dna_id gesetzt   -> genau DIESES Dokument (gezielte Wahl in der UI)
  //   mit_dna=false    -> keine DNA (Blindvergleich)
  //   sonst            -> automatisch alle passenden aktiven Layer
  //                       (global > branche > zielgruppe > marke)
  if (mit_dna === false) {
    ctx.dna = [];
  } else if (dna_id) {
    const { data } = await supabase.from('skript_dna')
      .select('id, name, layer_typ, version, inhalt')
      .eq('id', dna_id).eq('status', 'aktiv').single();
    if (!data) throw new Error('Gewaehlte DNA nicht gefunden oder nicht aktiv');
    ctx.dna = [data];
    ctx.dnaVersionen = [{ id: data.id, name: data.name, layer: data.layer_typ, version: data.version }];
  } else {
    const brancheId = ctx.brancheId || ctx.persona?.branche_id || null;
    const orParts = ['layer_typ.eq.global'];
    if (brancheId) orParts.push(`and(layer_typ.eq.branche,branche_id.eq.${brancheId})`);
    if (persona_id) orParts.push(`and(layer_typ.eq.zielgruppe,persona_id.eq.${persona_id})`);
    if (marke_id) orParts.push(`and(layer_typ.eq.marke,marke_id.eq.${marke_id})`);

    const { data } = await supabase.from('skript_dna')
      .select('id, name, layer_typ, version, inhalt')
      .eq('status', 'aktiv')
      .or(orParts.join(','));

    const order = { global: 0, branche: 1, zielgruppe: 2, marke: 3 };
    ctx.dna = (data || []).sort((a, b) => order[a.layer_typ] - order[b.layer_typ]);
    ctx.dnaVersionen = ctx.dna.map((d) => ({ id: d.id, name: d.name, layer: d.layer_typ, version: d.version }));
  }

  // Positiv-Beispiele: erst markenspezifisch, dann global auffuellen (max 3)
  const exampleCols = 'id, titel, hook, hauptteil, cta, performance_label, marke_id';
  const beispiele = [];
  if (marke_id) {
    const { data } = await supabase.from('skripte').select(exampleCols)
      .in('performance_label', ['erfolgreich', 'viral']).eq('marke_id', marke_id)
      .order('created_at', { ascending: false }).limit(3);
    beispiele.push(...(data || []));
  }
  if (beispiele.length < 3) {
    const { data } = await supabase.from('skripte').select(exampleCols)
      .in('performance_label', ['erfolgreich', 'viral'])
      .order('created_at', { ascending: false }).limit(6);
    for (const s of data || []) {
      if (beispiele.length >= 3) break;
      if (!beispiele.some((b) => b.id === s.id)) beispiele.push(s);
    }
  }
  ctx.beispiele = beispiele;

  // Anti-Patterns: max 2 nicht-erfolgreiche
  {
    const { data } = await supabase.from('skripte').select(exampleCols)
      .eq('performance_label', 'nicht_erfolgreich')
      .order('created_at', { ascending: false }).limit(2);
    ctx.antiPatterns = data || [];
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------
function fmtSection(title, obj) {
  if (!obj) return '';
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `- ${k}: ${v}`);
  if (!lines.length) return '';
  return `\n## ${title}\n${lines.join('\n')}\n`;
}

function fmtSkript(s) {
  return [
    s.titel ? `Titel: ${s.titel}` : null,
    s.hook ? `HOOK: ${s.hook}` : null,
    s.hauptteil ? `HAUPTTEIL: ${s.hauptteil}` : null,
    s.cta ? `CTA: ${s.cta}` : null
  ].filter(Boolean).join('\n');
}

// Gesprochenes Deutsch: ca. 2,3 Woerter pro Sekunde (auf 5er gerundet)
const WOERTER_PRO_SEKUNDE = 2.3;

/**
 * Menschlich lesbarer Laengen-Hinweis inkl. Wort-Budget aus einer
 * Sekunden-Spanne wie "30-45". Liefert null bei fehlender/kaputter Angabe.
 */
function videoLaengeHinweis(spanne) {
  if (!spanne) return null;
  const [von, bis] = String(spanne).split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(von) || !Number.isFinite(bis) || bis <= 0) return null;
  const rund5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  const minWoerter = rund5(von * WOERTER_PRO_SEKUNDE);
  const maxWoerter = rund5(bis * WOERTER_PRO_SEKUNDE);
  return `${von}-${bis} Sekunden gesprochen, das sind ca. ${minWoerter}-${maxWoerter} Woerter GESAMT (Hook + Hauptteil + CTA zusammen)`;
}

/**
 * Alle Kontext-Sektionen (Unternehmen ... Vorgaben) als Prompt-Text.
 * Wird von der Generierung UND der Rueckfragen-Function genutzt, damit beide
 * exakt dieselbe Datenbasis sehen.
 */
function buildKontextText(ctx, params) {
  let text = '';
  text += fmtSection('Unternehmen', ctx.unternehmen && {
    firmenname: ctx.unternehmen.firmenname,
    webseite: ctx.unternehmen.webseite
  });
  text += fmtSection('Marke', ctx.marke && {
    markenname: ctx.marke.markenname,
    branche: ctx.branche?.name || ctx.marke.branche,
    webseite: ctx.marke.webseite
  });
  if (!ctx.marke && ctx.branche) {
    text += fmtSection('Branche', { branche: ctx.branche.name });
  }
  text += fmtSection('Produkt', ctx.produkt);
  text += fmtSection('Kampagne', ctx.kampagne);
  text += fmtSection('Briefing', ctx.briefing);
  text += fmtSection('Marken-Kickoff', ctx.kickoff);
  text += fmtSection('Zielgruppen-Persona', ctx.persona && {
    name: ctx.persona.name,
    oberbegriff: ctx.persona.oberbegriff,
    alter: [ctx.persona.alter_von, ctx.persona.alter_bis].filter(Boolean).join('-') || null,
    geschlecht: ctx.persona.geschlecht,
    wohnort_region: ctx.persona.wohnort_region,
    beruf: ctx.persona.beruf,
    budgetrahmen: ctx.persona.budgetrahmen,
    bildungsstand: ctx.persona.bildungsstand,
    lebenssituation: ctx.persona.lebenssituation,
    lebensrealitaet: ctx.persona.kontext,
    pain_points: ctx.persona.pain_points,
    beschreibung: ctx.persona.beschreibung
  });
  // Regieanweisung bewusst NICHT im Prompt - reine Zusatzinfo fuer die Umsetzung
  text += fmtSection('Vorgaben fuer dieses Video', {
    video_idee: params.video_idee,
    location: params.location,
    video_laenge: videoLaengeHinweis(params.video_laenge),
    funnel_stufe: params.funnel_stufe,
    tonalitaet: params.tonalitaet
  });
  return text;
}

module.exports = { loadContext, fmtSection, fmtSkript, buildKontextText, videoLaengeHinweis };
