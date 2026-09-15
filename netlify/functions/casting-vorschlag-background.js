// casting-vorschlag-background.js
// Netlify Background Function: Creator-Vorschlaege fuer ein Casting (ADR 0013).
// Muster wie produkt-persona-background: der Client legt die Zeile in
// casting_vorschlag_jobs an (inkl. Input-Snapshot), POSTet { jobId } hierher
// und pollt die Zeile. Diese Function schreibt Fortschritt, Ergebnis oder
// Fehler per Service Role.
//
// Ablauf: Bedarf laden -> Kandidaten laden -> Gates -> Fit/Track/Fresh ->
// Slots -> Claude schreibt fit_grund/Risiken auf der Shortlist -> Validate ->
// pending-Zeilen ersetzen (kein Worksheet: das Casting existiert schon).

const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const match = require('./_shared/casting-match');

const {
  CONFIG_VERSION,
  buildBedarf,
  loadBedarfData,
  loadCandidates,
  loadBuchungsbild,
  applyGates,
  scoreFit,
  scoreTrack,
  scoreFresh,
  profilFuer,
  nischenTreffer,
  fillSlots,
  matchKategorie,
  validateVorschlaege,
  zielAnzahl,
  CASTING_TOOL,
  buildPrompt
} = match;

const THINKING_LABELS = {
  start: 'Ich lese Briefing und Bedarf',
  pool: 'Ich hole die Creator aus der Datenbank',
  werten: 'Ich bewerte Fit und Historie',
  generieren: 'Ich begründe die Shortlist',
  pruefen: 'Ich prüfe die Vorschläge gegen die Shortlist'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ casting-vorschlag-background: Supabase-Konfiguration fehlt');
    return { statusCode: 500 };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let jobId;
  try {
    ({ jobId } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400 };
  }
  if (!jobId) return { statusCode: 400 };

  const markJobError = async (message) => {
    try {
      await supabase.from('casting_vorschlag_jobs')
        .update({ status: 'error', error_message: message })
        .eq('id', jobId)
        .eq('status', 'pending');
    } catch (e) {
      console.error(`[${jobId}] Job-Fehler konnte nicht geschrieben werden:`, e.message);
    }
  };

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    const body = authErrorBody(auth);
    if (auth.code === 'auth_unavailable') await markJobError(body.error);
    return {
      statusCode: auth.code === 'auth_unavailable' ? 503 : 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }
  const { user } = auth;

  const { data: job } = await supabase.from('casting_vorschlag_jobs')
    .select('id, casting_id, status, input, created_by')
    .eq('id', jobId).single();
  if (!job || job.created_by !== user.id) {
    console.error(`❌ casting-vorschlag-background: Job ${jobId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (job.status !== 'pending') {
    console.warn(`⚠️ casting-vorschlag-background: Job ${jobId} bereits ${job.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }

  const input = job.input || {};

  let queue = Promise.resolve();
  let progressSteps = [];
  const schreibeStep = (step, msg) => {
    if (msg) console.log(`[${jobId}] ${msg}`);
    progressSteps = appendStep(progressSteps, {
      step,
      label: THINKING_LABELS[step] || msg || 'Ich arbeite'
    });
    const steps = progressSteps;
    queue = queue
      .then(() => supabase.from('casting_vorschlag_jobs').update({
        status: 'running',
        progress_step: step,
        progress_steps: steps
      }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Job-Update fehlgeschlagen:`, e.message));
  };

  schreibeStep('start', 'Casting-Vorschlaege starten');

  let ki = null;
  try {
    // --- Casting + Bedarf ---
    const { data: casting } = await supabase.from('creator_auswahl')
      .select('id, briefing_id, marke_id, unternehmen_id, kampagne_id, liste_typ')
      .eq('id', job.casting_id).single();
    if (!casting) throw new Error('Casting nicht gefunden');
    if (!casting.briefing_id) throw new Error('Casting ohne Briefing: ohne Bedarf kein Lauf');

    const { briefing, produktIds, personas, kategorien } = await loadBedarfData(supabase, casting);
    const bedarf = buildBedarf(briefing, { produktIds, personas });

    // Substance-Gate: ohne Nische, Groesse, Merkmale und Personas kein Fundament
    const hatBedarf = (bedarf.nischen?.length || bedarf.groessen?.length
      || bedarf.voraussetzungen?.length || bedarf.personas?.length || bedarf.typ);
    if (!hatBedarf) {
      throw new Error('Zu wenig Bedarf: Briefing nennt weder Nische noch Groesse noch Personas');
    }

    ki = await starteKiRequest(supabase, {
      userId: user.id,
      feature: 'casting_vorschlag'
    });

    // --- Pool + Buchungsbild ---
    schreibeStep('pool', 'Creator-Pool wird geladen');
    const [kandidaten, bild] = await Promise.all([
      loadCandidates(supabase, bedarf),
      loadBuchungsbild(supabase, {
        markeId: casting.marke_id,
        unternehmenId: casting.unternehmen_id,
        castingId: casting.id,
        fingerprint: bedarf.fingerprint
      })
    ]);

    // Management-Links fuer das Kontakt-Gate (Mail oder Management)
    try {
      const { data: links } = await supabase.from('creator_management').select('creator_id').limit(10000);
      (links || []).forEach(l => { if (l.creator_id) bild.managementIds.add(l.creator_id); });
    } catch (_) { /* Management-Tabelle optional */ }

    // Fresh-Signale aus frueheren Vorschlags-Jobs derselben Marke
    const freshSignale = await ladeFreshSignale(supabase, casting, bedarf);

    // --- Gates + Scores + Slots ---
    schreibeStep('werten', `${kandidaten.length} Creator werden geprüft`);
    const { pass, raus } = applyGates(kandidaten, bedarf, bild);
    if (!pass.length) throw new Error('Kein Creator besteht die Grundanforderungen (Sprache, Land, Typ, Kontakt)');

    const listeTyp = String(casting.liste_typ || 'mix').toLowerCase();
    const fortfuehren = bedarf.ansatz === 'always_on' && bedarf.alwaysOnBestehend === 'fortfuehren';

    const scored = pass.map(k => {
      const profile = profilFuer(k, listeTyp);
      const profileName = profile === match.PROFILES?.influencer ? 'influencer' : 'ugc';
      const h = bild.histJeCreator.get(k.id) || {};
      const hist = {
        ...h,
        videos: h.videos || 0,
        er: k.er,
        hatMail: !!k.mail,
        hatTelefonOderManagement: !!(k.telefon || bild.managementIds.has(k.id))
      };
      const treffer = nischenTreffer(k.branchenTokens, bedarf.nischen);
      const fit = scoreFit(k, bedarf, profile.fit).wert;
      const coverage = scoreFit(k, bedarf, profile.fit).coverage;
      const track = scoreTrack(k, hist, profile.track);
      const fresh = scoreFresh({
        markeGebucht90d: !!h.markeGebucht90d,
        fingerprintDabei: freshSignale.fingerprintDabei.has(k.id),
        vorgeschlagen3: freshSignale.vorgeschlagen3.has(k.id),
        vorschlaege30d: freshSignale.jeCreator30d.get(k.id) || 0,
        alwaysOnFortfuehren: fortfuehren
      }, profile.fresh);
      return { k, fit, track, fresh, hist, coverage, adjacent: treffer.nachbar && !treffer.primaer, profileName };
    });

    // Anzahl aus der Kampagne: 2-3x offene Creator-Sollzahl
    let offen = null;
    if (casting.kampagne_id) {
      const { data: kampagne } = await supabase.from('kampagne')
        .select('creatoranzahl').eq('id', casting.kampagne_id).maybeSingle();
      if (kampagne?.creatoranzahl != null) {
        offen = Math.max(0, Number(kampagne.creatoranzahl) - bild.aufDieserListe.size);
      }
    }
    const anzahl = zielAnzahl(offen);
    const exploreBias = Number.isFinite(Number(input.exploreBias)) ? Number(input.exploreBias) : bedarf.exploreDefault;
    const slots = fillSlots(scored, { anzahl, exploreBias });
    if (!slots.length) throw new Error('Aus dem bewerteten Pool liess sich kein Mix bilden');

    // --- LLM begruendet die Shortlist ---
    schreibeStep('generieren', `Claude begründet ${slots.length} Vorschläge`);
    const { stable, task } = buildPrompt(bedarf, { slots, kategorien });

    const result = await callClaude({
      model: MODELS.casting,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 8000,
      tool: CASTING_TOOL,
      toolForced: true
    });

    if (!result.json) {
      throw new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
    }

    schreibeStep('pruefen', 'Vorschläge werden validiert');
    const slotJeId = Object.fromEntries(slots.map(s => [s.k.id, s.slot]));
    const geprueft = validateVorschlaege(result.json, {
      shortlistIds: slots.map(s => s.k.id),
      slots: slotJeId,
      personaIds: bedarf.personas.map(p => p.id).filter(Boolean)
    });

    if (!geprueft.vorschlaege.length) {
      throw new Error('Die KI konnte aus der Shortlist keine tragfähigen Vorschläge begründen');
    }

    await ki.abschliessen({ model: result.model, usage: result.usage });

    // --- Persistieren: pending ersetzen (Regen), Aktivierte bleiben ---
    const slotJeValidiert = new Map(slots.map(s => [s.k.id, s]));
    const rows = geprueft.vorschlaege.map((v, i) => {
      const s = slotJeValidiert.get(v.creator_id);
      return {
        casting_id: casting.id,
        creator_id: v.creator_id,
        status: 'pending',
        slot: v.slot,
        kategorie_hint: matchKategorie(s.k, kategorien, bedarf.personas),
        fit_grund: v.fit_grund,
        risiken: v.risiken,
        persona_ids: v.persona_ids,
        coverage: s.coverage,
        scores: { fit: s.fit, track: s.track, fresh: s.fresh, profile: s.profileName },
        job_id: jobId,
        position: i
      };
    });

    await supabase.from('casting_vorschlag').delete()
      .eq('casting_id', casting.id).eq('status', 'pending');
    const { error: insertError } = await supabase.from('casting_vorschlag').insert(rows);
    if (insertError) throw new Error(`Vorschläge konnten nicht gespeichert werden: ${insertError.message}`);

    const payload = {
      success: true,
      anzahl: rows.length,
      vorschlaegeIds: rows.map(r => r.creator_id),
      verworfen: geprueft.verworfen,
      rausAnzahl: raus.length,
      fingerprint: bedarf.fingerprint,
      exploreBias,
      config_version: CONFIG_VERSION
    };

    await queue;
    await supabase.from('casting_vorschlag_jobs')
      .update({ status: 'done', progress_step: 'done', result: payload, config_version: CONFIG_VERSION })
      .eq('id', jobId);
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ casting-vorschlag-background [${jobId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try {
      await queue;
      await supabase.from('casting_vorschlag_jobs')
        .update({ status: 'error', error_message: error.message })
        .eq('id', jobId);
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  }
};

/**
 * Fresh-Signale aus frueheren Jobs: gleiche Fingerprints, letzte 3 Jobs,
 * Vorschlags-Counts der letzten 30 Tage (markenweit).
 */
async function ladeFreshSignale(supabase, casting, bedarf) {
  const signale = { fingerprintDabei: new Set(), vorgeschlagen3: new Set(), jeCreator30d: new Map() };
  try {
    let listenIds = [casting.id];
    if (casting.marke_id || casting.unternehmen_id) {
      let q = supabase.from('creator_auswahl').select('id');
      if (casting.marke_id) q = q.eq('marke_id', casting.marke_id);
      else q = q.eq('unternehmen_id', casting.unternehmen_id);
      const { data: listen } = await q;
      if (listen?.length) listenIds = listen.map(l => l.id);
    }

    const { data: jobs } = await supabase.from('casting_vorschlag_jobs')
      .select('id, result, created_at').in('casting_id', listenIds)
      .order('created_at', { ascending: false }).limit(10);
    const jobsListe = jobs || [];
    jobsListe.slice(0, 3).forEach(j => {
      ((j.result?.vorschlaegeIds) || []).forEach(id => signale.vorgeschlagen3.add(id));
    });

    const gleiche = jobsListe.filter(j => j.result?.fingerprint && j.result.fingerprint === bedarf.fingerprint);
    if (gleiche.length) {
      const { data: alte } = await supabase.from('casting_vorschlag')
        .select('creator_id').in('job_id', gleiche.map(j => j.id));
      (alte || []).forEach(r => { if (r.creator_id) signale.fingerprintDabei.add(r.creator_id); });
    }

    const vor30d = new Date();
    vor30d.setDate(vor30d.getDate() - 30);
    const { data: recent } = await supabase.from('casting_vorschlag')
      .select('creator_id').in('casting_id', listenIds).gte('created_at', vor30d.toISOString());
    (recent || []).forEach(r => {
      if (!r.creator_id) return;
      signale.jeCreator30d.set(r.creator_id, (signale.jeCreator30d.get(r.creator_id) || 0) + 1);
    });
  } catch (e) {
    console.warn(`[casting-vorschlag] Fresh-Signale unvollständig: ${e.message}`);
  }
  return signale;
}
