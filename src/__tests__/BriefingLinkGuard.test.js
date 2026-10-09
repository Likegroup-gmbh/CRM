import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertBriefingForCreate } from '../modules/briefing/BriefingLinkGuard.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import { insertStrategie } from '../modules/strategie/service/strategieRecord.js';

function mockSupabase(briefing, inserted) {
  return {
    from: (table) => {
      if (table === 'campaign_briefings') {
        const q = {
          select: () => q,
          eq: () => q,
          single: async () => ({ data: briefing, error: briefing ? null : { message: 'nicht gefunden' } })
        };
        return q;
      }
      const q = {
        insert: (row) => {
          inserted.push({ table, row });
          return q;
        },
        select: () => q,
        single: async () => ({ data: { id: `${table}-neu`, ...inserted.at(-1).row }, error: null })
      };
      return q;
    }
  };
}

const briefing = (patch = {}) => ({
  id: 'b1',
  unternehmen_id: 'u1',
  marke_id: null,
  is_draft: false,
  produktion_id: 'prod-1',
  produktion: { kampagne_id: 'kamp-1' },
  ...patch
});

describe('Briefing-Pflicht bei Casting und Konzept', () => {
  let inserted;

  beforeEach(() => {
    inserted = [];
    window.isKunde = () => false;
    window.currentUser = { id: 'user-1' };
  });

  it('übernimmt die Produktion des Briefings', async () => {
    window.supabase = mockSupabase(briefing(), inserted);
    const data = { briefing_id: 'b1', unternehmen_id: 'u1', kampagne_id: 'kamp-1' };

    await assertBriefingForCreate(data, 'Konzept');

    expect(data.produktion_id).toBe('prod-1');
  });

  it('überschreibt eine gesetzte Produktion nicht', async () => {
    window.supabase = mockSupabase(briefing(), inserted);
    const data = { briefing_id: 'b1', kampagne_id: 'kamp-1', produktion_id: 'prod-9' };

    await assertBriefingForCreate(data, 'Konzept');

    expect(data.produktion_id).toBe('prod-9');
  });

  it('leitet nichts ab, wenn die Kampagne eine andere ist', async () => {
    window.supabase = mockSupabase(briefing(), inserted);
    const data = { briefing_id: 'b1', kampagne_id: 'andere-kampagne' };

    await assertBriefingForCreate(data, 'Konzept');

    expect(data.produktion_id).toBeUndefined();
  });

  it('lehnt ein Briefing ohne Produktion mit klarer Meldung ab', async () => {
    window.supabase = mockSupabase(briefing({ produktion_id: null, produktion: null }), inserted);

    await expect(assertBriefingForCreate({ briefing_id: 'b1' }, 'Casting-Liste'))
      .rejects.toThrow('an keiner Produktion');
  });

  it('legt ein Casting aus der Seitenleiste mit der Produktion des Briefings an', async () => {
    window.supabase = mockSupabase(briefing(), inserted);
    vi.spyOn(window, 'isKunde').mockReturnValue(false);

    await creatorAuswahlService.createListe({
      name: 'Sourcing - Test',
      briefing_id: 'b1',
      kampagne_id: 'kamp-1',
      unternehmen_id: 'u1'
    });

    expect(inserted[0].table).toBe('creator_auswahl');
    expect(inserted[0].row).toMatchObject({ briefing_id: 'b1', produktion_id: 'prod-1' });
  });

  it('legt ein Konzept aus der Seitenleiste mit der Produktion des Briefings an', async () => {
    window.supabase = mockSupabase(briefing(), inserted);

    await insertStrategie({
      name: 'Konzept Test',
      briefing_id: 'b1',
      kampagne_id: 'kamp-1',
      unternehmen_id: 'u1'
    });

    expect(inserted[0].table).toBe('strategie');
    expect(inserted[0].row).toMatchObject({ briefing_id: 'b1', produktion_id: 'prod-1' });
  });
});
