// videoBrowserGroups.js
// Spalte 0 bei "Alle Linien": Kooperationen unter Gruppenköpfen (nach Creator oder Linie),
// Zeilentitel und Klappzustand. Kein DOM, kein Supabase.
//
// Gruppiert wird über den Creator-Datensatz, nie über den Namen. Eine Kooperation ohne
// Creator-Datensatz steht allein, ebenso ein Creator (bzw. eine Linie) mit nur einer Kooperation.

import { plural } from './videoBrowserFormat.js';

export const KOOP_GROUPS = [
  { value: 'creator', label: 'Creator' },
  { value: 'linie', label: 'Linie' }
];
export const DEFAULT_KOOP_GROUP = 'creator';
export const OHNE_LINIE = 'Ohne Linie';

const byText = (a, b) => String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' });
const byTime = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
const order = (koop) => (Number.isFinite(koop.linieOrder) ? koop.linieOrder : Number.POSITIVE_INFINITY);

export function isKoopGroup(value) {
  return KOOP_GROUPS.some(g => g.value === value);
}

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

/** Titel der Videos der Kooperation, ohne leere ("Ohne Titel") Videos, in Video-Reihenfolge. */
function videoTitel(koop) {
  return (koop.rows || []).map(r => clean(r.title)).filter(Boolean);
}

/** "Wassermelonen Eis · Schwamm DIY +2": die ersten zwei Videotitel, der Rest als Zähler. */
export function videoTitelText(koop) {
  const titel = videoTitel(koop);
  if (!titel.length) return '';
  const kopf = titel.slice(0, 2).join(' · ');
  return titel.length > 2 ? `${kopf} +${titel.length - 2}` : kopf;
}

/** Der Teil des Kooperationsnamens hinter dem Creator ("Carla Birkmann 6/9" -> "Kooperation 6/9"). */
function namensZusatz(koop) {
  const name = clean(koop.kooperationName);
  if (!name) return '';
  const creator = clean(koop.name);
  if (creator && name.toLowerCase() === creator.toLowerCase()) return '';
  if (creator && name.toLowerCase().startsWith(`${creator.toLowerCase()} `)) {
    return `Kooperation ${name.slice(creator.length).trim()}`;
  }
  return name;
}

/**
 * Die Merkmale, an denen man eine Kooperation erkennt, in Reihenfolge der Fallback-Kette:
 * Linie, Produkt(e) der Videoideen, Videotitel, Zusatz im Kooperationsnamen.
 * Die Kette hängt nie an einem einzelnen Merkmal: fehlt die Linie, trägt das Produkt, fehlt das
 * Produkt, tragen die Videotitel.
 */
const KETTE = [
  { key: 'linie', text: (k) => clean(k.linieName) },
  { key: 'produkt', text: (k) => clean(produktText(k)) },
  { key: 'videos', text: (k) => videoTitelText(k) },
  { key: 'name', text: namensZusatz }
];

/**
 * Zeilentitel der Kooperationen eines Creators (Modus Creator). Je Kooperation das erste Merkmal der
 * Kette, das sie von den anderen unterscheidet (nicht leer und bei keiner anderen gleich). Bleibt
 * keins übrig, steht das erste vorhandene da und eindeutig() hängt eine Nummer an.
 * @returns {Map<string, { title: string, key: string }>} je Kooperations-Id
 */
export function kooperationLabels(koops) {
  const list = koops || [];
  const out = new Map();
  for (const koop of list) {
    let pick = null;
    for (const stufe of KETTE) {
      const text = stufe.text(koop);
      if (!text) continue;
      const gleich = list.some(o => o !== koop && stufe.text(o) === text);
      if (!gleich) { pick = { title: text, key: stufe.key }; break; }
      pick ||= { title: text, key: stufe.key, mehrdeutig: true };
    }
    out.set(koop.id, pick || { title: 'Kooperation', key: 'leer', mehrdeutig: true });
  }
  return out;
}

/**
 * Wofür die Kooperation gebucht ist. Modus Creator: Fallback-Kette aus kooperationLabels(), mit
 * `siblings` (die übrigen Kooperationen desselben Creators) werden nur unterscheidende Merkmale genommen.
 */
export function kooperationLabel(koop, mode = DEFAULT_KOOP_GROUP, siblings = []) {
  if (mode === 'linie') return koop.name;
  const alle = [koop, ...(siblings || []).filter(k => k.id !== koop.id)];
  return kooperationLabels(alle).get(koop.id).title;
}

/** Alle Kooperationen desselben Creator-Datensatzes (inklusive der übergebenen). */
function desselbenCreators(kooperationen, koop) {
  if (!koop?.creatorId) return [koop];
  return (kooperationen || []).filter(k => k.creatorId === koop.creatorId);
}

/**
 * Creator, plus wofür die Kooperation gebucht ist (Pfadleiste, Detailkopf, "Was gerade ansteht").
 * Hat der Creator mehrere Kooperationen in der Produktion, unterscheidet sie das Label, auch
 * ohne Linien. Sonst nur bei mehreren sichtbaren Linien die Linie.
 */
export function kooperationTitel(koop, { zeigeLinie = false, kooperationen = null } = {}) {
  if (!koop) return '';
  const zusatz = kooperationZusatz(koop, { zeigeLinie, kooperationen });
  return zusatz ? `${koop.name} · ${zusatz}` : koop.name;
}

/** Nur der Zusatz ("Wassermelonen Eis · Schwamm DIY +2" bzw. die Linie), leer wenn nichts zu unterscheiden ist. */
export function kooperationZusatz(koop, { zeigeLinie = false, kooperationen = null } = {}) {
  if (!koop) return '';
  const gleiche = desselbenCreators(kooperationen, koop);
  if (gleiche.length > 1) return kooperationLabel(koop, DEFAULT_KOOP_GROUP, gleiche);
  return zeigeLinie && koop.linieName ? koop.linieName : '';
}

/** Die übrigen Kooperationen desselben Creators (gleicher Datensatz), in Linien-Reihenfolge. */
export function weitereKooperationen(kooperationen, koop) {
  if (!koop?.creatorId) return [];
  return (kooperationen || [])
    .filter(k => k.id !== koop.id && k.creatorId === koop.creatorId)
    .sort((a, b) => order(a) - order(b) || byTime(a, b));
}

/** Gruppen-Id einer Kooperation je Modus. null = sie hätte keinen gemeinsamen Kopf. */
export function koopGroupKey(koop, mode = DEFAULT_KOOP_GROUP) {
  if (mode === 'linie') return `linie:${koop.linieId || 'ohne'}`;
  return koop.creatorId ? `creator:${koop.creatorId}` : null;
}

/** Namen, die zu mehr als einem Creator gehören: dort steht der Handle dabei. */
function doppelteNamen(kooperationen) {
  const ids = new Map();
  for (const k of kooperationen) {
    const name = String(k.name || '').trim().toLowerCase();
    if (!ids.has(name)) ids.set(name, new Set());
    ids.get(name).add(k.creatorId || `koop:${k.id}`);
  }
  return new Set([...ids].filter(([, set]) => set.size > 1).map(([name]) => name));
}

function creatorName(koop, doppelt) {
  const dup = doppelt.has(String(koop.name || '').trim().toLowerCase());
  return dup && koop.handle ? `${koop.name} · ${koop.handle}` : koop.name;
}

/** Gleiche Titel unter einem Kopf bekommen eine laufende Nummer (Reihenfolge nach Anlage). */
function eindeutig(rows) {
  const counts = new Map();
  for (const r of rows) counts.set(r.title, (counts.get(r.title) || 0) + 1);
  const seen = new Map();
  const byAnlage = [...rows].sort((a, b) => byTime(a.koop, b.koop));
  const nummer = new Map();
  for (const r of byAnlage) {
    if (counts.get(r.title) < 2) continue;
    const n = (seen.get(r.title) || 0) + 1;
    seen.set(r.title, n);
    nummer.set(r.koop.id, n);
  }
  return rows.map(r => (nummer.has(r.koop.id) ? { ...r, title: `${r.title} · ${nummer.get(r.koop.id)}` } : r));
}

const videosText = (koop) => plural(koop.videoCount, 'Video', 'Videos');
const produktText = (koop) => (koop.produkte || []).join(', ');

/** Meta-Zeile: was nicht schon im Titel steht (Produkt, Videotitel), dann die Videoanzahl. */
function metaText(koop, { linie = '', titelKey = '' } = {}) {
  return [
    linie,
    titelKey === 'produkt' ? '' : produktText(koop),
    titelKey === 'videos' ? '' : videoTitelText(koop),
    videosText(koop)
  ].filter(Boolean).join(' · ');
}

/**
 * Einträge der Spalte 0 in Anzeigereihenfolge.
 * - `single`: eine Kooperationszeile ohne Kopf (Titel = Creator, bzw. im Modus Linie ebenfalls Creator)
 * - `group`: Gruppenkopf mit seinen Kooperationszeilen (`rows`)
 * Gruppiert wird über den Creator-Datensatz, unabhängig davon, ob Linien, Produkte oder Konzepte
 * gepflegt sind. Ohne `grouped` bleibt die Liste flach in der geladenen Reihenfolge.
 * `zeigeLinie`: mehrere Linien sichtbar, dann steht die Linie auch in der Meta-Zeile einer Einzelzeile.
 * @param {Array<object>} kooperationen Baumknoten aus buildTree
 * @param {{ mode?: 'creator'|'linie', grouped?: boolean, zeigeLinie?: boolean }} opts
 */
export function buildKoopGroups(kooperationen, { mode = DEFAULT_KOOP_GROUP, grouped = false, zeigeLinie = false } = {}) {
  const list = kooperationen || [];
  const doppelt = doppelteNamen(list);

  if (!grouped) {
    return list.map(koop => ({ kind: 'single', koop, title: creatorName(koop, doppelt), meta: videosText(koop) }));
  }

  const buckets = new Map();
  const singles = [];
  for (const koop of list) {
    const key = koopGroupKey(koop, mode);
    if (!key) {
      singles.push(koop);
      continue;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(koop);
  }

  const entries = singles.map(koop => singleEntry(koop, mode, doppelt, zeigeLinie));
  for (const [id, koops] of buckets) {
    if (koops.length === 1) {
      entries.push(singleEntry(koops[0], mode, doppelt, zeigeLinie));
      continue;
    }
    entries.push(groupEntry(id, koops, mode, doppelt));
  }

  if (mode === 'linie') {
    const linieOrder = (e) => order(e.kind === 'group' ? e.rows[0].koop : e.koop);
    const ohne = (e) => !(e.kind === 'group' ? e.rows[0].koop : e.koop).linieId;
    return entries.sort((a, b) => ohne(a) - ohne(b) || linieOrder(a) - linieOrder(b) || byText(a.sortName, b.sortName));
  }
  const kopfZuerst = (a, b) => (b.kind === 'group') - (a.kind === 'group');
  return entries.sort((a, b) => byText(a.sortName, b.sortName) || kopfZuerst(a, b) || byText(a.koop.id, b.koop.id));
}

function singleEntry(koop, mode, doppelt, zeigeLinie) {
  const linie = koop.linieName || (mode === 'linie' ? OHNE_LINIE : '');
  return {
    kind: 'single',
    koop,
    sortName: mode === 'linie' ? linie : koop.name,
    title: creatorName(koop, doppelt),
    // Ohne Linien steht hier, worum es geht: Produkt und Videotitel
    meta: metaText(koop, { linie: zeigeLinie || mode === 'linie' ? linie : '' })
  };
}

function groupEntry(id, koops, mode, doppelt) {
  const sorted = mode === 'linie'
    ? [...koops].sort((a, b) => byText(a.name, b.name) || byTime(a, b))
    : [...koops].sort((a, b) => order(a) - order(b) || byTime(a, b));
  const labels = mode === 'linie' ? null : kooperationLabels(sorted);
  const rows = eindeutig(sorted.map(koop => ({
    koop,
    title: mode === 'linie' ? creatorName(koop, doppelt) : labels.get(koop.id).title,
    meta: metaText(koop, { titelKey: labels?.get(koop.id).key })
  })));
  const first = sorted[0];
  const label = mode === 'linie' ? (first.linieName || OHNE_LINIE) : creatorName(first, doppelt);
  return {
    kind: 'group',
    id,
    mode,
    koop: first,
    linie: mode === 'linie' ? first.linie || null : null,
    sortName: mode === 'linie' ? label : first.name,
    label,
    meta: plural(koops.length, 'Kooperation', 'Kooperationen'),
    count: koops.length,
    offeneCount: koops.reduce((sum, k) => sum + (k.offeneCount || 0), 0),
    rows
  };
}

/**
 * Einträge der Spalte 0 für den Render-Kontext. Die Creator-Gruppierung gilt immer, auch bei einer
 * einzelnen oder ohne Linie. Der Modus Linie gibt es nur für das Team und nur bei Alle Linien (`zeigeLinie`).
 */
export function koopEntries(ctx) {
  return buildKoopGroups(ctx.tree?.kooperationen, {
    mode: ctx.team && ctx.zeigeLinie ? ctx.koopGroup : DEFAULT_KOOP_GROUP,
    grouped: true,
    zeigeLinie: !!ctx.zeigeLinie
  });
}

/** Id des Gruppenkopfs, unter dem die Kooperation steht (null = Einzelzeile oder nicht vorhanden). */
export function groupOfKoop(entries, koopId) {
  if (!koopId) return null;
  const group = (entries || []).find(e => e.kind === 'group' && e.rows.some(r => r.koop.id === koopId));
  return group ? group.id : null;
}

/** Anzahl unterschiedlicher Creator (ohne Datensatz zählt jede Kooperation einzeln). */
export function creatorAnzahl(kooperationen) {
  return new Set((kooperationen || []).map(k => k.creatorId || `koop:${k.id}`)).size;
}
