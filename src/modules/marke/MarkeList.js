// MarkeList.js (ES6-Modul)
// Marken-Liste mit neuem Filtersystem und Pagination
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { markeCreate } from './MarkeCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { MarkeFilterLogic } from './filters/MarkeFilterLogic.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { MarkeService } from './services/MarkeService.js';

export class MarkeList extends BasePaginatedList {
  constructor() {
    super('marke', {
      itemsPerPage: 10,
      headline: 'Marken Übersicht',
      breadcrumbLabel: 'Marke',
      sortField: 'markenname',
      sortAscending: true,
      paginationContainerId: 'pagination-marke',
      tbodySelector: '.data-table tbody',
      tableColspan: 10, // Mit Admin-Checkbox
      checkboxClass: 'marke-check',
      selectAllId: 'select-all-marken'
    });
    
    // Alias für Kompatibilität
    this.selectedMarken = this.selectedItems;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Marken-Daten für eine Seite
   * Verwendet eigene Supabase-Query für komplexe Beziehungen
   */
  async loadPageData(page, limit, filters) {
    try {
      if (!window.supabase) {
        return { data: [], total: 0 };
      }

      // Sichtbarkeit: Nicht-Admins nur zugeordnete Marken
      const isAdmin = this.isAdmin;
      let allowedMarkeIds = [];
      
      if (!isAdmin) {
        allowedMarkeIds = await MarkeService.getAllowedMarkeIdsForUser(window.currentUser?.id);
        
        if (allowedMarkeIds.length === 0) {
          return { data: [], total: 0 };
        }
      }

      // Berechne Range für Supabase
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Basis-Query mit Embeds
      let query = window.supabase
        .from('marke')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          branchen:marke_branchen(branche:branche_id(id, name)),
          ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url))
        `, { count: 'exact' })
        .order(this.currentSort.field, { ascending: this.currentSort.ascending });

      // Nicht-Admin Filterung
      if (!isAdmin && allowedMarkeIds.length > 0) {
        query = query.in('id', allowedMarkeIds);
      }

      // Branche-Filter
      if (filters.branche_id) {
        const { data: branchenMarken } = await window.supabase
          .from('marke_branchen')
          .select('marke_id')
          .eq('branche_id', filters.branche_id);
        
        const markeIdsWithBranche = (branchenMarken || []).map(mb => mb.marke_id).filter(Boolean);
        
        if (markeIdsWithBranche.length > 0) {
          query = query.in('id', markeIdsWithBranche);
        } else {
          return { data: [], total: 0 };
        }
      }

      // Andere Filter anwenden
      const filtersWithoutBranche = { ...filters };
      delete filtersWithoutBranche.branche_id;
      delete filtersWithoutBranche._sortBy;
      delete filtersWithoutBranche._sortOrder;
      query = MarkeFilterLogic.buildSupabaseQuery(query, filtersWithoutBranche);

      // Range für Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Daten transformieren
      const transformedData = (data || []).map(marke => ({
        ...marke,
        branchen: (marke.branchen || []).map(b => b.branche).filter(Boolean),
        ansprechpartner: (marke.ansprechpartner || []).map(a => a.ansprechpartner).filter(Boolean)
      }));

      return {
        data: transformedData,
        total: count || 0
      };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Marken:', error);
      throw error;
    }
  }
  
  /**
   * Rendert eine einzelne Marken-Zeile
   */
  renderSingleRow(marke) {
    const isAdmin = this.isAdmin;
    const sanitize = this.sanitize.bind(this);
    
    const allMitarbeiter = marke._mitarbeiter || [];
    const management = allMitarbeiter.filter(m => m.role === 'management');
    const leads = allMitarbeiter.filter(m => m.role === 'lead_mitarbeiter');
    const mitarbeiter = allMitarbeiter.filter(m => m.role !== 'management' && m.role !== 'lead_mitarbeiter');
    
    return `
      <tr data-id="${marke.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="marke-check" data-id="${marke.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          ${marke.logo_url 
            ? `<img src="${marke.logo_url}" class="table-logo" width="24" height="24" alt="" />` 
            : `<span class="table-avatar">${(marke.markenname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${sanitize(marke.markenname || '')}
          </a>
        </td>
        <td>${this.renderUnternehmen(marke.unternehmen)}</td>
        <td>${this.renderAnsprechpartner(marke.ansprechpartner)}</td>
        <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${marke.webseite}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>` : '-'}</td>
        <td>${this.renderBranchen(marke.branchen)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(management)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(leads)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(mitarbeiter)}</td>
        <td class="col-actions">
          ${actionBuilder.create('marke', marke.id)}
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
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-marken"></th>` : ''}
              <th class="col-name">Markenname</th>
              <th>Unternehmen</th>
              <th>Ansprechpartner</th>
              <th>Webseite</th>
              <th>Branche</th>
              <th class="col-mitarbeiter">Management</th>
              <th class="col-mitarbeiter">Lead</th>
              <th class="col-mitarbeiter">Mitarbeiter</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '10' : '9'}" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-marke"></div>
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
      sortDropdown.init('marke', sortContainer, {
        nameField: 'markenname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('marke', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }
  
  /**
   * Zusätzliche Events binden
   */
  bindAdditionalEvents(signal) {
    // Neue Marke anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-marke-new' || e.target.id === 'btn-marke-new-filter') {
        e.preventDefault();
        window.navigateTo('/marke/new');
      }
    }, { signal });
  }
  
  /**
   * Überschriebene updateTable mit Mitarbeiter-Loading
   */
  async updateTable(marken) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!marken || marken.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      // Mitarbeiter für alle Marken laden
      const markeIds = marken.map(m => m.id).filter(Boolean);
      const mitarbeiterMap = await this.loadMitarbeiterMap(markeIds);

      // Daten an Marken anhängen
      marken.forEach(m => {
        m._mitarbeiter = mitarbeiterMap.get(m.id) || [];
      });

      tbody.innerHTML = marken.map(marke => this.renderSingleRow(marke)).join('');
    });
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // MARKE-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Rendere Branchen Tags
   */
  renderBranchen(branchen) {
    if (!branchen || branchen.length === 0) return '-';

    const branchenTags = branchen
      .filter(branche => branche && branche.name)
      .map(branche => `<span class="tag tag--branche">${branche.name}</span>`)
      .join('');

    return `<div class="tags tags-compact">${branchenTags}</div>`;
  }

  /**
   * Render Unternehmen als Avatar Bubble
   */
  renderUnternehmen(unternehmen) {
    if (!unternehmen || !unternehmen.firmenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }]);
  }

  /**
   * Render Ansprechpartner
   */
  renderAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner || ansprechpartner.length === 0) return '-';

    const items = ansprechpartner
      .filter(ap => ap && ap.vorname && ap.nachname)
      .map(ap => ({
        name: `${ap.vorname} ${ap.nachname}`,
        type: 'person',
        id: ap.id,
        entityType: 'ansprechpartner',
        profile_image_url: ap.profile_image_url || null
      }));

    return avatarBubbles.renderBubbles(items);
  }

  /**
   * Mitarbeiter nach Rolle rendern
   */
  renderMitarbeiterByRole(list) {
    if (!list || list.length === 0) return '-';
    
    const items = list
      .filter(m => m && m.name)
      .map(m => ({
        name: m.name,
        type: 'person',
        id: m.id,
        entityType: 'mitarbeiter',
        profile_image_url: m.profile_image_url || null
      }));
    
    return avatarBubbles.renderBubbles(items);
  }

  /**
   * Lade Mitarbeiter-Zuordnungen für mehrere Marken
   */
  async loadMitarbeiterMap(markeIds) {
    const map = new Map();
    try {
      if (!window.supabase || !Array.isArray(markeIds) || markeIds.length === 0) {
        return map;
      }
      
      const { data, error } = await window.supabase
        .from('marke_mitarbeiter')
        .select(`
          marke_id,
          role,
          benutzer:mitarbeiter_id (
            id,
            name,
            profile_image_url
          )
        `)
        .in('marke_id', markeIds);
      
      if (error) {
        console.warn('⚠️ Konnte Mitarbeiter nicht laden:', error);
        return map;
      }
      
      (data || []).forEach(item => {
        if (!item.benutzer) return;
        
        const markeId = item.marke_id;
        const mitarbeiter = {
          ...item.benutzer,
          role: item.role || 'mitarbeiter'
        };
        
        const list = map.get(markeId) || [];
        list.push(mitarbeiter);
        map.set(markeId, list);
      });
      
    } catch (e) {
      console.warn('⚠️ loadMitarbeiterMap Fehler:', e);
    }
    
    return map;
  }

  /**
   * Prüfe ob aktive Filter vorhanden
   */
  hasActiveFilters() {
    const filters = filterSystem.getFilters('marke');
    return Object.keys(filters).length > 0;
  }

  /**
   * Show Create Form (für Routing)
   */
  showCreateForm() {
    console.log('🎯 Zeige Marken-Erstellungsformular');
    markeCreate.showCreateForm();
  }
}

// Exportiere Instanz für globale Nutzung
export const markeList = new MarkeList();
