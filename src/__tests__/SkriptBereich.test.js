// Bereich am Skript: Auftrag, sonst Briefing der Linie (auch nachträglich am Konzept),
// sonst eindeutige Kampagnenart. Offen klären ihn die Rückfragen und er wird gespeichert.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  gueltigerBereich, bereichVomStub, setzeBereichAmSkript
} = require('../../netlify/functions/_shared/skript-bereich.js');
const { buildFragenPrompt } = require('../../netlify/functions/skript-fragen-background.js');

/** Minimaler Supabase-Mock: jede Kette endet in { data, error } je Tabelle. */
function supabaseMock(antworten = {}) {
  const updates = [];
  const from = vi.fn((tabelle) => {
    const ergebnis = antworten[tabelle] || { data: null, error: null };
    const kette = {
      select: () => kette,
      eq: () => kette,
      maybeSingle: () => Promise.resolve(ergebnis),
      update: (patch) => { updates.push({ tabelle, patch }); return kette; },
      then: (res, rej) => Promise.resolve({ error: null }).then(res, rej)
    };
    return kette;
  });
  return { from, updates };
}

describe('Bereich vom Stub und vom Konzept', () => {
  it('nur die drei Skript-Bereiche gelten', () => {
    expect(gueltigerBereich('owned_social')).toBe('owned_social');
    expect(gueltigerBereich('basis')).toBeNull();
    expect(gueltigerBereich(null)).toBeNull();
  });

  it('leerer Bereich kommt aus der Skript-Spalte', async () => {
    const sb = supabaseMock();
    const skript = { bereich: 'paid_creator_ads', briefing_id: 'b1' };
    expect(await bereichVomStub(sb, { bereich: null, briefing_id: null }, skript))
      .toEqual({ bereich: 'paid_creator_ads', briefing_id: 'b1' });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('fehlendes Briefing kommt vom aktuellen Konzept der Videoidee', async () => {
    const sb = supabaseMock({
      strategie_items: { data: { strategie: { briefing_id: 'b-konzept' } }, error: null }
    });
    const skript = { bereich: null, briefing_id: null, strategie_item_id: 'si1' };
    const out = await bereichVomStub(sb, { skript_id: 's1', briefing_id: null }, skript);
    expect(out.briefing_id).toBe('b-konzept');
  });

  it('lädt den Stub selbst, wenn nur die skript_id da ist', async () => {
    const sb = supabaseMock({ skripte: { data: { bereich: 'owned_social', briefing_id: 'b1' }, error: null } });
    expect(await bereichVomStub(sb, { skript_id: 's1' }))
      .toEqual({ skript_id: 's1', bereich: 'owned_social', briefing_id: 'b1' });
  });

  it('gesetzter Auftrag bleibt unverändert', async () => {
    const sb = supabaseMock();
    const params = { skript_id: 's1', bereich: 'owned_social', briefing_id: 'b1' };
    expect(await bereichVomStub(sb, params)).toBe(params);
    expect(sb.from).not.toHaveBeenCalled();
  });
});

describe('Rückfragen klären den Bereich', () => {
  it('offener Bereich: Prompt verlangt das Feld bereich', () => {
    const { task } = buildFragenPrompt({ master: [], bereich: null }, {}, []);
    expect(task).toContain('# BEREICH DIESES SKRIPTS: unbekannt');
    expect(task).toContain('setze bereich');
    expect(task).toContain('(Felder: nachricht, fertig, bereich)');
  });

  it('feststehender Bereich: kein Feld bereich', () => {
    const { task } = buildFragenPrompt({ master: [], bereich: 'owned_social' }, {}, []);
    expect(task).toContain('(Felder: nachricht, fertig)');
  });

  it('Antwort wird an Spalte und generator_payload geschrieben', async () => {
    const sb = supabaseMock();
    const skript = { id: 's1', bereich: null, prompt_kontext: { generator_payload: { video_idee: 'x', bereich: null } } };
    await setzeBereichAmSkript(sb, skript, 'owned_social');
    const { patch } = sb.updates.find((u) => u.tabelle === 'skripte');
    expect(patch.bereich).toBe('owned_social');
    expect(patch.prompt_kontext.generator_payload).toEqual({ video_idee: 'x', bereich: 'owned_social' });
    expect(skript.prompt_kontext.generator_payload.bereich).toBe('owned_social');
  });
});
