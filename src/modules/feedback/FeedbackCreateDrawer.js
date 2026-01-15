// FeedbackCreateDrawer.js - Drawer für Feedback-Erstellung und -Bearbeitung
// Slide-in Drawer mit Kategorie, Priorität und Beschreibung

// Icons
const ICON_BUG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082" /></svg>`;

const ICON_FEATURE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`;

const ICON_ADDITIONS = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>`;

// Verfügbare Bereiche für das Feedback
const FEEDBACK_AREAS = [
  { value: '', label: '-- Kein Bereich --' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'aufgaben', label: 'Aufgaben' },
  { value: 'unternehmen', label: 'Unternehmen' },
  { value: 'marken', label: 'Marken' },
  { value: 'ansprechpartner', label: 'Ansprechpartner' },
  { value: 'creator', label: 'Creator' },
  { value: 'auftraege', label: 'Aufträge' },
  { value: 'auftragsdetails', label: 'Auftragsdetails' },
  { value: 'kampagnen', label: 'Kampagnen' },
  { value: 'strategie', label: 'Strategie' },
  { value: 'creator-sourcing', label: 'Sourcing' },
  { value: 'vertraege', label: 'Verträge' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'videos', label: 'Videos' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export class FeedbackCreateDrawer {
  constructor() {
    this.drawerId = 'feedback-create-drawer';
    this.preselectedCategory = null;
    this.feedbackToEdit = null; // Feedback-Objekt für Edit-Modus
  }

  async open(preselectedCategory = null, feedbackToEdit = null) {
    console.log('🆕 FeedbackCreateDrawer: open()', { preselectedCategory, feedbackToEdit });
    this.preselectedCategory = preselectedCategory;
    this.feedbackToEdit = feedbackToEdit;
    
    try {
      this.createDrawer();
      this.renderForm();
      this.bindFormEvents();
    } catch (error) {
      console.error('❌ FeedbackCreateDrawer.open Fehler:', error);
      this.showError('Fehler beim Öffnen des Formulars.');
    }
  }

  get isEditMode() {
    return !!this.feedbackToEdit;
  }

  createDrawer() {
    // Nur DOM-Elemente entfernen, nicht den State resetten
    const existingPanel = document.getElementById(this.drawerId);
    const existingOverlay = document.getElementById(`${this.drawerId}-overlay`);
    if (existingPanel) existingPanel.remove();
    if (existingOverlay) existingOverlay.remove();

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
    title.textContent = this.isEditMode ? 'Feedback bearbeiten' : 'Neues Feedback';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.isEditMode ? 'Änderungen am Feedback vornehmen' : 'Bug melden oder Feature vorschlagen';
    
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

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = `<div class="drawer-error">${message}</div>`;
    }
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    // Werte aus feedbackToEdit oder Defaults
    const category = this.feedbackToEdit?.category || this.preselectedCategory;
    const priority = this.feedbackToEdit?.priority || 'medium';
    const description = this.feedbackToEdit?.description || '';
    const area = this.feedbackToEdit?.area || '';

    // Area-Options generieren
    const areaOptionsHtml = FEEDBACK_AREAS.map(a => 
      `<option value="${a.value}" ${area === a.value ? 'selected' : ''}>${a.label}</option>`
    ).join('');

    body.innerHTML = `
      <form id="feedback-form" class="drawer-form feedback-form">
        
        <!-- Kategorie -->
        <div class="form-group">
          <label class="form-label" for="feedback-category">Kategorie *</label>
          <div class="category-select-wrapper">
            <div class="category-options">
              <label class="category-option ${category === 'bug' ? 'selected' : ''}">
                <input type="radio" name="category" value="bug" ${category === 'bug' ? 'checked' : ''} required>
                <span class="category-option-content">
                  ${ICON_BUG}
                  <span>Bug melden</span>
                </span>
              </label>
              <label class="category-option ${category === 'feature' ? 'selected' : ''}">
                <input type="radio" name="category" value="feature" ${category === 'feature' ? 'checked' : ''}>
                <span class="category-option-content">
                  ${ICON_FEATURE}
                  <span>Feature Wunsch</span>
                </span>
              </label>
              <label class="category-option ${category === 'additions' ? 'selected' : ''}">
                <input type="radio" name="category" value="additions" ${category === 'additions' ? 'checked' : ''}>
                <span class="category-option-content">
                  ${ICON_ADDITIONS}
                  <span>Ergänzung</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- Bereich -->
        <div class="form-group">
          <label class="form-label" for="feedback-area">Bereich</label>
          <select id="feedback-area" name="area" class="form-select">
            ${areaOptionsHtml}
          </select>
          <small class="form-hint">Optional: Welcher Bereich der App ist betroffen?</small>
        </div>

        <!-- Priorität -->
        <div class="form-group">
          <label class="form-label" for="feedback-priority">Priorität *</label>
          <select id="feedback-priority" name="priority" class="form-select" required>
            <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Mittel</option>
            <option value="low" ${priority === 'low' ? 'selected' : ''}>Niedrig</option>
            <option value="high" ${priority === 'high' ? 'selected' : ''}>Hoch</option>
          </select>
        </div>

        <!-- Beschreibung -->
        <div class="form-group">
          <label class="form-label" for="feedback-description">Beschreibung *</label>
          <textarea 
            id="feedback-description" 
            name="description" 
            class="form-textarea feedback-textarea" 
            rows="8" 
            placeholder="Beschreibe das Problem oder deinen Wunsch möglichst genau..."
            required
          >${description}</textarea>
          <small class="form-hint">
            Bei Bugs: Welche Schritte führen zum Problem? Was hast du erwartet?
          </small>
        </div>

        <!-- Actions -->
        <div class="drawer-actions">
          <button type="button" id="cancel-btn" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" id="submit-btn" class="mdc-btn mdc-btn--create">
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
            <span class="mdc-btn__label">${this.isEditMode ? 'Änderungen speichern' : 'Feedback senden'}</span>
          </button>
        </div>
      </form>
    `;
  }

  bindFormEvents() {
    const form = document.getElementById('feedback-form');
    const cancelBtn = document.getElementById('cancel-btn');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  }

  async handleSubmit() {
    const form = document.getElementById('feedback-form');
    const submitBtn = document.getElementById('submit-btn');

    // Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }

    try {
      const categoryRadio = document.querySelector('input[name="category"]:checked');
      const category = categoryRadio ? categoryRadio.value : null;
      const priority = document.getElementById('feedback-priority').value;
      const description = document.getElementById('feedback-description').value.trim();
      const area = document.getElementById('feedback-area').value || null;

      // Validierung
      if (!category || !description) {
        window.toastSystem?.show('Bitte alle Pflichtfelder ausfüllen', 'warning');
        return;
      }

      let data, error;

      if (this.isEditMode) {
        // UPDATE
        const result = await window.supabase
          .from('feedback')
          .update({
            category,
            priority,
            description,
            area,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.feedbackToEdit.id)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } else {
        // INSERT
        // Wenn Kategorie 'additions' ist, setze Status auf 'additions' statt 'open'
        const status = category === 'additions' ? 'additions' : 'open';
        
        const result = await window.supabase
          .from('feedback')
          .insert({
            category,
            priority,
            description,
            area,
            status,
            created_by: window.currentUser?.id
          })
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ Fehler beim Speichern:', error);
        window.toastSystem?.show('Fehler beim Speichern: ' + error.message, 'error');
        return;
      }

      console.log('✅ Feedback gespeichert:', data);
      window.toastSystem?.show(
        this.isEditMode ? 'Feedback aktualisiert!' : 'Feedback erfolgreich gesendet!', 
        'success'
      );

      // Event für Refresh (gleicher Event für Create und Update)
      window.dispatchEvent(new CustomEvent('feedbackCreated', { detail: data }));

      // Drawer schließen
      this.close();

    } catch (err) {
      console.error('❌ Unerwarteter Fehler:', err);
      window.toastSystem?.show('Unerwarteter Fehler', 'error');
    } finally {
      // Loading State zurücksetzen
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeDrawer();
        // Reset state nur beim Schließen
        this.feedbackToEdit = null;
        this.preselectedCategory = null;
      }, 300);
    } else {
      this.removeDrawer();
      // Reset state
      this.feedbackToEdit = null;
      this.preselectedCategory = null;
    }
  }

  removeDrawer() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    
    if (panel) panel.remove();
    if (overlay) overlay.remove();
  }
}
