import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../core/ModuleRegistry.js';

describe('ModuleRegistry Gast-Routensperre', () => {
  beforeEach(() => {
    window.guestShare = {
      allowedRoute: '/sourcing/abc',
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
    registry.register('sourcing-detail', { init });
    await registry.navigateTo('/sourcing/abc');
    expect(window.toastSystem.show).not.toHaveBeenCalled();
    expect(init).toHaveBeenCalledWith('abc');
  });
});
