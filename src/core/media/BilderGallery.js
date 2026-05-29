import { MediaLightbox } from './MediaLightbox.js';
import { toRawDropboxUrl, escapeHtml } from '../VideoUploadUtils.js';
import { resolveStreamUrl } from './mediaSrc.js';

const BILDER_SELECT = 'id, file_url, file_path, file_name, created_at';

const toDisplayUrl = toRawDropboxUrl;

/**
 * Bilder-Galerie als Lightbox. Bilder haengen an der Kooperation
 * (kooperation_bilder_asset), flache Liste ohne Versionen/Feedback.
 * Grid/Thumbnails + Swipe (Prev/Next).
 */
export class BilderGallery {
  constructor(table) {
    this.table = table;
    this.lightbox = new MediaLightbox();
    this.images = [];
    this.index = 0;
    this.loading = false;
    this.koop = null;
    this._srcCache = new Map();
  }

  async open(kooperationId) {
    this.koop = this.table.kooperationen.find(k => k.id === kooperationId) || null;
    this.images = [];
    this.index = 0;
    this.loading = true;

    this.lightbox.open({
      className: 'bilder-gallery-lightbox',
      onPrev: () => this._navigate(-1),
      onNext: () => this._navigate(1),
      hasPrev: () => this.index > 0,
      hasNext: () => this.index < this.images.length - 1,
      renderBody: () => this._renderBody(),
      onMount: (root) => this._mount(root),
    });

    await this._loadImages(kooperationId);
  }

  async _loadImages(kooperationId) {
    try {
      const { data, error } = await window.supabase
        .from('kooperation_bilder_asset')
        .select(BILDER_SELECT)
        .eq('kooperation_id', kooperationId)
        .order('file_name', { ascending: true });
      if (error) throw error;
      this.images = data || [];
    } catch (err) {
      console.warn('Bilder konnten nicht geladen werden:', err);
      this.images = [];
    }
    this.loading = false;
    this.lightbox.update();
    await this._resolveSrc();
  }

  get current() {
    return this.images[this.index] || null;
  }

  _navigate(dir) {
    const next = this.index + dir;
    if (next < 0 || next >= this.images.length) return;
    this.index = next;
    this.lightbox.update();
    this._resolveSrc();
  }

  async _resolveSrc() {
    const img = this.current;
    if (!img) return;
    let src = this._srcCache.get(img.id);
    if (!src) {
      src = await resolveStreamUrl({ file_path: img.file_path || null, file_url: img.file_url || null });
      this._srcCache.set(img.id, src);
    }
    if (this.current?.id !== img.id) return;
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (stage) {
      stage.innerHTML = src
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(img.file_name || 'Bild')}">`
        : `<div class="media-viewer-empty"><span>Bild kann nicht geladen werden.</span></div>`;
    }
  }

  _renderBody() {
    const title = this.koop?.name || 'Bilder';
    if (this.loading) {
      return `
        <div class="media-viewer-header"><div class="media-viewer-title">${escapeHtml(title)} &ndash; Bilder</div></div>
        <div class="media-viewer-stage"><div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Bilder werden geladen...</span></div></div>`;
    }
    if (this.images.length === 0) {
      return `
        <div class="media-viewer-header"><div class="media-viewer-title">${escapeHtml(title)} &ndash; Bilder</div></div>
        <div class="media-viewer-stage"><div class="media-viewer-empty"><span>Keine Bilder hochgeladen.</span></div></div>`;
    }

    const img = this.current;
    const counter = `${this.index + 1} / ${this.images.length}`;

    return `
      <div class="media-viewer-header">
        <div class="media-viewer-title">${escapeHtml(img.file_name || 'Bild')}</div>
        <div class="media-viewer-sub">${escapeHtml(title)} &middot; ${counter}</div>
      </div>
      <div class="media-viewer-stage"><div class="media-viewer-loading"><div class="media-viewer-spinner"></div></div></div>
      ${this._renderThumbs()}
    `;
  }

  _renderThumbs() {
    if (this.images.length <= 1) return '';
    const thumbs = this.images.map((img, i) => {
      const url = this._srcCache.get(img.id) || toDisplayUrl(img.file_url);
      return `<button type="button" class="media-gallery-thumb ${i === this.index ? 'active' : ''}" data-index="${i}">
        <img src="${escapeHtml(url || '')}" alt="${escapeHtml(img.file_name || '')}" loading="lazy">
      </button>`;
    }).join('');
    return `<div class="media-gallery-thumbs">${thumbs}</div>`;
  }

  _mount(root) {
    root.querySelectorAll('.media-gallery-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        this.index = Number(btn.dataset.index);
        this.lightbox.update();
        this._resolveSrc();
      });
    });
  }
}
