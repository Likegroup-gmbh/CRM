// SplitButton.js
// Wiederverwendbarer Split-Button: Primaeraktion + Chevron-Menue.
// Config analog ActionBuilder (SplitButtonConfig), Portal analog ActionsDropdown.

import { icon } from '../icons/IconSystem.js';
import { SplitButtonConfig } from './SplitButtonConfig.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstActionItem(items) {
  return items.find((item) => item && item.id && item.id !== 'separator' && item.selects !== false) || null;
}

export class SplitButton {
  constructor() {
    this.handlers = new Map();
    this._abortController = null;
  }

  init() {
    this.destroy();
    this.bindGlobalEvents();
  }

  /**
   * @param {string|object} configOrId - Config-ID oder Inline-Config
   * @param {object} [options]
   * @param {string} [options.label]
   * @param {string} [options.buttonId]
   * @param {string} [options.selectedId]
   * @param {string} [options.variant]
   * @param {boolean} [options.disabled]
   * @param {string[]} [options.disabledItemIds]
   * @returns {string}
   */
  render(configOrId, options = {}) {
    const isId = typeof configOrId === 'string';
    const config = isId ? SplitButtonConfig.get(configOrId) : configOrId;
    const configId = isId ? configOrId : (config?.id || options.id || '');

    if (!config) {
      console.warn(`SplitButton: keine Config fuer '${configOrId}'`);
      return '';
    }

    if (!isId && configId) SplitButtonConfig.register(configId, config);

    const items = SplitButtonConfig.resolveItems(config, options);
    const selectedId = options.selectedId || firstActionItem(items)?.id || '';
    const label = options.label || config.label || '';
    const primaryIcon = options.icon || config.icon || '';
    const variant = options.variant || config.variant || '';
    const variantClass = variant ? ` mdc-btn--${variant}` : '';
    const disabled = !!options.disabled;
    const buttonId = options.buttonId || '';
    const splitClass = ['split-btn', variant ? `split-btn--${variant}` : '', disabled ? 'is-disabled' : '']
      .filter(Boolean)
      .join(' ');

    return `
      <div class="${splitClass}" data-split-config="${escapeHtml(configId)}" data-split-selected="${escapeHtml(selectedId)}">
        <button type="button" class="mdc-btn split-btn__main${variantClass}" data-split-primary
          ${buttonId ? `id="${escapeHtml(buttonId)}"` : ''}
          ${disabled ? 'disabled' : ''}>
          ${primaryIcon ? icon(primaryIcon) : ''}
          <span class="mdc-btn__label">${escapeHtml(label)}</span>
        </button>
        <span class="split-btn__divider" aria-hidden="true"></span>
        <button type="button" class="mdc-btn split-btn__toggle${variantClass}" data-split-toggle
          aria-expanded="false" aria-haspopup="menu" aria-label="Weitere Optionen"
          ${disabled ? 'disabled' : ''}>
          ${icon('chevron-down')}
        </button>
        <div class="split-btn__menu" role="menu">
          ${this.renderItems(items, selectedId, options.disabledItemIds)}
        </div>
      </div>
    `;
  }

  renderItems(items, selectedId, disabledItemIds = []) {
    return items.map((item) => {
      if (!item || item.id === 'separator') {
        return '<div class="action-separator"></div>';
      }

      const isDisabled = !!item.disabled || disabledItemIds.includes(item.id);
      const dangerClass = item.danger ? 'action-danger' : '';
      const disabledClass = isDisabled ? 'action-disabled' : '';
      const selects = item.selects !== false;
      const activeClass = selects && item.id === selectedId ? 'is-active' : '';
      const disabledAttr = isDisabled ? 'aria-disabled="true"' : '';
      const iconHtml = item.icon ? icon(item.icon) : '';
      const dataAttrs = item.data && typeof item.data === 'object'
        ? Object.entries(item.data)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
          .join('')
        : '';
      const check = selects && item.id === selectedId
        ? `<span class="submenu-check">${icon('check-filled')}</span>`
        : '';

      return `
        <button type="button" class="action-item ${dangerClass} ${disabledClass} ${activeClass}"
          role="menuitem" data-split-item="${escapeHtml(item.id)}" ${disabledAttr}${dataAttrs}>
          ${iconHtml}
          ${escapeHtml(item.label || '')}
          ${check}
        </button>
      `;
    }).join('');
  }

  setHandler(configId, fn) {
    if (!configId) return;
    if (typeof fn === 'function') this.handlers.set(configId, fn);
    else this.handlers.delete(configId);
  }

  setBusy(root, busy, label) {
    const el = typeof root === 'string' ? document.querySelector(root) : root;
    if (!el) return;
    el.classList.toggle('is-busy', !!busy);
    el.querySelectorAll('button').forEach((btn) => {
      btn.disabled = !!busy;
    });
    if (label) {
      const labelEl = el.querySelector('.split-btn__main .mdc-btn__label');
      if (labelEl) labelEl.textContent = label;
    }
  }

  setItemsDisabled(root, itemIds, disabled) {
    const el = typeof root === 'string' ? document.querySelector(root) : root;
    if (!el) return;
    const ids = Array.isArray(itemIds) ? itemIds : [];
    el.querySelectorAll('[data-split-item]').forEach((btn) => {
      if (!ids.includes(btn.dataset.splitItem)) return;
      btn.classList.toggle('action-disabled', !!disabled);
      if (disabled) btn.setAttribute('aria-disabled', 'true');
      else btn.removeAttribute('aria-disabled');
    });
  }

  setPrimaryDisabled(root, disabled) {
    const el = typeof root === 'string' ? document.querySelector(root) : root;
    const primary = el?.querySelector('[data-split-primary]');
    if (primary) primary.disabled = !!disabled;
  }

  toggleDropdown(toggleButton) {
    const root = toggleButton.closest('.split-btn');
    if (!root || root.classList.contains('is-disabled') || root.classList.contains('is-busy')) return;

    const existingPortal = document.querySelector('.split-btn__menu-portal');
    const wasOpenForThis = existingPortal && existingPortal._sourceToggle === toggleButton;
    this.closeAll();
    if (wasOpenForThis) return;

    const sourceMenu = root.querySelector('.split-btn__menu');
    if (!sourceMenu) return;

    const portal = sourceMenu.cloneNode(true);
    portal.classList.remove('split-btn__menu');
    portal.classList.add('split-btn__menu-portal');
    portal._sourceToggle = toggleButton;
    portal._sourceRoot = root;
    portal.dataset.splitConfig = root.dataset.splitConfig || '';
    document.body.appendChild(portal);

    const buttonRect = root.getBoundingClientRect();
    const portalWidth = portal.offsetWidth || 260;
    const portalHeight = portal.offsetHeight || 240;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const needsFlip = spaceBelow < portalHeight && buttonRect.top > portalHeight;
    const alignLeft = buttonRect.left + portalWidth <= window.innerWidth - 8;

    if (alignLeft) {
      portal.style.left = `${Math.max(8, buttonRect.left)}px`;
      portal.style.right = 'auto';
    } else {
      portal.style.right = `${window.innerWidth - buttonRect.right}px`;
      portal.style.left = 'auto';
    }
    if (needsFlip) {
      portal.style.bottom = `${viewportHeight - buttonRect.top + 4}px`;
      portal.style.transformOrigin = 'bottom right';
    } else {
      portal.style.top = `${buttonRect.bottom + 4}px`;
      portal.style.transformOrigin = 'top right';
    }

    requestAnimationFrame(() => portal.classList.add('show'));
    toggleButton.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
  }

  closeAll() {
    document.querySelectorAll('.split-btn__menu-portal').forEach((portal) => portal.remove());
    document.querySelectorAll('.split-btn__toggle').forEach((toggle) => {
      toggle.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.split-btn.is-open').forEach((root) => {
      root.classList.remove('is-open');
    });
  }

  emitSelect(configId, item, source) {
    const handler = this.handlers.get(configId);
    if (handler) {
      handler(item, { source });
      return;
    }
    source.dispatchEvent(new CustomEvent('splitButtonSelect', {
      bubbles: true,
      detail: { configId, item }
    }));
  }

  resolveItemFromPortal(itemEl, portal) {
    const configId = portal?.dataset?.splitConfig
      || portal?._sourceRoot?.dataset?.splitConfig
      || '';
    const itemId = itemEl.dataset.splitItem;
    const config = SplitButtonConfig.get(configId);
    const items = SplitButtonConfig.resolveItems(config);
    const fromConfig = items.find((item) => item.id === itemId);
    if (fromConfig) return { configId, item: fromConfig };

    return {
      configId,
      item: {
        id: itemId,
        label: itemEl.textContent.trim(),
        data: { ...itemEl.dataset }
      }
    };
  }

  bindGlobalEvents() {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-split-toggle]');
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown(toggle);
    }, { signal });

    document.addEventListener('click', (e) => {
      const primary = e.target.closest('[data-split-primary]');
      if (!primary) return;
      const root = primary.closest('.split-btn');
      if (!root || root.classList.contains('is-disabled') || root.classList.contains('is-busy')) return;
      if (primary.disabled) return;

      e.preventDefault();
      this.closeAll();

      const configId = root.dataset.splitConfig;
      const selectedId = root.dataset.splitSelected;
      const config = SplitButtonConfig.get(configId);
      const items = SplitButtonConfig.resolveItems(config);
      const item = items.find((entry) => entry.id === selectedId) || firstActionItem(items);
      if (!item) return;
      this.emitSelect(configId, item, primary);
    }, { signal });

    document.addEventListener('click', (e) => {
      const itemEl = e.target.closest('[data-split-item]');
      if (!itemEl) return;
      if (itemEl.classList.contains('action-disabled')) {
        e.preventDefault();
        return;
      }

      const portal = itemEl.closest('.split-btn__menu-portal');
      const root = portal?._sourceRoot || itemEl.closest('.split-btn');
      if (!root && !portal) return;

      e.preventDefault();
      e.stopPropagation();

      const { configId, item } = this.resolveItemFromPortal(itemEl, portal || root);
      if (root && item.selects !== false) root.dataset.splitSelected = item.id;
      this.closeAll();
      this.emitSelect(configId, item, itemEl);
    }, { signal });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.split-btn') && !e.target.closest('.split-btn__menu-portal')) {
        this.closeAll();
      }
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAll();
    }, { signal });

    window.addEventListener('scroll', () => {
      if (document.querySelector('.split-btn__menu-portal')) this.closeAll();
    }, { capture: true, signal });
  }

  destroy() {
    this.closeAll();
    this._abortController?.abort();
    this._abortController = null;
  }
}

export const splitButton = new SplitButton();
