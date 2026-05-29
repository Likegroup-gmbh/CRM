import { MediaLightbox } from './MediaLightbox.js';
import { escapeHtml, toRawDropboxUrl } from '../VideoUploadUtils.js';
import { resolveStreamUrl, prefetchStreamUrl } from './mediaSrc.js';
import { downloadMediaAsset, DOWNLOAD_ICON } from './downloadMediaAsset.js';
import {
  resolveVideoFeedbackTarget,
  formatVideoFeedbackValue,
  normalizeVideoFeedbackComments
} from '../VideoFeedbackBuckets.js';

const ASSET_SELECT = 'id, video_id, file_url, file_path, file_name, version_number, variant_name, description, is_current, created_at';

const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
const ICON_VOLUME = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z"/></svg>`;
const ICON_MUTE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm18.3-1.3-1.4-1.4L17 10.2 14.1 7.3l-1.4 1.4L15.6 12l-2.9 2.9 1.4 1.4L17 13.4l2.9 2.9 1.4-1.4L18.4 12z"/></svg>`;
const ICON_FS = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
const ICON_FS_EXIT = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Durchgaengiger Medien-Viewer fuer die Kampagnen-Tabelle.
 * - Eine flache Item-Liste ueber ALLE gefilterten Kooperationen: pro Koop
 *   Videos -> Storys -> Bilder (nur vorhandene Inhalte).
 * - Prev/Next blaettert durchgaengig ueber alle Typen.
 * - Video & Story nutzen denselben Custom-Player; Bilder werden als <img> gezeigt.
 * - Rechtes Panel mit Feedback fuer alle Typen (kooperation_video_comment):
 *     Video  -> eigenes Video, Runde aus Feedbackschleife
 *     Story  -> Video der Story (slot.video_id), Runde aus Story-Version
 *     Bild   -> erstes Video der Koop, Runde 1
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
    this._assetCache = new Map();
    this._prefetchContainer = null;
    this._bytePrefetch = new Map();
    this._preconnected = false;
  }

  _hasUpload(video) {
    return !!(video.file_url || video.link_content || video.asset_url || video.currentAsset?.file_path);
  }

  // Bilder aller gefilterten Koops sicherstellen (Preload kann fehlen/leer sein).
  // Garantiert, dass die durchgaengige Liste auch Bilder enthaelt.
  async _ensureBilderLoaded() {
    const koops = this.table.renderer.getFilteredKooperationen() || [];
    const missing = koops.filter(k => k.bilder_folder_url && !Array.isArray(k._bilder));
    if (missing.length === 0) return;

    try {
      const ids = missing.map(k => k.id);
      const { data, error } = await window.supabase
        .from('kooperation_bilder_asset')
        .select('id, kooperation_id, file_url, file_path, file_name, created_at')
        .in('kooperation_id', ids)
        .order('file_name', { ascending: true });
      if (error) throw error;

      const byKoop = {};
      for (const img of (data || [])) {
        if (!byKoop[img.kooperation_id]) byKoop[img.kooperation_id] = [];
        byKoop[img.kooperation_id].push(img);
      }
      for (const k of missing) k._bilder = byKoop[k.id] || [];
    } catch (err) {
      console.warn('Bilder konnten nicht geladen werden:', err);
      for (const k of missing) k._bilder = Array.isArray(k._bilder) ? k._bilder : [];
    }
  }

  _buildItems() {
    const koops = this.table.renderer.getFilteredKooperationen() || [];
    const items = [];
    for (const koop of koops) {
      const videos = this.table.videos[koop.id] || [];
      for (const video of videos) {
        if (this._hasUpload(video)) items.push({ type: 'video', video, koop });
      }
      for (const video of videos) {
        const slots = video.story_slots || [];
        for (const slot of slots) {
          if ((slot.assets || []).length > 0) items.push({ type: 'story', slot, video, koop });
        }
      }
      const bilder = koop._bilder || [];
      for (const image of bilder) {
        items.push({ type: 'bild', image, koop });
      }
    }
    this.items = items;
  }

  get current() {
    return this.items[this.index] || null;
  }

  // ---- Public Einstiegspunkte ----

  openVideo(videoId, kooperationId) {
    return this._open([
      it => it.type === 'video' && it.video.id === videoId && it.koop.id === kooperationId,
      it => it.type === 'video' && it.video.id === videoId,
    ]);
  }

  openStory(videoId, kooperationId) {
    return this._open([
      it => it.type === 'story' && it.video?.id === videoId && it.koop.id === kooperationId,
      it => it.type === 'story' && it.koop.id === kooperationId,
      it => it.koop.id === kooperationId,
    ]);
  }

  openBilder(kooperationId) {
    return this._open([
      it => it.type === 'bild' && it.koop.id === kooperationId,
      it => it.koop.id === kooperationId,
    ]);
  }

  async _open(finders) {
    this._addPreconnect();
    await this._ensureBilderLoaded();
    this._buildItems();

    let idx = -1;
    for (const f of finders) {
      idx = this.items.findIndex(f);
      if (idx >= 0) break;
    }
    this.index = idx >= 0 ? idx : 0;
    this._resetItemState();

    // Warm-Start: Temp-Link des angeklickten Mediums sofort anfragen
    const lookup = this._currentLookup();
    if (lookup.file_path || lookup.file_url) prefetchStreamUrl(lookup);

    this.lightbox.open({
      className: 'video-player-lightbox media-split-lightbox',
      onPrev: () => this._navigate(-1),
      onNext: () => this._navigate(1),
      hasPrev: () => this.index > 0,
      hasNext: () => this.index < this.items.length - 1,
      renderBody: () => this._renderBody(),
      onMount: (root) => this._mount(root),
      onClose: () => this._cleanupPrefetch(),
    });

    await this._loadCurrent();
  }

  _addPreconnect() {
    if (this._preconnected) return;
    this._preconnected = true;
    ['https://dl.dropboxusercontent.com', 'https://www.dropbox.com'].forEach(href => {
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = href;
      l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    });
  }

  _navigate(dir) {
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

  async _loadAssets(videoId) {
    if (this._assetCache.has(videoId)) return this._assetCache.get(videoId);
    let assets = [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select(ASSET_SELECT)
        .eq('video_id', videoId)
        .order('version_number', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      assets = data || [];
    } catch (err) {
      console.warn('Video-Assets konnten nicht geladen werden:', err);
      assets = [];
    }
    this._assetCache.set(videoId, assets);
    return assets;
  }

  _applyDefaultSelection() {
    const versions = this._versions();
    if (versions.length > 0) {
      this.selectedVersion = versions[versions.length - 1];
      const variants = this._variantsForVersion(this.selectedVersion);
      const currentAsset = variants.find(a => a.is_current) || variants[0];
      this.selectedAssetId = currentAsset?.id || null;
    } else {
      this.selectedVersion = null;
      this.selectedAssetId = null;
    }
  }

  async _loadCurrent() {
    const item = this.current;
    if (!item) return;

    if (item.type === 'video') {
      const videoId = item.video.id;
      if (this._assetCache.has(videoId)) {
        this.assets = this._assetCache.get(videoId);
        this.loading = false;
        this._applyDefaultSelection();
        this.lightbox.update();
        await this._resolveSrc();
        return;
      }
      this.assets = [];
      this.loading = true;
      this.lightbox.update();
      const assets = await this._loadAssets(videoId);
      if (this.current?.video?.id !== videoId) return;
      this.assets = assets;
      this.loading = false;
      this._applyDefaultSelection();
      this.lightbox.update();
      await this._resolveSrc();
      return;
    }

    if (item.type === 'story') {
      const versions = this._storyVersions(item.slot);
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

  // ---- Video-Versionen/Varianten ----

  _versions() {
    return [...new Set(this.assets.map(a => a.version_number || 1))].sort((a, b) => a - b);
  }

  _variantsForVersion(version) {
    return this.assets.filter(a => (a.version_number || 1) === version);
  }

  _selectedAsset() {
    return this.assets.find(a => a.id === this.selectedAssetId) || null;
  }

  // ---- Story-Versionen ----

  _storyVersions(slot) {
    if (slot.existingVersions?.length) return slot.existingVersions;
    if (slot.versions?.length) return slot.versions;
    return [...new Set((slot.assets || []).map(a => a.version_number || 1))].sort((a, b) => a - b);
  }

  _storyAsset(slot, version) {
    const variants = (slot.assets || []).filter(a => (a.version_number || 1) === version);
    return variants.find(a => a.is_current) || variants[0] || null;
  }

  // ---- Quelle aufloesen ----

  _currentLookup() {
    const item = this.current;
    if (!item) return { file_path: null, file_url: null };
    if (item.type === 'video') {
      const asset = this._selectedAsset();
      if (asset) return { file_path: asset.file_path || null, file_url: asset.file_url || null };
      const v = item.video;
      return {
        file_path: v.currentAsset?.file_path || null,
        file_url: v.file_url || v.link_content || v.asset_url || null
      };
    }
    if (item.type === 'story') {
      const a = this._storyAsset(item.slot, this.storyVersion);
      return { file_path: a?.file_path || null, file_url: a?.file_url || null };
    }
    return { file_path: item.image.file_path || null, file_url: item.image.file_url || null };
  }

  async _resolveSrc() {
    const token = ++this._srcToken;
    const resolved = await resolveStreamUrl(this._currentLookup());

    if (token !== this._srcToken) return; // veraltet
    this.src = resolved;
    this.fallbackUrl = resolved;
    this.loading = false;
    this._applySrc();
    this._prefetchNeighborAssets();
    this._scheduleNeighborPrefetch();
  }

  _prefetchNeighborAssets() {
    [this.index - 1, this.index + 1].forEach(i => {
      const e = this.items[i];
      if (e && e.type === 'video' && !this._assetCache.has(e.video.id)) {
        this._loadAssets(e.video.id).catch(() => {});
      }
    });
  }

  _scheduleNeighborPrefetch() {
    const token = this._srcToken;
    const stage = this.lightbox?.contentEl?.querySelector('.media-viewer-stage');
    const video = stage?.querySelector('.vpl-video');
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      if (token === this._srcToken) this._prefetchNeighbors();
    };
    if (video) {
      if (video.readyState >= 2) run();
      else video.addEventListener('loadeddata', run, { once: true });
    }
    setTimeout(run, 2500);
  }

  _prefetchNeighbors() {
    const lookups = [this.index - 1, this.index + 1]
      .map(i => this.items[i])
      .filter(Boolean)
      .map(e => {
        if (e.type === 'video') {
          return {
            file_path: e.video.currentAsset?.file_path || null,
            file_url: e.video.file_url || e.video.link_content || e.video.asset_url || null
          };
        }
        if (e.type === 'story') {
          const versions = this._storyVersions(e.slot);
          const a = this._storyAsset(e.slot, versions[versions.length - 1] || 1);
          return { file_path: a?.file_path || null, file_url: a?.file_url || null };
        }
        return null;
      })
      .filter(Boolean);
    Promise.all(lookups.map(l => resolveStreamUrl(l).catch(() => null)))
      .then(urls => this._prefetchBytes(urls.filter(Boolean)));
  }

  _ensurePrefetchContainer() {
    if (this._prefetchContainer) return;
    const c = document.createElement('div');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(c);
    this._prefetchContainer = c;
  }

  _prefetchBytes(urls) {
    this._ensurePrefetchContainer();
    const keep = new Set(urls);
    for (const [url, el] of this._bytePrefetch) {
      if (!keep.has(url)) {
        el.removeAttribute('src');
        el.load?.();
        el.remove();
        this._bytePrefetch.delete(url);
      }
    }
    for (const url of keep) {
      if (this._bytePrefetch.has(url)) continue;
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.src = url + (url.includes('#') ? '' : '#t=0.1');
      this._prefetchContainer.appendChild(v);
      this._bytePrefetch.set(url, v);
    }
  }

  _cleanupPrefetch() {
    this._bytePrefetch.forEach(el => {
      el.removeAttribute('src');
      el.load?.();
      el.remove();
    });
    this._bytePrefetch.clear();
    this._prefetchContainer?.remove();
    this._prefetchContainer = null;
  }

  _applySrc() {
    if (!this.lightbox.isOpen()) return;
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    stage.innerHTML = this._renderStageInner();
    const videoEl = stage.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('error', () => this._onVideoError(), { once: true });
    }
    this._mountPlayer();
  }

  _mountPlayer() {
    const stage = this.lightbox?.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    const video = stage.querySelector('.vpl-video');
    if (!video || video.dataset.bound === '1') return;
    video.dataset.bound = '1';

    const playBtn = stage.querySelector('.vpl-play');
    const muteBtn = stage.querySelector('.vpl-mute');
    const fsBtn = stage.querySelector('.vpl-fs');
    const seek = stage.querySelector('.vpl-seek');
    const timeEl = stage.querySelector('.vpl-time');

    const setProgress = () => {
      if (seek && Number.isFinite(video.duration) && video.duration > 0) {
        seek.max = video.duration;
        seek.value = video.currentTime;
        seek.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
      }
      if (timeEl) timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    };

    const togglePlay = () => { if (video.paused) video.play(); else video.pause(); };

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('play', () => { if (playBtn) playBtn.innerHTML = ICON_PAUSE; });
    video.addEventListener('pause', () => { if (playBtn) playBtn.innerHTML = ICON_PLAY; });
    video.addEventListener('loadedmetadata', setProgress);
    video.addEventListener('timeupdate', setProgress);

    if (seek) {
      seek.addEventListener('input', () => {
        if (Number.isFinite(video.duration)) {
          video.currentTime = Number(seek.value);
          seek.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted ? ICON_MUTE : ICON_VOLUME;
      });
    }

    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (stage.requestFullscreen) stage.requestFullscreen();
      });
      document.addEventListener('fullscreenchange', () => {
        fsBtn.innerHTML = document.fullscreenElement ? ICON_FS_EXIT : ICON_FS;
      });
    }
  }

  _onVideoError() {
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    const link = this.fallbackUrl || this.src;
    stage.innerHTML = `
      <div class="media-viewer-empty">
        <span>Medium kann nicht eingebettet abgespielt werden.</span>
        ${link ? `<a class="media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern oeffnen</a>` : ''}
      </div>`;
  }

  // ---- Rendering ----

  _renderBody() {
    const item = this.current;
    if (!item) return '<div class="media-viewer-empty">Kein Inhalt gefunden.</div>';

    const koop = item.koop;
    const creatorName = `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim() || 'Unbekannt';
    const counter = `${this.index + 1} / ${this.items.length}`;

    let title;
    let controls;
    if (item.type === 'video') {
      title = item.video.video_name || item.video.thema || 'Video';
      controls = `${this._renderVersionSelect()}${this._renderVariantSelect()}`;
    } else if (item.type === 'story') {
      title = item.slot.slot_name || `Story ${item.slot.slot_index || ''}`.trim();
      controls = this._renderStoryVersionSelect();
    } else {
      title = item.image.file_name || 'Bild';
      controls = this._renderThumbs();
    }

    const hasPrev = this.index > 0;
    const hasNext = this.index < this.items.length - 1;

    return `
      <div class="vpl-stage media-viewer-stage">${this._renderStageInner()}</div>
      <div class="vpl-panel">
        <div class="vpl-panel-head">
          <div class="vpl-info">
            <div class="media-viewer-title">${escapeHtml(title)}</div>
            <div class="media-viewer-sub">${escapeHtml(creatorName)} &middot; ${escapeHtml(koop.name || '')} &middot; ${counter}</div>
          </div>
          <div class="vpl-selects">${controls}</div>
        </div>
        <div class="vpl-feedback-wrap">${this._renderFeedback()}</div>
        <div class="vpl-nav">
          <button type="button" class="secondary-btn vpl-download">${DOWNLOAD_ICON}<span>Download</span></button>
          <button type="button" class="secondary-btn vpl-prev" ${hasPrev ? '' : 'disabled'}>Zurück</button>
          <button type="button" class="primary-btn vpl-next" ${hasNext ? '' : 'disabled'}>Weiter</button>
        </div>
      </div>
    `;
  }

  _renderStageInner() {
    if (this.loading) {
      return `<div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Wird geladen...</span></div>`;
    }

    const item = this.current;
    if (item?.type === 'bild') {
      if (this.src) {
        return `<img class="vpl-image" src="${escapeHtml(this.src)}" alt="${escapeHtml(item.image.file_name || 'Bild')}">`;
      }
      return `<div class="media-viewer-empty"><span>Bild kann nicht geladen werden.</span></div>`;
    }

    if (this.src) {
      const previewSrc = this.src + (this.src.includes('#') ? '' : '#t=0.1');
      return `
        <video class="vpl-video" playsinline preload="auto" src="${escapeHtml(previewSrc)}"></video>
        <div class="vpl-controls">
          <button type="button" class="vpl-play" aria-label="Abspielen">${ICON_PLAY}</button>
          <span class="vpl-time">0:00 / 0:00</span>
          <input class="vpl-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Position">
          <button type="button" class="vpl-mute" aria-label="Stummschalten">${ICON_VOLUME}</button>
          <button type="button" class="vpl-fs" aria-label="Vollbild">${ICON_FS}</button>
        </div>`;
    }

    const folderUrl = item?.video?.folder_url;
    return `
      <div class="media-viewer-empty">
        <span>Kein Video hochgeladen.</span>
        ${folderUrl ? `<a class="media-viewer-fallback-link" href="${escapeHtml(folderUrl)}" target="_blank" rel="noopener">Ordner oeffnen</a>` : ''}
      </div>`;
  }

  _renderVersionSelect() {
    const versions = this._versions();
    if (versions.length === 0) return '';
    const versionOptions = versions.map(ver =>
      `<option value="${ver}" ${ver === this.selectedVersion ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <select class="player-version-select">${versionOptions}</select>
      </div>`;
  }

  _renderVariantSelect() {
    if (this._versions().length === 0) return '';
    const variants = this._variantsForVersion(this.selectedVersion);
    if (variants.length <= 1) return '';
    const variantOptions = variants.map(a =>
      `<option value="${a.id}" ${a.id === this.selectedAssetId ? 'selected' : ''}>${escapeHtml(a.variant_name || 'Variante')}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <label>Variante</label>
        <select class="player-variant-select">${variantOptions}</select>
      </div>`;
  }

  _renderStoryVersionSelect() {
    const versions = this._storyVersions(this.current.slot);
    if (versions.length <= 1) return '';
    const options = versions.map(ver =>
      `<option value="${ver}" ${ver === this.storyVersion ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <select class="story-version-select">${options}</select>
      </div>`;
  }

  _renderThumbs() {
    const images = this.current.koop._bilder || [];
    if (images.length <= 1) return '';
    const currentId = this.current.image.id;
    const thumbs = images.map(img => {
      const itemIndex = this.items.findIndex(it => it.type === 'bild' && it.image.id === img.id);
      const url = toRawDropboxUrl(img.file_url) || '';
      return `<button type="button" class="media-gallery-thumb ${img.id === currentId ? 'active' : ''}" data-item-index="${itemIndex}">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(img.file_name || '')}" loading="lazy">
      </button>`;
    }).join('');
    return `<div class="media-gallery-thumbs">${thumbs}</div>`;
  }

  _feedbackTarget() {
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

  _renderFeedback() {
    const ft = this._feedbackTarget();
    if (!ft) {
      return `
        <div class="media-viewer-feedback">
          <div class="media-viewer-feedback-hint">Kein Video vorhanden &ndash; Feedback nicht möglich.</div>
        </div>`;
    }

    const { videoId, target } = ft;
    if (!target.slot) return '';

    const comments = normalizeVideoFeedbackComments(this.table.videoComments[videoId]);
    const ownValue = formatVideoFeedbackValue(comments, target.slot.bucket);
    const counterpartValue = target.counterpartSlot
      ? formatVideoFeedbackValue(comments, target.counterpartSlot.bucket)
      : '';

    const editable = !target.readonly && this.table.isFieldEditableForUser('video', target.slot.field);

    const counterpartHtml = counterpartValue
      ? `<div class="media-viewer-feedback-context">
           <span class="ctx-label">${escapeHtml(target.counterpartSlot.label)}</span>${escapeHtml(counterpartValue)}
         </div>`
      : '';

    const hint = target.readonly
      ? 'Finale Version &ndash; kein neues Feedback moeglich.'
      : (editable ? '' : 'Nur Lesezugriff fuer deine Rolle.');

    return `
      <div class="media-viewer-feedback">
        <h4>${escapeHtml(target.slot.label)}</h4>
        <textarea
          class="player-feedback-input"
          data-entity="video"
          data-id="${videoId}"
          data-field="${target.slot.field}"
          ${editable ? '' : 'readonly'}
          placeholder="${escapeHtml(target.slot.label)}">${escapeHtml(ownValue)}</textarea>
        ${hint ? `<div class="media-viewer-feedback-hint">${hint}</div>` : ''}
        ${counterpartHtml}
      </div>`;
  }

  // ---- Events ----

  _mount(root) {
    const versionSelect = root.querySelector('.player-version-select');
    if (versionSelect) {
      versionSelect.addEventListener('change', () => {
        this.selectedVersion = Number(versionSelect.value);
        const variants = this._variantsForVersion(this.selectedVersion);
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

    const stageVideo = root.querySelector('.media-viewer-stage video');
    if (stageVideo) {
      stageVideo.addEventListener('error', () => this._onVideoError(), { once: true });
    }
    this._mountPlayer();
  }

  _download() {
    const item = this.current;
    if (!item) return;

    let source = null;
    let filename = null;
    if (item.type === 'video') {
      const asset = this._selectedAsset();
      const v = item.video;
      source = asset || {
        file_path: v.currentAsset?.file_path || null,
        file_url: v.file_url || v.link_content || v.asset_url || null,
      };
      filename = asset?.file_name || this._buildVideoFilename(asset, v);
    } else if (item.type === 'story') {
      source = this._storyAsset(item.slot, this.storyVersion);
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
    }
  }
}
