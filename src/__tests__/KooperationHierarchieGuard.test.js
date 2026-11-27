// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FormVideoHandler } from '../core/form/logic/FormVideoHandler.js';

describe('FormVideoHandler Hierarchie & Budget-Vorprüfung', () => {
  afterEach(() => {
    delete window.supabase;
    vi.restoreAllMocks();
  });

  it('blockiert Kooperation, wenn briefing_id zu einer anderen Produktion gehört', async () => {
    window.supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data: { produktion_id: 'prod-6-14' }, error: null }))
      }))
    };

    const handler = new FormVideoHandler();
    const res = await handler.validateKooperationBriefingProduktion({
      produktion_id: 'prod-15',
      briefing_id: 'brief-aus-6-14'
    });

    expect(res.isValid).toBe(false);
    expect(res.message).toContain('anderen Produktion');
  });

  it('übernimmt produktion_id vom Briefing, wenn beim freien Anlegen keine gesetzt ist', async () => {
    window.supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data: { produktion_id: 'prod-15' }, error: null }))
      }))
    };

    const handler = new FormVideoHandler();
    const submitData = { briefing_id: 'brief-15' };
    const res = await handler.validateKooperationBriefingProduktion(submitData);

    expect(res.isValid).toBe(true);
    expect(submitData.produktion_id).toBe('prod-15');
  });

  it('rollt eine frisch angelegte Kooperation bei fehlgeschlagenem Video-Insert zurück', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ delete: del })) };

    const handler = new FormVideoHandler();
    await handler.rollbackCreatedKooperation('koop-waise');

    expect(window.supabase.from).toHaveBeenCalledWith('kooperationen');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'koop-waise');
  });
});
