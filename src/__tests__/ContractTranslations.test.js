// Englische Vertrags-PDFs dürfen keine deutschen Satzreste behalten.
// Der Lookup behandelt '' als echten Treffer (Zeile weglassen). Neue Klauseln
// in den PDFs müssen entweder übersetzt sein oder sprachneutral bleiben.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

class MockJsPDF {
  static instances = [];
  constructor() {
    this.texts = [];
    MockJsPDF.instances.push(this);
  }
  setFont() {}
  setFontSize() {}
  getFontSize() { return 10; }
  getFont() { return { fontName: 'helvetica', fontStyle: 'normal' }; }
  getTextWidth(t) { return String(t ?? '').length * 1.7; }
  setTextColor() {}
  setDrawColor() {}
  text(t) { this.texts.push(String(t)); }
  splitTextToSize(text) { return String(text ?? '').split('\n'); }
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
import '../modules/vertrag/create/pdf/UgcPdf.js';
import '../modules/vertrag/create/pdf/InfluencerPdf.js';
import '../modules/vertrag/create/pdf/VideografPdf.js';
import '../modules/vertrag/create/pdf/ModelPdf.js';
import '../modules/vertrag/create/pdf/ContractingPdf.js';

const PDF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../modules/vertrag/create/pdf');
const PDFS = ['UgcPdf.js', 'InfluencerPdf.js', 'VideografPdf.js', 'ModelPdf.js', 'ContractingPdf.js'];

// Eigennamen und Gesetzesstellen dürfen in der englischen Fassung stehen bleiben.
function stripKeptNames(text) {
  return String(text)
    .replace(/Künstlersozialkasse/g, '')
    .replace(/Künstlersozialabgabe/g, '')
    .replace(/Straße/g, 'Strasse');
}

const GERMAN_RESIDUE = /[äöüÄÖÜß]|\b(der|die|das|den|dem|des|ein|eine|einer|und|oder|für|mit|von|ist|sind|wird|werden|nicht|bei|kein|keine|keinen|sowie|gemäß|Nutzungsrechte|einzuräumen|Auftraggeber|Auftragnehmer|Vergütung|Werktage|Korrekturschleife|Schriftform|Verschwiegenheit|Vertragspartner|Exklusivität|Unterschrift|Bestimmungen|unwirksam|Veröffentlichung|Kennzeichnung|Rücktritt|Neudreh|Persönlichkeits|Fotoshooting|Videoshooting|Tagesgage|Beschränkt|Reisepauschale|Sonstiges|Organisch|ausschließlich|Umsatzsteuer|zzgl|Monate|Jahre|Wochen|Tage|Stunden|Deutschland|Vertragsgegenstand|Nutzungsdauer|Zahlungsbedingungen|Schlussbestimmungen|Vertragsschluss|Werbekennzeichnung|Rechteübertragung|Leistungsstörungen|Durchführer|Begünstigter|Auftragsbezug|Geografisch|Storys|Feed-Posts|Creators ist)\b/i;

function germanResidue(text) {
  const cleaned = stripKeptNames(text).replace(/\{[A-Za-z0-9_]+\}/g, '');
  return GERMAN_RESIDUE.test(cleaned);
}

function contractLiterals(source) {
  const found = [];
  const take = (raw) => {
    const literal = raw.replace(/\\'/g, "'");
    if (literal.length >= 2) found.push(literal);
  };
  source.split('\n').forEach((line) => {
    if (/toastSystem|console\./.test(line)) return;
    if (/(?:doc\.text|addWrappedText|writeClause|drawCheckbox)\(/.test(line)) {
      for (const match of line.matchAll(/'((?:\\'|[^'])*)'/g)) take(match[1]);
    }
    const label = line.match(/^\s+'[^']+': '((?:\\'|[^'])*)'/);
    if (label) take(label[1]);
    const element = line.match(/^\s+'((?:\\'|[^'])*)',?\s*$/);
    if (element) take(element[1]);
  });
  return found;
}

function wizard() {
  const inst = new VertraegeCreate();
  inst.unternehmen = [{
    id: 'u-1',
    firmenname: 'hama GmbH',
    rechnungsadresse_strasse: 'Dresdener Strasse',
    rechnungsadresse_hausnummer: '1',
    rechnungsadresse_plz: '60314',
    rechnungsadresse_stadt: 'Frankfurt',
    rechnungsadresse_land: 'Deutschland'
  }];
  inst.creators = [{
    id: 'c-1',
    vorname: 'Alisa',
    nachname: 'Spitz',
    lieferadresse_strasse: 'Mainzer Landstr.',
    lieferadresse_hausnummer: '2',
    lieferadresse_plz: '60329',
    lieferadresse_stadt: 'Frankfurt',
    lieferadresse_land: 'Deutschland'
  }];
  inst.contractingAuftraege = [{ id: 'a-1', titel: 'Summer Push', po: 'PO-9', angebotsnummer: 'A-9' }];
  inst.formData = {};
  return inst;
}

const baseVertrag = {
  id: 'v-1',
  name: 'hama x Alisa Spitz',
  kunde_unternehmen_id: 'u-1',
  creator_id: 'c-1',
  vertragssprache: 'en',
  verguetung_netto: 550,
  zahlungsziel: '30_tage',
  skonto: true,
  zusatzkosten: true,
  zusatzkosten_betrag: 40,
  nutzungsdauer: '6_monate',
  medien: ['social_media'],
  organische_veroeffentlichung: 'influencer_only',
  media_buyout: 'organisch',
  exklusivitaet: true,
  exklusivitaet_monate: 3,
  exklusivitaet_einheit: 'monate',
  anzahl_videos: 1,
  anzahl_fotos: 2,
  anzahl_reels: 1,
  anzahl_feed_posts: 1,
  anzahl_storys: 1,
  influencer_agentur_vertreten: true,
  influencer_agentur_name: 'Talent AG',
  influencer_agentur_vertretung: 'Kim Berger',
  content_erstellung_art: 'video_foto',
  videograf_nutzungsart: ['organisch'],
  videograf_lieferumfang: ['fertig_geschnitten'],
  videograf_produktionsart: 'briefing',
  korrekturschleifen: 2,
  model_exklusivitaet_art: 'branche',
  model_exklusivitaet_dauer: 6,
  model_territorium: 'beschraenkt',
  model_territorium_beschraenkt: 'EU',
  model_reisekosten: 'pauschale',
  model_reisepauschale: 80,
  model_max_tagesstunden: 8,
  model_nutzungsdauer: '12_monate',
  contracting_auftrag_id: 'a-1',
  plattformen: ['instagram', 'sonstige'],
  plattformen_sonstige: 'Pinterest',
  contracting_anzahl_inhalte: 2,
  contracting_veroeffentlichung_zeitraum: 'June',
  contracting_buyout_aktiv: true,
  contracting_buyout_plattformen: ['instagram'],
  contracting_buyout_art: ['werbeanzeigen'],
  contracting_buyout_nutzungsdauer: '6 Monate',
  contracting_buyout_geografisch: 'europa',
  contracting_exklusivitaet_bereich: 'Beauty',
  contracting_exklusivitaet_von: '2026-06-01',
  contracting_exklusivitaet_bis: '2026-06-30',
  contracting_veroeffentlichungsdatum: '2026-07-01'
};

describe('englische Vertragstexte', () => {
  beforeAll(() => {
    window.jspdf = { jsPDF: MockJsPDF };
  });

  const inst = () => wizard();

  it('lässt absichtlich leere Umbruchreste weg, statt den deutschen Text stehen zu lassen', () => {
    const form = inst();
    expect(form.localizeContractText('Nutzungsrechte ein.', 'en')).toBe('');
    expect(form.localizeContractText('Nutzungsrechte einzuräumen.', 'en')).toBe('');
    expect(form.localizeContractText('Nutzungsrechte ein.', 'de')).toBe('Nutzungsrechte ein.');
  });

  it('übersetzt variable Sätze über Platzhalter, nicht über zusammengebaute Strings', () => {
    const form = inst();
    expect(form.localizeContractText('Vertreten durch Agentur: Talent AG', 'en'))
      .toBe('Represented by agency: Talent AG');
    expect(form.localizeContractText('Seite 2 von 4', 'en')).toBe('Page 2 of 4');
    expect(form.localizeContractText('Branchenexklusivität – Dauer: 6 Monate', 'en'))
      .toBe('Industry exclusivity - duration: 6 months');
    expect(form.localizeContractText('Fixvergütung: 550,00 € netto zzgl. gesetzlicher Umsatzsteuer.', 'en'))
      .toBe('Fixed compensation: 550,00 EUR net plus statutory VAT.');
    expect(form.localizeContractText('Videos: 1  |  Fotos: 2  |  Storys: 1', 'en'))
      .toBe('Videos: 1  |  Photos: 2  |  Stories: 1');
    expect(form.localizeContractText('Maximale tägliche Einsatzdauer: 8 Stunden', 'en'))
      .toBe('Maximum daily working hours: 8 hours');
    const clause = form.localizeContractTemplate(
      '(3) Die Zahlung erfolgt innerhalb von {ziel} nach Leistungserbringung und Rechnungsstellung.',
      { ziel: form.localizeContractText('30 Tage', 'en') },
      'en'
    );
    expect(clause).toBe('(3) Payment is made within 30 days after performance and invoicing.');
    expect(germanResidue(clause)).toBe(false);
  });

  it('hat für jede deutsche Klausel in den PDFs eine englische Fassung ohne Satzreste', () => {
    const form = inst();
    const failures = [];
    for (const file of PDFS) {
      const literals = contractLiterals(fs.readFileSync(path.join(PDF_DIR, file), 'utf8'));
      for (const literal of literals) {
        if (!germanResidue(literal)) continue;
        const out = form.localizeContractText(literal, 'en');
        if (out === '') continue;
        if (germanResidue(out)) {
          failures.push(`${file}: ${JSON.stringify(literal)} => ${JSON.stringify(out)}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('druckt englische Verträge ohne deutsche Satzreste', async () => {
    const cases = [
      ['UGC', (form) => form.generatePDF({ ...baseVertrag, typ: 'UGC' })],
      ['Influencer', (form) => form.generateInfluencerPDF({
        ...baseVertrag,
        typ: 'Influencer Kooperation',
        veroeffentlichungsplan: { videos: ['2026-07-01'], feed_posts: ['2026-07-02'], storys: ['2026-07-03'] }
      })],
      ['Videograf', (form) => form.generateVideografPDF({
        ...baseVertrag,
        typ: 'Videograph',
        videograf_produktionsplan: [{ datum: '2026-07-01', ort: 'Studio Mitte' }],
        videograf_finale_werktage: 5,
        videograf_v1_deadline: '2026-07-08'
      })],
      ['Model', (form) => form.generateModelPDF({ ...baseVertrag, typ: 'Model' })],
      ['Contracting', (form) => form.generateContractingPDF({ ...baseVertrag, typ: 'Contracting' })]
    ];

    for (const [name, render] of cases) {
      MockJsPDF.instances = [];
      await render(inst());
      const texts = MockJsPDF.instances[0].texts;
      const leftovers = texts.filter(germanResidue);
      expect(leftovers, `${name}\n${leftovers.join('\n')}`).toEqual([]);
    }

    MockJsPDF.instances = [];
    await inst().generatePDF({ ...baseVertrag, typ: 'UGC' });
    const ugc = MockJsPDF.instances[0].texts;
    expect(ugc.some((line) => line.includes('rights necessary to perform the engagement'))).toBe(true);
    expect(ugc.some((line) => line.includes('grant corresponding rights of use'))).toBe(true);
    expect(ugc).not.toContain('Nutzungsrechte ein.');
    expect(ugc).not.toContain('Nutzungsrechte einzuräumen.');
  });

  it('behält die deutschen Zeilenreste in der deutschen Fassung', async () => {
    MockJsPDF.instances = [];
    await inst().generatePDF({ ...baseVertrag, typ: 'UGC', vertragssprache: 'de' });
    const texts = MockJsPDF.instances[0].texts;
    expect(texts).toContain('Nutzungsrechte ein.');
    expect(texts).toContain('Nutzungsrechte einzuräumen.');
  });
});
