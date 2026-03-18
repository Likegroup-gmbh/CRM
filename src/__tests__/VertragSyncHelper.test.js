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

    it('rendert immer eine disabled Checkbox', () => {
      const html = renderVertragCell({ id: 'k1', vertrag_unterschrieben: false, _vertraege: [] });
      expect(html).toContain('disabled');
      expect(html).toContain('type="checkbox"');
    });

    it('rendert checked + disabled Checkbox wenn vertrag_unterschrieben = true', () => {
      const html = renderVertragCell({ id: 'k1', vertrag_unterschrieben: true, _vertraege: [] });
      expect(html).toContain('disabled');
      expect(html).toContain('checked');
    });

    it('rendert Badge-Link neben der Checkbox wenn signed Vertrag existiert', () => {
      const koop = {
        id: 'k1',
        vertrag_unterschrieben: true,
        _vertraege: [{ id: 'v1', dropbox_file_url: 'https://dropbox.com/signed.pdf', name: 'Vertrag A' }],
      };
      const html = renderVertragCell(koop);
      expect(html).toContain('disabled');
      expect(html).toContain('checked');
      expect(html).toContain('href="https://dropbox.com/signed.pdf"');
      expect(html).toContain('vertrag-badge--signed');
    });

    it('rendert nur leere disabled Checkbox ohne Badge wenn kein Vertrag existiert', () => {
      const html = renderVertragCell({ id: 'k1', vertrag_unterschrieben: false, _vertraege: [] });
      expect(html).toContain('disabled');
      expect(html).not.toContain('checked');
      expect(html).not.toContain('vertrag-badge');
    });

  });

});
