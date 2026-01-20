// CreatorTable.js (ES6-Modul)
// Wiederverwendbare Tabellen-Ausgabe für Creator

export function renderCreatorTable(creators, options = {}) {
  const { showFavoriteAction = false, showFavoritesMenu = false, showSelection = false, kampagneId = null } = options || {};

  const rows = (creators || []).map((c) => {
    const id = c.id;
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const typen = Array.isArray(c.creator_types) && c.creator_types.length
      ? c.creator_types.map(t => (typeof t === 'object' ? (t.name || t.label || t) : t)).join(', ')
      : '-';
    const sprachen = Array.isArray(c.sprachen) && c.sprachen.length
      ? c.sprachen.map(s => (typeof s === 'object' ? (s.name || s.label || s) : s)).join(', ')
      : '-';
    const branchen = Array.isArray(c.branchen) && c.branchen.length
      ? c.branchen.map(b => (typeof b === 'object' ? (b.name || b.label || b) : b)).join(', ')
      : '-';
    const igFollower = c.instagram_follower != null ? new Intl.NumberFormat('de-DE').format(c.instagram_follower) : '-';
    const ttFollower = c.tiktok_follower != null ? new Intl.NumberFormat('de-DE').format(c.tiktok_follower) : '-';
    const stadt = c.lieferadresse_stadt || '-';
    const land = c.lieferadresse_land || '-';

    const actionsCell = showFavoriteAction
      ? `
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${id}">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_list" data-id="${id}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Zur Liste hinzufügen
              </a>
              <a href="#" class="action-item" data-action="favorite" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
                Favorit speichern
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${id}">Löschen</a>
            </div>
          </div>
        </td>
      `
      : showFavoritesMenu
      ? `
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item assign-to-campaign" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Zu Kampagne hinzufügen
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger remove-favorite" data-creator-id="${id}" data-kampagne-id="${kampagneId}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m3 3 1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 0 1 1.743-1.342 48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664 19.5 19.5" />
                </svg>
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
          <span class="table-avatar">${(c.vorname || '?')[0].toUpperCase()}</span>
          ${id ? `<a href="#" class="table-link" data-table="creator" data-id="${id}">${name}</a>` : name}
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
            ${(showFavoriteAction || showFavoritesMenu) ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}


