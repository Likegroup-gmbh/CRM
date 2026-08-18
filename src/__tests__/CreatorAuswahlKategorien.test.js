import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderGroupedItems,
  resolveSourcingKategorie
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import { CreatorAuswahlKategorienDrawer } from '../modules/creator-auswahl/CreatorAuswahlKategorienDrawer.js';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';

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
    const btn = Array.from(doc.querySelectorAll('.kategorie-delete-btn')).find(
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
