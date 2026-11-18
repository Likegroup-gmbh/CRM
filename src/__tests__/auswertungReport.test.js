import { describe, expect, it } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { renderReport } from '../modules/auswertung/auswertungReport.js';
import { offenHinweis, renderTabellenZeilen } from '../modules/auswertung/auswertungTabelle.js';

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
    expect(html).toContain('>Live-Link<');
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
    expect(offen).toContain('TikTok');
    expect(offen).toContain('1.200');
    expect(offen).toContain('Zahlen prüfen');

    const bestaetigt = renderTabellenZeilen(modellAus([einheit('a')], [{ ...entwurf, status: 'confirmed' }]), { team: true });
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
