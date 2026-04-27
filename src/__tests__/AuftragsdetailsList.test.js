import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragsdetailsList } from '../modules/auftrag/AuftragsdetailsList.js';

function createAuftragDetailsQueryResult(data, count = data.length) {
  const query = {
    _result: { data, error: null, count },
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve) => resolve(query._result)
  };
  return query;
}

describe('AuftragsdetailsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.currentUser = { rolle: 'admin' };
    window.content = document.createElement('div');
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((element, html) => {
      element.innerHTML = html;
    });
  });

  it('liefert bei Suchbegriff konsistente count+Pagination clientseitig', async () => {
    const list = new AuftragsdetailsList();
    list.searchQuery = 'alpha';

    const data = [
      { id: '1', auftrag: { auftragsname: 'Alpha 1', unternehmen: { firmenname: 'U1' }, marke: { markenname: 'M1' }, po: 'PO-1' } },
      { id: '2', auftrag: { auftragsname: 'Beta', unternehmen: { firmenname: 'U2' }, marke: { markenname: 'M2' }, po: 'PO-2' } },
      { id: '3', auftrag: { auftragsname: 'Alpha 2', unternehmen: { firmenname: 'U3' }, marke: { markenname: 'M3' }, po: 'PO-3' } }
    ];

    const query = createAuftragDetailsQueryResult(data, data.length);
    window.supabase = {
      from: vi.fn((table) => {
        if (table === 'auftrag_details') return query;
        throw new Error(`Unexpected table ${table}`);
      })
    };

    const result = await list.loadDetailsWithPagination({}, 1, 1);

    // Zwei Treffer insgesamt, aber wegen limit=1 nur ein Datensatz auf Seite 1
    expect(result.count).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');

    // Bei aktivem Search-Flow darf kein serverseitiges range greifen
    expect(query.range).not.toHaveBeenCalled();
    expect(query.select.mock.calls[0][0]).not.toContain('titel');
    expect(query.select.mock.calls[0][0]).not.toContain('notiz');
  });

  it('rendert Auftrag als erste Inhaltsspalte und entfernt Titel', async () => {
    const list = new AuftragsdetailsList();

    await list.render();

    const headers = [...window.content.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).toEqual([
      'Auftrag',
      'Unternehmen',
      'Marke',
      'PO intern',
      'Status',
      'Start',
      'Ende',
      'Erstellt am',
      'Erstellt von',
      'Aktionen'
    ]);
    expect(headers).not.toContain('Titel');
  });
});
