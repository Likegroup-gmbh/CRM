import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/pdf/PdfBrand.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadLikeGroupLogoPng: vi.fn(async () => 'data:image/png;base64,LOGO') };
});

vi.mock('../modules/briefing/BriefingPdf.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadCustomerLogoPng: vi.fn(async (url) => (url ? 'data:image/png;base64,CUST' : null)),
  };
});

import { loadCustomerLogoPng } from '../modules/briefing/BriefingPdf.js';
import { createSkriptAnhang, creatorFuerAnschreiben, toPngDataUrl } from '../modules/skripte/SkriptPdf.js';

class MockJsPDF {
  static last = null;
  constructor() {
    this.textCalls = [];
    this.images = [];
    this.addPageCount = 0;
    this._size = 10;
    MockJsPDF.last = this;
  }
  setFont() {}
  setFontSize(size) { this._size = size; }
  getFontSize() { return this._size; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  setTextColor() {}
  setDrawColor() {}
  rect() {}
  text(value) { this.textCalls.push(String(value ?? '')); }
  splitTextToSize(text) { return [String(text ?? '')]; }
  addPage() { this.addPageCount += 1; }
  addImage(src, type, x, y, w, h) { this.images.push({ src, type, x, y, w, h }); }
  output() { return new Blob(['%PDF'], { type: 'application/pdf' }); }
}

const ANNA = {
  titel: 'Eins',
  hook: 'Erster Satz',
  hauptteil: '',
  cta: 'Kauf',
  hook_visuell: 'Close-up',
  hauptteil_visuell: '',
  cta_visuell: '',
  hook_variante_1: 'GEHEIM',
  creator: { name: 'Anna A', bildUrl: 'http://anna' },
  customerName: 'VHV',
  customerLogoUrl: 'http://logo',
};

beforeEach(() => {
  window.jspdf = { jsPDF: MockJsPDF };
  MockJsPDF.prototype.addImage = function addImage(src, type, x, y, w, h) {
    this.images.push({ src, type, x, y, w, h });
  };
  loadCustomerLogoPng.mockImplementation(async (url) => (url ? 'data:image/png;base64,CUST' : null));
});

describe('toPngDataUrl', () => {
  it('gibt ohne Canvas nur PNG durch', async () => {
    const prev = globalThis.OffscreenCanvas;
    delete globalThis.OffscreenCanvas;
    try {
      expect(await toPngDataUrl('data:image/png;base64,CUST')).toBe('data:image/png;base64,CUST');
      expect(await toPngDataUrl('data:image/avif;base64,AAAA')).toBeNull();
      expect(await toPngDataUrl('')).toBeNull();
    } finally {
      if (prev) globalThis.OffscreenCanvas = prev;
    }
  });
});

describe('creatorFuerAnschreiben', () => {
  it('nimmt den Creator der Verknuepfung, Bild vor Thumb', () => {
    const creator = creatorFuerAnschreiben({ titel: 'X' }, [
      { position: 2, kooperation: { creator: { vorname: 'Zed', nachname: 'Z', profilbild_url: 'http://zed' } } },
      { position: 1, kooperation: { creator: { vorname: 'Anna', nachname: 'A', profilbild_url: 'http://anna', profilbild_thumb_url: 'http://thumb' } } },
    ]);
    expect(creator).toEqual({ name: 'Anna A', bildUrl: 'http://anna' });
  });

  it('faellt auf den Creator der Videoidee zurueck', () => {
    const creator = creatorFuerAnschreiben({
      strategie_item: {
        casting_eintrag: {
          creator: { vorname: 'Bea', nachname: 'B', profilbild_thumb_url: 'http://bea' },
        },
      },
    }, []);
    expect(creator).toEqual({ name: 'Bea B', bildUrl: 'http://bea' });
  });

  it('ohne Verknuepfung null', () => {
    expect(creatorFuerAnschreiben({ titel: 'X' }, [])).toBeNull();
  });
});

describe('createSkriptAnhang', () => {
  it('zeichnet Tabelle, Lockup und genau ein Creator-Bild', async () => {
    const result = await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
    expect(result.dateiname).toBe('Eins.pdf');
    expect(result.blob).toBeInstanceOf(Blob);
    const doc = MockJsPDF.last;
    expect(doc.textCalls).toEqual(expect.arrayContaining([
      '×', 'Anna A', 'Eins', 'Was gesagt wird', 'Was zu sehen ist', 'Hook', 'Hauptteil', 'CTA', 'Erster Satz', 'Close-up',
    ]));
    expect(doc.textCalls).not.toContain('GEHEIM');
    const creatorImages = doc.images.filter((img) => img.w === 18 && img.h === 18);
    expect(creatorImages).toHaveLength(1);
    expect(creatorImages[0].type).toBe('PNG');
    expect(doc.addPageCount).toBe(0);
  });

  it('zeichnet AVIF als PNG, wenn Canvas da ist', async () => {
    const prev = globalThis.OffscreenCanvas;
    globalThis.OffscreenCanvas = class OffscreenCanvas {};
    const OriginalImage = globalThis.Image;
    globalThis.Image = class {
      set src(_value) {
        this.naturalWidth = 20;
        this.naturalHeight = 20;
        this.onload();
      }
    };
    const create = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag !== 'canvas') return create(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {} }),
        toDataURL: () => 'data:image/png;base64,RASTER',
      };
    });
    loadCustomerLogoPng.mockImplementation(async (url) => (
      String(url).includes('anna') ? 'data:image/avif;base64,AAAA' : 'data:image/png;base64,CUST'
    ));
    try {
      await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
      const creatorImages = MockJsPDF.last.images.filter((img) => img.w === 18);
      expect(creatorImages).toEqual([
        expect.objectContaining({ src: 'data:image/png;base64,RASTER', type: 'PNG' }),
      ]);
      expect(MockJsPDF.last.textCalls).toContain('Anna A');
    } finally {
      spy.mockRestore();
      globalThis.Image = OriginalImage;
      if (prev) globalThis.OffscreenCanvas = prev;
      else delete globalThis.OffscreenCanvas;
    }
  });

  it('laesst AVIF weg, wenn kein Canvas da ist, das PDF bleibt', async () => {
    const prev = globalThis.OffscreenCanvas;
    delete globalThis.OffscreenCanvas;
    loadCustomerLogoPng.mockImplementation(async (url) => (
      String(url).includes('anna') ? 'data:image/avif;base64,AAAA' : 'data:image/png;base64,CUST'
    ));
    try {
      const result = await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(MockJsPDF.last.textCalls).toContain('Anna A');
      expect(MockJsPDF.last.images.filter((img) => img.w === 18)).toHaveLength(0);
    } finally {
      if (prev) globalThis.OffscreenCanvas = prev;
    }
  });

  it('kaputtes PNG kippt das PDF nicht', async () => {
    loadCustomerLogoPng.mockImplementation(async (url) => (
      String(url).includes('anna') ? 'data:image/png;base64,BROKEN' : 'data:image/png;base64,CUST'
    ));
    MockJsPDF.prototype.addImage = function addImage(src, type, x, y, w, h) {
      if (String(src).includes('BROKEN')) throw new Error('Incomplete or corrupt PNG file');
      this.images.push({ src, type, x, y, w, h });
    };
    const result = await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(MockJsPDF.last.textCalls).toContain('Anna A');
    expect(MockJsPDF.last.images.filter((img) => img.w === 18)).toHaveLength(0);
  });

  it('laesst die Creator-Zeile weg, leere Felder bleiben leer', async () => {
    await createSkriptAnhang([{
      titel: 'Leer',
      hook: '',
      hauptteil: '',
      cta: '',
      hook_visuell: '',
      hauptteil_visuell: '',
      cta_visuell: '',
      creator: null,
    }], { dateiname: 'Leer.pdf' });
    const doc = MockJsPDF.last;
    expect(doc.textCalls).toEqual(expect.arrayContaining(['Hook', 'Hauptteil', 'CTA']));
    expect(doc.textCalls).not.toContain('Anna A');
    expect(doc.images.filter((img) => img.w === 18)).toHaveLength(0);
  });

  it('Sammel-PDF bricht pro Skript um', async () => {
    const result = await createSkriptAnhang([
      ANNA,
      { ...ANNA, titel: 'Zwei', creator: { name: 'Bea B', bildUrl: 'http://bea' }, hook: 'Zweiter' },
    ], { dateiname: 'Skripte Sommer.pdf' });
    expect(result.dateiname).toBe('Skripte Sommer.pdf');
    expect(result.pdfs).toBeUndefined();
    expect(MockJsPDF.last.addPageCount).toBe(1);
    expect(MockJsPDF.last.textCalls).toEqual(expect.arrayContaining(['Anna A', 'Bea B', 'Zweiter']));
  });

  it('eine PDF pro Skript', async () => {
    const result = await createSkriptAnhang([
      { ...ANNA, titel: 'Eins' },
      { ...ANNA, titel: 'Zwei' },
    ], { proSkript: true });
    expect(result.pdfs.map((pdf) => pdf.dateiname)).toEqual(['Eins.pdf', 'Zwei.pdf']);
    expect(result.pdfs[0].blob).toBeInstanceOf(Blob);
  });
});
