// AuftragsdetailsCreateSelects.js
// Select-UI: Searchable Selects, Kampagnenart-Multiselect, Edit-Mode-Vorausfüllung
// (Prototype-Mixin von AuftragsdetailsCreateController)

import { AuftragsdetailsCreateController } from './AuftragsdetailsCreateCore.js';

Object.assign(AuftragsdetailsCreateController.prototype, {
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

          // 4b. Abrechnungshinweis (ADR 0015) vorausfüllen
          const hinweisField = document.getElementById('abrechnung_hinweis');
          if (hinweisField) {
            hinweisField.value = details.abrechnung_hinweis || '';
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
  },

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
  },

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
  },

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
    
    // Select-Optionen aktualisieren (sicher per DOM API)
    this.setSelectOptions(auftragSelect, options, {
      placeholder: 'Bitte wählen...',
      emptyLabel: 'Keine Aufträge verfügbar'
    });
    
    // WICHTIG: ZUERST disabled-Status setzen, DANN Searchable Select erstellen
    // (createSearchableSelect prüft das disabled-Attribut während der Erstellung)
    auftragSelect.disabled = auftraege.length === 0;
    
    // Neues Searchable Select erstellen
    if (window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(auftragSelect, options, {
        name: 'auftrag_id',
        placeholder: auftraege.length === 0 ? 'Keine Aufträge verfügbar' : 'Auftrag suchen...'
      });
    }
    
    // Hint aktualisieren
    const hint = document.getElementById('auftrag-hint');
    if (hint) {
      hint.textContent = auftraege.length === 0 
        ? 'Keine Aufträge ohne Details für dieses Unternehmen verfügbar.'
        : `${auftraege.length} Auftrag/Aufträge verfügbar.`;
      hint.style.color = auftraege.length === 0 ? 'var(--color-warning)' : '';
    }
  },

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
  },

  setSelectOptions(selectElement, options = [], { placeholder = 'Bitte wählen...', emptyLabel = 'Keine Optionen verfügbar' } = {}) {
    this.view.setSelectOptions(selectElement, options, { placeholder, emptyLabel });
  },

  populateUnternehmenOptions() {
    this.view.populateUnternehmenOptions(this.unternehmen);
  },

  populateKampagnenartOptions() {
    this.view.populateKampagnenartOptions(this.allKampagnenartTypen);
  },
});
