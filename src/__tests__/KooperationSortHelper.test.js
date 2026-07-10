import { describe, it, expect } from 'vitest';
import {
  isVideoGoLiveCompleted,
  getEffectiveGoLiveDate,
  getEffectiveContentDeadline,
  sortKooperationen
} from '../modules/kampagne/KooperationSortHelper.js';

const NOW = new Date(2026, 4, 21); // 21.05.2026 (Monat 0-basiert)

function k(id, props = {}) {
  return { id, name: `K-${id}`, created_at: '2026-01-01T00:00:00Z', ...props };
}

describe('isVideoGoLiveCompleted', () => {
  it('false wenn keine Freigabe', () => {
    expect(isVideoGoLiveCompleted({ freigabe: false, posting_datum: '2026-05-01' }, NOW)).toBe(false);
  });

  it('false wenn kein Posting-Datum', () => {
    expect(isVideoGoLiveCompleted({ freigabe: true, posting_datum: null }, NOW)).toBe(false);
  });

  it('false wenn Datum in der Zukunft', () => {
    expect(isVideoGoLiveCompleted({ freigabe: true, posting_datum: '2026-06-01' }, NOW)).toBe(false);
  });

  it('true wenn Freigabe + Datum heute', () => {
    expect(isVideoGoLiveCompleted({ freigabe: true, posting_datum: '2026-05-21' }, NOW)).toBe(true);
  });

  it('true wenn Freigabe + Datum vergangen', () => {
    expect(isVideoGoLiveCompleted({ freigabe: true, posting_datum: '2026-04-01' }, NOW)).toBe(true);
  });
});

describe('getEffectiveGoLiveDate', () => {
  it('Video 1 relevant, wenn nicht erledigt', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: false, posting_datum: '2026-06-01' },
      { id: 'v2', freigabe: false, posting_datum: '2026-07-01' }
    ]};
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe('2026-06-01');
  });

  it('Video 1 erledigt → Video 2 zählt', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, posting_datum: '2026-04-01' },
      { id: 'v2', freigabe: false, posting_datum: '2026-07-01' }
    ]};
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe('2026-07-01');
  });

  it('Video 1+2 erledigt → Video 3 zählt', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, posting_datum: '2026-04-01' },
      { id: 'v2', freigabe: true, posting_datum: '2026-05-01' },
      { id: 'v3', freigabe: false, posting_datum: '2026-08-01' }
    ]};
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe('2026-08-01');
  });

  it('Freigabe ohne Datum → Video bleibt relevant (nicht überspringen, liefert null)', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, posting_datum: null },
      { id: 'v2', freigabe: false, posting_datum: '2026-07-01' }
    ]};
    // v1 ist NICHT erledigt (kein Datum) → ist aktiv, hat aber kein Datum
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe(null);
  });

  it('Datum vorbei ohne Freigabe → Video bleibt relevant', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: false, posting_datum: '2026-04-01' },
      { id: 'v2', freigabe: false, posting_datum: '2026-07-01' }
    ]};
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe('2026-04-01');
  });

  it('alle Videos erledigt → letztes Video', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, posting_datum: '2026-03-01' },
      { id: 'v2', freigabe: true, posting_datum: '2026-04-01' },
      { id: 'v3', freigabe: true, posting_datum: '2026-05-01' }
    ]};
    expect(getEffectiveGoLiveDate(koop, videos, NOW)).toBe('2026-05-01');
  });

  it('Fallback auf koop.posting_datum, wenn keine Videos', () => {
    const koop = k('a', { posting_datum: '2026-09-01' });
    expect(getEffectiveGoLiveDate(koop, {}, NOW)).toBe('2026-09-01');
  });

  it('null, wenn weder Videos noch koop-Datum vorhanden', () => {
    const koop = k('a');
    expect(getEffectiveGoLiveDate(koop, {}, NOW)).toBe(null);
  });
});

describe('sortKooperationen — name', () => {
  it('A-Z', () => {
    const koops = [k('1', { name: 'Charlie' }), k('2', { name: 'alpha' }), k('3', { name: 'Bravo' })];
    const sorted = sortKooperationen(koops, 'name_asc', {});
    expect(sorted.map(k => k.name)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('Z-A', () => {
    const koops = [k('1', { name: 'Charlie' }), k('2', { name: 'alpha' }), k('3', { name: 'Bravo' })];
    const sorted = sortKooperationen(koops, 'name_desc', {});
    expect(sorted.map(k => k.name)).toEqual(['Charlie', 'Bravo', 'alpha']);
  });
});

describe('sortKooperationen — created_at', () => {
  it('asc', () => {
    const koops = [
      k('1', { created_at: '2026-03-01T00:00:00Z' }),
      k('2', { created_at: '2026-01-01T00:00:00Z' }),
      k('3', { created_at: '2026-02-01T00:00:00Z' })
    ];
    expect(sortKooperationen(koops, 'created_asc', {}).map(k => k.id)).toEqual(['2', '3', '1']);
  });

  it('desc', () => {
    const koops = [
      k('1', { created_at: '2026-03-01T00:00:00Z' }),
      k('2', { created_at: '2026-01-01T00:00:00Z' }),
      k('3', { created_at: '2026-02-01T00:00:00Z' })
    ];
    expect(sortKooperationen(koops, 'created_desc', {}).map(k => k.id)).toEqual(['1', '3', '2']);
  });
});

describe('sortKooperationen — posting (GoLive)', () => {
  it('asc: nutzt erstes nicht-erledigtes Video', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, posting_datum: '2026-07-01' }],
      b: [{ id: 'vb1', freigabe: true, posting_datum: '2026-04-01' }, { id: 'vb2', freigabe: false, posting_datum: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, posting_datum: '2026-05-25' }]
    };
    const sorted = sortKooperationen(koops, 'posting_asc', videos, NOW);
    // c: 2026-05-25, b: 2026-06-01 (Video 2, weil Video 1 erledigt), a: 2026-07-01
    expect(sorted.map(k => k.id)).toEqual(['c', 'b', 'a']);
  });

  it('desc', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, posting_datum: '2026-07-01' }],
      b: [{ id: 'vb1', freigabe: true, posting_datum: '2026-04-01' }, { id: 'vb2', freigabe: false, posting_datum: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, posting_datum: '2026-05-25' }]
    };
    expect(sortKooperationen(koops, 'posting_desc', videos, NOW).map(k => k.id)).toEqual(['a', 'b', 'c']);
  });

  it('Einträge ohne Datum sortieren immer ans Ende (asc)', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, posting_datum: null }],
      b: [{ id: 'vb1', freigabe: false, posting_datum: '2026-06-01' }],
      c: []
    };
    const sorted = sortKooperationen(koops, 'posting_asc', videos, NOW);
    expect(sorted.map(k => k.id)).toEqual(['b', 'a', 'c']);
  });

  it('Einträge ohne Datum sortieren immer ans Ende (desc)', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, posting_datum: null }],
      b: [{ id: 'vb1', freigabe: false, posting_datum: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, posting_datum: '2026-08-01' }]
    };
    const sorted = sortKooperationen(koops, 'posting_desc', videos, NOW);
    expect(sorted.map(k => k.id)).toEqual(['c', 'b', 'a']);
  });

  it('Fallback auf koop.posting_datum, wenn keine Videos', () => {
    const koops = [
      k('a'),
      k('b', { posting_datum: '2026-03-01' }),
      k('c', { posting_datum: '2026-08-01' })
    ];
    const sorted = sortKooperationen(koops, 'posting_asc', {}, NOW);
    expect(sorted.map(k => k.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('getEffectiveContentDeadline', () => {
  it('erstes nicht freigegebenes Video zählt', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: false, content_deadline: '2026-06-01' },
      { id: 'v2', freigabe: false, content_deadline: '2026-07-01' }
    ]};
    expect(getEffectiveContentDeadline(koop, videos)).toBe('2026-06-01');
  });

  it('Video 1 freigegeben → Video 2 zählt', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, content_deadline: '2026-04-01' },
      { id: 'v2', freigabe: false, content_deadline: '2026-07-01' }
    ]};
    expect(getEffectiveContentDeadline(koop, videos)).toBe('2026-07-01');
  });

  it('aktives Video ohne Deadline → null (nicht überspringen)', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: false, content_deadline: null },
      { id: 'v2', freigabe: false, content_deadline: '2026-07-01' }
    ]};
    expect(getEffectiveContentDeadline(koop, videos)).toBe(null);
  });

  it('alle Videos freigegeben → letztes Video', () => {
    const koop = k('a');
    const videos = { a: [
      { id: 'v1', freigabe: true, content_deadline: '2026-03-01' },
      { id: 'v2', freigabe: true, content_deadline: '2026-04-01' },
      { id: 'v3', freigabe: true, content_deadline: '2026-05-01' }
    ]};
    expect(getEffectiveContentDeadline(koop, videos)).toBe('2026-05-01');
  });

  it('null, wenn keine Videos vorhanden', () => {
    const koop = k('a');
    expect(getEffectiveContentDeadline(koop, {})).toBe(null);
  });
});

describe('sortKooperationen — content_deadline', () => {
  it('asc: nutzt erstes nicht freigegebenes Video', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, content_deadline: '2026-07-01' }],
      b: [{ id: 'vb1', freigabe: true, content_deadline: '2026-04-01' }, { id: 'vb2', freigabe: false, content_deadline: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, content_deadline: '2026-05-25' }]
    };
    const sorted = sortKooperationen(koops, 'content_deadline_asc', videos, NOW);
    // c: 2026-05-25, b: 2026-06-01 (Video 2, weil Video 1 freigegeben), a: 2026-07-01
    expect(sorted.map(k => k.id)).toEqual(['c', 'b', 'a']);
  });

  it('desc', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, content_deadline: '2026-07-01' }],
      b: [{ id: 'vb1', freigabe: true, content_deadline: '2026-04-01' }, { id: 'vb2', freigabe: false, content_deadline: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, content_deadline: '2026-05-25' }]
    };
    expect(sortKooperationen(koops, 'content_deadline_desc', videos, NOW).map(k => k.id)).toEqual(['a', 'b', 'c']);
  });

  it('Einträge ohne Deadline sortieren immer ans Ende (asc)', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, content_deadline: null }],
      b: [{ id: 'vb1', freigabe: false, content_deadline: '2026-06-01' }],
      c: []
    };
    const sorted = sortKooperationen(koops, 'content_deadline_asc', videos, NOW);
    expect(sorted.map(k => k.id)).toEqual(['b', 'a', 'c']);
  });

  it('Einträge ohne Deadline sortieren immer ans Ende (desc)', () => {
    const koops = [k('a'), k('b'), k('c')];
    const videos = {
      a: [{ id: 'va1', freigabe: false, content_deadline: null }],
      b: [{ id: 'vb1', freigabe: false, content_deadline: '2026-06-01' }],
      c: [{ id: 'vc1', freigabe: false, content_deadline: '2026-08-01' }]
    };
    const sorted = sortKooperationen(koops, 'content_deadline_desc', videos, NOW);
    expect(sorted.map(k => k.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('sortKooperationen — Stabilität', () => {
  it('stabil bei gleichen Werten', () => {
    const koops = [
      k('1', { name: 'Same' }),
      k('2', { name: 'Same' }),
      k('3', { name: 'Same' }),
      k('4', { name: 'Same' })
    ];
    const sorted = sortKooperationen(koops, 'name_asc', {});
    expect(sorted.map(k => k.id)).toEqual(['1', '2', '3', '4']);
  });

  it('liefert neue Liste, mutiert Input nicht', () => {
    const koops = [k('1', { name: 'B' }), k('2', { name: 'A' })];
    const original = [...koops];
    sortKooperationen(koops, 'name_asc', {});
    expect(koops).toEqual(original);
  });

  it('leere Liste', () => {
    expect(sortKooperationen([], 'name_asc', {})).toEqual([]);
  });

  it('unbekannter sortValue → unverändert (Kopie)', () => {
    const koops = [k('1'), k('2')];
    expect(sortKooperationen(koops, 'foo_bar', {}).map(k => k.id)).toEqual(['1', '2']);
  });
});
