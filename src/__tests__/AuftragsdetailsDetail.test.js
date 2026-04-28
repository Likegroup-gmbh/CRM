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

    expect(html).toContain('Gesamtbudget (netto)');
    expect(html).toContain('Verbrauchtes Budget');
    expect(html).toContain('Offenes Budget');
    expect(html).toContain('Extra Kosten');
  });
});
