import { describe, it, expect } from 'vitest';
import {
  produktMarken,
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  NUR_UNTERNEHMEN_LABEL
} from '../modules/produkt/ProduktFolders.js';

const u1 = { id: 'u1', firmenname: 'Zebra GmbH', logo_url: 'z.png' };
const u2 = { id: 'u2', firmenname: 'Alpha AG', logo_url: 'a.png' };
const m1 = { id: 'm1', markenname: 'Brand B', logo_url: 'b.png' };
const m2 = { id: 'm2', markenname: 'Brand A', logo_url: 'c.png' };

function marken(...list) {
  return list.map((marke) => ({ marke_id: marke.id, marke }));
}

const produkte = [
  { id: 'p1', unternehmen_id: 'u1', unternehmen: u1, marken: marken(m1, m2) },
  { id: 'p2', unternehmen_id: 'u1', unternehmen: u1, marken: marken(m1) },
  { id: 'p3', unternehmen_id: 'u1', unternehmen: u1, marken: [] },
  { id: 'p4', unternehmen_id: 'u2', unternehmen: u2, marken: marken(m2) },
  { id: 'p5', unternehmen_id: null, unternehmen: null, marken: [] }
];

describe('produktMarken', () => {
  it('zieht id aus Embed oder Junction', () => {
    expect(produktMarken({ marken: [{ marke_id: 'x', marke: { id: 'm', markenname: 'M' } }] }))
      .toEqual([{ id: 'm', markenname: 'M', logo_url: null }]);
    expect(produktMarken({ marken: [{ marke_id: 'x' }] }))
      .toEqual([{ id: 'x', markenname: '', logo_url: null }]);
  });

  it('leeres Array bleibt leer', () => {
    expect(produktMarken({ marken: [] })).toEqual([]);
    expect(produktMarken({})).toEqual([]);
  });
});

describe('buildCompanyFolders', () => {
  it('gruppiert nach Unternehmen, zaehlt und sortiert de', () => {
    const folders = buildCompanyFolders(produkte);
    expect(folders.map((f) => f.id)).toEqual(['u2', 'u1']);
    expect(folders[0]).toMatchObject({ firmenname: 'Alpha AG', count: 1, logo_url: 'a.png' });
    expect(folders[1]).toMatchObject({ firmenname: 'Zebra GmbH', count: 3, logo_url: 'z.png' });
  });

  it('ignoriert Produkte ohne Unternehmen', () => {
    expect(buildCompanyFolders(produkte).every((f) => f.id)).toBe(true);
  });
});

describe('buildBrandFolders', () => {
  it('zaehlt M:N-Produkte in jeder Marke und haengt virtuellen Ordner an', () => {
    const folders = buildBrandFolders(produkte, 'u1');
    expect(folders).toHaveLength(3);
    expect(folders[0]).toMatchObject({ id: 'm2', markenname: 'Brand A', count: 1, virtual: false });
    expect(folders[1]).toMatchObject({ id: 'm1', markenname: 'Brand B', count: 2, virtual: false });
    expect(folders[2]).toMatchObject({
      id: null,
      markenname: NUR_UNTERNEHMEN_LABEL,
      count: 1,
      virtual: true
    });
  });

  it('ohne unbranded-Produkte keinen virtuellen Ordner', () => {
    const folders = buildBrandFolders(produkte, 'u2');
    expect(folders).toEqual([
      expect.objectContaining({ id: 'm2', count: 1, virtual: false })
    ]);
  });
});

describe('buildCurrentItems', () => {
  it('filtert nach Marken-Membership', () => {
    expect(buildCurrentItems(produkte, { unternehmenId: 'u1', markeId: 'm1' }).map((p) => p.id))
      .toEqual(['p1', 'p2']);
    expect(buildCurrentItems(produkte, { unternehmenId: 'u1', markeId: 'm2' }).map((p) => p.id))
      .toEqual(['p1']);
  });

  it('virtueller Ordner nur Produkte ohne Marke', () => {
    expect(buildCurrentItems(produkte, { unternehmenId: 'u1', ohneMarke: true }).map((p) => p.id))
      .toEqual(['p3']);
  });
});
