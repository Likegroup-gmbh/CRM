import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bindLiveUpdates, LIVE_RELOAD_MS } from '../modules/video-browser/videoBrowserLive.js';
import { __resetKampagneChannels } from '../modules/kampagne/kampagneRealtimeChannel.js';

function makeSupabase() {
  const channels = [];
  return {
    channels,
    supabase: {
      channel: vi.fn(() => {
        const api = {
          handlers: [],
          on: vi.fn((_type, opts, cb) => { api.handlers.push({ opts, cb }); return api; }),
          subscribe: vi.fn(() => api)
        };
        channels.push(api);
        return api;
      }),
      removeChannel: vi.fn()
    }
  };
}

function makeBrowser() {
  document.body.innerHTML = '<div data-vb><input data-caption></div>';
  return {
    detail: { kampagneId: 'kamp-1' },
    root: document.querySelector('[data-vb]'),
    raw: { kooperationen: [{ id: 'k1' }] },
    cleanups: [],
    destroyed: false,
    reload: vi.fn(async () => {})
  };
}

describe('Video-Browser: Live-Aktualisierung', () => {
  let channels;
  let vb;
  const emit = (table, payload) => {
    for (const c of channels) for (const h of c.handlers) if (h.opts.table === table) h.cb(payload);
  };
  const stand = (koopId) => ({ eventType: 'UPDATE', new: { kooperation_id: koopId } });

  beforeEach(() => {
    vi.useFakeTimers();
    const made = makeSupabase();
    channels = made.channels;
    window.supabase = made.supabase;
    vb = makeBrowser();
    bindLiveUpdates(vb);
  });

  afterEach(() => {
    vb.cleanups.forEach(fn => fn());
    __resetKampagneChannels();
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('lädt nach einer neuen Datei einmal entprellt neu', async () => {
    emit('kooperation_medien_stand', stand('k1'));
    emit('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS - 1);
    expect(vb.reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(vb.reload).toHaveBeenCalledTimes(1);
  });

  it('reagiert auf Video-Änderungen nur der eigenen Kooperationen', async () => {
    emit('kooperation_videos', { eventType: 'UPDATE', new: { id: 'v9', kooperation_id: 'fremd' } });
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).not.toHaveBeenCalled();

    emit('kooperation_videos', { eventType: 'DELETE', new: {}, old: { id: 'v1', kooperation_id: 'k1' } });
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).toHaveBeenCalledTimes(1);
  });

  it('ignoriert Kommentar-Events', async () => {
    emit('kooperation_video_comment', { eventType: 'INSERT', new: { video_id: 'v1' } });
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).not.toHaveBeenCalled();
  });

  it('wartet, solange ein Feld im Browser den Fokus hat', async () => {
    const input = vb.root.querySelector('input');
    input.focus();

    emit('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS * 3);
    expect(vb.reload).not.toHaveBeenCalled();

    input.blur();
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).toHaveBeenCalledTimes(1);
  });

  it('wartet während einer Umbenennung', async () => {
    vb.renamingFile = { id: 'a1' };
    emit('kooperation_medien_stand', stand('k1'));
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS * 2);
    expect(vb.reload).not.toHaveBeenCalled();

    vb.renamingFile = null;
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).toHaveBeenCalledTimes(1);
  });

  it('lädt nach einem Reconnect neu', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    channels[0].subscribe.mock.calls[0][0]('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(5000);
    channels[2].subscribe.mock.calls[0][0]('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS);
    expect(vb.reload).toHaveBeenCalledTimes(1);
  });

  it('macht nach dem Abbau nichts mehr', async () => {
    emit('kooperation_medien_stand', stand('k1'));
    vb.cleanups.forEach(fn => fn());
    vb.cleanups = [];
    await vi.advanceTimersByTimeAsync(LIVE_RELOAD_MS * 2);
    expect(vb.reload).not.toHaveBeenCalled();
  });
});
