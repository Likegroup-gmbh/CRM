import { describe, it, expect } from 'vitest';
import {
  personaMarken,
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  NUR_UNTERNEHMEN_LABEL
} from '../modules/persona/PersonaFolders.js';

function persona({
  id,
  unternehmenId,
  firmenname,
  logo_url = null,
  marken = []
} = {}) {
  return {
    id,
    unternehmen_id: unternehmenId,
    unternehmen: unternehmenId
      ? { id: unternehmenId, firmenname, logo_url }
      : null,
    marken: marken.map((m) => ({
      marke_id: m.id,
      marke: { id: m.id, markenname: m.markenname, logo_url: m.logo_url || null }
    }))
  };
}

describe('personaMarken', () => {
  it('zieht id, namen und logo aus der Junction', () => {
    const result = personaMarken(persona({
      id: 'p1',
      unternehmenId: 'u1',
      firmenname: 'Acme',
      marken: [{ id: 'm1', markenname: 'Brand', logo_url: '/b.png' }]
    }));
    expect(result).toEqual([
      { id: 'm1', markenname: 'Brand', logo_url: '/b.png' }
    ]);
  });

  it('verwirft Eintraege ohne Marken-Id', () => {
    expect(personaMarken({ marken: [{ marke: { markenname: 'X' } }] })).toEqual([]);
    expect(personaMarken({})).toEqual([]);
  });
});

describe('buildCompanyFolders', () => {
  it('gruppiert nach Unternehmen, zaehlt und sortiert de-DE', () => {
    const folders = buildCompanyFolders([
      persona({ id: 'p1', unternehmenId: 'u2', firmenname: 'Zebra' }),
      persona({ id: 'p2', unternehmenId: 'u1', firmenname: 'Acme', logo_url: '/a.png' }),
      persona({ id: 'p3', unternehmenId: 'u1', firmenname: 'Acme', logo_url: '/a.png' })
    ]);
    expect(folders).toEqual([
      { id: 'u1', firmenname: 'Acme', logo_url: '/a.png', count: 2 },
      { id: 'u2', firmenname: 'Zebra', logo_url: null, count: 1 }
    ]);
  });

  it('laesst Personas ohne unternehmen_id weg', () => {
    expect(buildCompanyFolders([
      persona({ id: 'dna', firmenname: 'Ghost' })
    ])).toEqual([]);
  });
});

describe('buildBrandFolders', () => {
  const rows = [
    persona({
      id: 'p1',
      unternehmenId: 'u1',
      firmenname: 'Acme',
      marken: [{ id: 'm2', markenname: 'Zeta' }, { id: 'm1', markenname: 'Alpha' }]
    }),
    persona({
      id: 'p2',
      unternehmenId: 'u1',
      firmenname: 'Acme',
      marken: [{ id: 'm1', markenname: 'Alpha' }]
    }),
    persona({ id: 'p3', unternehmenId: 'u1', firmenname: 'Acme' }),
    persona({
      id: 'p4',
      unternehmenId: 'u2',
      firmenname: 'Other',
      marken: [{ id: 'm9', markenname: 'Fremd' }]
    })
  ];

  it('zaehlt Marken im Unternehmen und haengt Nur-Unternehmen ans Ende', () => {
    const folders = buildBrandFolders(rows, 'u1');
    expect(folders).toEqual([
      { id: 'm1', markenname: 'Alpha', logo_url: null, count: 2, virtual: false },
      { id: 'm2', markenname: 'Zeta', logo_url: null, count: 1, virtual: false },
      { id: null, markenname: NUR_UNTERNEHMEN_LABEL, logo_url: null, count: 1, virtual: true }
    ]);
  });

  it('laesst den virtuellen Ordner weg wenn alle eine Marke haben', () => {
    const folders = buildBrandFolders(rows.slice(0, 2), 'u1');
    expect(folders.every((f) => !f.virtual)).toBe(true);
    expect(folders).toHaveLength(2);
  });
});

describe('buildCurrentItems', () => {
  const rows = [
    persona({
      id: 'p1',
      unternehmenId: 'u1',
      firmenname: 'Acme',
      marken: [{ id: 'm1', markenname: 'Alpha' }]
    }),
    persona({ id: 'p2', unternehmenId: 'u1', firmenname: 'Acme' }),
    persona({
      id: 'p3',
      unternehmenId: 'u2',
      firmenname: 'Other',
      marken: [{ id: 'm1', markenname: 'Alpha' }]
    })
  ];

  it('filtert auf Marke im Unternehmen', () => {
    expect(buildCurrentItems(rows, { unternehmenId: 'u1', markeId: 'm1' }).map((p) => p.id))
      .toEqual(['p1']);
  });

  it('filtert ohne Marke auf unbranded im Unternehmen', () => {
    expect(buildCurrentItems(rows, { unternehmenId: 'u1', ohneMarke: true }).map((p) => p.id))
      .toEqual(['p2']);
  });
});
