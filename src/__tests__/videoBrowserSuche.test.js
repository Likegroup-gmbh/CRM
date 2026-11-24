import { describe, expect, it } from 'vitest';
import {
  kachelText,
  ordnerTreffer,
  showcaseTreffer,
  sucheBegriffe,
  sucheNormal,
  trifft
} from '../modules/video-browser/videoBrowserSuche.js';

const KATALOG = [{ id: 't1', label: 'Persona A' }];

const koop = (id, name, rows, extra = {}) => ({ id, name, handle: null, kooperationName: '', linieName: '', produkte: [], rows, ...extra });
const row = (id, label, title, items = []) => ({ id, label, title, folders: [{ kind: 'schleife', items }] });

const TREE = {
  kooperationen: [
    koop('k1', 'Lisa Müller', [row('v1', 'Video 1', 'Wassermelonen Eis'), row('v2', 'Video 2', 'Unboxing')], { handle: '@lisa.m' }),
    koop('k2', 'Jan Voss', [row('v3', 'Video 12', 'Schwamm DIY', [{ name: 'Hook Variante', tagIds: ['t1'] }])], { linieName: 'Sommer' })
  ]
};

describe('Suche: Normalisieren und Treffen', () => {
  it('ignoriert Groß- und Kleinschreibung, Akzente, ß und doppelte Leerzeichen', () => {
    expect(sucheNormal('  Müller   STRAßE ')).toBe('muller strasse');
    expect(sucheBegriffe(' Lisa  Eis ')).toEqual(['lisa', 'eis']);
    expect(sucheBegriffe('   ')).toEqual([]);
  });

  it('verlangt jedes Wort (UND), Teilwörter zählen, eine Zahl nur als ganze Zahl', () => {
    const text = sucheNormal('Lisa Müller Video 12 Wassermelonen Eis');
    expect(trifft(text, sucheBegriffe('melone lisa'))).toBe(true);
    expect(trifft(text, sucheBegriffe('lisa jan'))).toBe(false);
    expect(trifft(text, sucheBegriffe('video 12'))).toBe(true);
    expect(trifft(text, sucheBegriffe('video 1'))).toBe(false);
    expect(trifft(text, [])).toBe(true);
  });
});

describe('Suche: Showcase', () => {
  it('trifft Creator, Handle, Video, Datei und Tag einer Kachel', () => {
    const [lisa] = TREE.kooperationen;
    const [jan] = TREE.kooperationen.slice(1);
    const list = [
      { koop: lisa, row: lisa.rows[0], item: { name: 'Finale Version 9:16', tagIds: [] } },
      { koop: jan, row: jan.rows[0], item: jan.rows[0].folders[0].items[0] }
    ];
    expect(showcaseTreffer(list, 'muller', KATALOG)).toEqual([true, false]);
    expect(showcaseTreffer(list, '@lisa', KATALOG)).toEqual([true, false]);
    expect(showcaseTreffer(list, 'persona', KATALOG)).toEqual([false, true]);
    expect(showcaseTreffer(list, 'hook sommer', KATALOG)).toEqual([false, true]);
    expect(showcaseTreffer(list, '', KATALOG)).toEqual([true, true]);
    expect(kachelText(list[0], KATALOG)).toContain('wassermelonen eis');
  });
});

describe('Suche: Spaltenbrowser', () => {
  it('ohne Begriffe filtert nichts', () => {
    expect(ordnerTreffer(TREE, '  ', KATALOG)).toBeNull();
  });

  it('trifft die Kooperation selbst, zeigt sie alle Videos, sonst nur die treffenden', () => {
    expect([...ordnerTreffer(TREE, 'lisa', KATALOG)]).toEqual([['k1', null]]);
    const treffer = ordnerTreffer(TREE, 'unboxing', KATALOG);
    expect([...treffer.keys()]).toEqual(['k1']);
    expect([...treffer.get('k1')]).toEqual(['v2']);
  });

  it('findet ein Video über Dateinamen und Tags seiner Dateien, kombiniert mit dem Creator', () => {
    expect([...ordnerTreffer(TREE, 'persona', KATALOG).get('k2')]).toEqual(['v3']);
    expect([...ordnerTreffer(TREE, 'jan hook', KATALOG).get('k2')]).toEqual(['v3']);
    expect(ordnerTreffer(TREE, 'lisa hook', KATALOG).size).toBe(0);
  });
});
