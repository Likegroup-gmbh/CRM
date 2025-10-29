// TaskKanbanBoard.js - Kanban Board mit Drag & Drop
// Nutzt native HTML5 Drag & Drop API

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
  }

  async init(containerElement) {
    this.container = containerElement;
    await this.loadTasks();
    this.render();
    this.bindEvents();
  }

  async loadTasks() {
    let query = window.supabase
      .from('kooperation_tasks')
      .select(`
        *,
        category:category_id(id, name),
        assigned_to:assigned_to_user_id(id, name, profile_image_url),
        creator:created_by(id, name, profile_image_url)
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
          <div style="display: flex; align-items: center; gap: var(--space-xs);">
            <h3>${safe(title)}</h3>
            <span class="kanban-count">${tasks.length}</span>
          </div>
          <button class="btn-add-task-in-column" data-status="${status}" title="Aufgabe hinzufügen" style="background: none; border: none; cursor: pointer; padding: var(--space-xxs); display: flex; align-items: center; color: var(--text-secondary); transition: color 0.2s;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        <div class="kanban-column-body" data-status="${status}">
          ${tasks.map(task => this.renderTaskCard(task)).join('')}
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
            ${this.renderTaskStats(task)}
            ${avatars}
            <button class="task-card-open" data-task-id="${task.id}" data-action="task-detail" title="Details öffnen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderTaskStats(task) {
    const commentsIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    `;
    
    const attachmentIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
        <path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
      </svg>
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
    
    const calendarIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
      </svg>
    `;
    
    return `<span class="task-due-date">${calendarIcon}${relativeDate}</span>`;
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
        type: 'person'
      });
    }
    
    // Zugewiesene Person (Assigned To)
    if (task.assigned_to) {
      items.push({
        name: task.assigned_to.name || 'Unbekannt',
        type: 'person'
      });
    }
    
    // Wenn keine Personen, leeren String zurückgeben
    if (items.length === 0) return '';
    
    // Verwende die AvatarBubbles Komponente mit custom class für Task-Cards
    const bubbles = window.AvatarBubbles?.renderBubbles?.(items) || '';
    
    // Wrap in task-card-avatars container für spezifische Styles
    return `<div class="task-card-avatars">${bubbles}</div>`;
  }

  bindEvents() {
    if (!this.container) return;

    // Plus-Buttons in Spalten-Headern
    const addButtons = this.container.querySelectorAll('.btn-add-task-in-column');
    addButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const status = e.currentTarget.dataset.status;
        this.openQuickAddForm(status);
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
    
    // Listener für Task-Updates (Kommentare, Anhänge, etc.)
    window.addEventListener('taskUpdated', (e) => this.handleTaskUpdate(e));

    // Task öffnen via Delegation bereits in TaskDetailDrawer.bindEvents()
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
    
    // Neu rendern
    this.render();
    this.bindEvents();
    this.bindDragDropEventsAfterRender();
  }

  bindDragDropEventsAfterRender() {
    if (!this.container) return;

    // Binde Drag & Drop Events auf Task Cards
    const taskCards = this.container.querySelectorAll('.task-card');
    taskCards.forEach(card => {
      // Entferne alte Listener falls vorhanden (um Duplikate zu vermeiden)
      card.removeEventListener('dragstart', this.boundHandlers.dragStart);
      card.removeEventListener('dragend', this.boundHandlers.dragEnd);
      
      // Füge neue Listener hinzu
      card.addEventListener('dragstart', this.boundHandlers.dragStart);
      card.addEventListener('dragend', this.boundHandlers.dragEnd);
    });

    // Binde Drop-Events auf Spalten
    const columns = this.container.querySelectorAll('.kanban-column-body');
    columns.forEach(column => {
      // Entferne alte Listener falls vorhanden
      column.removeEventListener('dragover', this.boundHandlers.dragOver);
      column.removeEventListener('drop', this.boundHandlers.drop);
      column.removeEventListener('dragleave', this.boundHandlers.dragLeave);
      
      // Füge neue Listener hinzu
      column.addEventListener('dragover', this.boundHandlers.dragOver);
      column.addEventListener('drop', this.boundHandlers.drop);
      column.addEventListener('dragleave', this.boundHandlers.dragLeave);
    });
  }

  bindDragDropEvents() {
    // Diese Methode wird von init() aufgerufen, aber eigentlich ist bindDragDropEventsAfterRender() die Hauptmethode
    this.bindDragDropEventsAfterRender();
  }

  onDragStart(e) {
    this.draggedTask = {
      id: e.target.dataset.taskId,
      status: e.target.dataset.status,
      sortOrder: parseInt(e.target.dataset.sortOrder, 10)
    };

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
      window.notificationSystem?.error?.('Fehler beim Verschieben der Aufgabe.');
    }
  }

  async updateTaskSortOrder(taskId, status, column) {
    // TODO: Implementiere Reordering innerhalb der Spalte
    // Für MVP: refresh reicht
    await this.refresh();
  }

  async openQuickAddForm(targetStatus = 'todo') {
    console.log('🆕 openQuickAddForm aufgerufen mit Status:', targetStatus);
    console.log('🎯 Current EntityType:', this.entityType, 'EntityID:', this.entityId);
    console.log('🌐 Current URL:', window.location.href);
    
    // Versuche Entity-Daten aus verschiedenen Quellen zu holen
    let entityType = this.entityType;
    let entityId = this.entityId;
    
    // Fallback: Aus URL holen (z.B. /kooperation/123)
    if (!entityType || !entityId) {
      const urlMatch = window.location.pathname.match(/\/(kooperation|kampagne|auftrag)\/([a-f0-9-]+)/);
      if (urlMatch) {
        entityType = urlMatch[1];
        entityId = urlMatch[2];
        console.log('✅ Entity-Daten aus URL geholt:', { entityType, entityId });
      }
    }
    
    console.log('📍 Finale Entity-Daten:', { entityType, entityId });
    
    // Erstelle erweiterte Task-Quick-Add-Form in der entsprechenden Spalte
    const targetColumn = this.container.querySelector(`.kanban-column-body[data-status="${targetStatus}"]`);
    if (!targetColumn) {
      console.error('❌ Spalte nicht gefunden für Status:', targetStatus);
      return;
    }

    // Entferne existierende Quick-Add-Form falls vorhanden
    const existingForm = this.container.querySelector('.task-quick-add-form');
    if (existingForm) {
      existingForm.remove();
      return;
    }

    // Lade Kategorien und Mitarbeiter für Dropdowns
    const categories = await this.loadCategories();
    const users = await this.loadUsers();
    
    // Lade verfügbare Kooperationen wenn kein Entity-Kontext vorhanden
    const needsEntitySelection = !entityType || !entityId;
    let kooperationen = [];
    
    if (needsEntitySelection) {
      console.log('📋 Lade Kooperationen für Entity-Auswahl...');
      const { data, error } = await window.supabase
        .from('kooperationen')
        .select('id, name')
        .order('name');
      
      if (error) {
        console.error('❌ Fehler beim Laden der Kooperationen:', error);
        kooperationen = [];
      } else {
        kooperationen = data || [];
        console.log('✅ Kooperationen geladen:', kooperationen.length, kooperationen);
      }
    }

    const formHtml = `
      <div class="task-card task-quick-add-form">
        <form id="quick-add-form" data-entity-type="${entityType || ''}" data-entity-id="${entityId || ''}" data-target-status="${targetStatus}">
          ${needsEntitySelection ? `
          <!-- Entity-Auswahl wenn kein Kontext vorhanden -->
          <div class="form-field" style="margin-bottom: var(--space-xs);">
            <label style="font-size: var(--text-xs); margin-bottom: var(--space-xxs); display: block;">Kooperation *</label>
            <select name="entity_id" class="form-input" required>
              <option value="">Kooperation auswählen...</option>
              ${kooperationen.map(k => `<option value="${k.id}">${k.name}</option>`).join('')}
            </select>
            <input type="hidden" name="entity_type" value="kooperation" />
          </div>
          ` : `
          <!-- Hidden Fields für Entity-Kontext -->
          <input type="hidden" name="entity_type" value="${entityType}" id="entity_type_field" />
          <input type="hidden" name="entity_id" value="${entityId}" id="entity_id_field" />
          `}
          
          <div class="form-field" style="margin-bottom: var(--space-xs);">
            <input type="text" name="title" class="form-input" placeholder="Aufgabentitel..." required autofocus />
          </div>
          
          <div class="form-field" style="margin-bottom: var(--space-xs);">
            <textarea name="description" class="form-input" rows="2" placeholder="Beschreibung (optional)"></textarea>
          </div>
          
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xs); margin-bottom: var(--space-xs);">
            <div class="form-field">
              <label style="font-size: var(--text-xs); margin-bottom: var(--space-xxs); display: block;">Priorität</label>
              <select name="priority" class="form-input" style="font-size: var(--text-sm);">
                <option value="low">Niedrig</option>
                <option value="medium" selected>Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
            
            <div class="form-field">
              <label style="font-size: var(--text-xs); margin-bottom: var(--space-xxs); display: block;">Fälligkeitsdatum</label>
              <input type="date" name="due_date" class="form-input" style="font-size: var(--text-sm);" />
            </div>
          </div>
          
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xs); margin-bottom: var(--space-xs);">
            <div class="form-field">
              <label style="font-size: var(--text-xs); margin-bottom: var(--space-xxs); display: block;">Kategorie</label>
              <select name="category_id" class="form-input" style="font-size: var(--text-sm);">
                <option value="">Keine Kategorie</option>
                ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-field">
              <label style="font-size: var(--text-xs); margin-bottom: var(--space-xxs); display: block;">Zuweisen an</label>
              <select name="assigned_to_user_id" class="form-input" style="font-size: var(--text-sm);">
                <option value="">Nicht zugewiesen</option>
                ${users.map(user => `<option value="${user.id}">${user.name}</option>`).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-actions" style="display: flex; gap: var(--space-xs);">
            <button type="submit" class="primary-btn" style="font-size: var(--text-sm); padding: var(--space-xs) var(--space-sm);">Hinzufügen</button>
            <button type="button" id="btn-cancel-quick-add" class="secondary-btn" style="font-size: var(--text-sm); padding: var(--space-xs) var(--space-sm);">Abbrechen</button>
          </div>
        </form>
      </div>
    `;

    targetColumn.insertAdjacentHTML('afterbegin', formHtml);

    // Bind Events
    const form = this.container.querySelector('#quick-add-form');
    console.log('📋 Form gefunden:', !!form);
    
    if (form) {
      form.addEventListener('submit', async (e) => {
        console.log('🚀 Form submit Event gefeuert');
        e.preventDefault();
        await this.handleQuickAdd(new FormData(form), targetStatus);
      });
    } else {
      console.error('❌ Form nicht gefunden!');
    }

    const cancelBtn = this.container.querySelector('#btn-cancel-quick-add');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        console.log('❌ Form abgebrochen');
        this.container.querySelector('.task-quick-add-form')?.remove();
      });
    }
  }

  async loadCategories() {
    try {
      const { data, error } = await window.supabase
        .from('kampagne_status')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
      return [];
    }
  }

  async loadUsers() {
    try {
      const { data, error } = await window.supabase
        .from('benutzer')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
      return [];
    }
  }

  async handleQuickAdd(formData, targetStatus = 'todo') {
    console.log('🔧 handleQuickAdd aufgerufen mit Status:', targetStatus);
    console.log('📋 FormData:', Object.fromEntries(formData));
    
    try {
      const title = formData.get('title')?.trim();
      if (!title) {
        console.warn('⚠️ Kein Titel angegeben');
        return;
      }

      const description = formData.get('description')?.trim() || null;
      const priority = formData.get('priority') || 'medium';
      const due_date = formData.get('due_date') || null;
      const category_id = formData.get('category_id') || null;
      const assigned_to_user_id = formData.get('assigned_to_user_id') || null;
      
      // Hole Entity-Daten aus der Form (Hidden Fields oder Select)
      let entity_type = formData.get('entity_type')?.trim();
      let entity_id = formData.get('entity_id')?.trim();
      
      // Konvertiere leere Strings zu null
      if (!entity_type) entity_type = null;
      if (!entity_id) entity_id = null;
      
      // Fallback auf Instance-Properties wenn Form leer ist
      if (!entity_type) entity_type = this.entityType;
      if (!entity_id) entity_id = this.entityId;
      
      // Letzter Fallback: Aus URL holen
      if (!entity_type || !entity_id) {
        const urlMatch = window.location.pathname.match(/\/(kooperation|kampagne|auftrag)\/([a-f0-9-]+)/);
        if (urlMatch) {
          entity_type = urlMatch[1];
          entity_id = urlMatch[2];
          console.log('✅ Entity-Daten aus URL geholt:', { entity_type, entity_id });
        }
      }

      console.log('🎯 Finale Entity-Daten:', entity_type, entity_id);
      console.log('📝 Task-Daten:', { title, description, priority, due_date, category_id, assigned_to_user_id, status: targetStatus });

      // Validierung: entity_type und entity_id müssen gesetzt sein
      if (!entity_type || !entity_id) {
        console.error('❌ Entity-Typ oder Entity-ID nicht gesetzt!', { entity_type, entity_id });
        window.notificationSystem?.error?.('Fehler: Keine Kooperation/Kampagne ausgewählt. Bitte öffne eine Kooperation und versuche es erneut.');
        return;
      }

      // Berechne sort_order für die Ziel-Spalte
      const tasksInTargetStatus = this.tasks.filter(t => t.status === targetStatus);
      const maxSortOrder = tasksInTargetStatus.length > 0
        ? Math.max(...tasksInTargetStatus.map(t => t.sort_order || 0))
        : 0;

      console.log('📊 Sort Order:', maxSortOrder + 1);

      const taskData = {
        title,
        description,
        status: targetStatus,
        priority,
        due_date,
        category_id: category_id || null,
        assigned_to_user_id: assigned_to_user_id || null,
        sort_order: maxSortOrder + 1,
        entity_type: entity_type,
        entity_id: entity_id,
        created_by: window.currentUser?.id || null
        // created_at und updated_at werden automatisch von der Datenbank gesetzt
      };

      console.log('💾 Sende an Supabase:', taskData);
      console.log('💾 JSON stringify:', JSON.stringify(taskData, null, 2));

      const { data, error } = await window.supabase
        .from('kooperation_tasks')
        .insert(taskData)
        .select();

      if (error) {
        console.error('❌ Supabase Fehler:', error);
        console.error('❌ Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Task erfolgreich erstellt:', data);

      window.notificationSystem?.success?.('Aufgabe erstellt.');
      this.container.querySelector('.task-quick-add-form')?.remove();
      await this.refresh();
      
      window.dispatchEvent(new CustomEvent('taskCreated', { detail: { entityType: entity_type, entityId: entity_id } }));
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Task:', error);
      window.notificationSystem?.error?.('Fehler beim Erstellen der Aufgabe: ' + error.message);
    }
  }

  async refresh() {
    await this.loadTasks();
    this.render();
    this.bindEvents();
  }

  destroy() {
    // Cleanup wenn Board nicht mehr benötigt wird
    this.container = null;
    this.tasks = [];
  }
}

