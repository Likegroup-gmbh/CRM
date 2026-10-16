// Abgeleitete Creator-Angaben: Größe, Generation, Namenssuche, Follower-Kurzform.
// Keine Stammdaten-Kopie der Größe oder Generation. Die Grenzen sind die
// Creator-Größen des Briefings.

export const GROESSEN = ['Nano', 'Micro', 'Mid-Tier', 'Macro', 'Hero'];

export const GENERATIONEN = [
  { label: 'Generation Alpha', from: 2010, to: null },
  { label: 'Generation Z', from: 1997, to: 2009 },
  { label: 'Millennials', from: 1981, to: 1996 },
  { label: 'Generation X', from: 1965, to: 1980 },
  { label: 'Babyboomer', from: 1946, to: 1964 },
  { label: 'Silent Generation', from: 1928, to: 1945 }
];

const KEINE_EINZELPERSON = new Set(['paar', 'familie', 'tier']);

export function istEinzelperson(geschlecht) {
  return !KEINE_EINZELPERSON.has(String(geschlecht || '').toLowerCase());
}

function asCount(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function groesseFromCount(count) {
  const n = asCount(count);
  if (n == null || n < 0) return null;
  if (n < 10000) return 'Nano';
  if (n < 100000) return 'Micro';
  if (n < 500000) return 'Mid-Tier';
  if (n < 1000000) return 'Macro';
  return 'Hero';
}

/** instagram | tiktok | null wenn keine Followerzahl vorliegt. */
export function hauptplattformOf(creator) {
  const gesetzt = creator?.hauptplattform;
  if (gesetzt === 'instagram' || gesetzt === 'tiktok') return gesetzt;
  const ig = asCount(creator?.instagram_follower);
  const tt = asCount(creator?.tiktok_follower);
  if (ig == null && tt == null) return null;
  if (tt != null && (ig == null || tt > ig)) return 'tiktok';
  return 'instagram';
}

export function groesseOf(creator) {
  const plattform = hauptplattformOf(creator);
  if (!plattform) return null;
  const count = plattform === 'tiktok' ? creator?.tiktok_follower : creator?.instagram_follower;
  return groesseFromCount(count);
}

export function generationFromBirthdate(iso, geschlecht) {
  if (!istEinzelperson(geschlecht) || !iso) return null;
  const year = Number(String(iso).slice(0, 4));
  if (!Number.isFinite(year)) return null;
  const hit = GENERATIONEN.find((g) => year >= g.from && (g.to == null || year <= g.to));
  return hit ? hit.label : null;
}

export function generationOf(creator) {
  if (!istEinzelperson(creator?.geschlecht)) return null;
  const override = String(creator?.generation_override || '').trim();
  if (override && GENERATIONEN.some((entry) => entry.label === override)) return override;
  return generationFromBirthdate(creator?.geburtsdatum, creator?.geschlecht);
}

export function completedYears(iso, today = new Date()) {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** Einzelperson mit Datum: ein Alter. Sonst die bisherige Spanne, nur als Anzeige. */
export function ageLabel(creator, today = new Date()) {
  if (istEinzelperson(creator?.geschlecht) && creator?.geburtsdatum) {
    const age = completedYears(creator.geburtsdatum, today);
    return age == null ? '' : `${age} Jahre`;
  }
  const min = creator?.alter_min;
  const max = creator?.alter_max;
  const legacy = creator?.alter_jahre;
  if (!min && !max && legacy) return `${legacy} Jahre`;
  if (!min && !max) return '';
  if (min && max && String(min) !== String(max)) return `${min}–${max} Jahre`;
  return `${min || max} Jahre`;
}

export function formatFollowerShort(value) {
  const n = asCount(value);
  if (n == null) return null;
  const trimmed = (num) => {
    const text = num >= 100 ? String(Math.round(num)) : num.toFixed(1).replace(/\.0$/, '');
    return text.replace('.', ',');
  };
  if (n >= 1000000) return `${trimmed(n / 1000000)}M`;
  if (n >= 1000) return `${trimmed(n / 1000)}K`;
  return String(Math.round(n));
}

function chipLabel(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(entry.name || entry.label || '').trim();
}

/** Creator-Typ zuerst, dann Branche. Die Art steuert die Tag-Klasse der Kachel. */
export function cardChips(typen, branchen, max = 3) {
  const chips = [];
  const seen = new Set();
  const nimm = (eintraege, art) => {
    for (const entry of eintraege || []) {
      const label = chipLabel(entry);
      if (!label || seen.has(label) || chips.length >= max) continue;
      seen.add(label);
      chips.push({ label, art });
    }
  };
  nimm(typen, 'type');
  nimm(branchen, 'branche');
  return chips;
}

export function searchTokens(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .replace(/@/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function handleField(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

export function nameFields(creator) {
  return [creator?.vorname, creator?.nachname, creator?.instagram, creator?.tiktok]
    .map(handleField)
    .filter(Boolean);
}

export function matchesTokens(creator, tokens) {
  if (!tokens?.length) return true;
  const fields = nameFields(creator);
  return tokens.every((token) => fields.some((field) => field.startsWith(token)));
}

export function matchScore(creator, tokens) {
  if (!tokens?.length) return 0;
  const fields = nameFields(creator);
  return tokens.reduce((sum, token) => {
    const hit = fields.find((field) => field.startsWith(token));
    if (!hit) return sum;
    return sum + token.length + (hit === token ? 10 : 0);
  }, 0);
}

export function rankByName(creators, query) {
  const tokens = searchTokens(query);
  const list = [...(creators || [])];
  list.sort((a, b) => {
    if (tokens.length) {
      const delta = matchScore(b, tokens) - matchScore(a, tokens);
      if (delta !== 0) return delta;
    }
    const nach = String(a.nachname || '').localeCompare(String(b.nachname || ''), 'de');
    if (nach !== 0) return nach;
    return String(a.vorname || '').localeCompare(String(b.vorname || ''), 'de');
  });
  return list;
}

export function normalizeFirmenname(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeHandle(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutUrl = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '')
    .replace(/[/?#].*$/, '');
  return withoutUrl.replace(/^@/, '').trim().toLowerCase();
}

/** Profil-URL aus Handle oder bereits gespeicherter Instagram-URL. */
export function instagramProfilUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const href = /^https?:\/\//i.test(raw)
    ? raw
    : `https://instagram.com/${encodeURIComponent(raw.replace(/^@/, ''))}`;
  return window.validatorSystem?.sanitizeUrl?.(href) || '';
}

/** Paar, Familie und Tier-Account behalten kein Geburtsdatum. */
export function sanitizeCreatorWrite(data) {
  if (!data || typeof data !== 'object') return data;
  const next = { ...data };
  delete next.rezension_schnitt;
  if (!istEinzelperson(next.geschlecht)) {
    next.geburtsdatum = null;
    next.generation_override = null;
  } else if ('alter_min' in next || 'alter_max' in next || 'alter_jahre' in next) {
    next.alter_min = null;
    next.alter_max = null;
    next.alter_jahre = null;
  }
  if (next.telefon_nicht_vorhanden === true || next.telefon_nicht_vorhanden === 'true') {
    next.telefon_nicht_vorhanden = true;
    if (!next.telefonnummer) next.telefonnummer = null;
  }
  if (next.hauptplattform === '') next.hauptplattform = null;
  if (next.geburtsdatum === '') next.geburtsdatum = null;
  if ('generation_override' in next && istEinzelperson(next.geschlecht)) {
    const chosen = String(next.generation_override || '').trim();
    const derived = generationFromBirthdate(next.geburtsdatum, next.geschlecht);
    next.generation_override = chosen && chosen !== derived ? chosen : null;
  }
  return next;
}

/** Hinweis unter dem Geburtsdatum und Dropdown nur für Einzelpersonen. */
export function bindGenerationControls(form) {
  if (!form) return;
  const date = form.querySelector('[name="geburtsdatum"]');
  const gender = form.querySelector('[name="geschlecht"]');
  const select = form.querySelector('[name="generation_override"]');
  if (!date || !select) return;
  let hint = date.parentElement.querySelector('.generation-birth-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'form-hint generation-birth-hint';
    date.parentElement.appendChild(hint);
  }
  const paint = () => {
    const einzel = istEinzelperson(gender?.value);
    select.disabled = !einzel;
    if (!einzel) {
      hint.textContent = '';
      return;
    }
    const derived = generationFromBirthdate(date.value, gender?.value);
    hint.textContent = derived
      ? `Aus dem Geburtsdatum: ${derived}`
      : 'Aus dem Geburtsdatum folgt keine Generation.';
  };
  date.addEventListener('change', paint);
  gender?.addEventListener('change', paint);
  paint();
}
