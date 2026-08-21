// Netlify Background Function: DNA-Destillation (Layer 1)
// Verdichtet gesammeltes Sektions-Feedback + Performance-Labels zu einem
// NEUEN DNA-Entwurf fuer einen Layer (global/branche/zielgruppe/marke).
// Der Entwurf wird NICHT aktiviert - ein Mensch reviewt und gibt frei (UI).

const { callClaude, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const { beansprucheJob, istJobAbgebrochen } = require('./_shared/skript-auftrag');
const { fmtSkript, cap, KONTEXT_MAX } = require('./_shared/skript-context');

const DISTILL_SYSTEM_TEXT = 'Du bist Analyst fuer Video-Werbeskripte. Du destillierst aus Skripten, '
  + 'menschlichem Sektions-Feedback (Hook/Hauptteil/CTA, Scores 1-5 mit Zwischenwerten, '
  + 'teils mit Bezug auf eine konkrete markierte Textstelle), visueller Regie '
  + '("Was zu sehen ist") und Performance-Labels '
  + 'ein praezises Regelwerk ("Skript-DNA"). Regeln muessen konkret und anwendbar sein - '
  + 'keine Binsenweisheiten. Erhalte bewaehrte Regeln der bisherigen DNA, verfeinere sie mit '
  + 'neuen Erkenntnissen, entferne widerlegte Regeln. Kennzeichne NICHTS als vorlaeufig; '
  + 'schreibe das Dokument so, dass es direkt als Anweisung fuer einen Skript-Autor dient. '
  + 'Beachte die Marker im Material: Skripte "generiert OHNE DNA (Blindvergleich)" sagen nichts '
  + 'ueber die Qualitaet der bisherigen DNA aus - ihr Feedback ist reines Text-Lernsignal. '
  + 'Feedback mit "-> Ueberarbeitung wurde ANGENOMMEN" ist besonders verlaesslich (der Mensch hat '
  + 'die daraus entstandene Aenderung uebernommen), bei ABGELEHNT die daraus gezogene Regel hinterfragen. '
  + 'Struktur: Markdown mit Abschnitten Hook, Hauptteil, CTA, Visuell, Tonalitaet, Anti-Patterns.';

// Hartes Material-Budget: 40 Skripte mit Feedback koennen den Prompt sonst
// auf das Vielfache des sinnvollen Kontexts aufblaehen. Skripte werden der
// Reihe nach aufgenommen, bis das Budget voll ist (fmtSkript kuerzt die
// Einzeltexte bereits intern).
const DISTILL_MATERIAL_MAX = 60000;

function buildDistillMaterial(skripte, feedbackBySkript) {
  let material = '';
  let ausgelassen = 0;
  for (const s of skripte || []) {
    const fbs = feedbackBySkript[s.id] || [];
    if (!fbs.length && s.performance_label === 'unbewertet') continue;
    const marker = [
      `Performance: ${s.performance_label}`,
      s.funnel_stufe ? `Funnel: ${s.funnel_stufe}` : null,
      s.mit_dna === false ? 'generiert OHNE DNA (Blindvergleich)' : null
    ].filter(Boolean).join(', ');
    let block = `\n--- Skript "${s.titel || s.id}" (${marker}) ---\n`;
    block += `${fmtSkript(s)}\n`;
    if (s.performance_notiz) block += `PERFORMANCE-NOTIZ: ${cap(s.performance_notiz, 500)}\n`;
    for (const f of fbs) {
      const bezug = f.selektion_text ? ` zu "${cap(f.selektion_text, 500)}"` : '';
      const outcome = f.skript_chat_messages?.status === 'angenommen'
        ? ' -> daraus generierte Ueberarbeitung wurde ANGENOMMEN'
        : f.skript_chat_messages?.status === 'abgelehnt'
          ? ' -> daraus generierte Ueberarbeitung wurde ABGELEHNT'
          : '';
      block += `FEEDBACK [${f.sektion}]${bezug} Score ${f.score ?? '-'}/5: ${cap(f.begruendung, KONTEXT_MAX.antiPattern) || '-'}${outcome}\n`;
      if (f.korrigierte_version) block += `KORRIGIERT [${f.sektion}]: ${cap(f.korrigierte_version, KONTEXT_MAX.beispiel)}\n`;
    }
    if (material.length + block.length > DISTILL_MATERIAL_MAX) {
      ausgelassen++;
      continue;
    }
    material += block;
  }
  if (ausgelassen) {
    material += `\n[... ${ausgelassen} weitere Skripte aus Budget-Gruenden weggelassen ...]\n`;
  }
  return material;
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, layer_typ, branche_id, persona_id, marke_id, name } = payload;
  if (!jobId || !layer_typ) return { statusCode: 400, body: 'jobId/layer_typ fehlt' };

  // Atomarer Claim: zweiter Trigger mit demselben jobId -> 409.
  // Distill hat kein skript_id - Sichtbarkeit laeuft ueber created_by (RLS).
  const claimed = await beansprucheJob(supabase, jobId);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId);
  let ki = null;

  try {
    // Frequenz-Limit pruefen + Protokoll-Zeile anlegen
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'dna_destillat' });

    // ------------------------------------------------------------------
    // 1. Aktuelle DNA dieses Layers laden (Basis der Ueberarbeitung)
    // ------------------------------------------------------------------
    job.step('laden', 'Aktive DNA und Feedback-Daten laden...');
    let dnaQuery = supabase.from('skript_dna')
      .select('id, name, version, inhalt').eq('layer_typ', layer_typ).eq('status', 'aktiv')
      .order('version', { ascending: false }).limit(1);
    if (layer_typ === 'branche') dnaQuery = dnaQuery.eq('branche_id', branche_id);
    if (layer_typ === 'zielgruppe') dnaQuery = dnaQuery.eq('persona_id', persona_id);
    if (layer_typ === 'marke') dnaQuery = dnaQuery.eq('marke_id', marke_id);
    const { data: dnaRows } = await dnaQuery;
    const aktuelleDna = dnaRows?.[0] || null;

    // Auch hoechste existierende Version (egal welcher Status) fuer Versionierung
    let maxVerQuery = supabase.from('skript_dna')
      .select('version').eq('layer_typ', layer_typ)
      .order('version', { ascending: false }).limit(1);
    if (layer_typ === 'branche') maxVerQuery = maxVerQuery.eq('branche_id', branche_id);
    if (layer_typ === 'zielgruppe') maxVerQuery = maxVerQuery.eq('persona_id', persona_id);
    if (layer_typ === 'marke') maxVerQuery = maxVerQuery.eq('marke_id', marke_id);
    const { data: maxVerRows } = await maxVerQuery;
    const naechsteVersion = (maxVerRows?.[0]?.version || 0) + 1;

    // ------------------------------------------------------------------
    // 2. Skripte + Feedback im Scope dieses Layers sammeln
    // ------------------------------------------------------------------
    let skriptQuery = supabase.from('skripte')
      .select('id, titel, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, performance_label, performance_notiz, funnel_stufe, tonalitaet, mit_dna, marke_id, persona_id, branche_id')
      .order('created_at', { ascending: false }).limit(40);
    if (layer_typ === 'marke') skriptQuery = skriptQuery.eq('marke_id', marke_id);
    if (layer_typ === 'zielgruppe') skriptQuery = skriptQuery.eq('persona_id', persona_id);
    if (layer_typ === 'branche') skriptQuery = skriptQuery.eq('branche_id', branche_id);
    // global: alle Skripte betrachten
    const { data: skripte } = await skriptQuery;

    const skriptIds = (skripte || []).map((s) => s.id);
    let feedback = [];
    if (skriptIds.length) {
      // chat_message_id-Join: wurde die aus dem Feedback generierte
      // Ueberarbeitung angenommen/abgelehnt? (starkes Lernsignal)
      const { data } = await supabase.from('skript_feedback')
        .select('skript_id, sektion, score, begruendung, korrigierte_version, selektion_text, skript_chat_messages(status)')
        .in('skript_id', skriptIds);
      feedback = data || [];
    }

    if (!feedback.length && !skripte?.length) {
      throw new Error('Keine Skripte/Feedback im Scope - Destillation nicht moeglich');
    }
    job.log(`${skripte.length} Skripte, ${feedback.length} Feedback-Eintraege im Scope`);

    // ------------------------------------------------------------------
    // 3. Material fuer den Prompt aufbereiten
    // ------------------------------------------------------------------
    const feedbackBySkript = {};
    for (const f of feedback) {
      (feedbackBySkript[f.skript_id] = feedbackBySkript[f.skript_id] || []).push(f);
    }

    const material = buildDistillMaterial(skripte, feedbackBySkript);

    if (!material.trim()) {
      throw new Error('Nur unbewertete Skripte ohne Feedback im Scope - erst Feedback geben');
    }

    // ------------------------------------------------------------------
    // 4. Destillation via Claude
    // ------------------------------------------------------------------
    const model = MODELS.distill;
    job.step('destillation', `Feedback wird zu DNA-Entwurf verdichtet (${model})...`);

    // Abbruch waehrend des Ladens: kein Claude-Call mehr
    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen');
      return { statusCode: 200 };
    }

    // Statischer System-Block: cachebar (Prompt-Caching spart Kosten)
    const systemText = DISTILL_SYSTEM_TEXT;

    const userPrompt = `# LAYER\n${layer_typ}\n\n# BISHERIGE DNA (Version ${aktuelleDna?.version || 0})\n`
      + `${aktuelleDna?.inhalt ? cap(aktuelleDna.inhalt, KONTEXT_MAX.dna) : '(noch keine aktive DNA fuer diesen Layer)'}\n\n`
      + `# MATERIAL (Skripte + Feedback + Performance)\n${material}\n\n`
      + `# AUFGABE\nSchreibe die ueberarbeitete DNA fuer den Layer "${layer_typ}" als Markdown. `
      + 'Antworte NUR mit dem DNA-Dokument, ohne Vor- oder Nachtext.';

    const result = await callClaude({
      model,
      systemBlocks: [{ text: systemText, cache: true }],
      userPrompt,
      maxTokens: 8192,
      // Konservativ: ein haengender Claude-Call soll nicht bis zum
      // Netlify-Limit blockieren, sondern als Job-Fehler sichtbar werden
      timeoutMs: 480000
    });
    await ki.abschliessen(result);

    // Abbruch waehrend des Calls: Ergebnis verwerfen, keinen Entwurf speichern
    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen - Ergebnis verworfen');
      return { statusCode: 200 };
    }

    // ------------------------------------------------------------------
    // 5. Als ENTWURF speichern (Freigabe erfolgt durch Menschen in der UI)
    // ------------------------------------------------------------------
    job.step('speichern', 'DNA-Entwurf speichern (Review noetig)...');
    const { data: neueDna, error: insertError } = await supabase.from('skript_dna').insert({
      // Name: explizit uebergeben oder von der bisherigen DNA geerbt
      name: name || aktuelleDna?.name || null,
      layer_typ,
      branche_id: layer_typ === 'branche' ? branche_id : null,
      persona_id: layer_typ === 'zielgruppe' ? persona_id : null,
      marke_id: layer_typ === 'marke' ? marke_id : null,
      version: naechsteVersion,
      inhalt: result.text.trim(),
      status: 'entwurf'
    }).select('id').single();

    if (insertError) throw new Error(`DNA-Insert fehlgeschlagen: ${insertError.message}`);

    job.log(`DNA-Entwurf v${naechsteVersion} erstellt - bitte reviewen und freigeben`);
    await job.flushAndUpdate({ status: 'done', progress_step: 'done' });
    return { statusCode: 200 };
  } catch (error) {
    console.error(`[${jobId}] Fehler:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      job.log(`FEHLER: ${error.message}`);
      await job.flushAndUpdate({ status: 'error', error_message: error.message });
    } catch (_) { /* noop */ }
    return { statusCode: 500 };
  }
});

exports.buildDistillMaterial = buildDistillMaterial;
exports.DISTILL_SYSTEM_TEXT = DISTILL_SYSTEM_TEXT;
