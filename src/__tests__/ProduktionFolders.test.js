import { describe, expect, it } from 'vitest';
import {
  buildBrandFolders,
  buildCampaignFolders,
  buildCompanyFolders,
  buildCurrentItems,
  markenEbeneWeg
} from '../modules/produktion/ProduktionFolders.js';

const firma = (id, firmenname) => ({ id, firmenname, logo_url: null });
const marke = (id, markenname) => ({ id, markenname, logo_url: null });
const row = (id, unternehmen, markeObj, kampagneId, name) => ({
  id,
  kampagne: {
    id: kampagneId,
    eigener_name: name,
    unternehmen_id: unternehmen.id,
    unternehmen,
    marke_id: markeObj?.id || null,
    marke: markeObj || null
  }
});

const zeta = firma('u1', 'Zeta');
const alpha = firma('u2', 'Alpha');
const rows = [
  row('p1', zeta, marke('m2', 'Beta'), 'k1', 'Burger'),
  row('p2', zeta, marke('m1', 'Alpha'), 'k2', 'Safari'),
  row('p3', zeta, null, 'k3', 'Sommer'),
  row('p4', zeta, marke('m1', 'Alpha'), 'k2', 'Safari'),
  row('p5', alpha, null, 'k4', 'Winter')
];

describe('ProduktionFolders', () => {
  it('gruppiert Unternehmen alphabetisch mit Anzahl', () => {
    const folders = buildCompanyFolders(rows);
    expect(folders.map(f => [f.firmenname, f.count])).toEqual([['Alpha', 1], ['Zeta', 4]]);
  });

  it('ignoriert Produktionen ohne Unternehmen', () => {
    const lose = [{ id: 'x', kampagne: { id: 'k9' } }];
    expect(buildCompanyFolders(lose)).toEqual([]);
  });

  it('bildet Marken mit virtuellem Ordner Nur Unternehmen', () => {
    const folders = buildBrandFolders(rows, 'u1');
    expect(folders.map(f => [f.markenname, f.count, f.virtual])).toEqual([
      ['Alpha', 2, false],
      ['Beta', 1, false],
      ['Nur Unternehmen', 1, true]
    ]);
  });

  it('lässt die Marken-Ebene nur ohne echte Marke entfallen', () => {
    expect(markenEbeneWeg(rows, 'u1')).toBe(false);
    expect(markenEbeneWeg(rows, 'u2')).toBe(true);
    expect(markenEbeneWeg(rows, 'unbekannt')).toBe(false);
    expect(markenEbeneWeg(rows, null)).toBe(false);
  });

  it('bildet Kampagnen je Marke und je Nur Unternehmen', () => {
    expect(buildCampaignFolders(rows, { unternehmenId: 'u1', markeId: 'm1' }))
      .toEqual([{ id: 'k2', name: 'Safari', count: 2 }]);
    expect(buildCampaignFolders(rows, { unternehmenId: 'u1', ohneMarke: true }))
      .toEqual([{ id: 'k3', name: 'Sommer', count: 1 }]);
  });

  it('liefert die Produktionen einer Kampagne', () => {
    const items = buildCurrentItems(rows, { unternehmenId: 'u1', markeId: 'm1', kampagneId: 'k2' });
    expect(items.map(r => r.id)).toEqual(['p2', 'p4']);
    expect(buildCurrentItems(rows, { unternehmenId: 'u1', markeId: 'm2', kampagneId: 'k2' })).toEqual([]);
  });
});
