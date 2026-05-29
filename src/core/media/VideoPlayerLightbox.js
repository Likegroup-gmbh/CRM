import { MediaLightbox } from './MediaLightbox.js';
import { escapeHtml } from '../VideoUploadUtils.js';
import { resolveStreamUrl, prefetchStreamUrl } from './mediaSrc.js';
import {
  resolveVideoFeedbackTarget,
  formatVideoFeedbackValue,
  normalizeVideoFeedbackComments
} from '../VideoFeedbackBuckets.js';

const ASSET_SELECT = 'id, video_id, file_url, file_path, version_number, variant_name, description, is_current, created_at';

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
 * Eingebetteter Video-Player als Lightbox fuer die Kampagnen-Tabelle.
 * - Zweistufiger Dropdown: Feedbackschleife (version_number) + Variante (variant_name)
 * - Streaming via dropbox-proxy temporary-link (Fallback file_url)
 * - Rollenbasiertes Inline-Feedback (Version->Runde Mapping, V3 read-only)
 * - Prev/Next ueber alle Videos der gefilterten Tabelle
 */
export class VideoPlayerLightbox {
  constructor(table) {
    this.table = table;
    this.lightbox = new MediaLightbox();
    this.flat = [];
    this.index = 0;
    this.assets = [];
    this.selectedVersion = null;
    this.selectedAssetId = null;
    this.loading = false;
    this.src = null;
    this.fallbackUrl = null;
    this._srcToken = 0;
    this._assetCache = new Map();
    this._prefetchContainer = null;
    this._bytePrefetch = new Map();
    this._preconnected = false;
  }

  _hasPlayable(video) {
    return !!(video.file_url || video.link_content || video.asset_url);
  }

  _buildFlatList() {
    const koops = this.table.renderer.getFilteredKooperationen() || [];
    const flat = [];
    for (const koop of koops) {
      const videos = this.table.videos[koop.id] || [];
      for (const video of videos) {
        if (this._hasPlayable(video)) flat.push({ video, koop });
      }
    }
    this.flat = flat;
  }

  get current() {
    return this.flat[this.index] || null;
  }

  async open(videoId, kooperationId) {
    this._addPreconnect();
    this._buildFlatList();
    const idx = this.flat.findIndex(
      e => e.video.id === videoId && e.koop.id === kooperationId
    );
    this.index = idx >= 0 ? idx : Math.max(0, this.flat.findIndex(e => e.video.id === videoId));

    // Warm-Start: Temp-Link des angeklickten Videos sofort anfragen (parallel zur Asset-Query)
    const warm = this.current?.video;
    if (warm) {
      prefetchStreamUrl({
        file_path: warm.currentAsset?.file_path || null,
        file_url: warm.file_url || warm.link_content || warm.asset_url || null
      });
    }

    this.lightbox.open({
      className: 'video-player-lightbox',
      onPrev: () => this._navigate(-1),
      onNext: () => this._navigate(1),
      hasPrev: () => this.index > 0,
      hasNext: () => this.index < this.flat.length - 1,
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
    if (next < 0 || next >= this.flat.length) return;
    this.index = next;

    const videoId = this.current.video.id;
    const cachedAssets = this._assetCache.get(videoId);
    if (cachedAssets) {
      // Flickerfrei: Assets liegen vor -> in EINEM Render fuellen (Selects bleiben sichtbar)
      this.src = null;
      this.fallbackUrl = null;
      this.assets = cachedAssets;
      this.loading = false;
      this._applyDefaultSelection();
      this.lightbox.update();
      this._resolveSrc();
    } else {
      this._resetAssetState();
      this.lightbox.update();
      this._loadCurrent();
    }
  }

  _resetAssetState() {
    this.assets = [];
    this.selectedVersion = null;
    this.selectedAssetId = null;
    this.src = null;
    this.fallbackUrl = null;
    this.loading = true;
  }

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
    // Default: aktuellste Version (max version_number), erste/aktuelle Variante darin
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
    const entry = this.current;
    if (!entry) return;

    const videoId = entry.video.id;
    const cached = this._assetCache.has(videoId);
    // Bei Cache-Hit kein Spinner-Flicker: direkt rendern, Temp-Link liegt i.d.R. schon vor.
    this.loading = !cached;
    this.lightbox.update();

    const assets = await this._loadAssets(videoId);

    // Verworfen falls inzwischen weiternavigiert
    if (this.current?.video.id !== videoId) return;

    this.assets = assets;
    this.loading = false;
    this._applyDefaultSelection();

    this.lightbox.update();
    await this._resolveSrc();
  }

  _versions() {
    return [...new Set(this.assets.map(a => a.version_number || 1))].sort((a, b) => a - b);
  }

  _variantsForVersion(version) {
    return this.assets.filter(a => (a.version_number || 1) === version);
  }

  _selectedAsset() {
    return this.assets.find(a => a.id === this.selectedAssetId) || null;
  }

  async _resolveSrc() {
    const token = ++this._srcToken;
    const asset = this._selectedAsset();
    const video = this.current?.video;

    let lookup;
    if (asset) {
      lookup = { file_path: asset.file_path || null, file_url: asset.file_url || null };
    } else if (video) {
      lookup = {
        file_path: video.currentAsset?.file_path || null,
        file_url: video.file_url || video.link_content || video.asset_url || null
      };
    } else {
      lookup = { file_path: null, file_url: null };
    }

    const resolved = await resolveStreamUrl(lookup);

    if (token !== this._srcToken) return; // veraltet
    this.src = resolved;
    this.fallbackUrl = resolved;
    this._applySrc();
    this._prefetchNeighborAssets();
    this._scheduleNeighborPrefetch();
  }

  // Nachbar-Asset-Metadaten (DB) vorladen -> Navigation rendert Selects flickerfrei.
  _prefetchNeighborAssets() {
    [this.index - 1, this.index + 1].forEach(i => {
      const e = this.flat[i];
      if (e && !this._assetCache.has(e.video.id)) {
        this._loadAssets(e.video.id).catch(() => {});
      }
    });
  }

  // Nachbarn erst vorladen, wenn das aktive Video spielbereit ist -> keine
  // Bandbreiten-Konkurrenz mit dem sichtbaren Video.
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
      if (video.readyState >= 2) run(); // bereits genug gepuffert
      else video.addEventListener('loadeddata', run, { once: true });
    }
    // Fallback, falls loadeddata nicht feuert (Fehler/sehr langsam)
    setTimeout(run, 2500);
  }

  _prefetchNeighbors() {
    const lookups = [this.index - 1, this.index + 1]
      .map(i => this.flat[i])
      .filter(Boolean)
      .map(e => ({
        file_path: e.video.currentAsset?.file_path || null,
        file_url: e.video.file_url || e.video.link_content || e.video.asset_url || null
      }));
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
      // metadata statt auto: nur Header + erstes Frame -> schneller Start/Vorschau
      // beim Navigieren, ohne dem aktiven Video Bandbreite zu stehlen.
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
        <span>Video kann nicht eingebettet abgespielt werden.</span>
        ${link ? `<a class="media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern oeffnen</a>` : ''}
      </div>`;
  }

  // ---- Rendering ----

  _renderBody() {
    const entry = this.current;
    if (!entry) return '<div class="media-viewer-empty">Kein Video gefunden.</div>';

    const v = entry.video;
    const koop = entry.koop;
    const creatorName = `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim() || 'Unbekannt';
    const title = v.video_name || v.thema || 'Video';
    const counter = `${this.index + 1} / ${this.flat.length}`;

    const hasPrev = this.index > 0;
    const hasNext = this.index < this.flat.length - 1;

    return `
      <div class="vpl-stage media-viewer-stage">${this._renderStageInner()}</div>
      <div class="vpl-panel">
        <div class="vpl-panel-head">
          <div class="vpl-info">
            <div class="media-viewer-title">${escapeHtml(title)}</div>
            <div class="media-viewer-sub">${escapeHtml(creatorName)} &middot; ${escapeHtml(koop.name || '')} &middot; ${counter}</div>
          </div>
          <div class="vpl-selects">
            ${this._renderVersionSelect()}
            ${this._renderVariantSelect()}
          </div>
        </div>
        <div class="vpl-feedback-wrap">${this._renderFeedback()}</div>
        <div class="vpl-nav">
          <button type="button" class="secondary-btn vpl-prev" ${hasPrev ? '' : 'disabled'}>Zurück</button>
          <button type="button" class="primary-btn vpl-next" ${hasNext ? '' : 'disabled'}>Weiter</button>
        </div>
      </div>
    `;
  }

  _renderStageInner() {
    if (this.loading) {
      return `<div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Video wird geladen...</span></div>`;
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
    const folderUrl = this.current?.video?.folder_url;
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

  _renderInfo() {
    const asset = this._selectedAsset();
    const desc = asset?.description;
    return `
      <div class="media-viewer-info">
        ${desc ? escapeHtml(desc) : '<span class="media-viewer-info-empty">Keine Beschreibung hinterlegt.</span>'}
      </div>`;
  }

  _renderFeedback() {
    const versions = this._versions();
    const version = this.selectedVersion || (versions.length ? versions[versions.length - 1] : 1);
    const isKunde = this.table.isKundeRole();
    const target = resolveVideoFeedbackTarget(version, isKunde);
    if (!target.slot) return '';

    const videoId = this.current.video.id;
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

    const feedbackInput = root.querySelector('.player-feedback-input:not([readonly])');
    if (feedbackInput) {
      feedbackInput.addEventListener('blur', () => this._saveFeedback(feedbackInput));
    }

    const prevBtn = root.querySelector('.vpl-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this._navigate(-1));
    const nextBtn = root.querySelector('.vpl-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this._navigate(1));

    const stageVideo = root.querySelector('.media-viewer-stage video');
    if (stageVideo) {
      stageVideo.addEventListener('error', () => this._onVideoError(), { once: true });
    }
    this._mountPlayer();
  }

  async _saveFeedback(textarea) {
    const videoId = textarea.dataset.id;
    const field = textarea.dataset.field;
    await this.table.handleFieldUpdate(textarea);

    // Tabellen-Textarea im Grid synchronisieren
    const gridTextarea = document.querySelector(
      `.kooperation-video-grid [data-entity="video"][data-id="${videoId}"][data-field="${field}"]`
    );
    if (gridTextarea && gridTextarea !== textarea) {
      gridTextarea.value = textarea.value;
    }
  }
}
