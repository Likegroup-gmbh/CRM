// KampagneKanbanBoard.js - Kanban Board für Kampagnen mit Drag & Drop
// Basiert auf TaskKanbanBoard.js

export class KampagneKanbanBoard {
  constructor() {
    console.log('🏗️ KampagneKanbanBoard Constructor');
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
  }

  async init(containerElement) {
    this.container = containerElement;
    await this.loadStatusOptions();
    await this.loadKampagnen();
    this.render();
    this.bindEvents();
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

      // Sichtbarkeit: Nicht-Admins sehen nur zugewiesene Kampagnen
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      let assignedKampagnenIds = [];

      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // 3. Kampagnen über zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          let unternehmenKampagnenIds = [];
          if (unternehmenIds.length > 0) {
            const { data: unternehmenMarken } = await window.supabase
              .from('marke')
              .select('id')
              .in('unternehmen_id', unternehmenIds);
            
            const unternehmenMarkenIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
            
            if (unternehmenMarkenIds.length > 0) {
              const { data: kampagnen } = await window.supabase
                .from('kampagne')
                .select('id')
                .in('marke_id', unternehmenMarkenIds);
              
              unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
            }
          }
          
          assignedKampagnenIds = [...new Set([
            ...directKampagnenIds,
            ...markenKampagnenIds,
            ...unternehmenKampagnenIds
          ])];
          
          console.log(`🔍 KAMPAGNEKANBAN: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            unternehmenKampagnen: unternehmenKampagnenIds.length,
            gesamt: assignedKampagnenIds.length
          });
          
          if (assignedKampagnenIds.length === 0 && window.currentUser?.rolle !== 'kunde') {
            this.kampagnen = [];
            return;
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen:', error);
          if (window.currentUser?.rolle !== 'kunde') {
            this.kampagnen = [];
            return;
          }
        }
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

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      if (!isAdmin && window.currentUser?.rolle !== 'kunde' && assignedKampagnenIds.length > 0) {
        query = query.in('id', assignedKampagnenIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnen:', error);
        throw error;
      }

      this.kampagnen = data || [];
      console.log('✅ Kampagnen geladen:', this.kampagnen.length);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen:', error);
      this.kampagnen = [];
    }
  }

  render() {
    if (!this.container) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    // Gruppiere Kampagnen nach Status
    const kampagnenByStatus = {};
    
    // Initialisiere alle Status-Spalten (auch leere)
    this.statusOptions.forEach(status => {
      kampagnenByStatus[status.id] = {
        status: status,
        kampagnen: []
      };
    });

    // Verteile Kampagnen auf die Status-Spalten
    this.kampagnen.forEach(kampagne => {
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
    
    const dueDateBadge = this.getDueDateBadge(kampagne.deadline);
    
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
              ${safe(kampagne.kampagnenname || 'Unbenannte Kampagne')}
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
  }

  destroy() {
    // Cleanup wenn Board nicht mehr benötigt wird
    this.container = null;
    this.kampagnen = [];
    this.statusOptions = [];
  }
}




