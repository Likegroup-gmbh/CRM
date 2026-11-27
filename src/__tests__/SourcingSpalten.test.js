import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
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
import { baseCtx, rowDoc, cell, tableDoc } from './sourcingTabelleTestKit.js';

describe('Sourcing – Spaltenreihenfolge', () => {
  /** Reihenfolge der cp-col-Klassen, wie sie im DOM stehen */
  function reihenfolge(nodes) {
    return Array.from(nodes)
      .map(el => Array.from(el.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);
  }

  it('stellt den Namen mit Bild direkt hinter die Checkbox, danach Link und Follower', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten.slice(0, 4)).toEqual([
      'cp-col-drag', 'cp-col-name', 'cp-col-link', 'cp-col-follower'
    ]);
    expect(SOURCING_SPALTEN).not.toContain('cp-col-bild');
  });

  it('stellt den Link direkt hinter den Namen, den Follower direkt dahinter', () => {
    expect(SOURCING_SPALTEN[SOURCING_SPALTEN.indexOf('cp-col-name') + 1])
      .toBe('cp-col-link');
    expect(SOURCING_SPALTEN[SOURCING_SPALTEN.indexOf('cp-col-link') + 1])
      .toBe('cp-col-follower');
  });

  it('rendert Namen und Link auch im Kopf direkt nebeneinander', () => {
    const kopf = reihenfolge(tableDoc([{ id: 'i1' }]).querySelectorAll('thead th'));
    const ab = kopf.indexOf('cp-col-name');

    expect(kopf.slice(ab, ab + 3)).toEqual([
      'cp-col-name', 'cp-col-link', 'cp-col-follower'
    ]);
  });

  it('ordnet Gesamtpreis, Kurzbeschreibung, Kundenfeedback, Rückmeldung Kunde, Status, Location und Mail in dieser Folge an', () => {
    const block = [
      'cp-col-pricing', 'cp-col-notiz', 'cp-col-kunden-feedback', 'cp-col-feedback',
      'cp-col-status', 'cp-col-location', 'cp-col-mail'
    ];
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const kopf = reihenfolge(tableDoc([{ id: 'i1' }]).querySelectorAll('thead th'));
    const ausschnitt = (folge) => folge.slice(folge.indexOf('cp-col-pricing'), folge.indexOf('cp-col-pricing') + block.length);

    expect(ausschnitt(spalten)).toEqual(block);
    expect(ausschnitt(kopf)).toEqual(block);
    expect(ausschnitt(SOURCING_SPALTEN)).toEqual(block);
  });

  it('haelt die Kurzbeschreibung genau einmal direkt hinter dem Gesamtpreis', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten.filter(c => c === 'cp-col-notiz')).toHaveLength(1);
    expect(spalten[spalten.indexOf('cp-col-pricing') + 1]).toBe('cp-col-notiz');
  });

  it('fasst Instagram und TikTok zu elf gemeinsamen Spalten zusammen', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));
    const ab = spalten.indexOf('cp-col-link');

    expect(spalten.slice(ab, ab + 11)).toEqual([
      'cp-col-link', 'cp-col-follower', 'cp-col-engagement',
      'cp-col-views-12', 'cp-col-cpm-12', 'cp-col-views-30', 'cp-col-cpm-30', 'cp-col-preis-video',
      'cp-col-reichweite-story', 'cp-col-story-preis', 'cp-col-pricing'
    ]);
  });

  it('setzt hinter Preis Story den Gesamtpreis und fuehrt Telefon, Nutzungsrechte, Garantie und Matching nicht mehr als Standardspalten', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    expect(spalten[spalten.indexOf('cp-col-story-preis') + 1]).toBe('cp-col-pricing');
    for (const weg of ['cp-col-telefon', 'cp-col-nutzungsrechte', 'cp-col-reichweite-garantie', 'cp-col-matching']) {
      expect(spalten, weg).not.toContain(weg);
      expect(SOURCING_SPALTEN, weg).not.toContain(weg);
    }
  });

  it('kennt die alten Plattform-Spalten nicht mehr als eigene Zellen', () => {
    const spalten = reihenfolge(rowDoc().querySelectorAll('tr > td'));

    for (const alt of ['cp-col-link-ig', 'cp-col-link-tt', 'cp-col-follower-ig', 'cp-col-follower-tt',
      'cp-col-engagement-ig', 'cp-col-cpm-ig-8', 'cp-col-cpm-ig-12', 'cp-col-cpm-ig-30',
      'cp-col-cpm-8', 'cp-col-views-ig-12', 'cp-col-views-ig-30',
      'cp-col-preis-reels', 'cp-col-preis-story', 'cp-col-preis-tt-video', 'cp-col-preis-tt-story',
      'cp-col-pricing-ig', 'cp-col-pricing-tt']) {
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
    columnOrder.splice(columnOrder.indexOf('cp-col-link'), 0, 'cp-col-status');
    const doc = tableDoc([{ id: 'i1' }], { columnOrder });
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));
    const ab = kopf.indexOf('cp-col-name');

    expect(kopf.slice(ab, ab + 3)).toEqual(['cp-col-name', 'cp-col-status', 'cp-col-link']);
    expect(reihenfolge(doc.querySelectorAll('tbody tr.item-row > td'))).toEqual(kopf);
    expect(getStickyClasses(baseCtx({ columnOrder }))).toEqual({ name: 'col-sticky-2' });
  });

  it('haelt den Namen auch bei umsortierten Spalten in der Sticky-Gruppe', () => {
    const columnOrder = [
      'cp-col-status',
      ...standardBeweglicheSpalten().filter(id => id !== 'cp-col-status')
    ];
    const doc = tableDoc([{ id: 'i1' }], { columnOrder });
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));

    expect(kopf.slice(0, 3)).toEqual(['cp-col-drag', 'cp-col-name', 'cp-col-status']);
    expect(doc.querySelector('.cp-col-bild')).toBeNull();
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

    expect(doc.querySelector('thead th.cp-col-cpm-12').textContent.trim()).toBe('Preis 12 Videos');
    expect(doc.querySelector('thead th.cp-col-cpm-30').textContent.trim()).toBe('Preis 30 Videos');
  });

  it('traegt im Kopf weder Plattform-Icons noch Farbe', () => {
    const kopf = tableDoc([{ id: 'i1' }]);

    for (const col of ['cp-col-link', 'cp-col-follower', 'cp-col-engagement', 'cp-col-views-12',
      'cp-col-cpm-12', 'cp-col-views-30', 'cp-col-cpm-30', 'cp-col-preis-video',
      'cp-col-reichweite-story', 'cp-col-story-preis', 'cp-col-pricing']) {
      expect(kopf.querySelector(`thead th.${col} svg`), col).toBeNull();
    }
  });

  it('erklaert im Kopf-Tooltip die Werbe- und die Ausreisser-Regel', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    for (const col of ['cp-col-views-12', 'cp-col-cpm-12']) {
      const titel = doc.querySelector(`thead th.${col}`).getAttribute('title');
      expect(titel, col).toContain('ohne Werbung');
      expect(titel, col).toContain('angepinnte TikToks');
      expect(titel, col).toContain('doppelt so viele');
    }
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

  it('rendert Matching, Telefon, Nutzungsrechte und Reichweitengarantie nicht mehr als Standardspalten', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-matching')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-telefon')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-nutzungsrechte')).toBeNull();
    expect(doc.querySelector('thead th.cp-col-reichweite-garantie')).toBeNull();
  });

  it('benennt die Kundenfeedback-Spalte', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-kunden-feedback').textContent.trim())
      .toBe('Kundenfeedback');
  });

  it('nennt im Tooltip den TKP der Liste statt der festen 25', () => {
    const doc = tableDoc([{ id: 'i1' }], { liste: { tkp: 40 } });

    expect(doc.querySelector('thead th.cp-col-cpm-12').getAttribute('title'))
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
    const sichtbar = Array.from(doc.querySelectorAll('.kategorie-col-header-row th'))
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

  it('haelt Mail fuer Kunden und Gaeste verborgen', () => {
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

describe('Sourcing – TikTok-Spalten', () => {
  it('umfasst Link, Follower, die Abruf-Werte und die drei Preis-Spalten', () => {
    expect(TIKTOK_SPALTEN).toEqual([
      'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-engagement-tt',
      'cp-col-views-tt-12', 'cp-col-cpm-tt-12', 'cp-col-views-tt-30', 'cp-col-cpm-tt-30',
      'cp-col-preis-tt-video', 'cp-col-preis-tt-story', 'cp-col-pricing-tt'
    ]);
  });

  it('blendet genau diese aus, wenn sie vorbelegt sind', () => {
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
