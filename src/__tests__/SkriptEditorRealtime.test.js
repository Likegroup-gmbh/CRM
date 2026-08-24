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

describe('SkriptEditorRealtime animateText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pending -> vorschlag: upsertMessageRow mit animateText true', () => {
    const view = makeView([{
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'pending',
      inhalt: null, vorschlag_text: null, error_message: null
    }]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'vorschlag',
      inhalt: 'ok', vorschlag_text: 'neuer Text', error_message: null
    }, 'UPDATE');

    expect(view.upsertMessageRow).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'vorschlag', vorschlag_text: 'neuer Text' }),
      { animateText: true }
    );
  });

  it('running -> fertig: upsertMessageRow mit animateText true', () => {
    const view = makeView([{
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running',
      inhalt: null, vorschlag_text: null, error_message: null
    }]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'fertig',
      inhalt: 'Hier der Kommentar', vorschlag_text: null, error_message: null
    }, 'UPDATE');

    expect(view.upsertMessageRow).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fertig' }),
      { animateText: true }
    );
  });

  it('pending -> running: kein animateText', () => {
    const view = makeView([{
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'pending',
      inhalt: null, vorschlag_text: null, error_message: null
    }]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running',
      inhalt: null, vorschlag_text: null, error_message: null
    }, 'UPDATE');

    expect(view.upsertMessageRow).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'running' }),
      { animateText: false }
    );
  });

  it('INSERT: kein animateText', () => {
    const view = makeView([]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({
      id: 'm2', skript_id: 's1', rolle: 'assistant', status: 'fertig',
      inhalt: 'hi', vorschlag_text: null, error_message: null
    }, 'INSERT');

    expect(view.upsertMessageRow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm2' }),
      { animateText: false }
    );
  });

  it('unveraenderte Poll-Row: kein upsert', () => {
    const row = {
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'pending',
      inhalt: null, vorschlag_text: null, error_message: null,
      progress_steps: [{ step: 'pending', label: 'Auftrag ist unterwegs…' }]
    };
    const view = makeView([{ ...row }]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({ ...row }, 'UPDATE');

    expect(view.upsertMessageRow).not.toHaveBeenCalled();
  });

  it('nur progress_steps geaendert: upsert ohne animateText', () => {
    const view = makeView([{
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running',
      inhalt: null, vorschlag_text: null, error_message: null,
      progress_steps: [{ step: 'pending', label: 'Auftrag ist unterwegs…' }]
    }]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate({
      id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running',
      inhalt: null, vorschlag_text: null, error_message: null,
      progress_steps: [
        { step: 'pending', label: 'Auftrag ist unterwegs…' },
        { step: 'kontext', label: 'Ich lese Skript und Kontext…' }
      ]
    }, 'UPDATE');

    expect(view.upsertMessageRow).toHaveBeenCalledWith(
      expect.objectContaining({
        progress_steps: expect.arrayContaining([
          expect.objectContaining({ step: 'kontext' })
        ])
      }),
      { animateText: false }
    );
  });
});
