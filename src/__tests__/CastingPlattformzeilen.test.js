import { describe, it, expect } from 'vitest';
import { renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import {
  ANKER_ALIASE,
  DEAKTIVIERTE_SPALTEN,
  PLATTFORM_ZEILEN,
  SOURCING_ANKER_SPALTEN,
  SOURCING_SPALTEN_LABELS,
  TIKTOK_SPALTEN
} from '../modules/creator-auswahl/sourcingSpaltenKatalog.js';
import {
  isColumnVisibleForCustomer,
  listeZeigtTiktok,
  sichtbarePlattformZeilen
} from '../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js';
import {
  baueBeweglicheSpalten,
  baueSourcingSpaltenfolge
} from '../modules/creator-auswahl/sourcingSpaltenfolge.js';
import { berechneHiddenColumns } from '../modules/creator-auswahl/sourcingSpaltenPreset.js';
import { EntityCustomColumnsManager } from '../core/customColumns/EntityCustomColumnsManager.js';

const GEMEINSAM = ['cp-col-link', 'cp-col-follower', 'cp-col-preis-video', 'cp-col-story-preis'];
const NUR_INSTAGRAM = ['cp-col-engagement-ig', 'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-reichweite-story'];

const ITEM = {
  id: 'i1',
  link_instagram: 'https://www.instagram.com/paulinemary/',
  link_tiktok: 'https://www.tiktok.com/@pauline',
  follower_instagram: 5547,
  follower_tiktok: 21569,
  preis_reels: '900',
  preis_tiktok_video: '800',
  preis_story: '250',
  preis_tiktok_story: '300',
  ig_views_8: 6029
};

function zeile(ctx = {}, item = ITEM) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, item, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

function plattformen(doc, spalte) {
  return Array.from(doc.querySelectorAll(`td.${spalte} .plattform-zeile`)).map(el => el.dataset.plattform);
}

function schluessel(el) {
  return el.dataset.customColId || Array.from(el.classList).find(c => c.startsWith('cp-col-'));
}

describe('Casting – Plattformzeilen: Zeilen je Zelle', () => {
  it('stapelt Instagram oben und TikTok darunter', () => {
    const doc = zeile();

    for (const spalte of GEMEINSAM) {
      expect(plattformen(doc, spalte), spalte).toEqual(['instagram', 'tiktok']);
    }
  });

  it('legt die Werte beider Plattformen in dieselbe Zelle', () => {
    const doc = zeile();
    const preis = doc.querySelector('td.cp-col-preis-video');

    expect(preis.querySelector('[data-plattform="instagram"] input').value).toBe('900');
    expect(preis.querySelector('[data-plattform="tiktok"] input').value).toBe('800');
  });

  it('zeigt in Listen ohne TikTok nur die Instagram-Zeile', () => {
    const doc = zeile({ hiddenColumns: berechneHiddenColumns({ liste_typ: 'influencer', plattformen: 'instagram' }) });

    for (const spalte of [...GEMEINSAM, ...NUR_INSTAGRAM]) {
      expect(plattformen(doc, spalte), spalte).toEqual(['instagram']);
    }
    expect(doc.querySelector('.plattform-zeile--leer')).toBeNull();
  });

  it('gibt reinen Instagram-Spalten in Listen mit TikTok eine leere TikTok-Zeile', () => {
    const doc = zeile();

    for (const spalte of NUR_INSTAGRAM) {
      expect(plattformen(doc, spalte), spalte).toEqual(['instagram', 'tiktok']);
      const tt = doc.querySelector(`td.${spalte} [data-plattform="tiktok"]`);
      expect(tt.classList.contains('plattform-zeile--leer'), spalte).toBe(true);
      expect(tt.textContent.trim()).toBe('');
    }
  });

  it('zeigt bei fehlendem TikTok-Wert einen Strich im Follower', () => {
    const doc = zeile({}, { id: 'i1', follower_instagram: 1000 });
    const tt = doc.querySelector('td.cp-col-follower [data-plattform="tiktok"]');

    expect(tt.querySelector('.cell-number__display').textContent.trim()).toBe('–');
  });

  it('zeigt bei reiner TikTok-Liste nur die TikTok-Zeile', () => {
    const hidden = berechneHiddenColumns({ liste_typ: 'influencer', plattformen: 'tiktok' });
    const doc = zeile({ hiddenColumns: hidden });

    for (const spalte of ['cp-col-link', 'cp-col-follower', 'cp-col-preis-video']) {
      expect(plattformen(doc, spalte), spalte).toEqual(['tiktok']);
    }
  });

  it('laesst die Story-Zeilen der Instagram-Reels-Liste mit TikTok stehen', () => {
    const hidden = berechneHiddenColumns({
      liste_typ: 'influencer', plattformen: ['instagram', 'tiktok'], ig_formate: 'reel'
    });
    const doc = zeile({ hiddenColumns: hidden });

    expect(plattformen(doc, 'cp-col-story-preis')).toEqual(['tiktok']);
    expect(doc.querySelector('td.cp-col-reichweite-story').getAttribute('style')).toContain('display:none');
  });

  it('versteckt die Kunden-Zelle nicht, zeigt aber nur lesende Werte', () => {
    const doc = zeile({ isKunde: true });

    expect(plattformen(doc, 'cp-col-preis-video')).toEqual(['instagram', 'tiktok']);
    expect(doc.querySelector('td.cp-col-preis-video input')).toBeNull();
  });
});

describe('Casting – Plattformzeilen: Icons', () => {
  it('setzt vor jeden Wert ein Plattform-Icon', () => {
    const doc = zeile();

    for (const spalte of ['cp-col-follower', 'cp-col-preis-video', 'cp-col-story-preis', 'cp-col-engagement-ig']) {
      const icons = doc.querySelectorAll(`td.${spalte} .plattform-zeile:not(.plattform-zeile--leer) .plattform-zeile__icon`);
      expect(icons.length, spalte).toBeGreaterThan(0);
      for (const icon of icons) expect(icon.querySelector('svg'), spalte).not.toBeNull();
    }
    const follower = doc.querySelectorAll('td.cp-col-follower .plattform-zeile__icon');
    expect(Array.from(follower).map(el => el.title)).toEqual(['Instagram', 'TikTok']);
  });

  it('laesst den Link ohne extra Icon: das Link-Icon ist selbst die Plattform', () => {
    const doc = zeile();

    expect(doc.querySelector('td.cp-col-link .plattform-zeile__icon')).toBeNull();
    const tt = doc.querySelector('td.cp-col-link [data-plattform="tiktok"] a.link-icon-btn');
    expect(tt).not.toBeNull();
    expect(tt.querySelector('svg')).not.toBeNull();
  });

  it('zeigt im Tabellenkopf keine Icons', () => {
    const html = renderItemsTable({ isKunde: false, hiddenColumns: [], items: [ITEM], hasAnyItems: true });
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const spalte of [...GEMEINSAM, ...NUR_INSTAGRAM]) {
      expect(doc.querySelector(`thead th.${spalte}`), spalte).not.toBeNull();
      expect(doc.querySelector(`thead th.${spalte} svg`), spalte).toBeNull();
    }
  });
});

describe('Casting – Plattformzeilen: Sichtbarkeit der Spalte', () => {
  it('blendet eine gemeinsame Spalte nur aus, wenn alle Plattformzeilen weg sind', () => {
    for (const [spalte, zeilen] of Object.entries(PLATTFORM_ZEILEN)) {
      const keys = zeilen.map(z => z.key);

      expect(isColumnVisibleForCustomer(spalte, false, []), spalte).toBe(true);
      expect(isColumnVisibleForCustomer(spalte, false, [keys[0]]), spalte).toBe(true);
      expect(isColumnVisibleForCustomer(spalte, false, [keys[1]]), spalte).toBe(true);
      expect(isColumnVisibleForCustomer(spalte, false, keys), spalte).toBe(false);
    }
  });

  it('blendet die Spalte mit dem eigenen Schluessel aus, auch wenn Zeilen sichtbar sind', () => {
    expect(isColumnVisibleForCustomer('cp-col-follower', false, ['cp-col-follower'])).toBe(false);
  });

  it('rendert die Zelle mit display:none, wenn beide Zeilen versteckt sind', () => {
    const doc = zeile({ hiddenColumns: ['cp-col-follower-ig', 'cp-col-follower-tt'] });

    expect(doc.querySelector('td.cp-col-follower').getAttribute('style')).toContain('display:none');
  });

  it('nennt die sichtbaren Zeilen in der Reihenfolge Instagram, TikTok', () => {
    expect(sichtbarePlattformZeilen('cp-col-link', []).map(z => z.plattform)).toEqual(['instagram', 'tiktok']);
    expect(sichtbarePlattformZeilen('cp-col-link', ['cp-col-link-ig']).map(z => z.plattform)).toEqual(['tiktok']);
  });

  it('erkennt TikTok an den TikTok-Schluesseln', () => {
    expect(listeZeigtTiktok([])).toBe(true);
    expect(listeZeigtTiktok(TIKTOK_SPALTEN)).toBe(false);
    expect(listeZeigtTiktok(TIKTOK_SPALTEN.slice(1))).toBe(true);
  });

  it('haelt Mail und Telefon fuer Kunden weiter zurueck', () => {
    expect(isColumnVisibleForCustomer('cp-col-mail', true, [])).toBe(false);
    expect(isColumnVisibleForCustomer('cp-col-telefon', true, [])).toBe(false);
    expect(isColumnVisibleForCustomer('cp-col-mail', false, [])).toBe(true);
  });
});

describe('Casting – Plattformzeilen: gespeicherte Reihenfolge', () => {
  it('uebernimmt alte Schluessel an der Stelle der ersten Plattformspalte', () => {
    const alt = [
      'cp-col-notiz', 'cp-col-follower-ig', 'cp-col-link-ig', 'cp-col-cpm-ig-8',
      'cp-col-preis-reels', 'cp-col-follower-tt', 'cp-col-link-tt'
    ];
    const neu = baueBeweglicheSpalten({ columnOrder: alt });
    const gespeichert = ['cp-col-notiz', 'cp-col-follower', 'cp-col-link', 'cp-col-cpm-ig-8', 'cp-col-preis-video'];

    // Die gespeicherte Nachbarschaft bleibt, neue Spalten drängen sich dazwischen
    expect(neu.filter(id => gespeichert.includes(id))).toEqual(gespeichert);
    expect(new Set(neu).size).toBe(neu.length);
    for (const key of Object.keys(ANKER_ALIASE)) expect(neu).not.toContain(key);
  });

  it('nimmt neue Spalten bei gespeicherter Reihenfolge hinter ihren Vorgaenger auf', () => {
    const folge = baueSourcingSpaltenfolge({ columnOrder: ['cp-col-notiz', 'cp-col-location'] });

    for (const spalte of [...GEMEINSAM, ...NUR_INSTAGRAM]) expect(folge, spalte).toContain(spalte);
  });
});

describe('Casting – Plattformzeilen: Anker eigener Spalten', () => {
  function manager(order) {
    const mgr = new EntityCustomColumnsManager({
      parentType: 'sourcing',
      parentTable: 'creator_auswahl',
      anchorColumns: SOURCING_ANKER_SPALTEN,
      anchorLabels: SOURCING_SPALTEN_LABELS,
      disabledAnchors: DEAKTIVIERTE_SPALTEN,
      anchorAliases: ANKER_ALIASE
    });
    mgr.columns = [{ id: 'a', name: 'Briefing', field_type: 'text', visible_for_kunden: true, position: 0 }];
    mgr.order = order;
    return mgr;
  }

  it('haengt eine Spalte hinter dem alten TikTok-Link an den gemeinsamen Link', () => {
    const mgr = manager([{ id: 'custom:a', after: 'cp-col-link-tt' }]);

    expect(mgr.getOrderedColumns()[0]._anchor).toBe('cp-col-link');
    expect(mgr.renderHeadersAt('cp-col-link', [], false)).toContain('Briefing');
    expect(mgr.renderHeaders([], false)).not.toContain('Briefing');
  });

  it('bildet jeden alten Plattform-Schluessel auf eine gemeinsame Spalte ab', () => {
    for (const [alt, neu] of Object.entries(ANKER_ALIASE)) {
      expect(manager([{ id: 'custom:a', after: alt }]).getOrderedColumns()[0]._anchor, alt).toBe(neu);
      expect(SOURCING_ANKER_SPALTEN).toContain(neu);
    }
  });

  it('rendert Kopf und Zeile mit der verankerten Spalte an derselben Stelle', () => {
    const mgr = manager([{ id: 'custom:a', after: 'cp-col-follower-tt' }]);
    const html = renderItemsTable({
      isKunde: false, hiddenColumns: [], items: [{ id: 'i1' }], hasAnyItems: true, customManager: mgr
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const kopf = Array.from(doc.querySelectorAll('thead th')).map(schluessel).filter(Boolean);
    const zellen = Array.from(doc.querySelectorAll('tbody tr.item-row > td')).map(schluessel).filter(Boolean);

    expect(kopf[kopf.indexOf('cp-col-follower') + 1]).toBe('custom:a');
    expect(zellen).toEqual(kopf);
  });
});
