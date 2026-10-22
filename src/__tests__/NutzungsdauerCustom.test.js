import { describe, expect, it, vi, beforeAll } from 'vitest';
import { buildNutzungsrechte } from '../core/NutzungsrechteFormatter.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/types/InfluencerContract.js';
import '../modules/vertrag/create/types/UgcContract.js';
import '../modules/vertrag/create/ContractTranslations.js';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

class MockJsPDF {
  static instances = [];
  constructor() {
    this.rawTexts = [];
    MockJsPDF.instances.push(this);
  }
  setFont() {}
  setFontSize() {}
  getFontSize() { return 10; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  getTextWidth(t) { return String(t ?? '').length * 1.7; }
  setTextColor() {}
  setDrawColor() {}
  text(t) { this.rawTexts.push(String(t)); }
  splitTextToSize(text) { return [String(text ?? '')]; }
  addPage() {}
  addImage() {}
  line() {}
  rect() {}
  output() { return new Blob(['pdf']); }
  save() {}
}

import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/pdf/InfluencerPdf.js';
import '../modules/vertrag/create/pdf/UgcPdf.js';

function wizard(formData) {
  const inst = new VertraegeCreate();
  inst.formData = formData;
  inst.unternehmen = [{ id: 'u-1', firmenname: 'Muster GmbH' }];
  inst.creators = [{ id: 'c-1', vorname: 'Anna', nachname: 'Creator' }];
  return inst;
}

function dauerOptionen(html) {
  const select = html.match(/id="nutzungsdauer_custom_einheit"[\s\S]*?<\/select>/)?.[0] || '';
  return [...select.matchAll(/<option value="([^"]*)"([^>]*)>([^<]+)/g)].map((m) => ({
    value: m[1],
    selected: m[2].includes('selected'),
    label: m[3]
  }));
}

describe('individuelle Nutzungsdauer', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  it('bietet im Influencer- und UGC-Wizard Jahre, Monate, Wochen und Tage', () => {
    for (const html of [
      wizard({ nutzungsdauer: 'individuell', nutzungsdauer_custom_einheit: 'wochen', nutzungsdauer_custom_wert: 6 }).renderInfluencerStep4(),
      wizard({ nutzungsdauer: 'individuell', nutzungsdauer_custom_einheit: 'tage', nutzungsdauer_custom_wert: 14 }).renderStep4()
    ]) {
      expect(html).toMatch(/class="form-field\s*" id="nutzungsdauer-custom-wrapper"/);
      const optionen = dauerOptionen(html);
      expect(optionen.map((o) => o.label)).toEqual(['Jahre', 'Monate', 'Wochen', 'Tage']);
    }

    const influencer = dauerOptionen(wizard({
      nutzungsdauer: 'individuell',
      nutzungsdauer_custom_einheit: 'wochen'
    }).renderInfluencerStep4());
    expect(influencer.find((o) => o.value === 'wochen').selected).toBe(true);
    expect(influencer.find((o) => o.value === 'monate').selected).toBe(false);

    const ugc = dauerOptionen(wizard({
      nutzungsdauer: 'individuell',
      nutzungsdauer_custom_einheit: 'tage'
    }).renderStep4());
    expect(ugc.find((o) => o.value === 'tage').selected).toBe(true);
  });

  it('schreibt Wochen und Tage in den Vertrag und ins Nutzungsrechte-Modal', async () => {
    const inst = wizard({});
    const vertrag = {
      id: 'v-1',
      typ: 'Influencer Kooperation',
      name: 'Testvertrag',
      kunde_unternehmen_id: 'u-1',
      creator_id: 'c-1',
      nutzungsdauer: 'individuell',
      nutzungsdauer_custom_wert: 6,
      nutzungsdauer_custom_einheit: 'wochen'
    };

    MockJsPDF.instances = [];
    await inst.generateInfluencerPDF(vertrag, 'de');
    expect(MockJsPDF.instances[0].rawTexts.join('\n')).toContain('Nutzungsdauer: 6 Wochen');

    MockJsPDF.instances = [];
    await inst.generateInfluencerPDF({ ...vertrag, vertragssprache: 'en', nutzungsdauer_custom_wert: 14, nutzungsdauer_custom_einheit: 'tage' }, 'en');
    expect(MockJsPDF.instances[0].rawTexts.join('\n')).toContain('Usage period: 14 days');

    MockJsPDF.instances = [];
    await inst.generatePDF({ ...vertrag, typ: 'UGC', nutzungsdauer_custom_wert: 8, nutzungsdauer_custom_einheit: 'wochen' });
    expect(MockJsPDF.instances[0].rawTexts.join('\n')).toContain('8 Wochen');

    const { sections } = buildNutzungsrechte(vertrag);
    const dauer = sections.flatMap((s) => s.items).find((item) => item.label === 'Nutzungsdauer');
    expect(dauer.value).toBe('6 Wochen');
  });

  it('lässt Jahre und Monate unverändert und übersetzt die Einheit im englischen Vertrag', () => {
    const inst = wizard({});
    expect(inst.localizeContractText('Nutzungsdauer: 2 Jahre', 'en')).toBe('Usage period: 2 years');
    expect(inst.localizeContractText('3 Monate', 'en')).toBe('3 months');
    expect(inst.localizeContractText('innerhalb von 5 Werktagen', 'en')).toBe('innerhalb von 5 Werktagen');
  });
});
