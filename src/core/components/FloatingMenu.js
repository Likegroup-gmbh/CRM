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
        const group = btn.closest('.crm-fmenu-group');
        group?.classList.toggle('is-open');
        const flyout = group?.querySelector('.crm-fmenu-flyout');
        if (group?.classList.contains('is-open') && flyout) placeFlyout(flyout);
        return;
      }
      el.hidden = true;
      onSelect?.(btn.dataset.id);
    });
  });

  // Flyout-Richtung: rechts und nach unten, ausser es laeuft aus dem Viewport
  el.querySelectorAll('.crm-fmenu-group').forEach((group) => {
    const trigger = group.querySelector('.crm-fmenu-item--parent');
    const flyout = group.querySelector('.crm-fmenu-flyout');
    trigger?.addEventListener('mouseenter', () => {
      if (flyout) placeFlyout(flyout);
    });
  });

  // Erst einblenden, sonst ist offsetHeight 0 und die Kante laesst sich nicht messen.
  el.hidden = false;
  const wide = layout === 'icon-label-sub'
    || list.some((item) => resolveLayout(item, layout) === 'icon-label-sub');
  placeFloatingMenu(el, anchor, wrap, wide ? 260 : 220);
  el.querySelectorAll('.crm-fmenu-flyout').forEach((flyout) => placeFlyout(flyout));
}

const MENU_GAP = 6;
const MENU_MARGIN = 8;

/**
 * Menue unter den Anker setzen. Liegt die Auswahl am unteren Rand, waechst
 * das Menue sonst aus dem Viewport — dann nach oben oeffnen und bei Bedarf
 * auf die freie Hoehe begrenzen.
 */
function placeFloatingMenu(el, anchor, wrap, minW) {
  const rect = getRect(anchor);
  const wrapRect = wrap?.getBoundingClientRect?.();
  if (!rect || !wrapRect || !wrap) return;

  el.style.maxHeight = '';
  el.style.overflowY = '';

  const naturalHeight = el.offsetHeight;
  const naturalWidth = el.offsetWidth;
  // Sichtbar ist die Schnittmenge aus Editor und Viewport. Ueber den Editor
  // hinaus clippt der Seitenrahmen (overflow: hidden) das Menue wieder.
  const visibleTop = Math.max(wrapRect.top, MENU_MARGIN);
  const visibleBottom = Math.min(wrapRect.bottom, window.innerHeight - MENU_MARGIN);
  const spaceBelow = visibleBottom - rect.bottom - MENU_GAP;
  const spaceAbove = rect.top - MENU_GAP - visibleTop;
  const openUp = naturalHeight > 0 && naturalHeight > spaceBelow && spaceAbove > spaceBelow;
  const room = Math.max(0, openUp ? spaceAbove : spaceBelow);
  const viewportRoom = Math.max(0, window.innerHeight - MENU_MARGIN * 2);
  const cap = room > 0 ? Math.min(room, viewportRoom) : viewportRoom;
  const height = naturalHeight > 0 && cap > 0 && naturalHeight > cap ? cap : naturalHeight;

  if (height > 0 && height < naturalHeight) {
    el.style.maxHeight = `${height}px`;
    el.style.overflowY = 'auto';
  }

  let top = openUp
    ? rect.top - wrapRect.top - MENU_GAP - height
    : rect.bottom - wrapRect.top + MENU_GAP;

  if (height > 0) {
    const minTop = visibleTop - wrapRect.top;
    const maxTop = visibleBottom - height - wrapRect.top;
    if (maxTop >= minTop) top = Math.max(minTop, Math.min(top, maxTop));
  }

  let left = Math.max(
    MENU_MARGIN,
    Math.min(rect.left - wrapRect.left, wrap.clientWidth - minW)
  );
  if (naturalWidth > 0) {
    const overflowRight = wrapRect.left + left + naturalWidth - (window.innerWidth - MENU_MARGIN);
    if (overflowRight > 0) left -= overflowRight;
    const minLeft = MENU_MARGIN - wrapRect.left;
    if (left < minLeft) left = minLeft;
  }

  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
}

/** Flyout neben den Trigger legen, ohne unten oder rechts aus dem Viewport zu ragen. */
function placeFlyout(flyout) {
  const margin = MENU_MARGIN;
  flyout.classList.remove('crm-fmenu-flyout--left', 'crm-fmenu-flyout--up');
  flyout.style.maxHeight = '';
  flyout.style.overflowY = '';

  let rect = flyout.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  if (rect.right > window.innerWidth - margin) {
    flyout.classList.add('crm-fmenu-flyout--left');
    rect = flyout.getBoundingClientRect();
  }

  const groupRect = flyout.parentElement?.getBoundingClientRect?.();
  const spaceAbove = groupRect ? groupRect.bottom - margin : rect.top;
  const spaceBelow = groupRect
    ? window.innerHeight - margin - groupRect.top
    : window.innerHeight - margin - rect.top;

  if (rect.bottom > window.innerHeight - margin && spaceAbove > spaceBelow) {
    flyout.classList.add('crm-fmenu-flyout--up');
    rect = flyout.getBoundingClientRect();
  }

  const room = flyout.classList.contains('crm-fmenu-flyout--up')
    ? Math.max(0, spaceAbove)
    : Math.max(0, spaceBelow);
  if (room > 0 && rect.height > room) {
    flyout.style.maxHeight = `${room}px`;
    flyout.style.overflowY = 'auto';
  }
}
