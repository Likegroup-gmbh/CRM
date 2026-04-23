import { FormConfig } from './form/FormConfig.js';
import { FormRenderer } from './form/FormRenderer.js';
import { FormValidator } from './form/FormValidator.js';
import { AutoGeneration } from './form/logic/AutoGeneration.js';
import { AutoCalculation } from './form/logic/AutoCalculation.js';
import { DependentFields } from './form/logic/DependentFields.js';
import { RelationTables } from './form/logic/RelationTables.js';
import { FormEvents } from './form/logic/FormEvents.js';
import { DynamicDataLoader } from './form/data/DynamicDataLoader.js';
import { OptionsManager } from './form/data/OptionsManager.js';
import { FormVideoHandler } from './form/logic/FormVideoHandler.js';
import { FormRelationsHandler } from './form/logic/FormRelationsHandler.js';
import { FormSearchableSelect } from './form/logic/FormSearchableSelect.js';
// Neue Architektur
import { SmartFormInitializer } from './form/initialization/SmartFormInitializer.js';

export class FormSystem {
  constructor() {
    // Module initialisieren
    this.config = new FormConfig();
    this.renderer = new FormRenderer();
    this.validator = new FormValidator();
    this.autoGeneration = new AutoGeneration();
    this.autoCalculation = new AutoCalculation();
    this.dependentFields = new DependentFields(this.autoGeneration);
    this.relationTables = new RelationTables();
    this.dataLoader = new DynamicDataLoader();
    this.optionsManager = new OptionsManager();
    this.formEvents = new FormEvents(this);
    this.videoHandler = new FormVideoHandler();
    this.relationsHandler = new FormRelationsHandler(this.renderer);
    this.searchableSelect = new FormSearchableSelect(this.optionsManager);

    // NEUE ARCHITEKTUR
    this.smartInitializer = new SmartFormInitializer();
    this.useSmartInitialization = false; // Feature Flag - TEMPORÄR DEAKTIVIERT für Ansprechpartner Fix

    // Konfiguration injizieren
    this.renderer.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.relationTables.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.dataLoader.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.validator.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.dependentFields.getFormConfig = this.config.getFormConfig.bind(this.config);

    // Searchable Select Methoden injizieren
    this.dataLoader.createSearchableSelect = this.createSearchableSelect.bind(this);
    this.dataLoader.reinitializeSearchableSelect = this.reinitializeSearchableSelect.bind(this);
    this.optionsManager.createSearchableSelect = this.createSearchableSelect.bind(this);

    // DynamicDataLoader für abhängige Felder injizieren
    this.dependentFields.dynamicDataLoader = this.dataLoader;

    // DataService injizieren (wird später aufgerufen)
    this.injectDataService();

    this.currentForm = null;
    this.currentFormState = null; // Neue State-Referenz
  }

  // Dynamische Optionen für ein einzelnes Feld laden
  async loadDynamicOptions(field) {
    if (!field || !field.getAttribute('data-table')) return;
    
    const table = field.getAttribute('data-table');
    const displayField = field.getAttribute('data-display-field') || 'name';
    const valueField = field.getAttribute('data-value-field') || 'id';
    
    try {
      const { data, error } = await window.supabase
        .from(table)
        .select(`${valueField}, ${displayField}`)
        .order(displayField);
      
      if (error) throw error;
      
      // Select-Element aktualisieren
      field.innerHTML = '<option value="">Bitte wählen...</option>';
      const options = data.map(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[displayField];
        field.appendChild(option);
        return {
          value: item[valueField],
          label: item[displayField]
        };
      });
      
      // Wenn es ein searchable field ist, auch die searchable select UI aktualisieren
      if (field.getAttribute('data-searchable') === 'true') {
        const container = field.parentNode.querySelector('.searchable-select-container');
        if (container) {
          const dropdown = container.querySelector('.searchable-select-dropdown');
          const input = container.querySelector('.searchable-select-input');
          
          if (dropdown && input) {
            // Dropdown-Optionen aktualisieren
            this.updateDropdownItems(dropdown, options, '');
            
            if (!input.value) {
              input.placeholder = field.getAttribute('data-placeholder') || 'Bitte wählen...';
            }
          }
        }
      }
      
      console.log(`✅ Dynamische Optionen geladen für ${field.name}: ${options.length} Optionen`);
    } catch (error) {
      console.error(`❌ Fehler beim Laden der Optionen für ${table}:`, error);
    }
  }

  // Formular öffnen
  async openForm(entity, data = null) {
    try {
      const formHtml = this.renderer.renderForm(entity, data);
      
      // Modal erstellen
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          ${formHtml}
        </div>
      `;

      document.body.appendChild(modal);
      this.currentForm = { entity, data, modal };

      // Events binden
      await this.formEvents.bindFormEvents(entity, data);

      console.log(`✅ Formular geöffnet: ${entity}`);
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Formulars:', error);
    }
  }

  // Formular schließen
  closeForm() {
    if (this.currentForm && this.currentForm.modal) {
      // Cleanup Event Listeners (Memory Leak Prevention)
      const form = this.currentForm.modal.querySelector('form');
      if (form) {
        this.dependentFields.cleanup(form);
      }
      
      document.body.removeChild(this.currentForm.modal);
      this.currentForm = null;
      console.log('✅ Formular geschlossen');
    }
  }

  // Formular ohne Modal rendern (für Seiten-Formulare)
  renderFormOnly(entity, data = null) {
    return this.renderer.renderFormOnly(entity, data);
  }

  // Formular-Events binden (für Seiten-Formulare)
  async bindFormEvents(entity, data) {
    // NEUE ARCHITEKTUR: Smart Initialization für kritische Entities
    if (this.useSmartInitialization && this.shouldUseSmartInit(entity)) {
      console.log(`🚀 FORMSYSTEM: Verwende Smart Initialization für ${entity}`);
      
      try {
        // Cleanup alte Initialisierung
        if (this.currentFormState) {
          this.currentFormState.destroy();
        }
        
        // Extrahiere entityId für Edit Mode
        const entityId = data?._entityId || data?.id || null;
        
        // Smart Initialization
        const result = await this.smartInitializer.initializeForm(entity, entityId, data || {});
        
        if (result.success) {
          this.currentFormState = result.stateManager;
          console.log(`✅ FORMSYSTEM: Smart Initialization erfolgreich für ${entity}`);
          
          // Fallback zu normalem Event Binding für UI-Interaktionen
          await this.formEvents.bindFormEvents(entity, data);
          
          return result;
        } else {
          console.warn(`⚠️ FORMSYSTEM: Smart Initialization fehlgeschlagen, Fallback zu Legacy System`);
        }
      } catch (error) {
        console.error(`❌ FORMSYSTEM: Smart Initialization Error:`, error);
        console.log(`🔄 FORMSYSTEM: Fallback zu Legacy System für ${entity}`);
      }
    }

    // Legacy System (Fallback)
    console.log(`📜 FORMSYSTEM: Verwende Legacy System für ${entity}`);
    return this.formEvents.bindFormEvents(entity, data);
  }

  // Bestimme ob Smart Initialization verwendet werden soll
  shouldUseSmartInit(entity) {
    // Aktiviere für problematische Entities
    const smartInitEntities = ['kampagne', 'ansprechpartner', 'creator'];
    return smartInitEntities.includes(entity);
  }

  // DataService injizieren
  injectDataService() {
    if (window.dataService) {
      this.dataLoader.setDataService(window.dataService);
      console.log('✅ DataService erfolgreich injiziert');
    } else {
      console.warn('⚠️ DataService noch nicht verfügbar, wird später injiziert');
      // Retry nach kurzer Verzögerung
      setTimeout(() => this.injectDataService(), 100);
    }
  }


  // Formular-Submit verarbeiten
  async handleFormSubmit(entity, data, formOverride) {
    try {
      const form = formOverride || document.getElementById(`${entity}-form`);
      if (!form) return;

      const submitData = this.collectSubmitData(form);

      // Spezielle Behandlung für Kampagnen: Kampagnenname generieren falls leer
      if (entity === 'kampagne' && (!submitData.kampagnenname || submitData.kampagnenname.trim() === '')) {
        console.log('🔧 FORMSYSTEM: Kampagnenname ist leer, generiere automatisch...');
        if (submitData.auftrag_id) {
          await this.autoGeneration.autoGenerateKampagnenname(form, submitData.auftrag_id);
          // Wert aus dem Formular neu lesen
          const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
          if (kampagnennameInput && kampagnennameInput.value) {
            submitData.kampagnenname = kampagnennameInput.value;
            console.log('✅ FORMSYSTEM: Kampagnenname generiert:', submitData.kampagnenname);
          }
        }
      }

      console.log(`🧪 FORMSYSTEM: Submit-Daten fuer ${entity}:`, submitData);

      // Validierung
      const errors = this.validator.validateFormData(entity, submitData);
      if (errors.length > 0) {
        this.validator.showValidationErrors(errors);
        return;
      }

      if (entity === 'kooperation') {
        const videoLimitValidation = await this.validateKooperationVideoLimit(form, submitData, data?.id || data?._entityId || null);
        if (!videoLimitValidation.isValid) {
          this.validator.showErrorMessage(videoLimitValidation.message);
          return { success: false };
        }
      }

      // Entity erstellen/aktualisieren
      let result;
      if (data && data.id) {
        // Update
        result = await window.dataService.updateEntity(entity, data.id, submitData);
      } else {
        // Create
        result = await window.dataService.createEntity(entity, submitData);
      }

      if (result.success) {
        // Verknüpfungstabellen verarbeiten
        await this.relationTables.handleRelationTables(entity, result.id, submitData, form);

        // Spezielle Behandlung für Kampagnen-Adressen
        if (entity === 'kampagne') {
          await this.handleKampagneAddresses(result.id, form);
        }

        // Spezielle Behandlung: Kooperation → Videos-Repeater speichern
        if (entity === 'kooperation') {
          await this.handleKooperationVideos(result.id, form);
          await this.handleKooperationTags(result.id, form);
        }

        // File-Upload für Ansprechpartner Profilbild
        if (entity === 'ansprechpartner') {
          await this.handleAnsprechpartnerProfileImage(result.id, form);
        }

        // Rechnungs-Dateien (Belege + PDF) beim Edit verarbeiten
        if (entity === 'rechnung') {
          await this.handleRechnungFiles(result.id, form);
        }

        this.validator.showSuccessMessage(data ? 'Erfolgreich aktualisiert!' : 'Erfolgreich erstellt!');

        // Micro-Animation greifen lassen, dann schließen (falls Button-Flow aktiv)
        const btn = form.querySelector('.mdc-btn.mdc-btn--create');
        if (btn) {
          setTimeout(() => this.closeForm(), 400);
        } else {
          this.closeForm();
        }
        
        // Event auslösen für List-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity, id: result.id, action: data ? 'updated' : 'created' } 
        }));
      } else {
        this.validator.showErrorMessage(`Fehler beim ${data ? 'Aktualisieren' : 'Erstellen'}: ${result.error}`);
        return { success: false };
      }

    } catch (error) {
      console.error('❌ Fehler beim Formular-Submit:', error);
      this.validator.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
      return { success: false };
    }
  }

  // Formulardaten sammeln (unterstützt Multi-Select & versteckte Tag-Selects)
  collectSubmitData(form) {
    const submitData = {};
    if (!form) return submitData;

    const formData = new FormData(form);

    for (const [rawKey, rawValue] of formData.entries()) {
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const isArrayKey = rawKey.endsWith('[]');
      const key = isArrayKey ? rawKey.slice(0, -2) : rawKey;

      if (isArrayKey) {
        if (!submitData[key]) {
          submitData[key] = [];
        }
        if (value !== '') {
          submitData[key].push(value);
        }
      } else if (submitData.hasOwnProperty(key)) {
        // Bei doppelten Einträgen (z.B. searchable select + hidden input):
        // Bevorzuge nicht-leeren Wert, vermeide unnötige Arrays
        const existingValue = submitData[key];
        const existingIsEmpty = existingValue === '' || existingValue === null || existingValue === undefined;
        const newIsEmpty = value === '' || value === null || value === undefined;
        
        if (existingIsEmpty && !newIsEmpty) {
          // Alter Wert leer, neuer nicht leer -> ersetze
          submitData[key] = value;
        } else if (!existingIsEmpty && !newIsEmpty && existingValue !== value) {
          // Beide nicht leer und unterschiedlich -> Array erstellen (echte Multi-Values)
          if (!Array.isArray(submitData[key])) {
            submitData[key] = [submitData[key]];
          }
          submitData[key].push(value);
        }
        // Sonst: behalte existierenden Wert (neuer ist leer oder identisch)
      } else {
        submitData[key] = value;
      }
    }

    // Versteckte/tag-basierte Multi-Selects erfassen
    const multiSelects = form.querySelectorAll('select[multiple]');
    multiSelects.forEach(select => {
      const name = select.name;
      if (!name) return;
      const key = name.endsWith('[]') ? name.slice(0, -2) : name;
      const selectedValues = Array.from(select.selectedOptions)
        .map(option => option.value)
        .filter(Boolean);

      if (selectedValues.length > 0) {
        submitData[key] = Array.from(new Set(selectedValues));
      } else if (!submitData[key]) {
        submitData[key] = [];
      }
    });

    // Sicherstellen, dass Array-Felder eindeutig und ohne leere Strings sind
    Object.keys(submitData).forEach(key => {
      if (Array.isArray(submitData[key])) {
        submitData[key] = Array.from(new Set(submitData[key].filter(Boolean)));
      }
    });

    // Checkboxen/Toggles explizit erfassen (unchecked Checkboxen sind nicht im FormData)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const name = checkbox.name;
      if (name) {
        submitData[name] = checkbox.checked;
      }
    });

    // Leere Strings bei UUID-Feldern (_id) zu null konvertieren (Supabase erwartet UUID oder null, nicht "")
    Object.keys(submitData).forEach(key => {
      if (key.endsWith('_id') && submitData[key] === '') {
        submitData[key] = null;
      }
    });

    return submitData;
  }



  // Formular-Validierung
  validateFormData(entity, data) {
    const errors = [];
    const config = this.config.getFormConfig(entity);
    
    if (!config) return errors;

    config.fields.forEach(field => {
      // Skip Validierung für auto-generierte Felder, die leer sind
      if (field.autoGenerate && (!data[field.name] || data[field.name].toString().trim() === '')) {
        return; // Auto-generierte Felder müssen nicht validiert werden
      }
      
      if (field.required && (!data[field.name] || data[field.name].toString().trim() === '')) {
        errors.push(`${field.label} ist erforderlich.`);
      }

      if (field.validation && data[field.name]) {
        const value = data[field.name];
        
        switch (field.validation.type) {
          case 'text':
            if (field.validation.minLength && value.length < field.validation.minLength) {
              errors.push(`${field.label} muss mindestens ${field.validation.minLength} Zeichen lang sein.`);
            }
            break;
          case 'number':
            if (field.validation.min !== undefined && parseFloat(value) < field.validation.min) {
              errors.push(`${field.label} muss mindestens ${field.validation.min} sein.`);
            }
            if (field.validation.max !== undefined && parseFloat(value) > field.validation.max) {
              errors.push(`${field.label} darf maximal ${field.validation.max} sein.`);
            }
            break;
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              errors.push(`${field.label} muss eine gültige E-Mail-Adresse sein.`);
            }
            break;
          case 'url':
            try {
              new URL(value);
            } catch {
              errors.push(`${field.label} muss eine gültige URL sein.`);
            }
            break;
        }
      }
    });

    return errors;
  }

  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    const message = errors.join('\n');
    alert(`Validierungsfehler:\n${message}`);
  }

  // Erfolgsmeldung anzeigen
  showSuccessMessage(message) {
    // Hier könnte eine schönere Benachrichtigung implementiert werden
    console.log(`✅ ${message}`);
  }

  // Fehlermeldung anzeigen
  showErrorMessage(message) {
    // Hier könnte eine schönere Benachrichtigung implementiert werden
    console.error(`❌ ${message}`);
    alert(message);
  }

  // ==================== NEUE ARCHITEKTUR: CLEANUP ====================
  
  // Cleanup für Smart Initialization
  cleanupSmartInit() {
    if (this.currentFormState) {
      this.currentFormState.destroy();
      this.currentFormState = null;
    }
    
    if (this.smartInitializer) {
      this.smartInitializer.cleanup();
    }
    
    // Cleanup globale Referenzen
    if (window.currentFormState) {
      window.currentFormState = null;
    }
    if (window.currentFieldLoader) {
      window.currentFieldLoader = null;
    }
    
    console.log(`🗑️ FORMSYSTEM: Smart Initialization Cleanup abgeschlossen`);
  }

  // ===== Delegationen an ausgelagerte Handler (öffentliche API beibehalten) =====

  initializeSearchableSelects(form) {
    return this.searchableSelect.initializeSearchableSelects(form);
  }

  createSearchableSelect(selectElement, options, field) {
    return this.searchableSelect.createSearchableSelect(selectElement, options, field);
  }

  isoToFlagEmoji(isoCode) {
    return this.searchableSelect.isoToFlagEmoji(isoCode);
  }

  createSimpleSearchableSelect(selectElement, options, field) {
    return this.searchableSelect.createSimpleSearchableSelect(selectElement, options, field);
  }

  updateDropdownItems(dropdown, options, filterText, field = null) {
    return this.searchableSelect.updateDropdownItems(dropdown, options, filterText, field);
  }

  async handleCreateNewOption(dropdown, options, newValue, field) {
    return this.searchableSelect.handleCreateNewOption(dropdown, options, newValue, field);
  }

  reinitializeSearchableSelect(selectElement, options, field) {
    return this.searchableSelect.reinitializeSearchableSelect(selectElement, options, field);
  }

  async createLookupEntry(table, displayField, value) {
    return this.searchableSelect.createLookupEntry(table, displayField, value);
  }

  getKampagneTotalVideos(kampagne) {
    return this.videoHandler.getKampagneTotalVideos(kampagne);
  }

  async validateKooperationVideoLimit(form, submitData, kooperationId = null) {
    return this.videoHandler.validateKooperationVideoLimit(form, submitData, kooperationId);
  }

  async handleKooperationVideos(kooperationId, form) {
    return this.videoHandler.handleKooperationVideos(kooperationId, form);
  }

  async handleKampagneAddresses(kampagneId, form) {
    return this.relationsHandler.handleKampagneAddresses(kampagneId, form);
  }

  setupAddressesFields(form) {
    return this.relationsHandler.setupAddressesFields(form);
  }

  async handleKooperationTags(kooperationId, form) {
    return this.relationsHandler.handleKooperationTags(kooperationId, form);
  }

  async handleAnsprechpartnerProfileImage(ansprechpartnerId, form) {
    return this.relationsHandler.handleAnsprechpartnerProfileImage(ansprechpartnerId, form);
  }

  async handleRechnungFiles(rechnungId, form) {
    return this.relationsHandler.handleRechnungFiles(rechnungId, form);
  }

  // Zerstöre FormSystem komplett
  destroy() {
    this.cleanupSmartInit();
    
    if (this.currentForm) {
      this.closeForm();
    }
    
    console.log(`🗑️ FORMSYSTEM: Komplett zerstört`);
  }
}

// Exportiere Instanz
export const formSystem = new FormSystem();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.formSystem = formSystem;
} 