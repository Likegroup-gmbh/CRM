// claude-cost.js
// Rechnet die usage-Angaben der Anthropic Messages API in Geld um.
//
// Preise in USD pro Million Tokens, Stand Juli 2026, Quelle:
// https://platform.claude.com/docs/en/about-claude/pricing
// Die vier Spalten entsprechen den dortigen: Base Input, 5m Cache Write,
// Cache Hits, Output. Wir schreiben Caches ohne TTL-Angabe, das ist der
// 5-Minuten-Tarif (1,25x Base) - siehe cache_control in anthropic.js.

const PRICES_USD_PER_MTOK = {
  'claude-haiku-4-5': { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
  'claude-sonnet-4-5': { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  'claude-sonnet-4-6': { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  'claude-sonnet-5': { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  // Sonnet 5.5: wie Sonnet 5, Cache-Reads halb so teuer. Der laengere Key
  // gewinnt in findPrices gegen das Prefix 'claude-sonnet-5'.
  'claude-sonnet-5-5': { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  // Haiku 5.5: hier der Tarif bis 100k Prompt-Tokens, darueber siehe HAIKU_5_5_OVER_LIMIT
  'claude-haiku-5-5': { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  'claude-opus-4-5': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-6': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-7': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-8': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-5': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-fable-5': { input: 10, cacheWrite: 12.5, cacheRead: 1, output: 50 }
};

// Haiku 5.5 hat zwei Tarife: bis 100.000 Prompt-Tokens (input + cacheWrite +
// cacheRead) den guenstigen, darueber fuer die ganze Anfrage den hoeheren.
const HAIKU_5_5_KEY = 'claude-haiku-5-5';
const HAIKU_5_5_PROMPT_LIMIT = 100000;
const HAIKU_5_5_OVER_LIMIT = { input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 };

// Websuche-Tool: 10 USD pro 1000 Suchanfragen, unabhaengig von der Treffer-
// zahl (die Treffer zaehlen zusaetzlich als Input-Tokens).
const WEB_SEARCH_USD = 10 / 1000;

// Anthropic rechnet in USD ab. Der Kurs ist eine Anzeige-Hilfe, kein
// Buchhaltungswert - bei Bedarf ueber die Env nachziehen.
const USD_TO_EUR = Number(process.env.ANTHROPIC_USD_EUR_RATE) || 0.86;

/**
 * Findet die Preise zu einer Modell-ID. Die API antwortet mit Datums-Suffix
 * ("claude-haiku-4-5-20251001"), deshalb ueber das laengste passende Prefix.
 */
function findPrices(model) {
  if (!model) return null;
  const id = String(model).toLowerCase();
  let best = null;
  for (const [key, prices] of Object.entries(PRICES_USD_PER_MTOK)) {
    if (id.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, prices };
    }
  }
  return best;
}

/**
 * @param {string} model - Modell-ID aus der API-Antwort
 * @param {Object} usage - usage-Objekt der Anthropic-Antwort
 * @returns {{ usd: number, eur: number, model: string, tokens: Object, searches?: number }|null}
 *          null, wenn das Modell unbekannt ist oder usage fehlt
 */
function calculateCost(model, usage) {
  if (!usage) return null;

  const match = findPrices(model);
  if (!match) {
    console.warn(`⚠️ claude-cost: Keine Preise fuer Modell "${model}" hinterlegt`);
    return null;
  }

  const tokens = {
    input: usage.input_tokens || 0,
    output: usage.output_tokens || 0,
    cacheWrite: usage.cache_creation_input_tokens || 0,
    cacheRead: usage.cache_read_input_tokens || 0
  };

  const prices = match.key === HAIKU_5_5_KEY
    && tokens.input + tokens.cacheWrite + tokens.cacheRead > HAIKU_5_5_PROMPT_LIMIT
    ? HAIKU_5_5_OVER_LIMIT
    : match.prices;
  const tokenUsd = (
    tokens.input * prices.input +
    tokens.output * prices.output +
    tokens.cacheWrite * prices.cacheWrite +
    tokens.cacheRead * prices.cacheRead
  ) / 1_000_000;

  // Websuche wird pro Suchanfrage zusaetzlich zu den Tokens berechnet
  const searches = Number(usage.server_tool_use?.web_search_requests) || 0;
  const usd = tokenUsd + searches * WEB_SEARCH_USD;

  return {
    usd: round(usd, 6),
    eur: round(usd * USD_TO_EUR, 6),
    model: match.key,
    tokens: { ...tokens, total: tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead },
    ...(searches ? { searches } : {})
  };
}

/**
 * Zwei Kosten-Objekte aus calculateCost zusammenfassen (z.B. Suche + Seiten-
 * auswertung in einem Job). Modell und Anzeige-Reihenfolge kommen von `main`.
 * Fehlt eines der beiden (Modell unbekannt), zaehlt das andere allein.
 */
function addCosts(main, extra) {
  if (!main || !extra) return main || extra || null;
  const tokens = {};
  for (const key of ['input', 'output', 'cacheWrite', 'cacheRead', 'total']) {
    tokens[key] = (main.tokens?.[key] || 0) + (extra.tokens?.[key] || 0);
  }
  const searches = (main.searches || 0) + (extra.searches || 0);
  return {
    usd: round(main.usd + extra.usd, 6),
    eur: round(main.eur + extra.eur, 6),
    model: main.model,
    tokens,
    ...(searches ? { searches } : {})
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

module.exports = { calculateCost, addCosts, PRICES_USD_PER_MTOK, USD_TO_EUR };
