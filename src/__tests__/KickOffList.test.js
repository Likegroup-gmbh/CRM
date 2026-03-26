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
    brand_essenz: 'Wir stehen für Nachhaltigkeit und Innovation in allem was wir tun und mehr als achtzig Zeichen lang ist dieser Text hier',
    created_at: '2025-06-01T10:00:00Z',
    unternehmen: { id: 'u1', firmenname: 'Acme GmbH', internes_kuerzel: 'ACM', logo_url: null },
    marke: { id: 'm1', markenname: 'SuperBrand', logo_url: null, unternehmen: { id: 'u1', firmenname: 'Acme GmbH', internes_kuerzel: 'ACM', logo_url: null } },
  },
  {
    id: '2',
    kickoff_type: 'paid',
    brand_essenz: 'Performance first',
    created_at: '2025-07-15T12:00:00Z',
    unternehmen: { id: 'u2', firmenname: 'Beta Corp', internes_kuerzel: 'BET', logo_url: null },
    marke: null,
  },
  {
    id: '3',
    kickoff_type: 'organic',
    brand_essenz: 'Marke ohne direktes Unternehmen',
    created_at: '2025-08-01T10:00:00Z',
    unternehmen: null,
    marke: { id: 'm2', markenname: 'OnlyMarke', logo_url: null, unternehmen: { id: 'u3', firmenname: 'Gamma AG', internes_kuerzel: 'GAM', logo_url: null } },
  },
];

describe('KickOffList', () => {
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

  it('rendert eine Tabelle mit den Spalten Unternehmen, Marke, Typ, Brand-Essenz, Erstellt am', async () => {
    await list.init();

    const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
    expect(headers).toContain('Unternehmen');
    expect(headers).toContain('Marke');
    expect(headers).toContain('Typ');
    expect(headers).toContain('Brand-Essenz');
    expect(headers).toContain('Erstellt am');
  });

  it('zeigt die Kick-Off-Daten in den Tabellenzeilen an', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);

    const firstRowCells = [...rows[0].querySelectorAll('td')];
    expect(firstRowCells[0].textContent).toContain('ACM');
    expect(firstRowCells[1].textContent).toContain('SuperBrand');
    expect(firstRowCells[2].textContent.toLowerCase()).toContain('organic');
  });

  it('kürzt Brand-Essenz auf maximal 80 Zeichen', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const essenzCell = rows[0].querySelectorAll('td')[3];
    const text = essenzCell.textContent.trim();
    expect(text.length).toBeLessThanOrEqual(83); // 80 + '...'
  });

  it('zeigt "-" wenn keine Marke vorhanden', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const markeCell = rows[1].querySelectorAll('td')[1];
    expect(markeCell.textContent.trim()).toBe('-');
  });

  it('nutzt Avatar-Bubbles für Unternehmen und Marke', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const unternehmenCell = rows[0].querySelectorAll('td')[0];
    const markeCell = rows[0].querySelectorAll('td')[1];
    expect(unternehmenCell.querySelector('.avatar-bubbles')).not.toBeNull();
    expect(markeCell.querySelector('.avatar-bubbles')).not.toBeNull();
  });

  it('zeigt internes Kürzel als Label bei Unternehmen-Bubble', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const label = rows[0].querySelector('td .avatar-bubble-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('ACM');
  });

  it('löst Unternehmen über Marke-Relation auf wenn unternehmen_id null', async () => {
    await list.init();

    const rows = document.querySelectorAll('tbody tr');
    const thirdRowUnternehmen = rows[2].querySelectorAll('td')[0];
    expect(thirdRowUnternehmen.textContent).toContain('GAM');
  });

  it('navigiert bei Klick auf eine Zeile zur Detailseite', async () => {
    await list.init();

    const row = document.querySelector('tbody tr');
    row.click();

    expect(window.navigateTo).toHaveBeenCalledWith('/kickoff/1');
  });

  it('ruft Supabase mit korrekter Tabelle und Select auf', async () => {
    await list.init();

    expect(window.supabase.from).toHaveBeenCalledWith('marke_kickoff');
    expect(window.supabase._query.select).toHaveBeenCalled();
    const selectArg = window.supabase._query.select.mock.calls[0][0];
    expect(selectArg).toContain('unternehmen');
    expect(selectArg).toContain('marke');
  });

  describe('Berechtigungen', () => {
    it('zeigt Create-Button für Admin', async () => {
      window.currentUser = { rolle: 'admin' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).not.toBeNull();
    });

    it('zeigt Create-Button für Mitarbeiter', async () => {
      window.currentUser = { rolle: 'mitarbeiter' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).not.toBeNull();
    });

    it('versteckt Create-Button für Kunde', async () => {
      window.currentUser = { rolle: 'kunde' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).toBeNull();
    });

    it('versteckt Create-Button für Kunde-Editor', async () => {
      window.currentUser = { rolle: 'kunde_editor' };
      await list.init();
      expect(document.getElementById('kickoff-create-btn')).toBeNull();
    });

    it('Kunde sieht nur 3 Spalten: Typ, Brand-Essenz, Erstellt am', async () => {
      window.currentUser = { rolle: 'kunde' };
      await list.init();

      const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
      expect(headers).toHaveLength(3);
      expect(headers).toContain('Typ');
      expect(headers).toContain('Brand-Essenz');
      expect(headers).toContain('Erstellt am');
      expect(headers).not.toContain('Unternehmen');
      expect(headers).not.toContain('Marke');
    });

    it('Admin sieht alle 5 Spalten', async () => {
      window.currentUser = { rolle: 'admin' };
      await list.init();

      const headers = [...document.querySelectorAll('th')].map(th => th.textContent.trim());
      expect(headers).toHaveLength(5);
      expect(headers).toContain('Unternehmen');
      expect(headers).toContain('Marke');
    });
  });
});
