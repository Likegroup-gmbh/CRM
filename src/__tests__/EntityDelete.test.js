import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityMutator } from '../core/data/EntityMutator.js';
import { confirmDelete } from '../core/actions/actionDelete.js';

function supabaseMitDelete(result) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { from, del, eq, select };
}

describe('EntityMutator.deleteEntity', () => {
  let mutator;

  beforeEach(() => {
    mutator = new EntityMutator({ dataPreparer: {}, relationManager: {} });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.supabase;
  });

  it('meldet success bei gelöschter Zeile und fragt die Zeile zurück', async () => {
    const sb = supabaseMitDelete({ data: [{ id: 's1' }], error: null });
    window.supabase = sb;

    expect(await mutator.deleteEntity('skripte', 's1')).toEqual({ success: true, id: 's1' });
    expect(sb.from).toHaveBeenCalledWith('skripte');
    expect(sb.eq).toHaveBeenCalledWith('id', 's1');
    expect(sb.select).toHaveBeenCalledWith('id');
  });

  it('meldet failure bei 0 Zeilen (RLS blockiert ohne Fehler)', async () => {
    window.supabase = supabaseMitDelete({ data: [], error: null });

    const res = await mutator.deleteEntity('skripte', 's1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Nicht gelöscht');
  });

  it('meldet failure bei Supabase-Fehler', async () => {
    window.supabase = supabaseMitDelete({ data: null, error: { message: 'boom' } });

    expect(await mutator.deleteEntity('skripte', 's1')).toEqual({ success: false, error: 'boom' });
  });
});

describe('confirmDelete (generisch)', () => {
  let events;
  const onEvent = (e) => events.push(e.detail);

  beforeEach(() => {
    events = [];
    window.addEventListener('entityUpdated', onEvent);
    window.toastSystem = { show: vi.fn() };
    window.confirmationModal = { open: vi.fn().mockResolvedValue({ confirmed: true }) };
    window.dataService = { deleteEntity: vi.fn().mockResolvedValue({ success: true, id: 's1' }) };
  });

  afterEach(() => {
    window.removeEventListener('entityUpdated', onEvent);
    delete window.toastSystem;
    delete window.confirmationModal;
    delete window.dataService;
  });

  it('macht bei Abbruch nichts', async () => {
    window.confirmationModal.open.mockResolvedValue({ confirmed: false });

    await confirmDelete('s1', 'skripte');

    expect(window.dataService.deleteEntity).not.toHaveBeenCalled();
    expect(window.toastSystem.show).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('toastet Erfolg und feuert entityUpdated', async () => {
    await confirmDelete('s1', 'skripte');

    expect(window.dataService.deleteEntity).toHaveBeenCalledWith('skripte', 's1');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Erfolgreich gelöscht', 'success');
    expect(events).toEqual([{ entity: 'skripte', action: 'deleted', id: 's1' }]);
  });

  it('toastet den Fehler und feuert kein entityUpdated', async () => {
    window.dataService.deleteEntity.mockResolvedValue({ success: false, error: 'Keine Berechtigung' });

    await confirmDelete('s1', 'skripte');

    expect(window.toastSystem.show).toHaveBeenCalledWith('Keine Berechtigung', 'error');
    expect(events).toEqual([]);
  });
});
