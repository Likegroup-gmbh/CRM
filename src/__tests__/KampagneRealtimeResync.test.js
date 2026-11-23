import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  acquireKampagneChannel,
  __resetKampagneChannels,
  RECONNECT_BASE_MS,
  RESYNC_AFTER_HIDDEN_MS,
  RESYNC_JITTER_MS,
  RESYNC_MIN_GAP_MS
} from '../modules/kampagne/kampagneRealtimeChannel.js';
import { makeSupabase, setVisibility } from './kampagneRealtimeTestKit.js';

// Nach einem Realtime-Aussetzer reconnecten alle Tabs gleichzeitig. Jeder Resync laedt die
// ganze Kampagnen-Tabelle: gestreut, zusammengefasst und mit Mindestabstand.
describe('kampagneRealtimeChannel Resync-Drossel', () => {
  let channels;
  let random;

  beforeEach(() => {
    vi.useFakeTimers();
    random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const made = makeSupabase();
    channels = made.channels;
    window.supabase = made.supabase;
  });

  afterEach(() => {
    __resetKampagneChannels();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.supabase;
    setVisibility('visible');
  });

  function abbrechenUndNeu(index) {
    channels[index].statusCb('CHANNEL_ERROR', new Error('x'));
  }

  it('fasst die Resyncs beider Teile zu einem zusammen', () => {
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    abbrechenUndNeu(0);
    abbrechenUndNeu(1);
    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    expect(channels).toHaveLength(4);

    channels[2].statusCb('SUBSCRIBED');
    channels[3].statusCb('SUBSCRIBED');
    vi.advanceTimersByTime(RESYNC_JITTER_MS);

    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('haelt zwischen zwei Resyncs den Mindestabstand ein', () => {
    const zeiten = [];
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync: () => zeiten.push(Date.now()) });
    abbrechenUndNeu(0);
    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    channels[2].statusCb('SUBSCRIBED');
    vi.advanceTimersByTime(RESYNC_JITTER_MS);
    expect(zeiten).toHaveLength(1);

    abbrechenUndNeu(2);
    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    channels[3].statusCb('SUBSCRIBED');
    vi.advanceTimersByTime(zeiten[0] + RESYNC_MIN_GAP_MS - Date.now() - 1);
    expect(zeiten).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(zeiten).toHaveLength(2);
    expect(zeiten[1] - zeiten[0]).toBe(RESYNC_MIN_GAP_MS);
  });

  it('streut den Resync ueber RESYNC_JITTER_MS', () => {
    random.mockReturnValue(0.75);
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    abbrechenUndNeu(0);
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 1.25);
    channels[2].statusCb('SUBSCRIBED');

    vi.advanceTimersByTime(RESYNC_JITTER_MS * 0.75 - 1);
    expect(onResync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('Tab-Rueckkehr nach totem Socket loest nur einen Resync aus', () => {
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    setVisibility('hidden');
    abbrechenUndNeu(0);
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS + 1000);

    channels[2].statusCb('SUBSCRIBED');
    setVisibility('visible');
    vi.advanceTimersByTime(RESYNC_MIN_GAP_MS * 2);

    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('streut Reconnects um +-50 % um den Backoff', () => {
    random.mockReturnValue(0);
    acquireKampagneChannel('k1', { onChange: vi.fn() });
    abbrechenUndNeu(0);
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 0.5 - 1);
    expect(channels).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(channels).toHaveLength(3);

    random.mockReturnValue(0.75);
    abbrechenUndNeu(2);
    // zweiter Versuch ohne Erfolg dazwischen: doppelte Basis, hier mal 1,25
    vi.advanceTimersByTime(RECONNECT_BASE_MS * 2 * 1.25 - 1);
    expect(channels).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(channels).toHaveLength(4);
  });

  it('verwirft einen geplanten Resync beim Abbau', () => {
    const onResync = vi.fn();
    acquireKampagneChannel('k1', { onChange: vi.fn(), onResync });
    abbrechenUndNeu(0);
    vi.advanceTimersByTime(RECONNECT_BASE_MS);
    channels[2].statusCb('SUBSCRIBED');

    __resetKampagneChannels();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(RESYNC_JITTER_MS);
    expect(onResync).not.toHaveBeenCalled();
  });
});
