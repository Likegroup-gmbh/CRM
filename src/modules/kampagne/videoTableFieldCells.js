// videoTableFieldCells.js
// Stack-Helfer und einfache Video-Felder der Kampagnen-Video-Tabelle

import { formatVideoFeedbackValue } from '../../core/VideoFeedbackBuckets.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { icon } from '../../core/icons/IconSystem.js';
import { CONTENT_ART_OPTIONS } from '../kooperation/contentArtOptions.js';
import { renderZeitkommentarList } from './videoTableZeitkommentare.js';

const EXTERNAL_LINK_ICON = `${icon('arrow-top-right')}`;

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderVideoFieldStack(videos, fieldRenderer) {
  if (!videos || videos.length === 0) {
    return '<span class="text-muted">-</span>';
  }

  const total = videos.length;
  return `<div class="video-fields-stack">${videos.map((video, index) => {
    const result = fieldRenderer(video, index, total);
    const approvedClass = video.freigabe ? 'video-field-wrapper--approved' : '';
    return `<div class="video-field-wrapper ${approvedClass}" data-video-id="${video.id}">${result}</div>`;
  }).join('')}</div>`;
}

export function renderVideoDatePicker(table, video, fieldName, label) {
  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00');
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  if (!table.isFieldEditableForUser('video', fieldName)) {
    return `<div class="video-deadline-text">${formatDate(video[fieldName])}</div>`;
  }
  const pickerHtml = CustomDatePicker.render({
    id: video.id,
    entity: 'video',
    field: fieldName,
    value: video[fieldName],
    label,
    inputClass: 'video-date-picker-input'
  });
  const displayText = formatDate(video[fieldName]);
  return `<div class="video-date-cell">${pickerHtml}<span class="video-date-display">${displayText}</span></div>`;
}

export function renderExtraKostenInner(koop) {
  return koop.verkaufspreis_zusatzkosten != null && parseFloat(koop.verkaufspreis_zusatzkosten) !== 0
    ? parseFloat(koop.verkaufspreis_zusatzkosten).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    : '—';
}

export function renderVideoNrInner(ctx, video, index) {
  // Bei gefilterter Liste (Suche) echte Position zeigen, nicht index+1 —
  // sonst stuende dort "1/1" statt "2/3".
  return `<div class="video-nr-text">${video.position || index + 1}/${ctx.allVideosCount || ctx.videos.length}</div>`;
}

export function renderVkInner(video) {
  const vk = video.verkaufspreis_netto != null ? parseFloat(video.verkaufspreis_netto) : null;
  return vk != null
    ? `<div class="video-vk-text">${vk.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>`
    : '<div class="video-vk-text">—</div>';
}

export function renderVideoTypInner(video) {
  const art = video.kampagnenart
    ? `<span class="tag tag--kampagne-art">${escapeHtml(video.kampagnenart)}</span>`
    : '—';
  return `<div class="video-typ-text">${art}</div>`;
}

export function renderThemaInner(ctx, video) {
  return `
        <input type="text" class="grid-input stacked-video-input"
          data-entity="video" data-id="${video.id}" data-field="thema"
          ${!ctx.t.isFieldEditableForUser('video', 'thema') ? 'readonly' : ''}
          value="${escapeHtml(video.thema || '')}" placeholder="Thema"/>
      `;
}

export function contentArtOptionsHtml(selectedValue) {
  const options = [...CONTENT_ART_OPTIONS];
  if (selectedValue && !options.includes(selectedValue)) {
    options.unshift(selectedValue);
  }
  const items = options.map(option => {
    const value = escapeHtml(option);
    const selected = selectedValue === option ? ' selected' : '';
    return `<option value="${value}"${selected}>${value}</option>`;
  });
  return ['<option value="">– bitte wählen –</option>', ...items].join('');
}

export function renderOrganicPaidInner(ctx, video) {
  return `
        <select class="grid-select stacked-video-select" 
          data-entity="video" data-id="${video.id}" data-field="content_art"
          ${!ctx.t.isFieldEditableForUser('video', 'content_art') ? 'disabled' : ''}>
          ${contentArtOptionsHtml(video.content_art)}
        </select>
      `;
}

export function renderTelefonInner(ctx) {
  const nummer = ctx.koop.creator?.telefonnummer;
  return nummer
    ? `<a href="tel:${escapeHtml(nummer)}" class="small-text telefon-link">${escapeHtml(nummer)}</a>`
    : '<span class="text-muted">-</span>';
}

export function renderTrackingInner(ctx, video) {
  const versandForVideo = ctx.t.getVersandForVideo(video.id);
  return `
          <input type="text" class="grid-input stacked-video-input" 
            data-entity="versand" 
            data-id="${versandForVideo?.id || 'new'}"
            data-video-id="${video.id}"
            data-kooperation-id="${ctx.koop.id}"
            data-field="tracking_nummer"
            ${!ctx.t.isFieldEditableForUser('versand', 'tracking_nummer') ? 'readonly' : ''}
            value="${escapeHtml(versandForVideo?.tracking_nummer || '')}" 
            placeholder="Tracking Nr."/>
        `;
}

export function renderDrehortInner(ctx, video) {
  return `
        <input type="text" class="grid-input stacked-video-input" 
          data-entity="video" data-id="${video.id}" data-field="drehort"
          ${!ctx.t.isFieldEditableForUser('video', 'drehort') ? 'readonly' : ''}
          value="${escapeHtml(video.drehort || '')}" placeholder="Drehort"/>
      `;
}

export function renderLinkSkriptInner(ctx, video) {
  if (!ctx.t.isFieldEditableForUser('video', 'link_skript')) {
    const url = video.link_skript || '';
    return url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn stacked-video-link-btn" title="Skript öffnen">${EXTERNAL_LINK_ICON}</a>`
      : `<span class="stacked-video-empty">-</span>`;
  }
  return `
          <input type="text" class="grid-input stacked-video-input"
            data-entity="video" data-id="${video.id}" data-field="link_skript"
            value="${escapeHtml(video.link_skript || '')}" placeholder="Link"/>
        `;
}

export function renderCheckboxStackInner(ctx, video, field) {
  return `
        <div class="stacked-video-checkbox-wrapper">
          <input type="checkbox" class="grid-checkbox stacked-video-checkbox"
            data-entity="video" data-id="${video.id}" data-field="${field}"
            ${!ctx.t.isFieldEditableForUser('video', field) ? 'disabled' : ''}
            ${video[field] ? 'checked' : ''}/>
        </div>
      `;
}

export function renderVideoNameInner(ctx, video) {
  return `
        <input type="text" class="grid-input stacked-video-input"
          data-entity="video" data-id="${video.id}" data-field="video_name"
          ${!ctx.t.isFieldEditableForUser('video', 'video_name') ? 'readonly' : ''}
          value="${escapeHtml(video.video_name || '')}" placeholder="Video-Name"/>
      `;
}

// Gemeinsame Auto-Resize-Textarea (Caption, Feedback, Kommentar- und Text-Spalten):
// Hoehe folgt dem Inhalt, Umbruch inklusive gesetzter Zeilenumbrueche, voller Text sichtbar.
export function renderStackedTextarea({ attrs, value, placeholder, readonly, className = '' }) {
  const extra = className ? ` ${className}` : '';
  return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea${extra}" 
          ${attrs}
          ${readonly ? 'readonly' : ''}
          placeholder="${escapeHtml(placeholder)}" rows="1">${escapeHtml(value || '')}</textarea>`;
}

export function renderCaptionInner(ctx, video) {
  return renderStackedTextarea({
    attrs: `data-entity="video" data-id="${video.id}" data-field="caption"`,
    value: video.caption,
    placeholder: 'Caption',
    readonly: !ctx.t.isFieldEditableForUser('video', 'caption')
  });
}

export function renderFeedbackInner(ctx, video, slot) {
  const comments = ctx.t.videoComments[video.id];
  return renderStackedTextarea({
    attrs: `data-entity="video" data-id="${video.id}" data-field="${slot.field}"`,
    value: formatVideoFeedbackValue(comments, slot.bucket),
    placeholder: slot.label,
    readonly: !ctx.t.isFieldEditableForUser('video', slot.field)
  }) + renderZeitkommentarList(ctx.t.zeitkommentare?.[video.id], video, slot);
}
