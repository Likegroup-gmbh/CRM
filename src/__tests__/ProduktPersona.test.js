// ProduktPersona.test.js
// Persona- und Use-Case-Vorschlaege aus dem Produkt:
//   - Pool-Regel (Marke zuerst, Unternehmen als Fallback, nie global)
//   - Quality-Gate der Modell-Antwort (validateVorschlaege)
//   - Prompt-Regeln (fact/guess, Covered-Set, Karten-Modus)
//   - Accept/Unlink (persona_marke-Attach, Materialisierung, Unused-Check)
//   - Retry-Schutz des Save-Flushs
//   - Panel: Regen-Exclusion, kein Auto-Reextract, Karten-Aktionen

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
    remove: vi.fn(async () => {})
  }
}));

vi.mock('../modules/produkt/ProduktPersonaDrawer.js', () => ({
  ProduktPersonaDrawer: class {
    open() {}
    close() {}
    remove() {}
  }
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
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
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

  it('verwirft Halluzinations-Matches, Namenlose und Karten ohne Use-Case-Bezug', () => {
    const out = validateVorschlaege(basis, { poolIds: ['p1'], useCaseCount: 2 });

    expect(out.vorschlaege).toHaveLength(2);
    expect(out.verworfen).toHaveLength(3);

    const match = out.vorschlaege.find(v => v.typ === 'match');
    expect(match.persona_id).toBe('p1');
    // Ungueltiger Index 99 ist raus, gueltige bleiben
    expect(match.use_case_indices).toEqual([0, 1]);

    const neu = out.vorschlaege.find(v => v.typ === 'neu');
    expect(neu.persona.name).toBe('Lena');
    expect(neu.persona.alter_von).toBe(30);
    // ausserhalb 0-120 -> null
    expect(neu.persona.alter_bis).toBeNull();
    // unbekannte Felder kommen nicht durch
    expect(neu.persona.geheim).toBeUndefined();
    expect(neu.luecken_begruendung).toContain('Keine Bestehende');

    // Use Cases: getrimmt, leere raus
    expect(out.use_cases).toEqual([{ name: 'Morgens vor der Arbeit', beschreibung: null }]);
  });

  it('kappt die Kartenanzahl (Karten-Modus: genau eine)', () => {
    const out = validateVorschlaege(basis, { poolIds: ['p1'], useCaseCount: 2, maxVorschlaege: 1 });
    expect(out.vorschlaege).toHaveLength(1);
  });

  it('sanitizePersonaPayload laesst nur bekannte Persona-Felder durch', () => {
    const sauber = sanitizePersonaPayload({ name: 'Lena', marke_ids: ['m1'], _meta: 1, beruf: ' Pflegerin ' });
    expect(sauber.name).toBe('Lena');
    expect(sauber.beruf).toBe('Pflegerin');
    expect(sauber.marke_ids).toBeUndefined();
    expect(sauber._meta).toBeUndefined();
    expect(sauber.alter_von).toBeNull();
  });

  it('sanitizePersonaPayload clampt budgetrahmen auf niedrig/mittel/hoch', () => {
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'niedrig' }).budgetrahmen).toBe('niedrig');
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'Mittel' }).budgetrahmen).toBe('mittel');
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'mittel bis hoch' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: 'niedrig bis mittel' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: '' }).budgetrahmen).toBeNull();
    expect(sanitizePersonaPayload({ name: 'A', budgetrahmen: null }).budgetrahmen).toBeNull();
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
    modus: 'alle',
    anzahlZiel: 5,
    behalten: [{ typ: 'match', name: 'Sandra' }]
  };

  it('markiert fact/guess/manual hart und listet das Covered-Set', () => {
    const { stable, task } = buildPrompt(input, { pool: [], poolQuelle: 'leer' });

    expect(task).toContain('BELEGBAR');
    expect(task).toContain('ABGELEITET');
    expect(task).toContain('MANUELL');
    expect(task).toContain('Sandra');
    expect(task).toContain('BEREITS AKZEPTIERT');
    expect(stable).toContain('NICHTS ERFINDEN');
    expect(stable).toContain('KEINE KLISCHEES');
  });

  it('nutzt bestehende Personas als House-Style und Match-Pool', () => {
    const pool = [{ id: 'p1', name: 'Sandra', oberbegriff: 'Effiziente Mutter', pain_points: 'Zeitdruck' }];
    const { stable, task } = buildPrompt(input, { pool, poolQuelle: 'marke' });

    expect(stable).toContain('HOUSE-STYLE');
    expect(task).toContain('Sandra');
    expect(task).toContain('BESTEHENDE PERSONAS der Produkt-Marken');
  });

  it('Karten-Modus Match: naechstbeste bestehende Persona, sonst Luecken-Persona', () => {
    const { task } = buildPrompt(
      { ...input, modus: 'karte', ersetzteKarte: { typ: 'match' } },
      { pool: [], poolQuelle: 'leer' }
    );
    expect(task).toContain('GENAU EINE');
    expect(task).toContain('ANDERE bestehende Persona');
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

  it('Regen-Exclusion: verworfene und liegende Persona-IDs gehen in den Ausschluss', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [
      { key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p-auf-karte', useCaseKeys: [], position: 0 },
      { key: 'k2', id: null, typ: 'neu', status: 'accepted', persona_id: 'p-akzeptiert', payload: { name: 'Neu' }, useCaseKeys: [], position: 1 }
    ];
    panel.verworfeneMatchIds = ['p-verworfen'];

    panel.regenAlle();
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('alle');
    expect(input.ausschluss_persona_ids).toEqual(
      expect.arrayContaining(['p-verworfen', 'p-auf-karte', 'p-akzeptiert'])
    );
    // akzeptierte Karte bleibt als Freeze im Auftrag
    expect(input.behalten).toEqual([{ typ: 'neu', name: 'Neu' }]);
    // die pending Match-Karte wurde durch den Regen verworfen
    expect(panel.karten.some(k => k.persona_id === 'p-auf-karte' && k.status !== 'deleted')).toBe(false);
  });

  it('Karten-Modus fragt genau eine Karte ab', async () => {
    form = mountPanel();
    panel = await startePanel(form);

    panel.karten = [{ key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p1', useCaseKeys: [], position: 0 }];
    panel.regenKarte('k1');
    await tick();

    const input = ProduktPersonaService.starteJob.mock.calls[0][0].input;
    expect(input.modus).toBe('karte');
    expect(input.anzahlZiel).toBe(1);
    expect(input.ersetzteKarte).toEqual({ typ: 'match' });
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

  it('Annehmen/Zuruecknehmen/Verwerfen sind reine State-Wechsel vor dem Save', () => {
    form = mountPanel();
    return startePanel(form).then(async (p) => {
      panel = p;
      panel.karten = [
        { key: 'k1', id: null, typ: 'match', status: 'pending', persona_id: 'p1', useCaseKeys: [], position: 0 },
        { key: 'k2', id: 'v2', typ: 'neu', status: 'pending', persona_id: 'p2', payload: { name: 'X' }, useCaseKeys: [], position: 1, persisted: { status: 'pending', persona_id: null } }
      ];

      panel.acceptKarte('k1');
      expect(panel.karten[0].status).toBe('accepted');

      panel.zurueckKarte('k1');
      expect(panel.karten[0].status).toBe('pending');

      // unpersistierte Karte: Verwerfen entfernt sie und merkt die Match-ID
      panel.verwerfKarte('k1');
      expect(panel.karten.some(k => k.key === 'k1')).toBe(false);
      expect(panel.verworfeneMatchIds).toContain('p1');

      // persistierte Karte: Verwerfen markiert deleted, Zeile bleibt fuer den Flush
      panel.verwerfKarte('k2');
      expect(panel.karten[0].status).toBe('deleted');
    });
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
});
