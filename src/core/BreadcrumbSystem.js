// BreadcrumbSystem.js (ES6-Modul)
// Zentrale Breadcrumb-Navigation für das CRM

import { getRouteConfig } from './breadcrumbRoutes.js';
import { entityIcon } from './icons/entityIcons.js';
import { icon } from '../core/icons/IconSystem.js';

export class BreadcrumbSystem {
  constructor() {
    this._container = null;
    this.currentBreadcrumbs = [];
    this.editButton = null;
    this.navigationId = 0;
  }

  get container() {
    if (!this._container || !this._container.isConnected) {
      this._container = document.getElementById('breadcrumb-container');
    }
    return this._container;
  }

  // Edit-Icon SVG
  getEditIcon() {
    return `${icon('pencil-square')}`;
  }

  // Finde das Icon für eine gegebene URL über die Route-Config
  getIconForUrl(url) {
    if (!url) return null;

    // Extrahiere das Segment (z.B. auftrag aus /auftrag/123)
    const segment = url.split('/').filter(Boolean)[0];
    if (!segment) return null;

    const entity = getRouteConfig(segment, window.currentUser?.rolle?.toLowerCase()).entity;
    return entity ? entityIcon(entity, { stroke: 1.5 }) : null;
  }

  init() {
    this._container = document.getElementById('breadcrumb-container');
    if (!this._container) {
      console.warn('⚠️ BreadcrumbSystem: Container nicht gefunden');
      return;
    }
    console.log('✅ BreadcrumbSystem: Initialisiert');
  }

  // Breadcrumb aktualisieren
  // editButton: { id: string, canEdit: boolean } - optional
  updateBreadcrumb(crumbs, editButton = null) {
    if (!this.container) {
      console.warn('⚠️ BreadcrumbSystem: Container nicht initialisiert');
      return;
    }

    this.currentBreadcrumbs = crumbs;
    this.editButton = editButton;
    this.render();
  }

  // Breadcrumb zurücksetzen
  reset() {
    this.currentBreadcrumbs = [];
    this.editButton = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  // Breadcrumb zentral aus Route setzen (aufgerufen vom Router)
  setFromRoute(segment, id, options = {}) {
    if (!this.container) return;

    this.navigationId++;
    this.editButton = null;

    const rolle = options.rolle || window.currentUser?.rolle?.toLowerCase();
    const config = getRouteConfig(segment, rolle);
    const url = `/${segment}`;

    if (id) {
      this.currentBreadcrumbs = [
        { label: config.label, url, clickable: true },
        { label: '...', url: `${url}/${id}`, clickable: false },
      ];
    } else {
      this.currentBreadcrumbs = [
        { label: config.label, url, clickable: false },
      ];
    }

    this.render();
  }

  // Detail-Label aktualisieren (Platzhalter ersetzen)
  updateDetailLabel(label, editButton = null, navId) {
    if (!this.container) return;

    if (navId !== undefined && navId !== this.navigationId) return;

    if (this.currentBreadcrumbs.length >= 2) {
      this.currentBreadcrumbs[this.currentBreadcrumbs.length - 1].label = label;
    }

    this.editButton = editButton;
    this.render();
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
            ${icon('chevron-right', { className: 'icon-14' })}
          </span>
        `;
      }
    }).join('');

    // Edit-Button HTML generieren wenn vorhanden und canEdit true ist
    let editButtonHtml = '';
    if (this.editButton && this.editButton.canEdit) {
      editButtonHtml = `
        <button id="${this.editButton.id}" class="breadcrumb-edit-button">
          ${this.getEditIcon()}
          <span>Bearbeiten</span>
        </button>
      `;
    }

    this.container.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        ${breadcrumbHtml}
        ${editButtonHtml}
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

    // Edit-Button Event binden (dispatcht Custom Event)
    if (this.editButton) {
      const editBtn = this.container.querySelector(`#${this.editButton.id}`);
      console.log('🔧 BREADCRUMB: Edit-Button Binding', { 
        editButtonId: this.editButton.id, 
        editBtnFound: !!editBtn,
        canEdit: this.editButton.canEdit 
      });
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('🖱️ BREADCRUMB: Edit-Button geklickt, dispatche Event:', this.editButton.id);
          // Custom Event dispatchen, damit Detail-Seiten darauf reagieren können
          window.dispatchEvent(new CustomEvent('breadcrumbEditClick', {
            detail: { buttonId: this.editButton.id }
          }));
        });
      }
    }
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

