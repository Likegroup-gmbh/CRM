import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHOWCASE,
  ansichtFromSearch,
  buildShowcase,
  collectCurrent,
  filterShowcase,
  groupShowcase,
  isAusstehend,
  istHochgeladen,
  ordnerToSearch,
  showcaseSummary,
  uploadCounts
} from '../modules/video-browser/videoBrowserLogic.js';

const datei = (id, type = 'video') => ({ id, type, ratio: '9:16', variantKey: `${type}A`, tagIds: ['t1'], name: id, status: { key: 'wartet' }, asset: {} });
const video = (id, { schleife = [], final = [], label = id, title = null } = {}) => ({
  id,
  label,
  title,
  folders: [
    { id: `${id}-raw`, kind: 'raw', items: [] },
    { id: `${id}-l1`, kind: 'schleife', items: schleife, leer: !schleife.length, upload: true },
    { id: `${id}-final`, kind: 'final', items: final }
  ]
});
const koop = (id, name, rows, { creatorId = null, rohmaterialCount = 0 } = {}) => ({ id, name, creatorId, rohmaterialCount, rows });

const TREE = {
  kooperationen: [
    koop('k1', 'Lena', [
      video('v1', { schleife: [datei('a')] }),
      video('v2', { label: 'Video 2', title: 'Unboxing' }),
      video('v3', { schleife: [datei('b')] })
    ], { creatorId: 'c1', rohmaterialCount: 2 }),
    koop('k2', 'Jonas', [video('v4')]),
    koop('k3', 'Lena', [video('v5', { schleife: [datei('c', 'still')] })], { creatorId: 'c1' })
  ]
};

const ids = (list) => list.map(e => e.item.id);

describe('Ausstehende Videos im Aktuellen Stand', () => {
  it('stehen an ihrer Video-Nr zwischen den Dateien, mit Titel und Rohmaterial-Hinweis', () => {
    const list = collectCurrent(TREE);
    expect(ids(list)).toEqual(['a', 'ausstehend:v2', 'b', 'ausstehend:v4', 'c']);
    const aus = list[1].item;
    expect(isAusstehend(aus)).toBe(true);
    expect(aus).toMatchObject({ name: 'Unboxing', ratio: null, tagIds: [], hatRohmaterial: true });
    expect(list[3].item).toMatchObject({ name: 'v4', hatRohmaterial: false });
  });

  it('hochgeladen heißt Datei in einer Schleife oder der Finalen Version, Rohmaterial zählt nicht', () => {
    expect(istHochgeladen(video('x', { schleife: [datei('a')] }))).toBe(true);
    expect(istHochgeladen(video('x', { final: [datei('f')] }))).toBe(true);
    const nurRoh = video('x');
    nurRoh.folders[0].items.push({ id: 'r', type: 'roh' });
    expect(istHochgeladen(nurRoh)).toBe(false);
  });

  it('bleiben ohne Filter und bei Videos, Bilder, Stories und jeder Tag blenden sie aus', () => {
    const list = collectCurrent(TREE);
    expect(ids(filterShowcase(list, {}))).toHaveLength(5);
    expect(ids(filterShowcase(list, { typ: 'video' }))).toEqual(['a', 'ausstehend:v2', 'b', 'ausstehend:v4']);
    expect(ids(filterShowcase(list, { typ: 'still' }))).toEqual(['c']);
    expect(ids(filterShowcase(list, { tag: 't1' }))).toEqual(['a', 'b', 'c']);
  });

  it('gibt es unter „Nur final“ nicht', () => {
    const sc = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, inhalt: 'final' }, []);
    expect(sc.list.some(e => isAusstehend(e.item))).toBe(false);
  });

  it('die Zusammenfassung nennt sie getrennt', () => {
    const sc = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, group: 'keine' }, []);
    expect(showcaseSummary(sc.list)).toBe('3 Inhalte von 2 Creators · 2 ausstehend');
  });
});

describe('Gruppe Creator mit „x von y hochgeladen“', () => {
  it('fasst Kooperationen desselben Creators zusammen und zählt seine Videos', () => {
    const counts = uploadCounts(TREE);
    expect(counts.get('creator:c1')).toEqual({ soll: 4, hochgeladen: 3, koops: 2 });
    expect(counts.get('koop:k2')).toEqual({ soll: 1, hochgeladen: 0, koops: 1 });

    const groups = groupShowcase(collectCurrent(TREE), 'creator', counts);
    expect(groups.map(g => [g.id, g.label, ids(g.entries)])).toEqual([
      ['creator:c1', 'Lena', ['a', 'ausstehend:v2', 'b', 'c']],
      ['koop:k2', 'Jonas', ['ausstehend:v4']]
    ]);
    expect(groups[0]).toMatchObject({ soll: 4, hochgeladen: 3, mehrereKooperationen: true, head: true });
    expect(groups[1]).toMatchObject({ soll: 1, hochgeladen: 0, mehrereKooperationen: false });
  });

  it('zählt auch bei Filtern alle Videos des Creators', () => {
    const sc = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, typ: 'still' }, []);
    expect(sc.groups).toHaveLength(1);
    expect(sc.groups[0]).toMatchObject({ id: 'creator:c1', soll: 4, hochgeladen: 3 });
  });
});

describe('Ansicht aus der URL', () => {
  it('Showcase ist Standard, ein Link mit Auswahl ohne Ansicht öffnet den Ordner', () => {
    expect(ansichtFromSearch('')).toBe('showcase');
    expect(ansichtFromSearch('?tab=videos')).toBe('showcase');
    expect(ansichtFromSearch('?tab=videos&k=k1&v=v1')).toBe('ordner');
    expect(ansichtFromSearch('?ansicht=showcase&k=k1')).toBe('showcase');
    expect(ansichtFromSearch('?ansicht=kalender')).toBe('kalender');
    expect(ansichtFromSearch('?ansicht=quatsch')).toBe('showcase');
  });

  it('ordnerToSearch setzt und entfernt nur die eigene Ansicht', () => {
    expect(ordnerToSearch('?tab=videos', true)).toBe('?tab=videos&ansicht=ordner');
    expect(ordnerToSearch('?tab=videos&ansicht=ordner', false)).toBe('?tab=videos');
    expect(ordnerToSearch('?ansicht=kalender', false)).toBe('?ansicht=kalender');
  });
});
