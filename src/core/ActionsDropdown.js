// ActionsDropdown.js — Fassade
// Delegiert an ActionsDropdownHandlers/-Effects und die Modal-Dateien
// (ActionsDropdownAnsprechpartner, AnsprechpartnerRemoveModal, StaffAssignModals,
// CreatorAssignModals, KooperationQuickView)

import { iconRegistry } from './actions/IconRegistry.js';
import { actionBuilder } from './actions/ActionBuilder.js';
import { playMenu, closeMenu, discardMenu } from './animation/menu.js';

import { handleAction, setField, GLOBAL_ACTIONS } from './ActionsDropdownHandlers.js';
import { addToFavorites } from './ActionsDropdownEffects.js';
import {
  openAddAnsprechpartnerModal,
  openAddAnsprechpartnerToUnternehmenModal,
  openAddAnsprechpartnerToKampagneModal
} from './ActionsDropdownAnsprechpartner.js';
import {
  openRemoveAnsprechpartnerFromUnternehmenModal,
  removeAnsprechpartnerFromUnternehmen
} from './AnsprechpartnerRemoveModal.js';
import { openAssignStaffModal, openAssignMarkeStaffModal } from './StaffAssignModals.js';
import { openAddToCampaignModal, openAddToListModal } from './CreatorAssignModals.js';
import { openKooperationQuickView } from './KooperationQuickView.js';

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

  // Actions, die der globale Switch in ActionsDropdownHandlers wirklich bedient.
  // Alles andere ist page-eigen und wird nicht geclaimt.
  isKnownGlobalAction(action) {
    return GLOBAL_ACTIONS.has(action);
  }

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
        replaceIn('.action-item[data-action="anschreiben"]', 'anschreiben');
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
    const existingPortal = document.querySelector('.actions-dropdown-portal:not([data-menu-state="closing"])');
    const wasOpenForThisButton = existingPortal && existingPortal._sourceToggle === toggleButton;
    // Selber Button: animiert zu. Anderer Button (oder Menue im Ausblenden): sofort weg, dann neu auf.
    this.closeAllDropdowns({ immediate: !wasOpenForThisButton });
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
    this.positionPortal(portal, toggleButton.getBoundingClientRect());

    portal.dataset.menuState = 'open';
    playMenu(portal, true);
    toggleButton.setAttribute('aria-expanded', 'true');
  }

  // Rechts am Button ausrichten, aber im Viewport halten. Die Aktions-Spalte
  // im Kooperationen-Tab klebt am rechten Rand. Reicht die Hoehe nicht, wird
  // das Menue zuerst enger gesetzt, damit Eintraege wie Loeschen sichtbar
  // bleiben, und nur danach scrollbar.
  positionPortal(portal, anchorRect) {
    const margin = 8;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.max(160, viewportWidth - margin * 2);

    portal.style.maxWidth = `${maxWidth}px`;
    portal.style.right = 'auto';
    portal.style.bottom = 'auto';
    portal.style.maxHeight = 'none';
    portal.style.overflowY = 'visible';
    portal.classList.remove('is-compact', 'is-scrollable');

    const portalWidth = Math.min(portal.offsetWidth || portal.scrollWidth || 260, maxWidth);
    let left = anchorRect.right - portalWidth;
    left = Math.min(left, viewportWidth - portalWidth - margin);
    left = Math.max(margin, left);
    portal.style.left = `${left}px`;

    const measure = () => Math.max(portal.offsetHeight, portal.scrollHeight) || 300;
    let portalHeight = measure();
    const roomBelow = () => viewportHeight - anchorRect.bottom - gap;
    const roomAbove = () => anchorRect.top - gap;
    let openUp = roomBelow() < portalHeight && roomAbove() > roomBelow();
    let available = openUp
      ? Math.max(0, anchorRect.top - gap - margin)
      : Math.max(0, viewportHeight - (anchorRect.bottom + gap) - margin);

    if (portalHeight > available) {
      portal.classList.add('is-compact');
      portalHeight = measure();
      openUp = roomBelow() < portalHeight && roomAbove() > roomBelow();
      available = openUp
        ? Math.max(0, anchorRect.top - gap - margin)
        : Math.max(0, viewportHeight - (anchorRect.bottom + gap) - margin);
    }

    if (openUp) {
      const height = Math.min(portalHeight, available);
      portal.style.top = `${Math.max(margin, anchorRect.top - gap - height)}px`;
      portal.style.transformOrigin = 'bottom right';
    } else {
      portal.style.top = `${Math.max(margin, anchorRect.bottom + gap)}px`;
      portal.style.transformOrigin = 'top right';
    }

    if (portalHeight > available) {
      portal.style.maxHeight = `${available}px`;
      portal.style.overflowY = 'scroll';
      portal.classList.add('is-scrollable');
    } else {
      portal.style.maxHeight = '';
      portal.style.overflowY = '';
    }
  }

  positionSubmenu(submenu, trigger) {
    const margin = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const submenuHeight = submenu.offsetHeight || submenu.scrollHeight || 300;
    const submenuWidth = submenu.offsetWidth || submenu.scrollWidth || 240;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    submenu.style.maxHeight = '';
    submenu.style.overflowY = '';
    submenu.style.top = '';
    submenu.classList.remove('submenu--flip-right', 'submenu--inline');
    trigger.classList.remove('submenu-opens-right', 'submenu-opens-inline');

    const spaceLeft = triggerRect.left - margin;
    const spaceRight = viewportWidth - triggerRect.right - margin;
    const fitsLeft = spaceLeft >= submenuWidth;
    const fitsRight = spaceRight >= submenuWidth;

    if (!fitsLeft && fitsRight) {
      submenu.classList.add('submenu--flip-right');
      trigger.classList.add('submenu-opens-right');
    } else if (!fitsLeft && !fitsRight) {
      submenu.classList.add('submenu--inline');
      trigger.classList.add('submenu-opens-inline');
      return;
    }

    const availableHeight = viewportHeight - margin * 2;
    if (submenuHeight > availableHeight) {
      submenu.style.maxHeight = `${availableHeight}px`;
      submenu.style.overflowY = 'auto';
      submenu.style.top = `${margin - triggerRect.top}px`;
      return;
    }

    const overflowBottom = (triggerRect.top + submenuHeight) - (viewportHeight - margin);
    let top = overflowBottom > 0 ? -overflowBottom : 0;
    if (triggerRect.top + top < margin) top = margin - triggerRect.top;
    submenu.style.top = `${top}px`;
  }

  // Standard: animiert zu (Portal verschwindet am Ende der Timeline).
  // { immediate: true }: sofort weg (Wechsel auf anderen Button, Scroll, destroy).
  closeAllDropdowns({ immediate = false } = {}) {
    document.querySelectorAll('.actions-dropdown-portal').forEach(portal => {
      if (immediate) discardMenu(portal);
      else closeMenu(portal);
    });
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
      // Nur eigene set-field-Items behandeln – fremde Submenüs (z.B. die
      // Toolbar-Plus-Menüs auf Kampagne/Sourcing) nutzen .submenu-item ebenfalls
      // und dürfen nicht per stopImmediatePropagation verschluckt werden.
      if (submenuItem.dataset.action !== 'set-field') return;
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

      // Page-eigene Actions: nur Dropdown schliessen, Handler laeuft auf der Seite.
      const customActions = [
        'comment-delete', 'video-view', 'video-edit', 'video-delete',
        'remove-zuordnung',
        'edit-item', 'delete-item',
        'activate-vorschlag', 'discard-vorschlag',
        'toggle-skript-freigabe', 'reprocess-item', 'connect-creator',
        'create-creator', 'create-videoidee', 'connect-videoidee', 'tausch-creator', 'konzept-einholen'
      ];
      if (customActions.includes(action) || !this.isKnownGlobalAction(action)) {
        e.preventDefault();
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
      if (document.querySelector('.actions-dropdown-portal')) this.closeAllDropdowns({ immediate: true });
    }, { capture: true, signal });

    window.addEventListener('resize', () => {
      const portal = document.querySelector('.actions-dropdown-portal');
      const toggle = portal?._sourceToggle;
      if (!portal || !toggle?.isConnected) return;
      this.positionPortal(portal, toggle.getBoundingClientRect());
    }, { signal });

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
    this.closeAllDropdowns({ immediate: true });
    this._abortController?.abort();
    this._abortController = null;
    if (this._iconObserver) {
      this._iconObserver.forEach(obs => obs.disconnect());
      this._iconObserver = null;
    }
  }
}

export const actionsDropdown = new ActionsDropdown();
