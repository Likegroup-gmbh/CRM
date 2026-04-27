import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/auftrag/logic/PoNummerGenerator.js', () => ({
  generatePoNummer: vi.fn(async () => ({ success: true, poNummer: 'PO-2026-001' }))
}));

import { ProjektErstellenPersistence } from '../modules/projekt-erstellen/services/ProjektErstellenPersistence.js';

function createInsertQuery(data) {
  return {
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data, error: null }))
    }))
  };
}

function createSelectQuery(rows = []) {
  return {
    eq: vi.fn(() => ({
      limit: vi.fn(async () => ({ data: rows, error: null }))
    }))
  };
}

describe('ProjektErstellenPersistence', () => {
  let inserted;
  let existingAuftraege;
  let persistence;

  beforeEach(() => {
    inserted = {};
    existingAuftraege = [];
    persistence = new ProjektErstellenPersistence();
    window.currentUser = { id: 'user-1' };
    window.supabase = {
      from: vi.fn((table) => ({
        select: vi.fn(() => createSelectQuery(table === 'auftrag' ? existingAuftraege : [])),
        insert: vi.fn((payload) => {
          inserted[table] = payload;

          if (table === 'auftrag') {
            return createInsertQuery({ id: 'auftrag-1' });
          }

          if (table === 'kampagne') {
            return createInsertQuery({ id: 'kampagne-1' });
          }

          return Promise.resolve({ error: null });
        })
      }))
    };
  });

  it('verknüpft den gewählten Ansprechpartner mit der neu angelegten Kampagne', async () => {
    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne'
        },
        details: {
          campaign_type: []
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result).toEqual({
      success: true,
      auftragId: 'auftrag-1',
      kampagneId: 'kampagne-1'
    });
    expect(inserted.auftrag.ansprechpartner_id).toBe('ansprechpartner-1');
    expect(inserted.ansprechpartner_kampagne).toEqual({
      kampagne_id: 'kampagne-1',
      ansprechpartner_id: 'ansprechpartner-1'
    });
  });

  it('bricht ab, wenn die Angebotsnummer bereits existiert', async () => {
    existingAuftraege = [{ id: 'auftrag-existing' }];

    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne',
          angebotsnummer: 'AN-100'
        },
        details: {
          campaign_type: []
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result).toEqual({
      success: false,
      error: 'Diese Angebotsnummer ist bereits einem anderen Auftrag zugewiesen.'
    });
    expect(inserted.auftrag).toBeUndefined();
  });

  it('speichert Angebotsnummern ohne führende oder folgende Leerzeichen', async () => {
    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne',
          angebotsnummer: '  AN-100  '
        },
        details: {
          campaign_type: []
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result.success).toBe(true);
    expect(inserted.auftrag.angebotsnummer).toBe('AN-100');
  });
});
