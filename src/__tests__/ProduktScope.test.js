import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProduktService,
  resolveProduktScope,
  produktFormRoute
} from '../modules/produkt/ProduktService.js';
import { ProduktList } from '../modules/produkt/ProduktList.js';
import { renderProduktDoc } from '../modules/produkt/ProduktDoc.js';

describe('resolveProduktScope', () => {
  it('volle Firma ohne explizite Marken → alle Produkte der Firma', () => {
    expect(resolveProduktScope({
      companyIds: ['u1'],
      brands: []
    })).toEqual({
      unrestrictedCompanyIds: ['u1'],
      restrictedBrandIds: []
    });
  });

  it('nur Marken-Zuordnung → nur diese Marken, nicht die Mutterfirma', () => {
    expect(resolveProduktScope({
      companyIds: [],
      brands: [{ id: 'm1', unternehmen_id: 'u1' }]
    })).toEqual({
      unrestrictedCompanyIds: [],
      restrictedBrandIds: ['m1']
    });
  });

  it('Firma plus explizite Marken derselben Firma → nur die Marken', () => {
    expect(resolveProduktScope({
      companyIds: ['u1'],
      brands: [{ id: 'm1', unternehmen_id: 'u1' }, { id: 'm2', unternehmen_id: 'u1' }]
    })).toEqual({
      unrestrictedCompanyIds: [],
      restrictedBrandIds: ['m1', 'm2']
    });
  });

  it('unbeschränkte Firma A plus Marke von Firma B', () => {
    expect(resolveProduktScope({
      companyIds: ['u-a'],
      brands: [{ id: 'm-b', unternehmen_id: 'u-b' }]
    })).toEqual({
      unrestrictedCompanyIds: ['u-a'],
      restrictedBrandIds: ['m-b']
    });
  });

  it('leer → nichts', () => {
    expect(resolveProduktScope({ companyIds: [], brands: [] })).toEqual({
      unrestrictedCompanyIds: [],
      restrictedBrandIds: []
    });
  });
});

describe('produktFormRoute', () => {
  it('baut die Worksheet-Route', () => {
    expect(produktFormRoute('u1', 'p1')).toBe('/unternehmen/u1/produkt?produkt=p1');
    expect(produktFormRoute('u1')).toBe('/unternehmen/u1/produkt');
  });
});

describe('ProduktService.getAllowedProduktScopeForUser', () => {
  afterEach(() => {
    delete window.currentUser;
    delete window.supabase;
  });

  it('Admin sieht alles', async () => {
    window.currentUser = { id: 'admin-1', rolle: 'admin' };
    const scope = await ProduktService.getAllowedProduktScopeForUser('admin-1');
    expect(scope.all).toBe(true);
    expect(scope.produktIds).toBeNull();
  });

  it('Kunde wird nicht clientseitig gefiltert', async () => {
    window.currentUser = { id: 'k1', rolle: 'kunde' };
    const scope = await ProduktService.getAllowedProduktScopeForUser('k1');
    expect(scope.all).toBe(true);
  });

  function scopedSupabase({
    mitarbeiterUnternehmen = [],
    markeMitarbeiter = [],
    marken = [],
    produkte = [],
    produktMarke = []
  } = {}) {
    const dataMap = {
      mitarbeiter_unternehmen: mitarbeiterUnternehmen,
      marke_mitarbeiter: markeMitarbeiter,
      marke: marken,
      produkt: produkte,
      produkt_marke: produktMarke
    };
    return {
      from: vi.fn((table) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: vi.fn(() => query),
          order: vi.fn(() => query),
          then: (resolve) => resolve({ data: dataMap[table] || [], error: null })
        };
        return query;
      })
    };
  }

  it('Mitarbeiter ohne Zuordnung sieht nichts', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.supabase = scopedSupabase();
    const scope = await ProduktService.getAllowedProduktScopeForUser('m1');
    expect(scope.all).toBe(false);
    expect(scope.produktIds).toEqual([]);
    expect(scope.unrestrictedCompanyIds).toEqual([]);
    expect(scope.restrictedBrandIds).toEqual([]);
  });

  it('Mitarbeiter mit Firma ohne Marken-Zwang sieht alle Firmen-Produkte', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.supabase = scopedSupabase({
      mitarbeiterUnternehmen: [{ unternehmen_id: 'u1' }],
      produkte: [{ id: 'p1' }, { id: 'p2' }]
    });
    const scope = await ProduktService.getAllowedProduktScopeForUser('m1');
    expect(scope.all).toBe(false);
    expect(scope.unrestrictedCompanyIds).toEqual(['u1']);
    expect(scope.restrictedBrandIds).toEqual([]);
    expect(scope.produktIds).toEqual(['p1', 'p2']);
  });

  it('Mitarbeiter nur an einer Marke sieht nur Marken-Produkte', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.supabase = scopedSupabase({
      markeMitarbeiter: [{ marke_id: 'm1' }],
      marken: [{ id: 'm1', unternehmen_id: 'u1' }],
      produktMarke: [{ produkt_id: 'p-brand' }]
    });
    const scope = await ProduktService.getAllowedProduktScopeForUser('m1');
    expect(scope.unrestrictedCompanyIds).toEqual([]);
    expect(scope.restrictedBrandIds).toEqual(['m1']);
    expect(scope.produktIds).toEqual(['p-brand']);
  });
});

describe('ProduktDoc standalone vs Owner', () => {
  it('standalone zeigt Firmenwahl, kein Hidden-Owner, Marken erst nach Firma', () => {
    const html = renderProduktDoc(null, { mitMarkenFeld: true, mitUnternehmenFeld: true });
    expect(html).not.toMatch(/<input type="hidden" name="unternehmen_id"/);
    expect(html).toContain('data-doc-field="unternehmen_id"');
    expect(html).toContain('name="unternehmen_id"');
    expect(html).toMatch(/data-doc-field="marke_ids"[^>]*hidden/);
  });

  it('Owner-Kontext hat Hidden-Feld und keine Firmenwahl', () => {
    const html = renderProduktDoc(null, {
      mitMarkenFeld: true,
      mitUnternehmenFeld: false,
      unternehmenId: 'u1'
    });
    expect(html).toMatch(/<input type="hidden" name="unternehmen_id" value="u1"/);
    expect(html).not.toContain('data-doc-field="unternehmen_id"');
    expect(html).toContain('data-doc-field="marke_ids"');
    expect(html).not.toMatch(/data-doc-field="marke_ids"[^>]*hidden/);
  });
});

describe('ProduktService.loadCreateUnternehmenOptions', () => {
  afterEach(() => {
    delete window.currentUser;
    delete window.supabase;
  });

  function scopedSupabase({
    mitarbeiterUnternehmen = [],
    markeMitarbeiter = [],
    marken = [],
    produkte = [],
    produktMarke = [],
    unternehmen = []
  } = {}) {
    const dataMap = {
      mitarbeiter_unternehmen: mitarbeiterUnternehmen,
      marke_mitarbeiter: markeMitarbeiter,
      marke: marken,
      produkt: produkte,
      produkt_marke: produktMarke,
      unternehmen
    };
    return {
      from: vi.fn((table) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: vi.fn(() => query),
          order: vi.fn(() => query),
          then: (resolve) => resolve({ data: dataMap[table] || [], error: null })
        };
        return query;
      })
    };
  }

  it('Admin sieht alle Firmen', async () => {
    window.currentUser = { id: 'a1', rolle: 'admin' };
    window.supabase = scopedSupabase({
      unternehmen: [{ id: 'u1', firmenname: 'A' }, { id: 'u2', firmenname: 'B' }]
    });
    const rows = await ProduktService.loadCreateUnternehmenOptions('a1');
    expect(rows).toEqual([
      { id: 'u1', firmenname: 'A' },
      { id: 'u2', firmenname: 'B' }
    ]);
  });

  it('Mitarbeiter bekommt die Elternfirma seiner Marke', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.supabase = scopedSupabase({
      markeMitarbeiter: [{ marke_id: 'brand-1' }],
      marken: [{ id: 'brand-1', unternehmen_id: 'u1' }],
      unternehmen: [{ id: 'u1', firmenname: 'Acme' }]
    });
    const rows = await ProduktService.loadCreateUnternehmenOptions('m1');
    expect(rows).toEqual([{ id: 'u1', firmenname: 'Acme' }]);
  });

  it('Mitarbeiter ohne Zuordnung bekommt keine Firmen', async () => {
    window.currentUser = { id: 'm1', rolle: 'mitarbeiter' };
    window.supabase = scopedSupabase();
    await expect(ProduktService.loadCreateUnternehmenOptions('m1')).resolves.toEqual([]);
  });
});

describe('ProduktList Anlegen', () => {
  afterEach(() => {
    delete window.navigateTo;
  });

  it('geht direkt auf /produkt/new', () => {
    window.navigateTo = vi.fn();
    new ProduktList().showCreateForm();
    expect(window.navigateTo).toHaveBeenCalledWith('/produkt/new');
  });
});

describe('ProduktList.loadPageData Scope', () => {
  let list;

  beforeEach(() => {
    window.isAdmin = () => false;
    window.isKunde = () => false;
    window.currentUser = { id: 'staff-1', rolle: 'mitarbeiter' };
    window.supabase = {};
    list = new ProduktList();
    list._isAdmin = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.isAdmin;
    delete window.isKunde;
    delete window.currentUser;
    delete window.supabase;
  });

  it('Mitarbeiter ohne IDs bekommt eine leere Seite', async () => {
    vi.spyOn(ProduktService, 'getAllowedProduktScopeForUser').mockResolvedValue({
      all: false,
      produktIds: [],
      unrestrictedCompanyIds: [],
      restrictedBrandIds: []
    });

    const result = await list.loadPageData(1, 25, {});
    expect(result).toEqual({ data: [], total: 0 });
  });
});
