// FeedbackNotifications.js - Benachrichtigungssystem für Feedback-Tickets
// Zeigt Mitarbeitern ihre offenen Tickets und neue Kommentare an

export class FeedbackNotifications {
  constructor() {
    this.ticketCount = 0;
    this.notifications = [];
    this.openTickets = [];
    this.unreadCount = 0;
    this._initialized = false;
    this._subscription = null;
    this._activeTab = 'comments'; // 'comments' oder 'tickets'
  }

  /**
   * Initialisiert das Notification-System
   */
  async init() {
    if (this._initialized) return;
    
    // Nur für eingeloggte Benutzer
    if (!window.currentUser?.id) {
      console.log('🔔 FeedbackNotifications: Kein User eingeloggt');
      return;
    }

    this._initialized = true;
    this.bindUI();
    await this.refresh();
    this.subscribeToChanges();
    
    console.log('🔔 FeedbackNotifications initialisiert');
  }

  /**
   * Zerstört das System (Cleanup)
   */
  destroy() {
    if (this._subscription) {
      window.supabase?.removeChannel(this._subscription);
      this._subscription = null;
    }
    this._initialized = false;
  }

  /**
   * Bindet UI-Events
   */
  bindUI() {
    const menu = document.getElementById('feedbackNotificationMenu');
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    
    if (!bell || !dropdown || !menu) {
      console.warn('🔔 FeedbackNotifications: UI-Elemente nicht gefunden');
      return;
    }

    // Speichere Referenzen
    this._menu = menu;
    this._bell = bell;
    this._dropdown = dropdown;
    this._isDropdownOpen = false;

    // Zeige den Button nur für Nicht-Kunden (Kunden sollen keine Notifications sehen)
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    menu.style.display = isKunde ? 'none' : '';

    // Toggle Dropdown
    bell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (this._isDropdownOpen) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    });

    // Schließen bei Klick außerhalb (mit Verzögerung um Race Conditions zu vermeiden)
    document.addEventListener('click', (e) => {
      // Nur schließen wenn das Dropdown offen ist und der Klick außerhalb war
      if (this._isDropdownOpen && !menu.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  /**
   * Öffnet das Dropdown
   */
  openDropdown() {
    if (!this._dropdown) return;
    this._isDropdownOpen = true;
    this._dropdown.classList.add('show');
    
    // Badge aktualisieren nach kurzem Delay (damit User die Zahl noch sieht)
    setTimeout(() => {
      this.markAllAsReadSilent();
    }, 500);
  }

  /**
   * Schließt das Dropdown
   */
  closeDropdown() {
    if (!this._dropdown) return;
    this._isDropdownOpen = false;
    this._dropdown.classList.remove('show');
  }

  /**
   * Lädt alle Daten neu
   * @param {boolean} forceRender - Erzwingt Dropdown-Render auch wenn offen
   */
  async refresh(forceRender = false) {
    try {
      if (!window.supabase || !window.currentUser?.id) return;
      
      await Promise.all([
        this.loadOpenTickets(),
        this.loadNotifications()
      ]);
      
      this.renderBadge();
      
      // Dropdown nur neu rendern wenn es geschlossen ist oder forceRender
      // So bleibt das Dropdown stabil wenn der User es gerade ansieht
      if (!this._isDropdownOpen || forceRender) {
        this.renderDropdown();
      }
    } catch (e) {
      console.warn('🔔 FeedbackNotifications refresh failed:', e);
    }
  }

  /**
   * Lädt die Anzahl der nicht-erledigten eigenen Tickets
   */
  async loadTicketCount() {
    const { data, error } = await window.supabase
      .from('feedback')
      .select('id', { count: 'exact' })
      .eq('created_by', window.currentUser.id)
      .neq('status', 'closed')
      .eq('archived', false);

    if (error) {
      console.error('Fehler beim Laden der Ticket-Anzahl:', error);
      return;
    }

    this.ticketCount = data?.length || 0;
  }

  /**
   * Lädt Benachrichtigungen für Kommentare auf eigene Tickets
   */
  async loadNotifications() {
    // Lade NUR Feedback-Kommentar-Benachrichtigungen (type = 'feedback_comment')
    const { data, error } = await window.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .eq('type', 'feedback_comment')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Fehler beim Laden der Benachrichtigungen:', error);
      return;
    }

    this.notifications = data || [];
    this.unreadCount = this.notifications.filter(n => !n.read_at).length;
  }

  /**
   * Lädt alle offenen Tickets des Users (für den Tickets-Tab)
   */
  async loadOpenTickets() {
    const { data, error } = await window.supabase
      .from('feedback')
      .select('id, description, category, priority, status, created_at')
      .eq('created_by', window.currentUser.id)
      .neq('status', 'closed')
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der offenen Tickets:', error);
      return;
    }

    this.openTickets = data || [];
    this.ticketCount = this.openTickets.length;
  }

  /**
   * Rendert den Badge mit der Anzahl
   */
  renderBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    // Badge zeigt ungelesene Kommentar-Benachrichtigungen
    const totalCount = this.unreadCount;
    
    badge.textContent = totalCount > 99 ? '99+' : String(totalCount || '');
    badge.style.display = totalCount > 0 ? '' : 'none';
  }

  /**
   * Rendert das Dropdown-Menü mit Tab-System
   */
  renderDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    // Tab-Navigation
    const tabsHtml = `
      <div class="notification-tabs">
        <button class="notification-tab ${this._activeTab === 'comments' ? 'active' : ''}" data-tab="comments">
          Kommentare
          <span class="notification-tab-badge">${this.unreadCount}</span>
        </button>
        <button class="notification-tab ${this._activeTab === 'tickets' ? 'active' : ''}" data-tab="tickets">
          Tickets
          <span class="notification-tab-badge">${this.ticketCount}</span>
        </button>
      </div>
    `;

    // Kommentare Tab-Inhalt
    const commentsContent = this.renderCommentsTab();
    
    // Tickets Tab-Inhalt
    const ticketsContent = this.renderTicketsTab();

    dropdown.innerHTML = tabsHtml + commentsContent + ticketsContent;

    // Tab-Wechsel Event-Listener
    dropdown.querySelectorAll('.notification-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabName = tab.dataset.tab;
        this._activeTab = tabName;
        
        // Tabs aktiv/inaktiv setzen
        dropdown.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Tab-Inhalte ein-/ausblenden
        dropdown.querySelectorAll('.notification-tab-content').forEach(content => {
          content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
        });
      });
    });

    // Event-Listener für Kommentare-Tab
    this.bindCommentEvents(dropdown);
    
    // Event-Listener für Tickets-Tab
    this.bindTicketEvents(dropdown);
  }

  /**
   * Rendert den Kommentare-Tab
   */
  renderCommentsTab() {
    let listHtml = '';
    if (this.notifications.length > 0) {
      listHtml = this.notifications.map(n => {
        const time = this.formatTime(n.created_at);
        const readClass = n.read_at ? '' : 'unread';
        return `
          <div class="notification-item ${readClass}" data-id="${n.id}" data-entity-id="${n.entity_id}">
            <div class="notification-title">${this.escape(n.title || 'Neuer Kommentar')}</div>
            <div class="notification-message">${this.escape(n.message || '')}</div>
            <div class="notification-meta">
              <span class="notification-time">${time}</span>
              <a href="#" class="notification-open" data-feedback-id="${n.entity_id}">Öffnen</a>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listHtml = '<div class="notification-empty">Keine neuen Kommentare</div>';
    }

    const actionsHtml = this.notifications.length > 0 ? `
      <div class="notification-actions">
        <button class="btn-link" id="markAllFeedbackRead">Alle als gelesen</button>
      </div>
    ` : '';

    return `
      <div class="notification-tab-content" data-tab="comments" style="${this._activeTab === 'comments' ? '' : 'display:none'}">
        <div class="notification-list">${listHtml}</div>
        ${actionsHtml}
      </div>
    `;
  }

  /**
   * Rendert den Tickets-Tab
   */
  renderTicketsTab() {
    const statusLabels = {
      'open': 'Offen',
      'in_progress': 'In Arbeit',
      'additions': 'Ergänzungen',
      'backlog': 'Backlog'
    };
    
    const categoryLabels = {
      'bug': 'Bug',
      'feature': 'Feature'
    };

    let listHtml = '';
    if (this.openTickets.length > 0) {
      listHtml = this.openTickets.map(ticket => {
        const time = this.formatTime(ticket.created_at);
        const description = ticket.description?.substring(0, 80) + (ticket.description?.length > 80 ? '...' : '');
        return `
          <div class="notification-item" data-ticket-id="${ticket.id}" data-priority="${ticket.priority || 'low'}">
            <div class="notification-title">${this.escape(description || 'Kein Titel')}</div>
            <div class="notification-ticket-category">
              <span class="notification-ticket-status" data-status="${ticket.status}">${statusLabels[ticket.status] || ticket.status}</span>
              <span>${categoryLabels[ticket.category] || ticket.category}</span>
              <span>•</span>
              <span>${time}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listHtml = '<div class="notification-empty">Keine offenen Tickets</div>';
    }

    return `
      <div class="notification-tab-content" data-tab="tickets" style="${this._activeTab === 'tickets' ? '' : 'display:none'}">
        <div class="notification-list">${listHtml}</div>
      </div>
    `;
  }

  /**
   * Bindet Event-Listener für den Kommentare-Tab
   */
  bindCommentEvents(dropdown) {
    // Event-Listener für "Alle als gelesen"
    dropdown.querySelector('#markAllFeedbackRead')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.markAllAsRead();
    });

    // Event-Listener für "Öffnen" Links
    dropdown.querySelectorAll('[data-tab="comments"] .notification-open').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = e.target.closest('.notification-item');
        const notificationId = item?.dataset?.id;
        const feedbackId = link.dataset.feedbackId;
        
        if (notificationId) {
          await this.markAsRead(notificationId);
        }
        
        this.closeDropdown();
        
        if (feedbackId && window.navigateTo) {
          window.navigateTo(`/feedback?highlight=${feedbackId}`);
        } else if (window.navigateTo) {
          window.navigateTo('/feedback');
        }
      });
    });

    // Klick auf Kommentar-Item
    dropdown.querySelectorAll('[data-tab="comments"] .notification-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('notification-open')) return;
        e.stopPropagation();
        
        const notificationId = item.dataset.id;
        const feedbackId = item.dataset.entityId;
        
        if (notificationId) {
          await this.markAsRead(notificationId);
        }
        
        this.closeDropdown();
        
        if (feedbackId && window.navigateTo) {
          window.navigateTo(`/feedback?highlight=${feedbackId}`);
        }
      });
    });
  }

  /**
   * Bindet Event-Listener für den Tickets-Tab
   */
  bindTicketEvents(dropdown) {
    dropdown.querySelectorAll('[data-tab="tickets"] .notification-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticketId = item.dataset.ticketId;
        
        this.closeDropdown();
        
        if (ticketId && window.navigateTo) {
          window.navigateTo(`/feedback?highlight=${ticketId}`);
        }
      });
    });
  }

  /**
   * Markiert eine Benachrichtigung als gelesen
   */
  async markAsRead(notificationId) {
    try {
      await window.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      
      // Lokalen State aktualisieren
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read_at = new Date().toISOString();
        this.unreadCount = this.notifications.filter(n => !n.read_at).length;
        this.renderBadge();
      }
    } catch (e) {
      console.warn('markAsRead failed:', e);
    }
  }

  /**
   * Markiert alle Benachrichtigungen als gelesen (mit UI-Update)
   */
  async markAllAsRead() {
    try {
      await window.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', window.currentUser.id)
        .eq('type', 'feedback_comment')
        .is('read_at', null);
      
      // Lokalen State aktualisieren
      this.notifications.forEach(n => {
        if (!n.read_at) {
          n.read_at = new Date().toISOString();
        }
      });
      this.unreadCount = 0;
      this.renderBadge();
      this.renderDropdown();
    } catch (e) {
      console.warn('markAllAsRead failed:', e);
    }
  }

  /**
   * Markiert alle als gelesen OHNE UI-Update (für automatisches Markieren beim Öffnen)
   */
  async markAllAsReadSilent() {
    try {
      if (this.unreadCount === 0) return;
      
      await window.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', window.currentUser.id)
        .eq('type', 'feedback_comment')
        .is('read_at', null);
      
      // Lokalen State aktualisieren
      this.notifications.forEach(n => {
        if (!n.read_at) {
          n.read_at = new Date().toISOString();
        }
      });
      this.unreadCount = 0;
      
      // Nur Badge aktualisieren, nicht das Dropdown
      this.renderBadge();
    } catch (e) {
      console.warn('markAllAsReadSilent failed:', e);
    }
  }

  /**
   * Erstellt eine Benachrichtigung für einen neuen Kommentar
   * @param {string} ticketOwnerId - ID des Ticket-Erstellers
   * @param {string} feedbackId - ID des Feedbacks
   * @param {string} commentText - Text des Kommentars
   * @param {string} commenterName - Name des Kommentierenden
   */
  static async createCommentNotification(ticketOwnerId, feedbackId, commentText, commenterName) {
    try {
      // Nicht benachrichtigen wenn der Ersteller selbst kommentiert
      if (ticketOwnerId === window.currentUser?.id) {
        console.log('🔔 Keine Benachrichtigung: Ersteller kommentiert selbst');
        return;
      }

      console.log('🔔 Erstelle Kommentar-Benachrichtigung für:', ticketOwnerId);
      
      const { data, error } = await window.supabase.from('notifications').insert({
        user_id: ticketOwnerId,
        type: 'feedback_comment',
        entity: 'feedback',
        entity_id: feedbackId,
        title: `Neuer Kommentar von ${commenterName}`,
        message: commentText.substring(0, 100) + (commentText.length > 100 ? '...' : ''),
        created_at: new Date().toISOString()
      }).select();

      if (error) {
        console.error('🔔 Fehler beim Erstellen der Benachrichtigung:', error);
        return;
      }
      
      console.log('🔔 Benachrichtigung erstellt:', data);

      // Event auslösen für sofortige UI-Updates
      window.dispatchEvent(new CustomEvent('feedbackNotificationUpdate'));
    } catch (e) {
      console.warn('createCommentNotification failed:', e);
    }
  }

  /**
   * Abonniert Realtime-Änderungen für Live-Updates
   */
  subscribeToChanges() {
    if (!window.supabase) return;

    // Listener für manuelle Updates (z.B. nach Kommentar-Erstellung)
    window.addEventListener('feedbackNotificationUpdate', () => {
      console.log('🔔 Manual notification update triggered');
      this.refresh(true); // Force render auch wenn Dropdown offen
    });

    // Realtime Subscription für alle relevanten Änderungen
    this._subscription = window.supabase
      .channel('feedback-notifications-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${window.currentUser.id}`
        },
        (payload) => {
          // Nur auf Feedback-Kommentar-Benachrichtigungen reagieren
          if (payload.new?.type === 'feedback_comment') {
            console.log('🔔 New notification received:', payload.new?.title);
            this.refresh(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback',
          filter: `created_by=eq.${window.currentUser.id}`
        },
        (payload) => {
          // Bei Änderungen an eigenen Tickets (Status, etc.)
          console.log('🔔 Own feedback changed:', payload.eventType, payload.new?.status);
          this.refresh(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback'
        },
        (payload) => {
          // Bei ALLEN Feedback-Änderungen prüfen ob es ein eigenes Ticket betrifft
          // (z.B. wenn Admin den Status ändert)
          const isOwnTicket = 
            payload.new?.created_by === window.currentUser?.id ||
            payload.old?.created_by === window.currentUser?.id;
          
          if (isOwnTicket) {
            console.log('🔔 Feedback update (own ticket):', payload.eventType);
            this.refresh(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Realtime subscription status:', status);
      });
  }

  /**
   * Formatiert einen Timestamp für die Anzeige
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    });
  }

  /**
   * Escaped HTML-Zeichen
   */
  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Singleton-Export
export const feedbackNotifications = new FeedbackNotifications();
