import { MediaLightbox } from './MediaLightbox.js';
import { escapeHtml } from '../VideoUploadUtils.js';
import { resolveStreamUrl } from './mediaSrc.js';

const SLOT_SELECT = 'id, video_id, slot_index, slot_name, created_at';
const ASSET_SELECT = 'id, story_id, video_id, file_url, file_path, file_name, version_number, variant_name, is_current, created_at';

/**
 * Instagram-Style Storys-Viewer: durch die Story-Slots eines Videos blaettern
 * (Prev/Next), pro Slot ein Versions-Dropdown (Feedbackschleife). Kein Feedback.
 */
export class StorysViewer {
  constructor(table) {
    this.table = table;
    this.lightbox = new MediaLightbox();
    this.slots = [];
    this.index = 0;
    this.selectedVersion = null;
    this.loading = false;
    this.src = null;
    this.fallbackUrl = null;
    this._srcToken = 0;
    this.video = null;
    this.koop = null;
  }

  async open(videoId, kooperationId) {
    this.koop = this.table.kooperationen.find(k => k.id === kooperationId) || null;
    const videos = this.table.videos[kooperationId] || [];
    this.video = videos.find(v => v.id === videoId) || null;
    this.index = 0;
    this.selectedVersion = null;
    this.slots = [];
    this.loading = true;

    this.lightbox.open({
      className: 'storys-viewer-lightbox',
      onPrev: () => this._navigate(-1),
      onNext: () => this._navigate(1),
      hasPrev: () => this.index > 0,
      hasNext: () => this.index < this.slots.length - 1,
      renderBody: () => this._renderBody(),
      onMount: (root) => this._mount(root),
    });

    await this._loadSlots(videoId);
  }

  async _loadSlots(videoId) {
    try {
      const [slotsRes, assetsRes] = await Promise.all([
        window.supabase.from('kooperation_story').select(SLOT_SELECT)
          .eq('video_id', videoId).order('slot_index', { ascending: true }),
        window.supabase.from('kooperation_story_asset').select(ASSET_SELECT)
          .eq('video_id', videoId)
      ]);

      const slots = slotsRes.data || [];
      const assets = assetsRes.data || [];
      const byStory = {};
      for (const a of assets) {
        (byStory[a.story_id] = byStory[a.story_id] || []).push(a);
      }

      this.slots = slots.map(slot => {
        const slotAssets = (byStory[slot.id] || []).sort(
          (a, b) => (a.version_number || 1) - (b.version_number || 1)
        );
        const versions = [...new Set(slotAssets.map(a => a.version_number || 1))].sort((x, y) => x - y);
        return { ...slot, assets: slotAssets, versions };
      }).filter(s => s.assets.length > 0);
    } catch (err) {
      console.warn('Story-Slots konnten nicht geladen werden:', err);
      this.slots = [];
    }

    this.loading = false;
    if (this.slots.length > 0) {
      const slot = this.slots[0];
      this.selectedVersion = slot.versions[slot.versions.length - 1];
    }
    this.lightbox.update();
    await this._resolveSrc();
  }

  get currentSlot() {
    return this.slots[this.index] || null;
  }

  _navigate(dir) {
    const next = this.index + dir;
    if (next < 0 || next >= this.slots.length) return;
    this.index = next;
    const slot = this.currentSlot;
    this.selectedVersion = slot.versions[slot.versions.length - 1];
    this.src = null;
    this.lightbox.update();
    this._resolveSrc();
  }

  _selectedAsset() {
    const slot = this.currentSlot;
    if (!slot) return null;
    const variants = slot.assets.filter(a => (a.version_number || 1) === this.selectedVersion);
    return variants.find(a => a.is_current) || variants[0] || null;
  }

  async _resolveSrc() {
    const token = ++this._srcToken;
    const asset = this._selectedAsset();
    const resolved = await resolveStreamUrl({
      file_path: asset?.file_path || null,
      file_url: asset?.file_url || null
    });
    if (token !== this._srcToken) return;
    this.src = resolved;
    this.fallbackUrl = resolved;
    this._applySrc();
  }

  _applySrc() {
    if (!this.lightbox.isOpen()) return;
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    stage.innerHTML = this._renderStageInner();
    const videoEl = stage.querySelector('video');
    if (videoEl) videoEl.addEventListener('error', () => this._onVideoError(), { once: true });
  }

  _onVideoError() {
    const stage = this.lightbox.contentEl?.querySelector('.media-viewer-stage');
    if (!stage) return;
    const link = this.fallbackUrl || this.src;
    stage.innerHTML = `
      <div class="media-viewer-empty">
        <span>Story kann nicht eingebettet abgespielt werden.</span>
        ${link ? `<a class="media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern oeffnen</a>` : ''}
      </div>`;
  }

  _renderBody() {
    const creatorName = `${this.koop?.creator?.vorname || ''} ${this.koop?.creator?.nachname || ''}`.trim() || 'Unbekannt';
    const title = this.video?.video_name || this.video?.thema || 'Storys';

    if (this.loading) {
      return `
        <div class="media-viewer-header">
          <div class="media-viewer-title">${escapeHtml(title)} &ndash; Storys</div>
        </div>
        <div class="media-viewer-stage"><div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Storys werden geladen...</span></div></div>`;
    }

    if (this.slots.length === 0) {
      return `
        <div class="media-viewer-header"><div class="media-viewer-title">${escapeHtml(title)} &ndash; Storys</div></div>
        <div class="media-viewer-stage"><div class="media-viewer-empty"><span>Keine Storys hochgeladen.</span></div></div>`;
    }

    const slot = this.currentSlot;
    const counter = `Story ${this.index + 1} / ${this.slots.length}`;

    return `
      <div class="media-viewer-header">
        <div class="media-viewer-title">${escapeHtml(slot.slot_name || `Story ${slot.slot_index || this.index + 1}`)}</div>
        <div class="media-viewer-sub">${escapeHtml(creatorName)} &middot; ${escapeHtml(this.koop?.name || '')} &middot; ${counter}</div>
      </div>
      <div class="media-viewer-stage">${this._renderStageInner()}</div>
      ${this._renderControls()}
    `;
  }

  _renderStageInner() {
    if (this.loading) {
      return `<div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Story wird geladen...</span></div>`;
    }
    if (this.src) {
      return `<video controls playsinline preload="auto" src="${escapeHtml(this.src)}"></video>`;
    }
    return `<div class="media-viewer-empty"><span>Keine Datei vorhanden.</span></div>`;
  }

  _renderControls() {
    const slot = this.currentSlot;
    if (!slot || slot.versions.length <= 1) return '';
    const options = slot.versions.map(ver =>
      `<option value="${ver}" ${ver === this.selectedVersion ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
    ).join('');
    return `
      <div class="media-viewer-controls">
        <div class="media-viewer-control">
          <label>Feedbackschleife</label>
          <select class="storys-version-select">${options}</select>
        </div>
      </div>`;
  }

  _mount(root) {
    const versionSelect = root.querySelector('.storys-version-select');
    if (versionSelect) {
      versionSelect.addEventListener('change', () => {
        this.selectedVersion = Number(versionSelect.value);
        this.src = null;
        this._resolveSrc();
      });
    }
    const stageVideo = root.querySelector('.media-viewer-stage video');
    if (stageVideo) stageVideo.addEventListener('error', () => this._onVideoError(), { once: true });
  }
}
