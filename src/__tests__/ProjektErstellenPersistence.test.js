import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/auftrag/logic/PoNummerGenerator.js', () => ({
  generatePoNummer: vi.fn(async () => ({ success: true, poNummer: 'PO-2026-001' }))
}));

import { ProjektErstellenPersistence } from '../modules/projekt-erstellen/services/ProjektErstellenPersistence.js';
import { ProjektErstellenValidator } from '../modules/projekt-erstellen/services/ProjektErstellenValidator.js';

function createInsertQuery(data) {
  return {
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data, error: null }))
    }))
  };
}

describe('ProjektErstellenPersistence', () => {
  let inserted;
  let persistence;

  beforeEach(() => {
    inserted = {};
    persistence = new ProjektErstellenPersistence();
    window.currentUser = { id: 'user-1' };
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'kampagne_art_typen') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  { id: 'art-ugc-paid', name: 'UGC Paid' },
                  { id: 'art-vorort', name: 'Vor-Ort-Produktion' }
                ],
                error: null
              }))
            }))
          };
        }

        return {
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
        };
      })
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

  it('lässt mehrfach verwendete Angebotsnummern zu', async () => {
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

    expect(result.success).toBe(true);
    expect(inserted.auftrag.angebotsnummer).toBe('AN-100');
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

  it('speichert das Creator-Budget als Netto abzüglich Zusatzleistungen, Agentur Fee und KSK', async () => {
    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne',
          nettobetrag: 100000
        },
        details: {
          agency_services_enabled: true,
          retainer_type: 'monthly',
          retainer_amount: 5000,
          extra_services_enabled: true,
          extra_services: [
            { name: 'Grafikdesign', amount: 10000 }
          ],
          percentage_fee_enabled: true,
          percentage_fee_value: 20000,
          ksk_enabled: true,
          ksk_type: 'fixed',
          ksk_value: 10000
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result.success).toBe(true);
    expect(inserted.auftrag.creator_budget).toBe(60000);
    expect(inserted.auftrag_details.retainer_amount).toBe(5000);
    expect(inserted.auftrag_details.ksk_type).toBe('fixed');
  });

  it('setzt das Creator-Budget bei deaktivierten Agenturleistungen auf den Nettobetrag', async () => {
    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne',
          nettobetrag: 100000
        },
        details: {
          agency_services_enabled: false,
          extra_services_enabled: true,
          extra_services: [
            { name: 'Grafikdesign', amount: 10000 }
          ],
          percentage_fee_enabled: true,
          percentage_fee_value: 20000,
          ksk_enabled: true,
          ksk_value: 10000
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result.success).toBe(true);
    expect(inserted.auftrag.creator_budget).toBe(100000);
  });

  it('speichert wiederholte Kampagnenarten als separate Blöcke und aggregiert Legacy-Spalten', async () => {
    const result = await persistence.submit({
      formData: {
        auftrag: {
          unternehmen_id: 'unternehmen-1',
          marke_id: 'marke-1',
          ansprechpartner_id: 'ansprechpartner-1',
          titel: 'Neue Kampagne'
        },
        details: {
          campaign_blocks: [
            {
              id: 'block-1',
              campaign_type: 'ugc_paid',
              video_anzahl: 2,
              creator_anzahl: 1,
              einkaufspreis_netto_von: 100,
              einkaufspreis_netto_bis: 150,
              verkaufspreis_netto_von: 200,
              verkaufspreis_netto_bis: 250,
              budget_info: 'Erster Block'
            },
            {
              id: 'block-2',
              campaign_type: 'ugc_paid',
              video_anzahl: 3,
              creator_anzahl: 2,
              einkaufspreis_netto_von: 120,
              einkaufspreis_netto_bis: 180,
              verkaufspreis_netto_von: 240,
              verkaufspreis_netto_bis: 300,
              budget_info: 'Zweiter Block'
            },
            {
              id: 'block-3',
              campaign_type: 'vorort_produktion',
              video_anzahl: 1,
              creator_anzahl: 1
            }
          ]
        },
        kampagne: {
          kampagnenname: 'Neue Kampagne'
        }
      }
    });

    expect(result.success).toBe(true);
    expect(inserted.auftrag_details.campaign_type).toEqual(['ugc_paid', 'ugc_paid', 'vorort_produktion']);
    expect(inserted.auftrag_details.gesamt_videos).toBe(6);
    expect(inserted.auftrag_details.ugc_paid_video_anzahl).toBe(5);
    expect(inserted.auftrag_details.ugc_paid_creator_anzahl).toBe(3);
    expect(inserted.auftrag_details.ugc_paid_einkaufspreis_netto_von).toBe(100);
    expect(inserted.auftrag_details.ugc_paid_einkaufspreis_netto_bis).toBe(180);

    expect(inserted.auftrag_kampagnenart_blocks).toMatchObject([
      {
        auftrag_id: 'auftrag-1',
        kampagne_id: 'kampagne-1',
        kampagne_art_id: 'art-ugc-paid',
        campaign_type: 'ugc_paid',
        status: 'offen'
      },
      {
        auftrag_id: 'auftrag-1',
        kampagne_id: 'kampagne-1',
        kampagne_art_id: 'art-ugc-paid',
        campaign_type: 'ugc_paid',
        status: 'offen'
      },
      {
        auftrag_id: 'auftrag-1',
        kampagne_id: 'kampagne-1',
        kampagne_art_id: 'art-vorort',
        campaign_type: 'vorort_produktion',
        status: 'offen'
      }
    ]);
  });
});

describe('ProjektErstellenValidator', () => {
  it('verhindert Agentur-Abzüge über dem Netto-Budget', () => {
    const validator = new ProjektErstellenValidator();

    const result = validator.validateStep2({
      auftrag: {
        angebotsnummer: 'AN-100',
        nettobetrag: 100000
      },
      details: {
        agency_services_enabled: true,
        extra_services_enabled: true,
        extra_services: [
          { name: 'Grafikdesign', amount: 80000 }
        ],
        percentage_fee_enabled: true,
        percentage_fee_value: 20000,
        ksk_enabled: true,
        ksk_value: 10000
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Agentur Fee, KSK und Zusatzleistungen dürfen das Netto-Budget nicht überschreiten');
  });
});
