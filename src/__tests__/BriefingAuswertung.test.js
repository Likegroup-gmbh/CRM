// BriefingAuswertung.test.js
// Client-Trigger: Job anlegen + Function aufrufen. Ohne briefingId werfen.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { starteBriefingAuswertung } from '../modules/briefing/create/BriefingAuswertung.js';

describe('starteBriefingAuswertung', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wirft ohne briefingId', async () => {
    await expect(starteBriefingAuswertung({})).rejects.toThrow('briefingId fehlt');
  });

  it('legt Job an und triggert briefing-auswertung-background', async () => {
    const service = {
      createJob: vi.fn(async () => ({ id: 'job-1' })),
      triggerFunction: vi.fn(async () => undefined)
    };

    const job = await starteBriefingAuswertung({ briefingId: 'b-1', service });

    expect(job).toEqual({ id: 'job-1' });
    expect(service.createJob).toHaveBeenCalledTimes(1);
    expect(service.triggerFunction).toHaveBeenCalledWith('briefing-auswertung-background', {
      jobId: 'job-1',
      briefing_id: 'b-1'
    });
  });
});
