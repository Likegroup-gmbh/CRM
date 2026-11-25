import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/kampagne/videoTableMediaRefresh.js', () => ({ refreshKoopMedia: vi.fn() }));

import { refreshKoopMedia } from '../modules/kampagne/videoTableMediaRefresh.js';
import { VideoTableRealtimeHandler, MEDIEN_DEBOUNCE_MS } from '../modules/kampagne/VideoTableRealtimeHandler.js';

const stand = (kooperationId) => ({ eventType: 'UPDATE', new: { kooperation_id: kooperationId, kampagne_id: 'kamp-1' } });

describe('VideoTableRealtimeHandler: kooperation_medien_stand', () => {
  let table;
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();
    refreshKoopMedia.mockReset();
    refreshKoopMedia.mockResolvedValue(true);
    table = { kooperationen: [{ id: 'k1' }, { id: 'k2' }], refilter: vi.fn() };
    handler = new VideoTableRealtimeHandler(table);
  });

  afterEach(() => {
    handler.destroy();
    vi.useRealTimers();
  });

  it('fasst mehrere Events einer Kooperation zu einem Refresh zusammen', async () => {
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    vi.advanceTimersByTime(MEDIEN_DEBOUNCE_MS - 100);
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    vi.advanceTimersByTime(MEDIEN_DEBOUNCE_MS - 1);
    expect(refreshKoopMedia).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(refreshKoopMedia).toHaveBeenCalledTimes(1);
    expect(refreshKoopMedia).toHaveBeenCalledWith(table, 'k1');
    expect(table.refilter).not.toHaveBeenCalled();
  });

  it('entprellt je Kooperation getrennt', async () => {
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    handler._onRealtimeChange('kooperation_medien_stand', stand('k2'));
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS);

    expect(refreshKoopMedia.mock.calls.map(c => c[1]).sort()).toEqual(['k1', 'k2']);
  });

  it('ignoriert Kooperationen außerhalb der Tabelle', async () => {
    handler._onRealtimeChange('kooperation_medien_stand', stand('fremd'));
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS);
    expect(refreshKoopMedia).not.toHaveBeenCalled();
  });

  it('startet während eines Laufs keinen zweiten, sondern genau einen danach', async () => {
    let fertig;
    refreshKoopMedia.mockImplementationOnce(() => new Promise((resolve) => { fertig = resolve; }));

    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS);
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS);
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS);
    expect(refreshKoopMedia).toHaveBeenCalledTimes(1);

    fertig(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshKoopMedia).toHaveBeenCalledTimes(2);
  });

  it('räumt offene Timer beim Zerstören ab', async () => {
    handler._onRealtimeChange('kooperation_medien_stand', stand('k1'));
    handler.destroy();
    await vi.advanceTimersByTimeAsync(MEDIEN_DEBOUNCE_MS * 2);
    expect(refreshKoopMedia).not.toHaveBeenCalled();
  });
});
