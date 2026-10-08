// VideoideeProProdukt.test.js
// Videoideen pro Produkt: Quoten, Laeufe, Prompt je Produkt, produkt_id am Insert.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  normalisiereQuoten,
  planeLaeufe,
  entwerfeLaeufe,
  leereLaeufeFehler,
  buildPrompt,
  buildVorschlagInsert
} = require('../../netlify/functions/_shared/strategie-idee.js');
const { _internals } = require('../../netlify/functions/konzept-chat-background.js');
const { fuehrePlanAus } = _internals;

const SERUM = { id: 'p1', name: 'Serum', usp: 'Schnell einziehend' };
const CLEANSER = { id: 'p2', name: 'Cleanser', usp: 'Mild' };
const MASKE = { id: 'p3', name: 'Maske' };

const idee = (titel) => ({
  titel,
  pain_point: 'p',
  hook: 'h',
  kernbotschaft: 'k',
  ablauf: 'a'
});

describe('normalisiereQuoten', () => {
  it('liefert null ohne proProdukt', () => {
    expect(normalisiereQuoten({ anzahl: 3 }, [SERUM])).toBeNull();
    expect(normalisiereQuoten(null, [SERUM])).toBeNull();
  });

  it('nimmt nur Produkte des Briefings und Zahlen ab 1', () => {
    const quoten = normalisiereQuoten({
      proProdukt: [
        { produkt_id: 'p1', anzahl: 3 },
        { produkt_id: 'fremd', anzahl: 4 },
        { produkt_id: 'p2', anzahl: 0 },
        { produkt_id: 'p3', anzahl: 1.5 }
      ]
    }, [SERUM, CLEANSER, MASKE]);
    expect(quoten).toEqual([{ produkt: SERUM, anzahl: 3 }]);
  });

  it('addiert doppelte IDs und kuerzt die Summe auf 12 (frueher Eintrag zuerst)', () => {
    const quoten = normalisiereQuoten({
      proProdukt: [
        { produkt_id: 'p1', anzahl: 5 },
        { produkt_id: 'p2', anzahl: 6 },
        { produkt_id: 'p1', anzahl: 2 },
        { produkt_id: 'p3', anzahl: 4 }
      ]
    }, [SERUM, CLEANSER, MASKE]);
    expect(quoten).toEqual([
      { produkt: SERUM, anzahl: 7 },
      { produkt: CLEANSER, anzahl: 5 }
    ]);
  });
});

describe('planeLaeufe', () => {
  it('ein Produkt: ein Lauf an diesem Produkt mit der Gesamtzahl', () => {
    expect(planeLaeufe({ input: { anzahl: 4 }, produkte: [SERUM] }))
      .toEqual([{ produkt: SERUM, anzahl: 4 }]);
  });

  it('kein Produkt: ein Lauf ohne Produkt, Default 5', () => {
    expect(planeLaeufe({ input: {}, produkte: [] })).toEqual([{ produkt: null, anzahl: 5 }]);
  });

  it('mehrere Produkte mit Quote: ein Lauf pro Quote', () => {
    const laeufe = planeLaeufe({
      input: { proProdukt: [{ produkt_id: 'p1', anzahl: 3 }, { produkt_id: 'p2', anzahl: 2 }] },
      produkte: [SERUM, CLEANSER]
    });
    expect(laeufe).toEqual([
      { produkt: SERUM, anzahl: 3 },
      { produkt: CLEANSER, anzahl: 2 }
    ]);
  });

  it('mehrere Produkte ohne Quote: Fehler, es wird nicht gemischt', () => {
    expect(() => planeLaeufe({ input: { anzahl: 5 }, produkte: [SERUM, CLEANSER] }))
      .toThrow(/mehrere Produkte/);
  });

  it('Quote ohne gueltiges Produkt: Fehler', () => {
    expect(() => planeLaeufe({
      input: { proProdukt: [{ produkt_id: 'fremd', anzahl: 3 }] },
      produkte: [SERUM, CLEANSER]
    })).toThrow(/Produkt-Zuordnung/);
  });
});

describe('buildPrompt je Produkt', () => {
  it('produktFix: nur dieses Produkt, keine Mischzeile', () => {
    const { stable, task } = buildPrompt({
      briefing: {},
      produkte: [SERUM],
      personas: [],
      ausschluss: [],
      anzahl: 3,
      produktFix: true
    });
    expect(stable).toContain('Genau 3 Ideen, alle fuer das eine genannte Produkt');
    expect(stable).not.toContain('quer ueber die Produkte');
    expect(task).toContain('Serum');
    expect(task).not.toContain('Cleanser');
  });

  it('ohne produktFix bleibt die Mischzeile', () => {
    const { stable } = buildPrompt({ briefing: {}, produkte: [SERUM, CLEANSER], personas: [], ausschluss: [], anzahl: 4 });
    expect(stable).toContain('quer ueber die Produkte (nicht 4 pro Produkt)');
  });
});

describe('buildVorschlagInsert', () => {
  it('schreibt produkt_id, wenn eins gesetzt ist', () => {
    const row = buildVorschlagInsert({
      strategieId: 's1',
      idee: { beschreibung: 'Titel' },
      sortierung: 0,
      createdBy: null,
      produktId: 'p1'
    });
    expect(row.produkt_id).toBe('p1');
    expect(row.ist_vorschlag).toBe(true);
  });

  it('laesst produkt_id ohne Produkt weg', () => {
    const row = buildVorschlagInsert({ strategieId: 's1', idee: { beschreibung: 'T' }, sortierung: 0, createdBy: null });
    expect('produkt_id' in row).toBe(false);
  });
});

describe('entwerfeLaeufe', () => {
  const input = {
    briefing: {},
    produkte: [SERUM, CLEANSER],
    personas: [],
    ausschluss: ['Alt']
  };

  it('ein Lauf pro Produkt: Prompt sieht nur dieses Produkt, Ideen tragen das Produkt', async () => {
    const prompts = [];
    const rufe = vi.fn(async ({ task, stable, lauf }) => {
      prompts.push({ task, stable, lauf });
      const prefix = lauf.produkt.name;
      return {
        json: { ideen: Array.from({ length: lauf.anzahl }, (_, i) => idee(`${prefix} ${i}`)) },
        model: 'm',
        usage: { input_tokens: 10, output_tokens: 5 }
      };
    });
    const zustand = {};

    const res = await entwerfeLaeufe({
      input,
      laeufe: [{ produkt: SERUM, anzahl: 2 }, { produkt: CLEANSER, anzahl: 1 }],
      rufe,
      zustand
    });

    expect(rufe).toHaveBeenCalledTimes(2);
    expect(prompts[0].task).toContain('Name: Serum');
    expect(prompts[0].task).not.toContain('Name: Cleanser');
    expect(prompts[1].task).toContain('Name: Cleanser');
    expect(prompts[1].task).not.toContain('Name: Serum');
    // Zweiter Lauf kennt die Ideen des ersten als Ausschluss
    expect(prompts[1].task).toContain('Serum 0');

    expect(res.ergebnisse.map((e) => [e.produkt.id, e.ideen.length])).toEqual([['p1', 2], ['p2', 1]]);
    expect(zustand.usage).toEqual({ input_tokens: 20, output_tokens: 10 });
  });

  it('ein Produkt ohne brauchbare Idee wird uebersprungen', async () => {
    const rufe = vi.fn(async ({ lauf }) => (lauf.produkt.id === 'p1'
      ? { json: { ideen: [] }, model: 'm', usage: null }
      : { json: { ideen: [idee('Cleanser A')] }, model: 'm', usage: null }));
    const onDiagnose = vi.fn();

    const res = await entwerfeLaeufe({
      input,
      laeufe: [{ produkt: SERUM, anzahl: 2 }, { produkt: CLEANSER, anzahl: 1 }],
      rufe,
      onDiagnose
    });

    // Serum: zwei Versuche, Cleanser: einer
    expect(rufe).toHaveBeenCalledTimes(3);
    expect(onDiagnose).toHaveBeenCalled();
    expect(res.ergebnisse.map((e) => e.produkt.id)).toEqual(['p2']);
  });

  it('alle Laeufe leer: leereLaeufeFehler wie bisher', async () => {
    const rufe = vi.fn(async () => ({ json: { ideen: [] }, model: 'm', usage: null }));
    const res = await entwerfeLaeufe({
      input,
      laeufe: [{ produkt: SERUM, anzahl: 2 }],
      rufe
    });
    expect(res.ergebnisse).toEqual([]);
    expect(leereLaeufeFehler(res).message).toContain('keine tragfähigen Videoideen');

    const ohneJson = await entwerfeLaeufe({
      input,
      laeufe: [{ produkt: SERUM, anzahl: 2 }],
      rufe: async () => ({ json: null, model: 'm', usage: null })
    });
    expect(leereLaeufeFehler(ohneJson).message).toBe('Die KI hat kein strukturiertes Ergebnis geliefert');
  });

  it('ein Lauf ohne Produkt nutzt die Produktliste des Briefings', async () => {
    const rufe = vi.fn(async ({ task }) => {
      expect(task).toContain('Serum');
      expect(task).toContain('Cleanser');
      return { json: { ideen: [idee('Eine')] }, model: 'm', usage: null };
    });
    const res = await entwerfeLaeufe({ input, laeufe: [{ produkt: null, anzahl: 1 }], rufe });
    expect(res.ergebnisse[0].produkt).toBeNull();
  });
});

describe('Konzept-Chat mit mehreren Produkten', () => {
  function makeSupabase({ produkte }) {
    const calls = { insert: [] };
    const newChain = (table) => {
      const chain = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.single = vi.fn(async () => ({
        data: { id: 's1', briefing_id: 'b1', marke_id: null, unternehmen_id: null },
        error: null
      }));
      chain.maybeSingle = vi.fn(async () => ({ data: { id: 'b1' }, error: null }));
      chain.insert = vi.fn((rows) => {
        calls.insert.push(rows);
        return { select: vi.fn(async () => ({ data: rows.map((_, i) => ({ id: `neu-${i}` })), error: null })) };
      });
      chain.delete = vi.fn(() => chain);
      if (table === 'campaign_briefing_produkt') {
        chain.then = (resolve) => resolve({ data: produkte.map((p) => ({ produkt_id: p.id })), error: null });
      }
      if (table === 'produkt') {
        chain.then = (resolve) => resolve({ data: produkte, error: null });
      }
      if (table === 'ki_requests') {
        chain.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'ki1' }, error: null })) })) }));
      }
      return chain;
    };
    return { supabase: { from: vi.fn((table) => newChain(table)) }, calls };
  }

  const CTX = (over = {}) => ({
    vorschlaege: [
      { id: 'a', beschreibung: 'Erste', produkt_id: 'p1' },
      { id: 'b', beschreibung: 'Zweite', produkt_id: 'p2' },
      { id: 'c', beschreibung: 'Dritte', produkt_id: 'p2' }
    ],
    gueltigeIds: new Set(['a', 'b', 'c']),
    strategieId: 's1',
    nachricht: 'noch welche',
    benutzerId: null,
    userId: 'u1',
    schreibeStep: vi.fn(),
    entwerfen: vi.fn(async () => ({ json: { ideen: [idee('Frisch 1'), idee('Frisch 2')] }, model: 'm', usage: null })),
    ...over
  });

  it('neu mit Zahl, aber mehreren Produkten: fragt die Karte, kein Lauf', async () => {
    const { supabase, calls } = makeSupabase({ produkte: [SERUM, CLEANSER] });
    const ctx = CTX();
    const erg = await fuehrePlanAus(supabase, { aktionen: [{ typ: 'neu', anzahl: 3 }] }, ctx);
    expect(erg.brauchtAnzahl).toBe(true);
    expect(ctx.entwerfen).not.toHaveBeenCalled();
    expect(calls.insert).toEqual([]);
  });

  it('ersetzen: Quote aus den Produkten der ersetzten Ideen, Insert traegt produkt_id', async () => {
    const { supabase, calls } = makeSupabase({ produkte: [SERUM, CLEANSER] });
    const entwerfen = vi.fn(async () => ({
      json: { ideen: [idee('X'), idee('Y')] },
      model: 'm',
      usage: null
    }));
    entwerfen
      .mockResolvedValueOnce({ json: { ideen: [idee('Serum neu')] }, model: 'm', usage: null })
      .mockResolvedValueOnce({ json: { ideen: [idee('Cleanser neu 1'), idee('Cleanser neu 2')] }, model: 'm', usage: null });

    const erg = await fuehrePlanAus(supabase, {
      aktionen: [{ typ: 'ersetzen', vorschlag_ids: ['a', 'b', 'c'] }]
    }, CTX({ entwerfen }));

    expect(entwerfen).toHaveBeenCalledTimes(2);
    expect(erg.brauchtAnzahl).toBe(false);
    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0].map((r) => r.produkt_id)).toEqual(['p1', 'p2', 'p2']);
    expect(erg.ersetzt.alt).toEqual(['a', 'b', 'c']);
  });

  it('ersetzen einer Idee ohne Produkt: fragt die Karte', async () => {
    const { supabase } = makeSupabase({ produkte: [SERUM, CLEANSER] });
    const ctx = CTX({
      vorschlaege: [{ id: 'a', beschreibung: 'Erste', produkt_id: null }]
    });
    const erg = await fuehrePlanAus(supabase, {
      aktionen: [{ typ: 'ersetzen', vorschlag_ids: ['a'] }]
    }, ctx);
    expect(erg.brauchtAnzahl).toBe(true);
    expect(ctx.entwerfen).not.toHaveBeenCalled();
  });
});
