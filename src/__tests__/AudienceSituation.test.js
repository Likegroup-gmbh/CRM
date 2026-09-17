// Audience Situations: Gate, Validate, Prompt, Sync, Downstream-Labels (ADR 0016)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import { istKiBereit, quelleNachEdit } from '../modules/persona/audienceSituationGate.js';
import { PersonaService } from '../modules/persona/PersonaService.js';

const require = createRequire(import.meta.url);
const {
  istKiBereit: istKiBereitCjs,
  quelleNachEdit: quelleNachEditCjs,
  fmtAudienceSituations,
  validateSituationen,
  buildPrompt,
  attachAudienceSituations
} = require('../../netlify/functions/_shared/audience-situation.js');
const { buildKontextText } = require('../../netlify/functions/_shared/skript-context.js');
const { buildBedarf, buildPrompt: buildCastingPrompt } = require('../../netlify/functions/_shared/casting-match.js');
const { sanitizePersonaPayload } = require('../../netlify/functions/_shared/produkt-persona.js');

describe('istKiBereit / quelleNachEdit', () => {
  it('ESM und CJS sind identisch', () => {
    expect(istKiBereit([])).toBe(istKiBereitCjs([]));
    expect(quelleNachEdit({ quelle: 'migration', name: 'Alltag', beschreibung: 'x' }, { name: 'Alltag', beschreibung: 'x' }))
      .toBe(quelleNachEditCjs({ quelle: 'migration', name: 'Alltag', beschreibung: 'x' }, { name: 'Alltag', beschreibung: 'x' }));
  });

  it('KI ist bereit bei 0 Rows oder nur Seeds', () => {
    expect(istKiBereit([])).toBe(true);
    expect(istKiBereit([{ quelle: 'migration' }])).toBe(true);
    expect(istKiBereit([{ quelle: 'migration' }, { quelle: 'migration' }])).toBe(true);
  });

  it('KI ist blockiert sobald eine echte Row existiert', () => {
    expect(istKiBereit([{ quelle: 'ki' }])).toBe(false);
    expect(istKiBereit([{ quelle: 'manual' }])).toBe(false);
    expect(istKiBereit([{ quelle: 'migration' }, { quelle: 'manual' }])).toBe(false);
  });

  it('unveraenderter Seed bleibt migration, Edit wird manual', () => {
    const seed = { quelle: 'migration', name: 'Alltag', beschreibung: 'Kita und Job' };
    expect(quelleNachEdit(seed, { name: 'Alltag', beschreibung: 'Kita und Job' })).toBe('migration');
    expect(quelleNachEdit(seed, { name: 'Alltag', beschreibung: 'anders' })).toBe('manual');
    expect(quelleNachEdit(seed, { name: 'morgens', beschreibung: 'Kita und Job' })).toBe('manual');
    expect(quelleNachEdit({ quelle: 'ki', name: 'x', beschreibung: 'y' }, { name: 'x', beschreibung: 'y' })).toBe('manual');
    expect(quelleNachEdit(null, { name: 'neu' })).toBe('manual');
  });
});

describe('validateSituationen', () => {
  it('nimmt 2–4 unique Namen, wirft zu wenig weg', () => {
    expect(validateSituationen({ situationen: [{ name: 'A' }] }).situationen).toEqual([]);
    const ok = validateSituationen({
      situationen: [
        { name: 'morgens unter Zeitdruck', beschreibung: 'Hook vor der Kita' },
        { name: 'nach einem langen Arbeitstag' },
        { name: 'unterwegs mit Kindern', beschreibung: 'Snack im Wagen' },
        { name: 'morgens unter Zeitdruck' }
      ]
    });
    expect(ok.situationen).toHaveLength(3);
    expect(ok.verworfen.some(v => v.grund === 'duplikat')).toBe(true);
  });

  it('kappt auf 4', () => {
    const out = validateSituationen({
      situationen: ['a', 'b', 'c', 'd', 'e'].map(n => ({ name: n }))
    });
    expect(out.situationen.map(s => s.name)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('fmtAudienceSituations / Prompts', () => {
  it('formatiert Name plus Beschreibung', () => {
    expect(fmtAudienceSituations([
      { name: 'morgens unter Zeitdruck', beschreibung: 'kein Kopf fuer Recherche' },
      { name: 'nach einem langen Arbeitstag' }
    ])).toBe('morgens unter Zeitdruck — kein Kopf fuer Recherche; nach einem langen Arbeitstag');
  });

  it('buildPrompt trennt Persona und Produkt, verbietet Use-Case-Klone', () => {
    const { stable, task } = buildPrompt({
      persona: { name: 'Sarah', oberbegriff: 'Berufstätige Mutter', pain_points: 'keine Zeit' },
      produkt: { name: 'Meal-Kit', usp: 'fertig in 15 Minuten' }
    });
    expect(stable).toContain('nicht dem Produkt');
    expect(stable).toContain('KEINE Use-Case-Klone');
    expect(task).toContain('Berufstätige Mutter');
    expect(task).toContain('Meal-Kit');
    expect(task).toContain('audience_situations_abgeben');
  });
});

describe('Downstream: Skript vs Briefing-Situationen', () => {
  it('Skript-Kontext nutzt Audience Situations, nicht persona.kontext', () => {
    const text = buildKontextText({
      dna: [],
      persona: {
        name: 'Sarah',
        kontext: 'DIESER ALTTEXT DARF NICHT REIN',
        audience_situations: [
          { name: 'morgens unter Zeitdruck', beschreibung: 'Kita-Stress' }
        ]
      }
    }, {});
    expect(text).toContain('Audience Situations');
    expect(text).toContain('morgens unter Zeitdruck');
    expect(text).not.toContain('DIESER ALTTEXT DARF NICHT REIN');
    expect(text).not.toContain('lebensrealitaet');
  });

  it('Casting: Briefing-situationen und Audience Situations bleiben zwei Haufen', () => {
    const b = buildBedarf(
      { bereich: 'influencer_marketing', im_situationen: 'Studio, weisses Set' },
      {
        personas: [{
          id: 'p1',
          name: 'Sarah',
          audience_situations: [{ name: 'morgens unter Zeitdruck', beschreibung: 'Kita' }]
        }]
      }
    );
    expect(b.situationen).toBe('Studio, weisses Set');
    expect(b.personas[0].audience_situations[0].name).toBe('morgens unter Zeitdruck');

    const { task } = buildCastingPrompt(b, { shortlist: [] });
    expect(task).toContain('Audience Situations');
    expect(task).toContain('morgens unter Zeitdruck');
  });

  it('sanitizePersonaPayload laesst kontext fallen', () => {
    const sauber = sanitizePersonaPayload({ name: 'Lena', kontext: 'Alltag' });
    expect(sauber.kontext).toBeUndefined();
    expect(sauber.name).toBe('Lena');
  });
});

describe('attachAudienceSituations', () => {
  it('haengt Rows an die Persona', async () => {
    const supabase = {
      from: (table) => {
        expect(table).toBe('audience_situation');
        const q = {
          select: () => q,
          in: () => q,
          order: async () => ({
            data: [{ persona_id: 'p1', name: 'morgens', beschreibung: 'x', position: 0, quelle: 'ki' }],
            error: null
          })
        };
        return q;
      }
    };
    const personas = [{ id: 'p1', name: 'Sarah' }, { id: 'p2', name: 'Tom' }];
    await attachAudienceSituations(supabase, personas);
    expect(personas[0].audience_situations).toEqual([{ name: 'morgens', beschreibung: 'x', quelle: 'ki' }]);
    expect(personas[1].audience_situations).toEqual([]);
  });
});

describe('PersonaService.syncAudienceSituations', () => {
  function mockDb(bestehende, { insertId = 'new-1' } = {}) {
    const chains = [];
    window.supabase = {
      from(table) {
        const chain = { table, ops: [] };
        for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order']) {
          chain[m] = (...args) => { chain.ops.push([m, ...args]); return chain; };
        }
        chain.single = () => { chain.ops.push(['single']); return chain; };
        chain.then = (resolve) => {
          chains.push(chain);
          const isInsert = chain.ops.some(o => o[0] === 'insert');
          const isSelect = chain.ops.some(o => o[0] === 'select') && !isInsert;
          if (isInsert) return resolve({ data: { id: insertId }, error: null });
          if (isSelect) return resolve({ data: bestehende, error: null });
          return resolve({ data: null, error: null });
        };
        return chain;
      }
    };
    return chains;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('behaelt quelle=migration wenn der Seed unveraendert bleibt', async () => {
    const seed = { id: 's1', name: 'Alltag', beschreibung: 'Kita', quelle: 'migration' };
    const chains = mockDb([seed]);
    await PersonaService.syncAudienceSituations('p1', [
      { key: 's1', id: 's1', name: 'Alltag', beschreibung: 'Kita' }
    ]);
    const update = chains.find(c => c.ops.some(o => o[0] === 'update'));
    expect(update.ops.find(o => o[0] === 'update')[1].quelle).toBe('migration');
  });

  it('setzt quelle=manual wenn der Seed editiert wird', async () => {
    const seed = { id: 's1', name: 'Alltag', beschreibung: 'Kita', quelle: 'migration' };
    const chains = mockDb([seed]);
    await PersonaService.syncAudienceSituations('p1', [
      { key: 's1', id: 's1', name: 'Alltag', beschreibung: 'anders' }
    ]);
    const update = chains.find(c => c.ops.some(o => o[0] === 'update'));
    expect(update.ops.find(o => o[0] === 'update')[1].quelle).toBe('manual');
  });

  it('legt neue Rows als manual an', async () => {
    const chains = mockDb([]);
    await PersonaService.syncAudienceSituations('p1', [
      { key: 'tmp', id: null, name: 'morgens unter Zeitdruck', beschreibung: 'Hook' }
    ]);
    const insert = chains.find(c => c.ops.some(o => o[0] === 'insert'));
    expect(insert.ops.find(o => o[0] === 'insert')[1][0].quelle).toBe('manual');
  });

  it('legt KI-Rows als ki an und adoptiert keine Seeds', async () => {
    const seed = { id: 's1', name: 'Alltag', beschreibung: 'Kita', quelle: 'migration' };
    const chains = mockDb([seed]);
    await PersonaService.syncAudienceSituations('p1', [
      { key: 's1', id: 's1', name: 'Alltag', beschreibung: 'Kita', deleted: true, quelle: 'migration' },
      { key: 'tmp', id: null, name: 'morgens unter Zeitdruck', beschreibung: 'Hook', quelle: 'ki' }
    ]);
    const insert = chains.find(c => c.ops.some(o => o[0] === 'insert'));
    expect(insert.ops.find(o => o[0] === 'insert')[1][0].quelle).toBe('ki');
    const del = chains.find(c => c.ops.some(o => o[0] === 'delete'));
    expect(del).toBeTruthy();
  });
});
