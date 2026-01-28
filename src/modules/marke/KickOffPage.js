// KickOffPage.js
// Seite für Brand Kick-Off / Brand-Essenz Erfassung (wie MarkeCreate)

export class KickOffPage {
  constructor() {
    this.selectedUnternehmenId = null;
    this.selectedMarkeId = null;
    this.hasMarken = false; // Flag: Hat das Unternehmen Marken?
    this.existingKickOff = null;
    this.existingMarkenwerte = [];
    this.allMarkenwerte = [];
  }

  // Initialisiere Seite
  async init() {
    console.log('🚀 KICK-OFF: Initialisiere Seite');
    
    // State zurücksetzen (wichtig bei Navigation zurück zur Seite)
    this.selectedUnternehmenId = null;
    this.selectedMarkeId = null;
    this.hasMarken = false;
    this.existingKickOff = null;
    this.existingMarkenwerte = [];
    
    window.setHeadline('Brand Kick-Off');
    
    // Breadcrumb
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Marken', url: '/marke', clickable: true },
        { label: 'Brand Kick-Off', url: '/kickoff', clickable: false }
      ]);
    }

    await this.loadMarkenwerte();
    this.render();
    await this.loadUnternehmen();
    this.initSearchableSelects();
    this.bindEvents();
  }

  // Lade alle verfügbaren Markenwerte
  async loadMarkenwerte() {
    try {
      const { data, error } = await window.supabase
        .from('markenwert_typen')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      this.allMarkenwerte = data || [];
      console.log('✅ Markenwerte geladen:', this.allMarkenwerte.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Markenwerte:', error);
      this.allMarkenwerte = [];
    }
  }

  // Render Page
  render() {
    window.content.innerHTML = `
      <div class="form-page kickoff-page">
        <form id="kickoff-form" class="form">
          
          <!-- Auswahl-Section -->
          <div class="form-section">
            <h3 class="form-section-title">Unternehmen / Marke auswählen</h3>
            
            <div class="form-field">
              <label for="kickoff_unternehmen">Unternehmen <span class="required">*</span></label>
              <select id="kickoff_unternehmen" class="form-select" data-searchable="true" required>
                <option value="">Unternehmen suchen...</option>
              </select>
            </div>
            
            <div class="form-field" id="marke_field_container">
              <label for="kickoff_marke">Marke</label>
              <select id="kickoff_marke" class="form-select" disabled>
                <option value="">Erst Unternehmen wählen...</option>
              </select>
            </div>
            
            <div id="kickoff_status" class="kickoff-status" style="display: none;"></div>
          </div>

          <!-- Kick-Off Felder (initial versteckt) -->
          <div id="kickoff_fields" class="kickoff-fields" style="display: none;">
            
            <div class="form-section">
              <h3 class="form-section-title">1. Brand-Essenz</h3>
              <div class="form-field">
                <label for="brand_essenz">Brand-Essenz (1 Satz) <span class="required">*</span></label>
                <input type="text" id="brand_essenz" class="form-input" maxlength="200" placeholder="Was macht die Marke einzigartig? (max. 200 Zeichen)" required>
                <span class="char-counter"><span id="brand_essenz_count">0</span>/200</span>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">2. Mission / Zweck der Marke</h3>
              <div class="form-field">
                <label for="mission">Mission <span class="required">*</span></label>
                <textarea id="mission" class="form-textarea" rows="3" placeholder="Warum existiert diese Marke? Was ist ihr Zweck?" required></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">3. Markenwerte (max. 3)</h3>
              <div class="form-field">
                <label>Markenwerte</label>
                <div class="tag-input-container" id="markenwerte_container">
                  <div class="selected-tags" id="selected_markenwerte"></div>
                  <div class="tag-input-wrapper">
                    <input type="text" id="markenwert_input" class="tag-input" placeholder="Wert eingeben oder auswählen...">
                    <div class="tag-suggestions" id="markenwert_suggestions" style="display: none;"></div>
                  </div>
                </div>
                <span class="field-hint">Maximal 3 Werte. Neue Werte werden automatisch angelegt.</span>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">4. Zielgruppe</h3>
              <div class="form-field">
                <label for="zielgruppe">Zielgruppe (Wer + Alter) <span class="required">*</span></label>
                <textarea id="zielgruppe" class="form-textarea" rows="2" placeholder="z.B. Frauen 25-35, modebewusst, urban" required></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">5. Zielgruppen-Mindset</h3>
              <div class="form-field">
                <label for="zielgruppen_mindset">Mindset der Zielgruppe</label>
                <textarea id="zielgruppen_mindset" class="form-textarea" rows="2" placeholder="Wie denkt und fühlt die Zielgruppe? Was motiviert sie?"></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">6. Marken-USP</h3>
              <div class="form-field">
                <label for="marken_usp">USP (Unternehmensebene) <span class="required">*</span></label>
                <textarea id="marken_usp" class="form-textarea" rows="2" placeholder="Was unterscheidet das Unternehmen von der Konkurrenz?" required></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">7. Tonalität & Sprachstil</h3>
              <div class="form-field">
                <label for="tonalitaet_sprachstil">Tonalität & Sprachstil <span class="required">*</span></label>
                <textarea id="tonalitaet_sprachstil" class="form-textarea" rows="2" placeholder="z.B. locker, professionell, humorvoll, sachlich..." required></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">8. Content-Charakter</h3>
              <div class="form-field">
                <label for="content_charakter">Look & Feel</label>
                <textarea id="content_charakter" class="form-textarea" rows="2" placeholder="Visueller Stil, Farben, Bildsprache..."></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">9. Marken-Do's & Don'ts</h3>
              <div class="form-field">
                <label for="dos_donts">Do's & Don'ts</label>
                <textarea id="dos_donts" class="form-textarea" rows="3" placeholder="Was soll/soll nicht kommuniziert werden?"></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3 class="form-section-title">10. Rechtliche & kommunikative Leitplanken</h3>
              <div class="form-field">
                <label for="rechtliche_leitplanken">Leitplanken</label>
                <textarea id="rechtliche_leitplanken" class="form-textarea" rows="3" placeholder="Rechtliche Einschränkungen, Claims die vermieden werden müssen..."></textarea>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions" id="kickoff_actions" style="display: none;">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="kickoff_cancel">
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn mdc-btn--create" id="kickoff_submit">
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
                </svg>
              </span>
              <span class="mdc-btn__spinner" aria-hidden="true">
                <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                  <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
                </svg>
              </span>
              <span class="mdc-btn__label">Speichern</span>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // Lade Unternehmen für Dropdown
  async loadUnternehmen() {
    const select = document.getElementById('kickoff_unternehmen');
    if (!select) return;

    try {
      const { data, error } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname')
        .order('firmenname', { ascending: true });

      if (error) throw error;

      data.forEach(u => {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = u.firmenname;
        select.appendChild(option);
      });

      console.log('✅ Unternehmen geladen:', data.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
    }
  }

  // Initialisiere Searchable Selects via FormSystem
  initSearchableSelects() {
    const form = document.getElementById('kickoff-form');
    if (form && window.formSystem) {
      window.formSystem.initializeSearchableSelects(form);
      console.log('✅ Searchable Selects initialisiert');
    }
  }

  // Lade Marken für Unternehmen
  async loadMarken(unternehmenId) {
    const select = document.getElementById('kickoff_marke');
    const fieldsDiv = document.getElementById('kickoff_fields');
    const actionsDiv = document.getElementById('kickoff_actions');
    const statusDiv = document.getElementById('kickoff_status');
    
    if (!select) return;

    // Reset Marke-bezogene States
    this.selectedMarkeId = null;
    this.existingKickOff = null;
    this.existingMarkenwerte = [];

    if (!unternehmenId) {
      select.innerHTML = '<option value="">Erst Unternehmen wählen...</option>';
      select.disabled = true;
      this.hasMarken = false;
      if (fieldsDiv) fieldsDiv.style.display = 'none';
      if (actionsDiv) actionsDiv.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      return;
    }

    // Zeige Lade-Status
    select.innerHTML = '<option value="">Lade Marken...</option>';
    select.disabled = true;

    try {
      const { data, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('unternehmen_id', unternehmenId)
        .order('markenname', { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        // Keine Marken vorhanden - Select disabled mit Hinweis, Felder direkt anzeigen
        console.log('📌 Keine Marken für Unternehmen - zeige Felder direkt');
        this.hasMarken = false;
        
        select.innerHTML = '<option value="">Keine Marke vorhanden</option>';
        select.disabled = true;
        
        // Felder direkt anzeigen - Kick-Off auf Unternehmen-Ebene
        await this.checkExistingKickOff(null, unternehmenId);
        
      } else {
        // Marken vorhanden - Select befüllen
        console.log('✅ Marken geladen:', data.length);
        this.hasMarken = true;
        
        select.innerHTML = '<option value="">Marke wählen...</option>';
        data.forEach(m => {
          const option = document.createElement('option');
          option.value = m.id;
          option.textContent = m.markenname;
          select.appendChild(option);
        });
        select.disabled = false;
        
        // Felder noch nicht anzeigen - erst nach Marke-Auswahl
        if (fieldsDiv) fieldsDiv.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'none';
        if (statusDiv) statusDiv.style.display = 'none';
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Marken:', error);
      select.innerHTML = '<option value="">Fehler beim Laden</option>';
    }
  }

  // Prüfe ob Kick-Off existiert (für Marke ODER Unternehmen)
  async checkExistingKickOff(markeId, unternehmenId = null) {
    const statusDiv = document.getElementById('kickoff_status');
    const fieldsDiv = document.getElementById('kickoff_fields');
    const actionsDiv = document.getElementById('kickoff_actions');

    // Wenn weder Marke noch Unternehmen gesetzt, nichts tun
    if (!markeId && !unternehmenId) {
      if (statusDiv) statusDiv.style.display = 'none';
      if (fieldsDiv) fieldsDiv.style.display = 'none';
      if (actionsDiv) actionsDiv.style.display = 'none';
      this.existingKickOff = null;
      this.existingMarkenwerte = [];
      return;
    }

    let kickoff = null;

    try {
      let query = window.supabase.from('marke_kickoff').select('*');
      
      if (markeId) {
        // Suche nach Marke-Kick-Off
        query = query.eq('marke_id', markeId);
      } else if (unternehmenId) {
        // Suche nach Unternehmen-Kick-Off (ohne Marke)
        query = query.eq('unternehmen_id', unternehmenId).is('marke_id', null);
      }

      const { data, error } = await query.single();

      // PGRST116 = keine Zeile gefunden - das ist OK
      if (error && error.code !== 'PGRST116') {
        // Andere Fehler (z.B. Spalte existiert nicht) - ignorieren, leeres Formular zeigen
        console.warn('⚠️ DB-Fehler beim Laden des Kick-Offs (wird ignoriert):', error.message);
      } else {
        kickoff = data || null;
      }
    } catch (error) {
      console.warn('⚠️ Fehler beim Prüfen des Kick-Offs (wird ignoriert):', error);
    }

    this.existingKickOff = kickoff;

    // Wenn Kick-Off vorhanden, lade auch die Markenwerte
    if (kickoff) {
      try {
        const { data: markenwerte } = await window.supabase
          .from('marke_kickoff_markenwerte')
          .select('markenwert_id, markenwert:markenwert_id(id, name)')
          .eq('kickoff_id', kickoff.id);

        this.existingMarkenwerte = markenwerte?.map(m => m.markenwert) || [];
      } catch (e) {
        console.warn('⚠️ Fehler beim Laden der Markenwerte:', e);
        this.existingMarkenwerte = [];
      }
    } else {
      this.existingMarkenwerte = [];
    }

    // UI aktualisieren - Status Badge
    if (statusDiv) {
      if (kickoff) {
        const updatedAt = new Date(kickoff.updated_at).toLocaleDateString('de-DE');
        statusDiv.innerHTML = `
          <div class="kickoff-status-badge kickoff-status-badge--exists">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Kick-Off existiert (zuletzt aktualisiert: ${updatedAt})
          </div>
        `;
        statusDiv.style.display = 'block';
      } else {
        statusDiv.innerHTML = '';
        statusDiv.style.display = 'none';
      }
    }

    // WICHTIG: Felder und Actions IMMER anzeigen
    if (fieldsDiv) fieldsDiv.style.display = 'block';
    if (actionsDiv) actionsDiv.style.display = 'flex';
    
    this.populateFields();

    console.log('✅ Kick-Off Status geprüft:', kickoff ? 'existiert' : 'neu');
  }

  // Befülle Felder mit existierenden Daten
  populateFields() {
    const data = this.existingKickOff || {};

    const fields = [
      'brand_essenz', 'mission', 'zielgruppe', 'zielgruppen_mindset',
      'marken_usp', 'tonalitaet_sprachstil', 'content_charakter',
      'dos_donts', 'rechtliche_leitplanken'
    ];

    fields.forEach(field => {
      const el = document.getElementById(field);
      if (el) el.value = data[field] || '';
    });

    this.updateCharCounter();
    this.renderSelectedMarkenwerte();
  }

  // Rendere ausgewählte Markenwerte als Tags
  renderSelectedMarkenwerte() {
    const container = document.getElementById('selected_markenwerte');
    if (!container) return;

    container.innerHTML = '';

    this.existingMarkenwerte.forEach(mw => {
      const tag = document.createElement('span');
      tag.className = 'tag-item';
      tag.dataset.id = mw.id;
      tag.innerHTML = `
        ${mw.name}
        <button type="button" class="tag-remove" data-id="${mw.id}">&times;</button>
      `;
      container.appendChild(tag);
    });
  }

  // Update Character Counter
  updateCharCounter() {
    const input = document.getElementById('brand_essenz');
    const counter = document.getElementById('brand_essenz_count');
    if (input && counter) {
      counter.textContent = input.value.length;
    }
  }

  // Binde Events
  bindEvents() {
    // Unternehmen Change - Searchable Select nutzt hidden input
    const unternehmenSelect = document.getElementById('kickoff_unternehmen');
    if (unternehmenSelect) {
      // Observer für value-Änderungen (da searchable select ein hidden input nutzt)
      const observer = new MutationObserver(() => {
        const newValue = unternehmenSelect.value;
        if (newValue && newValue !== this.selectedUnternehmenId) {
          console.log('🔄 Unternehmen geändert (Observer):', newValue);
          this.selectedUnternehmenId = newValue;
          this.loadMarken(newValue);
        }
      });
      observer.observe(unternehmenSelect, { attributes: true, attributeFilter: ['value'] });
      
      // Auch auf change hören (für nicht-searchable Fallback)
      unternehmenSelect.addEventListener('change', (e) => {
        if (e.target.value && e.target.value !== this.selectedUnternehmenId) {
          console.log('🔄 Unternehmen geändert (Change):', e.target.value);
          this.selectedUnternehmenId = e.target.value;
          this.loadMarken(e.target.value);
        }
      });
    }

    // Marke Change - normales Select (kein Searchable)
    const markeSelect = document.getElementById('kickoff_marke');
    if (markeSelect) {
      markeSelect.addEventListener('change', (e) => {
        const newValue = e.target.value;
        console.log('🔄 Marke geändert:', newValue);
        this.selectedMarkeId = newValue;
        if (newValue) {
          this.checkExistingKickOff(newValue, null);
        }
      });
    }

    // Brand-Essenz Char Counter
    const brandEssenzInput = document.getElementById('brand_essenz');
    if (brandEssenzInput) {
      brandEssenzInput.addEventListener('input', () => this.updateCharCounter());
    }

    // Tag Input
    this.bindTagInputEvents();

    // Form Submit
    const form = document.getElementById('kickoff-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.save();
      });
    }

    // Cancel Button
    const cancelBtn = document.getElementById('kickoff_cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.moduleRegistry?.navigateTo('/marke');
      });
    }
  }

  // Tag Input Events
  bindTagInputEvents() {
    const input = document.getElementById('markenwert_input');
    const suggestionsDiv = document.getElementById('markenwert_suggestions');
    const selectedContainer = document.getElementById('selected_markenwerte');

    if (!input || !suggestionsDiv) return;

    input.addEventListener('focus', () => {
      this.showSuggestions('');
    });

    input.addEventListener('input', (e) => {
      this.showSuggestions(e.target.value);
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        if (value && this.existingMarkenwerte.length < 3) {
          await this.addMarkenwert(value);
          input.value = '';
          this.showSuggestions('');
        }
      } else if (e.key === 'Escape') {
        suggestionsDiv.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tag-input-wrapper')) {
        suggestionsDiv.style.display = 'none';
      }
    });

    suggestionsDiv.addEventListener('click', async (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const id = item.dataset.id;
        const name = item.dataset.name;
        
        if (id && this.existingMarkenwerte.length < 3) {
          if (!this.existingMarkenwerte.find(m => m.id === id)) {
            this.existingMarkenwerte.push({ id, name });
            this.renderSelectedMarkenwerte();
          }
        }
        
        input.value = '';
        suggestionsDiv.style.display = 'none';
      }
    });

    if (selectedContainer) {
      selectedContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.tag-remove');
        if (removeBtn) {
          const id = removeBtn.dataset.id;
          this.existingMarkenwerte = this.existingMarkenwerte.filter(m => m.id !== id);
          this.renderSelectedMarkenwerte();
        }
      });
    }
  }

  // Zeige Suggestions
  showSuggestions(filter) {
    const suggestionsDiv = document.getElementById('markenwert_suggestions');
    if (!suggestionsDiv) return;

    if (this.existingMarkenwerte.length >= 3) {
      suggestionsDiv.innerHTML = '<div class="suggestion-hint">Maximum von 3 Werten erreicht</div>';
      suggestionsDiv.style.display = 'block';
      return;
    }

    const lowerFilter = filter.toLowerCase();
    const selectedIds = this.existingMarkenwerte.map(m => m.id);
    
    const filtered = this.allMarkenwerte.filter(mw => 
      !selectedIds.includes(mw.id) && 
      mw.name.toLowerCase().includes(lowerFilter)
    );

    let html = '';

    filtered.slice(0, 8).forEach(mw => {
      html += `<div class="suggestion-item" data-id="${mw.id}" data-name="${mw.name}">${mw.name}</div>`;
    });

    if (filter && !this.allMarkenwerte.find(m => m.name.toLowerCase() === lowerFilter)) {
      html += `<div class="suggestion-item suggestion-item--new" data-name="${filter}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        "${filter}" neu anlegen
      </div>`;
    }

    if (!html) {
      html = '<div class="suggestion-hint">Keine Vorschläge</div>';
    }

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';

    const newItem = suggestionsDiv.querySelector('.suggestion-item--new');
    if (newItem) {
      newItem.addEventListener('click', async () => {
        await this.addMarkenwert(filter);
        const input = document.getElementById('markenwert_input');
        if (input) input.value = '';
        suggestionsDiv.style.display = 'none';
      });
    }
  }

  // Füge Markenwert hinzu
  async addMarkenwert(name) {
    if (this.existingMarkenwerte.length >= 3) return;

    const existing = this.allMarkenwerte.find(m => m.name.toLowerCase() === name.toLowerCase());
    
    if (existing) {
      if (!this.existingMarkenwerte.find(m => m.id === existing.id)) {
        this.existingMarkenwerte.push(existing);
      }
    } else {
      try {
        const { data, error } = await window.supabase
          .from('markenwert_typen')
          .insert({ name: name.trim() })
          .select()
          .single();

        if (error) throw error;

        this.allMarkenwerte.push(data);
        this.existingMarkenwerte.push(data);
        console.log('✅ Neuer Markenwert angelegt:', data.name);
      } catch (error) {
        console.error('❌ Fehler beim Anlegen des Markenwerts:', error);
        return;
      }
    }

    this.renderSelectedMarkenwerte();
  }

  // Speichere Kick-Off
  async save() {
    console.log('💾 KICK-OFF: Speichere...');

    // Validierung: Entweder Marke oder Unternehmen (ohne Marke) muss ausgewählt sein
    if (!this.selectedMarkeId && !this.selectedUnternehmenId) {
      this.showError('Bitte wähle ein Unternehmen aus.');
      return;
    }

    // Wenn Unternehmen Marken hat, muss eine Marke ausgewählt sein
    if (this.hasMarken && !this.selectedMarkeId) {
      this.showError('Bitte wähle eine Marke aus.');
      return;
    }

    const submitBtn = document.getElementById('kickoff_submit');
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }

    try {
      // Daten sammeln - je nach Fall (mit oder ohne Marke)
      const kickoffData = {
        marke_id: this.selectedMarkeId || null,
        unternehmen_id: this.hasMarken ? null : this.selectedUnternehmenId, // Nur setzen wenn keine Marke
        brand_essenz: document.getElementById('brand_essenz')?.value?.trim() || null,
        mission: document.getElementById('mission')?.value?.trim() || null,
        zielgruppe: document.getElementById('zielgruppe')?.value?.trim() || null,
        zielgruppen_mindset: document.getElementById('zielgruppen_mindset')?.value?.trim() || null,
        marken_usp: document.getElementById('marken_usp')?.value?.trim() || null,
        tonalitaet_sprachstil: document.getElementById('tonalitaet_sprachstil')?.value?.trim() || null,
        content_charakter: document.getElementById('content_charakter')?.value?.trim() || null,
        dos_donts: document.getElementById('dos_donts')?.value?.trim() || null,
        rechtliche_leitplanken: document.getElementById('rechtliche_leitplanken')?.value?.trim() || null
      };

      if (!this.existingKickOff) {
        // Verwende currentUser aus der benutzer-Tabelle, nicht auth.users
        if (window.currentUser?.id) {
          kickoffData.created_by = window.currentUser.id;
        }
      }

      let kickoffId;

      if (this.existingKickOff) {
        const { error } = await window.supabase
          .from('marke_kickoff')
          .update(kickoffData)
          .eq('id', this.existingKickOff.id);

        if (error) throw error;
        kickoffId = this.existingKickOff.id;
        console.log('✅ Kick-Off aktualisiert');
      } else {
        const { data, error } = await window.supabase
          .from('marke_kickoff')
          .insert(kickoffData)
          .select()
          .single();

        if (error) throw error;
        kickoffId = data.id;
        console.log('✅ Kick-Off angelegt');
      }

      // Markenwerte speichern
      await window.supabase
        .from('marke_kickoff_markenwerte')
        .delete()
        .eq('kickoff_id', kickoffId);

      if (this.existingMarkenwerte.length > 0) {
        const junctionData = this.existingMarkenwerte.map(mw => ({
          kickoff_id: kickoffId,
          markenwert_id: mw.id
        }));

        const { error: junctionError } = await window.supabase
          .from('marke_kickoff_markenwerte')
          .insert(junctionData);

        if (junctionError) throw junctionError;
      }

      // Event & Toast
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { 
          entity: 'marke_kickoff', 
          id: kickoffId, 
          marke_id: this.selectedMarkeId,
          unternehmen_id: this.selectedUnternehmenId
        }
      }));

      if (window.toastSystem) {
        window.toastSystem.show('Kick-Off erfolgreich gespeichert!', 'success');
      }

      // Navigation: Zur Marke oder zum Unternehmen
      setTimeout(() => {
        if (this.selectedMarkeId) {
          window.moduleRegistry?.navigateTo(`/marke/${this.selectedMarkeId}`);
        } else {
          window.moduleRegistry?.navigateTo(`/unternehmen/${this.selectedUnternehmenId}`);
        }
      }, 500);

    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      this.showError('Fehler beim Speichern: ' + error.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    }
  }

  // Zeige Fehlermeldung
  showError(message) {
    if (window.toastSystem) {
      window.toastSystem.show(message, 'error');
    } else {
      alert(message);
    }
  }
}

export const kickOffPage = new KickOffPage();
