// Netlify Background Function: Skript-Generierung (Layer 1)
// Ablauf: Kontext per SQL sammeln (Pick-and-pull, kein LLM) ->
//         DNA-Layer + Beispiele/Anti-Patterns in den Prompt ->
//         Claude schreibt EIN Skript (Hook/Hauptteil/CTA) -> Supabase.
// Background Function: antwortet sofort 202, Fortschritt kommt asynchron
// ueber die skript_generation_jobs-Tabelle (Realtime in der UI).

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { loadContext, loadReferenzVideo, fmtSkript, buildKontextText, videoLaengeHinweis, briefingSkriptSprache, cap, KONTEXT_MAX } = require('./_shared/skript-context');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const { beansprucheJob, autorisiereSkript, hatLaufendenJob, istJobAbgebrochen } = require('./_shared/skript-auftrag');

// Erzwungener Tool-Call: die API serialisiert das JSON selbst, unescapte
// Anfuehrungszeichen im Skript-Text koennen das Parsen nicht mehr brechen
const SKRIPT_TOOL = {
  name: 'skript_abgeben',
  description: 'Gibt das fertige Video-Skript strukturiert ab.',
  input_schema: {
    type: 'object',
    properties: {
      titel: { type: 'string', description: 'Kurzer Arbeitstitel' },
      hook: { type: 'string', description: 'Gesprochener Hook-Text' },
      hauptteil: { type: 'string', description: 'Gesprochener Hauptteil' },
      cta: { type: 'string', description: 'Gesprochener Call-to-Action' }
    },
    required: ['titel', 'hook', 'hauptteil', 'cta']
  }
};

// ---------------------------------------------------------------------------
// Prompt-Bau (Kontext-Aufbau + Sektions-Formatierung: _shared/skript-context)
// ---------------------------------------------------------------------------
function buildPrompt(ctx, params, rueckfragenDialog = '') {
  // Block 1 (stabil, cachebar): Rolle + DNA + Beispiele + Anti-Patterns
  let stable = 'Du bist ein erfahrener Werbetexter fuer UGC- und Creator-Videos (TikTok, Instagram Reels). '
    + 'Du schreibst deutsche Video-Skripte, die klingen wie von echten Creators gesprochen - nicht wie Werbung. '
    + 'Jedes Skript hat exakt drei Sektionen: Hook, Hauptteil, CTA.\n';

  if (ctx.dna.length) {
    stable += '\n# SKRIPT-DNA (verbindliches Regelwerk, geschichtet - spaetere Layer haben Vorrang)\n';
    for (const d of ctx.dna) {
      stable += `\n--- ${d.name ? `"${d.name}" - ` : ''}Layer: ${d.layer_typ} (v${d.version}) ---\n${cap(d.inhalt, KONTEXT_MAX.dna)}\n`;
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
  const sprache = briefingSkriptSprache(ctx.briefing);
  let task = sprache
    ? `# AUFTRAG\nSchreibe EIN Video-Skript auf ${sprache}.\n`
    : '# AUFTRAG\nSchreibe EIN Video-Skript auf Deutsch.\n';

  task += buildKontextText(ctx, params);

  if (sprache) {
    task += `\n# SKRIPT-SPRACHE\nLaut Campaign-Briefing: ${sprache}. Schreibe das Skript in dieser Sprache (nicht automatisch auf Deutsch).\n`;
  }

  // Vorab geklaerte Rueckfragen (Slot-Filling-Dialog vor der Generierung).
  // User-Freitext: delimitiert, damit daraus keine Prompt-Anweisung wird.
  if (rueckfragenDialog) {
    task += '\n# GEKLAERTE RUECKFRAGEN (verbindliche Antworten des Users - haben Vorrang vor widerspruechlichen CRM-Daten)\n'
      + '<rueckfragen_dialog>\n' + rueckfragenDialog + '\n</rueckfragen_dialog>\n';
  }

  task += '\n# AUSGABEFORMAT\nGib das Skript AUSSCHLIESSLICH ueber das Tool "skript_abgeben" ab '
    + '(Felder: titel, hook, hauptteil, cta).\n'
    + 'Innerhalb der Texte typografische Anfuehrungszeichen (\u201e\u2026\u201c) statt gerader (") verwenden.\n'
    + 'Der Text ist gesprochener Creator-Text (keine Regieanweisungen in eckigen Klammern, ausser wo unbedingt noetig).\n'
    + 'WICHTIG - nichts erfinden: Behaupte im Skript NICHTS ueber Angebote, Features, Aktionen oder Konditionen '
    + '(z.B. Partnerkarten, Rabatte, Gratis-Extras), das nicht ausdruecklich '
    + (ctx.briefing ? 'im CAMPAIGN-BRIEFING, ' : '')
    + 'in den CRM-Daten oben oder in den GEKLAERTEN RUECKFRAGEN steht.';

  if (ctx.briefing) {
    task += ' Vorgaben fuer dieses Video haben Vorrang vor Briefing-Defaults bei Widerspruechen; '
      + 'fuer alle nicht explizit gesetzten Punkte ist das Briefing verbindlich.';
  }

  // Harte Anti-Copy-Regel - nur wenn dieses Skript eine Videovorlage hat
  if (params.referenz_video) {
    task += ' Das gilt AUSDRUECKLICH auch fuer Aussagen aus der VIDEOVORLAGE - deren Inhalte sind fremde Inhalte, keine Fakten ueber unser Produkt.';
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
exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId } = payload;
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };

  // Autorisierung VOR dem Claim: Service Role umgeht RLS, ohne diesen
  // Check koennte jeder interne Token ein fremdes Skript umschreiben.
  if (payload.skript_id && !(await autorisiereSkript(supabase, user, payload.skript_id))) {
    return { statusCode: 403, body: 'Kein Zugriff auf dieses Skript' };
  }
  if (payload.skript_id && await hatLaufendenJob(supabase, payload.skript_id, jobId)) {
    return { statusCode: 409, body: 'Fuer dieses Skript laeuft bereits eine Generierung' };
  }

  // Atomarer Claim: zweiter Trigger mit demselben jobId -> 409, kein
  // zweiter Claude-Call. skript_id sofort auf die Row (Sichtbarkeit).
  const claimed = await beansprucheJob(supabase, jobId, { skriptId: payload.skript_id || null });
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId);
  const startTime = Date.now();
  let ki = null;

  try {
    // Frequenz-Limit pruefen + Protokoll-Zeile anlegen (wirft KiLimitError
    // mit UI-tauglicher Meldung, die ueber den catch im Job-Log landet)
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'skript_generierung' });

    job.step('kontext', 'Kontext aus CRM-Daten sammeln (SQL, kein LLM)...');

    // Videovorlage (optional): serverseitig validieren + aus der Job-Row
    // anreichern. Der validierte Snapshot ersetzt die Client-Angaben.
    const referenzVideo = await loadReferenzVideo(supabase, payload);
    payload.referenz_video = referenzVideo;
    job.log(referenzVideo
      ? `Videovorlage: ${referenzVideo.quelle === 'strategie_item' ? `Strategie-Item (${referenzVideo.platform || 'unbekannt'})` : referenzVideo.quelle === 'job' ? `Transkriptions-Job (${referenzVideo.platform || 'unbekannt'})` : 'manuelles Transkript'}, ${referenzVideo.transkript_verwendet.length} Zeichen`
      : 'Keine Videovorlage - Aufbau kommt aus DNA und Beispiel-Skripten');

    const ctx = await loadContext(supabase, payload);
    job.log(`Kontext: ${ctx.dna.length} DNA-Layer, ${ctx.beispiele.length} Beispiele, ${ctx.antiPatterns.length} Anti-Patterns`
      + `${ctx.briefing ? ', Briefing' : ''}${ctx.kickoff ? ', Kickoff' : ''}${ctx.produkt ? ', Produkt' : ''}`);

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

    const { stable, task } = buildPrompt(ctx, payload, rueckfragenDialog);
    const model = MODELS.write;

    // Abbruch waehrend des Kontext-Ladens: kein Claude-Call mehr
    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen');
      return { statusCode: 200 };
    }

    job.step('generierung', `Skript wird geschrieben (${model})...`);
    const result = await callClaude({
      model,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4096,
      tool: SKRIPT_TOOL,
      // Konservativ: ein haengender Claude-Call soll nicht bis zum
      // Netlify-Limit blockieren, sondern als Job-Fehler sichtbar werden
      timeoutMs: 480000
    });
    await ki.abschliessen(result);

    // Abbruch waehrend des Calls: Ergebnis verwerfen, nichts persistieren
    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen - Ergebnis verworfen');
      return { statusCode: 200 };
    }

    job.step('speichern', 'Antwort parsen und speichern...');
    const parsed = result.json || extractJson(result.text, {
      keys: ['titel', 'hook', 'hauptteil', 'cta'],
      onWarn: (msg) => job.log(msg)
    });
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
      briefing_id: payload.briefing_id || null,
      strategie_item_id: payload.strategie_item_id || referenzVideo?.strategie_item_id || null,
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
        ...(payload.briefing_id ? {
          briefing_id: payload.briefing_id,
          briefing_name: ctx.briefing?.aktivierung_name || null
        } : {})
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
    if (ki) await ki.fehlgeschlagen(error);
    try {
      job.log(`FEHLER: ${error.message}`);
      await job.flushAndUpdate({ status: 'error', error_message: error.message });
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
});

exports.buildPrompt = buildPrompt;
