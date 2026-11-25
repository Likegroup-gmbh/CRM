import { describe, expect, it } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { leererFilter } from '../modules/auswertung/auswertungFilter.js';
import { creatorGruppen, creatorRaenge } from '../modules/auswertung/auswertungGruppen.js';
import { renderTabellenGruppen } from '../modules/auswertung/auswertungTabelle.js';

const produktion = { id: 'p1', name: 'Produktion 1', linien: [] };
const LEA = { id: 'c1', name: 'Lea Berg' };
const ADA = { id: 'c2', name: 'Ada Kern' };
const TOM = { id: 'c3', name: 'Tom Ries' };

const einheit = (id, creator, extra = {}) => ({
  id: `video:${id}`, art: 'video', label: `Video ${id}`, titel: `Hook ${id}`, erwartet: true,
  produktion: { id: 'p1', name: 'Produktion 1' }, creator,
  dateien: [{ id: `${id}-916`, ratio: '9:16' }], tags: { persona: [], ansatz: [], plattform: [] }, ...extra
});

const post = (id, einheitId, metrics, extra = {}) => ({
  id, einheitId, status: 'confirmed', plattform: 'tiktok', postedAt: '2026-10-01', metrics, ...extra
});

// Lea: 2 Posts (100 + 900 = 1.000) und ein fehlendes Video; Ada: 1 Post (3.000) und ein Entwurf; Tom: 1 Post (500)
const modell = baueModell({
  einheiten: [
    einheit('a', LEA), einheit('b', LEA), einheit('c', LEA),
    einheit('d', ADA), einheit('e', ADA),
    einheit('f', TOM)
  ],
  posts: [
    post('pa', 'video:a', { views: 100, avgWatchSec: 9 }),
    post('pb', 'video:b', { views: 900, avgWatchSec: 1 }),
    post('pd', 'video:d', { views: 3000, avgWatchSec: 4 }),
    post('pe', 'video:e', { views: 50 }, { status: 'draft' }),
    post('pf', 'video:f', { views: 500, avgWatchSec: 6 }, { plattform: 'ig_reel' })
  ],
  verbrauch: [],
  produktionen: [produktion]
}, { ebene: 'produktion', produktionId: 'p1' });

const doc = (html) => new DOMParser().parseFromString(`<table>${html}</table>`, 'text/html');
const reihenfolge = (gruppen) => gruppen.map(g => g.creator?.name);

describe('Gruppen der Post-Tabelle je Creator', () => {
  it('bündelt die Posts eines Creators, offene Zeilen nur fürs Team', () => {
    const team = creatorGruppen(modell, { team: true });
    const lea = team.find(g => g.key === 'c1');
    expect(lea.posts.map(p => p.id)).toEqual(['pb', 'pa']);
    expect(lea.offen.map(z => z.einheit.id)).toEqual(['video:c']);
    expect(lea.stand).toEqual({ bestaetigt: 2, pruefen: 0, fehlt: 1 });
    expect(lea.aufrufe).toBe(1000);

    const kunde = creatorGruppen(modell, { team: false });
    expect(kunde.every(g => g.offen.length === 0)).toBe(true);
  });

  it('ordnet Gruppen nach der Summe, bei Ø Wiedergabe nach dem Mittel', () => {
    expect(reihenfolge(creatorGruppen(modell))).toEqual(['Ada Kern', 'Lea Berg', 'Tom Ries']);
    expect(reihenfolge(creatorGruppen(modell, { sort: { field: 'aufrufe', ascending: true } })))
      .toEqual(['Tom Ries', 'Lea Berg', 'Ada Kern']);
    // Mittel: Tom 6, Lea 5, Ada 4
    expect(reihenfolge(creatorGruppen(modell, { sort: { field: 'wiedergabe', ascending: false } })))
      .toEqual(['Tom Ries', 'Lea Berg', 'Ada Kern']);
  });

  it('Gruppen ohne bestätigte Posts stehen hinten, „Ohne Creator“ bei Gleichstand zuletzt', () => {
    const m = baueModell({
      einheiten: [einheit('x', null), einheit('y', TOM), einheit('z', ADA)],
      posts: [post('pz', 'video:z', { views: 10 })],
      verbrauch: [],
      produktionen: [produktion]
    }, { ebene: 'produktion', produktionId: 'p1' });
    expect(reihenfolge(creatorGruppen(m, { team: true }))).toEqual(['Ada Kern', 'Tom Ries', undefined]);
  });

  it('Rang nach Aufrufen gesamt, unabhängig von Sortierung und Filter', () => {
    expect([...creatorRaenge(modell)]).toEqual([['c2', 1], ['c1', 2], ['c3', 3]]);
    const html = renderTabellenGruppen(modell, {
      sort: { field: 'aufrufe', ascending: true },
      filter: { ...leererFilter(), creator: ['c3'] }
    });
    const rang = doc(html).querySelector('td.auswertung-tabelle__rang .auswertung-rang');
    expect(rang.textContent).toBe('3');
    expect(rang.classList.contains('auswertung-rang--top')).toBe(true);
  });
});

describe('Darstellung je Creator', () => {
  it('ein tbody je Creator, Rang und Creator einmal mit rowspan über alle Zeilen', () => {
    const d = doc(renderTabellenGruppen(modell, { team: true }));
    const gruppen = [...d.querySelectorAll('tbody.auswertung-gruppe')];
    expect(gruppen.map(g => g.dataset.flipId)).toEqual(['creator:c2', 'creator:c1', 'creator:c3']);

    const lea = gruppen[1];
    expect(lea.querySelectorAll('tr')).toHaveLength(3);
    const koepfe = lea.querySelectorAll('td[data-auswertung-gruppenkopf]');
    expect(koepfe).toHaveLength(2);
    expect([...koepfe].map(td => td.getAttribute('rowspan'))).toEqual(['3', '3']);
    expect(lea.querySelectorAll('td.auswertung-tabelle__creator')).toHaveLength(1);
    expect([...lea.querySelectorAll('tr')].map(tr => tr.dataset.postId || tr.dataset.auswertungErfassenEinheit))
      .toEqual(['pb', 'pa', 'video:c']);
  });

  it('Creator-Zelle: nur der Name, keine Unterzeile', () => {
    const team = doc(renderTabellenGruppen(modell, { team: true }));
    const lea = team.querySelector('tbody[data-flip-id="creator:c1"] td.auswertung-tabelle__creator');
    expect(lea.querySelector('.auswertung-tabelle__sub')).toBeNull();
    expect(lea.textContent).not.toMatch(/Aufrufe|ausgewertet|fehlt/);

    const kunde = doc(renderTabellenGruppen(modell, { team: false }));
    const leaKunde = kunde.querySelector('tbody[data-flip-id="creator:c1"] td.auswertung-tabelle__creator');
    expect(leaKunde.querySelector('.auswertung-tabelle__sub')).toBeNull();
    expect(kunde.querySelectorAll('tr.auswertung-zeile--offen')).toHaveLength(0);
  });

  it('ohne Creator: eigene Gruppe mit „Ohne Creator“ und ohne Link', () => {
    const m = baueModell({
      einheiten: [einheit('x', null)],
      posts: [post('px', 'video:x', { views: 10 })],
      verbrauch: [],
      produktionen: [produktion]
    }, { ebene: 'produktion', produktionId: 'p1' });
    const zelle = doc(renderTabellenGruppen(m)).querySelector('td.auswertung-tabelle__creator');
    expect(zelle.textContent).toContain('Ohne Creator');
    expect(zelle.querySelector('a')).toBeNull();
  });
});
