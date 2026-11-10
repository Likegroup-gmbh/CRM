import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: (...args) => globalThis.fetch(...args),
  getAccessToken: vi.fn(async () => 'tok'),
  setGuestJwt: vi.fn(),
}));
vi.mock('../core/VideoUploadUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  proxyPost: vi.fn(),
}));

import { downloadMediaAsset } from '../core/media/downloadMediaAsset.js';
import { proxyPost, _resetProxyAvailability } from '../core/VideoUploadUtils.js';
import { _clearMediaSrcCache } from '../core/media/mediaSrc.js';
import { _clearAblageLinkCache } from '../core/ablage/ablageLink.js';

const LINK = 'https://contoso.sharepoint.com/_layouts/15/download.aspx?UniqueId=x&tempauth=t';
const SP = {
  id: 'a1',
  file_path: '/Kampagne/Final 9x16.mp4',
  file_url: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/Final%209x16.mp4',
  ablage: 'sharepoint',
  etag: 'e1',
};

/** fetch-Mock: ablage-link liefert LINK (oder fehlend), der Link selbst eine Datei. */
function mockFetch({ fehlend = false, blobOk = true } = {}) {
  const fn = vi.fn(async (url) => {
    if (url === '/.netlify/functions/ablage-link') {
      const links = fehlend ? {} : { a1: { url: LINK, laeuft_ab: new Date(Date.now() + 3600_000).toISOString() } };
      return { ok: true, json: async () => ({ links, fehlend: fehlend ? ['a1'] : [] }) };
    }
    if (url === LINK) return blobOk ? { ok: true, blob: async () => new Blob(['mp4']) } : { ok: false, status: 403 };
    throw new Error(`unerwartet: ${url}`);
  });
  globalThis.fetch = fn;
  return fn;
}

describe('downloadMediaAsset', () => {
  let klicks;

  beforeEach(() => {
    _clearMediaSrcCache();
    _clearAblageLinkCache();
    _resetProxyAvailability();
    vi.mocked(proxyPost).mockReset();
    klicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      klicks.push({ href: this.href, download: this.getAttribute('download'), target: this.target });
    });
    URL.createObjectURL = vi.fn(() => 'blob:datei');
    URL.revokeObjectURL = vi.fn();
    window.toastSystem = { show: vi.fn() };
  });
  afterEach(() => vi.restoreAllMocks());

  describe('SharePoint', () => {
    it('mit Dateiname: Blob ueber den Lese-Link, Wunschname bleibt', async () => {
      const fetchMock = mockFetch();
      expect(await downloadMediaAsset(SP, 'kunde_final_9_16.mp4', { typ: 'video' })).toBe(true);

      expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/.netlify/functions/ablage-link', LINK]);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ items: [{ typ: 'video', id: 'a1' }] });
      expect(klicks).toEqual([{ href: 'blob:datei', download: 'kunde_final_9_16.mp4', target: '' }]);
      expect(proxyPost).not.toHaveBeenCalled();
    });

    it('ohne Dateiname: oeffnet den Lese-Link direkt (Graph liefert als Attachment)', async () => {
      const fetchMock = mockFetch();
      expect(await downloadMediaAsset(SP, undefined, { typ: 'video' })).toBe(true);

      expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/.netlify/functions/ablage-link']);
      expect(klicks).toEqual([{ href: LINK, download: null, target: '_blank' }]);
      expect(proxyPost).not.toHaveBeenCalled();
    });

    it('Blob scheitert: faellt auf den Lese-Link zurueck, ohne neu anzufragen', async () => {
      const fetchMock = mockFetch({ blobOk: false });
      expect(await downloadMediaAsset(SP, 'x.mp4', { typ: 'video' })).toBe(true);

      expect(fetchMock.mock.calls.filter(c => c[0] === '/.netlify/functions/ablage-link')).toHaveLength(1);
      expect(klicks.at(-1)).toMatchObject({ href: LINK, target: '_blank' });
    });

    it('kein Lese-Link: Fehler-Toast, nie die webUrl und nie Dropbox', async () => {
      mockFetch({ fehlend: true });
      expect(await downloadMediaAsset(SP, 'x.mp4', { typ: 'video' })).toBe(false);

      expect(klicks).toEqual([]);
      expect(proxyPost).not.toHaveBeenCalled();
      expect(window.toastSystem.show).toHaveBeenLastCalledWith('Datei kann nicht heruntergeladen werden.', 'error');
    });

    it('Player-Typ "bild" wird als still angefragt', async () => {
      const fetchMock = mockFetch();
      await downloadMediaAsset({ ...SP, file_path: '/K/b.jpg' }, undefined, { typ: 'bild', silent: true });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).items).toEqual([{ typ: 'still', id: 'a1' }]);
    });
  });

  it('Dropbox unveraendert: frischer Shared-Link mit dl=1', async () => {
    globalThis.fetch = vi.fn();
    vi.mocked(proxyPost).mockResolvedValue({ url: 'https://www.dropbox.com/scl/fi/x/a.mp4?rlkey=k&dl=0' });

    expect(await downloadMediaAsset({ id: 'd1', file_path: '/x/a.mp4', file_url: null }, undefined, { typ: 'video' })).toBe(true);

    expect(proxyPost).toHaveBeenCalledWith({ action: 'shared-link', path: '/x/a.mp4' });
    expect(klicks).toEqual([{ href: 'https://www.dropbox.com/scl/fi/x/a.mp4?rlkey=k&dl=1', download: null, target: '_blank' }]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
