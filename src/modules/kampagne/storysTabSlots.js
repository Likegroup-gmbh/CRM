// storysTabSlots.js
// Story-Slots im Storys-Tab des VideoUploadDrawers: laden, anzeigen, Slot löschen.
// Mixin über installStorysTabSlots(proto).

import { ablageDateiLoeschen } from '../../core/ablage/ablageApi.js';
import { istSharePoint, mitAblage } from '../../core/ablage/ablageLink.js';
import { storySlotsHtml } from './storysTabRender.js';

export function installStorysTabSlots(proto) {
  proto._loadStorySlots = async function () {
    if (!this.drawer.videoId) return [];
    try {
      const { data: slots, error } = await window.supabase
        .from('kooperation_story')
        .select('id, video_id, slot_index, slot_name, created_at')
        .eq('video_id', this.drawer.videoId)
        .order('slot_index', { ascending: true });
      if (error) return [];

      const slotIds = (slots || []).map(s => s.id);
      let assets = [];
      if (slotIds.length > 0) {
        const { data: assetData } = await window.supabase
          .from('kooperation_story_asset')
          .select(mitAblage('id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name', 'ablage'))
          .in('story_id', slotIds);
        assets = assetData || [];
      }

      const assetsBySlot = {};
      for (const a of assets) {
        if (!assetsBySlot[a.story_id]) assetsBySlot[a.story_id] = [];
        assetsBySlot[a.story_id].push(a);
      }

      return (slots || []).map(slot => {
        const slotAssets = assetsBySlot[slot.id] || [];
        const loopAssets = slotAssets.filter(a => !a.is_final);
        const currentAsset = loopAssets.find(a => a.is_current) || loopAssets[0] || null;
        const existingVersions = [...new Set(loopAssets.map(a => a.version_number))].sort((a, b) => a - b);
        return { ...slot, assets: slotAssets, currentAsset, currentVersion: currentAsset?.version_number || 0, existingVersions };
      });
    } catch (err) {
      console.error('[StorysTabHandler] _loadStorySlots:', err);
      return [];
    }
  };

  proto._refreshStoryVersionDropdown = function () {
    this._renderExistingSlots();
  };

  proto._loadExistingStorys = async function () {
    this._storySlots = await this._loadStorySlots();
    this._renderExistingSlots();
  };

  proto._renderExistingSlots = function () {
    const listEl = document.getElementById('existing-storys-list');
    const countEl = document.getElementById('existing-storys-count');

    if (countEl) countEl.textContent = `(${this._storySlots.length})`;
    if (!listEl) return;

    listEl.innerHTML = this._storySlots.length
      ? storySlotsHtml(this._storySlots)
      : '<div class="existing-images-empty">Keine Storys vorhanden</div>';
  };

  proto._deleteSlot = async function (slotId) {
    const slotEl = document.querySelector(`.existing-story-slot-delete[data-slot-id="${slotId}"]`)?.closest('.existing-storys-slot-item');
    if (slotEl) slotEl.style.opacity = '0.5';

    try {
      const slot = this._storySlots.find(s => s.id === slotId);

      // SharePoint: Zeile direkt nach ihrer Datei löschen. Quelle und Finale teilen die Datei,
      // der Server löscht sie erst, wenn keine andere Zeile mehr auf sie zeigt.
      for (const asset of (slot?.assets || []).filter(istSharePoint)) {
        await ablageDateiLoeschen('story', asset.id);
        const { error } = await window.supabase.from('kooperation_story_asset').delete().eq('id', asset.id);
        if (error) throw error;
      }

      // Slot weg, restliche Zeilen (Altbestand) per CASCADE
      await window.supabase
        .from('kooperation_story')
        .delete()
        .eq('id', slotId);

      const { count } = await window.supabase
        .from('kooperation_story')
        .select('id', { count: 'exact', head: true })
        .eq('video_id', this.drawer.videoId);

      if ((count ?? 0) === 0) {
        await window.supabase
          .from('kooperation_videos')
          .update({ story_folder_url: null })
          .eq('id', this.drawer.videoId);
        this.drawer.onStorysCleared?.();
      }

      this._storySlots = await this._loadStorySlots();
      this._renderExistingSlots();
    } catch (err) {
      console.error('Story-Slot löschen fehlgeschlagen:', err);
      this._showStorysError(err.message || 'Löschen fehlgeschlagen');
      if (slotEl) slotEl.style.opacity = '';
    }
  };
}
