import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuftragsdetailsRepository } from '../modules/auftrag/repository/AuftragsdetailsRepository.js';

describe('AuftragsdetailsRepository', () => {
  let repository;
  let upsertMock;
  let selectMock;
  let singleMock;

  beforeEach(() => {
    singleMock = vi.fn(async () => ({ data: { id: 'detail-1' }, error: null }));
    selectMock = vi.fn(() => ({ single: singleMock }));
    upsertMock = vi.fn(() => ({ select: selectMock }));

    window.supabase = {
      from: vi.fn(() => ({
        upsert: upsertMock
      }))
    };

    repository = new AuftragsdetailsRepository();
  });

  it('speichert Auftragsdetails via upsert mit onConflict auftrag_id', async () => {
    const payload = {
      auftrag_id: 'a1',
      kampagnenanzahl: 3,
      ugc_pro_paid_video_anzahl: null,
      ugc_pro_organic_video_anzahl: 4
    };
    const result = await repository.upsertAuftragsdetails(payload);

    expect(window.supabase.from).toHaveBeenCalledWith('auftrag_details');
    expect(upsertMock).toHaveBeenCalledWith([payload], { onConflict: 'auftrag_id' });
    expect(selectMock).toHaveBeenCalled();
    expect(singleMock).toHaveBeenCalled();
    expect(result).toEqual({ id: 'detail-1' });
  });
});
