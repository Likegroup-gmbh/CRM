import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promoteAssetToFinal, unmarkFinalSlot, markedSlotsForSource } from '../core/PromoteFinalAsset.js';

vi.mock('../core/stills/stillAssets.js', async (importOriginal) => ({
  ...(await importOriginal()),
  updateStillCurrentFlags: vi.fn(async () => {}),
}));

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

  it('übernimmt den Titel der Quelldatei', async () => {
    const inserted = { id: 'f1', is_final: true };
    const del = makeThenable({ error: null });
    const ins = makeThenable({ data: inserted, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: inserted, error: null }));
    const insert = vi.fn(() => ins);
    window.supabase = { from: vi.fn(() => ({ delete: () => del, insert })) };

    await promoteAssetToFinal('video', { id: 'src1', video_id: 'v1', file_url: 'u', file_path: '/a.mp4', titel: 'Interview Kudamm' }, '9:16');

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ titel: 'Interview Kudamm' }));
  });

  it('Finale zeigen auf dieselbe SharePoint-Datei wie die Quelle', async () => {
    const ins = makeThenable({ data: { id: 'f1' }, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: { id: 'f1' }, error: null }));
    const insert = vi.fn(() => ins);
    window.supabase = { from: vi.fn(() => ({ delete: () => makeThenable({ error: null }), insert })) };
    const ablage = { ablage: 'sharepoint', drive_id: 'd1', item_id: 'it1', etag: 'e1', ctag: 'c1', breite: 1080, hoehe: 1920 };

    await promoteAssetToFinal('video', { id: 'src1', video_id: 'v1', file_url: 'u', file_path: '/a.mp4', ...ablage }, '9:16');
    await promoteAssetToFinal('story', { id: 's1', story_id: 'st1', video_id: 'v1', file_url: 'u', file_path: '/s.mp4', ...ablage }, '9:16');
    await promoteAssetToFinal('still', { id: 'b1', video_id: 'v1', file_url: 'u', file_path: '/b.jpg', ...ablage });

    expect(insert).toHaveBeenCalledTimes(3);
    for (const [row] of insert.mock.calls) expect(row).toMatchObject(ablage);
  });

  it('Quelle ohne Ablage-Spalten: kein ablage-Feld, die DB setzt dropbox', async () => {
    const ins = makeThenable({ data: { id: 'f1' }, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: { id: 'f1' }, error: null }));
    const insert = vi.fn(() => ins);
    window.supabase = { from: vi.fn(() => ({ delete: () => makeThenable({ error: null }), insert })) };

    await promoteAssetToFinal('video', { id: 'src1', video_id: 'v1', file_url: 'u', file_path: '/a.mp4' }, '9:16');

    expect(insert.mock.calls[0][0]).not.toHaveProperty('ablage');
    expect(insert.mock.calls[0][0]).not.toHaveProperty('item_id');
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

  it('Story: legt ein Final mit gleichem File, Story-Slot und source_asset_id an', async () => {
    const inserted = { id: 'sf1', story_id: 's1', variant_name: '4:5', is_final: true, source_asset_id: 'sa1' };
    const del = makeThenable({ error: null });
    const ins = makeThenable({ data: inserted, error: null });
    ins.single = vi.fn(() => Promise.resolve({ data: inserted, error: null }));
    const insert = vi.fn(() => ins);
    window.supabase = {
      from: vi.fn((table) => {
        expect(table).toBe('kooperation_story_asset');
        return { delete: () => del, insert };
      }),
    };
    const result = await promoteAssetToFinal('story', {
      id: 'sa1', story_id: 's1', video_id: 'v1', file_url: 'u', file_path: '/s.mp4', file_name: 's.mp4', file_size: 9,
    }, '4:5');
    expect(result.id).toBe('sf1');
    expect(del.eq).toHaveBeenCalledWith('source_asset_id', 'sa1');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      story_id: 's1', video_id: 'v1', file_path: '/s.mp4', variant_name: '4:5',
      is_final: true, is_current: false, source_asset_id: 'sa1', version_number: 1,
    }));
  });

  it('Story: lehnt unbekannte Slots und fehlende Slot-Zuordnung ab', async () => {
    await expect(promoteAssetToFinal('story', { id: 'a', story_id: 's' }, '16:9'))
      .rejects.toThrow(/Unbekannter Final-Slot/);
    await expect(promoteAssetToFinal('story', { id: 'a' }, '9:16'))
      .rejects.toThrow(/Slot-Zuordnung/);
  });

  it('Story: Aufheben loescht nur den Verweis dieser Quelle', async () => {
    const del = makeThenable({ error: null });
    window.supabase = { from: vi.fn(() => ({ delete: () => del })) };
    await unmarkFinalSlot('story', 'v1', '9:16', 'sa1');
    expect(window.supabase.from).toHaveBeenCalledWith('kooperation_story_asset');
    expect(del.eq).toHaveBeenCalledWith('is_final', true);
    expect(del.eq).toHaveBeenCalledWith('source_asset_id', 'sa1');
    await expect(unmarkFinalSlot('story', 'v1', '9:16')).rejects.toThrow(/sourceAssetId/);
  });
});
