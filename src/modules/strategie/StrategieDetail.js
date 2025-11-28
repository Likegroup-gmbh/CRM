// StrategieDetail.js
// Detail-Ansicht einer Strategie mit Items und Screenshot-Generierung

import { strategieService } from './StrategieService.js';

export class StrategieDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this.strategie = null;
    this.items = [];
    this.draggedItem = null;
    this.isKunde = window.currentUser?.rolle === 'kunde';
  }

  /**
   * Initialisiere Strategie-Detail
   */
  async init(strategieId) {
    this.strategieId = strategieId;

    try {
      // Daten laden
      this.strategie = await strategieService.getStrategieById(strategieId);
      this.items = await strategieService.getStrategieItems(strategieId);

      // Breadcrumb
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Strategien', url: '/strategie', clickable: true },
          { label: this.strategie.name, url: `/strategie/${strategieId}`, clickable: false }
        ]);
      }

      window.setHeadline(this.strategie.name);

      // Rendern
      await this.render();
      this.bindEvents();

    } catch (error) {
      console.error('Fehler beim Laden der Strategie:', error);
      window.content.innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden der Strategie</p>
        </div>
      `;
    }
  }

  /**
   * Rendere die Strategie-Detail-Ansicht
   */
  async render() {
    const canEdit = !this.isKunde;

    const html = `
      ${this.renderHeader()}
      
      ${canEdit ? this.renderAddItemSection() : ''}
      
      ${this.renderItemsTable()}
    `;

    window.content.innerHTML = html;
  }

  /**
   * Rendere Header mit Strategie-Infos
   */
  renderHeader() {
    let verknuepfung = '';
    if (this.strategie.marke) {
      verknuepfung = `Marke: ${this.strategie.marke.name}`;
    } else if (this.strategie.unternehmen) {
      verknuepfung = `Unternehmen: ${this.strategie.unternehmen.name}`;
    }

    return `
      <div class="detail-header" style="margin-bottom: var(--space-lg);">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h2 style="margin: 0; font-size: var(--text-xxl);">${this.strategie.name}</h2>
            ${this.strategie.beschreibung ? `<p style="margin-top: var(--space-xs); color: var(--text-secondary);">${this.strategie.beschreibung}</p>` : ''}
            ${verknuepfung ? `<p style="margin-top: var(--space-xs); font-size: var(--text-sm); color: var(--text-secondary);">${verknuepfung}</p>` : ''}
          </div>
          <button class="secondary-btn" onclick="window.navigateTo('/strategie')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Zurück
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Rendere Section zum Hinzufügen von Items
   */
  renderAddItemSection() {
    // Teilbereiche aus der Strategie holen
    const teilbereiche = this.getTeilbereicheFromStrategie();
    
    const teilbereichSelect = teilbereiche.length > 0 ? `
      <div class="form-field" style="margin: 0;">
        <label for="item-teilbereich" style="margin-bottom: var(--space-xs); display: block;">Kategorie</label>
        <select id="item-teilbereich" name="teilbereich" class="form-input">
          ${teilbereiche.map(tb => `<option value="${tb}">${tb}</option>`).join('')}
        </select>
      </div>
    ` : '';
    
    return `
      <div class="add-item-section" style="background: var(--bg-secondary); padding: var(--space-lg); border-radius: var(--radius-lg); margin-bottom: var(--space-lg);">
        <h3 style="margin: 0 0 var(--space-md) 0; font-size: var(--text-lg);">Video hinzufügen</h3>
        
        <form id="add-item-form" style="display: grid; grid-template-columns: ${teilbereiche.length > 0 ? '1fr 200px auto' : '1fr auto'}; gap: var(--space-sm); align-items: end;">
          <div class="form-field" style="margin: 0;">
            <label for="video-url" style="margin-bottom: var(--space-xs); display: block;">Video-URL *</label>
            <input 
              type="url" 
              id="video-url" 
              name="video_link" 
              required 
              class="form-input" 
              placeholder="https://www.youtube.com/watch?v=... oder TikTok/Instagram Link"
              style="width: 100%;"
            >
          </div>
          ${teilbereichSelect}
          <button type="submit" class="primary-btn" style="height: var(--height-input);">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            Screenshot generieren
          </button>
        </form>
      </div>
    `;
  }

  /**
   * Hole Teilbereiche aus der Strategie
   */
  getTeilbereicheFromStrategie() {
    if (!this.strategie?.teilbereich) return [];
    return this.strategie.teilbereich.split(',').map(tb => tb.trim()).filter(tb => tb);
  }

  /**
   * Rendere Tabelle mit Items (gruppiert nach Teilbereich)
   */
  renderItemsTable() {
    if (this.items.length === 0) {
      return `
        <div style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
            <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <p>Noch keine Videos hinzugefügt</p>
          ${!this.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben eine Video-URL ein, um zu starten</p>' : ''}
        </div>
      `;
    }

    // Items nach Teilbereich gruppieren
    const groupedItems = this.groupItemsByTeilbereich(this.items);
    const colCount = this.isKunde ? 10 : 11;

    return `
      <div class="table-container">
        <table class="data-table strategie-items-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">#</th>
              ${!this.isKunde ? '<th style="width: 40px;"></th>' : ''}
              <th style="width: 120px;">Bild</th>
              <th style="width: 60px; text-align: center;">Plattform</th>
              <th style="width: 60px; text-align: center;">Link</th>
              <th>Beschreibung</th>
              <th>Anmerkung Kunde</th>
              <th style="width: 80px; text-align: center;">Prio 1</th>
              <th style="width: 80px; text-align: center;">Prio 2</th>
              <th style="width: 100px; text-align: center;">Nicht umsetzen</th>
              ${!this.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody id="items-table-body">
            ${this.renderGroupedItems(groupedItems, colCount)}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Gruppiere Items nach Teilbereich
   */
  groupItemsByTeilbereich(items) {
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

  /**
   * Rendere gruppierte Items mit Kategorie-Headern
   */
  renderGroupedItems(groupedItems, colCount) {
    const teilbereiche = Object.keys(groupedItems);
    
    // Wenn nur "Ohne Kategorie" existiert, keine Header anzeigen
    if (teilbereiche.length === 1 && teilbereiche[0] === 'Ohne Kategorie') {
      return groupedItems['Ohne Kategorie']
        .map(item => this.renderItemRow(item, item.globalIndex))
        .join('');
    }
    
    // Mit Kategorie-Headern rendern
    return teilbereiche.map(teilbereich => {
      const items = groupedItems[teilbereich];
      return `
        <tr class="category-header-row">
          <td colspan="${colCount}" style="background: var(--color-primary-light, #FFF3CD); padding: var(--space-sm) var(--space-md); font-weight: 600; text-align: center; color: var(--color-primary-dark, #856404); border-top: 2px solid var(--color-primary, #FFC107); border-bottom: 2px solid var(--color-primary, #FFC107);">
            ${teilbereich}
          </td>
        </tr>
        ${items.map(item => this.renderItemRow(item, item.globalIndex)).join('')}
      `;
    }).join('');
  }

  /**
   * Rendere eine Item-Zeile
   */
  renderItemRow(item, index) {
    const platformIcon = this.getPlatformIcon(item.plattform);
    const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;

    return `
      <tr class="item-row ${!this.isKunde ? 'draggable' : ''}" data-item-id="${item.id}" draggable="${!this.isKunde}">
        <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">
          ${index + 1}
        </td>
        ${!this.isKunde ? `
          <td class="drag-handle" style="cursor: move; text-align: center;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px; color: var(--text-muted);">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </td>
        ` : ''}
        <td>
          ${item.screenshot_url ? `
            <img src="${item.screenshot_url}" alt="Screenshot" style="width: 100px; height: auto; border-radius: var(--radius-md); display: block; cursor: pointer;" onclick="window.open('${item.screenshot_url}', '_blank')">
          ` : `
            <div style="width: 100px; height: 60px; background: var(--gray-200); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
              <span style="font-size: var(--text-xs); color: var(--text-muted);">Lädt...</span>
            </div>
          `}
        </td>
        <td style="text-align: center;">
          ${platformIcon}
        </td>
        <td style="text-align: center;">
          <a href="${item.video_link}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); display: inline-flex;" title="${item.video_link}">
            ${externalLinkIcon}
          </a>
        </td>
        <td>
          ${!this.isKunde ? `
            <input 
              type="text" 
              class="form-input" 
              style="width: 100%; font-size: var(--text-sm);" 
              value="${item.beschreibung || ''}" 
              placeholder="Beschreibung..."
              data-field="beschreibung"
              data-item-id="${item.id}"
            >
          ` : `
            <span style="font-size: var(--text-sm);">${item.beschreibung || '-'}</span>
          `}
        </td>
        <td>
          <input 
            type="text" 
            class="form-input" 
            style="width: 100%; font-size: var(--text-sm);" 
            value="${item.kunde_anmerkung || ''}" 
            placeholder="${this.isKunde ? 'Ihre Anmerkung...' : 'Anmerkung Kunde...'}"
            data-field="kunde_anmerkung"
            data-item-id="${item.id}"
            ${this.isKunde ? '' : 'readonly'}
          >
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
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.nicht_umsetzen ? 'checked' : ''} 
            data-field="nicht_umsetzen"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: pointer;"
          >
        </td>
        ${!this.isKunde ? `
          <td class="col-actions">
            <div class="actions-dropdown-container" data-entity-type="strategie_item">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              <div class="actions-dropdown">
                <a href="#" class="action-item" data-action="add-to-video" data-id="${item.id}">
                  Zu Video hinzufügen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete-item" data-id="${item.id}">
                  Löschen
                </a>
              </div>
            </div>
          </td>
        ` : ''}
      </tr>
    `;
  }

  /**
   * Plattform-Icon zurückgeben
   */
  getPlatformIcon(platform) {
    const icons = {
      youtube: `<svg style="width: 20px; height: 20px; color: #FF0000;" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      tiktok: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
      instagram: `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`
    };
    return icons[platform] || '';
  }

  /**
   * URL kürzen für Anzeige
   */
  shortenUrl(url) {
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  }

  /**
   * Events binden
   */
  bindEvents() {
    // Cleanup alte Events
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Form zum Hinzufügen
    if (!this.isKunde) {
      const form = document.getElementById('add-item-form');
      if (form) {
        const handler = (e) => this.handleAddItem(e);
        form.addEventListener('submit', handler);
        this._boundEventListeners.add(() => form.removeEventListener('submit', handler));
      }

      // Drag & Drop
      this.bindDragAndDropEvents();
    }

    // Beschreibung/Anmerkung Inputs
    document.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
      const handler = () => this.handleFieldUpdate(input);
      input.addEventListener('blur', handler);
      this._boundEventListeners.add(() => input.removeEventListener('blur', handler));
    });

    // Checkbox Auswahl (Prio 1, Prio 2, Nicht umsetzen)
    document.querySelectorAll('input[type="checkbox"][data-field]').forEach(checkbox => {
      const handler = () => this.handleFieldUpdate(checkbox);
      checkbox.addEventListener('change', handler);
      this._boundEventListeners.add(() => checkbox.removeEventListener('change', handler));
    });

    // Actions Dropdown (Delete, Add to Video)
    if (!this.isKunde) {
      document.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleDeleteItem(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="add-to-video"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleAddToVideo(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });
    }
  }

  /**
   * Drag & Drop Events binden
   */
  bindDragAndDropEvents() {
    const rows = document.querySelectorAll('.item-row.draggable');
    const categoryHeaders = document.querySelectorAll('.category-header-row');
    
    rows.forEach(row => {
      // Dragstart
      const dragstartHandler = (e) => {
        this.draggedItem = row;
        this.draggedItemId = row.dataset.itemId;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.itemId);
      };
      row.addEventListener('dragstart', dragstartHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

      // Dragend
      const dragendHandler = () => {
        row.style.opacity = '1';
        this.draggedItem = null;
        this.draggedItemId = null;
        // Highlight von Kategorie-Headern entfernen
        document.querySelectorAll('.category-header-row').forEach(h => {
          h.classList.remove('drag-over');
        });
      };
      row.addEventListener('dragend', dragendHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

      // Dragover auf Item-Zeilen
      const dragoverHandler = (e) => {
        e.preventDefault();
        if (row === this.draggedItem) return;
        
        const tbody = row.parentNode;
        const draggingIndex = Array.from(tbody.children).indexOf(this.draggedItem);
        const targetIndex = Array.from(tbody.children).indexOf(row);
        
        if (draggingIndex < targetIndex) {
          row.parentNode.insertBefore(this.draggedItem, row.nextSibling);
        } else {
          row.parentNode.insertBefore(this.draggedItem, row);
        }
      };
      row.addEventListener('dragover', dragoverHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragover', dragoverHandler));

      // Drop auf Item-Zeilen
      const dropHandler = (e) => {
        e.stopPropagation();
        this.handleSortUpdate();
      };
      row.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => row.removeEventListener('drop', dropHandler));
    });

    // Kategorie-Header als Drop-Ziele
    categoryHeaders.forEach(header => {
      const kategorie = header.querySelector('td')?.textContent?.trim();
      
      // Dragover auf Kategorie-Header
      const dragoverHandler = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      };
      header.addEventListener('dragover', dragoverHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

      // Dragleave
      const dragleaveHandler = () => {
        header.classList.remove('drag-over');
      };
      header.addEventListener('dragleave', dragleaveHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

      // Drop auf Kategorie-Header
      const dropHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        
        if (!this.draggedItemId || !kategorie) return;
        
        // Teilbereich des Items ändern
        await this.handleCategoryChange(this.draggedItemId, kategorie);
      };
      header.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => header.removeEventListener('drop', dropHandler));
    });
  }

  /**
   * Item in andere Kategorie verschieben
   */
  async handleCategoryChange(itemId, newKategorie) {
    try {
      // "Ohne Kategorie" auf null setzen
      const teilbereich = newKategorie === 'Ohne Kategorie' ? null : newKategorie;
      
      await strategieService.updateStrategieItem(itemId, { teilbereich });
      
      // Items lokal aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item.teilbereich = teilbereich;
      }
      
      // Tabelle neu rendern
      this.rerenderItemsTable();
      
      window.toastSystem?.show(`Video in "${newKategorie}" verschoben`, 'success');
    } catch (error) {
      console.error('Fehler beim Ändern der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Verschieben', 'error');
    }
  }

  /**
   * Creator-Suche Events binden
   */
  bindCreatorSearchEvents() {
    document.querySelectorAll('.creator-search').forEach(input => {
      let debounceTimer;

      const searchHandler = async () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const searchTerm = input.value.trim();
          if (searchTerm.length < 2) {
            this.hideCreatorResults(input);
            return;
          }

          try {
            const creators = await strategieService.searchCreators(searchTerm);
            this.showCreatorResults(input, creators);
          } catch (error) {
            console.error('Fehler bei Creator-Suche:', error);
          }
        }, 300);
      };

      input.addEventListener('input', searchHandler);
      this._boundEventListeners.add(() => input.removeEventListener('input', searchHandler));

      // Blur mit Verzögerung für Klick auf Ergebnis
      const blurHandler = () => {
        setTimeout(() => this.hideCreatorResults(input), 200);
      };
      input.addEventListener('blur', blurHandler);
      this._boundEventListeners.add(() => input.removeEventListener('blur', blurHandler));
    });
  }

  /**
   * Zeige Creator-Suchergebnisse
   */
  showCreatorResults(input, creators) {
    const wrapper = input.closest('.creator-search-wrapper');
    let resultsDiv = wrapper.querySelector('.creator-search-results');
    
    if (!resultsDiv) {
      resultsDiv = document.createElement('div');
      resultsDiv.className = 'creator-search-results';
      wrapper.appendChild(resultsDiv);
    }

    if (creators.length === 0) {
      resultsDiv.innerHTML = '<div style="padding: var(--space-xs); font-size: var(--text-sm); color: var(--text-muted);">Keine Creator gefunden</div>';
    } else {
      resultsDiv.innerHTML = creators.map(creator => `
        <div class="creator-result-item" data-creator-id="${creator.id}" data-creator-name="${creator.name}" style="padding: var(--space-xs); cursor: pointer; border-bottom: 1px solid var(--gray-200); font-size: var(--text-sm);">
          <strong>${creator.name}</strong>
          ${creator.instagram ? `<span style="color: var(--text-muted); font-size: var(--text-xs); margin-left: var(--space-xs);">@${creator.instagram}</span>` : ''}
        </div>
      `).join('');

      // Klick auf Ergebnis
      resultsDiv.querySelectorAll('.creator-result-item').forEach(item => {
        item.addEventListener('click', () => {
          input.value = item.dataset.creatorName;
          input.dataset.creatorId = item.dataset.creatorId;
          this.hideCreatorResults(input);
          
          // Item aktualisieren
          const itemId = wrapper.dataset.itemId;
          this.updateItemField(itemId, 'creator_id', item.dataset.creatorId);
        });
      });
    }

    resultsDiv.style.display = 'block';
    resultsDiv.style.position = 'absolute';
    resultsDiv.style.background = 'white';
    resultsDiv.style.border = '1px solid var(--gray-300)';
    resultsDiv.style.borderRadius = 'var(--radius-md)';
    resultsDiv.style.boxShadow = 'var(--shadow-md)';
    resultsDiv.style.zIndex = '1000';
    resultsDiv.style.maxHeight = '200px';
    resultsDiv.style.overflow = 'auto';
    resultsDiv.style.width = '100%';
  }

  /**
   * Verstecke Creator-Suchergebnisse
   */
  hideCreatorResults(input) {
    const wrapper = input.closest('.creator-search-wrapper');
    const resultsDiv = wrapper?.querySelector('.creator-search-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }
  }

  /**
   * Video hinzufügen und Screenshot generieren
   */
  async handleAddItem(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const videoUrl = formData.get('video_link');

    if (!videoUrl) return;

    // Button referenz und original text AUSSERHALB try-catch
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      // Button in Loading-State
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="width: 16px; height: 16px; animation: spin 1s linear infinite;">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generiere...
      `;

      // Plattform aus URL erkennen
      let platform = 'other';
      if (videoUrl.includes('tiktok.com')) platform = 'tiktok';
      else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) platform = 'youtube';
      else if (videoUrl.includes('instagram.com')) platform = 'instagram';

      // Screenshot generieren (nur auf Netlify, nicht lokal)
      let screenshotUrl = null;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!isLocalhost) {
        try {
          window.toastSystem?.show('Screenshot wird generiert...', 'info');
          const screenshotResult = await strategieService.generateScreenshot(videoUrl);
          screenshotUrl = screenshotResult.screenshot_url;
        } catch (screenshotError) {
          console.warn('Screenshot-Generierung fehlgeschlagen:', screenshotError);
          window.toastSystem?.show('Screenshot konnte nicht generiert werden', 'warning');
        }
      } else {
        console.log('📸 Screenshot-Generierung übersprungen (localhost)');
      }

      // Teilbereich aus Formular holen
      const teilbereich = formData.get('teilbereich') || null;

      // Item erstellen (auch ohne Screenshot)
      const itemData = {
        strategie_id: this.strategieId,
        video_link: videoUrl,
        screenshot_url: screenshotUrl,
        plattform: platform,
        sortierung: this.items.length,
        teilbereich: teilbereich
      };

      await strategieService.createStrategieItem(itemData);

      // Erfolg
      window.toastSystem?.show('Video erfolgreich hinzugefügt', 'success');
      e.target.reset();

      // Button zurücksetzen vor dem Reload
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      // Neu laden
      await this.init(this.strategieId);

    } catch (error) {
      console.error('Fehler beim Hinzufügen des Videos:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Hinzufügen des Videos', 'error');
      
      // Button zurücksetzen
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  /**
   * Feld-Update (Beschreibung, Anmerkung, Checkbox)
   */
  async handleFieldUpdate(element) {
    const itemId = element.dataset.itemId;
    const field = element.dataset.field;
    let value = element.type === 'checkbox' ? element.checked : element.value;

    await this.updateItemField(itemId, field, value);
  }

  /**
   * Item-Feld aktualisieren
   */
  async updateItemField(itemId, field, value) {
    try {
      await strategieService.updateStrategieItem(itemId, { [field]: value });
      
      // Item in lokalem State aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item[field] = value;
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Items:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /**
   * Nur die Tabelle neu rendern (ohne Events neu zu binden)
   */
  rerenderItemsTable() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;

    tableContainer.outerHTML = this.renderItemsTable();
    
    // Events für die neu gerenderte Tabelle binden
    if (!this.isKunde) {
      this.bindDragAndDropEvents();
    }
    
    // Beschreibung/Anmerkung Inputs
    document.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
      const handler = () => this.handleFieldUpdate(input);
      input.addEventListener('blur', handler);
      this._boundEventListeners.add(() => input.removeEventListener('blur', handler));
    });

    // Checkbox Auswahl (Prio 1, Prio 2, Nicht umsetzen)
    document.querySelectorAll('input[type="checkbox"][data-field]').forEach(checkbox => {
      const handler = () => this.handleFieldUpdate(checkbox);
      checkbox.addEventListener('change', handler);
      this._boundEventListeners.add(() => checkbox.removeEventListener('change', handler));
    });

    // Actions Dropdown (Delete, Add to Video)
    if (!this.isKunde) {
      document.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleDeleteItem(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="add-to-video"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleAddToVideo(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });
    }
  }

  /**
   * Sortierung aktualisieren nach Drag & Drop
   */
  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const rows = Array.from(tbody.querySelectorAll('.item-row'));
    
    const reorderedItems = rows.map(row => {
      const itemId = row.dataset.itemId;
      return this.items.find(i => i.id === itemId);
    });

    try {
      await strategieService.updateItemsSortierung(reorderedItems);
      this.items = reorderedItems;
      
      // Tabelle neu rendern um Nummerierung zu aktualisieren
      this.rerenderItemsTable();
      
      window.toastSystem?.show('Sortierung gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Sortierung:', error);
      window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
    }
  }

  /**
   * Item löschen
   */
  async handleDeleteItem(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Item löschen?',
      message: 'Möchten Sie dieses Video wirklich aus der Strategie entfernen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await strategieService.deleteStrategieItem(itemId);
      window.toastSystem?.show('Item erfolgreich gelöscht', 'success');
      await this.init(this.strategieId);
    } catch (error) {
      console.error('Fehler beim Löschen des Items:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  /**
   * Item zu Video hinzufügen (Platzhalter)
   */
  async handleAddToVideo(itemId) {
    window.toastSystem?.show('Diese Funktion wird demnächst implementiert', 'info');
    console.log('Add to Video:', itemId);
  }

  /**
   * Cleanup
   */
  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
  }
}

// Singleton-Instanz exportieren
export const strategieDetail = new StrategieDetail();

