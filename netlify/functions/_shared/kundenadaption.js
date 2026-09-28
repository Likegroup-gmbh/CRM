// Kundenadaption einer Videoreferenz (ADR 0033).
// Absatz plus Punkte, wie das Video fuer diesen Kunden laufen koennte.
// Schreibt nur in eine leere Zelle. Neu generieren ersetzt den Text.

const { callClaude, MODELS } = require('./anthropic');
const { starteKiRequest } = require('./ki-log');
const { shouldApplyKiBeschreibung } = require('./ki-beschreibung');
const { fmtCampaignBriefing } = require('./skript-context/briefing-felder');
const { kuerzeTranskript, cap } = require('./skript-context/formatter');
const { loadIdeeInput, fmtProdukt, fmtPersona } = require('./strategie-idee');

const KUNDENADAPTION_TOOL = {
  name: 'kundenadaption_abgeben',
  description: 'Gibt die Kundenadaption einer Videoreferenz ab: kurzer Absatz und Bullet Points.',
  input_schema: {
    type: 'object',
    properties: {
      absatz: {
        type: 'string',
        description: 'Zwei bis vier Saetze, wie dieses Video fuer den Kunden funktionieren koennte.'
      },
      punkte: {
        type: 'array',
        items: { type: 'string' },
        description: 'Drei bis fuenf Punkte zum Ablauf. Jeder Punkt ein Satz, ohne Aufzaehlungszeichen.'
      }
    },
    required: ['absatz', 'punkte']
  }
};

function kundenadaptionBlocker(item) {
  if (!item?.video_link) return 'Nur eine Videoreferenz';
  if (!String(item.umsetzungsvorgabe || '').trim()) return 'Umsetzungsvorgabe fehlt';
  if (!String(item.transkript || '').trim()) return 'Transkript fehlt';
  return null;
}

function kundenadaptionAusTool(json) {
  const raw = json && (json.absatz || json.punkte) ? json : (json?.kundenadaption_abgeben || {});
  const absatz = String(raw?.absatz || '').trim();
  const punkte = (Array.isArray(raw?.punkte) ? raw.punkte : [])
    .map((p) => String(p || '').trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 6);
  if (!absatz || punkte.length < 2) return '';
  return [absatz, '', ...punkte.map((p) => `- ${p}`)].join('\n');
}

function buildKundenadaptionPrompt({ briefing, produkte, personas, item } = {}) {
  const briefingText = fmtCampaignBriefing(briefing) || '(Briefing ohne auswertbare Felder)';
  const produktText = (produkte || []).map(fmtProdukt).filter(Boolean).join('\n') || '(keine Produkte am Briefing)';
  const personaText = (personas || []).map(fmtPersona).filter(Boolean).join('\n') || '(keine akzeptierten Personas)';
  const vorgabe = cap(item?.umsetzungsvorgabe, 2000);
  const beschreibung = cap(item?.beschreibung, 2000) || '(keine Beschreibung)';
  const caption = cap(item?.caption, 2000) || '(keine Caption)';
  const transkript = kuerzeTranskript(item?.transkript) || '(kein Transkript)';

  const stable = `Du schreibst die Kundenadaption einer Videoreferenz fuer eine Creator-Agentur.
Der Kunde soll sehen, wie DIESES Video fuer ihn funktionieren koennte. Nicht ein neues Konzept, kein Skript, keine Shotliste.

Regeln:
- Deutsch, mit Umlauten.
- Die Umsetzungsvorgabe ist der Fokus. Steht dort nur die Hook, adaptiere die Hook. Steht dort eine bestimmte Umsetzung, nimm die, nicht das ganze Video.
- Keine erfundenen Produktfeatures, Preise, Claims. Nur was im Briefing, Produkt oder in der Videoreferenz steht.
- Donts im Briefing sind Verbote.
- Erst ein kurzer Absatz (zwei bis vier Saetze), dann drei bis fuenf Bullet Points als Ablauf.
- Konkrete Schritte, was im Video passiert, keine Agenturlyrik.`;

  const task = `Umsetzungsvorgabe (Fokus):
${vorgabe}

Beschreibung der Videoreferenz:
${beschreibung}

Caption:
${caption}

Transkript:
${transkript}

Briefing:
${briefingText}

Produkte:
${produktText}

Personas:
${personaText}

Gib die Kundenadaption ueber das Tool ab.`;

  return { stable, task };
}

async function generiereKundenadaptionText(supabase, { userId, strategieId, item, timeoutMs = 0 }) {
  const blocker = kundenadaptionBlocker(item);
  if (blocker) throw new Error(blocker);

  const input = await loadIdeeInput(supabase, strategieId);
  const { stable, task } = buildKundenadaptionPrompt({ ...input, item });
  const ki = await starteKiRequest(supabase, { userId, feature: 'kundenadaption' });
  let fertig = false;
  try {
    const result = await callClaude({
      model: MODELS.konzept,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 1200,
      timeoutMs,
      tool: KUNDENADAPTION_TOOL,
      toolForced: true
    });
    const text = kundenadaptionAusTool(result.json);
    if (!text) throw new Error('Die KI hat keine Kundenadaption geliefert');
    await ki.abschliessen({ model: result.model, usage: result.usage });
    fertig = true;
    return text;
  } catch (e) {
    if (!fertig) await ki.fehlgeschlagen(e);
    throw e;
  }
}

async function schreibeKundenadaptionWennLeer(supabase, {
  userId, itemId, strategieId, transkript, caption, onStep
}) {
  const { data: current, error } = await supabase.from('strategie_items')
    .select('video_link, beschreibung, umsetzungsvorgabe, kundenadaption, transkript, caption')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current?.video_link) return;
  if (!String(current.umsetzungsvorgabe || '').trim()) return;
  if (!shouldApplyKiBeschreibung(current.kundenadaption)) return;

  const item = {
    ...current,
    transkript: String(transkript || current.transkript || '').trim() || null,
    caption: caption ?? current.caption
  };
  if (!String(item.transkript || '').trim()) throw new Error('Transkript fehlt');

  onStep?.();
  const text = await generiereKundenadaptionText(supabase, { userId, strategieId, item });

  const { data: again } = await supabase.from('strategie_items')
    .select('kundenadaption')
    .eq('id', itemId)
    .maybeSingle();
  if (!shouldApplyKiBeschreibung(again?.kundenadaption)) return;

  const { error: writeError } = await supabase.from('strategie_items')
    .update({ kundenadaption: text, kundenadaption_quelle: 'ki' })
    .eq('id', itemId);
  if (writeError) throw new Error(writeError.message);
}

async function ersetzeKundenadaption(supabase, { userId, itemId }) {
  const { data: item, error } = await supabase.from('strategie_items')
    .select('id, strategie_id, video_link, beschreibung, umsetzungsvorgabe, transkript, caption, kundenadaption')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error('Videoidee nicht gefunden');

  const text = await generiereKundenadaptionText(supabase, {
    userId,
    strategieId: item.strategie_id,
    item,
    timeoutMs: 45000
  });
  const { error: writeError } = await supabase.from('strategie_items')
    .update({ kundenadaption: text, kundenadaption_quelle: 'ki' })
    .eq('id', itemId);
  if (writeError) throw new Error(writeError.message);
  return text;
}

module.exports = {
  KUNDENADAPTION_TOOL,
  kundenadaptionBlocker,
  kundenadaptionAusTool,
  buildKundenadaptionPrompt,
  schreibeKundenadaptionWennLeer,
  ersetzeKundenadaption
};
