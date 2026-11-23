import { describe, it, expect, beforeEach } from 'vitest';
import {
  festlegungenFuerKopie, kopieZeile, KOPIE_FELDER
} from '../modules/skripte/service/skripteKopieDaten.js';
import { skripteService } from '../modules/skripte/SkripteService.js';
import { geteiltHinweisHtml, videosFuerKopie } from '../modules/skripte/SkriptKooperationDrawer.js';
import { docHeadActionsHtml } from '../modules/skripte/editor/skriptDocKopfHtml.js';
import { skriptCreatorZelleHtml } from '../modules/skripte/editor/skriptDocCreatorHtml.js';

const AM = '2026-11-18T12:00:00.000Z';

const quelle = {
  id: 'orig',
  titel: 'Morgenroutine',
  kampagne_id: 'k1',
  strategie_item_id: 'idee-1',
  hook: 'Hook',
  hook_variante_1: 'Variante',
  dokument_bloecke: [{ id: 'skript-tabelle', typ: 'skript_tabelle' }],
  prompt_kontext: { modus: 'ugc' },
  festgezogen: ['hook'],
  festlegungen: [
    { text: 'Kein Tarif nennen', quelle: 'anweisung' },
    { text: 'Besetzung: Lea (vorher Mia)', quelle: 'creator_tausch' },
    { text: 'Besetzung: Papa mit zwei Kindern', quelle: 'anweisung' }
  ]
};

/** Supabase-Fake: Antwort je Tabelle und Operation, alle Aufrufe werden mitgeschrieben. */
function fakeDb({ zeile = quelle, versionError = null, linkError = null } = {}) {
  const calls = [];
  const from = (tabelle) => {
    const q = { tabelle, ops: [] };
    calls.push(q);
    const antwort = () => {
      const ops = q.ops.map(([op]) => op);
      if (tabelle === 'skripte' && ops.includes('insert')) return { data: { id: 'kopie-1' }, error: null };
      if (tabelle === 'skripte' && ops.includes('delete')) return { data: null, error: null };
      if (tabelle === 'skripte') return { data: zeile, error: null };
      if (tabelle === 'skript_versionen') return { data: null, error: versionError };
      if (tabelle === 'kooperation_videos') return { data: null, error: linkError };
      return { data: null, error: null };
    };
    const proxy = new Proxy({}, {
      get(_, op) {
        if (op === 'then') return (res, rej) => Promise.resolve(antwort()).then(res, rej);
        return (...args) => { q.ops.push([op, ...args]); return proxy; };
      }
    });
    return proxy;
  };
  return { calls, from, auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } };
}

const op = (call, name) => call.ops.find(([o]) => o === name)?.[1];
const hat = (call, name) => call.ops.some(([o]) => o === name);

describe('festlegungenFuerKopie', () => {
  it('lässt die Besetzung des Originals weg und setzt die des neuen Creators', () => {
    expect(festlegungenFuerKopie(quelle.festlegungen, 'Tom', AM)).toEqual([
      { text: 'Kein Tarif nennen', quelle: 'anweisung' },
      { text: 'Besetzung: Tom', quelle: 'skript_kopie', am: AM }
    ]);
  });

  it('setzt ohne Namen keine Besetzung', () => {
    expect(festlegungenFuerKopie(null, '  ', AM)).toEqual([]);
  });
});

describe('kopieZeile', () => {
  it('übernimmt Text, Blöcke und Videoidee, startet aber als Entwurf mit Version 1', () => {
    const zeile = kopieZeile(quelle, { creatorName: 'Tom', userId: 'u1', am: AM });
    expect(zeile).toMatchObject({
      titel: 'Morgenroutine – Tom',
      kampagne_id: 'k1',
      strategie_item_id: 'idee-1',
      hook: 'Hook',
      hook_variante_1: 'Variante',
      dokument_bloecke: quelle.dokument_bloecke,
      dokument_bloecke_rev: 1,
      festgezogen: ['hook'],
      status: 'entwurf',
      aktive_version_nr: 1,
      aktive_sub_nr: 0,
      created_by: 'u1',
      prompt_kontext: { modus: 'ugc', kopie_von: 'orig' }
    });
    expect(zeile.id).toBeUndefined();
    expect(zeile.creator_tausch).toBeUndefined();
  });

  it('kopiert nur die freigegebenen Spalten', () => {
    expect(KOPIE_FELDER).not.toContain('status');
    expect(KOPIE_FELDER).not.toContain('creator_tausch');
    expect(KOPIE_FELDER).not.toContain('pruefung');
  });
});

describe('kopiereSkriptFuerVideo', () => {
  beforeEach(() => { delete window.supabase; });

  it('legt Kopie und Version an und verknüpft das Video ohne Freigabe', async () => {
    window.supabase = fakeDb();
    const id = await skripteService.kopiereSkriptFuerVideo('orig', { videoId: 'v9', creatorName: 'Tom' });
    expect(id).toBe('kopie-1');

    const calls = window.supabase.calls;
    const insert = calls.find((c) => c.tabelle === 'skripte' && hat(c, 'insert'));
    expect(op(insert, 'insert')).toMatchObject({ titel: 'Morgenroutine – Tom', status: 'entwurf' });
    const version = calls.find((c) => c.tabelle === 'skript_versionen');
    expect(op(version, 'insert')).toEqual([
      expect.objectContaining({ skript_id: 'kopie-1', version_nr: 1, sub_nr: 0, hook: 'Hook' })
    ]);
    const link = calls.find((c) => c.tabelle === 'kooperation_videos');
    expect(op(link, 'update')).toEqual({ skript_id: 'kopie-1', skript_freigegeben: false });
    expect(op(link, 'eq')).toBe('id');
    expect(calls.some((c) => hat(c, 'delete'))).toBe(false);
  });

  it('löscht die Kopie wieder, wenn das Verknüpfen scheitert', async () => {
    window.supabase = fakeDb({ linkError: { message: 'kein Recht' } });
    await expect(skripteService.kopiereSkriptFuerVideo('orig', { videoId: 'v9' })).rejects.toThrow('kein Recht');
    const loeschen = window.supabase.calls.find((c) => hat(c, 'delete'));
    expect(loeschen.tabelle).toBe('skripte');
    expect(loeschen.ops).toContainEqual(['eq', 'id', 'kopie-1']);
  });

  it('kopiert kein Skript, das noch aus der Datei gelesen wird', async () => {
    window.supabase = fakeDb({ zeile: { ...quelle, prompt_kontext: { upload_status: 'lesen' } } });
    await expect(skripteService.kopiereSkriptFuerVideo('orig', { videoId: 'v9' })).rejects.toThrow('gelesen');
    expect(window.supabase.calls.some((c) => hat(c, 'insert'))).toBe(false);
  });
});

describe('Kopier-Dialog', () => {
  const kooperationen = [
    { id: 'koop-a', creator: { id: 'c-anna' } },
    { id: 'koop-b', creator: { id: 'c-ben' } }
  ];
  const videos = [
    { id: 'v1', kooperation_id: 'koop-a' },
    { id: 'v2', kooperation_id: 'koop-a' },
    { id: 'v3', kooperation_id: 'koop-b' }
  ];
  const verknuepfungen = [{ id: 'v1', kooperation: { creator: { id: 'c-anna', vorname: 'Anna', nachname: 'A' } } }];

  it('bietet nur Videos von Creatorn an, die das Skript noch nicht haben', () => {
    expect(videosFuerKopie(videos, kooperationen, verknuepfungen).map((v) => v.id)).toEqual(['v3']);
  });

  it('weist beim Zuweisen auf den geteilten Text hin, sobald ein Creator verknüpft ist', () => {
    expect(geteiltHinweisHtml([])).toBe('');
    const html = geteiltHinweisHtml(verknuepfungen);
    expect(html).toContain('Anna A');
    expect(html).toContain('denselben Text');
  });
});

describe('Doc-Kopf und Tabellen', () => {
  it('zeigt „Für weiteren Creator kopieren“ nur mit Recht', () => {
    expect(docHeadActionsHtml({ kannKopieren: true })).toContain('id="ed-kopieren"');
    expect(docHeadActionsHtml({ kannKopieren: false })).not.toContain('id="ed-kopieren"');
  });

  it('nimmt in der Creator-Zelle die Video-Creator vor der Videoidee', () => {
    const einzel = (c) => (c?.vorname ? `<img>${c.vorname}` : '');
    const idee = { casting_eintrag: { creator: { id: 'c-haupt', vorname: 'Haupt' } } };
    const kopie = {
      strategie_item: idee,
      kooperation_videos: [{ kooperation: { creator: { id: 'c-zweit', vorname: 'Zweit' } } }]
    };
    expect(skriptCreatorZelleHtml(kopie, einzel)).toBe('<td class="col-name"><img>Zweit</td>');
    expect(skriptCreatorZelleHtml({ strategie_item: idee }, einzel))
      .toBe('<td class="col-name"><img>Haupt</td>');
    expect(skriptCreatorZelleHtml({}, einzel)).toBe('<td>-</td>');

    const geteilt = {
      strategie_item: idee,
      kooperation_videos: [
        { kooperation: { creator: { id: 'c-haupt', vorname: 'Haupt' } } },
        { kooperation: { creator: { id: 'c-zweit', vorname: 'Zweit' } } }
      ]
    };
    expect(skriptCreatorZelleHtml(geteilt, einzel)).toBe('<td class="col-name">'
      + '<div class="table-creator-zeile"><img>Haupt</div>'
      + '<div class="table-creator-zeile"><img>Zweit</div></td>');
  });
});
