// StrategieDetailRenderer.js
// Tabellen-Rendering für die Strategie-Detail-Ansicht

export function renderItemsTable(detail) {
  if (detail.items.length === 0) {
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
        <p>Noch keine Videos hinzugefügt</p>
        ${!detail.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben eine Video-URL ein, um zu starten</p>' : ''}
      </div>
    `;
  }

  const groupedItems = groupItemsByTeilbereich(detail.items);
  const colCount = detail.isKunde ? 12 : 13;

  return `
    <div class="table-container">
      <table class="data-table strategie-items-table">
        <thead>
          <tr>
            <th class="col-number">#</th>
            ${!detail.isKunde ? '<th class="col-drag"></th>' : ''}
            <th class="col-image">Bild</th>
            <th class="col-platform">Plattform</th>
            <th class="col-link">Link</th>
            <th class="col-creator">Creator</th>
            <th class="col-beschreibung">Beschreibung</th>
            <th class="col-anmerkung">Anmerkung Kunde</th>
            <th class="col-prio">Prio 1</th>
            <th class="col-prio">Prio 2</th>
            <th class="col-umgesetzt">Umgesetzt</th>
            <th class="col-nicht-umsetzen">Nicht umsetzen</th>
            ${!detail.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="items-table-body">
          ${renderGroupedItems(detail, groupedItems, colCount)}
        </tbody>
      </table>
    </div>
  `;
}

export function groupItemsByTeilbereich(items) {
  const groups = {};
  let globalIndex = 0;
  
  items.forEach(item => {
    const teilbereich = item.teilbereich || 'Ohne Kategorie';
    if (!groups[teilbereich]) {
      groups[teilbereich] = [];
    }
    groups[teilbereich].push({ ...item, globalIndex: globalIndex++ });
  });
  
  return groups;
}

export function renderGroupedItems(detail, groupedItems, colCount) {
  const definierteKategorien = detail.getTeilbereicheFromStrategie();
  const hatDefinierteKategorien = definierteKategorien.length > 0;
  
  if (!hatDefinierteKategorien && Object.keys(groupedItems).length === 1 && groupedItems['Ohne Kategorie']) {
    return groupedItems['Ohne Kategorie']
      .map(item => renderItemRow(detail, item, item.globalIndex))
      .join('');
  }
  
  const alleKategorien = [...definierteKategorien];
  if (!alleKategorien.includes('Ohne Kategorie')) {
    alleKategorien.push('Ohne Kategorie');
  }
  
  return alleKategorien.map(kategorie => {
    const items = groupedItems[kategorie] || [];
    const isEmpty = items.length === 0;
    
    return `
      <tr class="category-header-row ${isEmpty ? 'category-empty' : ''}" data-kategorie="${kategorie}">
        <td colspan="${colCount}" class="category-header-cell">
          <span class="category-name">${kategorie}</span>
          ${isEmpty ? '<span class="category-empty-hint">(leer - Videos hierher ziehen)</span>' : ''}
        </td>
      </tr>
      ${items.map(item => renderItemRow(detail, item, item.globalIndex)).join('')}
    `;
  }).join('');
}

export function renderItemRow(detail, item, index) {
  const platformIcon = getPlatformIcon(item.plattform);
  const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;
  const ideaIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; color: var(--amber-500);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`;
  const isIdea = !item.video_link;
  const isLinked = !!item.linked_video;
  const isUmgesetzt = !!item.video_umgesetzt;

  const rowClasses = [
    'item-row',
    !detail.isKunde ? 'draggable' : '',
    isIdea ? 'idea-row' : '',
    isUmgesetzt ? 'strategie-item-umgesetzt' : '',
    item.nicht_umsetzen ? 'item-nicht-umsetzen' : '',
  ].filter(Boolean).join(' ');

  return `
    <tr class="${rowClasses}" data-item-id="${item.id}" draggable="false">
      <td class="col-number">
        ${index + 1}
      </td>
      ${!detail.isKunde ? `
        <td class="col-drag drag-handle">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </td>
      ` : ''}
      <td>
        ${item.screenshot_url ? `
          <img src="${item.screenshot_url}" alt="Screenshot" style="width: 100px; height: auto; border-radius: var(--radius-md); display: block; cursor: pointer;" onclick="window.open('${item.screenshot_url}', '_blank')">
        ` : isIdea ? `
          <div class="idea-placeholder">
            ${ideaIcon}
            <span>Idee</span>
          </div>
        ` : `
          <div style="width: 100px; height: 60px; background: var(--gray-200); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: var(--text-xs); color: var(--text-muted);">Lädt...</span>
          </div>
        `}
      </td>
      <td style="text-align: center;">
        ${isIdea ? `<span style="font-size: var(--text-xs); color: var(--text-muted);">-</span>` : platformIcon}
      </td>
      <td style="text-align: center;">
        ${item.video_link ? `
          <a href="${item.video_link}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); display: inline-flex;" title="${item.video_link}">
            ${externalLinkIcon}
          </a>
        ` : `<span style="font-size: var(--text-xs); color: var(--text-muted);">-</span>`}
      </td>
      <td class="cell-textarea">
        <textarea 
          class="strategie-textarea" 
          placeholder="Creator..."
          data-field="creator_name"
          data-item-id="${item.id}"
        >${item.creator_name || ''}</textarea>
      </td>
      <td class="cell-textarea">
        ${!detail.isKunde ? `
          <textarea 
            class="strategie-textarea" 
            placeholder="Beschreibung..."
            data-field="beschreibung"
            data-item-id="${item.id}"
          >${item.beschreibung || ''}</textarea>
        ` : `
          <div class="cell-text-readonly">${item.beschreibung || '-'}</div>
        `}
      </td>
      <td class="cell-textarea">
        <textarea 
          class="strategie-textarea ${detail.isKunde ? '' : 'readonly-textarea'}" 
          placeholder="${detail.isKunde ? 'Ihre Anmerkung...' : 'Anmerkung Kunde...'}"
          data-field="kunde_anmerkung"
          data-item-id="${item.id}"
          ${detail.isKunde ? '' : 'readonly'}
        >${item.kunde_anmerkung || ''}</textarea>
      </td>
      <td style="text-align: center;">
        <input 
          type="checkbox" 
          ${item.prio_1 ? 'checked' : ''} 
          data-field="prio_1"
          data-item-id="${item.id}"
          style="width: 20px; height: 20px; cursor: pointer;"
        >
      </td>
      <td style="text-align: center;">
        <input 
          type="checkbox" 
          ${item.prio_2 ? 'checked' : ''} 
          data-field="prio_2"
          data-item-id="${item.id}"
          style="width: 20px; height: 20px; cursor: pointer;"
        >
      </td>
      <td class="col-umgesetzt" style="text-align: center;">
        <label class="toggle-switch strategie-umgesetzt-toggle-wrapper">
          <input type="checkbox"
            class="strategie-umgesetzt-toggle"
            data-field="video_umgesetzt"
            data-item-id="${item.id}"
            ${isUmgesetzt ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td style="text-align: center;">
        <input 
          type="checkbox" 
          ${item.nicht_umsetzen ? 'checked' : ''} 
          data-field="nicht_umsetzen"
          data-item-id="${item.id}"
          style="width: 20px; height: 20px; cursor: pointer;"
        >
      </td>
      ${!detail.isKunde ? `
        <td class="col-actions">
          <div class="actions-dropdown-container" data-entity-type="strategie_item">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="edit-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                Bearbeiten
              </a>
              ${isLinked ? `
                <a href="#" class="action-item action-warning" data-action="unlink-from-video" data-id="${item.id}" data-video-id="${item.linked_video.id}">
                  ${window.ActionsDropdown?.getHeroIcon('unlink') || ''}
                  Idee von Video entfernen
                </a>
              ` : `
                <a href="#" class="action-item" data-action="add-to-video" data-id="${item.id}">
                  ${window.ActionsDropdown?.getHeroIcon('add-to-list') || ''}
                  Zu Video hinzufügen
                </a>
              `}
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                Löschen
              </a>
            </div>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}

export function getPlatformIcon(platform) {
  const icons = {
    youtube: `<svg style="width: 20px; height: 20px; color: #FF0000;" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    tiktok: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
    instagram: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`
  };
  return icons[platform] || '';
}

export function rerenderItemsTable(detail) {
  const tableContainer = document.querySelector('.table-container');
  if (!tableContainer) return;

  tableContainer.outerHTML = renderItemsTable(detail);
  
  detail._bindTableEvents();
}
