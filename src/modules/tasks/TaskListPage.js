// TaskListPage.js - Globale Task-Übersicht mit Kanban/Tabellen-Ansicht
import { TaskKanbanBoard } from './TaskKanbanBoard.js';
import { TaskCreateDrawer } from './TaskCreateDrawer.js';

export const taskListPage = {
  currentView: 'kanban', // 'kanban' oder 'table'
  kanbanBoard: null,
  createDrawer: null,
  tasks: [],
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
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Aufgaben', url: '/tasks', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canView = window.currentUser?.rolle === 'admin' || window.currentUser?.permissions?.tasks?.can_view;
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
    const canEdit = window.currentUser?.rolle === 'admin' || window.currentUser?.permissions?.tasks?.can_edit;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-kanban" class="secondary-btn ${this.currentView === 'kanban' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              Kanban
            </button>
            <button id="btn-view-table" class="secondary-btn ${this.currentView === 'table' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Tabelle
            </button>
          </div>
          ${canEdit ? `
          <button id="btn-add-task" class="primary-btn" style="margin-left: var(--space-sm);">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
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
                  ${task.description ? `<br><small style="color: var(--text-secondary);">${safe(task.description.substring(0, 60))}${task.description.length > 60 ? '...' : ''}</small>` : ''}
                </td>
                <td><span class="status-badge status-${task.status}">${statusLabels[task.status] || task.status}</span></td>
                <td><span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority] || task.priority}</span></td>
                <td>${entityTypeLabels[task.entity_type] || task.entity_type}</td>
                <td>${task.category ? safe(task.category.name) : '-'}</td>
                <td>${task.assigned_to ? safe(task.assigned_to.name) : 'Nicht zugewiesen'}</td>
                <td class="${this.isOverdue(task.due_date, task.status) ? 'task-overdue' : ''}">${formatDate(task.due_date)}</td>
                <td>
                  <button class="primary-btn" data-action="task-detail" data-task-id="${task.id}" style="padding: var(--space-xxs) var(--space-xs); font-size: var(--text-xs);">
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
    window.addEventListener('taskUpdated', () => this.refresh());
    window.addEventListener('taskCreated', () => this.refresh());
    window.addEventListener('taskDeleted', () => this.refresh());
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
    
    // Remove Event Listeners
    window.removeEventListener('taskUpdated', () => this.refresh());
    window.removeEventListener('taskCreated', () => this.refresh());
    window.removeEventListener('taskDeleted', () => this.refresh());
  }
};

