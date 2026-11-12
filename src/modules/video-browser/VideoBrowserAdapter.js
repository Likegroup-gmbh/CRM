// VideoBrowserAdapter.js
// Liest die vorhandenen Tabellen für den Videos-Tab (Read-Adapter, keine neuen
// Entitäten), schreibt Kommentare mit Timecode, Dateititel und löscht Dateien. Der Baum entsteht in
// videoBrowserLogic.buildTree. RLS filtert serverseitig, Kunden bekommen dadurch
// kein Rohmaterial.

import { scopeKoopsByLinie } from '../produktion/ProduktionService.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { assetTable } from '../../core/assetDelete.js';
import { proxyPost } from '../../core/dropboxLinks.js';
import { renamedFilePath, splitFileName } from '../../core/videoFileNames.js';
import { mitAblage, istSharePoint } from '../../core/ablage/ablageLink.js';
import { ablageDateiUmbenennen } from '../../core/ablage/ablageApi.js';

export { deleteAsset } from '../../core/assetDelete.js';

const CHUNK = 100;

const KOOP_SELECT = `
  id, name, briefing_id, created_at,
  creator:creator_id (id, vorname, nachname, instagram, profilbild_thumb_url, profilbild_url)
`;
const VIDEO_SELECT = 'id, kooperation_id, position, titel, thema, video_name, caption, status, created_at';
// Videoidee nur fürs Team: Kunden (v. a. kunde_editor) dürfen strategie_items nicht durchgängig lesen
const VIDEO_SELECT_TEAM = `${VIDEO_SELECT}, strategie_item_id`;
const STORY_SELECT = 'id, video_id, slot_index, slot_name, created_at';
const VIDEO_ASSET_SELECT = mitAblage('id, video_id, file_url, file_path, version_number, variant_name, titel, ad_manager_name, description, is_current, is_final, source_asset_id, created_at');
const STORY_ASSET_SELECT = mitAblage('id, video_id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, titel, source_asset_id, created_at');
const STILL_SELECT = mitAblage('id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_final, variant_name, titel, source_asset_id, created_at');
const ROH_SELECT = mitAblage('id, kooperation_id, file_name, file_path, file_url, file_size, folder_url, titel, created_at');
const TAG_TYP_SELECT = 'id, label, gruppe, kampagne_id';
const VARIANTE_TAG_SELECT = 'video_id, variant_key, tag_typ_id, created_at';
const NOTE_SELECT = 'id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at';
const STILL_NOTE_SELECT = 'id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at';
const ZEIT_SELECT = 'id, video_id, runde, feedback_typ, text, timecode_sec, asset_id, author_name, created_at, deleted_at';

function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Eine Tabelle in Blöcken über eine ID-Spalte lesen. Fehler = leere Liste (optionale Daten). */
async function readIn(table, select, column, ids, { optional = true, order } = {}) {
  if (!ids.length) return [];
  const results = await Promise.all(chunks(ids).map(async (part) => {
    let query = window.supabase.from(table).select(select).in(column, part);
    if (order) query = query.order(order, { ascending: true });
    const { data, error } = await query;
    if (error) {
      if (!optional) throw error;
      console.warn(`VideoBrowserAdapter: ${table} nicht lesbar`, error.message || error);
      return [];
    }
    return data || [];
  }));
  return results.flat();
}

/**
 * @param {{ kampagneId: string, produktionId?: string|null, briefingId?: string|null,
 *           linien?: Array<{id: string, name: string}>, team: boolean }} scope
 */
export async function loadVideoBrowserData({ kampagneId, produktionId = null, briefingId = null, linien = [], team }) {
  if (!window.supabase || !kampagneId) {
    return emptyRaw(linien);
  }

  let koopQuery = window.supabase
    .from('kooperationen')
    .select(KOOP_SELECT)
    .eq('kampagne_id', kampagneId)
    .order('name', { ascending: true });
  if (produktionId) koopQuery = koopQuery.eq('produktion_id', produktionId);
  koopQuery = scopeKoopsByLinie(koopQuery, briefingId);

  const { data: kooperationen, error } = await koopQuery;
  if (error) throw error;

  const koopIds = (kooperationen || []).map(k => k.id);
  if (!koopIds.length) return emptyRaw(linien);

  const [videos, stillAssets, rohmaterial] = await Promise.all([
    readIn('kooperation_videos', team ? VIDEO_SELECT_TEAM : VIDEO_SELECT, 'kooperation_id', koopIds, { optional: false }),
    readIn('kooperation_bilder_asset', STILL_SELECT, 'kooperation_id', koopIds),
    team ? readIn('kooperation_rohmaterial_asset', ROH_SELECT, 'kooperation_id', koopIds) : Promise.resolve([])
  ]);

  const videoIds = videos.map(v => v.id);
  const [stories, videoAssets, slotNotes, zeitkommentare, stillNotes, { ideen, produkte }] = await Promise.all([
    readIn('kooperation_story', STORY_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_asset', VIDEO_ASSET_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_comment', NOTE_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_zeitkommentar', ZEIT_SELECT, 'video_id', videoIds),
    readIn('kooperation_still_comment', STILL_NOTE_SELECT, 'video_id', videoIds),
    team ? loadProdukte(videos) : Promise.resolve({ ideen: [], produkte: [] })
  ]);

  const storyAssets = await readIn('kooperation_story_asset', STORY_ASSET_SELECT, 'story_id', stories.map(s => s.id));
  const [tagTypen, varianteTags] = await Promise.all([
    loadTagTypen(kampagneId),
    readIn('video_variante_tags', VARIANTE_TAG_SELECT, 'video_id', videoIds)
  ]);

  return {
    tagTypen,
    varianteTags,
    kooperationen: kooperationen || [],
    linien,
    videos,
    stories,
    videoAssets,
    storyAssets,
    stillAssets,
    rohmaterial,
    slotNotes,
    zeitkommentare,
    stillNotes,
    ideen,
    produkte
  };
}

/** Produkt der Videoideen hinter den Videos (Meta-Zeile in Spalte 0). Fehler = keine Produkte. */
async function loadProdukte(videos) {
  const ideeIds = [...new Set(videos.map(v => v.strategie_item_id).filter(Boolean))];
  const ideen = await readIn('strategie_items', 'id, produkt_id', 'id', ideeIds);
  const produktIds = [...new Set(ideen.map(i => i.produkt_id).filter(Boolean))];
  const produkte = await readIn('produkt', 'id, name', 'id', produktIds);
  return { ideen, produkte };
}

function emptyRaw(linien) {
  return {
    kooperationen: [], linien, videos: [], stories: [], videoAssets: [],
    storyAssets: [], stillAssets: [], rohmaterial: [], slotNotes: [], zeitkommentare: [], stillNotes: [],
    tagTypen: [], varianteTags: [], ideen: [], produkte: []
  };
}

/** Katalog: globale Tags und die dieser Kampagne. Fehlt die Tabelle noch, gibt es keine Tags. */
async function loadTagTypen(kampagneId) {
  try {
    const { data, error } = await window.supabase
      .from('video_tag_typen')
      .select(TAG_TYP_SELECT)
      .or(`kampagne_id.is.null,kampagne_id.eq.${kampagneId}`);
    if (error) {
      console.warn('VideoBrowserAdapter: video_tag_typen nicht lesbar', error.message || error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('VideoBrowserAdapter: video_tag_typen nicht lesbar', err?.message || err);
    return [];
  }
}

/* ---- Tags an Varianten ---- */

/** Tag an eine Variante hängen. Ein zweites Mal derselben Zuordnung ist kein Fehler. */
export async function insertVarianteTag({ videoId, variantKey, tagTypId }) {
  const row = { video_id: videoId, variant_key: variantKey, tag_typ_id: tagTypId };
  const { data, error } = await window.supabase
    .from('video_variante_tags')
    .insert(row)
    .select(VARIANTE_TAG_SELECT)
    .single();
  // 23505 = gibt es schon (zweiter Tab, doppelter Klick): der Zustand stimmt trotzdem
  if (error?.code === '23505') return { ...row, created_at: new Date().toISOString() };
  if (error) throw error;
  return data;
}

export async function deleteVarianteTag({ videoId, variantKey, tagTypId }) {
  const { error } = await window.supabase
    .from('video_variante_tags')
    .delete()
    .eq('video_id', videoId)
    .eq('variant_key', variantKey)
    .eq('tag_typ_id', tagTypId);
  if (error) throw error;
}

/** Neuen Tag im Katalog anlegen (Gruppe "Eigene", gilt für die Kampagne). */
export async function createTagTyp({ label, gruppe = 'Eigene', kampagneId = null }) {
  const { data, error } = await window.supabase
    .from('video_tag_typen')
    .insert({ label, gruppe, kampagne_id: kampagneId })
    .select(TAG_TYP_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Kommentar an einer Datei der aktuellen Feedbackschleife anlegen.
 * @param {{ videoId: string, runde: number, assetId?: string|null, text: string,
 *           timecodeSec?: number|null, isKunde: boolean }} input
 * @returns {Promise<object>} gespeicherte Zeile
 */
export async function saveZeitkommentar({ videoId, runde, assetId = null, text, timecodeSec = null, isKunde }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Kommentar ist leer');
  const user = window.currentUser || {};
  const { data, error } = await window.supabase
    .from('kooperation_video_zeitkommentar')
    .insert({
      video_id: videoId,
      runde,
      feedback_typ: isKunde ? 'kunde' : 'cj',
      text: trimmed,
      timecode_sec: timecodeSec === null || timecodeSec === undefined ? null : Math.round(timecodeSec * 100) / 100,
      asset_id: assetId,
      author_benutzer_id: user.id || null,
      author_name: user.name || 'Unbekannt'
    })
    .select(ZEIT_SELECT)
    .single();
  if (error) throw error;
  if (isKunde) teamsMeldungAnstossen();
  return data;
}

// Teams-Meldung sofort statt erst mit dem Minuten-Zeitplan (ADR 0066); was hier scheitert, holt der Zeitplan nach.
function teamsMeldungAnstossen() {
  try {
    globalThis.fetch?.('/.netlify/functions/teams-meldung-senden', { method: 'POST', keepalive: true })?.catch?.(() => {});
  } catch {
    // ohne Anstoss bleibt der Zeitplan
  }
}

/**
 * Caption des Kooperationsvideos. Dieselbe Spalte wie im Kooperationstab
 * (`kooperation_videos.caption`). Leer wird null.
 * @returns {Promise<string|null>}
 */
export async function saveVideoCaption(videoId, caption) {
  const value = String(caption ?? '').trim() || null;
  const { data, error } = await window.supabase
    .from('kooperation_videos')
    .update({ caption: value })
    .eq('id', videoId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Caption konnte nicht gespeichert werden');
  return value;
}

export const TITEL_MAX = 120;

/**
 * Anzeigetitel einer Datei setzen. Dropbox-Pfad und file_name bleiben unverändert.
 * RLS lässt nur Admin/Mitarbeiter schreiben: null Zeilen heißt keine Berechtigung.
 */
export async function renameAsset(item, titel) {
  const value = String(titel || '').trim().slice(0, TITEL_MAX);
  if (!value) throw new Error('Titel ist leer');
  const { data, error } = await window.supabase
    .from(assetTable(item))
    .update({ titel: value })
    .eq('id', item.id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Titel konnte nicht gespeichert werden');
  return value;
}

/**
 * Ad-Manager-Dateiname eines Videos: benennt die Datei in Dropbox um und trägt den Namen (ohne
 * Endung) ein. Alle Zeilen, die dieselbe Datei teilen (Feedbackschleife und ihre Finale
 * Versionen), ziehen mit, sonst zeigt ein Teil auf den alten Pfad. Der Anzeigetitel bleibt.
 * Schlägt der Eintrag fehl, wird die Datei zurückbenannt.
 * @returns {Promise<{ path: string, stem: string }>}
 */
export async function renameAdManagerFile(item, name) {
  const asset = item.asset;
  const oldPath = asset?.file_path;
  if (!oldPath || !asset.video_id) throw new Error('Datei hat keinen Dropbox-Pfad');
  const target = renamedFilePath(oldPath, name, { adManager: true });
  if (!target) throw new Error('Dateiname ist leer');
  if (istSharePoint(asset)) return renameAdManagerSharePoint(asset, oldPath, target);

  let path = oldPath;
  if (target !== oldPath) {
    const moved = await proxyPost({ action: 'move', fromPath: oldPath, toPath: target });
    path = moved.path || target;
  }
  const { stem } = splitFileName(path);

  const { data, error } = await window.supabase
    .from('kooperation_video_asset')
    .update({ file_path: path, ad_manager_name: stem })
    .eq('video_id', asset.video_id)
    .eq('file_path', oldPath)
    .select('id');
  if (error || !data?.length) {
    if (path !== oldPath) await proxyPost({ action: 'move', fromPath: path, toPath: oldPath }).catch(() => {});
    throw error || new Error('Dateiname konnte nicht gespeichert werden');
  }
  return { path, stem };
}

/** Wie oben, nur benennt der Server die Datei in SharePoint um. Zeilen derselben Datei über item_id. */
async function renameAdManagerSharePoint(asset, oldPath, target) {
  const oldName = oldPath.split('/').pop();
  const newName = target.split('/').pop();
  let path = oldPath;
  let felder = {};
  if (target !== oldPath) {
    const res = await ablageDateiUmbenennen('video', asset.id, newName);
    path = res.file_path || target;
    felder = { file_name: res.file_name || newName, ...(res.etag ? { etag: res.etag } : {}) };
  }
  const { stem } = splitFileName(path);

  let query = window.supabase
    .from('kooperation_video_asset')
    .update({ file_path: path, ...felder, ad_manager_name: stem })
    .eq('video_id', asset.video_id);
  query = asset.item_id ? query.eq('item_id', asset.item_id) : query.eq('file_path', oldPath);
  const { data, error } = await query.select('id');
  if (error || !data?.length) {
    if (path !== oldPath) await ablageDateiUmbenennen('video', asset.id, oldName).catch(() => {});
    throw error || new Error('Dateiname konnte nicht gespeichert werden');
  }
  return { path, stem };
}

/**
 * Messung einer Wiedergabe ablegen (append-only, Auswertung über die View
 * media_wiedergabe_perzentile). Fehler bleiben still: die Messung darf die Sichtung nie stören.
 * @param {object} row - Ergebnis von createWiedergabeMessung().finish()
 * @param {{ team: boolean }} scope
 */
export function saveWiedergabeMessung(row, { team }) {
  if (!row || !window.supabase) return;
  const browser = typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 200) : null;
  window.supabase
    .from('media_wiedergabe_messung')
    .insert({ ...row, ansicht: team ? 'team' : 'kunde', browser })
    .then(({ error }) => { if (error) console.warn('VideoBrowserAdapter: Messung nicht gespeichert', error.message || error); })
    .catch(() => {});
}

/**
 * Pfadkontext für Dropbox-Uploads einer Kooperation (gleiche Felder wie der
 * Rohmaterial-Upload und der Video-Upload-Drawer).
 * @returns {Promise<{ pathContext: object, creatorName: string, keinDropbox: boolean }>}
 */
export async function loadUploadContext(kooperationId) {
  const { data, error } = await window.supabase
    .from('kooperationen')
    .select(`
      id, name,
      creator:creator_id (vorname, nachname),
      kampagne:kampagne_id (
        id, kampagnenname, eigener_name,
        unternehmen:unternehmen_id (id, firmenname, kein_dropbox),
        marke:marke_id (id, markenname)
      )
    `)
    .eq('id', kooperationId)
    .single();
  if (error) throw error;
  const kamp = data.kampagne || {};
  return {
    pathContext: {
      unternehmen: kamp.unternehmen?.firmenname || '',
      marke: kamp.marke?.markenname || '',
      kampagne: KampagneUtils.getDisplayName(kamp),
      kooperation: data.name || ''
    },
    creatorName: [data.creator?.vorname, data.creator?.nachname].filter(Boolean).join(' '),
    keinDropbox: !!kamp.unternehmen?.kein_dropbox
  };
}
