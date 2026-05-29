import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KickOffList } from '../modules/kickoff/KickOffList.js';

function mockSupabase(data = []) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return {
    from: vi.fn(() => query),
    _query: query,
  };
}

const SAMPLE_KICKOFFS = [
  {
    id: '1',
    kickoff_type: 'organic',
    schema_version: 'legacy',
    brand_essenz: 'Wir stehen für Nachhaltigkeit und Innovation in allem was wir tun und mehr als achtzig Zeichen lang ist dieser Text hier',
    created_at: '2025-06-01T10:00:00Z',
    unternehmen: { id: 'u1', firmenname: 'Acme GmbH', internes_kuerzel: 'ACM', logo_url: null },
    marke: { id: 'm1', markenname: 'SuperBrand', logo_url: null, unternehmen: { id: 'u1', firmenname: 'Acme GmbH', internes_kuerzel: 'ACM', logo_url: null } },
  },
  {
    id: '2',
    kickoff_type: 'paid',
    schema_version: 'v2',
    kampagnenart: 'paid',
    kampagnen_zusammenfassung: 'Performance-Kampagne mit ROAS-Ziel',
    created_at: '2025-07-15T12:00:00Z',
    unternehmen: { id: 'u2', firmenname: 'Beta Corp', internes_kuerzel: 'BET', logo_url: null },
    marke: null,
  },
  {
    id: '3',
    kickoff_type: 'influencer',
    schema_version: 'v2',
    kampagnenart: 'influencer',
    kampagnen_zusammenfassung: 'Creator-Content mit TikTok-Fokus',
    created_at: '2025-08-01T10:00:00Z',
    unternehmen: null,
    marke: { id: 'm2', markenname: 'OnlyMarke', logo_url: null, unternehmen: { id: 'u3', firmenname: 'Gamma AG', internes_kuerzel: 'GAM', logo_url: null } },
  },
];

describe('KickOffList (Strategiebriefing)', () => {
  let list;

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
    window.currentUser = { rolle: 'admin', permissions: { kickoff: { can_view: true, can_edit: true, can_delete: true } } };
    window.supabase = mockSupabase(SAMPLE_KICKOFFS);
    list = new KickOffList();
  });

  it('rendert Spalten: Unternehmen, Marke, Kampagnenart, Zusammenfassung, Erstellt am', async () => {
    await list.init();

    const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
    expect(headers).toContain('Unternehmen');
    expect(headers).toContain('Marke');
    expect(headers).toContain('Kampagnenart');
    expect(headers).toContain('Zusammenfassung');
    expect(headers).toContain('Erstellt am');
  });

  it('zeigt Legacy-Daten mit brand_essenz als Zusammenfassung', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);

    const firstRowCells = [...rows[0].querySelectorAll('td')];
    expect(firstRowCells[3].textContent).toContain('Nachhaltigkeit');
  });

  it('zeigt v2-Daten mit kampagnen_zusammenfassung', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const secondRowCells = [...rows[1].querySelectorAll('td')];
    expect(secondRowCells[3].textContent).toContain('Performance-Kampagne');
  });

  it('zeigt Influencer-Typ für v2-Einträge', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const thirdRowCells = [...rows[2].querySelectorAll('td')];
    expect(thirdRowCells[2].textContent).toContain('Influencer');
  });

  it('markiert Legacy-Einträge mit Legacy-Tag', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].innerHTML).toContain('Legacy');
    expect(rows[1].innerHTML).not.toContain('Legacy');
  });

  it('kürzt Zusammenfassung auf maximal 80 Zeichen', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const summaryCell = rows[0].querySelectorAll('td')[3];
    const text = summaryCell.textContent.trim();
    expect(text.length).toBeLessThanOrEqual(83);
  });

  it('navigiert bei Klick auf eine Zeile zur Detailseite', async () => {
    await list.init();

    const row = document.querySelector('tbody tr');
    row.click();

    expect(window.navigateTo).toHaveBeenCalledWith('/kickoff/1');
  });

  it('zeigt headline "Strategiebriefings"', async () => {
    await list.init();
    expect(window.setHeadline).toHaveBeenCalledWith('Strategiebriefings');
  });

  describe('Berechtigungen', () => {
    it('zeigt Create-Button für Admin', async () => {
      window.currentUser = { rolle: 'admin' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).not.toBeNull();
    });

    it('versteckt Create-Button für Kunde', async () => {
      window.currentUser = { rolle: 'kunde' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).toBeNull();
    });

    it('Kunde sieht nur 3 Spalten: Kampagnenart, Zusammenfassung, Erstellt am', async () => {
      window.currentUser = { rolle: 'kunde' };
      await list.init();

      const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
      expect(headers).toHaveLength(3);
      expect(headers).toContain('Kampagnenart');
      expect(headers).toContain('Zusammenfassung');
      expect(headers).toContain('Erstellt am');
    });

    it('Admin sieht alle 5 Spalten', async () => {
      window.currentUser = { rolle: 'admin' };
      await list.init();

      const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
      expect(headers).toHaveLength(5);
    });
  });
});
