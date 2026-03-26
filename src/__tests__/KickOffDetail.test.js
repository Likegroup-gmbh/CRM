import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KickOffDetail } from '../modules/kickoff/KickOffDetail.js';

const SAMPLE_KICKOFF = {
  id: 'ko-1',
  kickoff_type: 'organic',
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

const SAMPLE_MARKENWERTE = [
  { markenwert_id: 'mw1', markenwert: { id: 'mw1', name: 'Qualität' } },
  { markenwert_id: 'mw2', markenwert: { id: 'mw2', name: 'Innovation' } },
];

function mockSupabaseForDetail(kickoff = SAMPLE_KICKOFF, markenwerte = SAMPLE_MARKENWERTE) {
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

describe('KickOffDetail', () => {
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
    window.supabase = mockSupabaseForDetail();
    detail = new KickOffDetail();
  });

  it('Sidebar enthält nur Tab-Navigation, keine Info-Items', async () => {
    await detail.init('ko-1');

    const sidebar = document.querySelector('.profile-sidebar');
    const sidebarText = sidebar.innerHTML;

    expect(sidebarText).toContain('secondary-tab-nav');
    expect(sidebarText).toContain('Informationen');
    expect(sidebarText).not.toContain('Brand-Essenz');
    expect(sidebarText).not.toContain('Mission');
  });

  it('Main Content enthält alle Kick-Off-Inhaltsfelder im Informationen-Tab', async () => {
    await detail.init('ko-1');

    const main = document.querySelector('.profile-main-content--secondary-scroll');
    const mainText = main.innerHTML;

    expect(mainText).toContain('Nachhaltigkeit und Innovation');
    expect(mainText).toContain('Wir machen die Welt besser');
    expect(mainText).toContain('Frauen 25-35, urban');
    expect(mainText).toContain('Umweltbewusst, aktiv');
    expect(mainText).toContain('Einzigartiges Material');
    expect(mainText).toContain('Locker und professionell');
    expect(mainText).toContain('Modern, clean');

    expect(mainText).toContain('Acme GmbH');
    expect(mainText).toContain('SuperBrand');
    expect(mainText).toContain('Erstellt am');

    expect(document.querySelector('#tab-informationen')).not.toBeNull();
  });

  it('zeigt Markenwerte als Tags', async () => {
    await detail.init('ko-1');

    const content = window.content.innerHTML;
    expect(content).toContain('Qualität');
    expect(content).toContain('Innovation');
  });

  it('zeigt den Typ als Tag (nicht Badge)', async () => {
    await detail.init('ko-1');

    const content = window.content.innerHTML;
    expect(content).toContain('<span class="tag">Organic</span>');
    expect(content).not.toContain('badge');
  });

  it('nutzt das Secondary-Nav-Layout wie MarkeDetail', async () => {
    await detail.init('ko-1');

    expect(document.querySelector('.profile-page-wrapper')).not.toBeNull();
    expect(document.querySelector('.profile-detail-layout--secondary-nav')).not.toBeNull();
    expect(document.querySelector('.secondary-tab-nav')).not.toBeNull();
    expect(document.querySelector('.profile-main-content--secondary-scroll')).not.toBeNull();
  });

  describe('Berechtigungen', () => {
    it('zeigt keine Quick-Action-Buttons', async () => {
      window.currentUser = { rolle: 'admin' };
      await detail.init('ko-1');

      const actions = document.querySelectorAll('.profile-action-btn');
      expect(actions.length).toBe(0);
    });

    it('zeigt keine Bearbeiten-Action für Kunde', async () => {
      window.currentUser = { rolle: 'kunde' };
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).not.toContain('Bearbeiten');
    });

    it('zeigt Unternehmen und Marke ohne Link für Kunde', async () => {
      window.currentUser = { rolle: 'kunde' };
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('Acme GmbH');
      expect(content).toContain('SuperBrand');
      expect(content).not.toContain('href="/unternehmen/');
      expect(content).not.toContain('href="/marke/');
    });

    it('zeigt Unternehmen und Marke als Link für Admin', async () => {
      window.currentUser = { rolle: 'admin' };
      await detail.init('ko-1');

      const content = window.content.innerHTML;
      expect(content).toContain('href="/unternehmen/u1"');
      expect(content).toContain('href="/marke/m1"');
    });
  });
});
