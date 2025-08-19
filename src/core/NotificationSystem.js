// NotificationSystem.js (ES6-Modul)
// Einfaches Benachrichtigungssystem für die Glocke im Header

export class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.pollIntervalMs = 60000; // 60s
    this._timer = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.bindUI();
    this.refresh(true);
    this.startPolling();
    window.addEventListener('notificationsRefresh', () => this.refresh());
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._initialized = false;
  }

  startPolling() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refresh(), this.pollIntervalMs);
  }

  bindUI() {
    const bell = document.querySelector('#notificationBell, .notification-bell');
    const dropdown = document.querySelector('#notificationDropdown, .notification-dropdown');
    if (!bell || !dropdown) return;

    const toggle = () => {
      dropdown.classList.toggle('show');
    };
    bell.addEventListener('click', (e) => {
      e.preventDefault();
      toggle();
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }

  async refresh(initial = false) {
    try {
      if (!window.supabase || !window.currentUser?.id) return;
      const { data, error } = await window.supabase
        .from('notifications')
        .select('id, user_id, type, entity, entity_id, title, message, created_at, read_at')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      this.notifications = data || [];
      this.unreadCount = (this.notifications || []).filter(n => !n.read_at).length;
      this.renderBadge();
      this.renderDropdown();
      if (!initial && this.unreadCount > 0) {
        // Optional: Sound oder Highlight
      }
    } catch (e) {
      console.warn('⚠️ Notifications refresh failed', e);
    }
  }

  renderBadge() {
    const badge = document.querySelector('#notificationBadge, .notification-badge');
    if (!badge) return;
    const count = this.unreadCount;
    badge.textContent = count > 99 ? '99+' : String(count || '');
    badge.style.display = count > 0 ? '' : 'none';
  }

  renderDropdown() {
    const dropdown = document.querySelector('#notificationDropdown, .notification-dropdown');
    if (!dropdown) return;
    const list = (this.notifications || []).map(n => {
      const url = this.getEntityUrl(n.entity, n.entity_id);
      const time = new Date(n.created_at).toLocaleString('de-DE');
      const readClass = n.read_at ? '' : 'unread';
      return `
        <div class="notification-item ${readClass}" data-id="${n.id}">
          <div class="notification-title">${this.escape(n.title || 'Benachrichtigung')}</div>
          <div class="notification-message">${this.escape(n.message || '')}</div>
          <div class="notification-meta">
            <span class="notification-time">${time}</span>
            ${url ? `<a href="${url}" data-route="${url}" class="notification-open">Öffnen</a>` : ''}
          </div>
        </div>`;
    }).join('');
    const controls = `
      <div class="notification-actions">
        <button class="btn-link" id="markAllRead">Alle als gelesen</button>
      </div>`;
    dropdown.innerHTML = `<div class="notification-list">${list || '<div class="notification-empty">Keine Benachrichtigungen</div>'}</div>${controls}`;

    dropdown.querySelector('#markAllRead')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.markAllAsRead();
      this.refresh();
    });
    dropdown.querySelectorAll('.notification-open').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const item = e.target.closest('.notification-item');
        const id = item?.dataset?.id;
        if (id) await this.markAsRead(id);
        const route = link.getAttribute('data-route');
        if (route && window.navigateTo) window.navigateTo(route);
        dropdown.classList.remove('show');
      });
    });
  }

  getEntityUrl(entity, id) {
    if (!entity || !id) return '';
    const map = {
      kampagne: `/kampagne/${id}`,
      kooperation: `/kooperation/${id}`,
      briefing: `/briefing/${id}`,
      auftrag: `/auftrag/${id}`
    };
    return map[entity] || '';
  }

  async markAsRead(id) {
    try {
      if (!window.supabase) return;
      await window.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
    } catch (e) {
      console.warn('⚠️ markAsRead failed', e);
    }
  }

  async markAllAsRead() {
    try {
      if (!window.supabase || !window.currentUser?.id) return;
      await window.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('user_id', window.currentUser.id);
    } catch (e) {
      console.warn('⚠️ markAllAsRead failed', e);
    }
  }

  async pushNotification(userId, payload) {
    try {
      if (!window.supabase || !userId) return;
      const body = {
        user_id: userId,
        type: payload?.type || 'info',
        entity: payload?.entity || null,
        entity_id: payload?.entityId || null,
        title: payload?.title || 'Benachrichtigung',
        message: payload?.message || '',
        created_at: new Date().toISOString()
      };
      await window.supabase.from('notifications').insert(body);
    } catch (e) {
      console.warn('⚠️ pushNotification failed', e);
    }
  }

  escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}

export const notificationSystem = new NotificationSystem();


