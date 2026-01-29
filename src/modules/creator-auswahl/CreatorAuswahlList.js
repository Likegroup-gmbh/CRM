// CreatorAuswahlList.js
// Übersicht aller Creator-Auswahl-Listen (Sourcing)
// Basiert auf BasePaginatedList (Client-seitige Pagination)

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { AvatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class CreatorAuswahlList extends BasePaginatedList {
  constructor() {
    super('creator-auswahl', {
      itemsPerPage: 10,
      headline: 'Sourcing',
      breadcrumbLabel: 'Sourcing',
      sortField: 'name',
      sortAscending: true,
      paginationContainerId: 'pagination-container-creator-auswahl',
      tbodySelector: '#creator-auswahl-table-body',
      tableColspan: 5,
      permissionEntity: 'kampagne' // Verwendet Kampagne-Permissions
    });
    
    // Client-seitige Daten (alle Listen)
    this.listen = [];
    this.autoGeneration = new AutoGeneration();
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Client-seitige Pagination: Lädt alle Daten und paginiert im Client
   */
  async loadPageData(page, limit, filters) {
    // Daten einmalig laden wenn noch nicht vorhanden
    if (this.listen.length === 0 || this._forceReload) {
      this.listen = await creatorAuswahlService.getAllListen();
      this._forceReload = false;
    }
    
    // Client-seitige Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = this.listen.slice(start, end);
    
    return {
      data: paginatedData,
      total: this.listen.length
    };
  }
  
  /**
   * Berechtigungsprüfung
   */
  async checkViewPermission() {
    if (window.currentUser?.rolle === 'admin') return true;
    return window.currentUser?.permissions?.kampagne?.can_view || false;
  }
  
  /**
   * Zusätzliche Init-Logik
   */
  async init() {
    // FAB/Quick-Menu für Kunden in Sourcing verstecken
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    if (isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) {
        quickMenuContainer.style.display = 'none';
      }
    }
    
    await super.init();
  }
  
  /**
   * Rendert eine einzelne Tabellenzeile
   */
  renderSingleRow(liste) {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const sanitize = this.sanitize.bind(this);

    const unternehmenBubble = liste.unternehmen 
      ? AvatarBubbles.renderBubbles([{
          name: liste.unternehmen.firmenname,
          type: 'org',
          id: liste.unternehmen.id,
          entityType: 'unternehmen',
          logo_url: liste.unternehmen.logo_url
        }])
      : '-';

    const markeBubble = liste.marke 
      ? AvatarBubbles.renderBubbles([{
          name: liste.marke.markenname,
          type: 'org',
          id: liste.marke.id,
          entityType: 'marke',
          logo_url: liste.marke.logo_url
        }])
      : '-';

    const kampagneName = KampagneUtils.getDisplayName(liste.kampagne);

    return `
      <tr class="table-row-clickable" data-liste-id="${liste.id}">
        <td class="col-name ca-col-name">
          <a href="#" class="table-link" data-table="sourcing" data-id="${liste.id}">
            ${sanitize(liste.name || 'Ohne Namen')}
          </a>
        </td>
        <td class="ca-col-unternehmen">${unternehmenBubble}</td>
        <td class="ca-col-marke">${markeBubble}</td>
        <td class="ca-col-kampagne">${kampagneName}</td>
        <td class="col-actions">
          <div class="actions-dropdown-container" data-entity-type="creator-auswahl">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view-liste" data-id="${liste.id}">
                ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                Details anzeigen
              </a>
              ${!isKunde ? `
                <a href="#" class="action-item" data-action="edit-liste" data-id="${liste.id}">
                  ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                  Bearbeiten
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete-liste" data-id="${liste.id}">
                  ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                  Löschen
                </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   */
  renderShellContent() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_edit);

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <div id="filter-dropdown-container"></div>
            </div>
          </div>
          <div class="table-actions">
            ${canCreate ? `
              <button class="primary-btn" data-action="create-liste">Neue Creator-Auswahl</button>
            ` : ''}
          </div>
        </div>

        <div class="table-container table-container--creator-auswahl-list">
          <table class="data-table data-table--creator-auswahl-list">
            <thead>
              <tr>
                <th class="col-name ca-col-name">Name</th>
                <th class="ca-col-unternehmen">Unternehmen</th>
                <th class="ca-col-marke">Marke</th>
                <th class="ca-col-kampagne">Kampagne</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="creator-auswahl-table-body">
              <tr>
                <td colspan="5" class="table-state-cell">
                  Lade Creator-Auswahl-Listen...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="pagination-container-creator-auswahl"></div>
      </div>
    `;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Zusätzliche Events binden
   */
  bindAdditionalEvents(signal) {
    // Create Liste Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="create-liste"]')) {
        e.preventDefault();
        window.navigateTo('/sourcing/new');
      }
    }, { signal });
    
    // View Liste
    document.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-action="view-liste"]');
      if (viewBtn) {
        e.preventDefault();
        const id = viewBtn.dataset.id;
        window.navigateTo(`/sourcing/${id}`);
      }
    }, { signal });
    
    // Edit Liste
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit-liste"]');
      if (editBtn) {
        e.preventDefault();
        const id = editBtn.dataset.id;
        window.navigateTo(`/sourcing/${id}/edit`);
      }
    }, { signal });
    
    // Delete Liste
    document.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-action="delete-liste"]');
      if (deleteBtn) {
        e.preventDefault();
        const id = deleteBtn.dataset.id;
        this.confirmDeleteListe(id);
      }
    }, { signal });
    
    // Row Click
    document.addEventListener('click', (e) => {
      const row = e.target.closest('.table-row-clickable');
      if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
        const id = row.dataset.listeId;
        if (id) {
          window.navigateTo(`/sourcing/${id}`);
        }
      }
    }, { signal });
    
    // Table Link Click (für Sourcing-Links)
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'sourcing') {
        e.preventDefault();
        const id = e.target.dataset.id;
        window.navigateTo(`/sourcing/${id}`);
      }
    }, { signal });
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATOR-AUSWAHL-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lösch-Bestätigung
   */
  async confirmDeleteListe(id) {
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Creator-Auswahl löschen',
        message: 'Möchten Sie diese Creator-Auswahl wirklich löschen? Alle zugeordneten Creator werden entfernt.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      
      if (result?.confirmed) {
        await this.deleteListe(id);
      }
    } else {
      if (confirm('Möchten Sie diese Creator-Auswahl wirklich löschen?')) {
        await this.deleteListe(id);
      }
    }
  }
  
  /**
   * Liste löschen
   */
  async deleteListe(id) {
    try {
      await creatorAuswahlService.deleteListe(id);
      
      window.toastSystem?.show('Creator-Auswahl erfolgreich gelöscht', 'success');
      
      // Daten neu laden
      this._forceReload = true;
      this.listen = [];
      await this.loadData();
      
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen der Creator-Auswahl', 'error');
    }
  }
  
  /**
   * Override destroy um Cache zu clearen
   */
  destroy() {
    this.listen = [];
    super.destroy();
  }
}

// Exportiere Instanz für globale Nutzung
export const creatorAuswahlList = new CreatorAuswahlList();
