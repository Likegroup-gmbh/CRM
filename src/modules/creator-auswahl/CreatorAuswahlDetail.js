// CreatorAuswahlDetail.js
// Detail-Ansicht einer Creator-Auswahl-Liste mit Scraping-Funktionalität

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingDetailColumnVisibilityDrawer } from './SourcingDetailColumnVisibilityDrawer.js';

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
    // Spalten-Sichtbarkeit
    this.hiddenColumns = [];
    this.columnVisibilityDrawer = null;
  }

  /**
   * Initialisiere Detail-Ansicht
   */
  async init(listeId) {
    this.listeId = listeId;
    const rolle = window.currentUser?.rolle?.toLowerCase();
    this.isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    
    // FAB/Quick-Menu für Kunden verstecken
    if (this.isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) {
        quickMenuContainer.style.display = 'none';
      }
    }
    
    // Lade Spalten-Sichtbarkeits-Einstellungen
    this.loadColumnVisibilitySettings();

    try {
      this.liste = await creatorAuswahlService.getListeById(listeId);
      this.items = await creatorAuswahlService.getItems(listeId);

      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Sourcing', url: '/sourcing', clickable: true },
          { label: this.liste.name, url: `/sourcing/${listeId}`, clickable: false }
        ]);
      }

      // Bei leerer Liste automatisch eine Zeile vorbereiten (nur für Nicht-Kunden)
      if (this.items.length === 0 && !this.isKunde) {
        await this.createInitialEmptyRow();
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
   * Lade Spalten-Sichtbarkeits-Einstellungen aus localStorage (pro Liste)
   */
  loadColumnVisibilitySettings() {
    try {
      const key = `sourcing_detail_hidden_columns_${this.listeId}`;
      const stored = localStorage.getItem(key);
      this.hiddenColumns = stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.hiddenColumns = [];
    }
  }

  /**
   * Speichere Spalten-Sichtbarkeits-Einstellungen (pro Liste)
   */
  saveColumnVisibilitySettings() {
    try {
      const key = `sourcing_detail_hidden_columns_${this.listeId}`;
      localStorage.setItem(key, JSON.stringify(this.hiddenColumns));
    } catch (error) {
      console.error('Fehler beim Speichern der Spalten-Sichtbarkeit:', error);
    }
  }

  /**
   * Prüfe ob eine Spalte für Kunden sichtbar ist
   */
  isColumnVisibleForCustomer(columnClass) {
    const userRole = window.currentUser?.rolle?.toLowerCase();
    
    // Admin/Mitarbeiter sehen immer alles
    if (userRole === 'admin' || userRole === 'mitarbeiter') {
      return true;
    }
    
    // Name und Aktionen sind IMMER sichtbar für alle (essentiell)
    if (columnClass === 'cp-col-name' || columnClass === 'cp-col-actions' || columnClass === 'cp-col-drag') {
      return true;
    }
    
    // Kunden sehen nur nicht-versteckte Spalten
    const isVisible = !this.hiddenColumns.includes(columnClass);
    return isVisible;
  }

  /**
   * Zeige den Spalten-Sichtbarkeits-Drawer
   */
  showColumnVisibilityDrawer() {
    if (!this.columnVisibilityDrawer) {
      this.columnVisibilityDrawer = new SourcingDetailColumnVisibilityDrawer(
        this.hiddenColumns,
        (newHiddenColumns) => {
          this.hiddenColumns = newHiddenColumns;
          this.saveColumnVisibilitySettings();
          this.rerenderTable();
        }
      );
    } else {
      this.columnVisibilityDrawer.hiddenColumns = this.hiddenColumns;
    }
    this.columnVisibilityDrawer.open();
  }

  /**
   * Berechne Anzahl sichtbarer Spalten für colspan
   */
  getVisibleColumnCount() {
    const allColumns = [
      'cp-col-drag', 'cp-col-name', 'cp-col-typ', 'cp-col-notiz', 'cp-col-link-ig', 'cp-col-follower-ig',
      'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-location', 'cp-col-feedback',
      'cp-col-prio1', 'cp-col-prio2', 'cp-col-nicht', 'cp-col-check', 'cp-col-pricing', 'cp-col-actions'
    ];
    
    let count = 0;
    for (const col of allColumns) {
      // Drag-Spalte nur für Nicht-Kunden, Aktionen-Spalte nur für Nicht-Kunden
      if (col === 'cp-col-drag' && this.isKunde) continue;
      if (col === 'cp-col-actions' && this.isKunde) continue;
      if (this.isColumnVisibleForCustomer(col)) count++;
    }
    return count;
  }

  /**
   * Hole Teilbereiche/Kategorien aus der Liste
   */
  getTeilbereicheFromListe() {
    if (!this.liste?.teilbereich) return [];
    return this.liste.teilbereich.split(',').map(tb => tb.trim()).filter(tb => tb);
  }

  /**
   * Gruppiere Items nach Kategorie
   */
  groupItemsByKategorie(items) {
    const groups = {};
    let globalIndex = 0;
    
    items.forEach(item => {
      const kategorie = item.kategorie || 'Ohne Kategorie';
      if (!groups[kategorie]) {
        groups[kategorie] = [];
      }
      groups[kategorie].push({ ...item, globalIndex: globalIndex++ });
    });
    
    return groups;
  }

  /**
   * Rendere Kategorien-Drawer Body
   */
  renderKategorienDrawerBody() {
    const teilbereiche = this.getTeilbereicheFromListe();
    
    return `
      <div class="kategorien-list" id="kategorien-list">
        ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
          <div class="kategorie-item" data-kategorie="${tb}">
            <span class="kategorie-name">${tb}</span>
            <button type="button" class="kategorie-delete-btn" data-kategorie="${tb}" title="Kategorie löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        `).join('') : '<p style="color: var(--text-secondary); text-align: center;">Noch keine Kategorien definiert</p>'}
      </div>
      <div class="kategorien-add-form" style="margin-top: var(--space-md); display: flex; gap: var(--space-sm);">
        <input type="text" id="new-kategorie-input" class="form-input" placeholder="Neue Kategorie..." style="flex: 1;">
        <button type="button" id="btn-add-kategorie" class="primary-btn">Hinzufügen</button>
      </div>
    `;
  }

  /**
   * Kategorie hinzufügen
   */
  async handleAddKategorie() {
    const input = document.getElementById('new-kategorie-input');
    const newKategorie = input?.value?.trim();
    
    if (!newKategorie) {
      window.toastSystem?.show('Bitte einen Namen eingeben', 'warning');
      return;
    }
    
    // Prüfen ob Kategorie bereits existiert
    const existingKategorien = this.getTeilbereicheFromListe();
    if (existingKategorien.includes(newKategorie)) {
      window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
      return;
    }

    try {
      // Neue Kategorien-Liste erstellen
      const updatedKategorien = [...existingKategorien, newKategorie];
      const teilbereichString = updatedKategorien.join(', ');
      
      // Liste aktualisieren
      await creatorAuswahlService.updateListe(this.listeId, { teilbereich: teilbereichString });
      
      // Lokalen State aktualisieren
      this.liste.teilbereich = teilbereichString;
      
      // Drawer-Body neu rendern
      this.rerenderKategorienDrawerBody();
      
      // Tabelle neu rendern
      this.rerenderTable();
      
      window.toastSystem?.show('Kategorie hinzugefügt', 'success');
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }
  }

  /**
   * Kategorie löschen
   */
  async handleDeleteKategorie(kategorie) {
    const result = await window.confirmationModal?.open({
      title: 'Kategorie löschen?',
      message: `Möchten Sie die Kategorie "${kategorie}" wirklich löschen? Items in dieser Kategorie werden zu "Ohne Kategorie" verschoben.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;
    
    try {
      // Kategorie aus Liste entfernen
      const existingKategorien = this.getTeilbereicheFromListe();
      const updatedKategorien = existingKategorien.filter(k => k !== kategorie);
      const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;
      
      // Liste aktualisieren
      await creatorAuswahlService.updateListe(this.listeId, { teilbereich: teilbereichString });
      
      // Alle Items dieser Kategorie auf null setzen
      const itemsToUpdate = this.items.filter(item => item.kategorie === kategorie);
      for (const item of itemsToUpdate) {
        await creatorAuswahlService.updateItem(item.id, { kategorie: null });
        item.kategorie = null;
      }
      
      // Lokalen State aktualisieren
      this.liste.teilbereich = teilbereichString;
      
      // Drawer-Body neu rendern
      this.rerenderKategorienDrawerBody();
      
      // Tabelle neu rendern
      this.rerenderTable();
      
      window.toastSystem?.show('Kategorie gelöscht', 'success');
    } catch (error) {
      console.error('Fehler beim Löschen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  /**
   * Kategorien-Drawer Body neu rendern
   */
  rerenderKategorienDrawerBody() {
    const drawerBody = document.getElementById('kategorien-drawer-body');
    if (drawerBody) {
      drawerBody.innerHTML = this.renderKategorienDrawerBody();
      this.bindKategorienDrawerEvents();
    }
  }

  /**
   * Events für Kategorien-Drawer
   */
  bindKategorienDrawerEvents() {
    const addBtn = document.getElementById('btn-add-kategorie');
    const input = document.getElementById('new-kategorie-input');
    
    if (addBtn) {
      addBtn.addEventListener('click', () => this.handleAddKategorie());
    }
    
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddKategorie();
        }
      });
    }
    
    document.querySelectorAll('.kategorie-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDeleteKategorie(btn.dataset.kategorie);
      });
    });
  }


  /**
   * Kategorien-Drawer öffnen
   */
  openKategorienDrawer() {
    this.removeKategorienDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'kategorien-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'kategorien-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Kategorien verwalten</span>
        <p class="drawer-subtitle">Kategorien für die Creator-Gruppierung</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = 'kategorien-drawer-body';
    body.innerHTML = this.renderKategorienDrawerBody();

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeKategorienDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeKategorienDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindKategorienDrawerEvents();
  }

  /**
   * Kategorien-Drawer entfernen
   */
  removeKategorienDrawer() {
    ['kategorien-drawer-overlay', 'kategorien-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  /**
   * Kategorien-Drawer schließen
   */
  closeKategorienDrawer() {
    document.getElementById('kategorien-drawer-overlay')?.classList.remove('active');
    document.getElementById('kategorien-drawer')?.classList.remove('show');
    setTimeout(() => this.removeKategorienDrawer(), 300);
  }

  /**
   * Kategorie eines Items ändern (z.B. per Drag&Drop)
   */
  async handleCategoryChange(itemId, newKategorie) {
    try {
      // "Ohne Kategorie" auf null setzen
      const kategorie = newKategorie === 'Ohne Kategorie' ? null : newKategorie;
      
      await creatorAuswahlService.updateItem(itemId, { kategorie });
      
      // Items lokal aktualisieren
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        item.kategorie = kategorie;
      }
      
      // Tabelle neu rendern
      this.rerenderTable();
      
      window.toastSystem?.show('Kategorie aktualisiert', 'success');
    } catch (error) {
      console.error('Fehler beim Ändern der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Ändern der Kategorie', 'error');
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
          <button type="button" class="secondary-btn" id="btn-sourcing-detail-column-visibility">
            Sichtbarkeit anpassen
          </button>
          <button type="button" class="secondary-btn" id="btn-manage-kategorien" title="Kategorien verwalten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
            Kategorien
          </button>
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

    const instagramIcon = `
      <svg class="platform-icon platform-icon--instagram" viewBox="0 0 24 24" aria-label="Instagram" role="img" focusable="false">
        <path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>
        <path d="M16.95 6.45a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"/>
        <path d="M12 2.8c2.53 0 2.83.01 3.83.06 1 .05 1.68.21 2.28.44.62.24 1.15.56 1.66 1.07.51.51.83 1.04 1.07 1.66.23.6.39 1.28.44 2.28.05 1 .06 1.3.06 3.83s-.01 2.83-.06 3.83c-.05 1-.21 1.68-.44 2.28-.24.62-.56 1.15-1.07 1.66-.51.51-1.04.83-1.66 1.07-.6.23-1.28.39-2.28.44-1 .05-1.3.06-3.83.06s-2.83-.01-3.83-.06c-1-.05-1.68-.21-2.28-.44a4.54 4.54 0 0 1-2.73-2.73c-.23-.6-.39-1.28-.44-2.28C2.81 14.83 2.8 14.53 2.8 12s.01-2.83.06-3.83c.05-1 .21-1.68.44-2.28.24-.62.56-1.15 1.07-1.66.51-.51 1.04-.83 1.66-1.07.6-.23 1.28-.39 2.28-.44 1-.05 1.3-.06 3.83-.06Zm0 1.8c-2.48 0-2.77.01-3.75.06-.9.04-1.39.19-1.71.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.81-.31 1.71-.05.98-.06 1.27-.06 3.75s.01 2.77.06 3.75c.04.9.19 1.39.31 1.71.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.81.27 1.71.31.98.05 1.27.06 3.75.06s2.77-.01 3.75-.06c.9-.04 1.39-.19 1.71-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.81.31-1.71.05-.98.06-1.27.06-3.75s-.01-2.77-.06-3.75c-.04-.9-.19-1.39-.31-1.71-.17-.43-.37-.74-.7-1.07-.33-.33-.64-.53-1.07-.7-.32-.12-.81-.27-1.71-.31-.98-.05-1.27-.06-3.75-.06Z"/>
      </svg>
    `.trim();

    const tiktokIcon = `
      <svg class="platform-icon platform-icon--tiktok" viewBox="0 0 24 24" aria-label="TikTok" role="img" focusable="false">
        <path d="M14.5 3c.4 3.2 2.3 5.1 5.5 5.5v2.3c-1.9 0-3.6-.6-5-1.7v6.4c0 3.1-2.5 5.6-5.6 5.6S3.8 19 3.8 15.9s2.5-5.6 5.6-5.6c.5 0 1 .1 1.5.2v2.6c-.5-.2-1-.4-1.5-.4-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.9Z"/>
      </svg>
    `.trim();

    // Berechne sichtbare Spalten für colspan
    const visibleColCount = this.getVisibleColumnCount();

    return `
      <div class="table-container creator-pool-table-container">
        <table class="data-table strategie-items-table creator-pool-table">
          <thead>
            <tr>
              ${!this.isKunde ? '<th class="col-drag col-sticky-1 cp-col-drag"></th>' : ''}
              <th class="${this.isKunde ? 'col-sticky-1' : 'col-sticky-2'} cp-col-name">Name</th>
              <th class="${this.isKunde ? 'col-sticky-2' : 'col-sticky-3'} cp-col-typ" ${!this.isColumnVisibleForCustomer('cp-col-typ') ? 'style="display:none;"' : ''}>Creator Art</th>
              <th class="cp-col-notiz" ${!this.isColumnVisibleForCustomer('cp-col-notiz') ? 'style="display:none;"' : ''}>Kurzbeschreibung</th>
              <th class="cp-col-link-ig" ${!this.isColumnVisibleForCustomer('cp-col-link-ig') ? 'style="display:none;"' : ''}>Link ${instagramIcon}</th>
              <th class="cp-col-follower-ig" ${!this.isColumnVisibleForCustomer('cp-col-follower-ig') ? 'style="display:none;"' : ''}>Follower ${instagramIcon}</th>
              <th class="cp-col-link-tt" ${!this.isColumnVisibleForCustomer('cp-col-link-tt') ? 'style="display:none;"' : ''}>Link ${tiktokIcon}</th>
              <th class="cp-col-follower-tt" ${!this.isColumnVisibleForCustomer('cp-col-follower-tt') ? 'style="display:none;"' : ''}>Follower ${tiktokIcon}</th>
              <th class="cp-col-location" ${!this.isColumnVisibleForCustomer('cp-col-location') ? 'style="display:none;"' : ''}>Location</th>
              <th class="cp-col-feedback" ${!this.isColumnVisibleForCustomer('cp-col-feedback') ? 'style="display:none;"' : ''}>Rückmeldung Kunde</th>
              <th class="cp-col-prio1" ${!this.isColumnVisibleForCustomer('cp-col-prio1') ? 'style="display:none;"' : ''}>Prio 1</th>
              <th class="cp-col-prio2" ${!this.isColumnVisibleForCustomer('cp-col-prio2') ? 'style="display:none;"' : ''}>Prio 2</th>
              <th class="cp-col-nicht" ${!this.isColumnVisibleForCustomer('cp-col-nicht') ? 'style="display:none;"' : ''}>Nicht buchen</th>
              <th class="cp-col-check" ${!this.isColumnVisibleForCustomer('cp-col-check') ? 'style="display:none;"' : ''}>Rückmeldung</th>
              <th class="cp-col-pricing" ${!this.isColumnVisibleForCustomer('cp-col-pricing') ? 'style="display:none;"' : ''}>Pricing</th>
              ${!this.isKunde ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody id="items-table-body">
            ${this.renderGroupedItems()}
          </tbody>
          ${!this.isKunde ? `
          <tfoot>
            <tr class="add-row-footer">
              <td colspan="${visibleColCount}" style="text-align: center; padding: var(--space-sm);">
                <button type="button" class="add-row-btn" id="btn-add-empty-row" title="Neue Zeile hinzufügen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </td>
            </tr>
          </tfoot>
          ` : ''}
        </table>
      </div>
    `;
  }

  /**
   * Gruppierte Items rendern (nach Kategorie)
   */
  renderGroupedItems() {
    const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
    
    // Alle definierten Kategorien holen (damit auch leere angezeigt werden)
    const definierteKategorien = this.getTeilbereicheFromListe();
    const hatDefinierteKategorien = definierteKategorien.length > 0;
    
    // Wenn keine Kategorien definiert sind, einfach alle Items rendern
    if (!hatDefinierteKategorien) {
      return this.items.map((item, index) => this.renderItemRow(item, index)).join('');
    }
    
    // Items nach Kategorie gruppieren
    const groupedItems = this.groupItemsByKategorie(this.items);
    const colCount = this.getVisibleColumnCount();
    
    let html = '';
    let globalIndex = 0;
    
    // Definierte Kategorien durchgehen (OHNE "Nicht umsetzen" - kommt ganz unten)
    const normaleKategorien = definierteKategorien.filter(k => k !== NICHT_UMSETZEN_KATEGORIE);
    
    for (const kategorie of normaleKategorien) {
      const items = groupedItems[kategorie] || [];
      
      // Kategorie-Header
      html += `
        <tr class="kategorie-header-row" data-kategorie="${kategorie}">
          <td colspan="${colCount}" class="kategorie-header">
            <span class="kategorie-label">${kategorie}</span>
            <span class="kategorie-count">(${items.length})</span>
          </td>
        </tr>
      `;
      
      // Items der Kategorie
      for (const item of items) {
        html += this.renderItemRow(item, globalIndex++);
      }
    }
    
    // "Ohne Kategorie" 
    const ohneKategorie = groupedItems['Ohne Kategorie'] || [];
    if (ohneKategorie.length > 0 || normaleKategorien.length > 0) {
      html += `
        <tr class="kategorie-header-row" data-kategorie="Ohne Kategorie">
          <td colspan="${colCount}" class="kategorie-header kategorie-header--default">
            <span class="kategorie-label">Ohne Kategorie</span>
            <span class="kategorie-count">(${ohneKategorie.length})</span>
          </td>
        </tr>
      `;
      
      for (const item of ohneKategorie) {
        html += this.renderItemRow(item, globalIndex++);
      }
    }
    
    // "Nicht umsetzen" ganz unten (rot/abgeschwächt)
    const nichtUmsetzenItems = groupedItems[NICHT_UMSETZEN_KATEGORIE] || [];
    if (nichtUmsetzenItems.length > 0 || definierteKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
      const nichtUmsetzenIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>`;
      
      html += `
        <tr class="kategorie-header-row kategorie-header-row--rejected" data-kategorie="${NICHT_UMSETZEN_KATEGORIE}">
          <td colspan="${colCount}" class="kategorie-header kategorie-header--rejected">
            <span class="kategorie-label">${nichtUmsetzenIcon} ${NICHT_UMSETZEN_KATEGORIE}</span>
            <span class="kategorie-count">(${nichtUmsetzenItems.length})</span>
          </td>
        </tr>
      `;
      
      for (const item of nichtUmsetzenItems) {
        html += this.renderItemRow(item, globalIndex++);
      }
    }
    
    return html;
  }

  /**
   * Einzelne Item-Zeile rendern
   */
  renderItemRow(item, index) {
    const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;
    const isLinkedToCRM = !!item.creator_id;

    const formatFollower = (count) => {
      if (!count) return '';
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toLocaleString('de-DE');
    };

    return `
      <tr class="item-row ${!this.isKunde ? 'draggable' : ''} ${item.nicht_umsetzen ? 'item-nicht-umsetzen' : ''}" data-item-id="${item.id}" draggable="${!this.isKunde}">
        ${!this.isKunde ? `
          <td class="col-drag drag-handle col-sticky-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </td>
        ` : ''}
        <td class="cell-textarea cp-col-name ${this.isKunde ? 'col-sticky-1' : 'col-sticky-2'}">
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.name || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-typ ${this.isKunde ? 'col-sticky-2' : 'col-sticky-3'}" ${!this.isColumnVisibleForCustomer('cp-col-typ') ? 'style="display:none;"' : ''}>
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
              <option value="Model" ${item.typ === 'Model' ? 'selected' : ''}>Model</option>
            </select>
          ` : `<div class="cell-text-readonly">${item.typ || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-notiz" ${!this.isColumnVisibleForCustomer('cp-col-notiz') ? 'style="display:none;"' : ''}>
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="notiz" data-item-id="${item.id}" placeholder="Kurzbeschreibung...">${item.notiz || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.notiz || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-link-ig" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-link-ig') ? ' display:none;' : ''}">
          ${!this.isKunde ? `
            <div class="link-cell-wrapper">
              ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${externalLinkIcon}</a>` : ''}
              <textarea class="strategie-textarea link-input" data-field="link_instagram" data-item-id="${item.id}" placeholder="Link...">${item.link_instagram || ''}</textarea>
            </div>
          ` : item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${externalLinkIcon}</a>` : `<div class="cell-text-readonly">-</div>`}
        </td>
        <td class="cell-textarea cp-col-follower-ig" ${!this.isColumnVisibleForCustomer('cp-col-follower-ig') ? 'style="display:none;"' : ''}>
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="follower_instagram" data-item-id="${item.id}" placeholder="0">${item.follower_instagram || ''}</textarea>
          ` : `<div class="cell-text-readonly">${formatFollower(item.follower_instagram) || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-link-tt" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-link-tt') ? ' display:none;' : ''}">
          ${!this.isKunde ? `
            <div class="link-cell-wrapper">
              ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${externalLinkIcon}</a>` : ''}
              <textarea class="strategie-textarea link-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="Link...">${item.link_tiktok || ''}</textarea>
            </div>
          ` : item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${externalLinkIcon}</a>` : `<div class="cell-text-readonly">-</div>`}
        </td>
        <td class="cell-textarea cp-col-follower-tt" ${!this.isColumnVisibleForCustomer('cp-col-follower-tt') ? 'style="display:none;"' : ''}>
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="follower_tiktok" data-item-id="${item.id}" placeholder="0">${item.follower_tiktok || ''}</textarea>
          ` : `<div class="cell-text-readonly">${formatFollower(item.follower_tiktok) || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-location" ${!this.isColumnVisibleForCustomer('cp-col-location') ? 'style="display:none;"' : ''}>
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="wohnort" data-item-id="${item.id}" placeholder="Location...">${item.wohnort || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.wohnort || '-'}</div>`}
        </td>
        <td class="cell-textarea cp-col-feedback" ${!this.isColumnVisibleForCustomer('cp-col-feedback') ? 'style="display:none;"' : ''}>
          <textarea 
            class="strategie-textarea ${this.isKunde ? '' : 'readonly-textarea'}" 
            data-field="feedback_kunde" 
            data-item-id="${item.id}" 
            placeholder="${this.isKunde ? 'Ihr Feedback...' : 'Rückmeldung Kunde...'}"
            ${this.isKunde ? '' : 'readonly'}
          >${item.feedback_kunde || ''}</textarea>
        </td>
        <td class="cp-col-prio1" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-prio1') ? ' display:none;' : ''}">
          <input 
            type="checkbox" 
            ${item.prio_1 ? 'checked' : ''} 
            data-field="prio_1"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: pointer;"
          >
        </td>
        <td class="cp-col-prio2" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-prio2') ? ' display:none;' : ''}">
          <input 
            type="checkbox" 
            ${item.prio_2 ? 'checked' : ''} 
            data-field="prio_2"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: pointer;"
          >
        </td>
        <td class="cp-col-nicht" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-nicht') ? ' display:none;' : ''}">
          <input 
            type="checkbox" 
            ${item.nicht_umsetzen ? 'checked' : ''} 
            data-field="nicht_umsetzen"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: pointer;"
          >
        </td>
        <td class="cp-col-check" style="text-align: center;${!this.isColumnVisibleForCustomer('cp-col-check') ? ' display:none;' : ''}">
          <input 
            type="checkbox" 
            ${item.rueckmeldung_creator ? 'checked' : ''} 
            data-field="rueckmeldung_creator"
            data-item-id="${item.id}"
            style="width: 20px; height: 20px; cursor: ${this.isKunde ? 'default' : 'pointer'};"
            ${this.isKunde ? 'disabled' : ''}
          >
        </td>
        <td class="cell-textarea cp-col-pricing" ${!this.isColumnVisibleForCustomer('cp-col-pricing') ? 'style="display:none;"' : ''}>
          ${!this.isKunde ? `
            <textarea class="strategie-textarea" data-field="pricing" data-item-id="${item.id}" placeholder="Preis...">${item.pricing || ''}</textarea>
          ` : `<div class="cell-text-readonly">${item.pricing || '-'}</div>`}
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

    // Add-Button (oben)
    if (!this.isKunde) {
      // Spalten-Sichtbarkeit Button
      const visibilityBtn = document.getElementById('btn-sourcing-detail-column-visibility');
      if (visibilityBtn) {
        const handler = () => this.showColumnVisibilityDrawer();
        visibilityBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => visibilityBtn.removeEventListener('click', handler));
      }

      // Kategorien-Button
      const kategorienBtn = document.getElementById('btn-manage-kategorien');
      if (kategorienBtn) {
        const handler = () => this.openKategorienDrawer();
        kategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kategorienBtn.removeEventListener('click', handler));
      }

      const addBtn = document.getElementById('btn-open-add-drawer');
      if (addBtn) {
        const handler = () => this.openAddCreatorDrawer();
        addBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addBtn.removeEventListener('click', handler));
      }

      // Plus-Button am Tabellen-Ende (schnelles Hinzufügen)
      const addEmptyRowBtn = document.getElementById('btn-add-empty-row');
      if (addEmptyRowBtn) {
        const handler = () => this.addEmptyRow();
        addEmptyRowBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addEmptyRowBtn.removeEventListener('click', handler));
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
    const kategorieHeaders = document.querySelectorAll('.kategorie-header-row');
    
    rows.forEach(row => {
      const dragstartHandler = (e) => {
        this.draggedItem = row;
        this.draggedItemId = row.dataset.itemId;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.itemId);
      };
      row.addEventListener('dragstart', dragstartHandler);
      this._boundEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

      const dragendHandler = () => {
        row.style.opacity = '1';
        this.draggedItem = null;
        this.draggedItemId = null;
        // Entferne alle drag-over Styles
        document.querySelectorAll('.kategorie-header-row.drag-over').forEach(h => h.classList.remove('drag-over'));
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

    // Kategorie-Header als Drop-Targets
    kategorieHeaders.forEach(header => {
      const dragoverHandler = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      };
      header.addEventListener('dragover', dragoverHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

      const dragleaveHandler = () => {
        header.classList.remove('drag-over');
      };
      header.addEventListener('dragleave', dragleaveHandler);
      this._boundEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

      const dropHandler = async (e) => {
        e.preventDefault();
        header.classList.remove('drag-over');
        
        const itemId = this.draggedItemId;
        const newKategorie = header.dataset.kategorie;
        
        if (itemId && newKategorie) {
          await this.handleCategoryChange(itemId, newKategorie);
        }
      };
      header.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => header.removeEventListener('drop', dropHandler));
    });
  }

  /**
   * Sortierung speichern (mit Kategorie-Berücksichtigung)
   */
  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const rows = Array.from(tbody.querySelectorAll('.item-row'));
    
    // Wenn Kategorien definiert sind, Kategorie aus Position ableiten
    const hatKategorien = this.getTeilbereicheFromListe().length > 0;
    
    const updatedItems = rows.map((row, index) => {
      const itemId = row.dataset.itemId;
      const item = this.items.find(i => i.id === itemId);
      
      let kategorie = item.kategorie;
      
      if (hatKategorien) {
        // Finde die Kategorie basierend auf dem vorherigen Kategorie-Header
        let currentHeader = row.previousElementSibling;
        while (currentHeader && !currentHeader.classList.contains('kategorie-header-row')) {
          currentHeader = currentHeader.previousElementSibling;
        }
        if (currentHeader) {
          const headerKategorie = currentHeader.dataset.kategorie;
          kategorie = headerKategorie === 'Ohne Kategorie' ? null : headerKategorie;
        }
      }
      
      return { ...item, sortierung: index, kategorie };
    });

    try {
      await creatorAuswahlService.updateItemsSortierungWithKategorie(updatedItems);
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
      // Spezialfall: "Nicht umsetzen" - Creator in separate Kategorie verschieben
      if (field === 'nicht_umsetzen') {
        await this.handleNichtUmsetzenChange(itemId, value);
        return;
      }

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
   * Spezialbehandlung für "Nicht umsetzen" - verschiebt Creator in eigene Kategorie
   */
  async handleNichtUmsetzenChange(itemId, isNichtUmsetzen) {
    const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
    
    try {
      // Wenn "Nicht umsetzen" aktiviert wird
      if (isNichtUmsetzen) {
        // Prüfen ob Kategorie "Nicht umsetzen" existiert, sonst erstellen
        const existingKategorien = this.getTeilbereicheFromListe();
        if (!existingKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
          // Kategorie hinzufügen
          const updatedKategorien = [...existingKategorien, NICHT_UMSETZEN_KATEGORIE];
          const teilbereichString = updatedKategorien.join(', ');
          await creatorAuswahlService.updateListe(this.listeId, { teilbereich: teilbereichString });
          this.liste.teilbereich = teilbereichString;
        }
        
        // Item aktualisieren: nicht_umsetzen = true UND in Kategorie "Nicht umsetzen" verschieben
        await creatorAuswahlService.updateItem(itemId, { 
          nicht_umsetzen: true, 
          kategorie: NICHT_UMSETZEN_KATEGORIE 
        });
        
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = true;
          item.kategorie = NICHT_UMSETZEN_KATEGORIE;
        }
        
        window.toastSystem?.show('Creator als "Nicht umsetzen" markiert', 'info');
      } else {
        // Wenn "Nicht umsetzen" deaktiviert wird: zurück zu "Ohne Kategorie"
        await creatorAuswahlService.updateItem(itemId, { 
          nicht_umsetzen: false, 
          kategorie: null 
        });
        
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = false;
          item.kategorie = null;
        }
        
        window.toastSystem?.show('Creator wieder aktiv', 'success');
      }
      
      // Tabelle neu rendern, damit Gruppierung aktualisiert wird
      this.rerenderTable();
      
    } catch (error) {
      console.error('Fehler beim Ändern von "Nicht umsetzen":', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  /**
   * Add-Creator-Drawer öffnen
   */
  openAddCreatorDrawer() {
    this.removeDrawer();
    this.addCreatorMode = 'new'; // 'new' oder 'database'
    this.selectedCreatorFromDb = null;

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
        <p class="drawer-subtitle">Creator zur Auswahlliste hinzufügen</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    // View Toggle
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'drawer-toggle-container';
    toggleContainer.innerHTML = `
      <div class="view-toggle">
        <button type="button" class="secondary-btn active" data-mode="new">Neuer Creator</button>
        <button type="button" class="secondary-btn" data-mode="database">Aus Datenbank</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = 'add-creator-drawer-body';
    body.innerHTML = this.renderAddCreatorForm();

    panel.appendChild(header);
    panel.appendChild(toggleContainer);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeDrawer());

    // View Toggle Events
    toggleContainer.querySelectorAll('.view-toggle .secondary-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.switchAddCreatorMode(mode);
        
        toggleContainer.querySelectorAll('.view-toggle .secondary-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindAddCreatorEvents();
  }

  /**
   * Wechselt den Modus im Add-Creator-Drawer
   */
  switchAddCreatorMode(mode) {
    this.addCreatorMode = mode;
    this.selectedCreatorFromDb = null;
    
    const body = document.getElementById('add-creator-drawer-body');
    if (body) {
      body.innerHTML = this.renderAddCreatorForm();
      this.bindAddCreatorEvents();
    }
  }

  /**
   * Rendert das Add-Creator-Formular basierend auf dem Modus
   */
  renderAddCreatorForm() {
    const isDatabaseMode = this.addCreatorMode === 'database';

    // Datenbank-Suche Section
    const searchSection = isDatabaseMode ? `
      <div class="form-field sourcing-search-section">
        <label class="form-label">Creator suchen</label>
        <div class="auto-suggest-container">
          <input 
            type="text" 
            id="db-creator-search" 
            class="form-input" 
            placeholder="Name, Instagram oder TikTok eingeben..." 
            autocomplete="off"
          />
          <div id="db-creator-dropdown" class="dropdown-menu"></div>
        </div>
        <small class="form-hint">Suche nach bestehenden Creators in der Datenbank</small>
      </div>
      <input type="hidden" id="db-selected-creator-id" value="" />
      <div id="db-selected-info" class="sourcing-selected-info" style="display: none;"></div>
    ` : '';

    return `
      <form id="add-creator-form">
        ${searchSection}
        
        <div id="add-creator-form-fields" ${isDatabaseMode ? 'style="display: none;"' : ''}>
          <div class="form-field">
            <label class="form-label">Creator Art *</label>
            <select id="creator-typ" name="typ" class="form-input" required>
              <option value="">Bitte wählen...</option>
              <option value="IGC">IGC</option>
              <option value="UGC">UGC</option>
              <option value="Influencer">Influencer</option>
              <option value="Videograf">Videograf</option>
              <option value="Model">Model</option>
            </select>
          </div>

          <div class="form-field">
            <label class="form-label">Name *</label>
            <input type="text" id="creator-name" name="name" class="form-input" placeholder="Name des Creators" ${isDatabaseMode ? '' : 'required'}>
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

          <div class="form-field">
            <label class="form-label">Location</label>
            <input type="text" name="wohnort" class="form-input" placeholder="z.B. Berlin">
          </div>

          <div class="form-field">
            <label class="form-label">Kurzbeschreibung</label>
            <textarea name="notiz" class="form-input" rows="2" placeholder="Kurzbeschreibung..."></textarea>
          </div>

          <div class="form-field">
            <label class="form-label">Pricing</label>
            <input type="text" name="pricing" class="form-input" placeholder="z.B. 500€ pro Video">
          </div>
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

    // Auto-Suggestion für Datenbank-Modus
    if (this.addCreatorMode === 'database') {
      this.setupDbCreatorAutoSuggestion();
    }
  }

  /**
   * Auto-Suggestion für Creator-Suche aus der Datenbank
   */
  setupDbCreatorAutoSuggestion() {
    const input = document.getElementById('db-creator-search');
    const dropdown = document.getElementById('db-creator-dropdown');
    const hiddenInput = document.getElementById('db-selected-creator-id');
    const infoDiv = document.getElementById('db-selected-info');
    const formFields = document.getElementById('add-creator-form-fields');

    if (!input || !dropdown) return;

    let debounceTimer;

    const escapeHtml = (str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    const renderDropdown = (items) => {
      if (!items || items.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Creator gefunden</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = items.map(creator => {
        const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt';
        const socials = [creator.instagram, creator.tiktok].filter(Boolean).join(', ') || 'Keine Social Media';
        return `
          <div class="dropdown-item" data-id="${creator.id}">
            <div class="dropdown-item-title">${escapeHtml(name)}</div>
            <div class="dropdown-item-subtitle">${escapeHtml(socials)}</div>
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';
    };

    const loadCreators = async (query) => {
      try {
        let q = window.supabase
          .from('creator')
          .select('id, vorname, nachname, instagram, tiktok, instagram_follower, tiktok_follower, lieferadresse_stadt')
          .limit(20);

        if (query && query.length > 0) {
          q = q.or(`vorname.ilike.%${query}%,nachname.ilike.%${query}%,instagram.ilike.%${query}%,tiktok.ilike.%${query}%`);
        }

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Fehler beim Laden der Creator:', error);
        return [];
      }
    };

    // Focus Event
    input.addEventListener('focus', async () => {
      const items = await loadCreators('');
      renderDropdown(items);
    });

    // Blur Event
    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });

    // Input Event - Debounced Suche
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = input.value.trim();
        const items = await loadCreators(query);
        renderDropdown(items);
      }, 250);
    });

    // Dropdown Click - Creator auswählen
    dropdown.addEventListener('click', async (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      const creatorId = item.dataset.id;
      
      try {
        const { data: creator, error } = await window.supabase
          .from('creator')
          .select('*')
          .eq('id', creatorId)
          .single();

        if (error) throw error;

        // Speichere ausgewählten Creator
        this.selectedCreatorFromDb = creator;
        hiddenInput.value = creatorId;

        // Zeige Info über ausgewählten Creator
        const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
        infoDiv.innerHTML = `
          <div class="tag tag-selected-creator">
            <span>${escapeHtml(name)}</span>
            <button type="button" class="tag-remove" id="btn-remove-db-creator">✕</button>
          </div>
        `;
        infoDiv.style.display = 'block';

        // Verstecke Suche
        input.style.display = 'none';

        // Zeige und fülle Formular
        formFields.style.display = 'block';
        this.fillFormFromDbCreator(creator);

        // Entfernen-Button Event
        document.getElementById('btn-remove-db-creator')?.addEventListener('click', () => {
          this.selectedCreatorFromDb = null;
          hiddenInput.value = '';
          infoDiv.style.display = 'none';
          input.style.display = 'block';
          input.value = '';
          formFields.style.display = 'none';
        });

      } catch (error) {
        console.error('Fehler beim Laden des Creators:', error);
        window.toastSystem?.show('Fehler beim Laden des Creators', 'error');
      }
    });
  }

  /**
   * Füllt das Formular mit Daten aus der Creator-Datenbank
   */
  fillFormFromDbCreator(creator) {
    const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
    
    // Name setzen
    const nameInput = document.getElementById('creator-name');
    if (nameInput) nameInput.value = name;

    // Instagram
    const igInput = document.querySelector('input[name="link_instagram"]');
    if (igInput && creator.instagram) {
      igInput.value = creator.instagram.startsWith('http') ? creator.instagram : `https://instagram.com/${creator.instagram.replace('@', '')}`;
    }
    
    const igFollower = document.querySelector('input[name="follower_instagram"]');
    if (igFollower && creator.instagram_follower) {
      // Konvertiere Range zu Zahl (z.B. "10000-25000" -> 17500)
      const follower = this.parseFollowerRange(creator.instagram_follower);
      if (follower) igFollower.value = follower;
    }

    // TikTok
    const ttInput = document.querySelector('input[name="link_tiktok"]');
    if (ttInput && creator.tiktok) {
      ttInput.value = creator.tiktok.startsWith('http') ? creator.tiktok : `https://tiktok.com/@${creator.tiktok.replace('@', '')}`;
    }
    
    const ttFollower = document.querySelector('input[name="follower_tiktok"]');
    if (ttFollower && creator.tiktok_follower) {
      const follower = this.parseFollowerRange(creator.tiktok_follower);
      if (follower) ttFollower.value = follower;
    }

    // Location
    const locationInput = document.querySelector('input[name="wohnort"]');
    if (locationInput && creator.lieferadresse_stadt) {
      locationInput.value = creator.lieferadresse_stadt;
    }

    // Notiz
    const notizInput = document.querySelector('textarea[name="notiz"]');
    if (notizInput && creator.notiz) {
      notizInput.value = creator.notiz;
    }
  }

  /**
   * Konvertiert Follower-Range String zu einer Zahl (Mittelwert)
   */
  parseFollowerRange(rangeStr) {
    if (!rangeStr) return null;
    
    // Wenn bereits eine Zahl
    if (typeof rangeStr === 'number') return rangeStr;
    
    // "1000000+" -> 1000000
    if (rangeStr.includes('+')) {
      return parseInt(rangeStr.replace('+', ''), 10);
    }
    
    // "10000-25000" -> Mittelwert
    const parts = rangeStr.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      if (!isNaN(min) && !isNaN(max)) {
        return Math.round((min + max) / 2);
      }
    }
    
    return parseInt(rangeStr, 10) || null;
  }

  /**
   * Creator manuell hinzufügen
   */
  async handleAddCreatorSubmit(formData) {
    const typ = formData.get('typ')?.trim();
    const name = formData.get('name')?.trim();

    // Bei Datenbank-Modus: Creator muss ausgewählt sein
    if (this.addCreatorMode === 'database' && !this.selectedCreatorFromDb) {
      window.toastSystem?.show('Bitte einen Creator aus der Datenbank auswählen', 'error');
      return;
    }

    // Bei Neu-Modus: Typ und Name sind Pflicht
    if (this.addCreatorMode === 'new' && (!typ || !name)) {
      window.toastSystem?.show('Bitte Creator Art und Name ausfüllen', 'error');
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    
    try {
      submitBtn.disabled = true;

      // Item-Daten aus Formular zusammenstellen
      const itemData = {
        creator_auswahl_id: this.listeId,
        typ: typ || (this.selectedCreatorFromDb ? 'Influencer' : null), // Default für DB-Creator
        name: name || (this.selectedCreatorFromDb ? `${this.selectedCreatorFromDb.vorname || ''} ${this.selectedCreatorFromDb.nachname || ''}`.trim() : null),
        link_instagram: formData.get('link_instagram')?.trim() || null,
        follower_instagram: formData.get('follower_instagram') ? parseInt(formData.get('follower_instagram'), 10) : null,
        link_tiktok: formData.get('link_tiktok')?.trim() || null,
        follower_tiktok: formData.get('follower_tiktok') ? parseInt(formData.get('follower_tiktok'), 10) : null,
        rueckmeldung_creator: formData.get('rueckmeldung_creator') === 'true',
        kategorie: formData.get('kategorie')?.trim() || null,
        wohnort: formData.get('wohnort')?.trim() || null,
        notiz: formData.get('notiz')?.trim() || null,
        pricing: formData.get('pricing')?.trim() || null,
        sortierung: this.items.length,
        // Verknüpfung zur Creator-Datenbank (nur wenn aus DB ausgewählt)
        creator_id: this.selectedCreatorFromDb?.id || null
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
   * Initiale leere Zeile erstellen (beim ersten Öffnen einer leeren Liste)
   */
  async createInitialEmptyRow() {
    try {
      const itemData = {
        creator_auswahl_id: this.listeId,
        typ: null,
        name: null,
        link_instagram: null,
        follower_instagram: null,
        link_tiktok: null,
        follower_tiktok: null,
        rueckmeldung_creator: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        sortierung: 0,
        creator_id: null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.items.push(newItem);
    } catch (error) {
      console.error('Fehler beim Erstellen der initialen Zeile:', error);
    }
  }

  /**
   * Leere Zeile hinzufügen (für schnelles Anlegen)
   */
  async addEmptyRow() {
    try {
      const itemData = {
        creator_auswahl_id: this.listeId,
        typ: null,
        name: null,
        link_instagram: null,
        follower_instagram: null,
        link_tiktok: null,
        follower_tiktok: null,
        rueckmeldung_creator: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        sortierung: this.items.length,
        creator_id: null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.items.push(newItem);
      this.rerenderTable();

      // Fokus auf das Name-Feld der neuen Zeile setzen
      setTimeout(() => {
        const nameField = document.querySelector(`textarea[data-item-id="${newItem.id}"][data-field="name"]`);
        if (nameField) {
          nameField.focus();
        }
      }, 100);

    } catch (error) {
      console.error('Fehler beim Hinzufügen einer leeren Zeile:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
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

