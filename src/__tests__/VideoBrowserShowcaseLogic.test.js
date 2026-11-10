import { describe, expect, it } from 'vitest';
import {
  activeChipIds,
  buildShowcase,
  collectCurrent,
  collectFinals,
  filterShowcase,
  groupShowcase,
  personaOf,
  pickFormat,
  reconcileState,
  showcaseChips,
  showcaseFromSearch,
  showcaseSummary,
  showcaseToSearch,
  toggleChip,
  DEFAULT_SHOWCASE
} from '../modules/video-browser/videoBrowserLogic.js';

const CATALOG = [
  { id: 't1', label: 'Persona A', gruppe: 'Persona' },
  { id: 't2', label: 'TikTok', gruppe: 'Plattform' },
  { id: 't4', label: 'Persona B', gruppe: 'Persona' }
];

const fin = (id, type, ratio, variantKey, tagIds = []) => ({ id, type, ratio, isFinal: true, variantKey, tagIds, name: id });
const koop = (id, name, rows) => ({ id, name, rows });
const row = (id, items) => ({ id, folders: [{ id: 'raw', kind: 'raw', items: [{ id: 'x' }] }, { id: 'final', kind: 'final', items }] });

const TREE = {
  kooperationen: [
    koop('k1', 'Lena Hartmann', [
      row('v1', [
        fin('a916', 'video', '9:16', 'videoA', ['t2', 't1']),
        fin('a45', 'video', '4:5', 'videoA', ['t2', 't1']),
        fin('b45', 'video', '4:5', 'videoB', ['t2']),
        fin('s1', 'still', '4:5', null)
      ])
    ]),
    koop('k2', 'Jonas Weber', [
      row('v2', [fin('c916', 'story', '9:16', 'storyX', ['t4'])]),
      row('v3', [])
    ])
  ]
};

describe('collectFinals', () => {
  it('sammelt Finale in Ordneransicht-Reihenfolge und überspringt Videos ohne Finale', () => {
    expect(collectFinals(TREE).map(e => e.item.id)).toEqual(['a916', 'a45', 'b45', 's1', 'c916']);
  });
  it('kommt mit leerem Baum zurecht', () => {
    expect(collectFinals(null)).toEqual([]);
  });
});

describe('collectCurrent (Aktueller Stand)', () => {
  const loop = (id, type, variantKey, source = null) => ({ id, type, ratio: '9:16', variantKey, tagIds: [], name: id, status: { key: 'wartet' }, asset: { source_asset_id: source } });
  const finalOf = (id, type, ratio, variantKey, source) => ({ ...fin(id, type, ratio, variantKey), asset: { source_asset_id: source } });
  const full = (id, loops1, loops2, finals) => ({
    id,
    folders: [
      { id: 'raw', kind: 'raw', items: [{ id: 'x' }] },
      { id: 'l1', kind: 'schleife', items: loops1 },
      { id: 'l2', kind: 'schleife', items: loops2 },
      { id: 'final', kind: 'final', items: finals }
    ]
  });

  it('Finale ersetzen ihre Variante, alles andere kommt aus der letzten Runde', () => {
    const tree = { kooperationen: [koop('k', 'Lena', [
      full('v1',
        [loop('o1', 'video', 'videoA'), loop('o2', 'video', 'videoB')],
        [loop('n1', 'video', 'videoA'), loop('n2', 'video', 'videoB'), loop('n3', 'still', 'stillC')],
        [finalOf('f1', 'video', '9:16', 'videoA', 'n1'), finalOf('f2', 'video', '4:5', 'videoA', 'n1')]),
      full('v2', [loop('m1', 'video', 'videoA')], [], [])
    ])] };
    const ids = (list) => list.map(e => e.item.id);
    expect(ids(collectCurrent(tree))).toEqual(['f1', 'f2', 'n2', 'n3', 'm1']);
    // Seitenverhältnis wählt je Variante die Datei
    expect(ids(pickFormat(collectCurrent(tree), '4:5'))).toEqual(['f2', 'n2', 'n3', 'm1']);
  });

  it('Finale ohne Variante verknüpfen über die Quelle und Finale ohne Quelle bleiben dabei', () => {
    const tree = { kooperationen: [koop('k', 'Lena', [
      full('v1', [], [loop('n1', 'video', null)], [finalOf('f1', 'video', '9:16', null, 'n1'), finalOf('direkt', 'video', '9:16', null, null)])
    ])] };
    expect(collectCurrent(tree).map(e => e.item.id)).toEqual(['f1', 'direkt']);
  });

  it('buildShowcase wählt die Datenmenge über inhalt', () => {
    const tree = { kooperationen: [koop('k', 'Lena', [full('v1', [], [loop('n1', 'video', 'videoA')], [])])] };
    expect(buildShowcase(tree, { ...DEFAULT_SHOWCASE }, []).total).toBe(0);
    expect(buildShowcase(tree, { ...DEFAULT_SHOWCASE, inhalt: 'aktuell' }, []).total).toBe(1);
  });
});

describe('pickFormat', () => {
  const all = collectFinals(TREE);
  it('nimmt je Variante das gewünschte Seitenverhältnis', () => {
    expect(pickFormat(all, '4:5').map(e => e.item.id)).toEqual(['a45', 'b45', 's1', 'c916']);
  });
  it('fällt auf die vorhandene Datei zurück, damit keine Variante verschwindet', () => {
    expect(pickFormat(all, '1:1').map(e => e.item.id)).toEqual(['a916', 'b45', 's1', 'c916']);
  });
  it('Finale ohne Variante zählen einzeln', () => {
    const list = [
      { row: { id: 'v' }, item: fin('u1', 'video', '9:16', null) },
      { row: { id: 'v' }, item: fin('u2', 'video', '4:5', null) }
    ];
    expect(pickFormat(list, '9:16')).toHaveLength(2);
  });
});

describe('Filter', () => {
  const base = pickFormat(collectFinals(TREE), '9:16');

  it('Typ und Tag sind UND-verknüpft', () => {
    expect(filterShowcase(base, { typ: 'video' }).map(e => e.item.id)).toEqual(['a916', 'b45']);
    expect(filterShowcase(base, { typ: 'video', tag: 't1' }).map(e => e.item.id)).toEqual(['a916']);
    expect(filterShowcase(base, { typ: 'story', tag: 't1' })).toEqual([]);
  });

  it('Chips: nur vorkommende Typen, Trenner, Tags alphabetisch nach Label', () => {
    const chips = showcaseChips(base, CATALOG);
    expect(chips.map(c => c.kind === 'sep' ? '|' : c.label)).toEqual(['Videos', 'Bilder', 'Stories', '|', 'Persona A', 'Persona B', 'TikTok']);
    expect(chips[0].id).toBe('typ:video');
    expect(chips.at(-1).id).toBe('tag:t2');
  });

  it('Chips ohne Tags haben keinen Trenner, ohne Daten gibt es keine Chips', () => {
    const noTags = showcaseChips([{ item: { type: 'video', tagIds: [] } }], CATALOG);
    expect(noTags.map(c => c.kind)).toEqual(['typ']);
    expect(showcaseChips([], CATALOG)).toEqual([]);
  });

  it('Einfachauswahl je Kategorie als Toggle', () => {
    let s = { ...DEFAULT_SHOWCASE };
    s = toggleChip(s, 'typ:story');
    expect(s.typ).toBe('story');
    s = toggleChip(s, 'tag:t4');
    expect(activeChipIds(s)).toEqual(['typ:story', 'tag:t4']);
    s = toggleChip(s, 'typ:video');
    expect(s.typ).toBe('video');
    s = toggleChip(s, 'typ:video');
    expect(s.typ).toBeNull();
  });

  it('ein Tag, den es in der Datenmenge nicht mehr gibt, wird zurückgesetzt', () => {
    const state = { ...DEFAULT_SHOWCASE, tag: 't4', typ: 'story' };
    const onlyVideos = base.filter(e => e.item.type === 'video');
    expect(reconcileState(state, onlyVideos, CATALOG)).toMatchObject({ tag: null, typ: null });
    expect(reconcileState(state, base, CATALOG)).toMatchObject({ tag: 't4', typ: 'story' });
  });
});

describe('Gruppierung', () => {
  const base = pickFormat(collectFinals(TREE), '9:16');

  it('Creator: ein Abschnitt je Kooperation in Ordner-Reihenfolge', () => {
    const groups = groupShowcase(base, 'creator', CATALOG);
    expect(groups.map(g => [g.label, g.entries.length])).toEqual([['Lena Hartmann', 3], ['Jonas Weber', 1]]);
  });

  it('Persona: über Tag-Gruppe, alphabetisch, „Ohne Persona“ zuletzt', () => {
    const groups = groupShowcase(base, 'persona', CATALOG);
    expect(groups.map(g => g.label)).toEqual(['Persona A', 'Persona B', 'Ohne Persona']);
    expect(groups[2].entries.map(e => e.item.id)).toEqual(['b45', 's1']);
  });

  it('personaOf ignoriert Tags anderer Gruppen und ist label-unabhängig', () => {
    expect(personaOf({ tagIds: ['t2'] }, CATALOG)).toBeNull();
    expect(personaOf({ tagIds: ['t2', 't1'] }, CATALOG).id).toBe('t1');
    expect(personaOf({ tagIds: ['t2'] }, [{ id: 't2', label: 'Persona X', gruppe: 'Plattform' }])).toBeNull();
  });

  it('Keine: ein Abschnitt ohne Kopf', () => {
    const groups = groupShowcase(base, 'keine', CATALOG);
    expect(groups).toHaveLength(1);
    expect(groups[0].head).toBe(false);
  });

  it('leere Menge ergibt keine Abschnitte', () => {
    expect(groupShowcase([], 'creator', CATALOG)).toEqual([]);
  });
});

describe('buildShowcase', () => {
  it('liefert flache Anzeigeliste in Abschnittsreihenfolge und setzt verwaiste Filter zurück', () => {
    const result = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, group: 'persona', tag: 'gibtsnicht' }, CATALOG);
    expect(result.state.tag).toBeNull();
    expect(result.list.map(e => e.item.id)).toEqual(['a916', 'c916', 'b45', 's1']);
    expect(result.total).toBe(4);
  });

  it('Zusammenfassung zählt Inhalte und Creators der gefilterten Menge', () => {
    const { list } = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, typ: 'video' }, CATALOG);
    expect(showcaseSummary(list)).toBe('2 Inhalte von 1 Creator');
  });
});

describe('URL', () => {
  it('Roundtrip, fremde Parameter bleiben', () => {
    const state = { inhalt: 'aktuell', group: 'persona', fmt: '4:5', size: 'L', typ: 'video', tag: 't1' };
    const search = showcaseToSearch('?tab=videos&linie=l1', state);
    expect(search).toContain('tab=videos');
    expect(search).toContain('format=4x5');
    expect(showcaseFromSearch(search)).toEqual(state);
  });

  it('ohne Showcase fehlen die Parameter', () => {
    const search = showcaseToSearch('?tab=videos&ansicht=showcase&typ=video', null);
    expect(search).toBe('?tab=videos');
    expect(showcaseFromSearch(search)).toBeNull();
  });

  it('unbekannte Werte fallen auf den Standard', () => {
    expect(showcaseFromSearch('?ansicht=showcase&gruppe=x&format=2x3&groesse=XL&typ=foo'))
      .toEqual({ ...DEFAULT_SHOWCASE });
  });
});
