// BriefingPdf: jsPDF-Text wie die Vertrags-PDFs. Content aus dem
// Briefing, kein CRM-Chrome, kein html2canvas / doc.html().
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/pdf/PdfBrand.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadLikeGroupLogoPng: vi.fn(async () => 'data:image/png;base64,AAA'),
  };
});

import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { createBriefingPdf } from '../modules/briefing/BriefingPdf.js';
import { buildBriefingPdfModel } from '../modules/briefing/BriefingDocView.js';
import { LIKEGROUP_FOOTER_DE, PDF_BRAND } from '../core/pdf/PdfBrand.js';

class MockJsPDF {
  static last = null;
  constructor() {
    this.textCalls = [];
    this.rawTexts = [];
    this.htmlCalls = 0;
    this.images = [];
    this._size = 10;
    MockJsPDF.last = this;
  }
  setFont() {}
  setFontSize(s) { this._size = s; }
  getFontSize() { return this._size; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  setTextColor() {}
  text(t) {
    this.textCalls.push(String(t ?? ''));
    this.rawTexts.push(String(t ?? ''));
  }
  splitTextToSize(text, width) {
    this.rawTexts.push(String(text ?? ''));
    const charsPerLine = Math.max(10, Math.floor(width / 1.7));
    const out = [];
    String(text ?? '').split('\n').forEach((part) => {
      let rest = part;
      while (rest.length > charsPerLine) {
        out.push(rest.slice(0, charsPerLine));
        rest = rest.slice(charsPerLine);
      }
      out.push(rest);
    });
    return out;
  }
  addPage() {}
  addImage(src, type, x, y, w, h) {
    this.images.push({ src, type, x, y, w, h });
  }
  html() {
    this.htmlCalls += 1;
    throw new Error('doc.html darf nicht verwendet werden');
  }
  output() { return new Blob(['%PDF'], { type: 'application/pdf' }); }
}

const THEMA = 'UGC-Kampagne für Coca-Cola Light unter dem Motto This Is My Taste.';
const ROLLE = 'Creator zeigen authentisch, wie Coca-Cola Light in den Alltag passt.';
const TITLE = 'Coca-Cola Light – This Is My Taste 2026';

function makeDetail() {
  const detail = new BriefingDetail();
  detail.briefing = {
    aktivierung_name: TITLE,
    ansatz: 'kampagne',
    bereich: 'paid_creator_ads',
    is_draft: false,
    kampagne_thema: THEMA,
    creator_rolle: ROLLE,
    pa_funnel_stufen: ['upper'],
    pa_videolaengen: ['15s'],
    pa_learnings_vorhanden: true,
    pa_learnings_text: 'Hook in den ersten zwei Sekunden',
    unternehmen: { firmenname: 'Ogilvy' },
    marke: { markenname: 'Coca-Cola' },
    produkte: [{ name: 'Coca-Cola Light' }],
    content_deadline: '2026-09-01',
    go_live: '2026-10-01',
    maerkte: ['deutschland'],
    sprachen: ['deutsch'],
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T12:00:00.000Z',
    assignee: { name: 'Lisa Intern' },
  };
  return detail;
}

describe('createBriefingPdf', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('script').forEach((s) => s.remove());
    window.jspdf = { jsPDF: MockJsPDF };
    window.html2canvas = undefined;
    window.validatorSystem = {
      sanitizeHtml: (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
    };
    MockJsPDF.last = null;
  });

  it('wirft ohne geladenes Briefing', async () => {
    await expect(createBriefingPdf({})).rejects.toThrow('Kein Briefing geladen');
  });

  it('schreibt Titel, Thema und Prosa, nicht die Mitarbeiter-Badges', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild');
    const result = await createBriefingPdf(makeDetail());
    const text = MockJsPDF.last.rawTexts.join('\n');

    expect(result.dateiname).toBe(`${TITLE}.pdf`);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(text).toContain(TITLE);
    expect(text).toContain(THEMA);
    expect(text).toContain(ROLLE);
    expect(text).toContain('Ogilvy');
    expect(text).toContain('Coca-Cola');
    expect(text).toContain('Coca-Cola Light');
    expect(text).toContain('Thema');
    expect(text).toContain('Hook in den ersten zwei Sekunden');
    expect(text).toContain('Upper Funnel');
    expect(text).toContain('15 Sek.');
    expect(text).toContain(LIKEGROUP_FOOTER_DE);
    expect(text).toContain('Seite 1');
    expect(MockJsPDF.last.images[0]).toMatchObject({
      x: PDF_BRAND.logoLeft.x,
      y: PDF_BRAND.logoLeft.y,
    });

    expect(text).not.toContain('Final');
    expect(text).not.toContain('Paid Creator Ads');
    expect(text).not.toMatch(/(^|\n)Kampagne(\n|$)/);
    expect(text).not.toContain('Erstellt');
    expect(text).not.toContain('Aktualisiert');
    expect(text).not.toContain('Lisa Intern');

    expect(MockJsPDF.last.htmlCalls).toBe(0);
    const scriptSrcs = appendSpy.mock.calls
      .map(([el]) => el?.src)
      .filter(Boolean);
    expect(scriptSrcs.some((src) => String(src).includes('html2canvas'))).toBe(false);
    appendSpy.mockRestore();
  });

  it('laesst html2canvas unbenutzt, auch wenn es schon global da ist', async () => {
    window.html2canvas = vi.fn();
    await createBriefingPdf(makeDetail());
    expect(window.html2canvas).not.toHaveBeenCalled();
    expect(MockJsPDF.last.htmlCalls).toBe(0);
  });
});

describe('buildBriefingPdfModel', () => {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
    };
  });

  it('hat keinen CRM-Chrome im Modell', () => {
    const model = buildBriefingPdfModel(makeDetail());
    const dumped = JSON.stringify(model);
    expect(model.title).toBe(TITLE);
    expect(model.subtitle).toBe('Ogilvy · Coca-Cola');
    expect(model.products).toBe('Coca-Cola Light');
    expect(model.sections.some((s) => s.title === 'Thema')).toBe(true);
    expect(dumped).not.toContain('Final');
    expect(dumped).not.toContain('Paid Creator Ads');
    expect(dumped).not.toContain('Erstellt');
    expect(dumped).not.toContain('Lisa Intern');
    expect(dumped).not.toMatch(/"Kampagne"/);
  });
});
