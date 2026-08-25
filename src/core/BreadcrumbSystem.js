// BreadcrumbSystem.js (ES6-Modul)
// Zentrale Breadcrumb-Navigation für das CRM

import { getRouteConfig } from './breadcrumbRoutes.js';
import { entityIcon } from './icons/entityIcons.js';
import { icon } from '../core/icons/IconSystem.js';
import { loadSwitcherItems, shouldEnableSwitcher } from './breadcrumbSwitcher.js';

const SWITCHER_DEBOUNCE_MS = 200;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class BreadcrumbSystem {
  constructor() {
    this._container = null;
    this.currentBreadcrumbs = [];
    this.editButton = null;
    this.navigationId = 0;
    this._switcherContext = null;
    this._portal = null;
    this._switcherAbort = null;
    this._searchTimer = null;
    this._switcherItems = [];
    this._focusedIndex = -1;
    this._switcherQuery = '';
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
    this.closeSwitcher();
    this._switcherContext = null;
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
    this.closeSwitcher();

    const rolle = options.rolle || window.currentUser?.rolle?.toLowerCase();
    const action = options.action || null;
    const config = getRouteConfig(segment, rolle);
    const url = `/${segment}`;
    const child = id ? config.children?.[id] : null;
    this._switcherContext = (!child && shouldEnableSwitcher(segment, id, { action, isChild: Boolean(child) }))
      ? { segment, id }
      : null;

    if (child) {
      const childUrl = `${url}/${id}`;
      this.currentBreadcrumbs = [
        { label: config.label, url, clickable: true },
        { label: child.label, url: childUrl, clickable: Boolean(action) },
      ];
      if (action) {
        this.currentBreadcrumbs.push({
          label: action === 'new' ? 'Neu' : '...',
          url: `${childUrl}/${action}`,
          clickable: false,
        });
      }
    } else if (id) {
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
    this.closeSwitcher();

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
      
      if (isLast && this._switcherContext && this.currentBreadcrumbs.length >= 2) {
        return `
          <button type="button" class="breadcrumb-item breadcrumb-current breadcrumb-switcher" aria-haspopup="listbox" aria-expanded="false">
            <span class="breadcrumb-switcher-label">${sanitizedLabel}</span>
            <span class="breadcrumb-switcher-icon">${icon('switcher-chevrons', { className: 'icon-14' })}</span>
          </button>
        `;
      }

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

    const switcher = this.container.querySelector('.breadcrumb-switcher');
    if (switcher) {
      switcher.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSwitcher(switcher);
      });
    }

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

  toggleSwitcher(trigger) {
    if (this._portal) {
      this.closeSwitcher();
      return;
    }
    this.openSwitcher(trigger);
  }

  openSwitcher(trigger) {
    if (!this._switcherContext) return;

    this._portal = document.createElement('div');
    this._portal.className = 'breadcrumb-switcher-portal';
    this._portal.innerHTML = `
      <div class="breadcrumb-switcher-search">
        <input type="search" class="breadcrumb-switcher-input" placeholder="Suchen…" autocomplete="off">
      </div>
      <div class="breadcrumb-switcher-list" role="listbox"></div>
    `;
    document.body.appendChild(this._portal);
    trigger.setAttribute('aria-expanded', 'true');
    this.positionSwitcherPortal(trigger);
    this.bindSwitcherChrome(trigger);

    const input = this._portal.querySelector('.breadcrumb-switcher-input');
    input?.focus();
    this._switcherQuery = '';
    this.loadAndRenderSwitcherItems('');
  }

  closeSwitcher() {
    clearTimeout(this._searchTimer);
    this._searchTimer = null;
    this._switcherAbort?.abort();
    this._switcherAbort = null;
    this._portal?.remove();
    this._portal = null;
    this._switcherItems = [];
    this._focusedIndex = -1;
    this._switcherQuery = '';
    this.container?.querySelector('.breadcrumb-switcher')?.setAttribute('aria-expanded', 'false');
  }

  bindSwitcherChrome(trigger) {
    this._switcherAbort = new AbortController();
    const { signal } = this._switcherAbort;
    const input = this._portal.querySelector('.breadcrumb-switcher-input');

    input?.addEventListener('input', (e) => {
      this._switcherQuery = e.target.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.loadAndRenderSwitcherItems(this._switcherQuery);
      }, SWITCHER_DEBOUNCE_MS);
    }, { signal });

    document.addEventListener('click', (e) => {
      if (this._portal?.contains(e.target) || trigger.contains(e.target)) return;
      this.closeSwitcher();
    }, { signal });

    document.addEventListener('keydown', (e) => this.onSwitcherKeydown(e), { signal });
    window.addEventListener('resize', () => this.positionSwitcherPortal(trigger), { signal });
  }

  positionSwitcherPortal(trigger) {
    if (!this._portal) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(360, Math.max(rect.width, 240));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    this._portal.style.minWidth = `${width}px`;
    this._portal.style.maxWidth = '360px';
    this._portal.style.left = `${left}px`;

    const spaceBelow = window.innerHeight - rect.bottom;
    const portalHeight = this._portal.offsetHeight || 280;
    if (spaceBelow < portalHeight && rect.top > portalHeight) {
      this._portal.style.top = 'auto';
      this._portal.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      this._portal.style.bottom = 'auto';
      this._portal.style.top = `${rect.bottom + 4}px`;
    }
  }

  async loadAndRenderSwitcherItems(query) {
    if (!this._portal || !this._switcherContext) return;
    const list = this._portal.querySelector('.breadcrumb-switcher-list');
    list.innerHTML = `<div class="breadcrumb-switcher-status">Laden…</div>`;

    const { items, error } = await loadSwitcherItems({
      segment: this._switcherContext.segment,
      query
    });

    if (!this._portal) return;
    if (error) {
      window.toastSystem?.show('Einträge konnten nicht geladen werden.', 'error');
    }

    this._switcherItems = items;
    this._focusedIndex = items.length ? 0 : -1;
    this.renderSwitcherItems();
    const trigger = this.container?.querySelector('.breadcrumb-switcher');
    if (trigger) this.positionSwitcherPortal(trigger);
  }

  renderSwitcherItems() {
    const list = this._portal?.querySelector('.breadcrumb-switcher-list');
    if (!list) return;

    if (!this._switcherItems.length) {
      list.innerHTML = `<div class="breadcrumb-switcher-status">Keine Treffer.</div>`;
      return;
    }

    const currentId = this._switcherContext?.id;
    list.innerHTML = this._switcherItems.map((item, index) => {
      const classes = ['breadcrumb-switcher-item'];
      if (String(item.id) === String(currentId)) classes.push('is-active');
      if (index === this._focusedIndex) classes.push('is-focused');
      return `
        <button type="button" class="${classes.join(' ')}" role="option" data-index="${index}" data-id="${escapeHtml(item.id)}" data-route="${escapeHtml(item.route)}">
          ${escapeHtml(item.label)}
        </button>
      `;
    }).join('');

    list.querySelectorAll('.breadcrumb-switcher-item').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectSwitcherItem(Number(button.dataset.index));
      });
    });
  }

  selectSwitcherItem(index) {
    const item = this._switcherItems[index];
    if (!item) return;
    if (String(item.id) === String(this._switcherContext?.id)) {
      this.closeSwitcher();
      return;
    }
    this.closeSwitcher();
    if (item.route && window.navigateTo) window.navigateTo(item.route);
  }

  onSwitcherKeydown(e) {
    if (!this._portal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeSwitcher();
      this.container?.querySelector('.breadcrumb-switcher')?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.moveSwitcherFocus(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.moveSwitcherFocus(-1);
      return;
    }
    if (e.key === 'Enter') {
      if (this._focusedIndex >= 0) {
        e.preventDefault();
        this.selectSwitcherItem(this._focusedIndex);
      }
    }
  }

  moveSwitcherFocus(delta) {
    if (!this._switcherItems.length) return;
    const next = (this._focusedIndex + delta + this._switcherItems.length) % this._switcherItems.length;
    this._focusedIndex = next;
    this.renderSwitcherItems();
    this._portal?.querySelector('.breadcrumb-switcher-item.is-focused')?.scrollIntoView({ block: 'nearest' });
  }
}

// Exportiere Instanz für globale Nutzung
export const breadcrumbSystem = new BreadcrumbSystem();

