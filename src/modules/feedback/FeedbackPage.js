// FeedbackPage.js - Feedback-Übersicht mit Kanban Board
import { FeedbackCreateDrawer } from './FeedbackCreateDrawer.js';

// Icons
const ICON_BUG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082" /></svg>`;

const ICON_FEATURE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`;

const ICON_DONE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;

const ICON_DELETE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;

export const feedbackPage = {
  feedbacks: [],
  createDrawer: null,
  draggedFeedback: null,
  isAdmin: false,
  filters: {
    priority: null
  },

  async init() {
    console.log('💬 FeedbackPage: init()');
    
    // Headline & Breadcrumb
    window.setHeadline('Feedback');
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Feedback', url: '/feedback', clickable: false }
      ]);
    }
    
    // Kunden blockieren
    if (window.currentUser?.rolle === 'kunde') {
      this.renderBlocked();
      return;
    }
    
    // Berechtigungsprüfung für Mitarbeiter (Admin hat immer Zugriff)
    if (window.currentUser?.rolle !== 'admin') {
      const canView = window.currentUser?.zugriffsrechte?.feedback?.can_view;
      if (!canView) {
        this.renderBlocked();
        return;
      }
    }
    
    this.isAdmin = window.currentUser?.rolle === 'admin';
    this.createDrawer = new FeedbackCreateDrawer();
    await this.loadFeedbacks();
    this.render();
    this.bindEvents();
  },

  renderBlocked() {
    const html = `
      <div class="empty-state">
        <h2>Zugriff verweigert</h2>
        <p>Diese Seite ist nur für Mitarbeiter zugänglich.</p>
      </div>
    `;
    window.setContentSafely(window.content, html);
  },

  async loadFeedbacks() {
    if (!window.supabase) {
      this.feedbacks = [];
      return;
    }

    let query = window.supabase
      .from('feedback')
      .select(`
        *,
        creator:created_by(id, name)
      `)
      .order('created_at', { ascending: false });

    if (this.filters.priority) {
      query = query.eq('priority', this.filters.priority);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Fehler beim Laden der Feedbacks:', error);
      this.feedbacks = [];
    } else {
      this.feedbacks = data || [];
    }
  },

  render() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    // Gruppiere nach Kategorie/Status
    const feedbackByColumn = {
      bug: this.feedbacks.filter(f => f.category === 'bug' && f.status === 'open'),
      feature: this.feedbacks.filter(f => f.category === 'feature' && f.status === 'open'),
      closed: this.feedbacks.filter(f => f.status === 'closed')
    };

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="filter-group">
            <select id="filter-priority" class="form-select filter-select">
              <option value="">Alle Prioritäten</option>
              <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>Hoch</option>
              <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>Mittel</option>
              <option value="low" ${this.filters.priority === 'low' ? 'selected' : ''}>Niedrig</option>
            </select>
          </div>
          <button class="primary-btn" id="new-feedback-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Neues Feedback
          </button>
        </div>
      </div>

      <div class="content-section">
        <div class="kanban-board-wrapper">
          <div class="kanban-board">
            ${this.renderColumn('bug', 'Bugs', feedbackByColumn.bug, ICON_BUG)}
            ${this.renderColumn('feature', 'Features', feedbackByColumn.feature, ICON_FEATURE)}
            ${this.renderColumn('closed', 'Erledigt', feedbackByColumn.closed, ICON_DONE)}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderColumn(columnId, title, feedbacks, icon = '') {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const isClosedColumn = columnId === 'closed';

    return `
      <div class="kanban-column" data-column="${columnId}">
        <div class="kanban-column-header">
          <div class="kanban-column-header-left">
            <span class="kanban-column-title">${icon} ${safe(title)}</span>
            <span class="kanban-count">${feedbacks.length}</span>
          </div>
          ${!isClosedColumn ? `
            <button class="btn-add-feedback-in-column" data-category="${columnId}" title="Feedback hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          ` : ''}
        </div>
        <div class="kanban-column-body" data-column="${columnId}">
          ${feedbacks.length === 0 ? `
            <div class="kanban-empty-state">
              <p>Keine Einträge</p>
            </div>
          ` : feedbacks.map(fb => this.renderFeedbackCard(fb)).join('')}
        </div>
      </div>
    `;
  },

  renderFeedbackCard(fb) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    const priorityClass = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high'
    }[fb.priority] || 'priority-medium';

    const priorityLabel = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch'
    }[fb.priority] || 'Mittel';

    const formattedDate = new Date(fb.created_at).toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });

    // Nur der Ersteller darf löschen
    const canDelete = fb.created_by === window.currentUser?.id;

    return `
      <div class="task-card feedback-card ${priorityClass}" 
           draggable="true" 
           data-feedback-id="${fb.id}"
           data-category="${fb.category}"
           data-status="${fb.status}">
        
        <div class="task-card-header">
          <div class="task-priority-badge">
            <span class="task-priority-indicator"></span>
            <span class="task-priority-text">${priorityLabel}</span>
          </div>
          ${canDelete ? `
            <button class="btn-delete-feedback" data-feedback-id="${fb.id}" title="Feedback löschen" style="padding: var(--spacing-xxxs);">
              ${ICON_DELETE}
            </button>
          ` : ''}
        </div>

        <div class="task-card-body">
          <p class="feedback-description">${safe(fb.description).substring(0, 120)}${fb.description.length > 120 ? '...' : ''}</p>
        </div>

        <div class="task-card-footer">
          <div class="task-meta-left">
            <span class="feedback-date">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              ${formattedDate}
            </span>
          </div>
          <div class="task-meta-right">
            <span class="feedback-creator">${safe(fb.creator?.name || 'Unbekannt')}</span>
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    // Neues Feedback
    const newBtn = document.getElementById('new-feedback-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.createDrawer.open();
      });
    }

    // Add buttons in columns
    document.querySelectorAll('.btn-add-feedback-in-column').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.createDrawer.open(category);
      });
    });

    // Filter Events
    const priorityFilter = document.getElementById('filter-priority');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', async (e) => {
        this.filters.priority = e.target.value || null;
        await this.loadFeedbacks();
        this.render();
        this.bindEvents();
      });
    }

    // Delete Events
    document.querySelectorAll('.btn-delete-feedback').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Verhindert Drag-Start
        const feedbackId = btn.dataset.feedbackId;
        await this.deleteFeedback(feedbackId);
      });
    });

    // Drag & Drop Events
    this.bindDragDropEvents();

    // Event für Drawer-Refresh
    window.addEventListener('feedbackCreated', this.handleFeedbackCreated.bind(this));
  },

  async deleteFeedback(feedbackId) {
    // Bestätigung via ConfirmationModal falls vorhanden
    let confirmed = false;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Feedback löschen',
        message: 'Möchtest du dieses Feedback wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = !!res?.confirmed;
    } else {
      confirmed = confirm('Möchtest du dieses Feedback wirklich löschen?');
    }

    if (!confirmed) return;

    const { error } = await window.supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId)
      .eq('created_by', window.currentUser?.id); // Extra Sicherheit

    if (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
      return;
    }

    window.toastSystem?.show('Feedback gelöscht', 'success');
    await this.loadFeedbacks();
    this.render();
    this.bindEvents();
  },

  handleFeedbackCreated: async function() {
    await this.loadFeedbacks();
    this.render();
    this.bindEvents();
  },

  bindDragDropEvents() {
    const cards = document.querySelectorAll('.feedback-card');
    const columns = document.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => this.onDragStart(e));
      card.addEventListener('dragend', (e) => this.onDragEnd(e));
    });

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => this.onDragOver(e));
      column.addEventListener('dragleave', (e) => this.onDragLeave(e));
      column.addEventListener('drop', (e) => this.onDrop(e));
    });
  },

  onDragStart(e) {
    const card = e.target.closest('.feedback-card');
    if (!card) return;

    this.draggedFeedback = {
      id: card.dataset.feedbackId,
      category: card.dataset.category,
      status: card.dataset.status
    };

    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  },

  onDragEnd(e) {
    const card = e.target.closest('.feedback-card');
    if (card) {
      card.classList.remove('dragging');
    }
    this.draggedFeedback = null;

    // Remove all drag-over states
    document.querySelectorAll('.kanban-column-body').forEach(col => {
      col.classList.remove('drag-over');
    });
  },

  onDragOver(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-column-body');
    if (!column) return;

    const targetColumn = column.dataset.column;
    
    // Nur Admins dürfen in "Erledigt" verschieben
    if (targetColumn === 'closed' && !this.isAdmin) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    column.classList.add('drag-over');
  },

  onDragLeave(e) {
    const column = e.target.closest('.kanban-column-body');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('drag-over');
    }
  },

  async onDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-column-body');
    if (!column || !this.draggedFeedback) return;

    column.classList.remove('drag-over');

    const targetColumn = column.dataset.column;
    const feedbackId = this.draggedFeedback.id;
    const currentCategory = this.draggedFeedback.category;
    const currentStatus = this.draggedFeedback.status;

    // Nur Admins dürfen in "Erledigt" verschieben
    if (targetColumn === 'closed' && !this.isAdmin) {
      window.toastSystem?.show('Nur Admins können Feedback als erledigt markieren', 'warning');
      return;
    }

    // Bestimme neue Werte
    let newCategory = currentCategory;
    let newStatus = currentStatus;

    if (targetColumn === 'closed') {
      newStatus = 'closed';
    } else if (targetColumn === 'bug' || targetColumn === 'feature') {
      newCategory = targetColumn;
      newStatus = 'open';
    }

    // Keine Änderung nötig?
    if (newCategory === currentCategory && newStatus === currentStatus) {
      return;
    }

    // Update in DB
    const { error } = await window.supabase
      .from('feedback')
      .update({ 
        category: newCategory,
        status: newStatus 
      })
      .eq('id', feedbackId);

    if (error) {
      console.error('Fehler beim Verschieben:', error);
      window.toastSystem?.show('Fehler beim Verschieben', 'error');
      return;
    }

    const statusText = newStatus === 'closed' ? 'erledigt' : (newCategory === 'bug' ? 'Bug' : 'Feature');
    window.toastSystem?.show(`Feedback nach "${statusText}" verschoben`, 'success');

    // Reload
    await this.loadFeedbacks();
    this.render();
    this.bindEvents();
  },

  destroy() {
    console.log('🗑️ FeedbackPage: destroy()');
    window.removeEventListener('feedbackCreated', this.handleFeedbackCreated);
  }
};
