// PlaybackSession
// Eine Stelle fuer das aktive Kooperationsvideo: Element-Leben (Pool),
// Blob-Umschaltung ohne Play-Abbruch, und wann Voll-Downloads starten duerfen.
// Stories/Stills und Dropbox-Aufloesung bleiben aussen.

import { VideoElementPool } from './VideoElementPool.js';
import * as MediaCache from './MediaCache.js';
import { perfLog } from './mediaPerf.js';

const HEADROOM_SECONDS = 8;
const HEADROOM_TIMEOUT_MS = 15_000;

function bareSrc(value) {
  if (!value) return '';
  return String(value).split('#')[0];
}

function sameMediaSrc(video, url) {
  const target = bareSrc(url);
  if (!target) return false;
  const candidates = [video.getAttribute?.('src'), video.src];
  return candidates.some(candidate => {
    const bare = bareSrc(candidate);
    return bare === target || (bare && target && bare.endsWith(target));
  });
}

/** Sekunden Puffer hinter currentTime. 0, wenn keine Range das Playhead deckt. */
export function bufferedAhead(video) {
  const t = Number(video?.currentTime) || 0;
  const ranges = video?.buffered;
  if (!ranges || ranges.length === 0) return 0;
  let end = null;
  for (let i = 0; i < ranges.length; i++) {
    const start = ranges.start(i);
    const rangeEnd = ranges.end(i);
    if (t >= start && t <= rangeEnd) end = rangeEnd;
  }
  if (end == null) {
    for (let i = 0; i < ranges.length; i++) {
      const rangeEnd = ranges.end(i);
      if (rangeEnd > t) end = rangeEnd;
    }
  }
  if (end == null) return 0;
  return Math.max(0, end - t);
}

export class PlaybackSession {
  /**
   * @param {{ pool?: VideoElementPool, playback?: { rearmFullscreen(stage: Element): void }, headroomTimeoutMs?: number }} [deps]
   */
  constructor({ pool, playback, headroomTimeoutMs } = {}) {
    this.pool = pool || new VideoElementPool();
    this.playback = playback || null;
    this._headroomTimeoutMs = headroomTimeoutMs ?? HEADROOM_TIMEOUT_MS;
    /** @type {string|null} */
    this._activeVideoKey = null;
    this._watchAbort = null;
    this._neighborAbort = null;
    this._stalled = false;
  }

  get activeKey() {
    return this._activeVideoKey;
  }

  /**
   * Pool-Hit wieder einhaengen, sonst frisch rendern lassen.
   * @returns {boolean} true, wenn ein geparktes Element wiederverwendet wurde
   */
  present(stage, { key, poolable, renderFresh }) {
    this._cancelWatch();
    const parked = poolable ? this.pool.take(key) : null;
    if (parked) {
      stage.replaceChildren(...Array.from(parked.childNodes));
      this.playback?.rearmFullscreen(stage);
      this._activeVideoKey = key;
      perfLog('pool-hit', { key });
      const blobUrl = MediaCache.getObjectUrl(key);
      const video = stage.querySelector('.vpl-video');
      if (blobUrl && video && !sameMediaSrc(video, blobUrl)) {
        const time = video.currentTime;
        // Parken pausiert. Play nicht wieder anstossen.
        this.retarget(video, blobUrl, { time, wasPaused: true });
        perfLog('blob-upgrade', { key, via: 'pool' });
      }
      return true;
    }

    renderFresh?.();
    this._activeVideoKey = poolable ? key : null;
    return false;
  }

  /**
   * Einziger Src-Tausch. play() erst nach loadedmetadata des NEUEN Mediums.
   * readyState des vorherigen Mediums wird ignoriert.
   * @returns {Promise<boolean>}
   */
  retarget(video, blobUrl, { time, wasPaused, signal } = {}) {
    if (signal?.aborted) return Promise.resolve(false);
    if (!video || !blobUrl || sameMediaSrc(video, blobUrl)) return Promise.resolve(false);

    video.src = blobUrl;
    return new Promise(resolve => {
      if (signal?.aborted) {
        resolve(false);
        return;
      }
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const restore = () => {
        if (signal?.aborted) {
          finish(false);
          return;
        }
        try {
          if (Number.isFinite(time) && time > 0) video.currentTime = time;
        } catch (_) { /* seek vor Metadaten */ }
        if (!wasPaused) {
          const pending = video.play?.();
          if (pending?.catch) pending.catch(() => {});
        }
        finish(true);
      };
      video.addEventListener('loadedmetadata', restore, { once: true, signal });
      video.addEventListener('error', () => finish(false), { once: true, signal });
    });
  }

  /**
   * Resolved bei Puffer-Vorsprung, bei kurzem Video mit canplaythrough,
   * oder nach Timeout (grosse Dateien sollen trotzdem in den Cache).
   * @returns {Promise<void>}
   */
  whenHeadroom(video, { signal, timeoutMs } = {}) {
    if (!video) return Promise.resolve();
    if (!signal?.aborted && this._hasHeadroom(video)) return Promise.resolve();

    const limit = timeoutMs ?? this._headroomTimeoutMs;
    return new Promise(resolve => {
      let timer = null;
      const events = ['progress', 'timeupdate', 'canplay', 'canplaythrough', 'playing', 'waiting'];
      const cleanup = () => {
        if (timer != null) clearTimeout(timer);
        for (const event of events) video.removeEventListener(event, check);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const check = () => {
        if (signal?.aborted || this._hasHeadroom(video)) finish();
      };
      timer = setTimeout(finish, limit);
      if (typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
      for (const event of events) video.addEventListener(event, check);
      if (signal) signal.addEventListener('abort', finish, { once: true });
      check();
    });
  }

  /**
   * Aktives Kooperationsvideo: ensure und ein Nachbar-Prefetch erst nach Headroom.
   * waiting bricht nur den Nachbar-Download ab, nicht den laufenden Stream.
   */
  fillWhenReady(video, { key, streamUrl, prefetch, onBlob } = {}) {
    this._cancelWatch();
    if (!video) return;

    const watchAbort = new AbortController();
    this._watchAbort = watchAbort;
    this._bindStall(video, watchAbort.signal);

    this.whenHeadroom(video, { signal: watchAbort.signal }).then(async () => {
      if (watchAbort.signal.aborted) return;

      if (streamUrl && key && this._activeVideoKey === key) {
        const blobUrl = await MediaCache.ensure(key, streamUrl);
        if (watchAbort.signal.aborted || this._activeVideoKey !== key) return;
        if (blobUrl) {
          const time = video.currentTime;
          const wasPaused = video.paused;
          this.retarget(video, blobUrl, { time, wasPaused, signal: watchAbort.signal });
        }
        onBlob?.(blobUrl || null);
      }

      if (watchAbort.signal.aborted || this._stalled) return;
      this._neighborAbort = new AbortController();
      prefetch?.(this._neighborAbort.signal);
    });
  }

  park(stage) {
    this._cancelWatch();
    const key = this._activeVideoKey;
    if (!key) return;
    this._activeVideoKey = null;
    const video = stage?.querySelector('.vpl-video');
    if (!video) return;
    try { video.pause(); } catch (_) { /* still */ }
    const wrapper = document.createElement('div');
    wrapper.append(...Array.from(stage.childNodes));
    this.pool.park(key, wrapper);
  }

  close() {
    this._cancelWatch();
    this.pool.clear();
    this._activeVideoKey = null;
  }

  _hasHeadroom(video) {
    if (this._stalled) return false;
    if (bufferedAhead(video) >= HEADROOM_SECONDS) return true;
    const duration = video.duration;
    if (Number.isFinite(duration)) {
      const remaining = duration - (Number(video.currentTime) || 0);
      // Kurzes Reststueck: canplaythrough (readyState >= 4) und kein Stall.
      if (remaining <= HEADROOM_SECONDS && video.readyState >= 4) return true;
    }
    return false;
  }

  _bindStall(video, signal) {
    const clear = () => { this._stalled = false; };
    video.addEventListener('waiting', () => {
      this._stalled = true;
      this._neighborAbort?.abort();
    }, { signal });
    video.addEventListener('playing', clear, { signal });
    video.addEventListener('canplay', clear, { signal });
    video.addEventListener('canplaythrough', clear, { signal });
  }

  _cancelWatch() {
    this._watchAbort?.abort();
    this._watchAbort = null;
    this._neighborAbort?.abort();
    this._neighborAbort = null;
    this._stalled = false;
  }
}
