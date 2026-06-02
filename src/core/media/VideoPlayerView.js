// VideoPlayerView
// Reines Rendering des Player-Bodys (Stage, Auswahl-Selects, Feedback, Nav)
// sowie der Fallback-Ansicht fuer nicht abspielbare Formate. Liest den State
// ueber einen schlanken Kontext (ctx = Player), erzeugt nur HTML-Strings.

import { escapeHtml, toRawDropboxUrl } from '../VideoUploadUtils.js';
import { DOWNLOAD_ICON } from './downloadMediaAsset.js';
import {
  formatVideoFeedbackValue,
  normalizeVideoFeedbackComments
} from '../VideoFeedbackBuckets.js';
import { ICON_PLAY, ICON_VOLUME, ICON_FS, ICON_CLOSE } from './mediaPlayerIcons.js';

// Container-Formate, die im Browser haeufig nicht abspielbar sind (v. a. .mov).
const RISKY_VIDEO_EXT = /\.(mov|avi|mkv|m4v)(?:\?|#|$)/i;

export class VideoPlayerView {
  constructor(ctx) {
    this.ctx = ctx;
  }

  renderBody() {
    const item = this.ctx.current;
    if (!item) return '<div class="media-viewer-empty">Kein Inhalt gefunden.</div>';

    const koop = item.koop;
    const creatorName = `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim() || 'Unbekannt';
    const counter = `${this.ctx.index + 1} / ${this.ctx.items.length}`;

    let title;
    let controls;
    if (item.type === 'video') {
      title = item.video.video_name || item.video.thema || 'Video';
      controls = `${this.renderVersionSelect()}${this.renderVariantSelect()}`;
    } else if (item.type === 'story') {
      title = item.slot.slot_name || `Story ${item.slot.slot_index || ''}`.trim();
      controls = this.renderStoryVersionSelect();
    } else {
      title = item.image.file_name || 'Bild';
      controls = this.renderThumbs();
    }

    const hasPrev = this.ctx.index > 0;
    const hasNext = this.ctx.index < this.ctx.items.length - 1;

    return `
      <div class="vpl-stage media-viewer-stage">${this.renderStageInner()}</div>
      <div class="vpl-panel">
        <div class="vpl-panel-head">
          <div class="vpl-info">
            <div class="media-viewer-title">${escapeHtml(title)}</div>
            <div class="media-viewer-sub">${escapeHtml(creatorName)} &middot; ${escapeHtml(koop.name || '')} &middot; ${counter}</div>
          </div>
          <div class="vpl-selects">${controls}</div>
        </div>
        <div class="vpl-feedback-wrap">${this.renderFeedback()}</div>
        <div class="vpl-nav">
          <button type="button" class="secondary-btn vpl-download">${DOWNLOAD_ICON}<span>Download</span></button>
          <button type="button" class="secondary-btn vpl-prev" ${hasPrev ? '' : 'disabled'}>Zurück</button>
          <button type="button" class="primary-btn vpl-next" ${hasNext ? '' : 'disabled'}>Weiter</button>
        </div>
      </div>
    `;
  }

  renderStageInner() {
    if (this.ctx.loading) {
      return `<div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Wird geladen...</span></div>`;
    }

    const item = this.ctx.current;
    if (item?.type === 'bild') {
      if (this.ctx.src) {
        return `<img class="vpl-image" src="${escapeHtml(this.ctx.src)}" alt="${escapeHtml(item.image.file_name || 'Bild')}">`;
      }
      return `<div class="media-viewer-empty"><span>Bild kann nicht geladen werden.</span></div>`;
    }

    if (this.ctx.src) {
      const previewSrc = this.ctx.src + (this.ctx.src.includes('#') ? '' : '#t=0.1');
      return `
        <video class="vpl-video" playsinline preload="auto" src="${escapeHtml(previewSrc)}"></video>
        <div class="vpl-controls">
          <button type="button" class="vpl-play" aria-label="Abspielen">${ICON_PLAY}</button>
          <span class="vpl-time">0:00 / 0:00</span>
          <input class="vpl-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Position">
          <button type="button" class="vpl-mute" aria-label="Stummschalten">${ICON_VOLUME}</button>
          <button type="button" class="vpl-fs" aria-label="Vollbild">${ICON_FS}</button>
        </div>
        ${this._formatHint()}`;
    }

    const folderUrl = item?.video?.folder_url;
    return `
      <div class="media-viewer-empty">
        <span>Kein Video hochgeladen.</span>
        ${folderUrl ? `<a class="media-viewer-fallback-link" href="${escapeHtml(folderUrl)}" target="_blank" rel="noopener">Ordner oeffnen</a>` : ''}
      </div>`;
  }

  // Proaktiver Hinweis bei riskanten Containerformaten (z. B. .mov), die in
  // manchen Browsern nicht abspielen – ohne den Player zu blockieren.
  _formatHint() {
    const path = this.ctx.currentMediaPath?.() || '';
    if (!RISKY_VIDEO_EXT.test(path)) return '';
    return `<div class="vpl-format-hint">
        <span class="vpl-format-hint-text">Falls das Video nicht abspielt, lädt es ggf. nur in einem anderen Browser oder per Download (z.&nbsp;B. .mov in Chrome/Firefox).</span>
        <button type="button" class="vpl-format-hint-close" aria-label="Hinweis schließen">${ICON_CLOSE}</button>
      </div>`;
  }

  // Fallback, wenn das Video-Element einen Fehler wirft (Codec/Container).
  renderUnplayable(link) {
    return `
      <div class="media-viewer-empty media-viewer-unplayable">
        <span>Dieses Format kann im Browser nicht abgespielt werden.</span>
        <div class="media-viewer-fallback-actions">
          <button type="button" class="primary-btn vpl-fallback-download">${DOWNLOAD_ICON}<span>Herunterladen</span></button>
          ${link ? `<a class="secondary-btn media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern öffnen</a>` : ''}
        </div>
      </div>`;
  }

  renderVersionSelect() {
    const item = this.ctx.current;
    const comments = this.ctx.table.videoComments[item.video.id];
    const versions = this.ctx.assetLoader.combinedVersions(this.ctx.assets, comments);
    if (versions.length <= 1) return '';
    const options = versions.map(ver =>
      `<option value="${ver}" ${ver === this.ctx.selectedVersion ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <select class="player-version-select">${options}</select>
      </div>`;
  }

  renderVariantSelect() {
    const variants = this.ctx.assetLoader.variantsForVersion(this.ctx.assets, this.ctx.selectedVersion);
    if (variants.length <= 1) return '';
    const options = variants.map(a =>
      `<option value="${a.id}" ${a.id === this.ctx.selectedAssetId ? 'selected' : ''}>${escapeHtml(a.variant_name || 'Variante')}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <label>Variante</label>
        <select class="player-variant-select">${options}</select>
      </div>`;
  }

  renderStoryVersionSelect() {
    const versions = this.ctx.storyVersions(this.ctx.current.slot);
    if (versions.length <= 1) return '';
    const options = versions.map(ver =>
      `<option value="${ver}" ${ver === this.ctx.storyVersion ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
    ).join('');
    return `
      <div class="media-viewer-control">
        <select class="story-version-select">${options}</select>
      </div>`;
  }

  renderThumbs() {
    const images = this.ctx.current.koop._bilder || [];
    if (images.length <= 1) return '';
    const currentId = this.ctx.current.image.id;
    const thumbs = images.map(img => {
      const itemIndex = this.ctx.items.findIndex(it => it.type === 'bild' && it.image.id === img.id);
      const url = toRawDropboxUrl(img.file_url) || '';
      return `<button type="button" class="media-gallery-thumb ${img.id === currentId ? 'active' : ''}" data-item-index="${itemIndex}">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(img.file_name || '')}" loading="lazy">
      </button>`;
    }).join('');
    return `<div class="media-gallery-thumbs">${thumbs}</div>`;
  }

  renderFeedback() {
    const ft = this.ctx.feedbackTarget();
    if (!ft) {
      return `
        <div class="media-viewer-feedback">
          <div class="media-viewer-feedback-hint">Kein Video vorhanden &ndash; Feedback nicht möglich.</div>
        </div>`;
    }

    const { videoId, target } = ft;
    if (!target.slot) return '';

    const comments = normalizeVideoFeedbackComments(this.ctx.table.videoComments[videoId]);
    const ownValue = formatVideoFeedbackValue(comments, target.slot.bucket);
    const counterpartValue = target.counterpartSlot
      ? formatVideoFeedbackValue(comments, target.counterpartSlot.bucket)
      : '';

    const editable = !target.readonly && this.ctx.table.isFieldEditableForUser('video', target.slot.field);

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
}
