import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmpfaengerComposer } from '../core/anschreiben/EmpfaengerComposer.js';

function chain(result) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    in: vi.fn(() => c),
    is: vi.fn(() => c),
    not: vi.fn(() => c),
    or: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return c;
}

function mockDb({ creator = [], management = [], kooperationen = [], creatorManagement = [] } = {}) {
  const chains = {
    creator: chain({ data: creator, error: null }),
    management: chain({ data: management, error: null }),
    kampagne: chain({ data: [], error: null }),
    kooperationen: chain({ data: kooperationen, error: null }),
    creator_management: chain({ data: creatorManagement, error: null }),
  };
  return { from: vi.fn((t) => chains[t]) };
}

function createComposer(db, opts = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const composer = new EmpfaengerComposer({
    container,
    db,
    unternehmenId: 'u1',
    ...opts,
  });
  composer.render();
  return composer;
}

describe('EmpfaengerComposer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('startet im Creator-Modus und togglet nach Management', () => {
    const composer = createComposer(mockDb());
    expect(composer.typ).toBe('creator');
    expect(document.querySelector('[data-typ="creator"]').classList.contains('is-active')).toBe(true);

    composer.setTyp('management');
    expect(composer.typ).toBe('management');
    expect(document.querySelector('[data-typ="management"]').classList.contains('is-active')).toBe(true);
    expect(document.querySelector('[data-typ="creator"]').classList.contains('is-active')).toBe(false);
  });

  it('leert die Empfaenger beim Toggle', () => {
    const composer = createComposer(mockDb());
    composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' });
    expect(composer.getEmpfaenger()).toHaveLength(1);

    composer.setTyp('management');
    expect(composer.getEmpfaenger()).toHaveLength(0);
  });

  it('dedupt nach (typ, id)', () => {
    const composer = createComposer(mockDb());
    expect(composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' })).toBe(true);
    expect(composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' })).toBe(false);
    expect(composer.getEmpfaenger()).toHaveLength(1);
  });

  it('nimmt Eintraege ohne Mail nicht auf', () => {
    const composer = createComposer(mockDb());
    expect(composer.addOne({ id: 'c1', email: '', name: 'A' })).toBe(false);
    expect(composer.addOne({ id: 'c2', email: null, name: 'B' })).toBe(false);
    expect(composer.isEmpty()).toBe(true);
  });

  it('entfernt Empfaenger per remove', () => {
    const composer = createComposer(mockDb());
    composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' });
    composer.addOne({ id: 'c2', email: 'b@b.de', name: 'B' });
    composer.remove('creator', 'c1');
    expect(composer.getEmpfaenger().map((e) => e.id)).toEqual(['c2']);
  });

  it('sucht Creator nur mit Mail', async () => {
    const db = mockDb({
      creator: [
        { id: 'c1', vorname: 'Lisa', nachname: 'K', mail: 'lisa@x.de' },
        { id: 'c2', vorname: 'Max', nachname: 'Ohne', mail: null },
      ],
    });
    const composer = createComposer(db);
    const items = await composer._loadCreatorOptions();
    expect(db.from).toHaveBeenCalledWith('creator');
    expect(items.map((i) => i.value)).toEqual(['c1']);
    expect(items[0].label).toBe('Lisa K');
    expect(items[0].description).toBe('lisa@x.de');
  });

  it('sucht Managements nur mit Mail', async () => {
    const db = mockDb({
      management: [
        { id: 'm1', firmenname: 'Agentur A', email: 'info@a.de' },
        { id: 'm2', firmenname: 'Agentur B', email: null },
      ],
    });
    const composer = createComposer(db);
    const items = await composer._loadManagementOptions();
    expect(items.map((i) => i.value)).toEqual(['m1']);
  });

  it('Kampagne expandiert Kooperations-Creator mit Mail, Rest gezaehlt', async () => {
    const db = mockDb({
      kooperationen: [
        { creator: { id: 'c1', vorname: 'A', nachname: '', mail: 'a@x.de' } },
        { creator: { id: 'c2', vorname: 'B', nachname: '', mail: null } },
        { creator: { id: 'c1', vorname: 'A', nachname: '', mail: 'a@x.de' } },
        { creator: null },
      ],
    });
    const composer = createComposer(db);
    const { empfaenger, skipped } = await composer._resolveKampagneCreators(['k1']);

    expect(empfaenger.map((e) => e.id)).toEqual(['c1']);
    expect(skipped).toBe(1);
    expect(db.from).toHaveBeenCalledWith('kooperationen');
  });

  it('Kampagne-Tab bleibt Creator-Empfaenger, nicht Management', async () => {
    const db = mockDb({
      kooperationen: [
        { creator: { id: 'c1', vorname: 'A', nachname: '', mail: 'a@x.de' } },
      ],
    });
    const composer = createComposer(db);
    composer.setTyp('kampagne');
    const { empfaenger } = await composer._resolveKampagneCreators(['k1']);
    expect(empfaenger[0].typ).toBe('creator');
  });

  it('Kampagne-Suche ist aufs Unternehmen (und Marke) gescoped', async () => {
    const db = mockDb();
    const composer = createComposer(db, { markeId: 'marke1' });
    await composer._loadKampagneOptions();

    const idx = db.from.mock.calls.findIndex((c) => c[0] === 'kampagne');
    const kampagneChain = db.from.mock.results[idx].value;
    expect(kampagneChain.eq).toHaveBeenCalledWith('unternehmen_id', 'u1');
    expect(kampagneChain.eq).toHaveBeenCalledWith('marke_id', 'marke1');
  });

  it('zeigt den Skip-Zaehler im DOM', async () => {
    const db = mockDb({
      kooperationen: [{ creator: { id: 'c1', vorname: 'B', nachname: '', mail: null } }],
    });
    const composer = createComposer(db);
    composer.setTyp('kampagne');
    const { empfaenger, skipped } = await composer._resolveKampagneCreators(['k1']);
    composer.empfaengerByTab.kampagne = empfaenger;
    composer.skippedByTab.kampagne = skipped;
    composer._renderSkipped();

    const hint = document.querySelector('[data-skipped]');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('1 ohne E-Mail');
  });

  it('zeigt das Kampagne-Label', () => {
    createComposer(mockDb());
    expect(document.querySelector('[data-typ="kampagne"]').textContent).toContain('Kampagne');
    expect(document.querySelector('#empfaenger-select-kampagne')).not.toBeNull();
  });

  it('Tab-Switch laesst alle Suchfelder im DOM', () => {
    const composer = createComposer(mockDb());
    expect(document.querySelectorAll('[data-searchable]')).toHaveLength(3);

    composer.setTyp('management');
    expect(document.querySelectorAll('[data-searchable]')).toHaveLength(3);
    expect(document.querySelector('[data-panel="management"]').hidden).toBe(false);
    expect(document.querySelector('[data-panel="creator"]').hidden).toBe(true);
  });

  it('applyPrefill setzt Creator', () => {
    const composer = createComposer(mockDb());
    composer.applyPrefill([{ typ: 'creator', id: 'c1', email: 'a@b.de', name: 'A', vorname: 'A' }]);
    expect(composer.getEmpfaenger()).toEqual([
      expect.objectContaining({ id: 'c1', email: 'a@b.de', typ: 'creator' }),
    ]);
  });
});
