import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../core/ModuleRegistry.js';

describe('NavigationGuard – Mehrfach-Klick-Schutz', () => {
  let registry;
  let mockModule;
  let initCallCount;

  beforeEach(() => {
    vi.clearAllMocks();
    initCallCount = 0;
    registry = new ModuleRegistry();

    mockModule = {
      init: vi.fn(() => {
        initCallCount++;
        return new Promise(resolve => setTimeout(resolve, 50));
      }),
      destroy: vi.fn(),
    };

    registry.register('kampagne-detail', mockModule);
    window.currentUser = { rolle: 'admin' };
  });

  it('ignoriert zweiten navigateTo() während laufender Navigation', async () => {
    const first = registry.navigateTo('/kampagne/abc');
    registry.navigateTo('/kampagne/abc');

    await first;

    expect(initCallCount).toBe(1);
  });

  it('erlaubt nächsten navigateTo() nach erfolgreicher Navigation', async () => {
    await registry.navigateTo('/kampagne/abc');
    await registry.navigateTo('/kampagne/def');

    expect(initCallCount).toBe(2);
  });

  it('setzt Flag zurück wenn init() fehlschlägt', async () => {
    const failModule = {
      init: vi.fn(() => Promise.reject(new Error('init failed'))),
      destroy: vi.fn(),
    };
    registry.register('kampagne-detail', failModule);

    try {
      await registry.navigateTo('/kampagne/abc');
    } catch {
      // Error erwartet
    }

    mockModule.init = vi.fn(() => Promise.resolve());
    registry.register('kampagne-detail', mockModule);

    await registry.navigateTo('/kampagne/def');
    expect(mockModule.init).toHaveBeenCalledWith('def');
  });
});

describe('Kunden-Routen-Alias', () => {
  let registry;
  let kundenDetail;

  beforeEach(() => {
    registry = new ModuleRegistry();
    kundenDetail = { init: vi.fn(() => Promise.resolve()), destroy: vi.fn() };
    registry.register('kunden-detail', kundenDetail);
    window.currentUser = { rolle: 'admin' };
  });

  it('leitet /kunde/:id/edit auf die Kundendetailseite', async () => {
    await registry.navigateTo('/kunde/39633377-48a7-4efb-a30d-dce388f5269e/edit');
    expect(kundenDetail.init).toHaveBeenCalledWith('39633377-48a7-4efb-a30d-dce388f5269e');
  });

  it('leitet /kunde/:id auf die Kundendetailseite', async () => {
    await registry.navigateTo('/kunde/39633377-48a7-4efb-a30d-dce388f5269e');
    expect(kundenDetail.init).toHaveBeenCalledWith('39633377-48a7-4efb-a30d-dce388f5269e');
  });

  it('laesst /kunden (Portal) unangetastet', async () => {
    const portal = { init: vi.fn(() => Promise.resolve()), destroy: vi.fn() };
    registry.register('kunden', portal);
    await registry.navigateTo('/kunden');
    expect(portal.init).toHaveBeenCalled();
    expect(kundenDetail.init).not.toHaveBeenCalled();
  });
});
