// ProduktPdf: echtes Text-PDF, kein Raster. Mock-Lauf prueft den Inhalt,
// der Lauf mit echtem jsPDF prueft das fertige PDF-Bytes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jsPDF } from 'jspdf';

vi.mock('../core/pdf/PdfBrand.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadLikeGroupLogoPng: vi.fn(async () => 'data:image/png;base64,AAA') };
});

vi.mock('../core/pdf/pdfImage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadCustomerLogoPng: vi.fn(async (url) => (url ? `data:image/png;base64,${url}` : null)),
    toPdfImageDataUrl: vi.fn(async (dataUrl, opts) => (
      dataUrl ? { dataUrl: 'data:image/jpeg;base64,/9j/', width: 400, height: 300, maxEdge: opts?.maxEdge } : null
    )),
  };
});

import { createProduktPdf } from '../modules/produkt/ProduktPdf.js';
import { buildProduktPdfModel } from '../modules/produkt/ProduktPdfModel.js';
import { toPdfImageDataUrl } from '../core/pdf/pdfImage.js';
import { loadLikeGroupLogoPng } from '../core/pdf/PdfBrand.js';

class MockJsPDF {
  static last = null;
  constructor() {
    this.texts = [];
    this.textAt = [];
    this.images = [];
    this.links = [];
    this.rects = 0;
    this.pages = 1;
    this.htmlCalls = 0;
    this._size = 10;
    MockJsPDF.last = this;
  }
  setFont() {}
  setFontSize(s) { this._size = s; }
  getFontSize() { return this._size; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  setTextColor() {}
  setFillColor() {}
  setDrawColor() {}
  setLineWidth() {}
  rect() { this.rects += 1; }
  line() {}
  getTextWidth(t) { return String(t).length * 1.7; }
  link(x, y, w, h, opts) { this.links.push(opts.url); }
  text(t, x, y) {
    this.texts.push(String(t ?? ''));
    this.textAt.push({ t: String(t ?? ''), x, y });
  }
  splitTextToSize(text, width) {
    const perLine = Math.max(10, Math.floor(width / 1.7));
    const out = [];
    String(text ?? '').split('\n').forEach((part) => {
      let rest = part;
      while (rest.length > perLine) {
        out.push(rest.slice(0, perLine));
        rest = rest.slice(perLine);
      }
      out.push(rest);
    });
    return out;
  }
  addPage() { this.pages += 1; }
  addImage(src, type, x, y, w, h) { this.images.push({ src, type, x, y, w, h }); }
  html() {
    this.htmlCalls += 1;
    throw new Error('doc.html darf nicht verwendet werden');
  }
  output() { return new Blob(['%PDF'], { type: 'application/pdf' }); }
}

const SNAPSHOT = {
  name: 'Clear Case Kollektion',
  url: 'https://shop.de/clear',
  kurzbeschreibung: 'Transparente Hülle fürs Handy.',
  usp: 'Stoßfest\nVergilbt nicht',
  loesung: 'Schützt ohne Bulk 😀',
  preis_von: 19.9,
  unternehmen: { firmenname: 'Glow GmbH', logo_url: 'logo.png' },
  marken: [{ markenname: 'Glow', logo_url: 'marke.png' }],
  rechtliche_hinweise: 'Mehr dazu: https://shop.de/recht/sehr/lange/adresse?x=1',
  varianten: [
    { name: 'Sand', farbe: 'Beige', bildUrl: 'v1' },
    { name: 'Nacht', farbe: 'Schwarz', bildUrl: null },
  ],
  useCases: [{ name: 'Morgens', beschreibung: 'Auf dem Weg zur Arbeit' }],
  bilder: [
    { url: 'a', name: 'Produktbild 1', primary: true },
    { url: 'b', name: 'Produktbild 2' },
    { url: 'c', name: 'Produktbild 3' },
    { url: 'd', name: 'Produktbild 4' },
  ],
};

function model(extra = {}) {
  return buildProduktPdfModel({ ...SNAPSHOT, ...extra }, { now: new Date('2026-10-09T10:00:00') });
}

describe('createProduktPdf (Mock)', () => {
  beforeEach(() => {
    window.jspdf = { jsPDF: MockJsPDF };
    MockJsPDF.last = null;
    vi.mocked(toPdfImageDataUrl).mockClear();
  });

  it('wirft ohne Produkt', async () => {
    await expect(createProduktPdf(null)).rejects.toThrow('Kein Produkt zum Exportieren');
  });

  it('schreibt Inhalt als Text, nie ueber doc.html', async () => {
    const result = await createProduktPdf(model());
    const doc = MockJsPDF.last;
    const text = doc.texts.join('\n');

    expect(result.dateiname).toBe('Clear Case Kollektion.pdf');
    expect(result.blob.type).toBe('application/pdf');
    expect(text).toContain('Clear Case Kollektion');
    expect(text).toContain('Glow GmbH');
    expect(text).toContain('Transparente Hülle fürs Handy.');
    expect(text).toContain('• Stoßfest');
    expect(text).toContain('• Vergilbt nicht');
    expect(text).toContain('Morgens');
    expect(text).toContain('Sand');
    expect(text).toContain('Farbe: Beige');
    expect(text).toContain('Seite 1');
    expect(doc.htmlCalls).toBe(0);
  });

  it('entfernt Zeichen, die Helvetica nicht kann', async () => {
    await createProduktPdf(model());
    const text = MockJsPDF.last.texts.join('\n');
    expect(text).toContain('Schützt ohne Bulk');
    expect(text).not.toContain('😀');
  });

  it('zeigt Produkt- und Variantenbilder in Tabellen mit Namen', async () => {
    await createProduktPdf(model());
    const doc = MockJsPDF.last;
    const text = doc.texts.join('\n');

    expect(text).toContain('Produktbilder');
    expect(text).toContain('BILD');
    expect(text).toContain('BEZEICHNUNG');
    expect(text).toContain('Produktbild 1');
    expect(text).toContain('Hauptbild');
    expect(text).toContain('Produktbild 4');
    expect(text).toContain('VARIANTE');
    expect(text).toContain('Nacht');
    expect(doc.rects).toBeGreaterThanOrEqual(2); // je Tabelle eine Kopfzeile, mehr bei Seitenumbruch

    // 4 Produktbilder + 1 Variantenbild + Kundenlogo, alles JPEG
    expect(doc.images.filter(i => i.type === 'JPEG')).toHaveLength(6);
    const kanten = vi.mocked(toPdfImageDataUrl).mock.calls.map(([, opts]) => opts?.maxEdge);
    expect(kanten.filter(k => k === 600)).toHaveLength(5);
  });

  it('haelt jedes Bild in der Zeile seines Namens', async () => {
    await createProduktPdf(model());
    const doc = MockJsPDF.last;
    // images[0] ist das Kundenlogo, danach folgen die vier Produktbilder
    const produktBilder = doc.images.filter(i => i.type === 'JPEG').slice(1, 5);

    ['Produktbild 1', 'Produktbild 2', 'Produktbild 3', 'Produktbild 4'].forEach((name, i) => {
      const label = doc.textAt.find(entry => entry.t === name);
      const bild = produktBilder[i];
      expect(label.y).toBeGreaterThanOrEqual(bild.y);
      expect(label.y).toBeLessThanOrEqual(bild.y + bild.h);
    });
  });

  it('gibt keine komplette URL aus, sondern eine anklickbare Bezeichnung', async () => {
    await createProduktPdf(model());
    const doc = MockJsPDF.last;
    const text = doc.texts.join('\n');

    expect(text).not.toContain('https://');
    expect(text).not.toContain('sehr/lange/adresse');
    expect(text).toContain('Link\u00A0zu\u00A0shop.de');
    expect(doc.links).toEqual([
      'https://shop.de/clear',
      'https://shop.de/recht/sehr/lange/adresse?x=1',
    ]);
  });

  it('bricht auf eine neue Seite mit Fusszeile, wenn der Text lang ist', async () => {
    const lang = Array.from({ length: 200 }, (_, i) => `Eintrag ${i}`).join('\n');
    await createProduktPdf(model({ usp: lang, bilder: [] }));
    const doc = MockJsPDF.last;
    expect(doc.pages).toBeGreaterThan(1);
    expect(doc.texts.join('\n')).toContain(`Seite ${doc.pages}`);
  });
});

describe('createProduktPdf (echtes jsPDF)', () => {
  beforeEach(() => {
    window.jspdf = { jsPDF };
  });

  async function bytesOf(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsBinaryString(blob);
    });
  }

  it('liefert ein PDF mit Text-Operatoren statt eines Seitenbildes', async () => {
    // Ohne Logos und Bilder: die Mock-Bytes oben sind kein gueltiges PNG/JPEG.
    vi.mocked(loadLikeGroupLogoPng).mockResolvedValueOnce(null);
    const { blob } = await createProduktPdf(
      model({ bilder: [], marken: [], unternehmen: { firmenname: 'Glow GmbH' } })
    );
    const raw = await bytesOf(blob);

    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw).toContain('Clear Case Kollektion');
    expect(raw).toContain('Transparente');
    expect(raw).toMatch(/\bTj\b/);
  });

  it('legt Link-Ziele an, ohne die URL in den sichtbaren Text zu schreiben', async () => {
    vi.mocked(loadLikeGroupLogoPng).mockResolvedValueOnce(null);
    const { blob } = await createProduktPdf(
      model({ bilder: [], varianten: [], marken: [], unternehmen: { firmenname: 'Glow GmbH' } })
    );
    const raw = await bytesOf(blob);

    expect(raw).toContain('/URI (https://shop.de/clear)');
    expect(raw).toContain('/URI (https://shop.de/recht/sehr/lange/adresse?x=1)');
    const sichtbar = raw.split('BT').slice(1).map(p => p.split('ET')[0]).join('\n');
    expect(sichtbar).not.toContain('https://');
    expect(sichtbar).toContain('shop.de');
  });
});
