// videoSettingsDelete.js
// Löschen von Video-, Story- und Bild-Dateien im VideoSettingsDrawer (`d`).

import { deleteAssetWithFile } from '../../core/assetDelete.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { ablageDateiLoeschen } from '../../core/ablage/ablageApi.js';
import { istSharePoint } from '../../core/ablage/ablageLink.js';

/** SharePoint vor der Zeile löschen (Server prüft die Zeile), Dropbox best effort. */
async function deleteFile(typ, asset, filePath) {
  if (istSharePoint(asset)) await ablageDateiLoeschen(typ, asset.id);
  else await deleteDropboxFile(filePath);
}

async function deleteDropboxFile(filePath) {
  if (!filePath) return;
  await authorizedFetch('/.netlify/functions/dropbox-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  }).catch(err => console.warn('Dropbox-Löschung fehlgeschlagen:', err));
}

/** Nachfragen, löschen, Drawer neu zeichnen. `run(assetId, filePath)` macht das eigentliche Löschen. */
function bindDelete(d, selector, question, run) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', async () => {
      const assetId = btn.dataset.assetId;
      const filePath = btn.dataset.filePath || '';
      if (!confirm(question)) return;

      btn.disabled = true;
      try {
        await run(assetId, filePath);
        d.renderContent();
        d.bindEvents();
      } catch (err) {
        alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
        btn.disabled = false;
      }
    });
  });
}

export function bindDeleteButtons(d) {
  bindDelete(d, '.video-version-delete-btn', 'Diese Datei wirklich löschen?', async (assetId) => {
    const deletedAsset = d.assets.find(a => a.id === assetId);
    await deleteAssetWithFile({ type: 'video', id: assetId, asset: deletedAsset });
    d.assets = d.assets.filter(a => a.id !== assetId);
    if (deletedAsset?.is_final) d.onFinaleChanged?.();
    if (typeof d.onDelete === 'function') await d.onDelete(deletedAsset);
  });

  bindDelete(d, '.story-asset-delete-btn', 'Diese Story-Datei wirklich löschen?', async (assetId, filePath) => {
    await deleteFile('story', d.storyAssets.find(a => a.id === assetId), filePath);
    await window.supabase.from('kooperation_story_asset').delete().eq('id', assetId);
    d.storyAssets = d.storyAssets.filter(a => a.id !== assetId);
  });

  bindDelete(d, '.bilder-asset-delete-btn', 'Dieses Bild wirklich löschen?', async (assetId, filePath) => {
    await deleteFile('still', d.bilderAssets.find(a => a.id === assetId), filePath);
    await window.supabase.from('kooperation_bilder_asset').delete().eq('id', assetId);
    d.bilderAssets = d.bilderAssets.filter(a => a.id !== assetId);
    d.onBilderChanged?.();
  });
}
