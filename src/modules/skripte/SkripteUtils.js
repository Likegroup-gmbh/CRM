// SkripteUtils.js - kleine Helfer fuer das Skripte-Modul

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function badge(text, variant = 'neutral') {
  return `<span class="skripte-badge skripte-badge--${variant}">${escapeHtml(text)}</span>`;
}

export const PERFORMANCE_BADGE_VARIANT = {
  unbewertet: 'neutral',
  erfolgreich: 'success',
  nicht_erfolgreich: 'danger',
  viral: 'viral'
};

export const STATUS_LABELS = {
  entwurf: 'Entwurf',
  feedback_gegeben: 'Feedback gegeben',
  final: 'Final',
  archiviert: 'Archiviert'
};

// ---------------------------------------------------------------------------
// Kosten-Schaetzung aus prompt_kontext.usage (Anthropic Messages API)
// ---------------------------------------------------------------------------

// USD pro 1M Tokens (Stand Juli 2026, Anthropic-Preisliste)
const MODEL_PRICING = [
  { match: 'opus', input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { match: 'haiku', input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }
];

// Fester Schaetzkurs USD -> EUR (kein Live-FX, nur Groessenordnung)
const USD_TO_EUR = 0.92;

/**
 * Liest Tokens + Modell aus einem Skript und liefert ein Kosten-Info-Objekt:
 * { label: '12,4k Tokens · ~0,11 €', tooltip: '...' } oder null ohne Usage.
 * Anthropic-Semantik: input_tokens enthaelt KEINE Cache-Tokens, die stehen
 * separat in cache_read_input_tokens / cache_creation_input_tokens.
 */
export function formatSkriptCost(skript) {
  const usage = skript?.prompt_kontext?.usage;
  if (!usage) return null;

  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const gesamt = input + output + cacheRead + cacheWrite;
  if (!gesamt) return null;

  const modelName = (skript.model || '').toLowerCase();
  const pricing = MODEL_PRICING.find((p) => modelName.includes(p.match)) || MODEL_PRICING[0];

  const usd = (input * pricing.input
    + output * pricing.output
    + cacheRead * pricing.cacheRead
    + cacheWrite * pricing.cacheWrite) / 1_000_000;
  const eur = usd * USD_TO_EUR;

  const tokenLabel = gesamt >= 1000
    ? `${(gesamt / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`
    : String(gesamt);
  const eurLabel = eur < 0.01
    ? '<0,01 €'
    : `~${eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const tooltip = `Input: ${input.toLocaleString('de-DE')} · Output: ${output.toLocaleString('de-DE')}`
    + (cacheRead ? ` · Cache-Read: ${cacheRead.toLocaleString('de-DE')}` : '')
    + (cacheWrite ? ` · Cache-Write: ${cacheWrite.toLocaleString('de-DE')}` : '')
    + ` · $${usd.toFixed(4)} (Schätzkurs ${USD_TO_EUR})`;

  return { label: `${tokenLabel} Tokens · ${eurLabel}`, tooltip };
}

/** Kosten-Badge-HTML (oder leerer String, wenn keine Usage vorliegt). */
export function costBadge(skript) {
  const cost = formatSkriptCost(skript);
  if (!cost) return '';
  return `<span class="skripte-badge skripte-badge--info" title="${escapeHtml(cost.tooltip)}">${escapeHtml(cost.label)}</span>`;
}
