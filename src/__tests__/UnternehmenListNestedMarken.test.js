import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnternehmenList } from '../modules/unternehmen/UnternehmenList.js';

function chain(data = []) {
  const result = Promise.resolve({ data, error: null });
  const c = {
    select: vi.fn(() => c),
    in: vi.fn(() => result),
    eq: vi.fn(() => c)
  };
  return c;
}

function mountTable() {
  document.body.innerHTML = `
    <table class="data-table data-table--unternehmen">
      <tbody class="table-loading-overlay">
        <tr><td class="loading">Lade</td></tr>
      </tbody>
    </table>
  `;
}

const mueller = {
  id: 'u1',
  firmenname: 'Müller GmbH',
  internes_kuerzel: 'Müller',
  rechnungsadresse_stadt: 'Hamburg',
  rechnungsadresse_land: 'DE',
  branchen: []
};

describe('UnternehmenList – nested Marken', () => {
  let list;

  beforeEach(() => {
    vi.clearAllMocks();
    window.validatorSystem = { sanitizeHtml: (value) => value };
    window.navigateTo = vi.fn();
    window.currentUser = { id: 'admin-1', rolle: 'admin' };
    mountTable();
    list = new UnternehmenList();
  });

  afterEach(() => {
    list?.destroy();
  });

  it('klappt sichtbare Marken unter einem Unternehmen auf', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'marke') {
          return chain([
            { id: 'm-bio', markenname: 'Müller Bio', logo_url: null, unternehmen_id: 'u1' },
            { id: 'm-kids', markenname: 'Müller Kids', logo_url: null, unternehmen_id: 'u1' }
          ]);
        }
        return chain([]);
      })
    };

    await list.updateTable([mueller]);
    list.bindAdditionalEvents(new AbortController().signal);

    const toggle = document.querySelector('.unternehmen-marken-toggle');
    expect(toggle).not.toBeNull();
    expect(document.body.textContent).not.toContain('Müller Bio');

    toggle.click();

    expect(document.body.textContent).toContain('Müller Bio');
    expect(document.body.textContent).toContain('Müller Kids');
    const nestedLink = document.querySelector('a.table-link[data-table="marke"][data-id="m-bio"]');
    expect(nestedLink).not.toBeNull();
    expect(nestedLink.closest('td').getAttribute('colspan')).toBe('3');
    expect(document.querySelector('.nested-marke-row .marke-check')).toBeNull();
    expect(document.querySelector('.nested-marke-row .unternehmen-check')).toBeNull();
  });

  it('zeigt ohne sichtbare Marken keinen Chevron', async () => {
    window.supabase = { from: vi.fn(() => chain([])) };
    await list.updateTable([mueller]);
    expect(document.querySelector('.unternehmen-marken-toggle')).toBeNull();
    expect(document.querySelector('.nested-marke-row')).toBeNull();
  });

  it('sortiert Nested-Marken nach Markenname A–Z', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'marke') {
          return chain([
            { id: 'm-z', markenname: 'Zeta', logo_url: null, unternehmen_id: 'u1' },
            { id: 'm-a', markenname: 'Alpha', logo_url: null, unternehmen_id: 'u1' }
          ]);
        }
        return chain([]);
      })
    };

    await list.updateTable([mueller]);
    list.bindAdditionalEvents(new AbortController().signal);
    document.querySelector('.unternehmen-marken-toggle').click();

    const names = [...document.querySelectorAll('.nested-marke-row a.table-link')].map((el) => el.textContent.trim());
    expect(names).toEqual(['Alpha', 'Zeta']);
  });

  it('blendet für Nicht-Admins nicht erlaubte Marken aus', async () => {
    list.destroy();
    window.currentUser = { id: 'user-1', rolle: 'mitarbeiter' };
    list = new UnternehmenList();

    const bio = { id: 'm-bio', markenname: 'Müller Bio', logo_url: null, unternehmen_id: 'u1' };
    const kids = { id: 'm-kids', markenname: 'Müller Kids', logo_url: null, unternehmen_id: 'u1' };

    window.supabase = {
      from: vi.fn((table) => {
        const c = {
          select: vi.fn(() => c),
          in: vi.fn((col) => {
            if (table === 'marke' && col === 'unternehmen_id') {
              return Promise.resolve({ data: [bio, kids], error: null });
            }
            if (table === 'marke' && col === 'id') {
              return Promise.resolve({ data: [{ id: 'm-bio', unternehmen_id: 'u1' }], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
          eq: vi.fn(() => {
            if (table === 'marke_mitarbeiter') {
              return Promise.resolve({ data: [{ marke_id: 'm-bio' }], error: null });
            }
            if (table === 'mitarbeiter_unternehmen') {
              return Promise.resolve({ data: [{ unternehmen_id: 'u1' }], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          })
        };
        return c;
      })
    };

    await list.updateTable([mueller]);
    list.bindAdditionalEvents(new AbortController().signal);
    document.querySelector('.unternehmen-marken-toggle').click();

    expect(document.body.textContent).toContain('Müller Bio');
    expect(document.body.textContent).not.toContain('Müller Kids');
  });

  it('zeigt Neue Marke anlegen neben neuem Unternehmen', () => {
    const html = list.renderShellContent();
    expect(html).toContain('id="btn-unternehmen-new"');
    expect(html).toContain('id="btn-marke-new"');
  });

  it('blendet Neue Marke anlegen ohne Marke-edit aus', () => {
    list.destroy();
    window.currentUser = { id: 'user-1', rolle: 'mitarbeiter' };
    list = new UnternehmenList();
    const html = list.renderShellContent();
    expect(html).not.toContain('id="btn-marke-new"');
  });

  it('füllt Nested-Zeile mit Marken-Daten und Aktionen', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'marke') {
          return chain([{
            id: 'm-bio',
            markenname: 'Müller Bio',
            logo_url: null,
            webseite: 'https://bio.example',
            unternehmen_id: 'u1',
            branchen: [{ branche: { id: 'b1', name: 'Food' } }],
            ansprechpartner: [{
              ansprechpartner: { id: 'ap1', vorname: 'Max', nachname: 'Mustermann', profile_image_url: null }
            }]
          }]);
        }
        if (table === 'marke_mitarbeiter') {
          return chain([{
            marke_id: 'm-bio',
            role: 'management',
            benutzer: { id: 'u-mgmt', name: 'Pat Lead', profile_image_url: null }
          }]);
        }
        return chain([]);
      })
    };

    await list.updateTable([mueller]);
    list.bindAdditionalEvents(new AbortController().signal);
    document.querySelector('.unternehmen-marken-toggle').click();

    const row = document.querySelector('.nested-marke-row');
    expect(row.textContent).toContain('Food');
    expect(row.querySelector('a.external-link-btn')?.getAttribute('href')).toContain('bio.example');
    expect(row.querySelector('[title="Max Mustermann"]')).not.toBeNull();
    expect(row.querySelector('[title="Pat Lead"]')).not.toBeNull();
    expect(row.querySelector('[data-entity-type="marke"]')).not.toBeNull();
  });

  it('klappt Suchtreffer-Marke automatisch auf und highlightet sie', async () => {
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'marke') {
          return chain([
            { id: 'm-bio', markenname: 'Müller Bio', logo_url: null, unternehmen_id: 'u1' },
            { id: 'm-kids', markenname: 'Müller Kids', logo_url: null, unternehmen_id: 'u1' }
          ]);
        }
        return chain([]);
      })
    };

    list.searchQuery = 'Bio';
    await list.updateTable([mueller]);

    const hit = document.querySelector('.nested-marke-row[data-id="m-bio"]');
    const other = document.querySelector('.nested-marke-row[data-id="m-kids"]');
    expect(hit).not.toBeNull();
    expect(hit.classList.contains('is-search-match')).toBe(true);
    expect(other).not.toBeNull();
    expect(other.classList.contains('is-search-match')).toBe(false);

    list.searchQuery = '';
    await list.updateTable([mueller]);
    expect(document.querySelector('.nested-marke-row')).toBeNull();
  });
});


