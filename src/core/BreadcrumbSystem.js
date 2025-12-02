// BreadcrumbSystem.js (ES6-Modul)
// Zentrale Breadcrumb-Navigation für das CRM

import { navigationSystem } from '../modules/navigation/NavigationSystem.js';

export class BreadcrumbSystem {
  constructor() {
    this.container = null;
    this.currentBreadcrumbs = [];
  }

  // Finde das Icon für eine gegebene URL aus der Navigation
  getIconForUrl(url) {
    if (!url) return null;
    
    // Extrahiere den Basis-Pfad (z.B. /auftrag aus /auftrag/123)
    const basePath = '/' + url.split('/').filter(Boolean)[0];
    
    // Durchsuche alle Nav-Sections
    for (const section of navigationSystem.navSections) {
      for (const item of section.items) {
        if (item.url === basePath || item.url === url) {
          return navigationSystem.getIcon(item.icon);
        }
      }
    }
    return null;
  }

  // Initialisiere Breadcrumb-System
  init() {
    this.container = document.getElementById('breadcrumb-container');
    if (!this.container) {
      console.warn('⚠️ BreadcrumbSystem: Container nicht gefunden');
      return;
    }
    console.log('✅ BreadcrumbSystem: Initialisiert');
  }

  // Breadcrumb aktualisieren
  updateBreadcrumb(crumbs) {
    if (!this.container) {
      console.warn('⚠️ BreadcrumbSystem: Container nicht initialisiert');
      return;
    }

    this.currentBreadcrumbs = crumbs;
    this.render();
  }

  // Breadcrumb zurücksetzen
  reset() {
    this.currentBreadcrumbs = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  // Breadcrumb rendern
  render() {
    if (!this.container || !this.currentBreadcrumbs.length) {
      if (this.container) {
        this.container.innerHTML = '';
      }
      return;
    }

    const breadcrumbHtml = this.currentBreadcrumbs.map((crumb, index) => {
      const isFirst = index === 0;
      const isLast = index === this.currentBreadcrumbs.length - 1;
      const sanitizedLabel = window.validatorSystem?.sanitizeHtml?.(crumb.label) || crumb.label;
      
      // Für den ersten Eintrag das passende Icon aus der Navigation holen
      const iconHtml = isFirst ? this.getIconForUrl(crumb.url) : null;
      const iconPrefix = iconHtml ? `<span class="breadcrumb-icon">${iconHtml}</span>` : '';
      
      if (isLast || !crumb.clickable) {
        // Aktuelle Seite - nicht klickbar
        return `<span class="breadcrumb-item breadcrumb-current">${iconPrefix}${sanitizedLabel}</span>`;
      } else {
        // Klickbare Breadcrumb-Items
        return `
          <a href="${crumb.url}" class="breadcrumb-item breadcrumb-link" data-route="${crumb.url}">
            ${iconPrefix}${sanitizedLabel}
          </a>
          <span class="breadcrumb-separator">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        `;
      }
    }).join('');

    this.container.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        ${breadcrumbHtml}
      </nav>
    `;

    // Events für klickbare Links binden
    this.bindEvents();
  }

  // Events binden
  bindEvents() {
    if (!this.container) return;

    const links = this.container.querySelectorAll('.breadcrumb-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route && window.navigateTo) {
          window.navigateTo(route);
        }
      });
    });
  }

  // Generiere Breadcrumb basierend auf Route und Daten
  generateBreadcrumb(moduleName, moduleUrl, details = []) {
    const crumbs = [
      { label: moduleName, url: moduleUrl, clickable: true }
    ];

    // Füge Detail-Ebenen hinzu
    details.forEach((detail, index) => {
      const isLast = index === details.length - 1;
      crumbs.push({
        label: detail.label,
        url: detail.url || '#',
        clickable: detail.clickable !== false && !isLast
      });
    });

    return crumbs;
  }
}

// Exportiere Instanz für globale Nutzung
export const breadcrumbSystem = new BreadcrumbSystem();

