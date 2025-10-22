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
        // Mehrfachwerte in Array umwandeln
        if (!Array.isArray(submitData[key])) {
          submitData[key] = [submitData[key]];
        }
        if (value !== '') {
          submitData[key].push(value);
        }
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

    return submitData;
  }

  // Kampagnen-Adressen verarbeiten
  async handleKampagneAddresses(kampagneId, form) {
    try {
      const addressesContainer = form.querySelector('.addresses-list');
      if (!addressesContainer) return;

      const addressItems = addressesContainer.querySelectorAll('.address-item');
      const addresses = [];

      addressItems.forEach(item => {
        const addressId = item.dataset.addressId;
        const address = {
          kampagne_id: kampagneId,
          adressname: form.querySelector(`input[name="adressname_${addressId}"]`)?.value || '',
          strasse: form.querySelector(`input[name="strasse_${addressId}"]`)?.value || '',
          hausnummer: form.querySelector(`input[name="hausnummer_${addressId}"]`)?.value || '',
          plz: form.querySelector(`input[name="plz_${addressId}"]`)?.value || '',
          stadt: form.querySelector(`input[name="stadt_${addressId}"]`)?.value || '',
          land: form.querySelector(`input[name="land_${addressId}"]`)?.value || '',
          notiz: form.querySelector(`textarea[name="notiz_${addressId}"]`)?.value || ''
        };

        // Nur hinzufügen wenn mindestens Adressname vorhanden
        if (address.adressname.trim()) {
          addresses.push(address);
        }
      });

      if (addresses.length > 0) {
        // Bestehende Adressen löschen
        await window.supabase
          .from('kampagne_adressen')
          .delete()
          .eq('kampagne_id', kampagneId);

        // Neue Adressen einfügen
        const { error } = await window.supabase
          .from('kampagne_adressen')
          .insert(addresses);

        if (error) {
          console.error('❌ Fehler beim Speichern der Adressen:', error);
        } else {
          console.log(`✅ ${addresses.length} Adressen für Kampagne ${kampagneId} gespeichert`);
        }
      }

    } catch (error) {
      console.error('❌ Fehler beim Verarbeiten der Kampagnen-Adressen:', error);
    }
  }

  // Adressen-Felder einrichten
  setupAddressesFields(form) {
    const addressesContainers = form.querySelectorAll('.addresses-container');
    
    addressesContainers.forEach(container => {
      const addBtn = container.querySelector('.add-address-btn');
      const addressesList = container.querySelector('.addresses-list');
      
      if (addBtn && addressesList) {
        addBtn.addEventListener('click', () => {
          this.renderer.addAddressRow(addressesList);
        });
      }
    });
  }

  // Kooperation: Videos-Repeater speichern
  async handleKooperationVideos(kooperationId, form) {
    try {
      if (!window.supabase) return;
      const list = form.querySelector('.videos-list');
      if (!list) return;

      const items = Array.from(list.querySelectorAll('.video-item'));
      const rows = items.map((el, idx) => {
        const id = el.getAttribute('data-video-id');
        const contentArt = form.querySelector(`select[name="video_content_art_${id}"]`)?.value || null;
        return {
          kooperation_id: kooperationId,
          content_art: contentArt,
          titel: null,
          asset_url: null,
          kommentar: null,
          position: idx + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }).filter(r => r.content_art || r.titel || r.asset_url || r.kommentar);

      // Bestehende Videos löschen und neu schreiben
      await window.supabase
        .from('kooperation_videos')
        .delete()
        .eq('kooperation_id', kooperationId);

      if (rows.length > 0) {
        const { data: inserted, error } = await window.supabase
          .from('kooperation_videos')
          .insert(rows)
          .select('id, content_art, position');
        if (error) {
          console.error('❌ Fehler beim Speichern der Kooperation-Videos:', error);
        } else {
          console.log(`✅ ${inserted?.length || 0} Videos für Kooperation ${kooperationId} gespeichert`, inserted);
          if (!inserted || inserted.length === 0) {
            console.warn('⚠️ Insert meldete Erfolg, aber keine Zeilen wurden zurückgegeben. Prüfe RLS/Policies für kooperation_videos.');
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler in handleKooperationVideos:', error);
    }
  }

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
    
    searchableSelects.forEach(select => {
      // Placeholder aus Dataset übernehmen, Tag-Based bereits hier respektieren
      this.createSearchableSelect(select, [], {
        placeholder: select.dataset.placeholder || 'Bitte wählen...',
        // Hilfsfelder für Erkennung von Tag-basiertem Multiselect
        type: select.multiple ? 'multiselect' : 'select',
        tagBased: select.dataset.tagBased === 'true'
      });
    });
  }

  // Searchable Select erstellen
  createSearchableSelect(selectElement, options, field) {
    // Prüfe ob es ein Tag-basiertes Multiselect sein soll (Dataset hart respektieren)
    const isTagBased = (field?.type === 'multiselect' || selectElement.multiple) &&
      (field?.tagBased === true || selectElement.dataset.tagBased === 'true');
    
    if (isTagBased) {
      // Optionen aus dem DOM extrahieren, falls leer (z. B. dynamisch noch nicht da)
      if (!options || options.length === 0) {
        options = Array.from(selectElement.options)
          .slice(1)
          .map(o => ({ 
            value: o.value, 
            label: o.textContent,
            selected: o.selected || false 
          }));
        console.log('🔧 FORMSYSTEM: Optionen aus DOM extrahiert für Tag-basiertes Select:', options.filter(o => o.selected));
      } else {
        // Debug: Zeige selected Optionen die weitergegeben werden
        const selectedOptions = options.filter(o => o.selected);
        if (selectedOptions.length > 0) {
          console.log('🎯 FORMSYSTEM: Übergebe selected Optionen an OptionsManager:', selectedOptions.map(o => o.label));
        }
      }
      return this.optionsManager.createTagBasedSelect(selectElement, options, field);
    }
    
    
    // Fallback: einfacher Such-Select
    if (!options || options.length === 0) {
      options = Array.from(selectElement.options)
        .slice(1)
        .map(o => ({ value: o.value, label: o.textContent }));
    }
    return this.createSimpleSearchableSelect(selectElement, options, field);
  }

  // Hilfsfunktion: ISO-Code zu Flag-Emoji
  isoToFlagEmoji(isoCode) {
    if (!isoCode || isoCode.length !== 2) return '';
    const codePoints = [...isoCode.toUpperCase()].map(char => 
      0x1F1E6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }

  // Einfache Auto-Suggestion Select erstellen
  createSimpleSearchableSelect(selectElement, options, field) {
    // Bestehende Container entfernen
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Prüfe ob es ein Phone-Field ist
    const isPhoneField = selectElement.dataset.phoneField === 'true';

    // Container erstellen (ohne Inline-Styles)
    const container = document.createElement('div');
    container.className = 'searchable-select-container';

    // Input-Feld erstellen
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = field.placeholder || 'Suchen...';
    // Browser-Autocomplete komplett deaktivieren (mehrere Methoden kombiniert)
    input.autocomplete = 'new-password'; // Trick: Browser denken es ist ein Passwort-Feld
    input.setAttribute('data-form-type', 'other');
    input.setAttribute('data-lpignore', 'true'); // LastPass ignorieren
    input.setAttribute('readonly', 'readonly'); // Initial readonly
    
    // Readonly nach kurzer Verzögerung entfernen (verhindert Autocomplete)
    setTimeout(() => {
      input.removeAttribute('readonly');
    }, 100);

    // Dropdown erstellen
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';

    // Original Select verstecken und required entfernen (wird auf Input übertragen)
    selectElement.style.display = 'none';
    const wasRequired = selectElement.hasAttribute('required');
    if (wasRequired) {
      selectElement.removeAttribute('required');
      input.setAttribute('required', '');
      input.setAttribute('data-was-required', 'true');
    }
    
    // Für normale Felder: Hidden Input für den tatsächlichen Wert erstellen
    // (das originale Select wird manchmal beim Submit ignoriert)
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = selectElement.name;
    hiddenInput.id = selectElement.id + '_value';
    
    // Initial Wert setzen falls vorhanden
    if (selectElement.value) {
      hiddenInput.value = selectElement.value;
    }

    // Container einfügen
    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(input);
    container.appendChild(dropdown);
    container.appendChild(hiddenInput); // Hidden Input für Submit

    // Bestehende Auswahl setzen (für Edit-Modus)
    const selectedOption = options.find(option => option.selected);
    if (selectedOption) {
      // Für Phone-Fields: Nur Ländername (ohne Vorwahl)
      if (isPhoneField && selectedOption.isoCode) {
        const countryName = selectedOption.label.replace(/^\+\d+\s*/, '').trim();
        const flagEmoji = this.isoToFlagEmoji(selectedOption.isoCode);
        input.value = `${flagEmoji} ${countryName}`;
        
        // Initial auch Vorwahl ins Telefonnummer-Feld setzen
        setTimeout(() => {
          const phoneContainer = selectElement.closest('.phone-number-field');
          if (phoneContainer) {
            const phoneInput = phoneContainer.querySelector('.phone-number-input');
            if (phoneInput && selectedOption.vorwahl && !phoneInput.value.trim()) {
              phoneInput.value = selectedOption.vorwahl + ' ';
              phoneInput.placeholder = selectedOption.vorwahl + ' 123 456 7890';
            }
          }
        }, 100);
      } else {
        input.value = selectedOption.label;
      }
      // Auch das ursprüngliche Select-Element setzen
      Array.from(selectElement.options).forEach(opt => {
        if (opt.value === selectedOption.value) {
          opt.selected = true;
        }
      });
      // Hidden Input auch initial setzen
      hiddenInput.value = selectedOption.value;
      console.log('✅ FORMSYSTEM: Bestehender Wert gesetzt für', field.name, ':', selectedOption.label);
    }

    // Hilfsfunktion: Dropdown-Position aktualisieren
    const updateDropdownPosition = () => {
      if (isPhoneField && dropdown.classList.contains('show')) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`; // Exakt die Breite des Inputs
      }
    };

    // Event-Handler
    input.addEventListener('focus', () => {
      // Dropdown erst anzeigen
      dropdown.classList.add('show');
      
      // Für Phone-Fields: Wenn nur Placeholder-Text drin ist, leeren
      if (isPhoneField && input.placeholder && input.value === input.placeholder) {
        input.value = '';
      }
      
      this.updateDropdownItems(dropdown, options, input.value);
      
      // Für Phone-Fields: Position NACH dem Anzeigen berechnen
      if (isPhoneField) {
        // Kleine Verzögerung damit DOM aktualisiert ist
        setTimeout(() => {
          updateDropdownPosition();
          
          // Scroll-Listener hinzufügen während Dropdown offen ist
          window.addEventListener('scroll', updateDropdownPosition, true);
          window.addEventListener('resize', updateDropdownPosition);
        }, 10);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('show');
        
        // Scroll-Listener entfernen wenn Dropdown geschlossen wird
        if (isPhoneField) {
          window.removeEventListener('scroll', updateDropdownPosition, true);
          window.removeEventListener('resize', updateDropdownPosition);
        }
      }, 200);
    });

    input.addEventListener('input', () => {
      this.updateDropdownItems(dropdown, options, input.value);
      
      // Custom Validierung für required Felder
      if (input.hasAttribute('data-was-required')) {
        if (input.value.trim() === '') {
          input.setCustomValidity('Dieses Feld ist erforderlich.');
        } else {
          input.setCustomValidity('');
        }
      }
    });

    // Dropdown-Items erstellen
    this.updateDropdownItems(dropdown, options, '');
  }

  // Dropdown-Items aktualisieren
  updateDropdownItems(dropdown, options, filterText) {
    dropdown.innerHTML = '';
    
    // Filter ignoriert Flag-Emojis
    const cleanFilterText = filterText.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    
    const filteredOptions = options.filter(option => 
      option.label.toLowerCase().includes(cleanFilterText.toLowerCase())
    );

    // Prüfe ob es ein Phone-Field ist
    const selectElement = dropdown.parentNode.parentNode.querySelector('select');
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      
      // Spezielle Behandlung für Phone-Fields mit Flag-Emojis
      if (isPhoneField && option.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(option.isoCode);
        item.textContent = `${flagEmoji} ${option.label}`;
      } else {
        item.textContent = option.label;
      }

      item.addEventListener('click', () => {
        // Original Select aktualisieren
        const selectElement = dropdown.parentNode.parentNode.querySelector('select');
        
        // Neue Option erstellen falls sie nicht existiert
        let optionElement = Array.from(selectElement.options).find(opt => opt.value === option.value);
        if (!optionElement) {
          optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          if (option.isoCode) {
            optionElement.dataset.isoCode = option.isoCode;
          }
          if (option.vorwahl) {
            optionElement.dataset.vorwahl = option.vorwahl;
          }
          selectElement.appendChild(optionElement);
        }
        
        selectElement.value = option.value;
        
        // Hidden Input auch aktualisieren (für Submit)
        const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          hiddenInput.value = option.value;
        }
        
        // Input aktualisieren (das sichtbare Text-Feld)
        const input = dropdown.parentNode.querySelector('.searchable-select-input');
        
        // Für Phone-Fields: Nur Ländername (ohne Emoji, ohne Vorwahl)
        if (isPhoneField && option.isoCode) {
          // Extrahiere nur den Ländernamen (Label ohne Vorwahl)
          const countryName = option.label.replace(/^\+\d+\s*/, '').trim();
          const flagEmoji = this.isoToFlagEmoji(option.isoCode);
          input.value = `${flagEmoji} ${countryName}`;
          
          // Finde das Telefonnummer-Input-Feld und füge Vorwahl ein
          const phoneContainer = selectElement.closest('.phone-number-field');
          if (phoneContainer) {
            const phoneInput = phoneContainer.querySelector('.phone-number-input');
            if (phoneInput && option.vorwahl) {
              // Wenn das Feld leer ist oder nur Vorwahl enthält, setze neue Vorwahl
              const currentValue = phoneInput.value.trim();
              if (!currentValue || currentValue.match(/^\+\d+\s*$/)) {
                phoneInput.value = option.vorwahl + ' ';
                // Cursor ans Ende setzen
                setTimeout(() => phoneInput.focus(), 50);
              } else if (currentValue.match(/^\+\d+\s+.+/)) {
                // Ersetze alte Vorwahl mit neuer
                phoneInput.value = currentValue.replace(/^\+\d+/, option.vorwahl);
              } else {
                // Füge Vorwahl vor bestehende Nummer
                phoneInput.value = option.vorwahl + ' ' + currentValue;
              }
            }
          }
        } else {
          input.value = option.label;
        }
        
        // Custom Validierung für required Felder
        if (input.hasAttribute('data-was-required')) {
          input.setCustomValidity(''); // Fehler löschen wenn Wert gesetzt
        }
        
        // Event auslösen (mit bubbles für DependentFields)
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Dropdown schließen
        dropdown.classList.remove('show');
        
        console.log(`✅ Searchable Select ${selectElement.name} aktualisiert: ${option.label} → ${option.value}`);
      });

      item.addEventListener('mouseenter', () => item.classList.add('hover'));
      item.addEventListener('mouseleave', () => item.classList.remove('hover'));

      dropdown.appendChild(item);
    });
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    // WICHTIG: Ursprüngliches Select ausgeblendet lassen
    // Das verhindert doppelte Input-Felder bei Reinitialisierung
    selectElement.style.display = 'none';
    
    this.createSearchableSelect(selectElement, options, field);
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