import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verkleinere } from '../modules/auswertung/auswertungBildVerkleinern.js';

const datei = (bytes, name = 'insights.png', type = 'image/png') => new File([new Uint8Array(bytes)], name, { type });

describe('Screenshot vor dem Upload verkleinern', () => {
  let gezeichnet;
  let jpegBytes;
  beforeEach(() => {
    gezeichnet = [];
    jpegBytes = 1000;
    globalThis.createImageBitmap = vi.fn(async () => ({ width: 1170, height: 2532, close: vi.fn() }));
    globalThis.OffscreenCanvas = class {
      constructor(breite, hoehe) { this.width = breite; this.height = hoehe; }
      getContext() { return { fillRect: vi.fn(), drawImage: (...args) => gezeichnet.push(args) }; }
      async convertToBlob({ type }) { return new Blob([new Uint8Array(jpegBytes)], { type }); }
    };
  });
  afterEach(() => {
    delete globalThis.createImageBitmap;
    delete globalThis.OffscreenCanvas;
    vi.restoreAllMocks();
  });

  it('längste Kante 1568 px, JPEG, Name mit .jpg', async () => {
    const neu = await verkleinere(datei(3_000_000));
    expect(neu).toMatchObject({ type: 'image/jpeg', name: 'insights.jpg', size: 1000 });
    expect(gezeichnet[0].slice(3)).toEqual([725, 1568]);
  });

  it('ein kleines, schon kompaktes Bild bleibt das Original', async () => {
    globalThis.createImageBitmap = vi.fn(async () => ({ width: 400, height: 300 }));
    const original = datei(500, 'klein.jpg', 'image/jpeg');
    expect(await verkleinere(original)).toBe(original);
  });

  it('scheitert das Verkleinern, geht das Original bis 3,5 MB, darüber nicht', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('kaputt'); });
    const klein = datei(2_000_000);
    expect(await verkleinere(klein)).toBe(klein);
    await expect(verkleinere(datei(4 * 1024 * 1024))).rejects.toThrow(/zu groß/);
  });
});
