// instagram-budget.js
// Reine Entscheidungen zum Meta-Kontingent von Business Discovery.
//
// Ein Token bedient das ganze CRM. Business Discovery faellt unter das
// Platform-Limit (200 Calls pro Stunde mal Nutzerzahl, hier also 200).
// Die Media-Abfragen sind schwer: X-App-Usage total_time erreicht 100,
// bevor die 200 Calls voll sind, und Meta antwortet mit Fehlercode 4
// ("Application request limit reached"). Ab dann scheitert jeder weitere
// Creator, und jeder Fehlversuch zaehlt selbst mit.
//
// Die Schwellen lassen einen Lauf erst guenstiger werden (weniger Seiten)
// und kurz vor dem Anschlag ganz auf den Pool ausweichen.

const PAGE_HEADROOM = 50; // ab hier hoechstens zwei Seiten
const PAGE_TIGHT = 80;    // ab hier nur noch die erste Seite
const DEFER_AT = 95;      // ab hier keine neue Anfrage, ausser bei force

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** X-App-Usage-Header (JSON) in Zahlen 0..100. null, wenn nichts Brauchbares drinsteht. */
function parseAppUsage(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  let parsed;
  try {
    parsed = JSON.parse(headerValue);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const usage = {
    call_count: clampPct(parsed.call_count),
    total_time: clampPct(parsed.total_time),
    total_cputime: clampPct(parsed.total_cputime)
  };
  return hottest(usage) > 0 ? usage : null;
}

/** Vom Client mitgeschickter Stand. Nur die drei Prozentfelder, nichts sonst. */
function sanitizeUsage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return parseAppUsage(JSON.stringify({
    call_count: raw.call_count,
    total_time: raw.total_time,
    total_cputime: raw.total_cputime
  }));
}

function hottest(usage) {
  if (!usage) return 0;
  return Math.max(
    clampPct(usage.call_count),
    clampPct(usage.total_time),
    clampPct(usage.total_cputime)
  );
}

/**
 * Wie viele Business-Discovery-Seiten dieser Creator noch kosten darf.
 * @returns {{ maxPages: number }}
 */
function pagingPlan(usage) {
  const hot = hottest(usage);
  if (hot >= PAGE_TIGHT) return { maxPages: 1 };
  if (hot >= PAGE_HEADROOM) return { maxPages: 2 };
  return { maxPages: 3 };
}

/**
 * Was vor dem naechsten Meta-Call zu tun ist.
 * 'fetch'  normal anfragen
 * 'pool'   Kontingent fast voll, vorhandene Pool-Zahlen ausliefern
 * 'defer'  Kontingent fast voll und kein Pool: nicht anfragen
 * force bleibt ein echter Versuch, der Nutzer hat frisch angefordert.
 */
function budgetDecision({ usage, hasPool, force }) {
  if (force) return 'fetch';
  if (hottest(usage) < DEFER_AT) return 'fetch';
  return hasPool ? 'pool' : 'defer';
}

module.exports = {
  PAGE_HEADROOM,
  PAGE_TIGHT,
  DEFER_AT,
  parseAppUsage,
  sanitizeUsage,
  hottest,
  pagingPlan,
  budgetDecision
};
