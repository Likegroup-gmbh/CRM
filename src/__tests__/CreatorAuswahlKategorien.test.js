import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderGroupedItems,
  resolveSourcingKategorie,
  reorderSourcingItemsByKategorien
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  CreatorAuswahlKategorienDrawer,
  validateSourcingKategorieName,
  NICHT_UMSETZEN_KATEGORIE
} from '../modules/creator-auswahl/CreatorAuswahlKategorienDrawer.js';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';

const C6 = 'C6 "Die jungen Marken-Orientierten"';
const C5_SPACE = 'C 5 "Die modernen Umweltbewussten"';
const C5 = 'C5 "Die modernen Umweltbewussten"';
const DEFINED = [C6, C5_SPACE, C5];
const TEILBEREICH = DEFINED.join(', ');

function groupedDoc(items, liste = { teilbereich: TEILBEREICH }) {
  const html = renderGroupedItems({
    liste,
    items,
    isKunde: false,
    hiddenColumns: [],
    customManager: null
  });
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

function headerByLabel(doc, label) {
  return Array.from(doc.querySelectorAll('.kategorie-header-row')).find(
    row => row.querySelector('.kategorie-label')?.textContent.trim() === label
  );
}

describe('resolveSourcingKategorie', () => {
  it('laesst exakte Treffer unveraendert', () => {
    expect(resolveSourcingKategorie(C6, DEFINED)).toBe(C6);
  });

  it('mappt das abgeschnittene Attribut "C6 " und "C6" auf den vollen C6-Namen', () => {
    expect(resolveSourcingKategorie('C6 ', DEFINED)).toBe(C6);
    expect(resolveSourcingKategorie('C6', DEFINED)).toBe(C6);
  });

  it('verwechselt C5 nicht mit C 5', () => {
    expect(resolveSourcingKategorie('C5', DEFINED)).toBe(C5);
    expect(resolveSourcingKategorie('C5 ', DEFINED)).toBe(C5);
    expect(resolveSourcingKategorie('C 5 ', DEFINED)).toBe(C5_SPACE);
    expect(resolveSourcingKategorie('C 5', DEFINED)).toBe(C5_SPACE);
  });

  it('laesst unbekannte Werte als Orphan stehen', () => {
    expect(resolveSourcingKategorie('Unbekannt XYZ', DEFINED)).toBe('Unbekannt XYZ');
    expect(resolveSourcingKategorie('C', DEFINED)).toBe('C');
  });
});

describe('Sourcing-Kategorien mit Anfuehrungszeichen', () => {
  it('schreibt den vollen Namen in data-kategorie der Gruppenheader', () => {
    const doc = groupedDoc([]);
    const header = headerByLabel(doc, C6);

    expect(header).toBeTruthy();
    expect(header.dataset.kategorie).toBe(C6);
    expect(header.querySelector('.sourcing-group-select').dataset.kategorie).toBe(C6);
  });

  it('zeigt Creator mit abgeschnittener Kategorie unter dem vollen Header', () => {
    const doc = groupedDoc([{ id: 'i1', name: 'Anna', kategorie: 'C6 ' }]);
    const header = headerByLabel(doc, C6);

    expect(header.querySelector('.kategorie-count').textContent).toBe('(1)');
    const rows = Array.from(doc.querySelectorAll('.item-row'));
    expect(rows).toHaveLength(1);
    expect(rows[0].dataset.itemId).toBe('i1');
  });

  it('rendert Items mit voellig fremder Kategorie als eigene Gruppe', () => {
    const doc = groupedDoc([{ id: 'i2', name: 'Ben', kategorie: 'Unbekannt XYZ' }]);
    const orphan = headerByLabel(doc, 'Unbekannt XYZ');

    expect(orphan).toBeTruthy();
    expect(orphan.dataset.kategorie).toBe('Unbekannt XYZ');
    expect(orphan.querySelector('.kategorie-count').textContent).toBe('(1)');
    expect(doc.querySelector('.item-row').dataset.itemId).toBe('i2');
  });

  it('liefert im Kategorien-Drawer den vollen Namen am Loesch-Button', () => {
    const drawer = new CreatorAuswahlKategorienDrawer({
      liste: { teilbereich: TEILBEREICH }
    });
    const doc = new DOMParser().parseFromString(drawer.renderBody(), 'text/html');
    const btn = Array.from(doc.querySelectorAll('[data-action="delete-kategorie"]')).find(
      el => el.closest('.kategorie-item')?.querySelector('.kategorie-name')?.textContent === C6
    );

    expect(btn).toBeTruthy();
    expect(btn.dataset.kategorie).toBe(C6);
  });

  it('liefert im Kategorien-Drawer den vollen Namen am Edit-Button', () => {
    const drawer = new CreatorAuswahlKategorienDrawer({
      liste: { teilbereich: TEILBEREICH }
    });
    const doc = new DOMParser().parseFromString(drawer.renderBody(), 'text/html');
    const btn = Array.from(doc.querySelectorAll('[data-action="edit-kategorie"]')).find(
      el => el.closest('.kategorie-item')?.querySelector('.kategorie-name')?.textContent === C6
    );

    expect(btn).toBeTruthy();
    expect(btn.dataset.kategorie).toBe(C6);
  });

  it('liefert in der Bulk-Bar den vollen Namen als option.value', () => {
    document.body.innerHTML = '';
    const detail = new CreatorAuswahlDetail();
    detail.liste = { teilbereich: TEILBEREICH };
    detail.renderBulkBar();

    const option = Array.from(document.querySelectorAll('#sourcing-bulk-kategorie option'))
      .find(el => el.textContent === C6);

    expect(option).toBeTruthy();
    expect(option.value).toBe(C6);
    document.getElementById('sourcing-bulk-bar')?.remove();
  });

  it('liefert im Add-Drawer den vollen Namen als option.value', () => {
    const drawer = new CreatorAuswahlAddDrawer({
      liste: { teilbereich: TEILBEREICH },
      hiddenColumns: []
    });
    const doc = new DOMParser().parseFromString(drawer.renderForm(), 'text/html');
    const option = Array.from(doc.querySelectorAll('#creator-kategorie option'))
      .find(el => el.textContent === C6);

    expect(option).toBeTruthy();
    expect(option.value).toBe(C6);
  });
});

describe('CreatorAuswahlDetail – Pill-Dropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('schreibt den vollen Namen in data-kategorie der Pill-Optionen', () => {
    const detail = new CreatorAuswahlDetail();
    detail.liste = { teilbereich: TEILBEREICH };
    detail.items = [{ id: 'i1', kategorie: null }];

    const pill = document.createElement('div');
    pill.className = 'kategorie-pill';
    pill.getBoundingClientRect = () => ({ bottom: 0, left: 0 });
    document.body.appendChild(pill);

    detail.openPillDropdown('i1', pill);

    const option = Array.from(document.querySelectorAll('.kategorie-pill-option'))
      .find(el => el.textContent === C6);

    expect(option).toBeTruthy();
    expect(option.dataset.kategorie).toBe(C6);
    detail.closePillDropdown();
  });
});

describe('validateSourcingKategorieName', () => {
  const existing = ['Reels', 'Stories', NICHT_UMSETZEN_KATEGORIE];

  it('lehnt leeren Namen ab', () => {
    expect(validateSourcingKategorieName('  ', { existing })).toEqual({
      error: 'Bitte einen Namen eingeben'
    });
  });

  it('lehnt Kommas im Namen ab', () => {
    expect(validateSourcingKategorieName('Reels, Stories', { existing })).toEqual({
      error: 'Kommas sind im Kategorienamen nicht erlaubt'
    });
  });

  it('lehnt Duplikate case-insensitive ab', () => {
    expect(validateSourcingKategorieName('reels', { existing })).toEqual({
      error: 'Diese Kategorie existiert bereits'
    });
  });

  it('verbietet das Umbenennen von "Nicht umsetzen"', () => {
    expect(validateSourcingKategorieName('Abgelehnt', {
      existing,
      oldName: NICHT_UMSETZEN_KATEGORIE
    })).toEqual({
      error: '"Nicht umsetzen" kann nicht umbenannt werden'
    });
  });

  it('schliesst unveraenderte Namen still', () => {
    expect(validateSourcingKategorieName('Reels', { existing, oldName: 'Reels' })).toEqual({
      unchanged: true,
      name: 'Reels'
    });
  });

  it('erlaubt Gross/Kleinschreibung am selben Namen als unveraendert', () => {
    expect(validateSourcingKategorieName('reels', { existing, oldName: 'Reels' })).toEqual({
      unchanged: true,
      name: 'reels'
    });
  });

  it('akzeptiert einen neuen Namen', () => {
    expect(validateSourcingKategorieName('UGC', { existing, oldName: 'Reels' })).toEqual({
      name: 'UGC'
    });
  });
});

describe('CreatorAuswahlKategorienDrawer.handleRename', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="kategorien-drawer-body"></div>';
    vi.restoreAllMocks();
  });

  it('zieht Items mit abgeschnittenem Kategorienamen auf den neuen Namen', async () => {
    const items = [
      { id: 'i1', kategorie: 'C6 ' },
      { id: 'i2', kategorie: C5 }
    ];
    const detail = {
      listeId: 'list-1',
      liste: { teilbereich: TEILBEREICH },
      items,
      rerenderTable: vi.fn()
    };
    const drawer = new CreatorAuswahlKategorienDrawer(detail);

    vi.spyOn(creatorAuswahlService, 'updateListe').mockResolvedValue({});
    vi.spyOn(creatorAuswahlService, 'updateItemsKategorie').mockResolvedValue([]);

    const didSave = await drawer.handleRename(C6, 'C6 Neu');

    expect(didSave).toBe(true);
    expect(creatorAuswahlService.updateListe).toHaveBeenCalledWith('list-1', {
      teilbereich: ['C6 Neu', C5_SPACE, C5].join(', ')
    });
    expect(creatorAuswahlService.updateItemsKategorie).toHaveBeenCalledWith(['i1'], 'C6 Neu');
    expect(items[0].kategorie).toBe('C6 Neu');
    expect(items[1].kategorie).toBe(C5);
    expect(detail.liste.teilbereich).toBe(['C6 Neu', C5_SPACE, C5].join(', '));
    expect(detail.rerenderTable).toHaveBeenCalled();
  });

  it('benennt ueber Stift-Icon und Speichern um', async () => {
    window.toastSystem = { show: vi.fn() };
    const items = [{ id: 'i1', kategorie: 'Reels' }];
    const detail = {
      listeId: 'list-1',
      liste: { teilbereich: 'Reels, Stories' },
      items,
      rerenderTable: vi.fn()
    };
    const drawer = new CreatorAuswahlKategorienDrawer(detail);

    vi.spyOn(creatorAuswahlService, 'updateListe').mockResolvedValue({});
    vi.spyOn(creatorAuswahlService, 'updateItemsKategorie').mockResolvedValue([]);

    drawer.open();

    const editBtn = Array.from(document.querySelectorAll('[data-action="edit-kategorie"]'))
      .find(btn => btn.dataset.kategorie === 'Reels');
    expect(editBtn).toBeTruthy();
    editBtn.click();

    const input = document.querySelector('.kategorie-item input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Reels');
    input.value = 'UGC';

    document.querySelector('[data-action="save-kategorie"]').click();
    await vi.waitFor(() => {
      expect(items[0].kategorie).toBe('UGC');
    });

    expect(creatorAuswahlService.updateListe).toHaveBeenCalledWith('list-1', {
      teilbereich: 'UGC, Stories'
    });
    expect(creatorAuswahlService.updateItemsKategorie).toHaveBeenCalledWith(['i1'], 'UGC');
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Kategorie "Reels" wurde umbenannt',
      'success'
    );

    drawer.remove();
    delete window.toastSystem;
  });

  it('benennt per Klick auf den Kategorienamen um', async () => {
    window.toastSystem = { show: vi.fn() };
    const items = [{ id: 'i1', kategorie: 'Reels' }];
    const detail = {
      listeId: 'list-1',
      liste: { teilbereich: 'Reels, Stories' },
      items,
      rerenderTable: vi.fn()
    };
    const drawer = new CreatorAuswahlKategorienDrawer(detail);

    vi.spyOn(creatorAuswahlService, 'updateListe').mockResolvedValue({});
    vi.spyOn(creatorAuswahlService, 'updateItemsKategorie').mockResolvedValue([]);

    drawer.open();

    const nameBtn = Array.from(document.querySelectorAll('.kategorie-name'))
      .find(btn => btn.dataset.kategorie === 'Reels');
    expect(nameBtn).toBeTruthy();
    nameBtn.click();

    const input = document.querySelector('.kategorie-item input');
    expect(input.value).toBe('Reels');
    input.value = 'UGC';

    document.querySelector('[data-action="save-kategorie"]').click();
    await vi.waitFor(() => {
      expect(items[0].kategorie).toBe('UGC');
    });

    drawer.remove();
    delete window.toastSystem;
  });
});

describe('reorderSourcingItemsByKategorien', () => {
  it('verschiebt Creator mit ihrer Kategorie und behaelt die Reihenfolge in der Gruppe', () => {
    const items = [
      { id: 'a1', kategorie: 'A', sortierung: 0 },
      { id: 'a2', kategorie: 'A', sortierung: 1 },
      { id: 'b1', kategorie: 'B', sortierung: 2 },
      { id: 'c1', kategorie: 'C', sortierung: 3 }
    ];

    const reordered = reorderSourcingItemsByKategorien(items, ['C', 'A', 'B']);

    expect(reordered.map(i => i.id)).toEqual(['c1', 'a1', 'a2', 'b1']);
    expect(reordered.map(i => i.sortierung)).toEqual([0, 1, 2, 3]);
  });

  it('laesst Ohne Kategorie und Nicht umsetzen am Ende', () => {
    const items = [
      { id: 'n1', kategorie: 'Nicht umsetzen', sortierung: 0 },
      { id: 'a1', kategorie: 'A', sortierung: 1 },
      { id: 'o1', kategorie: null, sortierung: 2 },
      { id: 'b1', kategorie: 'B', sortierung: 3 }
    ];

    const reordered = reorderSourcingItemsByKategorien(items, ['B', 'A', 'Nicht umsetzen']);

    expect(reordered.map(i => i.id)).toEqual(['b1', 'a1', 'o1', 'n1']);
  });

  it('rendert Gruppenheader in der neuen CSV-Reihenfolge', () => {
    const items = [
      { id: 'a1', kategorie: 'A' },
      { id: 'b1', kategorie: 'B' }
    ];
    const doc = groupedDoc(items, { teilbereich: 'B, A' });
    const labels = Array.from(doc.querySelectorAll('.kategorie-label')).map(el => el.textContent.trim());
    expect(labels.slice(0, 2)).toEqual(['B', 'A']);
  });
});

describe('CreatorAuswahlKategorienDrawer.applyKategorieOrder', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="kategorien-drawer-body"></div>';
    vi.restoreAllMocks();
    window.toastSystem = { show: vi.fn() };
  });

  it('schreibt CSV und Item-Sortierung in der neuen Reihenfolge', async () => {
    const items = [
      { id: 'a1', kategorie: 'A', sortierung: 0 },
      { id: 'b1', kategorie: 'B', sortierung: 1 }
    ];
    const detail = {
      listeId: 'list-1',
      liste: { teilbereich: 'A, B' },
      items,
      rerenderTable: vi.fn()
    };
    const drawer = new CreatorAuswahlKategorienDrawer(detail);

    vi.spyOn(creatorAuswahlService, 'updateListe').mockResolvedValue({});
    vi.spyOn(creatorAuswahlService, 'updateItemsSortierungWithKategorie').mockResolvedValue();

    const didSave = await drawer.applyKategorieOrder(['B', 'A']);

    expect(didSave).toBe(true);
    expect(creatorAuswahlService.updateListe).toHaveBeenCalledWith('list-1', { teilbereich: 'B, A' });
    expect(creatorAuswahlService.updateItemsSortierungWithKategorie).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'b1', kategorie: 'B', sortierung: 0 }),
      expect.objectContaining({ id: 'a1', kategorie: 'A', sortierung: 1 })
    ]);
    expect(detail.items.map(i => i.id)).toEqual(['b1', 'a1']);
    expect(detail.rerenderTable).toHaveBeenCalled();
  });

  it('zeigt einen Drag-Griff an jeder Kategorie', () => {
    const drawer = new CreatorAuswahlKategorienDrawer({
      liste: { teilbereich: 'A, B' }
    });
    const doc = new DOMParser().parseFromString(drawer.renderBody(), 'text/html');
    expect(doc.querySelectorAll('[data-action="drag-kategorie"]')).toHaveLength(2);
  });
});
