// videoBrowserTree.js
// Baum Kooperation → Video → Ordner → Datei aus den geladenen Zeilen, plus Abfragen auf dem Baum
// (Varianten, Verlauf, offener Inhalt, Download-Umfang).

import { FINAL_ID, FINAL_NAME, toHandle, videoName } from './videoBrowserFormat.js';
import { deriveBearbeitungsart } from './videoBrowserStatus.js';
import { normalizeComments } from './videoBrowserCommentData.js';
import { buildRow, sortBy } from './videoBrowserRow.js';
import { attachTags } from './videoBrowserTagLogic.js';

const byKey = (list, key) => {
  const map = new Map();
  for (const item of list || []) {
    if (!map.has(item[key])) map.set(item[key], []);
    map.get(item[key]).push(item);
  }
  return map;
};

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
  // Produkt hängt an der Videoidee (nur Team geladen): je Kooperation die Produkte ihrer Videos
  const produktName = new Map((raw.produkte || []).map(p => [p.id, p.name]));
  const produktByIdee = new Map((raw.ideen || []).map(i => [i.id, produktName.get(i.produkt_id) || null]));
  // Reihenfolge der Linien wie im Linien-Wechsler (Gruppierung in Spalte 0)
  const linienOrder = new Map((raw.linien || []).map((l, i) => [l.id, i]));

  const kooperationen = (raw.kooperationen || []).map((k) => {
    const rohmaterial = rohByKoop.get(k.id) || [];
    const creator = k.creator || {};
    const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || k.name || 'Creator';
    const videos = sortBy(videosByKoop.get(k.id) || [], 'position', 'created_at');

    const rows = videos.map((v, idx) => {
      const number = v.position || idx + 1;
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

      return buildRow({
        id: v.id,
        number,
        title: v.titel || v.thema || v.video_name || '',
        caption: v.caption || '',
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
        comments: normalizeComments(notesByVideo.get(v.id), zeitByVideo.get(v.id), stillNotesByVideo.get(v.id)),
        slotLabel: videoName(number)
      });
    });

    const linie = k.briefing_id ? linien.get(k.briefing_id) || null : null;
    return {
      id: k.id,
      name: creatorName,
      vorname: creator.vorname || creatorName.split(' ')[0],
      kooperationName: k.name || '',
      creatorId: creator.id || null,
      createdAt: k.created_at || null,
      handle: toHandle(creator.instagram),
      avatarUrl: creator.profilbild_thumb_url || creator.profilbild_url || null,
      linie,
      linieId: linie ? linie.id : null,
      linieName: linie?.name || '',
      linieOrder: linie ? linienOrder.get(linie.id) : null,
      produkte: [...new Set(videos.map(v => produktByIdee.get(v.strategie_item_id)).filter(Boolean))],
      mode: deriveBearbeitungsart(rohmaterial.length),
      rohmaterialCount: rohmaterial.length,
      videoCount: rows.length,
      offeneCount: rows.reduce((sum, r) => sum + r.offeneCount, 0),
      rows
    };
  });

  attachTags(kooperationen, { tagTypen: raw.tagTypen, varianteTags: raw.varianteTags });

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
 * @param {'item'|'formats'|'folder'|'koop'} scope  formats = alle Formate der Finalen Version, sonst wie item
 * @param {{ koop?: object, row?: object, folder?: object, item?: object }} resolved
 * @returns {Array<{ item: object, row: object }>} nur Einträge mit herunterladbarer Datei
 */
export function collectDownloadItems(scope, { koop, row, folder, item } = {}) {
  let list = [];
  if (scope === 'item' && item && row) {
    list = [{ item, row }];
  } else if (scope === 'formats' && item && row) {
    // Im Ordner Finale Version alle Videos (jedes Format ist eine Datei), sonst die gewählte Datei
    list = folder?.kind === 'final'
      ? folder.items.filter(i => i.type === 'video').map(i => ({ item: i, row }))
      : [{ item, row }];
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
