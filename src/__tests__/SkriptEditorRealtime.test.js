// SkriptEditorRealtime.test.js
// Pending-Watchdog: eine Message, die aelter als PENDING_TIMEOUT_MS ist und
// immer noch 'pending' steht, hat den Function-Invoke verloren (z.B. 502/503
// am Gateway ohne Netlify-Retry). Statt ewig "Ich arbeite gerade…" zu zeigen,
// wird sie konditional auf 'error' gesetzt (Retry-Button in der UI).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    subscribeToChat: vi.fn(),
    pollChatMessage: vi.fn(),
    updateChatMessage: vi.fn()
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({ skripteService: mockService }));

import { SkriptEditorRealtime } from '../modules/skripte/editor/SkriptEditorRealtime.js';

function makeView(messages) {
  return {
    skript: { id: 's1' },
    messages,
    upsertMessageRow: vi.fn(),
    renderCost: vi.fn()
  };
}

const vorMs = (ms) => new Date(Date.now() - ms).toISOString();

const pendingMsg = (createdAt) => ({
  id: 'm1', skript_id: 's1', rolle: 'assistant', aktion: 'rueckfrage',
  status: 'pending', created_at: createdAt
});

describe('SkriptEditorRealtime Pending-Watchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pending aelter als 45s -> konditionales error-Update, lokale Uebernahme', async () => {
    const rt = new SkriptEditorRealtime(makeView([pendingMsg(vorMs(60000))]));
    mockService.updateChatMessage.mockResolvedValue(true);

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).toHaveBeenCalledWith('m1', {
      status: 'error',
      error_message: expect.stringContaining('Start fehlgeschlagen')
    }, { nurWennStatus: 'pending' });
    expect(rt.view.messages[0].status).toBe('error');
    expect(rt.view.upsertMessageRow).toHaveBeenCalled();
  });

  it('frische pending Message (Invoke braucht nur lang): kein Eingriff', async () => {
    const rt = new SkriptEditorRealtime(makeView([pendingMsg(vorMs(5000))]));

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).not.toHaveBeenCalled();
  });

  it('running darf lange dauern (Claude-Call): kein Timeout', async () => {
    const rt = new SkriptEditorRealtime(makeView([
      { ...pendingMsg(vorMs(120000)), status: 'running' }
    ]));

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).not.toHaveBeenCalled();
  });

  it('Update greift nicht (Function hat zwischenzeitlich geclaimt): Status bleibt', async () => {
    const rt = new SkriptEditorRealtime(makeView([pendingMsg(vorMs(60000))]));
    mockService.updateChatMessage.mockResolvedValue(false);

    await rt.checkPendingTimeout('m1');

    expect(rt.view.messages[0].status).toBe('pending');
  });

  it('abgebrochene Message wird nicht nachtraeglich auf error gesetzt', async () => {
    const rt = new SkriptEditorRealtime(makeView([
      { ...pendingMsg(vorMs(60000)), status: 'cancelled' }
    ]));

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).not.toHaveBeenCalled();
  });
});
