// collapsiblePanel.js
// Gemeinsame Toggle-Logik fuer Hauptnav und Editor-Skriptliste:
// Klasse auf root, Icon/Title/aria am Button, optional localStorage.

import { icon } from './icons/IconSystem.js';

export const COLLAPSE_TITLES = {
  collapsed: 'Navigation einblenden',
  expanded: 'Navigation verkleinern'
};

export function bindCollapsible({
  root,
  toggleBtn,
  collapsedClass,
  storageKey,
  titles = COLLAPSE_TITLES
} = {}) {
  if (!root || !toggleBtn || !collapsedClass) {
    throw new Error('bindCollapsible: root, toggleBtn und collapsedClass sind Pflicht');
  }

  const apply = (collapsed) => {
    root.classList.toggle(collapsedClass, collapsed);
    toggleBtn.innerHTML = collapsed
      ? icon('arrows-expand-diagonal')
      : icon('arrows-expand');
    toggleBtn.title = collapsed ? titles.collapsed : titles.expanded;
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    toggleBtn.setAttribute('aria-label', toggleBtn.title);
  };

  const isCollapsed = () => root.classList.contains(collapsedClass);

  const setCollapsed = (collapsed, { persist = true } = {}) => {
    apply(Boolean(collapsed));
    if (persist && storageKey) {
      localStorage.setItem(storageKey, String(Boolean(collapsed)));
    }
  };

  const toggle = () => setCollapsed(!isCollapsed());

  const restore = () => {
    if (!storageKey) {
      apply(isCollapsed());
      return;
    }
    const stored = localStorage.getItem(storageKey);
    if (stored === null) {
      apply(isCollapsed());
      return;
    }
    setCollapsed(stored === 'true', { persist: false });
  };

  const onClick = () => toggle();
  toggleBtn.addEventListener('click', onClick);
  apply(isCollapsed());

  return {
    isCollapsed,
    setCollapsed,
    toggle,
    restore,
    destroy() {
      toggleBtn.removeEventListener('click', onClick);
    }
  };
}
