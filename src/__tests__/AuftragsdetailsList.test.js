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
    document.body.innerHTML = '';
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
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

  it('zeigt im Grid Unternehmen-Karten mit Anzahl und Ansicht-Toggle', async () => {
    const list = new AuftragsdetailsList();
    list._allDetails = [
      { id: '1', auftrag: { unternehmen: { id: 'u1', firmenname: 'Alpha AG' }, marke: { id: 'm1', markenname: 'A1' } } },
      { id: '2', auftrag: { unternehmen: { id: 'u1', firmenname: 'Alpha AG' }, marke: null } },
      { id: '3', auftrag: { unternehmen: { id: 'u2', firmenname: 'Beta GmbH' }, marke: null } }
    ];

    await list.loadAndRender();

    const cards = [...window.content.querySelectorAll('#companies-grid .folder-card')];
    expect(cards.map((c) => c.querySelector('.folder-name').textContent)).toEqual(['Alpha AG', 'Beta GmbH']);
    expect(cards.map((c) => c.querySelector('.folder-count').textContent)).toEqual([
      '2 Auftragsdetails',
      '1 Auftragsdetail'
    ]);
    expect(window.content.querySelector('#btn-view-grid').classList.contains('active')).toBe(true);
    expect(window.content.querySelector('#btn-view-list').classList.contains('active')).toBe(false);
  });

  it('überspringt die Marken-Ebene, wenn ein Unternehmen nur Details ohne Marke hat', async () => {
    const list = new AuftragsdetailsList();
    list._allDetails = [
      { id: '3', auftrag: { unternehmen: { id: 'u2', firmenname: 'Beta GmbH' }, marke: null } }
    ];
    list.viewMode = 'brands';
    list.currentUnternehmenId = 'u2';
    list.currentUnternehmenName = 'Beta GmbH';

    await list.loadAndRender();

    expect(list.viewMode).toBe('items');
    expect(list._ohneMarke).toBe(true);
    expect(list.currentItems.map((d) => d.id)).toEqual(['3']);
  });

  it('wechselt mit dem Toggle auf die flache Liste und zeigt dort den Toggle aktiv', async () => {
    const list = new AuftragsdetailsList();
    list.loadAndRender = vi.fn();

    list.setListViewMode('list');

    expect(list.listViewMode).toBe('list');
    expect(list.viewMode).toBe('companies');
    expect(list.loadAndRender).toHaveBeenCalledTimes(1);

    await list.render();

    expect(window.content.querySelector('#btn-view-list').classList.contains('active')).toBe(true);
    expect(window.content.querySelector('#btn-view-grid').classList.contains('active')).toBe(false);
    expect(window.content.querySelector('table.data-table')).not.toBeNull();
  });

  it('lädt im Grid-Modus alle Zeilen ohne Suche und in Batches', async () => {
    const list = new AuftragsdetailsList();
    list.searchQuery = 'alpha';
    const query = createAuftragDetailsQueryResult([
      { id: '1', auftrag: { auftragsname: 'Beta' } }
    ]);
    window.supabase = { from: vi.fn(() => query) };

    const result = await list.loadDetailsWithPagination({}, 1, 1000, { all: true });

    expect(result.data).toHaveLength(1);
    expect(query.range).toHaveBeenCalledWith(0, 999);
  });
});
