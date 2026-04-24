// StrategieDetail.js
// Detail-Ansicht einer Strategie mit Items und Screenshot-Generierung

import { strategieService } from './StrategieService.js';
import { AddToVideoDrawer } from './AddToVideoDrawer.js';
import { AddItemDrawer } from './AddItemDrawer.js';

export class StrategieDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this._tableEventListeners = new Set();
    this._dragScrollAbort = null;
    this.strategie = null;
    this.items = [];
    this.draggedItem = null;
    this.isKunde = false; // Wird in init() gesetzt
  }

  /**
   * Initialisiere Strategie-Detail
   */
  async init(strategieId) {
    this.strategieId = strategieId;
    this.isKunde = window.currentUser?.rolle === 'kunde';

    try {
      // Daten laden
      this.strategie = await strategieService.getStrategieById(strategieId);
      this.items = await strategieService.getStrategieItems(strategieId);

      // Breadcrumb
      if (window.breadcrumbSystem && this.strategie) {
        window.breadcrumbSystem.updateDetailLabel(this.strategie.name);
      }

      window.setHeadline(''); // Name wird bereits in Breadcrumb angezeigt

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

    const addSection = window.content.querySelector('.add-item-section--compact');
    if (addSection) {
      const h = addSection.offsetHeight;
      window.content.style.setProperty('--sticky-add-section-height', h + 'px');
    }
  }

  /**
   * Rendere Header mit Strategie-Infos
   */
  renderHeader() {
    return ''; // Name wird bereits in Breadcrumb angezeigt
  }

  /**
   * Rendere Section zum Hinzufügen von Items (Button + Kategorien-Verwaltung)
   */
  renderAddItemSection() {
    return `
      <div class="add-item-section add-item-section--compact">
        <div class="add-item-actions-right">
          <button type="button" class="primary-btn" id="btn-open-add-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Hinzufügen
          </button>
          <button type="button" class="secondary-btn" id="btn-manage-kategorien" title="Kategorien verwalten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
            Kategorien
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Kategorien-Drawer ID
   */
  get kategorienDrawerId() {
    return 'kategorien-drawer';
  }

  /**
   * Rendere Drawer-Body für Kategorien-Verwaltung
   */
  renderKategorienDrawerBody() {
    const teilbereiche = this.getTeilbereicheFromStrategie();
    
    return `
      <div class="kategorien-list" id="kategorien-list">
        ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
          <div class="kategorie-item" data-kategorie="${tb}">
            <span class="kategorie-name">${tb}</span>
            <button type="button" class="kategorie-delete-btn" data-action="edit-kategorie" data-kategorie="${tb}" title="Kategorie bearbeiten">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 3.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 15.07a4.5 4.5 0 0 1-1.897 1.13L6 17l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5" /></svg>
            </button>
            <button type="button" class="kategorie-delete-btn" data-action="delete-kategorie" data-kategorie="${tb}" title="Kategorie löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        `).join('') : '<p class="no-kategorien">Keine Kategorien vorhanden</p>'}
      </div>
      <div class="kategorie-add-form">
        <input type="text" id="new-kategorie-input" class="form-input" placeholder="Neue Kategorie...">
        <button type="button" class="primary-btn" id="btn-add-kategorie">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Hinzufügen
        </button>
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
        <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
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
              <th class="col-number">#</th>
              ${!this.isKunde ? '<th class="col-drag"></th>' : ''}
              <th class="col-image">Bild</th>
              <th class="col-platform">Plattform</th>
              <th class="col-link">Link</th>
              <th class="col-beschreibung">Beschreibung</th>
              <th class="col-anmerkung">Anmerkung Kunde</th>
              <th class="col-prio">Prio 1</th>
              <th class="col-prio">Prio 2</th>
              <th class="col-nicht-umsetzen">Nicht umsetzen</th>
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
    // Alle definierten Kategorien holen (damit auch leere angezeigt werden)
    const definierteKategorien = this.getTeilbereicheFromStrategie();
    const hatDefinierteKategorien = definierteKategorien.length > 0;
    
    // Wenn keine Kategorien definiert sind und nur "Ohne Kategorie" Items existieren
    if (!hatDefinierteKategorien && Object.keys(groupedItems).length === 1 && groupedItems['Ohne Kategorie']) {
      return groupedItems['Ohne Kategorie']
        .map(item => this.renderItemRow(item, item.globalIndex))
        .join('');
    }
    
    // Alle Kategorien sammeln: definierte + "Ohne Kategorie"
    const alleKategorien = [...definierteKategorien];
    if (!alleKategorien.includes('Ohne Kategorie')) {
      alleKategorien.push('Ohne Kategorie');
    }
    
    // Mit Kategorie-Headern rendern (auch leere Kategorien)
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
    const ideaIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; color: var(--amber-500);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`;
    const isIdea = !item.video_link;
    const isLinked = !!item.linked_video;

    return `
      <tr class="item-row ${!this.isKunde ? 'draggable' : ''} ${isIdea ? 'idea-row' : ''}" data-item-id="${item.id}" draggable="${!this.isKunde}">
        <td class="col-number">
          ${index + 1}
        </td>
        ${!this.isKunde ? `
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
          ${!this.isKunde ? `
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
            class="strategie-textarea ${this.isKunde ? '' : 'readonly-textarea'}" 
            placeholder="${this.isKunde ? 'Ihre Anmerkung...' : 'Anmerkung Kunde...'}"
            data-field="kunde_anmerkung"
            data-item-id="${item.id}"
            ${this.isKunde ? '' : 'readonly'}
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
    this._cleanupTableEvents();

    // Event-Listener für Strategie-Item Verknüpfung (aus AddToVideoDrawer)
    const linkHandler = async (event) => {
      const { itemId } = event.detail;
      // Items neu laden um linked_video Status zu aktualisieren
      this.items = await strategieService.getStrategieItems(this.strategieId);
      this.rerenderItemsTable();
    };
    window.addEventListener('strategieItemLinked', linkHandler);
    this._boundEventListeners.add(() => window.removeEventListener('strategieItemLinked', linkHandler));

    // Event-Listener für Live-Updates aus AddItemDrawer
    const itemCreatedHandler = async (event) => {
      if (event.detail?.strategieId === this.strategieId) {
        // Items neu laden und Tabelle aktualisieren
        this.items = await strategieService.getStrategieItems(this.strategieId);
        this.rerenderItemsTable();
      }
    };
    window.addEventListener('strategieItemCreated', itemCreatedHandler);
    this._boundEventListeners.add(() => window.removeEventListener('strategieItemCreated', itemCreatedHandler));

    // Button zum Öffnen des Add-Drawers
    if (!this.isKunde) {
      const openDrawerBtn = document.getElementById('btn-open-add-drawer');
      if (openDrawerBtn) {
        const handler = () => this.openAddItemDrawer();
        openDrawerBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => openDrawerBtn.removeEventListener('click', handler));
      }

      // Kategorien-Verwaltung Button
      const manageKategorienBtn = document.getElementById('btn-manage-kategorien');
      if (manageKategorienBtn) {
        const handler = () => this.showKategorienModal();
        manageKategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => manageKategorienBtn.removeEventListener('click', handler));
      }
    }

    // Table-spezifische Events binden (Inputs, Checkboxen, Actions, Drag&Drop, Scroll)
    this._bindTableEvents();
  }

  /**
   * Cleanup nur der Table-Events (bei Rerender)
   */
  _cleanupTableEvents() {
    this._tableEventListeners.forEach(cleanup => cleanup());
    this._tableEventListeners.clear();
  }

  /**
   * Alle Table-spezifischen Events binden (wiederverwendbar für bindEvents + rerenderItemsTable)
   */
  _bindTableEvents() {
    this._cleanupTableEvents();

    // Drag & Drop
    if (!this.isKunde) {
      this.bindDragAndDropEvents();
    }

    // Beschreibung/Anmerkung Inputs
    document.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
      const handler = () => this.handleFieldUpdate(input);
      input.addEventListener('blur', handler);
      this._tableEventListeners.add(() => input.removeEventListener('blur', handler));
    });

    // Checkbox Auswahl (Prio 1, Prio 2, Nicht umsetzen)
    document.querySelectorAll('input[type="checkbox"][data-field]').forEach(checkbox => {
      const handler = () => this.handleFieldUpdate(checkbox);
      checkbox.addEventListener('change', handler);
      this._tableEventListeners.add(() => checkbox.removeEventListener('change', handler));
    });

    // Actions Dropdown (Edit, Delete, Add to Video)
    if (!this.isKunde) {
      document.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.showEditItemDrawer(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._tableEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleDeleteItem(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._tableEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="add-to-video"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleAddToVideo(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._tableEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="unlink-from-video"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleUnlinkFromVideo(btn.dataset.id, btn.dataset.videoId);
        };
        btn.addEventListener('click', handler);
        this._tableEventListeners.add(() => btn.removeEventListener('click', handler));
      });
    }

    // Drag-to-Scroll (horizontales Ziehen)
    this.bindDragToScroll();
  }

  /**
   * Drag-to-Scroll für horizontales Scrollen der Tabelle (AbortController-Pattern)
   */
  bindDragToScroll() {
    const container = document.querySelector('.table-container');
    if (!container) return;

    this._dragScrollAbort?.abort();
    this._dragScrollAbort = new AbortController();
    const signal = this._dragScrollAbort.signal;

    container.classList.add('drag-scroll-enabled');

    container.addEventListener('mousedown', (e) => {
      if (
        e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'A' || e.target.closest('a') ||
        e.target.closest('.actions-dropdown-container') ||
        e.target.closest('.drag-handle')
      ) return;

      this._isDragScrolling = true;
      this._dragStartX = e.pageX - container.offsetLeft;
      this._dragScrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    }, { signal });

    container.addEventListener('mousemove', (e) => {
      if (!this._isDragScrolling) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = this._dragScrollLeft - (x - this._dragStartX) * 1.5;
    }, { signal });

    const stopDragging = () => {
      if (this._isDragScrolling) {
        this._isDragScrolling = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    container.addEventListener('mouseup', stopDragging, { signal });
    container.addEventListener('mouseleave', stopDragging, { signal });

    container.style.cursor = 'grab';
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
      this._tableEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

      // Dragend
      const dragendHandler = () => {
        row.style.opacity = '1';
        this.draggedItem = null;
        this.draggedItemId = null;
        document.querySelectorAll('.category-header-row').forEach(h => {
          h.classList.remove('drag-over');
        });
      };
      row.addEventListener('dragend', dragendHandler);
      this._tableEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

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
      this._tableEventListeners.add(() => row.removeEventListener('dragover', dragoverHandler));

      // Drop auf Item-Zeilen
      const dropHandler = (e) => {
        e.stopPropagation();
        this.handleSortUpdate();
      };
      row.addEventListener('drop', dropHandler);
      this._tableEventListeners.add(() => row.removeEventListener('drop', dropHandler));
    });

    // Kategorie-Header als Drop-Ziele
    categoryHeaders.forEach(header => {
      const kategorie = header.dataset.kategorie;
      
      // Dragover auf Kategorie-Header
      const dragoverHandler = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      };
      header.addEventListener('dragover', dragoverHandler);
      this._tableEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

      // Dragleave
      const dragleaveHandler = () => {
        header.classList.remove('drag-over');
      };
      header.addEventListener('dragleave', dragleaveHandler);
      this._tableEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

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
      this._tableEventListeners.add(() => header.removeEventListener('drop', dropHandler));
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
   * AddItemDrawer öffnen
   */
  openAddItemDrawer() {
    const teilbereiche = this.getTeilbereicheFromStrategie();
    const drawer = new AddItemDrawer();
    drawer.open(this.strategie, teilbereiche);
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
   * Nur die Tabelle neu rendern und Events neu binden
   */
  rerenderItemsTable() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;

    tableContainer.outerHTML = this.renderItemsTable();
    
    this._bindTableEvents();
  }

  /**
   * Sortierung aktualisieren nach Drag & Drop
   */
  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    
    // Ermittle für jedes Item den aktuellen Teilbereich basierend auf Position in der Tabelle
    let currentKategorie = null;
    const updatedItems = [];
    
    allRows.forEach(row => {
      if (row.classList.contains('category-header-row')) {
        // Kategorie-Header gefunden - merke die aktuelle Kategorie (aus data-attribut)
        const kategorieFromData = row.dataset.kategorie;
        currentKategorie = kategorieFromData === 'Ohne Kategorie' ? null : kategorieFromData;
      } else if (row.classList.contains('item-row')) {
        // Item-Zeile gefunden
        const itemId = row.dataset.itemId;
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          updatedItems.push({
            ...item,
            teilbereich: currentKategorie
          });
        }
      }
    });

    try {
      // Sortierung und Teilbereich aktualisieren
      await strategieService.updateItemsSortierungWithTeilbereich(updatedItems);
      this.items = updatedItems;
      
      // Tabelle neu rendern um Nummerierung zu aktualisieren
      this.rerenderItemsTable();
      
      window.toastSystem?.show('Sortierung gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Sortierung:', error);
      window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
    }
  }

  /**
   * Edit-Drawer ID
   */
  get editItemDrawerId() {
    return 'edit-item-drawer';
  }

  /**
   * Edit-Item-Drawer anzeigen
   */
  showEditItemDrawer(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) {
      window.toastSystem?.show('Item nicht gefunden', 'error');
      return;
    }

    // Entferne bestehendes Drawer
    this.removeEditItemDrawer();
    
    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.editItemDrawerId}-overlay`;
    
    // Erstelle Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.editItemDrawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Item bearbeiten';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = item.video_link ? 'Video-Eintrag anpassen' : 'Idee anpassen';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.editItemDrawerId}-body`;
    body.innerHTML = this.renderEditItemDrawerBody(item);

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.closeEditItemDrawer());
    closeBtn.addEventListener('click', () => this.closeEditItemDrawer());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
    
    // Form-Events binden
    this.bindEditItemDrawerEvents(itemId);
  }

  /**
   * Edit-Item-Drawer Body rendern
   */
  renderEditItemDrawerBody(item) {
    const teilbereiche = this.getTeilbereicheFromStrategie();
    
    return `
      <form id="edit-item-form" class="drawer-form">
        <div class="form-field">
          <label for="edit-video-url">Video-URL (optional)</label>
          <input 
            type="url" 
            id="edit-video-url" 
            name="video_link" 
            class="form-input" 
            value="${item.video_link || ''}"
            placeholder="https://youtube.com/... oder leer für Idee"
          >
        </div>

        <div class="form-field">
          <label for="edit-teilbereich">Kategorie</label>
          <select id="edit-teilbereich" name="teilbereich" class="form-input">
            <option value="">Ohne Kategorie</option>
            ${teilbereiche.map(tb => `<option value="${tb}" ${item.teilbereich === tb ? 'selected' : ''}>${tb}</option>`).join('')}
          </select>
        </div>

        <div class="form-field">
          <label for="edit-beschreibung">Beschreibung</label>
          <textarea 
            id="edit-beschreibung" 
            name="beschreibung" 
            class="form-input" 
            rows="3"
            placeholder="Beschreibung für das Video/die Idee..."
          >${item.beschreibung || ''}</textarea>
        </div>

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
        </div>
      </form>
    `;
  }

  /**
   * Edit-Item-Drawer Events binden
   */
  bindEditItemDrawerEvents(itemId) {
    const form = document.getElementById('edit-item-form');
    const cancelBtn = form?.querySelector('[data-action="close-drawer"]');
    
    cancelBtn?.addEventListener('click', () => this.closeEditItemDrawer());
    
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleEditItemSubmit(itemId, new FormData(form));
    });
  }

  /**
   * Edit-Item speichern
   */
  async handleEditItemSubmit(itemId, formData) {
    const submitBtn = document.querySelector('#edit-item-form button[type="submit"]');
    const originalText = submitBtn?.innerHTML;
    
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Speichern...';
      }

      const videoUrl = formData.get('video_link')?.trim() || null;
      const teilbereich = formData.get('teilbereich') || null;
      const beschreibung = formData.get('beschreibung')?.trim() || null;

      // Plattform aus URL erkennen
      let platform = null;
      if (videoUrl) {
        if (videoUrl.includes('tiktok.com')) platform = 'tiktok';
        else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) platform = 'youtube';
        else if (videoUrl.includes('instagram.com')) platform = 'instagram';
        else platform = 'other';
      }

      // Item aktualisieren
      await strategieService.updateStrategieItem(itemId, {
        video_link: videoUrl,
        teilbereich: teilbereich,
        beschreibung: beschreibung,
        plattform: platform
      });

      // Lokalen State aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item.video_link = videoUrl;
        item.teilbereich = teilbereich;
        item.beschreibung = beschreibung;
        item.plattform = platform;
      }

      window.toastSystem?.show('Änderungen gespeichert', 'success');
      this.closeEditItemDrawer();
      this.rerenderItemsTable();

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  /**
   * Edit-Item-Drawer entfernen
   */
  removeEditItemDrawer() {
    document.getElementById(`${this.editItemDrawerId}-overlay`)?.remove();
    document.getElementById(this.editItemDrawerId)?.remove();
  }

  /**
   * Edit-Item-Drawer schließen
   */
  closeEditItemDrawer() {
    const panel = document.getElementById(this.editItemDrawerId);
    
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeEditItemDrawer();
      }, 300);
    } else {
      this.removeEditItemDrawer();
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
   * Item zu Video hinzufügen - öffnet AddToVideoDrawer
   */
  async handleAddToVideo(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) {
      window.toastSystem?.show('Item nicht gefunden', 'error');
      return;
    }

    const drawer = new AddToVideoDrawer();
    await drawer.open(item, this.strategie);
  }

  /**
   * Verknüpfung zwischen Item und Video entfernen
   */
  async handleUnlinkFromVideo(itemId, videoId) {
    const result = await window.confirmationModal?.open({
      title: 'Verknüpfung entfernen?',
      message: 'Möchten Sie die Verknüpfung zwischen dieser Idee und dem Video wirklich entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      // Verknüpfung im Video entfernen (strategie_item_id auf null setzen)
      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ strategie_item_id: null })
        .eq('id', videoId);

      if (error) throw error;

      // Lokalen State aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item.linked_video = null;
      }

      window.toastSystem?.show('Verknüpfung erfolgreich entfernt', 'success');
      
      // Tabelle neu rendern
      this.rerenderItemsTable();

    } catch (error) {
      console.error('Fehler beim Entfernen der Verknüpfung:', error);
      window.toastSystem?.show('Fehler beim Entfernen der Verknüpfung', 'error');
    }
  }

  /**
   * Kategorien-Drawer anzeigen
   */
  showKategorienModal() {
    // Entferne bestehendes Drawer falls vorhanden
    this.removeKategorienDrawer();
    
    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.kategorienDrawerId}-overlay`;
    
    // Erstelle Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.kategorienDrawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Kategorien verwalten';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Kategorien hinzufügen oder entfernen';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.kategorienDrawerId}-body`;
    body.innerHTML = this.renderKategorienDrawerBody();

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.closeKategorienModal());
    closeBtn.addEventListener('click', () => this.closeKategorienModal());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
    
    // Body-Events binden
    this.bindKategorienDrawerEvents();
  }

  /**
   * Events für Kategorien-Drawer binden
   */
  bindKategorienDrawerEvents() {
    const addBtn = document.getElementById('btn-add-kategorie');
    const input = document.getElementById('new-kategorie-input');
    
    // Hinzufügen-Events
    const addHandler = () => this.handleAddKategorie();
    addBtn?.addEventListener('click', addHandler);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addHandler();
      }
    });
    
    // Bearbeiten-Events
    document.querySelectorAll('[data-action="edit-kategorie"]').forEach(btn => {
      btn.addEventListener('click', () => this.startInlineEdit(btn.dataset.kategorie));
    });

    // Löschen-Events
    document.querySelectorAll('[data-action="delete-kategorie"]').forEach(btn => {
      btn.addEventListener('click', () => this.handleDeleteKategorie(btn.dataset.kategorie));
    });
    
    // Focus auf Input
    input?.focus();
  }

  /**
   * Kategorien-Drawer entfernen
   */
  removeKategorienDrawer() {
    document.getElementById(`${this.kategorienDrawerId}-overlay`)?.remove();
    document.getElementById(this.kategorienDrawerId)?.remove();
  }

  /**
   * Kategorien-Drawer schließen mit Animation
   */
  closeKategorienModal() {
    const panel = document.getElementById(this.kategorienDrawerId);
    const overlay = document.getElementById(`${this.kategorienDrawerId}-overlay`);
    
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeKategorienDrawer();
      }, 300);
    } else {
      this.removeKategorienDrawer();
    }
  }

  /**
   * Neue Kategorie hinzufügen
   */
  async handleAddKategorie() {
    const input = document.getElementById('new-kategorie-input');
    const newKategorie = input?.value?.trim();
    
    if (!newKategorie) {
      window.toastSystem?.show('Bitte Kategorie-Name eingeben', 'warning');
      return;
    }
    
    // Prüfen ob Kategorie bereits existiert
    const existingKategorien = this.getTeilbereicheFromStrategie();
    if (existingKategorien.includes(newKategorie)) {
      window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
      return;
    }
    
    try {
      // Neue Kategorien-Liste erstellen
      const updatedKategorien = [...existingKategorien, newKategorie];
      const teilbereichString = updatedKategorien.join(', ');
      
      // Strategie aktualisieren
      await strategieService.updateStrategie(this.strategieId, { teilbereich: teilbereichString });
      
      // Lokalen State aktualisieren
      this.strategie.teilbereich = teilbereichString;
      
      // Drawer-Body neu rendern
      this.rerenderKategorienDrawerBody();
      
      // Dropdown aktualisieren
      this.updateKategorienDropdown();
      
      window.toastSystem?.show(`Kategorie "${newKategorie}" hinzugefügt`, 'success');
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen der Kategorie', 'error');
    }
  }

  /**
   * Inline-Edit für Kategorie starten
   */
  startInlineEdit(kategorie) {
    const row = document.querySelector(`.kategorie-item[data-kategorie="${kategorie}"]`);
    if (!row) return;

    const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>';
    const cancelSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>';

    row.innerHTML = `
      <input type="text" class="form-input" value="${kategorie}" data-edit-kategorie="${kategorie}">
      <button type="button" class="kategorie-delete-btn" data-action="save-kategorie" title="Speichern">${checkSvg}</button>
      <button type="button" class="kategorie-delete-btn" data-action="cancel-edit" title="Abbrechen">${cancelSvg}</button>
    `;

    const input = row.querySelector('input');
    input.focus();
    input.select();

    let saving = false;

    const save = async () => {
      if (saving) return;
      saving = true;
      await this.handleRenameKategorie(kategorie, input.value);
    };

    const cancel = () => {
      this.rerenderKategorienDrawerBody();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    row.querySelector('[data-action="save-kategorie"]').addEventListener('click', save);
    row.querySelector('[data-action="cancel-edit"]').addEventListener('click', cancel);
  }

  /**
   * Kategorie umbenennen
   */
  async handleRenameKategorie(oldKategorie, newKategorieInput) {
    const newKategorie = newKategorieInput?.trim();

    if (!newKategorie) {
      window.toastSystem?.show('Bitte Kategorie-Name eingeben', 'warning');
      return;
    }

    if (newKategorie.includes(',')) {
      window.toastSystem?.show('Kommas sind im Kategorienamen nicht erlaubt', 'warning');
      return;
    }

    const oldKategorieNormalized = oldKategorie?.trim().toLowerCase();
    const newKategorieNormalized = newKategorie.toLowerCase();
    const existingKategorien = this.getTeilbereicheFromStrategie();

    const hasDuplicate = existingKategorien.some(k => (
      k.trim().toLowerCase() === newKategorieNormalized &&
      k.trim().toLowerCase() !== oldKategorieNormalized
    ));

    if (hasDuplicate) {
      window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
      return;
    }

    const unchangedName = newKategorieNormalized === oldKategorieNormalized;
    if (unchangedName) return;

    try {
      // Kategorien-Liste aktualisieren
      const updatedKategorien = existingKategorien.map(k => (k === oldKategorie ? newKategorie : k));
      const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;

      await strategieService.updateStrategie(this.strategieId, { teilbereich: teilbereichString });

      // Nur betroffene Items aktualisieren
      const itemsToUpdate = this.items.filter(item => item.teilbereich === oldKategorie);
      await Promise.all(itemsToUpdate.map(item => (
        strategieService.updateStrategieItem(item.id, { teilbereich: newKategorie })
      )));

      itemsToUpdate.forEach(item => {
        item.teilbereich = newKategorie;
      });

      this.strategie.teilbereich = teilbereichString;
      this.rerenderKategorienDrawerBody();
      this.rerenderItemsTable();

      window.toastSystem?.show(`Kategorie "${oldKategorie}" wurde umbenannt`, 'success');
    } catch (error) {
      console.error('Fehler beim Umbenennen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Umbenennen der Kategorie', 'error');
    }
  }

  /**
   * Kategorie löschen
   */
  async handleDeleteKategorie(kategorie) {
    const result = await window.confirmationModal?.open({
      title: 'Kategorie löschen?',
      message: `Möchten Sie die Kategorie "${kategorie}" wirklich löschen? Videos in dieser Kategorie werden zu "Ohne Kategorie" verschoben.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;
    
    try {
      // Kategorie aus Liste entfernen
      const existingKategorien = this.getTeilbereicheFromStrategie();
      const updatedKategorien = existingKategorien.filter(k => k !== kategorie);
      const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;
      
      // Strategie aktualisieren
      await strategieService.updateStrategie(this.strategieId, { teilbereich: teilbereichString });
      
      // Alle Items dieser Kategorie auf null setzen
      const itemsToUpdate = this.items.filter(item => item.teilbereich === kategorie);
      for (const item of itemsToUpdate) {
        await strategieService.updateStrategieItem(item.id, { teilbereich: null });
        item.teilbereich = null;
      }
      
      // Lokalen State aktualisieren
      this.strategie.teilbereich = teilbereichString;
      
      // Drawer-Body neu rendern
      this.rerenderKategorienDrawerBody();
      
      // Dropdown und Tabelle aktualisieren
      this.updateKategorienDropdown();
      this.rerenderItemsTable();
      
      window.toastSystem?.show(`Kategorie "${kategorie}" gelöscht`, 'success');
    } catch (error) {
      console.error('Fehler beim Löschen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Löschen der Kategorie', 'error');
    }
  }

  /**
   * Drawer-Body neu rendern (ohne den ganzen Drawer zu schließen)
   */
  rerenderKategorienDrawerBody() {
    const body = document.getElementById(`${this.kategorienDrawerId}-body`);
    if (body) {
      body.innerHTML = this.renderKategorienDrawerBody();
      this.bindKategorienDrawerEvents();
    }
  }

  /**
   * Kategorien-Dropdown aktualisieren (nicht mehr benötigt, da Dropdown im Drawer)
   */
  updateKategorienDropdown() {
    // Dropdown ist jetzt im AddItemDrawer, diese Methode ist nur noch für Kompatibilität
  }

  /**
   * Cleanup
   */
  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this._cleanupTableEvents();
    this._dragScrollAbort?.abort();
    this._dragScrollAbort = null;
    this.removeKategorienDrawer();
    this.removeEditItemDrawer();
  }
}

// Singleton-Instanz exportieren
export const strategieDetail = new StrategieDetail();

