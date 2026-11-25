import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHOWCASE,
  activeChipIds,
  buildShowcase,
  collectCurrent,
  filterShowcase,
  showcaseChips,
  showcaseFromSearch,
  showcaseToSearch,
  toggleChip
} from '../modules/video-browser/videoBrowserLogic.js';
import { showcaseTreffer } from '../modules/video-browser/videoBrowserSuche.js';

const CATALOG = [{ id: 't1', label: 'Hook' }, { id: 't2', label: 'Mama' }];

const datei = (id, tagIds = []) => ({ id, type: 'video', ratio: '9:16', variantKey: `datei${id}`, tagIds, name: id, status: { key: 'wartet' }, asset: {} });
const video = (id, schleife = []) => ({
  id,
  label: id,
  folders: [
    { id: `${id}-raw`, kind: 'raw', items: [] },
    { id: `${id}-l1`, kind: 'schleife', items: schleife },
    { id: `${id}-final`, kind: 'final', items: [] }
  ]
});
const koop = (id, name, rows, tags = []) => ({ id, name, rows, tags });

const TREE = {
  kooperationen: [
    koop('k1', 'Lena', [video('v1', [datei('a', ['t1'])]), video('v2')], [{ id: '7', label: 'Sport' }, { id: '8', label: 'mama' }]),
    koop('k2', 'Jonas', [video('v3', [datei('b', ['t2'])])], [{ id: '9', label: 'Beauty' }]),
    koop('k3', 'Mia', [video('v4', [datei('c')])])
  ]
};

const ids = (list) => list.map(e => e.item.id);

describe('Showcase: Tags aus dem Kooperationsformular', () => {
  const list = collectCurrent(TREE);

  it('stehen als Chips neben den Video-Tags, alphabetisch, gleichnamige nur einmal mit der Video-Tag-Id', () => {
    const tags = showcaseChips(list, CATALOG).filter(c => c.kind === 'tag');
    expect(tags.map(c => [c.label, c.id])).toEqual([
      ['Beauty', 'tag:koop:9'],
      ['Hook', 'tag:t1'],
      ['Mama', 'tag:t2'],
      ['Sport', 'tag:koop:7']
    ]);
  });

  it('ein Koop-Tag zeigt alle Kacheln der Kooperation, auch Ausstehende', () => {
    expect(ids(filterShowcase(list, { tag: 'koop:7' }, CATALOG))).toEqual(['a', 'ausstehend:v2']);
    expect(ids(filterShowcase(list, { tag: 'koop:7', typ: 'still' }, CATALOG))).toEqual([]);
  });

  it('gleichnamige Video- und Koop-Tags filtern gleich, egal welche Id gewählt ist', () => {
    expect(ids(filterShowcase(list, { tag: 't2' }, CATALOG))).toEqual(['a', 'ausstehend:v2', 'b']);
    expect(ids(filterShowcase(list, { tag: 'koop:8' }, CATALOG))).toEqual(['a', 'ausstehend:v2', 'b']);
  });

  it('Chip, Zustand und URL tragen den Koop-Tag durch', () => {
    const state = toggleChip({ ...DEFAULT_SHOWCASE }, 'tag:koop:9');
    expect(state.tag).toBe('koop:9');
    expect(activeChipIds(state)).toEqual(['tag:koop:9']);
    expect(showcaseFromSearch(showcaseToSearch('?tab=videos', state)).tag).toBe('koop:9');

    const sc = buildShowcase(TREE, state, CATALOG);
    expect(sc.state.tag).toBe('koop:9');
    expect(ids(sc.list)).toEqual(['b']);
  });

  it('ein Koop-Tag, den es nicht mehr gibt, wird zurückgesetzt', () => {
    expect(buildShowcase(TREE, { ...DEFAULT_SHOWCASE, tag: 'koop:99' }, CATALOG).state.tag).toBeNull();
  });

  it('ohne Koop-Tags (Kundenseite) bleibt es bei den Video-Tags', () => {
    const ohne = { kooperationen: TREE.kooperationen.map(k => ({ ...k, tags: undefined })) };
    const tags = showcaseChips(collectCurrent(ohne), CATALOG).filter(c => c.kind === 'tag');
    expect(tags.map(c => c.label)).toEqual(['Hook', 'Mama']);
  });

  it('die Suche findet Kacheln über die Tags ihrer Kooperation', () => {
    expect(showcaseTreffer(list, 'sport', CATALOG)).toEqual([true, true, false, false]);
  });
});
