import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { renderItemsTable, renderAddSection } from '../modules/creator-auswahl/castingTableRender.js';

function makeItem(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    name: '',
    notiz: '',
    absage: false,
    gebucht: false,
    on_hold: false,
    ...overrides
  };
}

describe('CreatorAuswahlDetail – Namenssuche', () => {
  let detail;

  beforeEach(() => {
    detail = new CreatorAuswahlDetail();
    detail.items = [
      makeItem({ id: '1', name: 'Anna Müller' }),
      makeItem({ id: '2', name: 'Ben Schulz', gebucht: true }),
      makeItem({ id: '3', name: 'annalena.creator', on_hold: true }),
      makeItem({ id: '4', name: null, notiz: 'Anna im Notizfeld' }),
      makeItem({ id: '5', name: 'Chris', absage: true }),
      makeItem({ id: '6', name: 'Anna Abgelehnt', abgelehnt: true })
    ];
    detail.activeTab = 'alle';
  });

  it('filtert case-insensitiv und mit Teiltreffern nur über die Spalte name', () => {
    detail.searchQuery = 'anna';
    const result = detail.getFilteredItems();
    expect(result.map(i => i.id)).toEqual(['1', '3']);
    // Item 4 matcht nur in der Notiz, Item 6 ist im Reiter Abgelehnt
    expect(result.some(i => i.id === '4')).toBe(false);
    expect(result.some(i => i.id === '6')).toBe(false);
  });

  it('ignoriert führende/nachgestellte Leerzeichen im Suchbegriff', () => {
    detail.searchQuery = '  Anna  ';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['1', '3']);
  });

  it('liefert bei leerer Suche aktive Items unter Alle und Abgesagt/Abgelehnt unter Abgelehnt', () => {
    detail.searchQuery = '';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['1', '2', '3', '4']);

    detail.activeTab = 'abgelehnt';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['5', '6']);
  });

  it('kombiniert Suche und Reiter Alle/Abgelehnt', () => {
    detail.searchQuery = 'anna';
    detail.activeTab = 'abgelehnt';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['6']);

    detail.searchQuery = 'ben';
    expect(detail.getFilteredItems()).toHaveLength(0);
  });

  it('behandelt Items ohne Namen robust', () => {
    detail.searchQuery = 'irgendwas';
    expect(() => detail.getFilteredItems()).not.toThrow();
    expect(detail.getFilteredItems()).toHaveLength(0);
  });

  it('berechnet Tab-Counts auf Basis der Suchtreffer', () => {
    detail.searchQuery = 'anna';
    const counts = detail.getTabCounts();
    expect(counts).toEqual({
      alle: 2,
      abgelehnt: 1,
      bewerbung: 0
    });
  });

  it('wechselt bei ensureNewItemVisible nach Alle bzw. in den Reiter eines vorhandenen Eintrags', () => {
    const spy = vi.spyOn(detail, 'rerenderTable').mockImplementation(() => {});
    detail.activeTab = 'abgelehnt';
    detail.ensureNewItemVisible();
    expect(detail.activeTab).toBe('alle');

    detail.ensureNewItemVisible({ id: '6', abgelehnt: true });
    expect(detail.activeTab).toBe('abgelehnt');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('platziert die Tab-Leiste im Footer unter dem Tabellenbereich (standalone und embedded)', async () => {
    const root = document.createElement('div');
    const chrome = document.createElement('div');
    detail.root = root;
    detail.liste = { name: 'Casting', teilbereich: '' };
    detail.vorschlagPanel = { mount: vi.fn(), vorschlaege: [] };

    await detail.render();
    const page = root.querySelector('.casting-page');
    expect([...page.children].map(el => el.className)).toEqual([
      'casting-sticky-head',
      'casting-body',
      'casting-sticky-foot'
    ]);
    expect(page.querySelector('.casting-sticky-foot .sourcing-tab-navigation.monatsblatt-tabs')).not.toBeNull();

    detail.embedded = true;
    detail.chromeRoot = chrome;
    await detail.render();
    expect([...root.children].map(el => el.className)).toEqual([
      'casting-body',
      'casting-sticky-foot'
    ]);
    expect(root.querySelector('.casting-sticky-foot .sourcing-tab-navigation.monatsblatt-tabs')).not.toBeNull();
  });

  it('rendert bei aktiver Suche neu und ignoriert identische Eingaben', () => {
    const spy = vi.spyOn(detail, 'rerenderTable').mockImplementation(() => {});

    detail.handleSearch('anna');
    expect(detail.searchQuery).toBe('anna');
    expect(spy).toHaveBeenCalledTimes(1);

    detail.handleSearch('anna');
    expect(spy).toHaveBeenCalledTimes(1);

    detail.handleSearch('');
    expect(detail.searchQuery).toBe('');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('clearSearch setzt Suche und Input zurück', () => {
    const spy = vi.spyOn(detail, 'rerenderTable').mockImplementation(() => {});
    document.body.innerHTML = `
      <input id="sourcing-item-search-input" value="anna">
      <button id="sourcing-item-search-clear" style="display:flex;"></button>
    `;

    detail.root = document.body;
    detail.searchQuery = 'anna';
    detail.clearSearch();

    expect(detail.searchQuery).toBe('');
    expect(document.getElementById('sourcing-item-search-input').value).toBe('');
    expect(document.getElementById('sourcing-item-search-clear').style.display).toBe('none');
    expect(spy).toHaveBeenCalledTimes(1);

    // Ohne aktive Suche kein unnötiges Re-Rendern
    detail.clearSearch();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('CreatorAuswahlTemplates – Suche im UI', () => {
  const baseCtx = {
    items: [],
    hasAnyItems: true,
    activeTab: 'alle',
    tabCounts: { alle: 0, abgelehnt: 0, bewerbung: 0 },
    liste: { teilbereich: '' },
    isKunde: false,
    gastReadonly: false,
    hiddenColumns: [],
    kundenCallActive: false,
    customManager: null,
    searchQuery: ''
  };

  it('zeigt bei Suche ohne Treffer einen Such-Empty-State mit dem Begriff', () => {
    const html = renderItemsTable({ ...baseCtx, searchQuery: 'xyz' });
    expect(html).toContain('Keine Treffer für "xyz"');
    expect(html).not.toContain('Keine Creator im Reiter');
  });

  it('escaped den Suchbegriff im Empty-State', () => {
    const html = renderItemsTable({ ...baseCtx, searchQuery: '<img src=x>' });
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;img src=x&gt;');
  });

  it('zeigt weiterhin den Reiter-Empty-State, wenn die Suche im anderen Reiter Treffer hat', () => {
    const htmlAbgelehnt = renderItemsTable({
      ...baseCtx,
      activeTab: 'abgelehnt',
      searchQuery: 'anna',
      tabCounts: { alle: 2, abgelehnt: 0, bewerbung: 0 }
    });
    expect(htmlAbgelehnt).toContain('Keine Creator im Reiter "Abgelehnt"');
    expect(htmlAbgelehnt).not.toContain('Keine Treffer');

    const htmlAlle = renderItemsTable({
      ...baseCtx,
      activeTab: 'alle',
      searchQuery: 'chris',
      tabCounts: { alle: 0, abgelehnt: 1, bewerbung: 0 }
    });
    expect(htmlAlle).toContain('Keine Creator im Reiter "Alle"');
    expect(htmlAlle).not.toContain('Keine Treffer');
  });

  it('rendert das Suchfeld im rechten Aktions-Block für alle Rollen', () => {
    const htmlIntern = renderAddSection({ ...baseCtx, isKunde: false });
    const htmlKunde = renderAddSection({ ...baseCtx, isKunde: true });

    for (const html of [htmlIntern, htmlKunde]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const input = doc.getElementById('sourcing-item-search-input');

      expect(input).not.toBeNull();
      expect(input.getAttribute('placeholder')).toBe('Name suchen...');
      expect(input.closest('.add-item-actions-right')).not.toBeNull();
    }
  });

  it('zeigt die Aktions-Buttons nur mit sourcing.can_create (Creator hinzufügen kommt aus der Floating Bar)', () => {
    const htmlIntern = renderAddSection({ ...baseCtx, isKunde: false, canCreate: true });
    expect(htmlIntern).not.toContain('btn-open-add-drawer');
    expect(htmlIntern).toContain('btn-management-anfrage');
    expect(htmlIntern).toContain('btn-sourcing-toolbar-menu');

    const htmlKunde = renderAddSection({ ...baseCtx, isKunde: true, canCreate: false });
    expect(htmlKunde).not.toContain('btn-open-add-drawer');
    expect(htmlKunde).not.toContain('btn-management-anfrage');
  });

  it('übernimmt den aktuellen Suchwert escaped ins Input', () => {
    const html = renderAddSection({ ...baseCtx, searchQuery: '"onmouseover="x' });
    expect(html).toContain('&quot;onmouseover=&quot;x');
    expect(html).not.toContain('value=""onmouseover="x"');
  });
});
