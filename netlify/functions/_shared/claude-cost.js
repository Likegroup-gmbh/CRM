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
  'claude-opus-4-5': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-6': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-7': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-4-8': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-opus-5': { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  'claude-fable-5': { input: 10, cacheWrite: 12.5, cacheRead: 1, output: 50 }
};

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
 * @returns {{ usd: number, eur: number, model: string, tokens: Object }|null}
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

  const { prices } = match;
  const usd = (
    tokens.input * prices.input +
    tokens.output * prices.output +
    tokens.cacheWrite * prices.cacheWrite +
    tokens.cacheRead * prices.cacheRead
  ) / 1_000_000;

  return {
    usd: round(usd, 6),
    eur: round(usd * USD_TO_EUR, 6),
    model: match.key,
    tokens: { ...tokens, total: tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead }
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

module.exports = { calculateCost, PRICES_USD_PER_MTOK, USD_TO_EUR };
