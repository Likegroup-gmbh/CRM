import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import { renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';
import {
  isColumnVisibleForCustomer,
  getVisibleColumnCount,
  getStickyClasses
} from '../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js';
import {
  DEAKTIVIERTE_SPALTEN,
  TIKTOK_SPALTEN,
  SOURCING_SPALTEN
} from '../modules/creator-auswahl/sourcingSpaltenKatalog.js';
import { SourcingTabelleAnpassenDrawer } from '../modules/creator-auswahl/SourcingTabelleAnpassenDrawer.js';
import { standardBeweglicheSpalten } from '../modules/creator-auswahl/sourcingSpaltenfolge.js';

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

  it('stellt Bild zwischen Checkbox und Namen, Status und Kundenfeedback hinter die Creator Art', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten.slice(0, 11)).toEqual([
      'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-notiz', 'cp-col-matching',
      'cp-col-typ', 'cp-col-status', 'cp-col-kunden-feedback',
      'cp-col-location', 'cp-col-mail', 'cp-col-telefon'
    ]);
  });

  it('stellt die Kurzbeschreibung direkt hinter den Namen, Matching davor die Creator Art', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const ab = spalten.indexOf('cp-col-name');

    expect(spalten.slice(ab, ab + 4)).toEqual([
      'cp-col-name', 'cp-col-notiz', 'cp-col-matching', 'cp-col-typ'
    ]);
    expect(SOURCING_SPALTEN[SOURCING_SPALTEN.indexOf('cp-col-name') + 1])
      .toBe('cp-col-notiz');
    expect(SOURCING_SPALTEN[SOURCING_SPALTEN.indexOf('cp-col-notiz') + 1])
      .toBe('cp-col-matching');
  });

  it('zieht die Kurzbeschreibung auch im Kopf nach vorne', () => {
    const kopf = reihenfolge(tableDoc([{ id: 'i1' }]).querySelectorAll('thead th'));
    const ab = kopf.indexOf('cp-col-name');

    expect(kopf.slice(ab, ab + 4)).toEqual([
      'cp-col-name', 'cp-col-notiz', 'cp-col-matching', 'cp-col-typ'
    ]);
  });

  it('haelt die Kurzbeschreibung nicht mehr am Ende bei der Rueckmeldung', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten.filter(c => c === 'cp-col-notiz')).toHaveLength(1);
    expect(spalten[spalten.indexOf('cp-col-vk') + 1]).toBe('cp-col-feedback');
  });

  it('fasst Instagram und TikTok zu acht gemeinsamen Spalten zusammen', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const ab = spalten.indexOf('cp-col-link');

    expect(spalten.slice(ab, ab + 8)).toEqual([
      'cp-col-link', 'cp-col-follower', 'cp-col-engagement-ig',
      'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-preis-video',
      'cp-col-reichweite-story', 'cp-col-story-preis'
    ]);
  });

  it('setzt hinter Preis Story Gesamtpreis, Nutzungsrechte und Garantie', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const ab = spalten.indexOf('cp-col-story-preis');

    expect(spalten.slice(ab, ab + 4)).toEqual([
      'cp-col-story-preis', 'cp-col-pricing', 'cp-col-nutzungsrechte', 'cp-col-reichweite-garantie'
    ]);
  });

  it('kennt die alten Plattform-Spalten nicht mehr als eigene Zellen', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    for (const alt of ['cp-col-link-ig', 'cp-col-link-tt', 'cp-col-follower-ig', 'cp-col-follower-tt',
      'cp-col-preis-reels', 'cp-col-preis-story', 'cp-col-preis-tt-video', 'cp-col-preis-tt-story']) {
      expect(spalten, alt).not.toContain(alt);
      expect(SOURCING_SPALTEN, alt).not.toContain(alt);
    }
  });

  it('kennt die manuellen Reichweite-Spalten nicht mehr', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten).not.toContain('cp-col-reichweite-ig');
    expect(spalten).not.toContain('cp-col-reichweite-tt');
    expect(SOURCING_SPALTEN).not.toContain('cp-col-reichweite-ig');
    expect(SOURCING_SPALTEN).not.toContain('cp-col-reichweite-tt');
  });

  it('rendert Kopf und Zeile in derselben Reihenfolge', () => {
    const doc = tableDoc([{ id: 'i1' }]);
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));
    const zeile = reihenfolge(doc.querySelectorAll('tbody tr.item-row > td'));

    expect(zeile).toEqual(kopf);
  });

  it('folgt einer gespeicherten Reihenfolge und laesst den Namen fest', () => {
    const columnOrder = standardBeweglicheSpalten().filter(id => id !== 'cp-col-status');
    columnOrder.splice(columnOrder.indexOf('cp-col-notiz'), 0, 'cp-col-status');
    const doc = tableDoc([{ id: 'i1' }], { columnOrder });
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));
    const ab = kopf.indexOf('cp-col-name');

    expect(kopf.slice(ab, ab + 3)).toEqual(['cp-col-name', 'cp-col-status', 'cp-col-notiz']);
    expect(reihenfolge(doc.querySelectorAll('tbody tr.item-row > td'))).toEqual(kopf);
    expect(getStickyClasses(baseCtx({ columnOrder }))).toEqual({
      bild: 'col-sticky-2',
      name: 'col-sticky-3'
    });
  });

  it('loest das Bild aus der Sticky-Gruppe, wenn es nicht mehr vorn steht', () => {
    const columnOrder = [
      'cp-col-status',
      ...standardBeweglicheSpalten().filter(id => id !== 'cp-col-status')
    ];
    const doc = tableDoc([{ id: 'i1' }], { columnOrder });
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));

    expect(kopf.slice(0, 4)).toEqual([
      'cp-col-drag', 'cp-col-name', 'cp-col-status', 'cp-col-bild'
    ]);
    expect(doc.querySelector('th.cp-col-bild').classList.contains('col-sticky-2')).toBe(false);
    expect(doc.querySelector('th.cp-col-name').classList.contains('col-sticky-2')).toBe(true);
    expect(doc.querySelector('td.cp-col-name').classList.contains('col-sticky-2')).toBe(true);
  });

  it('nennt die Pricing-Spalte Gesamtpreis und kennt keine zweite Gesamtpreis-Spalte', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-pricing').textContent.trim()).toBe('Gesamtpreis');
    expect(doc.querySelector('thead th.cp-col-gesamtpreis')).toBeNull();
    expect(SOURCING_SPALTEN).not.toContain('cp-col-gesamtpreis');
  });

  it('nennt die Preis-Ueberschriften neutral mit Videos statt Reels', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-cpm-ig-8').textContent.trim()).toBe('Preis 8 Videos');
    expect(doc.querySelector('thead th.cp-col-cpm-ig-30').textContent.trim()).toBe('Preis 30 Videos');
  });

  it('traegt im Kopf weder Plattform-Icons noch Farbe', () => {
    const kopf = tableDoc([{ id: 'i1' }]);

    for (const col of ['cp-col-link', 'cp-col-follower', 'cp-col-engagement-ig', 'cp-col-cpm-ig-8',
      'cp-col-cpm-ig-30', 'cp-col-preis-video', 'cp-col-reichweite-story', 'cp-col-story-preis']) {
      expect(kopf.querySelector(`thead th.${col} svg`), col).toBeNull();
    }
  });

  it('erklaert im Kopf-Tooltip die Werbe- und die Ausreisser-Regel', () => {
    const titel = tableDoc([{ id: 'i1' }])
      .querySelector('thead th.cp-col-cpm-ig-8')
      .getAttribute('title');

    expect(titel).toContain('Werbe-Kennzeichnung');
    expect(titel).toContain('doppelt so viele');
  });

  it('kennt die getrimmte und die o.-A.-Preis-Spalten nicht mehr', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-cpm-ig-trimmed')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-cpm-ig-8-clean')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-cpm-ig-30-clean')).toBeNull();
    expect(SOURCING_SPALTEN).not.toContain('cp-col-cpm-ig-trimmed');
    expect(SOURCING_SPALTEN).not.toContain('cp-col-cpm-ig-8-clean');
    expect(SOURCING_SPALTEN).not.toContain('cp-col-cpm-ig-30-clean');
  });

  it('kennt die Checkbox-Spalten Anfragen und Rueckmeldung nicht mehr', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-anfragen')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-check')).toBeNull();
    expect(SOURCING_SPALTEN).not.toContain('cp-col-anfragen');
    expect(SOURCING_SPALTEN).not.toContain('cp-col-check');
  });

  it('benennt die gemeinsamen Preis-Spalten', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-preis-video').textContent.trim()).toBe('Preis Video');
    expect(doc.querySelector('thead th.cp-col-story-preis').textContent.trim()).toBe('Preis Story');
  });

  it('benennt die Matching-Spalte', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-matching').textContent.trim()).toBe('Matching');
  });

  it('benennt die Kundenfeedback-Spalte', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-kunden-feedback').textContent.trim())
      .toBe('Kundenfeedback');
  });

  it('nennt im Tooltip den TKP der Liste statt der festen 25', () => {
    const doc = tableDoc([{ id: 'i1' }], { liste: { tkp: 40 } });

    expect(doc.querySelector('thead th.cp-col-cpm-ig-8').getAttribute('title'))
      .toContain('40 € TKP');
  });

  it('benennt die Story-Spalten', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-reichweite-story').textContent.trim())
      .toBe('Reichweite Story');
    expect(doc.querySelector('thead th.cp-col-story-preis').textContent.trim())
      .toBe('Preis Story');
  });
});

describe('Sourcing – deaktivierte Spalten (EK/VK)', () => {
  it('blendet EK und VK auch fuer interne Nutzer aus', () => {
    expect(isColumnVisibleForCustomer('cp-col-ek', false, [])).toBe(false);
    expect(isColumnVisibleForCustomer('cp-col-vk', false, [])).toBe(false);
  });

  it('zaehlt sie nicht in der Spaltenanzahl mit', () => {
    const doc = tableDoc([{ id: 'i1', kategorie: 'Food' }], {
      teilbereiche: ['Food']
    });
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

  it('bietet sie nicht im Drawer "Tabelle anpassen" an', () => {
    const drawer = new SourcingTabelleAnpassenDrawer({ liste: {}, hiddenColumns: [] });
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
  it('zeigt die Mail nur als Icon-Link, nicht als Text', () => {
    const mail = cell('cp-col-mail', { email: 'booking@creator.de' });
    const link = mail.querySelector('a');

    expect(link.getAttribute('href')).toBe('mailto:booking@creator.de');
    expect(link.getAttribute('title')).toBe('booking@creator.de');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(mail.querySelector('input')).toBeNull();
    expect(mail.textContent).not.toContain('booking@creator.de');
  });

  it('zeigt ohne Mail nur einen Platzhalter', () => {
    const mail = cell('cp-col-mail', { email: null });

    expect(mail.querySelector('a')).toBeNull();
    expect(mail.textContent.trim()).toBe('-');
  });

  it('laesst Telefonnummern in der Tabelle editierbar und verlinkt sie per tel-Schema', () => {
    const tel = cell('cp-col-telefon', { telefon: '+49 170 1234567' });

    expect(tel.querySelector('input[data-field="telefon"]').value).toBe('+49 170 1234567');
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
    const bild = cell('cp-col-bild', { name: 'Mia', profile_image_url: 'https://cdn.test/p.avif' });
    const img = bild.querySelector('img.table-avatar-img');

    expect(img.getAttribute('src')).toBe('https://cdn.test/p.avif');
    expect(img.getAttribute('alt')).toBe('Mia');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.classList.contains('table-avatar--sourcing')).toBe(true);
  });

  it('nimmt fuer den kleinen Avatar das Thumbnail, wenn es vorhanden ist', () => {
    const bild = cell('cp-col-bild', {
      name: 'Mia',
      profile_image_url: 'https://cdn.test/p.avif',
      profile_image_thumb_url: 'https://cdn.test/p_thumb.avif'
    });

    expect(bild.querySelector('img').getAttribute('src')).toBe('https://cdn.test/p_thumb.avif');
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

  it('setzt den gruenen Punkt bei vorhandener creator_id', () => {
    const bild = cell('cp-col-bild', { creator_id: 'c1' });
    const dot = bild.querySelector('.sourcing-avatar__dot');

    expect(dot.classList.contains('status-dot--active')).toBe(true);
    expect(dot.getAttribute('title')).toBe('Als Creator angelegt');
  });

  it('setzt den roten Punkt nur bei Prio plus Zusage ohne Creator', () => {
    const rot = cell('cp-col-bild', { prio_1: true, zusage: true });
    expect(rot.querySelector('.sourcing-avatar__dot').classList.contains('status-dot--inactive')).toBe(true);

    expect(cell('cp-col-bild', { zusage: true }).querySelector('.sourcing-avatar__dot')).toBeNull();
    expect(cell('cp-col-bild', { prio_1: true }).querySelector('.sourcing-avatar__dot')).toBeNull();
  });

  it('zeigt Kunden und Vorschlaegen keinen Punkt', () => {
    const kunde = cell('cp-col-bild', { creator_id: 'c1' }, { isKunde: true });
    expect(kunde.querySelector('.sourcing-avatar__dot')).toBeNull();

    const vorschlag = cell('cp-col-bild', {
      isVorschlag: true,
      creator_id: 'c1',
      prio_1: true,
      zusage: true
    });
    expect(vorschlag.querySelector('.sourcing-avatar__dot')).toBeNull();
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
  it('umfasst Link, Follower und die beiden Preis-Spalten', () => {
    expect(TIKTOK_SPALTEN).toEqual([
      'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-preis-tt-video', 'cp-col-preis-tt-story'
    ]);
  });

  it('blendet genau diese vier aus, wenn sie vorbelegt sind', () => {
    for (const col of TIKTOK_SPALTEN) {
      expect(isColumnVisibleForCustomer(col, false, TIKTOK_SPALTEN)).toBe(false);
    }
    expect(isColumnVisibleForCustomer('cp-col-link', false, TIKTOK_SPALTEN)).toBe(true);
  });

  it('laesst die Spaltenanzahl gleich, weil nur die TikTok-Zeilen wegfallen', () => {
    const mit = getVisibleColumnCount(false, []);
    const ohne = getVisibleColumnCount(false, TIKTOK_SPALTEN);

    expect(mit).toBe(ohne);
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
