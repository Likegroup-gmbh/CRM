import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openSkriptCreateDrawer, closeSkriptCreateDrawer } from '../modules/skripte/SkriptCreateDrawer.js';
import { skripteService } from '../modules/skripte/SkripteService.js';

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: {
    loadUnternehmen: vi.fn(async () => [{ id: 'u1', firmenname: 'Hautica' }]),
    loadKonzepte: vi.fn(async () => []),
    loadFreigegebeneVideoideen: vi.fn(async () => [])
  }
}));

async function flush() {
  await vi.waitFor(() => {
    expect(document.getElementById('skript-create-drawer')).not.toBeNull();
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('SkriptCreateDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.formSystem = undefined;
    skripteService.loadUnternehmen.mockResolvedValue([{ id: 'u1', firmenname: 'Hautica' }]);
    skripteService.loadKonzepte.mockResolvedValue([]);
    skripteService.loadFreigegebeneVideoideen.mockResolvedValue([]);
  });

  afterEach(() => {
    closeSkriptCreateDrawer();
  });

  it('zeigt nur Unternehmen, Konzept, Videoidee', async () => {
    openSkriptCreateDrawer();
    await flush();

    const ids = [...document.querySelectorAll('#skript-create-drawer select')].map((s) => s.id);
    expect(ids).toEqual(['skcreate-unternehmen', 'skcreate-konzept', 'skcreate-videoidee']);
    expect(document.querySelector('#skcreate-marke')).toBeNull();
    expect(document.querySelector('#skcreate-kampagne')).toBeNull();
    expect(document.querySelector('#skcreate-produkt')).toBeNull();
    expect(document.querySelector('#skcreate-persona')).toBeNull();
    expect(document.querySelector('#skcreate-branche')).toBeNull();
    expect(document.querySelector('#skcreate-briefing')).toBeNull();
  });

  it('Kampagnen-Prefill: ein Konzept wird gesetzt und gelockt', async () => {
    skripteService.loadKonzepte.mockResolvedValue([{ id: 'st-1', name: 'Sommer' }]);
    openSkriptCreateDrawer({
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica',
      kampagne_id: 'k1'
    });
    await flush();

    expect(skripteService.loadKonzepte).toHaveBeenCalledWith({
      unternehmenId: 'u1',
      kampagneId: 'k1',
      produktionId: null
    });
    expect(document.getElementById('skcreate-konzept').value).toBe('st-1');
    expect(document.getElementById('skcreate-konzept').disabled).toBe(true);
    expect(document.getElementById('skcreate-unternehmen').disabled).toBe(true);
  });

  it('Kampagnen-Prefill: mehrere Konzepte bleiben wählbar', async () => {
    skripteService.loadKonzepte.mockResolvedValue([
      { id: 'st-1', name: 'Sommer' },
      { id: 'st-2', name: 'Winter' }
    ]);
    openSkriptCreateDrawer({
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica',
      kampagne_id: 'k1'
    });
    await flush();

    expect(document.getElementById('skcreate-konzept').value).toBe('');
    expect(document.getElementById('skcreate-konzept').disabled).toBe(false);
  });
});
