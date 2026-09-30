import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

// Schmaler Viewport (≤768px): Die Sidebar klappt von alleine zur Icon-Leiste
// ein, damit sie nicht ohne Hintergrund über dem Inhalt liegt. Die
// gespeicherte Nutzer-Präferenz bleibt dabei unangetastet und greift wieder,
// sobald der Viewport breit wird.

function mockMatchMedia(initialMatches) {
  let matches = initialMatches;
  const listeners = new Set();
  const mq = {
    media: '(max-width: 768px)',
    get matches() { return matches; },
    addEventListener: (_ev, cb) => listeners.add(cb),
    removeEventListener: (_ev, cb) => listeners.delete(cb),
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb)
  };
  window.matchMedia = vi.fn(() => mq);
  return {
    mq,
    setMatches(value) {
      matches = value;
      listeners.forEach((cb) => cb({ matches: value }));
    }
  };
}

describe('NavigationSystem Sidebar-Auto-Collapse', () => {
  let appRoot;
  let toggleBtn;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="app-root">
        <aside class="sidebar">
          <button type="button" id="sidebar-toggle"></button>
        </aside>
        <nav id="main-nav"></nav>
      </div>
    `;
    appRoot = document.getElementById('app-root');
    toggleBtn = document.getElementById('sidebar-toggle');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    delete window.matchMedia;
  });

  function bindNav() {
    const nav = new NavigationSystem();
    nav._bindSidebarToggle();
    return nav;
  }

  it('klappt bei schmalem Viewport automatisch ein, ohne Storage zu schreiben', () => {
    mockMatchMedia(true);
    bindNav();

    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);
    expect(localStorage.getItem('sidebar-collapsed')).toBeNull();
  });

  it('lässt bei breitem Viewport den Default ausgeklappt', () => {
    mockMatchMedia(false);
    bindNav();

    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(false);
  });

  it('wendet bei breitem Viewport die gespeicherte Präferenz an', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    mockMatchMedia(false);
    bindNav();

    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('stellt beim Zurückziehen auf breit wieder den ausgeklappten Default her', () => {
    const mm = mockMatchMedia(true);
    bindNav();
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);

    mm.setMatches(false); // Fenster wieder breit gezogen
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(false);
    expect(localStorage.getItem('sidebar-collapsed')).toBeNull();
  });

  it('klappt beim Wechsel auf schmal wieder ein, auch wenn vorher manuell ausgeklappt', () => {
    const mm = mockMatchMedia(false);
    bindNav();
    mm.setMatches(true);
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);

    // Nutzer klappt manuell aus ...
    toggleBtn.click();
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(false);

    // ... breit und wieder schmal ziehen klappt trotzdem wieder automatisch ein
    mm.setMatches(false);
    mm.setMatches(true);
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('lässt sich im schmalen Viewport manuell aus- und wieder einklappen', () => {
    mockMatchMedia(true);
    bindNav();
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);

    toggleBtn.click();
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(false);

    toggleBtn.click();
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('funktioniert auch ohne matchMedia-Support (Fallback)', () => {
    delete window.matchMedia;
    bindNav();

    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(false);
  });

  it('destroy entfernt den Viewport-Listener', () => {
    const mm = mockMatchMedia(true);
    const nav = bindNav();
    nav.destroy();

    mm.setMatches(false);
    // Kein Listener mehr: der Zustand darf sich nicht mehr ändern.
    expect(appRoot.classList.contains('sidebar-collapsed')).toBe(true);
  });
});
