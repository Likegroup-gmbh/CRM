// AwarenessPdf.test.js
// Smoke-Test fuer den Direktvertrag (awareness): generiert das PDF headless
// (Mock-jsPDF, Upload gemockt) und prueft die Text-Inhalte gegen die
// Original-Vorlagen (DE_TT / DE_IGR Agreement Awareness 2025).
// Sprachmodell: Deckblatt + Anhang einsprachig (lang), Hauptteil bilingual.

import { vi } from 'vitest';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

// Mock-jsPDF (jsPDF wird in der App per CDN geladen, nicht per npm):
// splitTextToSize bricht bei \n und alle `charsPerLine` Zeichen um.
class MockJsPDF {
  static instances = [];
  constructor() {
    this.textCalls = [];
    this.rawTexts = []; // ungewrappte Original-Strings (fuer Assertions)
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
  text(t) { this.textCalls.push(String(t)); this.rawTexts.push(String(t)); }
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
  line() {}
  rect() {}
  output() { return new Blob(['pdf']); }
  save() {}
}

import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/pdf/AwarenessPdf.js';

function makeInstance() {
  const inst = new VertraegeCreate();
  inst.formData = {};
  inst.unternehmen = [{
    id: 'u-hautica',
    firmenname: 'UAB "Hautica"',
    reg_code: '304140967',
    ust_id: 'LT100010142716',
    vertreten_durch: 'den Geschäftsführer Linas Motiejauskas, handelnd auf der Grundlage des Gesellschaftsvertrags',
    rechnungsadresse_strasse: 'Mosedzio g. 32',
    rechnungsadresse_hausnummer: '',
    rechnungsadresse_plz: 'LT-98289',
    rechnungsadresse_stadt: 'Skuodo r.',
    rechnungsadresse_land: 'Lietuva'
  }];
  inst.creators = [{
    id: 'c-1',
    vorname: 'Lisa',
    nachname: 'Test',
    mail: 'lisa@test.de',
    instagram: '@lisa_ig',
    tiktok: '@lisa_tt',
    lieferadresse_strasse: 'Teststr. 1',
    lieferadresse_plz: '10115',
    lieferadresse_stadt: 'Berlin'
  }];
  inst.kampagnen = [{
    id: 'k-1',
    kampagnenname: 'Awareness Q3',
    unternehmen_id: 'u-hautica',
    marke: { markenname: 'BURGA' }
  }];
  return inst;
}

function makeVertrag(plattformen) {
  return {
    id: 'v-1',
    typ: 'Influencer Kooperation',
    name: 'Testvertrag',
    kunde_unternehmen_id: 'u-hautica',
    kampagne_id: 'k-1',
    creator_id: 'c-1',
    plattformen,
    anzahl_reels: 1,
    anzahl_feed_posts: 0,
    anzahl_storys: 0,
    zahlungsziel: '30_tage',
    verguetung_netto: 500,
    influencer_profile: ['TikTok @lisa_tt', 'Instagram @lisa_ig'],
    awareness_felder: {
      vertrag_datum: '2026-09-07',
      ansprechpartner_email: 'johanna.seidl@burga.com',
      video_mindestlaenge_sekunden: 30,
      veroeffentlichungsfrist: '2026-10-01',
      verguetung_brutto: 500,
      zahlungsmethode: 'banktransfer',
      statistik_frist_tage: 7,
      brand_tag: '@burgaofficial'
    }
  };
}

async function generate(plattformen, lang) {
  MockJsPDF.instances = [];
  const inst = makeInstance();
  await inst.generateAwarenessPDF(makeVertrag(plattformen), lang);
  return MockJsPDF.instances[0].rawTexts.join('\n');
}

describe('AwarenessPdf (Direktvertrag)', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  it('DE: erzeugt bei Instagram + TikTok beide Anhaenge und vollstaendigen Rechtstext', async () => {
    const all = await generate(['instagram', 'tiktok'], 'de');

    // Zwei Anhaenge, einsprachig deutsch
    expect(all).toContain('ANHANG A');
    expect(all).toContain('ANHANG B');
    expect(all).not.toContain('ANNEX A');
    expect(all).toContain('1. Instagram Account: @lisa_ig');
    expect(all).toContain('1. TikTok Account: @lisa_tt');
    expect(all).toContain('1 Instagram-Reel(s)');
    expect(all).toContain('1 TikTok Video(s)');
    expect(all).toContain('LEISTUNGEN');
    expect(all).toContain('Lieferumfang');
    expect(all).toContain('Allgemeine Richtlinien:');

    // Deckblatt: echte Firmendaten + ISO-Datum, einsprachig deutsch
    expect(all).toContain('INFLUENCER-VERTRAG');
    expect(all).toContain('UAB "Hautica"');
    expect(all).toContain('304140967');
    expect(all).toContain('LT100010142716');
    expect(all).toContain('Lietuva');
    expect(all).toContain('lisa@test.de');
    expect(all).toContain('2026-09-07');

    // Reihenfolge Deckblatt: Parteien-Box VOR der Praeambel
    expect(all.indexOf('UNTERNEHMEN')).toBeLessThan(all.indexOf('AUSGANGSLAGE:'));

    // 1:1-Rechtstext Stichproben (Hauptteil bilingual)
    expect(all).toContain('10.4.'); // Waiver-Klausel
    expect(all).toContain('direct damages'); // 7.5 vollstaendig
    expect(all).toContain('delayed payment'); // 2.5 vollstaendig
    expect(all).toContain('9.3.3.'); // Unterpunkte

    // EN-Spalte bleibt englisch, auch bei lang=de
    expect(all).toContain('via bank transfer');
    expect(all).toContain('per Banküberweisung');

    // 4.2: Marke dynamisch aus der Kampagne
    expect(all).toContain('BURGA');

    // Annex-Referenzen im Haupttext bei zwei Anhaengen
    expect(all).toContain('Anhänge A und B');
    expect(all).toContain('Annexes A and B');
  });

  it('EN: Deckblatt und Anhang auf Englisch', async () => {
    const all = await generate(['tiktok'], 'en');

    expect(all).toContain('INFLUENCER AGREEMENT');
    expect(all).toContain('COMPANY');
    expect(all).toContain('WHEREAS:');
    expect(all).toContain('ANNEX A');
    expect(all).not.toContain('ANHANG A');
    expect(all).toContain('DELIVERABLES');
    expect(all).toContain('Deliverable');
    expect(all).toContain('Guidelines');
    expect(all).toContain('General guidelines:');
    expect(all).toContain('1. TikTok Account: @lisa_tt');
    // Hauptteil bleibt bilingual
    expect(all).toContain('2. ZAHLUNG UND ÜBERWEISUNG');
  });

  it('DE: bei nur TikTok genau ein Anhang A', async () => {
    const all = await generate(['tiktok'], 'de');

    expect(all).toContain('ANHANG A');
    expect(all).not.toContain('ANHANG B');
    expect(all).toContain('1. TikTok Account: @lisa_tt');
    expect(all).toContain('Anhang A');
  });
});
