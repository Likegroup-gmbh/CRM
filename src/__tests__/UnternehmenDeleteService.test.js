import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUnternehmenCascade, collectDependentIds, persistDeleteErrors, cleanupStorage, cleanupDropbox } from '../modules/unternehmen/services/UnternehmenDeleteService.js';

function createTrackingSupabase(config = {}) {
  const log = [];
  const entities = config.entities || {};
  const errors = config.errors || {};

  const mock = {
    from: vi.fn((table) => {
      const tableApi = {
        select: vi.fn(() => ({
          eq: vi.fn((col, val) => {
            log.push({ op: 'select', table, col, val });
            const rows = entities[table] || [];
            return Promise.resolve({ data: rows, error: null });
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((col, val) => {
            log.push({ op: 'delete', table, col, val });
            return Promise.resolve({ error: errors[table] || null });
          }),
          in: vi.fn((col, vals) => {
            log.push({ op: 'delete.in', table, col, vals });
            return Promise.resolve({ error: errors[table] || null });
          }),
        })),
        insert: vi.fn((rows) => {
          log.push({ op: 'insert', table, rows });
          return Promise.resolve({ error: null });
        }),
      };
      return tableApi;
    }),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        remove: vi.fn(() => Promise.resolve({ error: null })),
      })),
    },
    _log: log,
  };
  return mock;
}

describe('UnternehmenDeleteService', () => {

  describe('Löschreihenfolge', () => {

    it('löscht Entities in korrekter Bottom-Up-Reihenfolge vor dem Unternehmen', async () => {
      const sb = createTrackingSupabase({
        entities: {
          vertraege: [{ id: 'v1' }],
          briefings: [{ id: 'b1' }],
          kampagne: [{ id: 'k1' }],
          auftrag: [{ id: 'a1' }],
          produkt: [{ id: 'p1' }],
          marke: [{ id: 'm1' }],
        },
      });

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      const deletedTables = deleteOps.map(e => e.table);

      const expectedOrder = ['vertraege', 'briefings', 'kampagne', 'auftrag', 'produkt', 'marke', 'unternehmen'];
      const actualOrder = expectedOrder.filter(t => deletedTables.includes(t));

      expect(actualOrder).toEqual(expectedOrder);

      const unternehmenIdx = deletedTables.indexOf('unternehmen');
      expect(unternehmenIdx).toBe(deletedTables.length - 1);
    });
  });

  describe('Best-Effort bei Fehlern', () => {

    it('löscht weitere Entities auch wenn ein Schritt fehlschlägt', async () => {
      const sb = createTrackingSupabase({
        entities: {
          vertraege: [{ id: 'v1' }],
          briefings: [{ id: 'b1' }],
          kampagne: [{ id: 'k1' }],
          auftrag: [{ id: 'a1' }],
          produkt: [{ id: 'p1' }],
          marke: [{ id: 'm1' }],
        },
        errors: {
          kampagne: { message: 'FK violation' },
        },
      });

      const result = await deleteUnternehmenCascade('u1', { supabase: sb });

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      const deletedTables = deleteOps.map(e => e.table);

      expect(deletedTables).toContain('vertraege');
      expect(deletedTables).toContain('briefings');
      expect(deletedTables).toContain('kampagne');
      expect(deletedTables).toContain('auftrag');
      expect(deletedTables).toContain('produkt');
      expect(deletedTables).toContain('marke');
      expect(deletedTables).toContain('unternehmen');

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.step === 'kampagne')).toBe(true);
    });

    it('markiert success=false nur wenn das Unternehmen selbst nicht gelöscht werden kann', async () => {
      const sb = createTrackingSupabase({
        entities: {
          kampagne: [{ id: 'k1' }],
        },
        errors: {
          kampagne: { message: 'some error' },
        },
      });
      const noopFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

      const result = await deleteUnternehmenCascade('u1', { supabase: sb, fetch: noopFetch });

      expect(result.success).toBe(true);
      expect(result.errors.some(e => e.step === 'kampagne')).toBe(true);
    });

    it('markiert success=false wenn das Unternehmen selbst fehlschlägt', async () => {
      const sb = createTrackingSupabase({
        entities: {},
        errors: {
          unternehmen: { message: 'FK constraint' },
        },
      });

      const result = await deleteUnternehmenCascade('u1', { supabase: sb });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.step === 'unternehmen')).toBe(true);
    });
  });

  describe('Leerer Cascade', () => {

    it('löscht nur das Unternehmen wenn keine Abhängigkeiten existieren', async () => {
      const sb = createTrackingSupabase({ entities: {} });

      const result = await deleteUnternehmenCascade('u1', { supabase: sb });

      expect(result.success).toBe(true);

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      expect(deleteOps.length).toBe(1);
      expect(deleteOps[0].table).toBe('unternehmen');
    });

    it('führt trotzdem SELECT-Queries für alle Tabellen aus', async () => {
      const sb = createTrackingSupabase({ entities: {} });

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const selectOps = sb._log.filter(e => e.op === 'select');
      const queriedTables = selectOps.map(e => e.table);
      expect(queriedTables).toContain('vertraege');
      expect(queriedTables).toContain('briefings');
      expect(queriedTables).toContain('kampagne');
      expect(queriedTables).toContain('auftrag');
      expect(queriedTables).toContain('produkt');
      expect(queriedTables).toContain('marke');
    });
  });

  describe('Ergebnis-Zähler', () => {

    it('zählt gelöschte Entities korrekt pro Tabelle', async () => {
      const sb = createTrackingSupabase({
        entities: {
          vertraege: [{ id: 'v1' }, { id: 'v2' }],
          kampagne: [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }],
          marke: [{ id: 'm1' }],
        },
      });

      const result = await deleteUnternehmenCascade('u1', { supabase: sb });

      expect(result.deleted.vertraege).toBe(2);
      expect(result.deleted.kampagne).toBe(3);
      expect(result.deleted.marke).toBe(1);
      expect(result.deleted.unternehmen).toBe(1);
      expect(result.deleted.briefings).toBeUndefined();
      expect(result.deleted.auftrag).toBeUndefined();
    });

    it('sammelt Fehler mit step und error message', async () => {
      const sb = createTrackingSupabase({
        entities: {
          kampagne: [{ id: 'k1' }],
          auftrag: [{ id: 'a1' }],
        },
        errors: {
          kampagne: { message: 'FK violation on kooperationen' },
          auftrag: { message: 'timeout' },
        },
      });
      const noopFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

      const result = await deleteUnternehmenCascade('u1', { supabase: sb, fetch: noopFetch });

      const dbErrors = result.errors.filter(e => ['kampagne', 'auftrag'].includes(e.step));
      expect(dbErrors).toHaveLength(2);
      expect(dbErrors[0]).toEqual({ step: 'kampagne', error: 'FK violation on kooperationen' });
      expect(dbErrors[1]).toEqual({ step: 'auftrag', error: 'timeout' });

      expect(result.deleted.kampagne).toBeUndefined();
      expect(result.deleted.auftrag).toBeUndefined();
    });
  });

  describe('Ansprechpartner-Handling', () => {

    it('löscht Ansprechpartner NICHT aus der ansprechpartner-Tabelle', async () => {
      const sb = createTrackingSupabase({
        entities: {
          marke: [{ id: 'm1' }],
        },
      });

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      const deletedTables = deleteOps.map(e => e.table);
      expect(deletedTables).not.toContain('ansprechpartner');
    });

    it('löscht auch nicht aus ansprechpartner_unternehmen (das macht DB CASCADE)', async () => {
      const sb = createTrackingSupabase({ entities: {} });

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      const deletedTables = deleteOps.map(e => e.table);
      expect(deletedTables).not.toContain('ansprechpartner_unternehmen');
    });
  });

  describe('collectDependentIds', () => {

    it('gibt IDs pro Tabelle zurück ohne etwas zu löschen', async () => {
      const sb = createTrackingSupabase({
        entities: {
          kampagne: [{ id: 'k1' }, { id: 'k2' }],
          marke: [{ id: 'm1' }],
        },
      });

      const deps = await collectDependentIds('u1', { supabase: sb });

      expect(deps.kampagne).toEqual(['k1', 'k2']);
      expect(deps.marke).toEqual(['m1']);
      expect(deps.vertraege).toEqual([]);

      const deleteOps = sb._log.filter(e => e.op === 'delete' || e.op === 'delete.in');
      expect(deleteOps).toHaveLength(0);
    });
  });

  describe('onProgress Callback', () => {

    it('ruft onProgress für jeden Löschschritt auf', async () => {
      const sb = createTrackingSupabase({
        entities: {
          kampagne: [{ id: 'k1' }, { id: 'k2' }],
          marke: [{ id: 'm1' }],
        },
      });
      const progressLog = [];
      const onProgress = (p) => progressLog.push(p);

      await deleteUnternehmenCascade('u1', { supabase: sb, onProgress });

      expect(progressLog).toContainEqual({ step: 'kampagne', count: 2 });
      expect(progressLog).toContainEqual({ step: 'marke', count: 1 });
      expect(progressLog).toContainEqual({ step: 'unternehmen', count: 1 });

      expect(progressLog.some(p => p.step === 'vertraege')).toBe(false);
    });
  });

  describe('persistDeleteErrors', () => {

    function createInsertTrackingSupabase(insertConfig = {}) {
      const log = [];
      return {
        from: vi.fn((table) => ({
          insert: vi.fn((rows) => {
            log.push({ op: 'insert', table, rows });
            return Promise.resolve({ error: insertConfig.insertError || null });
          }),
        })),
        _log: log,
      };
    }

    it('schreibt Fehler in delete_logs Tabelle', async () => {
      const sb = createInsertTrackingSupabase();
      const errors = [
        { step: 'kampagne', error: 'FK violation' },
        { step: 'storage_logos', error: 'Bucket not found' },
      ];

      await persistDeleteErrors('u1', errors, { supabase: sb, userId: 'user-1' });

      const inserts = sb._log.filter(e => e.op === 'insert' && e.table === 'delete_logs');
      expect(inserts).toHaveLength(1);

      const rows = inserts[0].rows;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        deleted_entity_type: 'unternehmen',
        deleted_entity_id: 'u1',
        failed_step: 'kampagne',
        error_message: 'FK violation',
        created_by: 'user-1',
      });
      expect(rows[1]).toMatchObject({
        failed_step: 'storage_logos',
        error_message: 'Bucket not found',
      });
    });

    it('macht nichts wenn errors leer ist', async () => {
      const sb = createInsertTrackingSupabase();

      await persistDeleteErrors('u1', [], { supabase: sb });

      const inserts = sb._log.filter(e => e.op === 'insert');
      expect(inserts).toHaveLength(0);
    });

    it('fängt DB-Insert-Fehler ab und loggt in Console statt zu crashen', async () => {
      const sb = createInsertTrackingSupabase({ insertError: { message: 'RLS denied' } });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await persistDeleteErrors('u1', [{ step: 'kampagne', error: 'test' }], { supabase: sb });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('deleteUnternehmenCascade mit Error-Logging', () => {

    it('ruft persistDeleteErrors auf wenn Fehler aufgetreten sind', async () => {
      const log = [];
      const sb = {
        from: vi.fn((table) => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => {
              if (table === 'kampagne') return Promise.resolve({ data: [{ id: 'k1' }], error: null });
              return Promise.resolve({ data: [], error: null });
            }),
          })),
          delete: vi.fn(() => ({
            in: vi.fn(() => {
              if (table === 'kampagne') return Promise.resolve({ error: { message: 'oops' } });
              return Promise.resolve({ error: null });
            }),
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn((rows) => {
            log.push({ table, rows });
            return Promise.resolve({ error: null });
          }),
        })),
      };

      await deleteUnternehmenCascade('u1', { supabase: sb, userId: 'admin-1' });

      const logInserts = log.filter(e => e.table === 'delete_logs');
      expect(logInserts).toHaveLength(1);
      expect(logInserts[0].rows[0].failed_step).toBe('kampagne');
    });

    it('ruft persistDeleteErrors NICHT auf wenn keine Fehler', async () => {
      const log = [];
      const sb = {
        from: vi.fn((table) => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn((rows) => {
            log.push({ table, rows });
            return Promise.resolve({ error: null });
          }),
        })),
        storage: {
          from: vi.fn(() => ({
            list: vi.fn(() => Promise.resolve({ data: [], error: null })),
            remove: vi.fn(() => Promise.resolve({ error: null })),
          })),
        },
      };

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const logInserts = log.filter(e => e.table === 'delete_logs');
      expect(logInserts).toHaveLength(0);
    });
  });

  describe('cleanupStorage', () => {

    function createStorageTrackingSupabase() {
      const log = [];
      return {
        storage: {
          from: vi.fn((bucket) => ({
            list: vi.fn((path) => {
              log.push({ op: 'list', bucket, path });
              if (bucket === 'logos' && path === 'unternehmen/u1') {
                return Promise.resolve({ data: [{ name: 'logo.png' }], error: null });
              }
              if (bucket === 'vertraege' && path === 'unternehmen/u1') {
                return Promise.resolve({ data: [{ name: 'vertrag1.pdf' }, { name: 'vertrag2.pdf' }], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }),
            remove: vi.fn((paths) => {
              log.push({ op: 'remove', bucket, paths });
              return Promise.resolve({ error: null });
            }),
          })),
        },
        _log: log,
      };
    }

    it('löscht Logo-Dateien aus dem logos-Bucket', async () => {
      const sb = createStorageTrackingSupabase();

      const result = await cleanupStorage('u1', { supabase: sb });

      const removeOps = sb._log.filter(e => e.op === 'remove' && e.bucket === 'logos');
      expect(removeOps).toHaveLength(1);
      expect(removeOps[0].paths).toEqual(['unternehmen/u1/logo.png']);
      expect(result.errors).toHaveLength(0);
    });

    it('löscht Vertrags-Dateien aus dem vertraege-Bucket', async () => {
      const sb = createStorageTrackingSupabase();

      await cleanupStorage('u1', { supabase: sb });

      const removeOps = sb._log.filter(e => e.op === 'remove' && e.bucket === 'vertraege');
      expect(removeOps).toHaveLength(1);
      expect(removeOps[0].paths).toEqual(['unternehmen/u1/vertrag1.pdf', 'unternehmen/u1/vertrag2.pdf']);
    });

    it('macht nichts wenn Buckets leer sind', async () => {
      const log = [];
      const sb = {
        storage: {
          from: vi.fn(() => ({
            list: vi.fn(() => {
              return Promise.resolve({ data: [], error: null });
            }),
            remove: vi.fn((paths) => {
              log.push(paths);
              return Promise.resolve({ error: null });
            }),
          })),
        },
      };

      const result = await cleanupStorage('u1', { supabase: sb });

      expect(log).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('wird von deleteUnternehmenCascade aufgerufen', async () => {
      const log = [];
      const sb = {
        from: vi.fn((table) => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        })),
        storage: {
          from: vi.fn((bucket) => ({
            list: vi.fn((path) => {
              log.push({ op: 'storage.list', bucket, path });
              if (bucket === 'logos') {
                return Promise.resolve({ data: [{ name: 'logo.png' }], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }),
            remove: vi.fn((paths) => {
              log.push({ op: 'storage.remove', bucket, paths });
              return Promise.resolve({ error: null });
            }),
          })),
        },
      };

      await deleteUnternehmenCascade('u1', { supabase: sb });

      const storageOps = log.filter(e => e.op === 'storage.remove');
      expect(storageOps.length).toBeGreaterThan(0);
      expect(storageOps[0].bucket).toBe('logos');
    });

    it('sammelt Fehler statt zu crashen bei Storage-Problemen', async () => {
      const sb = {
        storage: {
          from: vi.fn(() => ({
            list: vi.fn(() => Promise.resolve({ data: null, error: { message: 'bucket not found' } })),
            remove: vi.fn(),
          })),
        },
      };

      const result = await cleanupStorage('u1', { supabase: sb });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].step).toContain('storage');
    });
  });

  describe('cleanupDropbox', () => {

    it('ruft deleteDropboxCascade für jede Kampagne auf', async () => {
      const fetchLog = [];
      const mockFetch = vi.fn(async (url, opts) => {
        fetchLog.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      const result = await cleanupDropbox(['k1', 'k2'], [], { fetch: mockFetch });

      expect(fetchLog).toHaveLength(2);
      expect(fetchLog[0].body).toEqual({ entityType: 'kampagne', entityId: 'k1' });
      expect(fetchLog[1].body).toEqual({ entityType: 'kampagne', entityId: 'k2' });
      expect(result.errors).toHaveLength(0);
    });

    it('ruft deleteDropboxCascade für verwaiste Kooperationen auf', async () => {
      const fetchLog = [];
      const mockFetch = vi.fn(async (url, opts) => {
        fetchLog.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      });

      const result = await cleanupDropbox([], ['koop1', 'koop2'], { fetch: mockFetch });

      expect(fetchLog).toHaveLength(2);
      expect(fetchLog[0].body).toEqual({ entityType: 'kooperation', entityId: 'koop1' });
      expect(fetchLog[1].body).toEqual({ entityType: 'kooperation', entityId: 'koop2' });
    });

    it('sammelt Dropbox-Fehler statt abzubrechen', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Dropbox API down' }),
      }));

      const result = await cleanupDropbox(['k1', 'k2'], [], { fetch: mockFetch });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].step).toBe('dropbox_kampagne_k1');
    });

    it('macht nichts wenn keine Kampagnen und keine Kooperationen', async () => {
      const mockFetch = vi.fn();

      const result = await cleanupDropbox([], [], { fetch: mockFetch });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(0);
    });
  });
});
