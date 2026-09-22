import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaybackSession } from '../core/media/PlaybackSession.js';
import { VideoElementPool } from '../core/media/VideoElementPool.js';
import * as MediaCache from '../core/media/MediaCache.js';

function fakeVideo(overrides = {}) {
  const listeners = new Map();
  const video = {
    readyState: 2,
    paused: false,
    currentTime: 1.5,
    duration: 40,
    src: 'https://dl/old.mp4',
    buffered: { length: 0, start: () => 0, end: () => 0 },
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    addEventListener(type, fn, opts) {
      const list = listeners.get(type) || [];
      list.push({ fn, opts });
      listeners.set(type, list);
      opts?.signal?.addEventListener('abort', () => {
        video.removeEventListener(type, fn);
      });
    },
    removeEventListener(type, fn) {
      const cur = listeners.get(type) || [];
      listeners.set(type, cur.filter(entry => entry.fn !== fn));
    },
    dispatch(type) {
      const list = [...(listeners.get(type) || [])];
      for (const entry of list) {
        entry.fn();
        if (entry.opts?.once) video.removeEventListener(type, entry.fn);
      }
    },
    getAttribute(name) {
      return name === 'src' ? video.src : null;
    },
  };
  return Object.assign(video, overrides);
}

function sessionWith(key) {
  const session = new PlaybackSession({
    pool: new VideoElementPool(),
    playback: { rearmFullscreen() {} },
  });
  const stage = document.createElement('div');
  session.present(stage, { key, poolable: true, renderFresh() {} });
  return session;
}

describe('PlaybackSession', () => {
  beforeEach(() => {
    MediaCache._clearMediaCache();
    URL.createObjectURL = vi.fn(() => 'blob:ready');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retarget wartet auf loadedmetadata, auch wenn readyState noch vom alten Medium stammt', async () => {
    const session = new PlaybackSession({ pool: new VideoElementPool() });
    const video = fakeVideo({ readyState: 2, paused: false, currentTime: 1.5 });

    const pending = session.retarget(video, 'blob:next', { time: 1.5, wasPaused: false });
    expect(video.src).toBe('blob:next');
    expect(video.readyState).toBe(2);
    expect(video.play).not.toHaveBeenCalled();

    video.dispatch('loadedmetadata');
    await pending;
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(1.5);
  });

  it('retarget ruft kein play(), wenn das Video pausiert war', async () => {
    const session = new PlaybackSession({ pool: new VideoElementPool() });
    const video = fakeVideo({ paused: true, currentTime: 2 });

    const pending = session.retarget(video, 'blob:next', { time: 2, wasPaused: true });
    video.dispatch('loadedmetadata');
    await pending;
    expect(video.play).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(2);
  });

  it('ohne Headroom kein ensure, mit Headroom ensure und dann retarget', async () => {
    const session = sessionWith('video:a:t');
    const video = fakeVideo({ paused: false, currentTime: 1.5 });
    global.fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      blob: async () => ({ size: 10 }),
    }));

    session.fillWhenReady(video, {
      key: 'video:a:t',
      streamUrl: 'https://dl/a.mp4',
      prefetch() {},
    });

    await Promise.resolve();
    expect(global.fetch).not.toHaveBeenCalled();

    video.buffered = { length: 1, start: () => 0, end: () => 20 };
    video.dispatch('progress');

    await vi.waitFor(() => expect(video.src).toBe('blob:ready'));
    expect(global.fetch).toHaveBeenCalledWith('https://dl/a.mp4', undefined);
    expect(video.play).not.toHaveBeenCalled();

    video.dispatch('loadedmetadata');
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(1.5);
    session.close();
  });

  it('waiting bricht den Nachbar-ensure ab, der Cache bleibt leer', async () => {
    const session = sessionWith('video:a:t');
    const video = fakeVideo({
      paused: true,
      buffered: { length: 1, start: () => 0, end: () => 20 },
    });
    let fetchSignal = null;
    global.fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      fetchSignal = init?.signal;
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));

    session.fillWhenReady(video, {
      key: 'video:a:t',
      streamUrl: null,
      prefetch(signal) {
        return MediaCache.ensure('video:n:t', 'https://dl/n.mp4', { signal });
      },
    });

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const hung = global.fetch.mock.results[0].value;
    video.dispatch('waiting');
    await hung.catch(() => {});
    await Promise.resolve();

    expect(fetchSignal.aborted).toBe(true);
    expect(MediaCache.getObjectUrl('video:n:t')).toBeNull();

    global.fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      blob: async () => ({ size: 4 }),
    }));
    const url = await MediaCache.ensure('video:n:t', 'https://dl/n.mp4');
    expect(url).toBe('blob:ready');
    session.close();
  });
});
