// VideoTableDrawerActions
// Upload-/Settings-/Strategie-Link-Drawer und Video-Delete der Kampagnen-Video-
// Tabelle. Kapselt die Drawer-Verdrahtung (Callbacks -> Store/refilter), damit
// der Orchestrator (KampagneKooperationenVideoTable) schlank bleibt.

import { deleteVideoFile } from '../../core/VideoDeleteHelper.js';

export class VideoTableDrawerActions {
  constructor(table) {
    this.table = table;
  }

  openUploadDrawer(videoId, kooperationId, { initialTab = 'video', preselectFinal = false } = {}) {
    const t = this.table;
    const koop = t.kooperationen.find(k => k.id === kooperationId);
    const videos = t.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);
    const creator = koop?.creator;
    const creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();

    const metadaten = {
      kooperationId,
      kooperationName: koop?.name || 'Kooperation',
      videoTitel: video?.thema || 'Video',
      videoName: video?.video_name || '',
      videoPosition: video?.position || 1,
      videoThema: video?.thema || '',
      unternehmen: t.kampagneInfo?.unternehmen || '',
      unternehmenId: t.kampagneInfo?.unternehmenId || null,
      keinDropbox: t.kampagneInfo?.keinDropbox || false,
      marke: t.kampagneInfo?.marke || '',
      kampagne: t.kampagneInfo?.name || '',
      creatorName,
      bilderFolderUrl: koop?.bilder_folder_url || null,
      videos: videos.map(v => ({ id: v.id, position: v.position || 1, thema: v.thema || '' }))
    };

    t._uploadDrawer.open(videoId, metadaten, (fileUrl, filePath, videoName, folderUrl) => {
      this.updateContentCellAfterUpload(videoId, kooperationId, fileUrl, videoName, folderUrl);
    }, (bilderFolderUrl) => {
      if (koop) koop.bilder_folder_url = bilderFolderUrl;
      this.refreshBilderForKoop(kooperationId);
    }, (storysFolderUrl) => {
      const patch = { story_folder_url: storysFolderUrl };
      if (t.store) {
        t.store.updateVideo(videoId, patch);
      } else {
        if (video) video.story_folder_url = storysFolderUrl;
      }
      t.refilter();
    }, { initialTab, preselectFinal,
      onBilderCleared: () => {
        if (koop) koop.bilder_folder_url = null;
        this.refreshBilderForKoop(kooperationId);
      },
      onBilderChanged: () => this.refreshBilderForKoop(kooperationId),
      onStorysCleared: () => {
        if (t.store) t.store.updateVideo(videoId, { story_folder_url: null });
        else if (video) video.story_folder_url = null;
        t.refilter();
      },
      onFinaleChanged: () => this.refreshFinalAssetsForVideo(videoId, kooperationId),
    });
  }

  async refreshFinalAssetsForVideo(videoId, kooperationId) {
    const t = this.table;
    try {
      const { data } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, video_id, file_url, file_path, variant_name, is_final, created_at')
        .eq('video_id', videoId)
        .eq('is_final', true)
        .order('created_at', { ascending: true });

      const finalAssets = data || [];
      if (t.store) {
        t.store.updateVideo(videoId, { finalAssets });
      } else {
        const videos = t.videos[kooperationId];
        const v = videos?.find(vid => vid.id === videoId);
        if (v) v.finalAssets = finalAssets;
      }
    } catch (err) {
      console.warn('Finale Assets konnten nicht aktualisiert werden:', err);
    }
    t.refilter();
  }

  async refreshBilderForKoop(kooperationId) {
    const t = this.table;
    try {
      await t.dataLoader.loadBilder([kooperationId]);
    } catch (_) {}
    t.refilter();
  }

  updateContentCellAfterUpload(videoId, kooperationId, fileUrl, videoName, folderUrl) {
    const t = this.table;
    // fileUrl kann null sein (z. B. reiner Finale-Upload) -> bestehenden
    // Content-Link nicht ueberschreiben.
    const patch = {};
    if (fileUrl) {
      patch.file_url = fileUrl;
      patch.link_content = fileUrl;
    }
    if (folderUrl) patch.folder_url = folderUrl;
    if (videoName) patch.video_name = videoName;

    if (t.store) {
      t.store.updateVideo(videoId, patch);
    } else {
      const videos = t.videos[kooperationId];
      if (videos) {
        const v = videos.find(vid => vid.id === videoId);
        if (v) Object.assign(v, patch);
      }
    }
    t.refilter();
  }

  openCustomUploadDrawer(btn) {
    const t = this.table;
    const columnId = btn.dataset.customColumnId;
    const entityId = btn.dataset.entityId;
    const columnName = btn.dataset.columnName || 'Upload';

    const row = btn.closest('tr');
    const kooperationId = row?.dataset?.kooperationId;
    const koop = t.kooperationen.find(k => k.id === kooperationId);

    const metadaten = {
      kooperationId,
      kooperationName: koop?.name || 'Kooperation',
      unternehmen: t.kampagneInfo?.unternehmen || '',
      marke: t.kampagneInfo?.marke || '',
      kampagne: t.kampagneInfo?.name || '',
      keinDropbox: t.kampagneInfo?.keinDropbox || false,
    };

    t._uploadDrawer.open(null, metadaten, null, null, null, {
      initialTab: 'custom',
      customMeta: {
        columnId,
        entityId,
        columnName,
        folderName: columnName,
        currentValue: t.store?.getCustomColumnValue(entityId, columnId) || null,
        onSuccess: (folderUrl) => {
          // folderUrl === null: alle Dateien geloescht -> Zelle zeigt wieder Upload-Button
          if (t.store) {
            t.store.setCustomColumnValue(entityId, columnId, folderUrl || null);
          }
          t.refilter();
        },
      },
    });
  }

  async openSettingsDrawer(btn) {
    const t = this.table;
    const videoId = btn.dataset.videoId;
    const kooperationId = btn.dataset.kooperationId;
    const filePath = btn.dataset.filePath || '';
    const videoUrl = btn.dataset.videoUrl || '';
    const videos = t.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);

    await t._settingsDrawer.open({
      videoId,
      kooperationId,
      videoUrl,
      filePath,
      videoTitel: video?.thema || 'Video',
      videos: videos.map(v => ({ id: v.id, position: v.position || 1, thema: v.thema || '' })),
      onReupload: () => this.openUploadDrawer(videoId, kooperationId),
      onStorysReupload: () => this.openUploadDrawer(videoId, kooperationId, { initialTab: 'storys' }),
      onBilderReupload: () => this.openUploadDrawer(videoId, kooperationId, { initialTab: 'bilder' }),
      onDelete: () => this.executeVideoDelete(videoId, kooperationId),
      onBilderChanged: () => this.refreshBilderForKoop(kooperationId),
    });
  }

  async openLinkStrategieDrawer(btn) {
    const t = this.table;
    const videoId = btn.dataset.videoId;
    const kooperationId = btn.dataset.kooperationId;
    const koop = t.kooperationen.find(k => k.id === kooperationId);
    const videos = t.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);

    if (!video || !koop) {
      window.toastSystem?.show('Video nicht gefunden', 'error');
      return;
    }

    await t._linkStrategieDrawer.open({
      video,
      kooperation: koop,
      kampagneId: t.kampagneId,
      onSuccess: () => this.reloadAfterStrategieLink()
    });
  }

  async reloadAfterStrategieLink() {
    const t = this.table;
    await t.dataLoader.loadData();
    t.refilter();
  }

  async executeVideoDelete(videoId, kooperationId) {
    const t = this.table;
    const { hasRemainingAssets } = await deleteVideoFile(videoId);
    const patch = { file_url: null, link_content: null, currentAsset: null };
    if (!hasRemainingAssets) patch.folder_url = null;
    if (t.store) {
      t.store.updateVideo(videoId, patch);
    } else {
      const videos = t.videos[kooperationId];
      if (videos) {
        const v = videos.find(vid => vid.id === videoId);
        if (v) Object.assign(v, patch);
      }
    }
    t.refilter();
  }
}
