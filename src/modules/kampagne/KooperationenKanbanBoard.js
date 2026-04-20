// KooperationenKanbanBoard.js
// Kanban Board für Kooperationen auf der Kampagnen-Detail-Seite
// Gruppiert Kooperationen nach kampagne_status, DnD für Statuswechsel

export class KooperationenKanbanBoard {
  constructor({ isKunde, store, kampagneId }) {
    this.isKunde = isKunde;
    this.store = store;
    this.kampagneId = kampagneId;
    this.container = null;
    this.draggedKoop = null;
    this.activeFilterTab = 'offen';

    this.boundHandlers = {
      dragStart: (e) => this.onDragStart(e),
      dragEnd: (e) => this.onDragEnd(e),
      dragOver: (e) => this.onDragOver(e),
      drop: (e) => this.onDrop(e),
      dragLeave: (e) => this.onDragLeave(e)
    };

    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;

    this._onKooperationenUpdated = () => this.render();
    this._onStoreChanged = () => this.render();
  }

  init(container) {
    this.container = container;
    this.render();
    if (!this.isKunde) {
      this.bindDragDropEvents();
    }
    this._subscribeToUpdates();
    setTimeout(() => this.initDragToScroll(), 100);
    setTimeout(() => this.initFloatingScrollbar(), 150);
  }

  setFilterTab(tab) {
    this.activeFilterTab = tab;
    this.render();
  }

  _subscribeToUpdates() {
    window.addEventListener('kooperationen-updated', this._onKooperationenUpdated);
    if (this.store) {
      this._unsubStore = this.store.on('kooperationen-changed', this._onStoreChanged);
    }
  }

  _getKooperationen() {
    if (!this.store) return [];
    return this.store.getFiltered(this.activeFilterTab);
  }

  _getStatusOptions() {
    return this.store?.statusOptions || [];
  }

  render() {
    if (!this.container) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const kooperationen = this._getKooperationen();
    const statusOptions = this._getStatusOptions();

    const koopByStatus = {};
    statusOptions.forEach(s => { koopByStatus[s.id] = []; });

    let unknownKoops = [];
    kooperationen.forEach(koop => {
      const sid = koop.status_id;
      if (sid && koopByStatus[sid]) {
        koopByStatus[sid].push(koop);
      } else {
        unknownKoops.push(koop);
      }
    });

    const readonlyClass = this.isKunde ? ' kanban-readonly' : '';

    const html = `
      <div class="kanban-board-wrapper kooperationen-kanban-wrapper${readonlyClass}">
        <div class="kanban-board kooperationen-kanban-board">
          ${statusOptions.map(status =>
            this._renderColumn(status.id, status.name, koopByStatus[status.id] || [])
          ).join('')}
          ${unknownKoops.length > 0 ? this._renderColumn('_unknown', 'Ohne Status', unknownKoops) : ''}
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    if (!this.isKunde) {
      this.bindDragDropEvents();
    }
    setTimeout(() => this.initDragToScroll(), 50);
  }

  _renderColumn(statusId, statusName, koops) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    return `
      <div class="kanban-column" data-status-id="${statusId}">
        <div class="kanban-column-header">
          <div style="display: flex; align-items: center; gap: var(--space-xs);">
            <span class="kanban-column-title">${safe(statusName)}</span>
            <span class="kanban-count">${koops.length}</span>
          </div>
        </div>
        <div class="kanban-column-body" data-status-id="${statusId}">
          ${koops.map(koop => this._renderCard(koop)).join('')}
        </div>
      </div>
    `;
  }

  _renderCard(koop) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    const creatorName = koop.creator
      ? `${koop.creator.vorname || ''} ${koop.creator.nachname || ''}`.trim()
      : 'Kein Creator';

    const statusChip = koop.status_name
      ? `<span class="kooperation-card-status">${safe(koop.status_name)}</span>`
      : '';

    const tags = (koop._tags || []).map(t =>
      `<span class="kooperation-card-tag">${safe(t)}</span>`
    ).join('');

    const postingDatum = koop.posting_datum
      ? new Date(koop.posting_datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';

    const datumHtml = postingDatum
      ? `<span class="kooperation-card-datum">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          ${postingDatum}
        </span>`
      : '';

    let kostenHtml = '';
    if (!this.isKunde) {
      const kosten = parseFloat(koop.einkaufspreis_gesamt) || parseFloat(koop.einkaufspreis_netto) || 0;
      if (kosten > 0) {
        kostenHtml = `<span class="kooperation-card-kosten">${kosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>`;
      }
    }

    const videos = this.store?.videos?.[koop.id] || [];
    const firstVideoWithSkript = videos.find(v => v.link_skript);
    const skriptLinkHtml = firstVideoWithSkript
      ? `<a href="${firstVideoWithSkript.link_skript}" target="_blank" rel="noopener" class="kooperation-card-skript-link" title="Skript öffnen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </a>`
      : '';

    const draggable = this.isKunde ? '' : 'draggable="true"';

    return `
      <div class="task-card kooperation-card"
           ${draggable}
           data-koop-id="${koop.id}"
           data-status-id="${koop.status_id || ''}">

        <div class="kooperation-card-header">
          <span class="kooperation-card-creator">${safe(creatorName)}</span>
          ${statusChip}
        </div>

        ${tags ? `<div class="kooperation-card-tags">${tags}</div>` : ''}

        <div class="kooperation-card-footer">
          <div class="kooperation-card-meta-left">
            ${datumHtml}
            ${kostenHtml}
          </div>
          <div class="kooperation-card-meta-right">
            ${skriptLinkHtml}
          </div>
        </div>
      </div>
    `;
  }

  // ========================================
  // DRAG & DROP
  // ========================================

  bindDragDropEvents() {
    if (!this.container || this.isKunde) return;

    const cards = this.container.querySelectorAll('.kooperation-card[draggable="true"]');
    cards.forEach(card => {
      if (card.dataset.dragBound === 'true') return;
      card.addEventListener('dragstart', this.boundHandlers.dragStart);
      card.addEventListener('dragend', this.boundHandlers.dragEnd);
      card.dataset.dragBound = 'true';
    });

    const columns = this.container.querySelectorAll('.kanban-column-body');
    columns.forEach(column => {
      if (column.dataset.dropBound === 'true') return;
      column.addEventListener('dragover', this.boundHandlers.dragOver);
      column.addEventListener('drop', this.boundHandlers.drop);
      column.addEventListener('dragleave', this.boundHandlers.dragLeave);
      column.dataset.dropBound = 'true';
    });
  }

  onDragStart(e) {
    const card = e.target.closest('.kooperation-card');
    if (!card) return;
    this.draggedKoop = {
      id: card.dataset.koopId,
      statusId: card.dataset.statusId
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedKoop.id);
    card.classList.add('dragging');
  }

  onDragEnd(e) {
    const card = e.target.closest('.kooperation-card');
    if (card) card.classList.remove('dragging');
    this.container?.querySelectorAll('.kanban-column-body').forEach(col => {
      col.classList.remove('drag-over');
    });
  }

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const column = e.target.closest('.kanban-column-body');
    if (column) column.classList.add('drag-over');
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
    if (!column || !this.draggedKoop) return;

    column.classList.remove('drag-over');

    const newStatusId = column.dataset.statusId;
    if (newStatusId === '_unknown') {
      this.draggedKoop = null;
      return;
    }

    if (newStatusId !== this.draggedKoop.statusId) {
      await this._updateKooperationStatus(this.draggedKoop.id, newStatusId);
    }
    this.draggedKoop = null;
  }

  async _updateKooperationStatus(koopId, newStatusId) {
    const statusOptions = this._getStatusOptions();
    const newStatusName = statusOptions.find(s => s.id === newStatusId)?.name || '';

    const oldKoop = this.store?.kooperationen.find(k => k.id === koopId);
    const oldStatusId = oldKoop?.status_id;
    const oldStatusName = oldKoop?.status_name;

    if (this.store) {
      this.store.updateKooperation(koopId, {
        status_id: newStatusId,
        status_name: newStatusName,
        status_ref: { id: newStatusId, name: newStatusName }
      });
    }
    this.render();

    try {
      const { error } = await window.supabase
        .from('kooperationen')
        .update({ status_id: newStatusId, updated_at: new Date().toISOString() })
        .eq('id', koopId);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('kooperationen-updated', {
        detail: { kampagneId: this.kampagneId, koopId, newStatusId }
      }));
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Kooperations-Status:', error);
      window.notificationSystem?.error?.('Fehler beim Verschieben der Kooperation.');

      if (this.store && oldStatusId !== undefined) {
        this.store.updateKooperation(koopId, {
          status_id: oldStatusId,
          status_name: oldStatusName,
          status_ref: { id: oldStatusId, name: oldStatusName }
        });
      }
      this.render();
    }
  }

  // ========================================
  // DRAG TO SCROLL (horizontal)
  // ========================================

  initDragToScroll() {
    const wrapper = this.container?.querySelector('.kanban-board-wrapper');
    const board = wrapper?.querySelector('.kanban-board');
    if (!board) return;

    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
    }

    const handleMouseDown = (e) => {
      if (e.target.closest('.kooperation-card')) return;
      this.isDragging = true;
      this.startX = e.pageX - board.offsetLeft;
      this.scrollLeft = board.scrollLeft;
      board.style.cursor = 'grabbing';
      board.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - board.offsetLeft;
      const walk = (x - this.startX) * 2;
      board.scrollLeft = this.scrollLeft - walk;
    };

    const handleMouseUp = () => {
      this.isDragging = false;
      board.style.cursor = 'grab';
      board.style.userSelect = '';
    };

    board.addEventListener('mousedown', handleMouseDown);
    board.addEventListener('mousemove', handleMouseMove);
    board.addEventListener('mouseup', handleMouseUp);
    board.addEventListener('mouseleave', handleMouseUp);
    board.style.cursor = 'grab';

    this._dragToScrollCleanup = () => {
      board.removeEventListener('mousedown', handleMouseDown);
      board.removeEventListener('mousemove', handleMouseMove);
      board.removeEventListener('mouseup', handleMouseUp);
      board.removeEventListener('mouseleave', handleMouseUp);
    };
  }

  // ========================================
  // FLOATING SCROLLBAR
  // ========================================

  initFloatingScrollbar() {
    const existingScrollbar = document.querySelector('.floating-scrollbar-kooperationen-kanban');
    if (existingScrollbar) existingScrollbar.remove();

    const kanbanBoard = this.container?.querySelector('.kooperationen-kanban-board');
    if (!kanbanBoard) return;

    const floatingScrollbar = document.createElement('div');
    floatingScrollbar.className = 'floating-scrollbar-kanban floating-scrollbar-kooperationen-kanban';

    const scrollbarContent = document.createElement('div');
    floatingScrollbar.appendChild(scrollbarContent);
    document.body.appendChild(floatingScrollbar);

    const updateScrollbar = () => {
      const kanbanWrapper = this.container?.querySelector('.kanban-board-wrapper');
      if (!kanbanWrapper || !kanbanBoard) return;
      scrollbarContent.style.width = kanbanBoard.scrollWidth + 'px';
      const wrapperRect = kanbanWrapper.getBoundingClientRect();
      floatingScrollbar.style.left = wrapperRect.left + 'px';
      floatingScrollbar.style.width = wrapperRect.width + 'px';
    };

    const handleFloatingScroll = () => { kanbanBoard.scrollLeft = floatingScrollbar.scrollLeft; };
    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);

    const handleBoardScroll = () => { floatingScrollbar.scrollLeft = kanbanBoard.scrollLeft; };
    kanbanBoard.addEventListener('scroll', handleBoardScroll);

    const checkVisibility = () => {
      if (!kanbanBoard) return;
      const shouldShow = kanbanBoard.scrollWidth > kanbanBoard.clientWidth;
      floatingScrollbar.classList.toggle('visible', shouldShow);
    };

    updateScrollbar();
    checkVisibility();
    setTimeout(() => { updateScrollbar(); checkVisibility(); }, 500);

    const handleResize = () => { updateScrollbar(); checkVisibility(); };
    window.addEventListener('resize', handleResize);

    this._cleanupFloatingScrollbar = () => {
      floatingScrollbar.remove();
      window.removeEventListener('resize', handleResize);
      floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
      kanbanBoard.removeEventListener('scroll', handleBoardScroll);
    };
  }

  // ========================================
  // TAB COUNTS (Kompatibilität mit KampagneDetail.switchTab)
  // ========================================

  updateTabCounts() {
    if (!this.store) return;
    const openEl = document.getElementById('tab-count-offen');
    const closedEl = document.getElementById('tab-count-abgeschlossen');
    const allEl = document.getElementById('tab-count-alle');
    if (openEl) openEl.textContent = this.store.getOpenCount();
    if (closedEl) closedEl.textContent = this.store.getClosedCount();
    if (allEl) allEl.textContent = this.store.getAllCount();
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  destroy() {
    window.removeEventListener('kooperationen-updated', this._onKooperationenUpdated);
    if (this._unsubStore) this._unsubStore();
    if (this._dragToScrollCleanup) this._dragToScrollCleanup();
    if (this._cleanupFloatingScrollbar) this._cleanupFloatingScrollbar();
    this.container = null;
  }
}
