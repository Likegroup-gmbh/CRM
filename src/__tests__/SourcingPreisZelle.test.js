import { describe, it, expect } from 'vitest';
import {
  renderItemRow,
  renderAddSection,
  berechnePreisAusViews,
  parsePreisFreitext,
  berechneGesamtpreis,
  getListenTkp,
  DEFAULT_TKP
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

function renderCell(columnClass, item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector(`td.${columnClass}`);
}

describe('Sourcing – Preis-Zellen mit View-Basis', () => {
  it('zeigt Preis und View-Basis zweizeilig', () => {
    const cell = renderCell('cp-col-cpm-ig-8', { ig_views_8: 6029 });

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('150,73 €');
    expect(cell.querySelector('.cpm-auto-reach').textContent.trim()).toBe('Ø 6,0K Views');
  });

  it('formatiert die View-Basis unter 1.000, ab 1.000 und ab 1 Mio.', () => {
    const reach = (views) => renderCell('cp-col-cpm-ig-30', { ig_views_30: views })
      .querySelector('.cpm-auto-reach').textContent.trim();

    expect(reach(850)).toBe('Ø 850 Views');
    expect(reach(12200)).toBe('Ø 12,2K Views');
    expect(reach(1450000)).toBe('Ø 1,5M Views');
  });

  it('zeigt ohne View-Basis nur einen Strich und keine leere zweite Zeile', () => {
    const cell = renderCell('cp-col-cpm-ig-8', {});

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('-');
    expect(cell.querySelector('.cpm-auto-reach')).toBeNull();
  });

  it('zeigt die View-Basis auch im 30er-Fenster', () => {
    const cell = renderCell('cp-col-cpm-ig-30', { ig_views_30: 3980 });

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('99,50 €');
    expect(cell.querySelector('.cpm-auto-reach').textContent.trim()).toBe('Ø 4,0K Views');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('3.980 Views im Schnitt × 25 € TKP');
  });
});

describe('Sourcing – Ausreißer-Hinweis im Tooltip', () => {
  it('nennt Anzahl, Richtung und Reichweite der entfernten Ausreißer', () => {
    const cell = renderCell('cp-col-cpm-ig-8', {
      ig_views_8: 50000,
      ig_stats: {
        outliers_8: [
          { views: 1000000, side: 'high' },
          { views: 10, side: 'low' }
        ]
      }
    });

    expect(cell.querySelector('.cpm-auto-value').title).toBe(
      '50.000 Views im Schnitt × 25 € TKP\n2 Ausreißer entfernt'
      + '\nnach oben: 1.000.000 Views\nnach unten: 10 Views'
    );
  });

  it('sagt es auch, wenn nichts entfernt wurde', () => {
    const cell = renderCell('cp-col-cpm-ig-30', {
      ig_views_30: 50000,
      ig_stats: { outliers_30: [] }
    });

    expect(cell.querySelector('.cpm-auto-value').title).toContain('Keine Ausreißer erkannt');
  });

  it('weist die ausgeschlossenen Werbe-Reels aus', () => {
    const cell = renderCell('cp-col-cpm-ig-8', {
      ig_views_8: 50000,
      ig_stats: { outliers_8: [], skipped_ads: 3 }
    });

    expect(cell.querySelector('.cpm-auto-value').title)
      .toContain('3 Reels mit Werbe-Kennzeichnung ausgeschlossen');
  });

  it('setzt den Singular bei genau einem Werbe-Reel', () => {
    const cell = renderCell('cp-col-cpm-ig-8', {
      ig_views_8: 50000,
      ig_stats: { outliers_8: [], skipped_ads: 1 }
    });

    expect(cell.querySelector('.cpm-auto-value').title)
      .toContain('1 Reel mit Werbe-Kennzeichnung ausgeschlossen');
  });

  it('laesst den Hinweis weg, solange keine Statistik vorliegt', () => {
    const cell = renderCell('cp-col-cpm-ig-8', { ig_views_8: 50000 });

    expect(cell.querySelector('.cpm-auto-value').title).toBe('50.000 Views im Schnitt × 25 € TKP');
  });

  it('haengt den Hinweis nicht an eine leere Zelle', () => {
    const cell = renderCell('cp-col-cpm-ig-8', { ig_stats: { outliers_8: [] } });

    expect(cell.querySelector('.cpm-auto-value').title).toBe('Noch nicht abgerufen');
  });

  it('blurrt im Kunden-Call Preis und View-Basis gemeinsam', () => {
    const cell = renderCell(
      'cp-col-cpm-ig-8',
      { ig_views_8: 6029 },
      { kundenCallActive: true }
    );
    const wrapper = cell.querySelector('.cpm-auto-value');

    expect(wrapper.classList.contains('kunden-call-blur')).toBe(true);
    expect(wrapper.querySelector('.cpm-auto-price')).not.toBeNull();
    expect(wrapper.querySelector('.cpm-auto-reach')).not.toBeNull();
  });
});

describe('Sourcing – TKP der Liste', () => {
  it('rechnet den Preis mit dem TKP der Liste, nicht mit den gespeicherten cpm_ig_*', () => {
    const cell = renderCell(
      'cp-col-cpm-ig-8',
      { ig_views_8: 6029, cpm_ig_8: 150.73 },
      { liste: { tkp: 40 } }
    );

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('241,16 €');
  });

  it('nennt den verwendeten TKP im Tooltip', () => {
    const cell = renderCell('cp-col-cpm-ig-30', { ig_views_30: 10000 }, { liste: { tkp: 12.5 } });

    expect(cell.querySelector('.cpm-auto-value').title).toBe('10.000 Views im Schnitt × 12,5 € TKP');
  });

  it('faellt fuer Bestandslisten ohne TKP auf 25 zurueck', () => {
    expect(getListenTkp(undefined)).toBe(DEFAULT_TKP);
    expect(getListenTkp({})).toBe(DEFAULT_TKP);
    expect(getListenTkp({ tkp: null })).toBe(DEFAULT_TKP);
    expect(getListenTkp({ tkp: 0 })).toBe(DEFAULT_TKP);
    expect(getListenTkp({ tkp: '40' })).toBe(40);
  });

  it('rundet den Preis auf Cent', () => {
    expect(berechnePreisAusViews(1000, 25)).toBe(25);
    expect(berechnePreisAusViews(6029, 25)).toBe(150.73);
    expect(berechnePreisAusViews(3333, 33.33)).toBe(111.09);
    expect(berechnePreisAusViews(null, 25)).toBeNull();
  });
});

describe('Sourcing – Kopfzeile der Detailtabelle', () => {
  function kopf(ctx = {}) {
    const html = renderAddSection({ isKunde: false, ...ctx });
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('fuehrt zum Drawer statt ein eigenes TKP-Feld neben der Suche zu zeigen', () => {
    const doc = kopf({ liste: { tkp: 40 } });

    expect(doc.querySelector('#btn-sourcing-tabelle-anpassen').textContent.trim())
      .toBe('Tabelle anpassen');
    expect(doc.querySelector('#sourcing-tkp-input')).toBeNull();
  });
});

describe('Sourcing – Story-Spalten', () => {
  it('nimmt Story-Reichweite und Story-Preis als Freitext auf', () => {
    const reichweite = renderCell('cp-col-reichweite-story', { reichweite_story: '8K' });
    const preis = renderCell('cp-col-preis-story', { preis_story: '250€' });

    expect(reichweite.querySelector('input[data-field="reichweite_story"]').value).toBe('8K');
    expect(preis.querySelector('input[data-field="preis_story"]').value).toBe('250€');
  });

  it('zeigt Kunden die Story-Werte nur lesend', () => {
    const cell = renderCell('cp-col-preis-story', { preis_story: '250€' }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('250€');
  });

  it('blurrt die Story-Spalten im Kunden-Call nicht', () => {
    const cell = renderCell('cp-col-preis-story', { preis_story: '250€' }, { kundenCallActive: true });

    expect(cell.querySelector('.kunden-call-blur')).toBeNull();
  });
});

describe('Sourcing – Preis Reels (manuell)', () => {
  it('nimmt den Reel-Preis als Freitext auf', () => {
    const cell = renderCell('cp-col-preis-reels', { preis_reels: 'ca. 1.200 €' });

    expect(cell.querySelector('input[data-field="preis_reels"]').value).toBe('ca. 1.200 €');
  });

  it('zeigt Kunden den Wert nur lesend', () => {
    const cell = renderCell('cp-col-preis-reels', { preis_reels: '900 €' }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('900 €');
  });
});

describe('parsePreisFreitext', () => {
  it('liest deutsche Zahlenformate', () => {
    expect(parsePreisFreitext('1.200')).toBe(1200);
    expect(parsePreisFreitext('1.200,50')).toBe(1200.5);
    expect(parsePreisFreitext('1200')).toBe(1200);
    expect(parsePreisFreitext('1200,50')).toBe(1200.5);
    expect(parsePreisFreitext('1.200.000')).toBe(1200000);
  });

  it('behandelt einen Punkt vor weniger als drei Ziffern als Dezimaltrenner', () => {
    expect(parsePreisFreitext('1.5')).toBe(1.5);
  });

  it('zieht die erste Zahl aus einem Freitext', () => {
    expect(parsePreisFreitext('ca. 1.200 € netto')).toBe(1200);
    expect(parsePreisFreitext('1200-1500 €')).toBe(1200);
    expect(parsePreisFreitext('€ 850')).toBe(850);
    expect(parsePreisFreitext('Preis 1200.')).toBe(1200);
  });

  it('gibt null zurueck, wenn keine Zahl drinsteht', () => {
    for (const value of ['', null, undefined, 'auf Anfrage', 'tbd']) {
      expect(parsePreisFreitext(value)).toBeNull();
    }
  });

  it('nimmt Zahlen direkt an', () => {
    expect(parsePreisFreitext(1200)).toBe(1200);
    expect(parsePreisFreitext(NaN)).toBeNull();
  });
});

describe('Sourcing – Gesamtpreis', () => {
  it('summiert Reel- und Story-Preis', () => {
    expect(berechneGesamtpreis({ preis_reels: '1.200', preis_story: '300' })).toBe(1500);
  });

  it('rechnet auch, wenn nur einer der beiden gefuellt ist', () => {
    expect(berechneGesamtpreis({ preis_reels: '1.200' })).toBe(1200);
    expect(berechneGesamtpreis({ preis_story: '300' })).toBe(300);
  });

  it('gibt null zurueck, wenn keiner der beiden als Zahl lesbar ist', () => {
    expect(berechneGesamtpreis({})).toBeNull();
    expect(berechneGesamtpreis({ preis_reels: 'auf Anfrage', preis_story: '' })).toBeNull();
  });

  it('rendert die Summe als read-only Zelle', () => {
    const cell = renderCell('cp-col-gesamtpreis', { preis_reels: '1.200', preis_story: '300' });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('1.500,00 €');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('Preis Reels + Preis Story');
  });

  it('zeigt einen Strich und erklaert warum, wenn nichts lesbar ist', () => {
    const cell = renderCell('cp-col-gesamtpreis', { preis_reels: 'auf Anfrage' });

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('-');
    expect(cell.querySelector('.cpm-auto-value').title).toContain('keine Zahl');
  });
});
