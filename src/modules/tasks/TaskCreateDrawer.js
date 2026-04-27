// TaskCreateDrawer.js - Drawer für Aufgaben-Erstellung
// Slide-in Drawer mit Kampagnen- und Kooperations-Auswahl

import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class TaskCreateDrawer {
  constructor() {
    this.drawerId = 'task-create-drawer';
    this.initialStatus = 'todo';
    this.kampagnen = [];
    this.mitarbeiter = [];
    this.kunden = [];
    this.boundHandleEntityUpdate = null;
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
      
      // Alten Handler abmelden falls vorhanden
      if (this.boundHandleEntityUpdate) {
        window.removeEventListener('entityUpdated', this.boundHandleEntityUpdate);
      }

      // Event-Listener für Live-Updates hinzufügen
      this.boundHandleEntityUpdate = this.handleEntityUpdate.bind(this);
      window.addEventListener('entityUpdated', this.boundHandleEntityUpdate);
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
      const isAdmin = window.currentUser?.rolle === 'admin';
      const isKunde = window.currentUser?.rolle === 'kunde';
      let kampagneIds = [];

      // Für Kunden: Lade über kunde_marke und kunde_unternehmen
      if (isKunde) {
        console.log('🔍 Lade Kampagnen für Kunde:', window.currentUser?.id);
        
        // 1. Kampagnen über zugeordnete Marken
        const { data: kundeMarken, error: kundeMarkenError } = await window.supabase
          .from('kunde_marke')
          .select('marke_id')
          .eq('kunde_id', window.currentUser?.id);
        
        if (kundeMarkenError) console.error('❌ Fehler bei kunde_marke:', kundeMarkenError);
        const markenIds = (kundeMarken || []).map(r => r.marke_id).filter(Boolean);
        console.log('  ✓ Zugeordnete Marken:', markenIds.length);
        
        let markenKampagnenIds = [];
        if (markenIds.length > 0) {
          const { data: markenKampagnen, error: markenKampagnenError } = await window.supabase
            .from('kampagne')
            .select('id')
            .in('marke_id', markenIds);
          if (markenKampagnenError) console.error('❌ Fehler bei Marken-Kampagnen:', markenKampagnenError);
          markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          console.log('  ✓ Kampagnen über Marken:', markenKampagnenIds.length);
        }
        
        // 2. Kampagnen über zugeordnete Unternehmen
        const { data: kundeUnternehmen, error: kundeUnternehmenError } = await window.supabase
          .from('kunde_unternehmen')
          .select('unternehmen_id')
          .eq('kunde_id', window.currentUser?.id);
        
        if (kundeUnternehmenError) console.error('❌ Fehler bei kunde_unternehmen:', kundeUnternehmenError);
        const unternehmenIds = (kundeUnternehmen || []).map(r => r.unternehmen_id).filter(Boolean);
        console.log('  ✓ Zugeordnete Unternehmen:', unternehmenIds.length);
        
        let unternehmenKampagnenIds = [];
        if (unternehmenIds.length > 0) {
          const { data: unternehmenKampagnen, error: unternehmenKampagnenError } = await window.supabase
            .from('kampagne')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          if (unternehmenKampagnenError) console.error('❌ Fehler bei Unternehmen-Kampagnen:', unternehmenKampagnenError);
          unternehmenKampagnenIds = (unternehmenKampagnen || []).map(k => k.id).filter(Boolean);
          console.log('  ✓ Kampagnen über Unternehmen:', unternehmenKampagnenIds.length);
        }
        
        // Kombiniere und dedupliziere
        kampagneIds = [...new Set([...markenKampagnenIds, ...unternehmenKampagnenIds])];
        
        console.log(`🔍 Kunde ${window.currentUser?.id} hat Zugriff auf ${kampagneIds.length} Kampagnen`);
        console.log('  → IDs:', kampagneIds);
        
        if (kampagneIds.length === 0) {
          this.kampagnen = [];
          return;
        }
      }
      // Für Mitarbeiter: Lade über mitarbeiter-spezifische Junction-Tabellen
      else if (!isAdmin) {
        console.log('🔍 Lade Kampagnen für Mitarbeiter:', window.currentUser?.id);
        
        // 1. Direkt zugeordnete Kampagnen
        const { data: directAssignments, error: directError } = await window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        
        if (directError) console.error('❌ Fehler bei kampagne_mitarbeiter:', directError);
        const directIds = (directAssignments || []).map(r => r.kampagne_id).filter(Boolean);
        console.log('  ✓ Direkte Kampagnen:', directIds.length);
        
        // 2. Kampagnen über zugeordnete Marken
        const { data: markenAssignments, error: markenError } = await window.supabase
          .from('marke_mitarbeiter')
          .select('marke_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        
        if (markenError) console.error('❌ Fehler bei marke_mitarbeiter:', markenError);
        const markenIds = (markenAssignments || []).map(r => r.marke_id).filter(Boolean);
        console.log('  ✓ Zugeordnete Marken:', markenIds.length);
        
        let markenKampagnenIds = [];
        if (markenIds.length > 0) {
          const { data: markenKampagnen, error: markenKampagnenError } = await window.supabase
            .from('kampagne')
            .select('id')
            .in('marke_id', markenIds);
          if (markenKampagnenError) console.error('❌ Fehler bei Marken-Kampagnen:', markenKampagnenError);
          markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          console.log('  ✓ Kampagnen über Marken:', markenKampagnenIds.length);
        }
        
        // 3. Kampagnen über zugeordnete Unternehmen
        const { data: unternehmenAssignments, error: unternehmenError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        
        if (unternehmenError) console.error('❌ Fehler bei mitarbeiter_unternehmen:', unternehmenError);
        const unternehmenIds = (unternehmenAssignments || []).map(r => r.unternehmen_id).filter(Boolean);
        console.log('  ✓ Zugeordnete Unternehmen:', unternehmenIds.length);
        
        let unternehmenKampagnenIds = [];
        if (unternehmenIds.length > 0) {
          const { data: unternehmenKampagnen, error: unternehmenKampagnenError } = await window.supabase
            .from('kampagne')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          if (unternehmenKampagnenError) console.error('❌ Fehler bei Unternehmen-Kampagnen:', unternehmenKampagnenError);
          unternehmenKampagnenIds = (unternehmenKampagnen || []).map(k => k.id).filter(Boolean);
          console.log('  ✓ Kampagnen über Unternehmen:', unternehmenKampagnenIds.length);
        }
        
        // Kombiniere und dedupliziere
        kampagneIds = [...new Set([...directIds, ...markenKampagnenIds, ...unternehmenKampagnenIds])];
        
        console.log(`🔍 Mitarbeiter ${window.currentUser?.id} hat Zugriff auf ${kampagneIds.length} Kampagnen`);
        console.log('  → IDs:', kampagneIds);
        
        if (kampagneIds.length === 0) {
          this.kampagnen = [];
          return;
        }
      }

      // Haupt-Query
      let query = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name')
        .order('kampagnenname');
      
      // Für Nicht-Admins: Filter anwenden
      if (!isAdmin && kampagneIds.length > 0) {
        query = query.in('id', kampagneIds);
      }
      
      const { data, error } = await query;
      
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

      // Lade die Kampagne um marke_id und unternehmen_id zu bekommen
      const { data: kampagneData, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('marke_id, unternehmen_id')
        .eq('id', kampagneId)
        .single();
      
      if (kampagneError) {
        console.error('❌ Fehler beim Laden der Kampagne:', kampagneError);
        this.mitarbeiter = [];
        return;
      }

      const mitarbeiterMap = new Map();

      // 1. Direkt zugeordnete Mitarbeiter über kampagne_mitarbeiter
      const { data: direkteMitarbeiter, error: direktError } = await window.supabase
        .from('kampagne_mitarbeiter')
        .select('mitarbeiter:mitarbeiter_id(id, name, rolle, profile_image_url)')
        .eq('kampagne_id', kampagneId);
      
      if (!direktError && direkteMitarbeiter) {
        direkteMitarbeiter.forEach(item => {
          if (item.mitarbeiter) {
            mitarbeiterMap.set(item.mitarbeiter.id, item.mitarbeiter);
          }
        });
      }

      // 2. Mitarbeiter über zugeordnete Marke (falls vorhanden)
      if (kampagneData.marke_id) {
        const { data: markenMitarbeiter, error: markenError } = await window.supabase
          .from('marke_mitarbeiter')
          .select('mitarbeiter:mitarbeiter_id(id, name, rolle, profile_image_url)')
          .eq('marke_id', kampagneData.marke_id);
        
        if (!markenError && markenMitarbeiter) {
          markenMitarbeiter.forEach(item => {
            if (item.mitarbeiter) {
              mitarbeiterMap.set(item.mitarbeiter.id, item.mitarbeiter);
            }
          });
        }
      }

      // 3. Mitarbeiter über zugeordnetes Unternehmen (falls vorhanden)
      if (kampagneData.unternehmen_id) {
        const { data: unternehmenMitarbeiter, error: unternehmenError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('mitarbeiter:mitarbeiter_id(id, name, rolle, profile_image_url)')
          .eq('unternehmen_id', kampagneData.unternehmen_id);
        
        if (!unternehmenError && unternehmenMitarbeiter) {
          unternehmenMitarbeiter.forEach(item => {
            if (item.mitarbeiter) {
              mitarbeiterMap.set(item.mitarbeiter.id, item.mitarbeiter);
            }
          });
        }
      }

      // 4. Zusätzlich: Lade alle freigeschalteten Mitarbeiter (damit alle im Dropdown verfügbar sind)
      const { data: alleMitarbeiter, error: alleError } = await window.supabase
        .from('benutzer')
        .select('id, name, rolle, profile_image_url')
        .in('rolle', ['admin', 'mitarbeiter'])
        .eq('freigeschaltet', true);
      
      if (!alleError && alleMitarbeiter) {
        alleMitarbeiter.forEach(user => {
          // Nur hinzufügen wenn noch nicht vorhanden (zugeordnete haben Priorität)
          if (!mitarbeiterMap.has(user.id)) {
            mitarbeiterMap.set(user.id, user);
          }
        });
      }

      // Konvertiere Map zu Array (automatisch dedupliziert) und filtere den aktuellen User raus
      const currentUserId = window.currentUser?.id;
      this.mitarbeiter = Array.from(mitarbeiterMap.values())
        .filter(user => user.id !== currentUserId);
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
        .filter(kunde => kunde && kunde.rolle === 'kunde');
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
            ${this.kampagnen.map(k => `<option value="${k.id}">${safe(KampagneUtils.getDisplayName(k))}</option>`).join('')}
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
          <button type="button" id="task-create-cancel" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
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
            <span class="mdc-btn__label">Aufgabe erstellen</span>
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

    // Mitarbeiter: <select> mit createSimpleSearchableSelect
    const mitarbeiterOpts = hasKampagne
      ? this.mitarbeiter.map(user =>
          `<option value="${user.id}">${safe(user.name)}${user.rolle ? ` (${safe(user.rolle)})` : ''}</option>`
        ).join('')
      : '';

    const mitarbeiterHtml = `
      <div class="form-field">
        <label for="task_mitarbeiter_select" class="drawer-form-label">
          Zuweisen an Mitarbeiter
        </label>
        <select
          id="task_mitarbeiter_select"
          name="assigned_to_user_id"
          class="form-input"
          ${!hasKampagne ? 'disabled' : ''}>
          <option value="">${!hasKampagne ? 'Bitte wähle zuerst eine Kampagne' : 'Mitarbeiter suchen...'}</option>
          ${mitarbeiterOpts}
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

    // Bind Searchable Select wenn Kampagne ausgewählt
    if (hasKampagne && window.formSystem) {
      const mitarbeiterSelect = document.getElementById('task_mitarbeiter_select');
      if (mitarbeiterSelect) {
        const options = this.mitarbeiter.map(user => ({
          value: user.id,
          label: `${user.name}${user.rolle ? ` (${user.rolle})` : ''}`
        }));
        window.formSystem.createSimpleSearchableSelect(mitarbeiterSelect, options, {
          placeholder: 'Mitarbeiter suchen...'
        });
      }
    }
  }

  async handleSubmit(formData) {
    console.log('🚀 TaskCreateDrawer: handleSubmit');
    
    const submitBtn = document.querySelector(`#${this.drawerId} button[type="submit"]`);
    
    // Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }
    
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
    } finally {
      // Loading State zurücksetzen
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    }
  }

  close() {
    if (this.boundHandleEntityUpdate) {
      window.removeEventListener('entityUpdated', this.boundHandleEntityUpdate);
      this.boundHandleEntityUpdate = null;
    }
    
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

  handleEntityUpdate(event) {
    if (event.detail?.entity === 'kampagne' && event.detail?.action === 'staff-assigned') {
      console.log('🔄 Kampagne aktualisiert, lade neu...');
      this.loadKampagnen().then(() => {
        this.renderForm();
        this.bindFormEvents();
        this.updateAssignmentDropdowns();
      });
    }
  }
}

