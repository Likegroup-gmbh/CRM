import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonaService } from '../modules/persona/PersonaService.js';

function makeQuery(result) {
  const q = {
    select: vi.fn(() => q),
    not: vi.fn(() => q),
    order: vi.fn(() => q),
    eq: vi.fn(() => q),
    then: (resolve) => resolve(result)
  };
  return q;
}

describe('PersonaService.loadAll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('laedt alle Personas mit Unternehmen und filtert DNA-Personas ohne unternehmen_id', async () => {
    const data = [
      { id: 'p1', name: 'Sarah', unternehmen_id: 'u1', unternehmen: { id: 'u1', firmenname: 'Acme' } },
      { id: 'p2', name: 'Tom', unternehmen_id: 'u2', unternehmen: { id: 'u2', firmenname: 'Beta' } }
    ];
    const query = makeQuery({ data, error: null });
    window.supabase = { from: vi.fn(() => query) };

    const result = await PersonaService.loadAll();

    expect(window.supabase.from).toHaveBeenCalledWith('personas');
    expect(query.not).toHaveBeenCalledWith('unternehmen_id', 'is', null);
    expect(result).toEqual(data);
  });

  it('wirft bei Supabase-Fehlern', async () => {
    const query = makeQuery({ data: null, error: new Error('RLS denied') });
    window.supabase = { from: vi.fn(() => query) };

    await expect(PersonaService.loadAll()).rejects.toThrow('RLS denied');
  });

  it('gibt leeres Array bei leerem Ergebnis zurueck', async () => {
    const query = makeQuery({ data: null, error: null });
    window.supabase = { from: vi.fn(() => query) };

    const result = await PersonaService.loadAll();
    expect(result).toEqual([]);
  });
});

describe('PersonaService.loadOne', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filtert im Standalone nicht auf unternehmen_id', async () => {
    const persona = { id: 'p1', name: 'Sarah', unternehmen_id: 'u1' };
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: persona, error: null }))
    };
    window.supabase = { from: vi.fn(() => q) };

    const result = await PersonaService.loadOne('p1');

    expect(q.select).toHaveBeenCalledWith('*');
    expect(result).toEqual(persona);
  });

  it('filtert im Unternehmens-Kontext auf unternehmen_id', async () => {
    const persona = { id: 'p1', name: 'Sarah', unternehmen_id: 'u1' };
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: persona, error: null }))
    };
    window.supabase = { from: vi.fn(() => q) };

    const result = await PersonaService.loadOne('p1', { unternehmenId: 'u1' });

    expect(q.eq).toHaveBeenCalledWith('unternehmen_id', 'u1');
    expect(result).toEqual(persona);
  });
});
