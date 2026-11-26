import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragsdetailsDetail } from '../modules/auftrag/AuftragsdetailsDetail.js';
import { setupAuftragsdetailsGlobals, videosAusKoops } from './AuftragsdetailsTestKit.js';

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
  setupAuftragsdetailsGlobals();

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

  it('zeigt Formel-Tooltips auf den UGC-Budget-Kacheln', () => {
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
      agencyFeeSummary: { baseFee: 500, ekVkMargin: 200, total: 700, showAgencyFeeCard: true, showKskCard: true, kskValue: 98, kskAuto: true, kskBasis: 2000 },
      totalCreators: 2,
      targetCreators: 4,
      totalVideos: 3,
      targetVideos: 6
    };

    const html = instance.renderInformationen();

    expect(html).toContain('card-hint');
    expect(html).toContain('Nettobetrag des Auftrags');
    expect(html).toContain('Creatoranteil + Agenturanteil + KSK + Zusatzkosten');
    expect(html).toContain('Auftragsvolumen − Zusatzleistungen − Verbrauchtes Budget');
    expect(html).toContain('Σ Einkaufspreise (EK) der gebuchten Videos');
    expect(html).toContain('Feste Fee + EK/VK-Differenz');
    expect(html).toContain('Σ Zusatzkosten der Kooperationen');
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
    instance.videos = videosAusKoops(instance.kooperationen);
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
    instance.videos = videosAusKoops(instance.kooperationen);
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
    instance.videos = videosAusKoops(instance.kooperationen);
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
    instance.videos = videosAusKoops(instance.kooperationen);
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
    instance.videos = videosAusKoops(instance.kooperationen);
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
    instance.videos = videosAusKoops(instance.kooperationen);
    instance.kampagnen = [{ id: 'ka1', kampagnenname: 'Test', videoanzahl: 1, creatoranzahl: 1 }];

    instance.calculateBudgetSummary();
    const html = instance.renderCreatorVideosTable();

    expect(html).toContain('class="tag tag--branche"');
    expect(html).toContain('20% Creatorbudget');
  });
});
