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
    // Drag-to-Scroll State
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
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

    return `
      <div class="table-container creator-pool-table-container">
        <table class="data-table strategie-items-table creator-pool-table">
          <thead>
            <tr>
              ${!this.isKunde ? '<th class="col-drag col-sticky-1 cp-col-drag"></th>' : ''}
              <th class="${this.isKunde ? 'col-sticky-1' : 'col-sticky-2'} cp-col-name">Name</th>
              <th class="${this.isKunde ? 'col-sticky-2' : 'col-sticky-3'} cp-col-typ">Creator Art</th>
              <th class="cp-col-link">Link IG</th>
              <th class="cp-col-follower">Follower IG</th>
              <th class="cp-col-link">Link TikTok</th>
              <th class="cp-col-follower">Follower TikTok</th>
              <th class="cp-col-check">Rückmeldung</th>
              <th class="cp-col-kategorie">Kategorie</th>
              <th class="cp-col-location">Location</th>
              <th class="cp-col-notiz">Notiz</th>
              <th class="cp-col-prio">Prio 1</th>
              <th class="cp-col-prio">Prio 2</th>
              <th class="cp-col-nicht">Nicht umsetzen</th>
              <th class="cp-col-pricing">Pricing</th>
              <th class="cp-col-feedback">Feedback Kunde</th>
              ${!this.isKunde ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
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

    const formatFollower = (count) => {
      if (!count) return '';
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toLocaleString('de-DE');
    };

    return `
      <tr class="item-row ${!this.isKunde ? 'draggable' : ''} ${isLinkedToCRM ? 'item-linked' : ''} ${item.nicht_umsetzen ? 'item-nicht-umsetzen' : ''}" data-item-id="${item.id}" draggable="${!this.isKunde}">
        ${!this.isKunde ? `
          <td class="col-drag drag-handle col-sticky-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </td>
        ` : ''}
        <td class="cell-textarea ${this.isKunde ? 'col-sticky-1' : 'col-sticky-2'}">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.name || '-'}</div>`}
        </td>
        <td class="cell-textarea ${this.isKunde ? 'col-sticky-2' : 'col-sticky-3'}">
          ${!this.isKunde ? `
            <select 
              class="strategie-textarea" 
              data-field="typ" 
              data-item-id="${item.id}"
              style="border: none; background: transparent; cursor: pointer;"
            >
              <option value="">-</option>
              <option value="IGC" ${item.typ === 'IGC' ? 'selected' : ''}>IGC</option>
              <option value="UGC" ${item.typ === 'UGC' ? 'selected' : ''}>UGC</option>
              <option value="Influencer" ${item.typ === 'Influencer' ? 'selected' : ''}>Influencer</option>
              <option value="Videograf" ${item.typ === 'Videograf' ? 'selected' : ''}>Videograf</option>
            </select>
          ` : `<div class="cell-text-readonly">${item.typ || '-'}</div>`}
        </td>
        <td class="cell-textarea" style="text-align: center;">
          ${!this.isKunde ? `
            <div class="link-cell-wrapper">
              ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${externalLinkIcon}</a>` : ''}
              <textarea class="strategie-textarea link-input" data-field="link_instagram" data-item-id="${item.id}" placeholder="Link...">${item.link_instagram || ''}</textarea>
            </div>
          ` : item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${externalLinkIcon}</a>` : `<div class="cell-text-readonly">-</div>`}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="follower_instagram" data-item-id="${item.id}" placeholder="0">${item.follower_instagram || ''}</textarea>
          ` : `<div class="cell-text-readonly">${formatFollower(item.follower_instagram) || '-'}</div>`}
        </td>
        <td class="cell-textarea" style="text-align: center;">
          ${!this.isKunde ? `
            <div class="link-cell-wrapper">
              ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${externalLinkIcon}</a>` : ''}
              <textarea class="strategie-textarea link-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="Link...">${item.link_tiktok || ''}</textarea>
            </div>
          ` : item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${externalLinkIcon}</a>` : `<div class="cell-text-readonly">-</div>`}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="follower_tiktok" data-item-id="${item.id}" placeholder="0">${item.follower_tiktok || ''}</textarea>
          ` : `<div class="cell-text-readonly">${formatFollower(item.follower_tiktok) || '-'}</div>`}
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.rueckmeldung_creator ? 'checked' : ''} 
            data-field="rueckmeldung_creator"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: ${this.isKunde ? 'default' : 'pointer'};"
            ${this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="kategorie" data-item-id="${item.id}" placeholder="Kategorie...">${item.kategorie || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.kategorie || '-'}</div>`}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="wohnort" data-item-id="${item.id}" placeholder="Location...">${item.wohnort || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.wohnort || '-'}</div>`}
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="notiz" data-item-id="${item.id}" placeholder="Notiz...">${item.notiz || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.notiz || '-'}</div>`}
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.prio_1 ? 'checked' : ''} 
            data-field="prio_1"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: ${this.isKunde ? 'pointer' : 'default'}; ${!this.isKunde ? 'pointer-events: none;' : ''}"
          >
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.prio_2 ? 'checked' : ''} 
            data-field="prio_2"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: ${this.isKunde ? 'pointer' : 'default'}; ${!this.isKunde ? 'pointer-events: none;' : ''}"
          >
        </td>
        <td style="text-align: center;">
          <input 
            type="checkbox" 
            ${item.nicht_umsetzen ? 'checked' : ''} 
            data-field="nicht_umsetzen"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: ${this.isKunde ? 'pointer' : 'default'}; ${!this.isKunde ? 'pointer-events: none;' : ''}"
          >
        </td>
        <td class="cell-textarea">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="pricing" data-item-id="${item.id}" placeholder="Preis...">${item.pricing || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.pricing || '-'}</div>`}
        </td>
        <td class="cell-textarea">
          <textarea 
            class="strategie-textarea ${this.isKunde ? '' : 'readonly-textarea'}" 
            data-field="feedback_kunde" 
            data-item-id="${item.id}" 
            placeholder="${this.isKunde ? 'Ihr Feedback...' : 'Kunden-Feedback...'}"
            ${this.isKunde ? '' : 'readonly'}
          >${item.feedback_kunde || ''}</textarea>
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

    // Floating Scrollbar und Drag-to-Scroll initialisieren
    this.initFloatingScrollbar();
    this.bindDragToScroll();

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
    } else if (field === 'follower_instagram' || field === 'follower_tiktok') {
      // Zahlenfelder parsen
      const numValue = element.value?.trim();
      value = numValue ? parseInt(numValue.replace(/[^\d]/g, ''), 10) : null;
    } else {
      value = element.value?.trim() || null;
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
        <p class="drawer-subtitle">Creator manuell zur Auswahlliste hinzufügen</p>
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
          <label class="form-label">Creator Art *</label>
          <select id="creator-typ" name="typ" class="form-input" required>
            <option value="">Bitte wählen...</option>
            <option value="IGC">IGC</option>
            <option value="UGC">UGC</option>
            <option value="Influencer">Influencer</option>
            <option value="Videograf">Videograf</option>
          </select>
        </div>

        <div class="form-field">
          <label class="form-label">Name *</label>
          <input type="text" id="creator-name" name="name" required class="form-input" placeholder="Name des Creators">
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Link Instagram</label>
            <input type="url" name="link_instagram" class="form-input" placeholder="https://instagram.com/...">
          </div>
          <div class="form-field">
            <label class="form-label">Follower IG</label>
            <input type="number" name="follower_instagram" class="form-input" placeholder="z.B. 10000">
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Link TikTok</label>
            <input type="url" name="link_tiktok" class="form-input" placeholder="https://tiktok.com/@...">
          </div>
          <div class="form-field">
            <label class="form-label">Follower TikTok</label>
            <input type="number" name="follower_tiktok" class="form-input" placeholder="z.B. 50000">
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Kategorie</label>
            <input type="text" name="kategorie" class="form-input" placeholder="z.B. Food, Fashion, Tech">
          </div>
          <div class="form-field">
            <label class="form-label">Location</label>
            <input type="text" name="wohnort" class="form-input" placeholder="z.B. Berlin">
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Notiz</label>
          <textarea name="notiz" class="form-input" rows="2" placeholder="Interne Notizen..."></textarea>
        </div>

        <div class="form-field">
          <label class="form-label">Pricing</label>
          <input type="text" name="pricing" class="form-input" placeholder="z.B. 500€ pro Video">
        </div>

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create" id="submit-btn">
            <span class="mdc-btn__label">Creator hinzufügen</span>
          </button>
        </div>
      </form>
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
   * Creator manuell hinzufügen
   */
  async handleAddCreatorSubmit(formData) {
    const typ = formData.get('typ')?.trim();
    const name = formData.get('name')?.trim();

    if (!typ || !name) {
      window.toastSystem?.show('Bitte Creator Art und Name ausfüllen', 'error');
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    
    try {
      submitBtn.disabled = true;

      // Item-Daten aus Formular zusammenstellen
      const itemData = {
        creator_auswahl_id: this.listeId,
        typ,
        name,
        link_instagram: formData.get('link_instagram')?.trim() || null,
        follower_instagram: formData.get('follower_instagram') ? parseInt(formData.get('follower_instagram'), 10) : null,
        link_tiktok: formData.get('link_tiktok')?.trim() || null,
        follower_tiktok: formData.get('follower_tiktok') ? parseInt(formData.get('follower_tiktok'), 10) : null,
        rueckmeldung_creator: formData.get('rueckmeldung_creator') === 'true',
        kategorie: formData.get('kategorie')?.trim() || null,
        wohnort: formData.get('wohnort')?.trim() || null,
        notiz: formData.get('notiz')?.trim() || null,
        pricing: formData.get('pricing')?.trim() || null,
        sortierung: this.items.length
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.items.push(newItem);

      window.toastSystem?.show('Creator erfolgreich hinzugefügt', 'success');
      this.closeDrawer();
      this.rerenderTable();

    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Hinzufügen des Creators', 'error');
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

  /**
   * Floating Scrollbar initialisieren
   */
  initFloatingScrollbar() {
    // Entferne vorhandene Floating Scrollbar
    const existingScrollbar = document.getElementById('floating-scrollbar-creator-auswahl');
    if (existingScrollbar) {
      existingScrollbar.remove();
    }

    const tableWrapper = document.querySelector('.table-container');
    if (!tableWrapper) return;

    // Erstelle Floating Scrollbar
    const floatingScrollbar = document.createElement('div');
    floatingScrollbar.id = 'floating-scrollbar-creator-auswahl';
    floatingScrollbar.className = 'floating-scrollbar-kampagne';

    const scrollbarInner = document.createElement('div');
    scrollbarInner.className = 'floating-scrollbar-inner';
    floatingScrollbar.appendChild(scrollbarInner);

    document.body.appendChild(floatingScrollbar);

    // Update Scrollbar-Größe und Position
    const updateScrollbarSize = () => {
      const table = tableWrapper.querySelector('table');
      if (table) {
        scrollbarInner.style.width = table.scrollWidth + 'px';
      }
      const wrapperRect = tableWrapper.getBoundingClientRect();
      floatingScrollbar.style.left = wrapperRect.left + 'px';
      floatingScrollbar.style.width = wrapperRect.width + 'px';
    };

    updateScrollbarSize();

    // Synchronisiere Scrolling
    const handleFloatingScroll = () => {
      if (this._isScrollingFromTable) return;
      this._isScrollingFromFloating = true;
      tableWrapper.scrollLeft = floatingScrollbar.scrollLeft;
      requestAnimationFrame(() => { this._isScrollingFromFloating = false; });
    };

    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);

    const handleTableScroll = () => {
      if (this._isScrollingFromFloating) return;
      this._isScrollingFromTable = true;
      floatingScrollbar.scrollLeft = tableWrapper.scrollLeft;
      requestAnimationFrame(() => { this._isScrollingFromTable = false; });
    };

    tableWrapper.addEventListener('scroll', handleTableScroll);

    // Zeige/Verstecke Floating-Scrollbar
    const toggleFloatingScrollbar = () => {
      const wrapperRect = tableWrapper.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const isTableVisible = wrapperRect.top < viewportHeight && wrapperRect.bottom > 0;
      const needsScroll = tableWrapper.scrollWidth > tableWrapper.clientWidth;

      if (isTableVisible && needsScroll && wrapperRect.bottom > viewportHeight) {
        floatingScrollbar.classList.add('visible');
        updateScrollbarSize();
      } else {
        floatingScrollbar.classList.remove('visible');
      }
    };

    toggleFloatingScrollbar();
    window.addEventListener('scroll', toggleFloatingScrollbar);
    window.addEventListener('resize', () => {
      updateScrollbarSize();
      toggleFloatingScrollbar();
    });

    // Cleanup-Funktion speichern
    this.cleanupFloatingScrollbar = () => {
      floatingScrollbar.classList.remove('visible');
      window.removeEventListener('scroll', toggleFloatingScrollbar);
      floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
      tableWrapper.removeEventListener('scroll', handleTableScroll);
      if (floatingScrollbar.parentNode) {
        floatingScrollbar.parentNode.removeChild(floatingScrollbar);
      }
    };
  }

  /**
   * Drag-to-Scroll für horizontales Scrollen
   */
  bindDragToScroll() {
    const container = document.querySelector('.table-container');
    if (!container) return;

    // Entferne alte Event-Listener
    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
    }

    this._dragMouseDown = (e) => {
      // Ignoriere wenn auf editierbare Elemente geklickt wird
      if (
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'A' ||
        e.target.closest('a') ||
        e.target.closest('.actions-dropdown-container') ||
        e.target.closest('.drag-handle')
      ) {
        return;
      }

      this.isDragging = true;
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;

      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';

      e.preventDefault();
    };

    this._dragMouseMove = (e) => {
      if (!this.isDragging) return;

      e.preventDefault();

      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeft - walk;
    };

    this._dragMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };

    container.addEventListener('mousedown', this._dragMouseDown);
    document.addEventListener('mousemove', this._dragMouseMove);
    document.addEventListener('mouseup', this._dragMouseUp);

    // Setze initialen Cursor und Klasse
    container.classList.add('drag-scroll-enabled');
    container.style.cursor = 'grab';
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.removeDrawer();
    
    // Cleanup Floating Scrollbar
    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }
    
    // Cleanup Drag-to-Scroll
    const container = document.querySelector('.table-container');
    if (container && this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
    }
  }
}

export const creatorAuswahlDetail = new CreatorAuswahlDetail();

