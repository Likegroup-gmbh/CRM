import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragsdetailsDetail } from '../modules/auftrag/AuftragsdetailsDetail.js';
import { setupAuftragsdetailsGlobals, videosAusKoops } from './AuftragsdetailsTestKit.js';

describe('AuftragsdetailsDetail Budget-Kacheln und KSK', () => {
  setupAuftragsdetailsGlobals();

  beforeEach(() => {
    window.validatorSystem = { sanitizeHtml: (v) => v || '' };
  });

  describe('getBudgetCardVariant', () => {
    it('erkennt Influencer über campaign_type-Chip', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['influencer'] };
      expect(instance.getBudgetCardVariant()).toBe('influencer');
    });

    it('erkennt UGC über campaign_type-Chip', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['ugc_paid'] };
      expect(instance.getBudgetCardVariant()).toBe('ugc');
    });

    it('erkennt UGC auch mit Vor-Ort-Produktion daneben', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['vorort_produktion', 'ugc_paid', 'ugc_organic'] };
      expect(instance.getBudgetCardVariant()).toBe('ugc');
    });

    it('gibt Influencer Vorrang bei gemischten Chips', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['ugc_paid', 'influencer'] };
      expect(instance.getBudgetCardVariant()).toBe('influencer');
    });

    it('erkennt Altbestand über influencer_* Daten-Spalten', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { influencer_video_anzahl: 3 };
      expect(instance.getBudgetCardVariant()).toBe('influencer');
    });

    it('erkennt Altbestand über ugc_* Daten-Spalten', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { ugc_budget_info: 'Budget-Info' };
      expect(instance.getBudgetCardVariant()).toBe('ugc');
    });

    it('erkennt Altbestand über igc_* Daten-Spalten', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = { igc_video_anzahl: 2 };
      expect(instance.getBudgetCardVariant()).toBe('ugc');
    });

    it('fällt ohne Chips und Daten auf influencer zurück', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = {};
      expect(instance.getBudgetCardVariant()).toBe('influencer');
    });

    it('fällt ohne details auf influencer zurück', () => {
      const instance = new AuftragsdetailsDetail();
      instance.details = null;
      expect(instance.getBudgetCardVariant()).toBe('influencer');
    });
  });

  describe('Budget-Kacheln Influencer-Variante', () => {
    it('zeigt VK-basierte Creatorbudget-Kacheln statt EK-Variante', () => {
      window.currentUser = { rolle: 'mitarbeiter' };

      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['influencer'] };
      instance.auftrag = { id: 'a1', nettobetrag: 50000, creator_budget: 44000 };
      instance.kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 0 }];
      instance.videos = [
        { id: 'v1', kooperation_id: 'k1', einkaufspreis_netto: 800, verkaufspreis_netto: 1000 },
      ];
      instance.kampagnen = [];

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(html).toContain('Gesamt Nettobetrag');
      expect(html).toContain('Creatorbudget');
      expect(html).toContain('Verbrauchtes Creatorbudget');
      expect(html).toContain('Offenes Creator Budget');
      expect(html).not.toContain('Auftragsvolumen');
      expect(html).not.toContain('Creator-Anteil');
      // Verbrauch VK-basiert: 1.000 (EK 800 erscheint nur in der Videos-Tabelle)
      expect(html).toContain('1.000,00');
      // Creatorbudget 44.000, Offenes Creator Budget 43.000
      expect(html).toContain('44.000,00');
      expect(html).toContain('43.000,00');
      // Formel-Tooltips der Influencer-Kacheln
      expect(html).toContain('Creator-Budget + KSK-Selbstzahler-Umbuchungen');
      expect(html).toContain('Σ Verkaufspreise (VK) der gebuchten Videos');
      expect(html).toContain('Creator-Budget − gebuchte VK');
    });

    it('berechnet Budget-Progress bei Influencer VK-basiert', () => {
      window.currentUser = { rolle: 'mitarbeiter' };

      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['influencer'] };
      instance.auftrag = { id: 'a1', nettobetrag: 50000, creator_budget: 1000 };
      instance.kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 0 }];
      instance.videos = [
        { id: 'v1', kooperation_id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 250 },
      ];
      instance.kampagnen = [];

      instance.calculateBudgetSummary();

      expect(instance.getBudgetProgressPercentage()).toBe(25);
    });
  });

  describe('UGC-KSK (KSK-Topf aus Auftragsdetails)', () => {
    function createUgcInstance(details = {}) {
      window.currentUser = { rolle: 'mitarbeiter' };
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['ugc_paid'], ...details };
      instance.auftrag = { id: 'a1', nettobetrag: 10000 };
      instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 2730, verkaufspreis_netto: 8000, verkaufspreis_zusatzkosten: 0 }];
      instance.videos = videosAusKoops(instance.kooperationen);
      instance.kampagnen = [];
      instance.rechnungen = [];
      instance.rechnungStatusMap = {};
      return instance;
    }

    it('zeigt keine KSK-Card ohne manuellen KSK-Topf', () => {
      const instance = createUgcInstance();

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(0);
      expect(html).not.toContain('>KSK<');
      expect(html).not.toContain('4,9 % vom Creator-Anteil');
    });

    it('nutzt den manuellen ksk_value bei UGC und rechnet ihn ins Budget', () => {
      const instance = createUgcInstance({ agency_services_enabled: true, ksk_enabled: true, ksk_value: '250' });

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(250);
      expect(html).toContain('>KSK<');
      expect(html).toContain('250,00');
      expect(html).not.toContain('4,9 % vom Creator-Anteil');
      // 2.730 EK + 5.270 Agenturanteil (EK/VK-Differenz) + 250 KSK-Topf = 8.250
      expect(instance.budgetSummary.verbrauchtesBudget).toBeCloseTo(8250, 2);
      expect(instance.budgetSummary.verfuegbaresBudget).toBeCloseTo(1750, 2);
    });

    it('zeigt UGC-Reihenfolge Creator-Anteil → Agenturanteil → KSK → Zusatzkosten', () => {
      const instance = createUgcInstance({ agency_services_enabled: true, ksk_enabled: true, ksk_value: '250' });

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      // Labels sind seit den Formel-Tooltips als <span>Label</span> markiert;
      // die Formeltexte selbst enthalten die Begriffe ebenfalls.
      const iCreator = html.indexOf('<span>Creator-Anteil</span>');
      const iAgentur = html.indexOf('<span>Agenturanteil</span>');
      const iKsk = html.indexOf('<span>KSK</span>');
      const iZusatz = html.indexOf('<span>Zusatzkosten</span>');
      expect(iCreator).toBeGreaterThan(-1);
      expect(iCreator).toBeLessThan(iAgentur);
      expect(iAgentur).toBeLessThan(iKsk);
      expect(iKsk).toBeLessThan(iZusatz);
    });

    it('zeigt Creator-Anteil Bezahlt/Offen aus Rechnungen', () => {
      window.canSeePricing = () => true;
      const instance = createUgcInstance();
      instance.rechnungen = [
        { status: 'Bezahlt', nettobetrag: 1000, rechnungstyp: 'kampagne' },
        { status: 'Offen', nettobetrag: 500, rechnungstyp: 'kampagne' },
        { status: 'Bezahlt', nettobetrag: 200, rechnungstyp: 'contracting' }
      ];

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(html).toContain('Creator-Anteil');
      expect(html).toContain('Bezahlt');
      expect(html).toContain('Offen');
      expect(html).toContain('1.000,00');
      expect(html).toContain('1.730,00');
    });
  });

  describe('Influencer-KSK (manuell)', () => {
    function createInfluencerInstance(details = {}) {
      window.currentUser = { rolle: 'mitarbeiter' };
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['influencer'], ...details };
      instance.auftrag = { id: 'a1', nettobetrag: 50000, creator_budget: 44000 };
      instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 2730, verkaufspreis_netto: 8000, verkaufspreis_zusatzkosten: 0 }];
      instance.videos = videosAusKoops(instance.kooperationen);
      instance.kampagnen = [];
      instance.rechnungStatusMap = {};
      return instance;
    }

    it('zeigt keine KSK-Card ohne manuelle Angabe (kein Auto-Wert)', () => {
      const instance = createInfluencerInstance();

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(0);
      expect(html).not.toContain('>KSK<');
      expect(html).not.toContain('4,9 % vom Creator-Anteil');
    });

    it('zeigt manuellen KSK-Topf und rechnet nicht aus EK', () => {
      const instance = createInfluencerInstance({ agency_services_enabled: true, ksk_enabled: true, ksk_value: '250' });

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(250);
      expect(html).toContain('>KSK<');
      expect(html).toContain('250,00');
      expect(html).not.toContain('4,9 % vom Creator-Anteil');
    });

    it('zeigt Influencer-Reihenfolge KSK → Agenturanteil → Zusatzkosten → Zusatzleistungen', () => {
      window.isKunde = vi.fn(() => false);
      window.isAdmin = vi.fn(() => true);
      const instance = createInfluencerInstance({
        agency_services_enabled: true,
        ksk_enabled: true,
        ksk_value: '250',
        percentage_fee_enabled: true,
        percentage_fee_value: '500',
        extra_services_enabled: true,
        extra_services: [{ name: 'Konzept', amount: 100 }]
      });

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      const iKsk = html.indexOf('>KSK<');
      const iAgentur = html.indexOf('Agenturanteil');
      const iZusatz = html.indexOf('Zusatzkosten');
      const iExtra = html.indexOf('Konzept');
      expect(iKsk).toBeGreaterThan(-1);
      expect(iKsk).toBeLessThan(iAgentur);
      expect(iAgentur).toBeLessThan(iZusatz);
      expect(iZusatz).toBeLessThan(iExtra);
      expect(html).not.toContain('Extra Kosten</div>');
    });
  });

  describe('renderKategorienTable', () => {
    beforeEach(() => {
      window.isKunde = vi.fn(() => false);
      window.validatorSystem = { sanitizeHtml: (v) => v || '' };
    });

    function createInstance(details) {
      const instance = new AuftragsdetailsDetail();
      instance.details = details;
      instance.auftrag = { id: 'a1', start: null, ende: null };
      return instance;
    }

    it('zeigt gewählte Kampagnenart ohne Werte als Zeile', () => {
      const instance = createInstance({ campaign_type: ['influencer'] });

      const html = instance.renderKategorienTable();

      expect(html).toContain('Influencer Kampagne');
      expect(html).not.toContain('Keine Produktionsdetails vorhanden');
    });

    it('zeigt zusammengeführte UGC-Kategorie ohne Werte', () => {
      const instance = createInstance({ campaign_type: ['ugc_paid'] });

      const html = instance.renderKategorienTable();

      expect(html).toContain('UGC Paid');
      expect(html).not.toContain('Keine Produktionsdetails vorhanden');
    });

    it('zeigt Empty-State wenn weder Auswahl noch Daten vorhanden sind', () => {
      const instance = createInstance({});

      const html = instance.renderKategorienTable();

      expect(html).toContain('Keine Produktionsdetails vorhanden');
    });

    it('zeigt Zeilen mit Daten auch ohne campaign_type (Altbestand)', () => {
      const instance = createInstance({ influencer_video_anzahl: 3 });

      const html = instance.renderKategorienTable();

      expect(html).toContain('Influencer Kampagne');
      expect(html).not.toContain('Keine Produktionsdetails vorhanden');
    });
  });
});
