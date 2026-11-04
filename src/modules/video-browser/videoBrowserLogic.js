// videoBrowserLogic.js
// Reine Logik des Videos-Tabs (Spaltenbrowser): Baum aus den vorhandenen Tabellen,
// Ablaufschritt, Auswahl, URL, Vorschau-Rahmen. Kein DOM, kein Supabase.
//
// Abbildung auf die Domäne (CONTEXT.md):
//   Kooperation -> Kooperationsvideo (Video-Nr) -> Ordner -> Datei
//   Ordner: Rohmaterial (an der Kooperation), Feedbackschleife 1..3, Finale Version
//   Dateien: Videos, Bilder und Stories des Videos, gruppiert innerhalb derselben Runde

import { sortStills } from '../../core/stills/stillAssets.js';

export const MAX_SCHLEIFEN = 3;
export const FORMATE = ['9:16', '1:1', '4:5'];

export const ROHMATERIAL_ID = 'raw';
export const FINAL_ID = 'final';

/* ------------------------------------------------------------------ */
/* Ablaufschritt                                                       */
/* ------------------------------------------------------------------ */

/** Intern = Rohmaterial der Kooperation vorhanden, sonst extern. */
export function deriveBearbeitungsart(rohmaterialCount) {
  return rohmaterialCount > 0 ? 'intern' : 'extern';
}

/**
 * Ablaufschritt aus den Daten: 5 = Finale Version, 4 = Feedbackschleife, 2 = nur Rohmaterial,
 * null = noch kein Upload.
 */
export function deriveAblaufschritt({ rohmaterialCount = 0, schleifenCount = 0, hatFinal = false } = {}) {
  if (hatFinal) return 5;
  if (schleifenCount > 0) return 4;
  if (rohmaterialCount > 0) return 2;
  return null;
}

/* ------------------------------------------------------------------ */
/* Auswahl                                                             */
/* ------------------------------------------------------------------ */

export const SELECTION_KEYS = ['kooperationId', 'videoId', 'folderId', 'itemId'];
const SELECTION_PARAMS = ['k', 'v', 'f', 'i'];

export const EMPTY_SELECTION = Object.freeze({
  kooperationId: null, videoId: null, folderId: null, itemId: null
});

/** Tiefste gewählte Ebene (-1 = nichts). */
export function selectionDepth(sel) {
  let depth = -1;
  SELECTION_KEYS.forEach((key, i) => { if (sel?.[key]) depth = i; });
  return depth;
}

/** Zeile in Ebene `depth` wählen und alle tieferen Ebenen leeren. */
export function selectLevel(sel, depth, id) {
  const next = { ...EMPTY_SELECTION };
  for (let i = 0; i < depth; i++) next[SELECTION_KEYS[i]] = sel?.[SELECTION_KEYS[i]] || null;
  next[SELECTION_KEYS[depth]] = id || null;
  return next;
}

/** Alles ab Ebene `depth` leeren (Pfadleiste). */
export function clearFrom(sel, depth) {
  const next = { ...EMPTY_SELECTION };
  for (let i = 0; i < depth; i++) next[SELECTION_KEYS[i]] = sel?.[SELECTION_KEYS[i]] || null;
  return next;
}

export function findKoop(tree, id) {
  return (tree?.kooperationen || []).find(k => k.id === id) || null;
}
export function findRow(koop, id) {
  return (koop?.rows || []).find(r => r.id === id) || null;
}
export function findFolder(row, id) {
  return (row?.folders || []).find(f => f.id === id) || null;
}
export function findItem(folder, id) {
  return (folder?.items || []).find(i => i.id === id) || null;
}

/** Löst die Auswahl gegen den Baum auf. Fehlende Knoten bleiben null. */
export function resolveSelection(tree, sel) {
  const koop = findKoop(tree, sel?.kooperationId);
  const row = findRow(koop, sel?.videoId);
  const folder = findFolder(row, sel?.folderId);
  const item = findItem(folder, sel?.itemId);
  return { koop, row, folder, item };
}

/** Leert die Auswahl ab der ersten Ebene, deren Knoten nicht (mehr) existiert. */
export function validateSelection(sel, tree) {
  const { koop, row, folder, item } = resolveSelection(tree, sel);
  const nodes = [koop, row, folder, item];
  const out = { ...EMPTY_SELECTION };
  for (let i = 0; i < SELECTION_KEYS.length; i++) {
    if (!sel?.[SELECTION_KEYS[i]] || !nodes[i]) break;
    out[SELECTION_KEYS[i]] = sel[SELECTION_KEYS[i]];
  }
  return out;
}

/**
 * Wer einen Ordner mit genau einer Datei öffnet, landet direkt in der Datei
 * (ein Klick statt zwei). Rohmaterial bleibt außen vor: dort ist die Liste der Inhalt.
 */
export function withAutoItem(sel, tree) {
  if (!sel?.folderId || sel?.itemId) return sel;
  const { folder } = resolveSelection(tree, sel);
  if (!folder || folder.kind === 'raw' || folder.items.length !== 1) return sel;
  return { ...sel, itemId: folder.items[0].id };
}

export function selectionEquals(a, b) {
  return SELECTION_KEYS.every(k => (a?.[k] || null) === (b?.[k] || null));
}

/* URL: ?k=…&v=…&f=…&i=… neben ?tab= und ?linie= */

export function selectionFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const sel = { ...EMPTY_SELECTION };
  SELECTION_KEYS.forEach((key, i) => { sel[key] = params.get(SELECTION_PARAMS[i]) || null; });
  return validateChain(sel);
}

function validateChain(sel) {
  const out = { ...EMPTY_SELECTION };
  for (const key of SELECTION_KEYS) {
    if (!sel[key]) break;
    out[key] = sel[key];
  }
  return out;
}

/** Neuer Query-String: Auswahl gesetzt, alle anderen Parameter bleiben. */
export function selectionToSearch(search, sel) {
  const params = new URLSearchParams(search || '');
  SELECTION_KEYS.forEach((key, i) => {
    if (sel?.[key]) params.set(SELECTION_PARAMS[i], sel[key]);
    else params.delete(SELECTION_PARAMS[i]);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/* ------------------------------------------------------------------ */
/* Vorschau                                                            */
/* ------------------------------------------------------------------ */

/** Rahmengröße im Seitenverhältnis, passend in maxW x maxH. */
export function fitFrame(ratio, maxW, maxH = 360) {
  const [rw, rh] = String(ratio).split(':').map(Number);
  if (!rw || !rh) return { w: Math.round(maxW), h: Math.round(maxH) };
  const s = Math.min(maxW / rw, maxH / rh);
  return { w: Math.round(rw * s), h: Math.round(rh * s) };
}

/** Position eines Markers auf der Zeitleiste in Prozent. */
export function markerProzent(timecodeSec, dauerSec) {
  if (!dauerSec || dauerSec <= 0) return 0;
  return Math.max(0, Math.min(100, (timecodeSec / dauerSec) * 100));
}

/** Marker nahe an der aktuellen Zeit (±0,6 s) bekommen den Aktiv-Zustand. */
export function markerNah(timecodeSec, aktuelleSec, toleranz = 0.6) {
  return Math.abs(timecodeSec - aktuelleSec) <= toleranz;
}

/** Datei zur Anzeige im gewünschten Seitenverhältnis: eigene finale Version oder null (Beschnitt). */
export function renditionFor(finalItems, ratio) {
  return (finalItems || []).find(i => i.ratio === ratio) || null;
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export const videoName = (n) => `Video ${n}`;
export const storyName = (n) => `Story ${n}`;
export const schleifeName = (n) => `Feedbackschleife ${n}`;
export const ROHMATERIAL_NAME = 'Rohmaterial';
export const FINAL_NAME = 'Finale Version';

export function plural(n, einzahl, mehrzahl) {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

export function formatDatum(d) {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}

export function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 * 1024 * 1024) return `${Math.round(b / (1024 * 1024))} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** @handle aus Instagram-Wert (Handle oder URL). */
export function toHandle(value) {
  if (!value) return '';
  const cleaned = String(value)
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '');
  return cleaned ? `@${cleaned}` : '';
}

/* ------------------------------------------------------------------ */
/* Baum                                                                */
/* ------------------------------------------------------------------ */

// Statusmodell: sagt, wer am Zug ist bzw. wie die Runde ausging. Alles wird aus den
// Daten abgeleitet (nichts wird gespeichert):
//   wartet       aktuelle Feedbackschleife mit Dateien, der Kunde ist am Zug
//   aenderungen  Schleife mit Nachfolger: der Kunde hat Änderungen angefordert
//   freigegeben  Finale Version liegt vor (bei der Schleife: die letzte davor)
const STATUS_TONE = { wartet: 'warning', aenderungen: 'info', freigegeben: 'success' };

export function statusOf(key, team = true) {
  const labels = {
    wartet: team ? 'Wartet auf Kunde' : 'Zu prüfen',
    aenderungen: 'Änderungen angefordert',
    freigegeben: 'Freigegeben'
  };
  return { key, label: labels[key], tone: STATUS_TONE[key] };
}

/** "Wartet seit 3 Tagen auf den Kunden." – `since` ist das Datum der jüngsten Datei der Schleife. */
export function wartetText(since, now = new Date()) {
  const start = since ? new Date(since) : null;
  if (!start || Number.isNaN(start.getTime())) return 'Wartet auf den Kunden.';
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  if (days === 0) return 'Wartet seit heute auf den Kunden.';
  return `Wartet seit ${days === 1 ? '1 Tag' : `${days} Tagen`} auf den Kunden.`;
}

function sortBy(list, ...keys) {
  return [...list].sort((a, b) => {
    for (const key of keys) {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}

const byKey = (list, key) => {
  const map = new Map();
  for (const item of list || []) {
    if (!map.has(item[key])) map.set(item[key], []);
    map.get(item[key]).push(item);
  }
  return map;
};

function ratioOf(asset) {
  return FORMATE.includes(asset?.variant_name) ? asset.variant_name : '9:16';
}

function normalizeComments(slotNotes, zeitkommentare, stillNotes) {
  const slots = (slotNotes || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: `slot-${c.id}`,
    author: { name: c.author_name || 'Unbekannt', role: c.feedback_typ === 'kunde' ? 'kunde' : 'team' },
    text: c.text,
    timecodeSec: null,
    createdAt: c.created_at,
    runde: c.runde,
    assetId: null
  }));
  // Feedback zu den Bildern einer Runde (eine Notiz je Video, Runde und Rolle)
  const stills = (stillNotes || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: `still-${c.id}`,
    author: { name: c.author_name || 'Unbekannt', role: c.feedback_typ === 'kunde' ? 'kunde' : 'team' },
    text: c.text,
    timecodeSec: null,
    createdAt: c.created_at,
    runde: c.runde,
    assetId: null,
    scope: 'still'
  }));
  const zeit = (zeitkommentare || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: c.id,
    author: { name: c.author_name || 'Unbekannt', role: c.feedback_typ === 'kunde' ? 'kunde' : 'team' },
    text: c.text,
    timecodeSec: c.timecode_sec === null || c.timecode_sec === undefined ? null : Number(c.timecode_sec),
    createdAt: c.created_at,
    runde: c.runde,
    assetId: c.asset_id || null
  }));
  return [...slots, ...stills, ...zeit].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/**
 * Kommentare einer Datei in ihrer Runde.
 *  - Video: die der Schleife, die ihm zugeordneten und die ohne Zuordnung (nicht die Bild-Notizen).
 *  - Story: die Runden-Notizen ohne Zeitstempel (ein Zeitstempel gehört zum Video).
 *  - Bild: die Bild-Notizen der Runde.
 */
export function commentsForAsset(comments, runde, assetId, type = 'video') {
  const inRunde = (comments || []).filter(c => c.runde === runde);
  if (type === 'still') return inRunde.filter(c => c.scope === 'still');
  const ohneBild = inRunde.filter(c => c.scope !== 'still');
  if (type === 'story') return ohneBild.filter(c => !c.assetId && c.timecodeSec === null);
  return ohneBild.filter(c => !c.assetId || c.assetId === assetId);
}

function loopFolderStatus({ current, istLetzte, hatFinal, team }) {
  if (current) return statusOf('wartet', team);
  if (hatFinal && istLetzte) return statusOf('freigegeben', team);
  return statusOf('aenderungen', team);
}

/**
 * Eine Zeile je Kooperationsvideo. Stories und Bilder des Videos liegen in denselben
 * Feedbackschleifen und in derselben Finalen Version wie das Video: die Runde gehört
 * zum Video, alle drei Arten teilen sich `version_number`.
 * @param {{ number: number, name: string }} storyInfo je story_id (Nummer = Slot + 1)
 */
function buildRow({
  id, number, title, kooperationId, rohmaterial, team,
  loopAssets, finalAssets,
  storyLoop = [], storyFinals = [], storyInfo = new Map(),
  stillLoop = [], stillFinals = [],
  comments, slotLabel
}) {
  const hatFinal = finalAssets.length > 0 || storyFinals.length > 0 || stillFinals.length > 0;
  const kommentarRunden = comments.map(c => c.runde).filter(Boolean);
  const versionen = [...new Set([
    ...loopAssets.map(a => a.version_number || 1),
    ...storyLoop.map(a => a.version_number || 1),
    ...stillLoop.map(a => a.version_number || 1),
    ...kommentarRunden
  ])].sort((a, b) => a - b);
  const maxVersion = versionen.length ? versionen[versionen.length - 1] : 0;

  const storyNumber = (a) => storyInfo.get(a.story_id)?.number || 1;
  const storyLabel = (a) => `${storyName(storyNumber(a))}${a.variant_name && !FORMATE.includes(a.variant_name) ? ` ${a.variant_name}` : ''}`;
  const byStory = (list) => [...list].sort((a, b) =>
    storyNumber(a) - storyNumber(b) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const byStill = (list) => sortStills(list);

  const folders = [];

  if (team) {
    const files = sortBy(rohmaterial, 'created_at').reverse();
    folders.push({
      id: ROHMATERIAL_ID,
      kind: 'raw',
      name: ROHMATERIAL_NAME,
      meta: files.length ? plural(files.length, 'Datei', 'Dateien') : 'Noch kein Upload',
      status: null,
      current: false,
      leer: files.length === 0,
      upload: true,
      items: files.map(f => ({
        id: f.id,
        type: 'roh',
        group: 'Dateien',
        name: f.file_name || 'Datei',
        meta: [formatBytes(f.file_size), formatDatum(f.created_at)].filter(Boolean).join(' · '),
        ratio: '9:16',
        asset: f,
        rowId: id
      }))
    });
  }

  for (const version of versionen) {
    const inVersion = (a) => (a.version_number || 1) === version;
    const videos = sortBy(loopAssets.filter(inVersion), 'created_at');
    const storys = byStory(storyLoop.filter(inVersion));
    const bilder = byStill(stillLoop.filter(inVersion));
    const current = version === maxVersion && !hatFinal;
    const status = loopFolderStatus({ current, istLetzte: version === maxVersion, hatFinal, team });
    const runden = comments.filter(c => c.runde === version && c.scope !== 'still');
    const base = { version, status, rowId: id, runde: version, locked: false };

    const items = [
      ...videos.map((a, idx) => ({
        ...base,
        id: a.id,
        type: 'video',
        group: 'Videos',
        name: a.variant_name ? `Video ${a.variant_name}` : `Video ${idx + 1}`,
        meta: `v${version} · ${plural(runden.length, 'Kommentar', 'Kommentare')}`,
        ratio: '9:16',
        asset: a
      })),
      ...bilder.map((a, idx) => ({
        ...base,
        id: a.id,
        type: 'still',
        group: 'Bilder',
        name: `Bild ${idx + 1}`,
        meta: `v${version}`,
        ratio: '4:5',
        asset: a
      })),
      ...storys.map((a) => ({
        ...base,
        id: a.id,
        type: 'story',
        group: 'Stories',
        name: storyLabel(a),
        meta: `v${version}`,
        ratio: '9:16',
        asset: a,
        storyId: a.story_id
      }))
    ];
    const alle = [...videos, ...storys, ...bilder];

    folders.push({
      id: `s${version}`,
      kind: 'schleife',
      name: schleifeName(version),
      number: version,
      meta: plural(items.length, 'Datei', 'Dateien'),
      status,
      // Datum der jüngsten Datei: seit wann der Kunde wartet
      since: alle.length
        ? alle.map(a => a.created_at || '').sort().pop() || null
        : null,
      current,
      closed: !current,
      leer: items.length === 0,
      upload: team && current,
      items
    });
  }

  // Team: nächste, noch leere Feedbackschleife zum Ablegen
  if (team && !hatFinal && versionen.length < MAX_SCHLEIFEN) {
    const next = maxVersion + 1;
    if (next <= MAX_SCHLEIFEN) {
      folders.push({
        id: `s${next}`,
        kind: 'schleife',
        name: schleifeName(next),
        number: next,
        meta: 'Noch leer',
        status: null,
        current: versionen.length === 0,
        closed: false,
        leer: true,
        upload: true,
        items: []
      });
    }
  }

  if (hatFinal) {
    const finalBase = { status: statusOf('freigegeben', team), rowId: id, isFinal: true, runde: null, locked: true };
    const videos = sortBy(finalAssets, 'created_at').map((a) => ({
      ...finalBase,
      id: a.id,
      type: 'video',
      group: 'Videos',
      name: `${FINAL_NAME} ${ratioOf(a)}`,
      meta: ratioOf(a),
      ratio: ratioOf(a),
      version: a.version_number || 1,
      asset: a
    }));
    const stills = byStill(stillFinals).map((a, idx) => ({
      ...finalBase,
      id: a.id,
      type: 'still',
      group: 'Bilder',
      name: a.file_name || `Bild ${idx + 1}`,
      meta: 'Bild',
      ratio: '4:5',
      version: a.version_number || 1,
      asset: a
    }));
    const storys = byStory(storyFinals).map((a) => ({
      ...finalBase,
      id: a.id,
      type: 'story',
      group: 'Stories',
      name: `${storyName(storyNumber(a))} · ${ratioOf(a)}`,
      meta: ratioOf(a),
      ratio: ratioOf(a),
      version: a.version_number || 1,
      asset: a,
      storyId: a.story_id
    }));
    const formate = [...new Set([...videos, ...storys].map(v => v.ratio))];
    const anzahl = videos.length + stills.length + storys.length;
    folders.push({
      id: FINAL_ID,
      kind: 'final',
      name: FINAL_NAME,
      meta: `${plural(anzahl, 'Inhalt', 'Inhalte')}${formate.length ? ` · ${formate.join(', ')}` : ''}`,
      status: statusOf('freigegeben', team),
      current: true,
      closed: false,
      leer: false,
      upload: false,
      items: [...videos, ...stills, ...storys]
    });
  }

  const stage = deriveAblaufschritt({
    rohmaterialCount: rohmaterial.length,
    schleifenCount: versionen.length,
    hatFinal
  });

  const aktuelle = folders.find(f => f.kind === 'schleife' && f.current && !f.leer);
  const offeneCount = hatFinal ? 0 : (aktuelle?.items.length || 0);

  let status = null;
  if (hatFinal) status = statusOf('freigegeben', team);
  else if (versionen.length) status = statusOf('wartet', team);

  const sichtbareOrdner = folders.filter(f => !(f.leer && f.kind === 'schleife' && !team));

  return {
    id,
    kind: 'video',
    kooperationId,
    number,
    title,
    label: slotLabel,
    stage,
    status,
    offeneCount,
    folders: sichtbareOrdner,
    comments,
    kannKommentieren: true
  };
}

/**
 * Baut den Baum Kooperation -> Video -> Ordner -> Datei. Stories und Bilder eines Videos
 * liegen in den Ordnern des Videos (gleiche Runde, gleiche Finale Version).
 * @param {object} raw geladene Zeilen (siehe VideoBrowserAdapter)
 * @param {{ team: boolean, zeigeLinie?: boolean }} opts
 */
export function buildTree(raw, { team }) {
  const videosByKoop = byKey(raw.videos, 'kooperation_id');
  const storiesByVideo = byKey(raw.stories, 'video_id');
  const loopByVideo = byKey((raw.videoAssets || []).filter(a => !a.is_final), 'video_id');
  const finalByVideo = byKey((raw.videoAssets || []).filter(a => a.is_final), 'video_id');
  const stillsByVideo = byKey((raw.stillAssets || []).filter(a => a.video_id), 'video_id');
  // Altbilder ohne Video hängen an der Kooperation: sie gehören zum ersten Video
  const lostStillsByKoop = byKey((raw.stillAssets || []).filter(a => !a.video_id), 'kooperation_id');
  const assetsByStory = byKey(raw.storyAssets || [], 'story_id');
  const rohByKoop = byKey(raw.rohmaterial || [], 'kooperation_id');
  const notesByVideo = byKey(raw.slotNotes || [], 'video_id');
  const zeitByVideo = byKey(raw.zeitkommentare || [], 'video_id');
  const stillNotesByVideo = byKey(raw.stillNotes || [], 'video_id');
  const linien = new Map((raw.linien || []).map(l => [l.id, l]));

  const kooperationen = (raw.kooperationen || []).map((k) => {
    const rohmaterial = rohByKoop.get(k.id) || [];
    const creator = k.creator || {};
    const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || k.name || 'Creator';
    const videos = sortBy(videosByKoop.get(k.id) || [], 'position', 'created_at');
    const rows = [];

    videos.forEach((v, idx) => {
      const number = v.position || idx + 1;
      const title = v.titel || v.thema || v.video_name || '';
      const comments = normalizeComments(notesByVideo.get(v.id), zeitByVideo.get(v.id), stillNotesByVideo.get(v.id));

      const stories = sortBy(storiesByVideo.get(v.id) || [], 'slot_index');
      const storyInfo = new Map(stories.map((s, sIdx) => [s.id, {
        number: (Number.isFinite(s.slot_index) ? s.slot_index : sIdx) + 1,
        name: s.slot_name || ''
      }]));
      const storyAssets = stories.flatMap(s => assetsByStory.get(s.id) || []);
      const stills = [
        ...(stillsByVideo.get(v.id) || []),
        ...(idx === 0 ? lostStillsByKoop.get(k.id) || [] : [])
      ];

      rows.push(buildRow({
        id: v.id,
        number,
        title,
        kooperationId: k.id,
        rohmaterial,
        team,
        loopAssets: loopByVideo.get(v.id) || [],
        finalAssets: finalByVideo.get(v.id) || [],
        storyLoop: storyAssets.filter(a => !a.is_final),
        storyFinals: storyAssets.filter(a => a.is_final),
        storyInfo,
        stillLoop: stills.filter(a => !a.is_final),
        stillFinals: stills.filter(a => a.is_final),
        comments,
        slotLabel: videoName(number)
      }));
    });

    const videoRows = rows;
    const linie = k.briefing_id ? linien.get(k.briefing_id) || null : null;
    return {
      id: k.id,
      name: creatorName,
      kooperationName: k.name || '',
      handle: toHandle(creator.instagram),
      avatarUrl: creator.profilbild_thumb_url || creator.profilbild_url || null,
      linie,
      mode: deriveBearbeitungsart(rohmaterial.length),
      rohmaterialCount: rohmaterial.length,
      videoCount: videoRows.length,
      offeneCount: rows.reduce((sum, r) => sum + r.offeneCount, 0),
      rows
    };
  });

  return { kooperationen };
}

/** Die nächsten `count` freien Variantenbuchstaben (A, B, C, ...) über alle Feedbackschleifen des Videos. */
export function nextVariantLetters(row, count = 1) {
  const used = new Set();
  for (const folder of row?.folders || []) {
    if (folder.kind !== 'schleife') continue;
    for (const item of folder.items) {
      if (item.type !== 'video') continue;
      const name = String(item.asset?.variant_name || '').trim().toUpperCase();
      if (name) used.add(name);
    }
  }
  const out = [];
  for (let i = 0; out.length < count; i++) {
    const letter = i < 26 ? String.fromCharCode(65 + i) : `V${i + 1}`;
    if (!used.has(letter)) out.push(letter);
  }
  return out;
}

export function nextVariantLetter(row) {
  return nextVariantLetters(row, 1)[0];
}

/**
 * Verlauf einer Variante: dieselbe Variante über die Feedbackschleifen plus ihre
 * Finale Version (Verweis über source_asset_id). Nur sinnvoll bei mehr als einem Eintrag.
 */
export function verlaufFor(row, item) {
  if (!row || !item || (item.type !== 'video' && item.type !== 'story')) return [];
  // Varianten gehören zur selben Art (und bei Stories zur selben Story)
  const sameKind = (i) => i.type === item.type
    && (item.type !== 'story' || i.asset?.story_id === item.asset?.story_id);
  const loopItems = row.folders
    .filter(f => f.kind === 'schleife')
    .flatMap(f => f.items.filter(sameKind).map(i => ({ folder: f, item: i })));

  let key = item.asset?.variant_name || null;
  if (item.isFinal) {
    const source = loopItems.find(e => e.item.id === item.asset?.source_asset_id);
    key = source?.item.asset?.variant_name || null;
  }
  if (!key) return [];

  const matches = loopItems.filter(e => (e.item.asset?.variant_name || null) === key);
  const ids = new Set(matches.map(e => e.item.id));
  const entries = matches.map(e => ({
    folderId: e.folder.id,
    itemId: e.item.id,
    label: e.folder.name,
    status: e.folder.status?.key || null,
    current: e.item.id === item.id
  }));
  const finals = row.folders
    .filter(f => f.kind === 'final')
    .flatMap(f => f.items.filter(i => ids.has(i.asset?.source_asset_id)).map(i => ({ folder: f, item: i })));
  for (const e of finals) {
    entries.push({
      folderId: e.folder.id,
      itemId: e.item.id,
      label: `${FINAL_NAME} ${e.item.ratio}`,
      status: 'freigegeben',
      current: e.item.id === item.id
    });
  }
  return entries;
}

/** Nächster offener Inhalt (für "Ersten offenen Inhalt prüfen" und "Was gerade ansteht"). */
export function ersterOffenerInhalt(tree) {
  for (const koop of tree?.kooperationen || []) {
    for (const row of koop.rows) {
      if (row.offeneCount === 0) continue;
      const folder = row.folders.find(f => f.kind === 'schleife' && f.current && !f.leer);
      const item = folder?.items[0];
      if (folder && item) {
        return { kooperationId: koop.id, videoId: row.id, folderId: folder.id, itemId: item.id };
      }
    }
  }
  return null;
}

/* ---- Downloads: was gehört zu welchem Umfang ---- */

const hasFile = (item) => !!(item?.asset?.file_path || item?.asset?.file_url);

/**
 * Die Dateien, die "aktuell" zu einem Video gehören: die Finale Version, sonst
 * die jüngste Feedbackschleife mit Dateien. Rohmaterial zählt nicht dazu.
 */
export function currentFolderOf(row) {
  const folders = row?.folders || [];
  const final = folders.find(f => f.id === FINAL_ID && f.items.length);
  if (final) return final;
  const loops = folders.filter(f => f.kind === 'schleife' && f.items.length);
  return loops.length ? loops[loops.length - 1] : null;
}

/**
 * @param {'item'|'folder'|'koop'} scope
 * @param {{ koop?: object, row?: object, folder?: object, item?: object }} resolved
 * @returns {Array<{ item: object, row: object }>} nur Einträge mit herunterladbarer Datei
 */
export function collectDownloadItems(scope, { koop, row, folder, item } = {}) {
  let list = [];
  if (scope === 'item' && item && row) {
    list = [{ item, row }];
  } else if (scope === 'folder' && folder && row) {
    list = folder.items.map(i => ({ item: i, row }));
  } else if (scope === 'koop' && koop) {
    for (const r of koop.rows) {
      const current = currentFolderOf(r);
      if (current) list.push(...current.items.map(i => ({ item: i, row: r })));
    }
  }
  return list.filter(e => hasFile(e.item));
}

/**
 * `vorschau_bereit` an die Asset-Zeilen hängen. Die View liefert nur Vorschaudateien mit
 * passender Revision: nach einem Replace fällt das Asset heraus und spielt das Original.
 * Reine Wiedergabe-Info: Status und Ablaufschritt lesen das Feld nie.
 */
export function markVorschau(videoAssets, vorschau) {
  const ready = new Set((vorschau || []).filter(v => v.status === 'ready').map(v => v.asset_id));
  for (const a of videoAssets || []) {
    if (ready.has(a.id)) a.vorschau_bereit = true;
  }
}

/** Wert für Attribut-Selektoren (`[data-x="…"]`) absichern; kommt ohne CSS.escape aus. */
export function cssEscape(value) {
  return String(value ?? '').replace(/["\\]/g, '\\$&');
}
