// Netlify Background Function: Skript-Generierung (Layer 1)
// Ablauf: Kontext per SQL sammeln (Pick-and-pull, kein LLM) ->
//         DNA-Layer in den Prompt ->
//         Claude schreibt EIN drehfertiges Markdown-Dokument (inhalt_md) -> Supabase.
// Background Function: antwortet sofort 202, Fortschritt kommt asynchron
// ueber die skript_generation_jobs-Tabelle (Realtime in der UI).

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { loadContext, loadReferenzVideo, buildKontextText, videoLaengeHinweis, briefingSkriptSprache, cap, KONTEXT_MAX } = require('./_shared/skript-context');
const { fmtMasterBlock, MASTER_BEREICH_LABELS } = require('./_shared/skript-master');
const { extractSkriptAusMaster } = require('./_shared/skript-creator-facing');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const { beansprucheJob, autorisiereSkript, hatLaufendenJob, istJobAbgebrochen } = require('./_shared/skript-auftrag');

// Erzwungener Tool-Call: die API serialisiert das JSON selbst, unescapte
// Anfuehrungszeichen im Skript-Text koennen das Parsen nicht mehr brechen
const SKRIPT_TOOL = {
  name: 'skript_abgeben',
  description: 'Gibt das fertige drehfertige Konzept als Markdown-Dokument plus Hook/Hauptteil/CTA ab.',
  input_schema: {
    type: 'object',
    properties: {
      titel: { type: 'string', description: 'Kurzer Arbeitstitel' },
      inhalt_md: {
        type: 'string',
        description: 'Nur Zusatzinfos (Produktionskopf, Timing, Shotlist, Brand-Hinweise). KEINE Creator-facing-Tabelle, KEINE Variantenuebersicht, KEINE alternativen Opener/Hooks/CTAs.'
      },
      hook: { type: 'string', description: 'Gesprochener Hook der Hauptvariante A. Jeder Zeitbeat eigener Absatz, Leerzeile dazwischen, gleiche Anzahl wie hook_visuell.' },
      hauptteil: { type: 'string', description: 'Gesprochener Hauptteil der Hauptvariante A. Jeder Zeitbeat eigener Absatz, Leerzeile dazwischen, gleiche Anzahl wie hauptteil_visuell.' },
      cta: { type: 'string', description: 'Gesprochener CTA der Hauptvariante A. Jeder Zeitbeat eigener Absatz, Leerzeile dazwischen, gleiche Anzahl wie cta_visuell.' },
      hook_visuell: { type: 'string', description: 'Was zu sehen ist im Hook (Variante A). Jeder Zeitmarker (Sek. 0–3:) beginnt einen neuen Absatz, Leerzeile dazwischen. On-Screen-Text am jeweiligen Beat.' },
      hauptteil_visuell: { type: 'string', description: 'Was zu sehen ist im Hauptteil (Variante A). Jeder Zeitmarker beginnt einen neuen Absatz, Leerzeile dazwischen. On-Screen-Text am jeweiligen Beat.' },
      cta_visuell: { type: 'string', description: 'Was zu sehen ist im CTA (Variante A). Jeder Zeitmarker beginnt einen neuen Absatz, Leerzeile dazwischen. On-Screen-Text am jeweiligen Beat.' },
      varianten: {
        type: 'array',
        description: 'Genau zwei alternative Skript-Varianten (B und C). Nicht in inhalt_md wiederholen.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'B oder C' },
            beschreibung: { type: 'string', description: 'Kurzer Unterschied zur Hauptvariante' },
            hook: { type: 'string' },
            hauptteil: { type: 'string' },
            cta: { type: 'string' },
            hook_visuell: { type: 'string' },
            hauptteil_visuell: { type: 'string' },
            cta_visuell: { type: 'string' }
          }
        }
      }
    },
    required: ['titel', 'inhalt_md']
  }
};

// ---------------------------------------------------------------------------
// Prompt-Bau (Kontext-Aufbau + Sektions-Formatierung: _shared/skript-context)
// ---------------------------------------------------------------------------
function buildPrompt(ctx, params, rueckfragenDialog = '') {
  const master = ctx.master || [];
  const dna = ctx.dna || [];

  // Block 1 (stabil, cachebar): Rolle + Master + DNA
  let stable = 'Du bist ein erfahrener Creative Director fuer Social-Video-Content '
    + '(Owned Media, Paid Ads, Influencer-Konzepte; TikTok, Instagram Reels). '
    + 'Du schreibst drehfertige Konzepte nach dem verbindlichen Master-Regelwerk. '
    + 'Die drei Systeme Owned, Paid und Influencer duerfen nicht vermischt werden. '
    + 'Fehlende Produktfakten, Claims, Preise, Offers, Bewertungen oder Ergebnisse darfst du niemals erfinden.\n';

  stable += fmtMasterBlock(master);

  if (dna.length) {
    stable += '\n# SKRIPT-DNA (verbindliches Regelwerk, geschichtet - spaetere Layer haben Vorrang)\n';
    for (const d of dna) {
      stable += `\n--- ${d.name ? `"${d.name}" - ` : ''}Layer: ${d.layer_typ} (v${d.version}) ---\n${cap(d.inhalt, KONTEXT_MAX.dna)}\n`;
    }
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

  const bereichLabel = MASTER_BEREICH_LABELS[ctx.bereich] || ctx.bereich || 'unbekannt';
  if (ctx.modus?.inhalt) {
    task += `\n# REGIE-MODUS: ${ctx.modus.name}\n${ctx.modus.inhalt}\n`;
  }

  task += '\n# AUSGABEFORMAT\nGib das Dokument AUSSCHLIESSLICH ueber das Tool "skript_abgeben" ab '
    + '(Felder: titel, inhalt_md, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, varianten).\n'
    + `Bereich: ${bereichLabel}. Folge dem drehfertigen Aufbau im MASTER-BEREICH-Dokument. `
    + 'inhalt_md = NUR Zusatzinfos: Produktionskopf, Timing, Brand-Hinweise, Shotlist, Pflicht-Shots, '
    + 'On-Screen-Liste, Schnitt/Sound. Mit ##-Ueberschriften nach den Hauptbloecken '
    + '(nicht nach Unterpunkten A/B/C als ##).\n'
    + 'NICHT in inhalt_md: Creator-facing-Tabelle, Variantenuebersicht, alternative Opener/Hooks/CTAs, '
    + 'Zweispalter "gesprochen / zu sehen". Diese Inhalte gehoeren AUSSCHLIESSLICH in die Skript-Felder.\n'
    + 'Variante A: hook/hauptteil/cta (gesprochen) plus hook_visuell/hauptteil_visuell/cta_visuell '
    + '(was zu sehen ist) – direkt mitgenerieren.\n'
    + 'ZEITMARKER: Jeder Beat beginnt einen neuen Absatz (Leerzeile dazwischen), '
    + 'Format „Sek. 0–3: …“. Links (gesagt) und rechts (sehen) dieselbe Absatz-Anzahl. '
    + 'On-Screen-Text gehoert zum Beat, nicht als Liste ans Ende. '
    + 'Marker alle paar Sekunden, nicht sekündlich. Niemals alle Marker in einen Fliesstext packen.\n'
    + 'Varianten B und C: Array "varianten" (label B/C, beschreibung, abweichende Felder). '
    + 'Meist nur Hook/Opener anders, Hauptteil und CTA gleich. NICHT in inhalt_md wiederholen.\n'
    + 'Tabellen als Markdown-Tabellen. Innerhalb der Texte typografische Anfuehrungszeichen (\u201e\u2026\u201c) statt gerader (") verwenden.\n'
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

    job.step('kontext', 'Ich sammle den Kontext aus den CRM-Daten…');

    // Videovorlage (optional): serverseitig validieren + aus der Job-Row
    // anreichern. Der validierte Snapshot ersetzt die Client-Angaben.
    const referenzVideo = await loadReferenzVideo(supabase, payload);
    payload.referenz_video = referenzVideo;
    job.log(referenzVideo
      ? `Videovorlage: ${referenzVideo.quelle === 'strategie_item' ? `Strategie-Item (${referenzVideo.platform || 'unbekannt'})` : referenzVideo.quelle === 'job' ? `Transkriptions-Job (${referenzVideo.platform || 'unbekannt'})` : 'manuelles Transkript'}, ${referenzVideo.transkript_verwendet.length} Zeichen`
      : 'Keine Videovorlage - Aufbau kommt aus DNA');

    const ctx = await loadContext(supabase, payload);
    if (!ctx.bereich) {
      throw new Error('Bereich fehlt – bitte Owned Social, Paid Creator Ads oder Influencer Marketing wählen');
    }
    if (payload.modus) {
      const { data: modus } = await supabase.from('skript_modi')
        .select('slug, name, inhalt')
        .eq('slug', payload.modus)
        .eq('status', 'aktiv')
        .maybeSingle();
      ctx.modus = modus || null;
    }
    job.log(`Kontext: Bereich ${ctx.bereich}, ${ctx.master.length} Master-Docs, ${ctx.dna.length} DNA-Layer`
      + `${ctx.briefing ? ', Briefing' : ''}${ctx.produkt ? ', Produkt' : ''}${ctx.modus ? `, Modus ${ctx.modus.slug}` : ''}`);

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

    job.step('generierung', 'Ich schreibe das Skript…');
    job.log(`Modell: ${model}`);
    const result = await callClaude({
      model,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 8192,
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

    job.step('speichern', 'Fast fertig – ich speichere…');
    const parsed = result.json || extractJson(result.text, {
      keys: ['titel', 'inhalt_md', 'hook', 'hauptteil', 'cta',
        'hook_visuell', 'hauptteil_visuell', 'cta_visuell', 'varianten'],
      onWarn: (msg) => job.log(msg)
    });
    if (!(parsed.inhalt_md || '').trim()) {
      throw new Error('Antwort unvollstaendig (inhalt_md fehlt)');
    }
    const { felder, varianten, inhalt_md: extraMd } = extractSkriptAusMaster(parsed.inhalt_md, parsed);
    const inhaltMd = extraMd || '';
    if (varianten.length) {
      job.log(`${varianten.length} Alternative(n) als eigene Versionen`);
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
      bereich: ctx.bereich,
      strategie_item_id: payload.strategie_item_id || referenzVideo?.strategie_item_id || null,
      inhalt_md: inhaltMd,
      hook: felder.hook,
      hauptteil: felder.hauptteil,
      cta: felder.cta,
      hook_visuell: felder.hook_visuell,
      hauptteil_visuell: felder.hauptteil_visuell,
      cta_visuell: felder.cta_visuell,
      aktive_version_nr: 1,
      aktive_sub_nr: 0,
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
        master_versionen: ctx.masterVersionen,
        bereich: ctx.bereich,
        modus: payload.modus || null,
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

    // v1 = Hauptvariante. Weitere Opener/Hooks/CTAs als v2, v3, …
    const versionRows = [
      {
        skript_id: skript.id,
        version_nr: 1,
        sub_nr: 0,
        titel: parsed.titel || null,
        inhalt_md: inhaltMd,
        hook: felder.hook,
        hauptteil: felder.hauptteil,
        cta: felder.cta,
        hook_visuell: felder.hook_visuell,
        hauptteil_visuell: felder.hauptteil_visuell,
        cta_visuell: felder.cta_visuell,
        aenderung_beschreibung: 'Erstgenerierung',
        created_by: user.id
      },
      ...varianten.map((v, i) => ({
        skript_id: skript.id,
        version_nr: i + 2,
        sub_nr: 0,
        titel: parsed.titel || null,
        inhalt_md: inhaltMd,
        hook: v.felder.hook,
        hauptteil: v.felder.hauptteil,
        cta: v.felder.cta,
        hook_visuell: v.felder.hook_visuell,
        hauptteil_visuell: v.felder.hauptteil_visuell,
        cta_visuell: v.felder.cta_visuell,
        aenderung_beschreibung: v.beschreibung,
        created_by: user.id
      }))
    ];
    const { error: versionError } = await supabase.from('skript_versionen').insert(versionRows);
    if (versionError) job.log(`Hinweis: Versions-Snapshots fehlgeschlagen (${versionError.message})`);

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
