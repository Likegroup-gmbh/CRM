// BewertungsSystem.js (ES6-Modul)
// Zentrale Bewertungs-Verwaltung für alle Entitäten

export class BewertungsSystem {
  constructor() {
    this.currentEntity = null;
    this.currentEntityId = null;
  }

  // Initialisiere Bewertungen für eine Entität
  async init(entityType, entityId) {
    console.log('⭐ BEWERTUNGSSYSTEM: Initialisiere für', entityType, entityId);
    this.currentEntity = entityType;
    this.currentEntityId = entityId;
  }

  // Lade Bewertungen für eine Entität
  async loadBewertungen(entityType, entityId) {
    console.log('🔄 BEWERTUNGSSYSTEM: Lade Bewertungen für', entityType, entityId);
    
    try {
      // Bestimme die richtige Tabelle basierend auf Entity-Type
      const tableName = this.getBewertungsTable(entityType);
      
      if (!tableName) {
        console.warn('⚠️ BEWERTUNGSSYSTEM: Keine Bewertungs-Tabelle für', entityType);
        return [];
      }

      // Spezielle Behandlung für Kooperationen (bewertung ist direkt in der Tabelle)
      if (entityType === 'kooperation') {
        const { data: kooperation, error } = await window.supabase
          .from('kooperationen')
          .select(`
            id,
            bewertung,
            created_at,
            updated_at
          `)
          .eq('id', entityId)
          .single();

        if (error) {
          console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kooperation:', error);
          return [];
        }

        // Wenn keine Bewertung vorhanden, leeres Array zurückgeben
        if (!kooperation.bewertung) {
          return [];
        }

        // Bewertung als Rating-Objekt formatieren
        return [{
          id: kooperation.id,
          rating: kooperation.bewertung,
          created_at: kooperation.created_at,
          updated_at: kooperation.updated_at,
          user_name: 'System'
        }];
      }

      // Normale Rating-Tabellen
      const { data: bewertungen, error } = await window.supabase
        .from(tableName)
        .select(`
          *,
          kampagne:kampagne_id (
            id,
            kampagnenname,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `)
        .eq(`${entityType}_id`, entityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:', error);
        return [];
      }

      console.log('✅ BEWERTUNGSSYSTEM: Bewertungen geladen:', bewertungen?.length || 0);
      return bewertungen || [];
      
    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:', error);
      return [];
    }
  }

  // Erstelle eine neue Bewertung
  async createBewertung(entityType, entityId, bewertungsData) {
    console.log('⭐ BEWERTUNGSSYSTEM: Erstelle Bewertung für', entityType, entityId);
    
    try {
      const tableName = this.getBewertungsTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Bewertungs-Tabelle für ${entityType} gefunden`);
      }

      // Spezielle Behandlung für Kooperationen
      if (entityType === 'kooperation') {
        const { data: updatedKooperation, error } = await window.supabase
          .from('kooperationen')
          .update({
            bewertung: bewertungsData.rating,
            updated_at: new Date().toISOString()
          })
          .eq('id', entityId)
          .select()
          .single();

        if (error) {
          throw new Error(`Fehler beim Erstellen der Bewertung: ${error.message}`);
        }

        console.log('✅ BEWERTUNGSSYSTEM: Bewertung erstellt:', updatedKooperation);
        return { success: true, data: updatedKooperation };
      }

      // Normale Rating-Tabellen
      const bewertungsPayload = {
        [`${entityType}_id`]: entityId,
        rating: bewertungsData.rating,
        user_name: bewertungsData.user_name || 'System',
        kampagne_id: bewertungsData.kampagne_id || null,
        created_at: new Date().toISOString()
      };

      const { data: newBewertung, error } = await window.supabase
        .from(tableName)
        .insert(bewertungsPayload)
        .select()
        .single();

      if (error) {
        throw new Error(`Fehler beim Erstellen der Bewertung: ${error.message}`);
      }

      console.log('✅ BEWERTUNGSSYSTEM: Bewertung erstellt:', newBewertung);
      return { success: true, data: newBewertung };
      
    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:', error);
      return { success: false, error: error.message };
    }
  }

  // Lösche eine Bewertung
  async deleteBewertung(entityType, bewertungsId) {
    console.log('🗑️ BEWERTUNGSSYSTEM: Lösche Bewertung', bewertungsId);
    
    try {
      const tableName = this.getBewertungsTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Bewertungs-Tabelle für ${entityType} gefunden`);
      }

      // Spezielle Behandlung für Kooperationen
      if (entityType === 'kooperation') {
        const { error } = await window.supabase
          .from('kooperationen')
          .update({
            bewertung: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', bewertungsId);

        if (error) {
          throw new Error(`Fehler beim Löschen der Bewertung: ${error.message}`);
        }

        console.log('✅ BEWERTUNGSSYSTEM: Bewertung gelöscht');
        return { success: true };
      }

      // Normale Rating-Tabellen
      const { error } = await window.supabase
        .from(tableName)
        .delete()
        .eq('id', bewertungsId);

      if (error) {
        throw new Error(`Fehler beim Löschen der Bewertung: ${error.message}`);
      }

      console.log('✅ BEWERTUNGSSYSTEM: Bewertung gelöscht');
      return { success: true };
      
    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Löschen der Bewertung:', error);
      return { success: false, error: error.message };
    }
  }

  // Aktualisiere eine Bewertung
  async updateBewertung(entityType, bewertungsId, bewertungsData) {
    console.log('✏️ BEWERTUNGSSYSTEM: Aktualisiere Bewertung', bewertungsId);
    
    try {
      const tableName = this.getBewertungsTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Bewertungs-Tabelle für ${entityType} gefunden`);
      }

      // Spezielle Behandlung für Kooperationen
      if (entityType === 'kooperation') {
        const { data: updatedKooperation, error } = await window.supabase
          .from('kooperationen')
          .update({
            bewertung: bewertungsData.rating,
            updated_at: new Date().toISOString()
          })
          .eq('id', bewertungsId)
          .select()
          .single();

        if (error) {
          throw new Error(`Fehler beim Aktualisieren der Bewertung: ${error.message}`);
        }

        console.log('✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:', updatedKooperation);
        return { success: true, data: updatedKooperation };
      }

      // Normale Rating-Tabellen
      const updatePayload = {
        rating: bewertungsData.rating,
        kampagne_id: bewertungsData.kampagne_id || null,
        updated_at: new Date().toISOString()
      };

      const { data: updatedBewertung, error } = await window.supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', bewertungsId)
        .select()
        .single();

      if (error) {
        throw new Error(`Fehler beim Aktualisieren der Bewertung: ${error.message}`);
      }

      console.log('✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:', updatedBewertung);
      return { success: true, data: updatedBewertung };
      
    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Aktualisieren der Bewertung:', error);
      return { success: false, error: error.message };
    }
  }

  // Bestimme die Bewertungs-Tabelle basierend auf Entity-Type
  getBewertungsTable(entityType) {
    const tableMapping = {
      'creator': 'creator_rating',
      // Für Unternehmen/Marke existieren aktuell keine separaten Rating-Tabellen
      // 'unternehmen': 'unternehmen_rating',
      // 'marke': 'marke_rating',
      // Kampagnen-Ratings laufen über creator_rating mit kampagne_id
      'kampagne': 'creator_rating',
      'kooperation': 'kooperationen', // Speziell für Kooperationen
      // Annahme: eigene Briefing-Rating-Tabelle vorhanden
      'briefing': 'briefing_rating',
      // 'rechnung': 'rechnung_rating'
    };

    return tableMapping[entityType] || null;
  }

  // Rendere Bewertungen-Container
  renderBewertungenContainer(bewertungen, entityType, entityId) {
    if (!bewertungen || bewertungen.length === 0) {
      return `
        <div class="bewertungen-container">
          <div class="empty-state">
            <p>Noch keine Bewertungen vorhanden.</p>
            <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${entityType}', '${entityId}')">
              Bewertung hinzufügen
            </button>
          </div>
        </div>
      `;
    }

    const bewertungenHtml = bewertungen.map(bewertung => `
      <div class="bewertung-card" data-bewertung-id="${bewertung.id}">
        <div class="bewertung-header">
          <div class="bewertung-stars">
            ${this.renderStars(bewertung.rating)}
          </div>
          <span class="bewertung-date">${this.formatDate(bewertung.created_at)}</span>
          <span class="bewertung-user">${bewertung.user_name || 'Unbekannt'}</span>
          <div class="bewertung-actions">
            <button class="icon-btn edit-bewertung" onclick="window.bewertungsSystem.showEditBewertungModal('${entityType}', '${bewertung.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-bewertung" onclick="window.bewertungsSystem.deleteBewertung('${entityType}', '${bewertung.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        ${bewertung.kampagne ? `
          <div class="bewertung-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${bewertung.kampagne.id}">${bewertung.kampagne.kampagnenname}</a></small>
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div class="bewertungen-container">
        ${bewertungenHtml}
        <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${entityType}', '${entityId}')">
          Neue Bewertung hinzufügen
        </button>
      </div>
    `;
  }

  // Rendere Sterne für Bewertungen
  renderStars(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(`<span class="star ${i <= rating ? 'filled' : ''}">★</span>`);
    }
    return stars.join('');
  }

  // Zeige Add Bewertung Modal
  showAddBewertungModal(entityType, entityId) {
    console.log('⭐ BEWERTUNGSSYSTEM: Zeige Add Bewertung Modal für', entityType, entityId);
    
    // Modal HTML erstellen
    const modalHtml = `
      <div class="modal-overlay" id="bewertung-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Bewertung hinzufügen</h3>
            <button class="modal-close" onclick="window.bewertungsSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-bewertung-form">
              <div class="form-group">
                <label>Bewertung</label>
                <div class="rating-input">
                  <div class="stars-container">
                    <span class="star-input" data-rating="1">★</span>
                    <span class="star-input" data-rating="2">★</span>
                    <span class="star-input" data-rating="3">★</span>
                    <span class="star-input" data-rating="4">★</span>
                    <span class="star-input" data-rating="5">★</span>
                  </div>
                  <input type="hidden" id="bewertung-rating" name="rating" value="0" required>
                  <div class="rating-text">Bitte wählen Sie eine Bewertung</div>
                </div>
              </div>
              <div class="form-group">
                <label for="bewertung-kampagne">Kampagne (optional)</label>
                <select id="bewertung-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.bewertungsSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Bewertung speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Modal anzeigen
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Kampagnen laden
    this.loadKampagnenForSelect();
    
    // Sterne-Events binden
    this.bindStarEvents();
    
    // Formular-Events binden
    this.bindBewertungFormEvents(entityType, entityId);
  }

  // Zeige Edit Bewertung Modal
  showEditBewertungModal(entityType, bewertungsId) {
    console.log('✏️ BEWERTUNGSSYSTEM: Zeige Edit Bewertung Modal für', entityType, bewertungsId);
    
    // TODO: Implementiere Edit Modal
    console.log('TODO: Edit Bewertung Modal implementieren');
  }

  // Lade Kampagnen für Select
  async loadKampagnenForSelect() {
    try {
      const { data: kampagnen, error } = await window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagnenname,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        `)
        .order('kampagnenname');

      if (!error && kampagnen) {
        const select = document.getElementById('bewertung-kampagne');
        if (select) {
          kampagnen.forEach(kampagne => {
            const option = document.createElement('option');
            option.value = kampagne.id;
            option.textContent = `${kampagne.kampagnenname} (${kampagne.unternehmen?.firmenname || 'Unbekannt'})`;
            select.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kampagnen:', error);
    }
  }

  // Binde Sterne-Events
  bindStarEvents() {
    const stars = document.querySelectorAll('.star-input');
    const ratingInput = document.getElementById('bewertung-rating');
    const ratingText = document.querySelector('.rating-text');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating);
        ratingInput.value = rating;
        
        // Sterne aktualisieren
        stars.forEach((s, index) => {
          s.classList.toggle('filled', index < rating);
        });
        
        // Text aktualisieren
        const texts = ['', 'Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut'];
        ratingText.textContent = texts[rating] || 'Bitte wählen Sie eine Bewertung';
      });

      star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.dataset.rating);
        stars.forEach((s, index) => {
          s.classList.toggle('filled', index < rating);
        });
      });

      star.addEventListener('mouseleave', () => {
        const currentRating = parseInt(ratingInput.value) || 0;
        stars.forEach((s, index) => {
          s.classList.toggle('filled', index < currentRating);
        });
      });
    });
  }

  // Binde Bewertungs-Formular Events
  bindBewertungFormEvents(entityType, entityId) {
    const form = document.getElementById('add-bewertung-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleBewertungSubmit(entityType, entityId);
      };
    }
  }

  // Handle Bewertung Submit
  async handleBewertungSubmit(entityType, entityId) {
    try {
      const form = document.getElementById('add-bewertung-form');
      const formData = new FormData(form);
      
      const rating = parseInt(formData.get('rating'));
      if (rating === 0) {
        this.showErrorMessage('Bitte wählen Sie eine Bewertung aus.');
        return;
      }
      
      const bewertungsData = {
        rating: rating,
        kampagne_id: formData.get('kampagne_id') || null,
        user_name: 'Aktueller Benutzer' // TODO: Echten Benutzer verwenden
      };

      const result = await this.createBewertung(entityType, entityId, bewertungsData);

      if (result.success) {
        this.showSuccessMessage('Bewertung erfolgreich erstellt!');
        this.closeModal();
        
        // Event auslösen für Neuladen der Bewertungen
        window.dispatchEvent(new CustomEvent('bewertungenUpdated', {
          detail: { entityType, entityId }
        }));
      } else {
        this.showErrorMessage(result.error);
      }

    } catch (error) {
      console.error('❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:', error);
      this.showErrorMessage(error.message);
    }
  }

  // Modal schließen
  closeModal() {
    const modal = document.getElementById('bewertung-modal');
    if (modal) {
      modal.remove();
    }
  }

  // Success Message anzeigen
  showSuccessMessage(message) {
    // TODO: Implementiere Success Message
    console.log('✅', message);
  }

  // Error Message anzeigen
  showErrorMessage(message) {
    // TODO: Implementiere Error Message
    console.error('❌', message);
  }

  // Hilfsfunktionen
  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  }

  // Cleanup
  destroy() {
    console.log('🗑️ BEWERTUNGSSYSTEM: Destroy aufgerufen');
    this.closeModal();
  }
}

export const bewertungsSystem = new BewertungsSystem(); 