// PersonDetailBase.js (ES6-Modul)
// Gemeinsame Basis-Klasse für alle Personen-Detailseiten (Mitarbeiter, Kunden, Creator, Profil)
// Stellt einheitliches zwei-Spalten-Layout bereit
import { getTabIcon } from '../../core/TabUtils.js';

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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 32px; height: 32px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
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
          ${sidebarInfo || '<p class="empty-state">Keine Informationen verfügbar.</p>'}
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
    const icons = {
      position: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" /></svg>`,
      building: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>`,
      city: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>`,
      globe: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`,
      language: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" /></svg>`,
      calendar: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`,
      clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      mail: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`,
      phone: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>`,
      link: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>`,
      user: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`,
      tag: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`,
      shield: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>`,
      check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      kooperation: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25h2.25A2.25 2.25 0 0 1 20.25 7.5v9a2.25 2.25 0 0 1-2.25 2.25h-2.25m-7.5-13.5H6A2.25 2.25 0 0 0 3.75 7.5v9A2.25 2.25 0 0 0 6 18.75h2.25m-1.5-9h10.5m-10.5 4.5h10.5" /></svg>`,
      video: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.5-2.598v8.196l-4.5-2.598m-9.75 4.5h8.25A2.25 2.25 0 0 0 16.5 15.75v-7.5A2.25 2.25 0 0 0 14.25 6H6A2.25 2.25 0 0 0 3.75 8.25v7.5A2.25 2.25 0 0 0 6 18Z" /></svg>`,
      currency: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      home: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>`,
      instagram: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
      tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
      marken: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`,
      marke: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`,
    };
    return icons[name] || '';
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




