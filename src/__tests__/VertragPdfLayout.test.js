// Fuzz-Test: Vertrags-PDFs dürfen für KEINE Kombination aus Freitext-Längen
// über den Seitenrand / in die Fußzeile laufen. Nutzt echtes jsPDF (gleiche Version wie
// das CDN-Skript in UgcPdf.js), damit Textbreiten stimmen.
import { vi, describe, it, expect, beforeAll } from 'vitest';
import { jsPDF } from 'jspdf';

vi.mock('../modules/vertrag/create/pdf/VertragPdfUpload.js', () => ({
  uploadGeneratedVertragPdf: vi.fn(async () => ({ fileUrl: 'https://example.test/vertrag.pdf' }))
}));

import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';
import '../modules/vertrag/create/ContractTranslations.js';
import '../modules/vertrag/create/pdf/UgcPdf.js';
import '../modules/vertrag/create/pdf/InfluencerPdf.js';

const FOOTER_Y = 285;
const PAGE_LEFT = 14;
const PAGE_RIGHT = 196;
const PAGE_HEIGHT = 297;
const LIMITS = { UGC: 250, 'Influencer Kooperation': 265 };

/** jsPDF, das jeden Zeichenaufruf mit Seite/Position/Breite mitschreibt */
class RecordingJsPDF extends jsPDF {
  static last = null;
  constructor(...args) {
    super(...args);
    this.calls = [];
    RecordingJsPDF.last = this;
    const record = (kind, extra) => this.calls.push({
      kind,
      page: this.internal.getCurrentPageInfo().pageNumber,
      ...extra
    });
    const text = this.text.bind(this);
    this.text = (t, x, y, opts) => {
      (Array.isArray(t) ? t : [t]).forEach((line) => {
        const width = this.getTextWidth(String(line));
        record('text', { text: String(line), x, y, align: opts?.align || 'left', width });
      });
      return text(t, x, y, opts);
    };
    const rect = this.rect.bind(this);
    this.rect = (x, y, w, h, ...rest) => {
      record('rect', { x, y, w, h });
      return rect(x, y, w, h, ...rest);
    };
    this.save = () => this;
  }
}

const isFooter = (c) => c.kind === 'text' && c.y === FOOTER_Y && (c.text.startsWith('LikeGroup GmbH |') || /^(Seite|Page) \d+/.test(c.text));

/** Liefert alle Verstöße gegen Seitenrand/Fußzeile */
function findViolations(calls, maxContentY) {
  const out = [];
  calls.forEach((c) => {
    if (isFooter(c)) return;
    if (c.kind === 'text') {
      const left = c.align === 'center' ? c.x - c.width / 2 : c.align === 'right' ? c.x - c.width : c.x;
      if (c.y > maxContentY) out.push(`y=${c.y} > ${maxContentY} (S.${c.page}): "${c.text.slice(0, 50)}"`);
      if (left < PAGE_LEFT - 0.01 || left + c.width > PAGE_RIGHT + 0.01) {
        out.push(`x-Überlauf ${left.toFixed(1)}..${(left + c.width).toFixed(1)} (S.${c.page}): "${c.text.slice(0, 50)}"`);
      }
    }
    if (c.kind === 'rect' && (c.y + c.h > maxContentY + 1 || c.y + c.h > PAGE_HEIGHT)) {
      out.push(`Rect y=${c.y} (S.${c.page})`);
    }
  });
  // Jede Seite braucht mindestens eine Content-Zeile (keine Footer-only-Seiten)
  const pages = new Set(calls.map((c) => c.page));
  pages.forEach((p) => {
    const hasContent = calls.some((c) => c.page === p && c.kind === 'text' && !isFooter(c));
    if (!hasContent) out.push(`Seite ${p} ohne Inhalt`);
  });
  return out;
}

// --- Fixtures -------------------------------------------------------------

const SATZ = 'Der Creator räumt dem Auftraggeber ergänzend weitere Nutzungsrechte für sämtliche Länder Europas ein, ';
/** n Zeilen Freitext, jede dritte Zeile ein Absatz-Umbruch */
function freitext(n) {
  if (n === 0) return undefined;
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(i % 3 === 2 ? '' : `${SATZ}Punkt ${i + 1}.`);
  }
  return parts.join('\n');
}

function makeInstance() {
  const inst = new VertraegeCreate();
  inst.formData = {};
  inst.unternehmen = [{
    id: 'u-1',
    firmenname: 'SharkNinja Germany GmbH',
    rechnungsadresse_strasse: 'Musterstraße',
    rechnungsadresse_hausnummer: '1',
    rechnungsadresse_plz: '60314',
    rechnungsadresse_stadt: 'Frankfurt am Main'
  }];
  inst.creators = [{
    id: 'c-1',
    vorname: 'Büsra',
    nachname: 'Ari',
    lieferadresse_strasse: 'Teststr.',
    lieferadresse_hausnummer: '1',
    lieferadresse_plz: '10115',
    lieferadresse_stadt: 'Berlin'
  }];
  return inst;
}

function baseVertrag(typ, extra = {}) {
  const common = {
    id: 'v-1',
    typ,
    name: 'UGC - SharkNinja Partnership Ads: Airfryer Core, CryoGlow, Cordles - Büsra Ari',
    kunde_unternehmen_id: 'u-1',
    creator_id: 'c-1',
    kunde_po_nummer: 'PO-SharkNinja-2026-47-492',
    verguetung_netto: '200.00',
    zusatzkosten: true,
    zusatzkosten_betrag: null,
    zahlungsziel: '30_tage',
    skonto: false,
    medien: ['social_media'],
    nutzungsdauer: '6_monate',
    vertragssprache: 'de',
    paragraph_zusaetze: {}
  };
  if (typ === 'UGC') {
    return {
      ...common,
      anzahl_videos: 2, anzahl_fotos: 2, anzahl_storys: 0,
      content_erstellung_art: 'skript_fertig', lieferung_art: 'rohmaterial',
      rohmaterial_enthalten: true, untertitel: false, nutzungsart: 'paid',
      exklusivitaet: false, korrekturschleifen: 2, content_deadline: '2026-08-27',
      ...extra
    };
  }
  return {
    ...common,
    plattformen: ['instagram', 'tiktok'], anzahl_reels: 2, anzahl_feed_posts: 1, anzahl_storys: 3,
    korrekturschleifen: 2, veroeffentlichungsplan: {},
    organische_veroeffentlichung: 'influencer_only', media_buyout: 'paid',
    exklusivitaet: false, mindest_online_dauer: '30_tage', reichweiten_garantie: false,
    anpassungen: ['schnitt', 'hook'], influencer_land: 'Deutschland', influencer_profile: ['@creator'],
    ...extra
  };
}

async function generate(typ, vertrag) {
  const inst = makeInstance();
  RecordingJsPDF.last = null;
  await inst.generatePDF(vertrag);
  return RecordingJsPDF.last;
}

async function expectKeinUeberlauf(typ, vertrag, label) {
  const doc = await generate(typ, vertrag);
  // Schutz gegen leeres Ergebnis (Generator schluckt Fehler z.B. im catch)
  expect(doc?.calls.length, `${typ} / ${label}: kein PDF erzeugt`).toBeGreaterThan(0);
  const violations = findViolations(doc.calls, LIMITS[typ]);
  expect(violations, `${typ} / ${label}`).toEqual([]);
  return doc;
}

const LAENGEN = [0, 1, 3, 7, 15, 40, 90];

/** Deterministischer Pseudo-Zufall, damit Fehler reproduzierbar bleiben */
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

beforeAll(() => {
  window.jspdf = { jsPDF: RecordingJsPDF };
});

// --- Tests ----------------------------------------------------------------

describe('Vertrags-PDF Layout: Regression Büsra Ari (SharkNinja)', () => {
  it('langer §4-Zusatz + weitere Bestimmungen: §5 landet nicht in der Fußzeile', async () => {
    const vertrag = baseVertrag('UGC', {
      paragraph_zusaetze: {
        p4: 'Ergänzend zu den bereits für die Bundesrepublik Deutschland eingeräumten Nutzungsrechten räumt der Lizenzgeber dem Lizenznehmer das Recht ein, die nachfolgend aufgeführten Videos für die Dauer von sechs (6) Monaten in sämtlichen Ländern Europas und des Nahen Ostens auszuspielen. Nach Ablauf der sechs Monate erlischt das Ausspielungsrecht außerhalb Deutschlands, die Rechte für Deutschland bleiben unberührt.\n\nVideo 1 "ASMR Unboxing" \nVideo 2 "Crispy Maultaschen"'
      },
      weitere_bestimmungen: 'Ergänzend zum UGC Produktionsvertrag "UGC - Partnership Ads: Airfryer Core, CryoGlow, Cordles - Büsra Ari" unterschrieben am 21.08.2026.'
    });
    const doc = await expectKeinUeberlauf('UGC', vertrag, 'Büsra Ari');
    // §5 muss vollständig vorhanden sein
    const texte = doc.calls.filter((c) => c.kind === 'text').map((c) => c.text);
    expect(texte).toContain('§5 Vergütung');
    expect(texte).toContain('5.2 Zahlungsbedingungen');
  });
});

describe('Vertrags-PDF Layout: Fuzz UGC (legacy)', () => {
  const keys = ['p2', 'p3', 'p4', 'p5', 'p6'];

  keys.forEach((key) => {
    it(`${key}: Zusatztext in allen Längen`, async () => {
      for (const n of LAENGEN) {
        await expectKeinUeberlauf('UGC', baseVertrag('UGC', { paragraph_zusaetze: { [key]: freitext(n) } }), `${key} x ${n}`);
      }
    });
  });

  it('weitere_bestimmungen in allen Längen', async () => {
    for (const n of LAENGEN) {
      await expectKeinUeberlauf('UGC', baseVertrag('UGC', { weitere_bestimmungen: freitext(n) }), `weitere x ${n}`);
    }
  });

  it('alle Zusätze gleichzeitig in allen Längen', async () => {
    for (const n of LAENGEN) {
      const zusaetze = Object.fromEntries(keys.map((k) => [k, freitext(n)]));
      await expectKeinUeberlauf('UGC', baseVertrag('UGC', { paragraph_zusaetze: zusaetze, weitere_bestimmungen: freitext(n) }), `alle x ${n}`);
    }
  });

  it('zufällige Kombinationen (seeded)', async () => {
    const rnd = seeded(42);
    for (let i = 0; i < 40; i++) {
      const zusaetze = {};
      keys.forEach((k) => { zusaetze[k] = freitext(Math.floor(rnd() * 25)); });
      const vertrag = baseVertrag('UGC', {
        paragraph_zusaetze: zusaetze,
        weitere_bestimmungen: freitext(Math.floor(rnd() * 40)),
        exklusivitaet: rnd() > 0.5,
        exklusivitaet_monate: 6,
        zusatzkosten_betrag: rnd() > 0.5 ? 150 : null
      });
      await expectKeinUeberlauf('UGC', vertrag, `random #${i}`);
    }
  });

  it('Extremwerte: lange Namen, Agentur, PO', async () => {
    const lang = 'Sehr langer Vertragsname für eine Kampagne mit vielen Beteiligten und Produkten ';
    const vertrag = baseVertrag('UGC', {
      name: lang.repeat(3),
      kunde_po_nummer: 'PO-' + 'ABCDEFGH-'.repeat(12),
      influencer_agentur_vertreten: true,
      influencer_agentur_name: 'Eine Agentur mit einem außergewöhnlich langen Namen GmbH & Co. KG Gesellschaft für Talent',
      influencer_agentur_strasse: 'Straße der Sehr Langen Namen und Beschreibungen',
      influencer_agentur_hausnummer: '123 b',
      influencer_agentur_plz: '60314',
      influencer_agentur_stadt: 'Frankfurt am Main',
      influencer_agentur_vertretung: 'Maximilian Alexander von und zu Mustermann-Beispielhausen, Geschäftsführer',
      medien: ['social_media', 'website', 'otv'],
      exklusivitaet: true,
      exklusivitaet_monate: 12
    });
    await expectKeinUeberlauf('UGC', vertrag, 'Extremwerte');
    await expectKeinUeberlauf('UGC', { ...vertrag, paragraph_zusaetze: { p4: freitext(12) }, weitere_bestimmungen: freitext(20) }, 'Extremwerte + Text');
  });

  it('Englische Vertragssprache mit langen Zusätzen', async () => {
    const zusaetze = Object.fromEntries(['p2', 'p3', 'p4', 'p5', 'p6'].map((k) => [k, freitext(9)]));
    await expectKeinUeberlauf('UGC', baseVertrag('UGC', { vertragssprache: 'en', paragraph_zusaetze: zusaetze, weitere_bestimmungen: freitext(30) }), 'EN');
  });
});

describe('Vertrags-PDF Layout: Fuzz Influencer', () => {
  const T = 'Influencer Kooperation';
  const keys = ['p2', 'p3', 'p5', 'p6', 'p7', 'p8', 'p10', 'p11'];

  keys.forEach((key) => {
    it(`${key}: Zusatztext in allen Längen`, async () => {
      for (const n of LAENGEN) {
        await expectKeinUeberlauf(T, baseVertrag(T, { paragraph_zusaetze: { [key]: freitext(n) } }), `${key} x ${n}`);
      }
    });
  });

  it('weitere_bestimmungen in allen Längen', async () => {
    for (const n of LAENGEN) {
      await expectKeinUeberlauf(T, baseVertrag(T, { weitere_bestimmungen: freitext(n) }), `weitere x ${n}`);
    }
  });

  it('Veröffentlichungsplan mit vielen Terminen', async () => {
    for (const n of [0, 2, 10, 30, 80]) {
      const dates = Array.from({ length: n }, (_, i) => `2026-10-${String((i % 28) + 1).padStart(2, '0')}`);
      await expectKeinUeberlauf(T, baseVertrag(T, {
        anzahl_reels: n,
        veroeffentlichungsplan: { videos: dates, feed_posts: dates.slice(0, Math.ceil(n / 2)), storys: dates.slice(0, Math.ceil(n / 3)) }
      }), `plan x ${n}`);
    }
  });

  it('alle Zusätze gleichzeitig + zufällige Kombinationen (seeded)', async () => {
    for (const n of LAENGEN) {
      const zusaetze = Object.fromEntries(keys.map((k) => [k, freitext(n)]));
      await expectKeinUeberlauf(T, baseVertrag(T, { paragraph_zusaetze: zusaetze, weitere_bestimmungen: freitext(n) }), `alle x ${n}`);
    }
    const rnd = seeded(7);
    for (let i = 0; i < 30; i++) {
      const zusaetze = {};
      keys.forEach((k) => { zusaetze[k] = freitext(Math.floor(rnd() * 20)); });
      await expectKeinUeberlauf(T, baseVertrag(T, {
        paragraph_zusaetze: zusaetze,
        weitere_bestimmungen: freitext(Math.floor(rnd() * 30)),
        ksk_selbstzahler: rnd() > 0.5
      }), `random #${i}`);
    }
  });

  it('Extremwerte: lange Labels, Profile, Agentur', async () => {
    const vertrag = baseVertrag(T, {
      name: 'Sehr langer Vertragsname für eine Kampagne mit vielen Beteiligten und Produkten '.repeat(3),
      plattformen: ['instagram', 'tiktok', 'youtube', 'sonstige'],
      plattformen_sonstige: 'Eine sehr exotische Plattform mit langem Namen und Beschreibung',
      influencer_profile: ['@ein_sehr_langer_profilname_eins', '@ein_sehr_langer_profilname_zwei', '@ein_sehr_langer_profilname_drei', '@vier'],
      influencer_agentur_vertreten: true,
      influencer_agentur_name: 'Eine Agentur mit einem außergewöhnlich langen Namen GmbH & Co. KG Gesellschaft für Talent',
      influencer_agentur_vertretung: 'Maximilian Alexander von und zu Mustermann-Beispielhausen, Geschäftsführer',
      exklusivitaet: true,
      exklusivitaet_monate: 12,
      reichweiten_garantie: true,
      reichweiten_garantie_wert: 'Mindestens 250.000 organische Impressions pro Video innerhalb von 14 Tagen nach Veröffentlichung auf allen Plattformen',
      zusatzkosten_betrag: 1234.5
    });
    await expectKeinUeberlauf(T, vertrag, 'Extremwerte');
  });
});

// Diagnose-Befund (nicht umgebaut): Videograph, Model, Contracting zeigen im gleichen Fuzz keinen
// y-Überlauf bei langen Zusätzen; Model/Contracting/Awareness brechen aber den zentrierten
// Vertragsnamen nicht um (x-Überlauf bei ~150+ Zeichen). Awareness nutzt FOOTER_Y=288.
describe('Vertrags-PDF Layout: noch nicht auf createPdfLayout umgestellt', () => {
  it.todo('Model: sehr langer Vertragsname wird nicht umgebrochen (zentrierter Titel läuft seitlich über)');
  it.todo('Contracting: sehr langer Vertragsname wird nicht umgebrochen (zentrierter Titel läuft seitlich über)');
  it.todo('Awareness: sehr langer Vertragsname wird nicht umgebrochen; Fuzz auf createPdfLayout umstellen');
  it.todo('Videograph: auf createPdfLayout umstellen (aktuell kein Überlauf im Fuzz, aber handgeschätzte Höhen)');
});
