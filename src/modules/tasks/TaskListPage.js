// TaskListPage.js - Globale Task-Übersicht mit Kanban/Tabellen-Ansicht
import { TaskKanbanBoard } from './TaskKanbanBoard.js';
import { TaskCreateDrawer } from './TaskCreateDrawer.js';
import { icon } from '../../core/icons/IconSystem.js';

export const taskListPage = {
  currentView: 'kanban', // 'kanban' oder 'table'
  kanbanBoard: null,
  createDrawer: null,
  tasks: [],
  _abortController: null,
  filters: {
    entityType: null,
    entityId: null,
    status: null,
    priority: null
  },

  // Prüft ob Task überfällig ist
  isOverdue(dueDate, status) {
    if (!dueDate || status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  },

  async init() {
    console.log('🎯 TaskListPage: init()');
    
    window.setHeadline('Aufgaben');
    
    // Berechtigungsprüfung
    const canView = window.isAdmin() || window.currentUser?.permissions?.tasks?.can_view;
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Aufgaben anzuzeigen.</p>
        </div>
      `;
      return;
    }
    
    this.createDrawer = new TaskCreateDrawer();
    await this.loadTasks();
    this.render();
    this.bindEvents();
  },

  async loadTasks() {
    let query = window.supabase
      .from('kooperation_tasks')
      .select(`
        *,
        category:category_id(id, name),
        assigned_to:assigned_to_user_id(id, name, profile_image_url),
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
      .order('created_at', { ascending: false });

    // Filter anwenden
    if (this.filters.entityType) {
      query = query.eq('entity_type', this.filters.entityType);
    }
    if (this.filters.entityId) {
      query = query.eq('entity_id', this.filters.entityId);
    }
    if (this.filters.status) {
      query = query.eq('status', this.filters.status);
    }
    if (this.filters.priority) {
      query = query.eq('priority', this.filters.priority);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Fehler beim Laden der Tasks:', error);
      this.tasks = [];
    } else {
      this.tasks = data || [];
    }
  },

  render() {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const canEdit = window.isAdmin() || window.currentUser?.permissions?.tasks?.can_edit;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-kanban" class="mdc-btn mdc-btn--secondary ${this.currentView === 'kanban' ? 'active' : ''}">
              ${icon('squares-2x2')}
              Kanban
            </button>
            <button id="btn-view-table" class="mdc-btn mdc-btn--secondary ${this.currentView === 'table' ? 'active' : ''}">
              ${icon('table-grid')}
              Tabelle
            </button>
          </div>
          ${canEdit ? `
          <button id="btn-add-task" class="mdc-btn task-add-btn">
            ${icon('plus-lg')}
            Neue Aufgabe
          </button>
          ` : ''}
        </div>
      </div>

      <div class="content-section">
        <div id="tasks-content-container">
          ${this.currentView === 'kanban' ? '<div id="kanban-container"></div>' : this.renderTable()}
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);

    // Kanban Board initialisieren wenn View = kanban
    if (this.currentView === 'kanban') {
      this.initKanbanBoard();
    }
  },

  renderTable() {
    if (this.tasks.length === 0) {
      return '<p class="empty-state">Keine Aufgaben vorhanden.</p>';
    }

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const statusLabels = {
      todo: 'To-Do',
      in_progress: 'In Progress',
      completed: 'Completed'
    };

    const priorityLabels = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch'
    };

    const entityTypeLabels = {
      kooperation: 'Kooperation',
      kampagne: 'Kampagne',
      auftrag: 'Auftrag'
    };

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Status</th>
              <th>Priorität</th>
              <th>Entity</th>
              <th>Kategorie</th>
              <th>Zugewiesen an</th>
              <th>Fällig am</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${this.tasks.map(task => `
              <tr>
                <td>
                  <strong>${safe(task.title)}</strong>
                  ${task.description ? `<br><small class="task-desc-preview">${safe(task.description.substring(0, 60))}${task.description.length > 60 ? '...' : ''}</small>` : ''}
                </td>
                <td><span class="status-badge status-${task.status}">${statusLabels[task.status] || task.status}</span></td>
                <td><span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority] || task.priority}</span></td>
                <td>${entityTypeLabels[task.entity_type] || task.entity_type}</td>
                <td>${task.category ? safe(task.category.name) : '-'}</td>
                <td>${task.assigned_to ? safe(task.assigned_to.name) : 'Nicht zugewiesen'}</td>
                <td class="${this.isOverdue(task.due_date, task.status) ? 'task-overdue' : ''}">${formatDate(task.due_date)}</td>
                <td>
                  <button class="mdc-btn task-detail-btn" data-action="task-detail" data-task-id="${task.id}">
                    Details
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async initKanbanBoard() {
    const container = document.getElementById('kanban-container');
    if (!container) return;

    // Cleanup old board
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
    }

    // Neue Board-Instanz ohne Entity-Filter (global)
    this.kanbanBoard = new TaskKanbanBoard(null, null);
    await this.kanbanBoard.init(container);
  },

  bindEvents() {
    // Add Task Button - öffnet TaskCreateDrawer
    const addTaskBtn = document.getElementById('btn-add-task');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        if (this.createDrawer) {
          this.createDrawer.open('todo');
        }
      });
    }

    // View Toggle
    const kanbanBtn = document.getElementById('btn-view-kanban');
    const tableBtn = document.getElementById('btn-view-table');

    if (kanbanBtn) {
      kanbanBtn.addEventListener('click', () => {
        this.currentView = 'kanban';
        this.render();
        this.bindEvents();
      });
    }

    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        this.currentView = 'table';
        this.render();
        this.bindEvents();
      });
    }

    // Event Listener für Task-Updates
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    window.addEventListener('taskUpdated', () => this.refresh(), { signal });
    window.addEventListener('taskCreated', () => this.refresh(), { signal });
    window.addEventListener('taskDeleted', () => this.refresh(), { signal });
  },

  async refresh() {
    await this.loadTasks();
    
    if (this.currentView === 'kanban' && this.kanbanBoard) {
      await this.kanbanBoard.refresh();
    } else {
      // Re-render nur Content-Bereich bei Table-View
      const container = document.getElementById('tasks-content-container');
      if (container) {
        container.innerHTML = this.renderTable();
      }
    }
  },

  destroy() {
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }
    
    this._abortController?.abort();
    this._abortController = null;
  }
};

