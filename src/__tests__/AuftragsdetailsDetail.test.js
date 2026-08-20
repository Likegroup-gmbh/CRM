import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragsdetailsDetail } from '../modules/auftrag/AuftragsdetailsDetail.js';

function createSingleResult(data) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data, error: null }))
      }))
    }))
  };
}

describe('AuftragsdetailsDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.content = document.createElement('div');
    window.ErrorHandler = { handle: vi.fn() };
    window.canSeePricing = () => window.currentUser?.rolle !== 'kunde';
  });

  it('nutzt permissions.auftragsdetails für Edit-Berechtigung', async () => {
    const detailData = {
      id: 'd1',
      auftrag: {
        id: 'a1',
        auftragsname: 'Testauftrag',
        auftragtype: 'UGC',
        start: null,
        ende: null
      }
    };

    const kampagnenResult = {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: [], error: null }))
      }))
    };

    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'auftrag_details') return createSingleResult(detailData);
        if (table === 'kampagne') return kampagnenResult;
        throw new Error(`Unexpected table ${table}`);
      })
    };

    const updateDetailLabel = vi.fn();
    window.breadcrumbSystem = { updateDetailLabel, setFromRoute: vi.fn() };
    window.currentUser = {
      rolle: 'mitarbeiter',
      permissions: {
        auftrag: { can_edit: true },
        auftragsdetails: { can_edit: false }
      }
    };

    const instance = new AuftragsdetailsDetail();
    await instance.init('d1');

    const editButton = updateDetailLabel.mock.calls[0][1];
    expect(editButton.canEdit).toBe(false);
  });

  it('zeigt Budget-Kacheln auch für Mitarbeiter', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.details = { campaign_type: ['ugc_paid'] };
    instance.auftrag = { id: 'a1', po: 'PO-1' };
    instance.budgetSummary = {
      totalBudget: 10000,
      verbrauchtesBudget: 2500,
      verfuegbaresBudget: 7500,
      creatorAnteil: 2000,
      extraKostenVkSum: 500,
      totalCreators: 2,
      targetCreators: 4,
      totalVideos: 3,
      targetVideos: 6
    };

    const html = instance.renderInformationen();

    expect(html).toContain('Auftragsvolumen');
    expect(html).toContain('Verfügbares Budget');
    expect(html).toContain('Verbrauchtes Budget');
    expect(html).toContain('Creator-Anteil');
    expect(html).toContain('Zusatzkosten');
  });

  it('summiert Extra Kosten (VK) in der Tabelle einmal pro Kooperation', () => {
    window.currentUser = { rolle: 'mitarbeiter' };
    window.validatorSystem = { sanitizeHtml: (v) => v || '' };

    const instance = new AuftragsdetailsDetail();
    instance.auftrag = { id: 'a1', creator_budget: 1000 };
    instance.kooperationen = [{
      id: 'koop-1',
      name: 'Koop 1',
      verkaufspreis_zusatzkosten: 100,
      creator: { id: 'c1', vorname: 'Max', nachname: 'Muster' },
      kampagne: { id: 'k1', kampagnenname: 'Kampagne A' }
    }];
    instance.videos = [
      { id: 'v1', kooperation_id: 'koop-1', titel: 'Video 1', verkaufspreis_netto: 50, einkaufspreis_netto: 30 },
      { id: 'v2', kooperation_id: 'koop-1', titel: 'Video 2', verkaufspreis_netto: 50, einkaufspreis_netto: 30 }
    ];
    instance.rechnungStatusMap = {};

    instance.calculateBudgetSummary();
    expect(instance.budgetSummary.extraKostenVkSum).toBe(100);

    const html = instance.renderCreatorVideosTable();
    const tfoot = html.match(/<tfoot>[\s\S]*?<\/tfoot>/);
    expect(tfoot).not.toBeNull();
    expect(tfoot[0]).toContain('100,00');
    expect(html).toContain('Gesamt');
  });

  it('berechnet EK/VK-Summen und Differenz im budgetSummary', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.auftrag = { id: 'a1', creator_budget: 1000 };
    instance.details = {};
    instance.kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [
      { id: 'v1', kooperation_id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 },
      { id: 'v2', kooperation_id: 'k1', einkaufspreis_netto: 50, verkaufspreis_netto: 80 },
    ];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();

    expect(instance.budgetSummary.ekSum).toBe(150);
    expect(instance.budgetSummary.vkSum).toBe(280);
    expect(instance.budgetSummary.ekVkMarginSum).toBe(130);
  });

  it('berechnet Verbrauchtes Budget EK-basiert (Creator-Anteil + Agenturanteil + KSK + Zusatzkosten)', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {
      agency_services_enabled: true,
      percentage_fee_enabled: true,
      percentage_fee_value: '500',
      ksk_enabled: true,
      ksk_value: '250',
    };
    instance.auftrag = { id: 'a1', nettobetrag: 10000, creator_budget: 8000 };
    instance.kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 300 }];
    instance.videos = [
      { id: 'v1', kooperation_id: 'k1', einkaufspreis_netto: 1000, verkaufspreis_netto: 2000 },
    ];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();

    // Creator-Anteil = EK-Summe, nicht VK (2000)
    expect(instance.budgetSummary.creatorAnteil).toBe(1000);
    // Agenturanteil = baseFee 500 + EK/VK-Marge 1000
    expect(instance.budgetSummary.agencyFeeSummary.total).toBe(1500);
    // Verbrauchtes Budget = 1000 + 1500 + 250 + 300
    expect(instance.budgetSummary.verbrauchtesBudget).toBe(3050);
    // Verfügbares Budget = Auftragsvolumen - Verbrauchtes Budget
    expect(instance.budgetSummary.verfuegbaresBudget).toBe(6950);
  });

  it('ignoriert EK/VK-Differenz wenn EK=0', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.auftrag = { id: 'a1', creator_budget: 1000 };
    instance.details = {};
    instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 0, verkaufspreis_netto: 2000, verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();

    expect(instance.budgetSummary.ekVkMarginSum).toBe(0);
  });

  it('zeigt EK/VK-Summen und Differenz im Tabellen-Footer', () => {
    window.currentUser = { rolle: 'mitarbeiter' };
    window.validatorSystem = { sanitizeHtml: (v) => v || '' };

    const instance = new AuftragsdetailsDetail();
    instance.auftrag = { id: 'a1', creator_budget: 1000 };
    instance.details = {};
    instance.kooperationen = [{ id: 'k1', verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [
      { id: 'v1', kooperation_id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 },
    ];
    instance.rechnungStatusMap = {};
    instance.kampagnen = [];

    instance.calculateBudgetSummary();
    const html = instance.renderCreatorVideosTable();
    const tfoot = html.match(/<tfoot>[\s\S]*?<\/tfoot>/)?.[0] || '';

    expect(tfoot).toContain('Gesamt');
    expect(tfoot).toContain('Differenz');
    expect(tfoot).toContain('100,00');
    expect(tfoot).toContain('200,00');
  });

  it('zeigt Agency-Fee-Kachel mit Breakdown wenn base + margin vorhanden', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {
      agency_services_enabled: true,
      percentage_fee_enabled: true,
      percentage_fee_value: '500',
    };
    instance.auftrag = { id: 'a1', nettobetrag: 5000 };
    instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300, verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [];
    instance.kampagnen = [];
    instance.rechnungStatusMap = { k1: 'Bezahlt' };

    instance.calculateBudgetSummary();

    expect(instance.budgetSummary.agencyFeeSummary.baseFee).toBe(500);
    expect(instance.budgetSummary.agencyFeeSummary.ekVkMargin).toBe(200);
    expect(instance.budgetSummary.agencyFeeSummary.total).toBe(700);

    const html = instance.renderInformationen();
    expect(html).toContain('Agenturanteil');
    expect(html).toContain('Festgelegt');
    expect(html).toContain('EK/VK-Differenz');
  });

  it('Kunde sieht nur baseFee Agency Fee ohne Breakdown', () => {
    window.currentUser = { rolle: 'kunde' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {
      agency_services_enabled: true,
      percentage_fee_enabled: true,
      percentage_fee_value: '500',
    };
    instance.auftrag = { id: 'a1', nettobetrag: 5000 };
    instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300, verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();
    const html = instance.renderInformationen();

    expect(html).toContain('Agenturanteil');
    expect(html).not.toContain('Festgelegt');
    expect(html).not.toContain('EK/VK-Differenz');
    expect(html).not.toContain('KSK');
    expect(html).not.toContain('Auftragsvolumen');
  });

  it('Kunde sieht Agency Fee-Kachel ohne Breakdown auch bei baseFee 0', () => {
    window.currentUser = { rolle: 'kunde' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {};
    instance.auftrag = { id: 'a1', nettobetrag: 5000 };
    instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300, verkaufspreis_zusatzkosten: 0 }];
    instance.videos = [];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();
    const html = instance.renderInformationen();

    expect(html).toContain('Agenturanteil');
    expect(html).not.toContain('Festgelegt');
    expect(html).not.toContain('EK/VK-Differenz');
  });

  it('Agency Fee EK/VK-Margin aus allen Kooperationen (ohne Bezahlt-Filter)', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {
      agency_services_enabled: true,
      percentage_fee_enabled: true,
      percentage_fee_value: '100',
    };
    instance.auftrag = { id: 'a1', nettobetrag: 5000 };
    instance.kooperationen = [
      { id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300, verkaufspreis_zusatzkosten: 0 },
      { id: 'k2', einkaufspreis_netto: 50, verkaufspreis_netto: 150, verkaufspreis_zusatzkosten: 0 },
    ];
    instance.videos = [];
    instance.kampagnen = [];

    instance.calculateBudgetSummary();

    expect(instance.budgetSummary.agencyFeeSummary.ekVkMargin).toBe(300);
    expect(instance.budgetSummary.agencyFeeSummary.total).toBe(400);
  });

  it('zeigt Creatorbudget-Prozent-Tag in der EK/VK-Differenz-Zeile', () => {
    window.currentUser = { rolle: 'mitarbeiter' };

    const instance = new AuftragsdetailsDetail();
    instance.details = {};
    instance.auftrag = { id: 'a1', creator_budget: 1000 };
    instance.kooperationen = [
      { id: 'k1', creator: { id: 'c1', vorname: 'Max' }, einkaufspreis_netto: 100, verkaufspreis_netto: 300, verkaufspreis_zusatzkosten: 0 },
    ];
    instance.videos = [];
    instance.kampagnen = [{ id: 'ka1', kampagnenname: 'Test', videoanzahl: 1, creatoranzahl: 1 }];

    instance.calculateBudgetSummary();
    const html = instance.renderCreatorVideosTable();

    expect(html).toContain('class="tag tag--branche"');
    expect(html).toContain('20% Creatorbudget');
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

  describe('UGC-KSK (automatisch aus Creator-Anteil)', () => {
    function createUgcInstance(details = {}) {
      window.currentUser = { rolle: 'mitarbeiter' };
      const instance = new AuftragsdetailsDetail();
      instance.details = { campaign_type: ['ugc_paid'], ...details };
      instance.auftrag = { id: 'a1', nettobetrag: 10000 };
      instance.kooperationen = [{ id: 'k1', einkaufspreis_netto: 2730, verkaufspreis_netto: 8000, verkaufspreis_zusatzkosten: 0 }];
      instance.videos = [];
      instance.kampagnen = [];
      instance.rechnungen = [];
      instance.rechnungStatusMap = {};
      return instance;
    }

    it('rechnet KSK als 4,9 % der EK-Summe und zeigt die Card ohne manuelle Angabe', () => {
      const instance = createUgcInstance();

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(133.77);
      expect(html).toContain('>KSK<');
      expect(html).toContain('4,9 % vom Creator-Anteil');
      expect(html).toContain('133,77');
    });

    it('rechnet die Auto-KSK ins verbrauchte und verfügbare Budget', () => {
      const instance = createUgcInstance();

      instance.calculateBudgetSummary();

      // 2.730 EK + 5.270 Agenturanteil (EK/VK-Differenz) + 133,77 KSK
      expect(instance.budgetSummary.verbrauchtesBudget).toBeCloseTo(8133.77, 2);
      expect(instance.budgetSummary.verfuegbaresBudget).toBeCloseTo(1866.23, 2);
    });

    it('ignoriert manuellen ksk_value bei UGC', () => {
      const instance = createUgcInstance({ agency_services_enabled: true, ksk_enabled: true, ksk_value: '250' });

      instance.calculateBudgetSummary();

      expect(instance.budgetSummary.agencyFeeSummary.kskValue).toBe(133.77);
    });

    it('zeigt UGC-Reihenfolge Creator-Anteil → Agenturanteil → KSK → Zusatzkosten', () => {
      const instance = createUgcInstance();

      instance.calculateBudgetSummary();
      const html = instance.renderInformationen();

      const iCreator = html.indexOf('Creator-Anteil');
      const iAgentur = html.indexOf('Agenturanteil');
      const iKsk = html.indexOf('>KSK<');
      const iZusatz = html.indexOf('Zusatzkosten');
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
      instance.videos = [];
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
