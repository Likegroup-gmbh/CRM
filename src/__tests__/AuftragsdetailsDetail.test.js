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
    window.notizenSystem = null;
    window.bewertungsSystem = null;
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

    const updateBreadcrumb = vi.fn();
    window.breadcrumbSystem = { updateBreadcrumb };
    window.currentUser = {
      rolle: 'mitarbeiter',
      permissions: {
        auftrag: { can_edit: true },
        auftragsdetails: { can_edit: false }
      }
    };

    const instance = new AuftragsdetailsDetail();
    await instance.init('d1');

    const breadcrumbArgs = updateBreadcrumb.mock.calls[0][1];
    expect(breadcrumbArgs.canEdit).toBe(false);
  });
});
