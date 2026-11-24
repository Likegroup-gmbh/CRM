import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHOWCASE,
  buildShowcase,
  collectCurrent,
  filterShowcase,
  kachelStatus,
  showcaseStatusOptions,
  statusCounts
} from '../modules/video-browser/videoBrowserLogic.js';

const datei = (id, key, extra = {}) => ({ id, type: 'video', ratio: '9:16', variantKey: null, tagIds: [], name: id, status: { key }, asset: {}, ...extra });
const video = (id, { schleife = [], final = [] } = {}) => ({
  id,
  label: id,
  folders: [
    { id: `${id}-l1`, kind: 'schleife', items: schleife },
    { id: `${id}-final`, kind: 'final', items: final }
  ]
});

const TREE = {
  kooperationen: [{
    id: 'k1',
    name: 'Lena',
    rows: [
      video('v1', { schleife: [datei('wartet', 'wartet'), datei('fb', 'feedback', { tagIds: ['t1'] })] }),
      video('v2', { schleife: [datei('alt', 'aenderungen')] }),
      video('v3'),
      video('v4', { final: [datei('fin', 'freigegeben', { isFinal: true })] })
    ]
  }]
};
const CATALOG = [{ id: 't1', label: 'Persona A' }];
const ids = (list) => list.map(e => e.item.id);

describe('Status-Filter im Showcase', () => {
  it('Kachelstatus: Ausstehend und Final aus der Kachel, Änderungen angefordert zählt wie Feedback erhalten', () => {
    const byId = Object.fromEntries(collectCurrent(TREE).map(e => [e.item.id, kachelStatus(e.item)]));
    expect(byId).toEqual({ wartet: 'wartet', fb: 'feedback', alt: 'feedback', 'ausstehend:v3': 'ausstehend', fin: 'freigegeben' });
  });

  it('filtert nach Status und verknüpft mit Typ und Tag per UND', () => {
    const list = collectCurrent(TREE);
    expect(ids(filterShowcase(list, { status: 'feedback' }))).toEqual(['fb', 'alt']);
    expect(ids(filterShowcase(list, { status: 'feedback', tag: 't1' }))).toEqual(['fb']);
    expect(ids(filterShowcase(list, { status: 'ausstehend', typ: 'still' }))).toEqual([]);
    expect(filterShowcase(list, { status: 'alle' })).toHaveLength(5);
  });

  it('Zähler je Status kommen nach Typ und Tag, aber vor dem Status', () => {
    expect(statusCounts(collectCurrent(TREE))).toEqual({ alle: 5, feedback: 2, wartet: 1, ausstehend: 1, freigegeben: 1 });
    const sc = buildShowcase(TREE, { ...DEFAULT_SHOWCASE, status: 'wartet', tag: 't1' }, CATALOG);
    expect(ids(sc.list)).toEqual([]);
    expect(sc.statusCounts).toMatchObject({ alle: 1, feedback: 1, wartet: 0 });
  });

  it('„Nur final“ setzt den Status auf „Alle“, ein Status ohne Kacheln bleibt stehen', () => {
    expect(buildShowcase(TREE, { ...DEFAULT_SHOWCASE, inhalt: 'final', status: 'wartet' }, []).state.status).toBe('alle');
    const leer = { kooperationen: [{ id: 'k', name: 'L', rows: [video('v', { schleife: [datei('w', 'wartet')] })] }] };
    expect(buildShowcase(leer, { ...DEFAULT_SHOWCASE, status: 'feedback' }, []).state.status).toBe('feedback');
  });

  it('Labels je Rolle wie die Badges, die eigene Aufgabe steht vorn', () => {
    expect(showcaseStatusOptions(true).map(o => o.label)).toEqual(['Alle', 'Feedback erhalten', 'Wartet auf Kunde', 'Ausstehend', 'Freigegeben']);
    expect(showcaseStatusOptions(false).map(o => [o.value, o.label])).toEqual([
      ['alle', 'Alle'], ['wartet', 'Zu prüfen'], ['feedback', 'Feedback gegeben'], ['ausstehend', 'In Produktion'], ['freigegeben', 'Freigegeben']
    ]);
  });
});
