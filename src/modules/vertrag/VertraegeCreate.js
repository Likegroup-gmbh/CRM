// VertraegeCreate.js (ES6-Modul)
// Multistep-Formular zur Vertragserstellung (mit DB-Draft Support)

export class VertraegeCreate {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedTyp = null;
    this.formData = {};
    this.unternehmen = [];
    this.creators = [];
    this.isGenerated = false;
    this.editId = null; // ID wenn Draft bearbeitet wird
  }

  // Initialisiere Vertrags-Erstellung (oder Draft-Bearbeitung)
  async init(draftId = null) {
    this.editId = draftId;
    
    window.setHeadline(draftId ? 'Vertrag bearbeiten' : 'Neuer Vertrag');
    
    // Breadcrumb
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Verträge', url: '/vertraege', clickable: true },
        { label: draftId ? 'Bearbeiten' : 'Neuer Vertrag', url: draftId ? `/vertraege/${draftId}/edit` : '/vertraege/new', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canCreate = window.currentUser?.rolle === 'admin' || 
                      window.currentUser?.rolle === 'mitarbeiter';
    
    if (!canCreate) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge zu erstellen.</p>
        </div>
      `;
      return;
    }

    // Lade Stammdaten
    await this.loadStammdaten();
    
    // Wenn Draft-ID übergeben, lade den Draft aus der DB
    if (draftId) {
      await this.loadDraftFromDB(draftId);
    }
    
    // Rendere Formular
    this.render();
  }

  // Draft aus Datenbank laden
  async loadDraftFromDB(draftId) {
    try {
      const { data: draft, error } = await window.supabase
        .from('vertraege')
        .select('*')
        .eq('id', draftId)
        .single();

      if (error) throw error;

      if (draft) {
        this.formData = {
          typ: draft.typ,
          name: draft.name,
          kunde_unternehmen_id: draft.kunde_unternehmen_id,
          creator_id: draft.creator_id,
          anzahl_videos: draft.anzahl_videos || 0,
          anzahl_fotos: draft.anzahl_fotos || 0,
          anzahl_storys: draft.anzahl_storys || 0,
          content_erstellung_art: draft.content_erstellung_art,
          lieferung_art: draft.lieferung_art,
          rohmaterial_enthalten: draft.rohmaterial_enthalten,
          untertitel: draft.untertitel,
          nutzungsart: draft.nutzungsart,
          medien: draft.medien || [],
          nutzungsdauer: draft.nutzungsdauer,
          exklusivitaet: draft.exklusivitaet,
          exklusivitaet_monate: draft.exklusivitaet_monate,
          verguetung_netto: draft.verguetung_netto,
          zusatzkosten: draft.zusatzkosten,
          zusatzkosten_betrag: draft.zusatzkosten_betrag,
          zahlungsziel: draft.zahlungsziel,
          skonto: draft.skonto,
          content_deadline: draft.content_deadline,
          korrekturschleifen: draft.korrekturschleifen,
          abnahmedatum: draft.abnahmedatum
        };
        this.selectedTyp = draft.typ;
        this.isGenerated = true;
        this.currentStep = 2; // Start bei Schritt 2 da Typ schon gewählt
        console.log('📋 Draft aus DB geladen:', draft);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden des Drafts:', error);
      window.toastSystem?.show('Draft konnte nicht geladen werden', 'error');
    }
  }

  // Formular zurücksetzen
  resetForm() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.isGenerated = false;
    this.editId = null;
  }

  // Lade Unternehmen und Creator
  async loadStammdaten() {
    if (!window.supabase) return;

    try {
      // Lade Unternehmen
      const { data: unternehmen } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname, rechnungsadresse_strasse, rechnungsadresse_hausnummer, rechnungsadresse_plz, rechnungsadresse_stadt')
        .order('firmenname');
      
      this.unternehmen = unternehmen || [];

      // Lade Creator mit Adressen
      const { data: creators } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land')
        .order('nachname');
      
      this.creators = creators || [];

    } catch (error) {
      console.error('❌ Fehler beim Laden der Stammdaten:', error);
    }
  }

  // Hauptrender-Funktion
  render() {
    if (!this.isGenerated) {
      this.renderStep1();
    } else {
      this.renderMultistep();
    }
  }

  // Schritt 1: Vertragstyp-Auswahl
  renderStep1() {
    const html = `
      <div class="form-page">
        <div class="vertrag-typ-selection">
          <h2>Vertragstyp auswählen</h2>
          <p class="form-hint">Wählen Sie den Vertragstyp aus und klicken Sie auf "Generieren".</p>
          
          <div class="form-field" style="max-width: 400px; margin: 2rem auto;">
            <label for="vertrag-typ">Vertragstyp</label>
            <select id="vertrag-typ" class="form-select">
              <option value="">Bitte wählen...</option>
              <option value="UGC">UGC-Produktionsvertrag</option>
              <option value="Influencer Kooperation">Influencer Kooperation</option>
              <option value="Videograph">Videograph</option>
            </select>
          </div>
          
          <div class="form-actions" style="justify-content: center;">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/vertraege')">
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="button" id="btn-generate" class="primary-btn" disabled>
              Generieren
            </button>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindStep1Events();
  }

  // Events für Schritt 1
  bindStep1Events() {
    const select = document.getElementById('vertrag-typ');
    const generateBtn = document.getElementById('btn-generate');

    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedTyp = e.target.value;
        if (generateBtn) {
          generateBtn.disabled = !this.selectedTyp;
        }
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (this.selectedTyp) {
          this.isGenerated = true;
          this.currentStep = 2;
          this.formData.typ = this.selectedTyp;
          this.render();
        }
      });
    }
  }

  // Multistep-Formular rendern
  renderMultistep() {
    const stepContent = this.getStepContent();
    const isEdit = !!this.editId;
    
    const html = `
      <div class="form-page">
        <form id="vertrag-form" data-entity="vertraege">
          <!-- Progress Bar -->
          <div class="multistep-progress">
            ${this.renderProgressBar()}
          </div>

          <!-- Step Content -->
          <div class="multistep-content">
            ${stepContent}
          </div>

          <!-- Navigation -->
          <div class="form-actions">
            <div class="form-actions-left">
              <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/vertraege')">
                <span class="mdc-btn__label">Abbrechen</span>
              </button>
              <button type="button" id="btn-save-draft" class="secondary-btn" title="Als Entwurf in der Datenbank speichern">
                💾 Als Entwurf speichern
              </button>
            </div>
            
            <div class="step-navigation">
              ${this.currentStep > 2 ? `
                <button type="button" id="btn-prev" class="secondary-btn">
                  ← Zurück
                </button>
              ` : ''}
              
              ${this.currentStep < this.totalSteps ? `
                <button type="button" id="btn-next" class="primary-btn">
                  Weiter →
                </button>
              ` : `
                <div class="submit-options">
                  <button type="submit" id="btn-submit" class="primary-btn">
                    ${isEdit ? 'Vertrag finalisieren & PDF generieren' : 'Vertrag erstellen & PDF generieren'}
                  </button>
                  <button type="button" id="btn-submit-and-new" class="secondary-btn" title="Vertrag erstellen und mit gleichen Werten neuen Vertrag starten">
                    Erstellen & Neuen mit gleichen Werten
                  </button>
                </div>
              `}
            </div>
          </div>
        </form>
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindMultistepEvents();
    this.initSearchableSelects();
  }

  // Progress Bar rendern
  renderProgressBar() {
    const steps = [
      { num: 2, label: 'Parteien' },
      { num: 3, label: 'Leistung' },
      { num: 4, label: 'Nutzung' },
      { num: 5, label: 'Vergütung' }
    ];

    return `
      <div class="progress-steps">
        ${steps.map(step => `
          <div class="progress-step ${this.currentStep >= step.num ? 'active' : ''} ${this.currentStep === step.num ? 'current' : ''}">
            <div class="step-number">${step.num - 1}</div>
            <div class="step-label">${step.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Step Content basierend auf aktuellem Schritt
  getStepContent() {
    switch (this.currentStep) {
      case 2: return this.renderStep2();
      case 3: return this.renderStep3();
      case 4: return this.renderStep4();
      case 5: return this.renderStep5();
      default: return '';
    }
  }

  // Schritt 2: Vertragsparteien
  renderStep2() {
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>${this.selectedTyp}</strong></p>
        
        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="kunde_unternehmen_id">Kunde (Unternehmen) <span class="required">*</span></label>
            <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
              <option value="">Unternehmen auswählen...</option>
              ${this.unternehmen.map(u => `
                <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                  ${u.firmenname}
                </option>
              `).join('')}
            </select>
            <div id="kunde-adresse" class="address-preview"></div>
          </div>

          <div class="form-field form-field--half">
            <label for="creator_id">Creator <span class="required">*</span></label>
            <select id="creator_id" name="creator_id" required data-searchable="true">
              <option value="">Creator auswählen...</option>
              ${this.creators.map(c => `
                <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                  ${c.vorname} ${c.nachname}
                </option>
              `).join('')}
            </select>
            <div id="creator-adresse" class="address-preview"></div>
          </div>
        </div>

        <div class="form-field">
          <label for="name">Vertragsname <span class="required">*</span></label>
          <input type="text" id="name" name="name" required 
                 value="${this.formData.name || ''}"
                 placeholder="z.B. UGC Vertrag - Marke XY - Creator Name">
        </div>
      </div>
    `;
  }

  // Schritt 3: Leistungsumfang
  renderStep3() {
    return `
      <div class="step-section">
        <h3>§2 Leistungsumfang</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="anzahl_videos">Anzahl Videos</label>
            <input type="number" id="anzahl_videos" name="anzahl_videos" min="0" 
                   value="${this.formData.anzahl_videos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_fotos">Anzahl Fotos</label>
            <input type="number" id="anzahl_fotos" name="anzahl_fotos" min="0" 
                   value="${this.formData.anzahl_fotos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_storys">Anzahl Storys</label>
            <input type="number" id="anzahl_storys" name="anzahl_storys" min="0" 
                   value="${this.formData.anzahl_storys || 0}">
          </div>
        </div>

        <div class="form-field">
          <label>Art der Content-Erstellung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="skript_fertig" 
                     ${this.formData.content_erstellung_art === 'skript_fertig' ? 'checked' : ''}>
              <span>Fertiges Skript vom Auftraggeber</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_direkt" 
                     ${this.formData.content_erstellung_art === 'briefing_direkt' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, direkter Dreh ohne Skript</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_skript" 
                     ${this.formData.content_erstellung_art === 'briefing_skript' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, Skript durch Creator</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="eigenstaendig" 
                     ${this.formData.content_erstellung_art === 'eigenstaendig' ? 'checked' : ''}>
              <span>Eigenständige Konzeption durch Creator</span>
            </label>
          </div>
        </div>

        <h3>§3 Output & Lieferumfang</h3>
        
        <div class="form-field">
          <label>Art der Lieferung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="fertig_geschnitten" 
                     ${this.formData.lieferung_art === 'fertig_geschnitten' ? 'checked' : ''}>
              <span>Fertig geschnittenes Video</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="raw_cut" 
                     ${this.formData.lieferung_art === 'raw_cut' ? 'checked' : ''}>
              <span>Raw Cut (Szenen aneinandergeschnitten, ohne Feinschnitt)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="rohmaterial" 
                     ${this.formData.lieferung_art === 'rohmaterial' ? 'checked' : ''}>
              <span>Rohmaterial (ungeschnittene Clips)</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="rohmaterial_enthalten" value="true"
                     ${this.formData.rohmaterial_enthalten ? 'checked' : ''}>
              <span>Rohmaterial enthalten</span>
            </label>
          </div>
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="untertitel" value="true"
                     ${this.formData.untertitel ? 'checked' : ''}>
              <span>Untertitel</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  // Schritt 4: Nutzungsrechte
  renderStep4() {
    return `
      <div class="step-section">
        <h3>§4 Nutzungsrechte</h3>
        
        <div class="form-field">
          <label>Nutzungsart</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="organisch" 
                     ${this.formData.nutzungsart === 'organisch' ? 'checked' : ''}>
              <span>Organische Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="paid" 
                     ${this.formData.nutzungsart === 'paid' ? 'checked' : ''}>
              <span>Paid Ads Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="beides" 
                     ${this.formData.nutzungsart === 'beides' ? 'checked' : ''}>
              <span>Organisch & Paid Ads</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label>Medien</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="social_media"
                     ${(this.formData.medien || []).includes('social_media') ? 'checked' : ''}>
              <span>Social Media</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="website"
                     ${(this.formData.medien || []).includes('website') ? 'checked' : ''}>
              <span>Website</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="otv"
                     ${(this.formData.medien || []).includes('otv') ? 'checked' : ''}>
              <span>OTV</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label for="nutzungsdauer">Nutzungsdauer</label>
          <select id="nutzungsdauer" name="nutzungsdauer">
            <option value="">Bitte wählen...</option>
            <option value="unbegrenzt" ${this.formData.nutzungsdauer === 'unbegrenzt' ? 'selected' : ''}>Unbegrenzt</option>
            <option value="12_monate" ${this.formData.nutzungsdauer === '12_monate' ? 'selected' : ''}>12 Monate</option>
            <option value="6_monate" ${this.formData.nutzungsdauer === '6_monate' ? 'selected' : ''}>6 Monate</option>
            <option value="3_monate" ${this.formData.nutzungsdauer === '3_monate' ? 'selected' : ''}>3 Monate</option>
          </select>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="exklusivitaet" name="exklusivitaet" value="true"
                     ${this.formData.exklusivitaet ? 'checked' : ''}>
              <span>Exklusivität</span>
            </label>
          </div>
          <div class="form-field" id="exklusivitaet-monate-wrapper" style="${this.formData.exklusivitaet ? '' : 'display: none;'}">
            <label for="exklusivitaet_monate">Exklusivität Monate</label>
            <input type="number" id="exklusivitaet_monate" name="exklusivitaet_monate" min="1" max="24"
                   value="${this.formData.exklusivitaet_monate || ''}">
          </div>
        </div>
      </div>
    `;
  }

  // Schritt 5: Vergütung und Deadlines
  renderStep5() {
    return `
      <div class="step-section">
        <h3>§5 Vergütung</h3>
        
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto" 
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label for="zahlungsziel">Zahlungsziel</label>
            <select id="zahlungsziel" name="zahlungsziel">
              <option value="">Bitte wählen...</option>
              <option value="30_tage" ${this.formData.zahlungsziel === '30_tage' ? 'selected' : ''}>30 Tage</option>
              <option value="60_tage" ${this.formData.zahlungsziel === '60_tage' ? 'selected' : ''}>60 Tage</option>
            </select>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart</span>
            </label>
          </div>
          <div class="form-field" id="zusatzkosten-wrapper" style="${this.formData.zusatzkosten ? '' : 'display: none;'}">
            <label for="zusatzkosten_betrag">Zusatzkosten (netto)</label>
            <div class="input-with-suffix">
              <input type="number" id="zusatzkosten_betrag" name="zusatzkosten_betrag" 
                     step="0.01" min="0"
                     value="${this.formData.zusatzkosten_betrag || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" name="skonto" value="true"
                   ${this.formData.skonto ? 'checked' : ''}>
            <span>Skonto (3% bei Zahlung innerhalb von 7 Tagen)</span>
          </label>
        </div>

        <h3>§6 Deadlines & Korrekturen</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="content_deadline">Content-Deadline</label>
            <input type="date" id="content_deadline" name="content_deadline"
                   value="${this.formData.content_deadline || ''}">
          </div>
          <div class="form-field">
            <label for="korrekturschleifen">Korrekturschleifen</label>
            <select id="korrekturschleifen" name="korrekturschleifen">
              <option value="">Bitte wählen...</option>
              <option value="1" ${this.formData.korrekturschleifen === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${this.formData.korrekturschleifen === 2 ? 'selected' : ''}>2</option>
            </select>
          </div>
          <div class="form-field">
            <label for="abnahmedatum">Abnahmedatum</label>
            <input type="date" id="abnahmedatum" name="abnahmedatum"
                   value="${this.formData.abnahmedatum || ''}">
          </div>
        </div>
      </div>
    `;
  }

  // Events für Multistep
  bindMultistepEvents() {
    const form = document.getElementById('vertrag-form');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');
    const submitAndNewBtn = document.getElementById('btn-submit-and-new');
    const saveDraftBtn = document.getElementById('btn-save-draft');

    // Draft speichern (in DB)
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', async () => {
        this.saveCurrentStepData();
        await this.saveDraftToDB();
      });
    }

    // Erstellen & Neuen mit gleichen Werten
    if (submitAndNewBtn) {
      submitAndNewBtn.addEventListener('click', async () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          await this.handleSubmit(null, true); // true = startNewAfter
        }
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

    // Submit
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Dynamische Felder
    this.bindDynamicFieldEvents();
    
    // Adress-Vorschau bei Auswahl
    this.bindAddressPreviewEvents();
  }

  // Draft in Datenbank speichern
  async saveDraftToDB() {
    // Erst aktuelle Formulardaten sammeln!
    this.saveCurrentStepData();
    
    const saveDraftBtn = document.getElementById('btn-save-draft');
    if (saveDraftBtn) {
      saveDraftBtn.disabled = true;
      saveDraftBtn.textContent = '💾 Speichert...';
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
        saveDraftBtn.textContent = '💾 Als Entwurf speichern';
      }
    }
  }

  // Daten für DB vorbereiten
  prepareDataForDB() {
    return {
      typ: this.formData.typ || this.selectedTyp,
      name: this.formData.name || null,
      kunde_unternehmen_id: this.formData.kunde_unternehmen_id || null,
      creator_id: this.formData.creator_id || null,
      anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
      anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
      anzahl_storys: parseInt(this.formData.anzahl_storys) || 0,
      content_erstellung_art: this.formData.content_erstellung_art || null,
      lieferung_art: this.formData.lieferung_art || null,
      rohmaterial_enthalten: this.formData.rohmaterial_enthalten || false,
      untertitel: this.formData.untertitel || false,
      nutzungsart: this.formData.nutzungsart || null,
      medien: this.formData.medien || [],
      nutzungsdauer: this.formData.nutzungsdauer || null,
      exklusivitaet: this.formData.exklusivitaet || false,
      exklusivitaet_monate: this.formData.exklusivitaet ? parseInt(this.formData.exklusivitaet_monate) || null : null,
      verguetung_netto: parseFloat(this.formData.verguetung_netto) || null,
      zusatzkosten: this.formData.zusatzkosten || false,
      zusatzkosten_betrag: this.formData.zusatzkosten ? parseFloat(this.formData.zusatzkosten_betrag) || null : null,
      zahlungsziel: this.formData.zahlungsziel || null,
      skonto: this.formData.skonto || false,
      content_deadline: this.formData.content_deadline || null,
      korrekturschleifen: parseInt(this.formData.korrekturschleifen) || null,
      abnahmedatum: this.formData.abnahmedatum || null
    };
  }

  // Dynamische Feld-Events (Exklusivität, Zusatzkosten Toggle)
  bindDynamicFieldEvents() {
    // Exklusivität Toggle
    const exklusivitaetCheckbox = document.getElementById('exklusivitaet');
    const exklusivitaetWrapper = document.getElementById('exklusivitaet-monate-wrapper');
    if (exklusivitaetCheckbox && exklusivitaetWrapper) {
      exklusivitaetCheckbox.addEventListener('change', (e) => {
        exklusivitaetWrapper.style.display = e.target.checked ? '' : 'none';
      });
    }

    // Zusatzkosten Toggle
    const zusatzkostenCheckbox = document.getElementById('zusatzkosten');
    const zusatzkostenWrapper = document.getElementById('zusatzkosten-wrapper');
    if (zusatzkostenCheckbox && zusatzkostenWrapper) {
      zusatzkostenCheckbox.addEventListener('change', (e) => {
        zusatzkostenWrapper.style.display = e.target.checked ? '' : 'none';
      });
    }
  }

  // Adress-Vorschau Events
  bindAddressPreviewEvents() {
    const kundeSelect = document.getElementById('kunde_unternehmen_id');
    const creatorSelect = document.getElementById('creator_id');

    if (kundeSelect) {
      kundeSelect.addEventListener('change', (e) => {
        const id = e.target.value;
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
      });
    }

    if (creatorSelect) {
      creatorSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        const creator = this.creators.find(c => c.id === id);
        const preview = document.getElementById('creator-adresse');
        if (preview && creator) {
          preview.innerHTML = `
            <small class="address-text">
              ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
              ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
              ${creator.lieferadresse_land || 'Deutschland'}
            </small>
          `;
        } else if (preview) {
          preview.innerHTML = '';
        }
      });
    }
  }

  // Searchable Selects initialisieren
  initSearchableSelects() {
    const kundeSelect = document.getElementById('kunde_unternehmen_id');
    const creatorSelect = document.getElementById('creator_id');

    if (kundeSelect && window.formSystem?.createSearchableSelect) {
      const options = this.unternehmen.map(u => ({ value: u.id, label: u.firmenname }));
      const selectedKunde = this.formData.kunde_unternehmen_id;
      
      window.formSystem.createSearchableSelect(kundeSelect, options, {
        name: 'kunde_unternehmen_id',
        placeholder: 'Unternehmen suchen...',
        value: selectedKunde
      });
      
      // Nach Erstellung des Searchable Selects: Wert manuell setzen
      if (selectedKunde) {
        this.setSearchableSelectValue('kunde_unternehmen_id', selectedKunde, options);
      }
    }

    if (creatorSelect && window.formSystem?.createSearchableSelect) {
      const options = this.creators.map(c => ({ value: c.id, label: `${c.vorname} ${c.nachname}` }));
      const selectedCreator = this.formData.creator_id;
      
      window.formSystem.createSearchableSelect(creatorSelect, options, {
        name: 'creator_id',
        placeholder: 'Creator suchen...',
        value: selectedCreator
      });
      
      // Nach Erstellung des Searchable Selects: Wert manuell setzen
      if (selectedCreator) {
        this.setSearchableSelectValue('creator_id', selectedCreator, options);
      }
    }
  }

  // Hilfsfunktion: Wert in Searchable Select setzen
  setSearchableSelectValue(selectId, value, options) {
    // Kurze Verzögerung damit das Searchable Select fertig initialisiert ist
    setTimeout(() => {
      const select = document.getElementById(selectId);
      if (!select) {
        console.warn(`⚠️ Select ${selectId} nicht gefunden`);
        return;
      }
      
      // Original-Select Wert setzen
      select.value = value;
      
      // Label finden
      const option = options.find(o => o.value === value);
      const label = option?.label || '';
      
      console.log(`🔍 Setze Searchable Select ${selectId}:`, { value, label });
      
      // Searchable Select Input finden - verschiedene Wege probieren
      let input = null;
      
      // Methode 1: nextElementSibling
      const container1 = select.nextElementSibling;
      if (container1 && container1.classList.contains('searchable-select-container')) {
        input = container1.querySelector('.searchable-select-input');
      }
      
      // Methode 2: parentNode suchen
      if (!input) {
        const container2 = select.parentNode?.querySelector('.searchable-select-container');
        if (container2) {
          input = container2.querySelector('.searchable-select-input');
        }
      }
      
      // Methode 3: closest form-field und dann suchen
      if (!input) {
        const formField = select.closest('.form-field');
        if (formField) {
          const container3 = formField.querySelector('.searchable-select-container');
          if (container3) {
            input = container3.querySelector('.searchable-select-input');
          }
        }
      }
      
      if (input) {
        input.value = label;
        console.log(`✅ Searchable Select ${selectId} gesetzt auf: ${label}`);
      } else {
        console.warn(`⚠️ Input für ${selectId} nicht gefunden`);
      }
      
      // Adress-Vorschau triggern
      select.dispatchEvent(new Event('change'));
    }, 150);
  }

  // Aktuellen Schritt validieren
  validateCurrentStep() {
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
  }

  // Daten des aktuellen Schritts speichern
  saveCurrentStepData() {
    const form = document.getElementById('vertrag-form');
    if (!form) {
      console.log('⚠️ Kein Formular gefunden für saveCurrentStepData');
      return;
    }

    const formData = new FormData(form);
    
    // Debug: Alle FormData-Einträge loggen
    console.log('📋 FormData Einträge:', Array.from(formData.entries()));
    
    // Normale Felder
    for (const [key, value] of formData.entries()) {
      if (key === 'medien') {
        // Array sammeln
        if (!this.formData.medien) this.formData.medien = [];
        if (!this.formData.medien.includes(value)) {
          this.formData.medien.push(value);
        }
      } else if (value === 'true') {
        this.formData[key] = true;
      } else if (value === 'false') {
        this.formData[key] = false;
      } else {
        this.formData[key] = value;
      }
    }

    // Checkboxen die nicht gecheckt sind
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (!cb.checked && cb.name !== 'medien') {
        this.formData[cb.name] = false;
      }
    });

    // Medien Array bereinigen
    const medienCheckboxes = form.querySelectorAll('input[name="medien"]');
    if (medienCheckboxes.length > 0) {
      this.formData.medien = [];
      medienCheckboxes.forEach(cb => {
        if (cb.checked) {
          this.formData.medien.push(cb.value);
        }
      });
    }
    
    // Typ aus selectedTyp sicherstellen (falls nicht im Formular)
    if (this.selectedTyp && !this.formData.typ) {
      this.formData.typ = this.selectedTyp;
    }
    
    console.log('💾 Gesammelte formData:', this.formData);
  }

  // Formular absenden (Erstellen oder Draft finalisieren)
  async handleSubmit(e, startNewAfter = false) {
    if (e) e.preventDefault();

    if (!this.validateCurrentStep()) return;
    this.saveCurrentStepData();

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
        this.formData.name = '';
        this.editId = null; // Wichtig: Neue ID für neuen Vertrag
        this.currentStep = 2;
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
  }

  // PDF generieren mit jsPDF
  async generatePDF(vertrag) {
    // Dynamisch jsPDF laden falls nicht vorhanden
    if (!window.jspdf) {
      try {
        const script = document.createElement('script');
        // jsdelivr.net ist in der CSP erlaubt
        script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      } catch (e) {
        console.warn('⚠️ jsPDF konnte nicht geladen werden:', e);
        window.toastSystem?.show('PDF-Bibliothek konnte nicht geladen werden', 'warning');
        return;
      }
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Hole Kunden- und Creator-Daten
      const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id);
      const creator = this.creators.find(c => c.id === vertrag.creator_id);

      // Helper: Content-Erstellung Art lesbar machen
      const contentErstellungLabels = {
        'skript_fertig': 'Fertiges Skript vom Auftraggeber',
        'briefing_direkt': 'Briefing vom Auftraggeber, direkter Dreh ohne Skript',
        'briefing_skript': 'Briefing vom Auftraggeber, Skript durch Creator',
        'eigenstaendig': 'Eigenständige Konzeption durch Creator'
      };
      
      // Helper: Lieferung Art lesbar machen
      const lieferungLabels = {
        'fertig_geschnitten': 'Fertig geschnittenes Video',
        'raw_cut': 'Raw Cut (Szenen aneinandergeschnitten)',
        'rohmaterial': 'Rohmaterial (ungeschnittene Clips)'
      };
      
      // Helper: Nutzungsart lesbar machen
      const nutzungsartLabels = {
        'organisch': 'Organische Nutzung',
        'paid': 'Paid Ads Nutzung',
        'beides': 'Organisch & Paid Ads'
      };
      
      // Helper: Nutzungsdauer lesbar machen
      const nutzungsdauerLabels = {
        'unbegrenzt': 'Unbegrenzt',
        '12_monate': '12 Monate',
        '6_monate': '6 Monate',
        '3_monate': '3 Monate'
      };

      // Titel
      doc.setFontSize(18);
      doc.text('UGC-PRODUKTIONSVERTRAG', 105, 20, { align: 'center' });
      
      // Vertragsname
      doc.setFontSize(10);
      doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 28, { align: 'center' });

      let y = 42;

      // Agenturdaten
      doc.setFontSize(12);
      doc.text('Agenturdaten', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text('LikeGroup GmbH', 14, y);
      y += 4;
      doc.text('Jakob-Latscha-Str. 3, 60314 Frankfurt am Main', 14, y);

      // Kundendaten
      y += 12;
      doc.setFontSize(12);
      doc.text('Kundendaten', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Firmenname: ${kunde?.firmenname || '-'}`, 14, y);
      y += 4;
      doc.text(`Adresse: ${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}, ${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, 14, y);

      // Creatordaten
      y += 12;
      doc.setFontSize(12);
      doc.text('Creatordaten', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 14, y);
      y += 4;
      doc.text(`Adresse: ${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}, ${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}, ${creator?.lieferadresse_land || 'Deutschland'}`, 14, y);

      // §2 Leistungsumfang
      y += 12;
      doc.setFontSize(12);
      doc.text('§2 Leistungsumfang', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Videos: ${vertrag.anzahl_videos || 0}  |  Fotos: ${vertrag.anzahl_fotos || 0}  |  Storys: ${vertrag.anzahl_storys || 0}`, 14, y);
      y += 5;
      doc.text(`Content-Erstellung: ${contentErstellungLabels[vertrag.content_erstellung_art] || '-'}`, 14, y);

      // §3 Output & Lieferumfang
      y += 10;
      doc.setFontSize(12);
      doc.text('§3 Output & Lieferumfang', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Lieferung: ${lieferungLabels[vertrag.lieferung_art] || '-'}`, 14, y);
      y += 4;
      const extras = [];
      if (vertrag.rohmaterial_enthalten) extras.push('Rohmaterial enthalten');
      if (vertrag.untertitel) extras.push('Mit Untertiteln');
      doc.text(`Extras: ${extras.length > 0 ? extras.join(', ') : 'Keine'}`, 14, y);

      // §4 Nutzungsrechte
      y += 10;
      doc.setFontSize(12);
      doc.text('§4 Nutzungsrechte', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Nutzungsart: ${nutzungsartLabels[vertrag.nutzungsart] || '-'}`, 14, y);
      y += 4;
      const medienLabels = { 'social_media': 'Social Media', 'website': 'Website', 'otv': 'OTV' };
      const medienText = (vertrag.medien || []).map(m => medienLabels[m] || m).join(', ') || '-';
      doc.text(`Medien: ${medienText}`, 14, y);
      y += 4;
      doc.text(`Nutzungsdauer: ${nutzungsdauerLabels[vertrag.nutzungsdauer] || '-'}`, 14, y);
      if (vertrag.exklusivitaet) {
        y += 4;
        doc.text(`Exklusivität: ${vertrag.exklusivitaet_monate || '-'} Monate`, 14, y);
      }

      // §5 Vergütung
      y += 10;
      doc.setFontSize(12);
      doc.text('§5 Vergütung', 14, y);
      doc.setFontSize(10);
      y += 6;
      doc.text(`Fixvergütung: ${vertrag.verguetung_netto || 0} € netto`, 14, y);
      if (vertrag.zusatzkosten && vertrag.zusatzkosten_betrag) {
        y += 4;
        doc.text(`Zusatzkosten: ${vertrag.zusatzkosten_betrag} € netto`, 14, y);
      }
      y += 4;
      const zahlungszielLabels = { '30_tage': '30 Tage', '60_tage': '60 Tage' };
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      if (vertrag.skonto) {
        y += 4;
        doc.text('Skonto: 3% bei Zahlung innerhalb von 7 Tagen', 14, y);
      }

      // §6 Deadlines
      y += 10;
      doc.setFontSize(12);
      doc.text('§6 Deadlines & Korrekturen', 14, y);
      doc.setFontSize(10);
      y += 6;
      const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
      doc.text(`Content-Deadline: ${formatDate(vertrag.content_deadline)}`, 14, y);
      y += 4;
      doc.text(`Korrekturschleifen: ${vertrag.korrekturschleifen || '-'}`, 14, y);
      y += 4;
      doc.text(`Abnahmedatum: ${formatDate(vertrag.abnahmedatum)}`, 14, y);

      // Unterschriften
      y += 20;
      doc.setFontSize(10);
      doc.text('Ort, Datum: ___________________________', 14, y);
      doc.text('Ort, Datum: ___________________________', 110, y);
      y += 15;
      doc.text('Auftraggeber: _________________________', 14, y);
      doc.text('Creator: ______________________________', 110, y);

      // PDF als Blob generieren
      const pdfBlob = doc.output('blob');
      const fileName = `Vertrag_${vertrag.name || 'UGC'}_${new Date().toISOString().split('T')[0]}.pdf`;
      const filePath = `${vertrag.id}/${fileName}`;

      // PDF in Storage hochladen
      const { data: uploadData, error: uploadError } = await window.supabase.storage
        .from('vertraege')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.warn('⚠️ PDF-Upload fehlgeschlagen:', uploadError);
        // Fallback: Nur lokal herunterladen
        doc.save(fileName);
      } else {
        // Signierte URL generieren (7 Tage gültig)
        const { data: urlData } = await window.supabase.storage
          .from('vertraege')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 Tage

        // URL in DB speichern
        if (urlData?.signedUrl) {
          await window.supabase
            .from('vertraege')
            .update({
              datei_url: urlData.signedUrl,
              datei_path: filePath
            })
            .eq('id', vertrag.id);

          console.log('✅ PDF hochgeladen und URL gespeichert');
        }

        // Auch lokal herunterladen
        doc.save(fileName);
      }

      console.log('✅ PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
  }

  // Cleanup
  destroy() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.isGenerated = false;
    this.editId = null;
  }
}

// Exportiere Instanz
export const vertraegeCreate = new VertraegeCreate();
