// produktionFlowZiele.test.js
// Welche Adressen im Produktionsflow bleiben (ADR 0079): Flow-Adresse, Erkennen der
// Entity hinter einer Route, Wahl der Linie aus den geladenen Linien oder per Abfrage.

import { describe, it, expect, vi } from 'vitest';
import {
  erkenneZiel, flowUrl, hatAbfrage, linieAbfragen, linieSync, OHNE_LINIE
} from '../modules/kampagne/produktionFlowZiele.js';

function produktion(overrides = {}) {
  return {
    produktionId: 'p1',
    linieId: 'b1',
    linien: [
      { id: 'b1', briefing: { produkte: [{ produkt: { id: 'x1' } }], persona_ids: ['y1'] } },
      { id: 'b2', briefing: { produkte: [{ produkt: { id: 'x1' } }, { produkt: { id: 'x2' } }], persona_ids: ['y2'] } }
    ],
    ...overrides
  };
}

// Kette wie supabase-js: jede Methode gibt die Kette zurück, await liefert result
function fakeDb(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return { from: vi.fn(() => chain), chain };
}

describe('Flow-Adresse', () => {
  it('trägt Tab, Linie und den Parameter des Tabs', () => {
    expect(flowUrl({ produktionId: 'p1', tab: 'skripte', linieId: 'b1', id: 's1' }))
      .toBe('/produktion/p1?tab=skripte&linie=b1&skript=s1');
    expect(flowUrl({ produktionId: 'p1', tab: 'produkte', linieId: 'b2', id: 'x2' }))
      .toBe('/produktion/p1?tab=produkte&linie=b2&produkt=x2');
    expect(flowUrl({ produktionId: 'p1', tab: 'casting', id: 'c1' })).toBe('/produktion/p1?tab=casting&casting=c1');
  });

  it('lässt die id weg, wo der Tab keinen Parameter hat', () => {
    expect(flowUrl({ produktionId: 'p1', tab: 'briefing', linieId: 'b2', id: 'b2' }))
      .toBe('/produktion/p1?tab=briefing&linie=b2');
  });

  it('hängt das Sprungziel im Tab an', () => {
    expect(flowUrl({ produktionId: 'p1', tab: 'konzepte', linieId: 'b1', id: 'k1', fokus: 'i1' }))
      .toBe('/produktion/p1?tab=konzepte&linie=b1&konzept=k1&fokus=i1');
    expect(flowUrl({ produktionId: 'p1', tab: 'kooperationen', linieId: 'alle', fokus: 'ko1' }))
      .toBe('/produktion/p1?tab=kooperationen&linie=alle&fokus=ko1');
  });
});

describe('Entity hinter einer Route', () => {
  it('erkennt Einzelseiten und Besitzer-Seiten', () => {
    expect(erkenneZiel('/briefing/b2')).toEqual({ kind: 'briefing', tab: 'briefing', id: 'b2', hinweis: null, fokus: null });
    expect(erkenneZiel('/produkt/x1?briefing=b2')).toEqual({ kind: 'produkt', tab: 'produkte', id: 'x1', hinweis: 'b2', fokus: null });
    expect(erkenneZiel('/konzepte/k1?fokus=i1')).toMatchObject({ kind: 'konzept', id: 'k1', fokus: 'i1' });
    expect(erkenneZiel('/marke/m1/produkt?produkt=x1')?.id).toBe('x1');
    expect(erkenneZiel('/unternehmen/u1/persona?persona=y1')).toMatchObject({ kind: 'persona', tab: 'personas', id: 'y1' });
    expect(erkenneZiel('/skripte/s1')).toMatchObject({ kind: 'skript', tab: 'skripte' });
    expect(erkenneZiel('/konzepte/k1')).toMatchObject({ kind: 'konzept', tab: 'konzepte' });
    expect(erkenneZiel('/castings/c1')).toMatchObject({ kind: 'casting', tab: 'casting' });
  });

  it('lässt Anlegen, Bearbeiten und Fremdes beim Router', () => {
    expect(erkenneZiel('/produkt/new')).toBeNull();
    expect(erkenneZiel('/persona/neu')).toBeNull();
    expect(erkenneZiel('/briefing/b1/edit')).toBeNull();
    expect(erkenneZiel('/unternehmen/u1/produkt')).toBeNull();
    expect(erkenneZiel('/kooperation/k1')).toBeNull();
    expect(erkenneZiel('/creator/c1')).toBeNull();
  });
});

describe('Linie aus den geladenen Linien', () => {
  it('nimmt den Hinweis, dann die aktive Linie, dann die erste', () => {
    const detail = produktion();
    expect(linieSync(detail, erkenneZiel('/produkt/x1?briefing=b2'))).toBe('b2');
    expect(linieSync(detail, erkenneZiel('/produkt/x1'))).toBe('b1');
    expect(linieSync(produktion({ linieId: 'b9' }), erkenneZiel('/produkt/x1'))).toBe('b1');
    expect(linieSync(detail, erkenneZiel('/produkt/x2'))).toBe('b2');
    expect(linieSync(detail, erkenneZiel('/persona/y2'))).toBe('b2');
    expect(linieSync(detail, erkenneZiel('/briefing/b2'))).toBe('b2');
  });

  it('kennt fremde Datensätze nicht', () => {
    const detail = produktion();
    expect(linieSync(detail, erkenneZiel('/produkt/x9'))).toBeNull();
    expect(linieSync(detail, erkenneZiel('/briefing/b9'))).toBeNull();
    expect(linieSync(detail, erkenneZiel('/skripte/s1'))).toBeNull();
  });
});

describe('Linie per Abfrage', () => {
  it('liest briefing_id an Skript, Konzept und Casting-Liste', async () => {
    const { from, chain } = fakeDb({ data: { briefing_id: 'b2' }, error: null });
    const db = { from };
    expect(await linieAbfragen(produktion(), erkenneZiel('/skripte/s1'), db)).toBe('b2');
    expect(from).toHaveBeenCalledWith('skripte');
    expect(chain.eq).toHaveBeenCalledWith('id', 's1');
    expect(await linieAbfragen(produktion(), erkenneZiel('/konzepte/k1'), db)).toBe('b2');
    expect(from).toHaveBeenCalledWith('strategie');
    expect(await linieAbfragen(produktion(), erkenneZiel('/castings/c1'), db)).toBe('b2');
    expect(from).toHaveBeenCalledWith('creator_auswahl');
  });

  it('fragt Produkte über die Junction nur in den eigenen Linien', async () => {
    const { from, chain } = fakeDb({ data: [{ briefing_id: 'b2' }], error: null });
    expect(await linieAbfragen(produktion(), erkenneZiel('/produkt/x9'), { from })).toBe('b2');
    expect(from).toHaveBeenCalledWith('campaign_briefing_produkt');
    expect(chain.in).toHaveBeenCalledWith('briefing_id', ['b1', 'b2']);
  });

  it('gibt null für Linien anderer Produktionen und ohne Linie', async () => {
    const fremd = fakeDb({ data: { briefing_id: 'b7' }, error: null });
    expect(await linieAbfragen(produktion(), erkenneZiel('/skripte/s1'), fremd)).toBeNull();
    const ohne = fakeDb({ data: { briefing_id: null }, error: null });
    expect(await linieAbfragen(produktion(), erkenneZiel('/skripte/s1'), ohne)).toBeNull();
    expect(await linieAbfragen(produktion({ linien: [] }), erkenneZiel('/skripte/s1'), ohne)).toBeNull();
  });

  it('ohne Linien zählt nur die Produktion', async () => {
    const ohneLinien = produktion({ linien: [], linieId: null });
    const eigen = fakeDb({ data: { briefing_id: null, produktion_id: 'p1' }, error: null });
    expect(await linieAbfragen(ohneLinien, erkenneZiel('/konzepte/k1'), eigen)).toBe(OHNE_LINIE);
    expect(eigen.chain.select).toHaveBeenCalledWith('briefing_id, produktion_id');
    const fremd = fakeDb({ data: { briefing_id: null, produktion_id: 'p7' }, error: null });
    expect(await linieAbfragen(ohneLinien, erkenneZiel('/skripte/s1'), fremd)).toBeNull();
    const produkt = fakeDb({ data: [], error: null });
    expect(await linieAbfragen(ohneLinien, erkenneZiel('/produkt/x1'), produkt)).toBeNull();
    expect(produkt.from).not.toHaveBeenCalled();
  });

  it('wirft Abfragefehler weiter', async () => {
    const db = fakeDb({ data: null, error: new Error('RLS') });
    await expect(linieAbfragen(produktion(), erkenneZiel('/skripte/s1'), db)).rejects.toThrow('RLS');
  });

  it('Briefings brauchen keine Abfrage', () => {
    expect(hatAbfrage(erkenneZiel('/briefing/b1'))).toBe(false);
    expect(hatAbfrage(erkenneZiel('/skripte/s1'))).toBe(true);
  });
});
