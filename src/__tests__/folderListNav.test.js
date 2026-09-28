import { describe, expect, it } from 'vitest';
import {
  folderCrumbs,
  markenEbeneEntfaellt,
  markenEbeneEntfaelltAusOrdnern,
  NUR_UNTERNEHMEN_LABEL
} from '../core/folderListNav.js';

describe('markenEbeneEntfaellt', () => {
  it('fällt weg, wenn nur Einträge ohne Marke da sind', () => {
    expect(markenEbeneEntfaellt(0, 3)).toBe(true);
  });

  it('bleibt, sobald eine echte Marke existiert', () => {
    expect(markenEbeneEntfaellt(1, 2)).toBe(false);
  });

  it('bleibt bei leerer Firma', () => {
    expect(markenEbeneEntfaellt(0, 0)).toBe(false);
  });

  it('liest virtuelle Ordner als ohne Marke', () => {
    expect(markenEbeneEntfaelltAusOrdnern([
      { id: null, virtual: true, count: 2 }
    ])).toBe(true);
    expect(markenEbeneEntfaelltAusOrdnern([
      { id: 'm1', virtual: false, count: 1 },
      { id: null, virtual: true, count: 1 }
    ])).toBe(false);
  });
});

describe('folderCrumbs markenEbeneWeg', () => {
  const folder = {
    unternehmenId: 'u1',
    unternehmenName: 'Acme',
    ohneMarke: true,
    markeName: NUR_UNTERNEHMEN_LABEL
  };

  it('lässt Nur Unternehmen weg und macht die Firma zur aktuellen Ebene', () => {
    const crumbs = folderCrumbs({
      listLabel: 'Kampagnen',
      basePath: '/kampagne',
      folder,
      markenEbeneWeg: true
    });
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Kampagnen', 'Acme']);
    expect(crumbs[1].clickable).toBe(false);
  });

  it('zeigt Nur Unternehmen, wenn die Marken-Ebene bleibt', () => {
    const crumbs = folderCrumbs({
      listLabel: 'Kampagnen',
      basePath: '/kampagne',
      folder
    });
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Kampagnen', 'Acme', NUR_UNTERNEHMEN_LABEL]);
  });
});
