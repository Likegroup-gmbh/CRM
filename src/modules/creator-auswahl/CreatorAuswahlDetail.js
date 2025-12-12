// CreatorAuswahlDetail.js
// Detail-Ansicht einer Creator-Auswahl-Liste mit Scraping-Funktionalität

import { creatorAuswahlService } from './CreatorAuswahlService.js';

export class CreatorAuswahlDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this.liste = null;
    this.items = [];
    this.isKunde = false;
    this.draggedItem = null;
  }

  /**
   * Initialisiere Detail-Ansicht
   */
  async init(listeId) {
    this.listeId = listeId;
    const rolle = window.currentUser?.rolle?.toLowerCase();
    this.isKunde = rolle === 'kunde' || rolle === 'kunde_editor';

    try {
      this.liste = await creatorAuswahlService.getListeById(listeId);
      this.items = await creatorAuswahlService.getItems(listeId);

      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Creator-Auswahl', url: '/creator-auswahl', clickable: true },
          { label: this.liste.name, url: `/creator-auswahl/${listeId}`, clickable: false }
        ]);
      }

      window.setHeadline('');
      await this.render();
      this.bindEvents();

    } catch (error) {
      console.error('Fehler beim Laden:', error);
      window.content.innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden der Creator-Auswahl</p>
        </div>
      `;
    }
  }

  /**
   * Hauptrendering
   */
  async render() {
    const canEdit = !this.isKunde;

    const html = `
      ${canEdit ? this.renderAddSection() : ''}
      ${this.renderItemsTable()}
    `;

    window.content.innerHTML = html;
  }

  /**
   * Section zum Hinzufügen von Creatorn
   */
  renderAddSection() {
    return `
      <div class="add-item-section add-item-section--compact">
        <div class="add-item-actions-right">
          <button type="button" class="primary-btn" id="btn-open-add-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Creator hinzufügen
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Items-Tabelle rendern
   */
  renderItemsTable() {
    if (this.items.length === 0) {
      return `
        <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p>Noch keine Creator hinzugefügt</p>
          ${!this.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben einen Creator hinzu</p>' : ''}
        </div>
      `;
    }

    const colCount = this.isKunde ? 16 : 17;

    return `
      <div class="table-container" style="overflow-x: auto;">
        <table class="data-table creator-auswahl-table">
          <thead>
            <tr>
              ${!this.isKunde ? '<th class="col-drag"></th>' : ''}
              <th>UGC/IGC</th>
              <th>Bild</th>
              <th>Name</th>
              <th>Likes</th>
              <th>Beschreibung</th>
              <th>E-Mail</th>
              <th>Creator</th>
              <th>Link</th>
              <th>Rückmeldung</th>
              <th>Wohnort</th>
              <th>Gebucht</th>
              <th>Referenz</th>
              <th>Feedback CJ</th>
              <th>Feedback Kunde</th>
              <th>Prio 1</th>
              <th>Prio 2</th>
              <th>Auswahl</th>
              ${!this.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody id="items-table-body">
            ${this.items.map((item, index) => this.renderItemRow(item, index)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Einzelne Item-Zeile rendern
   */
  renderItemRow(item, index) {
    const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;
    const isLinkedToCRM = !!item.creator_id;

    return `
      <tr class="item-row ${!this.isKunde ? 'draggable' : ''} ${isLinkedToCRM ? 'item-linked' : ''}" data-item-id="${item.id}" draggable="${!this.isKunde}">
        ${!this.isKunde ? `
          <td class="col-drag drag-handle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </td>
        ` : ''}
        <td>
          <select 
            class="form-input form-input--compact" 
            data-field="typ" 
            data-item-id="${item.id}"
            ${this.isKunde ? 'disabled' : ''}
            style="width: 80px;"
          >
            <option value="">-</option>
            <option value="UGC" ${item.typ === 'UGC' ? 'selected' : ''}>UGC</option>
            <option value="IGC" ${item.typ === 'IGC' ? 'selected' : ''}>IGC</option>
          </select>
        </td>
        <td>
          ${item.profile_image_url ? `
            <img src="${item.profile_image_url}" alt="${item.name || 'Profil'}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="window.open('${item.profile_image_url}', '_blank')">
          ` : `
            <div style="width: 50px; height: 50px; background: var(--gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 24px; height: 24px; color: var(--text-muted);">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
          `}
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="text" class="form-input form-input--compact" value="${item.name || ''}" data-field="name" data-item-id="${item.id}" placeholder="Name" style="min-width: 100px;">
          ` : `<span>${item.name || '-'}</span>`}
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="number" class="form-input form-input--compact" value="${item.likes || ''}" data-field="likes" data-item-id="${item.id}" placeholder="0" style="width: 70px;">
          ` : `<span>${item.likes ? item.likes.toLocaleString('de-DE') : '-'}</span>`}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="form-input form-input--compact" data-field="beschreibung" data-item-id="${item.id}" placeholder="Bio..." rows="2" style="min-width: 150px;">${item.beschreibung || ''}</textarea>
          ` : `<span class="cell-text-readonly">${item.beschreibung || '-'}</span>`}
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="email" class="form-input form-input--compact" value="${item.email || ''}" data-field="email" data-item-id="${item.id}" placeholder="E-Mail" style="min-width: 120px;">
          ` : `<span>${item.email || '-'}</span>`}
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="text" class="form-input form-input--compact" value="${item.creator_handle || ''}" data-field="creator_handle" data-item-id="${item.id}" placeholder="@handle" style="min-width: 100px;">
          ` : `<span>${item.creator_handle || '-'}</span>`}
        </td>
        <td style="text-align: center;">
          ${item.link ? `
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); display: inline-flex;" title="${item.link}">
              ${externalLinkIcon}
            </a>
          ` : '-'}
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.rueckmeldung_creator ? 'checked' : ''} 
            data-field="rueckmeldung_creator"
            data-item-id="${item.id}"
            style="width: 18px; height: 18px; cursor: ${this.isKunde ? 'default' : 'pointer'};"
            ${this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="text" class="form-input form-input--compact" value="${item.wohnort || ''}" data-field="wohnort" data-item-id="${item.id}" placeholder="Wohnort" style="min-width: 80px;">
          ` : `<span>${item.wohnort || '-'}</span>`}
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.gebucht ? 'checked' : ''} 
            data-field="gebucht"
            data-item-id="${item.id}"
            style="width: 18px; height: 18px; cursor: ${this.isKunde ? 'default' : 'pointer'};"
            ${this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td>
          ${!this.isKunde ? `
            <input type="url" class="form-input form-input--compact" value="${item.referenz || ''}" data-field="referenz" data-item-id="${item.id}" placeholder="Link" style="min-width: 100px;">
          ` : item.referenz ? `<a href="${item.referenz}" target="_blank" style="color: var(--color-primary);">${externalLinkIcon}</a>` : '-'}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="form-input form-input--compact" data-field="feedback_cj" data-item-id="${item.id}" placeholder="CJ Feedback..." rows="2" style="min-width: 100px;">${item.feedback_cj || ''}</textarea>
          ` : `<span class="cell-text-readonly">${item.feedback_cj || '-'}</span>`}
        </td>
        <td class="cell-textarea">
          <textarea 
            class="form-input form-input--compact ${this.isKunde ? '' : 'readonly-textarea'}" 
            data-field="feedback_kunde" 
            data-item-id="${item.id}" 
            placeholder="${this.isKunde ? 'Ihr Feedback...' : 'Kunden-Feedback...'}" 
            rows="2" 
            style="min-width: 100px;"
            ${this.isKunde ? '' : 'readonly'}
          >${item.feedback_kunde || ''}</textarea>
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.prio_1 ? 'checked' : ''} 
            data-field="prio_1"
            data-item-id="${item.id}"
            style="width: 18px; height: 18px; cursor: pointer;"
            ${!this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.prio_2 ? 'checked' : ''} 
            data-field="prio_2"
            data-item-id="${item.id}"
            style="width: 18px; height: 18px; cursor: pointer;"
            ${!this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.ausgewaehlt ? 'checked' : ''} 
            data-field="ausgewaehlt"
            data-item-id="${item.id}"
            style="width: 18px; height: 18px; cursor: pointer;"
            ${!this.isKunde ? 'disabled' : ''}
          >
        </td>
        ${!this.isKunde ? `
          <td class="col-actions">
            <div class="actions-dropdown-container" data-entity-type="creator_auswahl_item">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              <div class="actions-dropdown">
                ${!isLinkedToCRM ? `
                  <a href="#" class="action-item" data-action="transfer-to-crm" data-id="${item.id}">
                    ${window.ActionsDropdown?.getHeroIcon('add-to-list') || ''}
                    Ins CRM übernehmen
                  </a>
                ` : `
                  <a href="#" class="action-item" data-action="view-crm-creator" data-creator-id="${item.creator_id}">
                    ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                    Im CRM anzeigen
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
   * Events binden
   */
  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Add-Button
    if (!this.isKunde) {
      const addBtn = document.getElementById('btn-open-add-drawer');
      if (addBtn) {
        const handler = () => this.openAddCreatorDrawer();
        addBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addBtn.removeEventListener('click', handler));
      }

      this.bindDragAndDropEvents();
    }

    // Feld-Updates (Input/Textarea/Select)
    document.querySelectorAll('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
      const handler = () => this.handleFieldUpdate(el);
      el.addEventListener('blur', handler);
      el.addEventListener('change', handler);
      this._boundEventListeners.add(() => {
        el.removeEventListener('blur', handler);
        el.removeEventListener('change', handler);
      });
    });

    // Actions Dropdown
    if (!this.isKunde) {
      document.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleDeleteItem(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="transfer-to-crm"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          this.handleTransferToCRM(btn.dataset.id);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });

      document.querySelectorAll('[data-action="view-crm-creator"]').forEach(btn => {
        const handler = (e) => {
          e.preventDefault();
          window.navigateTo(`/creator/${btn.dataset.creatorId}`);
        };
        btn.addEventListener('click', handler);
        this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
      });
    }

    // ActionsDropdown initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  }

  /**
   * Drag & Drop
   */
  bindDragAndDropEvents() {
    const rows = document.querySelectorAll('.item-row.draggable');
    
    rows.forEach(row => {
      const dragstartHandler = (e) => {
        this.draggedItem = row;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      };
      row.addEventListener('dragstart', dragstartHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

      const dragendHandler = () => {
        row.style.opacity = '1';
        this.draggedItem = null;
      };
      row.addEventListener('dragend', dragendHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

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

      const dropHandler = () => {
        this.handleSortUpdate();
      };
      row.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => row.removeEventListener('drop', dropHandler));
    });
  }

  /**
   * Sortierung speichern
   */
  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const rows = Array.from(tbody.querySelectorAll('.item-row'));
    
    const updatedItems = rows.map((row, index) => {
      const itemId = row.dataset.itemId;
      const item = this.items.find(i => i.id === itemId);
      return { ...item, sortierung: index };
    });

    try {
      await creatorAuswahlService.updateItemsSortierung(updatedItems);
      this.items = updatedItems;
      window.toastSystem?.show('Sortierung gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Speichern der Sortierung:', error);
      window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
    }
  }

  /**
   * Feld-Update
   */
  async handleFieldUpdate(element) {
    const itemId = element.dataset.itemId;
    const field = element.dataset.field;
    let value;

    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (element.type === 'number') {
      value = element.value ? parseInt(element.value, 10) : null;
    } else {
      value = element.value || null;
    }

    try {
      await creatorAuswahlService.updateItem(itemId, { [field]: value });
      
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item[field] = value;
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /**
   * Add-Creator-Drawer öffnen
   */
  openAddCreatorDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'add-creator-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'add-creator-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Creator hinzufügen</span>
        <p class="drawer-subtitle">TikTok oder Instagram Profil-URL eingeben</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="add-creator-form">
        <div class="form-field">
          <label class="form-label">Profil-URL *</label>
          <input type="url" id="creator-url" name="url" required class="form-input" placeholder="https://tiktok.com/@username oder https://instagram.com/username">
          <small style="color: var(--text-secondary); font-size: var(--text-xs); margin-top: var(--space-xs); display: block;">
            TikTok oder Instagram Profil-URL eingeben. Die Daten werden automatisch gescraped.
          </small>
        </div>

        <div class="form-field">
          <label class="form-label">Creator-Typ</label>
          <select id="creator-typ" name="typ" class="form-input">
            <option value="">Nicht festgelegt</option>
            <option value="UGC">UGC (User Generated Content)</option>
            <option value="IGC">IGC (Influencer Generated Content)</option>
          </select>
        </div>

        <div id="scrape-status" style="display: none; padding: var(--space-md); background: var(--gray-100); border-radius: var(--radius-md); margin-top: var(--space-md);">
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <div class="spinner" style="width: 20px; height: 20px; border: 2px solid var(--gray-300); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Lade Creator-Daten...</span>
          </div>
        </div>

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create" id="submit-btn">
            <span class="mdc-btn__label">Creator scrapen & hinzufügen</span>
          </button>
        </div>
      </form>

      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindAddCreatorEvents();
  }

  /**
   * Events für Add-Creator-Form
   */
  bindAddCreatorEvents() {
    const form = document.getElementById('add-creator-form');
    const closeBtn = form?.querySelector('[data-action="close-drawer"]');
    
    closeBtn?.addEventListener('click', () => this.closeDrawer());

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddCreatorSubmit(new FormData(form));
    });
  }

  /**
   * Creator hinzufügen (mit Scraping)
   */
  async handleAddCreatorSubmit(formData) {
    const url = formData.get('url')?.trim();
    const typ = formData.get('typ') || null;

    if (!url) {
      window.toastSystem?.show('Bitte URL eingeben', 'error');
      return;
    }

    const statusEl = document.getElementById('scrape-status');
    const submitBtn = document.getElementById('submit-btn');
    
    try {
      // Status anzeigen
      statusEl.style.display = 'block';
      submitBtn.disabled = true;

      // Scraping durchführen
      const scrapedData = await creatorAuswahlService.scrapeCreator(url);

      // Item erstellen
      const itemData = {
        creator_auswahl_id: this.listeId,
        typ,
        ...scrapedData,
        sortierung: this.items.length
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.items.push(newItem);

      window.toastSystem?.show('Creator erfolgreich hinzugefügt', 'success');
      this.closeDrawer();
      this.rerenderTable();

    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Scrapen des Creators', 'error');
      
      statusEl.style.display = 'none';
      submitBtn.disabled = false;
    }
  }

  /**
   * Item löschen
   */
  async handleDeleteItem(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Creator entfernen?',
      message: 'Möchten Sie diesen Creator wirklich aus der Liste entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await creatorAuswahlService.deleteItem(itemId);
      this.items = this.items.filter(i => i.id !== itemId);
      window.toastSystem?.show('Creator entfernt', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  /**
   * Creator ins CRM übernehmen
   */
  async handleTransferToCRM(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Ins CRM übernehmen?',
      message: 'Möchten Sie diesen Creator als neuen Eintrag ins CRM übernehmen?',
      confirmText: 'Übernehmen',
      cancelText: 'Abbrechen'
    });

    if (!result?.confirmed) return;

    try {
      const creator = await creatorAuswahlService.transferToCRM(itemId);
      
      // Item in lokalem State aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item.creator_id = creator.id;
      }

      window.toastSystem?.show('Creator erfolgreich ins CRM übernommen', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler bei CRM-Übernahme:', error);
      window.toastSystem?.show('Fehler bei der CRM-Übernahme', 'error');
    }
  }

  /**
   * Tabelle neu rendern
   */
  rerenderTable() {
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = this.renderItemsTable();
      this.bindEvents();
    }
  }

  removeDrawer() {
    ['add-creator-overlay', 'add-creator-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  closeDrawer() {
    document.getElementById('add-creator-overlay')?.classList.remove('active');
    document.getElementById('add-creator-drawer')?.classList.remove('show');
    setTimeout(() => this.removeDrawer(), 300);
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.removeDrawer();
  }
}

export const creatorAuswahlDetail = new CreatorAuswahlDetail();

