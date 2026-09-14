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
    const items = await composer.searchEmpfaenger('l');
    expect(db.from).toHaveBeenCalledWith('creator');
    expect(items.map((i) => i.id)).toEqual(['c1']);
    expect(items[0].label).toBe('Lisa K');
    expect(items[0].sub).toBe('lisa@x.de');
  });

  it('sucht Managements nur mit Mail', async () => {
    const db = mockDb({
      management: [
        { id: 'm1', firmenname: 'Agentur A', email: 'info@a.de' },
        { id: 'm2', firmenname: 'Agentur B', email: null },
      ],
    });
    const composer = createComposer(db);
    composer.setTyp('management');
    const items = await composer.searchEmpfaenger('a');
    expect(items.map((i) => i.id)).toEqual(['m1']);
  });

  it('Kampagne-Bulk im Creator-Modus: Kooperations-Creator mit Mail, Rest gezaehlt', async () => {
    const db = mockDb({
      kooperationen: [
        { creator: { id: 'c1', vorname: 'A', nachname: '', mail: 'a@x.de' } },
        { creator: { id: 'c2', vorname: 'B', nachname: '', mail: null } },
        { creator: { id: 'c1', vorname: 'A', nachname: '', mail: 'a@x.de' } }, // dup
        { creator: null },
      ],
    });
    const composer = createComposer(db);
    const added = await composer.addKampagne('k1');

    expect(added).toBe(1);
    expect(composer.getEmpfaenger().map((e) => e.id)).toEqual(['c1']);
    expect(composer.getSkipped()).toBe(1);
    expect(db.from).toHaveBeenCalledWith('kooperationen');
  });

  it('Kampagne-Bulk im Management-Modus: aktive Managements der Creator', async () => {
    const db = mockDb({
      kooperationen: [{ creator_id: 'c1' }, { creator_id: 'c2' }, { creator_id: 'c1' }],
      creatorManagement: [
        { management: { id: 'm1', firmenname: 'A', email: 'a@m.de' } },
        { management: { id: 'm2', firmenname: 'B', email: null } },
      ],
    });
    const composer = createComposer(db);
    composer.setTyp('management');
    const added = await composer.addKampagne('k1');

    expect(added).toBe(1);
    expect(composer.getEmpfaenger()[0]).toMatchObject({ typ: 'management', id: 'm1', email: 'a@m.de' });
    expect(composer.getSkipped()).toBe(1);
  });

  it('Kampagne-Suche ist aufs Unternehmen (und Marke) gescoped', async () => {
    const db = mockDb();
    const composer = createComposer(db, { markeId: 'marke1' });
    await composer.searchKampagne('x');

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
    await composer.addKampagne('k1');

    const hint = document.querySelector('[data-skipped]');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('1 ohne E-Mail');
  });

  it('zeigt das Kampagne-Label', () => {
    createComposer(mockDb());
    expect(document.querySelector('.empfaenger-composer__label').textContent).toContain('Kampagne');
    expect(document.querySelector('[data-kampagne-suche] .rel-add')).not.toBeNull();
  });

  it('Tab-Switch laesst beide Suchfelder im DOM', () => {
    createComposer(mockDb());
    expect(document.querySelectorAll('.rel-add')).toHaveLength(2);

    const tab = document.querySelector('[data-typ="management"]');
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tab.click();

    expect(document.querySelectorAll('.rel-add')).toHaveLength(2);
    expect(document.querySelector('[data-suche] .rel-add')).not.toBeNull();
    expect(document.querySelector('[data-kampagne-suche] .rel-add')).not.toBeNull();
  });

  it('Outside-Click zerstoert die Suchfelder nicht', () => {
    createComposer(mockDb());
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('.rel-add')).toHaveLength(2);
  });
});
