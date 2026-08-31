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

const RELATIVE_STUFEN = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60]
];

/** "Vor 4 Stunden" / "Gerade eben" fuer Feedback-Kommentare. */
export function relativeZeit(iso) {
  if (!iso) return '';
  const sekunden = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(sekunden)) return '';
  if (sekunden < 60) return 'Gerade eben';

  const fmt = new Intl.RelativeTimeFormat('de-DE', { numeric: 'always' });
  for (const [einheit, laenge] of RELATIVE_STUFEN) {
    if (sekunden >= laenge) {
      const wert = Math.floor(sekunden / laenge);
      const text = fmt.format(-wert, einheit);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return 'Gerade eben';
}

/** Initialen fuer den Avatar-Fallback, wenn kein Profilbild hinterlegt ist. */
export function initialen(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return '?';
  if (teile.length === 1) return teile[0][0].toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

export const STATUS_LABELS = {
  fragen: 'Rückfragen offen',
  entwurf: 'Entwurf',
  feedback_gegeben: 'Feedback gegeben',
  final: 'Final',
  archiviert: 'Archiviert'
};

export const STATUS_TAG_VARIANT = {
  fragen: 'tag--warning',
  entwurf: 'tag--warning',
  feedback_gegeben: 'tag--type',
  final: 'tag--success',
  archiviert: 'tag--type'
};

export function skriptEditorPath(skriptId) {
  if (!skriptId || skriptId === 'neu' || skriptId === 'new') return '/skripte/new';
  return `/skripte/${skriptId}`;
}

export function replaceSkriptUrl(skriptId) {
  const path = skriptEditorPath(skriptId);
  window.history.replaceState({ route: path }, '', path);
}

export const OHNE_QUERY = 'ohne';
export const OHNE_MARKE_LABEL = 'Ohne Marke';
export const OHNE_KAMPAGNE_LABEL = 'Ohne Kampagne';

// ---------------------------------------------------------------------------
// Kosten-Schaetzung aus prompt_kontext.usage (Anthropic Messages API)
// ---------------------------------------------------------------------------

// USD pro 1M Tokens (Stand Juli 2026, Anthropic-Preisliste)
const MODEL_PRICING = [
  { match: 'opus', input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { match: 'haiku', input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }
];

// Fester Schaetzkurs USD -> EUR (kein Live-FX, nur Groessenordnung).
// Muss zum Backend-Wert in netlify/functions/_shared/claude-cost.js passen.
const USD_TO_EUR = 0.86;

/**
 * Summiert Tokens + Kosten ueber mehrere { model, usage }-Eintraege
 * (z.B. Erstgenerierung + alle Editor-Chat-Messages).
 * Liefert { label: '12,4k Tokens · ~0,11 €', tooltip: '...' } oder null.
 */
export function formatUsageCost(entries) {
  let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, usd = 0;

  for (const e of entries || []) {
    const usage = e?.usage;
    if (!usage) continue;
    const i = usage.input_tokens || 0;
    const o = usage.output_tokens || 0;
    const cr = usage.cache_read_input_tokens || 0;
    const cw = usage.cache_creation_input_tokens || 0;
    input += i; output += o; cacheRead += cr; cacheWrite += cw;

    const modelName = (e.model || '').toLowerCase();
    const pricing = MODEL_PRICING.find((p) => modelName.includes(p.match)) || MODEL_PRICING[0];
    usd += (i * pricing.input + o * pricing.output + cr * pricing.cacheRead + cw * pricing.cacheWrite) / 1_000_000;
  }

  const gesamt = input + output + cacheRead + cacheWrite;
  if (!gesamt) return null;

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
