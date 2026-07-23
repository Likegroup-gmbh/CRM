// Netlify Background Function: Skript-Generierung (Layer 1)
// Ablauf: Kontext per SQL sammeln (Pick-and-pull, kein LLM) ->
//         DNA-Layer + Beispiele/Anti-Patterns in den Prompt ->
//         Claude schreibt EIN Skript (Hook/Hauptteil/CTA) -> Supabase.
// Background Function: antwortet sofort 202, Fortschritt kommt asynchron
// ueber die skript_generation_jobs-Tabelle (Realtime in der UI).

const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { loadContext, fmtSkript, buildKontextText, videoLaengeHinweis } = require('./_shared/skript-context');
const { ladeBriefingExtrakt } = require('./_shared/skript-briefing');

// ---------------------------------------------------------------------------
// Videovorlage (Pflicht): Client-Angaben serverseitig validieren und mit der
// Job-Row aus transcription_jobs anreichern. Metadaten kommen IMMER aus der
// DB (nicht faelschbar); das ggf. vom User korrigierte Transkript bleibt
// bewusst die Client-Fassung ("transkript_verwendet" = Prompt-Snapshot).
// ---------------------------------------------------------------------------
async function loadReferenzVideo(supabase, payload) {
  const ref = payload.referenz_video;
  const transkript = String(ref?.transkript_verwendet || '').trim();
  if (!ref || !String(ref.url || '').trim() || !transkript) {
    throw new Error('Videovorlage fehlt - jedes neue Skript braucht eine Referenz (URL + Transkript)');
  }

  const referenz = {
    url: String(ref.url).trim(),
    transcription_job_id: ref.transcription_job_id || null,
    quelle: ref.transcription_job_id ? 'job' : 'manual',
    transkript_verwendet: transkript,
    beschreibung: String(ref.beschreibung || '').trim() || null,
    caption: String(ref.caption || '').trim() || null,
    platform: null,
    duration_seconds: null,
    author_name: null,
    metrics: { likes: null, comments: null, shares: null, saves: null }
  };

  if (referenz.quelle === 'job') {
    const { data: job } = await supabase.from('transcription_jobs')
      .select('id, url, status, platform, duration_seconds, author_name, description, caption, likes_count, comments_count, shares_count, saves_count')
      .eq('id', referenz.transcription_job_id).single();
    if (!job) throw new Error('Transkriptions-Job der Videovorlage nicht gefunden');
    if (job.status !== 'done') throw new Error('Transkription der Videovorlage ist noch nicht abgeschlossen');
    if (job.url !== referenz.url) throw new Error('URL der Videovorlage passt nicht zum Transkriptions-Job');

    referenz.platform = job.platform || null;
    referenz.duration_seconds = job.duration_seconds ?? null;
    referenz.author_name = job.author_name || null;
    referenz.beschreibung = referenz.beschreibung || job.description || null;
    referenz.caption = referenz.caption || job.caption || null;
    referenz.metrics = {
      likes: job.likes_count ?? null,
      comments: job.comments_count ?? null,
      shares: job.shares_count ?? null,
      saves: job.saves_count ?? null
    };
  } else if (transkript.length < 50) {
    throw new Error('Manuelles Transkript der Videovorlage ist zu kurz (min. 50 Zeichen)');
  }

  return referenz;
}

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
// Prompt-Bau (Kontext-Aufbau + Sektions-Formatierung: _shared/skript-context)
// ---------------------------------------------------------------------------
function buildPrompt(ctx, params, rueckfragenDialog = '', briefingExtrakt = null) {
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

  // Hochgeladenes PDF-Briefing: verbindlichste Faktenquelle
  if (briefingExtrakt) {
    task += '\n# PDF-BRIEFING (verbindliche Faktenbasis - hat Vorrang vor den CRM-Daten unten)\n'
      + briefingExtrakt + '\n';
  }

  task += buildKontextText(ctx, params);

  // Vorab geklaerte Rueckfragen (Slot-Filling-Dialog vor der Generierung)
  if (rueckfragenDialog) {
    task += '\n# GEKLAERTE RUECKFRAGEN (verbindliche Antworten des Users - haben Vorrang vor widerspruechlichen CRM-Daten)\n'
      + rueckfragenDialog + '\n';
  }

  task += '\n# AUSGABEFORMAT\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:\n'
    + '{"titel": "kurzer Arbeitstitel", "hook": "...", "hauptteil": "...", "cta": "..."}\n'
    + 'Der Text ist gesprochener Creator-Text (keine Regieanweisungen in eckigen Klammern, ausser wo unbedingt noetig).\n'
    + 'WICHTIG - nichts erfinden: Behaupte im Skript NICHTS ueber Angebote, Features, Aktionen oder Konditionen '
    + '(z.B. Partnerkarten, Rabatte, Gratis-Extras), das nicht ausdruecklich '
    + (briefingExtrakt ? 'im PDF-BRIEFING, ' : '')
    + 'in den CRM-Daten oben oder in den GEKLAERTEN RUECKFRAGEN steht. '
    + 'Das gilt AUSDRUECKLICH auch fuer Aussagen aus der VIDEOVORLAGE - deren Inhalte sind fremde Inhalte, keine Fakten ueber unser Produkt.';

  // Harte Anti-Copy-Regel zur Videovorlage (Pflicht-Referenz jedes Skripts)
  if (params.referenz_video) {
    task += '\nVIDEOVORLAGE-REGEL (verbindlich): Uebernimm von der Vorlage NUR die abstrakte Bauweise '
      + '(Hook-Typ, Dramaturgie, Pace, Szenenfolge, CTA-Mechanik). '
      + 'KEINE Hook-Formulierung, KEINE Satzstruktur im Wortlaut, KEINE CTA-Formulierung '
      + 'und KEINE Behauptung aus der Vorlage woertlich oder nah paraphrasiert uebernehmen.';
  }

  // Harte Laengen-Regel: Wort-Budget aus der gewaehlten Video-Laenge
  const laengenHinweis = videoLaengeHinweis(params.video_laenge);
  if (laengenHinweis) {
    task += `\nHARTES WORT-BUDGET: Ziel-Laenge ist ${laengenHinweis}. `
      + 'Dieses Budget ist verbindlich - dimensioniere vor allem den Hauptteil entsprechend. '
      + 'Im Zweifel lieber knapp unter dem Budget bleiben als darueber.';
  }

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

    // Videovorlage (Pflicht): serverseitig validieren + aus der Job-Row
    // anreichern. Der validierte Snapshot ersetzt die Client-Angaben.
    const referenzVideo = await loadReferenzVideo(supabase, payload);
    payload.referenz_video = referenzVideo;
    job.log(`Videovorlage: ${referenzVideo.quelle === 'job' ? `Transkriptions-Job (${referenzVideo.platform || 'unbekannt'})` : 'manuelles Transkript'}, ${referenzVideo.transkript_verwendet.length} Zeichen`);

    const ctx = await loadContext(supabase, payload);
    job.log(`Kontext: ${ctx.dna.length} DNA-Layer, ${ctx.beispiele.length} Beispiele, ${ctx.antiPatterns.length} Anti-Patterns`
      + `${ctx.briefing ? ', Briefing' : ''}${ctx.kickoff ? ', Kickoff' : ''}${ctx.produkt ? ', Produkt' : ''}`);

    // Hochgeladenes PDF-Briefing durchforsten (Cache am Stub greift, wenn die
    // Rueckfragen-Phase es schon extrahiert hat)
    let briefingExtrakt = null;
    if (payload.briefing_pdf?.pfad) {
      job.step('briefing', `PDF-Briefing "${payload.briefing_pdf.name || 'Dokument'}" wird durchforstet...`);
      briefingExtrakt = await ladeBriefingExtrakt(supabase, payload, payload.skript_id || null, (msg) => job.log(msg));
    }

    // Rueckfragen-Stub: geklaerten Frage/Antwort-Dialog in den Prompt aufnehmen
    let rueckfragenDialog = '';
    if (payload.skript_id) {
      const { data: dialog } = await supabase.from('skript_chat_messages')
        .select('rolle, inhalt')
        .eq('skript_id', payload.skript_id).eq('aktion', 'rueckfrage')
        .order('created_at');
      rueckfragenDialog = (dialog || [])
        .filter((m) => (m.inhalt || '').trim())
        .map((m) => `${m.rolle === 'user' ? 'User' : 'Liky'}: ${m.inhalt.trim()}`)
        .join('\n');
      if (rueckfragenDialog) job.log('Geklaerte Rueckfragen fliessen in den Prompt ein');
    }

    const { stable, task } = buildPrompt(ctx, payload, rueckfragenDialog, briefingExtrakt);
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

    // Bestehendes prompt_kontext (Stub) fuer den Merge laden: der
    // generator_payload und evtl. Caches duerfen nicht verloren gehen
    let bestehenderKontext = {};
    if (payload.skript_id) {
      const { data: stub } = await supabase.from('skripte')
        .select('prompt_kontext').eq('id', payload.skript_id).single();
      bestehenderKontext = stub?.prompt_kontext || {};
    }
    // Generator-Payload ohne interne Steuerfelder persistieren
    const { jobId: _jobId, skript_id: _skriptId, ...generatorPayload } = payload;

    const skriptDaten = {
      titel: parsed.titel || null,
      unternehmen_id: payload.unternehmen_id || null,
      marke_id: payload.marke_id || null,
      kampagne_id: payload.kampagne_id || null,
      produkt_id: payload.produkt_id || null,
      persona_id: payload.persona_id || null,
      branche_id: ctx.brancheId || null,
      hook: parsed.hook,
      hauptteil: parsed.hauptteil,
      cta: parsed.cta,
      video_idee: payload.video_idee || null,
      location: payload.location || null,
      regieanweisung: payload.regieanweisung || null,
      video_laenge: payload.video_laenge || null,
      funnel_stufe: payload.funnel_stufe || null,
      tonalitaet: payload.tonalitaet || null,
      herkunft: 'generiert',
      status: 'entwurf',
      mit_dna: payload.mit_dna !== false,
      model: result.model,
      // Merge statt Replace: generator_payload (Retry/Anzeige) und der
      // Referenz-Snapshot muessen die Generierung ueberleben
      prompt_kontext: {
        ...bestehenderKontext,
        generator_payload: generatorPayload,
        referenz_video: referenzVideo,
        dna_versionen: ctx.dnaVersionen,
        beispiel_ids: ctx.beispiele.map((s) => s.id),
        anti_pattern_ids: ctx.antiPatterns.map((s) => s.id),
        usage: result.usage,
        ...(payload.briefing_pdf ? { briefing_pdf: payload.briefing_pdf } : {}),
        ...(briefingExtrakt ? { briefing_extrakt: briefingExtrakt } : {})
      }
    };

    // Rueckfragen-Flow: Stub-Row aktualisieren statt neu anlegen
    let skript;
    if (payload.skript_id) {
      const { data, error: updateError } = await supabase.from('skripte')
        .update(skriptDaten).eq('id', payload.skript_id).select('id').single();
      if (updateError) throw new Error(`Skript-Update fehlgeschlagen: ${updateError.message}`);
      skript = data;
    } else {
      const { data, error: insertError } = await supabase.from('skripte')
        .insert({ ...skriptDaten, created_by: user.id }).select('id').single();
      if (insertError) throw new Error(`Skript-Insert fehlgeschlagen: ${insertError.message}`);
      skript = data;
    }

    // Ausgangsversion (v1) fuer den Chat-Editor snapshotten.
    // Nicht kritisch fuer die Generierung -> Fehler nur loggen.
    const { error: versionError } = await supabase.from('skript_versionen').insert({
      skript_id: skript.id,
      version_nr: 1,
      titel: parsed.titel || null,
      hook: parsed.hook,
      hauptteil: parsed.hauptteil,
      cta: parsed.cta,
      aenderung_beschreibung: 'Erstgenerierung',
      created_by: user.id
    });
    if (versionError) job.log(`Hinweis: v1-Snapshot fehlgeschlagen (${versionError.message})`);

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
