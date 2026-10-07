import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promoteAssetToFinal, unmarkFinalSlot, markedSlotsForSource } from '../core/PromoteFinalAsset.js';

function makeThenable(result) {
  const chain = {
    eq: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  };
  return chain;
}

describe('PromoteFinalAsset', () => {
  beforeEach(() => {
    window.currentUser = { id: 'u1' };
  });

  it('legt ein Final-Asset mit gleichem File und source_asset_id an', async () => {
    const inserted = {
      id: 'f1',
      video_id: 'v1',
      file_url: 'https://x/a.mp4',
      file_path: '/Feedbackschleife_2/a.mp4',
      variant_name: '9:16',
      is_final: true,
      source_asset_id: 'src1',
    };
    const del = makeThenable({ error: null });
    const ins = makeThenable({ data: inserted, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: inserted, error: null }));

    window.supabase = {
      from: vi.fn((table) => {
        expect(table).toBe('kooperation_video_asset');
        return {
          delete: () => del,
          insert: () => ins,
        };
      }),
    };

    const result = await promoteAssetToFinal('video', {
      id: 'src1',
      video_id: 'v1',
      file_url: 'https://x/a.mp4',
      file_path: '/Feedbackschleife_2/a.mp4',
    }, '9:16');

    expect(result.source_asset_id).toBe('src1');
    expect(result.variant_name).toBe('9:16');
    expect(result.file_url).toBe('https://x/a.mp4');
  });

  it('lehnt unbekannte Video-Slots ab', async () => {
    await expect(promoteAssetToFinal('video', { id: 'a', video_id: 'v' }, '16:9'))
      .rejects.toThrow(/Unbekannter Final-Slot/);
  });

  it('akzeptiert 1:1 als Final-Slot', async () => {
    const inserted = { id: 'f2', variant_name: '1:1', source_asset_id: 'src1', is_final: true };
    const del = makeThenable({ error: null });
    const ins = makeThenable({ data: inserted, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: inserted, error: null }));
    window.supabase = {
      from: vi.fn(() => ({
        delete: () => del,
        insert: () => ins,
      })),
    };
    const result = await promoteAssetToFinal('video', {
      id: 'src1', video_id: 'v1', file_url: 'https://x/a.mp4', file_path: '/a.mp4',
    }, '1:1');
    expect(result.variant_name).toBe('1:1');
    expect(del.eq).toHaveBeenCalledWith('source_asset_id', 'src1');
  });

  it('markedSlotsForSource findet die Slots des Quell-Assets', () => {
    const slots = markedSlotsForSource([
      { source_asset_id: 'a', variant_name: '9:16' },
      { source_asset_id: 'b', variant_name: '4:5' },
      { source_asset_id: 'a', variant_name: '4:5' },
    ], 'a');
    expect(slots).toEqual(['9:16', '4:5']);
  });

  it('unmarkFinalSlot loescht nur den Verweis dieser Quelle', async () => {
    const del = makeThenable({ error: null });
    window.supabase = {
      from: vi.fn(() => ({ delete: () => del })),
    };
    await unmarkFinalSlot('video', 'v1', '9:16', 'src1');
    expect(window.supabase.from).toHaveBeenCalledWith('kooperation_video_asset');
    expect(del.eq).toHaveBeenCalledWith('variant_name', '9:16');
    expect(del.eq).toHaveBeenCalledWith('source_asset_id', 'src1');
  });

  it('unmarkFinalSlot ohne Quelle loescht nicht den ganzen Slot', async () => {
    await expect(unmarkFinalSlot('video', 'v1', '9:16')).rejects.toThrow(/sourceAssetId/);
  });
});
