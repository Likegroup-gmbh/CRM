import { describe, it, expect, vi } from 'vitest';
import { ablageCascade } from '../core/VideoDeleteHelper.js';

function createTrackingFetch(antwort = {}) {
  const log = [];
  const fn = vi.fn(async (url, opts) => {
    log.push({ url, body: JSON.parse(opts.body) });
    return { ok: antwort.ok ?? true, status: antwort.status ?? 200, json: async () => antwort.json ?? { fehler: [] } };
  });
  fn._log = log;
  return fn;
}

describe('ablageCascade', () => {
  it.each(['unternehmen', 'kampagne', 'kooperation', 'video', 'spalte'])('ruft ablage-loeschen für %s', async (entity) => {
    const ft = createTrackingFetch();
    const result = await ablageCascade(entity, 'id-1', { fetch: ft });
    expect(ft._log).toEqual([{ url: '/.netlify/functions/ablage-loeschen', body: { entity, id: 'id-1' } }]);
    expect(result).toEqual({ success: true, fehler: [] });
  });

  it('meldet Teilfehler des Servers, ohne zu werfen', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ft = createTrackingFetch({ json: { fehler: [{ item: 'x', fehler: 'locked' }] } });
    const result = await ablageCascade('kampagne', 'k-1', { fetch: ft });
    expect(result).toEqual({ success: false, fehler: [{ item: 'x', fehler: 'locked' }] });
    warn.mockRestore();
  });

  it('HTTP- und Netzwerkfehler werden zum Ergebnis, nicht zur Exception', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const http = await ablageCascade('kampagne', 'k-1', { fetch: createTrackingFetch({ ok: false, status: 502, json: { error: 'Graph down' } }) });
    expect(http).toEqual({ success: false, fehler: ['Graph down'] });
    const netz = await ablageCascade('kampagne', 'k-1', { fetch: vi.fn(async () => { throw new Error('Network down'); }) });
    expect(netz).toEqual({ success: false, fehler: ['Network down'] });
    error.mockRestore();
  });
});
