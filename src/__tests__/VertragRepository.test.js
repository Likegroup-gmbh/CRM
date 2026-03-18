import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VertragRepository } from '../modules/vertrag/VertragRepository.js';

describe('VertragRepository', () => {
  let repo;
  let mockData;

  beforeEach(() => {
    vi.clearAllMocks();

    mockData = [
      { id: 'v1', kooperation_id: 'k1', kampagne_id: 'kamp1', creator_id: 'c1', typ: 'UGC', is_draft: false, datei_url: 'https://x.com/v1.pdf' },
      { id: 'v2', kooperation_id: 'k1', kampagne_id: 'kamp1', creator_id: 'c1', typ: 'Model', is_draft: false, dropbox_file_url: 'https://dropbox.com/v2.pdf' },
      { id: 'v3', kooperation_id: 'k2', kampagne_id: 'kamp1', creator_id: 'c2', typ: 'UGC', is_draft: true },
    ];

    window.supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((col, val) => {
            const filtered = mockData.filter(v => v[col] === val);
            return Promise.resolve({ data: filtered, error: null });
          }),
          in: vi.fn((col, vals) => {
            const filtered = mockData.filter(v => vals.includes(v[col]));
            return Promise.resolve({ data: filtered, error: null });
          }),
        })),
      })),
    };

    repo = new VertragRepository();
  });

  describe('loadByKooperation', () => {
    it('lädt Verträge einer Kooperation', async () => {
      const result = await repo.loadByKooperation('k1');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].kooperation_id).toBe('k1');
      expect(result.error).toBeNull();
    });

    it('gibt leeres Array bei unbekannter Kooperation', async () => {
      const result = await repo.loadByKooperation('unknown');
      expect(result.data).toHaveLength(0);
      expect(result.error).toBeNull();
    });
  });

  describe('loadByKampagne', () => {
    it('lädt Verträge einer Kampagne', async () => {
      const result = await repo.loadByKampagne('kamp1');
      expect(result.data).toHaveLength(3);
      expect(result.error).toBeNull();
    });
  });
});
