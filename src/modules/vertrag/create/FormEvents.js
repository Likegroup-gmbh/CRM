// FormEvents.js
// Event-Binding fuer Multistep-Navigation, dynamische Felder (Toggles, Kaskaden),
// Drehtage, Veroeffentlichungsplan-Synchronisation und Adressvorschau.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { KampagneUtils } from '../../kampagne/KampagneUtils.js';

VertraegeCreate.prototype.bindMultistepEvents = function() {
    const cancelBtn = document.getElementById('btn-cancel');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const languageButtons = document.querySelectorAll('[data-contract-lang]');

    // Abbrechen
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.navigateTo('/vertraege');
      });
    }

    // Draft speichern (in DB)
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', async () => {
        this.saveCurrentStepData();
        await this.saveDraftToDB();
      });
    }

    // Zurück
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.saveCurrentStepData();
        this.currentStep--;
        this.render();
      });
    }

    // Weiter
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          this.currentStep++;
          this.render();
        }
      });
    }
    
    // Submit (Vertrag erstellen)
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          await this.handleSubmit(null, false);
        }
      });
    }

    // Submit und Neu (gleiche Daten behalten)
    const submitAndNewBtn = document.getElementById('btn-submit-and-new');
    if (submitAndNewBtn) {
      submitAndNewBtn.addEventListener('click', async () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          await this.handleSubmit(null, true); // true = startNewAfter
        }
      });
    }

    if (languageButtons.length > 0) {
      languageButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.contractLang === 'en' ? 'en' : 'de';
          this.formData.vertragssprache = lang;
          languageButtons.forEach((otherBtn) => {
            otherBtn.classList.toggle('btn-active', otherBtn.dataset.contractLang === lang);
          });
        });
      });
    }

    // Dynamische Felder
    this.bindDynamicFieldEvents();
    
    // Adress-Vorschau bei Auswahl
    this.bindAddressPreviewEvents();
};


VertraegeCreate.prototype.bindDynamicFieldEvents = function() {
    const kooperationSelect = document.getElementById('kooperation_id');
    if (kooperationSelect) {
      kooperationSelect.addEventListener('change', (e) => {
        this.formData.kooperation_id = e.target.value || null;
        this.applyKooperationVerguetung(e.target.value);
      });
    }

    // Exklusivität Toggle
    const exklusivitaetCheckbox = document.getElementById('exklusivitaet');
    const exklusivitaetWrapper = document.getElementById('exklusivitaet-monate-wrapper');
    if (exklusivitaetCheckbox && exklusivitaetWrapper) {
      exklusivitaetCheckbox.addEventListener('change', (e) => {
        exklusivitaetWrapper.classList.toggle('hidden', !e.target.checked);
        this.formData.exklusivitaet = e.target.checked;
      });
    }
    // Exklusivität Monate/Einheit sofort speichern bei Eingabe
    const exklusivitaetMonateInput = document.getElementById('exklusivitaet_monate');
    if (exklusivitaetMonateInput) {
      exklusivitaetMonateInput.addEventListener('input', (e) => {
        this.formData.exklusivitaet_monate = e.target.value;
      });
    }
    const exklusivitaetEinheitSelect = document.getElementById('exklusivitaet_einheit');
    if (exklusivitaetEinheitSelect) {
      exklusivitaetEinheitSelect.addEventListener('change', (e) => {
        this.formData.exklusivitaet_einheit = e.target.value;
      });
    }

    // Nutzungsdauer Individuell Toggle (UGC Select + Influencer Radios)
    const nutzungsdauerCustomWrapper = document.getElementById('nutzungsdauer-custom-wrapper');
    const nutzungsdauerSelect = document.getElementById('nutzungsdauer');
    if (nutzungsdauerSelect && nutzungsdauerCustomWrapper) {
      nutzungsdauerSelect.addEventListener('change', (e) => {
        const isIndividuell = e.target.value === 'individuell';
        nutzungsdauerCustomWrapper.classList.toggle('hidden', !isIndividuell);
        this.formData.nutzungsdauer = e.target.value;
      });
    }
    const nutzungsdauerRadios = document.querySelectorAll('input[name="nutzungsdauer"]');
    if (nutzungsdauerRadios.length > 0 && nutzungsdauerCustomWrapper) {
      nutzungsdauerRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const isIndividuell = e.target.value === 'individuell';
          nutzungsdauerCustomWrapper.classList.toggle('hidden', !isIndividuell);
          this.formData.nutzungsdauer = e.target.value;
        });
      });
    }
    const nutzungsdauerCustomWertInput = document.getElementById('nutzungsdauer_custom_wert');
    if (nutzungsdauerCustomWertInput) {
      nutzungsdauerCustomWertInput.addEventListener('input', (e) => {
        this.formData.nutzungsdauer_custom_wert = e.target.value || null;
      });
    }
    const nutzungsdauerCustomEinheitSelect = document.getElementById('nutzungsdauer_custom_einheit');
    if (nutzungsdauerCustomEinheitSelect) {
      nutzungsdauerCustomEinheitSelect.addEventListener('change', (e) => {
        this.formData.nutzungsdauer_custom_einheit = e.target.value;
      });
    }

    // Zusatzkosten Toggle
    const zusatzkostenCheckbox = document.getElementById('zusatzkosten');
    const zusatzkostenWrapper = document.getElementById('zusatzkosten-wrapper');
    if (zusatzkostenCheckbox && zusatzkostenWrapper) {
      zusatzkostenCheckbox.addEventListener('change', (e) => {
        zusatzkostenWrapper.classList.toggle('hidden', !e.target.checked);
      });
    }

    // === INFLUENCER-SPEZIFISCHE EVENTS ===

    // Agentur-Vertretung: Radio-Toggle + Modal-Button (nur wenn Block vorhanden)
    if (document.getElementById('agentur-section-container') && typeof this._bindAgenturEvents === 'function') {
      this._bindAgenturEvents();
    }

    // Sonstige Plattform Toggle
    const plattformenCheckboxes = document.querySelectorAll('input[name="plattformen"]');
    const sonstigeWrapper = document.getElementById('plattformen-sonstige-wrapper');
    if (plattformenCheckboxes.length > 0 && sonstigeWrapper) {
      plattformenCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const sonstigeChecked = document.querySelector('input[name="plattformen"][value="sonstige"]:checked');
          sonstigeWrapper.classList.toggle('hidden', !sonstigeChecked);
        });
      });
    }

    // Reichweiten-Garantie Toggle
    const reichweitenRadios = document.querySelectorAll('input[name="reichweiten_garantie"]');
    const reichweitenWrapper = document.getElementById('reichweiten-wert-wrapper');
    if (reichweitenRadios.length > 0 && reichweitenWrapper) {
      reichweitenRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          reichweitenWrapper.classList.toggle('hidden', e.target.value !== 'true');
        });
      });
    }

    // Videos/Reels Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlReelsInput = document.getElementById('anzahl_reels');
    if (anzahlReelsInput) {
      anzahlReelsInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanVideos();
      });
    }

    // Feed-Posts Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlFeedPostsInput = document.getElementById('anzahl_feed_posts');
    if (anzahlFeedPostsInput) {
      anzahlFeedPostsInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanFeedPosts();
      });
    }

    // Story-Slides Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlStorysInput = document.getElementById('anzahl_storys');
    if (anzahlStorysInput) {
      anzahlStorysInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanStorys();
      });
    }

    // === VIDEOGRAF: DREHTAGE HINZUFÜGEN/ENTFERNEN ===
    const btnAddDrehtag = document.getElementById('btn-add-drehtag');
    if (btnAddDrehtag) {
      btnAddDrehtag.addEventListener('click', () => {
        this.addDrehtag();
      });
    }

    // Drehtag entfernen (Event Delegation)
    const produktionsplanContainer = document.getElementById('videograf-produktionsplan-container');
    if (produktionsplanContainer) {
      produktionsplanContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-drehtag')) {
          const btn = e.target.closest('.btn-remove-drehtag');
          const idx = parseInt(btn.dataset.index, 10);
          this.removeDrehtag(idx);
        }
      });
    }

    // === MODEL-SPEZIFISCHE EVENTS ===

    // Rolle "Sonstiges" Toggle
    const rolleCheckboxes = document.querySelectorAll('input[name="model_rolle"]');
    const rolleSonstigesWrapper = document.getElementById('model-rolle-sonstiges-wrapper');
    if (rolleCheckboxes.length > 0 && rolleSonstigesWrapper) {
      rolleCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const sonstigesChecked = document.querySelector('input[name="model_rolle"][value="sonstiges"]:checked');
          rolleSonstigesWrapper.classList.toggle('hidden', !sonstigesChecked);
        });
      });
    }

    // Styling "Fitting" Toggle
    const stylingRadios = document.querySelectorAll('input[name="model_styling"]');
    const fittingWrapper = document.getElementById('model-fitting-datum-wrapper');
    if (stylingRadios.length > 0 && fittingWrapper) {
      stylingRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          fittingWrapper.classList.toggle('hidden', e.target.value !== 'fitting');
        });
      });
    }

    // Territorium "beschränkt" Toggle
    const territoriumRadios = document.querySelectorAll('input[name="model_territorium"]');
    const territoriumWrapper = document.getElementById('model-territorium-beschraenkt-wrapper');
    if (territoriumRadios.length > 0 && territoriumWrapper) {
      territoriumRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          territoriumWrapper.classList.toggle('hidden', e.target.value !== 'beschraenkt');
        });
      });
    }

    // Exklusivität Dauer Toggle (Model)
    const modelExklRadios = document.querySelectorAll('input[name="model_exklusivitaet_art"]');
    const modelExklDauerWrapper = document.getElementById('model-exklusivitaet-dauer-wrapper');
    if (modelExklRadios.length > 0 && modelExklDauerWrapper) {
      modelExklRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          modelExklDauerWrapper.classList.toggle('hidden', e.target.value === 'keine');
        });
      });
    }

    // Buyout inklusiv Toggle
    const buyoutInklusivCheckbox = document.getElementById('model_buyout_inklusiv');
    const buyoutBetragWrapper = document.getElementById('model-buyout-betrag-wrapper');
    if (buyoutInklusivCheckbox && buyoutBetragWrapper) {
      buyoutInklusivCheckbox.addEventListener('change', (e) => {
        buyoutBetragWrapper.classList.toggle('hidden', e.target.checked);
      });
    }

    // Reisepauschale Toggle
    const reisekostenRadios = document.querySelectorAll('input[name="model_reisekosten"]');
    const reisepauschaleWrapper = document.getElementById('model-reisepauschale-wrapper');
    if (reisekostenRadios.length > 0 && reisepauschaleWrapper) {
      reisekostenRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          reisepauschaleWrapper.classList.toggle('hidden', e.target.value !== 'pauschale');
        });
      });
    }

    // Absage individuell Toggle
    const absageCheckboxes = document.querySelectorAll('input[name="model_absage_regelung"]');
    const absageIndividuellWrapper = document.getElementById('model-absage-individuell-wrapper');
    if (absageCheckboxes.length > 0 && absageIndividuellWrapper) {
      absageCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const individuellChecked = document.querySelector('input[name="model_absage_regelung"][value="individuell"]:checked');
          absageIndividuellWrapper.classList.toggle('hidden', !individuellChecked);
        });
      });
    }
};


VertraegeCreate.prototype.addDrehtag = function() {
    const container = document.getElementById('videograf-produktionsplan-container');
    if (!container) return;

    // Aktuelle Daten aus Formular sammeln
    this.collectProduktionsplanData();

    // Neuen leeren Eintrag hinzufügen
    if (!this.formData.videograf_produktionsplan) {
      this.formData.videograf_produktionsplan = [];
    }
    this.formData.videograf_produktionsplan.push({ datum: '', ort: '' });

    // Container neu rendern
    container.innerHTML = this.renderProduktionsplanRows();
};


VertraegeCreate.prototype.removeDrehtag = function(idx) {
    const container = document.getElementById('videograf-produktionsplan-container');
    if (!container) return;

    // Aktuelle Daten aus Formular sammeln
    this.collectProduktionsplanData();

    // Eintrag entfernen
    if (this.formData.videograf_produktionsplan && this.formData.videograf_produktionsplan.length > idx) {
      this.formData.videograf_produktionsplan.splice(idx, 1);
    }

    // Container neu rendern
    container.innerHTML = this.renderProduktionsplanRows();
};


VertraegeCreate.prototype.collectProduktionsplanData = function() {
    const rows = document.querySelectorAll('.produktionsplan-row');
    if (rows.length === 0) return;

    this.formData.videograf_produktionsplan = [];
    rows.forEach((row, index) => {
      const datumInput = document.getElementById(`drehtag_datum_${index}`);
      const ortInput = document.getElementById(`drehtag_ort_${index}`);
      
      if (datumInput && ortInput) {
        this.formData.videograf_produktionsplan.push({
          datum: datumInput.value || '',
          ort: ortInput.value || ''
        });
      }
    });
};


VertraegeCreate.prototype.addVeroeffentlichungsDatum = function(typ) {
    const list = document.getElementById(`${typ === 'videos' ? 'video' : 'story'}-dates-list`);
    if (!list) return;

    // Aktuelle Daten sammeln
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    if (!this.formData.veroeffentlichungsplan[typ]) {
      this.formData.veroeffentlichungsplan[typ] = [];
    }

    // Neues Datum (leer)
    this.formData.veroeffentlichungsplan[typ].push('');
    
    // Liste neu rendern
    list.innerHTML = this.renderVeroeffentlichungsDaten(typ, this.formData.veroeffentlichungsplan[typ]);
};


VertraegeCreate.prototype.removeVeroeffentlichungsDatum = function(typ, idx) {
    if (!this.formData.veroeffentlichungsplan || !this.formData.veroeffentlichungsplan[typ]) return;
    
    this.formData.veroeffentlichungsplan[typ].splice(idx, 1);
    
    const listIds = { 'videos': 'video-dates-list', 'feed_posts': 'feed-post-dates-list', 'storys': 'story-dates-list' };
    const list = document.getElementById(listIds[typ]);
    if (list) {
      list.innerHTML = this.renderVeroeffentlichungsDaten(typ, this.formData.veroeffentlichungsplan[typ]);
    }
};


VertraegeCreate.prototype.syncVeroeffentlichungsplanVideos = function() {
    const anzahlInput = document.getElementById('anzahl_reels');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('video-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.videos || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.videos = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('videos', newDates);
};


VertraegeCreate.prototype.syncVeroeffentlichungsplanFeedPosts = function() {
    const anzahlInput = document.getElementById('anzahl_feed_posts');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('feed-post-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.feed_posts || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.feed_posts = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('feed_posts', newDates);
};


VertraegeCreate.prototype.syncVeroeffentlichungsplanStorys = function() {
    const anzahlInput = document.getElementById('anzahl_storys');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('story-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.storys || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.storys = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('storys', newDates);
};


VertraegeCreate.prototype.bindAddressPreviewEvents = function() {
    const kundeSelect = document.getElementById('kunde_unternehmen_id');
    console.log('🔗 VERTRAG: bindAddressPreviewEvents - kundeSelect gefunden:', !!kundeSelect);

    // Kunde ändert sich → Kampagnen filtern und Searchable Select neu erstellen
    if (kundeSelect) {
      kundeSelect.addEventListener('change', async (e) => {
        console.log('🔄 VERTRAG: Kunde change Event ausgelöst');
        console.log('🔄 VERTRAG: _isInitializing:', this._isInitializing);
        
        // Ignoriere Events während der Initialisierung
        if (this._isInitializing) {
          console.log('⏭️ VERTRAG: Event ignoriert wegen _isInitializing');
          return;
        }
        
        const id = e.target.value;
        console.log('🔄 VERTRAG: Kunde ausgewählt mit ID:', id);
        this.formData.kunde_unternehmen_id = id;
        
        // Adress-Vorschau
        const kunde = this.unternehmen.find(u => u.id === id);
        const preview = document.getElementById('kunde-adresse');
        if (preview && kunde) {
          preview.innerHTML = `
            <small class="address-text">
              ${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}<br>
              ${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}
            </small>
          `;
        } else if (preview) {
          preview.innerHTML = '';
        }

        // Kampagnen filtern
        this.updateFilteredKampagnen();
        
        // PO zurücksetzen (wird über Kampagne-Auswahl neu gesetzt)
        this.formData.kunde_po_nummer = null;
        
        // Kampagne zurücksetzen
        this.formData.kampagne_id = null;
        this.formData.creator_id = null;
        this.filteredCreators = [];
        
        // Kampagne Searchable Select neu erstellen
        this.rebuildKampagneSelect(id);
        
        // Creator Searchable Select zurücksetzen
        this.rebuildCreatorSelect(false);
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
      });
    }
};

