import { describe, it, expect, vi } from 'vitest';
import { syncVertragCheckbox, renderVertragCell } from '../core/VertragSyncHelper.js';

function createTrackingSupabase(config = {}) {
  const log = [];

  const mock = {
    from: vi.fn((table) => ({
      update: vi.fn((data) => {
        log.push({ op: 'update', table, data });
        return {
          eq: vi.fn((col, val) => {
            log.push({ op: 'update.eq', table, col, val });
            return Promise.resolve({ error: config.updateError || null });
          }),
        };
      }),
    })),
    _log: log,
  };
  return mock;
}

describe('VertragSyncHelper', () => {

  it('setzt vertrag_unterschrieben = true auf der Kooperation', async () => {
    const sb = createTrackingSupabase();

    const result = await syncVertragCheckbox('koop-123', true, { supabase: sb });

    expect(result).toEqual({ success: true });

    const updateOps = sb._log.filter(e => e.op === 'update' && e.table === 'kooperationen');
    expect(updateOps.length).toBe(1);
    expect(updateOps[0].data).toEqual({ vertrag_unterschrieben: true });

    const eqOps = sb._log.filter(e => e.op === 'update.eq' && e.table === 'kooperationen');
    expect(eqOps[0]).toMatchObject({ col: 'id', val: 'koop-123' });
  });

  it('setzt vertrag_unterschrieben = false auf der Kooperation', async () => {
    const sb = createTrackingSupabase();

    const result = await syncVertragCheckbox('koop-456', false, { supabase: sb });

    expect(result).toEqual({ success: true });

    const updateOps = sb._log.filter(e => e.op === 'update' && e.table === 'kooperationen');
    expect(updateOps.length).toBe(1);
    expect(updateOps[0].data).toEqual({ vertrag_unterschrieben: false });

    const eqOps = sb._log.filter(e => e.op === 'update.eq' && e.table === 'kooperationen');
    expect(eqOps[0]).toMatchObject({ col: 'id', val: 'koop-456' });
  });

  it('gibt { success: false } zurueck wenn kooperationId fehlt (kein DB-Call)', async () => {
    const sb = createTrackingSupabase();

    const result = await syncVertragCheckbox(null, true, { supabase: sb });

    expect(result).toEqual({ success: false, error: 'Keine kooperationId' });
    expect(sb._log.length).toBe(0);
  });

  it('gibt Fehler zurueck bei DB-Fehler, wirft nicht', async () => {
    const sb = createTrackingSupabase({ updateError: { message: 'Connection lost' } });

    const result = await syncVertragCheckbox('koop-789', true, { supabase: sb });

    expect(result).toEqual({ success: false, error: 'Connection lost' });
  });

  it('faengt auch unerwartete Exceptions ab', async () => {
    const sb = {
      from: () => { throw new Error('Unexpected crash'); },
    };

    const result = await syncVertragCheckbox('koop-000', true, { supabase: sb });

    expect(result).toEqual({ success: false, error: 'Unexpected crash' });
  });

  describe('renderVertragCell', () => {
    const render = (koop) => new DOMParser().parseFromString(renderVertragCell(koop), 'text/html');
    const label = (doc) => doc.querySelector('.table-select__label').textContent.trim();

    it('rendert den TableSelect ohne Checkbox, nicht klickbar', () => {
      const doc = render({ id: 'k1', vertrag_unterschrieben: false, _vertraege: [] });
      expect(doc.querySelector('input[type="checkbox"]')).toBeNull();
      expect(doc.querySelector('.table-select').dataset.itemId).toBe('k1');
      expect(doc.querySelector('button.table-select__trigger')).toBeNull();
      expect(doc.querySelector('.table-select__trigger--disabled')).not.toBeNull();
    });

    it('zeigt "Unterschrieben" wenn signed Vertrag existiert', () => {
      const doc = render({
        id: 'k1',
        _vertraege: [{ id: 'v1', dropbox_file_url: 'https://dropbox.com/signed.pdf', name: 'Vertrag A' }],
      });
      expect(label(doc)).toBe('Unterschrieben');
    });

    it('zeigt "Erstellt" wenn generierter Vertrag existiert', () => {
      const doc = render({
        id: 'k1',
        _vertraege: [{ id: 'v1', datei_url: 'https://example.com/vertrag.pdf', is_draft: false, name: 'Vertrag B' }],
      });
      expect(label(doc)).toBe('Erstellt');
    });

    it('zeigt "Entwurf" wenn nur Draft existiert', () => {
      const doc = render({ id: 'k1', _vertraege: [{ id: 'v1', is_draft: true }] });
      expect(label(doc)).toBe('Entwurf');
    });

    it('zeigt "Gesendet"', () => {
      const doc = render({
        id: 'k1',
        _vertraege: [{ id: 'v1', status: 'gesendet', datei_url: 'https://example.com/vertrag.pdf', is_draft: false, name: 'V' }],
      });
      expect(label(doc)).toBe('Gesendet');
    });

    it('zeigt "Abgelehnt"', () => {
      const doc = render({
        id: 'k1',
        _vertraege: [{ id: 'v1', status: 'abgelehnt', datei_url: 'https://example.com/vertrag.pdf', is_draft: false }],
      });
      expect(label(doc)).toBe('Abgelehnt');
    });

    it('zeigt "Noch nicht erstellt" wenn kein Vertrag existiert', () => {
      const doc = render({ id: 'k1', vertrag_unterschrieben: false, _vertraege: [] });
      expect(label(doc)).toBe('Noch nicht erstellt');
      expect(doc.querySelector('.table-select__trigger--empty')).not.toBeNull();
    });

  });

});
