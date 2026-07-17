// Anthropic Messages API Client (ohne SDK, nur fetch)
// Modelle via Env konfigurierbar:
//   ANTHROPIC_MODEL_WRITE      (Default: claude-opus-4-7)   - Skript-Schreiben
//   ANTHROPIC_MODEL_DISTILL    (Default: claude-haiku-4-5)  - Verdichtung/Labeling
//   ANTHROPIC_MODEL_EDIT_WRITE (Default: claude-sonnet-4-6) - Editor: Neu schreiben / Ton / Chat
//   ANTHROPIC_MODEL_EDIT_FAST  (Default: claude-haiku-4-5)  - Editor: Kuerzen / Laenger

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const MODELS = {
  write: process.env.ANTHROPIC_MODEL_WRITE || 'claude-opus-4-7',
  distill: process.env.ANTHROPIC_MODEL_DISTILL || 'claude-haiku-4-5',
  edit_write: process.env.ANTHROPIC_MODEL_EDIT_WRITE || 'claude-sonnet-4-6',
  edit_fast: process.env.ANTHROPIC_MODEL_EDIT_FAST || 'claude-haiku-4-5'
};

/**
 * Ruft die Anthropic Messages API auf.
 * systemBlocks: Array von { text, cache } - cache:true setzt cache_control
 * (stabile Prefixe wie DNA/Beispiele -> ~90% Rabatt ab dem 2. Call).
 */
async function callClaude({ model, systemBlocks = [], userPrompt, maxTokens = 4096 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht gesetzt');

  const system = systemBlocks.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {})
  }));

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system.length ? { system } : {}),
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Anthropic API: ${msg}`);
  }

  return {
    text: (data.content || []).map((c) => c.text || '').join(''),
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

module.exports = { callClaude, extractJson, MODELS };
