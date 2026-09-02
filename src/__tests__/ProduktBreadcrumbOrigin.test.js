import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAction } from '../core/ActionsDropdownHandlers.js';

describe('Produkt-Actions folgen der Herkunft', () => {
  beforeEach(() => {
    window.navigateTo = vi.fn();
    window.moduleRegistry = { modules: new Map() };
  });

  afterEach(() => {
    delete window.navigateTo;
    delete window.moduleRegistry;
    window.history.pushState({}, '', '/');
  });

  it('von der Liste auf /produkt/:id', async () => {
    window.history.pushState({}, '', '/produkt');
    await handleAction({}, 'view', 'p1', 'produkt');
    expect(window.navigateTo).toHaveBeenCalledWith('/produkt/p1');
  });

  it('vom Unternehmen-Detail nested', async () => {
    window.history.pushState({}, '', '/unternehmen/u1?tab=produkte');
    window.moduleRegistry.modules.set('unternehmen-detail', { unternehmenId: 'u1' });
    await handleAction({}, 'view', 'p1', 'produkt');
    expect(window.navigateTo).toHaveBeenCalledWith('/unternehmen/u1/produkt?produkt=p1');
  });

  it('vom Marke-Detail nested auf die Marke', async () => {
    window.history.pushState({}, '', '/marke/m1?tab=produkte');
    window.moduleRegistry.modules.set('marke-detail', { markeId: 'm1' });
    await handleAction({}, 'view', 'p1', 'produkt');
    expect(window.navigateTo).toHaveBeenCalledWith('/marke/m1/produkt?produkt=p1');
  });
});
