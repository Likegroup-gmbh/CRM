import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KickOffDetail } from '../modules/kickoff/KickOffDetail.js';

const LEGACY_KICKOFF = {
  id: 'ko-1',
  kickoff_type: 'organic',
  schema_version: 'legacy',
  brand_essenz: 'Nachhaltigkeit und Innovation',
  mission: 'Wir machen die Welt besser',
  zielgruppe: 'Frauen 25-35, urban',
  zielgruppen_mindset: 'Umweltbewusst, aktiv',
  marken_usp: 'Einzigartiges Material',
  tonalitaet_sprachstil: 'Locker und professionell',
  content_charakter: 'Modern, clean',
  created_at: '2025-06-01T10:00:00Z',
  updated_at: '2025-06-15T14:00:00Z',
  unternehmen: { id: 'u1', firmenname: 'Acme GmbH' },
  marke: { id: 'm1', markenname: 'SuperBrand' },
};

const V2_KICKOFF = {
  id: 'ko-2',
  kickoff_type: 'influencer',
  schema_version: 'v2',
  kampagnenart: 'influencer',
  kampagnen_zusammenfassung: 'Creator-Kampagne mit TikTok-Fokus auf Gen-Z',
  beworben_typ: 'produkt',
  plattformen: ['tiktok', 'instagram'],
  ziel_influencer: 'awareness',
  format_influencer: 'reel',
  erfolgskriterien: 'Native Optik, Hook in 2 Sek',
  created_at: '2025-08-01T10:00:00Z',
  updated_at: '2025-08-10T14:00:00Z',
  unternehmen: { id: 'u2', firmenname: 'Beta Corp' },
  marke: { id: 'm2', markenname: 'BetaBrand' },
};

const SAMPLE_MARKENWERTE = [
  { markenwert_id: 'mw1', markenwert: { id: 'mw1', name: 'Qualität' } },
  { markenwert_id: 'mw2', markenwert: { id: 'mw2', name: 'Innovation' } },
];

function mockSupabaseForDetail(kickoff, markenwerte = SAMPLE_MARKENWERTE) {
  return {
    from: vi.fn((table) => {
      if (table === 'marke_kickoff') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: kickoff, error: null })),
            })),
          })),
        };
      }
      if (table === 'marke_kickoff_markenwerte') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: markenwerte, error: null })),
          })),
        };
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) };
    }),
  };
}

describe('KickOffDetail (Strategiebriefing)', () => {
  let detail;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => {
      if (typeof el === 'string') {
        window.content.innerHTML = el;
      } else {
        el.innerHTML = html;
      }
    });
    window.navigateTo = vi.fn();
    window.validatorSystem = { sanitizeHtml: (s) => s };
    window.breadcrumbSystem = { updateDetailLabel: vi.fn() };
    window.currentUser = { rolle: 'admin', permissions: { kickoff: { can_view: true, can_edit: true, can_delete: true } } };
  });

  describe('Legacy-Ansicht', () => {
    beforeEach(() => {
      window.supabase = mockSupabaseForDetail(LEGACY_KICKOFF);
      detail = new KickOffDetail();
    });

    it('zeigt Legacy-Felder (Brand-Essenz, Mission, etc.)', async () => {
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('Nachhaltigkeit und Innovation');
      expect(content).toContain('Wir machen die Welt besser');
      expect(content).toContain('Frauen 25-35, urban');
      expect(content).toContain('Legacy');
    });

    it('zeigt Markenwerte als Tags', async () => {
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('Qualität');
      expect(content).toContain('Innovation');
    });

    it('zeigt headline "Strategiebriefing"', async () => {
      await detail.init('ko-1');
      expect(window.setHeadline).toHaveBeenCalledWith('Strategiebriefing');
    });
  });

  describe('v2-Ansicht', () => {
    beforeEach(() => {
      window.supabase = mockSupabaseForDetail(V2_KICKOFF, []);
      detail = new KickOffDetail();
    });

    it('zeigt v2-Felder (Zusammenfassung, Plattformen, etc.)', async () => {
      await detail.init('ko-2');

      const content = window.content.innerHTML;
      expect(content).toContain('Creator-Kampagne mit TikTok-Fokus');
      expect(content).toContain('Zusammenfassung');
      expect(content).toContain('tiktok, instagram');
      expect(content).toContain('awareness');
    });

    it('zeigt Kampagnenart "Influencer"', async () => {
      await detail.init('ko-2');

      const content = window.content.innerHTML;
      expect(content).toContain('Influencer');
    });

    it('zeigt Erfolgskriterien', async () => {
      await detail.init('ko-2');

      const content = window.content.innerHTML;
      expect(content).toContain('Native Optik, Hook in 2 Sek');
    });

    it('lädt keine Markenwerte für v2', async () => {
      await detail.init('ko-2');
      // v2 braucht keine Markenwerte-Junction
      expect(window.supabase.from).not.toHaveBeenCalledWith('marke_kickoff_markenwerte');
    });
  });

  describe('Berechtigungen', () => {
    beforeEach(() => {
      window.supabase = mockSupabaseForDetail(LEGACY_KICKOFF);
      detail = new KickOffDetail();
    });

    it('zeigt Unternehmen und Marke als Link für Admin', async () => {
      window.currentUser = { rolle: 'admin' };
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('href="/unternehmen/u1"');
      expect(content).toContain('href="/marke/m1"');
    });

    it('zeigt Unternehmen und Marke ohne Link für Kunde', async () => {
      window.currentUser = { rolle: 'kunde' };
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('Acme GmbH');
      expect(content).not.toContain('href="/unternehmen/');
    });
  });
});
