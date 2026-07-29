import { describe, it, expect } from 'vitest';
import {
  renderItemRow,
  renderItemsTable,
  isColumnVisibleForCustomer,
  getVisibleColumnCount,
  getStickyClasses,
  DEAKTIVIERTE_SPALTEN,
  TIKTOK_SPALTEN,
  SOURCING_SPALTEN
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import { SourcingDetailColumnVisibilityDrawer } from '../modules/creator-auswahl/SourcingDetailColumnVisibilityDrawer.js';

function baseCtx(overrides = {}) {
  return { isKunde: false, hiddenColumns: [], ...overrides };
}

function rowDoc(item = {}, ctx = {}) {
  const html = renderItemRow(baseCtx(ctx), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

function cell(columnClass, item = {}, ctx = {}) {
  return rowDoc(item, ctx).querySelector(`td.${columnClass}`);
}

function tableDoc(items, ctx = {}) {
  const html = renderItemsTable(baseCtx({ items, hasAnyItems: items.length > 0, ...ctx }));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Sourcing – Spaltenreihenfolge', () => {
  /** Reihenfolge der cp-col-Klassen, wie sie im DOM stehen */
  function reihenfolge(nodes) {
    return Array.from(nodes)
      .map(el => Array.from(el.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);
  }

  it('stellt Bild zwischen Checkbox und Namen, Location direkt hinter die Creator Art', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten.slice(0, 7)).toEqual([
      'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-typ',
      'cp-col-location', 'cp-col-mail', 'cp-col-telefon'
    ]);
  });

  it('setzt den tatsaechlichen Preis hinter den Instagram-Schnitt, danach die Garantie', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const ab = spalten.indexOf('cp-col-cpm-ig-trimmed');

    expect(spalten.slice(ab, ab + 3)).toEqual([
      'cp-col-cpm-ig-trimmed', 'cp-col-pricing', 'cp-col-reichweite-garantie'
    ]);
  });

  it('rendert Kopf und Zeile in derselben Reihenfolge', () => {
    const doc = tableDoc([{ id: 'i1' }]);
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));
    const zeile = reihenfolge(doc.querySelectorAll('tbody tr.item-row > td'));

    expect(zeile).toEqual(kopf);
  });

  it('benennt die Pricing-Spalte in "Tatsächlicher Preis" um', () => {
    const th = tableDoc([{ id: 'i1' }]).querySelector('thead th.cp-col-pricing');

    expect(th.textContent.trim()).toBe('Tatsächlicher Preis');
  });
});

describe('Sourcing – deaktivierte Spalten (EK/VK)', () => {
  it('blendet EK und VK auch fuer interne Nutzer aus', () => {
    expect(isColumnVisibleForCustomer('cp-col-ek', false, [])).toBe(false);
    expect(isColumnVisibleForCustomer('cp-col-vk', false, [])).toBe(false);
  });

  it('zaehlt sie nicht in der Spaltenanzahl mit', () => {
    const doc = tableDoc([{ id: 'i1' }], { liste: { teilbereich: 'Reels' } });
    const colspan = Number(doc.querySelector('.kategorie-header').getAttribute('colspan'));
    const sichtbar = Array.from(doc.querySelectorAll('thead th'))
      .filter(th => !th.getAttribute('style')?.includes('display:none')).length;

    expect(colspan).toBe(sichtbar);
  });

  it('laesst die Zellen und Felder im Markup, nur eben verborgen', () => {
    const ek = cell('cp-col-ek', { preis_ek: 300 });

    expect(ek.getAttribute('style')).toContain('display:none');
    expect(ek.querySelector('input[data-field="preis_ek"]').value).toBe('300');
  });

  it('bietet sie nicht im Sichtbarkeits-Drawer an', () => {
    const drawer = new SourcingDetailColumnVisibilityDrawer([], () => {});
    const klassen = drawer.columns.map(c => c.className);

    expect(klassen).not.toContain('cp-col-ek');
    expect(klassen).not.toContain('cp-col-vk');
  });

  it('holt die Spalten zurueck, sobald die Konstante geleert wird', () => {
    // Dokumentiert den Schalter: die Konstante ist die einzige Stelle
    expect(DEAKTIVIERTE_SPALTEN).toEqual(['cp-col-ek', 'cp-col-vk']);
  });
});

describe('Sourcing – Mail und Telefon nur intern', () => {
  it('zeigt intern editierbare Felder', () => {
    const mail = cell('cp-col-mail', { email: 'booking@creator.de' });

    expect(mail.querySelector('input[data-field="email"]').value).toBe('booking@creator.de');
    expect(mail.querySelector('a').getAttribute('href')).toBe('mailto:booking@creator.de');
  });

  it('verlinkt Telefonnummern per tel-Schema', () => {
    const tel = cell('cp-col-telefon', { telefon: '+49 170 1234567' });

    expect(tel.querySelector('a').getAttribute('href')).toBe('tel:+49 170 1234567');
  });

  it('haelt beide Spalten fuer Kunden und Gaeste verborgen', () => {
    expect(isColumnVisibleForCustomer('cp-col-mail', true, [])).toBe(false);
    expect(isColumnVisibleForCustomer('cp-col-telefon', true, [])).toBe(false);
  });

  it('gibt die Werte im Kundenmarkup nicht aus', () => {
    const item = { email: 'booking@creator.de', telefon: '+49 170 1234567' };
    const html = renderItemRow(baseCtx({ isKunde: true }), { id: 'i1', ...item }, 0);

    expect(html).not.toContain('booking@creator.de');
    expect(html).not.toContain('1234567');
  });

  it('laesst sie fuer interne Nutzer ueber den Drawer abschaltbar', () => {
    expect(isColumnVisibleForCustomer('cp-col-mail', false, [])).toBe(true);
    expect(isColumnVisibleForCustomer('cp-col-mail', false, ['cp-col-mail'])).toBe(false);
  });
});

describe('Sourcing – Bild-Spalte', () => {
  it('zeigt das Profilbild aus dem Storage', () => {
    const bild = cell('cp-col-bild', { name: 'Mia', profile_image_url: 'https://cdn.test/p.webp' });
    const img = bild.querySelector('img.table-avatar-img');

    expect(img.getAttribute('src')).toBe('https://cdn.test/p.webp');
    expect(img.getAttribute('alt')).toBe('Mia');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('faellt ohne Bild auf den Initial des Namens zurueck', () => {
    const bild = cell('cp-col-bild', { name: 'mia mueller' });

    expect(bild.querySelector('img')).toBeNull();
    expect(bild.querySelector('span.table-avatar').textContent.trim()).toBe('M');
  });

  it('zeigt ohne Namen ein Fragezeichen', () => {
    expect(cell('cp-col-bild', {}).querySelector('span.table-avatar').textContent.trim()).toBe('?');
  });

  it('ist auch fuer Kunden sichtbar', () => {
    const bild = cell('cp-col-bild', { profile_image_url: 'https://cdn.test/p.webp' }, { isKunde: true });

    expect(bild.querySelector('img')).not.toBeNull();
  });
});

describe('Sourcing – Sticky-Positionen', () => {
  it('setzt intern Bild auf Position 2 und Name auf 3', () => {
    expect(getStickyClasses(baseCtx())).toEqual({
      bild: 'col-sticky-2',
      name: 'col-sticky-3'
    });
  });

  it('zieht den Namen auf Position 2, wenn das Bild ausgeblendet ist', () => {
    expect(getStickyClasses(baseCtx({ hiddenColumns: ['cp-col-bild'] }))).toEqual({
      bild: '',
      name: 'col-sticky-2'
    });
  });

  it('rueckt in der Kundenansicht ohne Drag-Spalte eine Position nach vorn', () => {
    expect(getStickyClasses(baseCtx({ isKunde: true }))).toEqual({
      bild: 'col-sticky-1',
      name: 'col-sticky-2'
    });
  });

  it('macht den Namen zur einzigen fixierten Spalte, wenn Kunde und kein Bild', () => {
    const ctx = baseCtx({ isKunde: true, hiddenColumns: ['cp-col-bild'] });

    expect(getStickyClasses(ctx)).toEqual({ bild: '', name: 'col-sticky-1' });
  });

  it('vergibt die Klassen in Kopf und Zeile identisch', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-name').classList.contains('col-sticky-3')).toBe(true);
    expect(doc.querySelector('tbody td.cp-col-name').classList.contains('col-sticky-3')).toBe(true);
  });
});

describe('Sourcing – TikTok-Spalten', () => {
  it('umfasst Link, Follower und Reichweite', () => {
    expect(TIKTOK_SPALTEN).toEqual([
      'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-reichweite-tt'
    ]);
  });

  it('blendet genau diese drei aus, wenn sie vorbelegt sind', () => {
    for (const col of TIKTOK_SPALTEN) {
      expect(isColumnVisibleForCustomer(col, false, TIKTOK_SPALTEN)).toBe(false);
    }
    expect(isColumnVisibleForCustomer('cp-col-link-ig', false, TIKTOK_SPALTEN)).toBe(true);
  });

  it('reduziert die Spaltenanzahl um drei', () => {
    const mit = getVisibleColumnCount(false, []);
    const ohne = getVisibleColumnCount(false, TIKTOK_SPALTEN);

    expect(mit - ohne).toBe(3);
  });
});

describe('Sourcing – Spaltenliste', () => {
  it('deckt alle im Kopf gerenderten Spalten ab', () => {
    const kopf = Array.from(tableDoc([{ id: 'i1' }]).querySelectorAll('thead th'))
      .map(th => Array.from(th.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);

    for (const col of kopf) {
      expect(SOURCING_SPALTEN).toContain(col);
    }
  });
});
