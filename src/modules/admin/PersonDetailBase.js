// PersonDetailBase.js (ES6-Modul)
// Gemeinsame Basis-Klasse für alle Personen-Detailseiten (Mitarbeiter, Kunden, Creator, Profil)
// Stellt einheitliches zwei-Spalten-Layout bereit

export class PersonDetailBase {
  constructor() {
    this.activeSidebarTab = 'info';
    this.activities = [];
    this._sidebarTabsBound = false;
  }

  // ============================================
  // LAYOUT RENDERING
  // ============================================

  /**
   * Rendert das komplette Layout mit Tab-Navigation oben und zwei-Spalten darunter
   * @param {Object} config - Konfiguration für das Layout
   * @param {Object} config.person - Personen-Daten (name, email, avatar, etc.)
   * @param {Array} config.stats - Stats für die Cards oben
   * @param {Array} config.quickActions - Quick-Action Buttons
   * @param {Object} config.sidebarInfo - Info-Tab Inhalt
   * @param {string} config.tabNavigation - HTML für die Tab-Navigation (volle Breite oben)
   * @param {string} config.mainContent - HTML für den Hauptbereich (Tab-Content)
   * @returns {string} HTML
   */
  renderTwoColumnLayout(config) {
    const { person, stats, quickActions, sidebarInfo, tabNavigation, mainContent } = config;

    return `
      <div class="profile-page-wrapper">
        <!-- Tab-Navigation oben über volle Breite -->
        ${tabNavigation ? `
          <div class="profile-tabs-header">
            ${tabNavigation}
          </div>
        ` : ''}

        <!-- Zwei-Spalten-Layout darunter -->
        <div class="profile-detail-layout">
          <!-- Linke Spalte: Sidebar -->
          <div class="profile-sidebar">
            ${this.renderSidebar(person, quickActions, sidebarInfo)}
          </div>

          <!-- Rechte Spalte: Haupt-Content -->
          <div class="profile-main-content">
            ${stats && stats.length > 0 ? this.renderStatsCards(stats) : ''}
            ${mainContent}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendert die komplette Sidebar
   * @param {Object} person - Personen-Daten
   * @param {boolean} person.avatarOnly - Wenn true, wird nur das Avatar/Logo angezeigt (ohne Name/Subtitle/Email im Header)
   */
  renderSidebar(person, quickActions, sidebarInfo) {
    const name = person.name || 'Unbekannt';
    const email = person.email || '';
    const subtitle = person.subtitle || '';
    const initials = this.getInitials(name);
    const avatarUrl = person.avatarUrl || person.profile_image_url || null;
    const avatarOnly = person.avatarOnly || false;

    return `
      <div class="profile-sidebar-card">
        <!-- Avatar Section -->
        <div class="profile-avatar-section">
          <div class="profile-avatar-large ${person.avatarClickable ? 'profile-avatar-clickable' : ''}" ${person.avatarClickable ? 'id="profile-avatar-upload"' : ''}>
            ${avatarUrl 
              ? `<img src="${avatarUrl}" alt="${this.sanitize(name)}" />` 
              : `<div class="profile-initials-large">${initials}</div>`
            }
            ${person.avatarClickable ? `
              <div class="profile-avatar-overlay">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 32px; height: 32px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
            ` : ''}
          </div>
          ${!avatarOnly ? `<span class="profile-name text-md">${this.sanitize(name)}</span>` : ''}
          ${!avatarOnly && subtitle ? `<p class="profile-subtitle" style="font-size: 0.875rem; color: var(--text-secondary); margin: 0 0 var(--space-xs) 0;">${this.sanitize(subtitle)}</p>` : ''}
          ${!avatarOnly && email ? `<p class="profile-email">${this.sanitize(email)}</p>` : ''}
          
          ${quickActions && quickActions.length > 0 ? this.renderQuickActions(quickActions) : ''}
        </div>

        <!-- Sidebar Tabs -->
        <div class="profile-info-tabs">
          <button class="profile-sidebar-tab ${this.activeSidebarTab === 'info' ? 'active' : ''}" data-sidebar-tab="info">
            Info
          </button>
          <button class="profile-sidebar-tab ${this.activeSidebarTab === 'activities' ? 'active' : ''}" data-sidebar-tab="activities">
            Aktivitäten
          </button>
        </div>

        <!-- Sidebar Tab Content -->
        <div class="profile-sidebar-content">
          <div class="profile-sidebar-pane ${this.activeSidebarTab === 'info' ? 'active' : ''}" id="sidebar-info">
            ${sidebarInfo || '<p class="empty-state">Keine Informationen verfügbar.</p>'}
          </div>
          <div class="profile-sidebar-pane ${this.activeSidebarTab === 'activities' ? 'active' : ''}" id="sidebar-activities">
            ${this.renderActivitiesTimeline()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendert die Quick-Action Buttons (Mail, Telefon, etc.)
   * @param {Array} actions - Array von {icon, label, action, href, disabled}
   */
  renderQuickActions(actions) {
    if (!actions || actions.length === 0) return '';

    const buttons = actions.map(action => {
      const isDisabled = action.disabled || (!action.href && !action.action);
      const dataAttr = action.action ? `data-action="${action.action}"` : '';
      const hrefAttr = action.href ? `href="${action.href}"` : 'href="#"';
      const targetAttr = action.href && action.href.startsWith('http') ? 'target="_blank" rel="noopener"' : '';
      
      return `
        <a ${hrefAttr} ${targetAttr} class="profile-action-btn ${isDisabled ? 'disabled' : ''}" ${dataAttr} ${isDisabled ? 'aria-disabled="true"' : ''}>
          ${this.getActionIcon(action.icon)}
          <span>${action.label}</span>
        </a>
      `;
    }).join('');

    return `<div class="profile-actions">${buttons}</div>`;
  }

  /**
   * Rendert Stats-Cards im 3er Grid
   * @param {Array} stats - Array von {label, value, icon?, link?}
   */
  renderStatsCards(stats) {
    if (!stats || stats.length === 0) return '';

    const cards = stats.map(stat => `
      <div class="stat-card">
        ${stat.icon ? `<div class="stat-icon">${stat.icon}</div>` : ''}
        <div class="stat-content">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-label">${stat.label}</div>
        </div>
        ${stat.link ? `<a href="${stat.link}" class="stat-link" onclick="event.preventDefault(); window.navigateTo('${stat.link}')">→</a>` : ''}
      </div>
    `).join('');

    return `
      <div class="stats-cards-grid">
        ${cards}
      </div>
    `;
  }

  /**
   * Rendert die Activities-Timeline in der Sidebar
   */
  renderActivitiesTimeline() {
    if (!this.activities || this.activities.length === 0) {
      return '<div class="empty-state"><p>Keine Aktivitäten vorhanden.</p></div>';
    }

    const entries = this.activities.map(activity => `
      <div class="timeline-entry">
        <div class="timeline-icon ${activity.type ? `timeline-icon-${activity.type}` : ''}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <strong>${this.sanitize(activity.title || activity.type || 'Aktivität')}</strong>
            <span class="timeline-date">${this.formatDateTime(activity.created_at)}</span>
          </div>
          <div class="timeline-body">
            ${activity.entity_name ? `<div class="timeline-entity">${this.sanitize(activity.entity_name)}</div>` : ''}
            ${activity.action ? `<div class="timeline-action">${this.sanitize(activity.action)}</div>` : ''}
            ${activity.comment ? `<div class="timeline-comment">${this.sanitize(activity.comment)}</div>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    return `<div class="timeline">${entries}</div>`;
  }

  /**
   * Rendert Info-Items für die Sidebar
   * @param {Array} items - Array von {label, value, badge?}
   */
  renderInfoItems(items) {
    if (!items || items.length === 0) return '';

    return `
      <div class="profile-info-section">
        ${items.map(item => {
          if (!item.rawHtml && (item.value === null || item.value === undefined || item.value === '' || item.value === '-')) return '';
          
          let valueHtml = '';
          if (item.rawHtml) {
            valueHtml = item.rawHtml;
          } else if (item.badge) {
            valueHtml = `<span class="badge badge-${item.badgeType || 'secondary'}">${this.sanitize(item.value)}</span>`;
          } else if (item.tags && Array.isArray(item.value)) {
            valueHtml = item.value.map(v => `<span class="tag">${this.sanitize(v)}</span>`).join('');
          } else if (item.mailto && item.value && item.value !== '-') {
            valueHtml = `<a href="mailto:${this.sanitize(item.value)}" class="info-mailto-link">${this.sanitize(item.value)}</a>`;
          } else {
            valueHtml = this.sanitize(String(item.value));
          }
          
          return `
            <div class="profile-info-item">
              <div class="info-label">${item.label}</div>
              <div class="info-value">${valueHtml}</div>
            </div>
          `;
        }).filter(Boolean).join('')}
      </div>
    `;
  }

  // ============================================
  // EVENT BINDING
  // ============================================

  /**
   * Bindet die Sidebar-Tab Events
   */
  bindSidebarTabs() {
    // Vermeide doppelte Event-Listener
    if (this._sidebarTabsBound) return;
    
    const tabButtons = document.querySelectorAll('[data-sidebar-tab]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.sidebarTab;
        this.activeSidebarTab = tab;
        
        // Update UI
        document.querySelectorAll('.profile-sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.profile-sidebar-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        document.getElementById(`sidebar-${tab}`)?.classList.add('active');
      });
    });
    
    this._sidebarTabsBound = true;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Holt Initialen aus einem Namen
   */
  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Sanitiert HTML
   */
  sanitize(text) {
    if (text === null || text === undefined) return '';
    return window.validatorSystem?.sanitizeHtml?.(String(text)) ?? String(text);
  }

  /**
   * Formatiert ein Datum
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }

  /**
   * Formatiert Datum mit Zeit
   */
  formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatiert Währung
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  /**
   * Gibt das Icon-SVG für eine Action zurück
   */
  getActionIcon(iconName) {
    const icons = {
      mail: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>`,
      phone: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>`,
      link: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>`,
      edit: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>`,
      more: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>`
    };
    return icons[iconName] || icons.more;
  }
}

// Singleton-Export für einfache Nutzung
export const personDetailBase = new PersonDetailBase();




