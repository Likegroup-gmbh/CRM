// KampagneKanbanBoard.js - Kanban Board für Kampagnen mit Drag & Drop
// Basiert auf TaskKanbanBoard.js

import { KampagneUtils } from './KampagneUtils.js';

// Debug-Flag für Logging (Production: false)
const DEBUG_KANBAN = false;
const debugLog = (...args) => DEBUG_KANBAN && console.log(...args);

export class KampagneKanbanBoard {
  constructor() {
    debugLog('🏗️ KampagneKanbanBoard Constructor');
    this.kampagnen = [];
    this.statusOptions = [];
    this.draggedKampagne = null;
    this.boundHandlers = {
      dragStart: (e) => this.onDragStart(e),
      dragEnd: (e) => this.onDragEnd(e),
      dragOver: (e) => this.onDragOver(e),
      drop: (e) => this.onDrop(e),
      dragLeave: (e) => this.onDragLeave(e)
    };
    
    // Drag-to-Scroll State
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    
    // Suchfilter
    this.searchQuery = '';
  }

  async init(containerElement) {
    this.container = containerElement;
    await this.loadStatusOptions();
    await this.loadKampagnen();
    this.render();
    this.bindEvents();
    // Warte bis DOM gerendert ist, dann initialisiere Floating Scrollbar
    setTimeout(() => this.initFloatingScrollbar(), 100);
  }

  async loadStatusOptions() {
    try {
      const { data, error } = await window.supabase
        .from('kampagne_status')
        .select('id, name, sort_order, beschreibung')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      this.statusOptions = data || [];
      console.log('✅ Status-Optionen geladen:', this.statusOptions.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Status-Optionen:', error);
      this.statusOptions = [];
    }
  }

  async loadKampagnen() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        this.kampagnen = [];
        return;
      }

      // Nutze zentralisierte Permission-Logik aus KampagneUtils
      const allowedIds = await KampagneUtils.loadAllowedKampagneIds();
      
      // null = keine Filterung (Admin/Kunde), [] = kein Zugriff
      if (allowedIds !== null && allowedIds.length === 0) {
        this.kampagnen = [];
        return;
      }

      let query = window.supabase
        .from('kampagne')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          status_ref:status_id(id, name, sort_order)
        `)
        .order('created_at', { ascending: false });

      // Permission-Filterung anwenden (nur wenn allowedIds ein Array ist)
      if (allowedIds !== null && allowedIds.length > 0) {
        query = query.in('id', allowedIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnen:', error);
        throw error;
      }

      this.kampagnen = data || [];

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen:', error);
      this.kampagnen = [];
    }
  }

  // Suchbegriff setzen und View aktualisieren
  setSearchQuery(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.render();
    this.bindEvents();
    setTimeout(() => this.initFloatingScrollbar(), 100);
  }

  // Kampagnen nach Suchbegriff filtern
  getFilteredKampagnen() {
    if (!this.searchQuery) return this.kampagnen;
    const q = this.searchQuery;
    return this.kampagnen.filter(k => {
      const name = (k.kampagnenname || '').toLowerCase();
      const eigenName = (k.eigener_name || '').toLowerCase();
      return name.includes(q) || eigenName.includes(q);
    });
  }

  render() {
    if (!this.container) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    // Gefilterte Kampagnen (berücksichtigt Suchbegriff)
    const filteredKampagnen = this.getFilteredKampagnen();

    // Gruppiere Kampagnen nach Status
    const kampagnenByStatus = {};
    
    // Initialisiere alle Status-Spalten (auch leere)
    this.statusOptions.forEach(status => {
      kampagnenByStatus[status.id] = {
        status: status,
        kampagnen: []
      };
    });

    // Verteile gefilterte Kampagnen auf die Status-Spalten
    filteredKampagnen.forEach(kampagne => {
      const statusId = kampagne.status_id;
      if (kampagnenByStatus[statusId]) {
        kampagnenByStatus[statusId].kampagnen.push(kampagne);
      }
    });

    const html = `
      <div class="kanban-board-wrapper">
        <div class="kanban-board kampagne-kanban-board">
          ${this.statusOptions.map(status => 
            this.renderColumn(
              status.id, 
              status.name, 
              kampagnenByStatus[status.id]?.kampagnen || []
            )
          ).join('')}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    
    // Nach dem Rendern Drag & Drop Events binden
    this.bindDragDropEventsAfterRender();
    
    // Initialisiere Drag-to-Scroll
    setTimeout(() => this.initDragToScroll(), 100);
  }

  initDragToScroll() {
    const wrapper = this.container.querySelector('.kanban-board-wrapper');
    if (!wrapper) {
      console.warn('⚠️ Kanban Board Wrapper nicht gefunden für Drag-to-Scroll');
      return;
    }
    
    const board = wrapper.querySelector('.kanban-board');
    if (!board) {
      console.warn('⚠️ Kanban Board nicht gefunden für Drag-to-Scroll');
      return;
    }
    
    // Mouse Down - Start Dragging
    const handleMouseDown = (e) => {
      // Ignoriere wenn auf task-card geklickt wird
      if (e.target.closest('.task-card')) return;
      
      this.isDragging = true;
      this.startX = e.pageX - board.offsetLeft;
      this.scrollLeft = board.scrollLeft;
      board.style.cursor = 'grabbing';
      board.style.userSelect = 'none';
    };
    
    // Mouse Move - Scroll
    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      
      const x = e.pageX - board.offsetLeft;
      const walk = (x - this.startX) * 2; // Scroll-Speed
      board.scrollLeft = this.scrollLeft - walk;
    };
    
    // Mouse Up/Leave - Stop Dragging
    const handleMouseUp = () => {
      this.isDragging = false;
      board.style.cursor = 'grab';
      board.style.userSelect = '';
    };
    
    // Events binden
    board.addEventListener('mousedown', handleMouseDown);
    board.addEventListener('mousemove', handleMouseMove);
    board.addEventListener('mouseup', handleMouseUp);
    board.addEventListener('mouseleave', handleMouseUp);
    
    // Initial cursor setzen
    board.style.cursor = 'grab';
    
    // Cleanup-Handler speichern
    this._dragToScrollCleanup = () => {
      board.removeEventListener('mousedown', handleMouseDown);
      board.removeEventListener('mousemove', handleMouseMove);
      board.removeEventListener('mouseup', handleMouseUp);
      board.removeEventListener('mouseleave', handleMouseUp);
      board.style.cursor = '';
      board.style.userSelect = '';
    };
    
    console.log('✅ Drag-to-Scroll initialisiert');
  }

  renderColumn(statusId, statusName, kampagnen) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    return `
      <div class="kanban-column" data-status-id="${statusId}">
        <div class="kanban-column-header">
          <div style="display: flex; align-items: center; gap: var(--space-xs);">
            <span class="kanban-column-title">${safe(statusName)}</span>
            <span class="kanban-count">${kampagnen.length}</span>
          </div>
        </div>
        <div class="kanban-column-body" data-status-id="${statusId}">
          ${kampagnen.map(kampagne => this.renderKampagneCard(kampagne)).join('')}
        </div>
      </div>
    `;
  }

  renderKampagneCard(kampagne) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    const dueDateBadge = this.getDueDateBadge(kampagne.deadline_post_produktion);
    
    // Organisation Bubble (Marke oder Unternehmen)
    const orgBubble = this.renderOrganisationBubble(kampagne);

    return `
      <div class="task-card kampagne-card" 
           draggable="true" 
           data-kampagne-id="${kampagne.id}"
           data-status-id="${kampagne.status_id}">
        
        <div class="task-card-body">
          <h4 class="task-title">
            <a href="#/kampagne/${kampagne.id}" class="kampagne-link" data-kampagne-id="${kampagne.id}">
              ${safe(KampagneUtils.getDisplayName(kampagne))}
            </a>
          </h4>
        </div>

        <div class="task-card-footer">
          <div class="task-meta-left">
            ${dueDateBadge}
          </div>
          <div class="task-meta-right">
            ${orgBubble}
          </div>
        </div>
      </div>
    `;
  }

  renderOrganisationBubble(kampagne) {
    const marke = kampagne.marke;
    const unternehmen = kampagne.unternehmen;
    
    // Bevorzuge Marke über Unternehmen
    const logoUrl = marke?.logo_url || unternehmen?.logo_url || null;
    const displayName = marke?.markenname || unternehmen?.firmenname || 'Keine Organisation';
    const entityType = marke ? 'marke' : 'unternehmen';
    const entityId = marke?.id || unternehmen?.id;
    
    if (!entityId) return '';

    const items = [{
      name: displayName,
      type: 'org',
      id: entityId,
      entityType: entityType,
      logo_url: logoUrl
    }];
    
    const bubbles = window.AvatarBubbles?.renderBubbles?.(items) || '';
    return `<div class="task-card-avatars">${bubbles}</div>`;
  }

  getDueDateBadge(deadline) {
    if (!deadline) return '';
    
    const relativeDate = this.getRelativeDate(deadline);
    
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

  bindEvents() {
    if (!this.container) return;

    // Drag & Drop Events binden
    this.bindDragDropEvents();
  }

  bindDragDropEventsAfterRender() {
    if (!this.container) return;

    // Binde Drag & Drop Events auf Kampagnen Cards
    const kampagneCards = this.container.querySelectorAll('.kampagne-card');
    kampagneCards.forEach(card => {
      // Skip wenn bereits gebunden
      if (card.dataset.dragBound === 'true') return;
      
      card.addEventListener('dragstart', this.boundHandlers.dragStart);
      card.addEventListener('dragend', this.boundHandlers.dragEnd);
      card.dataset.dragBound = 'true';
    });

    // Binde Drop-Events auf Spalten
    const columns = this.container.querySelectorAll('.kanban-column-body');
    columns.forEach(column => {
      // Skip wenn bereits gebunden
      if (column.dataset.dropBound === 'true') return;
      
      column.addEventListener('dragover', this.boundHandlers.dragOver);
      column.addEventListener('drop', this.boundHandlers.drop);
      column.addEventListener('dragleave', this.boundHandlers.dragLeave);
      column.dataset.dropBound = 'true';
    });
    
    // Binde Click-Events für Avatar-Bubbles
    if (window.AvatarBubbles?.bindClickEvents) {
      window.AvatarBubbles.bindClickEvents(this.container);
    }

    // Binde Click-Events für Kampagnen-Links
    const kampagneLinks = this.container.querySelectorAll('.kampagne-link');
    kampagneLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const kampagneId = e.target.dataset.kampagneId;
        if (kampagneId) {
          window.navigateTo(`/kampagne/${kampagneId}`);
        }
      });
    });
  }

  bindDragDropEvents() {
    this.bindDragDropEventsAfterRender();
  }

  onDragStart(e) {
    console.log('🎯 DRAG START:', e.target.dataset.kampagneId);
    this.draggedKampagne = {
      id: e.target.dataset.kampagneId,
      statusId: e.target.dataset.statusId
    };
    console.log('🎯 draggedKampagne set:', this.draggedKampagne);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedKampagne.id);

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

    const newStatusId = column.dataset.statusId;
    const kampagneId = this.draggedKampagne.id;

    // Status geändert?
    if (newStatusId !== this.draggedKampagne.statusId) {
      await this.updateKampagneStatus(kampagneId, newStatusId);
    }

    this.draggedKampagne = null;
  }

  async updateKampagneStatus(kampagneId, newStatusId) {
    try {
      console.log(`🔄 Aktualisiere Kampagne ${kampagneId} auf Status ${newStatusId}`);

      // Hole aktuellen Status für History-Log
      const kampagne = this.kampagnen.find(k => k.id === kampagneId);
      const oldStatusId = kampagne?.status_id;

      // Update Kampagne Status
      const { error } = await window.supabase
        .from('kampagne')
        .update({
          status_id: newStatusId,
          updated_at: new Date().toISOString()
        })
        .eq('id', kampagneId);

      if (error) throw error;

      console.log('✅ Kampagne-Status erfolgreich aktualisiert');

      // Optimistische UI-Aktualisierung
      await this.refresh();
      
      // Event für andere Komponenten
      window.dispatchEvent(new CustomEvent('kampagneUpdated', { 
        detail: { kampagneId, oldStatusId, newStatusId } 
      }));

    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Kampagnen-Status:', error);
      window.notificationSystem?.error?.('Fehler beim Verschieben der Kampagne.');
      // Bei Fehler: Reload um konsistenten Zustand herzustellen
      await this.refresh();
    }
  }

  async refresh() {
    await this.loadKampagnen();
    this.render();
    this.bindEvents();
    // Aktualisiere Floating Scrollbar nach Refresh
    setTimeout(() => this.initFloatingScrollbar(), 100);
  }

  initFloatingScrollbar() {
    console.log('🔧 KANBAN: Initialisiere Floating Scrollbar...');
    
    // Entferne vorhandene Floating Scrollbar falls vorhanden
    const existingScrollbar = document.querySelector('.floating-scrollbar-kanban');
    if (existingScrollbar) {
      console.log('🗑️ KANBAN: Entferne vorhandene Scrollbar');
      existingScrollbar.remove();
    }

    const kanbanBoard = document.querySelector('.kampagne-kanban-board');
    if (!kanbanBoard) {
      console.warn('⚠️ KANBAN: Kanban Board nicht gefunden!');
      return;
    }
    
    console.log('✅ KANBAN: Kanban Board gefunden', {
      scrollWidth: kanbanBoard.scrollWidth,
      clientWidth: kanbanBoard.clientWidth,
      needsScroll: kanbanBoard.scrollWidth > kanbanBoard.clientWidth
    });

    // Erstelle Floating Scrollbar Container
    const floatingScrollbar = document.createElement('div');
    floatingScrollbar.className = 'floating-scrollbar-kanban';
    
    // Erstelle einen inneren Div mit der gleichen Breite wie der scrollbare Content
    const scrollbarContent = document.createElement('div');
    floatingScrollbar.appendChild(scrollbarContent);
    
    document.body.appendChild(floatingScrollbar);
    console.log('✅ KANBAN: Floating Scrollbar in DOM eingefügt');

    // Funktion zum Aktualisieren der Scrollbar-Position und -Breite
    const updateScrollbar = () => {
      const kanbanWrapper = document.querySelector('.kanban-board-wrapper');
      if (!kanbanWrapper || !kanbanBoard) return;

      // Setze die Breite des inneren Divs auf die scrollbare Breite
      scrollbarContent.style.width = kanbanBoard.scrollWidth + 'px';
      
      // Positioniere die Floating Scrollbar über dem kanban-board-wrapper
      const wrapperRect = kanbanWrapper.getBoundingClientRect();
      floatingScrollbar.style.left = wrapperRect.left + 'px';
      floatingScrollbar.style.width = wrapperRect.width + 'px';
    };

    // Synchronisiere Scroll zwischen Floating Scrollbar und Kanban Board
    const handleFloatingScroll = () => {
      kanbanBoard.scrollLeft = floatingScrollbar.scrollLeft;
    };
    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);

    const handleBoardScroll = () => {
      floatingScrollbar.scrollLeft = kanbanBoard.scrollLeft;
    };
    kanbanBoard.addEventListener('scroll', handleBoardScroll);

    // Zeige/verstecke die Floating Scrollbar basierend auf Scroll-Notwendigkeit
    const checkScrollbarVisibility = () => {
      if (!kanbanBoard) {
        console.warn('⚠️ KANBAN: Board nicht gefunden');
        return;
      }

      // Prüfe ob wir auf der Kampagnen-Übersichtsseite sind (nicht Detail-Seite)
      const pathname = window.location.pathname;
      const isKampagnenOverviewPage = (pathname === '/kampagne' || pathname === '/kampagne/' || pathname.startsWith('/kampagne?'));
      
      console.log('🔍 KANBAN: Sichtbarkeits-Check', {
        pathname: pathname,
        isKampagnenOverviewPage: isKampagnenOverviewPage,
        scrollWidth: kanbanBoard.scrollWidth,
        clientWidth: kanbanBoard.clientWidth,
        needsScroll: kanbanBoard.scrollWidth > kanbanBoard.clientWidth,
        offsetParent: kanbanBoard.offsetParent !== null
      });
      
      // Zeige Scrollbar wenn auf Übersichtsseite UND Scrolling nötig ist
      const shouldShow = isKampagnenOverviewPage && kanbanBoard.scrollWidth > kanbanBoard.clientWidth;
      
      if (shouldShow) {
        floatingScrollbar.classList.add('visible');
        console.log('✅ KANBAN: Floating Scrollbar SICHTBAR');
      } else {
        floatingScrollbar.classList.remove('visible');
        console.log('❌ KANBAN: Floating Scrollbar VERSTECKT - Grund:', 
          !isKampagnenOverviewPage ? 'Nicht auf Kampagnen-Übersicht' : 'Kein Scrolling nötig'
        );
      }
    };

    // Initial Setup
    updateScrollbar();
    checkScrollbarVisibility();
    
    // Zusätzlicher Check nach 500ms, falls Layout noch nicht fertig war
    setTimeout(() => {
      console.log('🔄 KANBAN: Verzögerter Sichtbarkeits-Check');
      updateScrollbar();
      checkScrollbarVisibility();
    }, 500);

    // Update bei Window Resize
    const handleResize = () => {
      updateScrollbar();
      checkScrollbarVisibility();
    };
    window.addEventListener('resize', handleResize);

    // Update bei Tab-Wechsel (falls Filter die Breite ändern)
    const handleTabChanged = () => {
      setTimeout(() => {
        updateScrollbar();
        checkScrollbarVisibility();
      }, 100);
    };
    document.addEventListener('tab-changed', handleTabChanged);

    // Cleanup bei destroy
    this._cleanupFloatingScrollbar = () => {
      console.log('🗑️ KANBAN: Cleanup Floating Scrollbar');
      floatingScrollbar.remove();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('tab-changed', handleTabChanged);
      floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
      kanbanBoard.removeEventListener('scroll', handleBoardScroll);
    };
  }

  destroy() {
    // Drag-to-Scroll Cleanup
    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
      this._dragToScrollCleanup = null;
      console.log('✅ Drag-to-Scroll cleanup abgeschlossen');
    }
    
    // Cleanup Floating Scrollbar
    if (this._cleanupFloatingScrollbar) {
      this._cleanupFloatingScrollbar();
    }
    
    // Cleanup wenn Board nicht mehr benötigt wird
    this.container = null;
    this.kampagnen = [];
    this.statusOptions = [];
  }
}




