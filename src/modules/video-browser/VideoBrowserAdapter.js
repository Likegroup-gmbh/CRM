// VideoBrowserAdapter.js
// Liest die vorhandenen Tabellen für den Videos-Tab (Read-Adapter, keine neuen
// Entitäten), schreibt Kommentare mit Timecode, Dateititel und löscht Dateien. Der Baum entsteht in
// videoBrowserLogic.buildTree. RLS filtert serverseitig, Kunden bekommen dadurch
// kein Rohmaterial.

import { scopeKoopsByLinie } from '../produktion/ProduktionService.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { assetTable } from '../../core/assetDelete.js';

export { deleteAsset } from '../../core/assetDelete.js';

const CHUNK = 100;

const KOOP_SELECT = `
  id, name, briefing_id,
  creator:creator_id (id, vorname, nachname, instagram, profilbild_thumb_url, profilbild_url)
`;
const VIDEO_SELECT = 'id, kooperation_id, position, titel, thema, video_name, status, created_at';
const STORY_SELECT = 'id, video_id, slot_index, slot_name, created_at';
const VIDEO_ASSET_SELECT = 'id, video_id, file_url, file_path, version_number, variant_name, titel, description, is_current, is_final, source_asset_id, created_at';
const STORY_ASSET_SELECT = 'id, video_id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, titel, source_asset_id, created_at';
const STILL_SELECT = 'id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_final, variant_name, titel, source_asset_id, created_at';
const ROH_SELECT = 'id, kooperation_id, file_name, file_path, file_url, file_size, folder_url, titel, created_at';
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
    readIn('kooperation_videos', VIDEO_SELECT, 'kooperation_id', koopIds, { optional: false }),
    readIn('kooperation_bilder_asset', STILL_SELECT, 'kooperation_id', koopIds),
    team ? readIn('kooperation_rohmaterial_asset', ROH_SELECT, 'kooperation_id', koopIds) : Promise.resolve([])
  ]);

  const videoIds = videos.map(v => v.id);
  const [stories, videoAssets, slotNotes, zeitkommentare, stillNotes] = await Promise.all([
    readIn('kooperation_story', STORY_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_asset', VIDEO_ASSET_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_comment', NOTE_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_zeitkommentar', ZEIT_SELECT, 'video_id', videoIds),
    readIn('kooperation_still_comment', STILL_NOTE_SELECT, 'video_id', videoIds)
  ]);

  const storyAssets = await readIn('kooperation_story_asset', STORY_ASSET_SELECT, 'story_id', stories.map(s => s.id));

  return {
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
    stillNotes
  };
}

function emptyRaw(linien) {
  return {
    kooperationen: [], linien, videos: [], stories: [], videoAssets: [],
    storyAssets: [], stillAssets: [], rohmaterial: [], slotNotes: [], zeitkommentare: [], stillNotes: []
  };
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
  return data;
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
