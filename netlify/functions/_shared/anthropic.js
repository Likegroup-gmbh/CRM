// Anthropic Messages API Client (ohne SDK, nur fetch)
// Modelle via Env konfigurierbar:
//   ANTHROPIC_MODEL_WRITE      (Default: claude-opus-4-7)  - Skript-Schreiben
//   ANTHROPIC_MODEL_DISTILL    (Default: claude-haiku-4-5) - Verdichtung/Labeling
//   ANTHROPIC_MODEL_EDIT_WRITE (Default: claude-opus-4-6)  - Editor: alle Schreib-Aktionen (mit Extended Thinking)
//   ANTHROPIC_MODEL_EDIT_FAST  (Default: claude-haiku-4-5) - Editor: freier Chat / Rueckfragen
//   ANTHROPIC_MODEL_EXTRACT    (Default: claude-haiku-4-5) - Webseiten-Extraktion (site-extract)
//   ANTHROPIC_MODEL_EXTRACT_PRODUKT (Default: claude-sonnet-4-5) - Produktseiten: mehr Felder, mehr Interpretation

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const MODELS = {
  write: process.env.ANTHROPIC_MODEL_WRITE || 'claude-opus-4-7',
  distill: process.env.ANTHROPIC_MODEL_DISTILL || 'claude-haiku-4-5',
  edit_write: process.env.ANTHROPIC_MODEL_EDIT_WRITE || 'claude-opus-4-6',
  edit_fast: process.env.ANTHROPIC_MODEL_EDIT_FAST || 'claude-haiku-4-5',
  extract: process.env.ANTHROPIC_MODEL_EXTRACT || 'claude-haiku-4-5',
  extract_produkt: process.env.ANTHROPIC_MODEL_EXTRACT_PRODUKT || 'claude-sonnet-4-5'
};

/** Wird geworfen, wenn timeoutMs greift - der Aufrufer kann so degradiert antworten. */
class ClaudeTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Anthropic API hat nicht innerhalb von ${Math.round(timeoutMs / 1000)}s geantwortet`);
    this.name = 'ClaudeTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Ruft die Anthropic Messages API auf.
 * systemBlocks: Array von { text, cache } - cache:true setzt cache_control
 * (stabile Prefixe wie DNA/Beispiele -> ~90% Rabatt ab dem 2. Call).
 * thinking: true aktiviert Extended Thinking (Budget via thinkingBudget,
 * Default 2048 Tokens; max_tokens muss groesser sein als das Budget).
 * documents: optionale Datei-Anhaenge [{ base64, mediaType }] (z.B. PDFs) -
 * werden als document-Content-Blocks VOR dem Text-Prompt mitgeschickt.
 * timeoutMs: bricht den Call ab, statt ihn offen laufen zu lassen. Pflicht in
 * synchronen Functions, deren Gesamtlaufzeit begrenzt ist - ohne das kann ein
 * langsamer Call das Zeitlimit der Function reissen und der Aufrufer bekommt
 * einen 504 ohne jede Diagnose. 0 = kein Timeout (Background Functions).
 */
async function callClaude({ model, systemBlocks = [], userPrompt, maxTokens = 4096, thinking = false, thinkingBudget = 2048, documents = [], timeoutMs = 0 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht gesetzt');

  const system = systemBlocks.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {})
  }));

  // max_tokens umfasst bei Extended Thinking auch die Thinking-Tokens
  const effectiveMaxTokens = thinking ? Math.max(maxTokens, thinkingBudget + 2048) : maxTokens;

  // Mit Anhaengen wird der User-Content zum Block-Array, sonst bleibt er String
  const userContent = documents.length
    ? [
      ...documents.map((d) => ({
        type: 'document',
        source: { type: 'base64', media_type: d.mediaType || 'application/pdf', data: d.base64 }
      })),
      { type: 'text', text: userPrompt }
    ]
    : userPrompt;

  const controller = timeoutMs > 0 ? new AbortController() : null;
  // Der Timer laeuft ueber Request UND Body-Lesen: bei non-streaming haelt
  // Anthropic die Verbindung bis die Generierung fertig ist
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  let data;
  try {
    res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: effectiveMaxTokens,
        ...(thinking ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),
        ...(system.length ? { system } : {}),
        messages: [{ role: 'user', content: userContent }]
      }),
      ...(controller ? { signal: controller.signal } : {})
    });
    data = await res.json();
  } catch (err) {
    if (controller?.signal.aborted) throw new ClaudeTimeoutError(timeoutMs);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Anthropic API: ${msg}`);
  }

  return {
    // Thinking-Bloecke ueberspringen, nur Text-Bloecke zaehlen
    text: (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join(''),
    usage: data.usage || null,
    model: data.model
  };
}

/**
 * Extrahiert ein JSON-Objekt aus einer Modell-Antwort
 * (tolerant gegenueber ```json-Fences und Text drumherum).
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Keine JSON-Struktur in der Antwort gefunden');
  return JSON.parse(candidate.slice(start, end + 1));
}

module.exports = { callClaude, extractJson, MODELS, ClaudeTimeoutError };
