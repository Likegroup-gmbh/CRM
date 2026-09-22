// ProduktPersona.test.js
// Persona- und Use-Case-Vorschlaege aus dem Produkt:
//   - Pool-Regel (Marke zuerst, Unternehmen als Fallback, nie global)
//   - Quality-Gate der Modell-Antwort (validateVorschlaege)
//   - Prompt-Regeln (fact/guess, Covered-Set, Karten-Modus)
//   - Accept/Unlink (persona_marke-Attach, Materialisierung, Unused-Check)
//   - Retry-Schutz des Save-Flushs
//   - Panel: Startrun=1, Weitere, Regen ohne Match-Fill, kein Auto-Reextract

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import produktPersona from '../../netlify/functions/_shared/produkt-persona.js';
import { ProduktPersonaService } from '../modules/produkt/ProduktPersonaService.js';
import { PersonaService } from '../modules/persona/PersonaService.js';
import { ProduktPersonaPanel } from '../modules/produkt/ProduktPersonaPanel.js';

const { loadPoolPersonas, buildPrompt, validateVorschlaege, sanitizePersonaPayload } = produktPersona;

vi.mock('../modules/persona/PersonaService.js', () => ({
  PersonaService: {
    create: vi.fn(async () => ({ id: 'persona-neu-1' })),
    saveMarken: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    loadOne: vi.fn(async () => ({ id: 'persona-neu-1', name: 'Lena' })),
    loadAudienceSituations: vi.fn(async () => []),
    syncAudienceSituations: vi.fn(async () => {}),
    update: vi.fn(async () => ({ id: 'persona-neu-1' }))
  }
}));

vi.mock('../modules/produkt/ProduktPersonaDrawer.js', () => ({
  ProduktPersonaDrawer: class {
    open() {}
    close() {}
    remove() {}
  }
}));

vi.mock('../modules/briefing/BriefingPersonas.js', () => ({
  recomputeBriefingProdukteForPersona: vi.fn(async () => {})
}));

// ---------------------------------------------------------------------------
// Supabase-Mock: aufzeichnende, thenable Query-Chains. Der Responder entscheidet
// pro Chain (Tabelle + Operationen), was zurueckgegeben wird.
// ---------------------------------------------------------------------------

function createSupabaseMock(responder) {
  const chains = [];
  return {
    chains,
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table) {
      const chain = { table, ops: [] };
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'contains', 'order', 'limit']) {
        chain[m] = (...args) => { chain.ops.push([m, ...args]); return chain; };
      }
      chain.single = () => { chain.ops.push(['single']); return chain; };
      chain.maybeSingle = () => { chain.ops.push(['maybeSingle']); return chain; };
      chain.then = (resolve, reject) => {
        chains.push(chain);
        let out;
        try {
          out = responder(chain);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
        return Promise.resolve(out).then(resolve, reject);
      };
      return chain;
    }
  };
}

const hatOp = (chain, op) => chain.ops.some(o => o[0] === op);
const opArgs = (chain, op) => chain.ops.filter(o => o[0] === op).map(o => o.slice(1));

// ---------------------------------------------------------------------------
// Pool-Regel
// ---------------------------------------------------------------------------

describe('loadPoolPersonas (Pool-Regel)', () => {
  it('nimmt zuerst die Personas der Produkt-Marken', async () => {
    const supabase = createSupabaseMock((chain) => {
      if (chain.table === 'persona_marke') return { data: [{ persona_id: 'p1' }, { persona_id: 'p2' }], error: null };
      if (chain.table === 'personas') return { data: [{ id: 'p1' }, { id: 'p2' }], error: null };
      return { data: [], error: null };
    });

    const { pool, quelle } = await loadPoolPersonas(supabase, { markeIds: ['m1', 'm2'], unternehmenId: 'u1' });

    expect(quelle).toBe('marke');
    expect(pool).toHaveLength(2);

    const personaQuery = supabase.chains.find(c => c.table === 'personas');
    expect(opArgs(personaQuery, 'in')).toEqual([['id', ['p1', 'p2']]]);
    // Kein Unternehmen-Fallback abgefragt
    expect(opArgs(personaQuery, 'eq')).toEqual([]);
  });

  it('faellt auf das Unternehmen zurueck, wenn die Marke keine Personas hat', async () => {
    const supabase = createSupabaseMock((chain) => {
      if (chain.table === 'persona_marke') return { data: [], error: null };
      if (chain.table === 'personas') return { data: [{ id: 'p9' }], error: null };
      return { data: [], error: null };
    });

    const { pool, quelle } = await loadPoolPersonas(supabase, { markeIds: ['m1'], unternehmenId: 'u1' });

    expect(quelle).toBe('unternehmen');
    expect(pool).toHaveLength(1);
    const personaQuery = supabase.chains.find(c => c.table === 'personas');
    expect(opArgs(personaQuery, 'eq')).toEqual([['unternehmen_id', 'u1']]);
  });

  it('fragt ohne Marken und Unternehmen gar nicht ab', async () => {
    const supabase = createSupabaseMock(() => ({ data: [], error: null }));
    const { pool, quelle } = await loadPoolPersonas(supabase, {});
    expect(quelle).toBe('leer');
    expect(pool).toEqual([]);
    expect(supabase.chains).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Quality-Gate der Modell-Antwort
// ---------------------------------------------------------------------------

describe('validateVorschlaege (Quality-Mix)', () => {
  const basis = {
    use_cases: [{ name: '  Morgens vor der Arbeit ' }, { name: '' }],
    vorschlaege: [
      { typ: 'match', persona_id: 'p1', fit_grund: 'echter Fit', use_case_indices: [0, 1, 99] },
      { typ: 'match', persona_id: 'p-unbekannt', fit_grund: 'halluziniert', use_case_indices: [0] },
      { typ: 'neu', persona: { name: '   ' }, fit_grund: 'x', use_case_indices: [0] },
      {
        typ: 'neu',
        persona: { name: ' Lena ', alter_von: 30, alter_bis: 250, geheim: 'weg damit' },
        fit_grund: 'Luecke',
        use_case_indices: [1],
        luecken_begruendung: 'Keine Bestehende deckt das ab'
      },
      { typ: 'neu', persona: { name: 'Ohne Bezug' }, fit_grund: 'x', use_case_indices: [42] }
    ]
  };

  it('verwirft KI-Matches, Namenlose und Karten ohne Use-Case-Bezug', () => {
    const out = validateVorschlaege(basis, { useCaseCount: 2 });

    expect(out.vorschlaege).toHaveLength(1);
    expect(out.verworfen).toHaveLength(4);
    expect(out.verworfen.filter(v => v.grund === 'KI-Match nicht erlaubt')).toHaveLength(2);

    const neu = out.vorschlaege[0];
    expect(neu.typ).toBe('neu');
    expect(neu.persona.name).toBe('Lena');
    expect(neu.persona.alter_von).toBe(30);
    expect(neu.persona.alter_bis).toBeNull();
    expect(neu.persona.geheim).toBeUndefined();
    expect(neu.luecken_begruendung).toContain('Keine Bestehende');

    expect(out.use_cases).toEqual([{ name: 'Morgens vor der Arbeit', beschreibung: null }]);
  });

  it('kappt die Kartenanzahl auf genau eine', () => {
    const json = {
      use_cases: [{ name: 'Morgens' }],
      vorschlaege: [
        { typ: 'neu', persona: { name: 'Lena' }, fit_grund: 'a', use_case_indices: [0] },
        { typ: 'neu', persona: { name: 'Tim' }, fit_grund: 'b', use_case_indices: [0] }
      ]
    };
    const out = validateVorschlaege(json, { useCaseCount: 1, maxVorschlaege: 1 });
    expect(out.vorschlaege).toHaveLength(1);
    expect(out.vorschlaege[0].persona.name).toBe('Lena');
  });

  it('sanitizePersonaPayload laesst kontext fallen', () => {
    const sauber = sanitizePersonaPayload({ name: 'Lena', kontext: 'Alltag', beruf: ' Pflegerin ' });
    expect(sauber.kontext).toBeUndefined();
    expect(sauber.name).toBe('Lena');
    expect(sauber.beruf).toBe('Pflegerin');
  });

  it('sanitizePersonaPayload clampt budgetrahmen auf niedrig/mittel/hoch', () => {
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'niedrig' }).budgetrahmen).toBe('niedrig');
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'Mittel' }).budgetrahmen).toBe('mittel');
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'mittel bis hoch' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'niedrig bis mittel' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: '' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: null }).budgetrahmen).toBeNull();
  });

  it('sanitizePersonaPayload uebernimmt Audience Situations und valide branche_id', () => {
    const sauber = sanitizePersonaPayload({
      name: 'Lena',
      branche_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      _audience_situations: [
        { name: ' morgens unter Zeitdruck ', beschreibung: 'Kind fertig machen' },
        { name: 'morgens unter Zeitdruck' },
        { name: '  ' }
      ]
    });
    expect(sauber.branche_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(sauber._audience_situations).toEqual([
      { name: 'morgens unter Zeitdruck', beschreibung: 'Kind fertig machen' }
    ]);
    expect(sanitizePersonaPayload({ name: 'A', branche_id: 'keine-uuid' }).branche_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prompt-Regeln
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  const input = {
    felder: {
      name: { value: 'Schnell-Shampoo', kind: 'fact' },
      usp: { value: 'Wäscht in 60 Sekunden', kind: 'guess' },
      pain_points: 'Keine Zeit am Morgen'
    },
    markeNamen: ['Nordwind'],
    bestehendeUseCases: [{ name: 'Morgens vor der Arbeit', beschreibung: null }],
    modus: 'initial',
    anzahlZiel: 1,
    behalten: [{ typ: 'match', name: 'Sandra' }]
  };

  it('markiert fact/guess/manual hart und listet das Covered-Set', () => {
    const { stable, task } = buildPrompt(input, { pool: [], poolQuelle: 'leer' });

    expect(task).toContain('BELEGBAR');
    expect(task).toContain('ABGELEITET');
    expect(task).toContain('MANUELL');
    expect(task).toContain('Sandra');
    expect(task).toContain('BEREITS AUF KARTEN');
    expect(stable).toContain('NICHTS ERFINDEN');
    expect(stable).toContain('KEINE KLISCHEES');
    expect(stable).toContain('TYPEN MENSCH');
    expect(stable).not.toContain('Zielgruppen-Stratege');
    expect(stable).not.toContain('als Zielgruppe dienen');
    expect(task).toContain('_audience_situations');
  });

  it('nutzt bestehende Personas nur als House-Style, nicht als Match-Pool', () => {
    const pool = [{ id: 'p1', name: 'Sandra', oberbegriff: 'Effiziente Mutter', pain_points: 'Zeitdruck' }];
    const { stable, task } = buildPrompt(input, { pool, poolQuelle: 'marke' });

    expect(stable).toContain('HOUSE-STYLE');
    expect(stable).toContain('Nur Naming und Oberbegriff');
    expect(stable).toContain('Keine langen Bios');
    expect(task).toContain('Sandra');
    expect(task).toContain('BESTEHENDE PERSONAS der Produkt-Marken');
    expect(task).toContain('nur Stil-Referenz, kein Match');
    expect(task).not.toContain('Match-Pool');
  });

  it('Startrun und Weitere verlangen genau eine neue, breite Persona', () => {
    const { stable, task } = buildPrompt(input, { pool: [], poolQuelle: 'leer' });
    expect(stable).toContain('breiteste tragfaehige Typ');
    expect(task).toContain('GENAU EINE neue Persona');
    expect(task).toContain('Kein Szenen-Schnitt');
    expect(task).toContain('kein Match');
    expect(task).not.toContain('MATCHES auf bestehende');
    expect(task).not.toContain('Ziel: 2-3');

    const weitere = buildPrompt({ ...input, modus: 'weitere' }, { pool: [], poolQuelle: 'leer' });
    expect(weitere.task).toContain('GENAU EINE weitere neue Persona');
  });

  it('Karten-Modus ersetzt durch eine neue Persona, ohne Pool-Match', () => {
    const { task } = buildPrompt(
      { ...input, modus: 'karte', ersetzteKarte: { typ: 'match' } },
      { pool: [], poolQuelle: 'leer' }
    );
    expect(task).toContain('GENAU EINE');
    expect(task).toContain('typ immer "neu"');
    expect(task).not.toContain('ANDERE bestehende Persona');
  });

  it('ohne bestehende Use Cases: erst Einsatzsituationen generieren, dann mappen', () => {
    const { task } = buildPrompt({ ...input, bestehendeUseCases: [] }, { pool: [], poolQuelle: 'leer' });
    expect(task).toContain('Generiere ZUERST 3 bis 6 benannte Einsatzsituationen');
  });
});

// ---------------------------------------------------------------------------
// Accept/Unlink im Service
// ---------------------------------------------------------------------------

describe('ProduktPersonaService Accept/Unlink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attachPersonaMarken ergaenzt nur fehlende Links und meldet genau die', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'persona_marke' && hatOp(chain, 'select')) {
        return { data: [{ marke_id: 'm1' }], error: null };
      }
      return { data: [], error: null };
    });

    const attached = await ProduktPersonaService.attachPersonaMarken('p1', ['m1', 'm2', 'm2']);
    expect(attached).toEqual(['m2']);

    const insert = window.supabase.chains.find(c => c.table === 'persona_marke' && hatOp(c, 'insert'));
    expect(opArgs(insert, 'insert')[0][0]).toEqual([{ persona_id: 'p1', marke_id: 'm2' }]);
  });

  it('materialize (neu) legt die Persona ohne interne Meta-Keys an und verlinkt die Marken', async () => {
    window.supabase = createSupabaseMock(() => ({ data: [], error: null }));

    const karte = {
      typ: 'neu',
      persona_id: null,
      payload: { name: 'Lena', pain_points: 'Zeitdruck', _luecken_begruendung: 'Lücke' }
    };
    const out = await ProduktPersonaService.materialize(karte, { unternehmenId: 'u1', markeIds: ['m1'] });

    expect(PersonaService.create).toHaveBeenCalledWith(
      { name: 'Lena', pain_points: 'Zeitdruck' },
      { unternehmenId: 'u1' }
    );
    expect(PersonaService.saveMarken).toHaveBeenCalledWith('persona-neu-1', ['m1']);
    expect(out.personaId).toBe('persona-neu-1');
    expect(out.payload._attached_marke_ids).toEqual(['m1']);
  });

  it('dematerialize (neu, unbenutzt) loest Links, loest die Karte und loescht die Persona', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (hatOp(chain, 'select') && chain.ops.some(o => o[0] === 'select' && o[2]?.head)) {
        return { count: 0, error: null };
      }
      return { data: [], error: null };
    });

    const karte = {
      id: 'v1',
      typ: 'neu',
      persona_id: 'p-neu',
      payload: { name: 'Lena', _attached_marke_ids: ['m1'] }
    };
    const out = await ProduktPersonaService.dematerialize(karte);

    // genau der durch den Accept hinzugefuegte Link wird geloescht
    const linkDelete = window.supabase.chains.find(c => c.table === 'persona_marke' && hatOp(c, 'delete'));
    expect(opArgs(linkDelete, 'in')).toEqual([['marke_id', ['m1']]]);

    // die Karte wird vor dem Persona-Delete von der Persona geloest (CASCADE-Schutz)
    const loesung = window.supabase.chains.find(
      c => c.table === 'produkt_persona_vorschlag' && c.ops.some(o => o[0] === 'update' && o[1].persona_id === null)
    );
    expect(loesung).toBeTruthy();

    expect(PersonaService.remove).toHaveBeenCalledWith('p-neu');
    expect(out.personaId).toBeNull();
    expect(out.payload._attached_marke_ids).toBeUndefined();
  });

  it('dematerialize (neu, in Skript referenziert) behaelt die Persona', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'skripte') return { count: 1, error: null };
      if (hatOp(chain, 'select') && chain.ops.some(o => o[0] === 'select' && o[2]?.head)) {
        return { count: 0, error: null };
      }
      return { data: [], error: null };
    });

    const karte = { id: 'v1', typ: 'neu', persona_id: 'p-neu', payload: { name: 'Lena' } };
    const out = await ProduktPersonaService.dematerialize(karte);

    expect(PersonaService.remove).not.toHaveBeenCalled();
    expect(out.personaId).toBe('p-neu');
  });

  it('dematerialize (neu, in Briefing referenziert) behaelt die Persona', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'campaign_briefings') return { count: 1, error: null };
      if (hatOp(chain, 'select') && chain.ops.some(o => o[0] === 'select' && o[2]?.head)) {
        return { count: 0, error: null };
      }
      return { data: [], error: null };
    });

    const karte = { id: 'v1', typ: 'neu', persona_id: 'p-neu', payload: { name: 'Lena' } };
    const out = await ProduktPersonaService.dematerialize(karte);

    expect(PersonaService.remove).not.toHaveBeenCalled();
    expect(out.personaId).toBe('p-neu');
  });

  it('materialize (neu) schreibt Audience Situations aus dem Payload', async () => {
    window.supabase = createSupabaseMock(() => ({ data: [], error: null }));

    await ProduktPersonaService.materialize({
      typ: 'neu',
      persona_id: null,
      payload: {
        name: 'Lena',
        _audience_situations: [{ name: 'morgens unter Zeitdruck', beschreibung: 'Kind fertig machen' }]
      }
    }, { unternehmenId: 'u1', markeIds: [] });

    expect(PersonaService.syncAudienceSituations).toHaveBeenCalledWith('persona-neu-1', [
      { name: 'morgens unter Zeitdruck', beschreibung: 'Kind fertig machen', quelle: 'ki' }
    ]);
  });

  it('flushKarte (accepted neu mit persona_id) legt nicht nochmal an', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'insert')) {
        return { data: { id: 'v-1' }, error: null };
      }
      if (chain.table === 'persona_marke' && hatOp(chain, 'select')) {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });

    PersonaService.create.mockClear();
    const karte = {
      key: 'k1', id: null, typ: 'neu', status: 'accepted',
      persona_id: 'persona-neu-1', payload: { name: 'Lena' }, fit_grund: 'fit',
      useCaseKeys: [], persisted: null
    };
    await ProduktPersonaService.flushKarte('prod-1', karte, {
      position: 0, keyToId: new Map(), unternehmenId: 'u1', markeIds: []
    });

    expect(PersonaService.create).not.toHaveBeenCalled();
  });

  it('uebernehmen ohne Produkt-Id legt die Persona an, schreibt aber keinen Vorschlag', async () => {
    window.supabase = createSupabaseMock(() => ({ data: [], error: null }));

    const out = await ProduktPersonaService.uebernehmen({
      key: 'k1', id: null, typ: 'neu', status: 'pending',
      persona_id: null, payload: { name: 'Lena' }, fit_grund: 'fit',
      useCaseKeys: [], position: 0
    }, { produktId: null, unternehmenId: 'u1', markeIds: ['m1'] });

    expect(out.status).toBe('accepted');
    expect(out.persona_id).toBe('persona-neu-1');
    expect(out.persisted).toBeNull();
    expect(PersonaService.create).toHaveBeenCalled();
    expect(window.supabase.chains.some(c => c.table === 'produkt_persona_vorschlag')).toBe(false);
  });

  it('flushKarte (accepted neu) mappt Use-Case-Keys auf echte IDs', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'insert')) {
        return { data: { id: 'v-1' }, error: null };
      }
      return { data: [], error: null };
    });

    const karte = {
      key: 'k1', id: null, typ: 'neu', status: 'accepted',
      persona_id: null, payload: { name: 'Lena' }, fit_grund: 'fit',
      useCaseKeys: ['uc-temp'], persisted: null
    };
    const keyToId = new Map([['uc-temp', 'uc-real']]);
    const out = await ProduktPersonaService.flushKarte('prod-1', karte, {
      position: 0, keyToId, unternehmenId: 'u1', markeIds: ['m1']
    });

    const insert = window.supabase.chains.find(c => c.table === 'produkt_persona_vorschlag' && hatOp(c, 'insert'));
    const row = opArgs(insert, 'insert')[0][0][0];
    expect(row.use_case_ids).toEqual(['uc-real']);
    expect(row.status).toBe('accepted');
    expect(row.persona_id).toBe('persona-neu-1');
    expect(out.persisted).toEqual({ status: 'accepted', persona_id: 'persona-neu-1' });
  });

  it('upsertVorschlag adoptiert nach Teilerfolg die bestehende Zeile statt doppelt einzufuegen', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'select') && hatOp(chain, 'limit')) {
        return { data: [{ id: 'v-existiert' }], error: null };
      }
      return { data: [], error: null };
    });

    const id = await ProduktPersonaService.upsertVorschlag(null, {
      produkt_id: 'prod-1', typ: 'match', status: 'pending', persona_id: 'p1', payload: null
    });

    expect(id).toBe('v-existiert');
    const inserts = window.supabase.chains.filter(c => c.table === 'produkt_persona_vorschlag' && hatOp(c, 'insert'));
    expect(inserts).toHaveLength(0);
  });

  it('syncUseCases adoptiert gleichnamige Zeilen und loescht erst nach dem Schreiben', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_use_case' && hatOp(chain, 'insert')) {
        return { data: { id: 'uc-neu' }, error: null };
      }
      if (chain.table === 'produkt_use_case' && hatOp(chain, 'select')) {
        return { data: [{ id: 'uc-1', name: 'Morgens' }], error: null };
      }
      return { data: [], error: null };
    });

    const keyToId = await ProduktPersonaService.syncUseCases('prod-1', [
      { key: 'tmp-1', id: null, name: 'Morgens', beschreibung: 'überarbeitet' },
      { key: 'tmp-2', id: null, name: 'Abends', beschreibung: '' }
    ]);

    expect(keyToId.get('tmp-1')).toBe('uc-1'); // adoptiert, nicht neu eingefuegt
    expect(keyToId.get('tmp-2')).toBe('uc-neu');

    const updates = window.supabase.chains.filter(c => c.table === 'produkt_use_case' && hatOp(c, 'update'));
    expect(opArgs(updates[0], 'eq')).toEqual([['id', 'uc-1']]);

    // nichts geloescht: beide Zeilen sind im finalen Stand
    const deletes = window.supabase.chains.filter(c => c.table === 'produkt_use_case' && hatOp(c, 'delete'));
    expect(deletes).toHaveLength(0);
  });

  it('flushOnSave schreibt verworfene Match-IDs als deleted-Rows (Regen-Exclusion ueber Sessions)', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_use_case' && hatOp(chain, 'insert')) return { data: { id: 'uc-real' }, error: null };
      if (chain.table === 'produkt_use_case' && hatOp(chain, 'select')) return { data: [], error: null };
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'insert') && hatOp(chain, 'select')) {
        return { data: { id: 'v-1' }, error: null };
      }
      return { data: [], error: null };
    });

    const state = {
      useCases: [{ key: 't1', id: null, name: 'Morgens', beschreibung: '', deleted: false }],
      karten: [{
        key: 'k1', id: null, typ: 'neu', status: 'accepted',
        persona_id: null, payload: { name: 'Lena' }, fit_grund: 'fit',
        useCaseKeys: ['t1'], persisted: null
      }],
      verworfeneMatchIds: ['p-verworfen']
    };

    const out = await ProduktPersonaService.flushOnSave('prod-1', state, { unternehmenId: 'u1', markeIds: ['m1'] });

    expect(out.useCases[0].id).toBe('uc-real');
    expect(out.karten[0].id).toBe('v-1');
    expect(out.karten[0].persisted.status).toBe('accepted');
    expect(out.neuAkzeptiert).toEqual(['persona-neu-1']);

    // deleted-Row fuer die verworfene Match-ID
    const deletedInsert = window.supabase.chains.find(c =>
      c.table === 'produkt_persona_vorschlag' && hatOp(c, 'insert') && !hatOp(c, 'select')
    );
    expect(opArgs(deletedInsert, 'insert')[0][0]).toEqual([
      { produkt_id: 'prod-1', typ: 'match', status: 'deleted', persona_id: 'p-verworfen' }
    ]);
  });
});

// ---------------------------------------------------------------------------
// Persona-seitige Verknuepfung (Persona-Formular -> saveForPersona)
// ---------------------------------------------------------------------------

describe('ProduktPersonaService.saveForPersona', () => {
  it('markiert entfernte Produkte als deleted, ohne die Persona zu loeschen', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'select')) {
        return { data: [
          { id: 'v-1', produkt_id: 'prod-1', persona_id: 'p1', status: 'accepted', payload: { fit: 'x' } },
          { id: 'v-2', produkt_id: 'prod-2', persona_id: 'p1', status: 'accepted', payload: null }
        ], error: null };
      }
      return { data: [], error: null };
    });

    await ProduktPersonaService.saveForPersona('p1', ['prod-2']);

    const del = window.supabase.chains.find(c =>
      c.table === 'produkt_persona_vorschlag' && hatOp(c, 'update') && c.ops.some(o => o[0] === 'update' && o[1].status === 'deleted')
    );
    expect(del).toBeTruthy();
    expect(opArgs(del, 'eq')).toEqual([['id', 'v-1']]);
    expect(PersonaService.remove).not.toHaveBeenCalled();
  });

  it('hebt eine deleted-Row desselben Paars wieder auf accepted und behaelt den Fit', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'select')) {
        return { data: [
          { id: 'v-1', produkt_id: 'prod-1', persona_id: 'p1', status: 'deleted', payload: { _attached_marke_ids: ['m-alt'] } }
        ], error: null };
      }
      if (chain.table === 'produkt_marke') return { data: [{ marke_id: 'm-neu' }], error: null };
      if (chain.table === 'persona_marke') return { data: [], error: null };
      return { data: [], error: null };
    });

    await ProduktPersonaService.saveForPersona('p1', ['prod-1']);

    const revive = window.supabase.chains.find(c =>
      c.table === 'produkt_persona_vorschlag' && hatOp(c, 'update') && c.ops.some(o => o[0] === 'update' && o[1].status === 'accepted')
    );
    expect(revive).toBeTruthy();
    const row = opArgs(revive, 'update')[0][0];
    expect(row.payload._attached_marke_ids).toEqual(['m-alt', 'm-neu']);

    const inserts = window.supabase.chains.filter(c => c.table === 'produkt_persona_vorschlag' && hatOp(c, 'insert'));
    expect(inserts).toHaveLength(0);
  });

  it('legt eine neue accepted-Row an, wenn keine besteht, und haengt Produkt-Marken an', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'select')) return { data: [], error: null };
      if (chain.table === 'produkt_marke') return { data: [{ marke_id: 'm1' }, { marke_id: 'm2' }], error: null };
      if (chain.table === 'persona_marke' && hatOp(chain, 'select')) return { data: [{ marke_id: 'm1' }], error: null };
      return { data: [], error: null };
    });

    await ProduktPersonaService.saveForPersona('p1', ['prod-1']);

    const insert = window.supabase.chains.find(c => c.table === 'produkt_persona_vorschlag' && hatOp(c, 'insert'));
    const row = opArgs(insert, 'insert')[0][0][0];
    expect(row).toMatchObject({ produkt_id: 'prod-1', typ: 'match', status: 'accepted', persona_id: 'p1' });
    expect(row.payload._attached_marke_ids).toEqual(['m2']);

    const attach = window.supabase.chains.find(c => c.table === 'persona_marke' && hatOp(c, 'insert'));
    expect(opArgs(attach, 'insert')[0][0]).toEqual([{ persona_id: 'p1', marke_id: 'm2' }]);
  });

  it('laesst pending-Rows ohne persona_id (typ neu) unangetastet', async () => {
    window.supabase = createSupabaseMock((chain) => {
      if (chain.table === 'produkt_persona_vorschlag' && hatOp(chain, 'select')) {
        return { data: [
          { id: 'v-pending', produkt_id: 'prod-9', persona_id: 'p1', status: 'pending', payload: null }
        ], error: null };
      }
      if (chain.table === 'produkt_marke') return { data: [], error: null };
      return { data: [], error: null };
    });

    await ProduktPersonaService.saveForPersona('p1', []);

    const touched = window.supabase.chains.filter(c =>
      c.table === 'produkt_persona_vorschlag' && (hatOp(c, 'update') || hatOp(c, 'insert'))
    );
    expect(touched).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Panel: Regen-Exclusion, Auto-Chain, Karten-Aktionen
// ---------------------------------------------------------------------------

function mountPanel({ produktId = null, mitSubstanz = true } = {}) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div id="produkt-persona-panel"></div>
    ${mitSubstanz ? '<input name="name" value="Schnell-Shampoo"><textarea name="usp">Wäscht in 60 Sekunden</textarea>' : ''}
  `;
  document.body.appendChild(form);
  return form;
}

async function startePanel(form, kontext = {}) {
  const panel = new ProduktPersonaPanel();
  await panel.mount(form, {
    produktId: null,
    getMarkeIds: () => ['m1'],
    getUnternehmenId: () => 'u1',
    ...kontext
  });
  return panel;
}

describe('ProduktPersonaPanel', () => {
  let form;
  let panel;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProduktPersonaService, 'starteJob').mockResolvedValue({
      success: true,
      use_cases: [{ name: 'Morgens vor der Arbeit' }],
      vorschlaege: [{
        typ: 'neu',
        persona: { name: 'Lena' },
        fit_grund: 'Zeitdruck trifft 60-Sekunden-Versprechen',
        use_case_indices: [0],
        luecken_begruendung: 'Keine Bestehende'
      }]
    });
    vi.spyOn(ProduktPersonaService, 'loadUseCases').mockResolvedValue([]);
    vi.spyOn(ProduktPersonaService, 'loadVorschlaege').mockResolvedValue([]);
    vi.spyOn(ProduktPersonaService, 'loadVerworfeneMatchIds').mockResolvedValue([]);
  });

  afterEach(() => {
    panel?.destroy();
    form?.remove();
    vi.restoreAllMocks();
  });

  const tick = () => new Promise(r => setTimeout(r, 0));

  it('Startrun fragt genau eine neue Karte ab', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.regenAlle();
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('initial');
    expect(input.anzahlZiel).toBe(1);
  });

  it('Weitere legt eine Karte dazu, ohne pending Matches zu loeschen', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [
      {
        key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p-auf-karte',
        persona: { name: 'Sandra' }, useCaseKeys: [], position: 0
      },
      { key: 'k2', id: null, typ: 'neu', status: 'accepted', persona_id: 'p-akzeptiert', payload: { name: 'Neu' }, useCaseKeys: [], position: 1 }
    ];
    panel.verworfeneMatchIds = ['p-verworfen'];

    panel.weitereVorschlagen();
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('weitere');
    expect(input.anzahlZiel).toBe(1);
    expect(input.ausschluss_persona_ids).toEqual(
      expect.arrayContaining(['p-verworfen', 'p-auf-karte', 'p-akzeptiert'])
    );
    expect(input.behalten).toEqual(expect.arrayContaining([
      { typ: 'match', name: 'Sandra' },
      { typ: 'neu', name: 'Neu' }
    ]));
    expect(panel.karten.some(k => k.persona_id === 'p-auf-karte' && k.status !== 'deleted')).toBe(true);
  });

  it('Regen-alle mit accepted startet keinen Job und fasst manuelle Matches nicht an', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [
      { key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p-auf-karte', useCaseKeys: [], position: 0 },
      { key: 'k2', id: null, typ: 'neu', status: 'accepted', persona_id: 'p-akzeptiert', payload: { name: 'Neu' }, useCaseKeys: [], position: 1 }
    ];

    panel.regenAlle();
    await tick();

    expect(ProduktPersonaService.starteJob).not.toHaveBeenCalled();
    expect(panel.karten.some(k => k.persona_id === 'p-auf-karte' && k.status !== 'deleted')).toBe(true);
  });

  it('Regen-alle ersetzt nur pending KI-Karten', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [
      { key: 'k1', id: null, typ: 'neu', status: 'pending', persona_id: null, payload: { name: 'Alt' }, useCaseKeys: [], position: 0 },
      { key: 'k2', id: null, typ: 'match', status: 'pending', persona_id: 'p-manual', useCaseKeys: [], position: 1 }
    ];

    panel.regenAlle();
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('initial');
    expect(input.anzahlZiel).toBe(1);
    expect(panel.karten.some(k => k.key === 'k1' && k.status !== 'deleted')).toBe(false);
    expect(panel.karten.some(k => k.persona_id === 'p-manual' && k.status !== 'deleted')).toBe(true);
  });

  it('Karten-Modus fragt genau eine Karte ab', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [{
      key: 'k1', id: null, typ: 'neu', status: 'pending', persona_id: null,
      payload: { name: 'Alt' }, useCaseKeys: [], position: 0
    }];
    panel.regenKarte('k1');
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('karte');
    expect(input.anzahlZiel).toBe(1);
    expect(input.ersetzteKarte).toEqual({ typ: 'neu' });
  });

  it('Startrun zeigt ein Skeleton, Weitere-Button erst mit Karte', async () => {
    form = mountPanel();
    panel = await startePanel(form);
    panel.jobRunning = true;
    panel.render();

    expect(panel.root().querySelectorAll('.rel-card--skeleton')).toHaveLength(1);
    expect(panel.root().querySelector('[data-persona-action="weitere"]').disabled).toBe(true);

    panel.jobRunning = false;
    panel.karten = [{
      key: 'k1', id: null, typ: 'neu', status: 'accepted',
      persona_id: 'p1', payload: { name: 'Lena' }, useCaseKeys: [], position: 0
    }];
    panel.render();
    expect(panel.root().querySelector('[data-persona-action="weitere"]').disabled).toBe(false);
    expect(panel.root().querySelector('[data-persona-action="regen-alle"]').disabled).toBe(true);
  });

  it('kein Auto-Reextract: das zweite siteExtractFinished startet keinen Job mehr', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    const fertig = () => new CustomEvent('siteExtractFinished', {
      detail: { entity: 'produkt', ok: true, fields: { einsatzsituation: { value: 'morgens', kind: 'guess' } } }
    });

    document.dispatchEvent(fertig());
    await tick();
    expect(ProduktPersonaService.starteJob).toHaveBeenCalledTimes(1);
    expect(ProduktPersonaService.starteJob.mock.calls[0][0].input.modus).toBe('initial');
    expect(ProduktPersonaService.starteJob.mock.calls[0][0].input.anzahlZiel).toBe(1);
    // der Extract-Guess landet als Seed
    expect(panel.extractSeed).toBe('morgens');
    // Karte aus dem Job-Ergebnis liegt vor
    expect(panel.karten.some(k => k.status !== 'deleted')).toBe(true);

    document.dispatchEvent(fertig());
    await tick();
    expect(ProduktPersonaService.starteJob).toHaveBeenCalledTimes(1);
  });

  it('Auto-Chain ignoriert andere Entities und fehlgeschlagene Extracts', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    document.dispatchEvent(new CustomEvent('siteExtractFinished', {
      detail: { entity: 'unternehmen', ok: true, fields: {} }
    }));
    document.dispatchEvent(new CustomEvent('siteExtractFinished', {
      detail: { entity: 'produkt', ok: false, fields: {} }
    }));
    await tick();
    expect(ProduktPersonaService.starteJob).not.toHaveBeenCalled();
  });

  it('Auto-Chain skippt still ohne Substanz', async () => {
    form = mountPanel({ mitSubstanz: false });
    panel = await startePanel(form);

    document.dispatchEvent(new CustomEvent('siteExtractFinished', {
      detail: { entity: 'produkt', ok: true, fields: {} }
    }));
    await tick();
    expect(ProduktPersonaService.starteJob).not.toHaveBeenCalled();
  });

  it('Save-Toast: pending-Karten und laufender Job blocken, Verwerfen ist ein State-Wechsel', async () => {
    form = mountPanel();
    panel = await startePanel(form);
    panel.karten = [
      { key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p1', useCaseKeys: [], position: 0 },
      { key: 'k2', id: 'v2', typ: 'neu', status: 'pending', persona_id: null, payload: { name: 'X' }, useCaseKeys: [], position: 1, persisted: { status: 'pending', persona_id: null } }
    ];
    panel.render();

    expect(panel.saveBlockGrund()).toContain('2 Persona-Vorschläge nicht übernommen');
    expect(panel.root().querySelector('[data-persona-action="accept"]')).toBeNull();
    expect(panel.root().querySelector('[data-persona-action="accept-alle"]')).toBeNull();
    expect(panel.root().querySelector('[data-persona-action="open"]')).toBeTruthy();

    panel.jobRunning = true;
    expect(panel.saveBlockGrund()).toContain('noch generiert');
    panel.jobRunning = false;

    panel.karten[0].status = 'accepted';
    expect(panel.saveBlockGrund()).toContain('1 Persona-Vorschlag nicht übernommen');
    panel.karten[0].status = 'pending';

    await panel.verwerfKarte('k1');
    expect(panel.karten.some(k => k.key === 'k1')).toBe(false);
    expect(panel.verworfeneMatchIds).toContain('p1');

    await panel.verwerfKarte('k2');
    expect(panel.karten[0].status).toBe('deleted');
  });

  it('applySavedState mappt temp-Keys auf echte IDs, auch in den Karten-Refs', () => {
    form = mountPanel();
    return startePanel(form).then((p) => {
      panel = p;
      panel.useCases = [{ key: 'tmp-uc', id: null, name: 'Morgens', beschreibung: '', deleted: false }];
      panel.karten = [{
        key: 'tmp-karte', id: null, typ: 'neu', status: 'accepted',
        persona_id: 'persona-neu-1', payload: { name: 'Lena' },
        useCaseKeys: ['tmp-uc'], persisted: null
      }];

      panel.applySavedState({
        useCases: [{ key: 'tmp-uc', id: 'uc-real', name: 'Morgens', beschreibung: '', deleted: false }],
        karten: [{
          key: 'tmp-karte', id: 'v-real', typ: 'neu', status: 'accepted',
          persona_id: 'persona-neu-1', payload: { name: 'Lena' },
          useCaseKeys: ['tmp-uc'], persisted: { status: 'accepted', persona_id: 'persona-neu-1' }
        }]
      });

      expect(panel.useCases[0].key).toBe('uc-real');
      expect(panel.karten[0].key).toBe('v-real');
      expect(panel.karten[0].useCaseKeys).toEqual(['uc-real']);
    });
  });

  it('Plus-Karte: Drawer bekommt die volle Persona, nicht den Such-Stub', async () => {
    const voll = {
      id: 'p-pdf',
      name: 'Mutti am Morgen',
      oberbegriff: 'Zeitgedrückte Mutter',
      beschreibung: 'Zwei Kinder, 6:30-Chaos',
      pain_points: 'Keine Zeit für sich'
    };
    PersonaService.loadOne.mockResolvedValue(voll);

    form = mountPanel();
    panel = await startePanel(form);
    vi.spyOn(panel.drawer, 'open');

    panel.addPersonaKarte({
      id: 'p-pdf',
      label: 'Mutti am Morgen',
      data: { id: 'p-pdf', name: 'Mutti am Morgen', oberbegriff: 'Zeitgedrückte Mutter' }
    });

    await panel.openDrawer(panel.karten[0].key);

    expect(PersonaService.loadOne).toHaveBeenCalledWith('p-pdf', { unternehmenId: 'u1' });
    expect(panel.drawer.open).toHaveBeenCalledTimes(1);
    expect(panel.drawer.open.mock.calls[0][0].persona).toEqual(voll);
  });
});
