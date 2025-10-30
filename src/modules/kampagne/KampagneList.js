// KampagneList.js (ES6-Modul)
// Kampagnen-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

export class KampagneList {
  constructor() {
    this.selectedKampagnen = new Set();
    this._boundEventListeners = new Set();
    this.statusOptions = [];
    this.kampagneArtMap = new Map();
  }

  // Initialisiere Kampagnen-Liste
  async init() {
    window.setHeadline('Kampagnen Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagne', url: '/kampagne', clickable: false }
      ]);
    }
    
    // Verstecke Bulk-Actions für Kunden
    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }
    
    // Prüfe Berechtigungen (Page-scope zuerst)
    const canView = (window.canViewPage && window.canViewPage('kampagne')) || await window.checkUserPermission('kampagne', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kampagnen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Kampagnen-Liste
  async loadAndRender() {
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      // Filter-Optionen werden vom FilterSystem bei Bedarf geladen
      
      // Rendere die Seite (asynchron)
      await this.render();
      
      // Initialisiere Filterbar mit neuem System
      await this.initializeFilterBar();
      
      // Lade gefilterte Kampagnen für die Anzeige
      const currentFilters = filterSystem.getFilters('kampagne');
      console.log('🔍 Lade Kampagnen mit Filter:', currentFilters);
      const filteredKampagnen = await this.loadKampagnenWithRelations();
      console.log('📊 Kampagnen geladen:', filteredKampagnen?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredKampagnen);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'KampagneList.loadAndRender');
    }
  }

  // Lade Kampagnen mit Beziehungen
  async loadKampagnenWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('kampagne');
      }

      // Lade Status-Optionen und Kampagnenarten
      try {
        const [{ data: statusRows }, { data: artRows }] = await Promise.all([
          window.supabase.from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
          window.supabase.from('kampagne_art_typen').select('id, name')
        ]);
        this.statusOptions = statusRows || [];
        this.kampagneArtMap = new Map((artRows || []).map(r => [r.id, r.name]));
      } catch (e) {
        console.warn('⚠️ Konnte Status/Arten nicht laden', e);
      }

      // Sichtbarkeit: Nicht-Admins sehen nur zugewiesene Kampagnen
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      let assignedKampagnenIds = [];
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // 3. NEU: Kampagnen über zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          let unternehmenKampagnenIds = [];
          if (unternehmenIds.length > 0) {
            // Alle Marken dieser Unternehmen finden
            const { data: unternehmenMarken } = await window.supabase
              .from('marke')
              .select('id')
              .in('unternehmen_id', unternehmenIds);
            
            const unternehmenMarkenIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
            
            if (unternehmenMarkenIds.length > 0) {
              // Alle Kampagnen dieser Marken laden
              const { data: kampagnen } = await window.supabase
                .from('kampagne')
                .select('id')
                .in('marke_id', unternehmenMarkenIds);
              
              unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
            }
          }
          
          // Alle zusammenführen und Duplikate entfernen
          assignedKampagnenIds = [...new Set([
            ...directKampagnenIds,
            ...markenKampagnenIds,
            ...unternehmenKampagnenIds
          ])];
          
          console.log(`🔍 KAMPAGNELIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            unternehmenKampagnen: unternehmenKampagnenIds.length,
            gesamt: assignedKampagnenIds.length
          });
          
          // Für Mitarbeiter: Wenn keine zugewiesenen Kampagnen, dann keine Daten
          // Für Kunden: RLS-Policies filtern automatisch, also weiter machen
          if (assignedKampagnenIds.length === 0 && window.currentUser?.rolle !== 'kunde') {
            return [];
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen:', error);
          // Für Kunden: RLS-Policies filtern automatisch, also weiter machen
          // Für Mitarbeiter: Bei Fehler keine Daten anzeigen
          if (window.currentUser?.rolle !== 'kunde') {
            return [];
          }
        }
      }

      let query = window.supabase
        .from('kampagne')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          auftrag:auftrag_id(auftragsname),
          status_ref:status_id(id, name)
        `)
        .order('created_at', { ascending: false });

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde' && assignedKampagnenIds.length > 0) {
        query = query.in('id', assignedKampagnenIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(k => {
        const arr = Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : [];
        const artDisplay = arr.map(v => (this.kampagneArtMap.get(v) || v));
        return {
          ...k,
          art_der_kampagne_display: artDisplay,
          unternehmen: k.unternehmen ? { firmenname: k.unternehmen.firmenname } : null,
          marke: k.marke ? { markenname: k.marke.markenname } : null,
          auftrag: k.auftrag ? { auftragsname: k.auftrag.auftragsname } : null,
          status_name: k.status_ref?.name || k.status || null
        };
      });

      // Lade Many-to-Many Beziehungen (z.B. Ansprechpartner) über DataService
      const entityConfig = window.dataService.entities.kampagne;
      if (entityConfig.manyToMany) {
        await window.dataService.loadManyToManyRelations(formattedData, 'kampagne', entityConfig.manyToMany);
      }

      console.log('✅ Kampagnen mit Beziehungen geladen:', formattedData);
      return formattedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('kampagne');
    }
  }

  // Rendere Kampagnen-Liste
  async render() {
    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('kampagne');
    
    // Filter-Tags rendern (vereinfacht)
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        tags += `<span class="filter-tag" data-key="${key}">${key}: ${value} <b class="tag-x" data-key="${key}">×</b></span>`;
      }
    });
    
    // Filter-Dropdown über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-dropdown-container"></div>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagnen</h1>
          <p>Verwalten Sie alle Kampagnen und deren Details</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" id="select-all-kampagnen">
              </th>
              <th>Kampagnenname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Art der Kampagne</th>
              <th>Status</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Creator Anzahl</th>
              <th>Video Anzahl</th>
              <th>Ansprechpartner</th>
              <th>Mitarbeiter</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kampagnen-table-body">
            <tr>
              <td colspan="12" class="loading">Lade Kampagnen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Initialisiere Filter-Dropdown
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('kampagne', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 KampagneList: Filter angewendet:', filters);
    filterSystem.applyFilters('kampagne', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 KampagneList: Filter zurückgesetzt');
    filterSystem.resetFilters('kampagne');
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

    // Neue Kampagne anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-kampagne-new' || e.target.id === 'btn-kampagne-new-filter') {
        e.preventDefault();
        window.navigateTo('/kampagne/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.kampagne-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedKampagnen.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-kampagnen');
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
        this.deselectAll();
      }
    });

    // Kampagne Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kampagne') {
        e.preventDefault();
        const kampagneId = e.target.dataset.id;
        console.log('🎯 KAMPAGNELIST: Navigiere zu Kampagne Details:', kampagneId);
        window.navigateTo(`/kampagne/${kampagneId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'kampagne') {
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
        const currentFilters = filterSystem.getFilters('kampagne');
        delete currentFilters[key];
        filterSystem.applyFilters('kampagne', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-kampagnen') {
        const checkboxes = document.querySelectorAll('.kampagne-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedKampagnen.add(cb.dataset.id);
          } else {
            this.selectedKampagnen.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Kampagnen ausgewählt' : '❌ Alle Kampagnen abgewählt'}: ${this.selectedKampagnen.size}`);
      }
    });

    // Kampagne Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('kampagne-check')) {
        if (e.target.checked) {
          this.selectedKampagnen.add(e.target.dataset.id);
        } else {
          this.selectedKampagnen.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Bulk-Actions werden jetzt vom BulkActionSystem verwaltet
    // Registriere diese Liste beim BulkActionSystem
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('kampagne', this);
    }
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('kampagne');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedKampagnen.size;
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
  async updateTable(kampagnen) {
    const tbody = document.getElementById('kampagnen-table-body');
    if (!tbody) return;

    if (!kampagnen || kampagnen.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = kampagnen.map(kampagne => {
      // Hilfsfunktionen für Formatierung
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };

      const formatArray = (array) => array && Array.isArray(array) && array.length ? array.join(', ') : '-';

      return `
        <tr data-id="${kampagne.id}">
          <td><input type="checkbox" class="kampagne-check" data-id="${kampagne.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${window.validatorSystem.sanitizeHtml(kampagne.kampagnenname || 'Unbekannt')}
            </a>
          </td>
          <td>${this.renderUnternehmen(kampagne.unternehmen)}</td>
          <td>${this.renderMarke(kampagne.marke)}</td>
          <td>${formatArray(kampagne.art_der_kampagne_display || kampagne.art_der_kampagne)}</td>
          <td>
            <span class="status-badge status-${(kampagne.status_name || '').toLowerCase().replace(/\s+/g,'-') || 'unknown'}">
              ${kampagne.status_name || '-'}
            </span>
          </td>
          <td>${formatDate(kampagne.start)}</td>
          <td>${formatDate(kampagne.deadline)}</td>
          <td>${kampagne.creatoranzahl || 0}</td>
          <td>${kampagne.videoanzahl || 0}</td>
          <td>${this.renderAnsprechpartner(kampagne.ansprechpartner)}</td>
          <td>${this.renderMitarbeiter(kampagne.mitarbeiter)}</td>
          <td>
            ${actionBuilder.create('kampagne', kampagne.id, window.currentUser, { 
              statusOptions: this.statusOptions, 
              currentStatus: { id: kampagne.status_id, name: kampagne.status } 
            })}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Cleanup
  destroy() {
    console.log('KampagneList: Cleaning up...');
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Kampagnen-Erstellungsformular');
    window.setHeadline('Neue Kampagne anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagne', url: '/kampagne', clickable: true },
        { label: 'Neue Kampagne', url: '/kampagne/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kampagne');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kampagne anlegen</h1>
          <p>Erstellen Sie eine neue Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('kampagne', null);

    // Keine eigene Auto-Suggest UI mehr hier – wir nutzen die bestehende FormSystem Multiselects (pm_ids, scripter_ids, cutter_ids)
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      const form = document.getElementById('kampagne-form');
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        // Suche das versteckte Select mit den tatsächlichen Werten
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
        // Alternative: Suche nach Tag-Container und sammle Werte aus Tags
        if (!hiddenSelect) {
          const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

      // Kampagnenname manuell hinzufügen (da readonly Feld nicht in FormData enthalten ist)
      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput && kampagnennameInput.value) {
        submitData.kampagnenname = kampagnennameInput.value;
      }

      console.log('📝 Kampagne Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kampagne');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Erstelle Kampagne
      const result = await window.dataService.createEntity('kampagne', submitData);
      
      if (result.success) {
        // Nach Erstellung: Many-to-Many Beziehungen speichern
        try {
          const kampagneId = result.id;
          const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
          
          // Ansprechpartner-Zuordnungen
          const ansprechpartner = uniq(toArray(submitData.ansprechpartner_ids));
          if (ansprechpartner.length > 0) {
            const ansprechpartnerRows = ansprechpartner.map(apId => ({
              kampagne_id: kampagneId,
              ansprechpartner_id: apId
            }));
            await window.supabase.from('ansprechpartner_kampagne').insert(ansprechpartnerRows);
            console.log('✅ Ansprechpartner-Zuordnungen gespeichert:', ansprechpartnerRows.length);
          }
          
          // Mitarbeiter-Zuordnungen (alle Rollen + allgemeine Mitarbeiter)
          const mitarbeiter = uniq(toArray(submitData.mitarbeiter_ids));
          const pm = uniq(toArray(submitData.pm_ids));
          const sc = uniq(toArray(submitData.scripter_ids));
          const cu = uniq(toArray(submitData.cutter_ids));
          
          const mitarbeiterRows = [];
          // Allgemeine Mitarbeiter als 'projektmanager' einfügen (da 'mitarbeiter' nicht erlaubt ist)
          mitarbeiter.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          pm.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          sc.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
          cu.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
          
          if (mitarbeiterRows.length > 0 && window.supabase) {
            await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
            console.log('✅ Mitarbeiter-Zuordnungen gespeichert:', mitarbeiterRows.length);
          }
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
        }

        this.showSuccessMessage('Kampagne erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'created', id: result.id }
        }));
        
        // Zurück zur Liste
        setTimeout(() => {
          window.navigateTo('/kampagne');
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Erstellen: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Kampagne:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  

  // Zeige Validierungsfehler
  showValidationErrors(errors) {
    console.error('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        fieldElement.parentNode.appendChild(errorDiv);
      }
    });
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    const individualCheckboxes = document.querySelectorAll('.kampagne-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.kampagne-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Deselect All - alle Auswahlen aufheben
  deselectAll() {
    this.selectedKampagnen.clear();
    
    const checkboxes = document.querySelectorAll('.kampagne-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Kampagnen-Auswahlen aufgehoben');
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedKampagnen.size;
    if (selectedCount === 0) {
      alert('Keine Kampagnen ausgewählt.');
      return;
    }

    const message = selectedCount === 1
      ? 'Möchten Sie die ausgewählte Kampagne wirklich löschen?'
      : `Möchten Sie die ${selectedCount} ausgewählten Kampagnen wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Löschvorgang bestätigen',
        message: `${message}`,
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (res?.confirmed) {
        this.deleteSelectedKampagnen();
      }
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedKampagnen();
    }
  }

  // Ausgewählte Kampagnen löschen
  async deleteSelectedKampagnen() {
    const selectedIds = Array.from(this.selectedKampagnen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Kampagnen...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('kampagne', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Kampagnen erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('#kampagnen-table-body');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'bulk-deleted', count: result.deletedCount }
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

  // Render Unternehmen
  renderUnternehmen(unternehmen) {
    if (!unternehmen || !unternehmen.firmenname) {
      return '-';
    }

    const items = [{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen'
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Marke
  renderMarke(marke) {
    if (!marke || !marke.markenname) {
      return '-';
    }

    const items = [{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke'
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Mitarbeiter (Avatar-Bubbles mit Klickbarkeit)
  renderMitarbeiter(users) {
    if (!users || users.length === 0) {
      return '-';
    }
    
    console.log('🔍 KampagneList renderMitarbeiter:', users); // Debug
    
    const items = users
      .filter(u => u && (u.name || u.email))
      .map(u => ({
        name: u.name || u.email,
        type: 'person',
        id: u.id,
        entityType: 'mitarbeiter'
      }));
    
    console.log('🔍 KampagneList mitarbeiter items:', items); // Debug
    
    return avatarBubbles.renderBubbles(items);
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneList = new KampagneList(); 