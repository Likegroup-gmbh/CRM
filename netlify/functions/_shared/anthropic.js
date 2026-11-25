// Anthropic Messages API Client (ohne SDK, nur fetch)
// Modelle via Env konfigurierbar:
//   ANTHROPIC_MODEL_WRITE      (Default: claude-opus-5-5)  - Skript-Schreiben
//   ANTHROPIC_MODEL_DISTILL    (Default: claude-haiku-5-5) - Verdichtung/Labeling
//   ANTHROPIC_MODEL_EDIT_WRITE (Default: claude-opus-5-5)  - Editor: alle Schreib-Aktionen (mit Extended Thinking)
//   ANTHROPIC_MODEL_EDIT_FAST  (Default: claude-haiku-5-5) - Editor: freier Chat / Rueckfragen
//   ANTHROPIC_MODEL_EXTRACT    (Default: claude-haiku-5-5) - Webseiten-Extraktion (site-extract)
//   ANTHROPIC_MODEL_EXTRACT_PRODUKT (Default: claude-sonnet-5-5) - Produktseiten: mehr Felder, mehr Interpretation
//   ANTHROPIC_MODEL_EXTRACT_BRIEFING (Default: claude-sonnet-5-5) - Kundenbriefing-PDF: viele Felder, Mapping
//   ANTHROPIC_MODEL_EXTRACT_RECHNUNG (Default: claude-sonnet-5-5) - Creator-Rechnungs-PDF: Betraege, Datum, Steuer
//   ANTHROPIC_MODEL_PERSONA    (Default: claude-sonnet-5-5) - Persona-Vorschlaege aus dem Produkt
//   ANTHROPIC_MODEL_KONZEPT    (Default: claude-sonnet-5-5) - Videoideen im Konzept
//   ANTHROPIC_MODEL_RESOLVE    (Default: claude-haiku-5-5) - Websuche: Name -> Homepage (Management-Connect)
//   ANTHROPIC_MODEL_EXTRACT_INSIGHTS (Default: claude-sonnet-5-5) - Insights-Screenshots: Zahlen exakt lesen
//
// JSON-Bergung aus Text-Antworten liegt in anthropic-json.js und wird hier weiter exportiert.

const { extractJson, repairJsonStrings, extractByKeys, extractXmlParameters } = require('./anthropic-json');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const MODELS = {
  write: process.env.ANTHROPIC_MODEL_WRITE || 'claude-opus-5-5',
  distill: process.env.ANTHROPIC_MODEL_DISTILL || 'claude-haiku-5-5',
  edit_write: process.env.ANTHROPIC_MODEL_EDIT_WRITE || 'claude-opus-5-5',
  edit_fast: process.env.ANTHROPIC_MODEL_EDIT_FAST || 'claude-haiku-5-5',
  extract: process.env.ANTHROPIC_MODEL_EXTRACT || 'claude-haiku-5-5',
  extract_produkt: process.env.ANTHROPIC_MODEL_EXTRACT_PRODUKT || 'claude-sonnet-5-5',
  extract_briefing: process.env.ANTHROPIC_MODEL_EXTRACT_BRIEFING || 'claude-sonnet-5-5',
  extract_rechnung: process.env.ANTHROPIC_MODEL_EXTRACT_RECHNUNG || 'claude-sonnet-5-5',
  persona: process.env.ANTHROPIC_MODEL_PERSONA || 'claude-sonnet-5-5',
  casting: process.env.ANTHROPIC_MODEL_CASTING || 'claude-sonnet-5-5',
  konzept: process.env.ANTHROPIC_MODEL_KONZEPT || 'claude-sonnet-5-5',
  resolve: process.env.ANTHROPIC_MODEL_RESOLVE || 'claude-haiku-5-5',
  extract_insights: process.env.ANTHROPIC_MODEL_EXTRACT_INSIGHTS || 'claude-sonnet-5-5'
};

const isOpus55 = (model) => String(model || '').startsWith('claude-opus-5-5');
const isSonnet55 = (model) => String(model || '').startsWith('claude-sonnet-5-5');
const isHaiku55 = (model) => String(model || '').startsWith('claude-haiku-5-5');

/**
 * Baut Thinking, max_tokens und tool_choice passend zur Modellfamilie.
 * Die Call-Sites sagen nur "mit/ohne Thinking" und "Tool erzwingen" - was die
 * API dafuer akzeptiert, haengt am Modell:
 * - Opus 4.x / aeltere Modelle: Extended Thinking mit budget_tokens, erzwungenes
 *   tool_choice nur ohne Thinking.
 * - Opus 5.5: Thinking ist immer adaptiv an ('disabled', 'between_tools' und
 *   budget_tokens sind ein 400). Erzwungenes tool_choice ist ein 400, deshalb
 *   'auto' plus Hinweis im Prompt. Thinking-Tokens zaehlen in max_tokens.
 * - Sonnet 5.5: denkt ohne thinking-Feld von selbst. "Aus" heisst between_tools
 *   ('disabled' und budget_tokens sind ein 400). Erzwungenes tool_choice ist
 *   ein 400, deshalb 'auto' plus Hinweis im Prompt.
 * - Haiku 5.5: denkt ohne thinking-Feld von selbst. "Aus" heisst disabled,
 *   budget_tokens ist ein 400. Erzwungenes tool_choice bleibt erlaubt.
 * Bei 5.5 mit thinking:true laeuft adaptives Thinking ohne Budget.
 */
function shapeRequest({ model, maxTokens = 4096, thinking = false, thinkingBudget = 2048, tool = null, toolForced = true }) {
  const sonnet55 = isSonnet55(model);
  const haiku55 = isHaiku55(model);
  const opus55 = isOpus55(model);
  const adaptiveModel = sonnet55 || haiku55 || opus55;
  // Opus 5.5 und Sonnet 5.5 lehnen erzwungenes tool_choice mit 400 ab
  const noForcedTool = sonnet55 || opus55;

  let thinkingParam = null;
  if (opus55) {
    thinkingParam = { type: 'adaptive' };
  } else if (adaptiveModel) {
    if (thinking) thinkingParam = { type: 'adaptive' };
    else thinkingParam = sonnet55 ? { type: 'between_tools' } : { type: 'disabled' };
  } else if (thinking) {
    thinkingParam = { type: 'enabled', budget_tokens: thinkingBudget };
  }

  // max_tokens umfasst bei Extended Thinking auch die Thinking-Tokens
  const effectiveMaxTokens = thinking && !adaptiveModel
    ? Math.max(maxTokens, thinkingBudget + 2048)
    : maxTokens;

  // Erzwungener Tool-Call ist mit Thinking nicht kombinierbar, auf Sonnet/Opus 5.5 gar nicht
  const forced = !!(tool && toolForced && !thinking && !noForcedTool);
  const toolParams = tool
    ? {
      tools: [tool],
      tool_choice: forced ? { type: 'tool', name: tool.name } : { type: 'auto' }
    }
    : {};

  // Ohne Zwang muss der Prompt sagen, dass die Antwort ueber das Tool kommt.
  // Als letzter System-Block ohne cache_control, damit der gecachte Prefix gleich bleibt.
  const systemHint = noForcedTool && tool && toolForced
    ? `Liefere deine Antwort ausschliesslich ueber einen Aufruf des Tools "${tool.name}".`
    : null;

  return { thinking: thinkingParam, maxTokens: effectiveMaxTokens, toolParams, systemHint };
}

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
 * (stabile Prefixe wie Master-Regelwerk -> ~90% Rabatt ab dem 2. Call).
 * thinking: true aktiviert Extended Thinking (Budget via thinkingBudget,
 * Default 2048 Tokens; max_tokens muss groesser sein als das Budget).
 * timeoutMs: bricht den Call ab, statt ihn offen laufen zu lassen. Pflicht in
 * synchronen Functions, deren Gesamtlaufzeit begrenzt ist - ohne das kann ein
 * langsamer Call das Zeitlimit der Function reissen und der Aufrufer bekommt
 * einen 504 ohne jede Diagnose. 0 = kein Timeout (Background Functions).
 * tool: optionale Tool-Definition { name, description, input_schema } fuer
 * strukturierte Antworten - die API serialisiert das JSON dann selbst,
 * unescapte Anfuehrungszeichen im Text sind damit strukturell unmoeglich.
 * Das Ergebnis steht in result.json (input des tool_use-Blocks).
 * toolForced: erzwingt den Tool-Call (tool_choice type 'tool'). Mit Extended
 * Thinking erlaubt Anthropic nur 'auto'/'none' - dann wird still auf 'auto'
 * degradiert und der Aufrufer braucht einen Text-Fallback via extractJson.
 * messages: optionaler User/Assistant-Verlauf. Gesetzt, ersetzt er die eine
 * User-Message aus userPrompt. Sonst bleibt es bei einer User-Message.
 * Websuche: ein Server-Tool ({ type: 'web_search_20250305', name: 'web_search', ... })
 * geht ebenfalls als `tool` durch, dann mit toolForced: false. Die Treffer stehen
 * danach in result.sources ([{ url, title }]), die Suchanfragen des Modells in
 * result.searchQueries. Abgerechnet wird die Suche ueber usage.server_tool_use
 * (siehe claude-cost.js).
 * images: [{ base64, mediaType }] als Bildblöcke vor dem Text der letzten User-Message
 * (nach einem Dokument), z. B. Insights-Screenshots.
 */
async function callClaude({ model, systemBlocks = [], userPrompt, messages = null, maxTokens = 4096, thinking = false, thinkingBudget = 2048, timeoutMs = 0, tool = null, toolForced = true, document = null, images = [] }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht gesetzt');

  const system = systemBlocks.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {})
  }));

  const shaped = shapeRequest({ model, maxTokens, thinking, thinkingBudget, tool, toolForced });
  if (shaped.systemHint) system.push({ type: 'text', text: shaped.systemHint });

  // PDF und Bilder als Blöcke vor dem Text der letzten User-Message.
  const apiMessages = buildApiMessages({ userPrompt, messages, document, images });

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
        max_tokens: shaped.maxTokens,
        ...(shaped.thinking ? { thinking: shaped.thinking } : {}),
        ...shaped.toolParams,
        ...(system.length ? { system } : {}),
        messages: apiMessages
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

  const { sources, searchQueries } = readWebSearch(data.content);

  return {
    // Thinking-Bloecke ueberspringen, nur Text-Bloecke zaehlen
    text: (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join(''),
    sources,
    searchQueries,
    // Strukturierte Antwort des Tool-Calls (null, wenn das Modell trotz
    // 'auto' als Text geantwortet hat -> Aufrufer faellt auf extractJson zurueck)
    json: parseToolInput((data.content || []).find((c) => c.type === 'tool_use')?.input),
    usage: data.usage || null,
    model: data.model,
    stop_reason: data.stop_reason || null
  };
}

/**
 * Zieht aus den Content-Bloecken, was die Websuche geliefert hat: die
 * Trefferliste (Grundlage fuer das URL-Gate - eine URL, die hier nicht
 * auftaucht, hat das Modell erfunden) und die Suchanfragen. Ohne Websuche
 * beide leer.
 */
function readWebSearch(content) {
  const sources = [];
  const searchQueries = [];
  for (const block of Array.isArray(content) ? content : []) {
    if (block.type === 'server_tool_use' && block.name === 'web_search' && block.input?.query) {
      searchQueries.push(String(block.input.query));
    }
    // Bei einem Suchfehler ist content ein Objekt (error), kein Array
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const hit of block.content) {
        if (hit?.type === 'web_search_result' && hit.url) {
          sources.push({ url: hit.url, title: hit.title || null });
        }
      }
    }
  }
  return { sources, searchQueries };
}

function documentBlock(document) {
  if (!document?.base64) return null;
  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: document.mediaType || 'application/pdf',
      data: document.base64
    }
  };
}

function imageBlocks(images) {
  return (Array.isArray(images) ? images : [])
    .filter((img) => img?.base64)
    .map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.base64 }
    }));
}

/** messages, sonst eine User-Message. Dokument und Bilder haengen an der letzten User-Message. */
function buildApiMessages({ userPrompt, messages, document, images = [] }) {
  const anhang = [documentBlock(document), ...imageBlocks(images)].filter(Boolean);
  if (Array.isArray(messages) && messages.length) {
    const out = messages.map((m) => ({ role: m.role, content: m.content }));
    if (!anhang.length) return out;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].role !== 'user') continue;
      const text = typeof out[i].content === 'string' ? out[i].content : (userPrompt || '');
      out[i] = { role: 'user', content: [...anhang, { type: 'text', text }] };
      break;
    }
    return out;
  }
  return [{ role: 'user', content: [...anhang, { type: 'text', text: userPrompt }] }];
}

/** tool_use.input ist Objekt; manche Antworten liefern denselben JSON-String. */
function parseToolInput(input) {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

module.exports = {
  callClaude, shapeRequest, readWebSearch, parseToolInput, buildApiMessages,
  extractJson, repairJsonStrings, extractByKeys, extractXmlParameters,
  MODELS, ClaudeTimeoutError
};
