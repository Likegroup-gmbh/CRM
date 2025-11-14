// TaskCreateDrawer.js - Drawer für Aufgaben-Erstellung
// Slide-in Drawer mit Kampagnen- und Kooperations-Auswahl

export class TaskCreateDrawer {
  constructor() {
    this.drawerId = 'task-create-drawer';
    this.initialStatus = 'todo';
    this.kampagnen = [];
    this.mitarbeiter = [];
    this.kunden = [];
  }

  async open(initialStatus = 'todo') {
    console.log('🆕 TaskCreateDrawer: open() mit Status:', initialStatus);
    this.initialStatus = initialStatus;
    
    try {
      await this.createDrawer();
      this.showLoading();
      
      // Lade nur Kampagnen - Mitarbeiter/Kunden werden erst nach Kampagnen-Auswahl geladen
      await this.loadKampagnen();
      
      this.renderForm();
      this.bindFormEvents();
      
      // Initial die leeren Dropdowns anzeigen
      this.updateAssignmentDropdowns();
    } catch (error) {
      console.error('❌ TaskCreateDrawer.open Fehler:', error);
      this.showError('Fehler beim Öffnen des Formulars.');
    }
  }

  async createDrawer() {
    this.removeDrawer();

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Neue Aufgabe erstellen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Erstelle eine neue Aufgabe für eine Kampagne';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  showLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = '<div style="padding: 2rem; text-align: center;">Laden...</div>';
    }
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = `<div style="padding: 2rem; color: var(--error-600);">${message}</div>`;
    }
  }

  async loadKampagnen() {
    try {
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .order('kampagnenname');
      
      if (error) throw error;
      this.kampagnen = data || [];
      console.log('✅ Kampagnen geladen:', this.kampagnen.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen:', error);
      this.kampagnen = [];
    }
  }

  async loadMitarbeiter(kampagneId = null) {
    try {
      if (!kampagneId) {
        // Keine Kampagne ausgewählt - leere Liste
        this.mitarbeiter = [];
        return;
      }

      // Lade Mitarbeiter die dieser Kampagne zugeordnet sind
      const { data, error } = await window.supabase
        .from('kampagne_mitarbeiter')
        .select('mitarbeiter:mitarbeiter_id(id, name, rolle, profile_image_url)')
        .eq('kampagne_id', kampagneId);
      
      if (error) {
        console.error('❌ Fehler beim Laden der Mitarbeiter:', error);
        this.mitarbeiter = [];
        return;
      }
      
      this.mitarbeiter = (data || [])
        .map(item => item.mitarbeiter)
        .filter(Boolean);
      console.log('✅ Mitarbeiter geladen für Kampagne:', this.mitarbeiter.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Mitarbeiter:', error);
      this.mitarbeiter = [];
    }
  }

  async loadKunden(kampagneId = null) {
    try {
      if (!kampagneId) {
        // Keine Kampagne ausgewählt - leere Liste
        this.kunden = [];
        return;
      }

      // Prüfe ob User Admin/Mitarbeiter ist
      const isAdminOrMitarbeiter = window.currentUser?.rolle === 'admin' || 
                                    window.currentUser?.rolle === 'mitarbeiter';
      
      if (!isAdminOrMitarbeiter) {
        // Kunden sehen kein Kunden-Dropdown
        this.kunden = [];
        return;
      }

      // Lade die Kampagne mit marke_id und unternehmen_id
      const { data: kampagneData, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('marke_id, unternehmen_id')
        .eq('id', kampagneId)
        .single();
      
      if (kampagneError || !kampagneData) {
        console.error('❌ Fehler beim Laden der Kampagne:', kampagneError);
        this.kunden = [];
        return;
      }

      let kundenData;

      // Fall 1: Kampagne hat eine Marke → Lade Kunden über kunde_marke
      if (kampagneData.marke_id) {
        const { data, error } = await window.supabase
          .from('kunde_marke')
          .select('kunde:kunde_id(id, name, rolle, profile_image_url)')
          .eq('marke_id', kampagneData.marke_id);
        
        if (error) {
          console.error('❌ Fehler beim Laden der Kunden über Marke:', error);
          this.kunden = [];
          return;
        }
        kundenData = data;
        console.log('✅ Kunden über Marke geladen:', data?.length || 0);
      }
      // Fall 2: Kampagne hat keine Marke → Lade Kunden über kunde_unternehmen
      else if (kampagneData.unternehmen_id) {
        const { data, error } = await window.supabase
          .from('kunde_unternehmen')
          .select('kunde:kunde_id(id, name, rolle, profile_image_url)')
          .eq('unternehmen_id', kampagneData.unternehmen_id);
        
        if (error) {
          console.error('❌ Fehler beim Laden der Kunden über Unternehmen:', error);
          this.kunden = [];
          return;
        }
        kundenData = data;
        console.log('✅ Kunden über Unternehmen geladen:', data?.length || 0);
      }
      else {
        console.warn('⚠️ Kampagne hat weder Marke noch Unternehmen');
        this.kunden = [];
        return;
      }
      
      this.kunden = (kundenData || [])
        .map(item => item.kunde)
        .filter(Boolean);
      console.log('✅ Kunden final geladen für Kampagne:', this.kunden.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kunden:', error);
      this.kunden = [];
    }
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    const html = `
      <form id="task-create-form" class="drawer-form">
        <!-- Validation Error Display -->
        <div id="task-create-error" class="drawer-form-error"></div>
        
        <!-- Kampagne Auswahl - PFLICHTFELD -->
        <div class="form-field">
          <label for="kampagne_id" class="drawer-form-label">
            Kampagne *
          </label>
          <select 
            id="kampagne_id" 
            name="kampagne_id" 
            class="form-input drawer-form-select"
            required>
            <option value="">Kampagne auswählen...</option>
            ${this.kampagnen.map(k => `<option value="${k.id}">${safe(k.kampagnenname)}</option>`).join('')}
          </select>
        </div>

        <!-- Titel -->
        <div class="form-field">
          <label for="task_title" class="drawer-form-label">
            Titel *
          </label>
          <input 
            type="text" 
            id="task_title" 
            name="title" 
            class="form-input drawer-form-input" 
            required
            placeholder="z.B. Skript erstellen" />
        </div>

        <!-- Beschreibung -->
        <div class="form-field">
          <label for="task_description" class="drawer-form-label">
            Beschreibung
          </label>
          <textarea 
            id="task_description" 
            name="description" 
            class="form-input drawer-form-textarea" 
            rows="4"
            placeholder="Weitere Details zur Aufgabe..."></textarea>
        </div>

        <!-- Grid für Priorität und Fälligkeitsdatum -->
        <div class="drawer-form-grid">
          <!-- Priorität -->
          <div class="form-field">
            <label for="task_priority" class="drawer-form-label">
              Priorität
            </label>
            <select 
              id="task_priority" 
              name="priority" 
              class="form-input drawer-form-select">
              <option value="low">Niedrig</option>
              <option value="medium" selected>Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>

          <!-- Fälligkeitsdatum -->
          <div class="form-field">
            <label for="task_due_date" class="drawer-form-label">
              Fälligkeitsdatum
            </label>
            <input 
              type="date" 
              id="task_due_date" 
              name="due_date" 
              class="form-input drawer-form-input" />
          </div>
        </div>

        <!-- Zuweisen an Mitarbeiter / Kunde - Container für dynamisches Update -->
        <div id="assignment-dropdowns-container">
          <!-- Dropdowns werden hier dynamisch eingefügt nach Kampagnen-Auswahl -->
        </div>

        <!-- Hidden Status Field -->
        <input type="hidden" name="status" value="${this.initialStatus}" />

        <!-- Actions -->
        <div class="drawer-actions">
          <button 
            type="submit" 
            class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__label">Aufgabe erstellen</span>
          </button>
          <button 
            type="button" 
            id="task-create-cancel" 
            class="secondary-btn">
            Abbrechen
          </button>
        </div>
      </form>
    `;

    body.innerHTML = html;
    
    // Fokus auf Titel-Feld setzen
    setTimeout(() => {
      document.getElementById('task_title')?.focus();
    }, 100);
  }

  bindFormEvents() {
    const form = document.getElementById('task-create-form');
    const cancelBtn = document.getElementById('task-create-cancel');
    const errorDiv = document.getElementById('task-create-error');
    const kampagneSelect = document.getElementById('kampagne_id');

    // Event-Listener für Kampagnen-Auswahl
    if (kampagneSelect) {
      kampagneSelect.addEventListener('change', async (e) => {
        const kampagneId = e.target.value;
        
        if (!kampagneId) {
          // Keine Kampagne ausgewählt - Listen leeren und Dropdowns verstecken
          this.mitarbeiter = [];
          this.kunden = [];
          this.updateAssignmentDropdowns();
          return;
        }

        // Lade Mitarbeiter und Kunden für die ausgewählte Kampagne
        console.log('📋 Kampagne ausgewählt, lade Mitarbeiter und Kunden...');
        await Promise.all([
          this.loadMitarbeiter(kampagneId),
          this.loadKunden(kampagneId)
        ]);
        
        // Aktualisiere nur die Zuweisungs-Dropdowns (nicht das ganze Formular)
        this.updateAssignmentDropdowns();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset error
        if (errorDiv) {
          errorDiv.style.display = 'none';
          errorDiv.textContent = '';
        }

        const formData = new FormData(form);
        const kampagneId = formData.get('kampagne_id');

        // Validation: Kampagne ist Pflichtfeld
        if (!kampagneId) {
          if (errorDiv) {
            errorDiv.textContent = 'Bitte wähle eine Kampagne aus.';
            errorDiv.style.display = 'block';
          }
          return;
        }

        await this.handleSubmit(formData);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
  }

  updateAssignmentDropdowns() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    // Container für die Zuweisungs-Dropdowns
    const assignmentContainer = document.getElementById('assignment-dropdowns-container');
    if (!assignmentContainer) return;

    // Prüfe ob Kampagne ausgewählt ist
    const kampagneSelect = document.getElementById('kampagne_id');
    const hasKampagne = kampagneSelect?.value;

    // HTML für Mitarbeiter-Dropdown (immer anzeigen)
    const mitarbeiterHtml = `
      <div class="form-field">
        <label for="task_assigned_to_mitarbeiter" class="drawer-form-label">
          Zuweisen an Mitarbeiter
        </label>
        <select 
          id="task_assigned_to_mitarbeiter" 
          name="assigned_to_user_id" 
          class="form-input drawer-form-select"
          ${!hasKampagne ? 'disabled' : ''}>
          ${!hasKampagne 
            ? '<option value="">Bitte wähle zuerst eine Kampagne</option>'
            : this.mitarbeiter.length > 0
              ? '<option value="">Nicht zugewiesen</option>' + this.mitarbeiter.map(user => `<option value="${user.id}">${safe(user.name)}</option>`).join('')
              : '<option value="">Keine Mitarbeiter verfügbar</option>'
          }
        </select>
      </div>
    `;

    // Prüfe ob User Admin/Mitarbeiter ist für Kunden-Dropdown
    const isAdminOrMitarbeiter = window.currentUser?.rolle === 'admin' || 
                                  window.currentUser?.rolle === 'mitarbeiter';

    // HTML für Kunden-Dropdown (nur für Admins/Mitarbeiter, aber immer anzeigen)
    const kundenHtml = isAdminOrMitarbeiter ? `
      <div class="form-field">
        <label for="task_assigned_to_kunde" class="drawer-form-label">
          Zuweisen an Kunde
        </label>
        <select 
          id="task_assigned_to_kunde" 
          name="assigned_to_kunde_id" 
          class="form-input drawer-form-select"
          ${!hasKampagne ? 'disabled' : ''}>
          ${!hasKampagne 
            ? '<option value="">Bitte wähle zuerst eine Kampagne</option>'
            : this.kunden.length > 0
              ? '<option value="">Nicht zugewiesen</option>' + this.kunden.map(user => `<option value="${user.id}">${safe(user.name)}</option>`).join('')
              : '<option value="">Keine Kunden verfügbar</option>'
          }
        </select>
      </div>
    ` : '';

    // Aktualisiere den Container
    assignmentContainer.innerHTML = mitarbeiterHtml + kundenHtml;
  }

  async handleSubmit(formData) {
    console.log('🚀 TaskCreateDrawer: handleSubmit');
    
    try {
      const title = formData.get('title')?.trim();
      if (!title) {
        throw new Error('Titel ist erforderlich');
      }

      const kampagneId = formData.get('kampagne_id');
      if (!kampagneId) {
        throw new Error('Kampagne ist erforderlich');
      }

      const description = formData.get('description')?.trim() || null;
      const priority = formData.get('priority') || 'medium';
      const status = formData.get('status') || 'todo';
      const dueDate = formData.get('due_date') || null;
      const assignedToUserId = formData.get('assigned_to_user_id') || null;
      const assignedToKundeId = formData.get('assigned_to_kunde_id') || null;

      // Berechne sort_order (neue Tasks ans Ende)
      const { data: existingTasks } = await window.supabase
        .from('kooperation_tasks')
        .select('sort_order')
        .eq('status', status)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const maxSortOrder = existingTasks?.[0]?.sort_order || 0;

      const taskData = {
        title,
        description,
        status,
        priority,
        due_date: dueDate,
        category_id: null,  // Kategorie nicht mehr verwendet
        assigned_to_user_id: assignedToUserId,
        assigned_to_kunde_id: assignedToKundeId,  // NEUE SPALTE
        sort_order: maxSortOrder + 1,
        kampagne_id: kampagneId,
        kooperation_id: null,  // Kooperation nicht mehr verwendet
        entity_type: 'kampagne',  // Immer kampagne
        entity_id: kampagneId,
        created_by: window.currentUser?.id || null
      };

      console.log('💾 Erstelle Task:', taskData);

      const { data, error } = await window.supabase
        .from('kooperation_tasks')
        .insert(taskData)
        .select();

      if (error) {
        console.error('❌ Supabase Fehler:', error);
        throw error;
      }

      console.log('✅ Task erfolgreich erstellt:', data);

      window.notificationSystem?.success?.('Aufgabe erfolgreich erstellt.');
      
      // Trigger Refresh Event
      window.dispatchEvent(new CustomEvent('taskCreated', { 
        detail: { 
          taskId: data[0]?.id,
          kampagneId,
          entityType: 'kampagne',
          entityId: kampagneId
        } 
      }));
      
      this.close();
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Task:', error);
      window.notificationSystem?.error?.('Fehler beim Erstellen der Aufgabe: ' + error.message);
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeDrawer();
      }, 250); // Match CSS transition time
    } else {
      this.removeDrawer();
    }
  }

  removeDrawer() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    
    if (panel) panel.remove();
    if (overlay) overlay.remove();
  }
}

