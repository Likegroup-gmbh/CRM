// playbackHeadroom
// Wann darf neben dem laufenden Stream ein Voll-Download starten? Erst wenn
// genug Puffer vor dem Playhead liegt (oder das Reststueck kurz und
// durchspielbar ist), sonst teilt sich der Start die Leitung mit dem Blob.

export const HEADROOM_SECONDS = 8;
export const HEADROOM_TIMEOUT_MS = 15_000;

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

export function hasHeadroom(video, { stalled = false } = {}) {
  if (!video || stalled) return false;
  if (bufferedAhead(video) >= HEADROOM_SECONDS) return true;
  const duration = video.duration;
  if (Number.isFinite(duration)) {
    const remaining = duration - (Number(video.currentTime) || 0);
    // Kurzes Reststueck: canplaythrough (readyState >= 4) und kein Stall.
    if (remaining <= HEADROOM_SECONDS && video.readyState >= 4) return true;
  }
  return false;
}

/**
 * Resolved bei Puffer-Vorsprung, bei kurzem Video mit canplaythrough, bei
 * Abbruch oder nach Timeout (grosse Dateien sollen trotzdem in den Cache).
 * @returns {Promise<void>}
 */
export function whenHeadroom(video, { signal, timeoutMs = HEADROOM_TIMEOUT_MS, isStalled = () => false } = {}) {
  if (!video || signal?.aborted || hasHeadroom(video, { stalled: isStalled() })) return Promise.resolve();

  return new Promise(resolve => {
    const events = ['progress', 'timeupdate', 'canplay', 'canplaythrough', 'playing', 'waiting'];
    let timer = null;
    const finish = () => {
      if (timer != null) clearTimeout(timer);
      for (const event of events) video.removeEventListener(event, check);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const check = () => {
      if (signal?.aborted || hasHeadroom(video, { stalled: isStalled() })) finish();
    };
    timer = setTimeout(finish, timeoutMs);
    if (typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
    for (const event of events) video.addEventListener(event, check);
    signal?.addEventListener('abort', finish, { once: true });
  });
}
