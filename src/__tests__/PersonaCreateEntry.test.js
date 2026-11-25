import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAction } from '../core/ActionsDropdownHandlers.js';
import { openPersonaCreateDrawer } from '../modules/persona/PersonaCreateDrawer.js';

vi.mock('../modules/persona/PersonaCreateDrawer.js', () => ({
  openPersonaCreateDrawer: vi.fn()
}));

describe('add_persona öffnet den Drawer', () => {
  beforeEach(() => {
    openPersonaCreateDrawer.mockClear();
    window.navigateTo = vi.fn();
    window.moduleRegistry = { modules: new Map() };
  });

  it('vom Unternehmen mit gesperrter Firma', async () => {
    window.moduleRegistry.modules.set('unternehmen-detail', {
      unternehmen: { firmenname: 'Hautica' }
    });
    await handleAction({}, 'add_persona', 'u1', 'unternehmen');
    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(openPersonaCreateDrawer).toHaveBeenCalledWith({
      origin: 'unternehmen',
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica'
    });
  });

  it('von der Marke mit gesperrter Firma und Marke', async () => {
    window.moduleRegistry.modules.set('marke-detail', {
      marke: {
        markenname: 'Clear',
        unternehmen_id: 'u1',
        unternehmen: { firmenname: 'Hautica' }
      }
    });
    await handleAction({}, 'add_persona', 'm1', 'marke');
    expect(openPersonaCreateDrawer).toHaveBeenCalledWith({
      origin: 'marke',
      marke_id: 'm1',
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica',
      markeName: 'Clear'
    });
  });
});
