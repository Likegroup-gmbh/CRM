import { describe, it, expect } from 'vitest';
import {
  renderItemRow,
  renderItemsTable,
  renderAddSection,
  berechnePreisAusViews,
  getListenTkp,
  ohneEuroZeichen,
  DEFAULT_TKP
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

function renderCell(columnClass, item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector(`td.${columnClass}`);
}

function tabelle(ctx = {}) {
  const html = renderItemsTable({
    isKunde: false, hiddenColumns: [], items: [{ id: 'i1' }], hasAnyItems: true, ...ctx
  });
  return new DOMParser().parseFromString(html, 'text/html');
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

  it('zeigt das Logo des Unternehmens im linken Block', () => {
    const doc = kopf({
      liste: { unternehmen: { firmenname: 'Meta Glasses', logo_url: 'https://cdn.test/logo.png' } }
    });
    const logo = doc.querySelector('.sourcing-unternehmen-logo');

    expect(logo.getAttribute('src')).toBe('https://cdn.test/logo.png');
    expect(logo.getAttribute('alt')).toBe('Meta Glasses');
    expect(logo.getAttribute('title')).toBe('Meta Glasses');
    expect(logo.closest('.add-item-actions-left')).not.toBeNull();
  });

  it('laesst den Logo-Platz weg, wenn kein Logo hinterlegt ist', () => {
    expect(kopf({ liste: { unternehmen: { firmenname: 'Ohne Logo' } } })
      .querySelector('.sourcing-unternehmen-logo')).toBeNull();
    expect(kopf({ liste: {} }).querySelector('.sourcing-unternehmen-logo')).toBeNull();
    expect(kopf().querySelector('.sourcing-unternehmen-logo')).toBeNull();
  });

  it('zeigt den Listennamen auch ohne Logo neben dem Logo-Platz', () => {
    const doc = kopf({ liste: { name: 'Sommer <Kampagne>' } });
    const name = doc.querySelector('.sourcing-listen-name');

    expect(name.textContent).toBe('Sommer <Kampagne>');
    expect(name.closest('.sourcing-listen-kopf')).not.toBeNull();
    expect(name.closest('.add-item-actions-left')).not.toBeNull();
  });

  it('stellt die Suche vor Creator hinzufügen und Plus-Menü; Kunden sehen nur die Suche', () => {
    const doc = kopf();
    const rechts = doc.querySelector('.add-item-actions-right');
    const kinder = Array.from(rechts.children);

    expect(kinder[0].querySelector('#sourcing-item-search-input')).not.toBeNull();
    expect(kinder[1].id).toBe('btn-open-add-drawer');
    expect(kinder[2].classList.contains('sourcing-toolbar-menu')).toBe(true);

    const kundenDoc = kopf({ isKunde: true });
    expect(kundenDoc.querySelector('#sourcing-item-search-input')).not.toBeNull();
    expect(kundenDoc.querySelector('.sourcing-toolbar-menu')).toBeNull();
    expect(kundenDoc.querySelector('.sourcing-status-filter-submenu')).toBeNull();
  });

  it('legt Status-Filter und Toolbar-Actions ins Plus-Dropdown', () => {
    const doc = kopf({ kundenCallActive: true, statusFilter: ['Zusage', 'Buchen'] });
    const dropdown = doc.querySelector('.sourcing-toolbar-dropdown');
    const statusSub = dropdown.querySelector('.sourcing-status-filter-submenu');

    expect(doc.getElementById('btn-sourcing-toolbar-menu')).not.toBeNull();
    expect(statusSub.querySelector('[data-status-tag="Zusage"] .submenu-check')).not.toBeNull();
    expect(statusSub.querySelector('[data-status-tag="Buchen"] .submenu-check')).not.toBeNull();
    expect(statusSub.querySelector('[data-status-tag="Angefragt"] .submenu-check')).toBeNull();
    expect(dropdown.querySelector('#btn-share-sourcing')).not.toBeNull();
    expect(dropdown.querySelector('#btn-kunden-call-toggle').classList.contains('active')).toBe(true);
    expect(dropdown.querySelector('#btn-sourcing-tabelle-anpassen')).not.toBeNull();
    expect(dropdown.querySelector('#btn-sourcing-custom-columns')).not.toBeNull();
    expect(dropdown.querySelector('#btn-manage-kategorien')).not.toBeNull();
    expect(dropdown.querySelector('#btn-open-add-drawer')).toBeNull();
  });
});

describe('Sourcing – Story-Spalten', () => {
  it('nimmt Story-Reichweite und Story-Preis als Freitext auf', () => {
    const reichweite = renderCell('cp-col-reichweite-story', { reichweite_story: '8K' });
    const preis = renderCell('cp-col-preis-story', { preis_story: '250' });

    expect(reichweite.querySelector('input[data-field="reichweite_story"]').value).toBe('8K');
    expect(preis.querySelector('input[data-field="preis_story"]').value).toBe('250');
  });

  it('zeigt Kunden die Story-Werte nur lesend', () => {
    const cell = renderCell('cp-col-preis-story', { preis_story: '250' }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('250 €');
  });

  it('blurrt die Story-Spalten im Kunden-Call nicht', () => {
    const cell = renderCell('cp-col-preis-story', { preis_story: '250€' }, { kundenCallActive: true });

    expect(cell.querySelector('.kunden-call-blur')).toBeNull();
  });
});

describe('Sourcing – Preis Reels (manuell)', () => {
  it('nimmt den Reel-Preis als Freitext auf', () => {
    const cell = renderCell('cp-col-preis-reels', { preis_reels: 'ca. 1.200' });

    expect(cell.querySelector('input[data-field="preis_reels"]').value).toBe('ca. 1.200');
  });

  it('zeigt Kunden den Wert nur lesend', () => {
    const cell = renderCell('cp-col-preis-reels', { preis_reels: '900' }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('900 €');
  });
});

describe('Sourcing – Gesamtpreis', () => {
  it('nennt die frueher "Tatsächlicher Preis" genannte Spalte Gesamtpreis', () => {
    const doc = tabelle();

    expect(doc.querySelector('thead th.cp-col-pricing').textContent.trim()).toBe('Gesamtpreis');
    expect(doc.querySelector('thead th.cp-col-gesamtpreis')).toBeNull();
  });

  it('nimmt den Gesamtpreis als Freitext im Feld pricing auf', () => {
    const cell = renderCell('cp-col-pricing', { pricing: '1.500' });

    expect(cell.querySelector('input[data-field="pricing"]').value).toBe('1.500');
  });

  it('zeigt die alte Gesamtpreis-Spalte nicht mehr in der Zeile', () => {
    expect(renderCell('cp-col-gesamtpreis', { gesamtpreis: '1.500' })).toBeNull();
  });
});

describe('Sourcing – Euro-Zeichen in den Preisfeldern', () => {
  const PREIS_FELDER = [
    ['cp-col-preis-reels', 'preis_reels'],
    ['cp-col-preis-story', 'preis_story'],
    ['cp-col-pricing', 'pricing'],
    ['cp-col-ek', 'preis_ek'],
    ['cp-col-vk', 'preis_vk']
  ];

  it('haengt an jedes Preisfeld ein festes Euro-Zeichen', () => {
    for (const [spalte, feld] of PREIS_FELDER) {
      const cell = renderCell(spalte, { [feld]: '250' });
      const suffix = cell.querySelector('.cell-euro__suffix');

      expect(suffix, spalte).not.toBeNull();
      expect(suffix.textContent.trim()).toBe('€');
      expect(cell.querySelector(`[data-field="${feld}"]`).classList.contains('cell-euro__input')).toBe(true);
    }
  });

  it('zeigt das Zeichen auch bei leerem Feld', () => {
    expect(renderCell('cp-col-pricing', {}).querySelector('.cell-euro__suffix')).not.toBeNull();
  });

  it('schneidet ein bereits gespeichertes Euro-Zeichen vom Wert ab', () => {
    const cell = renderCell('cp-col-preis-reels', { preis_reels: '1.200 €' });

    expect(cell.querySelector('input[data-field="preis_reels"]').value).toBe('1.200');
    expect(ohneEuroZeichen('900€')).toBe('900');
    expect(ohneEuroZeichen(null)).toBe('');
  });

  it('haengt das Zeichen in der Kundenansicht an den Wert', () => {
    const cell = renderCell('cp-col-pricing', { pricing: '1.500' }, { isKunde: true });

    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('1.500 €');
  });

  it('zeigt in der Kundenansicht ohne Wert einen Strich statt eines einsamen Euro', () => {
    const cell = renderCell('cp-col-pricing', {}, { isKunde: true });

    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('-');
  });

  it('blurrt den EK im Kunden-Call weiterhin', () => {
    const input = renderCell('cp-col-ek', { preis_ek: 500 }, { kundenCallActive: true })
      .querySelector('input[data-field="preis_ek"]');

    expect(input.classList.contains('kunden-call-blur')).toBe(true);
    expect(input.hasAttribute('data-blur-target')).toBe(true);
  });
});

describe('Sourcing – Nutzungsrechte', () => {
  it('steht als Freitext direkt hinter dem Gesamtpreis', () => {
    const kopf = Array.from(tabelle().querySelectorAll('thead th'))
      .map(th => Array.from(th.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);

    expect(kopf[kopf.indexOf('cp-col-pricing') + 1]).toBe('cp-col-nutzungsrechte');
  });

  it('speichert in das Feld nutzungsrechte', () => {
    const cell = renderCell('cp-col-nutzungsrechte', { nutzungsrechte: '6 Monate Paid Social' });

    expect(cell.querySelector('textarea[data-field="nutzungsrechte"]').value)
      .toBe('6 Monate Paid Social');
  });

  it('zeigt Kunden den Wert nur lesend', () => {
    const cell = renderCell('cp-col-nutzungsrechte', { nutzungsrechte: 'IG + TikTok' }, { isKunde: true });

    expect(cell.querySelector('textarea')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('IG + TikTok');
  });
});
