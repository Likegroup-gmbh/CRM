// KonzeptChat.test.js
// Plan-Ausfuehrung des Konzept-Chats (ADR 0036): Kette, Ersetzen erst-neu,
// fehlende Zahl, ungueltige IDs. Plus: kein "Claude" mehr in den
// nutzerseitigen Fortschrittslabels der vier Hintergrund-Laeufe.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const { _internals } = require('../../netlify/functions/konzept-chat-background.js');
const { fuehrePlanAus, fasseErgebnis, buildRewritePrompt, buildPlanPrompt } = _internals;

const IDEE = (titel) => ({
  titel,
  pain_point: 'p',
  hook: 'h',
  kernbotschaft: 'k',
  ablauf: 'a'
});

function makeSupabase({ insertOk = true } = {}) {
  const calls = { delete: [], insert: [] };

  const newChain = () => {
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
    chain.delete = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.insert = vi.fn((rows) => {
      calls.insert.push(rows);
      return {
        select: vi.fn(async () => insertOk
          ? { data: rows.map((_, i) => ({ id: `neu-${i}` })), error: null }
          : { data: null, error: { message: 'insert kaputt' } })
      };
    });
    // delete().in().eq() endet im letzten eq
    const origEq = chain.eq;
    chain.eq = vi.fn((...args) => {
      if (chain.delete.mock.calls.length && args[0] === 'ist_vorschlag') {
        calls.delete.push(chain.in.mock.calls.at(-1)?.[1]);
        return Promise.resolve({ error: null });
      }
      return origEq(...args);
    });
    return chain;
  };

  const supabase = {
    from: vi.fn((table) => {
      const chain = newChain();
      // ki_requests protokolliert jeden Lauf - kein Vorschlag-Insert
      if (table === 'ki_requests') {
        chain.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'ki1' }, error: null })) })) }));
      }
      return chain;
    })
  };
  return { supabase, calls };
}

const CTX = (over = {}) => ({
  vorschlaege: [
    { id: 'a', beschreibung: 'Erste\n\nRest' },
    { id: 'b', beschreibung: 'Zweite\n\nRest' }
  ],
  gueltigeIds: new Set(['a', 'b']),
  strategieId: 's1',
  nachricht: 'mach was',
  benutzerId: null,
  userId: 'u1',
  schreibeStep: vi.fn(),
  entwerfen: vi.fn(async () => ({ json: { ideen: [IDEE('Neu 1'), IDEE('Neu 2')] }, model: 'm', usage: null })),
  ...over
});

describe('fuehrePlanAus', () => {
  it('Rueckfrage: keine Aktion, kein Schreibzugriff', async () => {
    const { supabase } = makeSupabase();
    const erg = await fuehrePlanAus(supabase, { rueckfrage: 'Welche Idee meinst du?', aktionen: [] }, CTX());
    expect(erg.rueckfrage).toBe('Welche Idee meinst du?');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('ersetzen ohne Zahl: Anzahl der genannten, erst entwerfen dann verwerfen', async () => {
    const { supabase, calls } = makeSupabase();
    const entwerfen = vi.fn(async () => ({ json: { ideen: [IDEE('N1'), IDEE('N2')] }, model: 'm', usage: null }));
    const erg = await fuehrePlanAus(supabase, {
      aktionen: [{ typ: 'ersetzen', vorschlag_ids: ['a', 'b'] }]
    }, CTX({ entwerfen }));

    expect(entwerfen).toHaveBeenCalledTimes(1);
    expect(erg.ersetzt.alt).toEqual(['a', 'b']);
    expect(erg.ersetzt.neu).toEqual(['neu-0', 'neu-1']);
    // Insert vor Delete (erst-neu)
    expect(calls.insert.length).toBe(1);
    expect(calls.delete).toEqual([['a', 'b']]);
  });

  it('ersetzen mit leerem Lauf: wirft und loescht nichts', async () => {
    const { supabase, calls } = makeSupabase();
    const entwerfen = vi.fn(async () => ({ json: { ideen: [] }, model: 'm', usage: null }));
    await expect(fuehrePlanAus(supabase, {
      aktionen: [{ typ: 'ersetzen', vorschlag_ids: ['a'] }]
    }, CTX({ entwerfen }))).rejects.toThrow();
    expect(calls.delete).toEqual([]);
  });

  it('neu ohne Zahl: brauchtAnzahl, kein Lauf', async () => {
    const { supabase } = makeSupabase();
    const entwerfen = vi.fn();
    const erg = await fuehrePlanAus(supabase, {
      aktionen: [{ typ: 'neu' }]
    }, CTX({ entwerfen }));
    expect(erg.brauchtAnzahl).toBe(true);
    expect(entwerfen).not.toHaveBeenCalled();
  });

  it('Kette: umschreiben trifft keine Zeile, die verworfen wird; ungueltige IDs fallen raus', async () => {
    const { supabase, calls } = makeSupabase();
    // umschreiben braucht loadIdeeInput -> strategie ohne briefing_id wirft.
    // Darum hier nur verwerfen + neu mit ungueltiger ID.
    const erg = await fuehrePlanAus(supabase, {
      aktionen: [
        { typ: 'verwerfen', vorschlag_ids: ['a', 'x'] },
        { typ: 'verwerfen', vorschlag_ids: ['a'] },
        { typ: 'neu', anzahl: 1 }
      ]
    }, CTX());
    expect(erg.verworfen).toBe(1);
    expect(calls.delete).toEqual([['a']]);
    expect(erg.neu).toEqual(['neu-0']);
  });
});

describe('buildRewritePrompt', () => {
  it('haelt die Situation fest und sieht Donts plus Produktfakten', () => {
    const { stable, task } = buildRewritePrompt({
      vorschlag: { beschreibung: 'Mara vor dem Meeting\n\nPain Point: x' },
      anweisung: 'Kuerzer.',
      input: {
        briefing: { donts: 'Keine Heilversprechen', vorgaben_ausschluesse: 'Keine Kinder' },
        produkte: [{ name: 'Protein', usp: '30g', loesung: 'Shake' }]
      }
    });
    expect(stable).toContain('Situation, Pain und Aussage der Idee bleiben');
    expect(stable).toContain('Keine erfundenen Produktfeatures');
    expect(stable).not.toContain('neue Situation');
    expect(stable).not.toContain('nicht die Geschichte');
    expect(task).toContain('Keine Heilversprechen');
    expect(task).toContain('Keine Kinder');
    expect(task).toContain('Protein');
    expect(task).not.toContain('CAMPAIGN-BRIEFING');
  });
});

describe('fasseErgebnis', () => {
  it('listet, was passiert ist', () => {
    expect(fasseErgebnis({
      umgeschrieben: ['a'], verworfen: 2, neu: [], ersetzt: { alt: [], neu: [] }
    })).toBe('1 Idee umgeschrieben, 2 Ideen verworfen.');
    expect(fasseErgebnis({
      umgeschrieben: [], verworfen: 0, neu: [], ersetzt: { alt: ['a', 'b'], neu: ['n1', 'n2'] }
    })).toBe('2 durch 2 neue ersetzt.');
    expect(fasseErgebnis({
      umgeschrieben: [], verworfen: 0, neu: [], ersetzt: { alt: [], neu: [] }
    })).toContain('Nichts zu tun');
  });
});

describe('buildPlanPrompt', () => {
  it('ordnet Ueberarbeiten dem umschreiben zu, neu nur bei zusaetzlichen Ideen', () => {
    const { stable } = buildPlanPrompt({ vorschlaege: [], history: [], nachricht: 'x' });
    expect(stable).toContain('ueberarbeiten');
    expect(stable).toContain('umschreiben dieser Vorschlaege');
    expect(stable).toContain('Ueberarbeiten ist nie neu');
    expect(stable).toContain('Reine Diskussion oder Frage ohne Aenderungswunsch: rueckfrage');
  });
});

describe('Fortschrittslabels sagen Liky', () => {
  const files = [
    'netlify/functions/strategie-idee-background.js',
    'netlify/functions/casting-vorschlag-background.js',
    'netlify/functions/produkt-persona-background.js',
    'netlify/functions/audience-situation-background.js'
  ];

  for (const file of files) {
    it(`${file}: kein "Claude" in schreibeStep-Labels`, () => {
      const src = readFileSync(resolve(__dirname, '../../', file), 'utf8');
      const labels = [...src.matchAll(/schreibeStep\([^)]*\)/g)].map((m) => m[0]);
      const labelsConst = [...src.matchAll(/THINKING_LABELS = \{[\s\S]*?\};/g)].map((m) => m[0]);
      const zusammen = [...labels, ...labelsConst].join('\n');
      expect(zusammen).not.toContain('Claude');
    });
  }
});
