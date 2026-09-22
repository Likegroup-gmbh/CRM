// videoTableFieldCells.js
// Stack-Helfer und einfache Video-Felder der Kampagnen-Video-Tabelle

import { formatVideoFeedbackValue } from '../../core/VideoFeedbackBuckets.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { renderChipCell, renderPlatformChip, renderStaticChip } from '../../core/components/chipCell.js';
import { liveLinkDotState, LIVE_LINK_TOOLBAR } from './liveLinkCell.js';
import { icon } from '../../core/icons/IconSystem.js';

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

/**
 * Live-Link-Zelle: sichtbar ist nur der Chip ("Reel · @handle") plus ein
 * kleiner Status-Punkt. Die drei Aktionen (Statistiken abrufen, Video
 * oeffnen, Link entfernen) liegen in einer schwebenden Hover-Toolbar, die
 * bei Hover ueber der Zelle erscheint. data-hover-toolbar genuegt dafuer -
 * die Engine bindet global, die Aktionen stehen in liveLinkToolbarConfig.
 *
 * Das Geruest kommt aus chipCell (src/core/components), die Sourcing-Tabelle
 * nutzt dasselbe fuer ihre Instagram-Spalte. Der Chip ist ein Overlay ueber
 * dem Input - dasselbe Muster wie bei den Stats-Zahlen
 * (renderStatsNumberCell): der Input haelt die Roh-URL, beim Fokussieren
 * blendet CSS den Chip aus. Vorher standen Input, Haekchen, Extern-Link und X
 * in einer Flex-Row; der Input wurde dabei zerdrueckt und sprang in der
 * Breite, sobald ein Link gespeichert war.
 */
export function renderLiveLinkCell(table, koop, video) {
  const url = video.link_live || '';
  const handle = koop?.creator?.instagram || koop?.creator?.tiktok || '';
  const chip = renderPlatformChip(url, handle);

  if (!table.isFieldEditableForUser('video', 'link_live')) {
    return renderStaticChip({ href: url, chip, title: 'Video öffnen' })
      || `<span class="stacked-video-empty">-</span>`;
  }

  return renderChipCell({
    toolbar: LIVE_LINK_TOOLBAR,
    id: video.id,
    input: {
      className: 'grid-input stacked-video-input',
      value: url,
      placeholder: 'Reel-Link',
      attrs: {
        'data-entity': 'video',
        'data-id': video.id,
        'data-field': 'link_live',
        'data-live-link-handle': handle
      }
    },
    chip,
    dot: liveLinkDotState(video)
  });
}

/**
 * Views/Likes/Kommentare. Editierbar, weil der Abruf nicht immer greift
 * (Creator ohne Business-Account, Collab-Post unter dem Marken-Handle) -
 * dann traegt man die Zahl von Hand ein.
 *
 * Wie die Follower-Zelle im Sourcing: der Rohwert steckt im Input, darueber
 * liegt die kompakte Anzeige (21,6K / 1,39M). Beim Fokussieren blendet CSS
 * das Overlay aus, editiert wird also immer die exakte Zahl.
 */
export function renderStatsNumberCell(table, video, fieldName, label) {
  const value = video[fieldName];
  const compact = formatCompactNumber(value);
  const exact = formatExactNumber(value);

  if (!table.isFieldEditableForUser('video', fieldName)) {
    return `<div class="video-stats-text" title="${exact}">${compact || '—'}</div>`;
  }

  return `
      <div class="video-stats-cell">
        <input type="text" inputmode="numeric" class="grid-input stacked-video-input cell-number__input"
          data-entity="video" data-id="${video.id}" data-field="${fieldName}" data-value-type="compact-integer"
          value="${value != null ? value : ''}" aria-label="${escapeHtml(label)}"/>
        <span class="cell-number__display" data-number-display title="${exact}">${compact || '—'}</span>
      </div>
    `;
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
  return `<div class="video-typ-text">${escapeHtml(video.kampagnenart || '—')}</div>`;
}

export function renderThemaInner(ctx, video) {
  return `
        <input type="text" class="grid-input stacked-video-input"
          data-entity="video" data-id="${video.id}" data-field="thema"
          ${!ctx.t.isFieldEditableForUser('video', 'thema') ? 'readonly' : ''}
          value="${escapeHtml(video.thema || '')}" placeholder="Thema"/>
      `;
}

export function renderOrganicPaidInner(ctx, video) {
  return `
        <select class="grid-select stacked-video-select" 
          data-entity="video" data-id="${video.id}" data-field="content_art"
          ${!ctx.t.isFieldEditableForUser('video', 'content_art') ? 'disabled' : ''}>
          <option value="">– bitte wählen –</option>
          <option value="Paid" ${video.content_art === 'Paid' ? 'selected' : ''}>Paid</option>
          <option value="Organisch" ${video.content_art === 'Organisch' ? 'selected' : ''}>Organisch</option>
          <option value="Influencer" ${video.content_art === 'Influencer' ? 'selected' : ''}>Influencer</option>
          <option value="Videograph" ${video.content_art === 'Videograph' ? 'selected' : ''}>Videograph</option>
          <option value="Whitelisting" ${video.content_art === 'Whitelisting' ? 'selected' : ''}>Whitelisting</option>
          <option value="Spark-Ad" ${video.content_art === 'Spark-Ad' ? 'selected' : ''}>Spark-Ad</option>
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

export function renderCaptionInner(ctx, video) {
  return `
        <textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
          data-entity="video" data-id="${video.id}" data-field="caption"
          ${!ctx.t.isFieldEditableForUser('video', 'caption') ? 'readonly' : ''}
          placeholder="Caption" rows="1">${escapeHtml(video.caption || '')}</textarea>
      `;
}

export function renderFeedbackInner(ctx, video, slot) {
  const comments = ctx.t.videoComments[video.id];
  const value = formatVideoFeedbackValue(comments, slot.bucket);
  return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
          data-entity="video" data-id="${video.id}" data-field="${slot.field}"
          ${!ctx.t.isFieldEditableForUser('video', slot.field) ? 'readonly' : ''}
          placeholder="${slot.label}" rows="1">${escapeHtml(value)}</textarea>`;
}
