import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';

describe('KampagneUtils.loadAllowedKampagneIds', () => {
  beforeEach(() => {
    KampagneUtils.invalidatePermissionCache();
    window.currentUser = { id: 'u1' };
    window.isAdmin = vi.fn(() => false);
    window.isKunde = vi.fn(() => false);
    window.isUnscoped = vi.fn(() => false);
    window.supabase = { from: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('liefert null ohne Joins wenn isUnscoped', async () => {
    window.isUnscoped = vi.fn(() => true);
    await expect(KampagneUtils.loadAllowedKampagneIds()).resolves.toBeNull();
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('liefert null für Admin', async () => {
    window.isAdmin = vi.fn(() => true);
    await expect(KampagneUtils.loadAllowedKampagneIds()).resolves.toBeNull();
    expect(window.supabase.from).not.toHaveBeenCalled();
  });
});
