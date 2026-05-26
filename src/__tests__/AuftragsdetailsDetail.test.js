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
    instance.details = {};
    instance.auftrag = { id: 'a1', po: 'PO-1' };
    instance.budgetSummary = {
      totalBudget: 10000,
      usedVkBudget: 2500,
      extraKostenVkSum: 500,
      totalCreators: 2,
      targetCreators: 4,
      totalVideos: 3,
      targetVideos: 6
    };

    const html = instance.renderInformationen();

    expect(html).toContain('Gesamt Nettobetrag');
    expect(html).toContain('Verbrauchtes Creatorbudget');
    expect(html).toContain('Offenes Budget');
    expect(html).toContain('Extra Kosten');
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
    expect(html).toContain('Agentur Fee');
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

    expect(html).toContain('Agentur Fee');
    expect(html).not.toContain('Festgelegt');
    expect(html).not.toContain('EK/VK-Differenz');
    expect(html).not.toContain('KSK');
    expect(html).not.toContain('Gesamt Nettobetrag');
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

    expect(html).toContain('Agentur Fee');
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
});
