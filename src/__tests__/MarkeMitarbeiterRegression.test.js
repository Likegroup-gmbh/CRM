/**
 * Regressionstests: Marken-Mitarbeiter-Zuordnung und Rechte (Override-Semantik, Persistenz).
 * Siehe auch docs/regression-marke-mitarbeiter.md für manuelle Testfälle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarkeService } from '../modules/marke/services/MarkeService.js';
import { permissionSystem } from '../core/PermissionSystem.js';

const emptyTable = () => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })), then(fn) { return Promise.resolve({ data: [], error: null }).then(fn); } })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
  insert: vi.fn(() => Promise.resolve({ error: null })),
  upsert: vi.fn(() => Promise.resolve({ error: null }))
});

describe('Marken-Mitarbeiter: Rechte Override-Semantik', () => {
  afterEach(() => {
    window.currentUser = undefined;
  });

  it('getAllowedMarkenIds: Admin gibt null zurück', async () => {
    window.currentUser = { id: 'admin-1', rolle: 'admin' };
    window.supabase = { from: vi.fn(emptyTable) };
    const ids = await permissionSystem.getAllowedMarkenIds();
    expect(ids).toBeNull();
  });

  it('getAllowedMarkenIds: Kein User gibt [] zurück', async () => {
    window.currentUser = null;
    window.supabase = { from: vi.fn(emptyTable) };
    const ids = await permissionSystem.getAllowedMarkenIds();
    expect(ids).toEqual([]);
  });

  it('getAllowedMarkenIds: Kunde gibt null zurück', async () => {
    window.currentUser = { id: 'k-1', rolle: 'kunde' };
    window.supabase = { from: vi.fn(emptyTable) };
    const ids = await permissionSystem.getAllowedMarkenIds();
    expect(ids).toBeNull();
  });
});

describe('Marken-Mitarbeiter: saveMitarbeiterToMarke', () => {
  it('wirft bei Löschfehler', async () => {
    window.supabase = {
      from: vi.fn((table) => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'RLS blocked' } })) })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        upsert: vi.fn(() => Promise.resolve({ error: null }))
      }))
    };

    await expect(
      MarkeService.saveMitarbeiterToMarke('marke-1', { mitarbeiter_ids: ['user-1'] }, null, { deleteExisting: true })
    ).rejects.toThrow(/zurückgesetzt/);
  });

  it('dedupliziert Einträge nach (marke_id, mitarbeiter_id, role)', async () => {
    const inserted = [];
    window.supabase = {
      from: vi.fn((table) => {
        const base = {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
          delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          insert: vi.fn((rows) => {
            inserted.push(...(Array.isArray(rows) ? rows : [rows]));
            return Promise.resolve({ error: null });
          }),
          upsert: vi.fn(() => Promise.resolve({ error: null }))
        };
        if (table === 'marke_mitarbeiter') return base;
        return { ...base, insert: vi.fn(() => Promise.resolve({ error: null })) };
      })
    };

    const data = {
      management_ids: ['user-a', 'user-a'],
      mitarbeiter_ids: ['user-a']
    };
    await MarkeService.saveMitarbeiterToMarke('marke-1', data, null, { deleteExisting: true });

    const keys = inserted.map(r => `${r.marke_id}|${r.mitarbeiter_id}|${r.role}`);
    expect(keys.length).toBe([...new Set(keys)].length);
    expect(inserted.some(r => r.role === 'management')).toBe(true);
    expect(inserted.some(r => r.role === 'mitarbeiter')).toBe(true);
  });
});
