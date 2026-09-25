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

import { loadCustomerLogoPng, toPdfImageDataUrl } from '../modules/briefing/BriefingPdf.js';
import { createSkriptAnhang, creatorFuerAnschreiben } from '../modules/skripte/SkriptPdf.js';
import { PDF_BRAND } from '../core/pdf/PdfBrand.js';

class MockJsPDF {
  static last = null;
  constructor() {
    this.textCalls = [];
    this.images = [];
    this.links = [];
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
  setFillColor() {}
  setLineWidth() {}
  setCharSpace() {}
  line() {}
  rect() {}
  text(value) { this.textCalls.push(String(value ?? '')); }
  getTextWidth(value) { return String(value ?? '').length * 1.6; }
  link(x, y, w, h, options) { this.links.push({ x, y, w, h, url: options?.url }); }
  splitTextToSize(text) { return [String(text ?? '')]; }
  addPage() { this.addPageCount += 1; }
  addImage(src, type, x, y, w, h, alias, compression) {
    this.images.push({ src, type, x, y, w, h, alias, compression });
  }
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
  creator: { name: 'Anna A', bildUrl: 'http://anna', instagram: '@anna' },
  produktName: 'FORCE-FIT',
  customerName: 'VHV',
  customerLogoUrl: 'http://logo',
  videoUrl: 'https://instagram.com/reel/abc',
};

beforeEach(() => {
  window.jspdf = { jsPDF: MockJsPDF };
  MockJsPDF.prototype.addImage = function addImage(src, type, x, y, w, h, alias, compression) {
    this.images.push({ src, type, x, y, w, h, alias, compression });
  };
  loadCustomerLogoPng.mockImplementation(async (url) => (url ? 'data:image/png;base64,CUST' : null));
});

function installRaster({ width, height, dataUrl = 'data:image/jpeg;base64,RASTER' }) {
  const prev = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class OffscreenCanvas {};
  const OriginalImage = globalThis.Image;
  const canvases = [];
  globalThis.Image = class {
    set src(_value) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.onload();
    }
  };
  const create = document.createElement.bind(document);
  const spy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag !== 'canvas') return create(tag);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toDataURL: (type, quality) => {
        canvases.push({ width: canvas.width, height: canvas.height, type, quality });
        return dataUrl;
      },
    };
    return canvas;
  });
  return {
    canvases,
    restore() {
      spy.mockRestore();
      globalThis.Image = OriginalImage;
      if (prev) globalThis.OffscreenCanvas = prev;
      else delete globalThis.OffscreenCanvas;
    },
  };
}

describe('toPdfImageDataUrl', () => {
  it('skaliert auf 256px und liefert JPEG, auch aus PNG', async () => {
    const raster = installRaster({ width: 640, height: 400 });
    try {
      const jpeg = await toPdfImageDataUrl('data:image/png;base64,CUST');
      expect(jpeg).toEqual({
        dataUrl: 'data:image/jpeg;base64,RASTER',
        width: 256,
        height: 160,
      });
      expect(raster.canvases).toEqual([
        { width: 256, height: 160, type: 'image/jpeg', quality: 0.85 },
      ]);
    } finally {
      raster.restore();
    }
  });

  it('vergroessert kleine Bilder nicht', async () => {
    const raster = installRaster({ width: 20, height: 20 });
    try {
      await toPdfImageDataUrl('data:image/avif;base64,AAAA');
      expect(raster.canvases[0]).toMatchObject({ width: 20, height: 20, type: 'image/jpeg' });
    } finally {
      raster.restore();
    }
  });

  it('laesst ohne Canvas alles weg', async () => {
    const prev = globalThis.OffscreenCanvas;
    delete globalThis.OffscreenCanvas;
    try {
      expect(await toPdfImageDataUrl('data:image/png;base64,CUST')).toBeNull();
      expect(await toPdfImageDataUrl('data:image/avif;base64,AAAA')).toBeNull();
      expect(await toPdfImageDataUrl('')).toBeNull();
    } finally {
      if (prev) globalThis.OffscreenCanvas = prev;
    }
  });
});

describe('creatorFuerAnschreiben', () => {
  it('nimmt den Creator der Verknuepfung, Bild vor Thumb', () => {
    const creator = creatorFuerAnschreiben({ titel: 'X' }, [
      { position: 2, kooperation: { creator: { vorname: 'Zed', nachname: 'Z', profilbild_url: 'http://zed' } } },
      { position: 1, kooperation: { creator: { vorname: 'Anna', nachname: 'A', profilbild_url: 'http://anna', profilbild_thumb_url: 'http://thumb', instagram: '@anna' } } },
    ]);
    expect(creator).toEqual({ name: 'Anna A', bildUrl: 'http://anna', instagram: '@anna' });
  });

  it('faellt auf den Creator der Videoidee zurueck', () => {
    const creator = creatorFuerAnschreiben({
      strategie_item: {
        casting_eintrag: {
          creator: { vorname: 'Bea', nachname: 'B', profilbild_thumb_url: 'http://bea', instagram: 'https://instagram.com/bea/' },
        },
      },
    }, []);
    expect(creator).toEqual({
      name: 'Bea B',
      bildUrl: 'http://bea',
      instagram: 'https://instagram.com/bea/',
    });
  });

  it('nimmt Instagram aus der Casting-Liste, auch ohne CRM-Creator', () => {
    const creator = creatorFuerAnschreiben({
      strategie_item: {
        casting_eintrag: {
          name: 'Jolina',
          link_instagram: 'https://www.instagram.com/jolina/',
        },
      },
    }, []);
    expect(creator).toEqual({
      name: 'Jolina',
      bildUrl: '',
      instagram: 'https://www.instagram.com/jolina/',
    });
  });

  it('Casting-Instagram schlaegt den Handle am Creator', () => {
    const creator = creatorFuerAnschreiben({
      strategie_item: {
        casting_eintrag: { link_instagram: 'https://instagram.com/casting' },
      },
    }, [
      { position: 1, kooperation: { creator: { vorname: 'Anna', nachname: 'A', profilbild_url: 'http://anna', instagram: '@anna' } } },
    ]);
    expect(creator.name).toBe('Anna A');
    expect(creator.instagram).toBe('https://instagram.com/casting');
  });

  it('beschriftet die Plattform, nicht die Account-URL', async () => {
    await createSkriptAnhang([{
      titel: 'X',
      creator: { name: 'Jolina' },
      instagram: 'https://www.instagram.com/jolina/',
      tiktok: 'https://www.tiktok.com/@jolina',
      videoUrl: 'https://example.com/reel',
    }]);
    const doc = MockJsPDF.last;
    expect(doc.textCalls).toEqual(expect.arrayContaining(['Instagram', 'TikTok', 'Beispiel-Video']));
    expect(doc.textCalls.join(' ')).not.toContain('jolina');
    expect(doc.links.map((link) => link.url)).toEqual(expect.arrayContaining([
      'https://instagram.com/jolina',
      'https://www.tiktok.com/@jolina',
      'https://example.com/reel',
    ]));

    await createSkriptAnhang([{
      titel: 'Y',
      creator: { name: 'Jolina' },
      instagram: 'https://linktr.ee/jolina',
    }]);
    expect(MockJsPDF.last.textCalls).toContain('Social Media');
    expect(MockJsPDF.last.links.map((link) => link.url)).toContain('https://linktr.ee/jolina');
  });

  it('ohne Verknuepfung null', () => {
    expect(creatorFuerAnschreiben({ titel: 'X' }, [])).toBeNull();
  });
});

describe('createSkriptAnhang', () => {
  it('zeichnet Tabelle, Lockup und genau ein Creator-Bild als JPEG', async () => {
    const raster = installRaster({ width: 640, height: 640 });
    try {
      const result = await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
      expect(result.dateiname).toBe('Eins.pdf');
      expect(result.blob).toBeInstanceOf(Blob);
      const doc = MockJsPDF.last;
      expect(doc.textCalls).toEqual(expect.arrayContaining([
        '×', 'VHV FORCE-FIT × Anna A –', '„Eins“', 'CREATOR', 'Anna A',
        'Instagram', 'Beispiel-Video', 'WAS GESAGT WIRD', 'WAS ZU SEHEN IST',
        'HOOK', 'HAUPTTEIL', 'CTA', 'Erster Satz', 'Close-up',
      ]));
      expect(doc.textCalls).not.toContain('GEHEIM');
      const creatorImages = doc.images.filter((img) => img.w === 12 && img.h === 12);
      expect(creatorImages).toEqual([
        expect.objectContaining({
          src: 'data:image/jpeg;base64,RASTER',
          type: 'JPEG',
          compression: 'FAST',
        }),
      ]);
      const like = doc.images.find((img) => img.x === PDF_BRAND.logoLeft.x);
      const slotW = PDF_BRAND.logoLeft.w * 0.85;
      const slotH = PDF_BRAND.logoLeft.h * 0.85;
      expect(like.w).toBeCloseTo(slotW);
      expect(like.h).toBeCloseTo(slotW * (66 / 120));
      expect(like.w / like.h).toBeCloseTo(120 / 66);
      const customer = doc.images.find((img) => img.type === 'JPEG' && img.h !== 12);
      expect(customer).toMatchObject({
        src: 'data:image/jpeg;base64,RASTER',
        type: 'JPEG',
        compression: 'FAST',
      });
      expect(customer.w).toBeCloseTo(customer.h);
      expect(customer.h).toBeCloseTo(slotH);
      expect(customer.x).toBeGreaterThan(like.x + like.w + 6);
      expect(doc.textCalls).not.toContain('https://instagram.com/reel/abc');
      expect(doc.textCalls).not.toContain('instagram.com/anna');
      expect(doc.links).toEqual([
        expect.objectContaining({ url: 'https://instagram.com/anna' }),
        expect.objectContaining({ url: 'https://instagram.com/reel/abc' }),
      ]);
      expect(raster.canvases.every((c) => c.width <= 256 && c.height <= 256)).toBe(true);
      expect(doc.addPageCount).toBe(0);
    } finally {
      raster.restore();
    }
  });

  it('zeichnet AVIF als JPEG, wenn Canvas da ist', async () => {
    const raster = installRaster({ width: 20, height: 20 });
    loadCustomerLogoPng.mockImplementation(async (url) => (
      String(url).includes('anna') ? 'data:image/avif;base64,AAAA' : 'data:image/png;base64,CUST'
    ));
    try {
      await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
      const creatorImages = MockJsPDF.last.images.filter((img) => img.w === 12);
      expect(creatorImages).toEqual([
        expect.objectContaining({ src: 'data:image/jpeg;base64,RASTER', type: 'JPEG', compression: 'FAST' }),
      ]);
      expect(MockJsPDF.last.textCalls).toContain('Anna A');
    } finally {
      raster.restore();
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
      expect(MockJsPDF.last.images.filter((img) => img.w === 12)).toHaveLength(0);
    } finally {
      if (prev) globalThis.OffscreenCanvas = prev;
    }
  });

  it('kaputtes Bild kippt das PDF nicht', async () => {
    const raster = installRaster({ width: 20, height: 20, dataUrl: 'data:image/jpeg;base64,BROKEN' });
    loadCustomerLogoPng.mockImplementation(async (url) => (
      String(url).includes('anna') ? 'data:image/png;base64,BROKEN' : 'data:image/png;base64,CUST'
    ));
    MockJsPDF.prototype.addImage = function addImage(src, type, x, y, w, h, alias, compression) {
      if (w === 12) throw new Error('Incomplete or corrupt PNG file');
      this.images.push({ src, type, x, y, w, h, alias, compression });
    };
    try {
      const result = await createSkriptAnhang([ANNA], { dateiname: 'Eins.pdf' });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(MockJsPDF.last.textCalls).toContain('Anna A');
      expect(MockJsPDF.last.images.filter((img) => img.w === 12)).toHaveLength(0);
    } finally {
      raster.restore();
    }
  });

  it('filtert Emoji und kombinierende Umlaute, laesst WinAnsi-Satzzeichen stehen', async () => {
    await createSkriptAnhang([{
      titel: 'Plus',
      hook: 'za\u0308hlt \u{1F600} und (2\u{1F464} 3\u{1F464} 4\u{1F464} 5)',
      hook_visuell: '\u201ENetz\u201C \u2013 bleibt',
      hauptteil: '',
      cta: '',
      hauptteil_visuell: '',
      cta_visuell: '',
      creator: { name: 'Ann_a \u{1F600}' },
    }], { dateiname: 'Plus.pdf' });
    const joined = MockJsPDF.last.textCalls.join('\n');
    expect(joined).toContain('zählt und (2 3 4 5)');
    expect(joined).toContain('\u201ENetz\u201C \u2013 bleibt');
    expect(joined).toContain('Ann_a');
    expect(joined).not.toMatch(/\p{Extended_Pictographic}/u);
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
    expect(doc.textCalls).toEqual(expect.arrayContaining(['„Leer“', 'HOOK', 'HAUPTTEIL', 'CTA']));
    expect(doc.textCalls).not.toContain('SKRIPT');
    expect(doc.textCalls).not.toContain('Beispiel-Video');
    expect(doc.textCalls).not.toContain('Anna A');
    expect(doc.textCalls).not.toContain('CREATOR');
    expect(doc.links).toEqual([]);
    expect(doc.images.filter((img) => img.w === 12)).toHaveLength(0);
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
