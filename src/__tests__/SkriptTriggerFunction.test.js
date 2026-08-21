// SkriptTriggerFunction.test.js
// triggerFunction haette transienten Gateway-Fehler (502/503/Netz) mit kurzem
// Retry, statt sofort zu werfen: Netlify queued Background-Jobs oft trotz
// Invoke-Fehler, und der atomare Claim serverseitig macht Retries idempotent.
// 4xx (ausser 408/429) und AbortError werden sofort durchgereicht.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkripteService } from '../modules/skripte/SkripteService.js';

const res = (status) => ({ status, ok: status >= 200 && status < 300 });

describe('SkripteService.triggerFunction', () => {
  let service;
  let fetchMock;

  beforeEach(() => {
    window.supabase = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } }))
      }
    };
    service = new SkripteService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('202 sofort: ein Versuch, kein Retry', async () => {
    fetchMock.mockResolvedValue(res(202));

    await service.triggerFunction('skript-fragen-background', { messageId: 'm1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/.netlify/functions/skript-fragen-background');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(opts.body)).toEqual({ messageId: 'm1' });
  });

  it('503 dann 202: Retry, kein Throw', async () => {
    fetchMock.mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(202));

    const p = service.triggerFunction('fn', {});
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Netzwerkfehler (ERR_CONNECTION_RESET) dann 202: Retry, kein Throw', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(res(202));

    const p = service.triggerFunction('fn', {});
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('409 = laeuft bereits: Erfolg ohne Retry', async () => {
    fetchMock.mockResolvedValue(res(409));

    await service.triggerFunction('fn', {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401: sofort Throw, kein Retry, nicht transient', async () => {
    fetchMock.mockResolvedValue(res(401));

    const err = await service.triggerFunction('fn', {}).catch((e) => e);

    expect(err.message).toContain('HTTP 401');
    expect(err.transient).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dauerhaft 503: wirft nach 3 Versuchen mit transient-Flag', async () => {
    fetchMock.mockResolvedValue(res(503));

    const p = service.triggerFunction('fn', {}).then(
      () => { throw new Error('haette werfen muessen'); },
      (err) => err
    );
    await vi.advanceTimersByTimeAsync(3000);
    const err = await p;

    expect(err.message).toContain('HTTP 503');
    expect(err.transient).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('AbortError (Nutzer-Abbruch): sofort durchgereicht, kein Retry', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => {
      controller.abort();
      return Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    });

    const err = await service.triggerFunction('fn', {}, { signal: controller.signal }).catch((e) => e);

    expect(err.name).toBe('AbortError');
    expect(err.transient).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
