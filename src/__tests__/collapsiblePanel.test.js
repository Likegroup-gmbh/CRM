import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/icons/IconSystem.js', () => ({
  icon: (key) => `<svg data-icon="${key}"></svg>`
}));

import { bindCollapsible } from '../core/collapsiblePanel.js';

describe('bindCollapsible', () => {
  let root;
  let toggleBtn;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement('div');
    toggleBtn = document.createElement('button');
    document.body.append(root, toggleBtn);
  });

  afterEach(() => {
    root.remove();
    toggleBtn.remove();
    localStorage.clear();
  });

  function bind(overrides = {}) {
    return bindCollapsible({
      root,
      toggleBtn,
      collapsedClass: 'is-collapsed',
      storageKey: 'test-collapsed',
      ...overrides
    });
  }

  it('toggle setzt Klasse, persistiert "true"/"false" und tauscht Icon/Title', () => {
    const panel = bind();

    expect(panel.isCollapsed()).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.title).toBe('Navigation verkleinern');
    expect(toggleBtn.innerHTML).toContain('arrows-expand');

    panel.toggle();

    expect(root.classList.contains('is-collapsed')).toBe(true);
    expect(localStorage.getItem('test-collapsed')).toBe('true');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.title).toBe('Navigation einblenden');
    expect(toggleBtn.getAttribute('aria-label')).toBe('Navigation einblenden');
    expect(toggleBtn.innerHTML).toContain('arrows-expand-diagonal');

    panel.toggle();

    expect(panel.isCollapsed()).toBe(false);
    expect(localStorage.getItem('test-collapsed')).toBe('false');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('setCollapsed(..., { persist: false }) schreibt Storage nicht', () => {
    const panel = bind();
    panel.setCollapsed(true, { persist: false });

    expect(panel.isCollapsed()).toBe(true);
    expect(localStorage.getItem('test-collapsed')).toBeNull();
  });

  it('restore liest Storage-String "true"', () => {
    localStorage.setItem('test-collapsed', 'true');
    const panel = bind();
    panel.restore();

    expect(panel.isCollapsed()).toBe(true);
    expect(toggleBtn.innerHTML).toContain('arrows-expand-diagonal');
  });

  it('restore ohne Pref laesst den aktuellen Zustand', () => {
    const panel = bind();
    expect(panel.isCollapsed()).toBe(false);
    panel.restore();
    expect(panel.isCollapsed()).toBe(false);
    expect(localStorage.getItem('test-collapsed')).toBeNull();
  });

  it('Klick auf den Button togglet', () => {
    const panel = bind();
    toggleBtn.click();
    expect(panel.isCollapsed()).toBe(true);
    expect(localStorage.getItem('test-collapsed')).toBe('true');
  });

  it('destroy entfernt den Click-Listener', () => {
    const panel = bind();
    panel.destroy();
    toggleBtn.click();
    expect(panel.isCollapsed()).toBe(false);
    expect(localStorage.getItem('test-collapsed')).toBeNull();
  });
});
