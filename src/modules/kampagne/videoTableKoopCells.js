// videoTableKoopCells.js
// Creator, Status, Adresse und Aktionen der Kampagnen-Video-Tabelle

import { getCachedCreatorUploadStatus } from './CreatorUploadActions.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml } from './videoTableFieldCells.js';

const INSTAGRAM_ICON = `${icon('instagram')}`;
const TIKTOK_ICON = `${icon('tiktok')}`;

// Auch vom VideoTableEventBinder genutzt (Copy-Feedback)
export const COPY_ICON = `${icon('squares-2x2')}`;
export const CHECK_ICON = `${icon('check')}`;

export function renderCreatorInner(ctx) {
  const creator = ctx.creator;
  const name = escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt');
  const nameHtml = ctx.canViewCreator && creator.id
    ? `<a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" class="table-link">${name}</a>`
    : name;
  const socials = (creator.instagram || creator.tiktok) ? `<div class="creator-social-links">
      ${creator.instagram ? `<a href="${creator.instagram.startsWith('http') ? escapeHtml(creator.instagram) : `https://instagram.com/${encodeURIComponent(creator.instagram.replace('@', ''))}`}" target="_blank" rel="noopener" title="@${escapeHtml(creator.instagram)}">${INSTAGRAM_ICON}</a>` : ''}
      ${creator.tiktok ? `<a href="${creator.tiktok.startsWith('http') ? escapeHtml(creator.tiktok) : `https://tiktok.com/@${encodeURIComponent(creator.tiktok.replace('@', ''))}`}" target="_blank" rel="noopener" title="@${escapeHtml(creator.tiktok)}">${TIKTOK_ICON}</a>` : ''}
    </div>` : '';
  return `${nameHtml}${socials}`;
}

export function renderTagsInner(koop) {
  return (koop._tags || []).length > 0
    ? `<div class="tags tags-compact">${koop._tags.map(name => `<span class="tag tag--branche">${escapeHtml(name)}</span>`).join('')}</div>`
    : '<span class="text-muted">-</span>';
}

export function renderProduktInner(ctx, video) {
  const versandForVideo = ctx.t.getVersandForVideo(video.id);
  return `
      <input type="text" class="grid-input stacked-video-input" 
        data-entity="versand" 
        data-id="${versandForVideo?.id || 'new'}"
        data-video-id="${video.id}"
        data-kooperation-id="${ctx.koop.id}"
        data-field="produkt_name"
        ${!ctx.t.isFieldEditableForUser('versand', 'produkt_name') ? 'readonly' : ''}
        value="${escapeHtml(versandForVideo?.produkt_name || '')}" 
        placeholder="Produktname"/>
      <input type="url" class="grid-input stacked-video-input" 
        data-entity="versand" 
        data-id="${versandForVideo?.id || 'new'}"
        data-video-id="${video.id}"
        data-kooperation-id="${ctx.koop.id}"
        data-field="produkt_link"
        ${!ctx.t.isFieldEditableForUser('versand', 'produkt_link') ? 'readonly' : ''}
        value="${escapeHtml(versandForVideo?.produkt_link || '')}" 
        placeholder="Produktlink (optional)"/>
    `;
}

export function renderLieferadresseInner(ctx, video) {
  const koop = ctx.koop;
  const versandForVideo = ctx.t.getVersandForVideo(video.id);
  let strasse = '';
  let plzStadt = '';
  let land = '';

  if (versandForVideo?.creator_adresse_id) {
    const ca = (ctx.t.store || ctx.t).creatorAdressen?.[versandForVideo.creator_adresse_id];
    if (ca) {
      strasse = [ca.strasse, ca.hausnummer].filter(Boolean).join(' ');
      plzStadt = [ca.plz, ca.stadt].filter(Boolean).join(' ');
      land = ca.land || '';
    }
  } else if (versandForVideo?.strasse) {
    strasse = [versandForVideo.strasse, versandForVideo.hausnummer].filter(Boolean).join(' ');
    plzStadt = [versandForVideo.plz, versandForVideo.stadt].filter(Boolean).join(' ');
    land = versandForVideo.land || '';
  }

  if (!strasse && !plzStadt && koop.creator) {
    strasse = [koop.creator.lieferadresse_strasse, koop.creator.lieferadresse_hausnummer]
      .filter(Boolean).join(' ');
    plzStadt = [koop.creator.lieferadresse_plz, koop.creator.lieferadresse_stadt]
      .filter(Boolean).join(' ');
    land = koop.creator.lieferadresse_land || '';
  }

  const lines = [strasse, plzStadt].filter(Boolean);
  const copyText = [strasse, plzStadt, land].filter(Boolean).join('\n');
  if (lines.length === 0) lines.push('-');
  const addressHtml = `<div class="small-text address-text">`
       + lines.map(l => `<div class="address-line">${escapeHtml(l)}</div>`).join('')
       + (land ? `<div class="address-line address-land-text">${escapeHtml(land)}</div>` : '')
       + `</div>`;
  const copyBtn = copyText
    ? `<button type="button" class="address-copy-btn" data-action="copy-address" data-address="${escapeHtml(copyText)}" title="Adresse kopieren">${COPY_ICON}</button>`
    : '';
  return `<div class="address-cell">${addressHtml}${copyBtn}</div>`;
}

export function renderActionsInner(ctx) {
  const koop = ctx.koop;
  const canEdit = window.permissionSystem?.canEdit('kooperation') ?? false;
  const canDelete = ctx.t.canDeleteKooperation();
  if (!canEdit && !canDelete) return '';
  return `
      <div class="actions-dropdown-container" data-entity-type="kooperation">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          ${icon('dots-grid', { className: 'w-5 h-5' })}
        </button>
        <div class="actions-dropdown">
          ${canEdit ? renderActionStatusSubmenu(ctx.t, koop) : ''}
          ${canEdit ? `
          <a href="#" class="action-item" data-action="edit" data-id="${koop.id}" data-return-to="/kampagne/${ctx.t.kampagneId}">
            ${icon('pencil-square', { className: 'w-4 h-4' })}
            Bearbeiten
          </a>
          ` : ''}
          ${canEdit ? renderCreatorUploadItems(ctx.t, koop) : ''}
          ${canDelete ? `
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger" data-action="delete" data-id="${koop.id}">
              ${icon('trash-alt', { className: 'w-4 h-4' })}
              Löschen
            </a>
          ` : ''}
        </div>
      </div>
    `;
}

function renderCreatorUploadItems(table, koop) {
  if (!(window.canFeature?.('mediaUpload') ?? false)) return '';
  if (table.kampagneInfo?.keinDropbox) return '';
  if (!koop.creator_id) return '';

  const status = getCachedCreatorUploadStatus(table.kampagneId).get(koop.creator_id);
  const stateLine = status?.expiresAt
    ? `<div class="action-item action-item--info" style="pointer-events:none; font-size:12px; opacity:0.75;">Zugang aktiv bis ${new Date(status.expiresAt).toLocaleDateString('de-DE')}</div>`
    : '';

  const attrs = `data-id="${koop.id}" data-kampagne-id="${table.kampagneId}" data-creator-id="${koop.creator_id}"`;
  return `
      <div class="action-separator"></div>
      ${stateLine}
      <a href="#" class="action-item" data-action="creator-upload-send" ${attrs}>
        ${icon('envelope', { className: 'w-4 h-4' })}
        Upload-Link senden
      </a>
      <a href="#" class="action-item" data-action="creator-upload-resend" ${attrs}>
        ${icon('arrow-path', { className: 'w-4 h-4' })}
        Upload-Link erneut senden
      </a>
      <a href="#" class="action-item" data-action="creator-upload-copy" ${attrs}>
        ${icon('link', { className: 'w-4 h-4' })}
        Upload-Link kopieren
      </a>
      <a href="#" class="action-item action-danger" data-action="creator-upload-revoke" ${attrs}>
        ${icon('x-circle', { className: 'w-4 h-4' })}
        Upload-Zugang widerrufen
      </a>
    `;
}

function renderActionStatusSubmenu(table, koop) {
  if (!(window.permissionSystem?.canEditField('kooperation', 'status_id') ?? false)) return '';
  const statusOptions = table.statusOptions || [];
  if (statusOptions.length === 0) return '';

  const checkSvg = `${icon('check-bold', { className: 'size-5' })}`;
  const items = statusOptions.map(opt => {
    const isActive = koop.status_id === opt.id;
    return `<a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${opt.id}" data-status-name="${escapeHtml(opt.name)}" data-id="${koop.id}"><span>${escapeHtml(opt.name)}</span>${isActive ? `<span class="submenu-check">${checkSvg}</span>` : ''}</a>`;
  }).join('');

  return `
      <div class="action-submenu">
        <a href="#" class="action-item has-submenu" data-submenu="status">
          ${icon('tag', { className: 'w-4 h-4' })}
          Status ändern
        </a>
        <div class="submenu" data-submenu="status" data-entity-id="${koop.id}" data-entity-type="kooperation">
          ${items}
        </div>
      </div>
    `;
}

function renderStatusBadge(koop) {
  const statusName = koop.status_name || koop.status_ref?.name || '';
  const statusClass = statusName ? `status-${statusName.toLowerCase().replace(/\s+/g, '-')}` : '';

  if (!statusName) {
    return '<span class="text-muted">-</span>';
  }

  return `<span class="status-badge ${statusClass}">${escapeHtml(statusName)}</span>`;
}

export function renderStatusSelect(table, koop) {
  const statusOptions = table.statusOptions || [];
  const isEditable = (window.permissionSystem?.canEditField('kooperation', 'status_id') ?? false)
    && statusOptions.length > 0;

  if (!isEditable) return renderStatusBadge(koop);

  const currentId = koop.status_id || '';
  const statusName = koop.status_name || koop.status_ref?.name || '';
  const statusClass = statusName ? `status-${statusName.toLowerCase().replace(/\s+/g, '-')}` : '';
  const chevron = `<span class="status-select-chevron">${icon('chevron-down')}</span>`;
  const checkSvg = `${icon('check-bold', { className: 'size-5' })}`;

  const triggerClasses = statusName
    ? `status-badge ${statusClass} status-select-trigger`
    : `status-badge status-select-trigger status-no-value`;
  const triggerLabel = statusName ? escapeHtml(statusName) : '<span class="text-muted">–</span>';

  return `<div class="status-select-wrapper" data-kooperation-id="${koop.id}">
      <span class="${triggerClasses}" role="button">${triggerLabel} ${chevron}</span>
      <div class="status-dropdown">
        <a href="#" class="status-dropdown-item ${!currentId ? 'is-active' : ''}" data-value="">
          <span>– kein Status –</span>
          ${!currentId ? `<span class="submenu-check">${checkSvg}</span>` : ''}
        </a>
        ${statusOptions.map(opt => {
          const isActive = opt.id === currentId;
          return `<a href="#" class="status-dropdown-item ${isActive ? 'is-active' : ''}" data-value="${opt.id}">
            <span>${escapeHtml(opt.name)}</span>
            ${isActive ? `<span class="submenu-check">${checkSvg}</span>` : ''}
          </a>`;
        }).join('')}
      </div>
    </div>`;
}
