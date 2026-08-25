// Netlify Background Function: Briefing-Auswertung
// Nach finalem Briefing schreibt Claude Kampagnenstrategie, To-dos,
// offene Punkte und Empfehlungen ins entity_dokumente der Marke
// (sonst des Unternehmens). "notizen" bleibt unangetastet.

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { fmtCampaignBriefing } = require('./_shared/skript-context');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');
const { beansprucheJob, istJobAbgebrochen } = require('./_shared/skript-auftrag');

const KI_KEYS = ['kampagnenstrategie', 'todos', 'offene_punkte', 'empfehlungen'];

const AUSWERTUNG_TOOL = {
  name: 'briefing_auswertung_abgeben',
  description: 'Gibt die Briefing-Auswertung in vier Sektionen ab.',
  input_schema: {
    type: 'object',
    properties: {
      kampagnenstrategie: {
        type: 'string',
        description: 'Kurze Kampagnenstrategie: Ziel, Positionierung, Hebel, Kanaele.'
      },
      todos: {
        type: 'string',
        description: 'Konkrete, priorisierte Handlungsempfehlungen und To-dos als Markdown-Liste.'
      },
      offene_punkte: {
        type: 'string',
        description: 'Fehlende Infos, offene Entscheidungen. Markdown-Liste. Leer lassen nur wenn nichts fehlt.'
      },
      empfehlungen: {
        type: 'string',
        description: 'Empfehlungen fuer Sourcing, Creator-Typ und Content-Formate als Markdown-Liste.'
      }
    },
    required: KI_KEYS
  }
};

function resolveZielEntity(briefing) {
  if (briefing?.marke_id) return { entityType: 'marke', entityId: briefing.marke_id };
  if (briefing?.unternehmen_id) return { entityType: 'unternehmen', entityId: briefing.unternehmen_id };
  return null;
}

function mergeKiSektionen(bestehend, ki) {
  const next = { ...(bestehend || {}) };
  for (const key of KI_KEYS) {
    next[key] = (ki?.[key] ?? '').trim();
  }
  return next;
}

function buildPrompt({ briefingText, firma, marke, branche, beschreibung }) {
  const stable = 'Du bist Senior Campaign Strategist fuer Creator-Marketing '
    + '(Influencer Marketing, Paid Creator Ads, Owned Social). '
    + 'Du schreibst knappe, umsetzbare Auswertungen auf Deutsch. '
    + 'Nichts erfinden: nur aus Briefing und Stammdaten ableiten. '
    + 'Was fehlt, gehoert in Offene Punkte – nicht als Fakt behaupten.';

  let task = '# AUFTRAG\nWerte das Campaign-Briefing aus und liefere vier Sektionen '
    + 'ausschliesslich ueber das Tool "briefing_auswertung_abgeben".\n';

  if (firma) task += `\nUnternehmen: ${firma}`;
  if (marke) task += `\nMarke: ${marke}`;
  if (branche) task += `\nBranche: ${branche}`;
  if (beschreibung) task += `\nKurzbeschreibung: ${beschreibung}`;
  task += briefingText || '\n# CAMPAIGN-BRIEFING\n(keine Felder ausgefuellt)\n';

  task += '\n# AUSGABEFORMAT\nNur das Tool. Deutsch. Konkret, keine Floskeln. Listen als Markdown (- ).\n'
    + 'kampagnenstrategie: kurze Strategie (Ziel, Positionierung, Hebel, Kanaele).\n'
    + 'todos: konkrete naechste Schritte, priorisiert.\n'
    + 'offene_punkte: fehlende Infos und offene Entscheidungen.\n'
    + 'empfehlungen: Sourcing, Creator-Typ, Content-Formate.\n'
    + 'Typografische Anfuehrungszeichen (\u201e\u2026\u201c) statt gerader (").';

  return { stable, task };
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, briefing_id: briefingId } = payload;
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (!briefingId) return { statusCode: 400, body: 'briefing_id fehlt' };

  const claimed = await beansprucheJob(supabase, jobId);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId);
  const startTime = Date.now();
  let ki = null;

  try {
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'briefing_auswertung' });
    job.step('kontext', 'Ich lese das Briefing…');

    const { data: briefing, error: briefingError } = await supabase
      .from('campaign_briefings')
      .select('*')
      .eq('id', briefingId)
      .single();
    if (briefingError || !briefing) {
      throw new Error(`Briefing nicht gefunden: ${briefingError?.message || briefingId}`);
    }

    const ziel = resolveZielEntity(briefing);
    if (!ziel) throw new Error('Briefing hat weder Marke noch Unternehmen');

    let firma = null;
    let markeName = null;
    let branche = null;
    let beschreibung = null;

    if (briefing.unternehmen_id) {
      const { data: u } = await supabase.from('unternehmen')
        .select('firmenname, beschreibung')
        .eq('id', briefing.unternehmen_id)
        .maybeSingle();
      firma = u?.firmenname || null;
      beschreibung = u?.beschreibung || null;
    }
    if (briefing.marke_id) {
      const { data: m } = await supabase.from('marke')
        .select('markenname, beschreibung, branche')
        .eq('id', briefing.marke_id)
        .maybeSingle();
      markeName = m?.markenname || null;
      if (m?.beschreibung) beschreibung = m.beschreibung;
      branche = m?.branche || null;
    }

    const briefingText = fmtCampaignBriefing(briefing);
    job.log(`Ziel: ${ziel.entityType} ${ziel.entityId}`
      + `${firma ? `, ${firma}` : ''}${markeName ? ` / ${markeName}` : ''}`);

    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen');
      return { statusCode: 200 };
    }

    const { stable, task } = buildPrompt({
      briefingText, firma, marke: markeName, branche, beschreibung
    });
    const model = MODELS.write;

    job.step('generierung', 'Ich schreibe die Auswertung…');
    job.log(`Modell: ${model}`);
    const result = await callClaude({
      model,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4096,
      tool: AUSWERTUNG_TOOL,
      timeoutMs: 480000
    });
    await ki.abschliessen(result);

    if (await istJobAbgebrochen(supabase, jobId)) {
      job.log('Vom Nutzer abgebrochen - Ergebnis verworfen');
      return { statusCode: 200 };
    }

    job.step('speichern', 'Ich schreibe das Dokument…');
    const parsed = result.json || extractJson(result.text, {
      keys: KI_KEYS,
      onWarn: (msg) => job.log(msg)
    });

    const { data: existing } = await supabase.from('entity_dokumente')
      .select('sektionen')
      .eq('entity_type', ziel.entityType)
      .eq('entity_id', ziel.entityId)
      .maybeSingle();

    const sektionen = mergeKiSektionen(existing?.sektionen, parsed);
    const { error: upsertError } = await supabase.from('entity_dokumente').upsert({
      entity_type: ziel.entityType,
      entity_id: ziel.entityId,
      sektionen,
      ki_stand: new Date().toISOString()
    }, { onConflict: 'entity_type,entity_id' });
    if (upsertError) throw new Error(`Dokument-Upsert fehlgeschlagen: ${upsertError.message}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    job.log(`Fertig in ${elapsed}s (Tokens: ${result.usage?.input_tokens ?? '?'} in / ${result.usage?.output_tokens ?? '?'} out)`);
    await job.flushAndUpdate({ status: 'done', progress_step: 'done' });

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

exports.resolveZielEntity = resolveZielEntity;
exports.mergeKiSektionen = mergeKiSektionen;
exports.buildPrompt = buildPrompt;
