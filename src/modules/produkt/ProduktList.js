// ProduktList.js (ES6-Modul)
// Produkt-Liste mit Filtersystem und Pagination
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { produktCreate } from './ProduktCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { ProduktFilterLogic } from './filters/ProduktFilterLogic.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class ProduktList extends BasePaginatedList {
  constructor() {
    super('produkt', {
      itemsPerPage: 25,
      headline: 'Produkte Übersicht',
      breadcrumbLabel: 'Produkte',
      sortField: 'created_at',
      sortAscending: false,
      paginationContainerId: 'pagination-produkt',
      tbodySelector: '.data-table tbody',
      tableColspan: 6, // Mit Admin-Checkbox
      checkboxClass: 'produkt-check',
      selectAllId: 'select-all-produkte'
    });
    
    // Alias für Kompatibilität
    this.selectedProdukte = this.selectedItems;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Produkt-Daten für eine Seite
   */
  async loadPageData(page, limit, filters) {
    try {
      if (!window.supabase) {
        return { data: [], total: 0 };
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = window.supabase
        .from('produkt')
        .select(`
          *,
          marke:marke_id(id, markenname, logo_url),
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          pflicht_elemente:produkt_pflicht_elemente(pflicht_element:pflicht_element_id(id, name)),
          no_gos:produkt_no_gos(no_go:no_go_id(id, name))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Kunden-Filter: nur Produkte der eigenen Unternehmen/Marken
      const rolle = window.currentUser?.rolle?.toLowerCase();
      if (rolle === 'kunde' || rolle === 'kunde_editor') {
        const scope = await this._getCustomerScope();
        if (scope.unternehmenIds.length === 0 && scope.markeIds.length === 0) {
          return { data: [], total: 0 };
        }
        const orParts = [];
        if (scope.unternehmenIds.length > 0) {
          orParts.push(`unternehmen_id.in.(${scope.unternehmenIds.join(',')})`);
        }
        if (scope.markeIds.length > 0) {
          orParts.push(`marke_id.in.(${scope.markeIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }

      const filtersToApply = { ...filters };
      delete filtersToApply._sortBy;
      delete filtersToApply._sortOrder;
      query = ProduktFilterLogic.buildSupabaseQuery(query, filtersToApply);

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Daten transformieren
      const transformedData = (data || []).map(produkt => ({
        ...produkt,
        pflicht_elemente: (produkt.pflicht_elemente || []).map(p => p.pflicht_element).filter(Boolean),
        no_gos: (produkt.no_gos || []).map(n => n.no_go).filter(Boolean)
      }));

      return {
        data: transformedData,
        total: count || 0
      };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Produkte:', error);
      throw error;
    }
  }
  
  /**
   * Rendert eine einzelne Produkt-Zeile
   */
  renderSingleRow(produkt) {
    const isAdmin = this.isAdmin;
    const sanitize = this.sanitize.bind(this);
    
    return `
      <tr data-id="${produkt.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="produkt-check" data-id="${produkt.id}"></td>` : ''}
        <td class="col-name">
          <a href="#" class="table-link" data-table="produkt" data-id="${produkt.id}">
            ${sanitize(produkt.name || '')}
          </a>
        </td>
        <td>${this.renderMarke(produkt.marke)}</td>
        <td>${this.renderUnternehmen(produkt.unternehmen)}</td>
        <td class="text-truncate" title="${sanitize(produkt.kernbotschaft || '')}">
          ${this.truncateText(produkt.kernbotschaft, 60)}
        </td>
        <td class="col-actions">
          ${actionBuilder.create('produkt', produkt.id)}
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
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-produkt-new" class="primary-btn">Neues Produkt anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-produkte"></th>` : ''}
              <th class="col-name">Produkt-Name</th>
              <th>Marke</th>
              <th>Unternehmen</th>
              <th>Kernbotschaft</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '6' : '5'}" class="no-data">Lade Produkte...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-produkt"></div>
    `;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialisiert die Filter-Bar
   */
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('produkt', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }
  
  /**
   * Zusätzliche Events binden
   */
  bindAdditionalEvents(signal) {
    // Neues Produkt anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-produkt-new' || e.target.id === 'btn-produkt-new-filter') {
        e.preventDefault();
        window.navigateTo('/produkt/new');
      }
    }, { signal });
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // PRODUKT-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Render Marke als Avatar Bubble
   */
  renderMarke(marke) {
    if (!marke || !marke.markenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }]);
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
   * Text kürzen
   */
  truncateText(text, maxLength) {
    if (!text) return '-';
    const sanitized = this.sanitize(text);
    if (sanitized.length <= maxLength) return sanitized;
    return sanitized.substring(0, maxLength) + '...';
  }

  /**
   * Kunden-Scope: Unternehmen- und Marke-IDs des eingeloggten Kunden ermitteln
   */
  async _getCustomerScope() {
    const userId = window.currentUser?.id;
    if (!userId) return { unternehmenIds: [], markeIds: [] };

    const { data: userUnternehmen } = await window.supabase
      .from('kunde_unternehmen')
      .select('unternehmen_id')
      .eq('kunde_id', userId);

    const unternehmenIds = [...new Set((userUnternehmen || []).map(u => u.unternehmen_id).filter(Boolean))];

    const { data: userMarken } = await window.supabase
      .from('kunde_marke')
      .select('marke_id')
      .eq('kunde_id', userId);

    const directMarkeIds = (userMarken || []).map(m => m.marke_id).filter(Boolean);

    let unternehmenMarkeIds = [];
    if (unternehmenIds.length > 0) {
      const { data: markenByUnternehmen } = await window.supabase
        .from('marke')
        .select('id')
        .in('unternehmen_id', unternehmenIds);
      unternehmenMarkeIds = (markenByUnternehmen || []).map(m => m.id).filter(Boolean);
    }

    return {
      unternehmenIds,
      markeIds: [...new Set([...directMarkeIds, ...unternehmenMarkeIds])]
    };
  }

  /**
   * Show Create Form (für Routing)
   */
  showCreateForm() {
    console.log('🎯 Zeige Produkt-Erstellungsformular');
    produktCreate.showCreateForm();
  }
}

// Exportiere Instanz für globale Nutzung
export const produktList = new ProduktList();
