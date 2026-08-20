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
 */
async function callClaude({ model, systemBlocks = [], userPrompt, maxTokens = 4096, thinking = false, thinkingBudget = 2048, timeoutMs = 0, tool = null, toolForced = true }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht gesetzt');

  const system = systemBlocks.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {})
  }));

  // max_tokens umfasst bei Extended Thinking auch die Thinking-Tokens
  const effectiveMaxTokens = thinking ? Math.max(maxTokens, thinkingBudget + 2048) : maxTokens;

  // Erzwungener Tool-Call ist mit Extended Thinking nicht kombinierbar
  const forced = tool && toolForced && !thinking;
  const toolParams = tool
    ? {
      tools: [tool],
      tool_choice: forced ? { type: 'tool', name: tool.name } : { type: 'auto' }
    }
    : {};

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
        ...toolParams,
        ...(system.length ? { system } : {}),
        messages: [{ role: 'user', content: userPrompt }]
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
    // Strukturierte Antwort des Tool-Calls (null, wenn das Modell trotz
    // 'auto' als Text geantwortet hat -> Aufrufer faellt auf extractJson zurueck)
    json: (data.content || []).find((c) => c.type === 'tool_use')?.input || null,
    usage: data.usage || null,
    model: data.model
  };
}

/**
 * Repariert die typischen Fehler, die Modelle beim Schreiben von JSON-Text
 * machen: unescapte Anfuehrungszeichen und rohe Zeilenumbrueche in Werten.
 *
 * Struktur-bewusster Automat statt reinem Lookahead: er fuehrt mit, ob der
 * aktuelle String ein Key oder ein Value ist und in welchem Container
 * (Objekt/Array) er steht. Ein " beendet den String nur, wenn an dieser
 * Position auch strukturell ein String enden darf:
 * - Key: danach muss ein Doppelpunkt kommen
 * - Value: danach Komma oder der Closer des AKTUELLEN Containers
 *   ('}' im Objekt, ']' im Array - ein ']' mitten im Objekt-Value wie in
 *   '[Overlay: "Nur heute"]' ist damit kein String-Ende mehr)
 * - nach einem Komma im Objekt muss ein Key folgen; ist knownKeys gesetzt,
 *   zaehlt nur ein erwarteter Key (loest 'sagte "Hallo", "Tschuess": ...' auf)
 */
function repairJsonStrings(src, knownKeys = []) {
  const keySet = new Set(knownKeys);
  let out = '';
  const stack = [];
  let inString = false;
  let escaped = false;
  let stringIsKey = false;
  let expectKey = false;

  const endsKey = (rest) => /^\s*:/.test(rest);

  const endsValue = (rest) => {
    // Abgeschnittene Antwort: Ende der Eingabe als String-Ende akzeptieren
    if (/^\s*$/.test(rest)) return true;
    const container = stack[stack.length - 1];
    const closer = container === '[' ? ']' : '}';
    if (rest.trimStart().startsWith(closer)) return true;
    const comma = rest.match(/^\s*,\s*/);
    if (!comma) return false;
    const after = rest.slice(comma[0].length);
    if (container === '[') {
      // Naechstes Array-Element muss ein Wert-Anfang sein
      return /^["{[\d\-tfn]/.test(after) || after.startsWith(']');
    }
    // Objekt: nach dem Komma muss ein Key folgen
    const key = after.match(/^"([^"\\]*)"\s*:/);
    if (!key) return false;
    return keySet.size === 0 || keySet.has(key[1]);
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (!inString) {
      out += ch;
      if (ch === '"') {
        inString = true;
        stringIsKey = stack[stack.length - 1] === '{' && expectKey;
      } else if (ch === '{') { stack.push('{'); expectKey = true; }
      else if (ch === '[') { stack.push('['); }
      else if (ch === '}' || ch === ']') { stack.pop(); }
      else if (ch === ':') { expectKey = false; }
      else if (ch === ',') { expectKey = stack[stack.length - 1] === '{'; }
      continue;
    }
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\') { out += ch; escaped = true; continue; }

    if (ch === '"') {
      const rest = src.slice(i + 1);
      if (stringIsKey ? endsKey(rest) : endsValue(rest)) {
        out += ch;
        inString = false;
      } else {
        out += '\\"';
      }
      continue;
    }
    if (ch === '\n') { out += '\\n'; continue; }
    if (ch === '\r') { out += '\\r'; continue; }
    if (ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }

  return out;
}

/**
 * Letzte Rettung fuer flache Objekte mit bekannten Feldern: die Werte werden
 * zwischen den "key":-Markern herausgeschnitten, statt das JSON zu parsen.
 * Funktioniert auch bei hoffnungslos kaputtem Quoting, solange die Feldnamen
 * selbst intakt sind. Gibt null zurueck, wenn kein Marker gefunden wurde.
 */
function extractByKeys(raw, keys) {
  if (!keys || !keys.length) return null;

  const marker = [];
  for (const key of keys) {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*`));
    if (m) marker.push({ key, start: m.index, valueStart: m.index + m[0].length });
  }
  if (!marker.length) return null;
  marker.sort((a, b) => a.start - b.start);

  const result = {};
  for (let i = 0; i < marker.length; i++) {
    const { key, valueStart } = marker[i];
    const end = i + 1 < marker.length ? marker[i + 1].start : raw.length;
    let segment = raw.slice(valueStart, end).trim();
    // Trenner zum naechsten Feld bzw. die schliessende Klammer abschneiden
    if (i === marker.length - 1) segment = segment.replace(/\}\s*$/, '');
    segment = segment.replace(/,\s*$/, '').trim();

    if (segment.startsWith('"')) {
      let text = segment.slice(1);
      if (text.endsWith('"')) text = text.slice(0, -1);
      result[key] = text
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    } else if (segment === 'null') {
      result[key] = null;
    } else if (segment === 'true' || segment === 'false') {
      result[key] = segment === 'true';
    } else if (segment !== '' && !Number.isNaN(Number(segment))) {
      result[key] = Number(segment);
    } else {
      result[key] = segment || null;
    }
  }
  return result;
}

/**
 * Extrahiert ein JSON-Objekt aus einer Modell-Antwort
 * (tolerant gegenueber ```json-Fences und Text drumherum).
 * Scheitert das strikte Parsen, wird ein Reparaturlauf versucht - Modelle
 * escapen Anfuehrungszeichen in laengeren deutschen Texten regelmaessig nicht.
 * Optionen:
 * - keys: erwartete Feldnamen des Schemas. Schaerft die Reparatur-Heuristik
 *   und aktiviert die Feld-Extraktion als letzte Fallback-Schicht.
 * - onWarn: Callback fuer Diagnose-Meldungen (z.B. job.log), damit stille
 *   Reparaturen und Rohantworten nicht nur in den Netlify-Logs landen.
 */
function extractJson(text, { keys = [], onWarn } = {}) {
  const warn = (msg) => {
    console.warn(`[extractJson] ${msg}`);
    if (onWarn) { try { onWarn(msg); } catch (_) { /* Diagnose darf nie werfen */ } }
  };

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Keine JSON-Struktur in der Antwort gefunden');
  const raw = candidate.slice(start, end + 1);

  try {
    return JSON.parse(raw);
  } catch (strictError) {
    try {
      const parsed = JSON.parse(repairJsonStrings(raw, keys));
      warn(`Hinweis: KI-Antwort war kein valides JSON, automatisch repariert (${strictError.message})`);
      return parsed;
    } catch (_) {
      const geborgen = extractByKeys(raw, keys);
      if (geborgen && Object.keys(geborgen).length) {
        warn(`Hinweis: KI-Antwort per Feld-Extraktion geborgen (${strictError.message})`);
        return geborgen;
      }
      console.error(`[extractJson] Antwort nicht parsebar (${strictError.message}). Rohantwort: ${raw.slice(0, 600)}`);
      if (onWarn) {
        try { onWarn(`Rohantwort (gekuerzt): ${raw.slice(0, 800)}`); } catch (_) { /* noop */ }
      }
      throw strictError;
    }
  }
}

module.exports = { callClaude, extractJson, repairJsonStrings, extractByKeys, MODELS, ClaudeTimeoutError };
