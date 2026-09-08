import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProduktService } from '../modules/produkt/ProduktService.js';

function makeQuery(result) {
  const q = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
    eq: vi.fn(() => q),
    then: (resolve) => resolve(result)
  };
  return q;
}

describe('ProduktService.loadAll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('laedt alle Produkte mit Unternehmen, Marken und Tabellen-Relationen', async () => {
    const data = [
      { id: 'pr1', name: 'Case', unternehmen_id: 'u1', unternehmen: { id: 'u1', firmenname: 'Acme' } }
    ];
    const query = makeQuery({ data, error: null });
    window.supabase = { from: vi.fn(() => query) };

    const result = await ProduktService.loadAll();

    expect(window.supabase.from).toHaveBeenCalledWith('produkt');
    expect(query.select).toHaveBeenCalled();
    expect(String(query.select.mock.calls[0][0])).toContain('unternehmen:unternehmen_id');
    expect(result).toEqual(data);
  });

  it('wirft bei Supabase-Fehlern', async () => {
    const query = makeQuery({ data: null, error: new Error('RLS denied') });
    window.supabase = { from: vi.fn(() => query) };

    await expect(ProduktService.loadAll()).rejects.toThrow('RLS denied');
  });

  it('gibt leeres Array bei leerem Ergebnis zurueck', async () => {
    const query = makeQuery({ data: null, error: null });
    window.supabase = { from: vi.fn(() => query) };

    const result = await ProduktService.loadAll();
    expect(result).toEqual([]);
  });
});

describe('ProduktService.loadOne', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filtert im Standalone nicht auf unternehmen_id', async () => {
    const produkt = { id: 'pr1', name: 'Case', unternehmen_id: 'u1' };
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: produkt, error: null }))
    };
    window.supabase = { from: vi.fn(() => q) };

    const result = await ProduktService.loadOne('pr1');

    expect(q.select).toHaveBeenCalledWith('*');
    expect(q.eq).toHaveBeenCalledWith('id', 'pr1');
    expect(q.eq).not.toHaveBeenCalledWith('unternehmen_id', expect.anything());
    expect(result).toEqual(produkt);
  });

  it('filtert im Unternehmens-Kontext auf unternehmen_id', async () => {
    const produkt = { id: 'pr1', name: 'Case', unternehmen_id: 'u1' };
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: produkt, error: null }))
    };
    window.supabase = { from: vi.fn(() => q) };

    const result = await ProduktService.loadOne('pr1', { unternehmenId: 'u1' });

    expect(q.eq).toHaveBeenCalledWith('unternehmen_id', 'u1');
    expect(result).toEqual(produkt);
  });
});
