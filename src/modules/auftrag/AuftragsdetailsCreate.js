// AuftragsdetailsCreate.js (ES6-Modul)
// Auftragsdetails-Erstellungsseite - Dynamisch basierend auf Kampagnenarten

import { KAMPAGNENARTEN_MAPPING, generateBudgetOnlyFieldsHtml } from './logic/KampagnenartenMapping.js';

export class AuftragsdetailsCreate {
  constructor() {
    this.formData = {};
    this.unternehmen = []; // Gefilterte Unternehmen für Mitarbeiter
    this.auftraege = []; // Aufträge-Liste für Event-Listener
    this.currentKampagnenarten = []; // Aktuelle Kampagnenarten des ausgewählten Auftrags
    this.allKampagnenartTypen = []; // Alle verfügbaren Kampagnenart-Typen
    this.currentUnternehmenId = null; // Aktuell ausgewähltes Unternehmen
    this.currentAuftragId = null; // Aktuell ausgewählter Auftrag
    this.auftragIdsWithDetails = []; // Aufträge die bereits Details haben
    
    // Edit-Mode Variablen
    this.isEditMode = false;
    this.editDetailsId = null;
    this.existingDetails = null;
  }

  // Initialisiere Auftragsdetails-Erstellung
  async init() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Initialisiere Auftragsdetails-Erstellung');
    
    // Security: Nur Mitarbeiter haben Zugriff
    const isKunde = window.currentUser?.rolle === 'kunde';
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    // Edit-Mode prüfen:
    // 1. Via Route /auftragsdetails/:id/edit (window._auftragsdetailsEditId)
    // 2. Via Query-Parameter ?edit=detailsId (Legacy/Fallback)
    let editId = window._auftragsdetailsEditId || null;
    
    // Fallback: Query-Parameter prüfen
    if (!editId) {
      const urlParams = new URLSearchParams(window.location.search);
      editId = urlParams.get('edit');
    }
    
    // window._auftragsdetailsEditId nach Verwendung löschen
    if (window._auftragsdetailsEditId) {
      delete window._auftragsdetailsEditId;
    }
    
    if (editId) {
      console.log('📝 AUFTRAGSDETAILSCREATE: Edit-Mode erkannt für Details-ID:', editId);
      this.isEditMode = true;
      this.editDetailsId = editId;
      
      // Bestehende Details laden
      await this.loadExistingDetails(editId);
    } else {
      this.isEditMode = false;
      this.editDetailsId = null;
      this.existingDetails = null;
    }

    await this.showCreateForm();
  }

  /**
   * Lädt bestehende Auftragsdetails für den Edit-Mode
   * @param {string} detailsId - ID der Auftragsdetails
   */
  async loadExistingDetails(detailsId) {
    console.log('🔄 AUFTRAGSDETAILSCREATE: Lade bestehende Details für ID:', detailsId);
    
    try {
      const { data, error } = await window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            unternehmen_id,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `)
        .eq('id', detailsId)
        .single();

      if (error) throw error;

      this.existingDetails = data;
      console.log('✅ AUFTRAGSDETAILSCREATE: Bestehende Details geladen:', data);
      
      // IDs für Vorausfüllung setzen
      if (data.auftrag) {
        this.currentUnternehmenId = data.auftrag.unternehmen_id;
        this.currentAuftragId = data.auftrag_id;
      }
      
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSCREATE: Fehler beim Laden der Details:', error);
      window.notificationSystem?.show('Fehler beim Laden der Auftragsdetails', 'error');
    }
  }

  // Show Create Form
  async showCreateForm() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Zeige Auftragsdetails-Formular (Edit-Mode:', this.isEditMode, ')');
    
    // Headline und Breadcrumb basierend auf Mode
    if (this.isEditMode) {
      const detailsName = this.existingDetails?.auftrag?.auftragsname || 'Auftragsdetails';
      window.setHeadline('Auftragsdetails bearbeiten');
      
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
          { label: detailsName, url: `/auftragsdetails/${this.editDetailsId}`, clickable: true },
          { label: 'Bearbeiten', url: `/auftragsdetails/${this.editDetailsId}/edit`, clickable: false }
        ]);
      }
    } else {
      window.setHeadline('Neue Auftragsdetails anlegen');
      
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
          { label: 'Neue Auftragsdetails', url: '/auftragsdetails/new', clickable: false }
        ]);
      }
    }
    
    // Schritt 1: Lade alle Aufträge, die bereits Details haben
    const { data: existingDetails, error: detailsError } = await window.supabase
      .from('auftrag_details')
      .select('auftrag_id');

    if (detailsError) {
      console.error('Fehler beim Laden der existierenden Details:', detailsError);
      window.showNotification('Fehler beim Laden der Daten', 'error');
      return;
    }

    // IDs der Aufträge, die bereits Details haben
    this.auftragIdsWithDetails = existingDetails.map(d => d.auftrag_id);
    console.log('📋 Aufträge mit Details:', this.auftragIdsWithDetails);

    // Schritt 2: Lade Unternehmen (gefiltert nach Mitarbeiter-Zuordnung)
    this.unternehmen = await this.loadUnternehmen();
    console.log('🏢 Verfügbare Unternehmen:', this.unternehmen.length);
    
    // Aufträge werden erst nach Unternehmen-Auswahl geladen (Kaskade)
    this.auftraege = [];

    // Lade alle verfügbaren Kampagnenart-Typen für das Multiselect
    this.allKampagnenartTypen = await this.loadAllKampagnenartTypen();

    // Formular HTML - Basis-Struktur mit dynamischem Container
    const formHtml = `
      <div class="form-page">
        <form id="auftragsdetails-form" data-entity="auftragsdetails">
          
          <!-- Unternehmen & Auftrag Auswahl (Kaskade) -->
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="unternehmen_id">Unternehmen auswählen <span class="required">*</span></label>
              <select id="unternehmen_id" name="unternehmen_id" required data-searchable="true" data-placeholder="Unternehmen suchen...">
                ${this.unternehmen.length === 0 
                  ? '<option value="">Keine Unternehmen zugeordnet</option>'
                  : '<option value="">Bitte wählen...</option>'
                }
                ${this.unternehmen.map(u => `
                  <option value="${u.id}">${u.firmenname}</option>
                `).join('')}
              </select>
              ${this.unternehmen.length === 0 
                ? '<small class="form-hint" style="color: var(--color-error);">Sie haben keine Unternehmen zugeordnet.</small>'
                : '<small class="form-hint">Wählen Sie zuerst ein Unternehmen, um die verfügbaren Aufträge zu sehen.</small>'
              }
            </div>

            <div class="form-field form-field--half">
              <label for="auftrag_id">Auftrag auswählen <span class="required">*</span></label>
              <select id="auftrag_id" name="auftrag_id" required disabled data-searchable="true" data-placeholder="Erst Unternehmen wählen...">
                <option value="">Erst Unternehmen wählen...</option>
              </select>
              <small class="form-hint" id="auftrag-hint">Aufträge werden nach Unternehmen-Auswahl geladen.</small>
            </div>
          </div>

          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="kampagnenanzahl">Anzahl Kampagnen</label>
              <input type="number" id="kampagnenanzahl" name="kampagnenanzahl" min="0" placeholder="Wird aus Auftrag übernommen..." readonly>
              <small class="form-hint">Wird automatisch aus dem Auftrag übernommen</small>
            </div>
            <div class="form-field form-field--half"></div>
          </div>

          <!-- Kampagnenart-Auswahl Section -->
          <div id="kampagnenart-selection-section" class="details-section" style="display: none;">
            <h3>Art der Kampagne</h3>
            <p class="form-hint">Wählen Sie die Kampagnenarten für diesen Auftrag aus und klicken Sie auf "Aktivieren".</p>
            <div class="form-field">
              <select id="kampagnenart-select" 
                      name="art_der_kampagne" 
                      multiple 
                      data-searchable="true" 
                      data-tag-based="true" 
                      data-placeholder="Kampagnenart suchen und auswählen...">
                ${this.allKampagnenartTypen.map(typ => `<option value="${typ.id}">${typ.name}</option>`).join('')}
              </select>
            </div>
            <div class="kampagnenart-activate-actions">
              <button type="button" id="activate-kampagnenarten-btn" class="primary-btn">
                Aktivieren
              </button>
            </div>
          </div>

          <!-- Dynamischer Container für Budget-Felder pro Kampagnenart -->
          <div id="kampagnenart-sections-container">
            <div class="alert alert-info">
              <p>Bitte wählen Sie einen Auftrag aus, um die Kampagnenart-Auswahl anzuzeigen.</p>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="form-actions">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/auftragsdetails')">
              <span class="mdc-btn__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn ${this.isEditMode ? 'mdc-btn--save' : 'mdc-btn--create'}" id="submit-btn" data-variant="@create-prd.mdc" data-entity-label="Auftragsdetails" data-mode="${this.isEditMode ? 'edit' : 'create'}" disabled>
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
                </svg>
              </span>
              <span class="mdc-btn__spinner" aria-hidden="true">
                <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                  <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
                </svg>
              </span>
              <span class="mdc-btn__label">${this.isEditMode ? 'Speichern' : 'Erstellen'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    window.content.innerHTML = formHtml;
    
    // Events binden
    this.bindFormEvents();
    
    // Autosuggestion für Unternehmen und Auftrag initialisieren
    this.initSearchableSelects();
    
    // Im Edit-Mode: Selects vorausfüllen
    if (this.isEditMode && this.existingDetails) {
      await this.prefillFormForEditMode();
    }
  }

  /**
   * Füllt das Formular im Edit-Mode mit bestehenden Daten vor
   */
  async prefillFormForEditMode() {
    console.log('📝 AUFTRAGSDETAILSCREATE: Fülle Formular für Edit-Mode vor');
    
    const details = this.existingDetails;
    const auftrag = details?.auftrag;
    
    if (!auftrag) {
      console.warn('⚠️ AUFTRAGSDETAILSCREATE: Keine Auftragsdaten zum Vorausfüllen');
      return;
    }
    
    try {
      // 1. Unternehmen-Select vorausfüllen
      const unternehmenId = auftrag.unternehmen_id;
      if (unternehmenId) {
        console.log('🏢 AUFTRAGSDETAILSCREATE: Setze Unternehmen:', unternehmenId);
        
        const unternehmenSelect = document.getElementById('unternehmen_id');
        const selectedUnternehmen = this.unternehmen.find(u => u.id === unternehmenId);
        const unternehmenLabel = selectedUnternehmen?.firmenname || 'Unbekannt';
        
        // Select und Searchable UI aktualisieren
        this.fillSearchableSelect(unternehmenSelect, unternehmenId, unternehmenLabel);
        
        // 2. Aufträge für dieses Unternehmen laden
        this.currentUnternehmenId = unternehmenId;
        this.auftraege = await this.loadAuftraegeForUnternehmen(unternehmenId);
        
        // Auftrag-Dropdown aktualisieren
        this.updateAuftragSelect(this.auftraege);
        
        // 3. Auftrag-Select vorausfüllen
        const auftragId = details.auftrag_id;
        if (auftragId) {
          console.log('📋 AUFTRAGSDETAILSCREATE: Setze Auftrag:', auftragId);
          
          const auftragSelect = document.getElementById('auftrag_id');
          const selectedAuftrag = this.auftraege.find(a => a.id === auftragId);
          const auftragLabel = selectedAuftrag 
            ? `${selectedAuftrag.auftragsname}${selectedAuftrag.marke?.markenname ? ` (${selectedAuftrag.marke.markenname})` : ''}`
            : auftrag.auftragsname || 'Unbekannt';
          
          // Select und Searchable UI aktualisieren
          this.fillSearchableSelect(auftragSelect, auftragId, auftragLabel);
          if (auftragSelect) auftragSelect.disabled = false;
          
          this.currentAuftragId = auftragId;
          
          // 4. Kampagnenanzahl setzen
          const kampagnenField = document.getElementById('kampagnenanzahl');
          if (kampagnenField && auftrag.kampagnenanzahl) {
            kampagnenField.value = auftrag.kampagnenanzahl;
            kampagnenField.style.backgroundColor = '#f5f5f5';
          }
          
          // 5. Kampagnenart-Selection Section anzeigen
          const selectionSection = document.getElementById('kampagnenart-selection-section');
          if (selectionSection) {
            selectionSection.style.display = 'block';
          }
          
          // 6. Kampagnenarten laden und Multiselect vorausfüllen
          const kampagnenarten = await this.loadKampagnenartenForAuftrag(auftragId);
          this.currentKampagnenarten = kampagnenarten;
          await this.initKampagnenartSelect(kampagnenarten);
          
          // 7. Budget-Sections mit bestehenden Werten rendern
          if (kampagnenarten.length > 0) {
            this.renderDynamicSections(kampagnenarten, details);
            
            // Submit-Button aktivieren
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
              submitBtn.disabled = false;
            }
          }
        }
      }
      
      // Hint aktualisieren
      const hint = document.getElementById('auftrag-hint');
      if (hint) {
        hint.textContent = `${this.auftraege.length} Auftrag/Aufträge verfügbar.`;
        hint.style.color = '';
      }
      
      console.log('✅ AUFTRAGSDETAILSCREATE: Formular vorausgefüllt');
      
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSCREATE: Fehler beim Vorausfüllen:', error);
    }
  }

  /**
   * Hilfsmethode: Searchable Select mit Wert füllen
   * @param {HTMLSelectElement} selectEl - Das Select-Element
   * @param {string} value - Der Wert
   * @param {string} label - Das anzuzeigende Label
   */
  fillSearchableSelect(selectEl, value, label) {
    if (!selectEl) return;
    
    console.log(`🔧 AUFTRAGSDETAILSCREATE: fillSearchableSelect für ${selectEl.id}:`, value, label);
    
    // 1. Option zum Select hinzufügen falls nicht vorhanden
    let optionElement = selectEl.querySelector(`option[value="${value}"]`);
    if (!optionElement) {
      optionElement = document.createElement('option');
      optionElement.value = value;
      optionElement.textContent = label;
      selectEl.appendChild(optionElement);
    }
    
    // 2. Wert im Select setzen
    optionElement.selected = true;
    selectEl.value = value;
    
    // 3. Hidden Input setzen (für FormSystem)
    const hiddenInput = document.getElementById(`${selectEl.id}_value`);
    if (hiddenInput) {
      hiddenInput.value = value;
      console.log(`🔧 Hidden Input ${selectEl.id}_value gesetzt:`, value);
    }
    
    // 4. Searchable Select Container finden und Input aktualisieren
    // Methode 1: parentNode
    let container = selectEl.parentNode?.querySelector('.searchable-select-container');
    // Methode 2: nextElementSibling
    if (!container && selectEl.nextElementSibling?.classList?.contains('searchable-select-container')) {
      container = selectEl.nextElementSibling;
    }
    
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = label;
        console.log(`🔧 Searchable Input für ${selectEl.id} gesetzt:`, label);
      } else {
        console.warn(`⚠️ Kein .searchable-select-input gefunden für ${selectEl.id}`);
      }
    } else {
      console.warn(`⚠️ Kein .searchable-select-container gefunden für ${selectEl.id}`);
    }
  }

  /**
   * Lädt alle verfügbaren Kampagnenart-Typen aus der Datenbank
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async loadAllKampagnenartTypen() {
    if (!window.supabase) return [];
    
    try {
      const { data, error } = await window.supabase
        .from('kampagne_art_typen')
        .select('id, name')
        .order('sort_order, name');
      
      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnenart-Typen:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenart-Typen:', error);
      return [];
    }
  }

  /**
   * Lädt Unternehmen gefiltert nach Mitarbeiter-Zuordnung
   * @returns {Promise<Array<{id: string, firmenname: string}>>}
   */
  async loadUnternehmen() {
    if (!window.supabase) return [];
    
    try {
      // Hole erlaubte Unternehmen-IDs vom PermissionSystem
      const allowedIds = await window.getAllowedUnternehmenIds?.();
      console.log('🔐 Erlaubte Unternehmen-IDs:', allowedIds);
      
      let query = window.supabase
        .from('unternehmen')
        .select('id, firmenname')
        .order('firmenname', { ascending: true });
      
      // Für Nicht-Admins: Filter nach erlaubten IDs
      if (allowedIds !== null) {
        if (allowedIds.length === 0) {
          console.log('🔐 Keine Unternehmen zugeordnet');
          return [];
        }
        query = query.in('id', allowedIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Fehler beim Laden der Unternehmen:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      return [];
    }
  }

  /**
   * Lädt Aufträge für ein bestimmtes Unternehmen (ohne bereits vorhandene Details)
   * Im Edit-Mode wird der aktuelle Auftrag NICHT herausgefiltert
   * @param {string} unternehmenId - ID des Unternehmens
   * @returns {Promise<Array>}
   */
  async loadAuftraegeForUnternehmen(unternehmenId) {
    if (!window.supabase || !unternehmenId) return [];
    
    try {
      const { data, error } = await window.supabase
        .from('auftrag')
        .select('id, auftragsname, kampagnenanzahl, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
        .eq('unternehmen_id', unternehmenId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge:', error);
        return [];
      }
      
      // Filtere Aufträge die bereits Details haben
      // Im Edit-Mode: Den aktuellen Auftrag NICHT herausfiltern!
      const filtered = (data || []).filter(a => {
        // Im Edit-Mode: aktuellen Auftrag behalten
        if (this.isEditMode && a.id === this.currentAuftragId) {
          return true;
        }
        // Sonst: Aufträge mit Details herausfiltern
        return !this.auftragIdsWithDetails.includes(a.id);
      });
      
      console.log(`📋 Aufträge für Unternehmen ${unternehmenId}: ${filtered.length} verfügbar (Edit-Mode: ${this.isEditMode})`);
      
      return filtered;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      return [];
    }
  }

  /**
   * Initialisiert die Searchable Selects für Unternehmen und Auftrag
   */
  initSearchableSelects() {
    // Unternehmen-Select
    const unternehmenSelect = document.getElementById('unternehmen_id');
    if (unternehmenSelect && window.formSystem?.createSearchableSelect) {
      const options = this.unternehmen.map(u => ({
        value: u.id,
        label: u.firmenname
      }));
      window.formSystem.createSearchableSelect(unternehmenSelect, options, {
        name: 'unternehmen_id',
        placeholder: 'Unternehmen suchen...'
      });
      console.log('✅ Searchable Select für Unternehmen initialisiert');
    }
    
    // Auftrag-Select (initial leer, wird nach Unternehmen-Auswahl befüllt)
    const auftragSelect = document.getElementById('auftrag_id');
    if (auftragSelect && window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(auftragSelect, [], {
        name: 'auftrag_id',
        placeholder: 'Erst Unternehmen wählen...'
      });
      console.log('✅ Searchable Select für Auftrag initialisiert (leer)');
    }
  }

  /**
   * Aktualisiert das Auftrag-Dropdown mit neuen Optionen
   * @param {Array} auftraege - Liste der Aufträge
   */
  updateAuftragSelect(auftraege) {
    const auftragSelect = document.getElementById('auftrag_id');
    if (!auftragSelect) return;
    
    // Optionen für das Select erstellen
    const options = auftraege.map(a => ({
      value: a.id,
      label: `${a.auftragsname}${a.marke?.markenname ? ` (${a.marke.markenname})` : ''}`
    }));
    
    // Bestehenden Container finden und aktualisieren
    const container = auftragSelect.nextElementSibling;
    if (container && container.classList.contains('searchable-select-container')) {
      // Container entfernen und neu erstellen
      container.remove();
    }
    
    // Select-Optionen aktualisieren
    auftragSelect.innerHTML = auftraege.length === 0
      ? '<option value="">Keine Aufträge verfügbar</option>'
      : '<option value="">Bitte wählen...</option>' + 
        options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    
    // Neues Searchable Select erstellen
    if (window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(auftragSelect, options, {
        name: 'auftrag_id',
        placeholder: auftraege.length === 0 ? 'Keine Aufträge verfügbar' : 'Auftrag suchen...'
      });
    }
    
    // Select aktivieren/deaktivieren
    auftragSelect.disabled = auftraege.length === 0;
    
    // Hint aktualisieren
    const hint = document.getElementById('auftrag-hint');
    if (hint) {
      hint.textContent = auftraege.length === 0 
        ? 'Keine Aufträge ohne Details für dieses Unternehmen verfügbar.'
        : `${auftraege.length} Auftrag/Aufträge verfügbar.`;
      hint.style.color = auftraege.length === 0 ? 'var(--color-warning)' : '';
    }
  }

  /**
   * Initialisiert das TagBased-Multiselect für die Kampagnenart-Auswahl
   * @param {Array<string>} selectedArten - Bereits ausgewählte Kampagnenarten (Namen)
   */
  async initKampagnenartSelect(selectedArten = []) {
    const selectElement = document.getElementById('kampagnenart-select');
    if (!selectElement) return;

    // Konvertiere zu Options-Format für createTagBasedSelect
    const options = this.allKampagnenartTypen.map(typ => ({
      value: typ.id,
      label: typ.name,
      selected: selectedArten.includes(typ.name)
    }));

    // Nutze das bestehende FormSystem für TagBased-Multiselect falls verfügbar
    if (window.formSystem?.optionsManager?.createTagBasedSelect) {
      const field = {
        name: 'art_der_kampagne',
        tagBased: true,
        placeholder: 'Kampagnenart suchen und auswählen...'
      };
      
      window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
      console.log('✅ TagBased-Multiselect für Kampagnenarten initialisiert');
    } else {
      console.warn('⚠️ FormSystem nicht verfügbar, nutze Fallback-Multiselect');
    }
  }

  /**
   * Aktiviert die ausgewählten Kampagnenarten:
   * - Speichert in auftrag_kampagne_art Junction-Tabelle
   * - Rendert die dynamischen Budget-Sections
   */
  async activateKampagnenarten() {
    if (!this.currentAuftragId) {
      window.notificationSystem?.show('Bitte wählen Sie zuerst einen Auftrag aus.', 'warning');
      return;
    }

    console.log('🎯 Aktiviere Kampagnenarten für Auftrag:', this.currentAuftragId);
    
    try {
      // Sammle die ausgewählten Werte
      const selectedIds = this.getSelectedKampagnenartIds();
      
      if (selectedIds.length === 0) {
        window.notificationSystem?.show('Bitte wählen Sie mindestens eine Kampagnenart aus.', 'warning');
        return;
      }

      // Speichere in der Junction-Tabelle
      await this.saveKampagnenartenToJunction(this.currentAuftragId, selectedIds);

      // Lade die Kampagnenarten-Namen neu
      const kampagnenarten = await this.loadKampagnenartenForAuftrag(this.currentAuftragId);
      this.currentKampagnenarten = kampagnenarten;

      // Lade bestehende auftrag_details Werte (falls vorhanden)
      let existingValues = {};
      try {
        const { data } = await window.supabase
          .from('auftrag_details')
          .select('*')
          .eq('auftrag_id', this.currentAuftragId)
          .maybeSingle();
        if (data) {
          existingValues = data;
        }
      } catch (e) {
        console.warn('⚠️ Keine bestehenden auftrag_details gefunden');
      }

      // Rendere die dynamischen Sections
      this.renderDynamicSections(kampagnenarten, existingValues);

      // Aktiviere den Erstellen-Button
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
      }

      window.notificationSystem?.show(`${kampagnenarten.length} Kampagnenart(en) aktiviert.`, 'success');
      console.log('✅ Kampagnenarten aktiviert:', kampagnenarten);

    } catch (error) {
      console.error('❌ Fehler beim Aktivieren der Kampagnenarten:', error);
      window.notificationSystem?.show('Fehler beim Aktivieren der Kampagnenarten.', 'error');
    }
  }

  /**
   * Holt die ausgewählten Kampagnenart-IDs aus dem Multiselect
   * @returns {string[]} - Array der ausgewählten IDs
   */
  getSelectedKampagnenartIds() {
    const selectedIds = [];
    
    // Versuche zuerst das versteckte Select zu finden (TagBased-Multiselect)
    const hiddenSelect = document.getElementById('kampagnenart-select_hidden');
    if (hiddenSelect) {
      Array.from(hiddenSelect.selectedOptions).forEach(option => {
        if (option.value) selectedIds.push(option.value);
      });
    }
    
    // Fallback: Normales Select
    if (selectedIds.length === 0) {
      const selectElement = document.getElementById('kampagnenart-select');
      if (selectElement) {
        Array.from(selectElement.selectedOptions).forEach(option => {
          if (option.value) selectedIds.push(option.value);
        });
      }
    }
    
    // Fallback: Aus Tags lesen
    if (selectedIds.length === 0) {
      const tags = document.querySelectorAll('#kampagnenart-selection-section .tag');
      tags.forEach(tag => {
        const value = tag.dataset?.value;
        if (value) selectedIds.push(value);
      });
    }
    
    console.log('📋 Ausgewählte Kampagnenart-IDs:', selectedIds);
    return selectedIds;
  }

  /**
   * Speichert die Kampagnenarten in die auftrag_kampagne_art Junction-Tabelle
   * @param {string} auftragId - ID des Auftrags
   * @param {string[]} kampagneArtIds - Array der Kampagnenart-IDs
   */
  async saveKampagnenartenToJunction(auftragId, kampagneArtIds) {
    if (!window.supabase) return;

    console.log('💾 Speichere Kampagnenarten in Junction:', { auftragId, kampagneArtIds });

    // Lösche bestehende Einträge
    const { error: deleteError } = await window.supabase
      .from('auftrag_kampagne_art')
      .delete()
      .eq('auftrag_id', auftragId);

    if (deleteError) {
      console.error('❌ Fehler beim Löschen alter Kampagnenarten:', deleteError);
      throw deleteError;
    }

    // Füge neue Einträge hinzu
    if (kampagneArtIds.length > 0) {
      const insertData = kampagneArtIds.map(kampagneArtId => ({
        auftrag_id: auftragId,
        kampagne_art_id: kampagneArtId
      }));

      const { error: insertError } = await window.supabase
        .from('auftrag_kampagne_art')
        .insert(insertData);

      if (insertError) {
        console.error('❌ Fehler beim Speichern der Kampagnenarten:', insertError);
        throw insertError;
      }
    }

    console.log('✅ Kampagnenarten in Junction gespeichert');
  }

  /**
   * Lädt die Kampagnenarten für einen Auftrag
   * PRIMÄR: Aus der auftrag_kampagne_art Junction-Tabelle (direkt am Auftrag hinterlegt)
   * FALLBACK: Aus den zugehörigen Kampagnen
   * @param {string} auftragId - ID des Auftrags
   * @returns {Promise<string[]>} - Array der eindeutigen Kampagnenarten-Namen
   */
  async loadKampagnenartenForAuftrag(auftragId) {
    if (!window.supabase || !auftragId) return [];
    
    try {
      const artenSet = new Set();
      
      // PRIMÄR: Lade Kampagnenarten direkt vom Auftrag (über auftrag_kampagne_art Junction)
      const { data: auftragArten, error: auftragError } = await window.supabase
        .from('auftrag_kampagne_art')
        .select(`
          kampagne_art_typen:kampagne_art_id(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (auftragError) {
        console.warn('⚠️ Fehler beim Laden der Auftrag-Kampagnenarten:', auftragError);
      } else {
        (auftragArten || []).forEach(item => {
          if (item.kampagne_art_typen?.name) {
            artenSet.add(item.kampagne_art_typen.name);
          }
        });
      }
      
      // Falls vom Auftrag Kampagnenarten gefunden wurden, diese verwenden
      if (artenSet.size > 0) {
        console.log('📋 Kampagnenarten aus Auftrag geladen:', Array.from(artenSet));
        return Array.from(artenSet);
      }
      
      // FALLBACK: Lade aus den Kampagnen (für Abwärtskompatibilität)
      console.log('ℹ️ Keine Kampagnenarten im Auftrag, prüfe Kampagnen...');
      const { data: kampagnen, error: kampError } = await window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagne_art_typen:art_der_kampagne(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (kampError) {
        console.error('❌ Fehler beim Laden der Kampagnen:', kampError);
        return [];
      }
      
      (kampagnen || []).forEach(kampagne => {
        const arten = kampagne.kampagne_art_typen;
        if (Array.isArray(arten)) {
          arten.forEach(art => {
            if (art?.name) artenSet.add(art.name);
          });
        } else if (arten?.name) {
          artenSet.add(arten.name);
        }
      });
      
      console.log('📋 Kampagnenarten aus Kampagnen geladen:', Array.from(artenSet));
      return Array.from(artenSet);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenarten:', error);
      return [];
    }
  }

  /**
   * Rendert die dynamischen Sections basierend auf Kampagnenarten
   * NUR Budget-Felder - Anzahl wird über Kampagnen gepflegt
   * @param {string[]} kampagnenarten - Array von Kampagnenarten-Namen
   * @param {object} existingValues - Bestehende Werte (optional)
   */
  renderDynamicSections(kampagnenarten, existingValues = {}) {
    const container = document.getElementById('kampagnenart-sections-container');
    if (!container) return;
    
    if (kampagnenarten.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <p>Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.</p>
        </div>
      `;
      return;
    }
    
    // Generiere Sections für jede Kampagnenart - NUR Budget
    let sectionsHtml = '';
    kampagnenarten.forEach(artName => {
      const config = KAMPAGNENARTEN_MAPPING[artName];
      if (config) {
        sectionsHtml += generateBudgetOnlyFieldsHtml(artName, existingValues);
      } else {
        console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
      }
    });
    
    container.innerHTML = sectionsHtml;
  }

  // Events binden
  bindFormEvents() {
    const form = document.getElementById('auftragsdetails-form');
    if (!form) return;

    // KASKADE: Unternehmen-Auswahl Listener
    this.bindUnternehmenChangeListener();

    // KASKADE: Auftrag-Auswahl Listener (Kampagnenart-Selection Section anzeigen)
    this.bindAuftragChangeListener();

    // Aktivieren-Button Event
    const activateBtn = document.getElementById('activate-kampagnenarten-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        activateBtn.disabled = true;
        activateBtn.textContent = 'Aktiviere...';
        try {
          await this.activateKampagnenarten();
        } finally {
          activateBtn.disabled = false;
          activateBtn.textContent = 'Aktivieren';
        }
      });
    }

    // Submit Handler
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
  }

  /**
   * Event-Listener für Unternehmen-Auswahl (Kaskade Schritt 1)
   */
  bindUnternehmenChangeListener() {
    const unternehmenSelect = document.getElementById('unternehmen_id');
    if (!unternehmenSelect) return;

    // Event-Handler der auch bei Searchable Select funktioniert
    const handleUnternehmenChange = async (unternehmenId) => {
      console.log('🏢 Unternehmen geändert:', unternehmenId);
      
      const auftragSelect = document.getElementById('auftrag_id');
      const selectionSection = document.getElementById('kampagnenart-selection-section');
      const container = document.getElementById('kampagnenart-sections-container');
      const submitBtn = document.getElementById('submit-btn');
      const kampagnenField = document.getElementById('kampagnenanzahl');
      
      if (!unternehmenId) {
        // Reset bei keiner Auswahl
        this.currentUnternehmenId = null;
        this.currentAuftragId = null;
        this.auftraege = [];
        
        this.updateAuftragSelect([]);
        if (auftragSelect) auftragSelect.disabled = true;
        if (selectionSection) selectionSection.style.display = 'none';
        if (container) {
          container.innerHTML = `
            <div class="alert alert-info">
              <p>Bitte wählen Sie ein Unternehmen und dann einen Auftrag aus.</p>
            </div>
          `;
        }
        if (submitBtn) submitBtn.disabled = true;
        if (kampagnenField) {
          kampagnenField.value = '';
          kampagnenField.style.backgroundColor = '';
        }
        return;
      }
      
      this.currentUnternehmenId = unternehmenId;
      this.currentAuftragId = null;
      
      // Lade Aufträge für dieses Unternehmen
      this.auftraege = await this.loadAuftraegeForUnternehmen(unternehmenId);
      
      // Update Auftrag-Dropdown
      this.updateAuftragSelect(this.auftraege);
      
      // Reset restliche Felder
      if (selectionSection) selectionSection.style.display = 'none';
      if (container) {
        container.innerHTML = `
          <div class="alert alert-info">
            <p>Bitte wählen Sie einen Auftrag aus, um die Kampagnenart-Auswahl anzuzeigen.</p>
          </div>
        `;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (kampagnenField) {
        kampagnenField.value = '';
        kampagnenField.style.backgroundColor = '';
      }
    };
    
    // Event auf Original-Select (für Searchable Select)
    unternehmenSelect.addEventListener('change', (e) => {
      handleUnternehmenChange(e.target.value);
    });
    
    // Auch auf Hidden Input hören (falls FormSystem diesen verwendet)
    const hiddenInput = document.getElementById('unternehmen_id_value');
    if (hiddenInput) {
      // MutationObserver für Hidden Input Value-Änderungen
      const observer = new MutationObserver(() => {
        handleUnternehmenChange(hiddenInput.value);
      });
      observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
      
      // Zusätzlich: Input-Event
      hiddenInput.addEventListener('input', (e) => {
        handleUnternehmenChange(e.target.value);
      });
    }
  }

  /**
   * Event-Listener für Auftrag-Auswahl (Kaskade Schritt 2)
   */
  bindAuftragChangeListener() {
    const auftragSelect = document.getElementById('auftrag_id');
    if (!auftragSelect) return;

    const handleAuftragChange = async (auftragId) => {
      console.log('📋 Auftrag geändert:', auftragId);
      
      const kampagnenField = document.getElementById('kampagnenanzahl');
      const selectionSection = document.getElementById('kampagnenart-selection-section');
      const container = document.getElementById('kampagnenart-sections-container');
      const submitBtn = document.getElementById('submit-btn');
      
      if (!auftragId) {
        // Kein Auftrag ausgewählt - Reset
        this.currentAuftragId = null;
        if (kampagnenField) {
          kampagnenField.value = '';
          kampagnenField.style.backgroundColor = '';
        }
        if (selectionSection) {
          selectionSection.style.display = 'none';
        }
        if (container) {
          container.innerHTML = `
            <div class="alert alert-info">
              <p>Bitte wählen Sie einen Auftrag aus, um die Kampagnenart-Auswahl anzuzeigen.</p>
            </div>
          `;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        return;
      }
      
      this.currentAuftragId = auftragId;
      
      // Kampagnenanzahl vom Auftrag übernehmen
      const selectedAuftrag = this.auftraege.find(a => a.id === auftragId);
      if (selectedAuftrag?.kampagnenanzahl && kampagnenField) {
        kampagnenField.value = selectedAuftrag.kampagnenanzahl;
        kampagnenField.style.backgroundColor = '#f5f5f5';
        console.log(`✅ Kampagnenanzahl ${selectedAuftrag.kampagnenanzahl} vom Auftrag übernommen`);
      } else if (kampagnenField) {
        kampagnenField.value = '';
        kampagnenField.style.backgroundColor = '';
      }
      
      // Lade bereits vorhandene Kampagnenarten für diesen Auftrag
      console.log('🔄 Lade Kampagnenarten für Auftrag:', auftragId);
      const kampagnenarten = await this.loadKampagnenartenForAuftrag(auftragId);
      this.currentKampagnenarten = kampagnenarten;
      
      // Zeige Kampagnenart-Selection Section
      if (selectionSection) {
        selectionSection.style.display = 'block';
      }
      
      // Initialisiere das TagBased-Multiselect
      await this.initKampagnenartSelect(kampagnenarten);
      
      // Wenn bereits Kampagnenarten vorhanden sind, zeige die Budget-Sections
      if (kampagnenarten.length > 0) {
        // Lade bestehende auftrag_details Werte (falls vorhanden)
        let existingValues = {};
        try {
          const { data } = await window.supabase
            .from('auftrag_details')
            .select('*')
            .eq('auftrag_id', auftragId)
            .maybeSingle();
          if (data) {
            existingValues = data;
          }
        } catch (e) {
          console.warn('⚠️ Keine bestehenden auftrag_details gefunden');
        }
        
        this.renderDynamicSections(kampagnenarten, existingValues);
        
        // Aktiviere den Erstellen-Button
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      } else {
        // Zeige Hinweis, dass Kampagnenarten gewählt werden müssen
        if (container) {
          container.innerHTML = `
            <div class="alert alert-info">
              <p>Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.</p>
            </div>
          `;
        }
      }
    };
    
    // Event auf Original-Select
    auftragSelect.addEventListener('change', (e) => {
      handleAuftragChange(e.target.value);
    });
    
    // Auch auf Hidden Input hören
    const hiddenInput = document.getElementById('auftrag_id_value');
    if (hiddenInput) {
      const observer = new MutationObserver(() => {
        handleAuftragChange(hiddenInput.value);
      });
      observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
      
      hiddenInput.addEventListener('input', (e) => {
        handleAuftragChange(e.target.value);
      });
    }
  }

  // Handle Form Submit
  async handleFormSubmit(e) {
    e.preventDefault();

    try {
      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      const form = document.getElementById('auftragsdetails-form');
      const formData = new FormData(form);
      const data = {};

      // Sammle alle Felder (außer art_der_kampagne und unternehmen_id)
      for (let [key, value] of formData.entries()) {
        // Skip art_der_kampagne - wird bereits über auftrag_kampagne_art gespeichert
        if (key === 'art_der_kampagne' || key === 'art_der_kampagne[]') {
          continue;
        }
        
        // Skip unternehmen_id - wird nur für die Filterung verwendet
        if (key === 'unternehmen_id') {
          continue;
        }
        
        // Leere Werte als null speichern
        if (value === '' || value === null) {
          data[key] = null;
        } else if (key.endsWith('_anzahl') || key === 'gesamt_videos' || key === 'gesamt_creator' || key === 'kampagnenanzahl') {
          // Zahlen konvertieren
          data[key] = value ? parseInt(value) : null;
        } else {
          data[key] = value;
        }
      }

      console.log('📤 Auftragsdetails-Daten:', data);

      // Validierung
      if (!data.auftrag_id) {
        window.showNotification('Bitte wählen Sie einen Auftrag aus', 'error');
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
        return;
      }

      // Prüfe ob bereits Details existieren
      const { data: existing, error: checkError } = await window.supabase
        .from('auftrag_details')
        .select('id')
        .eq('auftrag_id', data.auftrag_id)
        .maybeSingle();

      let result;
      if (existing?.id) {
        // Update
        const { data: updated, error } = await window.supabase
          .from('auftrag_details')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
        console.log('✅ Auftragsdetails erfolgreich aktualisiert:', result);
      } else {
        // Insert
        const { data: created, error } = await window.supabase
          .from('auftrag_details')
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        result = created;
        console.log('✅ Auftragsdetails erfolgreich erstellt:', result);
      }
      
      // Success-State für Button
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
      }
      
      // Erfolgs-Benachrichtigung anzeigen
      window.showNotification?.('Auftragsdetails erfolgreich gespeichert', 'success');
      
      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'auftrag_details', id: result.id, action: existing ? 'updated' : 'created' } 
      }));
      
      // Kurz warten damit Success-State sichtbar ist, dann navigieren
      setTimeout(() => {
        window.navigateTo('/auftragsdetails');
      }, 400);

    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsCreate.handleFormSubmit');
      window.showNotification?.(`Fehler beim Speichern: ${error.message}`, 'error') || alert(`❌ Fehler beim Speichern der Auftragsdetails: ${error.message}`);

      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Destroy');
  }
}

// Exportiere Instanz für globale Nutzung
export const auftragsdetailsCreate = new AuftragsdetailsCreate();
