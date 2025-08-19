// NotizenSystem.js (ES6-Modul)
// Zentrale Notizen-Verwaltung für alle Entitäten

export class NotizenSystem {
  constructor() {
    this.currentEntity = null;
    this.currentEntityId = null;
  }

  // Initialisiere Notizen für eine Entität
  async init(entityType, entityId) {
    console.log('📝 NOTIZENSYSTEM: Initialisiere für', entityType, entityId);
    this.currentEntity = entityType;
    this.currentEntityId = entityId;
  }

  // Lade Notizen für eine Entität
  async loadNotizen(entityType, entityId) {
    console.log('🔄 NOTIZENSYSTEM: Lade Notizen für', entityType, entityId);
    
    try {
      // Bestimme die richtige Tabelle basierend auf Entity-Type
      const tableName = this.getNotizenTable(entityType);
      
      if (!tableName) {
        console.warn('⚠️ NOTIZENSYSTEM: Keine Notizen-Tabelle für', entityType);
        return [];
      }

      // Nur creator_notiz hat eine FK-Beziehung zu kampagne_id → nur dort joinen
      let selectClause = '*';
      if (tableName === 'creator_notiz') {
        selectClause += `,
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
          )`;
      }

      const { data: notizen, error } = await window.supabase
        .from(tableName)
        .select(selectClause)
        .eq(`${entityType}_id`, entityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:', error);
        return [];
      }

      console.log('✅ NOTIZENSYSTEM: Notizen geladen:', notizen?.length || 0);
      return notizen || [];
      
    } catch (error) {
      console.error('❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:', error);
      return [];
    }
  }

  // Erstelle eine neue Notiz
  async createNotiz(entityType, entityId, notizData) {
    console.log('📝 NOTIZENSYSTEM: Erstelle Notiz für', entityType, entityId);
    
    try {
      const tableName = this.getNotizenTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Notizen-Tabelle für ${entityType} gefunden`);
      }

      const notizPayload = {
        [`${entityType}_id`]: entityId,
        text: notizData.text,
        user_name: notizData.user_name || 'System',
        kampagne_id: notizData.kampagne_id || null,
        created_at: new Date().toISOString()
      };

      const { data: newNotiz, error } = await window.supabase
        .from(tableName)
        .insert(notizPayload)
        .select()
        .single();

      if (error) {
        throw new Error(`Fehler beim Erstellen der Notiz: ${error.message}`);
      }

      console.log('✅ NOTIZENSYSTEM: Notiz erstellt:', newNotiz);
      return { success: true, data: newNotiz };
      
    } catch (error) {
      console.error('❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:', error);
      return { success: false, error: error.message };
    }
  }

  // Lösche eine Notiz
  async deleteNotiz(entityType, notizId) {
    console.log('🗑️ NOTIZENSYSTEM: Lösche Notiz', notizId);
    
    try {
      const tableName = this.getNotizenTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Notizen-Tabelle für ${entityType} gefunden`);
      }

      const { error } = await window.supabase
        .from(tableName)
        .delete()
        .eq('id', notizId);

      if (error) {
        throw new Error(`Fehler beim Löschen der Notiz: ${error.message}`);
      }

      console.log('✅ NOTIZENSYSTEM: Notiz gelöscht');
      return { success: true };
      
    } catch (error) {
      console.error('❌ NOTIZENSYSTEM: Fehler beim Löschen der Notiz:', error);
      return { success: false, error: error.message };
    }
  }

  // Aktualisiere eine Notiz
  async updateNotiz(entityType, notizId, notizData) {
    console.log('✏️ NOTIZENSYSTEM: Aktualisiere Notiz', notizId);
    
    try {
      const tableName = this.getNotizenTable(entityType);
      
      if (!tableName) {
        throw new Error(`Keine Notizen-Tabelle für ${entityType} gefunden`);
      }

      const updatePayload = {
        text: notizData.text,
        kampagne_id: notizData.kampagne_id || null,
        updated_at: new Date().toISOString()
      };

      const { data: updatedNotiz, error } = await window.supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', notizId)
        .select()
        .single();

      if (error) {
        throw new Error(`Fehler beim Aktualisieren der Notiz: ${error.message}`);
      }

      console.log('✅ NOTIZENSYSTEM: Notiz aktualisiert:', updatedNotiz);
      return { success: true, data: updatedNotiz };
      
    } catch (error) {
      console.error('❌ NOTIZENSYSTEM: Fehler beim Aktualisieren der Notiz:', error);
      return { success: false, error: error.message };
    }
  }

  // Bestimme die Notizen-Tabelle basierend auf Entity-Type
  getNotizenTable(entityType) {
    const tableMapping = {
      'creator': 'creator_notiz',
      // Für Unternehmen/Marke/Rechnung existieren aktuell keine separaten Notiz-Tabellen
      // 'unternehmen': 'unternehmen_notiz',
      // 'marke': 'marke_notiz',
      // Kampagnen-Notizen laufen über creator_notiz mit kampagne_id
      'kampagne': 'creator_notiz',
      // Annahme: eigene Briefing-Notizen-Tabelle vorhanden
      'briefing': 'briefing_notiz',
      'kooperation': 'kooperation_notiz',
      // 'rechnung': 'rechnung_notiz'
    };

    return tableMapping[entityType] || null;
  }

  // Rendere Notizen-Container
  renderNotizenContainer(notizen, entityType, entityId) {
    if (!notizen || notizen.length === 0) {
      return `
        <div class="notizen-container">
          <div class="empty-state">
            <p>Noch keine Notizen vorhanden.</p>
            <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${entityType}', '${entityId}')">
              Notiz hinzufügen
            </button>
          </div>
        </div>
      `;
    }

    const notizenHtml = notizen.map(notiz => `
      <div class="notiz-card" data-notiz-id="${notiz.id}">
        <div class="notiz-header">
          <span class="notiz-date">${this.formatDate(notiz.created_at)}</span>
          <span class="notiz-user">${notiz.user_name || 'Unbekannt'}</span>
          <div class="notiz-actions">
            <button class="icon-btn edit-notiz" onclick="window.notizenSystem.showEditNotizModal('${entityType}', '${notiz.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-notiz" onclick="window.notizenSystem.deleteNotiz('${entityType}', '${notiz.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        <div class="notiz-content">
          <p>${notiz.text}</p>
        </div>
        ${notiz.kampagne ? `
          <div class="notiz-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${notiz.kampagne.id}">${notiz.kampagne.kampagnenname}</a></small>
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div class="notizen-container">
        ${notizenHtml}
        <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${entityType}', '${entityId}')">
          Neue Notiz hinzufügen
        </button>
      </div>
    `;
  }

  // Zeige Add Notiz Modal
  showAddNotizModal(entityType, entityId) {
    console.log('📝 NOTIZENSYSTEM: Zeige Add Notiz Modal für', entityType, entityId);
    
    // Modal HTML erstellen
    const modalHtml = `
      <div class="modal-overlay" id="notiz-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Notiz hinzufügen</h3>
            <button class="modal-close" onclick="window.notizenSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-notiz-form">
              <div class="form-group">
                <label for="notiz-text">Notiz</label>
                <textarea id="notiz-text" name="text" rows="4" required placeholder="Notiz eingeben..."></textarea>
              </div>
              <div class="form-group">
                <label for="notiz-kampagne">Kampagne (optional)</label>
                <select id="notiz-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.notizenSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Notiz speichern</button>
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
    
    // Formular-Events binden
    this.bindNotizFormEvents(entityType, entityId);
  }

  // Zeige Edit Notiz Modal
  showEditNotizModal(entityType, notizId) {
    console.log('✏️ NOTIZENSYSTEM: Zeige Edit Notiz Modal für', entityType, notizId);
    
    // TODO: Implementiere Edit Modal
    console.log('TODO: Edit Notiz Modal implementieren');
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
        const select = document.getElementById('notiz-kampagne');
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
      console.error('❌ NOTIZENSYSTEM: Fehler beim Laden der Kampagnen:', error);
    }
  }

  // Binde Notiz-Formular Events
  bindNotizFormEvents(entityType, entityId) {
    const form = document.getElementById('add-notiz-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleNotizSubmit(entityType, entityId);
      };
    }
  }

  // Handle Notiz Submit
  async handleNotizSubmit(entityType, entityId) {
    try {
      const form = document.getElementById('add-notiz-form');
      const formData = new FormData(form);
      
      const notizData = {
        text: formData.get('text'),
        kampagne_id: formData.get('kampagne_id') || null,
        user_name: 'Aktueller Benutzer' // TODO: Echten Benutzer verwenden
      };

      const result = await this.createNotiz(entityType, entityId, notizData);

      if (result.success) {
        this.showSuccessMessage('Notiz erfolgreich erstellt!');
        this.closeModal();
        
        // Event auslösen für Neuladen der Notizen
        window.dispatchEvent(new CustomEvent('notizenUpdated', {
          detail: { entityType, entityId }
        }));
      } else {
        this.showErrorMessage(result.error);
      }

    } catch (error) {
      console.error('❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:', error);
      this.showErrorMessage(error.message);
    }
  }

  // Modal schließen
  closeModal() {
    const modal = document.getElementById('notiz-modal');
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
    console.log('🗑️ NOTIZENSYSTEM: Destroy aufgerufen');
    this.closeModal();
  }
}

export const notizenSystem = new NotizenSystem(); 