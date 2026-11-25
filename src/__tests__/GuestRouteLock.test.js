import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../core/ModuleRegistry.js';

describe('ModuleRegistry Gast-Routensperre', () => {
  beforeEach(() => {
    window.guestShare = {
      allowedRoute: '/castings/abc',
      entityType: 'sourcing',
      entityId: 'abc',
      rechte: 'ansehen',
    };
    window.toastSystem = { show: vi.fn() };
    window.content = document.createElement('div');
    window.setHeadline = vi.fn();
  });

  it('blockiert andere Routen', async () => {
    const registry = new ModuleRegistry();
    await registry.navigateTo('/kampagne/xyz');
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Ihr Zugang ist auf die geteilte Liste beschränkt.',
      'warning',
    );
  });

  it('erlaubt die geteilte Liste', async () => {
    const registry = new ModuleRegistry();
    const init = vi.fn();
    registry.register('castings-detail', { init });
    await registry.navigateTo('/castings/abc');
    expect(window.toastSystem.show).not.toHaveBeenCalled();
    expect(init).toHaveBeenCalledWith('abc');
  });

  it('lässt Produktionen nur bei geteilten Kampagnen durch', async () => {
    const registry = new ModuleRegistry();
    const init = vi.fn();
    registry.register('kampagne-detail', { init });
    await registry.navigateTo('/produktion/p1');
    expect(init).not.toHaveBeenCalled();

    window.guestShare = { allowedRoute: '/kampagne/k1', entityType: 'kampagne', entityId: 'k1', rechte: 'feedback' };
    await registry.navigateTo('/produktion/p1');
    expect(init).toHaveBeenCalledWith('p1');
    expect(window.toastSystem.show).toHaveBeenCalledTimes(1);

    await registry.navigateTo('/produktion/p1/edit');
    expect(init).toHaveBeenCalledTimes(1);
  });
});
