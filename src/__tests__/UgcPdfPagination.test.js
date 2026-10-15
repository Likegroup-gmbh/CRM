// UgcPdf: Paragraphen dürfen nicht in die Fußzeile laufen.
// Reicht der Platz nicht, springt der Block geschlossen auf die nächste Seite.

import { vi } from 'vitest';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

class MockJsPDF {
  static instances = [];
  constructor() {
    this.entries = [];
    this.page = 1;
    this._size = 10;
    MockJsPDF.instances.push(this);
  }
  setFont() {}
  setFontSize(s) { this._size = s; }
  getFontSize() { return this._size; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  getTextWidth(t) { return String(t ?? '').length * 1.7; }
  setTextColor() {}
  setDrawColor() {}
  text(t, _x, y) {
    this.entries.push({ text: String(t), y, page: this.page });
  }
  splitTextToSize(text, width) {
    const charsPerLine = Math.max(10, Math.floor(width / 1.7));
    const out = [];
    String(text ?? '').split('\n').forEach(part => {
      let rest = part;
      if (rest.length === 0) { out.push(''); return; }
      while (rest.length > charsPerLine) {
        out.push(rest.slice(0, charsPerLine));
        rest = rest.slice(charsPerLine);
      }
      out.push(rest);
    });
    return out;
  }
  addPage() { this.page += 1; }
  addImage() {}
  line() {}
  rect() {}
  output() { return new Blob(['pdf']); }
  save() {}
}

import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/ContractTranslations.js';
import '../modules/vertrag/create/pdf/UgcPdf.js';

const MAX_CONTENT_Y = 250;

const SECTION_51_LINES = [
  '§5 Vergütung',
  '5.1 Vergütung',
  'Fixvergütung: 550,00 € netto',
  'Die Vergütung versteht sich zzgl. gesetzlicher Umsatzsteuer, sofern diese anfällt.',
  'Zusatzkosten vereinbart',
  'Keine Zusatzkosten'
];

function makeInstance() {
  const inst = new VertraegeCreate();
  inst.formData = {};
  inst.unternehmen = [{ id: 'u-1', firmenname: 'hama GmbH' }];
  inst.creators = [{ id: 'c-1', vorname: 'Alisa', nachname: 'Spitz' }];
  return inst;
}

function baseVertrag(extra = {}) {
  return {
    id: 'v-1',
    typ: 'UGC',
    name: 'hama x Alisa Spitz',
    kunde_unternehmen_id: 'u-1',
    creator_id: 'c-1',
    vertragssprache: 'de',
    verguetung_netto: 550,
    zahlungsziel: '30_tage',
    skonto: false,
    ...extra
  };
}

async function render(vertrag) {
  MockJsPDF.instances = [];
  const inst = makeInstance();
  await inst.generatePDF(vertrag);
  return MockJsPDF.instances[0].entries;
}

function findLine(entries, text) {
  return entries.find(entry => entry.text === text);
}

describe('UGC-PDF Seitenumbruch §5', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  it('lässt §5.1 auf der Seite, wenn der Block noch passt', async () => {
    const entries = await render(baseVertrag());
    const heading = findLine(entries, '§5 Vergütung');
    const section4 = findLine(entries, '§4 Nutzungsrechte');

    expect(heading).toBeTruthy();
    expect(heading.page).toBe(section4.page);
    for (const line of SECTION_51_LINES) {
      const entry = findLine(entries, line);
      expect(entry, line).toBeTruthy();
      expect(entry.y).toBeLessThanOrEqual(MAX_CONTENT_Y);
      expect(entry.page).toBe(heading.page);
    }
  });

  it('springt mit §5.1 geschlossen um, wenn der Block nicht mehr passt', async () => {
    // 8 kurze Zeilen füllen den Rest von Seite 2 bis MAX_CONTENT_Y.
    // Ohne ensureSpace läge die Fixvergütung danach in der Fußzeile.
    const zusatz = Array.from({ length: 8 }, (_, i) => `Zusatzzeile ${i + 1} zum Nutzungsrecht.`).join('\n');
    const entries = await render(baseVertrag({
      paragraph_zusaetze: { p4: zusatz }
    }));

    const heading = findLine(entries, '§5 Vergütung');
    const zusatzLabel = findLine(entries, 'Zusätzliche Bestimmung:');
    expect(heading).toBeTruthy();
    expect(zusatzLabel).toBeTruthy();
    expect(heading.page).toBeGreaterThan(zusatzLabel.page);

    for (const line of SECTION_51_LINES) {
      const entry = findLine(entries, line);
      expect(entry, line).toBeTruthy();
      expect(entry.y).toBeLessThanOrEqual(MAX_CONTENT_Y);
      expect(entry.page).toBe(heading.page);
    }

    const zahlung = findLine(entries, '5.2 Zahlungsbedingungen');
    expect(zahlung.y).toBeLessThanOrEqual(MAX_CONTENT_Y);
    expect(zahlung.page).toBe(heading.page);
  });
});
