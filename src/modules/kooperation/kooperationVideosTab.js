// kooperationVideosTab.js
// Videos-Tab der Kooperations-Detailseite. detail = KooperationDetail (videos, kooperationId, sanitize).

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { VIDEO_FEEDBACK_FIELDS } from '../../core/VideoFeedbackBuckets.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ordnerLinkHtml } from '../../core/ablage/ablageOrdnerLink.js';

const euro = (wert) => wert != null
  ? parseFloat(wert).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  : '-';
const datum = (wert) => wert ? new Date(wert).toLocaleDateString('de-DE') : '-';

function feedbackListe(detail, kommentare) {
  if (!kommentare || kommentare.length === 0) return '-';
  return kommentare.map(c => {
    const date = c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '';
    const author = c.author_name || '';
    const text = detail.sanitize(c.text || '');
    return `<div class="fb-line"><span class="fb-meta">${author}${date ? ' • ' + date : ''}</span><div class="fb-text">${text}</div></div>`;
  }).join('');
}

function aktionsMenu(v, { isKunde, isAdmin }) {
  return `
    <div class="actions-dropdown-container" data-entity-type="kooperation_videos">
      <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
        ${icon('dots-vertical-filled')}
      </button>
      <div class="actions-dropdown">
        ${!isKunde ? `
        <div class="action-submenu">
          <a href="#" class="action-item has-submenu" data-submenu="status">
            ${actionsDropdown.getHeroIcon('invoice')}
            <span>Status ändern</span>
          </a>
          <div class="submenu" data-submenu="status">
            <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="produktion" data-id="${v.id}">
              ${actionsDropdown.getStatusIcon('Strategiebriefing')}
              <span>Produktion</span>
              ${(v.status || 'produktion') === 'produktion' ? '<span class="submenu-check">✓</span>' : ''}
            </a>
            <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="abgeschlossen" data-id="${v.id}">
              ${actionsDropdown.getHeroIcon('check')}
              <span>Abgeschlossen</span>
              ${v.status === 'abgeschlossen' ? '<span class="submenu-check">✓</span>' : ''}
            </a>
          </div>
        </div>
        ` : ''}
        <a href="#" class="action-item" data-action="video-view" data-id="${v.id}">
          ${icon('eye-outline', { className: 'size-6' })}
          Details ansehen
        </a>
        ${!isKunde ? `
        <a href="#" class="action-item" data-action="video-edit" data-id="${v.id}">
          ${icon('pencil-square', { className: 'size-6' })}
          Bearbeiten
        </a>
        ` : ''}
        ${isAdmin ? `
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="video-delete" data-id="${v.id}">
          ${icon('trash-alt', { className: 'size-6' })}
          Löschen
        </a>
        ` : ''}
      </div>
    </div>`;
}

function urlZelle(detail, v) {
  const ordner = ordnerLinkHtml({
    url: v.folder_url,
    kooperationId: v.kooperation_id || detail.kooperationId,
    inhalt: 'Ordner öffnen',
    klasse: 'table-link',
  });
  if (ordner) return ordner;
  return v.titel
    ? `<a href="/video/${v.id}" class="table-link" data-table="video" data-id="${v.id}">${detail.sanitize(v.titel)}</a>`
    : '-';
}

function videoZeile(detail, v, rolle) {
  return `
    <tr>
      <td>${v.position || '-'}</td>
      <td>${detail.sanitize(v.kampagnenart || '-')}</td>
      <td>${detail.sanitize(v.content_art || '-')}</td>
      <td>${datum(v.skript_deadline)}</td>
      <td>${datum(v.content_deadline)}</td>
      <td class="text-right">${euro(v.verkaufspreis_netto)}</td>
      ${!rolle.isKunde ? `<td class="text-right">${euro(v.einkaufspreis_netto)}</td>` : ''}
      <td>
        ${urlZelle(detail, v)}
        ${v.currentAsset ? `<span class="version-badge koop-version-badge">V${v.currentAsset.version_number || 1}</span>` : ''}
      </td>
      ${VIDEO_FEEDBACK_FIELDS.map(slot => `<td class="feedback-cell">${feedbackListe(detail, v.feedback?.[slot.bucket])}</td>`).join('')}
      <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
      <td>${aktionsMenu(v, rolle)}</td>
    </tr>`;
}

/** HTML des Videos-Tabs. */
export function renderKooperationVideos(detail) {
  const videos = detail.videos || [];
  if (videos.length === 0) {
    return renderEmptyState({
      icon: 'film',
      title: 'Keine Videos angelegt',
      text: 'Videos werden automatisch beim Erstellen/Bearbeiten der Kooperation generiert.'
    });
  }

  const rolle = { isKunde: !!window.isKunde?.(), isAdmin: !!window.isAdmin?.() };
  const summeVk = videos.reduce((s, v) => s + (parseFloat(v.verkaufspreis_netto) || 0), 0);

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Kampagnenart</th>
            <th>Content Art</th>
            <th>Skript Deadline</th>
            <th>Content Deadline</th>
            <th class="text-right">VK Netto</th>
            ${!rolle.isKunde ? '<th class="text-right">EK Netto</th>' : ''}
            <th>URL</th>
            ${VIDEO_FEEDBACK_FIELDS.map(slot => `<th>${slot.label}</th>`).join('')}
            <th>Status</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>${videos.map(v => videoZeile(detail, v, rolle)).join('')}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="u-text-right fw-semibold">Gesamt VK Netto:</td>
            <td class="text-right fw-semibold">${euro(summeVk)}</td>
            <td colspan="${!rolle.isKunde ? '10' : '9'}"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
