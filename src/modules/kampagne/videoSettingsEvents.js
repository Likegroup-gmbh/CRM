// videoSettingsEvents.js
// Events im VideoSettingsDrawer (`d`): Schließen, Tabs, Accordion, Re-Upload, geteilter Ordner,
// Finale Version markieren. Löschen liegt in videoSettingsDelete.js.

import { promoteAssetToFinal, unmarkFinalSlot } from '../../core/PromoteFinalAsset.js';
import { bindDeleteButtons } from './videoSettingsDelete.js';

/** Der Upload-Drawer öffnet erst, wenn dieser Drawer ausgeblendet ist. */
const REUPLOAD_DELAY_MS = 350;

const REUPLOAD_BUTTONS = [
  ['video-settings-reupload-btn', 'onReupload'],
  ['storys-settings-reupload-btn', 'onStorysReupload'],
  ['bilder-settings-reupload-btn', 'onBilderReupload'],
];

function bindAccordion(d, panel) {
  panel?.querySelectorAll('.settings-accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.accordion;
      const body = btn.nextElementSibling;
      const isExpanded = btn.classList.contains('expanded');

      if (isExpanded) {
        btn.classList.remove('expanded');
        if (body) body.style.display = 'none';
        d._expandedRounds.delete(key);
      } else {
        btn.classList.add('expanded');
        if (body) body.style.display = '';
        d._expandedRounds.add(key);
      }
    });
  });
}

function bindRemoveFolder(d) {
  const removeFolderBtn = document.getElementById('video-settings-folder-remove');
  removeFolderBtn?.addEventListener('click', async () => {
    if (!confirm('Geteilten Ordner entfernen?')) return;
    removeFolderBtn.disabled = true;
    try {
      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ folder_url: null })
        .eq('id', d.videoId);
      if (error) throw error;
      d.folderUrl = '';
      await d.onFolderCleared?.();
      d.renderContent();
      d.bindEvents();
    } catch (err) {
      alert('Entfernen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
      removeFolderBtn.disabled = false;
    }
  });
}

function promoteSource(d, kind, assetId) {
  if (kind === 'still') {
    const asset = d.bilderAssets.find(a => a.id === assetId);
    return {
      ...asset,
      video_id: asset?.video_id || d.videoId,
      kooperation_id: asset?.kooperation_id || d.kooperationId,
    };
  }
  const asset = d.assets.find(a => a.id === assetId);
  return { ...asset, video_id: asset?.video_id || d.videoId };
}

/** Assets neu laden, Tab und Callbacks bleiben. */
function reopen(d) {
  return d.open({
    videoId: d.videoId,
    kooperationId: d.kooperationId,
    videoUrl: d.videoUrl,
    filePath: d.filePath,
    videoTitel: d.videoTitel,
    folderUrl: d.folderUrl,
    videos: d.videos,
    onReupload: d.onReupload,
    onStorysReupload: d.onStorysReupload,
    onBilderReupload: d.onBilderReupload,
    onDelete: d.onDelete,
    onBilderChanged: d.onBilderChanged,
    onFinaleChanged: d.onFinaleChanged,
    onFolderCleared: d.onFolderCleared,
    initialTab: d._activeTab,
  });
}

function bindPromoteFinal(d, panel) {
  panel?.querySelectorAll('.promote-final-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { kind, assetId, slot } = btn.dataset;
      const unmark = btn.dataset.unmark === '1';
      const source = promoteSource(d, kind, assetId);
      if (!source?.id) return;
      btn.disabled = true;
      try {
        if (unmark) {
          await unmarkFinalSlot(kind, source.video_id || d.videoId, slot || undefined, kind === 'video' ? source.id : undefined);
        } else {
          await promoteAssetToFinal(kind, source, slot);
        }
        d.onFinaleChanged?.();
        d.onBilderChanged?.();
        await reopen(d);
      } catch (err) {
        alert('Markieren fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
        btn.disabled = false;
      }
    });
  });
}

export function bindSettingsEvents(d) {
  const overlay = document.getElementById(`${d.drawerId}-overlay`);
  const panel = document.getElementById(d.drawerId);

  overlay?.addEventListener('click', () => d.close());
  panel?.querySelector('.drawer-close-btn')?.addEventListener('click', () => d.close());
  document.getElementById('video-settings-close-btn')?.addEventListener('click', () => d.close());

  panel?.querySelectorAll('.drawer-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => d._switchTab(btn.dataset.settingsTab));
  });

  bindAccordion(d, panel);

  for (const [id, callback] of REUPLOAD_BUTTONS) {
    document.getElementById(id)?.addEventListener('click', () => {
      d.close();
      if (typeof d[callback] === 'function') {
        setTimeout(() => d[callback](), REUPLOAD_DELAY_MS);
      }
    });
  }

  bindRemoveFolder(d);
  bindPromoteFinal(d, panel);
  bindDeleteButtons(d);
}
