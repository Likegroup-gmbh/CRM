// FeedbackCreateDrawer.js - Drawer für Feedback-Erstellung und -Bearbeitung

import {
  ICON_BUG_SM, ICON_FEATURE_SM, ICON_ADDITIONS_SM,
  FEEDBACK_AREAS
} from './FeedbackConstants.js';

export class FeedbackCreateDrawer {
  constructor() {
    this.drawerId = 'feedback-create-drawer';
    this.preselectedCategory = null;
    this.feedbackToEdit = null;
  }

  async open(preselectedCategory = null, feedbackToEdit = null) {
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
    const existingPanel = document.getElementById(this.drawerId);
    const existingOverlay = document.getElementById(`${this.drawerId}-overlay`);
    if (existingPanel) existingPanel.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

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

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => panel.classList.add('show'));
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) body.innerHTML = `<div class="drawer-error">${message}</div>`;
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const category = this.feedbackToEdit?.category || this.preselectedCategory;
    const priority = this.feedbackToEdit?.priority || 'medium';
    const description = this.feedbackToEdit?.description || '';
    const area = this.feedbackToEdit?.area || '';

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
                  ${ICON_BUG_SM}
                  <span>Bug melden</span>
                </span>
              </label>
              <label class="category-option ${category === 'feature' ? 'selected' : ''}">
                <input type="radio" name="category" value="feature" ${category === 'feature' ? 'checked' : ''}>
                <span class="category-option-content">
                  ${ICON_FEATURE_SM}
                  <span>Feature Wunsch</span>
                </span>
              </label>
              <label class="category-option ${category === 'additions' ? 'selected' : ''}">
                <input type="radio" name="category" value="additions" ${category === 'additions' ? 'checked' : ''}>
                <span class="category-option-content">
                  ${ICON_ADDITIONS_SM}
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

    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  }

  async handleSubmit() {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('is-loading'); }

    try {
      const categoryRadio = document.querySelector('input[name="category"]:checked');
      const category = categoryRadio ? categoryRadio.value : null;
      const priority = document.getElementById('feedback-priority').value;
      const description = document.getElementById('feedback-description').value.trim();
      const area = document.getElementById('feedback-area').value || null;

      if (!category || !description) {
        window.toastSystem?.show('Bitte alle Pflichtfelder ausfüllen', 'warning');
        return;
      }

      let data, error;

      if (this.isEditMode) {
        const result = await window.supabase
          .from('feedback')
          .update({ category, priority, description, area, updated_at: new Date().toISOString() })
          .eq('id', this.feedbackToEdit.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const status = category === 'additions' ? 'additions' : 'open';
        const result = await window.supabase
          .from('feedback')
          .insert({ category, priority, description, area, status, created_by: window.currentUser?.id })
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

      window.toastSystem?.show(
        this.isEditMode ? 'Feedback aktualisiert!' : 'Feedback erfolgreich gesendet!',
        'success'
      );
      window.dispatchEvent(new CustomEvent('feedbackCreated', { detail: data }));
      this.close();
    } catch (err) {
      console.error('❌ Unerwarteter Fehler:', err);
      window.toastSystem?.show('Unerwarteter Fehler', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('is-loading'); }
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeDrawer();
        this.feedbackToEdit = null;
        this.preselectedCategory = null;
      }, 300);
    } else {
      this.removeDrawer();
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
