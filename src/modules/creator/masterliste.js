// Masterliste: Pool von CRM-Creatorn. Profilfelder kommen live aus den
// Stammdaten; was nur fuer diese Liste gilt, liegt in eigenen Spalten.

export const MASTERLISTE_SPALTEN = [
  { key: 'ml-col-drag', label: 'Reihenfolge', fixed: true },
  { key: 'ml-col-bild', label: 'Bild' },
  { key: 'ml-col-name', label: 'Name', fixed: true },
  { key: 'ml-col-ig', label: 'Instagram' },
  { key: 'ml-col-follower-ig', label: 'Follower Instagram' },
  { key: 'ml-col-engagement', label: 'Engagement-Rate' },
  { key: 'ml-col-tt', label: 'TikTok' },
  { key: 'ml-col-follower-tt', label: 'Follower TikTok' },
  { key: 'ml-col-ort', label: 'Ort' },
  { key: 'ml-col-branchen', label: 'Branchen' },
  { key: 'ml-col-art', label: 'Creator Art', defaultHidden: true },
  { key: 'ml-col-sprachen', label: 'Sprachen', defaultHidden: true },
  { key: 'ml-col-mail', label: 'Mail', defaultHidden: true },
  { key: 'ml-col-telefon', label: 'Telefon', defaultHidden: true },
  { key: 'ml-col-actions', label: 'Aktionen', fixed: true }
];

export const DEFAULT_HIDDEN = MASTERLISTE_SPALTEN.filter(col => col.defaultHidden).map(col => col.key);

export const ANCHOR_COLUMNS = MASTERLISTE_SPALTEN.filter(col => !col.fixed).map(col => col.key);

export const ANCHOR_LABELS = Object.fromEntries(
  MASTERLISTE_SPALTEN.filter(col => !col.fixed).map(col => [col.key, col.label])
);

export function canManageMasterliste() {
  if (typeof window.canEdit === 'function') return window.canEdit('creator-lists') === true;
  return typeof window.isAdmin === 'function' && window.isAdmin();
}

export function resolveHidden(stored) {
  if (stored == null) return [...DEFAULT_HIDDEN];
  return Array.isArray(stored) ? stored.filter(key => typeof key === 'string') : [...DEFAULT_HIDDEN];
}

export function visibleColumns(hidden, { canManage = false } = {}) {
  return MASTERLISTE_SPALTEN.filter(col => {
    if (col.key === 'ml-col-drag' || col.key === 'ml-col-actions') return canManage;
    if (col.fixed) return true;
    return !hidden.includes(col.key);
  });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function creatorName(creator) {
  const name = [creator?.vorname, creator?.nachname].filter(Boolean).join(' ').trim();
  return name || 'Unbekannt';
}

function namesOf(rows, pick) {
  return (rows || []).map(pick).filter(Boolean);
}

export function mapMember(row) {
  const creator = row?.creator || {};
  return {
    memberId: row?.id,
    position: row?.position ?? null,
    addedAt: row?.added_at || null,
    creator: {
      id: creator.id,
      vorname: creator.vorname || '',
      nachname: creator.nachname || '',
      name: creatorName(creator),
      instagram: creator.instagram || '',
      tiktok: creator.tiktok || '',
      instagram_follower: creator.instagram_follower,
      tiktok_follower: creator.tiktok_follower,
      ig_engagement_rate: creator.ig_engagement_rate ?? null,
      ig_engagement_rate_clean: creator.ig_engagement_rate_clean ?? null,
      ig_trial_gate: creator.ig_trial_gate || null,
      lieferadresse_stadt: creator.lieferadresse_stadt || '',
      lieferadresse_land: creator.lieferadresse_land || '',
      mail: creator.mail || '',
      telefonnummer: creator.telefonnummer || '',
      profilbild_thumb_url: creator.profilbild_thumb_url || '',
      profilbild_url: creator.profilbild_url || '',
      branchen: namesOf(creator.branchen, eintrag => eintrag?.branche?.name || eintrag?.name),
      sprachen: namesOf(creator.sprachen, eintrag => eintrag?.sprache?.name || eintrag?.name),
      creatorTypes: namesOf(creator.creator_types, eintrag => eintrag?.creator_type?.name || eintrag?.name)
    }
  };
}

export function compareMembers(a, b) {
  const aPos = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
  const bPos = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
  if (aPos !== bPos) return aPos - bPos;
  return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
}

export function filterMembers(members, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return members || [];
  return (members || []).filter(member => {
    const creator = member.creator || {};
    const haystack = [
      creator.name,
      creator.instagram,
      creator.tiktok,
      creator.lieferadresse_stadt,
      creator.mail,
      ...(creator.branchen || []),
      ...(creator.sprachen || []),
      ...(creator.creatorTypes || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function filterLists(lists, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return lists || [];
  return (lists || []).filter(list =>
    `${list.name} ${list.beschreibung} ${list.autor}`.toLowerCase().includes(q)
  );
}

export function mapListRow(row) {
  const rawCount = row?.members?.[0]?.count ?? row?.members?.count ?? 0;
  const autor = row?.autor?.name || '';
  return {
    id: row?.id,
    name: row?.name || '',
    beschreibung: row?.beschreibung || '',
    createdAt: row?.created_at || null,
    count: Number(rawCount) || 0,
    autor
  };
}

export function displayHandle(handle) {
  const raw = String(handle || '').trim();
  if (!raw || /^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('@') ? raw : `@${raw}`;
}

export function socialUrl(platform, handle) {
  const raw = String(handle || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^@/, '');
  if (platform === 'tiktok') return `https://www.tiktok.com/@${clean}`;
  return `https://instagram.com/${clean}`;
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function safeReturnPath(url) {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  return url;
}

export function creatorReturnPath() {
  const params = new URLSearchParams(window.location?.search || '');
  return safeReturnPath(params.get('returnTo'));
}
