import { MediaLightbox } from './MediaLightbox.js';
import { resolveStreamUrl, prefetchStreamUrl } from './mediaSrc.js';
import { downloadMediaAsset } from './downloadMediaAsset.js';
import { resolveVideoFeedbackTarget } from '../VideoFeedbackBuckets.js';
import { MediaItemBuilder } from './MediaItemBuilder.js';
import { VideoAssetLoader } from './VideoAssetLoader.js';
import { MediaPrefetcher } from './MediaPrefetcher.js';
import { VideoPlayerView } from './VideoPlayerView.js';
import { VideoPlaybackController } from './VideoPlaybackController.js';
import { VideoElementPool } from './VideoElementPool.js';
import * as MediaCache from './MediaCache.js';

// Container-Formate, die haeufig nicht abspielbar sind -> kein Blob-Caching
// (laufen ohnehin ueber den Download-Fallback).
const RISKY_VIDEO_EXT = /\.(mov|avi|mkv|m4v)(?:\?|#|$)/i;

/**
 * Durchgaengiger Medien-Viewer fuer die Kampagnen-Tabelle (Orchestrator).
 * - Flache Item-Liste ueber ALLE gefilterten Kooperationen (siehe MediaItemBuilder):
 *   pro Video das Video + seine Storys, danach die Bilder der Koop.
 * - Prev/Next blaettert durchgaengig ueber alle Typen.
 * - Rendering (VideoPlayerView), Asset-/Versionslogik (VideoAssetLoader),
 *   Prefetch (MediaPrefetcher) und Player-Steuerung (VideoPlaybackController)
 *   sind in eigene Module ausgelagert; diese Klasse haelt State/Lifecycle.
 */
export class VideoPlayerLightbox {
  constructor(table) {
    this.table = table;
    this.lightbox = new MediaLightbox();
    this.items = [];
    this.index = 0;

    // Video-spezifischer Zustand
    this.assets = [];
    this.selectedVersion = null;
    this.selectedAssetId = null;
    // Story-spezifischer Zustand
    this.storyVersion = null;

    this.loading = false;
    this.src = null;
    this.fallbackUrl = null;
    this._srcToken = 0;
    // Key des aktuell in der Stage sichtbaren Videos (fuers Offscreen-Parken).
    this._activeVideoKey = null;

    // Module
    this.itemBuilder = new MediaItemBuilder(table);
    this.assetLoader = new VideoAssetLoader();
    this.prefetcher = new MediaPrefetcher(this);
    this.view = new VideoPlayerView(this);
    this.playback = new VideoPlaybackController();
    this.videoPool = new VideoElementPool();
  }

  get current() {
    return this.items[this.index] || null;
  }

  // ---- Public Einstiegspunkte ----

  openVideo(videoId, kooperationId) {
    return this._open([
      it => it.type === 'video' && it.video.id === videoId && it.koop.id === kooperationId,
      it => it.type === 'video' && it.video.id === videoId,
    ], kooperationId);
  }

  openStory(videoId, kooperationId) {
    return this._open([
      it => it.type === 'story' && it.video?.id === videoId && it.koop.id === kooperationId,
      it => it.type === 'story' && it.koop.id === kooperationId,
    ], kooperationId);
  }

  openBilder(kooperationId) {
    return this._open([
      it => it.type === 'bild' && it.koop.id === kooperationId,
    ], kooperationId);
  }

  async _open(finders, kooperationId = null) {
    this.prefetcher.addPreconnect();
    await Promise.all([
      this.itemBuilder.ensureBilderLoaded(),
      this.itemBuilder.ensureStorySlotsLoaded(),
    ]);
    this.items = this.itemBuilder.build();

    let idx = -1;
    for (const f of finders) {
      idx = this.items.findIndex(f);
      if (idx >= 0) break;
    }
    // Niemals still auf items[0] (fremde Kooperation) springen. Wenn kein
    // passendes Medium gefunden wurde, auf die richtige Koop scopen; gibt es
    // dort gar nichts, leeren Zustand zeigen (index = -1 -> current === null).
    if (idx < 0 && kooperationId != null) {
      idx = this.items.findIndex(it => it.koop.id === kooperationId);
    }
    this.index = idx;
    this._resetItemState();

    // Warm-Start: Temp-Link des angeklickten Mediums sofort anfragen
    const lookup = this.currentLookup();
    if (lookup.file_path || lookup.file_url) prefetchStreamUrl(lookup);

    this.lightbox.open({
      className: 'video-player-lightbox media-split-lightbox',
      onPrev: () => this._navigate(-1),
      onNext: () => this._navigate(1),
      hasPrev: () => this.index > 0,
      hasNext: () => this.index >= 0 && this.index < this.items.length - 1,
      renderBody: () => this.view.renderBody(),
      onMount: (root) => this._mount(root),
      onBeforeRerender: () => this._parkStageVideo(),
      onClose: () => {
        MediaCache.unpin();
        this.prefetcher.cleanup();
        this.playback.unmount();
        this.videoPool.clear();
        this._activeVideoKey = null;
      },
    });

    await this._loadCurrent();
  }

  _navigate(dir) {
    if (this.index < 0) return;
    const next = this.index + dir;
    if (next < 0 || next >= this.items.length) return;
    this.index = next;
    this._resetItemState();
    this._loadCurrent();
  }

  _resetItemState() {
    this.assets = [];
    this.selectedVersion = null;
    this.selectedAssetId = null;
    this.storyVersion = null;
    this.src = null;
    this.fallbackUrl = null;
  }

  // ---- Laden ----

  async _loadCurrent() {
    const item = this.current;
    if (!item) return;

    if (item.type === 'video') {
      const videoId = item.video.id;
      if (this.assetLoader.has(videoId)) {
        this.assets = this.assetLoader.get(videoId);
        this.loading = false;
        this._applyDefaultSelection(videoId);
        this.lightbox.update();
        await this._resolveSrc();
        return;
      }
      this.assets = [];
      this.loading = true;
      this.lightbox.update();
      const assets = await this.assetLoader.load(videoId);
      if (this.current?.video?.id !== videoId) return;
      this.assets = assets;
      this.loading = false;
      this._applyDefaultSelection(videoId);
      this.lightbox.update();
      await this._resolveSrc();
      return;
    }

    if (item.type === 'story') {
      const versions = this.storyVersions(item.slot);
      this.storyVersion = versions.length ? versions[versions.length - 1] : 1;
      this.loading = true;
      this.lightbox.update();
      await this._resolveSrc();
      return;
    }

    // bild
    this.loading = true;
    this.lightbox.update();
    await this._resolveSrc();
  }

  _applyDefaultSelection(videoId) {
    const comments = this.table.videoComments[videoId];
    const sel = this.assetLoader.applyDefaultSelection(this.assets, comments);
    this.selectedVersion = sel.selectedVersion;
    this.selectedAssetId = sel.selectedAssetId;
  }

  // ---- Story-Versionen ----

  storyVersions(slot) {
    if (slot.existingVersions?.length) return slot.existingVersions;
    if (slot.versions?.length) return slot.versions;
    return [...new Set((slot.assets || []).map(a => a.version_number || 1))].sort((a, b) => a - b);
  }

  storyAsset(slot, version) {
    const variants = (slot.assets || []).filter(a => (a.version_number || 1) === version);
    return variants.find(a => a.is_current) || variants[0] || null;
  }

  // ---- Quelle aufloesen ----

  currentLookup() {
    const item = this.current;
    if (!item) return { file_path: null, file_url: null };
    if (item.type === 'video') {
      const asset = this.assetLoader.selectedAsset(this.assets, this.selectedAssetId);
      if (asset) return { file_path: asset.file_path || null, file_url: asset.file_url || null };
      const v = item.video;
      return {
        file_path: v.currentAsset?.file_path || null,
        file_url: v.file_url || v.link_content || v.asset_url || null
      };
    }
    if (item.type === 'story') {
      const a = this.storyAsset(item.slot, this.storyVersion);
      return { file_path: a?.file_path || null, file_url: a?.file_url || null };
    }
    return { file_path: item.image.file_path || null, file_url: item.image.file_url || null };
  }

  /** Pfad/URL des aktuellen Mediums (fuer Format-Hinweis). */
  currentMediaPath() {
    const lookup = this.currentLookup();
    return lookup.file_path || lookup.file_url || '';
  }

  /**
   * Stabiler Content-Key fuers Blob-Caching: `{typ}:{id}:{created_at}`.
   * created_at aendert sich bei Upload UND Replace (gleiche id) -> kein Stale.
   * @returns {string|null} null -> Caching ueberspringen
   */
  currentCacheKey() {
    const item = this.current;
    if (!item) return null;
    if (item.type === 'video') {
      const asset = this.assetLoader.selectedAsset(this.assets, this.selectedAssetId)
        || item.video.currentAsset;
      if (!asset?.id) return null;
      return `video:${asset.id}:${asset.created_at || ''}`;
    }
    if (item.type === 'story') {
      const a = this.storyAsset(item.slot, this.storyVersion);
      if (!a?.id) return null;
      return `story:${a.id}:${a.created_at || a.file_size || ''}`;
    }
    if (!item.image?.id) return null;
    return `bild:${item.image.id}:${item.image.created_at || ''}`;
  }

  async _resolveSrc() {
    const token = ++this._srcToken;
    const lookup = this.currentLookup();
    const resolved = await resolveStreamUrl(lookup);

    if (token !== this._srcToken) return; // veraltet

    const item = this.current;
    const key = this.currentCacheKey();
    MediaCache.pin(key);

    const cached = key ? MediaCache.getObjectUrl(key) : null;
    if (cached) {
      // Bereits als Blob vorhanden -> sofort, kein Netz.
      this.src = cached;
    } else {
      this.src = resolved;
      const path = lookup.file_path || lookup.file_url || '';
      const cacheable = !!key && !!resolved && !RISKY_VIDEO_EXT.test(path);
      // Sofort befuellen, waehrend das Medium ohnehin betrachtet wird -> beim
      // Zurueck-/Wieder-Oeffnen ist der Blob fertig und wird ohne Netz angezeigt.
      if (cacheable) MediaCache.ensure(key, resolved);
    }

    this.fallbackUrl = resolved;
    this.loading = false;
    this._applySrc();
    this.prefetcher.prefetchNeighborAssets();
    this.prefetcher.scheduleNeighborPrefetch();
  }

  _applySrc() {
    if (!this.lightbox.isOpen()) return;
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;

    const item = this.current;
    const key = this.currentCacheKey();
    const poolable = item?.type === 'video' && !!key && !RISKY_VIDEO_EXT.test(this.currentMediaPath());

    // Geparktes Video mit erhaltenem Puffer/Position wiederverwenden -> kein
    // Re-Download, Poster + gesehener Bereich sofort. Listener am Subtree sind
    // intakt; nur der document-gebundene Fullscreen-Listener muss neu.
    const parked = poolable ? this.videoPool.take(key) : null;
    if (parked) {
      stage.replaceChildren(...Array.from(parked.childNodes));
      this.playback.rearmFullscreen(stage);
      this._activeVideoKey = key;
      return;
    }

    stage.innerHTML = this.view.renderStageInner();
    this._bindFormatHint(stage);
    const videoEl = stage.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('error', () => this._onVideoError(), { once: true });
    }
    // Altes Stage-Video wurde durch innerHTML ersetzt -> document-Listener
    // des vorherigen Mounts entbinden, bevor neu gemountet wird.
    this.playback.unmount();
    this.playback.mount(stage);
    this._activeVideoKey = poolable ? key : null;
  }

  /**
   * Rettet das aktuell sichtbare Stage-Video (mit Puffer/Position/Listenern) in
   * den Offscreen-Pool, bevor der Body neu gerendert wird. No-op, wenn das
   * aktuelle Medium kein cachebares Video war (_activeVideoKey === null).
   */
  _parkStageVideo() {
    const key = this._activeVideoKey;
    if (!key) return;
    this._activeVideoKey = null;
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    const video = stage?.querySelector('.vpl-video');
    if (!video) return;
    try { video.pause(); } catch (_) { /* still */ }
    const wrapper = document.createElement('div');
    wrapper.append(...Array.from(stage.childNodes));
    this.videoPool.park(key, wrapper);
  }

  _bindFormatHint(stage) {
    const closeBtn = stage?.querySelector('.vpl-format-hint-close');
    if (!closeBtn) return;
    closeBtn.addEventListener('click', () => {
      closeBtn.closest('.vpl-format-hint')?.classList.add('is-hidden');
    });
  }

  _onVideoError() {
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    const link = this.fallbackUrl || this.src;
    stage.innerHTML = this.view.renderUnplayable(link);
    const dl = stage.querySelector('.vpl-fallback-download');
    if (dl) dl.addEventListener('click', () => this._download());
  }

  // ---- Feedback-Ziel ----

  feedbackTarget() {
    const item = this.current;
    if (!item) return null;

    let videoId = null;
    let version = 1;
    if (item.type === 'video') {
      videoId = item.video.id;
      version = this.selectedVersion || 1;
    } else if (item.type === 'story') {
      videoId = item.slot.video_id || item.video?.id || null;
      version = this.storyVersion || 1;
    } else {
      const koopVideos = this.table.videos[item.koop.id] || [];
      videoId = koopVideos[0]?.id || null;
      version = 1;
    }
    if (!videoId) return null;

    const isKunde = this.table.isKundeRole();
    return { videoId, target: resolveVideoFeedbackTarget(version, isKunde) };
  }

  // ---- Events ----

  _mount(root) {
    const versionSelect = root.querySelector('.player-version-select');
    if (versionSelect) {
      versionSelect.addEventListener('change', () => {
        this.selectedVersion = Number(versionSelect.value);
        const variants = this.assetLoader.variantsForVersion(this.assets, this.selectedVersion);
        const currentAsset = variants.find(a => a.is_current) || variants[0];
        this.selectedAssetId = currentAsset?.id || null;
        this.loading = false;
        this.lightbox.update();
        this._resolveSrc();
      });
    }

    const variantSelect = root.querySelector('.player-variant-select');
    if (variantSelect) {
      variantSelect.addEventListener('change', () => {
        this.selectedAssetId = variantSelect.value;
        this._resolveSrc();
      });
    }

    const storyVersionSelect = root.querySelector('.story-version-select');
    if (storyVersionSelect) {
      storyVersionSelect.addEventListener('change', () => {
        this.storyVersion = Number(storyVersionSelect.value);
        this.src = null;
        this.lightbox.update();
        this._resolveSrc();
      });
    }

    root.querySelectorAll('.media-gallery-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.itemIndex);
        if (Number.isInteger(idx) && idx >= 0 && idx !== this.index) {
          this.index = idx;
          this._resetItemState();
          this._loadCurrent();
        }
      });
    });

    const feedbackInput = root.querySelector('.player-feedback-input:not([readonly])');
    if (feedbackInput) {
      feedbackInput.addEventListener('blur', () => this._saveFeedback(feedbackInput));
    }

    const prevBtn = root.querySelector('.vpl-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this._navigate(-1));
    const nextBtn = root.querySelector('.vpl-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this._navigate(1));
    const downloadBtn = root.querySelector('.vpl-download');
    if (downloadBtn) downloadBtn.addEventListener('click', () => this._download());

    const stage = root.querySelector('.media-viewer-stage');
    this._bindFormatHint(stage);
    const stageVideo = stage?.querySelector('video');
    if (stageVideo) {
      stageVideo.addEventListener('error', () => this._onVideoError(), { once: true });
    }
    this.playback.mount(stage);
  }

  // ---- Download ----

  _download() {
    const item = this.current;
    if (!item) return;

    let source = null;
    let filename = null;
    if (item.type === 'video') {
      const asset = this.assetLoader.selectedAsset(this.assets, this.selectedAssetId);
      const v = item.video;
      source = asset || {
        file_path: v.currentAsset?.file_path || null,
        file_url: v.file_url || v.link_content || v.asset_url || null,
      };
      filename = this._buildVideoFilename(asset, v);
    } else if (item.type === 'story') {
      source = this.storyAsset(item.slot, this.storyVersion);
      filename = source?.file_name || `${item.slot.slot_name || 'Story'}_v${this.storyVersion || 1}`;
    } else {
      source = item.image;
      filename = item.image.file_name || 'Bild';
    }

    if (!source || (!source.file_path && !source.file_url)) {
      window.toastSystem?.show('Kein Inhalt zum Herunterladen.', 'error');
      return;
    }
    downloadMediaAsset(source, filename);
  }

  _buildVideoFilename(asset, video) {
    const base = (video?.video_name || video?.thema || 'Video').trim();
    const parts = [base];
    if (asset?.version_number) parts.push(`v${asset.version_number}`);
    if (asset?.variant_name) parts.push(asset.variant_name);
    const path = asset?.file_path || video?.currentAsset?.file_path || video?.file_url || '';
    const extMatch = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(path);
    const ext = extMatch ? `.${extMatch[1]}` : '.mp4';
    return `${parts.join('_')}${ext}`;
  }

  async _saveFeedback(textarea) {
    const videoId = textarea.dataset.id;
    const field = textarea.dataset.field;
    await this.table.handleFieldUpdate(textarea);

    const gridTextarea = document.querySelector(
      `.kooperation-video-grid [data-entity="video"][data-id="${videoId}"][data-field="${field}"]`
    );
    if (gridTextarea && gridTextarea !== textarea) {
      gridTextarea.value = textarea.value;
      // Programmatische Wertaenderung loest kein input-Event aus -> Reihe neu angleichen.
      this.table._rowHeightSync?.schedule();
    }
  }
}
