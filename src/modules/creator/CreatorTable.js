// CreatorTable.js (ES6-Modul)
// Wiederverwendbare Tabellen-Ausgabe für Creator
import { creatorUtils } from './CreatorUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

function renderTags(items, tagClass) {
  if (!items || !items.length) return '-';
  const arr = Array.isArray(items) ? items : [items];
  const tags = arr.map(item => {
    const label = typeof item === 'object' ? (item.name || item.label || item) : item;
    const safe = String(label).trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<span class="tag ${tagClass}">${safe}</span>`;
  }).join('');
  return `<div class="tags tags-compact">${tags}</div>`;
}

export function renderCreatorTable(creators, options = {}) {
  const { showFavoriteAction = false, showFavoritesMenu = false, showSelection = false, showRemoveAction = false, managementId = null, kampagneId = null } = options || {};
  const isKunde = window.isKunde();
  const canViewViaPage = window.canViewPage?.('creator');
  const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
  const canViewCreator = !isKunde && canViewViaPage !== false && canViewViaPerm !== false;
  const canShowActions = !isKunde && (showFavoriteAction || showFavoritesMenu || showRemoveAction);

  const rows = (creators || []).map((c) => {
    const id = c.id;
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const typen = renderTags(c.creator_types, 'tag--type');
    const sprachen = renderTags(c.sprachen, 'tag--lang');
    const branchen = renderTags(c.branchen, 'tag--branche');
    const igFollower = creatorUtils.formatFollowerRange(c.instagram_follower);
    const ttFollower = creatorUtils.formatFollowerRange(c.tiktok_follower);
    const stadt = c.lieferadresse_stadt || '-';
    const land = c.lieferadresse_land || '-';

    // Kleiner Tabellen-Avatar: 128px-Thumb reicht, Fallback fuer Altbestand
    const avatarSource = c.profilbild_thumb_url || c.profilbild_url;
    const safeAvatarUrl = avatarSource ? window.validatorSystem?.sanitizeUrl(avatarSource) : null;
    const avatarHtml = safeAvatarUrl
      ? `<img src="${safeAvatarUrl}" alt="${name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}" class="table-avatar table-avatar-img" loading="lazy" />`
      : `<span class="table-avatar">${(c.vorname || '?')[0].toUpperCase()}</span>`;

    const actionsCell = canShowActions && showRemoveAction
      ? `
        <td>
          <button class="mdc-btn mdc-btn--secondary mdc-btn--sm mdc-btn--delete" data-action="remove-creator-from-management" data-creator-id="${id}" title="Zuordnung entfernen">
            ${icon('x-mark', { className: 'icon-14' })}
          </button>
        </td>
      `
      : canShowActions && showFavoriteAction
      ? `
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('ellipsis-vertical')}
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${id}">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_list" data-id="${id}">
                ${icon('view-list', { className: 'size-6' })}
                Zur Liste hinzufügen
              </a>
              <a href="#" class="action-item" data-action="favorite" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                ${icon('bookmark', { className: 'size-6' })}
                Favorit speichern
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${id}">Löschen</a>
            </div>
          </div>
        </td>
      `
      : canShowActions && showFavoritesMenu
      ? `
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('ellipsis-vertical')}
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item assign-to-campaign" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                ${icon('user-plus', { className: 'size-6' })}
                Zu Kampagne hinzufügen
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger remove-favorite" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                ${icon('bookmark-slash', { className: 'size-6' })}
                Aus Favoriten entfernen
              </a>
            </div>
          </div>
        </td>
      `
      : '';

    return `
      <tr data-id="${id || ''}">
        ${showSelection ? `<td><input type=\"checkbox\" class=\"creator-check\" data-id=\"${id}\"></td>` : ''}
        <td class="col-name-with-icon">
          ${avatarHtml}
          ${id && canViewCreator ? `<a href="#" class="table-link" data-table="creator" data-id="${id}">${name}</a>` : name}
        </td>
        <td>${typen}</td>
        <td>${sprachen}</td>
        <td>${branchen}</td>
        <td>${igFollower}</td>
        <td>${ttFollower}</td>
        <td>${stadt}</td>
        <td>${land}</td>
        ${actionsCell}
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            ${showSelection ? '<th></th>' : ''}
            <th>Name</th>
            <th>Typen</th>
            <th>Sprachen</th>
            <th>Branchen</th>
            <th>Instagram</th>
            <th>TikTok</th>
            <th>Stadt</th>
            <th>Land</th>
            ${canShowActions ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}


