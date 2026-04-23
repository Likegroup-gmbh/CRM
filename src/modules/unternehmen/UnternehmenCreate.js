// UnternehmenCreate.js (ES6-Modul)
// Unternehmen-Erstellungsseite mit Auto-Suggestion für Branchen

import { UnternehmenService } from './services/UnternehmenService.js';

export class UnternehmenCreate {
  constructor() {
    this.formData = {};
    this.selectedBranches = [];
    this.allBranches = [];
  }

  // Initialisiere Unternehmen-Erstellungsseite
  async init() {
    console.log('🎯 UNTERNEHMENCREATE: Initialisiere Unternehmen-Erstellungsseite mit FormSystem');
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ UNTERNEHMENCREATE: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      // Verwende das FormSystem anstatt der manuellen Implementierung
      this.showCreateForm();
      
      console.log('✅ UNTERNEHMENCREATE: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ UNTERNEHMENCREATE: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'UnternehmenCreate.init');
    }
  }

  // Lade alle Branchen für Auto-Suggestion
  async loadBranches() {
    console.log('🔄 UNTERNEHMENCREATE: Lade Branchen...');
    
    const { data: branches, error } = await window.supabase
      .from('branchen')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Fehler beim Laden der Branchen: ${error.message}`);
    }

    this.allBranches = branches;
    console.log('✅ UNTERNEHMENCREATE: Branchen geladen:', branches.length);
  }

  // Rendere Unternehmen-Erstellungsseite
  render() {
    // Setze Headline
    window.setHeadline('Neues Unternehmen anlegen');

    const html = `
      <div class="create-page">
        <div class="create-container">
          <div class="create-header">
            <h1>Neues Unternehmen anlegen</h1>
            <p>Erstellen Sie ein neues Unternehmen mit allen relevanten Informationen.</p>
          </div>

          <form id="unternehmen-create-form" class="create-form">
            <!-- Grundinformationen -->
            <div class="form-section">
              <h2 class="section-title">Grundinformationen</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="firmenname" class="form-label required">Firmenname</label>
                  <input 
                    type="text" 
                    id="firmenname" 
                    name="firmenname" 
                    class="form-input" 
                    placeholder="Firmenname eingeben..."
                    required
                  >
                  <div class="form-error" id="firmenname-error"></div>
                </div>

                <div class="form-group">
                  <label for="webseite" class="form-label">Webseite</label>
                  <input 
                    type="url" 
                    id="webseite" 
                    name="webseite" 
                    class="form-input" 
                    placeholder="https://www.beispiel.de"
                  >
                  <div class="form-error" id="webseite-error"></div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="branche" class="form-label">Branchen</label>
                  <div class="multi-select-container">
                    <div class="selected-items" id="selected-branches"></div>
                    <div class="input-with-clear">
                      <input 
                        type="text" 
                        id="branche-input" 
                        class="form-input auto-suggest-input" 
                        placeholder="Branche suchen und hinzufügen..."
                      >
                      <button type="button" class="clear-input-btn" id="clear-branche-input" title="Eingabe löschen">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div class="auto-suggest-dropdown" id="branche-dropdown"></div>
                  </div>
                  <div class="form-help">Mehrere Branchen können ausgewählt werden</div>
                </div>

                <div class="form-group">
                  <label for="status" class="form-label">Status</label>
                  <select id="status" name="status" class="form-select">
                    <option value="">Status auswählen...</option>
                    <option value="aktiv">Aktiv</option>
                    <option value="inaktiv">Inaktiv</option>
                    <option value="prospekt">Prospekt</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="auftragtype" class="form-label">Auftragstyp</label>
                  <select id="auftragtype" name="auftragtype" class="form-select">
                    <option value="">Auftragstyp auswählen...</option>
                    <option value="einmalig">Einmalig</option>
                    <option value="wiederkehrend">Wiederkehrend</option>
                    <option value="projekt">Projekt</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="invoice_email" class="form-label">Rechnungs-E-Mail</label>
                  <input 
                    type="email" 
                    id="invoice_email" 
                    name="invoice_email" 
                    class="form-input" 
                    placeholder="rechnung@unternehmen.de"
                  >
                  <div class="form-error" id="invoice_email-error"></div>
                </div>
              </div>
            </div>

            <!-- Rechnungsadresse -->
            <div class="form-section">
              <h2 class="section-title">Rechnungsadresse</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="rechnungsadresse_strasse" class="form-label">Straße</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_strasse" 
                    name="rechnungsadresse_strasse" 
                    class="form-input" 
                    placeholder="Straßenname"
                  >
                </div>

                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_hausnummer" class="form-label">Hausnummer</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_hausnummer" 
                    name="rechnungsadresse_hausnummer" 
                    class="form-input" 
                    placeholder="123a"
                  >
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_plz" class="form-label">PLZ</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_plz" 
                    name="rechnungsadresse_plz" 
                    class="form-input" 
                    placeholder="12345"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_stadt" class="form-label">Stadt</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_stadt" 
                    name="rechnungsadresse_stadt" 
                    class="form-input" 
                    placeholder="Stadtname"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_land" class="form-label">Land</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_land" 
                    name="rechnungsadresse_land" 
                    class="form-input" 
                    placeholder="Deutschland"
                    value="Deutschland"
                  >
                </div>
              </div>
            </div>

            <!-- Aktionen -->
            <div class="form-actions">
              <button type="button" id="btn-cancel" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abbrechen
              </button>
              
              <button type="submit" id="btn-save" class="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Unternehmen anlegen
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.setContentSafely(html);
  }

  // Binde Events
  bindEvents() {
    this._eventsAbort?.abort();
    this._eventsAbort = new AbortController();
    const signal = this._eventsAbort.signal;

    // Form Submit
    document.getElementById('unternehmen-create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    }, { signal });

    // Abbrechen Button
    document.getElementById('btn-cancel').addEventListener('click', () => {
      window.navigateTo('/unternehmen');
    });

    // Clear-Button für Branche-Input
    document.getElementById('clear-branche-input').addEventListener('click', () => {
      const input = document.getElementById('branche-input');
      const dropdown = document.getElementById('branche-dropdown');
      input.value = '';
      dropdown.style.display = 'none';
      input.focus();
    });

    // Auto-Suggestion für Branchen
    this.setupBrancheAutoSuggest();
  }

  // Auto-Suggestion für Branchen einrichten
  setupBrancheAutoSuggest() {
    const input = document.getElementById('branche-input');
    const dropdown = document.getElementById('branche-dropdown');

    console.log('🔧 UNTERNEHMENCREATE: Setup Auto-Suggest, Branchen verfügbar:', this.allBranches.length);

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      console.log('🔍 UNTERNEHMENCREATE: Suche nach:', query);
      
      if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
      }

      // Filtere Branchen basierend auf der Eingabe
      const filteredBranches = this.allBranches.filter(branch => 
        branch.name.toLowerCase().includes(query) &&
        !this.selectedBranches.some(selected => selected.id === branch.id)
      );

      console.log('📋 UNTERNEHMENCREATE: Gefilterte Branchen:', filteredBranches.length);
      this.renderBrancheDropdown(filteredBranches);
    });

    input.addEventListener('focus', () => {
      if (input.value.length >= 2) {
        dropdown.style.display = 'block';
      }
    });

    // Dropdown schließen bei Klick außerhalb
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    }, { signal: this._eventsAbort.signal });
  }

  // Rendere Branchen-Dropdown
  renderBrancheDropdown(branches) {
    const dropdown = document.getElementById('branche-dropdown');
    const sanitize = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    
    if (branches.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Branchen gefunden</div>';
    } else {
      dropdown.innerHTML = branches.map(branch => `
        <div class="dropdown-item" data-branch-id="${branch.id}">
          <span class="branch-name">${sanitize(branch.name)}</span>
          ${branch.beschreibung ? `<span class="branch-description">${sanitize(branch.beschreibung)}</span>` : ''}
        </div>
      `).join('');

      // Klick-Events für Dropdown-Items
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        if (!item.classList.contains('no-results')) {
          item.addEventListener('click', () => {
            const branchId = item.dataset.branchId;
            const branch = branches.find(b => b.id === branchId);
            this.addBranch(branch);
          });
        }
      });
    }

    dropdown.style.display = 'block';
  }

  // Branche hinzufügen
  addBranch(branch) {
    if (!this.selectedBranches.some(selected => selected.id === branch.id)) {
      this.selectedBranches.push(branch);
      this.renderSelectedBranches();
      
      // Input leeren und Dropdown schließen
      document.getElementById('branche-input').value = '';
      document.getElementById('branche-dropdown').style.display = 'none';
    }
  }

  // Branche entfernen
  removeBranch(branchId) {
    this.selectedBranches = this.selectedBranches.filter(branch => branch.id !== branchId);
    this.renderSelectedBranches();
  }

  // Ausgewählte Branchen rendern
  renderSelectedBranches() {
    const container = document.getElementById('selected-branches');
    const sanitize = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    
    if (this.selectedBranches.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.selectedBranches.map(branch => `
      <div class="selected-item" data-branch-id="${branch.id}">
        <span class="item-name">${sanitize(branch.name)}</span>
        <button type="button" class="remove-item" data-branch-id="${branch.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `).join('');

    // Event-Listener für Remove-Buttons hinzufügen
    container.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const branchId = button.dataset.branchId;
        this.removeBranch(branchId);
      });
    });
  }

  // Form-Daten sammeln
  collectFormData() {
    const formData = new FormData(document.getElementById('unternehmen-create-form'));
    const data = {};

    // Ausgewählte Branchen aus Hidden Select übernehmen (Auto-Suggest)
    const hiddenSelect = document.querySelector('select[name="branche_id[]"]');
    if (hiddenSelect) {
      const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(Boolean);
      if (selectedValues.length > 0) {
        data.branche_id = selectedValues;
      }
    }
    
    // Standard-Felder
    for (let [key, value] of formData.entries()) {
      if (key === 'branche_id' || key === 'branche_id[]') {
        continue;
      }
      data[key] = value.trim();
    }

    // Branchen-IDs hinzufügen
    if (!data.branche_id || data.branche_id.length === 0) {
      data.branche_id = this.selectedBranches.map(branch => branch.id).filter(Boolean);
    }

    if (!Array.isArray(data.branche_id)) {
      data.branche_id = data.branche_id ? [data.branche_id] : [];
    }

    return data;
  }

  // Formular validieren
  validateForm(data) {
    const errors = {};

    // Pflichtfelder prüfen
    if (!data.firmenname) {
      errors.firmenname = 'Firmenname ist erforderlich';
    }

    // E-Mail-Format prüfen
    if (data.invoice_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.invoice_email)) {
      errors.invoice_email = 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
    }

    return errors;
  }

  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    // Alle bestehenden Fehler entfernen
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));

    // Neue Fehler anzeigen
    Object.keys(errors).forEach(fieldName => {
      const errorEl = document.getElementById(`${fieldName}-error`);
      const inputEl = document.getElementById(fieldName);
      
      if (errorEl) {
        errorEl.textContent = errors[fieldName];
      }
      
      if (inputEl) {
        inputEl.classList.add('error');
      }
    });
  }

  // Form Submit behandeln
  async handleSubmit() {
    try {
      // Loading-State
      const submitBtn = document.getElementById('btn-save');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
      submitBtn.disabled = true;

      // Form-Daten sammeln
      const formData = this.collectFormData();
      
      // Validierung
      const errors = this.validateForm(formData);
      if (Object.keys(errors).length > 0) {
        this.showValidationErrors(errors);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Unternehmen erstellen
      const { data: unternehmen, error } = await window.supabase
        .from('unternehmen')
        .insert([formData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ UNTERNEHMENCREATE: Unternehmen erstellt:', unternehmen);

      const createForm = document.getElementById('unternehmen-create-form') || document;
      await this.saveUnternehmenBranchen(unternehmen.id, formData.branche_id, createForm);

      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityCreated', {
        detail: { entity: 'unternehmen', data: unternehmen }
      }));

      // Erfolgsmeldung und Weiterleitung
      alert('Unternehmen wurde erfolgreich angelegt!');
      // Event auslösen für Listen-Update statt Navigation
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'unternehmen', id: unternehmen.id, action: 'created' } 
      }));
      
      // Optional: Zur Detail-Seite navigieren (nur wenn gewünscht)
      // window.navigateTo(`/unternehmen/${unternehmen.id}`);

    } catch (error) {
      console.error('❌ UNTERNEHMENCREATE: Fehler beim Anlegen:', error);
      alert('Fehler beim Anlegen des Unternehmens: ' + error.message);
      
      // Loading-State zurücksetzen
      const submitBtn = document.getElementById('btn-save');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  // Show Create Form (verwendet FormSystem)
  showCreateForm() {
    console.log('🎯 UNTERNEHMENCREATE: Zeige Unternehmen-Erstellungsformular mit FormSystem');
    window.setHeadline('Neues Unternehmen anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neues Unternehmen');
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('unternehmen');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('unternehmen', null);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      console.log('🎯 UNTERNEHMENCREATE: Verarbeite Formular-Submit');
      
      // Loading-State
      const submitBtn = document.querySelector('#unternehmen-form button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
      submitBtn.disabled = true;

      // Formular-Daten sammeln
      const form = document.getElementById('unternehmen-form');
      const formData = new FormData(form);
      const data = {};
      
      // Multi-Select Felder zuerst sammeln (Tag-basierte)
      const allFormData = {};
      
      // Tag-basierte Multi-Selects verarbeiten
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden:', tagBasedSelects.length);
      
      tagBasedSelects.forEach(select => {
        // Zuerst mit [], dann ohne (wie in FormSubmitHelper.js) - Hidden Select wird mit [] erstellt
        let hiddenSelect = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        }
        // Fallback: Nach allen Selects mit dem gleichen Namen
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) {
            hiddenSelect = allSelects[1]; // Das zweite ist das versteckte
          }
        }
        
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions)
            .map(option => option.value)
            .filter(val => val !== '');
          // WICHTIG: Auch leere Arrays setzen, damit "alle Tags entfernt" korrekt als Clear verarbeitet wird.
          allFormData[select.name] = selectedValues;
          console.log(`🏷️ Tag-basiertes Multi-Select ${select.name}:`, selectedValues);
        }
      });
      
      // Mitarbeiter-Felder explizit sammeln (falls nicht über tagBasedSelects gefunden)
      const mitarbeiterFields = ['management_ids', 'lead_mitarbeiter_ids', 'mitarbeiter_ids'];
      console.log('🔍 UNTERNEHMENCREATE: Suche Mitarbeiter-Felder...');
      
      for (const fieldName of mitarbeiterFields) {
        console.log(`🔍 Suche ${fieldName}...`);
        
        // Debug: Zeige alle Selects mit diesem Namen
        const debugSelects = form.querySelectorAll(`select[name="${fieldName}"]`);
        console.log(`   Gefundene Selects für ${fieldName}:`, debugSelects.length);
        debugSelects.forEach((sel, idx) => {
          console.log(`   Select ${idx}: multiple=${sel.multiple}, selectedOptions=${sel.selectedOptions.length}, style.display=${sel.style.display}`);
        });
        
        if (!allFormData[fieldName]) {
          // Methode 1: Suche nach verstecktem Select (style enthält "display: none")
          let hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
          
          // Methode 2: Suche nach Select mit multiple Attribut
          if (!hiddenSelect) {
            const multiSelects = form.querySelectorAll(`select[name="${fieldName}"][multiple]`);
            if (multiSelects.length > 0) {
              hiddenSelect = multiSelects[0];
              console.log(`   Gefunden via [multiple] Attribut`);
            }
          }
          
          // Methode 3: Wenn es mehrere Selects gibt, nimm das zweite (versteckte)
          if (!hiddenSelect) {
            const allSelects = form.querySelectorAll(`select[name="${fieldName}"]`);
            if (allSelects.length > 1) {
              hiddenSelect = allSelects[1];
              console.log(`   Gefunden via zweites Select`);
            } else if (allSelects.length === 1 && allSelects[0].multiple) {
              hiddenSelect = allSelects[0];
              console.log(`   Gefunden via einziges Multi-Select`);
            }
          }
          
          if (hiddenSelect) {
            const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
            console.log(`   ${fieldName}: ${selectedValues.length} ausgewählte Werte`, selectedValues);
            if (selectedValues.length > 0) {
              allFormData[fieldName] = selectedValues;
              console.log(`✅ Gesammelt: ${fieldName} =`, selectedValues);
            }
          } else {
            console.log(`   ⚠️ Kein Select für ${fieldName} gefunden`);
          }
        }
      }
      
      // Standard FormData-Einträge sammeln (inkl. Array-basierte Multi-Selects)
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            // Multi-Select Array behandeln (z.B. branchen_ids[])
            const cleanKey = key.replace('[]', '');
            if (!allFormData[cleanKey]) {
              allFormData[cleanKey] = [];
            }
            allFormData[cleanKey].push(value);
            console.log(`📤 Multi-Select Array ${cleanKey}: ${value}`);
          } else {
            if (allFormData[key]) {
              // Mehrfachwerte zu Array konvertieren
              if (!Array.isArray(allFormData[key])) {
                allFormData[key] = [allFormData[key]];
              }
              allFormData[key].push(value);
            } else {
              allFormData[key] = value;
            }
          }
        }
      }
      
      // Daten verarbeiten
      for (let [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : value.trim();
      }

      // Branchen-IDs für Junction Table beibehalten (nicht zu einzelner UUID konvertieren)
      if (data.branche_id && Array.isArray(data.branche_id)) {
        console.log('✅ branche_id Array für Junction Table:', data.branche_id);
        // Array beibehalten - wird von RelationTables verarbeitet
      }

      console.log('📋 UNTERNEHMENCREATE: Formular-Daten gesammelt:', data);
      console.log('🧪 UNTERNEHMENCREATE: Übergabe an DataService mit branche_id:', data.branche_id);
      console.log('👥 UNTERNEHMENCREATE: Mitarbeiter-Daten:', {
        management_ids: data.management_ids,
        lead_mitarbeiter_ids: data.lead_mitarbeiter_ids,
        mitarbeiter_ids: data.mitarbeiter_ids
      });

      // Unternehmen über DataService erstellen (konsistent mit anderen Modulen)
      const result = await window.dataService.createEntity('unternehmen', data);
      
      if (!result.success) {
        throw new Error(result.error || 'Unbekannter Fehler beim Erstellen');
      }
      
      const unternehmen = result.data;

      console.log('✅ UNTERNEHMENCREATE: Unternehmen erstellt:', unternehmen);

      // Logo-Upload (falls vorhanden)
      try {
        console.log('🔵 START: Logo-Upload für Unternehmen', result.id);
        await this.uploadLogo(result.id, form);
        console.log('✅ Logo-Upload abgeschlossen');
      } catch (logoErr) {
        console.error('❌ Logo-Upload fehlgeschlagen:', logoErr);
        // Alert nur bei echten Fehlern, nicht bei "kein Logo ausgewählt"
        if (logoErr && logoErr.message && !logoErr.message.includes('Kein Logo')) {
          alert('Logo konnte nicht hochgeladen werden: ' + logoErr.message);
        }
      }

      // HINWEIS: Branchen werden automatisch durch DataService.handleManyToManyRelations() verwaltet
      // Daher NICHT manuell saveUnternehmenBranchen() aufrufen - das führt zu Race Conditions!
      
      // Mitarbeiter-Zuordnungen mit Rollen speichern
      await this.saveMitarbeiterRoles(result.id, data);

      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityCreated', {
        detail: { entity: 'unternehmen', data: unternehmen }
      }));

      // Erfolgsmeldung und Weiterleitung
      alert('Unternehmen wurde erfolgreich angelegt!');
      // Event auslösen für Listen-Update statt Navigation
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'unternehmen', id: unternehmen.id, action: 'created' } 
      }));
      
      // Optional: Zur Detail-Seite navigieren (nur wenn gewünscht)
      // window.navigateTo(`/unternehmen/${unternehmen.id}`);

    } catch (error) {
      console.error('❌ UNTERNEHMENCREATE: Fehler beim Anlegen:', error);
      alert('Fehler beim Anlegen des Unternehmens: ' + error.message);
      
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#unternehmen-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  // Branche-Namen aus IDs laden - delegiert an UnternehmenService
  async getBranchenNamen(branchenIds) {
    return UnternehmenService.getBranchenNamen(branchenIds);
  }

  // Logo-Upload - delegiert an UnternehmenService
  async uploadLogo(unternehmenId, form) {
    return UnternehmenService.uploadLogo(unternehmenId, form);
  }
  
  // Mitarbeiter-Zuordnungen mit Rollen speichern - delegiert an UnternehmenService
  async saveMitarbeiterRoles(unternehmenId, data) {
    return UnternehmenService.saveMitarbeiterRoles(unternehmenId, data, { deleteExisting: false });
  }

  // Branchen-Verknüpfungen speichern - delegiert an UnternehmenService
  // HINWEIS: Sollte NICHT manuell aufgerufen werden wenn DataService verwendet wird!
  async saveUnternehmenBranchen(unternehmenId, brancheIds = null, form = null) {
    return UnternehmenService.saveUnternehmenBranchen(unternehmenId, brancheIds, form);
  }

  // Cleanup
  destroy() {
    console.log('🗑️ UNTERNEHMENCREATE: Destroy aufgerufen');
    this._eventsAbort?.abort();
    this._eventsAbort = null;
    window.setContentSafely('');
    console.log('✅ UNTERNEHMENCREATE: Destroy abgeschlossen');
  }
}

// Exportiere Instanz für globale Nutzung
export const unternehmenCreate = new UnternehmenCreate();
