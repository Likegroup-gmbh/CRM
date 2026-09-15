// sourcingMatching.js
// Gesamtscore und Ampelbalken fuer KI-Casting-Vorschlaege (ADR 0014).
// Ein finaler Score: Fit lastig, Track als Historie-Signal, Fresh leicht.
// Cold-Start ohne Casting-Historie: Track-Gewicht geht auf Fit (Renorm).
// Die Balkenfarbe ist immer einheitlich: der Score bestimmt EINEN Ton
// auf der Skala Rot → Orange → Gruen, kein Verlauf im Fill.

export const MATCHING_WEIGHTS = Object.freeze({
  fit: 0.8,
  track: 0.15,
  fresh: 0.05
});

const COLOR_STOPS = Object.freeze([
  { score: 0, h: 0, s: 72, l: 51 },
  { score: 50, h: 32, s: 95, l: 44 },
  { score: 100, h: 160, s: 91, l: 30 }
]);

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function matchingScore(scores = {}) {
  const fit = clampScore(scores.fit);
  const track = clampScore(scores.track);
  const fresh = clampScore(scores.fresh);
  if (fit == null && track == null && fresh == null) return null;

  // Cold-Start: ohne Casting-Historie Track-Gewicht auf Fit umverteilen
  if (!Number(scores.castings)) {
    const summe = MATCHING_WEIGHTS.fit + MATCHING_WEIGHTS.fresh;
    return Math.round(Math.min(100,
      (MATCHING_WEIGHTS.fit * (fit ?? 0) + MATCHING_WEIGHTS.fresh * (fresh ?? 0)) / summe));
  }

  const total = MATCHING_WEIGHTS.fit * (fit ?? 0)
    + MATCHING_WEIGHTS.track * (track ?? 0)
    + MATCHING_WEIGHTS.fresh * (fresh ?? 0);
  return Math.round(total);
}

export function matchingScoreTooltip(scores = {}) {
  const parts = [];
  if (scores.fit != null) parts.push(`Fit ${scores.fit}`);
  if (scores.track != null) {
    parts.push(Number(scores.castings) ? `Track ${scores.track}` : 'Track n. v. (neu)');
  }
  if (scores.fresh != null) parts.push(`Fresh ${scores.fresh}`);
  return parts.join(' · ');
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function matchingBarColor(score) {
  const t = clampScore(score);
  if (t == null) return 'var(--gray-400)';

  let from = COLOR_STOPS[0];
  let to = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].score && t <= COLOR_STOPS[i + 1].score) {
      from = COLOR_STOPS[i];
      to = COLOR_STOPS[i + 1];
      break;
    }
  }

  const span = to.score - from.score || 1;
  const p = (t - from.score) / span;
  const h = lerp(from.h, to.h, p);
  const s = lerp(from.s, to.s, p);
  const l = lerp(from.l, to.l, p);
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMatchingCell(score, scores = {}) {
  if (score == null) {
    return '<div class="cell-text-readonly">-</div>';
  }

  const width = clampScore(score) ?? 0;
  const color = matchingBarColor(width);
  const tooltip = matchingScoreTooltip(scores);
  const title = tooltip ? ` title="${escapeHtml(tooltip)}"` : '';

  return `
    <div class="sourcing-matching"${title}>
      <div class="sourcing-matching__track">
        <div class="sourcing-matching__fill" style="width:${width}%;background:${color}"></div>
      </div>
      <span class="sourcing-matching__score">${width}/100</span>
    </div>
  `;
}

export function normalizeInstagramUrl(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, '')}`;
}

export function normalizeTiktokUrl(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://tiktok.com/@${s.replace(/^@/, '')}`;
}
