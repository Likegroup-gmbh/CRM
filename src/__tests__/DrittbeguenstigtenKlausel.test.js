import { vi } from 'vitest';
import { buildDrittbeguenstigtenKlausel } from '../modules/vertrag/create/pdf/DrittbeguenstigtenKlausel.js';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

class MockJsPDF {
  static instances = [];
  constructor() {
    this.rawTexts = [];
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
  text(t) { this.rawTexts.push(String(t)); }
  splitTextToSize(text, width) {
    this.rawTexts.push(String(text ?? ''));
    const charsPerLine = Math.max(10, Math.floor(width / 1.7));
    const out = [];
    String(text ?? '').split('\n').forEach(part => {
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
  addImage() {}
  line() {}
  rect() {}
  output() { return new Blob(['pdf']); }
  save() {}
}

import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/ContractTranslations.js';
import '../modules/vertrag/create/pdf/InfluencerPdf.js';
import '../modules/vertrag/create/pdf/UgcPdf.js';
import '../modules/vertrag/create/pdf/ModelPdf.js';
import '../modules/vertrag/create/pdf/VideografPdf.js';
import '../modules/vertrag/create/pdf/ContractingPdf.js';

const KUNDE = 'Muster GmbH';
const HAFTUNG_AGENTUR = '§ 7 Haftung der Agentur';

function makeInstance() {
  const inst = new VertraegeCreate();
  inst.formData = {};
  inst.unternehmen = [{ id: 'u-1', firmenname: KUNDE }];
  inst.creators = [{ id: 'c-1', vorname: 'Anna', nachname: 'Creator' }];
  return inst;
}

function baseVertrag(typ) {
  return {
    id: 'v-1',
    typ,
    name: 'Testvertrag',
    kunde_unternehmen_id: 'u-1',
    creator_id: 'c-1',
    vertragssprache: 'de'
  };
}

async function pdfText(generate) {
  MockJsPDF.instances = [];
  const inst = makeInstance();
  await generate(inst);
  return MockJsPDF.instances[0].rawTexts.join('\n');
}

function expectKlausel(all, lang = 'de') {
  if (lang === 'en') {
    expect(all).toContain(`Rights of ${KUNDE} as third-party beneficiary`);
    expect(all).toContain('third-party beneficiary within the meaning of § 328 BGB');
    expect(all).toContain(`In case of doubt, the instruction of ${KUNDE} shall prevail.`);
    expect(all).toContain('The statutory objections of the creator under this contract remain unaffected.');
    expect(all).not.toContain(`Rechte von ${KUNDE} als begünstigte Dritte`);
    return;
  }
  expect(all).toContain(`Rechte von ${KUNDE} als begünstigte Dritte`);
  expect(all).toContain('§ 328 BGB');
  expect(all).toContain(`Im Zweifel geht die Weisung von ${KUNDE} vor.`);
  expect(all).toContain('Die gesetzlichen Einwendungen des Creators aus diesem Vertrag bleiben bestehen.');
}

describe('buildDrittbeguenstigtenKlausel', () => {
  it('DE: Abs. 1, 4 und 5 mit Kundenname, intern 1–3', () => {
    const klausel = buildDrittbeguenstigtenKlausel(KUNDE, 'de');
    expect(klausel.title).toBe(`Rechte von ${KUNDE} als begünstigte Dritte`);
    expect(klausel.paragraphs).toHaveLength(3);
    expect(klausel.paragraphs[0]).toContain('§ 328 BGB');
    expect(klausel.paragraphs[1]).toContain(`Im Zweifel geht die Weisung von ${KUNDE} vor.`);
    expect(klausel.paragraphs[2]).toBe('3. Die gesetzlichen Einwendungen des Creators aus diesem Vertrag bleiben bestehen.');
  });

  it('EN: englischer Wortlaut, leerer Name wird Platzhalter', () => {
    const klausel = buildDrittbeguenstigtenKlausel('  ', 'en');
    expect(klausel.title).toBe(`Rights of ${'_'.repeat(20)} as third-party beneficiary`);
    expect(klausel.paragraphs[0]).toContain('§ 328 BGB');
  });
});

describe('Drittbeguenstigtenklausel in Standard-PDFs', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  it('Influencer DE und EN', async () => {
    const de = await pdfText((inst) => inst.generateInfluencerPDF(baseVertrag('Influencer Kooperation'), 'de'));
    expectKlausel(de);
    expect(de.indexOf(`Rechte von ${KUNDE} als begünstigte Dritte`)).toBeLessThan(de.indexOf('Ort, Datum:'));

    const en = await pdfText((inst) => inst.generateInfluencerPDF({ ...baseVertrag('Influencer Kooperation'), vertragssprache: 'en' }, 'en'));
    expectKlausel(en, 'en');
  });

  it('UGC: Klausel ohne § 7 Haftung der Agentur', async () => {
    const all = await pdfText((inst) => inst.generatePDF(baseVertrag('UGC')));
    expectKlausel(all);
    expect(all).toContain('§7 Rechte Dritter');
    expect(all).not.toContain(HAFTUNG_AGENTUR);
    expect(all).not.toContain('Die Agentur haftet unbeschränkt');
    expect(all.indexOf(`Rechte von ${KUNDE} als begünstigte Dritte`)).toBeLessThan(all.indexOf('Ort, Datum:'));
  });

  it('Model', async () => {
    const all = await pdfText((inst) => inst.generateModelPDF(baseVertrag('Model'), 'de'));
    expectKlausel(all);
    expect(all.indexOf(`Rechte von ${KUNDE} als begünstigte Dritte`)).toBeLessThan(all.indexOf('Ort, Datum:'));
  });

  it('Videograf', async () => {
    const all = await pdfText((inst) => inst.generateVideografPDF(baseVertrag('Videograph'), 'de'));
    expectKlausel(all);
    expect(all.indexOf(`Rechte von ${KUNDE} als begünstigte Dritte`)).toBeLessThan(all.indexOf('Ort, Datum:'));
  });

  it('Contracting: zusaetzlich zum bestehenden § 1 Abs. 3', async () => {
    const all = await pdfText((inst) => inst.generateContractingPDF(baseVertrag('Contracting'), 'de'));
    expectKlausel(all);
    expect(all).toContain(`Das Unternehmen ${KUNDE} erhält jedoch als begünstigter Dritter im Sinne des § 328 BGB die in diesem Vertrag geregelten Nutzungsrechte.`);
    expect(all.indexOf(`Rechte von ${KUNDE} als begünstigte Dritte`)).toBeLessThan(all.indexOf('Unterschrift LikeGroup GmbH'));
  });
});
