import { describe, it, expect } from 'vitest';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  NUR_UNTERNEHMEN_LABEL
} from '../modules/auftrag/AuftragsdetailsFolders.js';

const detail = (id, unternehmen, marke) => ({
  id,
  auftrag: {
    unternehmen: unternehmen ? { id: unternehmen[0], firmenname: unternehmen[1], logo_url: null } : null,
    marke: marke ? { id: marke[0], markenname: marke[1], logo_url: null } : null
  }
});

const details = [
  detail('d1', ['u2', 'Zeta GmbH'], ['m3', 'Zeta Pro']),
  detail('d2', ['u1', 'Alpha AG'], ['m2', 'Beta']),
  detail('d3', ['u1', 'Alpha AG'], ['m1', 'Alpha Marke']),
  detail('d4', ['u1', 'Alpha AG'], ['m1', 'Alpha Marke']),
  detail('d5', ['u1', 'Alpha AG'], null),
  detail('d6', null, null)
];

describe('AuftragsdetailsFolders', () => {
  it('gruppiert Unternehmen aus dem verschachtelten Auftrag, sortiert und zählt', () => {
    const folders = buildCompanyFolders(details);
    expect(folders.map((f) => [f.firmenname, f.count])).toEqual([
      ['Alpha AG', 4],
      ['Zeta GmbH', 1]
    ]);
  });

  it('lässt Zeilen ohne Unternehmen im Grid weg', () => {
    const total = buildCompanyFolders(details).reduce((sum, f) => sum + f.count, 0);
    expect(total).toBe(5);
  });

  it('baut Marken-Ordner sortiert und hängt „Nur Unternehmen“ als virtuellen Ordner an', () => {
    const folders = buildBrandFolders(details, 'u1');
    expect(folders.map((f) => [f.markenname, f.count, f.virtual])).toEqual([
      ['Alpha Marke', 2, false],
      ['Beta', 1, false],
      [NUR_UNTERNEHMEN_LABEL, 1, true]
    ]);
  });

  it('zeigt keinen virtuellen Ordner, wenn jede Zeile eine Marke hat', () => {
    const folders = buildBrandFolders(details, 'u2');
    expect(folders).toHaveLength(1);
    expect(folders[0].virtual).toBe(false);
  });

  it('filtert Items nach Unternehmen und Marke', () => {
    const items = buildCurrentItems(details, { unternehmenId: 'u1', markeId: 'm1' });
    expect(items.map((d) => d.id)).toEqual(['d3', 'd4']);
  });

  it('filtert Items ohne Marke', () => {
    const items = buildCurrentItems(details, { unternehmenId: 'u1', ohneMarke: true });
    expect(items.map((d) => d.id)).toEqual(['d5']);
  });
});
