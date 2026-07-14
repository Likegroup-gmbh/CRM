import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { renderItemsTable, renderAddSection } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

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
      makeItem({ id: '5', name: 'Chris', absage: true })
    ];
    detail.activeTab = 'alle';
  });

  it('filtert case-insensitiv und mit Teiltreffern nur über die Spalte name', () => {
    detail.searchQuery = 'anna';
    const result = detail.getFilteredItems();
    expect(result.map(i => i.id)).toEqual(['1', '3']);
    // Item 4 matcht nur in der Notiz und darf nicht erscheinen
    expect(result.some(i => i.id === '4')).toBe(false);
  });

  it('ignoriert führende/nachgestellte Leerzeichen im Suchbegriff', () => {
    detail.searchQuery = '  Anna  ';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['1', '3']);
  });

  it('liefert bei leerer Suche alle Items des aktiven Reiters', () => {
    detail.searchQuery = '';
    expect(detail.getFilteredItems()).toHaveLength(5);

    detail.activeTab = 'gebucht';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['2']);
  });

  it('kombiniert Suche und Status-Reiter', () => {
    detail.searchQuery = 'anna';
    detail.activeTab = 'on_hold';
    expect(detail.getFilteredItems().map(i => i.id)).toEqual(['3']);

    detail.activeTab = 'gebucht';
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
    expect(counts).toEqual({ offen: 1, on_hold: 1, gebucht: 0, nicht_buchen: 0, alle: 2 });
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
    tabCounts: { offen: 0, on_hold: 0, gebucht: 0, nicht_buchen: 0, alle: 0 },
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

  it('zeigt weiterhin den Reiter-Empty-State, wenn die Suche in anderen Reitern Treffer hat', () => {
    const html = renderItemsTable({
      ...baseCtx,
      activeTab: 'gebucht',
      searchQuery: 'anna',
      tabCounts: { offen: 2, on_hold: 0, gebucht: 0, nicht_buchen: 0, alle: 2 }
    });
    expect(html).toContain('Keine Creator im Reiter "Gebucht"');
    expect(html).not.toContain('Keine Treffer');
  });

  it('rendert das Suchfeld links in der Aktions-Zeile für alle Rollen', () => {
    const htmlIntern = renderAddSection({ ...baseCtx, isKunde: false });
    const htmlKunde = renderAddSection({ ...baseCtx, isKunde: true });

    for (const html of [htmlIntern, htmlKunde]) {
      expect(html).toContain('add-item-actions-left');
      expect(html).toContain('sourcing-item-search-input');
      expect(html).toContain('Name suchen...');
    }
  });

  it('zeigt die Aktions-Buttons nur für interne Nutzer', () => {
    const htmlIntern = renderAddSection({ ...baseCtx, isKunde: false });
    expect(htmlIntern).toContain('add-item-actions-right');
    expect(htmlIntern).toContain('btn-open-add-drawer');

    const htmlKunde = renderAddSection({ ...baseCtx, isKunde: true });
    expect(htmlKunde).not.toContain('add-item-actions-right');
    expect(htmlKunde).not.toContain('btn-open-add-drawer');
  });

  it('übernimmt den aktuellen Suchwert escaped ins Input', () => {
    const html = renderAddSection({ ...baseCtx, searchQuery: '"onmouseover="x' });
    expect(html).toContain('&quot;onmouseover=&quot;x');
    expect(html).not.toContain('value=""onmouseover="x"');
  });
});
