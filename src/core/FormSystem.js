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
    return this.formEvents.bindFormEvents(entity, data);
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
  async handleFormSubmit(entity, data) {
    try {
      const form = document.getElementById(`${entity}-form`);
      if (!form) return;

      // Formulardaten sammeln
      const formData = new FormData(form);
      const submitData = {};
      
      // Alle Formularfelder durchgehen (auch readonly)
      const formFields = form.querySelectorAll('input, select, textarea');
      
      for (const field of formFields) {
        const name = field.name;
        if (!name) continue;
        
        let value = '';
        
        if (field.type === 'checkbox') {
          value = field.checked ? field.value || 'true' : '';
        } else if (field.type === 'radio') {
          if (field.checked) {
            value = field.value;
          }
        } else {
          value = field.value || '';
        }
        
        // Nur nicht-leere Werte hinzufügen (außer bei readonly Feldern)
        if (value !== '' || field.readOnly) {
          submitData[name] = value;
        }
      }

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
        this.closeForm();
        
        // Event auslösen für List-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity, id: result.id, action: data ? 'updated' : 'created' } 
        }));
      } else {
        this.validator.showErrorMessage(`Fehler beim ${data ? 'Aktualisieren' : 'Erstellen'}: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Formular-Submit:', error);
      this.validator.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
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
          .map(o => ({ value: o.value, label: o.textContent }));
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

  // Einfache Auto-Suggestion Select erstellen
  createSimpleSearchableSelect(selectElement, options, field) {
    // Bestehende Container entfernen
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Container erstellen (ohne Inline-Styles)
    const container = document.createElement('div');
    container.className = 'searchable-select-container';

    // Input-Feld erstellen
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = field.placeholder || 'Suchen...';

    // Dropdown erstellen
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';

    // Original Select verstecken
    selectElement.style.display = 'none';

    // Container einfügen
    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(input);
    container.appendChild(dropdown);

    // Event-Handler
    input.addEventListener('focus', () => {
      dropdown.classList.add('show');
      this.updateDropdownItems(dropdown, options, input.value);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('show');
      }, 200);
    });

    input.addEventListener('input', () => {
      this.updateDropdownItems(dropdown, options, input.value);
    });

    // Dropdown-Items erstellen
    this.updateDropdownItems(dropdown, options, '');
  }

  // Dropdown-Items aktualisieren
  updateDropdownItems(dropdown, options, filterText) {
    dropdown.innerHTML = '';
    
    const filteredOptions = options.filter(option => 
      option.label.toLowerCase().includes(filterText.toLowerCase())
    );

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      item.textContent = option.label;

      item.addEventListener('click', () => {
        // Original Select aktualisieren
        const selectElement = dropdown.parentNode.parentNode.querySelector('select');
        selectElement.value = option.value;
        
        // Input aktualisieren
        const input = dropdown.parentNode.querySelector('input');
        input.value = option.label;
        
        // Event auslösen
        selectElement.dispatchEvent(new Event('change'));
        
        // Dropdown schließen
        dropdown.classList.remove('show');
      });

      item.addEventListener('mouseenter', () => item.classList.add('hover'));
      item.addEventListener('mouseleave', () => item.classList.remove('hover'));

      dropdown.appendChild(item);
    });
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    this.createSearchableSelect(selectElement, options, field);
  }

  // Formular-Validierung
  validateFormData(entity, data) {
    const errors = [];
    const config = this.config.getFormConfig(entity);
    
    if (!config) return errors;

    config.fields.forEach(field => {
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

// Exportiere Instanz
export const formSystem = new FormSystem();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.formSystem = formSystem;
} 