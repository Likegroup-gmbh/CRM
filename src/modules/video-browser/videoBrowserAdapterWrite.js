// videoBrowserAdapterWrite.js
// Schreibzugriffe des Videos-Tabs: Kommentare mit Timecode, Kunden-Freigabe, Caption, Dateititel,
// Ad-Manager-Dateiname und Wiedergabe-Messung. VideoBrowserAdapter.js exportiert alles weiter,
// Aufrufer importieren nur von dort.

import { KOMMENTAR_SPALTE, assetTable } from '../../core/assetDelete.js';
import { proxyPost } from '../../core/dropboxLinks.js';
import { renamedFilePath, splitFileName } from '../../core/videoFileNames.js';
import { istSharePoint } from '../../core/ablage/ablageLink.js';
import { ablageDateiUmbenennen } from '../../core/ablage/ablageApi.js';

export const ZEIT_SELECT = 'id, video_id, runde, feedback_typ, text, timecode_sec, asset_id, story_asset_id, still_asset_id, author_name, created_at, deleted_at';

/**
 * Kommentar an einer Datei der aktuellen Feedbackschleife anlegen.
 * Bilder haben keine Zeitleiste: dort bleibt der Timecode leer.
 * @param {{ videoId: string, runde: number, assetId?: string|null, assetType?: 'video'|'story'|'still',
 *           text: string, timecodeSec?: number|null, isKunde: boolean }} input
 * @returns {Promise<object>} gespeicherte Zeile
 */
export async function saveZeitkommentar({ videoId, runde, assetId = null, assetType = 'video', text, timecodeSec = null, isKunde }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Kommentar ist leer');
  const spalte = KOMMENTAR_SPALTE[assetType];
  if (!spalte) throw new Error('Unbekannte Datei');
  const ohneZeit = assetType === 'still' || timecodeSec === null || timecodeSec === undefined;
  const user = window.currentUser || {};
  const { data, error } = await window.supabase
    .from('kooperation_video_zeitkommentar')
    .insert({
      video_id: videoId,
      runde,
      feedback_typ: isKunde ? 'kunde' : 'cj',
      text: trimmed,
      timecode_sec: ohneZeit ? null : Math.round(timecodeSec * 100) / 100,
      [spalte]: assetId,
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
 * Video-Freigabe durch die Kundenseite (ADR 0072): die Dateien der aktuellen Feedbackschleife
 * werden Finale Version, das Flag `freigabe` am Video wird gesetzt. Beides serverseitig in einem Schritt.
 * @param {string} videoId
 * @param {Array<{ kind: 'video'|'story'|'still', source_id: string, slot: string|null }>} finals
 * @returns {Promise<{ freigabe_vorher: boolean, video: object[], story: object[], still: object[] }>}
 */
export async function freigebenVideoKunde(videoId, finals) {
  const { data, error } = await window.supabase.rpc('freigeben_video_kunde', { p_video_id: videoId, p_finals: finals });
  if (error) throw error;
  return { freigabe_vorher: !!data?.freigabe_vorher, video: data?.video || [], story: data?.story || [], still: data?.still || [] };
}

/** "Rückgängig" kurz nach der Freigabe: entfernt die eben angelegten Finals und stellt das Flag zurück. */
export async function zuruecknehmenVideoKunde(videoId, ids, freigabeVorher = false) {
  const { error } = await window.supabase.rpc('zuruecknehmen_video_kunde', {
    p_video_id: videoId, p_ids: ids, p_freigabe: !!freigabeVorher
  });
  if (error) throw error;
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
