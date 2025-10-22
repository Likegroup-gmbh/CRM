import { FormConfig } from './FormConfig.js';
import { FormRenderer } from './FormRenderer.js';
import { AutoGeneration } from './logic/AutoGeneration.js';
import { DependentFields } from './logic/DependentFields.js';
import { RelationTables } from './logic/RelationTables.js';
import { DynamicDataLoader } from './data/DynamicDataLoader.js';

export class FormSystem {
  constructor() {
    // Module initialisieren
    this.config = new FormConfig();
    this.renderer = new FormRenderer();
    this.autoGeneration = new AutoGeneration();
    this.dependentFields = new DependentFields(this.autoGeneration);
    this.relationTables = new RelationTables();
    this.dataLoader = new DynamicDataLoader();

    // Konfiguration injizieren
    this.renderer.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.relationTables.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.dataLoader.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.dependentFields.getFormConfig = this.config.getFormConfig.bind(this.config);
    this.dependentFields.dynamicDataLoader = this.dataLoader;

    // Searchable Select Methoden injizieren
    this.dataLoader.createSearchableSelect = this.createSearchableSelect.bind(this);
    this.dataLoader.reinitializeSearchableSelect = this.reinitializeSearchableSelect.bind(this);

    this.currentForm = null;
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
      
      field.innerHTML = '<option value="">Bitte wählen...</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[displayField];
        field.appendChild(option);
      });
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
      await this.bindFormEvents(entity, data);

      console.log(`✅ Formular geöffnet: ${entity}`);
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Formulars:', error);
    }
  }

  // Formular schließen
  closeForm() {
    if (this.currentForm && this.currentForm.modal) {
      document.body.removeChild(this.currentForm.modal);
      this.currentForm = null;
      console.log('✅ Formular geschlossen');
    }
  }

  // Formular-Events binden
  async bindFormEvents(entity, data) {
    const form = document.getElementById(`${entity}-form`);
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(entity, data);
    };

    // Close-Button Event
    const closeBtn = form.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeForm();
    }

    // Edit-Mode Kontext für DynamicDataLoader setzen
    if (data && data._isEditMode) {
      console.log('🎯 FORMSYSTEM: Edit-Mode erkannt, setze Kontext für DynamicDataLoader');
      console.log('📋 FORMSYSTEM: Edit-Mode Daten:', {
        entityId: data._entityId,
        brancheIds: data.branche_id,
        totalFields: Object.keys(data).length
      });
      
      form.dataset.editModeData = JSON.stringify(data);
      
      // Spezielle Behandlung für branche_id im Edit-Mode
      if (data.branche_id && Array.isArray(data.branche_id)) {
        console.log('🏷️ FORMSYSTEM: Branchen-IDs für Edit-Mode verfügbar:', data.branche_id);
      } else {
        console.log('ℹ️ FORMSYSTEM: Keine Branchen-IDs im Edit-Mode vorhanden');
      }
    } else {
      console.log('ℹ️ FORMSYSTEM: Kein Edit-Mode erkannt oder keine Daten verfügbar');
    }

    // Dynamische Daten für Formular laden
    await this.dataLoader.loadDynamicFormData(entity, form);

    // Searchable Select-Felder initialisieren (nach dem Laden der Daten)
    // DEAKTIVIERT: Das alte FormSystem (window.formSystem) übernimmt das
    // this.initializeSearchableSelects(form);

    // Abhängige Felder einrichten
    this.dependentFields.setupDependentFields(form);

    // Adressen-Felder einrichten
    this.setupAddressesFields(form);

    // Auto-Generierung einrichten
    this.autoGeneration.setupAutoGeneration(form);
  }

  // Formular-Submit verarbeiten
  async handleFormSubmit(entity, data) {
    try {
      const form = document.getElementById(`${entity}-form`);
      if (!form) return;

      // Formulardaten sammeln
      const formData = new FormData(form);
      const submitData = {};
      
      console.log('📤 FormData sammeln...');
      console.log('🚨 FORMSYSTEM: handleFormSubmit wird aufgerufen für:', entity);
      
      // Tag-basierte Multi-Selects verarbeiten (erweiterte Suche)
      let tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden (data-tag-based="true"):', tagBasedSelects.length);
      
      // Fallback: Suche nach versteckten Multi-Selects mit [] Namen (das sind die Tag-basierten)
      if (tagBasedSelects.length === 0) {
        const hiddenSelects = form.querySelectorAll('select[multiple][style*="display: none"]');
        console.log('🔍 Versteckte Multi-Selects als Fallback gefunden:', hiddenSelects.length);
        
        // Filter nur die mit [] Namen (das sind die Tag-basierten)
        tagBasedSelects = Array.from(hiddenSelects).filter(select => 
          select.name.includes('[]') || select.id.includes('hidden')
        );
        console.log('🏷️ Tag-basierte Selects über Fallback gefunden:', tagBasedSelects.length);
      }
      
      console.log('🚨 FORMSYSTEM: Tag-basierte Verarbeitung läuft!');
      
      tagBasedSelects.forEach(select => {
        console.log(`🔍 Verarbeite Tag-basiertes Select: ${select.name}`);
        
        // Wenn das Select bereits versteckt ist (Fallback-Fall), verwende es direkt
        let hiddenSelect = select;
        let fieldName = select.name;
        
        // Bereinige den Feldnamen von [] falls vorhanden
        if (fieldName.includes('[]')) {
          fieldName = fieldName.replace('[]', '');
        }
        
        // Wenn es kein verstecktes Select ist, suche nach dem versteckten
        if (!select.style.display.includes('none') && !select.name.includes('[]')) {
          // Debug: Alle Selects mit diesem Namen finden
          const allSelects = form.querySelectorAll(`select[name^="${fieldName}"]`);
          console.log(`🔍 Alle Selects für ${fieldName}:`, allSelects.length, Array.from(allSelects).map(s => ({ name: s.name, hidden: s.style.display === 'none', options: s.options.length })));
          
          // Suche das versteckte Select mit den tatsächlichen Werten
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`) ||
                        form.querySelector(`select[name="${fieldName}"][style*="display: none"]`) ||
                        (allSelects.length > 1 ? allSelects[1] : null);
          
          console.log(`🔍 Verstecktes Select gefunden:`, !!hiddenSelect);
        }
        
        if (hiddenSelect) {
          console.log(`🔍 Verstecktes Select Details:`, {
            name: hiddenSelect.name,
            optionsCount: hiddenSelect.options.length,
            selectedCount: hiddenSelect.selectedOptions.length
          });
          
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
          console.log(`🔍 Ausgewählte Werte:`, selectedValues);
          
          if (selectedValues.length > 0) {
            submitData[fieldName] = selectedValues;
            console.log(`🏷️ Tag-basiertes Multi-Select ${fieldName}:`, selectedValues);
          }
        } else {
          console.log(`⚠️ Verstecktes Select für ${fieldName} nicht gefunden`);
        }
      });
      
      // Normale Multi-Select Felder sammeln
      const multiSelects = form.querySelectorAll('select[multiple]:not([data-tag-based="true"])');
      console.log('🔧 Normale Multi-Select Felder gefunden:', multiSelects.length);
      
      multiSelects.forEach(select => {
        const selectedValues = Array.from(select.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          submitData[select.name] = selectedValues;
          console.log(`✅ Multi-Select ${select.name}:`, selectedValues);
        }
      });
      
      // Standard FormData-Einträge sammeln (inkl. Array-basierte Multi-Selects)
      for (const [key, value] of formData.entries()) {
        if (value !== '') {
          if (key.includes('[]')) {
            // Multi-Select Array behandeln (z.B. branchen_ids[])
            const cleanKey = key.replace('[]', '');
            
            // Prüfe ob bereits durch Tag-basierte Verarbeitung gesetzt
            if (submitData.hasOwnProperty(cleanKey)) {
              console.log(`⏭️ Überspringe ${cleanKey} - bereits durch Tag-basierte Verarbeitung gesetzt:`, submitData[cleanKey]);
              continue;
            }
            
            if (!submitData[cleanKey]) {
              submitData[cleanKey] = [];
            }
            submitData[cleanKey].push(value);
            console.log(`📤 Multi-Select Array ${cleanKey}: ${value}`);
          } else if (!submitData.hasOwnProperty(key)) {
            submitData[key] = value;
            console.log(`📤 FormData ${key}: ${value}`);
          }
        }
      }
      
      // Fix für Searchable Selects: Werte aus versteckten Selects sammeln
      const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
      console.log('🔧 Searchable Selects gefunden:', searchableSelects.length);
      
      searchableSelects.forEach(select => {
        console.log(`🔧 Prüfe Select ${select.name}:`, {
          value: select.value,
          options: select.options.length,
          selectedIndex: select.selectedIndex
        });
        
        if (select.value && select.value !== '') {
          submitData[select.name] = select.value;
          console.log(`✅ Searchable Select ${select.name}: ${select.value}`);
        } else {
          console.log(`❌ Searchable Select ${select.name}: Kein Wert`);
        }
      });
      
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

      console.log('📤 Finale Submit-Daten:', submitData);
      console.log('🚨 FORMSYSTEM: Submit-Daten für DataService:', JSON.stringify(submitData, null, 2));

      // Validierung
      const errors = this.validateFormData(entity, submitData);
      if (errors.length > 0) {
        this.showValidationErrors(errors);
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
        // Verknüpfungstabellen verarbeiten (nicht für Ansprechpartner - wird über DataService Many-to-Many verarbeitet)
        if (entity !== 'ansprechpartner') {
          await this.relationTables.handleRelationTables(entity, result.id, submitData, form);
        }

        // Spezielle Behandlung für Kampagnen-Adressen
        if (entity === 'kampagne') {
          await this.handleKampagneAddresses(result.id, form);
        }

        this.showSuccessMessage(data ? 'Erfolgreich aktualisiert!' : 'Erfolgreich erstellt!');
        this.closeForm();
        
        // Event auslösen für List-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity, id: result.id, action: data ? 'updated' : 'created' } 
        }));
      } else {
        this.showErrorMessage(`Fehler beim ${data ? 'Aktualisieren' : 'Erstellen'}: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Formular-Submit:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
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

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
    
    searchableSelects.forEach(select => {
      // Prüfe ob das Select bereits Optionen hat
      const hasOptions = select.options.length > 1; // Mehr als nur Placeholder
      
      if (hasOptions) {
        // Konvertiere Select-Optionen zu Array
        const options = Array.from(select.options).slice(1).map(option => ({
          value: option.value,
          label: option.textContent
        }));
        
        console.log(`🔧 Initialisiere Searchable Select ${select.name} mit ${options.length} Optionen`);
        this.createSearchableSelect(select, options, {
          placeholder: select.dataset.placeholder || 'Bitte wählen...'
        });
      } else {
        // Leere Optionen für dynamische Felder - werden später geladen
        console.log(`🔧 Initialisiere Searchable Select ${select.name} mit leeren Optionen`);
        this.createSearchableSelect(select, [], {
          placeholder: select.dataset.placeholder || 'Bitte wählen...'
        });
      }
    });
  }

  // Searchable Select erstellen
  createSearchableSelect(selectElement, options, field) {
    // Prüfe ob es ein Tag-basiertes Multiselect sein soll
    const isTagBased = (field?.type === 'multiselect' || selectElement.multiple) &&
      (field?.tagBased === true || selectElement.dataset.tagBased === 'true');
    
    if (isTagBased) {
      console.log(`🏷️ FORMSYSTEM: Erstelle Tag-basiertes Select für ${field.name}`);
      // Verwende das Tag-basierte System aus dem alten FormSystem
      if (window.formSystem?.optionsManager?.createTagBasedSelect) {
        return window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
      }
    }

    // Bestehende Container entfernen (sowohl normale als auch Tag-basierte)
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
    if (existingContainer) {
      // Das versteckte Select-Element vor dem Entfernen des Containers sichern
      const hiddenSelect = document.getElementById(selectElement.id + '_hidden');
      if (hiddenSelect) {
        console.log('🔄 Behalte verstecktes Select-Element bei Container-Entfernung');
      }
      existingContainer.remove();
    }

    // Container erstellen
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    container.style.position = 'relative';
    
    // Prüfe ob es ein Phone-Field ist
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';
    
    // Flag-Icon für Phone Fields
    let flagIcon = null;
    if (isPhoneField) {
      flagIcon = document.createElement('span');
      flagIcon.className = 'phone-flag-icon fi';
      flagIcon.style.cssText = `
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 18px;
        z-index: 3;
        pointer-events: none;
        border-radius: 2px;
      `;
      container.appendChild(flagIcon);
      console.log('📍 Flag-Icon Container erstellt für Phone Field');
    }

    // Input-Feld erstellen
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = field.placeholder || 'Suchen...';
    input.autocomplete = 'off';
    input.style.cssText = `
      width: 100%;
      padding: 8px ${isPhoneField ? '40px' : '12px'} 8px ${isPhoneField ? '44px' : '12px'};
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
    `;

    // Dropdown erstellen
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    `;

    // Original Select verstecken
    selectElement.style.display = 'none';

    // Container einfügen
    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(input);
    container.appendChild(dropdown);

    // Event-Handler
    input.addEventListener('focus', () => {
      dropdown.style.display = 'block';
      this.updateDropdownItems(dropdown, options, input.value, selectElement);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });

    input.addEventListener('input', () => {
      this.updateDropdownItems(dropdown, options, input.value, selectElement);
    });

    // Dropdown-Items erstellen
    this.updateDropdownItems(dropdown, options, '', selectElement);
  }

  // Dropdown-Items aktualisieren
  updateDropdownItems(dropdown, options, filterText, selectElement) {
    dropdown.innerHTML = '';
    
    const filteredOptions = options.filter(option => 
      option.label.toLowerCase().includes(filterText.toLowerCase())
    );

    // Prüfe ob es ein Phone-Field ist
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';

    if (filteredOptions.length === 0) {
      dropdown.innerHTML = '<div style="padding: 8px 12px; color: #9ca3af;">Keine Ergebnisse gefunden</div>';
      return;
    }

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      
      // Spezielle Behandlung für Phone-Fields mit Flaggen
      if (isPhoneField && option.isoCode) {
        // Erstelle Flaggen-Span separat für korrekte Darstellung
        const flag = document.createElement('span');
        flag.className = `fi fi-${option.isoCode.toLowerCase()}`;
        flag.style.cssText = 'margin-right: 8px; display: inline-block; width: 20px; height: 15px;';
        
        const text = document.createTextNode(option.label);
        
        item.appendChild(flag);
        item.appendChild(text);
      } else {
        item.textContent = option.label;
      }
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
        display: flex;
        align-items: center;
      `;

      item.addEventListener('click', () => {
        // Original Select aktualisieren - suche im gleichen Parent-Container
        const container = dropdown.parentNode;
        const selectElement = container.parentNode.querySelector('select');
        
        if (selectElement) {
          selectElement.value = option.value;
          
          // Input aktualisieren
          const input = container.querySelector('input');
          if (input) {
            // Spezielle Behandlung für Phone-Fields: Zeige Flagge + Label
            const isPhoneField = selectElement?.dataset?.phoneField === 'true';
            if (isPhoneField && option.isoCode) {
              // Erstelle Container mit Flagge
              input.value = `${option.vorwahl} ${option.label.replace(option.vorwahl, '').trim()}`;
              // Speichere ISO-Code für spätere Referenz
              input.dataset.selectedIsoCode = option.isoCode;

              // Update die Flaggen-Anzeige im Container
              const flagIcon = container.querySelector('.phone-flag-icon');
              if (flagIcon && option.isoCode) {
                flagIcon.className = `phone-flag-icon fi fi-${option.isoCode.toLowerCase()}`;
                console.log(`🚩 Flagge gesetzt: fi-${option.isoCode.toLowerCase()}`);
              }
            } else {
              input.value = option.label;
            }
          }
          
          // Event auslösen
          selectElement.dispatchEvent(new Event('change'));
        }
        
        // Dropdown schließen
        dropdown.style.display = 'none';
      });

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f3f4f6';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });

      dropdown.appendChild(item);
    });
  }

  // Searchable Select mit vorausgewähltem Wert initialisieren
  initializeSearchableSelectValue(selectElement, options, field) {
    console.log(`🔧 Initialisiere Searchable Select für ${field.name} mit vorausgewähltem Wert`);
    
    // Finde die vorausgewählte Option
    const selectedOption = options.find(opt => opt.selected);
    if (selectedOption) {
      console.log(`✅ Vorausgewählte Option gefunden: ${selectedOption.label}`);
      
      // Select-Element setzen
      selectElement.value = selectedOption.value;
      
      // Input-Element finden und setzen
      const container = selectElement.parentNode.querySelector('.searchable-select-container');
      if (container) {
        const input = container.querySelector('input');
        if (input) {
          input.value = selectedOption.label;
          console.log(`✅ Input-Wert gesetzt: ${selectedOption.label}`);
        }
      }
    }
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    this.createSearchableSelect(selectElement, options, field);
    // Vorausgewählten Wert setzen
    this.initializeSearchableSelectValue(selectElement, options, field);
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
} 