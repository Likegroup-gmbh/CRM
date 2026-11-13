// assetDelete.js
// Eine Datei (Video, Story, Still, Rohmaterial) endgültig löschen: erst die Zeile, dann die
// Datei in Dropbox. Die Datei bleibt, solange eine andere Zeile denselben Pfad nutzt
// (Finale Versionen teilen sich die Datei ihrer Quelle). is_current und link_content
// räumt der Video-Trigger ab. Liegt die Datei in SharePoint, löscht der Server sie vor der
// Zeile (er braucht die Zeile für die Rechteprüfung) und lässt sie bei geteilter Nutzung stehen.

import { deleteSingleDropboxFile, syncVideoAssetsAfterDelete } from './VideoDeleteHelper.js';
import { updateStillCurrentFlags } from './stills/stillAssets.js';
import { ablageDateiLoeschen } from './ablage/ablageApi.js';
import { istSharePoint } from './ablage/ablageLink.js';

export const ASSET_TABLE = {
  video: 'kooperation_video_asset',
  story: 'kooperation_story_asset',
  still: 'kooperation_bilder_asset',
  roh: 'kooperation_rohmaterial_asset'
};

/** Spalte in kooperation_video_zeitkommentar, die auf die Datei zeigt. Rohmaterial hat keine Kommentare. */
export const KOMMENTAR_SPALTE = {
  video: 'asset_id',
  story: 'story_asset_id',
  still: 'still_asset_id'
};

export function assetTable(item) {
  const table = ASSET_TABLE[item?.type];
  if (!table || !item?.id) throw new Error('Unbekannte Datei');
  return table;
}

/** Dropbox-Datei löschen, sobald keine Zeile der Tabelle mehr auf den Pfad zeigt (best effort). */
export async function deleteFileIfUnreferenced(table, filePath) {
  if (!filePath) return;
  const { data, error } = await window.supabase
    .from(table)
    .select('id')
    .eq('file_path', filePath)
    .limit(1);
  if (error || data?.length) return;
  await deleteSingleDropboxFile(filePath)
    .catch(err => console.warn('assetDelete: Dropbox-Löschung fehlgeschlagen', err));
}

/**
 * Zeile und (falls ungeteilt) Dropbox-Datei löschen, ohne das Video abzugleichen.
 * Für Aufrufer, die den Abgleich selbst anstoßen (z. B. über einen onDelete-Callback).
 * @param {{ type: 'video'|'story'|'still'|'roh', id: string, asset?: object }} item
 */
export async function deleteAssetWithFile(item) {
  const table = assetTable(item);
  const asset = item.asset || {};
  const sb = window.supabase;
  const sharePoint = istSharePoint(asset);

  if (sharePoint) await ablageDateiLoeschen(item.type, item.id);

  const kommentarSpalte = KOMMENTAR_SPALTE[item.type];
  if (kommentarSpalte) {
    // Der Verweis fällt sonst auf null: die Kommentare stünden dann bei allen Videos der Runde
    const { error } = await sb
      .from('kooperation_video_zeitkommentar')
      .update({ deleted_at: new Date().toISOString() })
      .eq(kommentarSpalte, item.id)
      .is('deleted_at', null);
    if (error) console.warn('assetDelete: Kommentare der Datei nicht entfernt', error.message || error);
  }

  const { data, error } = await sb.from(table).delete().eq('id', item.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Datei konnte nicht gelöscht werden');

  if (!sharePoint) await deleteFileIfUnreferenced(table, asset.file_path);
}

/** Wie deleteAssetWithFile, danach Video bzw. Stills der Runde abgleichen. */
export async function deleteAsset(item) {
  await deleteAssetWithFile(item);
  const asset = item.asset || {};
  if (item.type === 'video' && asset.video_id) await syncVideoAssetsAfterDelete(asset.video_id);
  if (item.type === 'still' && asset.video_id) await updateStillCurrentFlags(asset.video_id);
}
