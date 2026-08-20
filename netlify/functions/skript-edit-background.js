// Netlify Background Function: Skript-Editor (Chat-basierte Ueberarbeitung)
// Die pending Assistant-Message in skript_chat_messages IST der Job:
//   pending -> running -> vorschlag (mit vorschlag_text) | fertig (nur Antwort) | error
// Modellwahl: alle Schreib-Aktionen (Neu schreiben / Kuerzen / Laenger /
// Anderer Ton) -> edit_write (Opus mit Extended Thinking),
// freier Chat / Rueckfragen -> edit_fast (Haiku).
// Kontext + Prompt-Bau: _shared/skript-edit-prompt.js

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { starteKiRequest } = require('./_shared/ki-log');
const {
  loadEditContext, buildEditPrompt, stripToolXml, letzterZeitstempel, formatZeitstempel,
  ladeVisuellStil, loadVisualBeispiele, EDIT_BRIEFING_MAX
} = require('./_shared/skript-edit-prompt');

// Tool-Call fuer strukturierte Antworten. Bei Schreib-Aktionen laeuft
// Extended Thinking - dann erlaubt Anthropic nur tool_choice 'auto'
// (callClaude degradiert selbst), deshalb bleibt extractJson als Fallback.
const EDIT_TOOL = {
  name: 'aenderung_abgeben',
  description: 'Gibt die Antwort an den User und optional einen Textvorschlag strukturiert ab.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Kurze Erklaerung fuer den User (1-3 Saetze, Deutsch)' },
      sektion: { type: ['string', 'null'], enum: ['hook', 'hauptteil', 'cta', null], description: 'Betroffene Sektion oder null' },
      vorschlag_text: { type: ['string', 'null'], description: 'Neuer Text oder null' }
    },
    required: ['antwort', 'sektion', 'vorschlag_text']
  }
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { messageId } = payload;
  if (!messageId) return { statusCode: 400, body: 'messageId fehlt' };

  const fail = async (msg) => {
    await supabase.from('skript_chat_messages')
      .update({ status: 'error', error_message: msg })
      .eq('id', messageId);
  };

  let ki = null;

  try {
    const { data: message } = await supabase.from('skript_chat_messages')
      .select('*').eq('id', messageId).single();
    if (!message) return { statusCode: 404, body: 'Message nicht gefunden' };
    if (message.rolle !== 'assistant' || message.status !== 'pending') {
      return { statusCode: 409, body: 'Message ist kein pending Assistant-Job' };
    }

    // Frequenz-Limit pruefen + Protokoll-Zeile anlegen (Fehlermeldung
    // landet ueber den catch als error_message in der Chat-Message)
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'skript_editor' });

    await supabase.from('skript_chat_messages')
      .update({ status: 'running' }).eq('id', messageId);

    const ctx = await loadEditContext(supabase, message);
    const { stable, task } = buildEditPrompt(ctx, message);

    // Modellwahl: Schreiben immer mit dem starken Modell + Extended Thinking,
    // nur freier Chat (Fragen/Rueckfragen) mit dem guenstigen
    const istSchreibAktion = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton', 'feedback', 'visuell'].includes(message.aktion);

    const result = await callClaude({
      model: istSchreibAktion ? MODELS.edit_write : MODELS.edit_fast,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      // Schreib-Aktionen brauchen Luft: max_tokens umfasst auch die
      // Thinking-Tokens - 2048 wuerde bei langem Hauptteil truncaten
      maxTokens: istSchreibAktion ? 8192 : 2048,
      thinking: istSchreibAktion,
      thinkingBudget: 2048,
      tool: EDIT_TOOL,
      // Konservativ: ein haengender Claude-Call soll nicht bis zum
      // Netlify-Limit blockieren, sondern als Chat-Fehler sichtbar werden
      timeoutMs: 480000
    });
    await ki.abschliessen(result);

    const parsed = result.json || extractJson(result.text, { keys: ['antwort', 'sektion', 'vorschlag_text'] });
    const vorschlag = stripToolXml(parsed.vorschlag_text);
    const antwort = stripToolXml(parsed.antwort);
    const sektion = ['hook', 'hauptteil', 'cta'].includes(parsed.sektion) ? parsed.sektion : message.sektion;

    await supabase.from('skript_chat_messages').update({
      // Vorschlag ohne konkrete Sektion kann nicht angewendet werden -> nur Antwort
      status: vorschlag && sektion && sektion !== 'gesamt' ? 'vorschlag' : 'fertig',
      inhalt: antwort,
      vorschlag_text: vorschlag,
      sektion: sektion || message.sektion,
      model: result.model,
      usage: result.usage
    }).eq('id', messageId);

    return { statusCode: 200 };
  } catch (error) {
    console.error(`[skript-edit ${messageId}] Fehler:`, error.message);
    if (ki) await ki.fehlgeschlagen(error);
    try { await fail(error.message); } catch (_) { /* noop */ }
    return { statusCode: 500 };
  }
});

// Re-Exports fuer die Tests (SkriptEditPrompt.test.js importiert von hier)
exports.buildEditPrompt = buildEditPrompt;
exports.stripToolXml = stripToolXml;
exports.letzterZeitstempel = letzterZeitstempel;
exports.formatZeitstempel = formatZeitstempel;
exports.ladeVisuellStil = ladeVisuellStil;
exports.loadVisualBeispiele = loadVisualBeispiele;
exports.EDIT_BRIEFING_MAX = EDIT_BRIEFING_MAX;
