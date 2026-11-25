// videoBrowserShowcaseLogic.js
// Reine Logik der Showcase-Ansicht (Grid der Videos einer Produktion): aktuellen Stand samt
// Ausstehender Videos oder nur Finale sammeln, je Variante die 9:16-Datei wählen, nach Status,
// Typ und Tag filtern, je Creator gruppieren, flache Anzeigeliste.
// Kein DOM, kein Supabase. Tags und Katalog kommen aus videoBrowserTagLogic (item.tagIds, koop.tags).

import { FINAL_ID, plural } from './videoBrowserFormat.js';
import { statusOf } from './videoBrowserStatus.js';
import { KOOP_OPTION_PREFIX, normalizeTagLabel } from './videoBrowserTagLogic.js';

/** Datenmenge: der aktuelle Stand (Finale, sonst die letzte Runde, sonst Ausstehend) oder nur Finale Versionen. */
export const SHOWCASE_INHALT = [
  { value: 'aktuell', label: 'Aktueller Stand' },
  { value: 'final', label: 'Nur final' }
];
export const SHOWCASE_GROUPS = [
  { value: 'creator', label: 'Creator' },
  { value: 'keine', label: 'Keine' }
];
/** Seitenverhältnis des Showcase: je Variante die Datei darin, Ausstehende Videos haben es auch in der Vollansicht. */
export const SHOWCASE_RATIO = '9:16';
/** Werte des Status-Filters (Kachelstatus, siehe `kachelStatus`). */
export const SHOWCASE_STATUS = ['alle', 'feedback', 'wartet', 'ausstehend', 'freigegeben'];
/** Mindestbreite der Kacheln in px (S, M, L). */
export const SHOWCASE_SIZES = [
  { value: 'S', label: 'S', px: 124 },
  { value: 'M', label: 'M', px: 172 },
  { value: 'L', label: 'L', px: 240 }
];
export const SHOWCASE_TYPES = [
  { id: 'video', label: 'Videos' },
  { id: 'still', label: 'Bilder' },
  { id: 'story', label: 'Stories' }
];
/** Ab dieser Kachelzahl wird nicht mehr per Flip umgeordnet, nur eingeblendet. */
export const FLIP_LIMIT = 200;

export const DEFAULT_SHOWCASE = Object.freeze({
  inhalt: 'aktuell', group: 'creator', status: 'alle', size: 'M', typ: null, tag: null
});

const TYP_PREFIX = 'typ:';
const TAG_PREFIX = 'tag:';
const byLabel = (a, b) => a.label.localeCompare(b.label, 'de');

/**
 * Alle Finalen Versionen des Baums in Ordneransicht-Reihenfolge:
 * Kooperation, Video, dann Videos, Bilder, Stories.
 * @returns {Array<{ koop: object, row: object, item: object }>}
 */
export function collectFinals(tree) {
  const out = [];
  for (const koop of tree?.kooperationen || []) {
    for (const row of koop.rows || []) {
      const folder = (row.folders || []).find(f => f.id === FINAL_ID || f.kind === 'final');
      for (const item of folder?.items || []) out.push({ koop, row, item });
    }
  }
  return out;
}

const TYPE_RANK = { video: 0, still: 1, story: 2 };

export const AUSSTEHEND = 'ausstehend';
export const isAusstehend = (item) => item?.type === AUSSTEHEND;

/** Hochgeladen = eine Datei in einer Feedbackschleife oder der Finalen Version. Rohmaterial zählt nicht. */
export const istHochgeladen = (row) => (row.folders || [])
  .some(f => (f.kind === 'schleife' || f.kind === 'final') && f.items.length > 0);

/** Kachel eines Ausstehenden Videos. Kein eigenes Seitenverhältnis: die Kachel nimmt SHOWCASE_RATIO. */
function ausstehendItem(koop, row) {
  return {
    id: `${AUSSTEHEND}:${row.id}`,
    type: AUSSTEHEND,
    name: row.title || row.label,
    ratio: null,
    tagIds: [],
    hatRohmaterial: (koop.rohmaterialCount || 0) > 0
  };
}

/**
 * Aktueller Stand: je Variante die Finale Version, sonst die Datei der letzten Feedbackschleife,
 * ein Video ohne Datei als Ausstehendes Video an seiner Stelle. Varianten aus früheren Runden
 * ohne Finale gehören nicht dazu. Reihenfolge wie `collectFinals`:
 * Kooperation, Video, dann Videos, Bilder, Stories (Varianten in der Reihenfolge der Runde).
 * @returns {Array<{ koop: object, row: object, item: object }>}
 */
export function collectCurrent(tree) {
  const out = [];
  for (const koop of tree?.kooperationen || []) {
    for (const row of koop.rows || []) {
      const folders = row.folders || [];
      const finals = (folders.find(f => f.id === FINAL_ID || f.kind === 'final')?.items || []);
      const loops = folders.filter(f => f.kind === 'schleife' && f.items.length);
      const used = new Set();
      const entries = [];
      for (const item of loops[loops.length - 1]?.items || []) {
        const finished = finals.filter(f => f.type === item.type
          && (f.asset?.source_asset_id === item.id || (item.variantKey && f.variantKey === item.variantKey)));
        if (!finished.length) {
          entries.push({ koop, row, item });
          continue;
        }
        for (const f of finished) {
          if (used.has(f.id)) continue;
          used.add(f.id);
          entries.push({ koop, row, item: f });
        }
      }
      for (const f of finals) if (!used.has(f.id)) entries.push({ koop, row, item: f });
      entries.sort((a, b) => (TYPE_RANK[a.item.type] ?? 9) - (TYPE_RANK[b.item.type] ?? 9));
      if (!entries.length) entries.push({ koop, row, item: ausstehendItem(koop, row) });
      out.push(...entries);
    }
  }
  return out;
}

/**
 * Eine Datei je Variante im bevorzugten Seitenverhältnis. Hat die Variante es nicht,
 * gilt ihre erste vorhandene Datei, damit nichts aus dem Showcase verschwindet.
 * Finale ohne Variante (direkt hochgeladen) zählen einzeln.
 */
export function pickFormat(entries, fmt) {
  const groups = new Map();
  for (const entry of entries) {
    const { item, row } = entry;
    const key = `${row.id}|${item.type}|${item.variantKey || item.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  // Reihenfolge der Varianten (A, B, ...) bleibt: jede Gruppe steht dort, wo ihre erste Datei stand
  return [...groups.values()].map(list => list.find(e => e.item.ratio === fmt) || list[0]);
}

/**
 * Status einer Kachel für den Filter: Finale sind freigegeben, Ausstehende Videos ausstehend.
 * "Änderungen angefordert" zählt wie "Feedback erhalten": in beiden Fällen ist das Team am Zug.
 */
export function kachelStatus(item) {
  if (isAusstehend(item)) return 'ausstehend';
  if (item.isFinal) return 'freigegeben';
  const key = item.status?.key || null;
  return key === 'aenderungen' ? 'feedback' : key;
}

/**
 * Optionen des Status-Filters mit den Labels der Rolle (wie die Badges der Kacheln). Was die Rolle
 * selbst tun muss, steht vorn: beim Team "Feedback erhalten", beim Kunden "Zu prüfen".
 */
export function showcaseStatusOptions(team = true) {
  const order = team ? ['feedback', 'wartet', 'ausstehend', 'freigegeben'] : ['wartet', 'feedback', 'ausstehend', 'freigegeben'];
  const label = (key) => (key === 'ausstehend' ? (team ? 'Ausstehend' : 'In Produktion') : statusOf(key, team).label);
  return [{ value: 'alle', label: 'Alle' }, ...order.map(value => ({ value, label: label(value) }))];
}

/** Kacheln je Status, für die Zähler im Filter. */
export function statusCounts(entries) {
  const counts = Object.fromEntries(SHOWCASE_STATUS.map(key => [key, 0]));
  counts.alle = entries.length;
  for (const { item } of entries) {
    const key = kachelStatus(item);
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

const isKoopTag = (id) => String(id).startsWith(KOOP_OPTION_PREFIX);
const catalogById = (catalog) => new Map((catalog || []).map(t => [t.id, t]));

/**
 * Tags einer Kachel: die Video-Tags der Datei und die Tags ihrer Kooperation (Kooperationsformular,
 * nur fürs Team geladen). Gleichnamige zählen einmal, das Video-Tag hat Vorrang.
 * @returns {Map<string, { id: string, label: string }>} normalisiertes Label -> Tag, Koop-Tags mit Id `koop:<id>`
 */
function kachelTags({ koop, item }, byId) {
  const out = new Map();
  for (const id of item.tagIds || []) {
    const tag = byId.get(id);
    if (tag) out.set(normalizeTagLabel(tag.label), { id, label: tag.label });
  }
  for (const tag of koop?.tags || []) {
    const key = normalizeTagLabel(tag.label);
    if (key && !out.has(key)) out.set(key, { id: `${KOOP_OPTION_PREFIX}${tag.id}`, label: tag.label });
  }
  return out;
}

/** Normalisiertes Label des gewählten Tags: aus dem Katalog, bei Koop-Tags aus den Kooperationen der Kacheln. */
function tagKey(tag, entries, byId) {
  if (!isKoopTag(tag)) return byId.has(tag) ? normalizeTagLabel(byId.get(tag).label) : null;
  const id = tag.slice(KOOP_OPTION_PREFIX.length);
  for (const { koop } of entries) {
    const hit = (koop?.tags || []).find(t => String(t.id) === id);
    if (hit) return normalizeTagLabel(hit.label);
  }
  return null;
}

/**
 * Status-, Typ- und Tag-Filter, UND-verknüpft. Ein Tag trifft über die Datei oder ihre Kooperation,
 * gleichnamige Video- und Koop-Tags filtern gleich. Ausstehende Videos zählen als Video ohne eigene
 * Tags: sie bleiben bei "Videos" und ohne Filter, ein Tag-Filter zeigt sie nur über ihre Kooperation.
 */
export function filterShowcase(entries, { status = 'alle', typ = null, tag = null } = {}, catalog = []) {
  const byId = catalogById(catalog);
  const key = tag ? tagKey(tag, entries, byId) : null;
  const hatTag = (entry) => (entry.item.tagIds || []).includes(tag) || (!!key && kachelTags(entry, byId).has(key));
  return entries.filter((entry) => {
    const { item } = entry;
    if (status && status !== 'alle' && kachelStatus(item) !== status) return false;
    const typOk = !typ || (isAusstehend(item) ? typ === 'video' : item.type === typ);
    return typOk && (!tag || hatTag(entry));
  });
}

/**
 * Chips der Filterzeile: Typen, Trenner, Tags der Datenmenge (Video- und Koop-Tags, je Label einmal,
 * alphabetisch). Ids: "typ:video", "tag:<id>" und "tag:koop:<id>", damit alles in einer Chip-Liste steht.
 * @returns {Array<{ id?: string, label?: string, kind: 'typ'|'sep'|'tag' }>}
 */
export function showcaseChips(entries, catalog) {
  const types = SHOWCASE_TYPES
    .filter(t => entries.some(e => e.item.type === t.id))
    .map(t => ({ id: `${TYP_PREFIX}${t.id}`, label: t.label, kind: 'typ' }));
  const byId = catalogById(catalog);
  const seen = new Map();
  for (const entry of entries) {
    for (const [key, tag] of kachelTags(entry, byId)) {
      const known = seen.get(key);
      if (!known || (isKoopTag(known.id) && !isKoopTag(tag.id))) seen.set(key, tag);
    }
  }
  const tags = [...seen.values()]
    .map(t => ({ id: `${TAG_PREFIX}${t.id}`, label: t.label, kind: 'tag' }))
    .sort(byLabel);
  if (!types.length && !tags.length) return [];
  return [...types, ...(types.length && tags.length ? [{ kind: 'sep' }] : []), ...tags];
}

/** Aktive Chip-Ids aus dem Zustand. */
export function activeChipIds({ typ, tag } = {}) {
  return [typ ? `${TYP_PREFIX}${typ}` : null, tag ? `${TAG_PREFIX}${tag}` : null].filter(Boolean);
}

/** Chip anklicken: Einfachauswahl je Kategorie als Toggle (gleicher Chip hebt auf, anderer wechselt). */
export function toggleChip(state, chipId) {
  const next = { ...state };
  if (chipId.startsWith(TYP_PREFIX)) {
    const value = chipId.slice(TYP_PREFIX.length);
    next.typ = state.typ === value ? null : value;
  } else if (chipId.startsWith(TAG_PREFIX)) {
    const value = chipId.slice(TAG_PREFIX.length);
    next.tag = state.tag === value ? null : value;
  }
  return next;
}

/**
 * Ein Filterwert, den es in der Datenmenge nicht (mehr) gibt, wird zurückgesetzt. "Nur final" kennt
 * keinen Status-Filter (alles ist freigegeben). Ein Status ohne Kacheln bleibt: "nichts zu tun" ist eine Antwort.
 */
export function reconcileState(state, entries, catalog) {
  const ids = new Set(showcaseChips(entries, catalog).map(c => c.id));
  const next = { ...state };
  if (next.typ && !ids.has(`${TYP_PREFIX}${next.typ}`)) next.typ = null;
  if (next.tag && !ids.has(`${TAG_PREFIX}${next.tag}`)) next.tag = null;
  if (next.inhalt !== 'aktuell' || !SHOWCASE_STATUS.includes(next.status)) next.status = 'alle';
  return next;
}

/** Gruppe "Creator" läuft über den Creator-Datensatz: mehrere Kooperationen desselben Creators stehen zusammen. */
export const creatorKey = (koop) => (koop.creatorId ? `creator:${koop.creatorId}` : `koop:${koop.id}`);

/** Je Creator: Videos der Kooperationen im Baum (soll) und davon hochgeladene. */
export function uploadCounts(tree) {
  const counts = new Map();
  for (const koop of tree?.kooperationen || []) {
    const key = creatorKey(koop);
    const c = counts.get(key) || { soll: 0, hochgeladen: 0, koops: 0 };
    c.koops += 1;
    for (const row of koop.rows || []) {
      c.soll += 1;
      if (istHochgeladen(row)) c.hochgeladen += 1;
    }
    counts.set(key, c);
  }
  return counts;
}

/**
 * Abschnitte je Modus. `keine` liefert einen Abschnitt ohne Kopf. Leere Abschnitte entfallen.
 * `counts` aus uploadCounts: der Kopf nennt "3 von 5 hochgeladen", `mehrereKooperationen` lässt
 * die Kacheln ihre Linie nennen.
 * @returns {Array<{ id: string, label: string, koop: object|null, head: boolean, entries: Array,
 *   soll?: number, hochgeladen?: number, mehrereKooperationen?: boolean }>}
 */
export function groupShowcase(entries, mode, counts = new Map()) {
  if (!entries.length) return [];
  if (mode === 'keine') {
    return [{ id: 'alle', label: '', koop: null, head: false, entries }];
  }
  const groups = new Map();
  for (const entry of entries) {
    const key = creatorKey(entry.koop);
    if (!groups.has(key)) {
      const c = counts.get(key);
      groups.set(key, {
        id: key,
        label: entry.koop.name,
        koop: entry.koop,
        head: true,
        entries: [],
        soll: c?.soll ?? 0,
        hochgeladen: c?.hochgeladen ?? 0,
        mehrereKooperationen: (c?.koops ?? 1) > 1
      });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()];
}

/** Flache Liste in Anzeigereihenfolge (Navigation der Vollansicht). */
export const displayList = (groups) => groups.flatMap(g => g.entries);

/**
 * Gesamte Pipeline: Datenmenge, gefilterte Menge, Abschnitte, Anzeigeliste. `statusCounts` zählt
 * nach Typ und Tag, aber vor dem Status-Filter (`statusBasis`): jede Option nennt, wie viele Kacheln sie
 * zeigt. Die Textsuche legt videoBrowserShowcase.js darüber (sucheShowcase).
 */
export function buildShowcase(tree, state, catalog) {
  const collect = state.inhalt === 'aktuell' ? collectCurrent : collectFinals;
  const base = pickFormat(collect(tree), SHOWCASE_RATIO);
  const filters = reconcileState(state, base, catalog);
  const filtered = filterShowcase(base, filters, catalog);
  const groups = groupShowcase(filtered, filters.group, uploadCounts(tree));
  const statusBasis = filterShowcase(base, { ...filters, status: 'alle' }, catalog);
  return {
    state: filters,
    total: base.length,
    chips: showcaseChips(base, catalog),
    statusBasis,
    statusCounts: statusCounts(statusBasis),
    groups,
    list: displayList(groups)
  };
}

/** "{n} Inhalte von {m} Creators · {k} ausstehend" für die gefilterte Menge. */
export function showcaseSummary(list) {
  const ausstehend = list.filter(e => isAusstehend(e.item)).length;
  const creators = new Set(list.map(e => creatorKey(e.koop))).size;
  const text = `${plural(list.length - ausstehend, 'Inhalt', 'Inhalte')} von ${plural(creators, 'Creator', 'Creators')}`;
  return ausstehend ? `${text} · ${ausstehend} ausstehend` : text;
}

export const sizePx = (size) => (SHOWCASE_SIZES.find(s => s.value === size) || SHOWCASE_SIZES[1]).px;
