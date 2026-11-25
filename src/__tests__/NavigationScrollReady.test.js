import { describe, it, expect, beforeEach, vi } from 'vitest';

const scroll = vi.hoisted(() => ({
  applyScrollAfterNavigation: vi.fn(() => Promise.resolve()),
}));

vi.mock('../core/NavigationScroll.js', () => ({
  rememberScrollForRoute: vi.fn(),
  saveScrollToCurrentHistory: vi.fn(),
  applyScrollAfterNavigation: scroll.applyScrollAfterNavigation,
  savedScrollFor: vi.fn(() => ({})),
  historyScrollFor: vi.fn(() => ({})),
  mergeScrolls: vi.fn(() => ({ top: 400 })),
  currentHistoryRoute: vi.fn(() => '/kampagne/abc'),
}));

const { ModuleRegistry } = await import('../core/ModuleRegistry.js');

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// Module mit Skeleton-Muster kehren vor dem Laden zurueck. Der Scroll darf
// erst nach `ready` greifen, aber ohne die Navigationssperre zu halten.
describe('Scroll-Restore nach ready', () => {
  let registry;
  let load;
  let modul;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ModuleRegistry();
    load = deferred();
    modul = {
      init: vi.fn(() => Promise.resolve()),
      destroy: vi.fn(),
      ready: load.promise,
    };
    registry.register('kampagne-detail', modul);
    window.currentUser = { rolle: 'admin' };
  });

  it('wartet mit dem Scroll auf ready und gibt die Sperre vorher frei', async () => {
    await registry.navigateTo('/kampagne/abc');

    expect(registry._isNavigating).toBe(false);
    expect(scroll.applyScrollAfterNavigation).not.toHaveBeenCalled();

    load.resolve();
    await tick();

    expect(scroll.applyScrollAfterNavigation).toHaveBeenCalledTimes(1);
  });

  it('scrollt nicht, wenn zwischenzeitlich weiternavigiert wurde', async () => {
    await registry.navigateTo('/kampagne/abc');
    modul.ready = undefined;
    await registry.navigateTo('/kampagne/def');
    scroll.applyScrollAfterNavigation.mockClear();

    load.resolve();
    await tick();

    expect(scroll.applyScrollAfterNavigation).not.toHaveBeenCalled();
  });

  it('scrollt ohne ready sofort innerhalb der Navigation', async () => {
    modul.ready = undefined;
    await registry.navigateTo('/kampagne/abc');

    expect(scroll.applyScrollAfterNavigation).toHaveBeenCalledTimes(1);
  });
});
