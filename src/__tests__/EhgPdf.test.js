import { vi } from 'vitest';
import { uploadGeneratedVertragPdf } from '../modules/vertrag/create/pdf/VertragPdfUpload.js';
import { normalizePdfWinAnsi } from '../modules/vertrag/create/pdf/EhgPdf.js';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

class MockJsPDF {
  static instances = [];
  constructor() {
    this.textCalls = [];
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
  addImage() {}
  line() {}
  rect() {}
  output() { return new Blob(['pdf']); }
  save() {}
}

import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/ContractTranslations.js';
import '../modules/vertrag/create/pdf/EhgPdf.js';

function makeInstance() {
  const inst = new VertraegeCreate();
  inst.formData = {};
  inst.unternehmen = [{
    id: 'u-ehg',
    firmenname: 'EHG GmbH & Co. KG',
    rechnungsadresse_strasse: 'Falsche CRM-Straße',
    rechnungsadresse_hausnummer: '9',
    rechnungsadresse_plz: '00000',
    rechnungsadresse_stadt: 'Nirgends'
  }];
  inst.creators = [{
    id: 'c-1',
    vorname: 'Anna',
    nachname: 'Creator',
    instagram: 'anna_ef',
    lieferadresse_strasse: 'Teststr. 1',
    lieferadresse_plz: '10115',
    lieferadresse_stadt: 'Berlin'
  }];
  inst._extractHandle = (v) => String(v || '').replace(/^@/, '');
  inst.kampagnen = [{
    id: 'k-1',
    kampagnenname: 'EF UGC Q3',
    marke: { markenname: 'ernsting\'s family' }
  }];
  return inst;
}

function makeVertrag() {
  return {
    id: 'v-1',
    typ: 'UGC',
    name: 'EF Testvertrag',
    kunde_unternehmen_id: 'u-ehg',
    kampagne_id: 'k-1',
    creator_id: 'c-1',
    anzahl_videos: 2,
    anzahl_fotos: 1,
    content_erstellung_art: 'skript_fertig',
    lieferung_art: 'fertig_geschnitten',
    untertitel: true,
    content_deadline: '2026-10-01',
    verguetung_netto: 750,
    kunde_po_nummer: 'PO-EF-1',
    ehg_felder: {
      marke_id: 'm-1',
      marke_name: 'ernsting\'s family',
      produkt_name: 'Basic Tee',
      ansprechpartner: 'Lisa PM',
      lieferbestandteile: ['thumbnail'],
      nutzungen: ['organic_social', 'website'],
      gebiet: 'deutschland',
      dauer_organic: 'unbegrenzt',
      dauer_paid: '12_monate',
      ust: 'faellt_an',
      unterschrift_ort: 'Frankfurt am Main',
      unterschrift_datum: '2026-09-09'
    }
  };
}

async function generate(lang) {
  MockJsPDF.instances = [];
  const inst = makeInstance();
  await inst.generateEhgPDF(makeVertrag(), lang);
  return MockJsPDF.instances[0].rawTexts.join('\n');
}

describe('EhgPdf', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  beforeEach(() => {
    vi.mocked(uploadGeneratedVertragPdf).mockClear();
    vi.mocked(uploadGeneratedVertragPdf).mockResolvedValue({ fileUrl: 'https://example.test/vertrag.pdf' });
  });

  it('DE: Standard-Deckblatt, Vorlagenadresse, voller § 6 und Projektblatt', async () => {
    const all = await generate('de');

    expect(all).toContain('UGC-PRODUKTIONSVERTRAG');
    expect(all).toContain('Agenturdaten');
    expect(all).toContain('Kundendaten');
    expect(all).toContain('Drittbegünstigte');
    expect(all).toContain('Hugo-Ernsting-Platz 1');
    expect(all).toContain('48653 Coesfeld');
    expect(all).not.toContain('Falsche CRM-Straße');

    expect(all).toContain('§ 6 Rechte von EHG als begünstigte Dritte');
    expect(all).toContain('§ 328 BGB');
    expect(all).toContain('EHG kann im eigenen Namen die vertragsgemäße Erstellung');
    expect(all).toContain('Schadensersatz-, Aufwendungsersatz-, Nachweis- und Freistellungsansprüche');
    expect(all).toContain('Im Zweifel geht die Weisung von EHG vor');
    expect(all).toContain('innerhalb von 30 Tagen');

    expect(all).toContain('PROJEKTBLATT');
    expect(all).toContain('EF UGC Q3');
    expect(all).toContain('Anna Creator @anna_ef');
    expect(all).toContain('ernsting\'s family / Basic Tee');
    expect(all).toContain('Organic Social Media');
    expect(all).toContain('Frankfurt am Main');
    expect(all).toContain('Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.');
    expect(all).toContain('Creator: ______________________________');
    expect(all).not.toContain('Agentur / Agency');
    expect(all).not.toContain('The Creator shall produce');
  });

  it('EN: einsprachig englisch, ohne deutschen Klauseltext', async () => {
    const all = await generate('en');
    expect(all).toContain('UGC PRODUCTION AGREEMENT');
    expect(all).toContain('§ 6 Rights of EHG as a Third-Party Beneficiary');
    expect(all).toContain('PROJECT SHEET');
    expect(all).toContain('within 30 days');
    expect(all).not.toContain('Der Creator produziert die im beigefügten Projektblatt');
  });

  it('DE: lädt die PDF hoch und verknüpft sie am Vertrag', async () => {
    await generate('de');
    expect(uploadGeneratedVertragPdf).toHaveBeenCalledTimes(1);
    const [, vertrag, blob, fileName] = uploadGeneratedVertragPdf.mock.calls[0];
    expect(vertrag.id).toBe('v-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(fileName).toMatch(/^Vertrag_EHG_EF Testvertrag_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('EN: Dateiname EN_Contract_EHG', async () => {
    await generate('en');
    const fileName = uploadGeneratedVertragPdf.mock.calls[0][3];
    expect(fileName).toMatch(/^EN_Contract_EHG_EF Testvertrag_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('reicht Generierungs- und Verknüpfungsfehler weiter', async () => {
    window.toastSystem = { show: vi.fn() };
    vi.mocked(uploadGeneratedVertragPdf).mockRejectedValueOnce(new Error('update failed'));
    const inst = makeInstance();
    await expect(inst.generateEhgPDF(makeVertrag(), 'de')).rejects.toThrow('update failed');
    expect(window.toastSystem.show).toHaveBeenCalledWith('PDF konnte nicht generiert werden', 'warning');
    delete window.toastSystem;
  });

  it('normalisiert typografische Zeichen auf WinAnsi', () => {
    expect(normalizePdfWinAnsi('„Content“ und Do’s – Creator’s — Text')).toBe('"Content" und Do\'s - Creator\'s - Text');
  });
});
