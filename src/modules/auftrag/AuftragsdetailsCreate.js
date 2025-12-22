// AuftragsdetailsCreate.js (ES6-Modul)
// Auftragsdetails-Erstellungsseite - Dynamisch basierend auf Kampagnenarten

import { KAMPAGNENARTEN_MAPPING, generateBudgetOnlyFieldsHtml } from './logic/KampagnenartenMapping.js';

export class AuftragsdetailsCreate {
  constructor() {
    this.formData = {};
    this.auftraege = []; // Aufträge-Liste für Event-Listener
    this.currentKampagnenarten = []; // Aktuelle Kampagnenarten des ausgewählten Auftrags
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

    // Formular HTML - Basis-Struktur mit dynamischem Container
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

          <!-- Dynamischer Container für Budget-Felder pro Kampagnenart -->
          <div id="kampagnenart-sections-container">
            <div class="alert alert-info">
              <p>Bitte wählen Sie einen Auftrag aus, um die Budget-Felder anzuzeigen.</p>
            </div>
          </div>

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

  /**
   * Lädt die Kampagnenarten für einen Auftrag
   * PRIMÄR: Aus der auftrag_kampagne_art Junction-Tabelle (direkt am Auftrag hinterlegt)
   * FALLBACK: Aus den zugehörigen Kampagnen
   * @param {string} auftragId - ID des Auftrags
   * @returns {Promise<string[]>} - Array der eindeutigen Kampagnenarten-Namen
   */
  async loadKampagnenartenForAuftrag(auftragId) {
    if (!window.supabase || !auftragId) return [];
    
    try {
      const artenSet = new Set();
      
      // PRIMÄR: Lade Kampagnenarten direkt vom Auftrag (über auftrag_kampagne_art Junction)
      const { data: auftragArten, error: auftragError } = await window.supabase
        .from('auftrag_kampagne_art')
        .select(`
          kampagne_art_typen:kampagne_art_id(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (auftragError) {
        console.warn('⚠️ Fehler beim Laden der Auftrag-Kampagnenarten:', auftragError);
      } else {
        (auftragArten || []).forEach(item => {
          if (item.kampagne_art_typen?.name) {
            artenSet.add(item.kampagne_art_typen.name);
          }
        });
      }
      
      // Falls vom Auftrag Kampagnenarten gefunden wurden, diese verwenden
      if (artenSet.size > 0) {
        console.log('📋 Kampagnenarten aus Auftrag geladen:', Array.from(artenSet));
        return Array.from(artenSet);
      }
      
      // FALLBACK: Lade aus den Kampagnen (für Abwärtskompatibilität)
      console.log('ℹ️ Keine Kampagnenarten im Auftrag, prüfe Kampagnen...');
      const { data: kampagnen, error: kampError } = await window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagne_art_typen:art_der_kampagne(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (kampError) {
        console.error('❌ Fehler beim Laden der Kampagnen:', kampError);
        return [];
      }
      
      (kampagnen || []).forEach(kampagne => {
        const arten = kampagne.kampagne_art_typen;
        if (Array.isArray(arten)) {
          arten.forEach(art => {
            if (art?.name) artenSet.add(art.name);
          });
        } else if (arten?.name) {
          artenSet.add(arten.name);
        }
      });
      
      console.log('📋 Kampagnenarten aus Kampagnen geladen:', Array.from(artenSet));
      return Array.from(artenSet);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenarten:', error);
      return [];
    }
  }

  /**
   * Rendert die dynamischen Sections basierend auf Kampagnenarten
   * NUR Budget-Felder - Anzahl wird über Kampagnen gepflegt
   * @param {string[]} kampagnenarten - Array von Kampagnenarten-Namen
   * @param {object} existingValues - Bestehende Werte (optional)
   */
  renderDynamicSections(kampagnenarten, existingValues = {}) {
    const container = document.getElementById('kampagnenart-sections-container');
    if (!container) return;
    
    if (kampagnenarten.length === 0) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <p>Für diesen Auftrag wurden noch keine Kampagnenarten hinterlegt.</p>
          <p>Bitte wählen Sie einen Auftrag mit Kampagnenarten oder fügen Sie erst Kampagnenarten zum Auftrag hinzu.</p>
        </div>
      `;
      return;
    }
    
    // Generiere Sections für jede Kampagnenart - NUR Budget
    let sectionsHtml = `
      <div class="alert alert-info" style="margin-bottom: var(--space-md);">
        <p><strong>Hinweis:</strong> Die Anzahl der Videos, Creator und Bilder wird beim Erstellen der Kampagnen festgelegt und automatisch hierher übertragen.</p>
      </div>
    `;
    kampagnenarten.forEach(artName => {
      const config = KAMPAGNENARTEN_MAPPING[artName];
      if (config) {
        sectionsHtml += generateBudgetOnlyFieldsHtml(artName, existingValues);
      } else {
        console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
      }
    });
    
    container.innerHTML = sectionsHtml;
  }

  // Events binden
  bindFormEvents() {
    const form = document.getElementById('auftragsdetails-form');
    if (!form) return;

    // Auftrag-Auswahl Listener: Kampagnenarten laden und Sections rendern
    const auftragSelect = document.getElementById('auftrag_id');
    if (auftragSelect) {
      auftragSelect.addEventListener('change', async (e) => {
        const auftragId = e.target.value;
        const kampagnenField = document.getElementById('kampagnenanzahl');
        
        if (!auftragId) {
          // Kein Auftrag ausgewählt - Reset
          if (kampagnenField) {
            kampagnenField.value = '';
            kampagnenField.style.backgroundColor = '';
          }
          this.renderDynamicSections([]);
          return;
        }
        
        // Kampagnenanzahl vom Auftrag übernehmen
        const selectedAuftrag = this.auftraege.find(a => a.id === auftragId);
        if (selectedAuftrag?.kampagnenanzahl && kampagnenField) {
          kampagnenField.value = selectedAuftrag.kampagnenanzahl;
          kampagnenField.style.backgroundColor = '#f5f5f5';
          console.log(`✅ Kampagnenanzahl ${selectedAuftrag.kampagnenanzahl} vom Auftrag übernommen`);
        } else if (kampagnenField) {
          kampagnenField.value = '';
          kampagnenField.style.backgroundColor = '';
        }
        
        // Lade Kampagnenarten für diesen Auftrag
        console.log('🔄 Lade Kampagnenarten für Auftrag:', auftragId);
        const kampagnenarten = await this.loadKampagnenartenForAuftrag(auftragId);
        this.currentKampagnenarten = kampagnenarten;
        
        // Lade bestehende auftrag_details Werte (falls vorhanden)
        let existingValues = {};
        try {
          const { data } = await window.supabase
            .from('auftrag_details')
            .select('*')
            .eq('auftrag_id', auftragId)
            .maybeSingle();
          if (data) {
            existingValues = data;
          }
        } catch (e) {
          console.warn('⚠️ Keine bestehenden auftrag_details gefunden');
        }
        
        // Rendere Sections
        this.renderDynamicSections(kampagnenarten, existingValues);
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

      // Sammle alle Felder
      for (let [key, value] of formData.entries()) {
        // Leere Werte als null speichern
        if (value === '' || value === null) {
          data[key] = null;
        } else if (key.endsWith('_anzahl') || key === 'gesamt_videos' || key === 'gesamt_creator' || key === 'kampagnenanzahl') {
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

      // Prüfe ob bereits Details existieren
      const { data: existing, error: checkError } = await window.supabase
        .from('auftrag_details')
        .select('id')
        .eq('auftrag_id', data.auftrag_id)
        .maybeSingle();

      let result;
      if (existing?.id) {
        // Update
        const { data: updated, error } = await window.supabase
          .from('auftrag_details')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
        console.log('✅ Auftragsdetails erfolgreich aktualisiert:', result);
      } else {
        // Insert
        const { data: created, error } = await window.supabase
          .from('auftrag_details')
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        result = created;
        console.log('✅ Auftragsdetails erfolgreich erstellt:', result);
      }
      
      // Success-State für Button
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
      }
      
      // Erfolgs-Benachrichtigung anzeigen
      window.showNotification?.('Auftragsdetails erfolgreich gespeichert', 'success');
      
      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'auftrag_details', id: result.id, action: existing ? 'updated' : 'created' } 
      }));
      
      // Kurz warten damit Success-State sichtbar ist, dann navigieren
      setTimeout(() => {
        window.navigateTo('/auftragsdetails');
      }, 400);

    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsCreate.handleFormSubmit');
      window.showNotification?.(`Fehler beim Speichern: ${error.message}`, 'error') || alert(`❌ Fehler beim Speichern der Auftragsdetails: ${error.message}`);

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
