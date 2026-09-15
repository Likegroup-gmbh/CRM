import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/media/downloadMediaAsset.js', () => ({
  downloadMediaAsset: vi.fn(async () => true),
}));

import { FinalVideoBulkDownload } from '../modules/kampagne/FinalVideoBulkDownload.js';
import { downloadMediaAsset } from '../core/media/downloadMediaAsset.js';

function makeTable() {
  return {
    kampagneInfo: { unternehmen: 'Acme GmbH', name: 'Sommer 2025' },
    kooperationen: [
      { id: 'k1', creator: { vorname: 'Max', nachname: 'Mueller' } },
      { id: 'k2', creator: { vorname: 'Anna', nachname: 'Schulz' } },
    ],
    videos: {
      k1: [
        { id: 'v1', position: 1 },
        { id: 'v2', position: 2 },
      ],
      k2: [{ id: 'v3', position: 1 }],
    },
  };
}

function mockSupabase(finalAssets) {
  window.supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: finalAssets, error: null })),
        })),
      })),
    })),
  };
}

describe('FinalVideoBulkDownload', () => {
  let table;
  let bulk;
  let toasts;

  beforeEach(() => {
    vi.clearAllMocks();
    toasts = [];
    window.toastSystem = { show: (msg, type) => toasts.push({ msg, type }) };
    window.canFeature = () => true;
    table = makeTable();
    bulk = new FinalVideoBulkDownload(table);
  });

  it('ohne Markierung: Toast, kein Download', async () => {
    await bulk.downloadSelected();
    expect(downloadMediaAsset).not.toHaveBeenCalled();
    expect(toasts[0].msg).toMatch(/markieren/);
  });

  it('laedt beide Final-Varianten (9:16 + 4:5) mit Upload-Namen inkl. Video-Nr', async () => {
    mockSupabase([
      { id: 'a1', video_id: 'v2', file_path: '/x/alt1.mp4', variant_name: '9:16', is_final: true },
      { id: 'a2', video_id: 'v2', file_path: '/x/alt2.mp4', variant_name: '4:5', is_final: true },
    ]);
    bulk.selected.add('k1');

    await bulk.downloadSelected();

    expect(downloadMediaAsset).toHaveBeenCalledTimes(2);
    expect(downloadMediaAsset).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ id: 'a1' }),
      'max_mueller_acme_gmbh_sommer_2025_2_final_9_16.mp4',
      { silent: true }
    );
    expect(downloadMediaAsset).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: 'a2' }),
      'max_mueller_acme_gmbh_sommer_2025_2_final_4_5.mp4',
      { silent: true }
    );
    expect(toasts.at(-1).msg).toContain('2/2');
  });

  it('ueberspringt Videos ohne Final und weist im Toast darauf hin', async () => {
    mockSupabase([
      { id: 'a1', video_id: 'v1', file_path: '/x/f.mp4', variant_name: '9:16', is_final: true },
    ]);
    bulk.selected.add('k1'); // v1 hat Final, v2 nicht

    await bulk.downloadSelected();

    expect(downloadMediaAsset).toHaveBeenCalledTimes(1);
    expect(toasts.at(-1).msg).toContain('1 Video(s) ohne Final übersprungen');
  });

  it('meldet info, wenn die Auswahl gar keine Finals hat', async () => {
    mockSupabase([]);
    bulk.selected.add('k2');

    await bulk.downloadSelected();

    expect(downloadMediaAsset).not.toHaveBeenCalled();
    expect(toasts.at(-1).msg).toMatch(/Keine finalen Videos/);
  });

  it('sammelt Finals ueber mehrere markierte Kooperationen', async () => {
    mockSupabase([
      { id: 'a1', video_id: 'v1', file_path: '/x/f1.mp4', variant_name: '9:16', is_final: true },
      { id: 'a2', video_id: 'v3', file_path: '/x/f3.mp4', variant_name: '9:16', is_final: true },
    ]);
    bulk.selected.add('k1');
    bulk.selected.add('k2');

    await bulk.downloadSelected();

    expect(downloadMediaAsset).toHaveBeenCalledTimes(2);
    expect(downloadMediaAsset).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: 'a2' }),
      'anna_schulz_acme_gmbh_sommer_2025_1_final_9_16.mp4',
      { silent: true }
    );
  });
});
