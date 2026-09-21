import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openAnschreiben } from '../core/anschreiben/openAnschreiben.js';

const { open, AnschreibenDrawer } = vi.hoisted(() => {
  const open = vi.fn(async () => {});
  const AnschreibenDrawer = vi.fn(function AnschreibenDrawer() {
    this.open = open;
  });
  return { open, AnschreibenDrawer };
});

vi.mock('../core/anschreiben/AnschreibenDrawer.js', () => ({ AnschreibenDrawer }));

const { createBriefingPdf } = vi.hoisted(() => ({
  createBriefingPdf: vi.fn(async () => ({ blob: new Blob(['%PDF']), dateiname: 'b.pdf' })),
}));
vi.mock('../modules/briefing/BriefingPdf.js', () => ({ createBriefingPdf }));

const { fetchDokumentPdf } = vi.hoisted(() => ({
  fetchDokumentPdf: vi.fn(async () => ({ blob: new Blob(['%PDF']), dateiname: 'v.pdf' })),
}));
vi.mock('../core/anschreiben/fetchDokumentPdf.js', () => ({ fetchDokumentPdf }));

describe('openAnschreiben', () => {
  beforeEach(() => {
    open.mockClear();
    AnschreibenDrawer.mockClear();
    window.isInternal = () => true;
    window.toastSystem = { show: vi.fn() };
  });

  it('oeffnet Briefing-Drawer ueber den zentralen Einstieg', async () => {
    const detail = {
      briefing: {
        is_draft: false,
        aktivierung_name: 'Glow',
        unternehmen_id: 'u1',
        marke_id: 'm1',
      },
    };
    await openAnschreiben({ dokumentTyp: 'briefing', dokumentId: 'b1', detail });
    expect(AnschreibenDrawer).toHaveBeenCalledTimes(1);
    expect(AnschreibenDrawer.mock.calls[0][0]).toMatchObject({
      dokumentTyp: 'briefing',
      dokumentId: 'b1',
      dokumentName: 'Glow',
      unternehmenId: 'u1',
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('oeffnet Vertrag-Drawer mit Prefill Creator', async () => {
    const vertrag = {
      is_draft: false,
      datei_url: 'https://dropbox.com/v.pdf?raw=1',
      name: 'UGC Max',
      kunde_unternehmen_id: 'u1',
      creator: { id: 'c1', vorname: 'Max', nachname: 'M', mail: 'max@x.de' },
    };
    await openAnschreiben({ dokumentTyp: 'vertrag', dokumentId: 'v1', vertrag });
    const opts = AnschreibenDrawer.mock.calls[0][0];
    expect(opts.dokumentTyp).toBe('vertrag');
    expect(opts.prefill).toEqual([
      expect.objectContaining({ id: 'c1', email: 'max@x.de', typ: 'creator' }),
    ]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('lehnt Vertrags-Entwurf ab', async () => {
    await openAnschreiben({
      dokumentTyp: 'vertrag',
      dokumentId: 'v1',
      vertrag: { is_draft: true, datei_url: 'https://x.pdf' },
    });
    expect(AnschreibenDrawer).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalled();
  });

  it('Vertrags-PDF faellt auf Server zurueck wenn Fetch scheitert', async () => {
    fetchDokumentPdf.mockRejectedValueOnce(new Error('CORS'));
    const vertrag = {
      is_draft: false,
      datei_url: 'https://dropbox.com/v.pdf',
      name: 'UGC Max',
      kunde_unternehmen_id: 'u1',
      creator: { id: 'c1', vorname: 'Max', nachname: 'M', mail: 'max@x.de' },
    };
    await openAnschreiben({ dokumentTyp: 'vertrag', dokumentId: 'v1', vertrag });
    const createPdf = AnschreibenDrawer.mock.calls[0][0].createPdf;
    const result = await createPdf();
    expect(result.serverFallback).toBe(true);
    expect(result.dateiname).toMatch(/\.pdf$/);
  });
});
