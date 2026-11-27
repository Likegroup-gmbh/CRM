import { describe, it, expect } from 'vitest';
import { renderCell } from './sourcingZelleKit.js';
import { renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';

function kopf(ctx = {}) {
  const html = renderItemsTable({
    isKunde: false, hiddenColumns: [], items: [{ id: 'i1' }], hasAnyItems: true, ...ctx
  });
  return new DOMParser().parseFromString(html, 'text/html');
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('Sourcing – Views und Preis in getrennten Spalten', () => {
  it('stellt je Fenster erst die Views, dann den Preis, danach den Preis pro Video', () => {
    const spalten = Array.from(kopf().querySelectorAll('thead th'))
      .map(th => Array.from(th.classList).find(c => c.startsWith('cp-col-')))
      .filter(Boolean);
    const start = spalten.indexOf('cp-col-views-12');

    expect(spalten.slice(start, start + 5)).toEqual([
      'cp-col-views-12', 'cp-col-cpm-12', 'cp-col-views-30', 'cp-col-cpm-30', 'cp-col-preis-video'
    ]);
    expect(spalten).not.toContain('cp-col-cpm-8');
  });

  it('beschriftet die Koepfe und erklaert Fenster und TKP im Tooltip', () => {
    const doc = kopf({ liste: { tkp: 40 } });
    const th = (klasse) => doc.querySelector(`thead th.${klasse}`);

    expect(text(th('cp-col-views-12'))).toBe('Ø Views 12 Videos');
    expect(text(th('cp-col-cpm-12'))).toBe('Preis 12 Videos');
    expect(text(th('cp-col-views-30'))).toBe('Ø Views 30 Videos');
    expect(text(th('cp-col-cpm-30'))).toBe('Preis 30 Videos');
    expect(th('cp-col-views-12').title).toContain('Durchschnitt der letzten 12 Videos');
    expect(th('cp-col-cpm-30').title).toContain('Geschätzter Preis bei 40 € TKP');
    expect(th('cp-col-cpm-30').title).toContain('Durchschnitt der letzten 30 Videos');
  });
});

describe('Sourcing – Views-Zelle', () => {
  it('zeigt den Schnitt kurz und die exakte Zahl im Tooltip', () => {
    const cell = renderCell('cp-col-views-ig-12', { ig_views_12: 6029 });

    expect(text(cell.querySelector('.cpm-auto-views'))).toBe('6,0K');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('6.029 Views im Schnitt');
    expect(cell.querySelector('.cpm-auto-price')).toBeNull();
  });

  it('formatiert unter 1.000, ab 1.000 und ab 1 Mio.', () => {
    const views = (n) => text(renderCell('cp-col-views-ig-30', { ig_views_30: n }).querySelector('.cpm-auto-views'));

    expect(views(850)).toBe('850');
    expect(views(12200)).toBe('12,2K');
    expect(views(1450000)).toBe('1,5M');
  });

  it('zeigt ohne Abruf einen Strich', () => {
    const cell = renderCell('cp-col-views-ig-12', {});

    expect(text(cell.querySelector('.cpm-auto-views'))).toBe('-');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('Noch nicht abgerufen');
  });

  it('blurrt die Views im Kunden-Call nicht', () => {
    const cell = renderCell('cp-col-views-ig-12', { ig_views_12: 6029 }, { kundenCallActive: true });

    expect(cell.querySelector('.kunden-call-blur')).toBeNull();
  });
});

describe('Sourcing – Preis-Zelle', () => {
  it('zeigt nur den Preis, die Views stehen in ihrer eigenen Spalte', () => {
    const cell = renderCell('cp-col-cpm-ig-12', { ig_views_12: 6029 });

    expect(text(cell.querySelector('.cpm-auto-price'))).toBe('150,73 €');
    expect(cell.querySelector('.cpm-auto-views')).toBeNull();
    expect(cell.querySelector('.cpm-auto-reach')).toBeNull();
  });

  it('zeigt ohne View-Basis nur einen Strich', () => {
    const cell = renderCell('cp-col-cpm-ig-12', {});

    expect(text(cell.querySelector('.cpm-auto-price'))).toBe('-');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('Noch nicht abgerufen');
  });

  it('nennt die Rechnung im Tooltip, die Ausreißer stehen bei den Views', () => {
    const cell = renderCell('cp-col-cpm-ig-30', {
      ig_views_30: 3980,
      ig_stats: { outliers_30: [{ views: 1000000, side: 'high' }] }
    });

    expect(cell.querySelector('.cpm-auto-value').title).toBe('3.980 Views im Schnitt × 25 € TKP');
  });

  it('blurrt im Kunden-Call den Preis', () => {
    const cell = renderCell('cp-col-cpm-ig-12', { ig_views_12: 6029 }, { kundenCallActive: true });

    expect(cell.querySelector('.cpm-auto-value').classList.contains('kunden-call-blur')).toBe(true);
  });
});

describe('Sourcing – Ausreißer-Hinweis im Views-Tooltip', () => {
  const views = (item) => renderCell('cp-col-views-ig-12', item).querySelector('.cpm-auto-value').title;

  it('nennt Anzahl, Richtung und Reichweite der entfernten Ausreißer', () => {
    expect(views({
      ig_views_12: 50000,
      ig_stats: { outliers_12: [{ views: 1000000, side: 'high' }, { views: 10, side: 'low' }] }
    })).toBe(
      '50.000 Views im Schnitt\n2 Ausreißer entfernt'
      + '\nnach oben: 1.000.000 Views\nnach unten: 10 Views'
    );
  });

  it('sagt es auch, wenn nichts entfernt wurde', () => {
    const title = renderCell('cp-col-views-ig-30', { ig_views_30: 50000, ig_stats: { outliers_30: [] } })
      .querySelector('.cpm-auto-value').title;

    expect(title).toContain('Keine Ausreißer erkannt');
  });

  it('weist die ausgeschlossenen Werbe-Reels aus, im Singular bei genau einem', () => {
    expect(views({ ig_views_12: 50000, ig_stats: { outliers_12: [], skipped_ads: 3 } }))
      .toContain('3 Reels mit Werbe-Kennzeichnung ausgeschlossen');
    expect(views({ ig_views_12: 50000, ig_stats: { outliers_12: [], skipped_ads: 1 } }))
      .toContain('1 Reel mit Werbe-Kennzeichnung ausgeschlossen');
  });

  it('laesst den Hinweis weg, solange keine Statistik vorliegt', () => {
    expect(views({ ig_views_12: 50000 })).toBe('50.000 Views im Schnitt');
  });

  it('haengt den Hinweis nicht an eine leere Zelle', () => {
    expect(views({ ig_stats: { outliers_12: [] } })).toBe('Noch nicht abgerufen');
  });

  it('liest nur das eigene Fenster, keine Reste aus dem 8er-Fenster', () => {
    expect(views({ ig_views_12: 50000, ig_stats: { outliers_8: [{ views: 1, side: 'low' }] } }))
      .toBe('50.000 Views im Schnitt');
  });
});

describe('Sourcing – Zweitwert ohne Trials', () => {
  const itemMitGate = {
    ig_views_12: 189375,
    ig_stats: {
      outliers_12: [],
      skipped_trial_views: 5,
      ohne_trials: { views_12: 501875, cpm_12: 12546.88 },
      trial_gate: { aktiv: true, schwelle: 25125, gap_ratio: 150, cluster_size: 5 }
    }
  };
  const zweit = (spalte, item, ctx) => renderCell(spalte, item, ctx).querySelector('.cpm-auto-reach--clean');

  it('zeigt bei den Views eine kurze zweite Zeile mit o. T.', () => {
    const cell = renderCell('cp-col-views-ig-12', itemMitGate);
    const clean = cell.querySelector('.cpm-auto-reach--clean');

    // Hauptwert bleibt die Rechnung mit Trials
    expect(text(cell.querySelector('.cpm-auto-views'))).toBe('189,4K');
    expect(text(clean)).toBe('o. T. 501,9K');
    expect(clean.querySelector('.cpm-auto-tag').textContent).toBe('o. T.');
    expect(clean.title).toBe('ohne Trial-Reels: 501.875 Views im Schnitt');
  });

  it('zeigt beim Preis den Zweitwert mit dem TKP der Liste', () => {
    const cell = renderCell('cp-col-cpm-ig-12', itemMitGate);

    expect(text(cell.querySelector('.cpm-auto-price'))).toBe('4.734,38 €');
    expect(text(cell.querySelector('.cpm-auto-reach--clean'))).toBe('o. T. 12.546,88 €');
    // 501875 / 1000 * 40 = 20075
    expect(text(zweit('cp-col-cpm-ig-12', itemMitGate, { liste: { tkp: 40 } }))).toBe('o. T. 20.075,00 €');
  });

  it('blurrt die Zeile ohne Trials im Kunden-Call mit dem Preis', () => {
    const wrapper = renderCell('cp-col-cpm-ig-12', itemMitGate, { kundenCallActive: true })
      .querySelector('.cpm-auto-value');

    expect(wrapper.classList.contains('kunden-call-blur')).toBe(true);
    expect(wrapper.querySelector('.cpm-auto-reach--clean')).not.toBeNull();
  });

  it('zeigt ohne Gate und bei gleichem Wert keine zweite Zeile', () => {
    const ohneGate = { ig_views_12: 50000, ig_stats: { outliers_12: [] } };
    const gleich = { ig_views_12: 50000, ig_stats: { outliers_12: [], ohne_trials: { views_12: 50000 } } };

    for (const spalte of ['cp-col-views-ig-12', 'cp-col-cpm-ig-12']) {
      expect(zweit(spalte, ohneGate), spalte).toBeNull();
      expect(zweit(spalte, gleich), spalte).toBeNull();
    }
  });

  it('nennt erkannte Trials und den bereinigten Schnitt im Views-Tooltip', () => {
    const title = renderCell('cp-col-views-ig-12', itemMitGate).querySelector('.cpm-auto-value').title;

    expect(title).toContain('5 Trial-Reels per View-Lücke erkannt (im Hauptwert enthalten)');
    expect(title).toContain('Ohne Trials: Ø 501.875 Views (Schwelle 25.125, Lücke 150x)');
  });
});
