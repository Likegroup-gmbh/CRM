import { describe, it, expect } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { kompakt } from '../modules/auswertung/auswertungFormat.js';
import { KACHEL_WERTE, posterRefs, reportPdfVm, zeitraumText } from '../modules/report-pdf/reportPdfModell.js';
import { beispielVm } from '../modules/report-pdf/reportPdfQuelle.js';

const PROD = { id: 'p1', name: 'Produktion 1', linien: [] };

function einheit(id, { art = 'video', dateien } = {}) {
  return {
    id,
    art,
    label: 'Video 1',
    creator: { id: `c-${id}`, name: `Creator ${id}`, handle: `handle_${id}` },
    produktion: { id: PROD.id, name: PROD.name },
    linie: null,
    erwartet: true,
    dateien: dateien || [{ id: `d-${id}`, ratio: '9:16', item: { id: `d-${id}`, type: art } }]
  };
}

function post(id, einheitId, { plattform = 'ig_reel', status = 'confirmed', metrics = {}, dateiId, postedAt = '2026-11-03' } = {}) {
  return { id, einheitId, dateiId: dateiId ?? `d-${einheitId}`, plattform, status, postedAt, accountHandle: null, metrics };
}

function vmAus(einheiten, posts, kontext = {}) {
  const basis = { einheiten, posts, verbrauch: [{ produktionId: PROD.id, betrag: 4800 }], produktionen: [PROD], zielFuer: () => null };
  const modell = baueModell(basis, { ebene: 'produktion', produktionId: PROD.id });
  return { modell, vm: reportPdfVm(modell, kontext) };
}

describe('Report-PDF: View-Model', () => {
  it('nimmt nur bestätigte Posts', () => {
    const { vm } = vmAus([einheit('a'), einheit('b')], [
      post('p-a', 'a', { metrics: { views: 100 } }),
      post('p-b', 'b', { status: 'pending', metrics: { views: 900 } })
    ]);
    expect(vm.kacheln.map(k => k.id)).toEqual(['p-a']);
    expect(vm.intro).toMatch(/^1 Post von 1 Creator/);
  });

  it('sortiert nach Aufrufen absteigend, Posts ohne Aufrufe ans Ende', () => {
    const { vm } = vmAus([einheit('a'), einheit('b'), einheit('c')], [
      post('p-a', 'a', { metrics: { views: 100 } }),
      post('p-b', 'b', { metrics: {} }),
      post('p-c', 'c', { metrics: { views: 5000 } })
    ]);
    expect(vm.kacheln.map(k => k.id)).toEqual(['p-c', 'p-a', 'p-b']);
  });

  it('zeigt je Plattform genau 4 Werte, Feed mit Interaktionen statt Engagement', () => {
    for (const plattform of ['ig_reel', 'ig_post', 'tiktok', 'ig_story']) {
      expect(KACHEL_WERTE[plattform]).toHaveLength(4);
    }
    const { vm } = vmAus([einheit('a')], [
      post('p-a', 'a', { plattform: 'tiktok', metrics: { views: 12000, likes: 800, comments: 40, shares: 10, saves: 5 } })
    ]);
    expect(vm.kacheln[0].plattform).toBe('TikTok');
    expect(vm.kacheln[0].werte.map(w => w.label)).toEqual(['Aufrufe', 'Likes', 'Kommentare', 'Interaktionen']);
    expect(vm.kacheln[0].werte[0].wert).toBe(kompakt(12000));
    expect(vm.kacheln[0].werte[3].wert).toBe(kompakt(855));
    expect(JSON.stringify(vm)).not.toMatch(/engagement/i);
  });

  it('Deckblatt: immer alle 8 Kennzahlen, ohne Grundlage mit „–“ und Leertext', () => {
    const { vm } = vmAus([einheit('a')], [
      post('p-a', 'a', { plattform: 'tiktok', metrics: { views: 12000, likes: 800, comments: 40 } })
    ]);
    expect(vm.kennzahlen.map(k => k.label)).toEqual([
      'Aufrufe', 'Likes', 'Kommentare', 'Betrachter', 'Interaktionen', 'Ø Wiedergabe', 'Link-Klicks', 'Sticker-Taps'
    ]);
    const sticker = vm.kennzahlen.find(k => k.label === 'Sticker-Taps');
    expect(sticker).toEqual({ label: 'Sticker-Taps', wert: '–', sub: 'nur Instagram-Stories' });
    expect(vm.kennzahlen.find(k => k.label === 'Likes').wert).toBe(kompakt(800));
  });

  it('Story zeigt Aufrufe, Betrachter, Link-Klicks und Sticker-Taps', () => {
    const { vm } = vmAus([einheit('s', { art: 'story' })], [
      post('p-s', 's', { plattform: 'ig_story', metrics: { views: 3000, reach: 2100, linkClicks: 44, stickerTaps: 12 } })
    ]);
    expect(vm.kacheln[0].werte).toEqual([
      { label: 'Aufrufe', wert: kompakt(3000) },
      { label: 'Betrachter', wert: kompakt(2100) },
      { label: 'Link-Klicks', wert: kompakt(44) },
      { label: 'Sticker-Taps', wert: kompakt(12) }
    ]);
  });

  it('nimmt das Poster der geposteten Datei, nicht der ersten', () => {
    const dateien = [
      { id: 'd-916', ratio: '9:16', item: { id: 'asset-916', type: 'video' } },
      { id: 'd-45', ratio: '4:5', item: { id: 'link-45', type: 'video', asset: { id: 'asset-45' } } }
    ];
    const einheiten = [einheit('a', { dateien })];
    const posts = [post('p-a', 'a', { dateiId: 'd-45', metrics: { views: 1 } })];
    const { modell } = vmAus(einheiten, posts);
    expect([...posterRefs(modell)]).toEqual([['d-45', { typ: 'video', id: 'asset-45' }]]);

    const posterUrls = new Map([['d-916', 'https://x.test/916.jpg'], ['d-45', 'https://x.test/45.jpg']]);
    const { vm } = vmAus(einheiten, posts, { posterUrls });
    expect(vm.kacheln[0].posterUrl).toBe('https://x.test/45.jpg');
  });

  it('ohne Poster-Link bleibt posterUrl leer', () => {
    const { vm } = vmAus([einheit('a')], [post('p-a', 'a', { metrics: { views: 1 } })]);
    expect(vm.kacheln[0].posterUrl).toBeNull();
  });

  it('enthält nie Kosten, auch wenn die Produktion Verbrauch hat', () => {
    const { modell, vm } = vmAus([einheit('a')], [post('p-a', 'a', { metrics: { views: 20000, reach: 9000, likes: 300 } })]);
    expect(modell.kennzahlen.verbrauch).toBe(4800);
    const text = JSON.stringify(vm);
    expect(text).not.toMatch(/kosten|verbrauch|budget|€|cpm|cpv/i);
    expect(vm.kennzahlen.map(k => k.label)).toContain('Aufrufe');
  });

  it('ohne Posts: leeres Deckblatt mit Hinweis', () => {
    const { vm } = vmAus([einheit('a')], []);
    expect(vm.kacheln).toEqual([]);
    expect(vm.kennzahlen).toEqual([]);
    expect(vm.intro).toBe('Noch keine bestätigten Posts.');
  });

  it('Beispieldaten liefern so viele Kacheln wie verlangt', () => {
    expect(beispielVm(8).kacheln).toHaveLength(8);
    expect(beispielVm(0).kacheln).toHaveLength(0);
  });
});

describe('Report-PDF: Zeitraum', () => {
  const p = (postedAt) => ({ postedAt });

  it('ein Monat, gleiches Jahr, Jahreswechsel', () => {
    expect(zeitraumText([p('2026-11-03'), p('2026-11-20')])).toBe('Nov 2026');
    expect(zeitraumText([p('2026-11-03'), p('2026-10-20')])).toBe('Okt – Nov 2026');
    expect(zeitraumText([p('2026-01-03'), p('2025-12-20')])).toBe('Dez 2025 – Jan 2026');
  });

  it('ohne Datum leer', () => {
    expect(zeitraumText([p(null), {}])).toBe('');
    expect(zeitraumText([])).toBe('');
  });
});
