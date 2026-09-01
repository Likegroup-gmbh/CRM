// FloatingMenu.js
// Wiederverwendbares Click-Menue: Items mit Icon / Label / optionalem Subtext.
// Layout pro Menue oder pro Item: icon | icon-label | icon-label-sub.
// Close-outside und Escape bleiben beim Aufrufer.

import { icon } from '../icons/IconSystem.js';

export const FLOATING_MENU_LAYOUTS = ['icon', 'icon-label', 'icon-label-sub'];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveLayout(item, menuLayout) {
  const raw = item?.layout || menuLayout || 'icon-label';
  const layout = FLOATING_MENU_LAYOUTS.includes(raw) ? raw : 'icon-label';
  if (layout === 'icon-label-sub' && !String(item?.subtext || '').trim()) return 'icon-label';
  return layout;
}

function extraDataAttrs(data) {
  if (!data || typeof data !== 'object') return '';
  return Object.entries(data)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
    .join('');
}

function getRect(anchor) {
  if (!anchor) return null;
  if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
  if (typeof anchor.top === 'number' && typeof anchor.left === 'number') return anchor;
  return null;
}

/** Einzelnes Menue-Item als HTML. Exportiert fuer Tests. */
export function renderFloatingMenuItem(item, menuLayout = 'icon-label') {
  const layout = resolveLayout(item, menuLayout);
  const iconHtml = item.iconHtml || (item.icon ? icon(item.icon) : '');
  const label = item.label || '';
  const subtext = String(item.subtext || '').trim();

  let textHtml = '';
  if (layout === 'icon-label-sub') {
    textHtml = `
      <span class="crm-fmenu-text">
        <span class="crm-fmenu-label">${escapeHtml(label)}</span>
        <span class="crm-fmenu-sub">${escapeHtml(subtext)}</span>
      </span>`;
  } else if (layout !== 'icon') {
    textHtml = `<span class="crm-fmenu-label">${escapeHtml(label)}</span>`;
  }

  const title = item.title || (layout === 'icon' ? label : '');
  const active = !!item.active;
  const classes = [
    'crm-fmenu-item',
    `crm-fmenu-item--${layout}`,
    active ? 'is-active' : ''
  ].filter(Boolean).join(' ');

  // Item mit children: Parent-Trigger + Hover-Flyout (Pattern wie
  // .action-submenu in dropdowns.css). Der Trigger loest selbst keine
  // Aktion aus - Klick toggelt nur das Flyout (Touch/Tastatur).
  const children = Array.isArray(item.children) ? item.children.filter(Boolean) : [];
  if (children.length) {
    const childHtml = children.map((child) => renderFloatingMenuItem(child, menuLayout)).join('');
    return `
    <div class="crm-fmenu-group">
      <button type="button" class="${classes} crm-fmenu-item--parent" data-id="${escapeHtml(item.id)}"
        data-has-children="true" aria-haspopup="true"${
        title ? ` title="${escapeHtml(title)}"` : ''}${extraDataAttrs(item.data)}>
        ${iconHtml ? `<span class="crm-fmenu-icon">${iconHtml}</span>` : ''}
        ${textHtml}
        <span class="crm-fmenu-chevron" aria-hidden="true">›</span>
      </button>
      <div class="crm-fmenu-flyout">${childHtml}</div>
    </div>`;
  }

  return `
    <button type="button" class="${classes}" data-id="${escapeHtml(item.id)}"${
      title ? ` title="${escapeHtml(title)}"` : ''
    }${active ? ' aria-checked="true"' : ''}${extraDataAttrs(item.data)}>
      ${iconHtml ? `<span class="crm-fmenu-icon">${iconHtml}</span>` : ''}
      ${textHtml}
      ${active ? `<span class="crm-fmenu-check">${icon('check-filled')}</span>` : ''}
    </button>`;
}

/**
 * Befuellt und positioniert ein bestehendes Menu-Element.
 * @param {object} opts
 * @param {HTMLElement} opts.el
 * @param {Element|DOMRect|Range} [opts.anchor]
 * @param {Element} [opts.wrap]
 * @param {Array} opts.items
 * @param {string} [opts.layout]
 * @param {(id: string) => void} [opts.onSelect]
 */
export function openFloatingMenu({ el, anchor, wrap, items, layout = 'icon-label', onSelect }) {
  if (!el) return;
  const list = items || [];
  el.innerHTML = list.map((item) => renderFloatingMenuItem(item, layout)).join('');
  el.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Parent mit children: nur Flyout togglen, keine Aktion ausloesen
      if (btn.dataset.hasChildren) {
        btn.closest('.crm-fmenu-group')?.classList.toggle('is-open');
        return;
      }
      el.hidden = true;
      onSelect?.(btn.dataset.id);
    });
  });

  // Flyout-Richtung: rechts auf, ausser es laeuft aus dem Viewport
  el.querySelectorAll('.crm-fmenu-group').forEach((group) => {
    const trigger = group.querySelector('.crm-fmenu-item--parent');
    const flyout = group.querySelector('.crm-fmenu-flyout');
    trigger?.addEventListener('mouseenter', () => {
      flyout.classList.remove('crm-fmenu-flyout--left');
      const rect = flyout.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) flyout.classList.add('crm-fmenu-flyout--left');
    });
  });

  const rect = getRect(anchor);
  const wrapRect = wrap?.getBoundingClientRect?.();
  if (rect && wrapRect && wrap) {
    const wide = layout === 'icon-label-sub'
      || list.some((item) => resolveLayout(item, layout) === 'icon-label-sub');
    const minW = wide ? 260 : 220;
    el.style.top = `${rect.bottom - wrapRect.top + 6}px`;
    el.style.left = `${Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - minW))}px`;
  }
  el.hidden = false;
}
