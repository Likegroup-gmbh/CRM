// BreadcrumbSystem.js (ES6-Modul)
// Zentrale Breadcrumb-Navigation für das CRM.
// Module liefern die offizielle Kette ihrer Seite; liegt ein Klickpfad vor
// (breadcrumbTrail.js), wird die Seite an diesen Pfad gehängt.

import { getRouteConfig } from './breadcrumbRoutes.js';
import { entityIcon } from './icons/entityIcons.js';
import { icon } from '../core/icons/IconSystem.js';
import { loadSwitcherItems, shouldEnableSwitcher } from './breadcrumbSwitcher.js';
import { collapse, composeCrumbs, createLabelCache } from './breadcrumbTrail.js';

const SWITCHER_DEBOUNCE_MS = 200;
const PLACEHOLDER = '...';

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
    this._boundContainer = null;
    this._official = [];
    this._trail = [];
    this._editLeaf = null;
    this._expanded = false;
    this._labels = createLabelCache();
    this.currentBreadcrumbs = [];
    this.editButton = null;
    this.actionsHtml = '';
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

  get trail() {
    return this._trail;
  }

  getIconForUrl(url) {
    if (!url) return null;
    const segment = url.split(/[?#]/)[0].split('/').filter(Boolean)[0];
    if (!segment) return null;
    const entity = getRouteConfig(segment, window.currentUser?.rolle?.toLowerCase()).entity;
    return entity ? entityIcon(entity, { stroke: 1.5 }) : null;
  }

  init() {
    this._container = document.getElementById('breadcrumb-container');
    if (!this._container) console.warn('⚠️ BreadcrumbSystem: Container nicht gefunden');
  }

  // Offizielle Kette der Seite setzen.
  // editButton: { id, canEdit, actionsHtml } - optional
  // options.switcher: Context für den letzten Crumb, oder null zum Abschalten.
  // Ohne options.switcher bleibt der Context aus setFromRoute.
  updateBreadcrumb(crumbs, editButton = null, options = {}) {
    if (!this.container) return;
    this._official = Array.isArray(crumbs) ? crumbs.map((crumb) => ({ ...crumb })) : [];
    this._editLeaf = null;
    this._setEditButton(editButton);
    if (Object.prototype.hasOwnProperty.call(options, 'switcher')) {
      this._switcherContext = options.switcher;
    }
    this.render();
  }

  // Vom Router: offizielle Kette aus der Route + Klickpfad aus history.state.
  setFromRoute(segment, id, options = {}) {
    if (!this.container) return;

    this.navigationId++;
    this._setEditButton(null);
    this._editLeaf = null;
    this._expanded = false;
    this._trail = Array.isArray(options.trail) ? options.trail : [];

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
      this._official = [
        { label: config.label, url, clickable: true },
        { label: child.label, url: childUrl, clickable: Boolean(action) },
      ];
      if (action) {
        this._official.push({ label: action === 'new' ? 'Neu' : PLACEHOLDER, url: `${childUrl}/${action}`, clickable: false });
      }
    } else if (id) {
      const entityUrl = `${url}/${id}`;
      const leafUrl = action ? `${entityUrl}/${action}` : entityUrl;
      this._official = [{ label: config.label, url, clickable: true }];
      const entityLabel = this._labels.get(entityUrl);
      if (action && entityLabel) {
        this._official.push({ label: entityLabel, url: entityUrl, clickable: true });
      }
      this._official.push({ label: this._labels.get(leafUrl) || PLACEHOLDER, url: leafUrl, clickable: false });
    } else {
      this._official = [{ label: config.label, url, clickable: false }];
    }

    this.render();
  }

  // Blatt-Label der Seite setzen (Platzhalter ersetzen).
  updateDetailLabel(label, editButton = null, navId) {
    if (!this.container) return;
    if (navId !== undefined && navId !== this.navigationId) return;

    const leaf = this._official[this._official.length - 1];
    if (leaf && (this._official.length >= 2 || this._trail.length)) leaf.label = label;
    this._editLeaf = null;
    this._setEditButton(editButton);
    this.render();
  }

  // Bearbeiten-Ansicht: Auf einer Edit-Route wird das Blatt umbenannt, auf der
  // Detailseite (Inline-Edit) hängt ein Extra-Crumb dran — das Entitäts-Label
  // bleibt so für Pfad und Label-Cache erhalten.
  showEditLeaf(label = 'Bearbeiten') {
    if (!this.container) return;
    const leaf = this._official[this._official.length - 1];
    const onEditRoute = /\/edit$/.test(String(leaf?.url || '').split(/[?#]/)[0]);
    if (onEditRoute) {
      leaf.label = label;
      this._editLeaf = null;
    } else {
      this._editLeaf = { label, clickable: false };
    }
    this._setEditButton(null);
    this.render();
  }

  _setEditButton(editButton) {
    this.editButton = editButton;
    this.actionsHtml = editButton?.actionsHtml || '';
  }

  _composed() {
    const crumbs = composeCrumbs(this._trail, this._official).map((crumb) => (
      crumb.label === PLACEHOLDER && crumb.url
        ? { ...crumb, label: this._labels.get(crumb.url) || PLACEHOLDER }
        : crumb
    ));
    if (!this._editLeaf || !crumbs.length) return crumbs;
    const last = crumbs[crumbs.length - 1];
    return [...crumbs.slice(0, -1), { ...last, clickable: Boolean(last.url) }, this._editLeaf];
  }

  render() {
    this.closeSwitcher();
    const container = this.container;
    this.currentBreadcrumbs = this._composed();

    if (!container) return;
    if (!this.currentBreadcrumbs.length) {
      container.innerHTML = '';
      return;
    }

    this.currentBreadcrumbs.forEach((crumb) => this._labels.set(crumb.url, crumb.label));

    const total = this.currentBreadcrumbs.length;
    const { visible, hidden } = this._expanded
      ? { visible: this.currentBreadcrumbs, hidden: [] }
      : collapse(this.currentBreadcrumbs);
    const separator = `<span class="breadcrumb-separator">${icon('chevron-right', { className: 'icon-14' })}</span>`;

    const breadcrumbHtml = visible.map((crumb, index) => {
      if (crumb.collapsed) {
        const title = escapeHtml(hidden.map((c) => c.label).join(' › '));
        return `<button type="button" class="breadcrumb-item breadcrumb-link breadcrumb-collapsed" title="${title}">…</button>${separator}`;
      }

      const isFirst = index === 0;
      const isLast = index === visible.length - 1;
      const label = window.validatorSystem?.sanitizeHtml?.(crumb.label) || escapeHtml(crumb.label);
      const iconHtml = isFirst ? this.getIconForUrl(crumb.url) : null;
      const iconPrefix = iconHtml ? `<span class="breadcrumb-icon">${iconHtml}</span>` : '';

      if (isLast && this._switcherContext && !this._editLeaf && total >= 2) {
        return `
          <button type="button" class="breadcrumb-item breadcrumb-current breadcrumb-switcher" aria-haspopup="listbox" aria-expanded="false">
            <span class="breadcrumb-switcher-label">${label}</span>
            <span class="breadcrumb-switcher-icon">${icon('switcher-chevrons', { className: 'icon-14' })}</span>
          </button>
        `;
      }

      if (isLast) {
        return `<span class="breadcrumb-item breadcrumb-current">${iconPrefix}${label}</span>`;
      }
      if (!crumb.clickable || !crumb.url) {
        return `<span class="breadcrumb-item">${iconPrefix}${label}</span>${separator}`;
      }
      return `<a href="${escapeHtml(crumb.url)}" class="breadcrumb-item breadcrumb-link" data-route="${escapeHtml(crumb.url)}">${iconPrefix}${label}</a>${separator}`;
    }).join('');

    const editButtonHtml = this.editButton?.canEdit
      ? `<button id="${escapeHtml(this.editButton.id)}" class="breadcrumb-edit-button">${icon('pencil-square')}<span>Bearbeiten</span></button>`
      : '';
    const trailingHtml = (editButtonHtml || this.actionsHtml)
      ? `<div class="breadcrumb-actions">${editButtonHtml}${this.actionsHtml}</div>`
      : '';

    container.innerHTML = `<nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumbHtml}${trailingHtml}</nav>`;
    this._bindContainer(container);
  }

  // Ein Listener pro Container statt pro Render.
  _bindContainer(container) {
    if (this._boundContainer === container) return;
    this._boundContainer = container;
    container.addEventListener('click', (e) => this._onClick(e));
  }

  _onClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('.breadcrumb-collapsed')) {
      e.preventDefault();
      this._expanded = true;
      this.render();
      return;
    }

    const link = target.closest('.breadcrumb-link');
    if (link) {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      if (route && window.navigateTo) window.navigateTo(route);
      return;
    }

    const switcher = target.closest('.breadcrumb-switcher');
    if (switcher) {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSwitcher(switcher);
      return;
    }

    const editBtn = this.editButton && target.closest('.breadcrumb-edit-button');
    if (editBtn && editBtn.id === this.editButton.id) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('breadcrumbEditClick', {
        detail: { buttonId: this.editButton.id }
      }));
    }
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

    this._portal.querySelector('.breadcrumb-switcher-input')?.focus();
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
      query,
      context: this._switcherContext
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
    this.closeSwitcher();
    if (String(item.id) === String(this._switcherContext?.id)) return;
    this._labels.set(item.route, item.label);
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
    if (e.key === 'Enter' && this._focusedIndex >= 0) {
      e.preventDefault();
      this.selectSwitcherItem(this._focusedIndex);
    }
  }

  moveSwitcherFocus(delta) {
    if (!this._switcherItems.length) return;
    this._focusedIndex = (this._focusedIndex + delta + this._switcherItems.length) % this._switcherItems.length;
    this.renderSwitcherItems();
    this._portal?.querySelector('.breadcrumb-switcher-item.is-focused')?.scrollIntoView({ block: 'nearest' });
  }
}

export const breadcrumbSystem = new BreadcrumbSystem();
