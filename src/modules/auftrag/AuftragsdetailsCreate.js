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

    // Formular HTML
    const formHtml = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Auftragsdetails anlegen</h1>
          <p>Erstellen Sie detaillierte Produktionsplanung für einen Auftrag</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftragsdetails')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        <form id="auftragsdetails-form" class="entity-form">
          
          <!-- Auftrag Auswahl -->
          <div class="form-section">
            <h2 class="section-title">Auftrag</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="auftrag_id" class="form-label required">Auftrag auswählen</label>
                <select id="auftrag_id" name="auftrag_id" class="form-select" required ${auftraege.length === 0 ? 'disabled' : ''}>
                  ${auftraege.length === 0 
                    ? '<option value="">Keine Aufträge verfügbar (alle haben bereits Details)</option>'
                    : '<option value="">Bitte auswählen...</option>'
                  }
                  ${auftraege.map(a => `
                    <option value="${a.id}">
                      ${a.auftragsname} ${a.unternehmen ? `(${a.unternehmen.firmenname})` : ''}
                    </option>
                  `).join('')}
                </select>
                ${auftraege.length === 0 
                  ? '<div class="form-help" style="color: #e74c3c;">Alle Aufträge haben bereits Auftragsdetails. Bitte erstellen Sie zuerst einen neuen Auftrag.</div>'
                  : ''
                }
              </div>

              <div class="form-group">
                <label for="kampagnenanzahl" class="form-label">Anzahl Kampagnen</label>
                <input type="number" id="kampagnenanzahl" name="kampagnenanzahl" class="form-input" min="0" placeholder="Wird aus Auftrag übernommen..." readonly style="background-color: #f5f5f5;">
              </div>
            </div>
          </div>

          <!-- UGC Content -->
          <div class="form-section">
            <h2 class="section-title">UGC (User Generated Content)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="ugc_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="ugc_video_anzahl" name="ugc_video_anzahl" class="form-input" min="0" placeholder="z.B. 10">
              </div>
              <div class="form-group">
                <label for="ugc_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="ugc_creator_anzahl" name="ugc_creator_anzahl" class="form-input" min="0" placeholder="z.B. 5">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="ugc_budget_info" class="form-label">Budget-Info</label>
                <textarea id="ugc_budget_info" name="ugc_budget_info" class="form-input" rows="3" placeholder="Budget-Details für UGC..."></textarea>
              </div>
            </div>
          </div>

          <!-- Influencer Content -->
          <div class="form-section">
            <h2 class="section-title">Influencer Marketing</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="influencer_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="influencer_video_anzahl" name="influencer_video_anzahl" class="form-input" min="0" placeholder="z.B. 8">
              </div>
              <div class="form-group">
                <label for="influencer_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="influencer_creator_anzahl" name="influencer_creator_anzahl" class="form-input" min="0" placeholder="z.B. 4">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="influencer_budget_info" class="form-label">Budget-Info</label>
                <textarea id="influencer_budget_info" name="influencer_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Influencer..."></textarea>
              </div>
            </div>
          </div>

          <!-- Vor Ort -->
          <div class="form-section">
            <h2 class="section-title">Vor Ort (External)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="vor_ort_video_anzahl" name="vor_ort_video_anzahl" class="form-input" min="0" placeholder="z.B. 6">
              </div>
              <div class="form-group">
                <label for="vor_ort_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="vor_ort_creator_anzahl" name="vor_ort_creator_anzahl" class="form-input" min="0" placeholder="z.B. 3">
              </div>
              <div class="form-group">
                <label for="vor_ort_videographen_anzahl" class="form-label">Anzahl Videographen</label>
                <input type="number" id="vor_ort_videographen_anzahl" name="vor_ort_videographen_anzahl" class="form-input" min="0" placeholder="z.B. 2">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_budget_info" class="form-label">Budget-Info</label>
                <textarea id="vor_ort_budget_info" name="vor_ort_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Vor-Ort..."></textarea>
              </div>
            </div>
          </div>

          <!-- Vor Ort Mitarbeiter -->
          <div class="form-section">
            <h2 class="section-title">Vor Ort (Mitarbeiter)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="vor_ort_mitarbeiter_video_anzahl" name="vor_ort_mitarbeiter_video_anzahl" class="form-input" min="0" placeholder="z.B. 4">
              </div>
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_videographen_anzahl" class="form-label">Anzahl Videographen</label>
                <input type="number" id="vor_ort_mitarbeiter_videographen_anzahl" name="vor_ort_mitarbeiter_videographen_anzahl" class="form-input" min="0" placeholder="z.B. 2">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_budget_info" class="form-label">Budget-Info</label>
                <textarea id="vor_ort_mitarbeiter_budget_info" name="vor_ort_mitarbeiter_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Mitarbeiter Vor-Ort..."></textarea>
              </div>
            </div>
          </div>

          <!-- Gesamt -->
          <div class="form-section">
            <h2 class="section-title">Gesamt (automatisch berechnet)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="gesamt_videos" class="form-label">Gesamt Videos</label>
                <input type="number" id="gesamt_videos" name="gesamt_videos" class="form-input" min="0" placeholder="Automatisch berechnet" readonly>
                <div class="form-help">Wird automatisch aus allen Video-Anzahlen berechnet</div>
              </div>
              <div class="form-group">
                <label for="gesamt_creator" class="form-label">Gesamt Creator</label>
                <input type="number" id="gesamt_creator" name="gesamt_creator" class="form-input" min="0" placeholder="Automatisch berechnet" readonly>
                <div class="form-help">Wird automatisch aus allen Creator-Anzahlen berechnet</div>
              </div>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="form-actions">
            <button type="button" onclick="window.navigateTo('/auftragsdetails')" class="btn btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Abbrechen
            </button>
            
            <button type="submit" class="btn btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Auftragsdetails erstellen
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
        submitBtn.innerHTML = 'Erstelle...';
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
          submitBtn.innerHTML = 'Auftragsdetails erstellen';
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
      
      // Erfolgs-Benachrichtigung anzeigen
      alert('✅ Auftragsdetails erfolgreich erstellt.');
      
      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'auftrag_details', id: created.id, action: 'created' } 
      }));
      
      // Navigiere zur Auftragsdetails-Übersicht
      window.navigateTo('/auftragsdetails');

    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsCreate.handleFormSubmit');
      alert(`❌ Fehler beim Erstellen der Auftragsdetails: ${error.message}`);

      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Auftragsdetails erstellen';
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
