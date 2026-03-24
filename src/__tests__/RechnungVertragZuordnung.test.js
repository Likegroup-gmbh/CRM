import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSignedVertragForKooperation } from '../modules/rechnung/RechnungVertragZuordnung.js';

describe('RechnungVertragZuordnung', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt vertragId des unterschriebenen Vertrags zurueck', async () => {
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'kooperationen') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { id: 'k1', creator_id: 'c1', kampagne_id: 'kamp1' },
                  error: null
                }))
              }))
            }))
          };
        }
        if (table === 'vertraege') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: [{ id: 'v1', unterschriebener_vertrag_url: 'https://signed.pdf' }],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          };
        }
      })
    };

    const result = await findSignedVertragForKooperation('k1', mockSupabase);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBe('v1');
  });

  it('gibt vertragId null wenn kein unterschriebener Vertrag existiert', async () => {
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'kooperationen') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { id: 'k1', creator_id: 'c1', kampagne_id: 'kamp1' },
                  error: null
                }))
              }))
            }))
          };
        }
        if (table === 'vertraege') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: [],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          };
        }
      })
    };

    const result = await findSignedVertragForKooperation('k1', mockSupabase);
    expect(result.ok).toBe(false);
    expect(result.vertragId).toBeNull();
  });

  it('gibt vertragId null wenn Vertrag existiert aber nicht unterschrieben ist', async () => {
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'kooperationen') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { id: 'k1', creator_id: 'c1', kampagne_id: 'kamp1' },
                  error: null
                }))
              }))
            }))
          };
        }
        if (table === 'vertraege') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: [{ id: 'v1', unterschriebener_vertrag_url: null, dropbox_file_url: null }],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          };
        }
      })
    };

    const result = await findSignedVertragForKooperation('k1', mockSupabase);
    expect(result.ok).toBe(true);
    expect(result.vertragId).toBeNull();
  });

  it('gibt Fehler wenn Kooperation nicht gefunden wird', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Not found' }
            }))
          }))
        }))
      }))
    };

    const result = await findSignedVertragForKooperation('unknown', mockSupabase);
    expect(result.ok).toBe(false);
    expect(result.vertragId).toBeNull();
    expect(result.message).toBeTruthy();
  });

});
