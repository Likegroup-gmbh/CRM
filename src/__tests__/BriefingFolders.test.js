import { describe, it, expect } from 'vitest';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  OHNE_MARKE_LABEL
} from '../modules/briefing/BriefingFolders.js';

const u1 = { id: 'u1', firmenname: 'Zebra GmbH', logo_url: 'z.png' };
const u2 = { id: 'u2', firmenname: 'Alpha AG', logo_url: 'a.png' };
const m1 = { id: 'm1', markenname: 'Brand B', logo_url: 'b.png' };
const m2 = { id: 'm2', markenname: 'Brand A', logo_url: 'c.png' };

const briefings = [
  { id: 'b1', unternehmen_id: 'u1', unternehmen: u1, marke_id: 'm1', marke: m1 },
  { id: 'b2', unternehmen_id: 'u1', unternehmen: u1, marke_id: 'm1', marke: m1 },
  { id: 'b3', unternehmen_id: 'u1', unternehmen: u1, marke_id: 'm2', marke: m2 },
  { id: 'b4', unternehmen_id: 'u1', unternehmen: u1, marke_id: null, marke: null },
  { id: 'b5', unternehmen_id: 'u2', unternehmen: u2, marke_id: 'm2', marke: m2 },
  { id: 'b6', unternehmen_id: null, unternehmen: null, marke_id: null, marke: null }
];

describe('buildCompanyFolders', () => {
  it('gruppiert nach Unternehmen, zaehlt und sortiert de', () => {
    const folders = buildCompanyFolders(briefings);
    expect(folders.map((f) => f.id)).toEqual(['u2', 'u1']);
    expect(folders[0]).toMatchObject({ firmenname: 'Alpha AG', count: 1 });
    expect(folders[1]).toMatchObject({ firmenname: 'Zebra GmbH', count: 4 });
  });
});

describe('buildBrandFolders', () => {
  it('gruppiert 1:1 nach marke_id und haengt Ohne-Marke-Ordner an', () => {
    const folders = buildBrandFolders(briefings, 'u1');
    expect(folders).toHaveLength(3);
    expect(folders[0]).toMatchObject({ id: 'm2', markenname: 'Brand A', count: 1, virtual: false });
    expect(folders[1]).toMatchObject({ id: 'm1', markenname: 'Brand B', count: 2, virtual: false });
    expect(folders[2]).toMatchObject({
      id: null,
      markenname: OHNE_MARKE_LABEL,
      count: 1,
      virtual: true
    });
  });

  it('ohne unbranded-Briefings keinen virtuellen Ordner', () => {
    const folders = buildBrandFolders(briefings, 'u2');
    expect(folders).toEqual([
      expect.objectContaining({ id: 'm2', count: 1, virtual: false })
    ]);
  });
});

describe('buildCurrentItems', () => {
  it('filtert nach marke_id', () => {
    expect(buildCurrentItems(briefings, { unternehmenId: 'u1', markeId: 'm1' }).map((b) => b.id))
      .toEqual(['b1', 'b2']);
  });

  it('virtueller Ordner nur Briefings ohne Marke', () => {
    expect(buildCurrentItems(briefings, { unternehmenId: 'u1', ohneMarke: true }).map((b) => b.id))
      .toEqual(['b4']);
  });
});
