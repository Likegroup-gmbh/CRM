// AnsprechpartnerList.js (ES6-Modul)
// Ansprechpartner-Liste mit Filter, Verwaltung und Pagination
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

// Sprach-Mapping für Abkürzungen
const SPRACH_KUERZEL = {
  'Deutsch': 'DE', 'Englisch': 'EN', 'Französisch': 'FR', 'Spanisch': 'ES',
  'Italienisch': 'IT', 'Portugiesisch': 'PT', 'Niederländisch': 'NL', 'Polnisch': 'PL',
  'Russisch': 'RU', 'Chinesisch': 'ZH', 'Japanisch': 'JA', 'Koreanisch': 'KO',
  'Arabisch': 'AR', 'Türkisch': 'TR', 'Griechisch': 'EL', 'Schwedisch': 'SV',
  'Dänisch': 'DA', 'Norwegisch': 'NO', 'Finnisch': 'FI', 'Tschechisch': 'CS',
  'Ungarisch': 'HU', 'Rumänisch': 'RO', 'Ukrainisch': 'UK', 'Hindi': 'HI',
  'Hebräisch': 'HE', 'Vietnamesisch': 'VI', 'Thailändisch': 'TH', 'Indonesisch': 'ID'
};

function getSprachKuerzel(name) {
  if (!name) return '-';
  return SPRACH_KUERZEL[name] || name.substring(0, 2).toUpperCase();
}

const LINK_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tag--verknuepft-icon"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

export class AnsprechpartnerList extends BasePaginatedList {
  constructor() {
    super('ansprechpartner', {
      itemsPerPage: 25,
      headline: 'Ansprechpartner Übersicht',
      breadcrumbLabel: 'Ansprechpartner',
      sortField: 'nachname',
      sortAscending: true,
      paginationContainerId: 'pagination-ansprechpartner',
      tbodySelector: '.data-table tbody',
      tableColspan: 12, // Mit Admin-Checkbox + Newsletter-Spalte
      checkboxClass: 'ansprechpartner-check',
      selectAllId: 'select-all-ansprechpartner'
    });
    
    // Alias für Kompatibilität
    this.selectedAnsprechpartner = this.selectedItems;
    
    // Erlaubte IDs für Nicht-Admins (gecacht)
    this._allowedAnsprechpartnerIds = null;
    this._newsletterUpdateInFlight = new Set();
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN FÜR PERMISSION-HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Setzt entity-spezifische Caches zurück bei Permission-Änderungen
   * @override
   */
  resetEntityCaches() {
    console.log('🔄 ANSPRECHPARTNERLISTE: Cache zurückgesetzt');
    this._allowedAnsprechpartnerIds = null;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Ansprechpartner-Daten für eine Seite
   */
  async loadPageData(page, limit, filters) {
    // Nicht-Admin Filterung prüfen
    if (!this.isAdmin && window.supabase) {
      const allowedIds = await this.loadAllowedAnsprechpartnerIds();
      
      if (allowedIds && allowedIds.length === 0) {
        return { data: [], total: 0 };
      }
      
      if (allowedIds) {
        filters._allowedIds = allowedIds;
      }
    }
    
    const result = await window.dataService.loadEntitiesWithPagination(
      'ansprechpartner',
      filters,
      page,
      limit
    );
    
    return {
      data: result.data || [],
      total: result.total || 0
    };
  }
  
  /**
   * Lädt die erlaubten Ansprechpartner-IDs für Nicht-Admins
   */
  async loadAllowedAnsprechpartnerIds() {
    // Cache nutzen wenn vorhanden
    if (this._allowedAnsprechpartnerIds !== null) {
      return this._allowedAnsprechpartnerIds;
    }
    
    try {
      // PHASE 1: Initiale Daten PARALLEL laden
      const [assignedMarkenResult, mitarbeiterUnternehmenResult] = await Promise.all([
        window.supabase
          .from('marke_mitarbeiter')
          .select('marke_id')
          .eq('mitarbeiter_id', window.currentUser?.id),
        window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .eq('mitarbeiter_id', window.currentUser?.id)
      ]);
      
      const markenIds = (assignedMarkenResult.data || []).map(r => r.marke_id).filter(Boolean);
      const unternehmenIds = (mitarbeiterUnternehmenResult.data || []).map(r => r.unternehmen_id).filter(Boolean);
      
      // PHASE 2: Marken mit Unternehmen-IDs laden
      let markenMitUnternehmen = [];
      if (markenIds.length > 0) {
        const { data: markenData } = await window.supabase
          .from('marke')
          .select('id, unternehmen_id')
          .in('id', markenIds);
        
        markenMitUnternehmen = (markenData || []).map(m => ({
          marke_id: m.id,
          unternehmen_id: m.unternehmen_id
        }));
      }
      
      // Sammle alle relevanten IDs
      const alleUnternehmenIds = new Set(unternehmenIds);
      const alleMarkenIds = new Set(markenIds);
      
      markenMitUnternehmen.forEach(r => {
        if (r.unternehmen_id) {
          alleUnternehmenIds.add(r.unternehmen_id);
        }
      });
      
      // PHASE 3: BATCH-Queries für Ansprechpartner
      const erlaubteAnsprechpartnerIds = new Set();
      const batchPromises = [];
      
      if (alleUnternehmenIds.size > 0) {
        batchPromises.push(
          window.supabase
            .from('ansprechpartner_unternehmen')
            .select('ansprechpartner_id')
            .in('unternehmen_id', [...alleUnternehmenIds])
        );
      }
      
      if (alleMarkenIds.size > 0) {
        batchPromises.push(
          window.supabase
            .from('ansprechpartner_marke')
            .select('ansprechpartner_id')
            .in('marke_id', [...alleMarkenIds])
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        (result.data || []).forEach(r => {
          if (r.ansprechpartner_id) {
            erlaubteAnsprechpartnerIds.add(r.ansprechpartner_id);
          }
        });
      });
      
      this._allowedAnsprechpartnerIds = [...erlaubteAnsprechpartnerIds];
      return this._allowedAnsprechpartnerIds;
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERLIST: Fehler beim Laden der Zuordnungen:', error);
      return null;
    }
  }
  
  /**
   * Rendert eine einzelne Ansprechpartner-Zeile
   */
  renderNewsletterToggle(ap, canEdit) {
    const sanitize = this.sanitize.bind(this);
    const fullName = `${sanitize(ap.vorname || '')} ${sanitize(ap.nachname || '')}`.trim() || 'Ansprechpartner';
    const checked = ap.erlaubt_newsletter ? 'checked' : '';
    const disabled = canEdit ? '' : 'disabled';

    return `
      <label class="toggle-switch ansprechpartner-newsletter-toggle-wrapper">
        <input
          type="checkbox"
          class="ansprechpartner-newsletter-toggle"
          data-id="${ap.id}"
          aria-label="Newsletter für ${fullName}"
          ${checked}
          ${disabled}
        >
        <span class="toggle-slider"></span>
      </label>
    `;
  }

  renderSingleRow(ap) {
    const isAdmin = this.isAdmin;
    const canEdit = this.canEdit;
    const sanitize = this.sanitize.bind(this);
    
    return `
      <tr data-id="${ap.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="ansprechpartner-check" data-id="${ap.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          ${ap.profile_image_url 
            ? `<img src="${ap.profile_image_url}" class="table-logo" width="24" height="24" alt="" />` 
            : `<span class="table-avatar">${(ap.vorname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
            ${sanitize(ap.vorname || '')} ${sanitize(ap.nachname || '')}
          </a>
          ${ap.ist_verknuepft ? `<span class="tag tag--verknuepft" title="verknüpft">${LINK_ICON_SVG}</span>` : ''}
        </td>
        <td>${this.renderUnternehmen(ap)}</td>
        <td>
          ${(ap.marken && ap.marken.length > 0)
            ? avatarBubbles.renderBubbles(ap.marken.map(m => ({
                name: m.markenname,
                type: 'org',
                id: m.id,
                entityType: 'marke',
                logo_url: m.logo_url || null
              })))
            : '-'}
        </td>
        <td>${ap.stadt || '-'}</td>
        <td>${ap.land || '-'}</td>
        <td>
          ${ap.positionen?.name ? `<div class="tag-list"><span class="tag tag--position">${sanitize(ap.positionen.name)}</span></div>` : '-'}
        </td>
        <td>${ap.email ? `<a href="mailto:${ap.email}" class="table-link email-link">${ap.email}</a>` : '-'}</td>
        <td>${PhoneDisplay.render(
          ap.telefonnummer_land?.iso_code,
          ap.telefonnummer_land?.vorwahl,
          ap.telefonnummer
        )}</td>
        <td class="table-cell-center">${this.renderLinkedInLink(ap.linkedin)}</td>
        <td class="table-cell-center">${this.renderNewsletterToggle(ap, canEdit)}</td>
        <td class="col-actions table-cell-center">
          ${actionBuilder.create('ansprechpartner', ap.id)}
        </td>
      </tr>
    `;
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   */
  renderShellContent() {
    const isAdmin = this.isAdmin;
    const canEdit = this.canEdit;
    
    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('ansprechpartner', { 
              placeholder: 'Ansprechpartner suchen...', 
              currentValue: this.searchQuery 
            })}
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? `<button id="btn-ansprechpartner-new" class="primary-btn">Neuen Ansprechpartner anlegen</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="ansprechpartner-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-ansprechpartner"></th>` : ''}
              <th class="col-name">Name</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Position</th>
              <th>Mail</th>
              <th>Telefon Mobil</th>
              <th class="table-cell-center">LinkedIn</th>
              <th class="table-cell-center">Newsletter</th>
              <th class="col-actions table-cell-center">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '12' : '11'}" class="no-data">Lade Ansprechpartner...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-ansprechpartner"></div>
    `;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialisiert die Filter-Bar
   */
  async initializeFilterBar() {
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('ansprechpartner', sortContainer, {
        nameField: 'nachname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('ansprechpartner', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }
  
  /**
   * Zusätzliche Events binden
   */
  bindAdditionalEvents(signal) {
    // Suchfeld Events über globale Komponente
    SearchInput.bind('ansprechpartner', (value) => this.handleSearch(value), signal);
    
    // Neuen Ansprechpartner anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-ansprechpartner-new') {
        e.preventDefault();
        window.navigateTo('/ansprechpartner/new');
      }
    }, { signal });
    
    // Delete Selected Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-delete-selected') {
        e.preventDefault();
        this.showDeleteSelectedConfirmation();
      }
    }, { signal });

    // Newsletter-Toggle direkt in der Tabelle speichern
    document.addEventListener('change', async (e) => {
      const target = e.target;
      if (!target || !target.classList?.contains('ansprechpartner-newsletter-toggle')) return;

      const id = target.dataset.id;
      if (!id || this._newsletterUpdateInFlight.has(id)) return;

      const checked = target.checked;
      this._newsletterUpdateInFlight.add(id);
      target.disabled = true;

      try {
        const result = await window.dataService.updateEntity('ansprechpartner', id, {
          erlaubt_newsletter: checked
        });

        if (!result?.success) {
          throw new Error(result?.error || 'Unbekannter Fehler beim Speichern');
        }

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: {
            entity: 'ansprechpartner',
            id,
            action: 'newsletter-updated'
          }
        }));
      } catch (error) {
        target.checked = !checked;
        console.error('❌ ANSPRECHPARTNERLIST: Newsletter-Update fehlgeschlagen:', error);

        if (window.toastSystem?.show) {
          window.toastSystem.show('error', `Newsletter konnte nicht gespeichert werden: ${error.message}`);
        } else {
          alert(`❌ Newsletter konnte nicht gespeichert werden: ${error.message}`);
        }
      } finally {
        this._newsletterUpdateInFlight.delete(id);
        target.disabled = !this.canEdit;
      }
    }, { signal });
  }
  
  /**
   * Cache invalidieren bei Destroy
   */
  destroy() {
    this._allowedAnsprechpartnerIds = null;
    super.destroy();
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ANSPRECHPARTNER-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Sichere Render-Methode für LinkedIn-URLs (XSS-Schutz)
   */
  renderLinkedInLink(url) {
    if (!url) return '-';
    
    try {
      const parsed = new URL(url);
      
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return '-';
      }
      
      const safeUrl = this.sanitize(url);
      
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="LinkedIn Profil"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>`;
    } catch {
      return '-';
    }
  }
  
  /**
   * Render Unternehmen (unterstützt sowohl Legacy-Einzelobjekt als auch Many-to-Many Array)
   */
  renderUnternehmen(ap) {
    // Many-to-Many: unternehmen als Array
    if (Array.isArray(ap.unternehmen) && ap.unternehmen.length > 0) {
      const items = ap.unternehmen.map(u => ({
        name: u.firmenname,
        label: u.internes_kuerzel || u.firmenname,
        type: 'org',
        id: u.id,
        entityType: 'unternehmen',
        logo_url: u.logo_url || null
      }));
      return avatarBubbles.renderBubbles(items, { showLabel: true });
    }
    
    // Legacy: unternehmen als Einzelobjekt
    if (ap.unternehmen && ap.unternehmen.firmenname) {
      const items = [{
        name: ap.unternehmen.firmenname,
        label: ap.unternehmen.internes_kuerzel || ap.unternehmen.firmenname,
        type: 'org',
        id: ap.unternehmen.id,
        entityType: 'unternehmen',
        logo_url: ap.unternehmen.logo_url || null
      }];
      return avatarBubbles.renderBubbles(items, { showLabel: true });
    }
    
    return '-';
  }
  
  /**
   * Prüfe ob aktive Filter vorhanden
   */
  hasActiveFilters() {
    const filters = filterSystem.getFilters('ansprechpartner');
    return Object.keys(filters).length > 0;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // BULK DELETE
  // ══════════════════════════════════════════════════════════════════════════
  
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedItems.size;
    
    if (selectedCount === 0) {
      alert('Keine Ansprechpartner ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Ansprechpartner wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Ansprechpartner wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Löschvorgang bestätigen',
        message: message,
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        danger: true
      });

      if (res?.confirmed) {
        this.deleteSelectedAnsprechpartner();
      }
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedAnsprechpartner();
    }
  }

  async deleteSelectedAnsprechpartner() {
    const selectedIds = Array.from(this.selectedItems);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Ansprechpartner...`);
    
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      const result = await window.dataService.deleteEntities('ansprechpartner', selectedIds);
      
      if (result.success) {
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Ansprechpartner erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadData();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'ansprechpartner', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      await this.loadData();
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATE FORM (für Routing)
  // ══════════════════════════════════════════════════════════════════════════
  
  showCreateForm() {
    console.log('🎯 Zeige Ansprechpartner-Erstellungsformular');
    ansprechpartnerCreate.showCreateForm();
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerList = new AnsprechpartnerList();
