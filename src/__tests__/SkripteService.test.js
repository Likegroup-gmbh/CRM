import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkripteService } from '../modules/skripte/SkripteService.js';

function setupWindow(overrides = {}) {
  window.isAdmin = vi.fn(() => overrides.isAdmin ?? false);
  window.isMitarbeiter = vi.fn(() => overrides.isMitarbeiter ?? false);
  window.isKunde = vi.fn(() => overrides.isKunde ?? false);
  window.currentUser = overrides.currentUser ?? { id: 'user-1', rolle: 'mitarbeiter' };
  window.supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  };
}

function skript(overrides = {}) {
  return {
    id: 's1',
    titel: 'Test',
    unternehmen_id: 'u1',
    marke_id: 'm1',
    kampagne_id: 'k1',
    ...overrides
  };
}

describe('SkripteService.loadSkripte', () => {
  let service;

  beforeEach(() => {
    service = new SkripteService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gibt RLS-gefilterte Rows durch (keine Client-Filterung mehr)', async () => {
    setupWindow({ isMitarbeiter: true });

    const rows = [skript({ id: 'a' }), skript({ id: 'b', kampagne_id: 'k2' })];
    const select = vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: rows, error: null }))
      }))
    }));
    window.supabase.from = vi.fn(() => ({ select }));

    const result = await service.loadSkripte();
    expect(result).toHaveLength(2);
    expect(select).toHaveBeenCalledWith(expect.stringContaining('unternehmen(id, firmenname, internes_kuerzel, logo_url)'));
    expect(select).toHaveBeenCalledWith(expect.stringContaining('marke(id, markenname, logo_url)'));
    expect(select).toHaveBeenCalledWith(expect.stringContaining('kampagne(id, kampagnenname, eigener_name)'));
  });

  it('getVersionen selektiert Visual-Felder', async () => {
    setupWindow({ isMitarbeiter: true });
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }));
    window.supabase.from = vi.fn(() => ({ select }));

    await service.getVersionen('s1');
    expect(select).toHaveBeenCalledWith(expect.stringContaining('hook_visuell'));
    expect(select).toHaveBeenCalledWith(expect.stringContaining('hauptteil_visuell'));
    expect(select).toHaveBeenCalledWith(expect.stringContaining('cta_visuell'));
  });

  it('wirft bei Query-Fehler statt still [] zu liefern', async () => {
    setupWindow({ isAdmin: true });
    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: null, error: { message: 'PGRST200 boom' } }))
        }))
      }))
    }));

    await expect(service.loadSkripte()).rejects.toThrow('PGRST200 boom');
  });
});

describe('SkripteService.loadSkript', () => {
  let service;

  beforeEach(() => {
    service = new SkripteService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gibt Skript zurueck', async () => {
    setupWindow({ isAdmin: true });

    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: skript(), error: null }))
        }))
      }))
    }));

    const result = await service.loadSkript('s1');
    expect(result).not.toBeNull();
  });

  it('nicht sichtbar (RLS) -> null, kein Fehler', async () => {
    setupWindow({ isMitarbeiter: true });

    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }));

    const result = await service.loadSkript('s1');
    expect(result).toBeNull();
  });

  it('wirft bei Query-Fehler (z.B. kaputter Embed)', async () => {
    setupWindow({ isAdmin: true });

    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Could not find a relationship' } }))
        }))
      }))
    }));

    await expect(service.loadSkript('s1')).rejects.toThrow('Could not find a relationship');
  });
});

function mockBriefingsBuilder(rows, captured) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn((k, v) => { captured.eq[k] = v; return api; }),
    or: vi.fn((expr) => { captured.or = expr; return api; }),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null }))
  };
  return api;
}

describe('SkripteService.loadBriefings', () => {
  let service;

  beforeEach(() => {
    service = new SkripteService();
  });

  it('ohne Unternehmen leere Liste, keine Query', async () => {
    setupWindow();
    const result = await service.loadBriefings(null);
    expect(result).toEqual([]);
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('filtert Unternehmen + is_draft=false, ohne Marke kein or()', async () => {
    setupWindow();
    const captured = { eq: {}, or: null };
    const rows = [{ id: 'b1', aktivierung_name: 'Glow', bereich: 'influencer_marketing', is_draft: false }];
    window.supabase.from = vi.fn(() => mockBriefingsBuilder(rows, captured));

    const result = await service.loadBriefings('u1');
    expect(window.supabase.from).toHaveBeenCalledWith('campaign_briefings');
    expect(captured.eq.unternehmen_id).toBe('u1');
    expect(captured.eq.is_draft).toBe(false);
    expect(captured.or).toBeNull();
    expect(result).toEqual(rows);
  });

  it('mit Marke: marke_id = Y OR marke_id IS NULL', async () => {
    setupWindow();
    const captured = { eq: {}, or: null };
    window.supabase.from = vi.fn(() => mockBriefingsBuilder([], captured));

    await service.loadBriefings('u1', 'm9');
    expect(captured.or).toBe('marke_id.eq.m9,marke_id.is.null');
  });
});

describe('SkripteService.createSkriptStub / updateSkriptStub', () => {
  let service;

  beforeEach(() => {
    service = new SkripteService();
  });

  it('createSkriptStub schreibt briefing_id', async () => {
    setupWindow();
    let inserted = null;
    window.supabase.auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) };
    window.supabase.from = vi.fn(() => ({
      insert: vi.fn((row) => {
        inserted = row;
        return { select: () => ({ single: async () => ({ data: { id: 's1', ...row }, error: null }) }) };
      })
    }));

    await service.createSkriptStub({
      unternehmen_id: 'u1',
      briefing_id: 'br-1',
      video_idee: 'Glow Routine'
    });
    expect(inserted.briefing_id).toBe('br-1');
    expect(inserted.prompt_kontext.generator_payload.briefing_id).toBe('br-1');
  });

  it('updateSkriptStub schreibt briefing_id und merged prompt_kontext', async () => {
    setupWindow();
    let updated = null;
    window.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { prompt_kontext: { leftover: true } }, error: null }))
        }))
      })),
      update: vi.fn((row) => {
        updated = row;
        return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 's1', ...row }, error: null }) }) }) };
      })
    }));

    await service.updateSkriptStub('s1', {
      unternehmen_id: 'u1',
      briefing_id: 'br-2',
      video_idee: 'Neu'
    });
    expect(updated.briefing_id).toBe('br-2');
    expect(updated.prompt_kontext.leftover).toBe(true);
    expect(updated.prompt_kontext.generator_payload.briefing_id).toBe('br-2');
  });
});
