import { icon } from '../icons/IconSystem.js';
// ToolbarMenu.js
// Gemeinsame Toolbar-Bausteine fuer Tabellen-Detailseiten (Sourcing, Strategie, ...):
// Listen-Kopf (Logo + Name) links und Plus-Menue rechts. Submenues (z.B. der
// Sourcing-Status-Filter) werden als fertiges HTML in itemsHtml durchgereicht.

const PLUS_ICON = `
  ${icon('plus-lg')}`;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Logo + Listenname fuer den linken Block der Compact-Toolbar. */
export function renderToolbarListenKopf({ name = '', logoUrl = '', logoAlt = 'Logo' } = {}) {
  let logoHtml = '';
  if (logoUrl) {
    const safeUrl = window.validatorSystem?.sanitizeUrl(logoUrl) ?? logoUrl;
    if (safeUrl) {
      logoHtml = `
        <img src="${escapeHtml(safeUrl)}"
             alt="${escapeHtml(logoAlt)}"
             title="${escapeHtml(logoAlt)}"
             class="toolbar-entity-logo"
             loading="lazy" />`;
    }
  }

  return `
    <div class="toolbar-listen-kopf">
      ${logoHtml}
      ${name ? `<span class="toolbar-listen-name">${escapeHtml(name)}</span>` : ''}
    </div>`;
}

export function renderToolbarMenuItem({ id, label, icon = '', title = '', active = false } = {}) {
  return `
    <button type="button" class="action-item${active ? ' active' : ''}"${id ? ` id="${escapeHtml(id)}"` : ''} role="menuitem"${title ? ` title="${escapeHtml(title)}"` : ''}>
      ${icon}
      ${escapeHtml(label)}
    </button>`;
}

export function renderToolbarMenu({ toggleId, toggleTitle = 'Weitere Aktionen', itemsHtml = '' } = {}) {
  return `
    <div class="toolbar-menu">
      <button type="button" class="toolbar-menu-toggle"${toggleId ? ` id="${escapeHtml(toggleId)}"` : ''} aria-expanded="false" aria-haspopup="true" title="${escapeHtml(toggleTitle)}" aria-label="${escapeHtml(toggleTitle)}">
        ${PLUS_ICON}
      </button>
      <div class="toolbar-menu-dropdown" role="menu" aria-hidden="true">
        ${itemsHtml}
      </div>
    </div>`;
}

// Bindet Oeffnen/Schliessen inkl. Outside-Click und Escape. Klicks auf
// Submenues schliessen das Menue nicht. Rueckgabe ist eine Cleanup-Funktion,
// die der Aufrufer in seine Listener-Verwaltung haengt.
export function bindToolbarMenu(menu) {
  const root = typeof menu === 'string' ? document.querySelector(menu) : menu;
  const toggle = root?.querySelector('.toolbar-menu-toggle');
  const dropdown = root?.querySelector('.toolbar-menu-dropdown');
  if (!root || !toggle || !dropdown) return () => {};

  const setOpen = (open) => {
    dropdown.classList.toggle('show', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    dropdown.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const toggleHandler = (e) => {
    e.stopPropagation();
    setOpen(!dropdown.classList.contains('show'));
  };
  toggle.addEventListener('click', toggleHandler);

  const itemHandler = (e) => {
    if (e.target.closest('.action-submenu') || e.target.closest('.submenu')) return;
    if (e.target.closest('.action-item')) setOpen(false);
  };
  dropdown.addEventListener('click', itemHandler);

  const outsideHandler = (e) => {
    if (!root.contains(e.target)) setOpen(false);
  };
  document.addEventListener('click', outsideHandler);

  const escapeHandler = (e) => {
    if (e.key === 'Escape') setOpen(false);
  };
  document.addEventListener('keydown', escapeHandler);

  return () => {
    toggle.removeEventListener('click', toggleHandler);
    dropdown.removeEventListener('click', itemHandler);
    document.removeEventListener('click', outsideHandler);
    document.removeEventListener('keydown', escapeHandler);
  };
}
