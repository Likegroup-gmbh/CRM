// DataPersistence.js
// Datenbank-Persistierung: Draft speichern, Submit, DB-Payload, Validierung.

import { VertraegeCreate } from './VertraegeCreateCore.js';

VertraegeCreate.prototype.saveDraftToDB = async function() {
    // Erst aktuelle Formulardaten sammeln!
    this.saveCurrentStepData();
    
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const saveDraftLabel = saveDraftBtn?.querySelector('.btn-label');
    if (saveDraftBtn) {
      saveDraftBtn.disabled = true;
      if (saveDraftLabel) saveDraftLabel.textContent = 'Speichert...';
    }

    try {
      const data = this.prepareDataForDB();
      data.is_draft = true; // Als Draft markieren
      
      console.log('📤 Draft-Daten:', data); // Debug-Log

      if (this.editId) {
        // Update bestehenden Draft
        const { error } = await window.supabase
          .from('vertraege')
          .update(data)
          .eq('id', this.editId);

        if (error) throw error;
        window.toastSystem?.show('Entwurf aktualisiert!', 'success');
      } else {
        // Neuen Draft erstellen
        const { data: created, error } = await window.supabase
          .from('vertraege')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        
        // ID merken für spätere Updates
        this.editId = created.id;
        window.toastSystem?.show('Entwurf gespeichert!', 'success');
      }

      // Zur Liste navigieren
      setTimeout(() => {
        window.navigateTo('/vertraege');
      }, 500);

    } catch (error) {
      console.error('❌ Fehler beim Speichern des Drafts:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    } finally {
      if (saveDraftBtn) {
        saveDraftBtn.disabled = false;
        if (saveDraftLabel) saveDraftLabel.textContent = 'Als Entwurf speichern';
      }
    }
};


VertraegeCreate.prototype.prepareDataForDB = function() {
    const typ = this.formData.typ || this.selectedTyp;
    
    // Basis-Daten (für alle Vertragstypen)
    const data = {
      typ: typ,
      name: this.formData.name || null,
      kunde_unternehmen_id: this.formData.kunde_unternehmen_id || null,
      kampagne_id: this.formData.kampagne_id || null,
      creator_id: this.formData.creator_id || null,
      kooperation_id: this.formData.kooperation_id || null,
      anzahl_storys: parseInt(this.formData.anzahl_storys) || 0,
      medien: this.formData.medien || [],
      nutzungsdauer: this.formData.nutzungsdauer || null,
      nutzungsdauer_custom_wert: this.formData.nutzungsdauer === 'individuell' ? (parseInt(this.formData.nutzungsdauer_custom_wert, 10) || null) : null,
      nutzungsdauer_custom_einheit: this.formData.nutzungsdauer === 'individuell' ? (this.formData.nutzungsdauer_custom_einheit || null) : null,
      exklusivitaet: this.formData.exklusivitaet || false,
      exklusivitaet_monate: this.formData.exklusivitaet ? parseInt(this.formData.exklusivitaet_monate) || null : null,
      exklusivitaet_einheit: this.formData.exklusivitaet ? (this.formData.exklusivitaet_einheit || 'monate') : null,
      verguetung_netto: this.parseCurrencyInput(this.formData.verguetung_netto),
      zusatzkosten: this.formData.zusatzkosten || false,
      zusatzkosten_betrag: this.formData.zusatzkosten ? this.parseCurrencyInput(this.formData.zusatzkosten_betrag) : null,
      zahlungsziel: this.formData.zahlungsziel || null,
      skonto: this.formData.skonto === true || this.formData.skonto === 'true',
      korrekturschleifen: parseInt(this.formData.korrekturschleifen) || null,
      weitere_bestimmungen: this.formData.weitere_bestimmungen || null,
      kunde_po_nummer: this.formData.kunde_po_nummer || null,
      vertragssprache: this.getContractLanguage(this.formData)
    };

    if (typ === 'Influencer Kooperation') {
      // Influencer-spezifische Felder
      Object.assign(data, {
        // Agentur-Vertretung (strukturiert, siehe creator_agentur)
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_strasse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_strasse || null : null,
        influencer_agentur_hausnummer: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_hausnummer || null : null,
        influencer_agentur_plz: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_plz || null : null,
        influencer_agentur_stadt: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_stadt || null : null,
        influencer_agentur_land: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_land || 'Deutschland' : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        // Influencer-Daten
        influencer_land: this.formData.influencer_land || 'Deutschland',
        influencer_profile: this.formData.influencer_profile || [],
        
        // Plattformen & Inhalte
        plattformen: this.formData.plattformen || [],
        plattformen_sonstige: this.formData.plattformen_sonstige || null,
        anzahl_reels: parseInt(this.formData.anzahl_reels) || 0,
        anzahl_feed_posts: parseInt(this.formData.anzahl_feed_posts) || 0,
        
        // Veröffentlichungsplan
        veroeffentlichungsplan: this.formData.veroeffentlichungsplan || {},
        
        // Nutzungsrechte
        organische_veroeffentlichung: this.formData.organische_veroeffentlichung || null,
        media_buyout: this.formData.media_buyout || null,
        
        // Reichweite & Online-Dauer
        reichweiten_garantie: this.formData.reichweiten_garantie || false,
        reichweiten_garantie_wert: this.formData.reichweiten_garantie ? parseInt(this.formData.reichweiten_garantie_wert) || null : null,
        mindest_online_dauer: this.formData.mindest_online_dauer || null,
        
        // Anpassungen
        anpassungen: this.formData.anpassungen || []
      });
    } else if (typ === 'Videograph') {
      // Videograf-spezifische Felder
      Object.assign(data, {
        // Kunde
        kunde_rechtsform: this.formData.kunde_rechtsform || null,
        
        // Auftragnehmer-Daten (nutzt influencer_-Felder für Kompatibilität)
        influencer_steuer_id: this.formData.influencer_steuer_id || null,
        influencer_land: this.formData.influencer_land || 'Deutschland',
        
        // Leistungsumfang
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        
        // Videograf-spezifisch
        videograf_produktionsart: this.formData.videograf_produktionsart || null,
        videograf_produktionsplan: this.formData.videograf_produktionsplan || [],
        videograf_lieferumfang: this.formData.videograf_lieferumfang || [],
        videograf_v1_deadline: this.formData.videograf_v1_deadline || null,
        videograf_finale_werktage: parseInt(this.formData.videograf_finale_werktage) || 5,
        videograf_nutzungsart: this.formData.videograf_nutzungsart || []
      });
    } else if (typ === 'Model') {
      // Model-spezifische Felder
      Object.assign(data, {
        influencer_steuer_id: this.formData.influencer_steuer_id || null,
        influencer_land: this.formData.influencer_land || 'Deutschland',

        model_produktionsart: this.formData.model_produktionsart || null,
        model_shooting_von: this.formData.model_shooting_von || null,
        model_shooting_bis: this.formData.model_shooting_bis || null,
        model_call_time: this.formData.model_call_time || null,
        model_drehbeginn: this.formData.model_drehbeginn || null,
        model_produktionsende: this.formData.model_produktionsende || null,
        model_max_tagesstunden: this.formData.model_max_tagesstunden ? parseFloat(this.formData.model_max_tagesstunden) : null,
        model_einsatzort_art: this.formData.model_einsatzort_art || [],
        model_einsatzort_adresse: this.formData.model_einsatzort_adresse || null,
        model_optionstage: this.formData.model_optionstage || null,

        model_anzahl_foto_motive: parseInt(this.formData.model_anzahl_foto_motive) || 0,
        model_anzahl_video_sequenzen: parseInt(this.formData.model_anzahl_video_sequenzen) || 0,
        model_rolle: this.formData.model_rolle || [],
        model_rolle_sonstiges: (this.formData.model_rolle || []).includes('sonstiges') ? this.formData.model_rolle_sonstiges || null : null,
        model_styling: this.formData.model_styling || null,
        model_fitting_datum: this.formData.model_styling === 'fitting' ? this.formData.model_fitting_datum || null : null,

        model_nutzungsarten: this.formData.model_nutzungsarten || [],
        model_territorium: this.formData.model_territorium || null,
        model_territorium_beschraenkt: this.formData.model_territorium === 'beschraenkt' ? this.formData.model_territorium_beschraenkt || null : null,
        model_nutzungsdauer: this.formData.model_nutzungsdauer || null,
        model_nutzungsbeginn: this.formData.model_nutzungsbeginn || null,
        model_exklusivitaet_art: this.formData.model_exklusivitaet_art || 'keine',
        model_exklusivitaet_dauer: this.formData.model_exklusivitaet_art && this.formData.model_exklusivitaet_art !== 'keine' ? parseInt(this.formData.model_exklusivitaet_dauer) || null : null,
        model_ki_nutzung: this.formData.model_ki_nutzung || [],

        model_honorar_art: this.formData.model_honorar_art || null,
        model_buyout_inklusiv: this.formData.model_buyout_inklusiv === true || this.formData.model_buyout_inklusiv === 'true',
        model_buyout_betrag: !(this.formData.model_buyout_inklusiv === true || this.formData.model_buyout_inklusiv === 'true') ? this.parseCurrencyInput(this.formData.model_buyout_betrag) : null,
        model_reisekosten: this.formData.model_reisekosten || null,
        model_reisepauschale: this.formData.model_reisekosten === 'pauschale' ? this.parseCurrencyInput(this.formData.model_reisepauschale) : null,

        model_wetterabhaengig: this.formData.model_wetterabhaengig === true || this.formData.model_wetterabhaengig === 'true',
        model_absage_regelung: this.formData.model_absage_regelung || [],
        model_absage_individuell: (this.formData.model_absage_regelung || []).includes('individuell') ? this.formData.model_absage_individuell || null : null
      });
    } else {
      // UGC-spezifische Felder
      Object.assign(data, {
        // Agentur-Vertretung (strukturiert, siehe creator_agentur)
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_strasse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_strasse || null : null,
        influencer_agentur_hausnummer: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_hausnummer || null : null,
        influencer_agentur_plz: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_plz || null : null,
        influencer_agentur_stadt: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_stadt || null : null,
        influencer_agentur_land: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_land || 'Deutschland' : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        lieferung_art: this.formData.lieferung_art || null,
        rohmaterial_enthalten: this.formData.rohmaterial_enthalten || false,
        untertitel: this.formData.untertitel || false,
        nutzungsart: this.formData.nutzungsart || null,
        content_deadline: this.formData.content_deadline || null,
        abnahmedatum: this.formData.abnahmedatum || null
      });
    }

    return data;
};


VertraegeCreate.prototype.validateCurrentStep = function() {
    const form = document.getElementById('vertrag-form');
    if (!form) return true;

    // Prüfe required Felder im aktuellen Step
    const requiredFields = form.querySelectorAll('[required]');
    for (const field of requiredFields) {
      if (!field.value) {
        field.focus();
        window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
        return false;
      }
    }

    return true;
};


VertraegeCreate.prototype.saveCurrentStepData = function() {
    const form = document.getElementById('vertrag-form');
    if (!form) {
      console.log('⚠️ Kein Formular gefunden für saveCurrentStepData');
      return;
    }

    const formData = new FormData(form);
    
    // Debug: Alle FormData-Einträge loggen
    console.log('📋 FormData Einträge:', Array.from(formData.entries()));
    
    // Array-Felder die speziell behandelt werden müssen
    const arrayFields = ['medien', 'plattformen', 'anpassungen', 'videograf_lieferumfang', 'videograf_nutzungsart', 'model_einsatzort_art', 'model_rolle', 'model_nutzungsarten', 'model_ki_nutzung', 'model_absage_regelung'];
    
    // Normale Felder (Array-Felder werden separat gesammelt)
    for (const [key, value] of formData.entries()) {
      if (arrayFields.includes(key)) {
        // Array-Felder überspringen - werden unten autoritativ gesammelt
        continue;
      } else if (value === 'true') {
        this.formData[key] = true;
      } else if (value === 'false') {
        this.formData[key] = false;
      } else {
        this.formData[key] = value;
      }
    }

    // Checkboxen die nicht gecheckt sind (außer Array-Felder)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (!cb.checked && !arrayFields.includes(cb.name)) {
        this.formData[cb.name] = false;
      }
    });

    // Array-Felder: Nur neu sammeln wenn die Checkboxen im aktuellen Step vorhanden sind
    // Ansonsten vorherige Werte beibehalten
    arrayFields.forEach(fieldName => {
      const checkboxesForField = form.querySelectorAll(`input[name="${fieldName}"]`);
      if (checkboxesForField.length > 0) {
        this.formData[fieldName] = [];
        checkboxesForField.forEach(cb => {
          if (cb.checked) {
            this.formData[fieldName].push(cb.value);
          }
        });
      }
      // Wenn keine Checkboxen im DOM: vorherige Werte bleiben erhalten
    });

    // Veröffentlichungsplan: Daten aus Date-Inputs sammeln
    const videoDates = form.querySelectorAll('input[name^="videos_date_"]');
    const feedPostDates = form.querySelectorAll('input[name^="feed_posts_date_"]');
    const storyDates = form.querySelectorAll('input[name^="storys_date_"]');
    
    if (videoDates.length > 0 || feedPostDates.length > 0 || storyDates.length > 0) {
      if (!this.formData.veroeffentlichungsplan) {
        this.formData.veroeffentlichungsplan = {};
      }
      
      if (videoDates.length > 0) {
        this.formData.veroeffentlichungsplan.videos = Array.from(videoDates).map(input => input.value);
      }
      if (feedPostDates.length > 0) {
        this.formData.veroeffentlichungsplan.feed_posts = Array.from(feedPostDates).map(input => input.value);
      }
      if (storyDates.length > 0) {
        this.formData.veroeffentlichungsplan.storys = Array.from(storyDates).map(input => input.value);
      }
    }

    // influencer_profile wird jetzt automatisch aus dem Creator-Profil übernommen (via _applyCreatorProfiles)

    // Videograf-Produktionsplan: Drehtage & Orte sammeln
    const produktionsplanRows = form.querySelectorAll('.produktionsplan-row');
    if (produktionsplanRows.length > 0) {
      this.formData.videograf_produktionsplan = [];
      produktionsplanRows.forEach((row, index) => {
        const datumInput = form.querySelector(`#drehtag_datum_${index}`);
        const ortInput = form.querySelector(`#drehtag_ort_${index}`);
        
        if (datumInput && ortInput) {
          this.formData.videograf_produktionsplan.push({
            datum: datumInput.value || '',
            ort: ortInput.value || ''
          });
        }
      });
    }
    
    // Typ aus selectedTyp sicherstellen (falls nicht im Formular)
    if (this.selectedTyp && !this.formData.typ) {
      this.formData.typ = this.selectedTyp;
    }
    
    console.log('💾 Gesammelte formData:', this.formData);
};


VertraegeCreate.prototype.handleSubmit = async function(e, startNewAfter = false) {
    if (e) e.preventDefault();

    if (!this.validateCurrentStep()) return;
    this.saveCurrentStepData();

    // Prüfen ob Creator ausgewählt ist und keine gültige Adresse hat
    if (this.formData.creator_id) {
      const creator = this.creators.find(c => c.id === this.formData.creator_id);
      if (creator && !this.hasValidCreatorAddress(creator)) {
        window.toastSystem?.show('Der ausgewählte Creator hat keine gültige Adresse hinterlegt. Bitte zuerst Adresse im Creator-Profil ergänzen.', 'error');
        return;
      }
    }

    const submitBtn = document.getElementById('btn-submit');
    const submitAndNewBtn = document.getElementById('btn-submit-and-new');
    const isEdit = !!this.editId;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Wird finalisiert...' : 'Wird erstellt...';
    }
    if (submitAndNewBtn) {
      submitAndNewBtn.disabled = true;
    }

    try {
      const data = this.prepareDataForDB();
      data.is_draft = false; // Kein Draft mehr, finalisiert

      console.log('📤 Vertragsdaten:', data);

      let vertrag;

      if (this.editId) {
        // Update bestehenden Draft -> finalisieren
        const { data: updated, error } = await window.supabase
          .from('vertraege')
          .update(data)
          .eq('id', this.editId)
          .select()
          .single();

        if (error) throw error;
        vertrag = updated;
        console.log('✅ Draft finalisiert:', vertrag);
      } else {
        // Neuen Vertrag erstellen
        const { data: created, error } = await window.supabase
          .from('vertraege')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        vertrag = created;
        console.log('✅ Vertrag erstellt:', vertrag);
      }

      // PDF generieren
      await this.generatePDF(vertrag);

      window.toastSystem?.show(
        isEdit ? 'Vertrag finalisiert!' : 'Vertrag erfolgreich erstellt!', 
        'success'
      );
      
      if (startNewAfter) {
        // Neuen Vertrag mit gleichen Werten starten
        this.editId = null; // Wichtig: Neue ID für neuen Vertrag
        this.currentStep = 2;
        // Name wird automatisch neu generiert beim Render
        window.toastSystem?.show('Neuer Vertrag mit gleichen Werten gestartet', 'info');
        this.render();
      } else {
        // Zur Liste navigieren
        setTimeout(() => {
          window.navigateTo('/vertraege');
        }, 500);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Vertrag finalisieren & PDF generieren' : 'Vertrag erstellen & PDF generieren';
      }
      if (submitAndNewBtn) {
        submitAndNewBtn.disabled = false;
      }
    }
};

