// TaskKanbanBoard.js - Kanban Board mit Drag & Drop
// Nutzt native HTML5 Drag & Drop API

import { TaskCreateDrawer } from './TaskCreateDrawer.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderEmptyState, bindEmptyStateActions } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export class TaskKanbanBoard {
  constructor(entityType = null, entityId = null) {
    console.log('🏗️ TaskKanbanBoard Constructor:', { entityType, entityId });
    this.entityType = entityType;
    this.entityId = entityId;
    this.tasks = [];
    this.filters = {
      assignee: null,
      priority: null,
      category: null,
      dueDateRange: null
    };
    this.draggedTask = null;
    this.boundHandlers = {
      dragStart: (e) => this.onDragStart(e),
      dragEnd: (e) => this.onDragEnd(e),
      dragOver: (e) => this.onDragOver(e),
      drop: (e) => this.onDrop(e),
      dragLeave: (e) => this.onDragLeave(e)
    };
    this.createDrawer = new TaskCreateDrawer();
  }

  async init(containerElement) {
    this.container = containerElement;
    await this.loadTasks();
    this.render();
    this.bindEvents();
    this.bindGlobalEvents();
  }

  async loadTasks() {
    let query = window.supabase
      .from('kooperation_tasks')
      .select(`
        *,
        category:category_id(id, name),
        assigned_to:assigned_to_user_id(id, name, profile_image_url),
        creator:created_by(id, name, profile_image_url),
        kampagne:kampagne_id(
          id,
          kampagnenname,
          eigener_name,
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
      .order('sort_order', { ascending: true });

    // Filter nach Entity wenn angegeben
    if (this.entityType && this.entityId) {
      query = query.eq('entity_type', this.entityType).eq('entity_id', this.entityId);
    }

    // Anwenden weiterer Filter
    if (this.filters.assignee) {
      query = query.eq('assigned_to_user_id', this.filters.assignee);
    }
    if (this.filters.priority) {
      query = query.eq('priority', this.filters.priority);
    }
    if (this.filters.category) {
      query = query.eq('category_id', this.filters.category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Fehler beim Laden der Tasks:', error);
      this.tasks = [];
    } else {
      this.tasks = data || [];
      
      // Lade Kommentare- und Anhänge-Counts für alle Tasks
      await this.loadTaskCounts();
    }
  }

  async loadTaskCounts() {
    if (this.tasks.length === 0) return;
    
    const taskIds = this.tasks.map(t => t.id);
    
    // Kommentare-Count laden
    const { data: commentsData } = await window.supabase
      .from('kooperation_task_comments')
      .select('task_id')
      .in('task_id', taskIds)
      .is('deleted_at', null);
    
    // Anhänge-Count laden
    const { data: attachmentsData } = await window.supabase
      .from('kooperation_task_attachments')
      .select('task_id')
      .in('task_id', taskIds);
    
    // Counts zu Tasks hinzufügen
    const commentsCounts = {};
    const attachmentsCounts = {};
    
    (commentsData || []).forEach(c => {
      commentsCounts[c.task_id] = (commentsCounts[c.task_id] || 0) + 1;
    });
    
    (attachmentsData || []).forEach(a => {
      attachmentsCounts[a.task_id] = (attachmentsCounts[a.task_id] || 0) + 1;
    });
    
    this.tasks = this.tasks.map(task => ({
      ...task,
      comments_count: commentsCounts[task.id] || 0,
      attachments_count: attachmentsCounts[task.id] || 0
    }));
  }

  render() {
    if (!this.container) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    // Board-Level Empty State
    if (this.tasks.length === 0) {
      this.container.innerHTML = `
        <div class="kanban-board-wrapper">
          ${renderEmptyState({
            icon: 'kanban',
            title: 'Keine Aufgaben vorhanden',
            text: 'Erstelle die erste Aufgabe, um loszulegen.',
            actions: [{ label: 'Aufgabe erstellen', action: 'create-task', variant: 'primary' }]
          })}
        </div>
      `;
      return;
    }

    // Gruppiere Tasks nach Status
    const tasksByStatus = {
      todo: this.tasks.filter(t => t.status === 'todo'),
      in_progress: this.tasks.filter(t => t.status === 'in_progress'),
      completed: this.tasks.filter(t => t.status === 'completed')
    };

    const html = `
      <div class="kanban-board-wrapper">
        <!-- Kanban Board -->
        <div class="kanban-board">
          ${this.renderColumn('todo', 'To-Do', tasksByStatus.todo)}
          ${this.renderColumn('in_progress', 'In Progress', tasksByStatus.in_progress)}
          ${this.renderColumn('completed', 'Completed', tasksByStatus.completed)}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    
    // Nach dem Rendern müssen die Drag & Drop Events neu gebunden werden
    this.bindDragDropEventsAfterRender();
  }

  renderColumn(status, title, tasks) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    return `
      <div class="kanban-column" data-status="${status}">
        <div class="kanban-column-header">
          <div class="task-kanban-col-header">
            <span class="kanban-column-title">${safe(title)}</span>
            <span class="kanban-count">${tasks.length}</span>
          </div>
          <button class="btn-add-task-in-column task-kanban-add-btn" data-status="${status}" title="Aufgabe hinzufügen">
            ${icon('plus-lg')}
          </button>
        </div>
        <div class="kanban-column-body" data-status="${status}">
          ${tasks.length > 0
            ? tasks.map(task => this.renderTaskCard(task)).join('')
            : renderEmptyState({ title: 'Keine Aufgaben', size: 'small' })}
        </div>
      </div>
    `;
  }

  renderTaskCard(task) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    const priorityClass = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high'
    }[task.priority] || 'priority-medium';

    const dueDateBadge = this.getDueDateBadge(task.due_date);
    
    // Avatar-Bubbles für Ersteller und zugewiesene Person
    const avatars = this.renderTaskAvatars(task);
    
    // Kampagne-Bubble
    const kampagneBubble = this.renderKampagneBubble(task);

    return `
      <div class="task-card ${priorityClass}" 
           draggable="true" 
           data-task-id="${task.id}"
           data-status="${task.status}"
           data-sort-order="${task.sort_order}">
        
        <div class="task-card-header">
          <div class="task-priority-badge">
            <span class="task-priority-indicator"></span>
            <span class="task-priority-text">${this.getPriorityText(task.priority)}</span>
          </div>
          ${task.category ? `<span class="task-category-badge">${safe(task.category.name)}</span>` : ''}
        </div>

        <div class="task-card-body">
          <h4 class="task-title">${safe(task.title)}</h4>
        </div>

        <div class="task-card-footer">
          <div class="task-meta-left">
            ${dueDateBadge}
          </div>
          <div class="task-meta-right">
            ${kampagneBubble}
            ${this.renderTaskStats(task)}
            ${avatars}
            <button class="task-card-open" data-task-id="${task.id}" data-action="task-detail" title="Details öffnen">
              ${icon('chevron-right')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderTaskStats(task) {
    const commentsIcon = `
      ${icon('chat-bubble')}
    `;
    
    const attachmentIcon = `
      ${icon('paper-clip')}
    `;
    
    const commentsCount = task.comments_count || 0;
    const attachmentsCount = task.attachments_count || 0;
    
    return `
      <span class="task-stat">${commentsIcon}<span class="task-stat-count">${commentsCount}</span></span>
      <span class="task-stat">${attachmentIcon}<span class="task-stat-count">${attachmentsCount}</span></span>
    `;
  }

  getDueDateBadge(dueDate) {
    if (!dueDate) return '';
    
    const relativeDate = this.getRelativeDate(dueDate);
    const isOverdue = this.isOverdue(dueDate);
    
    const calendarIcon = `
      ${icon('calendar-days')}
    `;
    
    return `<span class="task-due-date${isOverdue ? ' task-overdue' : ''}">${calendarIcon}${relativeDate}</span>`;
  }

  isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  getRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `vor ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'Tag' : 'Tagen'}`;
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays <= 7) return `in ${diffDays} Tagen`;
    if (diffDays <= 14) return `in ${Math.ceil(diffDays / 7)} ${Math.ceil(diffDays / 7) === 1 ? 'Woche' : 'Wochen'}`;
    if (diffDays <= 30) return `in ${Math.ceil(diffDays / 7)} Wochen`;
    return `in ${Math.ceil(diffDays / 30)} ${Math.ceil(diffDays / 30) === 1 ? 'Monat' : 'Monaten'}`;
  }

  getPriorityText(priority) {
    const map = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
    return map[priority] || 'Mittel';
  }

  renderAssigneeAvatar(user) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

    if (user.profile_image_url) {
      return `<img src="${user.profile_image_url}" alt="${safe(user.name)}" class="assignee-avatar" title="${safe(user.name)}" />`;
    }

    return `<div class="assignee-avatar assignee-avatar-initials" title="${safe(user.name)}">${initials}</div>`;
  }

  renderTaskAvatars(task) {
    const items = [];
    
    // Ersteller (Creator)
    if (task.creator) {
      items.push({
        name: task.creator.name || 'Unbekannt',
        type: 'person',
        profile_image_url: task.creator.profile_image_url
      });
    }
    
    // Zugewiesene Person (Assigned To)
    if (task.assigned_to) {
      items.push({
        name: task.assigned_to.name || 'Unbekannt',
        type: 'person',
        profile_image_url: task.assigned_to.profile_image_url
      });
    }
    
    // Wenn keine Personen, leeren String zurückgeben
    if (items.length === 0) return '';
    
    // Verwende die AvatarBubbles Komponente mit custom class für Task-Cards
    const bubbles = window.AvatarBubbles?.renderBubbles?.(items) || '';
    
    // Wrap in task-card-avatars container für spezifische Styles
    return `<div class="task-card-avatars">${bubbles}</div>`;
  }

  renderKampagneBubble(task) {
    if (!task?.kampagne) return '';
    
    const kampagne = task.kampagne;
    const marke = kampagne.marke;
    const unternehmen = kampagne.unternehmen;
    
    // Verwende Logo der Marke falls vorhanden, sonst Logo des Unternehmens
    const logoUrl = marke?.logo_url || unternehmen?.logo_url || null;
    const displayName = KampagneUtils.getDisplayName(kampagne);
    
    const items = [{
      name: displayName,
      type: 'org',
      id: kampagne.id,
      entityType: 'kampagne',
      logo_url: logoUrl
    }];
    
    // Verwende die AvatarBubbles Komponente mit custom class für Task-Cards
    const bubbles = window.AvatarBubbles?.renderBubbles?.(items) || '';
    
    // Wrap in task-card-avatars container für spezifische Styles
    return `<div class="task-card-avatars">${bubbles}</div>`;
  }

  bindEvents() {
    if (!this.container) return;

    // Plus-Buttons in Spalten-Headern - öffnen TaskCreateDrawer
    const addButtons = this.container.querySelectorAll('.btn-add-task-in-column');
    addButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const status = e.currentTarget.dataset.status;
        this.createDrawer.open(status);
      });
      
      // Hover-Effekt
      btn.addEventListener('mouseenter', (e) => {
        e.currentTarget.style.color = 'var(--primary-600)';
      });
      btn.addEventListener('mouseleave', (e) => {
        e.currentTarget.style.color = 'var(--text-secondary)';
      });
    });

    // Drag & Drop Events neu binden
    this.bindDragDropEvents();
  }

  bindGlobalEvents() {
    this._globalAbort?.abort();
    this._globalAbort = new AbortController();
    const signal = this._globalAbort.signal;

    window.addEventListener('taskUpdated', (e) => this.handleTaskUpdate(e), { signal });
    window.addEventListener('taskCreated', (e) => this.handleTaskCreated(e), { signal });

    // Empty-State-Aktionen (delegiert am stabilen Container, ueberlebt Re-Renders)
    if (this.container) {
      bindEmptyStateActions(this.container, {
        'create-task': () => this.createDrawer.open('todo')
      }, { signal });
    }
  }

  async handleTaskUpdate(event) {
    const taskId = event.detail?.taskId;
    if (!taskId) return;
    
    // Lade Counts nur für die aktualisierte Task neu
    const { data: commentsData } = await window.supabase
      .from('kooperation_task_comments')
      .select('task_id')
      .eq('task_id', taskId)
      .is('deleted_at', null);
    
    const { data: attachmentsData } = await window.supabase
      .from('kooperation_task_attachments')
      .select('task_id')
      .eq('task_id', taskId);
    
    const commentsCount = commentsData?.length || 0;
    const attachmentsCount = attachmentsData?.length || 0;
    
    // Update Task in der Liste
    this.tasks = this.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          comments_count: commentsCount,
          attachments_count: attachmentsCount
        };
      }
      return task;
    });
    
    // Neu rendern ohne bindEvents() → verhindert doppelte Event-Bindings
    this.render();
    this.bindDragDropEventsAfterRender();
  }

  async handleTaskCreated(event) {
    console.log('✅ TaskKanbanBoard: Task erstellt, refresh Board');
    await this.refresh();
  }

  bindDragDropEventsAfterRender() {
    if (!this.container) return;

    // Binde Drag & Drop Events auf Task Cards
    // Nutze data-Attribut um doppelte Bindings zu vermeiden
    const taskCards = this.container.querySelectorAll('.task-card');
    taskCards.forEach(card => {
      // Skip wenn bereits gebunden
      if (card.dataset.dragBound === 'true') return;
      
      // Füge neue Listener hinzu
      card.addEventListener('dragstart', this.boundHandlers.dragStart);
      card.addEventListener('dragend', this.boundHandlers.dragEnd);
      card.dataset.dragBound = 'true';
    });

    // Binde Drop-Events auf Spalten
    const columns = this.container.querySelectorAll('.kanban-column-body');
    columns.forEach(column => {
      // Skip wenn bereits gebunden
      if (column.dataset.dropBound === 'true') return;
      
      // Füge neue Listener hinzu
      column.addEventListener('dragover', this.boundHandlers.dragOver);
      column.addEventListener('drop', this.boundHandlers.drop);
      column.addEventListener('dragleave', this.boundHandlers.dragLeave);
      column.dataset.dropBound = 'true';
    });
    
    // Binde Click-Events für Avatar-Bubbles (Kampagne, Creator, etc.)
    if (window.AvatarBubbles?.bindClickEvents) {
      window.AvatarBubbles.bindClickEvents(this.container);
    }
  }

  bindDragDropEvents() {
    // Diese Methode wird von init() aufgerufen, aber eigentlich ist bindDragDropEventsAfterRender() die Hauptmethode
    this.bindDragDropEventsAfterRender();
  }

  onDragStart(e) {
    console.log('🎯 DRAG START:', e.target.dataset.taskId);
    this.draggedTask = {
      id: e.target.dataset.taskId,
      status: e.target.dataset.status,
      sortOrder: parseInt(e.target.dataset.sortOrder, 10)
    };
    console.log('🎯 draggedTask set:', this.draggedTask);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedTask.id);

    e.target.classList.add('dragging');
  }

  onDragEnd(e) {
    e.target.classList.remove('dragging');
    
    // Entferne alle Highlights
    this.container.querySelectorAll('.kanban-column-body').forEach(col => {
      col.classList.remove('drag-over');
    });
  }

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const column = e.target.closest('.kanban-column-body');
    if (column) {
      column.classList.add('drag-over');
    }
  }

  onDragLeave(e) {
    const column = e.target.closest('.kanban-column-body');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('drag-over');
    }
  }

  async onDrop(e) {
    e.preventDefault();

    const column = e.target.closest('.kanban-column-body');
    if (!column) return;

    column.classList.remove('drag-over');

    const newStatus = column.dataset.status;
    const taskId = this.draggedTask.id;

    // Status geändert?
    if (newStatus === this.draggedTask.status) {
      // Nur Reihenfolge innerhalb der Spalte geändert
      await this.updateTaskSortOrder(taskId, newStatus, column);
    } else {
      // Status UND ggf. Reihenfolge geändert
      await this.updateTaskStatus(taskId, newStatus);
    }

    this.draggedTask = null;
  }

  async updateTaskStatus(taskId, newStatus) {
    try {
      // Berechne neue sort_order (ans Ende der neuen Spalte)
      const tasksInNewColumn = this.tasks.filter(t => t.status === newStatus);
      const maxSortOrder = tasksInNewColumn.length > 0
        ? Math.max(...tasksInNewColumn.map(t => t.sort_order || 0))
        : 0;

      const { error } = await window.supabase
        .from('kooperation_tasks')
        .update({
          status: newStatus,
          sort_order: maxSortOrder + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Optimistische UI-Aktualisierung
      await this.refresh();
      
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: { taskId } }));
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Task-Status:', error);
    }
  }

  async updateTaskSortOrder(taskId, status, column) {
    // TODO: Implementiere Reordering innerhalb der Spalte
    // Für MVP: refresh reicht
    await this.refresh();
  }

  async refresh() {
    await this.loadTasks();
    this.render();
    this.bindEvents();
  }

  destroy() {
    this._globalAbort?.abort();
    this._globalAbort = null;
    this.container = null;
    this.tasks = [];
  }
}

