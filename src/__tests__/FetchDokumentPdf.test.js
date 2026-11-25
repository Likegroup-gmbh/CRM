import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDokumentPdf } from '../core/anschreiben/fetchDokumentPdf.js';

vi.mock('../core/DocumentUrlHelper.js', () => ({
  resolveDocumentUrl: vi.fn(async (url) => url),
}));

describe('fetchDokumentPdf', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('laedt Blob und haengt .pdf an', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })));
    const result = await fetchDokumentPdf({ url: 'https://dropbox.com/v?dl=0', dateiname: 'Vertrag Max' });
    expect(result.blob).toBe(blob);
    expect(result.dateiname).toBe('Vertrag Max.pdf');
    expect(fetch).toHaveBeenCalledWith('https://dropbox.com/v?raw=1');
  });

  it('wirft bei HTTP-Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(fetchDokumentPdf({ url: 'https://x.pdf', dateiname: 'x.pdf' }))
      .rejects.toThrow(/404/);
  });
});
