// PersonDetailBase.js (ES6-Modul)
// Gemeinsame Basis-Klasse für alle Personen-Detailseiten (Mitarbeiter, Kunden, Creator, Profil)
// Stellt einheitliches zwei-Spalten-Layout bereit
import { getTabIcon } from '../../core/TabUtils.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export class PersonDetailBase {
  constructor() {
    this.activeSidebarTab = 'info';
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
    const { person, stats, quickActions, sidebarInfo, tabNavigation, mainContent, layoutClass, sidebarHeader = 'Information' } = config;
    const sidebarHtml = this.renderSidebar(person, quickActions, sidebarInfo);

    if (tabNavigation) {
      const usesMainTab = tabNavigation.includes('data-main-tab=');
      const infoPaneId = usesMainTab ? 'main-informationen' : 'tab-informationen';
      const infoAttr = usesMainTab ? 'data-main-tab' : 'data-tab';
      const hasInfoButton = /data-(?:main-)?tab="(?:informationen|info)"/.test(tabNavigation);
      const hasInfoPane = mainContent.includes('id="tab-informationen"')
        || mainContent.includes('id="tab-info"')
        || mainContent.includes('id="main-informationen"')
        || mainContent.includes('id="main-info"');
      const hasActivePane = /class="[^"]*tab-pane[^"]*active/.test(mainContent);
      const infoPane = `
        <div class="tab-pane ${!hasActivePane ? 'active' : ''}" id="${infoPaneId}">
          ${sidebarHtml}
        </div>
      `;

      let mainContentWithInfo = mainContent;
      if (!hasInfoPane) {
        if (/<div class="tab-content[^"]*">/.test(mainContent)) {
          mainContentWithInfo = mainContent.replace(/<div class="tab-content[^"]*">/, (match) => `${match}${infoPane}`);
        } else {
          mainContentWithInfo = `
            <div class="tab-content secondary-tab-content">
              ${infoPane}
              ${mainContent}
            </div>
          `;
        }
      }

      return `
        <div class="profile-page-wrapper">
          <div class="profile-detail-layout profile-detail-layout--secondary-nav ${layoutClass || ''}">
            <div class="profile-sidebar profile-sidebar--secondary-fixed">
              <div class="profile-sidebar-header">Navigation</div>
              <div class="secondary-nav-sidebar">
                <div class="secondary-tab-nav">
                  ${!hasInfoButton ? `<button class="tab-button ${!hasActivePane ? 'active' : ''}" ${infoAttr}="informationen"><span class="tab-icon">${getTabIcon('informationen')}</span>Informationen</button>` : ''}
                  ${tabNavigation}
                </div>
              </div>
            </div>
            <div class="profile-main-content profile-main-content--secondary-scroll">
              ${stats && stats.length > 0 ? this.renderStatsCards(stats) : ''}
              ${mainContentWithInfo}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="profile-page-wrapper">
        <div class="profile-detail-layout ${layoutClass || ''}">
          <div class="profile-sidebar">
            <div class="profile-sidebar-header">${sidebarHeader}</div>
            ${sidebarHtml}
          </div>
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
        <div class="profile-avatar-wrapper">
          <div class="profile-avatar-section">
            <div class="profile-avatar-large ${person.avatarClickable ? 'profile-avatar-clickable' : ''}" ${person.avatarClickable ? 'id="profile-avatar-upload"' : ''}>
              ${avatarUrl
                ? `<img src="${avatarUrl}" alt="${this.sanitize(name)}" />`
                : `<div class="profile-initials-large">${initials}</div>`
              }
              ${person.avatarClickable ? `
                <div class="profile-avatar-overlay">
    ${icon('camera', { stroke: 1.5, className: 'icon-32' })}
                </div>
              ` : ''}
            </div>
            ${!avatarOnly ? `
              <div class="profile-avatar-info">
                <span class="profile-name text-md">${this.sanitize(name)}</span>
                ${subtitle ? `<p class="profile-subtitle">${this.sanitize(subtitle)}</p>` : ''}
                ${email ? `<p class="profile-email">${this.sanitize(email)}</p>` : ''}
              </div>
            ` : ''}
          </div>
          ${quickActions && quickActions.length > 0 ? this.renderQuickActions(quickActions) : ''}
        </div>
        <div class="profile-sidebar-content">
          ${sidebarInfo || renderEmptyState({ icon: 'info', title: 'Keine Informationen verfügbar', size: 'small' })}
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
   * Rendert Info-Items für die Sidebar
   * @param {Array} items - Array von {label, value, icon?, badge?}
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

          const iconHtml = item.icon ? `<div class="info-icon">${this.getInfoIcon(item.icon)}</div>` : '';
          
          return `
            <div class="profile-info-item">
              ${iconHtml}
              <div class="info-label">${item.label}</div>
              <div class="info-value">${valueHtml}</div>
            </div>
          `;
        }).filter(Boolean).join('')}
      </div>
    `;
  }

  getInfoIcon(name) {
    const keys = {
      position: 'briefcase',
      building: 'building',
      city: 'city',
      globe: 'globe',
      language: 'language',
      calendar: 'calendar',
      clock: 'clock',
      mail: 'envelope',
      phone: 'phone',
      'phone-mobile': 'phone-mobile',
      link: 'link',
      user: 'user',
      tag: 'tag',
      info: 'information-circle',
      shield: 'shield',
      check: 'check-circle',
      kooperation: 'kooperation',
      video: 'video',
      currency: 'currency-euro',
      home: 'home',
      instagram: 'instagram',
      tiktok: 'tiktok',
      linkedin: 'linkedin',
      newsletter: 'newsletter',
      invoice: 'rechnung',
      ust: 'ust',
      engagement: 'engagement',
      plug: 'plug',
      pet: 'pet',
      marken: 'tag',
      marke: 'tag',
    };
    const key = keys[name];
    return key ? icon(key, { stroke: 1.7 }) : '';
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
    const keys = {
      mail: 'envelope',
      phone: 'phone',
      link: 'link',
      edit: 'pencil-square',
      more: 'ellipsis-vertical',
    };
    const key = keys[iconName] || 'ellipsis-vertical';
    return icon(key, { stroke: 1.5 });
  }
}

// Singleton-Export für einfache Nutzung
export const personDetailBase = new PersonDetailBase();




