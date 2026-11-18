import { describe, it, expect, beforeEach } from 'vitest';
import { renderItemRow, renderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    getTeilbereicheFromStrategie: () => ['A'],
    ...overrides
  };
}

function renderRow(item, detailOverrides = {}) {
  const html = renderItemRow(detailStub(detailOverrides), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

const eintrag = (extra = {}) => ({
  creator_auswahl_item_id: 'e1',
  casting_eintrag: { id: 'e1', name: 'Mia Muster', creator_id: 'c1', ...extra }
});

const erste = (liste) => liste.map((el) => [...el.classList].find((c) => c.startsWith('col-')));

beforeEach(() => {
  window.isGastReadonly = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

describe('Konzepte-Tabelle: Creator-Profilbild und Name', () => {
  it('stellt die Creator-Spalte mit Profilbild direkt hinter die Verschieben-Spalte', () => {
    const zeile = renderRow(eintrag());
    const zellen = erste([...zeile.querySelectorAll('tr.item-row > td')]);
    const drag = zellen.indexOf('col-drag');
    expect(zellen.slice(drag, drag + 3)).toEqual(['col-drag', 'col-creator', 'col-image']);

    const tabelle = new DOMParser().parseFromString(
      renderItemsTable(detailStub({ items: [{ id: 'i1', teilbereich: 'A' }] })),
      'text/html'
    );
    const kopf = erste([...tabelle.querySelectorAll('thead th')]);
    const kopfDrag = kopf.indexOf('col-drag');
    expect(kopf.slice(kopfDrag, kopfDrag + 3)).toEqual(['col-drag', 'col-creator', 'col-image']);
  });

  it('zaehlt den colspan der Gruppenzeile passend zu den Spaltenkoepfen', () => {
    const tabelle = new DOMParser().parseFromString(
      renderItemsTable(detailStub({ items: [{ id: 'i1', teilbereich: 'A' }] })),
      'text/html'
    );
    const spalten = tabelle.querySelectorAll('thead th').length;
    expect(Number(tabelle.querySelector('.category-header-cell').getAttribute('colspan'))).toBe(spalten);
  });

  it('bevorzugt das Thumb des Casting-Eintrags vor dem Hauptbild', () => {
    const doc = renderRow(eintrag({
      profile_image_url: 'https://cdn/gross.avif',
      profile_image_thumb_url: 'https://cdn/thumb.avif'
    }));
    const img = doc.querySelector('td.col-creator .table-identity__media img.table-avatar-img');
    expect(img.getAttribute('src')).toBe('https://cdn/thumb.avif');
  });

  it('nimmt das CRM-Profilbild, wenn der Eintrag keins hat', () => {
    const doc = renderRow(eintrag({
      creator: { id: 'c1', vorname: 'Mia', nachname: 'Muster', profilbild_url: 'https://cdn/crm.avif' }
    }));
    expect(doc.querySelector('td.col-creator img.table-avatar').getAttribute('src')).toBe('https://cdn/crm.avif');
  });

  it('zeigt ohne Bild den Initial des Namens', () => {
    const doc = renderRow(eintrag());
    expect(doc.querySelector('td.col-creator span.table-avatar').textContent.trim()).toBe('M');
  });

  it('zeigt ohne Zuordnung kein Bild, nur den Verknuepfen-Button', () => {
    const doc = renderRow({});
    expect(doc.querySelector('td.col-creator .table-avatar')).toBeNull();
    expect(doc.querySelector('td.col-creator .table-identity__text .creator-connect-btn')).not.toBeNull();
  });

  it('zeigt leere Creator- und Produkt-Zellen als Verknuepfen-Button mit Text', () => {
    const doc = renderRow({});
    const creator = doc.querySelector('td.col-creator button.creator-connect-btn.creator-cell-select');
    const produkt = doc.querySelector('td.col-produkt button.produkt-connect-btn.creator-cell-select');

    expect(creator.textContent.trim()).toBe('Creator verknüpfen');
    expect(produkt.textContent.trim()).toBe('Produkt verknüpfen');
  });

  it('zeigt eine Zuordnung im selben Container mit Name und x zum Loesen rechts', () => {
    const doc = renderRow({
      ...eintrag(),
      produkt_id: 'p1',
      produkt: { id: 'p1', name: 'Shampoo' }
    });
    const creator = doc.querySelector('td.col-creator .creator-cell-select');
    const produkt = doc.querySelector('td.col-produkt .creator-cell-select');

    expect(creator.textContent.trim()).toBe('Mia Muster');
    expect(creator.querySelector('a.table-link')).not.toBeNull();
    expect(creator.lastElementChild.classList.contains('creator-unlink-btn')).toBe(true);
    expect(produkt.textContent.trim()).toBe('Shampoo');
    expect(produkt.lastElementChild.classList.contains('produkt-unlink-btn')).toBe(true);
    expect(doc.querySelector('.creator-connect-btn')).toBeNull();
  });

  it('zeigt den Container ohne x, wenn nicht bearbeitet werden darf', () => {
    const doc = renderRow(eintrag(), { canEdit: false });

    expect(doc.querySelector('td.col-creator .creator-cell-select')).not.toBeNull();
    expect(doc.querySelector('.creator-unlink-btn')).toBeNull();
  });

  it('blendet das Bild zusammen mit der Creator-Spalte aus', () => {
    const doc = renderRow(eintrag(), { hiddenColumns: ['fixed:creator'] });
    expect(doc.querySelector('td.col-creator')).toBeNull();
    expect(doc.querySelector('.table-avatar')).toBeNull();
  });
});
