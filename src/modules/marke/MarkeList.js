// MarkeList.js (ES6-Modul)
// Marken-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { markeCreate } from './MarkeCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

export class MarkeList {
  constructor() {
    this.selectedMarken = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Marken-Liste
  async init() {
    console.log('🎯 MARKELLIST: Initialisiere Marken-Liste');
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ MARKELLIST: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    window.setHeadline('Marken Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Marke', url: '/marke', clickable: false }
      ]);
    }
    
    // BulkActionSystem für Marke registrieren
    window.bulkActionSystem?.registerList('marke', this);
    
    const canView = (window.canViewPage && window.canViewPage('marke')) || await window.checkUserPermission('marke', 'can_view');
    console.log('🔐 MARKELLIST: Berechtigung für marke.can_view:', canView);
    
    if (!canView) {
      console.log('❌ MARKELLIST: Keine Berechtigung für Marken');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Marken anzuzeigen.</p>
        </div>
      `;
      return;
    }

    console.log('✅ MARKELLIST: Berechtigung OK, lade Marken...');
    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
    console.log('✅ MARKELLIST: Initialisierung abgeschlossen');
  }

  // Lade und rendere Marken-Liste
  async loadAndRender() {
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      // Filter-Optionen werden aus den geladenen Entities extrahiert
      
      // Rendere die Seite-Struktur (ohne Filter-Daten)
      await this.render();
      
      // Lade gefilterte Marken für die Anzeige mit Sichtbarkeits-Logik
      const currentFilters = filterSystem.getFilters('marke');
      console.log('🔍 Lade Marken mit Filter:', currentFilters);
      const filteredMarken = await this.loadMarkenWithRelations(currentFilters);
      console.log('📊 Marken geladen:', filteredMarken?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredMarken);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'MarkeList.loadAndRender');
    }
  }

  // Lade Marken mit Beziehungen und Sichtbarkeits-Logik
  async loadMarkenWithRelations(filters = {}) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('marke', filters);
      }

      // Sichtbarkeit: Nicht-Admins nur zugeordnete Marken (direkt oder über Unternehmen)
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedMarkeIds = [];
      
      console.log('🔍 MARKELIST: Sichtbarkeits-Check:', {
        currentUser: window.currentUser?.name,
        rolle: window.currentUser?.rolle,
        isAdmin: isAdmin,
        userId: window.currentUser?.id
      });
      
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Marken
          const { data: assignedMarken, error } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
            
          if (error) {
            console.error('❌ MARKELIST: Fehler beim Laden der Zuordnungen:', error);
          }
          
          const directMarkeIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          // 2. NEU: Marken über zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          let unternehmenMarkeIds = [];
          if (unternehmenIds.length > 0) {
            // Alle Marken dieser Unternehmen finden
            const { data: unternehmenMarken } = await window.supabase
              .from('marke')
              .select('id')
              .in('unternehmen_id', unternehmenIds);
            
            unternehmenMarkeIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
          }
          
          // Alle zusammenführen und Duplikate entfernen
          allowedMarkeIds = [...new Set([...directMarkeIds, ...unternehmenMarkeIds])];
          
          console.log('🔍 MARKELIST: Zugeordnete Marken für Nicht-Admin:', {
            direkteMarken: directMarkeIds.length,
            unternehmenMarken: unternehmenMarkeIds.length,
            gesamt: allowedMarkeIds.length
          });
        } catch (error) {
          console.error('❌ MARKELIST: Exception beim Laden der Zuordnungen:', error);
        }
      }

      // Basis-Query mit Embeds
      let query = window.supabase
        .from('marke')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          branchen:marke_branchen(branche:branche_id(id, name)),
          ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)),
          mitarbeiter:marke_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `)
        .order('created_at', { ascending: false });

      // Nicht-Admin Filterung
      if (!isAdmin) {
        if (allowedMarkeIds.length > 0) {
          query = query.in('id', allowedMarkeIds);
          console.log('🔍 MARKELIST: Query eingeschränkt auf Marken-IDs:', allowedMarkeIds);
        } else {
          // Keine zugeordneten Marken = leeres Ergebnis
          console.log('⚠️ MARKELIST: Keine zugeordneten Marken - leeres Ergebnis');
          return [];
        }
      } else {
        console.log('✅ MARKELIST: Admin-Benutzer - alle Marken werden geladen');
      }

      // Filter anwenden (vereinfacht, analog zu anderen Listen)
      if (filters) {
        const apply = (field, val, type = 'string') => {
          if (val == null || val === '' || val === '[object Object]') return;
          if (type === 'string') {
            query = query.ilike(field, `%${val}%`);
          } else if (type === 'exact') {
            query = query.eq(field, val);
          } else if (type === 'uuid') {
            query = query.eq(field, val);
          }
        };

        apply('markenname', filters.markenname);
        apply('unternehmen_id', filters.unternehmen_id, 'uuid');
        apply('branche_id', filters.branche_id, 'uuid');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Marken mit Beziehungen:', error);
        throw error;
      }

      // Daten transformieren für Kompatibilität mit bestehender UI
      const transformedData = (data || []).map(marke => ({
        ...marke,
        // Branchen als Array extrahieren
        branchen: (marke.branchen || []).map(b => b.branche).filter(Boolean),
        // Ansprechpartner als Array extrahieren  
        ansprechpartner: (marke.ansprechpartner || []).map(a => a.ansprechpartner).filter(Boolean),
        // Mitarbeiter als Array extrahieren
        mitarbeiter: (marke.mitarbeiter || []).map(m => m.mitarbeiter).filter(Boolean)
      }));

      console.log('✅ Marken mit Beziehungen geladen:', transformedData.length);
      return transformedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Marken:', error);
      // Fallback auf DataService
      return await window.dataService.loadEntities('marke', filters);
    }
  }

  // Rendere Marken-Liste
  async render() {
    const canEdit = window.currentUser?.permissions?.marke?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('marke');
    
    // Filter-Tags rendern (vereinfacht)
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        tags += `<span class="filter-tag" data-key="${key}">${key}: ${value} <b class="tag-x" data-key="${key}">×</b></span>`;
      }
    });
    
    // Filter-UI über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marken</h1>
          <p>Verwalten Sie alle Marken und deren Eigenschaften</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-marken"></th>
              <th>Markenname</th>
              <th>Unternehmen</th>
              <th>Branche</th>
              <th>Webseite</th>
              <th>Ansprechpartner</th>
              <th>Zuständigkeit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('marke', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('marke', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('marke');
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Reset All Button - spezifisch für dieses Modul
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

    // Neue Marke anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-marke-new' || e.target.id === 'btn-marke-new-filter') {
        e.preventDefault();
        window.navigateTo('/marke/new');
      }
    });

    // Marken Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'marke') {
        e.preventDefault();
        const markeId = e.target.dataset.id;
        console.log('🎯 MARKELIST: Navigiere zu Marken Details:', markeId);
        window.navigateTo(`/marke/${markeId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedMarken.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-marken');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    });

    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedMarken.clear();
        const selectAllHeader = document.getElementById('select-all-marken');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'marke') {
        this.loadAndRender();
      }
    });

    // Filter-Tag X-Buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement.dataset.key;
        
        // Entferne Filter
        const currentFilters = filterSystem.getFilters('marke');
        delete currentFilters[key];
        filterSystem.applyFilters('marke', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-marken') {
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedMarken.add(cb.dataset.id);
          } else {
            this.selectedMarken.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Marken Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('marke-check')) {
        if (e.target.checked) {
          this.selectedMarken.add(e.target.dataset.id);
        } else {
          this.selectedMarken.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('marke');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedMarken.size;
    const selectedCountElement = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Tabelle
  async updateTable(marken) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!marken || marken.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = marken.map(marke => `
      <tr data-id="${marke.id}">
        <td><input type="checkbox" class="marke-check" data-id="${marke.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${window.validatorSystem.sanitizeHtml(marke.markenname || '')}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(marke.unternehmen?.firmenname || 'Kein Unternehmen zugeordnet')}</td>
        <td>${this.renderBranchen(marke.branchen)}</td>
        <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" class="table-link">${marke.webseite}</a>` : '-'}</td>
        <td>${this.renderAnsprechpartner(marke.ansprechpartner)}</td>
        <td>${this.renderZustaendigkeit(marke.zustaendigkeit, marke.mitarbeiter)}</td>
        <td>
          ${actionBuilder.create('marke', marke.id)}
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Rendere Branchen
  renderBranchen(branchen) {
    if (!branchen || branchen.length === 0) {
      return '-';
    }

    // Branchen als kompakte Tags
    const branchenTags = branchen
      .filter(branche => branche && branche.name)
      .map(branche => `<span class="tag tag--branche">${branche.name}</span>`)
      .join('');

    return `<div class="tags tags-compact">${branchenTags}</div>`;
  }

  // Render Ansprechpartner
  renderAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner || ansprechpartner.length === 0) {
      return '-';
    }

    // Ansprechpartner als klickbare Avatar-Bubbles
    const items = ansprechpartner
      .filter(ap => ap && ap.vorname && ap.nachname)
      .map(ap => ({
        name: `${ap.vorname} ${ap.nachname}`,
        type: 'person',
        id: ap.id,
        entityType: 'ansprechpartner'
      }));

    return avatarBubbles.renderBubbles(items);
  }

  // Render Zuständigkeit
  renderZustaendigkeit(zustaendigkeit, mitarbeiter) {
    // Neue mitarbeiter-Zuordnungen haben Vorrang
    if (mitarbeiter && mitarbeiter.length > 0) {
      const items = mitarbeiter
        .filter(m => m && m.name)
        .map(m => ({
          name: m.name,
          type: 'person',
          id: m.id,
          entityType: 'mitarbeiter'
        }));
      
      return avatarBubbles.renderBubbles(items);
    }
    
    // Fallback für alte zustaendigkeit-Struktur
    if (!zustaendigkeit || zustaendigkeit.length === 0) return '-';
    
    if (Array.isArray(zustaendigkeit)) {
      const items = zustaendigkeit.map(z => ({
        name: z.mitarbeiter?.name || 'Unbekannt',
        type: 'person',
        id: z.mitarbeiter?.id,
        entityType: 'mitarbeiter'
      }));
      return avatarBubbles.renderBubbles(items);
    }
    
    return `<span class="text-muted">${zustaendigkeit.mitarbeiter?.name || 'Unbekannt'}</span>`;
  }

  // Cleanup
  destroy() {
    console.log('🗑️ MARKELLIST: Destroy aufgerufen');
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ MARKELLIST: Destroy abgeschlossen');
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedMarken.size;
    console.log(`🔧 MarkeList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${selectedCount}`, Array.from(this.selectedMarken));
    
    if (selectedCount === 0) {
      alert('Keine Marken ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie die ausgewählte Marke wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Marken wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedMarken();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedMarken();
    }
  }

  // Ausgewählte Marken löschen
  async deleteSelectedMarken() {
    const selectedIds = Array.from(this.selectedMarken);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Marken...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('marke', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Marken erfolgreich gelöscht.`);
        
        this.selectedMarken.clear();
        this.updateSelection();
        this.updateSelectAllCheckbox();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'marke', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      // Bei Fehler: Zeilen wiederherstellen
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      await this.loadAndRender();
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Marken-Erstellungsformular mit MarkeCreate');
    // Verwende MarkeCreate statt FormSystem (wie bei Unternehmen)
    markeCreate.showCreateForm();
  }




}

// Exportiere Instanz für globale Nutzung
export const markeList = new MarkeList(); 