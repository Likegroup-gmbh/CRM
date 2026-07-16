// Netlify Background Function: Skript-Generierung (Layer 1)
// Ablauf: Kontext per SQL sammeln (Pick-and-pull, kein LLM) ->
//         DNA-Layer + Beispiele/Anti-Patterns in den Prompt ->
//         Claude schreibt EIN Skript (Hook/Hauptteil/CTA) -> Supabase.
// Background Function: antwortet sofort 202, Fortschritt kommt asynchron
// ueber die skript_generation_jobs-Tabelle (Realtime in der UI).

const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function createJobUpdater(supabase, jobId) {
  const logs = [];
  let queue = Promise.resolve();

  const enqueue = (patch) => {
    queue = queue
      .then(() => supabase.from('skript_generation_jobs').update({ ...patch, logs }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Supabase-Write fehlgeschlagen:`, e.message));
  };

  const pushLog = (msg) => {
    logs.push({ ts: new Date().toISOString(), msg });
    console.log(`[${jobId}] ${msg}`);
  };

  return {
    step(progressStep, msg) {
      if (msg) pushLog(msg);
      enqueue({ progress_step: progressStep, status: 'running' });
    },
    log(msg) {
      pushLog(msg);
      enqueue({});
    },
    async flushAndUpdate(patch) {
      await queue;
      await supabase.from('skript_generation_jobs').update({ ...patch, logs }).eq('id', jobId);
    }
  };
}

// ---------------------------------------------------------------------------
// Kontext-Aufbau: alle Quellen per SQL (kein LLM noetig)
// ---------------------------------------------------------------------------
async function loadContext(supabase, params) {
  const { marke_id, kampagne_id, produkt_id, persona_id, mit_dna, dna_id } = params;
  const ctx = { dnaVersionen: [], beispiele: [], antiPatterns: [] };

  if (marke_id) {
    const { data } = await supabase.from('marke')
      .select('id, markenname, webseite, branche, branche_id').eq('id', marke_id).single();
    ctx.marke = data;
  }

  if (produkt_id) {
    const { data } = await supabase.from('produkt')
      .select('name, url, kernbotschaft, hauptproblem, kernnutzen, usp_1, usp_2, usp_3, kauf_conversion_trigger, zielnutzer_anwendungskontext')
      .eq('id', produkt_id).single();
    ctx.produkt = data;
  }

  if (persona_id) {
    const { data } = await supabase.from('personas')
      .select('id, name, beschreibung, branche_id, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, kontext, pain_points')
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
      .eq('id', dna_id).single();
    if (!data) throw new Error('Gewaehlte DNA nicht gefunden');
    ctx.dna = [data];
    ctx.dnaVersionen = [{ id: data.id, name: data.name, layer: data.layer_typ, version: data.version }];
  } else {
    const brancheId = ctx.marke?.branche_id || ctx.persona?.branche_id || null;
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
// Prompt-Bau
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

function buildPrompt(ctx, params) {
  // Block 1 (stabil, cachebar): Rolle + DNA + Beispiele + Anti-Patterns
  let stable = 'Du bist ein erfahrener Werbetexter fuer UGC- und Creator-Videos (TikTok, Instagram Reels). '
    + 'Du schreibst deutsche Video-Skripte, die klingen wie von echten Creators gesprochen - nicht wie Werbung. '
    + 'Jedes Skript hat exakt drei Sektionen: Hook, Hauptteil, CTA.\n';

  if (ctx.dna.length) {
    stable += '\n# SKRIPT-DNA (verbindliches Regelwerk, geschichtet - spaetere Layer haben Vorrang)\n';
    for (const d of ctx.dna) {
      stable += `\n--- ${d.name ? `"${d.name}" - ` : ''}Layer: ${d.layer_typ} (v${d.version}) ---\n${d.inhalt}\n`;
    }
  }

  if (ctx.beispiele.length) {
    stable += '\n# ERFOLGREICHE BEISPIEL-SKRIPTE (an diesen Mustern orientieren, NICHT kopieren)\n';
    ctx.beispiele.forEach((s, i) => {
      stable += `\n--- Beispiel ${i + 1} (${s.performance_label}) ---\n${fmtSkript(s)}\n`;
    });
  }

  if (ctx.antiPatterns.length) {
    stable += '\n# ANTI-PATTERNS (diese Skripte haben NICHT funktioniert - solche Muster vermeiden)\n';
    ctx.antiPatterns.forEach((s, i) => {
      stable += `\n--- Anti-Beispiel ${i + 1} ---\n${fmtSkript(s)}\n`;
    });
  }

  // Block 2 (variabel): Auftrag dieser Generierung
  let task = '# AUFTRAG\nSchreibe EIN Video-Skript auf Deutsch.\n';
  task += fmtSection('Marke', ctx.marke && { markenname: ctx.marke.markenname, branche: ctx.marke.branche, webseite: ctx.marke.webseite });
  task += fmtSection('Produkt', ctx.produkt);
  task += fmtSection('Kampagne', ctx.kampagne);
  task += fmtSection('Briefing', ctx.briefing);
  task += fmtSection('Marken-Kickoff', ctx.kickoff);
  task += fmtSection('Zielgruppen-Persona', ctx.persona && {
    name: ctx.persona.name,
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
  task += fmtSection('Vorgaben fuer dieses Video', {
    video_idee: params.video_idee,
    location: params.location,
    funnel_stufe: params.funnel_stufe,
    tonalitaet: params.tonalitaet
  });

  task += '\n# AUSGABEFORMAT\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:\n'
    + '{"titel": "kurzer Arbeitstitel", "hook": "...", "hauptteil": "...", "cta": "..."}\n'
    + 'Der Text ist gesprochener Creator-Text (keine Regieanweisungen in eckigen Klammern, ausser wo unbedingt noetig).';

  return { stable, task };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const user = await verifyAuth(event, supabase);
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { jobId } = payload;
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };

  const job = createJobUpdater(supabase, jobId);
  const startTime = Date.now();

  try {
    job.step('kontext', 'Kontext aus CRM-Daten sammeln (SQL, kein LLM)...');
    const ctx = await loadContext(supabase, payload);
    job.log(`Kontext: ${ctx.dna.length} DNA-Layer, ${ctx.beispiele.length} Beispiele, ${ctx.antiPatterns.length} Anti-Patterns`
      + `${ctx.briefing ? ', Briefing' : ''}${ctx.kickoff ? ', Kickoff' : ''}${ctx.produkt ? ', Produkt' : ''}`);

    const { stable, task } = buildPrompt(ctx, payload);
    const model = MODELS.write;

    job.step('generierung', `Skript wird geschrieben (${model})...`);
    const result = await callClaude({
      model,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4096
    });

    job.step('speichern', 'Antwort parsen und speichern...');
    const parsed = extractJson(result.text);
    if (!parsed.hook || !parsed.hauptteil || !parsed.cta) {
      throw new Error('Antwort unvollstaendig (hook/hauptteil/cta fehlt)');
    }

    const { data: skript, error: insertError } = await supabase.from('skripte').insert({
      titel: parsed.titel || null,
      marke_id: payload.marke_id || null,
      kampagne_id: payload.kampagne_id || null,
      produkt_id: payload.produkt_id || null,
      persona_id: payload.persona_id || null,
      hook: parsed.hook,
      hauptteil: parsed.hauptteil,
      cta: parsed.cta,
      video_idee: payload.video_idee || null,
      location: payload.location || null,
      regieanweisung: payload.regieanweisung || null,
      funnel_stufe: payload.funnel_stufe || null,
      tonalitaet: payload.tonalitaet || null,
      herkunft: 'generiert',
      status: 'entwurf',
      mit_dna: payload.mit_dna !== false,
      model: result.model,
      prompt_kontext: {
        dna_versionen: ctx.dnaVersionen,
        beispiel_ids: ctx.beispiele.map((s) => s.id),
        anti_pattern_ids: ctx.antiPatterns.map((s) => s.id),
        usage: result.usage
      },
      created_by: user.id
    }).select('id').single();

    if (insertError) throw new Error(`Skript-Insert fehlgeschlagen: ${insertError.message}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    job.log(`Fertig in ${elapsed}s (Tokens: ${result.usage?.input_tokens ?? '?'} in / ${result.usage?.output_tokens ?? '?'} out)`);
    await job.flushAndUpdate({ status: 'done', progress_step: 'done', skript_id: skript.id });

    return { statusCode: 200 };
  } catch (error) {
    console.error(`[${jobId}] Fehler:`, error.message);
    try {
      job.log(`FEHLER: ${error.message}`);
      await job.flushAndUpdate({ status: 'error', error_message: error.message });
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};
