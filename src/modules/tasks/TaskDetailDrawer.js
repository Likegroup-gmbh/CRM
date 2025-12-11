// TaskDetailDrawer.js - Drawer für Task-Details mit Tabs
// Basiert auf VersandManager.js & AuftragsDetailsManager.js Pattern
import { getTabIcon } from '../../core/TabUtils.js';

export class TaskDetailDrawer {
  constructor() {
    this.drawerId = 'task-detail-drawer';
    this.taskId = null;
    this.task = null;
    this.comments = [];
    this.attachments = [];
    this.history = [];
    this.availableMitarbeiter = [];
    this.availableKunden = [];
    this.categories = [];
  }

  bindEvents() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action="task-detail"]');
      if (trigger) {
        const taskId = trigger.dataset.taskId;
        if (taskId) this.open(taskId);
      }
    });
  }

  async open(taskId) {
    console.log('🎯 TaskDetailDrawer: open() mit ID:', taskId);
    try {
      this.taskId = taskId;
      await this.createDrawer();
      this.showLoading();

      // Paralleles Laden der Daten
      await Promise.all([
        this.loadTaskData(),
        this.loadComments(),
        this.loadAttachments(),
        this.loadHistory(),
        this.loadCategories()
      ]);

      await this.loadAvailableMitarbeiter();
      await this.loadAvailableKunden();
      
      this.renderContent();
      this.bindFormEvents();
    } catch (error) {
      console.error('❌ TaskDetailDrawer.open Fehler:', error);
      this.showError('Fehler beim Laden der Task-Details.');
    }
  }

  async createDrawer() {
    this.removeDrawer();

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
    title.textContent = 'Aufgabe';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Details, Kommentare und Verlauf';
    subtitle.id = `${this.drawerId}-subtitle`;
    
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

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  async loadTaskData() {
    const { data, error } = await window.supabase
      .from('kooperation_tasks')
      .select(`
        *,
        category:category_id(id, name),
        assigned_to:assigned_to_user_id(id, name, profile_image_url),
        assigned_kunde:assigned_to_kunde_id(id, name, profile_image_url),
        creator:created_by(id, name),
        kampagne:kampagne_id(
          id,
          kampagnenname,
          marke:marke_id(
            id,
            markenname,
            logo_url
          ),
          unternehmen:unternehmen_id(
            id,
            firmenname,
            logo_url
          )
        ),
        kooperation:kooperation_id(id, name)
      `)
      .eq('id', this.taskId)
      .single();
    
    if (error) throw error;
    this.task = data;
  }

  async loadComments() {
    const { data, error } = await window.supabase
      .from('kooperation_task_comments')
      .select('*')
      .eq('task_id', this.taskId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    
    if (!error) this.comments = data || [];
  }

  async loadAttachments() {
    const { data, error } = await window.supabase
      .from('kooperation_task_attachments')
      .select('*')
      .eq('task_id', this.taskId)
      .order('created_at', { ascending: false });
    
    if (!error) this.attachments = data || [];
  }

  async loadHistory() {
    const { data, error } = await window.supabase
      .from('kooperation_task_history')
      .select('*, changed_by_user:changed_by(name)')
      .eq('task_id', this.taskId)
      .order('created_at', { ascending: false });
    
    if (!error) this.history = data || [];
  }

  async loadCategories() {
    const { data, error } = await window.supabase
      .from('kampagne_status')
      .select('id, name')
      .order('sort_order', { ascending: true });
    
    if (!error) this.categories = data || [];
  }

  async loadAvailableMitarbeiter() {
    if (!this.task) return;
    
    try {
      // Lade alle freigeschalteten Mitarbeiter (wie bei TaskCreateDrawer)
      const { data: alleMitarbeiter, error } = await window.supabase
        .from('benutzer')
        .select('id, name, rolle, profile_image_url')
        .in('rolle', ['admin', 'mitarbeiter'])
        .eq('freigeschaltet', true)
        .order('name');
      
      if (error) {
        console.error('❌ Fehler beim Laden der Mitarbeiter:', error);
        this.availableMitarbeiter = [];
        return;
      }

      // Filtere den aktuellen User raus (man kann sich nicht selbst zuweisen)
      const currentUserId = window.currentUser?.id;
      this.availableMitarbeiter = (alleMitarbeiter || [])
        .filter(user => user.id !== currentUserId);
      
      console.log('✅ Mitarbeiter für TaskDetail geladen:', this.availableMitarbeiter.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Mitarbeiter:', error);
      this.availableMitarbeiter = [];
    }
  }

  async loadAvailableKunden() {
    // Lade Kunden basierend auf der Marke oder dem Unternehmen der Kampagne
    try {
      if (!this.task || !this.task.kampagne_id) {
        this.availableKunden = [];
        return;
      }

      // Prüfe ob User Admin/Mitarbeiter ist
      const isAdminOrMitarbeiter = window.currentUser?.rolle === 'admin' || 
                                    window.currentUser?.rolle === 'mitarbeiter';
      
      if (!isAdminOrMitarbeiter) {
        // Kunden sehen kein Kunden-Dropdown
        this.availableKunden = [];
        return;
      }

      // Lade die Kampagne mit marke_id und unternehmen_id
      const { data: kampagneData, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('marke_id, unternehmen_id')
        .eq('id', this.task.kampagne_id)
        .single();
      
      if (kampagneError || !kampagneData) {
        console.error('❌ Fehler beim Laden der Kampagne:', kampagneError);
        this.availableKunden = [];
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
          this.availableKunden = [];
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
          this.availableKunden = [];
          return;
        }
        kundenData = data;
        console.log('✅ Kunden über Unternehmen geladen:', data?.length || 0);
      }
      else {
        console.warn('⚠️ Kampagne hat weder Marke noch Unternehmen');
        this.availableKunden = [];
        return;
      }
      
      this.availableKunden = (kundenData || [])
        .map(item => item.kunde)
        .filter(kunde => kunde && kunde.rolle === 'kunde');
      
      console.log('✅ Kunden final geladen für Task:', this.availableKunden.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kunden:', error);
      this.availableKunden = [];
    }
  }

  async getKampagneIdForKooperation(kooperationId) {
    const { data } = await window.supabase
      .from('kooperationen')
      .select('kampagne_id')
      .eq('id', kooperationId)
      .single();
    return data?.kampagne_id;
  }

  showLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = '<div class="drawer-loading">Lade Task-Details...</div>';
    }
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = `<div class="drawer-error">${window.validatorSystem?.sanitizeHtml?.(message) || message}</div>`;
    }
  }

  renderContent() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body || !this.task) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    const formatDateTime = (date) => date ? new Date(date).toLocaleString('de-DE') : '-';

    // Berechtigungsprüfung - Nur Ersteller darf bearbeiten
    const currentUserId = window.currentUser?.id;
    const taskCreatorId = this.task.created_by;
    
    console.log('🔐 TaskDetailDrawer Berechtigungsprüfung:', {
      currentUserId,
      taskCreatorId,
      idsMatch: currentUserId && taskCreatorId && String(currentUserId) === String(taskCreatorId)
    });
    
    // Explizite Prüfung: Nur wenn User der Ersteller ist
    const isCreator = currentUserId && taskCreatorId && String(currentUserId) === String(taskCreatorId);
    const canEdit = isCreator;
    
    console.log('🔐 Ergebnis:', { canEdit });

    // Update Subtitle
    const subtitle = document.getElementById(`${this.drawerId}-subtitle`);
    if (subtitle) subtitle.textContent = safe(this.task.title);

    const html = `
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="details">
          <span class="tab-icon">${getTabIcon('details')}</span>
          Details
        </button>
        <button class="tab-button" data-tab="comments">
          <span class="tab-icon">${getTabIcon('notizen')}</span>
          Kommentare<span class="tab-count">${this.comments.length}</span>
        </button>
        <button class="tab-button" data-tab="attachments">
          <span class="tab-icon">${getTabIcon('dateien')}</span>
          Anhänge<span class="tab-count">${this.attachments.length}</span>
        </button>
        <button class="tab-button" data-tab="history">
          <span class="tab-icon">${getTabIcon('history')}</span>
          Verlauf<span class="tab-count">${this.history.length}</span>
        </button>
      </div>

      <div class="tab-content">
        <!-- Tab: Details -->
        <div class="tab-pane active" id="tab-details">
          ${canEdit ? this.renderDetailsEditable() : this.renderDetailsReadOnly()}
        </div>

        <!-- Tab: Kommentare -->
        <div class="tab-pane" id="tab-comments">
          <div class="detail-section">
            ${this.renderComments()}
            <h3 class="section-title">Neuer Kommentar</h3>
            <form id="comment-form">
              <div class="form-field">
                <textarea name="text" class="form-input" rows="3" placeholder="Kommentar eingeben..." required></textarea>
              </div>
              <button type="submit" class="mdc-btn mdc-btn--create">
                <span class="mdc-btn__label">Kommentar hinzufügen</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Tab: Anhänge -->
        <div class="tab-pane" id="tab-attachments">
          <div class="detail-section">
            ${this.renderAttachments()}
            <h3 class="section-title">Neuen Anhang hinzufügen</h3>
            <form id="attachment-form">
              <div class="form-field">
                <label>Datei-URL</label>
                <input type="url" name="file_url" class="form-input" placeholder="https://..." required />
              </div>
              <button type="submit" class="mdc-btn mdc-btn--create">
                <span class="mdc-btn__label">Anhang hinzufügen</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Tab: Verlauf -->
        <div class="tab-pane" id="tab-history">
          <div class="detail-section">
            ${this.renderHistory()}
          </div>
        </div>
      </div>
    `;

    body.innerHTML = html;

    // Tab-Switching
    body.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  }

  renderDetailsEditable() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    return `
      <form id="task-detail-form" class="detail-section">
        <div class="form-field">
          <label>Titel *</label>
          <input type="text" name="title" class="form-input" value="${safe(this.task.title)}" required />
        </div>

        <div class="form-field">
          <label>Beschreibung</label>
          <textarea name="description" class="form-input" rows="4">${safe(this.task.description || '')}</textarea>
        </div>

        <div class="form-grid form-grid-2">
          <div class="form-field">
            <label>Status *</label>
            <select name="status" class="form-input">
              <option value="todo" ${this.task.status === 'todo' ? 'selected' : ''}>To-Do</option>
              <option value="in_progress" ${this.task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="completed" ${this.task.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </div>

          <div class="form-field">
            <label>Priorität</label>
            <select name="priority" class="form-input">
              <option value="low" ${this.task.priority === 'low' ? 'selected' : ''}>Niedrig</option>
              <option value="medium" ${this.task.priority === 'medium' ? 'selected' : ''}>Mittel</option>
              <option value="high" ${this.task.priority === 'high' ? 'selected' : ''}>Hoch</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label>Fälligkeitsdatum</label>
          <input type="date" name="due_date" class="form-input" value="${this.task.due_date || ''}" />
        </div>

        <div class="form-field">
          <label>Zugewiesen an Mitarbeiter</label>
          <select name="assigned_to_user_id" class="form-input">
            <option value="">– Nicht zugewiesen –</option>
            ${this.availableMitarbeiter.map(user => `
              <option value="${user.id}" ${this.task.assigned_to_user_id === user.id ? 'selected' : ''}>
                ${safe(user.name)}
              </option>
            `).join('')}
          </select>
        </div>

        ${this.availableKunden.length > 0 ? `
        <div class="form-field">
          <label>Zugewiesen an Kunde</label>
          <select name="assigned_to_kunde_id" class="form-input">
            <option value="">– Nicht zugewiesen –</option>
            ${this.availableKunden.map(user => `
              <option value="${user.id}" ${this.task.assigned_to_kunde_id === user.id ? 'selected' : ''}>
                ${safe(user.name)}
              </option>
            `).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-field">
          <label class="label-checkbox">
            <input type="checkbox" name="is_public" ${this.task.is_public ? 'checked' : ''} />
            Für alle sichtbar (öffentlich)
          </label>
        </div>

        <div class="drawer-actions">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="btn-cancel-task">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__icon mdc-btn__icon--check">${this.getCheckIcon()}</span>
            <span class="mdc-btn__spinner">${this.getSpinnerIcon()}</span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
          <button type="button" id="btn-delete-task" class="mdc-btn mdc-btn--delete">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </span>
            <span class="mdc-btn__label">Aufgabe löschen</span>
          </button>
        </div>
      </form>
    `;
  }

  renderDetailsReadOnly() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const statusLabels = {
      todo: 'To-Do',
      in_progress: 'In Progress',
      completed: 'Erledigt'
    };

    const priorityLabels = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch'
    };

    return `
      <div class="detail-section">
        <div class="info-message">
          Diese Aufgabe kann nur vom Ersteller bearbeitet werden. Sie können aber weiterhin Kommentare hinzufügen.
        </div>

        <div class="detail-grid">
          <!-- Titel -->
          <div>
            <div class="drawer-label">Titel</div>
            <div class="drawer-value-large">${safe(this.task.title)}</div>
          </div>

          <!-- Beschreibung -->
          ${this.task.description ? `
          <div>
            <div class="drawer-label">Beschreibung</div>
            <div class="drawer-value text-pre-wrap">${safe(this.task.description)}</div>
          </div>
          ` : ''}

          <!-- Status und Priorität -->
          <div class="detail-grid-2">
            <div>
              <div class="drawer-label">Status</div>
              <span class="task-status-badge task-status-badge--${this.task.status.replace('_', '-')}">
                ${statusLabels[this.task.status] || this.task.status}
              </span>
            </div>

            <div>
              <div class="drawer-label">Priorität</div>
              <span class="task-priority-badge task-priority-badge--${this.task.priority}">
                ${priorityLabels[this.task.priority] || this.task.priority}
              </span>
            </div>
          </div>

          <!-- Fälligkeitsdatum -->
          <div>
            <div class="drawer-label">Fälligkeitsdatum</div>
            <div class="drawer-value">${formatDate(this.task.due_date)}</div>
          </div>

          <!-- Zugewiesen an Mitarbeiter -->
          <div>
            <div class="drawer-label">Zugewiesen an Mitarbeiter</div>
            <div class="drawer-value">
              ${this.task.assigned_to ? safe(this.task.assigned_to.name) : 'Nicht zugewiesen'}
            </div>
          </div>

          ${this.task.assigned_kunde ? `
          <!-- Zugewiesen an Kunde -->
          <div>
            <div class="drawer-label">Zugewiesen an Kunde</div>
            <div class="drawer-value">
              ${safe(this.task.assigned_kunde.name)}
            </div>
          </div>
          ` : ''}

          <!-- Erstellt von -->
          <div>
            <div class="drawer-label">Erstellt von</div>
            <div class="drawer-value">
              ${this.task.creator ? safe(this.task.creator.name) : 'Unbekannt'}
            </div>
          </div>

          <!-- Sichtbarkeit -->
          <div>
            <div class="drawer-label">Sichtbarkeit</div>
            <div class="drawer-value">
              ${this.task.is_public ? 'Öffentlich (für alle sichtbar)' : 'Privat'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderComments() {
    if (this.comments.length === 0) {
      return '<p class="empty-state">Keine Kommentare vorhanden.</p>';
    }

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDateTime = (date) => date ? new Date(date).toLocaleString('de-DE') : '-';

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Autor</th>
              <th>Datum</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>
            ${this.comments.map(comment => `
              <tr>
                <td>${safe(comment.author_name || 'Unbekannt')}</td>
                <td>${formatDateTime(comment.created_at)}</td>
                <td class="text-pre-wrap">${safe(comment.text)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderAttachments() {
    if (this.attachments.length === 0) {
      return '<p class="empty-state">Keine Anhänge vorhanden.</p>';
    }

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDateTime = (date) => date ? new Date(date).toLocaleString('de-DE') : '-';
    const formatSize = (bytes) => {
      if (!bytes) return '-';
      const kb = bytes / 1024;
      const mb = kb / 1024;
      return mb > 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
    };

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Dateiname</th>
              <th>Größe</th>
              <th>Hochgeladen am</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${this.attachments.map(att => `
              <tr>
                <td>${safe(att.file_name)}</td>
                <td>${formatSize(att.size)}</td>
                <td>${formatDateTime(att.created_at)}</td>
                <td>
                  <a href="${att.file_url}" target="_blank" rel="noopener" class="primary-btn btn-link-small">Öffnen</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderHistory() {
    if (this.history.length === 0) {
      return '<p class="empty-state">Kein Verlauf vorhanden.</p>';
    }

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDateTime = (date) => date ? new Date(date).toLocaleString('de-DE') : '-';

    const changeTypeLabels = {
      created: 'Erstellt',
      status_changed: 'Status geändert',
      assigned: 'Zugewiesen',
      commented: 'Kommentiert',
      attachment_added: 'Anhang hinzugefügt',
      priority_changed: 'Priorität geändert',
      due_date_changed: 'Fälligkeitsdatum geändert',
      updated: 'Aktualisiert'
    };

    return `
      <div class="timeline">
        ${this.history.map(entry => `
          <div class="timeline-entry">
            <div class="timeline-icon"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>${safe(changeTypeLabels[entry.change_type] || entry.change_type)}</strong>
                <span class="timeline-date">${formatDateTime(entry.created_at)}</span>
              </div>
              <div class="timeline-body">
                ${entry.changed_by_user ? `von ${safe(entry.changed_by_user.name)}` : ''}
                ${entry.old_value && entry.new_value ? `<br>von "${safe(entry.old_value)}" zu "${safe(entry.new_value)}"` : ''}
                ${entry.new_value && !entry.old_value ? `<br>${safe(entry.new_value)}` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  bindFormEvents() {
    // Task-Update
    const taskForm = document.getElementById('task-detail-form');
    if (taskForm) {
      taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleTaskUpdate(new FormData(taskForm));
      });
    }

    // Kommentar hinzufügen
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCommentAdd(new FormData(commentForm));
      });
    }

    // Anhang hinzufügen
    const attachmentForm = document.getElementById('attachment-form');
    if (attachmentForm) {
      attachmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAttachmentAdd(new FormData(attachmentForm));
      });
    }

    // Cancel Button
    const cancelBtn = document.getElementById('btn-cancel-task');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Delete Task
    const deleteBtn = document.getElementById('btn-delete-task');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleTaskDelete());
    }
  }

  async handleTaskUpdate(formData) {
    try {
      const updates = {
        title: formData.get('title'),
        description: formData.get('description') || null,
        status: formData.get('status'),
        priority: formData.get('priority'),
        category_id: formData.get('category_id') || null,
        due_date: formData.get('due_date') || null,
        assigned_to_user_id: formData.get('assigned_to_user_id') || null,
        assigned_to_kunde_id: formData.get('assigned_to_kunde_id') || null,
        is_public: formData.get('is_public') === 'on',
        updated_at: new Date().toISOString()
      };

      const { error } = await window.supabase
        .from('kooperation_tasks')
        .update(updates)
        .eq('id', this.taskId);

      if (error) throw error;

      window.notificationSystem?.success?.('Task erfolgreich aktualisiert.');
      
      // Refresh & Event
      await this.loadTaskData();
      this.renderContent();
      this.bindFormEvents();
      
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: { taskId: this.taskId } }));
    } catch (error) {
      console.error('Task-Update Fehler:', error);
      window.notificationSystem?.error?.('Fehler beim Aktualisieren der Aufgabe.');
    }
  }

  async handleCommentAdd(formData) {
    try {
      const text = formData.get('text')?.trim();
      if (!text) return;

      const { error } = await window.supabase
        .from('kooperation_task_comments')
        .insert({
          task_id: this.taskId,
          author_benutzer_id: window.currentUser?.id || null,
          author_name: window.currentUser?.name || 'Unbekannt',
          text,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      await this.loadComments();
      this.renderContent();
      this.bindFormEvents();
      this.switchTab('comments');
      
      // Event triggern damit Kanban Board den Counter aktualisiert
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: { taskId: this.taskId } }));
    } catch (error) {
      console.error('Kommentar-Add Fehler:', error);
      window.notificationSystem?.error?.('Fehler beim Hinzufügen des Kommentars.');
    }
  }

  async handleAttachmentAdd(formData) {
    try {
      const fileUrl = formData.get('file_url')?.trim();
      if (!fileUrl) return;

      const fileName = fileUrl.split('/').pop() || 'attachment';

      const { error } = await window.supabase
        .from('kooperation_task_attachments')
        .insert({
          task_id: this.taskId,
          file_name: fileName,
          file_path: fileUrl,
          file_url: fileUrl,
          uploaded_by: window.currentUser?.id || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      await this.loadAttachments();
      this.renderContent();
      this.bindFormEvents();
      this.switchTab('attachments');
      
      // Event triggern damit Kanban Board den Counter aktualisiert
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: { taskId: this.taskId } }));
    } catch (error) {
      console.error('Attachment-Add Fehler:', error);
      window.notificationSystem?.error?.('Fehler beim Hinzufügen des Anhangs.');
    }
  }

  async handleTaskDelete() {
    // Nutze confirmationModal wenn verfügbar, sonst Fallback zu confirm()
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Aufgabe löschen',
        message: 'Möchten Sie diese Aufgabe wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!res?.confirmed) return;
    } else {
      if (!confirm('Aufgabe wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
        return;
      }
    }

    try {
      const { error } = await window.supabase
        .from('kooperation_tasks')
        .delete()
        .eq('id', this.taskId);

      if (error) throw error;

      window.notificationSystem?.success?.('Aufgabe gelöscht.');
      this.close();
      window.dispatchEvent(new CustomEvent('taskDeleted', { detail: { taskId: this.taskId } }));
    } catch (error) {
      console.error('Task-Delete Fehler:', error);
      window.notificationSystem?.error?.('Fehler beim Löschen der Aufgabe.');
    }
  }

  switchTab(tabName) {
    const buttons = document.querySelectorAll(`#${this.drawerId}-body .tab-button`);
    const panes = document.querySelectorAll(`#${this.drawerId}-body .tab-pane`);

    buttons.forEach(btn => btn.classList.remove('active'));
    panes.forEach(pane => pane.classList.remove('active'));

    const activeBtn = document.querySelector(`#${this.drawerId}-body .tab-button[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');
  }

  close() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    
    if (panel) panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 250);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  getCheckIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>`;
  }

  getSpinnerIcon() {
    return `<svg class="mdc-spinner" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle class="mdc-spinner-path" cx="12" cy="12" r="10" fill="none" stroke-width="3"></circle>
    </svg>`;
  }
}

