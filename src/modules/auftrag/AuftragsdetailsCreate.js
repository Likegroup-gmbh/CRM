// AuftragsdetailsCreate.js (ES6-Modul)
// Auftragsdetails-Erstellungsseite

export class AuftragsdetailsCreate {
  constructor() {
    this.formData = {};
    this.auftraege = []; // Aufträge-Liste für Event-Listener
  }

  // Initialisiere Auftragsdetails-Erstellung
  async init() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Initialisiere Auftragsdetails-Erstellung');
    
    // Security: Nur Mitarbeiter haben Zugriff
    const isKunde = window.currentUser?.rolle === 'kunde';
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    await this.showCreateForm();
  }

  // Show Create Form
  async showCreateForm() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Zeige Auftragsdetails-Erstellungsformular');
    window.setHeadline('Neue Auftragsdetails anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
        { label: 'Neue Auftragsdetails', url: '/auftragsdetails/new', clickable: false }
      ]);
    }
    
    // Schritt 1: Lade alle Aufträge, die bereits Details haben
    const { data: existingDetails, error: detailsError } = await window.supabase
      .from('auftrag_details')
      .select('auftrag_id');

    if (detailsError) {
      console.error('Fehler beim Laden der existierenden Details:', detailsError);
      window.showNotification('Fehler beim Laden der Daten', 'error');
      return;
    }

    // IDs der Aufträge, die bereits Details haben
    const auftragIdsWithDetails = existingDetails.map(d => d.auftrag_id);
    console.log('📋 Aufträge mit Details:', auftragIdsWithDetails);

    // Schritt 2: Lade alle Aufträge
    const { data: alleAuftraege, error: auftraegeError } = await window.supabase
      .from('auftrag')
      .select('id, auftragsname, kampagnenanzahl, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
      .order('created_at', { ascending: false });

    if (auftraegeError) {
      console.error('Fehler beim Laden der Aufträge:', auftraegeError);
      window.showNotification('Fehler beim Laden der Aufträge', 'error');
      return;
    }

    // Schritt 3: Filtere client-seitig - nur Aufträge OHNE Details
    const auftraege = alleAuftraege.filter(auftrag => !auftragIdsWithDetails.includes(auftrag.id));
    
    // Aufträge in Instanz-Variable speichern für Event-Listener
    this.auftraege = auftraege;

    console.log('📊 Alle Aufträge:', alleAuftraege?.length || 0);
    console.log('✅ Verfügbare Aufträge ohne Details:', auftraege?.length || 0);

    // Formular HTML - Einheitlich mit FormSystem-Stil
    const formHtml = `
      <div class="form-page">
        <form id="auftragsdetails-form" data-entity="auftragsdetails">
          
          <!-- Auftrag Auswahl -->
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="auftrag_id">Auftrag auswählen <span class="required">*</span></label>
              <select id="auftrag_id" name="auftrag_id" required ${auftraege.length === 0 ? 'disabled' : ''}>
                ${auftraege.length === 0 
                  ? '<option value="">Keine Aufträge verfügbar (alle haben bereits Details)</option>'
                  : '<option value="">Bitte wählen...</option>'
                }
                ${auftraege.map(a => `
                  <option value="${a.id}">
                    ${a.auftragsname} ${a.unternehmen ? `(${a.unternehmen.firmenname})` : ''}
                  </option>
                `).join('')}
              </select>
              ${auftraege.length === 0 
                ? '<small style="color: var(--color-error);">Alle Aufträge haben bereits Auftragsdetails. Bitte erstellen Sie zuerst einen neuen Auftrag.</small>'
                : ''
              }
            </div>

            <div class="form-field form-field--half">
              <label for="kampagnenanzahl">Anzahl Kampagnen</label>
              <input type="number" id="kampagnenanzahl" name="kampagnenanzahl" min="0" placeholder="Wird aus Auftrag übernommen..." readonly>
              <small style="color: var(--text-secondary);">Wird automatisch aus dem Auftrag übernommen</small>
            </div>
          </div>

          <!-- UGC Content -->
          <fieldset class="form-section-fieldset">
            <legend>UGC (User Generated Content)</legend>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="ugc_video_anzahl">Anzahl Videos</label>
                <input type="number" id="ugc_video_anzahl" name="ugc_video_anzahl" min="0" placeholder="z.B. 10">
              </div>
              <div class="form-field form-field--half">
                <label for="ugc_creator_anzahl">Anzahl Creator</label>
                <input type="number" id="ugc_creator_anzahl" name="ugc_creator_anzahl" min="0" placeholder="z.B. 5">
              </div>
            </div>
            <div class="form-field form-field-full">
              <label for="ugc_budget_info">Budget-Info</label>
              <textarea id="ugc_budget_info" name="ugc_budget_info" rows="3" placeholder="Budget-Details für UGC..."></textarea>
            </div>
          </fieldset>

          <!-- Influencer Content -->
          <fieldset class="form-section-fieldset">
            <legend>Influencer Marketing</legend>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="influencer_video_anzahl">Anzahl Videos</label>
                <input type="number" id="influencer_video_anzahl" name="influencer_video_anzahl" min="0" placeholder="z.B. 8">
              </div>
              <div class="form-field form-field--half">
                <label for="influencer_creator_anzahl">Anzahl Creator</label>
                <input type="number" id="influencer_creator_anzahl" name="influencer_creator_anzahl" min="0" placeholder="z.B. 4">
              </div>
            </div>
            <div class="form-field form-field-full">
              <label for="influencer_budget_info">Budget-Info</label>
              <textarea id="influencer_budget_info" name="influencer_budget_info" rows="3" placeholder="Budget-Details für Influencer..."></textarea>
            </div>
          </fieldset>

          <!-- Vor Ort -->
          <fieldset class="form-section-fieldset">
            <legend>Vor Ort (External)</legend>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="vor_ort_video_anzahl">Anzahl Videos</label>
                <input type="number" id="vor_ort_video_anzahl" name="vor_ort_video_anzahl" min="0" placeholder="z.B. 6">
              </div>
              <div class="form-field form-field--half">
                <label for="vor_ort_creator_anzahl">Anzahl Creator</label>
                <input type="number" id="vor_ort_creator_anzahl" name="vor_ort_creator_anzahl" min="0" placeholder="z.B. 3">
              </div>
            </div>
            <div class="form-field">
              <label for="vor_ort_videographen_anzahl">Anzahl Videographen</label>
              <input type="number" id="vor_ort_videographen_anzahl" name="vor_ort_videographen_anzahl" min="0" placeholder="z.B. 2">
            </div>
            <div class="form-field form-field-full">
              <label for="vor_ort_budget_info">Budget-Info</label>
              <textarea id="vor_ort_budget_info" name="vor_ort_budget_info" rows="3" placeholder="Budget-Details für Vor-Ort..."></textarea>
            </div>
          </fieldset>

          <!-- Vor Ort Mitarbeiter -->
          <fieldset class="form-section-fieldset">
            <legend>Vor Ort (Mitarbeiter)</legend>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="vor_ort_mitarbeiter_video_anzahl">Anzahl Videos</label>
                <input type="number" id="vor_ort_mitarbeiter_video_anzahl" name="vor_ort_mitarbeiter_video_anzahl" min="0" placeholder="z.B. 4">
              </div>
              <div class="form-field form-field--half">
                <label for="vor_ort_mitarbeiter_videographen_anzahl">Anzahl Videographen</label>
                <input type="number" id="vor_ort_mitarbeiter_videographen_anzahl" name="vor_ort_mitarbeiter_videographen_anzahl" min="0" placeholder="z.B. 2">
              </div>
            </div>
            <div class="form-field form-field-full">
              <label for="vor_ort_mitarbeiter_budget_info">Budget-Info</label>
              <textarea id="vor_ort_mitarbeiter_budget_info" name="vor_ort_mitarbeiter_budget_info" rows="3" placeholder="Budget-Details für Mitarbeiter Vor-Ort..."></textarea>
            </div>
          </fieldset>

          <!-- Gesamt -->
          <fieldset class="form-section-fieldset">
            <legend>Gesamt (automatisch berechnet)</legend>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="gesamt_videos">Gesamt Videos</label>
                <input type="number" id="gesamt_videos" name="gesamt_videos" min="0" placeholder="Automatisch berechnet" readonly>
                <small style="color: var(--text-secondary);">Wird automatisch berechnet</small>
              </div>
              <div class="form-field form-field--half">
                <label for="gesamt_creator">Gesamt Creator</label>
                <input type="number" id="gesamt_creator" name="gesamt_creator" min="0" placeholder="Automatisch berechnet" readonly>
                <small style="color: var(--text-secondary);">Wird automatisch berechnet</small>
              </div>
            </div>
          </fieldset>

          <!-- Submit Buttons -->
          <div class="form-actions">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/auftragsdetails')">
              <span class="mdc-btn__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-entity-label="Auftragsdetails" data-mode="create">
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
              <span class="mdc-btn__label">Erstellen</span>
            </button>
          </div>
        </form>
      </div>
    `;

    window.content.innerHTML = formHtml;
    
    // Events binden
    this.bindFormEvents();
  }

  // Events binden
  bindFormEvents() {
    const form = document.getElementById('auftragsdetails-form');
    if (!form) return;

    // Auto-Berechnung bei Änderung
    const videoFields = [
      'ugc_video_anzahl',
      'influencer_video_anzahl',
      'vor_ort_video_anzahl',
      'vor_ort_mitarbeiter_video_anzahl'
    ];

    const creatorFields = [
      'ugc_creator_anzahl',
      'influencer_creator_anzahl',
      'vor_ort_creator_anzahl'
    ];

    const updateTotals = () => {
      let totalVideos = 0;
      let totalCreator = 0;

      videoFields.forEach(fieldId => {
        const value = parseInt(document.getElementById(fieldId)?.value || 0);
        totalVideos += value;
      });

      creatorFields.forEach(fieldId => {
        const value = parseInt(document.getElementById(fieldId)?.value || 0);
        totalCreator += value;
      });

      document.getElementById('gesamt_videos').value = totalVideos || '';
      document.getElementById('gesamt_creator').value = totalCreator || '';
    };

    // Listener für alle Felder
    [...videoFields, ...creatorFields].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', updateTotals);
      }
    });

    // Auftrag-Auswahl Listener: Kampagnenanzahl aus Auftrag übernehmen
    const auftragSelect = document.getElementById('auftrag_id');
    if (auftragSelect) {
      auftragSelect.addEventListener('change', (e) => {
        const auftragId = e.target.value;
        const kampagnenField = document.getElementById('kampagnenanzahl');
        
        if (!auftragId || !kampagnenField) return;
        
        // Finde den ausgewählten Auftrag und hole kampagnenanzahl
        const selectedAuftrag = this.auftraege.find(a => a.id === auftragId);
        if (selectedAuftrag?.kampagnenanzahl) {
          kampagnenField.value = selectedAuftrag.kampagnenanzahl;
          kampagnenField.setAttribute('readonly', true);
          kampagnenField.style.backgroundColor = '#f5f5f5';
          console.log(`✅ Kampagnenanzahl ${selectedAuftrag.kampagnenanzahl} vom Auftrag übernommen`);
        } else {
          kampagnenField.value = '';
          kampagnenField.removeAttribute('readonly');
          kampagnenField.style.backgroundColor = '';
          console.log('⚠️ Keine Kampagnenanzahl im Auftrag vorhanden');
        }
      });
    }

    // Submit Handler
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
  }

  // Handle Form Submit
  async handleFormSubmit(e) {
    e.preventDefault();

    try {
      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      const form = document.getElementById('auftragsdetails-form');
      const formData = new FormData(form);
      const data = {};

      for (let [key, value] of formData.entries()) {
        // Leere Werte als null speichern
        if (value === '' || value === null) {
          data[key] = null;
        } else if (['kampagnenanzahl', 'ugc_video_anzahl', 'ugc_creator_anzahl', 
                    'influencer_video_anzahl', 'influencer_creator_anzahl',
                    'vor_ort_video_anzahl', 'vor_ort_creator_anzahl', 'vor_ort_videographen_anzahl',
                    'vor_ort_mitarbeiter_video_anzahl', 'vor_ort_mitarbeiter_videographen_anzahl',
                    'gesamt_videos', 'gesamt_creator'].includes(key)) {
          // Zahlen konvertieren
          data[key] = value ? parseInt(value) : null;
        } else {
          data[key] = value;
        }
      }

      console.log('📤 Auftragsdetails-Daten:', data);

      // Validierung
      if (!data.auftrag_id) {
        window.showNotification('Bitte wählen Sie einen Auftrag aus', 'error');
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
        return;
      }

      // Erstelle Auftragsdetails
      const { data: created, error } = await window.supabase
        .from('auftrag_details')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Auftragsdetails erfolgreich erstellt:', created);
      
      // Success-State für Button
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
      }
      
      // Erfolgs-Benachrichtigung anzeigen
      window.showNotification?.('Auftragsdetails erfolgreich erstellt', 'success');
      
      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'auftrag_details', id: created.id, action: 'created' } 
      }));
      
      // Kurz warten damit Success-State sichtbar ist, dann navigieren
      setTimeout(() => {
        window.navigateTo('/auftragsdetails');
      }, 400);

    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsCreate.handleFormSubmit');
      window.showNotification?.(`Fehler beim Erstellen: ${error.message}`, 'error') || alert(`❌ Fehler beim Erstellen der Auftragsdetails: ${error.message}`);

      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Destroy');
  }
}

// Exportiere Instanz für globale Nutzung
export const auftragsdetailsCreate = new AuftragsdetailsCreate();
