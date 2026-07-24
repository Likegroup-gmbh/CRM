// ActionsDropdown.js — Fassade
// Delegiert an ActionsDropdownHandlers, ActionsDropdownAnsprechpartner, ActionsDropdownModals

import { iconRegistry } from './actions/IconRegistry.js';
import { actionBuilder } from './actions/ActionBuilder.js';

import { handleAction, setField, addToFavorites } from './ActionsDropdownHandlers.js';
import {
  openAddAnsprechpartnerModal,
  openAddAnsprechpartnerToUnternehmenModal,
  openRemoveAnsprechpartnerFromUnternehmenModal,
  removeAnsprechpartnerFromUnternehmen
} from './ActionsDropdownAnsprechpartner.js';
import {
  openKooperationQuickView,
  openAssignStaffModal,
  openAssignMarkeStaffModal,
  openAddToCampaignModal,
  openAddToListModal,
  openAddAnsprechpartnerToKampagneModal
} from './ActionsDropdownModals.js';

export class ActionsDropdown {
  constructor() {
    this.dropdowns = new Map();
    this._abortController = null;
    this._iconObserver = null;
    this._normalizingIcons = false;
    this.iconRegistry = iconRegistry;
    this.actionBuilder = actionBuilder;
  }

  init() {
    this.destroy();
    this.bindGlobalEvents();
    this.normalizeIcons(document);
    this.observeTableMutations();
  }

  // --- Icon-Durchleitung (Backward Compatible) ---
  getHeroIcon(name) { return this.iconRegistry.get(name); }
  getStatusIcon(statusName) { return this.iconRegistry.getStatusIcon(statusName); }

  // --- Delegation: Handlers ---
  handleAction(action, entityId, entityType, actionItem) {
    return handleAction(this, action, entityId, entityType, actionItem);
  }
  setField(entityType, entityId, fieldName, fieldValue) {
    return setField(this, entityType, entityId, fieldName, fieldValue);
  }
  addToFavorites(creatorId, kampagneId) {
    return addToFavorites(this, creatorId, kampagneId);
  }

  // --- Delegation: Ansprechpartner ---
  openAddAnsprechpartnerModal(markeId) {
    return openAddAnsprechpartnerModal(this, markeId);
  }
  openAddAnsprechpartnerToUnternehmenModal(unternehmenId) {
    return openAddAnsprechpartnerToUnternehmenModal(this, unternehmenId);
  }
  openRemoveAnsprechpartnerFromUnternehmenModal(unternehmenId) {
    return openRemoveAnsprechpartnerFromUnternehmenModal(this, unternehmenId);
  }
  removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId) {
    return removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId);
  }

  // --- Delegation: Modals ---
  openKooperationQuickView(kooperationId) {
    return openKooperationQuickView(this, kooperationId);
  }
  openAssignStaffModal(kampagneId) {
    return openAssignStaffModal(this, kampagneId);
  }
  openAssignMarkeStaffModal(markeId) {
    return openAssignMarkeStaffModal(this, markeId);
  }
  openAddToCampaignModal(creatorId) {
    return openAddToCampaignModal(this, creatorId);
  }
  openAddToListModal(creatorId) {
    return openAddToListModal(this, creatorId);
  }
  openAddAnsprechpartnerToKampagneModal(kampagneId) {
    return openAddAnsprechpartnerToKampagneModal(this, kampagneId);
  }

  // --- Hilfsfunktion ---
  isKunde() { return window.isKunde(); }

  // --- Portal-UI ---
  normalizeIcons(root) {
    try {
      if (this._normalizingIcons) return;
      this._normalizingIcons = true;

      const container = root || document;
      const dropdowns = container.querySelectorAll('.actions-dropdown:not([data-icons-normalized="1"])');
      dropdowns.forEach((dd) => {
        const replaceIn = (selector, iconName) => {
          dd.querySelectorAll(selector).forEach((link) => {
            const existingSvg = link.querySelector('svg');
            if (existingSvg) existingSvg.remove();
            link.insertAdjacentHTML('afterbegin', this.getHeroIcon(iconName));
          });
        };
        replaceIn('.action-item[data-action="view"]', 'view');
        replaceIn('.action-item[data-action="edit"]', 'edit');
        replaceIn('.action-item[data-action="favorite"]', 'favorite');
        replaceIn('.action-item.action-danger[data-action="delete"]', 'delete');
        replaceIn('.action-item[data-action="rechnungen"]', 'rechnungen');
        replaceIn('.action-item[data-action="auftrag-details"]', 'details');
        dd.setAttribute('data-icons-normalized', '1');
      });
    } catch (err) {
      console.warn('normalizeIcons Fehler', err);
    } finally {
      this._normalizingIcons = false;
    }
  }

  observeTableMutations() {
    if (this._iconObserver) return;
    setTimeout(() => {
      const targets = document.querySelectorAll('.data-table-container, #dashboard-content');
      if (targets.length === 0) {
        const fallbackTarget = document.getElementById('dashboard-content') || document.body;
        this.observeSingleTarget(fallbackTarget);
        return;
      }
      targets.forEach(target => this.observeSingleTarget(target));
    }, 100);
  }

  observeSingleTarget(target) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) this.normalizeIcons(node);
          });
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    if (!this._iconObserver) {
      this._iconObserver = [observer];
    } else {
      this._iconObserver.push(observer);
    }
  }

  toggleDropdown(toggleButton) {
    const existingPortal = document.querySelector('.actions-dropdown-portal');
    const wasOpenForThisButton = existingPortal && existingPortal._sourceToggle === toggleButton;
    this.closeAllDropdowns();
    if (wasOpenForThisButton) return;

    const sourceDropdown = toggleButton.nextElementSibling;
    if (!sourceDropdown) return;

    const container = toggleButton.closest('.actions-dropdown-container');
    const portal = sourceDropdown.cloneNode(true);
    portal.classList.remove('actions-dropdown');
    portal.classList.add('actions-dropdown-portal');
    portal._sourceToggle = toggleButton;
    portal._sourceContainer = container;

    if (container?.dataset?.entityType) {
      portal.dataset.entityType = container.dataset.entityType;
    }

    document.body.appendChild(portal);

    const buttonRect = toggleButton.getBoundingClientRect();
    const portalHeight = portal.offsetHeight || 300;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const needsFlip = spaceBelow < portalHeight && buttonRect.top > portalHeight;

    portal.style.right = (window.innerWidth - buttonRect.right) + 'px';

    if (needsFlip) {
      portal.style.bottom = (viewportHeight - buttonRect.top + 4) + 'px';
      portal.style.transformOrigin = 'bottom right';
    } else {
      portal.style.top = (buttonRect.bottom + 4) + 'px';
      portal.style.transformOrigin = 'top right';
    }

    requestAnimationFrame(() => portal.classList.add('show'));
    toggleButton.setAttribute('aria-expanded', 'true');
  }

  positionSubmenu(submenu, trigger) {
    const triggerRect = trigger.getBoundingClientRect();
    const submenuHeight = submenu.offsetHeight || submenu.scrollHeight || 300;
    const viewportHeight = window.innerHeight;
    const overflow = (triggerRect.top + submenuHeight) - (viewportHeight - 20);
    submenu.style.top = overflow > 0 ? -overflow + 'px' : '0px';
  }

  closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown-portal').forEach(portal => portal.remove());
    document.querySelectorAll('.actions-toggle').forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // --- Globale Event-Delegation ---
  bindGlobalEvents() {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const toggleButton = e.target.closest('.actions-toggle');
      if (toggleButton) {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        else e.stopPropagation();
        this.toggleDropdown(toggleButton);
      }
    }, { signal });

    document.addEventListener('click', async (e) => {
      const submenuItem = e.target.closest('.submenu-item');
      if (!submenuItem) return;
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const entityId = submenuItem.dataset.id;
      const fieldName = submenuItem.dataset.field;
      const fieldValue = submenuItem.dataset.value;
      const portal = submenuItem.closest('.actions-dropdown-portal');
      const entityType = portal?.dataset?.entityType
        || portal?._sourceContainer?.dataset?.entityType
        || submenuItem.closest('.actions-dropdown-container')?.dataset?.entityType
        || 'auftrag';

      if (submenuItem.dataset.action === 'set-field') {
        try {
          if (entityType === 'kooperation' && fieldName === 'status_id') {
            const statusName = submenuItem.dataset.statusName || '';
            const { error } = await window.supabase
              .from('kooperationen')
              .update({ status_id: fieldValue, status: statusName, updated_at: new Date().toISOString() })
              .eq('id', entityId);
            if (error) throw error;
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation', action: 'updated', id: entityId, field: 'status_id', value: fieldValue } }));
            window.dispatchEvent(new CustomEvent('kooperationStatusChanged', { detail: { kooperationId: entityId, statusId: fieldValue, statusName } }));
          } else {
            await this.setField(entityType, entityId, fieldName, fieldValue);
          }
        } catch (err) {
          console.error('setField Fehler aus Submenu', err);
          alert('Aktualisierung fehlgeschlagen.');
        }
        this.closeAllDropdowns();
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item');
      if (!actionItem) return;

      const action = actionItem.dataset?.action;
      if (!action) return;

      // Ausgegraute Actions (z.B. Connect ohne Instagram-Link) ignorieren
      if (actionItem.classList.contains('action-disabled')) {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return;
      }

      const customActions = ['comment-delete', 'video-view', 'video-edit', 'video-delete', 'remove-zuordnung', 'add-to-video', 'unlink-from-video', 'edit-item', 'delete-item'];
      if (customActions.includes(action)) {
        this.closeAllDropdowns();
        return;
      }

      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      else e.stopPropagation();

      const entityId = actionItem.dataset.id;
      const portal = actionItem.closest('.actions-dropdown-portal');
      const container = portal?._sourceContainer || actionItem.closest('.actions-dropdown-container');
      const entityType = portal?.dataset?.entityType
        || container?.dataset?.entityType
        || 'auftrag';

      if (action === 'favorite') {
        const creatorId = actionItem.dataset.creatorId || entityId;
        const kampagneId = actionItem.dataset.kampagneId || null;
        this.addToFavorites(creatorId, kampagneId);
        this.closeAllDropdowns();
        return;
      }

      this.handleAction(action, entityId, entityType, actionItem);
      this.closeAllDropdowns();
    }, { signal });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-dropdown-container') && !e.target.closest('.actions-dropdown-portal')) {
        this.closeAllDropdowns();
      }
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllDropdowns();
    }, { signal });

    window.addEventListener('scroll', () => {
      if (document.querySelector('.actions-dropdown-portal')) this.closeAllDropdowns();
    }, { capture: true, signal });

    document.addEventListener('mouseover', (e) => {
      const trigger = e.target.closest('.actions-dropdown-portal .action-item.has-submenu');
      if (!trigger) return;
      const wrapper = trigger.closest('.action-submenu');
      const submenu = wrapper?.querySelector('.submenu');
      if (!submenu) return;
      this.positionSubmenu(submenu, trigger);
    }, { signal });
  }

  destroy() {
    this.closeAllDropdowns();
    this._abortController?.abort();
    this._abortController = null;
    if (this._iconObserver) {
      this._iconObserver.forEach(obs => obs.disconnect());
      this._iconObserver = null;
    }
  }
}

export const actionsDropdown = new ActionsDropdown();
