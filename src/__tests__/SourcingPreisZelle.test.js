import { describe, it, expect } from 'vitest';
import { renderCell, renderZeile } from './sourcingZelleKit.js';
import { renderItemsTable, renderAddSection } from '../modules/creator-auswahl/castingTableRender.js';
import {
  berechnePreisAusViews,
  bindListenTkpFeld,
  getListenTkp,
  parseListenTkp,
  ohneEuroZeichen,
  DEFAULT_TKP
} from '../modules/creator-auswahl/castingPreisZellen.js';


function tabelle(ctx = {}) {
  const html = renderItemsTable({
    isKunde: false, hiddenColumns: [], items: [{ id: 'i1' }], hasAnyItems: true, ...ctx
  });
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Sourcing – TKP der Liste', () => {
  it('rechnet den Preis mit dem TKP der Liste, nicht mit den gespeicherten cpm_ig_*', () => {
    const cell = renderCell(
      'cp-col-cpm-ig-12',
      { ig_views_12: 6029, cpm_ig_12: 150.73 },
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

  it('liest 40, 12,5 und 12.5 und weist leer, 0 und negativ zurueck', () => {
    expect(parseListenTkp('40')).toBe(40);
    expect(parseListenTkp('12,5')).toBe(12.5);
    expect(parseListenTkp('12.5')).toBe(12.5);
    expect(parseListenTkp('12,555')).toBe(12.56);
    expect(parseListenTkp('')).toBeNull();
    expect(parseListenTkp('   ')).toBeNull();
    expect(parseListenTkp('0')).toBeNull();
    expect(parseListenTkp('-1')).toBeNull();
    expect(parseListenTkp('abc')).toBeNull();
  });

  it('speichert einen neuen TKP beim Verlassen und laesst denselben Wert liegen', () => {
    const input = document.createElement('input');
    const saves = [];
    const off = bindListenTkpFeld(input, {
      getAktuell: () => 25,
      onSave: (tkp) => saves.push(tkp)
    });

    input.value = '40';
    input.dispatchEvent(new Event('blur'));
    expect(saves).toEqual([40]);

    input.value = '25,00';
    input.dispatchEvent(new Event('blur'));
    expect(saves).toEqual([40]);
    expect(input.value).toBe('25');
    off();
  });

  it('stellt 0 und leere Eingaben auf den bisherigen TKP zurueck', () => {
    const input = document.createElement('input');
    const meldungen = [];
    window.toastSystem = { show: (msg) => meldungen.push(msg) };
    const off = bindListenTkpFeld(input, {
      getAktuell: () => 40,
      onSave: () => { throw new Error('soll nicht speichern'); }
    });

    input.value = '0';
    input.dispatchEvent(new Event('blur'));
    input.value = '';
    input.dispatchEvent(new Event('blur'));

    expect(input.value).toBe('40');
    expect(meldungen).toEqual([
      'TKP muss größer als 0 sein',
      'TKP muss größer als 0 sein'
    ]);
    off();
    delete window.toastSystem;
  });
});

describe('Sourcing – Kopfzeile der Detailtabelle', () => {
  function kopf(ctx = {}) {
    // Interner Default hat create-Recht; Kunden-/Investor-Faelle setzen canCreate:false.
    const html = renderAddSection({ isKunde: false, canCreate: true, ...ctx });
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('fuehrt zum Drawer statt ein eigenes TKP-Feld neben der Suche zu zeigen', () => {
    const doc = kopf({ liste: { tkp: 40 } });

    expect(doc.querySelector('#btn-sourcing-tabelle-anpassen').textContent.trim())
      .toBe('Tabelle anpassen');
    expect(doc.querySelector('#sourcing-tkp-input')).toBeNull();
    expect(doc.querySelector('.add-item-actions-right > #sourcing-listen-tkp')).toBeNull();
  });

  it('zeigt den TKP oben im Plus-Menü, 40 wenn gesetzt und 25 sonst', () => {
    const mit = kopf({ liste: { tkp: 40 } });
    const feld = mit.querySelector('#sourcing-listen-tkp');

    expect(feld.closest('.toolbar-menu-dropdown')).not.toBeNull();
    expect(feld.closest('.toolbar-menu-dropdown').firstElementChild).toBe(feld.closest('.toolbar-tkp-zeile'));
    expect(feld.classList.contains('form-input')).toBe(false);
    expect(feld.closest('.toolbar-tkp-zeile').querySelector('svg')).not.toBeNull();
    expect(feld.value).toBe('40');
    expect(feld.parentElement.textContent).toContain('€');

    expect(kopf({ liste: {} }).querySelector('#sourcing-listen-tkp').value).toBe('25');
    expect(kopf({ liste: { tkp: null } }).querySelector('#sourcing-listen-tkp').value).toBe('25');
    expect(kopf({ isKunde: true, canCreate: false }).querySelector('#sourcing-listen-tkp')).toBeNull();
  });

  it('zeigt das Logo des Unternehmens im linken Block', () => {
    const doc = kopf({
      liste: { unternehmen: { firmenname: 'Meta Glasses', logo_url: 'https://cdn.test/logo.png' } }
    });
    const logo = doc.querySelector('.toolbar-entity-logo');

    expect(logo.getAttribute('src')).toBe('https://cdn.test/logo.png');
    expect(logo.getAttribute('alt')).toBe('Meta Glasses');
    expect(logo.getAttribute('title')).toBe('Meta Glasses');
    expect(logo.closest('.add-item-actions-left')).not.toBeNull();
  });

  it('laesst den Logo-Platz weg, wenn kein Logo hinterlegt ist', () => {
    expect(kopf({ liste: { unternehmen: { firmenname: 'Ohne Logo' } } })
      .querySelector('.toolbar-entity-logo')).toBeNull();
    expect(kopf({ liste: {} }).querySelector('.toolbar-entity-logo')).toBeNull();
    expect(kopf().querySelector('.toolbar-entity-logo')).toBeNull();
  });

  it('zeigt den Listennamen auch ohne Logo neben dem Logo-Platz', () => {
    const doc = kopf({ liste: { name: 'Sommer <Kampagne>' } });
    const name = doc.querySelector('.toolbar-listen-name');

    expect(name.textContent).toBe('Sommer <Kampagne>');
    expect(name.closest('.toolbar-listen-kopf')).not.toBeNull();
    expect(name.closest('.add-item-actions-left')).not.toBeNull();
  });

  it('stellt die Suche vor Creator hinzufügen und Plus-Menü; Kunden sehen nur die Suche', () => {
    const doc = kopf();
    const rechts = doc.querySelector('.add-item-actions-right');
    const kinder = Array.from(rechts.children);

    expect(kinder[0].querySelector('#sourcing-item-search-input')).not.toBeNull();
    expect(kinder[1].id).toBe('btn-open-add-drawer');
    expect(kinder[2].id).toBe('btn-management-anfrage');
    expect(kinder[3].id).toBe('casting-vorschlag-block');
    expect(kinder[3].closest('.add-item-actions-right')).not.toBeNull();
    expect(kinder[4].classList.contains('toolbar-menu')).toBe(true);

    const kundenDoc = kopf({ isKunde: true, canCreate: false });
    expect(kundenDoc.querySelector('#sourcing-item-search-input')).not.toBeNull();
    expect(kundenDoc.querySelector('#btn-management-anfrage')).toBeNull();
    expect(kundenDoc.querySelector('.toolbar-menu')).toBeNull();
    expect(kundenDoc.querySelector('.sourcing-status-filter-submenu')).toBeNull();
  });

  it('legt die Toolbar-Actions ins Plus-Dropdown, den Statusfilter nicht mehr', () => {
    const doc = kopf({ kundenCallActive: true });
    const dropdown = doc.querySelector('.toolbar-menu-dropdown');

    expect(doc.getElementById('btn-sourcing-toolbar-menu')).not.toBeNull();
    expect(dropdown.querySelector('.sourcing-status-filter-submenu')).toBeNull();
    expect(dropdown.querySelector('#btn-share-sourcing')).not.toBeNull();
    expect(dropdown.querySelector('#btn-kunden-call-toggle').classList.contains('active')).toBe(true);
    expect(dropdown.querySelector('#btn-sourcing-tabelle-anpassen')).not.toBeNull();
    expect(dropdown.querySelector('#btn-sourcing-custom-columns')).toBeNull();
    expect(dropdown.querySelector('#btn-manage-kategorien')).toBeNull();
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

describe('Sourcing – TikTok-Preise (manuell)', () => {
  it('nimmt TikTok Video- und Story-Preis als Freitext auf', () => {
    const video = renderCell('cp-col-preis-tt-video', { preis_tiktok_video: '800' });
    const story = renderCell('cp-col-preis-tt-story', { preis_tiktok_story: 'ca. 300' });

    expect(video.querySelector('input[data-field="preis_tiktok_video"]').value).toBe('800');
    expect(story.querySelector('input[data-field="preis_tiktok_story"]').value).toBe('ca. 300');
  });

  it('steht als gemeinsame Spalte Preis Story direkt vor dem Gesamtpreis', () => {
    const kopf = Array.from(tabelle().querySelectorAll('thead th'))
      .map(th => Array.from(th.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);

    expect(kopf[kopf.indexOf('cp-col-story-preis') + 1]).toBe('cp-col-pricing');
    expect(kopf).not.toContain('cp-col-preis-tt-video');
    expect(kopf).not.toContain('cp-col-preis-tt-story');
  });

  it('zeigt Kunden die Werte nur lesend', () => {
    const video = renderCell('cp-col-preis-tt-video', { preis_tiktok_video: '800' }, { isKunde: true });
    const story = renderCell('cp-col-preis-tt-story', {}, { isKunde: true });

    expect(video.querySelector('input')).toBeNull();
    expect(video.querySelector('.cell-text-readonly').textContent.trim()).toBe('800 €');
    expect(story.querySelector('.cell-text-readonly').textContent.trim()).toBe('-');
  });

  it('blendet nur die TikTok-Zeile aus, wenn ihr Schluessel versteckt ist', () => {
    const doc = renderZeile({ hiddenColumns: ['cp-col-preis-tt-video'] });
    const td = doc.querySelector('td.cp-col-preis-video');

    expect(td.getAttribute('style') || '').not.toContain('display:none');
    expect(td.querySelector('[data-plattform="instagram"] input[data-field="preis_reels"]')).not.toBeNull();
    expect(td.querySelector('input[data-field="preis_tiktok_video"]')).toBeNull();
  });

  it('blendet die Spalte aus, wenn beide Plattformzeilen versteckt sind', () => {
    const doc = renderZeile({ hiddenColumns: ['cp-col-preis-reels', 'cp-col-preis-tt-video'] });

    expect(doc.querySelector('td.cp-col-preis-video').getAttribute('style')).toContain('display:none');
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
    ['cp-col-preis-tt-video', 'preis_tiktok_video'],
    ['cp-col-preis-tt-story', 'preis_tiktok_story'],
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
  it('steht als Freitext hinter dem Kontakt-Block, der auf den Gesamtpreis folgt', () => {
    const kopf = Array.from(tabelle().querySelectorAll('thead th'))
      .map(th => Array.from(th.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);

    expect(kopf[kopf.indexOf('cp-col-telefon') + 1]).toBe('cp-col-nutzungsrechte');
    expect(kopf.indexOf('cp-col-pricing')).toBeLessThan(kopf.indexOf('cp-col-nutzungsrechte'));
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
