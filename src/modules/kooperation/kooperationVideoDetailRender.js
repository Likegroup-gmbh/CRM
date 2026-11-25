// kooperationVideoDetailRender.js
// HTML der Video-Detailseite (KooperationVideoDetail): Info-Tab, Video-Versionen, Feedback-Slots.
// Reine Funktionen.

import {
  groupVideoFeedbackComments,
  formatVideoFeedbackValue,
  VIDEO_FEEDBACK_FIELDS
} from '../../core/VideoFeedbackBuckets.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { dateiLinkHtml } from '../../core/ablage/ablageOrdnerLink.js';

const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');

export function assetVersionsHtml(assets, canEdit) {
  if (!assets || assets.length === 0) {
    return renderEmptyState({ icon: 'folder', title: 'Keine Assets vorhanden' });
  }

  const sortedAssets = [...assets].sort((a, b) =>
    (b.version_number || 0) - (a.version_number || 0)
  );

  const rows = sortedAssets.map(asset => `
      <tr>
        <td>
          <span class="koop-version-label">V${asset.version_number || 1}</span>
        </td>
        <td>${asset.description ? safe(asset.description) : '—'}</td>
        <td>${fmtDateTime(asset.created_at)}</td>
        <td>
          ${asset.is_current
            ? '<span class="status-badge status-abgeschlossen">Aktuell</span>'
            : '<span class="status-badge status-produktion">Archiv</span>'}
        </td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_asset">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('dots-vertical-filled')}
            </button>
            <div class="actions-dropdown">
              ${dateiLinkHtml({ asset, typ: 'video', inhalt: `${icon('eye')} Anzeigen`, klasse: 'action-item' })}
              ${!asset.is_current && canEdit ? `
              <a href="#" class="action-item set-current-version" data-asset-id="${asset.id}">
                ${icon('check-circle')}
                Als aktuell markieren
              </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `).join('');

  return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Beschreibung</th>
              <th>Hochgeladen am</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
}

function infoTabHtml(v, canEdit) {
  return `
        <div class="tab-pane active" id="tab-info">
          <div class="detail-card">
            <h3>Informationen</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Content-Art</label><span>${safe(v.content_art || '-')}</span></div>
              <div class="detail-item"><label>Position</label><span>${v.position || '-'}</span></div>
              <div class="detail-item"><label>Status</label>
                <span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span>
              </div>
              <div class="detail-item"><label>Erstellt</label><span>${fmtDateTime(v.created_at)}</span></div>
            </div>
            ${canEdit ? `
            <div class="form-inline koop-video-status-row">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input koop-video-status-select">
                <option value="produktion" ${v.status !== 'abgeschlossen' ? 'selected' : ''}>Produktion</option>
                <option value="abgeschlossen" ${v.status === 'abgeschlossen' ? 'selected' : ''}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button>
            </div>` : ''}
          </div>
        </div>`;
}

function feedbackSlotsHtml(comments, videoId) {
  // Nur aktive (nicht soft-geloeschte) Kommentare als Slot-Wert anzeigen.
  const grouped = groupVideoFeedbackComments((comments || []).filter(c => !c.deleted_at));
  const isKunde = window.isKunde?.() || false;
  return VIDEO_FEEDBACK_FIELDS.map(slot => {
    const value = formatVideoFeedbackValue(grouped, slot.bucket);
    const readonly = isKunde && slot.feedback_typ === 'cj';
    return `
            <div class="detail-card feedback-status-host">
              <h3>${slot.label}</h3>
              <textarea class="form-input video-feedback-slot"
                data-entity="video" data-id="${videoId}" data-field="${slot.field}"
                rows="4" ${readonly ? 'readonly' : ''}
                placeholder="${readonly ? 'Nur Lesezugriff für deine Rolle.' : 'Feedback eingeben…'}">${safe(value)}</textarea>
            </div>`;
  }).join('');
}

/** Ganze Seite; Uploads laufen über den VideoUploadDrawer (Knopf #btn-video-upload). */
export function videoDetailHtml({ video, comments, assets, videoId, canEdit, canUpload }) {
  const v = video || {};
  return `
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="info">
          Informationen
        </button>
        <button class="tab-button" data-tab="videos">
          Videos & Feedback
        </button>
      </div>

      <div class="tab-content">
        ${infoTabHtml(v, canEdit)}

        <div class="tab-pane" id="tab-videos">
          <div class="detail-card">
            <h3>Video-Versionen</h3>
            ${assetVersionsHtml(assets, canEdit)}
            ${canUpload ? `
            <div class="koop-asset-upload-section">
              <button type="button" id="btn-video-upload" class="mdc-btn mdc-btn--create">
                ${icon('upload')}
                <span class="mdc-btn__label">Video hochladen</span>
              </button>
            </div>` : ''}
          </div>

          <div class="detail-grid">
            ${feedbackSlotsHtml(comments, videoId)}
          </div>
        </div>
      </div>
    `;
}
