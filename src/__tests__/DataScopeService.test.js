import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataScopeService } from '../core/DataScopeService.js';

describe('DataScopeService isUnscoped', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.isUnscoped = undefined;
    window.permissionSystem = undefined;
    window.currentUser = { id: 'u1', rolle: 'mitarbeiter' };
    window.supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    };
  });

  it('liefert null ohne Joins wenn isUnscoped true', async () => {
    window.isUnscoped = () => true;
    const ds = new DataScopeService();
    await expect(ds.getAllowedUnternehmenIds()).resolves.toBeNull();
    await expect(ds.getAllowedMarkenIds()).resolves.toBeNull();
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('scoped Mitarbeiter ohne isUnscoped', async () => {
    window.isUnscoped = () => false;
    const ds = new DataScopeService();
    const ids = await ds.getAllowedUnternehmenIds();
    expect(ids).toEqual([]);
    expect(window.supabase.from).toHaveBeenCalled();
  });
});
