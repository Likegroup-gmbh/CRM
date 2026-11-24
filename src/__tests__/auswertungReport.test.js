import { describe, expect, it } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { renderReport } from '../modules/auswertung/auswertungReport.js';
import { offenHinweis, renderTabellenGruppen } from '../modules/auswertung/auswertungTabelle.js';

const produktion = { id: 'p1', name: 'Produktion 1', linien: [] };
const datei = (id) => [{ id: `${id}-916`, ratio: '9:16' }];

const einheit = (id, extra = {}) => ({
  id: `video:${id}`,
  art: 'video',
  label: 'Video 1',
  titel: `Titel ${id}`,
  erwartet: true,
  produktion: { id: 'p1', name: 'Produktion 1' },
  creator: { id: 'c1', name: 'Lea Berg' },
  dateien: datei(id),
  tags: { persona: [], ansatz: [], plattform: [] },
  ...extra
});

const modellAus = (einheiten, posts = []) => baueModell(
  { einheiten, posts, verbrauch: [], produktionen: [produktion] },
  { ebene: 'produktion', produktionId: 'p1' }
);

describe('Report ohne bestätigte Posts', () => {
  const einheiten = [
    einheit('a', { gepostetAm: '2026-10-01' }),
    einheit('b', { dateien: [] }),
    einheit('c', { erwartet: false })
  ];

  it('zeigt dem Team Kacheln mit „–“ und alle möglichen Posts statt des Leerzustands', () => {
    const html = renderReport(modellAus(einheiten), { team: true, zeigeKosten: true });
    expect(html).not.toContain('Noch keine Zahlen');
    expect(html).toContain('auswertung-stats');
    expect(html).toContain('Kosten pro 1.000 Aufrufe');
    expect(html).toContain('<th>Post</th>');
    expect(html.match(/data-auswertung-erfassen-einheit=/g)).toHaveLength(3);
    expect(html).toContain('Titel a');
    expect(html).toContain('01.10.2026');
    expect(html).not.toContain('>Live-Link<');
    expect(html).toContain('>Likes<');
    expect(html).toContain('>Kommentare<');
  });

  it('ein Entwurf zeigt Link, Plattform und gelesene Zahlen in der offenen Zeile', () => {
    const entwurf = {
      id: 'p1',
      einheitId: 'video:a',
      status: 'draft',
      plattform: 'tiktok',
      postedAt: '2026-10-01',
      link: 'https://www.tiktok.com/@lea/video/1',
      metrics: { views: 1200, likes: 80, comments: 7 }
    };
    const offen = renderReport(modellAus([einheit('a')], [entwurf]), { team: true });
    expect(offen).toContain('data-auswertung-erfassen="p1"');
    expect(offen).toContain('href="https://www.tiktok.com/@lea/video/1"');
    expect(offen).toContain('auswertung-plattform-pill');
    expect(offen).toContain('TikTok');
    expect(offen).toContain('1.200');
    expect(offen).toContain('Zahlen prüfen');

    const bestaetigt = renderTabellenGruppen(modellAus([einheit('a')], [{ ...entwurf, status: 'confirmed' }]), { team: true });
    expect(bestaetigt).toContain('data-post-id="p1"');
    expect(bestaetigt).toContain('>80<');
  });

  it('nennt je Zeile, woran es hängt', () => {
    const html = renderReport(modellAus(einheiten), { team: true });
    expect(html).toContain('Zahlen fehlen');
    expect(html).toContain('Noch keine Finale Version');
    expect(html).toContain('Paid, kein Post erwartet');
    expect(html).toContain('0 ausgewertet · 2 ohne Zahlen');
  });

  it('ohne Einheiten und für Kunden bleibt der Leerzustand', () => {
    expect(renderReport(modellAus([]), { team: true })).toContain('Noch keine Posts');
    expect(renderReport(modellAus(einheiten), { team: false })).toContain('Noch keine Zahlen');
  });
});

describe('Report mit bestätigten Posts', () => {
  const bestaetigt = (id, metrics, extra = {}) => ({
    id, einheitId: 'video:a', status: 'confirmed', plattform: 'tiktok', postedAt: '2026-10-01', metrics, ...extra
  });
  const doc = (html) => new DOMParser().parseFromString(`<table>${html}</table>`, 'text/html');
  const mitSeitenrecht = (darf, fn) => {
    const vorher = window.canViewPage;
    window.canViewPage = () => darf;
    try { fn(); } finally { window.canViewPage = vorher; }
  };

  it('zeigt Kacheln und Posts, ohne Aufschlüsselung und Zusammenfassung', () => {
    const html = renderReport(modellAus([einheit('a')], [bestaetigt('p1', { views: 900 })]), { team: true });
    expect(html).toContain('auswertung-stats');
    expect(html).toContain('data-auswertung-tabelle');
    expect(html).not.toContain('Aufschlüsselung');
    expect(html).not.toContain('Zusammenfassung');
  });

  it('zeigt alle Kacheln immer, ohne Grundlage mit „–“ und Leertext, und keine Engagement-Rate', () => {
    const modell = modellAus([einheit('a')], [bestaetigt('p1', { views: 900, likes: 40, comments: 3 })]);
    const html = renderReport(modell, { team: true });
    const kacheln = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.auswertung-stat')];
    expect(kacheln.map(k => k.querySelector('.budget-tab__stat-label').textContent)).toEqual([
      'Aufrufe', 'Likes', 'Kommentare', 'Betrachter', 'Interaktionen', 'Ø Wiedergabe', 'Link-Klicks', 'Sticker-Taps'
    ]);
    const sticker = kacheln.find(k => k.textContent.includes('Sticker-Taps'));
    expect(sticker.querySelector('.auswertung-stat__leer').textContent).toBe('–');
    expect(sticker.querySelector('.budget-tab__stat-sub').textContent).toBe('nur Instagram-Stories');
    expect(sticker.querySelector('[data-count]')).toBeNull();
    const likes = kacheln.find(k => k.textContent.includes('Likes'));
    expect(likes.querySelector('[data-count="likes"]').dataset.countValue).toBe('40');
    expect(html).toContain('auswertung-stats--4');
    expect(html).not.toMatch(/engagement/i);
  });

  it('mit Preis-Sicht neun Kacheln in zwei Reihen (5 + 4)', () => {
    const html = renderReport(modellAus([einheit('a')], [bestaetigt('p1', { views: 900 })]), { team: true, zeigeKosten: true });
    expect(html.match(/class="budget-tab__stat auswertung-stat"/g)).toHaveLength(9);
    expect(html).toContain('auswertung-stats--5');
  });

  it('Spalten: Link-Klicks und Sticker-Taps, keine Engagement-Rate', () => {
    const html = renderReport(modellAus([einheit('a', { art: 'story' })], [
      bestaetigt('p1', { views: 900, linkClicks: 31, stickerTaps: 7 }, { plattform: 'ig_story' })
    ]), { team: true });
    const tabelle = new DOMParser().parseFromString(html, 'text/html').querySelector('table[data-auswertung-table]');
    const koepfe = [...tabelle.querySelectorAll('thead th')].map(th => th.textContent.trim());
    expect(koepfe).toEqual([
      '#', 'Creator', 'Post', 'Plattform', 'Gepostet', 'Aufrufe', 'Likes', 'Kommentare', 'Betrachter',
      'Interaktionen', 'Ø Wiedergabe', 'Link-Klicks', 'Sticker-Taps'
    ]);
    const zellen = [...tabelle.querySelectorAll('tr[data-post-id="p1"] > td')].map(td => td.textContent.trim());
    expect(zellen.slice(-2)).toEqual(['31', '7']);
  });

  it('zeigt Kosten pro 1.000 Aufrufe nur mit Preis-Sicht', () => {
    const modell = baueModell(
      {
        einheiten: [einheit('a')],
        posts: [bestaetigt('p1', { views: 20000 })],
        verbrauch: [{ produktionId: 'p1', briefingId: null, betrag: 4000 }],
        produktionen: [produktion]
      },
      { ebene: 'produktion', produktionId: 'p1' }
    );
    const ohne = renderReport(modell, { team: false, zeigeKosten: false });
    expect(ohne).not.toContain('Kosten pro 1.000 Aufrufe');
    expect(ohne).not.toContain('Verbrauch');
    expect(ohne).not.toContain('4.000');

    const mit = renderReport(modell, { team: true, zeigeKosten: true });
    expect(mit).toContain('Kosten pro 1.000 Aufrufe');
    expect(mit).toContain('4.000');
    expect(mit).toContain('Verbrauch');
  });

  it('Creator-Spalte: Thumb und Name als Link zum Creator, der Name steht nicht mehr unter dem Post', () => {
    const creator = { id: 'c1', name: 'Lea Berg', avatarUrl: 'https://cdn/thumb.avif' };
    mitSeitenrecht(true, () => {
      const zeile = doc(renderTabellenGruppen(modellAus([einheit('a', { creator })], [bestaetigt('p1', { views: 900 })])));
      const zelle = zeile.querySelector('td.auswertung-tabelle__creator .table-identity');
      expect(zelle.querySelector('.table-identity__media img.table-avatar-img').getAttribute('src')).toBe('https://cdn/thumb.avif');
      const link = zelle.querySelector('a.verknuepfung-pill[data-auswertung-creator]');
      expect(link.getAttribute('href')).toBe('/creator/c1');
      expect(link.textContent.trim()).toBe('Lea Berg');
      expect(zeile.querySelector('td.auswertung-tabelle__post').textContent).not.toContain('Lea Berg');
    });
  });

  it('Creator-Spalte: ohne Bild das Initial, ohne Recht auf Creator kein Link', () => {
    mitSeitenrecht(false, () => {
      const zeile = doc(renderTabellenGruppen(modellAus([einheit('a')], [bestaetigt('p1', { views: 900 })])));
      const zelle = zeile.querySelector('td.auswertung-tabelle__creator');
      expect(zelle.querySelector('span.table-avatar').textContent).toBe('L');
      expect(zelle.querySelector('a')).toBeNull();
      expect(zelle.textContent).toContain('Lea Berg');
    });
  });

  it('Plattform-Zelle: Icon, Name und Öffnen-Pfeil in einem Link, ohne Link nur Icon und Name', () => {
    const modell = (link) => modellAus([einheit('a')], [bestaetigt('p1', { views: 900 }, { plattform: 'ig_reel', link })]);
    const mitLink = doc(renderTabellenGruppen(modell('https://instagram.com/reel/X'))).querySelectorAll('tr > td')[3];
    const pill = mitLink.querySelector('a.auswertung-plattform-pill');
    expect(pill.getAttribute('href')).toBe('https://instagram.com/reel/X');
    expect(pill.getAttribute('target')).toBe('_blank');
    expect(pill.querySelectorAll('svg')).toHaveLength(2);
    expect(pill.querySelector('.mdc-btn__label').textContent).toBe('Reel');

    const ohne = doc(renderTabellenGruppen(modell(null))).querySelectorAll('tr > td')[3];
    const statisch = ohne.querySelector('span.auswertung-plattform-pill--ohne-link');
    expect(ohne.querySelector('a')).toBeNull();
    expect(statisch.classList.contains('mdc-btn--secondary')).toBe(true);
    expect(statisch.querySelectorAll('svg')).toHaveLength(1);
    expect(statisch.textContent.trim()).toBe('Reel');

    const unsicher = doc(renderTabellenGruppen(modell('javascript:alert(1)'))).querySelectorAll('tr > td')[3];
    expect(unsicher.querySelector('a')).toBeNull();
  });

  it('Ø Wiedergabe als Spalte, sortierbar', () => {
    const modell = modellAus([einheit('a'), einheit('b')], [
      bestaetigt('p1', { views: 900, avgWatchSec: 4.5 }, { einheitId: 'video:a' }),
      bestaetigt('p2', { views: 100, avgWatchSec: 9 }, { einheitId: 'video:b' })
    ]);
    expect(renderReport(modell, { team: true })).toContain('Ø Wiedergabe');
    const zeilen = renderTabellenGruppen(modell, { sort: { field: 'wiedergabe', ascending: false } });
    expect(zeilen.indexOf('data-post-id="p2"')).toBeLessThan(zeilen.indexOf('data-post-id="p1"'));
    expect(zeilen).toContain('9,0 s');
  });
});

describe('Hinweis einer offenen Zeile', () => {
  const heute = Date.parse('2026-11-18T12:00:00Z');

  it('unterscheidet Prüfen, Paid, ohne Final, geplant und gepostet', () => {
    expect(offenHinweis({ einheit: einheit('a'), post: { postedAt: '2026-11-01' }, status: 'pruefen' }, heute)).toBe('Zahlen prüfen');
    expect(offenHinweis({ einheit: einheit('a', { erwartet: false }), status: 'optional' }, heute)).toBe('Paid, kein Post erwartet');
    expect(offenHinweis({ einheit: einheit('a', { dateien: [] }), status: 'fehlt' }, heute)).toBe('Noch keine Finale Version');
    expect(offenHinweis({ einheit: einheit('a', { gepostetAm: '2026-12-01' }), status: 'fehlt' }, heute)).toBe('geplant');
    expect(offenHinweis({ einheit: einheit('a', { gepostetAm: '2026-11-10' }), status: 'fehlt' }, heute)).toBe('Zahlen fehlen');
    expect(offenHinweis({ einheit: einheit('a'), status: 'fehlt' }, heute)).toBe('Noch nicht gepostet');
  });
});
