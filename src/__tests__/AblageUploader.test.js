import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToSession } from '../core/AblageUploader.js';

const URL_ = 'https://graph.example/upload/s1';
const CHUNK = 320 * 1024;

const json = (status, body, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k] ?? null },
  json: async () => body,
});

const file = (size) => new Blob([new Uint8Array(size)]);

/** Fake-Graph: nimmt Stücke an, antwortet je Aufruf aus `script` oder regulär. */
function graph({ size, script = [] } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, opts) => {
    const range = opts.headers?.['Content-Range'];
    calls.push({ method: opts.method, range, headers: opts.headers });
    const next = script.shift();
    if (next instanceof Error) throw next;
    if (next) return next;
    if (opts.method !== 'PUT') return json(204, null);
    const end = Number(range.match(/-(\d+)\//)[1]);
    if (end + 1 >= size) return json(201, { id: 'item1', name: 'a.mp4', size });
    return json(202, { nextExpectedRanges: [`${end + 1}-`] });
  });
  return { fetchImpl, calls };
}

describe('uploadToSession', () => {
  afterEach(() => vi.useRealTimers());

  it('lädt in Stücken mit Content-Range und ohne Authorization', async () => {
    const size = CHUNK * 2 + 10;
    const g = graph({ size });
    const progress = [];

    const item = await uploadToSession({
      file: file(size), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl,
      onProgress: (p) => progress.push(p.loaded),
    });

    expect(item).toEqual({ id: 'item1', name: 'a.mp4', size });
    expect(g.calls.map(c => c.range)).toEqual([
      `bytes 0-${CHUNK - 1}/${size}`,
      `bytes ${CHUNK}-${2 * CHUNK - 1}/${size}`,
      `bytes ${2 * CHUNK}-${size - 1}/${size}`,
    ]);
    expect(g.calls.every(c => !('Authorization' in c.headers))).toBe(true);
    expect(progress).toEqual([CHUNK, 2 * CHUNK, size]);
  });

  it('setzt dort fort, wo nextExpectedRanges hinzeigt', async () => {
    const size = CHUNK * 3;
    // Graph hat vom ersten Stück nur die Hälfte übernommen
    const g = graph({ size, script: [json(202, { nextExpectedRanges: [`${CHUNK / 2}-`] })] });

    await uploadToSession({ file: file(size), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl });

    expect(g.calls[1].range).toBe(`bytes ${CHUNK / 2}-${CHUNK / 2 + CHUNK - 1}/${size}`);
  });

  it('wiederholt bei 503 und Netzwerkfehler mit Backoff', async () => {
    vi.useFakeTimers();
    const size = 100;
    const g = graph({ size, script: [json(503, {}), new TypeError('Failed to fetch')] });

    const p = uploadToSession({ file: file(size), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl });
    await vi.runAllTimersAsync();

    await expect(p).resolves.toMatchObject({ id: 'item1' });
    expect(g.calls).toHaveLength(3);
    expect(new Set(g.calls.map(c => c.range))).toEqual(new Set([`bytes 0-99/100`]));
  });

  it('respektiert Retry-After bei 429', async () => {
    vi.useFakeTimers();
    const g = graph({ size: 100, script: [json(429, {}, { 'Retry-After': '5' })] });

    const p = uploadToSession({ file: file(100), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl });
    await vi.advanceTimersByTimeAsync(4900);
    expect(g.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(p).resolves.toMatchObject({ id: 'item1' });
    expect(g.calls).toHaveLength(2);
  });

  it('gibt nach 3 Wiederholungen auf', async () => {
    vi.useFakeTimers();
    const g = graph({ size: 100, script: [json(503, {}), json(503, {}), json(503, {}), json(503, {})] });

    const p = uploadToSession({ file: file(100), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl });
    const assertion = expect(p).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(g.calls).toHaveLength(4);
  });

  it('404: Session abgelaufen, kein Retry', async () => {
    const g = graph({ size: 100, script: [json(404, {})] });

    await expect(uploadToSession({ file: file(100), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl }))
      .rejects.toMatchObject({ name: 'SessionError', status: 404 });
    expect(g.calls).toHaveLength(1);
  });

  it('416: fragt den Stand der Session ab und macht dort weiter', async () => {
    const size = CHUNK * 2;
    const g = graph({ size, script: [json(416, {}), json(200, { nextExpectedRanges: [`${CHUNK}-`] })] });

    await uploadToSession({ file: file(size), uploadUrl: URL_, chunkBytes: CHUNK, fetchImpl: g.fetchImpl });

    expect(g.calls.map(c => c.method)).toEqual(['PUT', 'GET', 'PUT']);
    expect(g.calls[2].range).toBe(`bytes ${CHUNK}-${size - 1}/${size}`);
  });

  it('Abbruch löscht die Session per DELETE', async () => {
    const controller = new AbortController();
    const size = CHUNK * 2;
    const g = graph({ size });
    g.fetchImpl.mockImplementationOnce(async () => {
      controller.abort();
      return json(202, { nextExpectedRanges: [`${CHUNK}-`] });
    });

    await expect(uploadToSession({
      file: file(size), uploadUrl: URL_, chunkBytes: CHUNK, signal: controller.signal, fetchImpl: g.fetchImpl,
    })).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(g.fetchImpl).toHaveBeenLastCalledWith(URL_, { method: 'DELETE', keepalive: true }));
  });

  it('leere Datei wird abgelehnt, ohne Graph zu fragen', async () => {
    const g = graph({ size: 0 });
    await expect(uploadToSession({ file: file(0), uploadUrl: URL_, fetchImpl: g.fetchImpl })).rejects.toThrow('Datei ist leer');
    expect(g.fetchImpl).not.toHaveBeenCalled();
  });
});
