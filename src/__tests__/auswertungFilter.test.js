import { describe, expect, it } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { filterLage, filterOptionen, leererFilter, passtZumFilter } from '../modules/auswertung/auswertungFilter.js';
import { renderTabelle, renderTabellenGruppen, tabellenSub } from '../modules/auswertung/auswertungTabelle.js';

const produktion = { id: 'p1', name: 'Produktion 1', linien: [] };

const einheit = (id, creator, ansatz = []) => ({
  id: `video:${id}`, art: 'video', label: `Video ${id}`, titel: `Hook ${id}`, erwartet: true,
  produktion: { id: 'p1', name: 'Produktion 1' }, creator,
  dateien: [{ id: `${id}-916`, ratio: '9:16' }], tags: { persona: [], ansatz, plattform: [] }
});

const post = (id, einheitId, plattform, metrics, status = 'confirmed') => ({ id, einheitId, plattform, status, metrics });

const LEA = { id: 'c1', name: 'Lea Berg' };
const ADA = { id: 'c2', name: 'Ada Kern' };

const modell = baueModell({
  einheiten: [einheit('a', LEA, ['Problem-Lösung']), einheit('b', ADA, ['Unboxing']), einheit('c', LEA), einheit('d', ADA, ['Unboxing'])],
  posts: [
    post('pa', 'video:a', 'tiktok', { views: 1000, likes: 100, avgWatchSec: 8 }),
    post('pb', 'video:b', 'ig_reel', { views: 3000, reach: 2000, likes: 100, avgWatchSec: 4 }),
    post('pc', 'video:c', 'tiktok', { views: 500 }, 'draft')
  ],
  verbrauch: [],
  produktionen: [produktion]
}, { ebene: 'produktion', produktionId: 'p1' });

const filter = (teil) => ({ ...leererFilter(), ...teil });
const zeilenIds = (html) => [...html.matchAll(/data-(?:post-id|auswertung-erfassen(?:-einheit)?)="([^"]+)"/g)].map(m => m[1]);

describe('Optionen der Filter', () => {
  it('nimmt Creator und Ansätze aus den Einheiten, „Ohne“ steht am Ende', () => {
    const o = filterOptionen(modell);
    expect(o.creator.map(x => x.label)).toEqual(['Ada Kern', 'Lea Berg']);
    expect(o.ansatz.map(x => x.label)).toEqual(['Problem-Lösung', 'Unboxing', 'Ohne Ansatz']);
  });

  it('nimmt die Plattformen aus den Posts, in der Reihenfolge der Konfiguration', () => {
    expect(filterOptionen(modell).plattform.map(x => x.value)).toEqual(['ig_reel', 'tiktok']);
  });

  it('blendet Filter mit nur einem Wert aus und ignoriert Werte, die es auf der Ebene nicht gibt', () => {
    const nurLea = baueModell({ einheiten: [einheit('a', LEA)], posts: [], verbrauch: [], produktionen: [produktion] }, { ebene: 'produktion', produktionId: 'p1' });
    const lage = filterLage(nurLea, filter({ creator: ['c1'], plattform: ['tiktok'] }));
    expect(lage.optionen.creator).toEqual([]);
    expect(lage.filter.creator).toEqual([]);
    expect(lage.aktiv).toBe(false);
  });
});

describe('Filtern der Post-Tabelle', () => {
  it('ein Treffer im Filter reicht, mehrere Filter gelten zusammen', () => {
    const zeile = { einheit: einheit('x', LEA, ['Unboxing']), post: { plattform: 'tiktok' } };
    expect(passtZumFilter(zeile, filter({ ansatz: ['Unboxing', 'Problem-Lösung'] }))).toBe(true);
    expect(passtZumFilter(zeile, filter({ creator: ['c1'], plattform: ['ig_reel'] }))).toBe(false);
  });

  it('filtert bestätigte und offene Zeilen nach Creator', () => {
    const html = renderTabellenGruppen(modell, { team: true, filter: filter({ creator: ['c1'] }) });
    expect(zeilenIds(html)).toEqual(['pa', 'pc']);
  });

  it('„Ohne Ansatz“ findet Einheiten ohne Ansatz-Tag', () => {
    const ohne = filterOptionen(modell).ansatz.at(-1).value;
    expect(zeilenIds(renderTabellenGruppen(modell, { team: true, filter: filter({ ansatz: [ohne] }) }))).toEqual(['pc']);
  });

  it('eine Zeile ohne Post fällt beim Plattform-Filter weg', () => {
    const html = renderTabellenGruppen(modell, { team: true, filter: filter({ plattform: ['ig_reel'] }) });
    expect(zeilenIds(html)).toEqual(['pb']);
  });

  it('meldet einen leeren Filter statt „Noch keine Posts“', () => {
    const html = renderTabellenGruppen(modell, { filter: filter({ creator: ['c1'], plattform: ['ig_reel'] }) });
    expect(html).toContain('Keine Posts für diesen Filter.');
  });
});

describe('Kopf der Post-Tabelle', () => {
  it('zeigt die Filter nur mit mindestens zwei Werten', () => {
    const html = renderTabelle(modell, { team: true, filter: leererFilter() });
    expect(html).toContain('data-auswertung-filter="creator"');
    expect(html).toContain('data-auswertung-filter="ansatz"');
    expect(html).toContain('data-auswertung-filter="plattform"');
    expect(html).toContain('Alle Creator');
  });

  it('nennt ohne Filter den Stand, mit Filter Aufrufe, Interaktionen und Ø Wiedergabe der Auswahl', () => {
    expect(tabellenSub(modell, { team: true, filter: leererFilter() })).toBe('2 ausgewertet · 2 ohne Zahlen');
    expect(tabellenSub(modell, { team: true, filter: filter({ creator: ['c2'] }) }))
      .toBe('1 von 2 ausgewertet · 3,0K Aufrufe · 100 Interaktionen · Ø 4,0 s Wiedergabe · 1 ohne Zahlen');
  });
});
