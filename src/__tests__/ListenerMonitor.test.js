import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureListenerMonitor, hideListenerMonitor } from '../core/dev/ListenerMonitor.js';

const COLLAPSED_KEY = 'listenerMonitorCollapsed';

function ensureLocalStorage() {
  if (typeof globalThis.localStorage?.removeItem === 'function') return;
  const store = Object.create(null);
  const api = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true, writable: true });
}

ensureLocalStorage();

describe('ListenerMonitor ein-/ausblenden', () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.removeItem(COLLAPSED_KEY);
    hideListenerMonitor();
  });

  afterEach(() => {
    hideListenerMonitor();
    localStorage.removeItem(COLLAPSED_KEY);
  });

  it('klappt auf einen Tab zusammen und wieder auf', () => {
    ensureListenerMonitor();
    const overlay = document.getElementById('listener-monitor');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toMatch(/doc:/);
    expect(overlay.style.bottom).toBe('8px');

    overlay.querySelector('[data-action="collapse"]').click();

    expect(overlay.classList.contains('is-collapsed')).toBe(true);
    expect(overlay.textContent).not.toMatch(/doc:/);
    expect(overlay.textContent).toMatch(/L/);
    expect(overlay.style.bottom).toBe('96px');
    expect(overlay.style.right).toBe('0px');
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('1');

    overlay.click();

    expect(overlay.classList.contains('is-collapsed')).toBe(false);
    expect(overlay.textContent).toMatch(/doc:/);
    expect(overlay.style.bottom).toBe('8px');
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('0');
  });

  it('bleibt nach Remount eingeklappt', () => {
    localStorage.setItem(COLLAPSED_KEY, '1');
    ensureListenerMonitor();
    const overlay = document.getElementById('listener-monitor');
    expect(overlay.classList.contains('is-collapsed')).toBe(true);
    expect(overlay.textContent).not.toMatch(/doc:/);
    expect(overlay.style.right).toBe('0px');
  });
});
