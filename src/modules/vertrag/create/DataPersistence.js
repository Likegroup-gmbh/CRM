// DataPersistence.js
// Datenbank-Persistierung: Draft speichern, Submit, DB-Payload, Validierung.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { collectEhgFelder } from './EhgVertragGating.js';
import { missingUgcPflichtAuswahlen, normalizeKorrekturschleifen } from './pflichtAuswahlen.js';
import { splitButton } from '../../../core/components/SplitButton.js';

VertraegeCreate.prototype.saveDraftToDB = async function() {
    // Erst aktuelle Formulardaten sammeln!
    this.saveCurrentStepData();
    if (typeof this.saveVertretungAddress === 'function') {
      await this.saveVertretungAddress();
      await this.saveVertretungEmail();
    }
    
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


VertraegeCreate.prototype.validateCurrentStep = function() {
    const form = document.getElementById('vertrag-form');
    if (!form) return true;

    // Prüfe required Felder im aktuellen Step
    const requiredFields = form.querySelectorAll('[required]');
    for (const field of requiredFields) {
      if (!field.value) {
        if (field.matches('[data-pflicht-auswahl]')) {
          field.classList.add('is-invalid');
          field.parentElement?.querySelector('[data-auswahl-hinweis]')?.classList.remove('hidden');
        }
        field.focus();
        window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
        return false;
      }
    }

    return true;
};

VertraegeCreate.prototype.focusPendingAuswahl = function() {
    const fieldName = this._pendingAuswahlFocus;
    if (!fieldName) return;
    this._pendingAuswahlFocus = null;
    const field = document.getElementById(fieldName);
    if (!field) return;
    field.classList.add('is-invalid');
    field.parentElement?.querySelector('[data-auswahl-hinweis]')?.classList.remove('hidden');
    field.focus();
};

VertraegeCreate.prototype.ensureUgcPflichtAuswahlen = function() {
    if (this.selectedTyp !== 'UGC') return true;
    const missing = missingUgcPflichtAuswahlen(this.formData);
    if (missing.length === 0) return true;

    const first = missing[0];
    window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
    this._pendingAuswahlFocus = first.field;
    if (this.currentStep !== first.step) {
      this.goToStep(first.step);
      return false;
    }
    this.focusPendingAuswahl();
    return false;
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
    const arrayFields = ['medien', 'plattformen', 'anpassungen', 'videograf_lieferumfang', 'videograf_nutzungsart', 'model_einsatzort_art', 'model_rolle', 'model_nutzungsarten', 'model_ki_nutzung', 'model_absage_regelung', 'contracting_content_formate', 'contracting_buyout_plattformen', 'contracting_buyout_art', 'ehg_lieferbestandteile', 'ehg_nutzungen', 'ehg_persoenlichkeitsrechte', 'ehg_unterlagen'];
    
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

    // Radio-Gruppen ohne Auswahl auf null setzen
    const radioGroups = new Set();
    form.querySelectorAll('input[type="radio"]').forEach(r => radioGroups.add(r.name));
    radioGroups.forEach(name => {
      const checked = form.querySelector(`input[type="radio"][name="${name}"]:checked`);
      if (!checked) {
        this.formData[name] = null;
      }
    });

    if (form.querySelector('[name="korrekturschleifen"]')) {
      this.formData.korrekturschleifen = normalizeKorrekturschleifen(this.formData.korrekturschleifen);
    }

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
    if (!this.ensureUgcPflichtAuswahlen()) return;
    if (typeof this.ensureManagementVertretung === 'function') {
      const vertretungOk = await this.ensureManagementVertretung();
      if (!vertretungOk) return;
    }

    if (this.formData.creator_id) {
      const creator = this.creators.find(c => c.id === this.formData.creator_id);
      if (creator && !this.getResolvedCreatorContractAddress(creator)) {
        const msg = this.formData.nur_management_adresse
          ? 'Es ist "Nur Management-Adresse verwenden" aktiv, aber das gewaehlte Management hat keine gueltige Adresse.'
          : 'Der Creator hat keine gueltige Adresse, keine Firma mit Adresse und kein Management mit Adresse hinterlegt.';
        window.toastSystem?.show(msg, 'error');
        return;
      }
    }

    const submitBtn = document.getElementById('btn-submit');
    const splitRoot = document.querySelector(`.split-btn[data-split-config="${this.getSubmitConfigId()}"]`);
    const isEdit = !!this.editId;
    const busyLabel = isEdit ? 'Wird finalisiert...' : 'Wird erstellt...';
    const idleLabel = isEdit ? 'Finalisieren & PDF' : 'Erstellen & PDF';

    if (splitRoot) {
      splitButton.setBusy(splitRoot, true, busyLabel);
    } else if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = busyLabel;
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

      // KSK-Selbstzahler-Flag fuer die Paragraph-13-Textwahl anreichern
      // (keine Vertrags-Spalte; verguetung_netto traegt den Betrag bereits)
      if (this.formData.ksk_selbstzahler !== undefined) {
        vertrag.ksk_selbstzahler = this.formData.ksk_selbstzahler === true;
      } else if (vertrag.kooperation_id) {
        try {
          const { data: koop } = await window.supabase
            .from('kooperationen')
            .select('ksk_selbstzahler')
            .eq('id', vertrag.kooperation_id)
            .single();
          vertrag.ksk_selbstzahler = koop?.ksk_selbstzahler === true;
        } catch (_) {
          vertrag.ksk_selbstzahler = false;
        }
      }

      // PDF generieren
      vertrag._pdfTemplate = this.formData.vertrag_template || 'legacy';
      if (vertrag._pdfTemplate === 'ehg' && !vertrag.ehg_felder) {
        vertrag.ehg_felder = collectEhgFelder(this.formData, (v) => this.parseCurrencyInput(v));
      }
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
      
      if (splitRoot) {
        splitButton.setBusy(splitRoot, false, idleLabel);
      } else if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = idleLabel;
      }
    }
};

