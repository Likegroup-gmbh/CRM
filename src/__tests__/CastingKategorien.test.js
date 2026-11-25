import { describe, it, expect, beforeEach } from 'vitest';
import { renderGroupedItems } from '../modules/creator-auswahl/castingTableRender.js';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { AddCreatorToCastingDrawer } from '../modules/creator-auswahl/AddCreatorToCastingDrawer.js';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  NICHT_UMSETZEN_KEY,
  OHNE_KATEGORIE,
  OHNE_KATEGORIE_KEY,
  applyGroupToItem,
  kategorieGroupKey,
  orderedKategorieGroups,
  parseTeilbereiche,
  pruefeKategorieName,
  reorderCastingItemsByKategorien,
  serializeTeilbereiche,
  updatesForGroupKey
} from '../modules/creator-auswahl/castingKategorien.js';

const KATEGORIEN = ['Food', 'Sport'];

function groupedDoc(items, teilbereiche = KATEGORIEN) {
  const html = renderGroupedItems({
    liste: {},
    items,
    teilbereiche,
    isKunde: false,
    hiddenColumns: [],
    customManager: null
  });
  return new DOMParser().parseFromString(`<table>${html}</table>`, 'text/html');
}

function headerByLabel(doc, label) {
  return Array.from(doc.querySelectorAll('.kategorie-header-row')).find(
    row => row.querySelector('.kategorie-label')?.textContent.trim() === label
  );
}

describe('parseTeilbereiche / serializeTeilbereiche', () => {
  it('trennt an Kommas, trimmt und dedupliziert', () => {
    expect(parseTeilbereiche('Food,  Sport , Food, ')).toEqual(['Food', 'Sport']);
    expect(parseTeilbereiche(null)).toEqual([]);
  });

  it('serialisiert leer als null', () => {
    expect(serializeTeilbereiche(['A', ' B '])).toBe('A, B');
    expect(serializeTeilbereiche([])).toBeNull();
  });
});

describe('pruefeKategorieName', () => {
  it('lehnt leer, Kommas, reservierte und doppelte Namen ab', () => {
    expect(pruefeKategorieName('', [])).toBeTruthy();
    expect(pruefeKategorieName('A, B', [])).toMatch(/Kommas/);
    expect(pruefeKategorieName('nicht umsetzen', [])).toMatch(/reserviert/);
    expect(pruefeKategorieName('Ohne Kategorie', [])).toMatch(/reserviert/);
    expect(pruefeKategorieName('food', ['Food'])).toMatch(/existiert/);
    expect(pruefeKategorieName('Neu', ['Food'])).toBeNull();
  });

  it('erlaubt beim Umbenennen den eigenen Namen', () => {
    expect(pruefeKategorieName('Food', ['Food'], { ausser: 'Food' })).toBeNull();
  });
});

describe('orderedKategorieGroups', () => {
  it('haelt Reihenfolge und leere Kategorien', () => {
    const groups = orderedKategorieGroups([{ id: 'i1', kategorie: 'Sport' }], KATEGORIEN);
    expect(groups.map(g => g.label)).toEqual(['Food', 'Sport']);
    expect(groups[0].items).toHaveLength(0);
    expect(groups[1].items.map(i => i.id)).toEqual(['i1']);
  });

  it('haengt Orphans, Ohne Kategorie und Nicht umsetzen ans Ende', () => {
    const groups = orderedKategorieGroups([
      { id: 'o1', kategorie: null },
      { id: 'x1', kategorie: 'Alt' },
      { id: 'n1', kategorie: NICHT_UMSETZEN_KATEGORIE }
    ], KATEGORIEN);
    expect(groups.map(g => g.label)).toEqual(['Food', 'Sport', 'Alt', OHNE_KATEGORIE, NICHT_UMSETZEN_KATEGORIE]);
  });

  it('ignoriert persona_id bei der Gruppierung', () => {
    const groups = orderedKategorieGroups([{ id: 'p1', persona_id: 'pa', kategorie: null }], []);
    expect(groups.map(g => g.key)).toEqual([OHNE_KATEGORIE_KEY]);
  });
});

describe('kategorieGroupKey / updatesForGroupKey', () => {
  it('erkennt Nicht umsetzen ueber Flag und Kategorie', () => {
    expect(kategorieGroupKey({ nicht_umsetzen: true })).toBe(NICHT_UMSETZEN_KEY);
    expect(kategorieGroupKey({ kategorie: NICHT_UMSETZEN_KATEGORIE })).toBe(NICHT_UMSETZEN_KEY);
    expect(kategorieGroupKey({ kategorie: ' Food ' })).toBe('Food');
    expect(kategorieGroupKey({})).toBe(OHNE_KATEGORIE_KEY);
  });

  it('schreibt nur kategorie und nicht_umsetzen, nie persona_id', () => {
    expect(updatesForGroupKey('Food')).toEqual({ kategorie: 'Food', nicht_umsetzen: false });
    expect(updatesForGroupKey(OHNE_KATEGORIE_KEY)).toEqual({ kategorie: null, nicht_umsetzen: false });
    expect(updatesForGroupKey(NICHT_UMSETZEN_KEY)).toEqual({
      kategorie: NICHT_UMSETZEN_KATEGORIE,
      nicht_umsetzen: true
    });
    expect(applyGroupToItem({ id: 'i', persona_id: 'pa' }, 'Food')).toMatchObject({
      persona_id: 'pa',
      kategorie: 'Food'
    });
  });
});

describe('reorderCastingItemsByKategorien', () => {
  it('sortiert nach Kategorie-Reihenfolge, Nicht umsetzen zuletzt', () => {
    const reordered = reorderCastingItemsByKategorien([
      { id: 'n1', kategorie: NICHT_UMSETZEN_KATEGORIE },
      { id: 'b1', kategorie: 'Sport' },
      { id: 'o1', kategorie: null },
      { id: 'a1', kategorie: 'Food' }
    ], KATEGORIEN);
    expect(reordered.map(i => i.id)).toEqual(['a1', 'b1', 'o1', 'n1']);
    expect(reordered.map(i => i.sortierung)).toEqual([0, 1, 2, 3]);
  });
});

describe('renderGroupedItems nach Kategorie', () => {
  it('rendert leere Kategorien als Kopf mit Zaehler', () => {
    const header = headerByLabel(groupedDoc([]), 'Food');
    expect(header).toBeTruthy();
    expect(header.dataset.groupKey).toBe('Food');
    expect(header.querySelector('.kategorie-count').textContent).toBe('(0)');
  });

  it('legt Vorschlaege ohne Kategorie in Ohne Kategorie', () => {
    const doc = groupedDoc([
      { id: 'v1', name: 'Jessie', isVorschlag: true, kategorie: null },
      { id: 'i1', name: 'Anna', kategorie: 'Food' }
    ]);
    expect(headerByLabel(doc, OHNE_KATEGORIE).querySelector('.kategorie-count').textContent).toBe('(1)');
    expect(headerByLabel(doc, 'Food').querySelector('.kategorie-count').textContent).toBe('(1)');
  });

  it('legt jede Kategorie in ein eigenes tbody', () => {
    const doc = groupedDoc([
      { id: 'a1', name: 'Anna', kategorie: 'Food' },
      { id: 'b1', name: 'Ben', kategorie: 'Sport' }
    ]);
    const tbodys = Array.from(doc.querySelectorAll('tbody.kategorie-group-tbody'));
    expect(tbodys.map(t => t.dataset.groupKey)).toEqual(['Food', 'Sport']);
    expect(tbodys[0].querySelector('.item-row')?.dataset.itemId).toBe('a1');
    expect(tbodys[1].querySelector('.item-row')?.dataset.itemId).toBe('b1');
  });

  it('packt Items ohne Kategorien in ein einzelnes tbody ohne Kopf', () => {
    const doc = groupedDoc([{ id: 'a1', name: 'Anna', kategorie: null }], []);
    const tbodys = Array.from(doc.querySelectorAll('tbody.kategorie-group-tbody'));
    expect(tbodys).toHaveLength(1);
    expect(tbodys[0].dataset.groupKey).toBe(OHNE_KATEGORIE_KEY);
    expect(tbodys[0].querySelector('.kategorie-header-row')).toBeNull();
  });
});

describe('Add-Drawer Kategorie', () => {
  it('zeigt ein optionales Kategorie-Select nur mit Kategorien', () => {
    const mitKategorien = new CreatorAuswahlAddDrawer({
      liste: {},
      getTeilbereiche: () => KATEGORIEN,
      hiddenColumns: []
    });
    const doc = new DOMParser().parseFromString(mitKategorien.renderForm(), 'text/html');
    const select = doc.querySelector('#creator-kategorie');
    expect(select).toBeTruthy();
    expect(select.required).toBe(false);
    expect(Array.from(select.querySelectorAll('option')).map(o => o.value)).toEqual(['', 'Food', 'Sport']);

    const ohne = new CreatorAuswahlAddDrawer({ liste: {}, getTeilbereiche: () => [], hiddenColumns: [] });
    const doc2 = new DOMParser().parseFromString(ohne.renderForm(), 'text/html');
    expect(doc2.querySelector('#creator-kategorie')).toBeNull();
    expect(doc2.querySelector('#creator-persona')).toBeNull();
  });
});

describe('CreatorAuswahlDetail – Bulk-Bar Kategorien', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('listet Kategorien, Ohne Kategorie und Nicht umsetzen', () => {
    const detail = new CreatorAuswahlDetail();
    detail.liste = { teilbereich: 'Food, Sport' };
    detail.renderBulkBar();

    const values = Array.from(document.querySelectorAll('#sourcing-bulk-kategorie option')).map(o => o.value);
    expect(values).toEqual(['', 'Food', 'Sport', OHNE_KATEGORIE_KEY, NICHT_UMSETZEN_KEY]);
    document.getElementById('sourcing-bulk-bar')?.remove();
  });
});

describe('CreatorAuswahlDetail – Pill-Dropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('bietet Kategorien und Ohne Kategorie an', () => {
    const detail = new CreatorAuswahlDetail();
    detail.liste = { teilbereich: 'Food, Sport' };
    detail.items = [{ id: 'i1', kategorie: null }];

    const pill = document.createElement('div');
    pill.className = 'kategorie-pill';
    pill.getBoundingClientRect = () => ({ bottom: 0, left: 0 });
    document.body.appendChild(pill);

    detail.openPillDropdown('i1', pill);

    const keys = Array.from(document.querySelectorAll('.kategorie-pill-option')).map(o => o.dataset.groupKey);
    expect(keys).toEqual(['Food', 'Sport', OHNE_KATEGORIE_KEY]);
    detail.closePillDropdown();
  });
});

describe('AddCreatorToCastingDrawer', () => {
  it('zeigt nach dem Casting ein optionales Kategorie-Feld statt Persona', () => {
    document.body.innerHTML = '<div id="add-creator-to-casting-drawer-body"></div>';
    const drawer = new AddCreatorToCastingDrawer();
    drawer.renderBody([{ value: 'l1', label: 'Forge Casting' }]);
    expect(document.getElementById('add-creator-to-casting-drawer-kategorie-field')).toBeTruthy();
    expect(document.getElementById('add-creator-to-casting-drawer-persona')).toBeNull();
    expect(document.getElementById('add-creator-to-casting-drawer-submit').disabled).toBe(true);
  });
});
