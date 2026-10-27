import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  acquireKampagneChannel,
  __resetKampagneChannels,
  GRACE_MS,
  RECONNECT_BASE_MS,
  RESYNC_AFTER_HIDDEN_MS
} from '../modules/kampagne/kampagneRealtimeChannel.js';

function makeSupabase() {
  const channels = [];
  const supabase = {
    channel: vi.fn((name) => {
      const api = {
        name,
        handlers: [],
        statusCb: null,
        on: vi.fn((_type, opts, cb) => { api.handlers.push({ opts, cb }); return api; }),
        subscribe: vi.fn((cb) => { api.statusCb = cb; return api; })
      };
      channels.push(api);
      return api;
    }),
    removeChannel: vi.fn()
  };
  return { supabase, channels };
}

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('kampagneRealtimeChannel', () => {
  let channels;

  beforeEach(() => {
    vi.useFakeTimers();
    const made = makeSupabase();
    channels = made.channels;
    window.supabase = made.supabase;
  });

  afterEach(() => {
    __resetKampagneChannels();
    vi.useRealTimers();
    delete window.supabase;
    setVisibility('visible');
  });

  it('meldet pro Tabelle ein Event * an (vier Subscriptions statt acht)', () => {
    acquireKampagneChannel('k1', { onChange: vi.fn() });

    expect(channels).toHaveLength(1);
    const { handlers } = channels[0];
    expect(handlers.map(h => `${h.opts.table}:${h.opts.event}`)).toEqual([
      'kooperation_videos:*',
      'kooperation_video_comment:*',
      'kooperationen:*',
      'kooperationen:DELETE'
    ]);
    expect(handlers[2].opts.filter).toBe('kampagne_id=eq.k1');
  });

  it('teilt einen Channel zwischen Listenern und baut ihn nach der Gnadenfrist ab', () => {
    const releaseA = acquireKampagneChannel('k1', { onChange: vi.fn() });
    releaseA();
    // Kanban/Tabelle-Wechsel: neuer Listener innerhalb der Gnadenfrist
    const releaseB = acquireKampagneChannel('k1', { onChange: vi.fn() });

    expect(window.supabase.channel).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GRACE_MS + 1000);
    expect(window.supabase.removeChannel).not.toHaveBeenCalled();

    releaseB();
    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(window.supabase.removeChannel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(window.supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('stellt Events dem Listener mit Tabellenname zu', () => {
    const onChange = vi.fn();
    acquireKampagneChannel('k1', { onChange });
    const payload = { eventType: 'UPDATE', new: { id: 'v1' } };

    channels[0].handlers[0].cb(payload);

    expect(onChange).toHaveBeenCalledWith('kooperation_videos', payload);
  });

  it('baut nach Fehler mit Backoff neu auf und loest danach einen Resync aus', () => {
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    const first = channels[0];

    first.statusCb('SUBSCRIBED');
    expect(onResync).not.toHaveBeenCalled();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    first.statusCb('CHANNEL_ERROR', new Error('x'));
    vi.advanceTimersByTime(RECONNECT_BASE_MS - 1);
    expect(channels).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(channels).toHaveLength(2);
    expect(window.supabase.removeChannel).toHaveBeenCalledWith(first);

    channels[1].statusCb('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('ignoriert Status eines bereits abgebauten Channels', () => {
    const onResync = vi.fn();
    const release = acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    const first = channels[0];
    release();
    vi.advanceTimersByTime(GRACE_MS + 1);

    first.statusCb('CLOSED');
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 4);

    expect(channels).toHaveLength(1);
    expect(onResync).not.toHaveBeenCalled();
  });

  it('holt nach laengerem Hintergrund-Tab nach, nach kurzem nicht', () => {
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });

    setVisibility('hidden');
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS - 1000);
    setVisibility('visible');
    expect(onResync).not.toHaveBeenCalled();

    setVisibility('hidden');
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS + 1000);
    setVisibility('visible');
    expect(onResync).toHaveBeenCalledTimes(1);
  });
});
