import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';

function setupWindow(overrides = {}) {
  window.isAdmin = vi.fn(() => overrides.isAdmin ?? false);
  window.isKunde = vi.fn(() => overrides.isKunde ?? false);
  window.isInvestor = vi.fn(() => overrides.isInvestor ?? false);
  window.isMitarbeiter = vi.fn(() => overrides.isMitarbeiter ?? false);
  window.checkUserPermission = vi.fn((entity, action) => {
    if (overrides.permissions === false) return false;
    return overrides.permissions?.[entity]?.[`can_${action}`] ?? true;
  });
  window.currentUser = overrides.currentUser ?? { id: 'user-1', rolle: 'mitarbeiter' };
}

function createMockSupabase({ listeData, listenData, allowedKampagnen, deleteError } = {}) {
  const deleteFn = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: deleteError || null })),
  }));

  window.supabase = {
    from: vi.fn((table) => {
      if (table === 'creator_auswahl') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: listeData || null, error: null })),
            })),
            order: vi.fn(() => Promise.resolve({
              data: listenData ?? (listeData ? [listeData] : []),
              error: null
            })),
          })),
          delete: deleteFn,
        };
      }
      if (table === 'creator_auswahl_items') {
        return { delete: deleteFn };
      }
      if (table === 'kampagne_mitarbeiter') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({
              data: (allowedKampagnen || []).map(id => ({ kampagne_id: id })),
              error: null,
            })),
          })),
        };
      }
      if (table === 'mitarbeiter_unternehmen') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      if (table === 'marke_mitarbeiter') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        delete: deleteFn,
      };
    }),
  };
  return deleteFn;
}

describe('CreatorAuswahlService', () => {
  let service;

  beforeEach(() => {
    service = new CreatorAuswahlService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deleteListe', () => {
    it('Admin darf jede Liste löschen', async () => {
      setupWindow({ isAdmin: true });
      const deleteFn = createMockSupabase({ listeData: { id: 'l1', kampagne_id: 'k1' } });

      await service.deleteListe('l1');
      expect(deleteFn).toHaveBeenCalled();
    });

    it('Mitarbeiter im Scope darf Liste löschen', async () => {
      setupWindow({ isMitarbeiter: true });
      const deleteFn = createMockSupabase({
        listeData: { id: 'l1', kampagne_id: 'k1' },
        allowedKampagnen: ['k1'],
      });

      await service.deleteListe('l1');
      expect(deleteFn).toHaveBeenCalled();
    });

    it('Mitarbeiter außerhalb des Scopes wird blockiert', async () => {
      setupWindow({ isMitarbeiter: true });
      createMockSupabase({
        listeData: { id: 'l1', kampagne_id: 'k-other' },
        allowedKampagnen: ['k1'],
      });

      await expect(service.deleteListe('l1')).rejects.toThrow('außerhalb des zugewiesenen Bereichs');
    });

    it('Mitarbeiter kann Liste ohne kampagne_id nicht löschen', async () => {
      setupWindow({ isMitarbeiter: true });
      createMockSupabase({
        listeData: { id: 'l1', kampagne_id: null },
        allowedKampagnen: ['k1'],
      });

      await expect(service.deleteListe('l1')).rejects.toThrow('ohne Kampagnen-Zuordnung');
    });

    it('Kunde wird immer blockiert', async () => {
      setupWindow({ isKunde: true });
      createMockSupabase({ listeData: { id: 'l1', kampagne_id: 'k1' } });

      await expect(service.deleteListe('l1')).rejects.toThrow('Keine Berechtigung');
    });

    it('blockiert bei fehlendem sourcing.can_delete', async () => {
      setupWindow({
        isMitarbeiter: true,
        permissions: { sourcing: { can_delete: false } },
      });
      createMockSupabase({ listeData: { id: 'l1', kampagne_id: 'k1' } });

      await expect(service.deleteListe('l1')).rejects.toThrow('Keine Berechtigung');
    });
  });

  describe('deleteItem', () => {
    it('Mitarbeiter darf Items löschen', async () => {
      setupWindow({ isMitarbeiter: true });
      const deleteFn = createMockSupabase();

      await service.deleteItem('item-1');
      expect(deleteFn).toHaveBeenCalled();
    });

    it('Kunde wird beim Item-Löschen blockiert', async () => {
      setupWindow({ isKunde: true });
      createMockSupabase();

      await expect(service.deleteItem('item-1')).rejects.toThrow('Keine Berechtigung');
    });

    it('blockiert bei fehlendem sourcing.can_delete', async () => {
      setupWindow({
        isMitarbeiter: true,
        permissions: { sourcing: { can_delete: false } },
      });
      createMockSupabase();

      await expect(service.deleteItem('item-1')).rejects.toThrow('Keine Berechtigung');
    });
  });

  describe('getAllListen', () => {
    it('lädt als Investor alle Listen ohne Kampagnen-Filter', async () => {
      setupWindow({ isInvestor: true, currentUser: { id: 'inv-1', rolle: 'investor' } });
      createMockSupabase({
        listenData: [
          { id: 'l1', kampagne_id: 'k-other', creator_auswahl_items: [{ count: 2 }] },
          { id: 'l2', kampagne_id: 'k1', creator_auswahl_items: [{ count: 0 }] }
        ]
      });

      const listen = await service.getAllListen();
      expect(listen).toHaveLength(2);
      expect(window.supabase.from).toHaveBeenCalledWith('creator_auswahl');
      expect(window.supabase.from).not.toHaveBeenCalledWith('kampagne_mitarbeiter');
      expect(window.supabase.from).not.toHaveBeenCalledWith('mitarbeiter_unternehmen');
    });
  });
});
