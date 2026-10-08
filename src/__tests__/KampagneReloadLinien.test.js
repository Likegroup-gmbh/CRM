import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/kampagne/KampagneDetailDataLoader.js', () => ({
  loadCriticalData: vi.fn(),
  loadFullTableData: vi.fn()
}));

vi.mock('../modules/produktion/ProduktionService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProduktion: vi.fn()
}));

import { loadProduktion } from '../modules/produktion/ProduktionService.js';
import { KampagneDetail } from '../modules/kampagne/KampagneDetail.js';

const linie = (id, name = id) => ({ id, name, is_draft: false });

function detailStub() {
  const detail = new KampagneDetail();
  detail._isMounted = true;
  detail.kampagneId = 'k1';
  detail.mode = 'workflow';
  detail.produktionId = 'p1';
  detail.activeWorkflowTab = 'produktion';
  detail.linien = [linie('b1'), linie('b2')];
  detail.linieId = 'b2';
  detail.kooperationenVideoTable = { briefingId: 'b2' };
  detail.reloadKooperationTable = vi.fn(async () => {});
  return detail;
}

describe('reloadLinien', () => {
  beforeEach(() => {
    loadProduktion.mockReset();
    window.supabase = undefined;
    window.localStorage?.clear();
    window.history.replaceState({}, '', '/produktion/p1?tab=briefing&linie=b2');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('fällt nach dem Löschen der aktiven Linie auf die verbleibende zurück', async () => {
    loadProduktion.mockResolvedValue({ id: 'p1', name: 'P', linien: [linie('b1')] });
    const detail = detailStub();

    await detail.reloadLinien();

    expect(loadProduktion).toHaveBeenCalledWith('p1');
    expect(detail.linien.map(l => l.id)).toEqual(['b1']);
    expect(detail.linieId).toBe('b1');
    expect(new URLSearchParams(window.location.search).get('linie')).toBe('b1');
    expect(detail.kooperationenVideoTable.briefingId).toBe('b1');
    expect(detail.reloadKooperationTable).toHaveBeenCalled();
  });

  it('ohne verbleibende Linie bleibt keine Linie aktiv und die URL verliert ?linie=', async () => {
    loadProduktion.mockResolvedValue({ id: 'p1', name: 'P', linien: [] });
    const detail = detailStub();

    await detail.reloadLinien();

    expect(detail.linien).toEqual([]);
    expect(detail.linieId).toBeNull();
    expect(new URLSearchParams(window.location.search).get('linie')).toBeNull();
  });

  it('behält die aktive Linie, wenn sie noch existiert', async () => {
    loadProduktion.mockResolvedValue({ id: 'p1', name: 'P', linien: [linie('b1'), linie('b2'), linie('b3')] });
    const detail = detailStub();

    await detail.reloadLinien();

    expect(detail.linieId).toBe('b2');
    expect(detail.linien).toHaveLength(3);
  });

  it('tut außerhalb der Produktion nichts', async () => {
    const detail = detailStub();
    detail.mode = 'overview';

    await detail.reloadLinien();

    expect(loadProduktion).not.toHaveBeenCalled();
  });
});
