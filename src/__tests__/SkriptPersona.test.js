// Persona-Kette: Videoidee, Casting, sonst Rueckfrage aus dem Briefing. Liky waehlt nie selbst.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { personaWarnung } from '../modules/skripte/skriptCreateKontext.js';
import { vorgabenPanelHtml } from '../modules/skripte/editor/SkriptEditorDocRenderer.js';

const require = createRequire(import.meta.url);
const {
  ladePersonaOptionen, personaOffenBlock, gueltigePersonaId, setzePersonaAmSkript, personaVomStub
} = require('../../netlify/functions/_shared/skript-persona.js');
const { buildFragenPrompt } = require('../../netlify/functions/skript-fragen-background.js');

const OPTIONEN = [
  { id: 'p-katrin', name: 'Katrin Hoffmann', oberbegriff: 'Die gestresste Mutter' },
  { id: 'p-laura', name: 'Laura Schäfer', oberbegriff: 'Die achtsame moderne Genießerin' }
];

/** Minimaler Supabase-Mock: jede Kette endet in { data, error } je Tabelle. */
function supabaseMock(antworten = {}) {
  const updates = [];
  const from = vi.fn((tabelle) => {
    const ergebnis = antworten[tabelle] || { data: null, error: null };
    const kette = {
      select: () => kette,
      in: () => Promise.resolve(ergebnis),
      eq: () => kette,
      maybeSingle: () => Promise.resolve(ergebnis),
      update: (patch) => { updates.push({ tabelle, patch }); return kette; },
      then: (res, rej) => Promise.resolve(ergebnis).then(res, rej)
    };
    return kette;
  });
  return { from, updates };
}

describe('personaWarnung im Drawer', () => {
  const item = (extra = {}) => ({
    id: 'si', persona_id: null, casting_eintrag: null,
    strategie: { briefing: { persona_ids: ['p-katrin', 'p-laura'] } }, ...extra
  });

  it('warnt, wenn Videoidee und Casting keine Persona haben', () => {
    expect(personaWarnung(item())).toContain('Liky fragt in den Rückfragen');
  });

  it('still bei gesetzter Persona oder Briefing ohne Personas', () => {
    expect(personaWarnung(item({ persona_id: 'p-katrin' }))).toBe('');
    expect(personaWarnung(item({ strategie: { briefing: { persona_ids: [] } } }))).toBe('');
    expect(personaWarnung(null)).toBe('');
  });
});

describe('Persona-Wahl im Editor fuer Bestandsskripte', () => {
  it('Warnung mit Auswahl nur ohne Persona und mit Schreibrecht', () => {
    const skript = { id: 's1', persona_id: null, persona_optionen: OPTIONEN, prompt_kontext: {} };
    const html = vorgabenPanelHtml(skript, { kannPersonaSetzen: true });
    expect(html).toContain('data-persona-setzen');
    expect(html).toContain('value="p-laura"');
    expect(vorgabenPanelHtml(skript)).not.toContain('data-persona-setzen');
    expect(vorgabenPanelHtml({ ...skript, persona_id: 'p-laura' }, { kannPersonaSetzen: true })).not.toContain('data-persona-setzen');
  });
});

describe('Rueckfragen klaeren die Persona', () => {
  it('Block listet die Personas und verbietet die eigene Wahl', () => {
    const block = personaOffenBlock(OPTIONEN);
    expect(block).toContain('# PERSONA DIESES SKRIPTS: offen');
    expect(block).toContain('- p-laura: Die achtsame moderne Genießerin (Laura Schäfer)');
    expect(block).toContain('Waehle nie selbst');
    expect(personaOffenBlock([])).toBe('');
  });

  it('buildFragenPrompt haengt den Block an und nennt persona_id im Format', () => {
    const { task } = buildFragenPrompt({ master: [], bereich: 'owned_social' }, {}, [], { personaOptionen: OPTIONEN });
    expect(task).toContain('# PERSONA DIESES SKRIPTS: offen');
    expect(task).toContain('(Felder: nachricht, fertig, persona_id)');
    expect(task.indexOf('# PERSONA DIESES SKRIPTS')).toBeLessThan(task.indexOf('# VORLIEGENDE CRM-DATEN'));
  });

  it('ohne offene Persona kein Block und kein Feld', () => {
    const { task } = buildFragenPrompt({ master: [], bereich: 'owned_social' }, {}, []);
    expect(task).not.toContain('PERSONA DIESES SKRIPTS');
    expect(task).toContain('(Felder: nachricht, fertig)');
  });

  it('nur IDs aus der Auswahl gelten', () => {
    expect(gueltigePersonaId(OPTIONEN, 'p-laura')).toBe('p-laura');
    expect(gueltigePersonaId(OPTIONEN, 'erfunden')).toBeNull();
    expect(gueltigePersonaId([], 'p-laura')).toBeNull();
  });

  it('Optionen nur laden, wenn noch keine Persona gesetzt ist', async () => {
    const sb = supabaseMock({ personas: { data: OPTIONEN, error: null } });
    expect(await ladePersonaOptionen(sb, { personaId: 'p-katrin', briefing: { persona_ids: ['p-laura'] } })).toEqual([]);
    expect(sb.from).not.toHaveBeenCalled();
    expect(await ladePersonaOptionen(sb, { personaId: null, briefing: { persona_ids: ['p-katrin', 'p-laura'] } })).toEqual(OPTIONEN);
  });
});

describe('Persona am Skript setzen', () => {
  it('schreibt Spalte und generator_payload, Produkt bei genau einem Fit', async () => {
    const sb = supabaseMock({ produkt_persona_vorschlag: { data: [{ produkt_id: 'prod-leber' }], error: null } });
    const skript = { id: 's1', produkt_id: null, prompt_kontext: { generator_payload: { video_idee: 'x' } } };
    const out = await setzePersonaAmSkript(sb, skript, 'p-laura');
    expect(out).toEqual({ personaId: 'p-laura', produktId: 'prod-leber' });
    const { patch } = sb.updates.find((u) => u.tabelle === 'skripte');
    expect(patch.persona_id).toBe('p-laura');
    expect(patch.produkt_id).toBe('prod-leber');
    expect(patch.prompt_kontext.generator_payload).toEqual({ video_idee: 'x', persona_id: 'p-laura', produkt_id: 'prod-leber' });
  });

  it('mehrere Fits: kein Produkt raten', async () => {
    const sb = supabaseMock({ produkt_persona_vorschlag: { data: [{ produkt_id: 'a' }, { produkt_id: 'b' }], error: null } });
    const out = await setzePersonaAmSkript(sb, { id: 's1', prompt_kontext: {} }, 'p-laura');
    expect(out.produktId).toBeNull();
    expect(sb.updates[0].patch).not.toHaveProperty('produkt_id');
  });

  it('Generierung fuellt leere Persona aus dem Stub', async () => {
    const sb = supabaseMock({ skripte: { data: { persona_id: 'p-laura', produkt_id: 'prod-leber' }, error: null } });
    expect(await personaVomStub(sb, { skript_id: 's1', persona_id: null, produkt_id: null }))
      .toEqual({ skript_id: 's1', persona_id: 'p-laura', produkt_id: 'prod-leber' });
    const gesetzt = { skript_id: 's1', persona_id: 'p-katrin', produkt_id: 'x' };
    expect(await personaVomStub(sb, gesetzt)).toBe(gesetzt);
  });
});
