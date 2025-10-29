// TaskDetailDrawer.js - Drawer für Task-Details mit Tabs
// Basiert auf VersandManager.js & AuftragsDetailsManager.js Pattern

export class TaskDetailDrawer {
  constructor() {
    this.drawerId = 'task-detail-drawer';
    this.taskId = null;
    this.task = null;
    this.comments = [];
    this.attachments = [];
    this.history = [];
    this.availableAssignees = [];
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

      await this.loadAvailableAssignees();
      
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
    const title = document.createElement('h1');
    title.textContent = 'Aufgabe';
    title.style.margin = '0';
    title.style.fontSize = '1.25rem';
    title.style.fontWeight = '600';
    
    const subtitle = document.createElement('p');
    subtitle.style.margin = '0';
    subtitle.style.color = '#6b7280';
    subtitle.style.fontSize = '0.95rem';
    subtitle.textContent = 'Details, Kommentare und Verlauf';
    subtitle.id = `${this.drawerId}-subtitle`;
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.textContent = 'Schließen';
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
        creator:created_by(id, name)
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

  async loadAvailableAssignees() {
    if (!this.task) return;
    
    const { entity_type, entity_id } = this.task;
    let query;

    if (entity_type === 'kooperation') {
      // Mitarbeiter der Kampagne der Kooperation
      query = window.supabase
        .from('kampagne_mitarbeiter')
        .select('mitarbeiter:mitarbeiter_id(id, name, profile_image_url)')
        .eq('kampagne_id', (await this.getKampagneIdForKooperation(entity_id)));
    } else if (entity_type === 'kampagne') {
      query = window.supabase
        .from('kampagne_mitarbeiter')
        .select('mitarbeiter:mitarbeiter_id(id, name, profile_image_url)')
        .eq('kampagne_id', entity_id);
    } else if (entity_type === 'auftrag') {
      query = window.supabase
        .from('auftrag_mitarbeiter')
        .select('mitarbeiter:mitarbeiter_id(id, name, profile_image_url)')
        .eq('auftrag_id', entity_id);
    }

    const { data } = await query;
    this.availableAssignees = (data || []).map(item => item.mitarbeiter).filter(Boolean);
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
        <button class="tab-button active" data-tab="details">Details</button>
        <button class="tab-button" data-tab="comments">Kommentare <span class="tab-count">${this.comments.length}</span></button>
        <button class="tab-button" data-tab="attachments">Anhänge <span class="tab-count">${this.attachments.length}</span></button>
        <button class="tab-button" data-tab="history">Verlauf <span class="tab-count">${this.history.length}</span></button>
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
            <h3 style="margin-top: var(--space-lg);">Neuer Kommentar</h3>
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
            <h3 style="margin-top: var(--space-lg);">Neuen Anhang hinzufügen</h3>
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

        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-sm);">
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

        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: var(--space-sm);">
          <div class="form-field">
            <label>Kategorie/Phase</label>
            <select name="category_id" class="form-input">
              <option value="">– keine –</option>
              ${this.categories.map(cat => `
                <option value="${cat.id}" ${this.task.category_id === cat.id ? 'selected' : ''}>
                  ${safe(cat.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-field">
            <label>Fälligkeitsdatum</label>
            <input type="date" name="due_date" class="form-input" value="${this.task.due_date || ''}" />
          </div>
        </div>

        <div class="form-field">
          <label>Zugewiesen an</label>
          <select name="assigned_to_user_id" class="form-input">
            <option value="">– Nicht zugewiesen –</option>
            ${this.availableAssignees.map(user => `
              <option value="${user.id}" ${this.task.assigned_to_user_id === user.id ? 'selected' : ''}>
                ${safe(user.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-field">
          <label style="display: flex; align-items: center; gap: var(--space-xs);">
            <input type="checkbox" name="is_public" ${this.task.is_public ? 'checked' : ''} />
            Für alle sichtbar (öffentlich)
          </label>
        </div>

        <div class="drawer-actions">
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__icon mdc-btn__icon--check">${this.getCheckIcon()}</span>
            <span class="mdc-btn__spinner">${this.getSpinnerIcon()}</span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
          <button type="button" id="btn-delete-task" class="secondary-btn" style="color: #dc2626;">Löschen</button>
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

    const priorityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444'
    };

    const statusColors = {
      todo: '#6b7280',
      in_progress: '#3b82f6',
      completed: '#10b981'
    };

    return `
      <div class="detail-section">
        <div class="info-message" style="margin-bottom: var(--space-md); padding: var(--space-sm); background: #f3f4f6; border-radius: var(--radius-sm); color: #6b7280;">
          Diese Aufgabe kann nur vom Ersteller bearbeitet werden. Sie können aber weiterhin Kommentare hinzufügen.
        </div>

        <div style="display: grid; gap: var(--space-md);">
          <!-- Titel -->
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Titel</div>
            <div style="font-size: 1rem; color: #111827;">${safe(this.task.title)}</div>
          </div>

          <!-- Beschreibung -->
          ${this.task.description ? `
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Beschreibung</div>
            <div style="font-size: 0.95rem; color: #374151; white-space: pre-wrap;">${safe(this.task.description)}</div>
          </div>
          ` : ''}

          <!-- Status und Priorität -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md);">
            <div>
              <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Status</div>
              <span style="display: inline-flex; align-items: center; gap: var(--space-xs); padding: 4px 12px; background: ${statusColors[this.task.status]}20; color: ${statusColors[this.task.status]}; border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 500;">
                ${statusLabels[this.task.status] || this.task.status}
              </span>
            </div>

            <div>
              <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Priorität</div>
              <span style="display: inline-flex; align-items: center; gap: var(--space-xs); padding: 4px 12px; background: ${priorityColors[this.task.priority]}20; color: ${priorityColors[this.task.priority]}; border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 500;">
                ${priorityLabels[this.task.priority] || this.task.priority}
              </span>
            </div>
          </div>

          <!-- Kategorie und Fälligkeitsdatum -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md);">
            <div>
              <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Kategorie/Phase</div>
              <div style="font-size: 0.95rem; color: #374151;">
                ${this.task.category ? safe(this.task.category.name) : '–'}
              </div>
            </div>

            <div>
              <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Fälligkeitsdatum</div>
              <div style="font-size: 0.95rem; color: #374151;">${formatDate(this.task.due_date)}</div>
            </div>
          </div>

          <!-- Zugewiesen an -->
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Zugewiesen an</div>
            <div style="font-size: 0.95rem; color: #374151;">
              ${this.task.assigned_to ? safe(this.task.assigned_to.name) : 'Nicht zugewiesen'}
            </div>
          </div>

          <!-- Erstellt von -->
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Erstellt von</div>
            <div style="font-size: 0.95rem; color: #374151;">
              ${this.task.creator ? safe(this.task.creator.name) : 'Unbekannt'}
            </div>
          </div>

          <!-- Sichtbarkeit -->
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin-bottom: var(--space-xs);">Sichtbarkeit</div>
            <div style="font-size: 0.95rem; color: #374151;">
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
                <td style="white-space: pre-wrap;">${safe(comment.text)}</td>
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
                  <a href="${att.file_url}" target="_blank" rel="noopener" class="primary-btn" style="padding: var(--space-xxs) var(--space-xs); font-size: var(--text-xs);">Öffnen</a>
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

