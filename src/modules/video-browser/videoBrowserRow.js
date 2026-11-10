// videoBrowserRow.js
// Eine Zeile je Kooperationsvideo mit ihren Ordnern: Rohmaterial, Feedbackschleifen, Finale Version.

import { sortStills } from '../../core/stills/stillAssets.js';
import {
  FINAL_ID,
  FINAL_NAME,
  FORMATE,
  MAX_SCHLEIFEN,
  ROHMATERIAL_ID,
  ROHMATERIAL_NAME,
  formatBytes,
  formatDatum,
  plural,
  ratioOf,
  schleifeName,
  storyName
} from './videoBrowserFormat.js';
import { deriveAblaufschritt, loopFolderStatus, statusOf } from './videoBrowserStatus.js';

export function sortBy(list, ...keys) {
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

/** Nummer, Name und Reihenfolge der Stories eines Videos. */
function storyHelpers(storyInfo) {
  const number = (a) => storyInfo.get(a.story_id)?.number || 1;
  const label = (a) => `${storyName(number(a))}${a.variant_name && !FORMATE.includes(a.variant_name) ? ` ${a.variant_name}` : ''}`;
  const sort = (list) => [...list].sort((a, b) =>
    number(a) - number(b) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return { number, label, sort };
}

function rohmaterialFolder(rowId, rohmaterial) {
  const files = sortBy(rohmaterial, 'created_at').reverse();
  return {
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
      name: f.titel || f.file_name || 'Datei',
      meta: [formatBytes(f.file_size), formatDatum(f.created_at)].filter(Boolean).join(' · '),
      ratio: '9:16',
      asset: f,
      rowId
    }))
  };
}

function loopFolder({ version, rowId, current, istLetzte, hatFinal, team, loopAssets, storyLoop, stillLoop, comments, stories }) {
  const inVersion = (a) => (a.version_number || 1) === version;
  const videos = sortBy(loopAssets.filter(inVersion), 'created_at');
  const storys = stories.sort(storyLoop.filter(inVersion));
  const bilder = sortStills(stillLoop.filter(inVersion));
  const status = loopFolderStatus({ current, istLetzte, hatFinal, team });
  const runden = comments.filter(c => c.runde === version && c.scope !== 'still');
  const base = { version, status, rowId, runde: version, locked: false };

  const items = [
    ...videos.map((a, idx) => ({
      ...base,
      id: a.id,
      type: 'video',
      group: 'Videos',
      name: a.titel || (a.variant_name ? `Video ${a.variant_name}` : `Video ${idx + 1}`),
      meta: `v${version} · ${plural(runden.length, 'Kommentar', 'Kommentare')}`,
      ratio: '9:16',
      asset: a
    })),
    ...bilder.map((a, idx) => ({
      ...base,
      id: a.id,
      type: 'still',
      group: 'Bilder',
      name: a.titel || `Bild ${idx + 1}`,
      meta: `v${version}`,
      ratio: '4:5',
      asset: a
    })),
    ...storys.map((a) => ({
      ...base,
      id: a.id,
      type: 'story',
      group: 'Stories',
      name: a.titel || stories.label(a),
      meta: `v${version}`,
      ratio: '9:16',
      asset: a,
      storyId: a.story_id
    }))
  ];
  const alle = [...videos, ...storys, ...bilder];

  return {
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
  };
}

/** Team: nächste, noch leere Feedbackschleife zum Ablegen. */
function nextLoopFolder(number, current) {
  return {
    id: `s${number}`,
    kind: 'schleife',
    name: schleifeName(number),
    number,
    meta: 'Noch leer',
    status: null,
    current,
    closed: false,
    leer: true,
    upload: true,
    items: []
  };
}

const FINAL_RATIO_ORDER = ['9:16', '4:5', '1:1'];
const ratioRank = (a) => {
  const i = FINAL_RATIO_ORDER.indexOf(ratioOf(a));
  return i === -1 ? FINAL_RATIO_ORDER.length : i;
};
/** Finale Dateien: erst nach Format (9:16, 4:5, 1:1), dann nach Anlage. */
const sortFinals = (list) => [...list].sort((a, b) =>
  ratioRank(a) - ratioRank(b) || String(a.created_at || '').localeCompare(String(b.created_at || '')));

/** Titel einer finalen Datei; ohne eigenen Titel (ältere Freigaben) der Titel der Quelldatei. */
function titelMap(...lists) {
  const map = new Map();
  for (const list of lists) for (const a of list) if (a.titel) map.set(a.id, a.titel);
  return map;
}

function finalFolder({ rowId, team, finalAssets, stillFinals, storyFinals, stories, quellTitel }) {
  const titelOf = (a) => a.titel || quellTitel.get(a.source_asset_id) || null;
  const anzahl0 = finalAssets.length + stillFinals.length + storyFinals.length;
  // Für das Team immer da, auch leer: Dropzone für direkte Finale. Kunden sehen ihn erst mit Inhalt.
  const finalBase = { status: statusOf('freigegeben', team), rowId, isFinal: true, runde: null, locked: true };
  const videos = sortFinals(finalAssets).map((a) => ({
    ...finalBase,
    id: a.id,
    type: 'video',
    group: 'Videos',
    name: titelOf(a) || `${FINAL_NAME} ${ratioOf(a)}`,
    meta: ratioOf(a),
    ratio: ratioOf(a),
    version: a.version_number || 1,
    asset: a
  }));
  const stills = sortStills(stillFinals).map((a, idx) => ({
    ...finalBase,
    id: a.id,
    type: 'still',
    group: 'Bilder',
    name: titelOf(a) || a.file_name || `Bild ${idx + 1}`,
    meta: 'Bild',
    ratio: '4:5',
    version: a.version_number || 1,
    asset: a
  }));
  const storys = stories.sort(storyFinals).map((a) => ({
    ...finalBase,
    id: a.id,
    type: 'story',
    group: 'Stories',
    name: titelOf(a) || `${storyName(stories.number(a))} · ${ratioOf(a)}`,
    meta: ratioOf(a),
    ratio: ratioOf(a),
    version: a.version_number || 1,
    asset: a,
    storyId: a.story_id
  }));
  const formate = [...new Set([...videos, ...storys].map(v => v.ratio))];
  const anzahl = videos.length + stills.length + storys.length;
  return {
    id: FINAL_ID,
    kind: 'final',
    name: FINAL_NAME,
    meta: anzahl0
      ? `${plural(anzahl, 'Inhalt', 'Inhalte')}${formate.length ? ` · ${formate.join(', ')}` : ''}`
      : 'Noch leer',
    status: anzahl0 ? statusOf('freigegeben', team) : null,
    current: true,
    closed: false,
    leer: anzahl0 === 0,
    upload: !!team,
    items: [...videos, ...stills, ...storys]
  };
}

/**
 * Eine Zeile je Kooperationsvideo. Stories und Bilder des Videos liegen in denselben
 * Feedbackschleifen und in derselben Finalen Version wie das Video: die Runde gehört
 * zum Video, alle drei Arten teilen sich `version_number`.
 * @param {{ number: number, name: string }} storyInfo je story_id (Nummer = Slot + 1)
 */
export function buildRow({
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
  const stories = storyHelpers(storyInfo);

  const folders = [];
  if (team) folders.push(rohmaterialFolder(id, rohmaterial));

  for (const version of versionen) {
    folders.push(loopFolder({
      version,
      rowId: id,
      current: version === maxVersion && !hatFinal,
      istLetzte: version === maxVersion,
      hatFinal,
      team,
      loopAssets,
      storyLoop,
      stillLoop,
      comments,
      stories
    }));
  }

  if (team && !hatFinal && versionen.length < MAX_SCHLEIFEN && maxVersion + 1 <= MAX_SCHLEIFEN) {
    folders.push(nextLoopFolder(maxVersion + 1, versionen.length === 0));
  }

  if (hatFinal || team) folders.push(finalFolder({
    rowId: id, team, finalAssets, stillFinals, storyFinals, stories,
    quellTitel: titelMap(loopAssets, storyLoop, stillLoop)
  }));

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
