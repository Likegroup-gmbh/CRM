// Masterliste: Pool von CRM-Creatorn. Profilfelder kommen live aus den
// Stammdaten; was nur fuer diese Liste gilt, liegt in eigenen Spalten.
// Ein Eintrag ohne Creator-Datensatz haengt am Instagram-Handle und zeigt
// die Werte aus dem Creator-Pool (sourcing_creator).

import { parseSocialLink } from '../../core/format/socialLink.js';
import { normalizeHandle } from './creatorProfil.js';
import { eindeutigerCreator } from '../creator-auswahl/castingCreatorVerknuepfung.js';
import { followerStufe, nameZuVorNachname } from './creatorInstagramPrefill.js';

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

function text(value) {
  return String(value ?? '').trim();
}

/** Von Hand eingetragene Werte eines Eintrags ohne Creator. */
function eigeneWerte(row) {
  return {
    name: text(row?.name),
    typ: text(row?.typ),
    follower_instagram: row?.follower_instagram ?? null,
    link_tiktok: text(row?.link_tiktok),
    follower_tiktok: row?.follower_tiktok ?? null,
    wohnort: text(row?.wohnort),
    email: text(row?.email),
    telefon: text(row?.telefon)
  };
}

/** Handarbeit geht vor; Instagram-Zahlen und Bild kommen live aus dem Pool. */
function creatorOhneDatensatz(handle, eigen, pool) {
  const stats = pool?.ig_stats || {};
  const name = eigen.name || text(pool?.name);
  return {
    id: null,
    vorname: name || handle,
    nachname: '',
    name: name || displayHandle(handle) || 'Unbekannt',
    instagram: pool?.link_instagram || handle,
    tiktok: eigen.link_tiktok,
    instagram_follower: pool?.follower_instagram ?? eigen.follower_instagram,
    tiktok_follower: eigen.follower_tiktok,
    ig_engagement_rate: stats.engagement_rate ?? null,
    ig_engagement_rate_clean: stats.engagement_rate_clean ?? null,
    ig_trial_gate: stats.trial_gate || null,
    lieferadresse_stadt: eigen.wohnort || text(pool?.wohnort),
    lieferadresse_land: '',
    mail: eigen.email || text(pool?.email),
    telefonnummer: eigen.telefon || text(pool?.telefon),
    profilbild_thumb_url: pool?.profile_image_thumb_url || '',
    profilbild_url: pool?.profile_image_url || '',
    branchen: [],
    sprachen: [],
    creatorTypes: eigen.typ ? [eigen.typ] : []
  };
}

export function mapMember(row) {
  const igUsername = row?.ig_username || '';
  const base = {
    memberId: row?.id,
    position: row?.position ?? null,
    addedAt: row?.added_at || null,
    igUsername,
    sourcingCreatorId: row?.sourcing_creator_id || null,
    hatDatensatz: !!row?.creator
  };
  if (!row?.creator) {
    const eigen = eigeneWerte(row);
    return { ...base, eigen, pool: row?.pool || null, creator: creatorOhneDatensatz(igUsername, eigen, row?.pool) };
  }
  const creator = row.creator;
  return {
    ...base,
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

/** Eingefuegter Text -> Instagram-Profil-Handles (lowercase, ohne Doppelte) und was keiner war. */
export function leseMasterlisteLinks(raw) {
  const handles = [];
  const ungueltig = [];
  for (const teil of String(raw || '').split(/[\s,;]+/).filter(Boolean)) {
    const parsed = parseSocialLink(teil);
    if (parsed.platform !== 'instagram' || parsed.type !== 'profile' || !parsed.handle) {
      ungueltig.push(teil);
      continue;
    }
    const handle = parsed.handle.toLowerCase();
    if (!handles.includes(handle)) handles.push(handle);
  }
  return { handles, ungueltig };
}

function handleDesMembers(member) {
  return member?.igUsername || normalizeHandle(member?.creator?.instagram);
}

/**
 * Handles gegen die Liste und die Stammdaten pruefen.
 * schonDabei: Handle oder dessen Creator steht schon auf der Liste.
 * crmTreffer: genau ein CRM-Creator hat den Handle. neu: alles andere.
 */
export function teileHandlesAuf(handles, members, creators) {
  const belegteHandles = new Set((members || []).map(handleDesMembers).filter(Boolean));
  const belegteCreator = new Set((members || []).map(member => member?.creator?.id).filter(Boolean));
  const ergebnis = { schonDabei: [], crmTreffer: [], neu: [] };

  for (const handle of handles || []) {
    if (belegteHandles.has(handle)) {
      ergebnis.schonDabei.push(handle);
      continue;
    }
    const creator = eindeutigerCreator(creators, handle);
    if (creator && belegteCreator.has(creator.id)) {
      ergebnis.schonDabei.push(handle);
      continue;
    }
    belegteHandles.add(handle);
    if (creator) {
      belegteCreator.add(creator.id);
      ergebnis.crmTreffer.push({ handle, creator });
    } else {
      ergebnis.neu.push(handle);
    }
  }
  return ergebnis;
}

/** Zaehler unter dem Textfeld "Mehrere Links", z. B. "3 Instagram-Profile erkannt, 1 kein Profil-Link". */
export function linkZaehlerText({ handles = [], ungueltig = [] } = {}) {
  const teile = [];
  if (handles.length) teile.push(handles.length === 1 ? '1 Instagram-Profil erkannt' : `${handles.length} Instagram-Profile erkannt`);
  if (ungueltig.length) teile.push(ungueltig.length === 1 ? '1 kein Profil-Link' : `${ungueltig.length} keine Profil-Links`);
  return teile.join(', ');
}

/** Rueckmeldung nach dem Einfuegen, z. B. "3 hinzugefügt, davon 1 aus den Stammdaten verknüpft, 2 schon auf der Liste". */
export function quickAddText({ hinzugefuegt = 0, verknuepft = 0, schonDabei = 0, ungueltig = 0 } = {}) {
  if (!hinzugefuegt && schonDabei === 1 && !ungueltig) return 'Dieser Creator steht schon auf der Liste';
  const teile = [];
  if (hinzugefuegt) {
    teile.push(verknuepft
      ? `${hinzugefuegt} hinzugefügt, davon ${verknuepft} aus den Stammdaten verknüpft`
      : `${hinzugefuegt} hinzugefügt`);
  }
  if (schonDabei) teile.push(`${schonDabei} schon auf der Liste`);
  if (ungueltig) teile.push(`${ungueltig} kein Instagram-Profil`);
  return teile.join(', ');
}

/** Eintraege ohne Creator, deren Handle genau einem CRM-Creator gehoert, der noch nicht auf der Liste steht. */
export function verknuepfbareMember(members, creators) {
  const belegt = new Set((members || []).map(member => member?.creator?.id).filter(Boolean));
  const links = [];
  for (const member of members || []) {
    if (member.hatDatensatz || !member.igUsername) continue;
    const creator = eindeutigerCreator(creators, member.igUsername);
    if (!creator || belegt.has(creator.id)) continue;
    belegt.add(creator.id);
    links.push({ memberId: member.memberId, creatorId: creator.id });
  }
  return links;
}

function teileName(name) {
  const strikt = nameZuVorNachname(name);
  if (strikt.vorname) return strikt;
  const [vorname = '', ...rest] = text(name).split(/\s+/).filter(Boolean);
  return { vorname, nachname: rest.join(' ') };
}

/** Formularwerte fuer "Creator anlegen" aus einem Eintrag ohne Creator (Handarbeit vor Pool). */
export function prefillOhneDatensatz(member) {
  const eigen = member?.eigen || {};
  const pool = member?.pool || {};
  const name = teileName(eigen.name || pool.name);
  return {
    vorname: name.vorname,
    nachname: name.nachname,
    mail: eigen.email || pool.email || '',
    telefonnummer: eigen.telefon || pool.telefon || '',
    instagram: member?.igUsername || '',
    instagram_follower: followerStufe(pool.follower_instagram ?? eigen.follower_instagram),
    tiktok: normalizeHandle(eigen.link_tiktok),
    tiktok_follower: followerStufe(eigen.follower_tiktok),
    lieferadresse_stadt: eigen.wohnort || pool.wohnort || '',
    profilbild_url: pool.profile_image_url || ''
  };
}

function ganzzahl(value) {
  const raw = text(value).replace(/[.\s]/g, '');
  if (!raw) return null;
  const zahl = Number(raw);
  return Number.isFinite(zahl) && zahl >= 0 ? Math.round(zahl) : null;
}

function tiktokLink(raw) {
  const value = text(raw);
  if (!value) return null;
  const parsed = parseSocialLink(value);
  if (parsed.platform === 'tiktok' && parsed.type === 'profile' && parsed.handle) {
    return `https://www.tiktok.com/@${parsed.handle.toLowerCase()}`;
  }
  if (/^@?[A-Za-z0-9._]{1,30}$/.test(value)) return `https://www.tiktok.com/@${value.replace(/^@/, '').toLowerCase()}`;
  return value;
}

/**
 * Formular "Neuer Creator" -> Zeilenwerte oder Fehler.
 * Creator Art und Name sind Pflicht wie im Casting; der Instagram-Link ist optional,
 * muss aber ein Profil sein.
 */
export function eintragAusFormular(values, { erlaubteTypen = [] } = {}) {
  const typ = text(values?.typ);
  const name = text(values?.name);
  if (!typ || !name) return { fehler: 'Bitte Creator Art und Name ausfüllen' };
  if (erlaubteTypen.length && !erlaubteTypen.includes(typ)) return { fehler: 'Ungültige Creator Art' };

  const linkInstagram = text(values?.link_instagram);
  let handle = null;
  if (linkInstagram) {
    const parsed = parseSocialLink(linkInstagram);
    if (parsed.platform !== 'instagram' || parsed.type !== 'profile' || !parsed.handle) {
      return { fehler: 'Bitte einen Instagram-Profil-Link einfügen (kein Reel oder Post)' };
    }
    handle = parsed.handle.toLowerCase();
  }

  return {
    handle,
    werte: {
      name,
      typ,
      follower_instagram: ganzzahl(values?.follower_instagram),
      link_tiktok: tiktokLink(values?.link_tiktok),
      follower_tiktok: ganzzahl(values?.follower_tiktok),
      wohnort: text(values?.wohnort) || null,
      email: text(values?.email) || null,
      telefon: text(values?.telefon) || null
    }
  };
}
