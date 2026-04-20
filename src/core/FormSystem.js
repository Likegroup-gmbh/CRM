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
import { deleteVideoFull } from './VideoDeleteHelper.js';
import { compressImage } from './ImageCompressor.js';

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



  getKampagneTotalVideos(kampagne) {
    const newFieldsSum =
      (parseInt(kampagne?.ugc_pro_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_pro_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_video_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_video_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0);

    const legacyFieldsSum =
      (parseInt(kampagne?.ugc_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.igc_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0);

    return newFieldsSum || legacyFieldsSum || (kampagne?.videoanzahl ?? 0);
  }

  async validateKooperationVideoLimit(form, submitData, kooperationId = null) {
    try {
      if (!window.supabase) {
        return { isValid: true };
      }

      const kampagneId = submitData?.kampagne_id || form?.querySelector('[name="kampagne_id"]')?.value;
      if (!kampagneId) {
        return { isValid: true };
      }

      const desiredVideos = parseInt(submitData?.videoanzahl, 10) || 0;
      if (desiredVideos <= 0) {
        return { isValid: true };
      }

      const { data: kampagne, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('videoanzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
        .eq('id', kampagneId)
        .single();

      if (kampagneError) {
        throw kampagneError;
      }

      let koopQuery = window.supabase
        .from('kooperationen')
        .select('id, videoanzahl')
        .eq('kampagne_id', kampagneId);

      if (kooperationId) {
        koopQuery = koopQuery.neq('id', kooperationId);
      }

      const { data: existingKoops, error: koopError } = await koopQuery;
      if (koopError) {
        throw koopError;
      }

      const totalVideos = this.getKampagneTotalVideos(kampagne);
      const usedVideos = (existingKoops || []).reduce((sum, koop) => sum + (parseInt(koop.videoanzahl, 10) || 0), 0);
      const remainingVideos = Math.max(0, totalVideos - usedVideos);

      if (desiredVideos > remainingVideos) {
        return {
          isValid: false,
          message: 'Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieser Kampagne.'
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('❌ FORMSYSTEM: Fehler bei Kooperations-Video-Limit-Prüfung:', error);
      return {
        isValid: false,
        message: 'Die verfügbare Video Anzahl konnte nicht geprüft werden. Bitte erneut versuchen.'
      };
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

  // Kooperation: Videos automatisch anlegen/synchronisieren basierend auf videoanzahl
  async handleKooperationVideos(kooperationId, form) {
    try {
      if (!window.supabase) return;

      const videoanzahl = parseInt(form.querySelector('[name="videoanzahl"]')?.value || '0', 10);
      if (videoanzahl <= 0) return;

      const contentArtFallback = null;
      const isEditMode = !!form.dataset.entityId;

      const manualRows = this._collectStepperVideos(kooperationId, form);

      if (isEditMode) {
        await this._mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      } else {
        await this._createKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      }
    } catch (error) {
      console.error('❌ Fehler in handleKooperationVideos:', error);
    }
  }

  async handleKooperationTags(kooperationId, form) {
    try {
      if (!window.supabase) return;
      const hiddenInputs = form.querySelectorAll('input[name="koop_tag_ids[]"]');
      const tagIds = Array.from(hiddenInputs).map(i => i.value).filter(Boolean);
      console.log('🏷️ handleKooperationTags:', kooperationId, 'tagIds:', tagIds);

      const { error: delError } = await window.supabase
        .from('kooperation_tags')
        .delete()
        .eq('kooperation_id', kooperationId);
      if (delError) console.error('❌ Fehler beim Löschen alter Koop-Tags:', delError);

      if (tagIds.length > 0) {
        const rows = tagIds.map(id => ({ kooperation_id: kooperationId, tag_id: id }));
        const { error } = await window.supabase
          .from('kooperation_tags')
          .upsert(rows, { onConflict: 'kooperation_id,tag_id', ignoreDuplicates: true });
        if (error) throw error;
        console.log('✅ Koop-Tags gespeichert:', tagIds.length);
      }
    } catch (error) {
      console.error('❌ Fehler in handleKooperationTags:', error);
    }
  }

  // Stepper-Daten aus dem Formular auslesen
  _collectStepperVideos(kooperationId, form) {
    const list = form.querySelector('.videos-list');
    if (!list) return [];

    return Array.from(list.querySelectorAll('.video-item')).map((el, idx) => {
      const id = el.getAttribute('data-video-id');
      const contentArt = form.querySelector(`select[name="video_content_art_${id}"]`)?.value || null;
      const kampagnenart = form.querySelector(`select[name="video_kampagnenart_${id}"]`)?.value || null;
      const ekRaw = form.querySelector(`input[name="video_ek_netto_${id}"]`)?.value;
      const einkaufspreis = (ekRaw !== null && ekRaw !== undefined && ekRaw !== '') ? parseFloat(ekRaw) : 0;
      const vkRaw = form.querySelector(`input[name="video_vk_netto_${id}"]`)?.value;
      const verkaufspreis = (vkRaw !== null && vkRaw !== undefined && vkRaw !== '') ? parseFloat(vkRaw) : 0;
      return {
        kooperation_id: kooperationId,
        content_art: contentArt,
        kampagnenart: kampagnenart,
        einkaufspreis_netto: einkaufspreis,
        verkaufspreis_netto: verkaufspreis,
        position: idx + 1
      };
    });
  }

  // Create-Mode: Alle Videos frisch anlegen
  async _createKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback) {
    const rows = [];
    for (let i = 0; i < videoanzahl; i++) {
      const manual = manualRows[i];
      rows.push({
        kooperation_id: kooperationId,
        content_art: manual?.content_art || contentArtFallback,
        kampagnenart: manual?.kampagnenart || null,
        einkaufspreis_netto: manual?.einkaufspreis_netto || 0,
        verkaufspreis_netto: manual?.verkaufspreis_netto || 0,
        titel: null,
        asset_url: null,
        kommentar: null,
        position: i + 1
      });
    }

    const { data: inserted, error } = await window.supabase
      .from('kooperation_videos')
      .insert(rows)
      .select('id, content_art, position');

    if (error) {
      console.error('❌ Fehler beim Erstellen der Videos:', error);
    } else {
      console.log(`✅ ${inserted?.length || 0} Videos für Kooperation ${kooperationId} erstellt`);
    }
  }

  // Edit-Mode: Smart-Merge -- bestehende Videos erhalten, fehlende hinzufügen, überzählige entfernen
  async _mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback) {
    const { data: existing, error: loadErr } = await window.supabase
      .from('kooperation_videos')
      .select('id, position, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto')
      .eq('kooperation_id', kooperationId)
      .order('position', { ascending: true });

    if (loadErr) {
      console.error('❌ Fehler beim Laden bestehender Videos:', loadErr);
      return;
    }

    const existingVideos = existing || [];
    const currentCount = existingVideos.length;

    // Bestehende Videos mit Stepper-Daten updaten
    const updatePromises = existingVideos.slice(0, videoanzahl).map((video, idx) => {
      const manual = manualRows[idx];
      if (!manual) return null;

      const updates = {};
      if (manual.content_art) updates.content_art = manual.content_art;
      if (manual.kampagnenart) updates.kampagnenart = manual.kampagnenart;
      if (manual.einkaufspreis_netto > 0) updates.einkaufspreis_netto = manual.einkaufspreis_netto;
      if (manual.verkaufspreis_netto > 0) updates.verkaufspreis_netto = manual.verkaufspreis_netto;
      updates.position = idx + 1;

      if (Object.keys(updates).length === 1 && updates.position === video.position) return null;

      return window.supabase
        .from('kooperation_videos')
        .update(updates)
        .eq('id', video.id);
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ ${updatePromises.length} bestehende Videos aktualisiert`);
    }

    if (currentCount > videoanzahl) {
      const toRemove = existingVideos.slice(videoanzahl).map(v => v.id);
      const results = await Promise.allSettled(
        toRemove.map(id => deleteVideoFull(id))
      );
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success));
      if (failed.length > 0) {
        console.error(`❌ ${failed.length} von ${toRemove.length} Videos konnten nicht vollständig gelöscht werden`);
      } else {
        console.log(`✅ ${toRemove.length} überzählige Videos entfernt (inkl. Dropbox + Assets)`);
      }
    }

    // Fehlende Videos hinzufügen
    if (videoanzahl > currentCount) {
      const newRows = [];
      for (let i = currentCount; i < videoanzahl; i++) {
        const manual = manualRows[i];
        newRows.push({
          kooperation_id: kooperationId,
          content_art: manual?.content_art || contentArtFallback,
          kampagnenart: manual?.kampagnenart || null,
          einkaufspreis_netto: manual?.einkaufspreis_netto || 0,
          verkaufspreis_netto: manual?.verkaufspreis_netto || 0,
          titel: null,
          asset_url: null,
          kommentar: null,
          position: i + 1
        });
      }

      const { error: insErr } = await window.supabase
        .from('kooperation_videos')
        .insert(newRows)
        .select('id, content_art, position');

      if (insErr) {
        console.error('❌ Fehler beim Hinzufügen neuer Videos:', insErr);
      } else {
        console.log(`✅ ${newRows.length} neue Videos hinzugefügt (Position ${currentCount + 1}-${videoanzahl})`);
      }
    }
  }

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
    
    searchableSelects.forEach(select => {
      // WICHTIG: Phone-Fields überspringen - diese werden bereits in loadPhoneFieldCountries 
      // mit korrektem Default (Deutschland) und Prefix-Logik initialisiert
      if (select.dataset.phoneField === 'true') {
        console.log(`⏭️ Überspringe Phone-Field ${select.name} - bereits initialisiert`);
        return;
      }
      
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

    // Prüfe ob es ein Phone-Field oder Country-Field ist
    const isPhoneField = selectElement.dataset.phoneField === 'true';
    const isCountryField = selectElement.dataset.countryField === 'true';
    
    // Prüfe ob das Feld readonly ist (data-readonly="true" oder disabled)
    const isReadonly = selectElement.getAttribute('data-readonly') === 'true' || 
                       selectElement.disabled || 
                       field.readonly === true;

    // Container erstellen (ohne Inline-Styles)
    const container = document.createElement('div');
    container.className = 'searchable-select-container';

    // Input-Feld erstellen
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input' + (isReadonly ? ' is-disabled' : '');
    input.placeholder = field.placeholder || 'Suchen...';
    // Browser-Autocomplete komplett deaktivieren (mehrere Methoden kombiniert)
    input.autocomplete = 'new-password'; // Trick: Browser denken es ist ein Passwort-Feld
    input.setAttribute('data-form-type', 'other');
    input.setAttribute('data-lpignore', 'true'); // LastPass ignorieren
    input.setAttribute('readonly', 'readonly'); // Initial readonly
    
    // Für readonly-Felder: dauerhaft disabled setzen
    if (isReadonly) {
      input.setAttribute('disabled', 'true');
      input.setAttribute('data-is-readonly', 'true');
    }
    
    // Readonly nach kurzer Verzögerung entfernen (verhindert Autocomplete) - NUR wenn nicht readonly
    if (!isReadonly) {
      setTimeout(() => {
        input.removeAttribute('readonly');
      }, 100);
    }

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
    
    // Original-Select Name wird NICHT entfernt (wird für DependentFields benötigt)
    // Stattdessen wird in collectSubmitData der Hidden Input bevorzugt
    
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
      // Für Phone-Fields: Flagge + Vorwahl + Ländername anzeigen
      if (isPhoneField && selectedOption.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(selectedOption.isoCode);
        const vorwahl = selectedOption.vorwahl || '';
        const countryName = selectedOption.label.replace(/^\+\d+\s*/, '').trim();
        input.value = `${flagEmoji} ${vorwahl} ${countryName}`.trim();
      } else if (isCountryField && selectedOption.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(selectedOption.isoCode);
        input.value = `${flagEmoji} ${selectedOption.label}`.trim();
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

    // Event-Handler (nur wenn nicht readonly)
    input.addEventListener('focus', () => {
      // Readonly-Felder: Keine Dropdown-Interaktion erlauben
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }
      
      // Dropdown erst anzeigen
      dropdown.classList.add('show');
      
      // Für Phone-Fields: Wenn nur Placeholder-Text drin ist, leeren
      if (isPhoneField && input.placeholder && input.value === input.placeholder) {
        input.value = '';
      }
      
      this.updateDropdownItems(dropdown, options, input.value, field);
      
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
      // Readonly-Felder: Keine Eingabe erlauben
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }
      
      this.updateDropdownItems(dropdown, options, input.value, field);
      
      // Custom Validierung für required Felder
      if (input.hasAttribute('data-was-required')) {
        if (input.value.trim() === '') {
          input.setCustomValidity('Dieses Feld ist erforderlich.');
        } else {
          input.setCustomValidity('');
        }
      }
    });

    // Enter-Handler für allowCreate Feature
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        
        const cleanFilterText = input.value.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
        
        // Prüfe ob exakter Match existiert
        const exactMatch = options.find(opt => 
          opt.label.toLowerCase() === cleanFilterText.toLowerCase()
        );
        
        if (exactMatch) {
          // Existierende Option auswählen
          selectElement.value = exactMatch.value;
          input.value = exactMatch.label;
          if (hiddenInput) {
            hiddenInput.value = exactMatch.value;
          }
          if (input.hasAttribute('data-was-required')) {
            input.setCustomValidity('');
          }
          selectElement.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.classList.remove('show');
          console.log(`✅ Existierende Option per Enter ausgewählt: ${exactMatch.label}`);
        } else if (field?.allowCreate && cleanFilterText.length > 0) {
          // Neue Option erstellen
          await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
        }
      }
    });

    // Dropdown-Items erstellen
    this.updateDropdownItems(dropdown, options, '', field);
  }

  // Dropdown-Items aktualisieren
  updateDropdownItems(dropdown, options, filterText, field = null) {
    dropdown.innerHTML = '';
    
    // Filter ignoriert Flag-Emojis
    const cleanFilterText = filterText.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    
    const filteredOptions = options.filter(option => 
      option.label.toLowerCase().includes(cleanFilterText.toLowerCase())
    );

    // Prüfe ob es ein Phone-Field oder Country-Field ist
    const selectElement = dropdown.parentNode.parentNode.querySelector('select');
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';
    const isCountryField = selectElement?.dataset?.countryField === 'true';

    // Prüfe ob exakter Match existiert (case-insensitive)
    const exactMatch = options.some(opt => 
      opt.label.toLowerCase() === cleanFilterText.toLowerCase()
    );

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      
      // Spezielle Behandlung für Phone-Fields und Country-Fields mit Flag-Emojis
      if ((isPhoneField || isCountryField) && option.isoCode) {
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
        
        // Für Phone-Fields: Flagge + Vorwahl + Ländername anzeigen
        if (isPhoneField && option.isoCode) {
          const flagEmoji = this.isoToFlagEmoji(option.isoCode);
          const vorwahl = option.vorwahl || '';
          const countryName = option.label.replace(/^\+\d+\s*/, '').trim();
          input.value = `${flagEmoji} ${vorwahl} ${countryName}`.trim();
        } else if (isCountryField && option.isoCode) {
          const flagEmoji = this.isoToFlagEmoji(option.isoCode);
          input.value = `${flagEmoji} ${option.label}`.trim();
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

    // "Neu erstellen" Option anzeigen wenn allowCreate und kein exakter Match
    if (field?.allowCreate && cleanFilterText.length > 0 && !exactMatch) {
      const createItem = document.createElement('div');
      createItem.className = 'searchable-select-item create-new';
      createItem.innerHTML = `<span class="create-new-icon">+</span> Neu erstellen: <strong>${cleanFilterText}</strong>`;
      
      createItem.addEventListener('click', async () => {
        await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
      });
      
      createItem.addEventListener('mouseenter', () => createItem.classList.add('hover'));
      createItem.addEventListener('mouseleave', () => createItem.classList.remove('hover'));
      
      dropdown.appendChild(createItem);
    }
  }

  // Neue Option erstellen und auswählen (für allowCreate Feature)
  async handleCreateNewOption(dropdown, options, newValue, field) {
    try {
      // In DB speichern
      const newEntry = await this.createLookupEntry(field.table, field.displayField, newValue);
      
      // Neue Option erstellen
      const newOption = {
        value: newEntry[field.valueField],
        label: newEntry[field.displayField],
        selected: false
      };
      
      // Zur Options-Liste hinzufügen
      options.push(newOption);
      
      // Select-Element und Input finden
      const selectElement = dropdown.parentNode.parentNode.querySelector('select');
      const input = dropdown.parentNode.querySelector('.searchable-select-input');
      const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');
      
      // Neue Option zum Select hinzufügen
      const optionElement = document.createElement('option');
      optionElement.value = newOption.value;
      optionElement.textContent = newOption.label;
      selectElement.appendChild(optionElement);
      
      // Auswählen
      selectElement.value = newOption.value;
      input.value = newOption.label;
      if (hiddenInput) {
        hiddenInput.value = newOption.value;
      }
      
      // Custom Validierung für required Felder
      if (input.hasAttribute('data-was-required')) {
        input.setCustomValidity('');
      }
      
      // Event auslösen
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Dropdown schließen
      dropdown.classList.remove('show');
      
      // Cache invalidieren (für zukünftige Formular-Öffnungen)
      if (window.staticDataCache) {
        window.staticDataCache.invalidate(field.table);
        console.log(`🗑️ Cache invalidiert für ${field.table}`);
      }
      
      console.log(`✅ Neue Option erstellt und ausgewählt: ${newOption.label} → ${newOption.value}`);
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der neuen Option:', error);
      alert(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
    }
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    // WICHTIG: Ursprüngliches Select ausgeblendet lassen
    // Das verhindert doppelte Input-Felder bei Reinitialisierung
    selectElement.style.display = 'none';
    
    this.createSearchableSelect(selectElement, options, field);
  }

  // Neuen Lookup-Eintrag in DB erstellen (für allowCreate Feature)
  async createLookupEntry(table, displayField, value) {
    console.log(`🆕 Erstelle neuen Eintrag in ${table}: ${value}`);
    
    try {
      const { data, error } = await window.supabase
        .from(table)
        .insert({ [displayField]: value })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Fehler beim Erstellen in ${table}:`, error);
        throw error;
      }
      
      console.log(`✅ Neuer Eintrag erstellt:`, data);
      return data;
    } catch (err) {
      console.error(`❌ createLookupEntry fehlgeschlagen:`, err);
      throw err;
    }
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

  // Profilbild-Upload für Ansprechpartner
  async handleAnsprechpartnerProfileImage(ansprechpartnerId, form) {
    try {
      console.log('📋 handleAnsprechpartnerProfileImage() aufgerufen für:', ansprechpartnerId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="profile_image_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Profilbild zum Hochladen');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      let file = files[0];
      const bucket = 'ansprechpartner-images';
      
      // Validierung: Dateityp (vor Komprimierung)
      const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
      
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.type}`);
        alert(`Nur PNG, JPG und WebP Dateien sind erlaubt`);
        return;
      }

      // WebP-Komprimierung
      try {
        const originalSize = file.size;
        file = await compressImage(file);
        console.log(`🖼️ Profilbild komprimiert: ${Math.round(originalSize / 1024)}KB → ${Math.round(file.size / 1024)}KB (WebP)`);
      } catch (compressError) {
        console.warn('⚠️ Komprimierung fehlgeschlagen, nutze Original:', compressError);
      }

      // Validierung: Dateigröße (nach Komprimierung)
      const MAX_FILE_SIZE = 500 * 1024; // 500 KB
      
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Profilbild zu groß: ${(file.size / 1024).toFixed(2)} KB`);
        alert(`Profilbild ist zu groß (max. 500 KB)`);
        return;
      }

      const path = `${ansprechpartnerId}/profile.webp`;
      
      console.log(`📤 Uploading Profilbild: ${file.name} -> ${path}`);
      
      // Altes Bild löschen
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(ansprechpartnerId);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`${ansprechpartnerId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Profilbilder:', deleteErr);
      }
      
      // Upload
      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp'
        });
      
      if (upErr) {
        console.error(`❌ Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const profile_image_url = publicUrlData?.publicUrl || '';
      
      // DB aktualisieren
      const { error: dbErr } = await window.supabase
        .from('ansprechpartner')
        .update({
          profile_image_url,
          profile_image_path: path
        })
        .eq('id', ansprechpartnerId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Profilbild erfolgreich hochgeladen: ${profile_image_url}`);
    } catch (error) {
      console.error('❌ Profilbild-Upload fehlgeschlagen:', error);
      // Nicht werfen - Update war erfolgreich
    }
  }

  async handleRechnungFiles(rechnungId, form) {
    if (!window.supabase || !rechnungId) return;

    try {
      // --- Belege ---
      const belegeUploader = form.querySelector('.uploader[data-name="belege_files"]')?.__uploaderInstance;
      if (belegeUploader) {
        // Gelöschte Belege entfernen
        const deletedIds = belegeUploader.getDeletedFileIds().filter(id => id !== 'pdf');
        for (const belegId of deletedIds) {
          try {
            const { data: row } = await window.supabase
              .from('rechnung_belege')
              .select('file_path')
              .eq('id', belegId)
              .single();
            if (row?.file_path) {
              await window.supabase.storage.from('rechnung-belege').remove([row.file_path]);
            }
            await window.supabase.from('rechnung_belege').delete().eq('id', belegId);
          } catch (err) {
            console.warn('⚠️ Fehler beim Löschen eines Belegs:', err?.message);
          }
        }

        // Neue Belege hochladen
        const newFiles = belegeUploader.files || [];
        for (const file of newFiles) {
          const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '_')
            .substring(0, 200);
          const belegePath = `${rechnungId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitizedName}`;
          const { error: upErr } = await window.supabase.storage.from('rechnung-belege').upload(belegePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });
          if (upErr) {
            console.warn('⚠️ Beleg-Upload fehlgeschlagen:', upErr.message);
            continue;
          }
          const { data: urlData } = window.supabase.storage.from('rechnung-belege').getPublicUrl(belegePath);
          await window.supabase.from('rechnung_belege').insert({
            rechnung_id: rechnungId,
            file_name: file.name,
            file_path: belegePath,
            file_url: urlData?.publicUrl || '',
            content_type: file.type,
            size: file.size,
            uploaded_by: window.currentUser?.id || null
          });
        }
      }

      // --- PDF ---
      const pdfUploader = form.querySelector('.uploader[data-name="pdf_file"]')?.__uploaderInstance;
      if (pdfUploader) {
        const pdfDeleted = pdfUploader.getDeletedFileIds().includes('pdf');
        const hasNewPdf = pdfUploader.files && pdfUploader.files.length > 0;

        // Bestehende PDF löschen (wenn markiert oder neue hochgeladen wird)
        if (pdfDeleted || hasNewPdf) {
          const { data: rechnung } = await window.supabase
            .from('rechnung')
            .select('pdf_path')
            .eq('id', rechnungId)
            .single();
          if (rechnung?.pdf_path) {
            await window.supabase.storage.from('rechnungen').remove([rechnung.pdf_path]);
          }
          if (!hasNewPdf) {
            await window.supabase.from('rechnung').update({ pdf_url: null, pdf_path: null }).eq('id', rechnungId);
          }
        }

        // Neue PDF hochladen
        if (hasNewPdf) {
          const file = pdfUploader.files[0];
          const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '_')
            .substring(0, 200);
          const { data: rechnungRow } = await window.supabase
            .from('rechnung')
            .select('unternehmen_id')
            .eq('id', rechnungId)
            .single();
          const pdfPath = `${rechnungRow?.unternehmen_id || 'unknown'}/${Date.now()}_${sanitizedName}`;
          const { error: upErr } = await window.supabase.storage.from('rechnungen').upload(pdfPath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });
          if (!upErr) {
            const { data: urlData } = window.supabase.storage.from('rechnungen').getPublicUrl(pdfPath);
            await window.supabase.from('rechnung').update({
              pdf_url: urlData?.publicUrl || '',
              pdf_path: pdfPath
            }).eq('id', rechnungId);
          } else {
            console.warn('⚠️ PDF-Upload fehlgeschlagen:', upErr.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler bei Rechnungs-Dateien:', error);
    }
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