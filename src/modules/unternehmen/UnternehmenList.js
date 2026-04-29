// UnternehmenList.js (ES6-Modul)
// Unternehmen-Liste mit neuem Filtersystem und Pagination
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { UnternehmenService } from './services/UnternehmenService.js';

export class UnternehmenList extends BasePaginatedList {
  constructor() {
    super('unternehmen', {
      itemsPerPage: 25,
      headline: 'Unternehmen Übersicht',
      breadcrumbLabel: 'Unternehmen',
      sortField: 'firmenname',
      sortAscending: true,
      paginationContainerId: 'pagination-unternehmen',
      tbodySelector: '.data-table tbody',
      tableColspan: 11, // Mit Admin-Checkbox
      checkboxClass: 'unternehmen-check',
      selectAllId: 'select-all-unternehmen'
    });
    
    // Alias für Kompatibilität
    this.selectedUnternehmen = this.selectedItems;
    
    // Erlaubte IDs für Nicht-Admins
    this._allowedUnternehmenIds = null;
    this._mitarbeiterQuickFilterOptions = [];
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN FÜR PERMISSION-HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Setzt entity-spezifische Caches zurück bei Permission-Änderungen
   * @override
   */
  resetEntityCaches() {
    console.log('🔄 UNTERNEHMENLISTE: Cache zurückgesetzt');
    this._allowedUnternehmenIds = null;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Unternehmen-Daten für eine Seite
   * Mit komplexer Mitarbeiter-Filterung für Nicht-Admins
   */
  async loadPageData(page, limit, filters) {
    try {
      const intersectIds = (baseIds, nextIds) => {
        if (!Array.isArray(nextIds) || nextIds.length === 0) return [];
        if (!Array.isArray(baseIds)) return [...new Set(nextIds)];
        const nextSet = new Set(nextIds);
        return baseIds.filter(id => nextSet.has(id));
      };

      // Nicht-Admin Filterung
      let allowedUnternehmenIds = null;
      if (!this.isAdmin) {
        const { data: mitarbeiterUnternehmen, error } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        
        if (error) {
          console.error('❌ UNTERNEHMENLISTE: Fehler beim Laden der Zuordnungen:', error);
        }
        
        allowedUnternehmenIds = (mitarbeiterUnternehmen || [])
          .map(r => r.unternehmen_id)
          .filter(Boolean);
        
        if (allowedUnternehmenIds.length === 0) {
          return { data: [], total: 0 };
        }
      }
      
      // Berechne Range für Supabase
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Basis-Query
      let query = window.supabase
        .from('unternehmen')
        .select(`
          *,
          unternehmen_branchen (
            branche_id,
            branchen (id, name)
          )
        `, { count: 'exact' })
        .order(this.currentSort.field, { ascending: this.currentSort.ascending });
      
      // Alle ID-basierten Einschränkungen über Schnittmengen kombinieren
      let constrainedUnternehmenIds = Array.isArray(allowedUnternehmenIds)
        ? [...allowedUnternehmenIds]
        : null;
      
      // Branche-Filter
      if (filters.branche_id) {
        const { data: links } = await window.supabase
          .from('unternehmen_branchen')
          .select('unternehmen_id')
          .eq('branche_id', filters.branche_id);
        
        const brancheUnternehmenIds = (links || []).map(r => r.unternehmen_id).filter(Boolean);
        
        if (brancheUnternehmenIds.length === 0) {
          return { data: [], total: 0 };
        }
        
        constrainedUnternehmenIds = intersectIds(constrainedUnternehmenIds, brancheUnternehmenIds);
      }

      // Mitarbeiter-Filter (Mehrfachauswahl)
      const selectedMitarbeiterIds = Array.isArray(filters.mitarbeiter_ids)
        ? filters.mitarbeiter_ids.map(id => String(id).trim()).filter(Boolean)
        : [];

      if (selectedMitarbeiterIds.length > 0) {
        const { data: mitarbeiterLinks, error: mitarbeiterFilterError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .in('mitarbeiter_id', selectedMitarbeiterIds);

        if (mitarbeiterFilterError) {
          console.error('❌ UNTERNEHMENLISTE: Fehler beim Mitarbeiter-Filter:', mitarbeiterFilterError);
          throw mitarbeiterFilterError;
        }

        const mitarbeiterUnternehmenIds = [...new Set(
          (mitarbeiterLinks || []).map(row => row.unternehmen_id).filter(Boolean)
        )];

        if (mitarbeiterUnternehmenIds.length === 0) {
          return { data: [], total: 0 };
        }

        constrainedUnternehmenIds = intersectIds(constrainedUnternehmenIds, mitarbeiterUnternehmenIds);
      }

      if (Array.isArray(constrainedUnternehmenIds)) {
        if (constrainedUnternehmenIds.length === 0) {
          return { data: [], total: 0 };
        }
        query = query.in('id', constrainedUnternehmenIds);
      }
      
      // Weitere Filter anwenden
      // Name-Filter vom Suchfeld: sucht in firmenname UND zugehörigen Markennamen
      if (filters.name) {
        const search = filters.name;
        const { data: matchM } = await window.supabase
          .from('marke').select('unternehmen_id').ilike('markenname', `%${search}%`);
        const orParts = [`firmenname.ilike.%${search}%`];
        if (matchM?.length) {
          const ids = [...new Set(matchM.map(m => m.unternehmen_id).filter(Boolean))];
          if (ids.length) orParts.push(`id.in.(${ids.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }
      if (filters.firmenname) {
        query = query.ilike('firmenname', `%${filters.firmenname}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.rechnungsadresse_stadt) {
        query = query.ilike('rechnungsadresse_stadt', `%${filters.rechnungsadresse_stadt}%`);
      }
      if (filters.rechnungsadresse_land) {
        query = query.ilike('rechnungsadresse_land', `%${filters.rechnungsadresse_land}%`);
      }
      
      // Pagination anwenden
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Branchen-Daten transformieren
      const transformedData = (data || []).map(unternehmen => {
        if (unternehmen.unternehmen_branchen) {
          unternehmen.branchen = unternehmen.unternehmen_branchen
            .map(ub => ub.branchen)
            .filter(Boolean);
          delete unternehmen.unternehmen_branchen;
        } else {
          unternehmen.branchen = [];
        }
        return unternehmen;
      });
      
      return {
        data: transformedData,
        total: count || 0
      };
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      throw error;
    }
  }
  
  /**
   * Rendert eine einzelne Unternehmen-Zeile
   */
  renderSingleRow(u) {
    const canBulkDelete = this.canBulkDelete;
    const sanitize = this.sanitize.bind(this);
    
    const allMitarbeiter = u._mitarbeiter || [];
    const management = allMitarbeiter.filter(m => m.role === 'management');
    const leads = allMitarbeiter.filter(m => m.role === 'lead_mitarbeiter');
    const mitarbeiter = allMitarbeiter.filter(m => m.role === 'mitarbeiter');
    
    return `
      <tr data-id="${u.id}">
        ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="unternehmen-check" data-id="${u.id}"></td>` : ''}
        <td class="col-name">
          ${u.logo_url ? `<img src="${u.logo_url}" class="table-logo" width="24" height="24" alt="" />` : ''}
          <a href="#" class="table-link" data-table="unternehmen" data-id="${u.id}">
            ${sanitize(u.internes_kuerzel || u.firmenname || '')}
          </a>
        </td>
        <td class="col-stadt">${sanitize(u.rechnungsadresse_stadt || '-')}</td>
        <td>${sanitize(u.rechnungsadresse_land || '-')}</td>
        <td class="col-webseite table-cell-center">${u.webseite ? `<a href="${UnternehmenService.sanitizeUrl(u.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${sanitize(u.webseite)}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>` : '-'}</td>
        <td>${this.renderBrancheTags(u.branchen)}</td>
        <td>${this.renderAnsprechpartnerList(u._ansprechpartner)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(management)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(leads)}</td>
        <td class="col-mitarbeiter">${this.renderMitarbeiterByRole(mitarbeiter)}</td>
        <td class="col-actions">
          ${actionBuilder.create('unternehmen', u.id)}
        </td>
      </tr>
    `;
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   */
  renderShellContent() {
    const canBulkDelete = this.canBulkDelete;
    const canEdit = this.canEdit;
    
    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('unternehmen', { 
              placeholder: 'Unternehmen suchen...', 
              currentValue: this.searchQuery 
            })}
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
            <div id="unternehmen-mitarbeiter-filter-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-unternehmen-new" class="primary-btn">Neues Unternehmen anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table data-table--unternehmen">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-unternehmen"></th>` : ''}
              <th class="col-name">Name</th>
              <th class="col-stadt">Stadt</th>
              <th>Land</th>
              <th class="col-webseite table-cell-center">Webseite</th>
              <th>Branche</th>
              <th>Ansprechpartner</th>
              <th class="col-mitarbeiter">Management</th>
              <th class="col-mitarbeiter">Lead</th>
              <th class="col-mitarbeiter">Mitarbeiter</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '11' : '10'}" class="no-data">Lade Unternehmen...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-unternehmen"></div>
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
      sortDropdown.init('unternehmen', sortContainer, {
        nameField: 'firmenname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('unternehmen', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }

    await this.initializeMitarbeiterQuickFilter();
  }
  
  /**
   * Zusätzliche Events binden
   */
  bindAdditionalEvents(signal) {
    // Suchfeld Events über globale Komponente
    SearchInput.bind('unternehmen', (value) => this.handleSearch(value), signal);
    
    // Neues Unternehmen anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-unternehmen-new' || e.target.id === 'btn-unternehmen-new-filter') {
        e.preventDefault();
        window.navigateTo('/unternehmen/new');
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
      const dropdown = document.getElementById('mitarbeiter-quick-filter-dropdown');
      const toggleButton = document.getElementById('mitarbeiter-quick-filter-toggle');
      if (!container || !dropdown || !toggleButton) return;

      const clickedToggleButton = e.target.closest('#mitarbeiter-quick-filter-toggle');
      if (clickedToggleButton) {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dropdown.classList.contains('show');
        dropdown.classList.toggle('show', willOpen);
        toggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      const clickedReset = e.target.closest('#mitarbeiter-quick-filter-reset');
      if (clickedReset) {
        e.preventDefault();
        this.applyMitarbeiterQuickFilter([]);
        return;
      }

      if (!e.target.closest('#unternehmen-mitarbeiter-filter-container')) {
        dropdown.classList.remove('show');
        toggleButton.setAttribute('aria-expanded', 'false');
      }
    }, { signal });

    document.addEventListener('change', (e) => {
      if (!e.target.classList.contains('mitarbeiter-quick-filter-toggle-input')) return;

      const selectedIds = Array.from(
        document.querySelectorAll('.mitarbeiter-quick-filter-toggle-input:checked')
      ).map(input => input.value).filter(Boolean);

      this.applyMitarbeiterQuickFilter(selectedIds);
    }, { signal });
  }

  onFiltersApplied(filters) {
    const selectedMitarbeiterIds = this.getSelectedMitarbeiterFilterIds();
    const mergedFilters = { ...(filters || {}) };
    if (selectedMitarbeiterIds.length > 0) {
      mergedFilters.mitarbeiter_ids = selectedMitarbeiterIds;
    }
    super.onFiltersApplied(mergedFilters);
    this.syncMitarbeiterQuickFilterUI();
  }

  onFiltersReset() {
    super.onFiltersReset();
    this.syncMitarbeiterQuickFilterUI();
  }
  
  /**
   * Überschriebene updateTable mit Ansprechpartner/Mitarbeiter-Loading
   */
  async updateTable(unternehmen) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!unternehmen || unternehmen.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      // Kontakte und Mitarbeiter für alle Unternehmen laden
      const unternehmenIds = unternehmen.map(u => u.id).filter(Boolean);
      const [apMap, mitarbeiterMap] = await Promise.all([
        this.loadAnsprechpartnerMap(unternehmenIds),
        this.loadMitarbeiterMap(unternehmenIds)
      ]);

      // Daten an Unternehmen anhängen
      unternehmen.forEach(u => {
        u._ansprechpartner = apMap.get(u.id) || [];
        u._mitarbeiter = mitarbeiterMap.get(u.id) || [];
      });

      tbody.innerHTML = unternehmen.map(u => this.renderSingleRow(u)).join('');
    });
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // UNTERNEHMEN-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Render Branche Tags
   */
  renderBrancheTags(branchen) {
    if (!branchen || (Array.isArray(branchen) && branchen.length === 0)) return '-';

    if (typeof branchen === 'object' && !Array.isArray(branchen) && branchen.name) {
      return `<div class="tags tags-compact"><span class="tag tag--branche">${this.sanitize(branchen.name)}</span></div>`;
    }

    if (typeof branchen === 'string') {
      const parts = branchen.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return '-';
      const inner = parts.map(label => `<span class="tag tag--branche">${this.sanitize(label)}</span>`).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }

    if (Array.isArray(branchen)) {
      const inner = branchen.map(b => {
        const label = typeof b === 'object' ? (b.name || b.label || b) : b;
        return `<span class="tag tag--branche">${this.sanitize(String(label).trim())}</span>`;
      }).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }

    if (typeof branchen === 'object') {
      const label = branchen.name || branchen.label;
      return label ? `<div class="tags tags-compact"><span class="tag tag--branche">${this.sanitize(label)}</span></div>` : '-';
    }

    return '-';
  }

  /**
   * Ansprechpartner-Map laden
   */
  async loadAnsprechpartnerMap(unternehmenIds) {
    const map = new Map();
    try {
      if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
        return map;
      }
      
      const { data, error } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select(`
          unternehmen_id,
          ansprechpartner:ansprechpartner_id (
            id, vorname, nachname, email, profile_image_url
          )
        `)
        .in('unternehmen_id', unternehmenIds);
        
      if (error) {
        console.warn('⚠️ Konnte Ansprechpartner nicht laden:', error);
        return map;
      }
      
      (data || []).forEach(item => {
        if (!item.ansprechpartner) return;
        
        const unternehmenId = item.unternehmen_id;
        const list = map.get(unternehmenId) || [];
        list.push(item.ansprechpartner);
        map.set(unternehmenId, list);
      });
      
    } catch (e) {
      console.warn('⚠️ loadAnsprechpartnerMap Fehler:', e);
    }
    return map;
  }

  /**
   * Mitarbeiter-Map laden
   */
  async loadMitarbeiterMap(unternehmenIds) {
    const map = new Map();
    try {
      if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
        return map;
      }
      
      const { data, error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select(`
          unternehmen_id,
          role,
          benutzer:mitarbeiter_id (id, name, profile_image_url)
        `)
        .in('unternehmen_id', unternehmenIds);
        
      if (error) {
        console.warn('⚠️ Konnte Mitarbeiter nicht laden:', error);
        return map;
      }
      
      (data || []).forEach(item => {
        if (!item.benutzer) return;
        
        const unternehmenId = item.unternehmen_id;
        const mitarbeiter = { ...item.benutzer, role: item.role || 'mitarbeiter' };
        
        const list = map.get(unternehmenId) || [];
        list.push(mitarbeiter);
        map.set(unternehmenId, list);
      });
      
    } catch (e) {
      console.warn('⚠️ loadMitarbeiterMap Fehler:', e);
    }
    return map;
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
   * Ansprechpartner-Liste rendern
   */
  renderAnsprechpartnerList(list) {
    if (!list || list.length === 0) return '-';
    
    const items = list
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
   * Prüfe ob aktive Filter vorhanden
   */
  hasActiveFilters() {
    const filters = filterSystem.getFilters('unternehmen');
    return Object.keys(filters).length > 0;
  }

  async initializeMitarbeiterQuickFilter() {
    const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
    if (!container) return;

    this._mitarbeiterQuickFilterOptions = await this.loadMitarbeiterQuickFilterOptions();
    container.innerHTML = this.renderMitarbeiterQuickFilterHtml();
  }

  async loadMitarbeiterQuickFilterOptions() {
    try {
      // Primärquelle: benutzer (damit auch nicht-zugeordnete Mitarbeiter angezeigt werden)
      let data = [];

      const { data: activeUsers, error: activeUsersError } = await window.supabase
        .from('benutzer')
        .select('id, name, rolle, freigeschaltet')
        .in('rolle', ['admin', 'mitarbeiter'])
        .eq('freigeschaltet', true);

      if (activeUsersError) {
        // Fallback für Instanzen ohne freigeschaltet-Spalte oder bei inkompatiblen Schemas
        const { data: fallbackUsers, error: fallbackError } = await window.supabase
          .from('benutzer')
          .select('id, name, rolle')
          .in('rolle', ['admin', 'mitarbeiter']);

        if (fallbackError) {
          console.warn('⚠️ UNTERNEHMENLISTE: Mitarbeiterfilter konnte nicht geladen werden:', fallbackError);
          return [];
        }

        data = fallbackUsers || [];
      } else {
        data = activeUsers || [];
      }

      return (data || [])
        .filter(user => user?.id && user?.name)
        .filter(user => {
          const name = String(user.name || '').toLowerCase();
          // Auf Wunsch explizit ausblenden
          if (name.includes('oliver') && (name.includes('mageldanz') || name.includes('mackeldanz'))) {
            return false;
          }
          if (name.includes('alpha foods test')) {
            return false;
          }
          return true;
        })
        .map(user => ({ id: user.id, name: user.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    } catch (error) {
      console.warn('⚠️ UNTERNEHMENLISTE: Fehler bei Mitarbeiterfilter-Optionen:', error);
      return [];
    }
  }

  getSelectedMitarbeiterFilterIds() {
    const currentFilters = filterSystem.getFilters('unternehmen');
    const ids = currentFilters?.mitarbeiter_ids;
    if (!Array.isArray(ids)) return [];
    return ids.map(id => String(id).trim()).filter(Boolean);
  }

  renderMitarbeiterQuickFilterHtml() {
    const selectedIds = this.getSelectedMitarbeiterFilterIds();
    const selectedSet = new Set(selectedIds);
    const selectedCount = selectedIds.length;
    const hasOptions = this._mitarbeiterQuickFilterOptions.length > 0;
    const optionsHtml = hasOptions
      ? this._mitarbeiterQuickFilterOptions.map((m, index) => {
          const inputId = `unternehmen-mitarbeiter-filter-${index}`;
          const checked = selectedSet.has(m.id) ? 'checked' : '';
          const safeLabel = this.sanitize(m.name);

          return `
            <label class="filter-checkbox-option" for="${inputId}">
              <span class="toggle-text">${safeLabel}</span>
              <span class="toggle-switch">
                <input type="checkbox"
                       id="${inputId}"
                       class="mitarbeiter-quick-filter-toggle-input"
                       value="${m.id}"
                       aria-label="${safeLabel}"
                       ${checked}>
                <span class="toggle-slider"></span>
              </span>
            </label>
          `;
        }).join('')
      : '<div class="filter-dropdown-empty">Keine Mitarbeiter gefunden</div>';

    return `
      <div class="filter-dropdown-container">
        <button id="mitarbeiter-quick-filter-toggle"
                class="filter-dropdown-toggle"
                aria-expanded="false"
                aria-label="Mitarbeiter filtern">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <path d="M20 8v6"/>
            <path d="M23 11h-6"/>
          </svg>
          <span>Mitarbeiter</span>
          ${selectedCount > 0 ? `<span class="filter-count-badge">${selectedCount}</span>` : ''}
        </button>

        <div id="mitarbeiter-quick-filter-dropdown" class="filter-dropdown">
          <div class="filter-dropdown-header">
            <span class="filter-dropdown-title">Mitarbeiter filtern</span>
            <button id="mitarbeiter-quick-filter-reset" class="secondary-btn" ${selectedCount === 0 ? 'disabled' : ''}>
              Zurücksetzen
            </button>
          </div>
          <div class="filter-submenu-body mitarbeiter-quick-filter-body">
            <div class="filter-submenu-checkboxes mitarbeiter-quick-filter-list">
              ${optionsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  syncMitarbeiterQuickFilterUI() {
    const container = document.getElementById('unternehmen-mitarbeiter-filter-container');
    if (!container) return;
    container.innerHTML = this.renderMitarbeiterQuickFilterHtml();
  }

  applyMitarbeiterQuickFilter(selectedIds) {
    const normalizedIds = Array.isArray(selectedIds)
      ? selectedIds.map(id => String(id).trim()).filter(Boolean)
      : [];

    const currentFilters = filterSystem.getFilters('unternehmen') || {};
    const nextFilters = { ...currentFilters };

    if (normalizedIds.length > 0) {
      nextFilters.mitarbeiter_ids = normalizedIds;
    } else {
      delete nextFilters.mitarbeiter_ids;
    }

    filterSystem.applyFilters('unternehmen', nextFilters);
    this.pagination.currentPage = 1;
    this.loadDataDebounced(100);
    this.updateMitarbeiterQuickFilterMeta(normalizedIds.length);
  }

  updateMitarbeiterQuickFilterMeta(selectedCount) {
    const toggleButton = document.getElementById('mitarbeiter-quick-filter-toggle');
    const resetButton = document.getElementById('mitarbeiter-quick-filter-reset');
    if (!toggleButton) return;

    let badge = toggleButton.querySelector('.filter-count-badge');
    if (selectedCount > 0) {
      if (!badge) {
        toggleButton.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${selectedCount}</span>`);
      } else {
        badge.textContent = String(selectedCount);
      }
    } else if (badge) {
      badge.remove();
    }

    if (resetButton) {
      resetButton.disabled = selectedCount === 0;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE FORM (für Routing)
  // ══════════════════════════════════════════════════════════════════════════

  showCreateForm() {
    console.log('🎯 Zeige Unternehmen-Erstellungsformular');
    window.setHeadline('Neues Unternehmen anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neues Unternehmen');
    }
    
    const formHtml = window.formSystem.renderFormOnly('unternehmen');
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
            <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
              <label class="form-logo-label">Logo Vorschau:</label>
              <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
            </div>
          </div>
        </div>
        <div class="form-split-right hidden" id="unternehmen-split-container">
          <div id="unternehmen-embedded-form"></div>
        </div>
      </div>
    `;

    window.formSystem.bindFormEvents('unternehmen', null);
    
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      this.setupLogoPreview(form);
      this.setupDuplicateValidation(form);
    }
  }

  setupDuplicateValidation(form) {
    const firmennameField = form.querySelector('#firmenname, input[name="firmenname"]');
    if (!firmennameField) return;

    let messageContainer = firmennameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      firmennameField.parentElement.appendChild(messageContainer);
    }

    firmennameField.addEventListener('blur', async (e) => {
      await this.validateUnternehmenDuplicate(e.target.value, messageContainer);
    });

    firmennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
  }

  async validateUnternehmenDuplicate(firmenname, messageContainer) {
    if (!firmenname || firmenname.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) return;

    try {
      const result = await window.duplicateChecker.checkUnternehmen(firmenname, null);

      if (result.exact) {
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ Fehler bei Duplikat-Validierung:', error);
    }
  }

  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Firmenname existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.firmenname}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.firmenname}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  bindDuplicateLinks(container, entityType) {
    container.querySelectorAll('.duplicate-link[data-entity-id]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id && window.navigationSystem) {
          window.navigationSystem.navigateTo(`/${entityType}/${id}`);
        }
      });
    });
  }

  clearDuplicateMessages(container) {
    if (container) container.innerHTML = '';
  }

  disableSubmitButton(disable) {
    const form = document.getElementById('unternehmen-form');
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = disable;
      submitBtn.style.opacity = disable ? '0.5' : '1';
      submitBtn.style.cursor = disable ? 'not-allowed' : 'pointer';
    }
  }

  enableSubmitButton() {
    this.disableSubmitButton(false);
  }

  setupLogoPreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
    if (!uploaderRoot) return;

    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('logo-preview-container');
            const previewImage = document.getElementById('logo-preview-image');
            if (previewContainer && previewImage) {
              previewImage.src = event.target.result;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  async handleFormSubmit() {
    try {
      const form = document.getElementById('unternehmen-form');
      const submitData = window.formSystem.collectSubmitData(form);

      const validation = window.validatorSystem.validateForm(submitData, {
        firmenname: { type: 'text', minLength: 2, required: true },
        invoice_email: { type: 'email' }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      const result = await window.dataService.createEntity('unternehmen', submitData);

      if (result.success && result.id) {
        try {
          const { RelationTables } = await import('../../core/form/logic/RelationTables.js');
          const relationTables = new RelationTables();
          await relationTables.handleRelationTables('unternehmen', result.id, submitData, form);
        } catch (relationError) {
          console.error('❌ Junction Tables Fehler:', relationError);
        }

        try {
          await this.saveMitarbeiterRoles(result.id, submitData);
        } catch (mitarbeiterErr) {
          console.error('❌ Mitarbeiter-Rollen Fehler:', mitarbeiterErr);
        }
        
        try {
          await this.uploadLogo(result.id, form);
        } catch (logoErr) {
          console.error('❌ Logo-Upload Fehler:', logoErr);
        }

        this.showSuccessMessage('Unternehmen erfolgreich erstellt!');
        
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'unternehmen', id: result.id, action: 'created' } 
        }));
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  showValidationErrors(errors) {
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        fieldElement.parentNode.appendChild(errorElement);
      }
    });
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    const form = document.getElementById('unternehmen-form');
    if (form) form.parentNode.insertBefore(successDiv, form);
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    const form = document.getElementById('unternehmen-form');
    if (form) form.parentNode.insertBefore(errorDiv, form);
  }

  async saveMitarbeiterRoles(unternehmenId, data) {
    return UnternehmenService.saveMitarbeiterRoles(unternehmenId, data, { deleteExisting: false });
  }

  async uploadLogo(unternehmenId, form) {
    return UnternehmenService.uploadLogo(unternehmenId, form);
  }
}

// Exportiere Instanz für globale Nutzung
export const unternehmenList = new UnternehmenList();
