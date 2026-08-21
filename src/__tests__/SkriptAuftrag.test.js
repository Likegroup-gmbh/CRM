import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkriptAuftrag } from '../modules/skripte/SkriptAuftrag.js';

function makeService(overrides = {}) {
  return {
    createJob: vi.fn(async ({ skriptId } = {}) => ({ id: 'job-1', skript_id: skriptId || null })),
    subscribeToJob: vi.fn(() => ({ unsubscribe: vi.fn() })),
    pollJob: vi.fn(async () => null),
    triggerFunction: vi.fn(async () => {}),
    updateJob: vi.fn(async () => {}),
    updateChatMessage: vi.fn(async () => {}),
    ...overrides
  };
}

describe('SkriptAuftrag.starteJob', () => {
  beforeEach(() => {
    window.supabase = { removeChannel: vi.fn() };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('legt Job mit skript_id an, subscribed, pollt und triggert die richtige Function', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);

    const { jobId } = await auftrag.starteJob({
      art: 'generate',
      skriptId: 's1',
      payload: { mit_dna: true },
      onUpdate: () => {}
    });

    expect(jobId).toBe('job-1');
    expect(service.createJob).toHaveBeenCalledWith({ skriptId: 's1' });
    expect(service.subscribeToJob).toHaveBeenCalledWith('job-1', expect.any(Function));
    expect(service.triggerFunction).toHaveBeenCalledWith('skript-generate-background', {
      jobId: 'job-1',
      skript_id: 's1',
      mit_dna: true
    });
  });

  it('blockiert einen zweiten Auftrag derselben Art auf dasselbe Skript', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);
    await auftrag.starteJob({ art: 'generate', skriptId: 's1' });

    await expect(auftrag.starteJob({ art: 'generate', skriptId: 's1' }))
      .rejects.toThrow('läuft bereits');
    expect(service.createJob).toHaveBeenCalledTimes(1);
  });

  it('raeumt bei done selbst auf (In-Flight frei, Channel entfernt)', async () => {
    let onUpdateRef = null;
    const service = makeService({
      subscribeToJob: vi.fn((id, cb) => { onUpdateRef = cb; return { unsubscribe: vi.fn() }; })
    });
    const auftrag = new SkriptAuftrag(service);
    await auftrag.starteJob({ art: 'generate', skriptId: 's1', onUpdate: () => {} });

    onUpdateRef({ id: 'job-1', status: 'done', skript_id: 's1' });

    expect(window.supabase.removeChannel).toHaveBeenCalled();
    expect(auftrag.hatLaufenden('generate:s1')).toBe(false);
  });

  it('raeumt bei Trigger-Fehler auf und wirft weiter', async () => {
    const service = makeService({
      triggerFunction: vi.fn(async () => { throw new Error('HTTP 500'); })
    });
    const auftrag = new SkriptAuftrag(service);

    await expect(auftrag.starteJob({ art: 'generate', skriptId: 's1' }))
      .rejects.toThrow('HTTP 500');
    expect(auftrag.hatLaufenden('generate:s1')).toBe(false);
    expect(window.supabase.removeChannel).toHaveBeenCalled();
  });

  it('stop() ist idempotent', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);
    const { stop } = await auftrag.starteJob({ art: 'distill' });

    stop();
    stop();
    expect(window.supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(auftrag.hatLaufenden('distill:global')).toBe(false);
  });

  it('distill geht ohne skript_id an die Distill-Function', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);
    await auftrag.starteJob({ art: 'distill', payload: { layer_typ: 'global' } });

    expect(service.createJob).toHaveBeenCalledWith({ skriptId: null });
    expect(service.triggerFunction).toHaveBeenCalledWith('skript-distill-background', {
      jobId: 'job-1',
      layer_typ: 'global'
    });
  });
});

describe('SkriptAuftrag.starteVonNachricht', () => {
  beforeEach(() => {
    window.supabase = { removeChannel: vi.fn() };
  });

  it('triggert edit/fragen je nach Art, blockiert Doppel-Trigger', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);

    const erste = await auftrag.starteVonNachricht({ art: 'edit', messageId: 'm1' });
    expect(erste).toBe(true);
    expect(service.triggerFunction).toHaveBeenCalledWith(
      'skript-edit-background', { messageId: 'm1' }, { signal: expect.any(AbortSignal) }
    );

    // Nach Abschluss ist der Guard wieder frei (der Trigger selbst ist synchron)
    const zweite = await auftrag.starteVonNachricht({ art: 'fragen', messageId: 'm2' });
    expect(zweite).toBe(true);
    expect(service.triggerFunction).toHaveBeenCalledWith(
      'skript-fragen-background', { messageId: 'm2' }, { signal: expect.any(AbortSignal) }
    );
  });

  it('AbortError vom Trigger wird als Nutzer-Abbruch geschluckt, nicht geworfen', async () => {
    const service = makeService({
      triggerFunction: vi.fn(async () => {
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      })
    });
    const auftrag = new SkriptAuftrag(service);

    await expect(auftrag.starteVonNachricht({ art: 'fragen', messageId: 'm1' })).resolves.toBe(true);
    expect(auftrag.hatLaufenden('msg:m1')).toBe(false);
  });

  it('brichNachrichtAb bricht einen noch offenen Trigger-Fetch ab', async () => {
    let signalRef = null;
    const service = makeService({
      triggerFunction: vi.fn((name, body, { signal } = {}) => {
        signalRef = signal;
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      })
    });
    const auftrag = new SkriptAuftrag(service);

    const startPromise = auftrag.starteVonNachricht({ art: 'fragen', messageId: 'm1' });
    await auftrag.brichNachrichtAb('m1');

    expect(signalRef.aborted).toBe(true);
    await expect(startPromise).resolves.toBe(true);
    expect(service.updateChatMessage).toHaveBeenCalledWith('m1', {
      status: 'cancelled',
      error_message: 'Vom Nutzer abgebrochen'
    });
  });
});

describe('SkriptAuftrag Abbruch', () => {
  it('brichAb setzt den Job auf cancelled', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);
    await auftrag.brichAb('job-1');
    expect(service.updateJob).toHaveBeenCalledWith('job-1', {
      status: 'cancelled',
      error_message: 'Vom Nutzer abgebrochen'
    });
  });

  it('brichNachrichtAb setzt die Message auf cancelled', async () => {
    const service = makeService();
    const auftrag = new SkriptAuftrag(service);
    await auftrag.brichNachrichtAb('m1');
    expect(service.updateChatMessage).toHaveBeenCalledWith('m1', {
      status: 'cancelled',
      error_message: 'Vom Nutzer abgebrochen'
    });
  });
});
