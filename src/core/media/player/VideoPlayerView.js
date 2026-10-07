// VideoPlayerView
// Reines Rendering des Player-Bodys (Stage, Auswahl-Selects, Feedback, Nav)
// sowie der Fallback-Ansicht fuer nicht abspielbare Formate. Liest den State
// aus der Session, erzeugt nur HTML-Strings.
// host = VideoPlayerLightbox: session, assetLoader, currentMedia(), promote.

import { getAssetDisplayLabel, canPreviewImageAsset } from '../../VideoUploadUtils.js';
import { escapeHtml } from '../../format.js';
import { DOWNLOAD_ICON } from '../downloadMediaAsset.js';
import {
  formatVideoFeedbackValue,
  normalizeVideoFeedbackComments
} from '../../VideoFeedbackBuckets.js';
import { finalStills, stillVersions } from '../../stills/stillAssets.js';
import { ICON_PLAY, ICON_VOLUME, ICON_FS, ICON_CLOSE } from '../mediaPlayerIcons.js';
import { isRiskyFormat, itemLabel, lookupPath } from './mediaIdentity.js';
import { storyVersions, storyFinalVariants } from './selection/story.js';
import { stillImages, stillsForSelectedVersion, currentStillAsset } from './selection/still.js';
import { feedbackTargetFor } from './playerFeedbackTarget.js';

/** <option>-Liste "Feedbackschleife N" (+ "Finale Version"). */
function versionOptions(versions, hasFinal, selected) {
  let options = versions.map(ver =>
    `<option value="${ver}" ${ver === selected ? 'selected' : ''}>Feedbackschleife ${ver}</option>`
  ).join('');
  if (hasFinal) {
    options += `<option value="final" ${selected === 'final' ? 'selected' : ''}>Finale Version</option>`;
  }
  return options;
}

/** Versions-Select; leer, wenn es nichts zu waehlen gibt. */
function versionSelect(cls, versions, hasFinal, selected) {
  if (versions.length + (hasFinal ? 1 : 0) <= 1) return '';
  return `
      <div class="media-viewer-control">
        <select class="${cls}">${versionOptions(versions, hasFinal, selected)}</select>
      </div>`;
}

/** Varianten-Select mit Label; leer bei weniger als zwei Varianten. */
function variantSelect({ cls, label, assets, selectedId, text }) {
  if (assets.length <= 1) return '';
  const options = assets.map(a =>
    `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(text(a))}</option>`
  ).join('');
  return `
      <div class="media-viewer-control">
        <label>${label}</label>
        <select class="${cls}">${options}</select>
      </div>`;
}

export class VideoPlayerView {
  constructor(host) {
    this.host = host;
  }

  get session() {
    return this.host.session;
  }

  renderBody() {
    const s = this.session;
    const item = s.current;
    if (!item) return '<div class="media-viewer-empty">Kein Inhalt gefunden.</div>';

    const koop = item.koop;
    const creatorName = `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim() || 'Unbekannt';
    const counter = `${s.index + 1} / ${s.items.length}`;

    let controls;
    if (item.type === 'video') {
      controls = `${this.renderVersionSelect()}${this.renderVariantSelect()}${this.renderPromoteControl()}`;
    } else if (item.type === 'story') {
      controls = this.renderStoryVersionSelect();
    } else {
      controls = `${this.renderStillVersionSelect()}${this.renderStillVariantSelect()}${this.renderPromoteControl()}`;
    }
    const title = itemLabel(item, item.type === 'bild' ? currentStillAsset(s) : null) + this._typeCounter(item);

    const hasPrev = s.index > 0;
    const hasNext = s.index >= 0 && s.index < s.items.length - 1;

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
          <button type="button" class="mdc-btn mdc-btn--secondary vpl-download">${DOWNLOAD_ICON}<span>Download</span></button>
          <button type="button" class="mdc-btn mdc-btn--secondary vpl-prev" ${hasPrev ? '' : 'disabled'}>Zurück</button>
          <button type="button" class="mdc-btn vpl-next" ${hasNext ? '' : 'disabled'}>Weiter</button>
        </div>
      </div>
    `;
  }

  // Liefert ein " X/Y"-Suffix fuer den Titel: Position/Anzahl der gleichartigen
  // Items (gleicher type, gleicher Creator) in der flachen Medienliste. Leer,
  // wenn es nur ein Medium dieses Typs beim Creator gibt.
  _typeCounter(item) {
    const same = this.session.items.filter(
      it => it.type === item.type && it.koop?.id === item.koop?.id
    );
    const pos = same.indexOf(item) + 1;
    return same.length > 1 ? ` ${pos}/${same.length}` : '';
  }

  renderStageInner() {
    const s = this.session;
    if (s.loading) {
      return `<div class="media-viewer-loading"><div class="media-viewer-spinner"></div><span>Wird geladen...</span></div>`;
    }

    const item = s.current;
    if (item?.type === 'bild') {
      const asset = currentStillAsset(s) || item.image;
      if (!canPreviewImageAsset(asset)) return this.renderImageNotPreviewable(asset);
      if (s.src) {
        return `<img class="vpl-image" src="${escapeHtml(s.src)}" alt="${escapeHtml(getAssetDisplayLabel(asset) || 'Bild')}">`;
      }
      return `<div class="media-viewer-empty"><span>Bild kann nicht geladen werden.</span></div>`;
    }

    if (s.src) {
      const previewSrc = s.src + (s.src.includes('#') ? '' : '#t=0.1');
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

  // Sharing-Links (z. B. SharePoint) lassen sich nicht einbetten: statt eines
  // kaputten Bildes den Grund nennen und den Link extern anbieten.
  renderImageNotPreviewable(asset) {
    const link = asset?.file_url || '';
    return `
      <div class="media-viewer-empty">
        <span>Externer Link &ndash; Vorschau nicht möglich.</span>
        ${link ? `<div class="media-viewer-fallback-actions">
          <a class="mdc-btn mdc-btn--secondary media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern öffnen</a>
        </div>` : ''}
      </div>`;
  }

  // Proaktiver Hinweis bei riskanten Containerformaten (z. B. .mov), die in
  // manchen Browsern nicht abspielen – ohne den Player zu blockieren.
  _formatHint() {
    const path = lookupPath(this.host.currentMedia()?.lookup);
    if (!isRiskyFormat(path)) return '';
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
          <button type="button" class="mdc-btn vpl-fallback-download">${DOWNLOAD_ICON}<span>Herunterladen</span></button>
          ${link ? `<a class="mdc-btn mdc-btn--secondary media-viewer-fallback-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Extern öffnen</a>` : ''}
        </div>
      </div>`;
  }

  renderVersionSelect() {
    const s = this.session;
    const { assetLoader } = this.host;
    const comments = s.table.videoComments[s.current.video.id];
    return versionSelect(
      'player-version-select',
      assetLoader.combinedVersions(s.assets, comments),
      assetLoader.finalVariants(s.assets).length > 0,
      s.video.version
    );
  }

  renderVariantSelect() {
    const s = this.session;
    return variantSelect({
      cls: 'player-variant-select',
      label: 'Variante',
      assets: this.host.assetLoader.variantsForVersion(s.assets, s.video.version),
      selectedId: s.video.assetId,
      text: a => a.variant_name || 'Variante',
    });
  }

  renderStillVersionSelect() {
    const s = this.session;
    const images = stillImages(s);
    return versionSelect(
      'still-version-select',
      stillVersions(images),
      finalStills(images).length > 0,
      s.still.version
    );
  }

  renderStillVariantSelect() {
    const s = this.session;
    return variantSelect({
      cls: 'still-variant-select',
      label: 'Still',
      assets: stillsForSelectedVersion(s),
      selectedId: s.still.assetId,
      text: a => getAssetDisplayLabel(a) || 'Still',
    });
  }

  renderStoryVersionSelect() {
    const s = this.session;
    const slot = s.current.slot;
    const finals = storyFinalVariants(slot);
    const select = versionSelect('story-version-select', storyVersions(slot), finals.length > 0, s.story.version);
    if (!select) return '';
    return select + this.renderStoryFinalVariantSelect(finals);
  }

  // Varianten-Select (9:16 / 4:5 / 1:1) fuer die finale Story-Version
  renderStoryFinalVariantSelect(finals) {
    const s = this.session;
    if (s.story.version !== 'final') return '';
    return variantSelect({
      cls: 'story-final-variant-select',
      label: 'Variante',
      assets: finals,
      selectedId: s.story.finalAssetId || finals[0]?.id,
      text: a => a.variant_name || 'Variante',
    });
  }

  renderPromoteControl() {
    const s = this.session;
    if (s.table?.isKundeRole?.()) return '';
    const item = s.current;
    if (!item || item.type === 'story') return '';
    return this.host.promote.html() || '';
  }

  renderFeedback() {
    const s = this.session;
    const ft = feedbackTargetFor(s);
    if (!ft) {
      return `
        <div class="media-viewer-feedback">
          <div class="media-viewer-feedback-hint">Kein Video vorhanden &ndash; Feedback nicht möglich.</div>
        </div>`;
    }

    const { videoId, target, kind = 'video' } = ft;
    if (target.isFinal) {
      return `
        <div class="media-viewer-feedback">
          <div class="media-viewer-feedback-hint">Finale Version &ndash; kein Feedback m&ouml;glich.</div>
        </div>`;
    }
    if (!target.slot) return '';

    const commentsMap = kind === 'still'
      ? (s.table.stillComments || {})
      : s.table.videoComments;
    const comments = normalizeVideoFeedbackComments(commentsMap[videoId]);
    const ownValue = formatVideoFeedbackValue(comments, target.slot.bucket);
    const counterpartValue = target.counterpartSlot
      ? formatVideoFeedbackValue(comments, target.counterpartSlot.bucket)
      : '';

    const editable = !target.readonly && s.table.isFieldEditableForUser('video', target.slot.field);

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
          data-entity="${kind === 'still' ? 'still' : 'video'}"
          data-id="${videoId}"
          data-field="${target.slot.field}"
          ${editable ? '' : 'readonly'}
          placeholder="${escapeHtml(target.slot.label)}">${escapeHtml(ownValue)}</textarea>
        ${hint ? `<div class="media-viewer-feedback-hint">${hint}</div>` : ''}
        ${counterpartHtml}
      </div>`;
  }
}
