// BriefingDetail._openAnschreiben: Flush vor Drawer, bei Flush-Fehler kein PDF.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { open, AnschreibenDrawer, createBriefingPdf } = vi.hoisted(() => {
  const open = vi.fn();
  const AnschreibenDrawer = vi.fn(function AnschreibenDrawer() {
    this.open = open;
  });
  const createBriefingPdf = vi.fn(async () => ({
    blob: new Blob(['%PDF'], { type: 'application/pdf' }),
    dateiname: 'Glow Up.pdf',
  }));
  return { open, AnschreibenDrawer, createBriefingPdf };
});

vi.mock('../core/anschreiben/AnschreibenDrawer.js', () => ({ AnschreibenDrawer }));
vi.mock('../modules/briefing/BriefingPdf.js', () => ({ createBriefingPdf }));

import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';

function makeDetail({ flush } = {}) {
  const detail = new BriefingDetail();
  detail.briefingId = 'b1';
  detail.briefing = {
    id: 'b1',
    is_draft: false,
    aktivierung_name: 'Glow Up',
    unternehmen_id: 'u1',
    marke_id: 'm1',
  };
  detail._docHandle = {
    inlineEdit: { flush: flush || vi.fn(async () => {}) },
  };
  return detail;
}

describe('BriefingDetail._openAnschreiben', () => {
  beforeEach(() => {
    open.mockReset();
    AnschreibenDrawer.mockClear();
    createBriefingPdf.mockClear();
    window.isInternal = () => true;
    window.toastSystem = { show: vi.fn() };
  });

  it('flushed InlineEdit bevor der Drawer oeffnet', async () => {
    const order = [];
    const flush = vi.fn(async () => { order.push('flush'); });
    open.mockImplementation(() => { order.push('open'); });
    const detail = makeDetail({ flush });

    await detail._openAnschreiben();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(AnschreibenDrawer).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['flush', 'open']);
  });

  it('oeffnet den Drawer nicht wenn Flush fehlschlaegt', async () => {
    const flush = vi.fn(async () => { throw new Error('save fail'); });
    const detail = makeDetail({ flush });

    await detail._openAnschreiben();

    expect(AnschreibenDrawer).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Änderungen konnten nicht gespeichert werden',
      'error'
    );
  });

  it('oeffnet ohne Handle (kein offenes InlineEdit)', async () => {
    const detail = makeDetail();
    detail._docHandle = null;

    await detail._openAnschreiben();

    expect(AnschreibenDrawer).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
