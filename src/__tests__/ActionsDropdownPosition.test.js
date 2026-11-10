import { describe, it, expect, afterEach } from 'vitest';
import { ActionsDropdown } from '../core/ActionsDropdown.js';

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

function setViewport(width, height) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function stubSize(el, width, height) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
}

describe('ActionsDropdown – Position im Viewport', () => {
  let dd;

  afterEach(() => {
    dd?.destroy();
    dd = null;
    document.body.innerHTML = '';
    setViewport(VIEWPORT.width, VIEWPORT.height);
  });

  it('hält das Menü im Bild, wenn der Button links in einem schmalen Fenster sitzt', () => {
    setViewport(360, 640);
    dd = new ActionsDropdown();
    const portal = document.createElement('div');
    stubSize(portal, 280, 220);
    document.body.appendChild(portal);

    dd.positionPortal(portal, { top: 80, bottom: 112, left: 40, right: 72, width: 32, height: 32 });

    const left = parseFloat(portal.style.left);
    expect(left).toBe(8);
    expect(left + 280).toBeLessThanOrEqual(360 - 8);
  });

  it('klemmt ein Menü, das breiter als das Fenster ist, an den rechten Rand', () => {
    setViewport(320, 640);
    dd = new ActionsDropdown();
    const portal = document.createElement('div');
    stubSize(portal, 400, 220);
    document.body.appendChild(portal);

    dd.positionPortal(portal, { top: 80, bottom: 112, left: 280, right: 312, width: 32, height: 32 });

    expect(portal.style.maxWidth).toBe('304px');
    expect(parseFloat(portal.style.left)).toBe(8);
  });

  it('öffnet nach oben, wenn unter dem Button zu wenig Platz ist', () => {
    setViewport(1024, 500);
    dd = new ActionsDropdown();
    const portal = document.createElement('div');
    stubSize(portal, 260, 300);
    document.body.appendChild(portal);

    dd.positionPortal(portal, { top: 420, bottom: 452, left: 900, right: 980, width: 80, height: 32 });

    expect(parseFloat(portal.style.top)).toBe(116);
    expect(portal.style.maxHeight).toBe('');
  });

  it('begrenzt die Höhe, wenn das Menü länger als das Fenster ist', () => {
    setViewport(390, 400);
    dd = new ActionsDropdown();
    const portal = document.createElement('div');
    stubSize(portal, 260, 500);
    document.body.appendChild(portal);

    dd.positionPortal(portal, { top: 180, bottom: 212, left: 340, right: 372, width: 32, height: 32 });

    const top = parseFloat(portal.style.top);
    const maxHeight = parseFloat(portal.style.maxHeight);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + maxHeight).toBeLessThanOrEqual(400 - 8);
    expect(portal.style.overflowY).toBe('auto');
  });

  it('klappt das Untermenü nach rechts, wenn links kein Platz ist', () => {
    setViewport(800, 700);
    dd = new ActionsDropdown();
    const trigger = document.createElement('a');
    trigger.className = 'action-item has-submenu';
    trigger.getBoundingClientRect = () => ({ top: 120, bottom: 156, left: 16, right: 180, width: 164, height: 36 });
    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    stubSize(submenu, 240, 180);

    dd.positionSubmenu(submenu, trigger);

    expect(submenu.classList.contains('submenu--flip-right')).toBe(true);
    expect(trigger.classList.contains('submenu-opens-right')).toBe(true);
  });

  it('legt das Untermenü unter den Eintrag, wenn daneben kein Platz ist', () => {
    setViewport(360, 700);
    dd = new ActionsDropdown();
    const trigger = document.createElement('a');
    trigger.className = 'action-item has-submenu';
    trigger.getBoundingClientRect = () => ({ top: 120, bottom: 156, left: 40, right: 300, width: 260, height: 36 });
    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    stubSize(submenu, 240, 180);

    dd.positionSubmenu(submenu, trigger);

    expect(submenu.classList.contains('submenu--inline')).toBe(true);
    expect(submenu.style.top).toBe('');
  });
});
