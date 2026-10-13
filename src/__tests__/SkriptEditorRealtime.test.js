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
    getChatMessages: vi.fn(),
    updateChatMessage: vi.fn()
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({ skripteService: mockService }));

import { SkriptEditorRealtime } from '../modules/skripte/editor/SkriptEditorRealtime.js';
import { upsertById } from '../modules/skripte/editor/skriptEditorMessages.js';

function makeView(messages) {
  return {
    skript: { id: 's1' },
    messages,
    upsertMessageRow: vi.fn(),
    renderCost: vi.fn(),
    renderChat: vi.fn(),
    ensurePolling: vi.fn(),
    pollInterval: null
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

  it('running ueber 12 min (Function tot): konditionales error-Update auf running', async () => {
    const rt = new SkriptEditorRealtime(makeView([
      { ...pendingMsg(vorMs(13 * 60 * 1000)), status: 'running' }
    ]));
    mockService.updateChatMessage.mockResolvedValue(true);

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).toHaveBeenCalledWith('m1', {
      status: 'error',
      error_message: expect.stringContaining('Zeitüberschreitung')
    }, { nurWennStatus: 'running' });
    expect(rt.view.messages[0].status).toBe('error');
  });

  it('running knapp unter 12 min: noch kein Eingriff', async () => {
    const rt = new SkriptEditorRealtime(makeView([
      { ...pendingMsg(vorMs(11 * 60 * 1000)), status: 'running' }
    ]));

    await rt.checkPendingTimeout('m1');

    expect(mockService.updateChatMessage).not.toHaveBeenCalled();
  });

  it('Update greift nicht: echter Stand wird per Resync geholt', async () => {
    const rt = new SkriptEditorRealtime(makeView([
      { ...pendingMsg(vorMs(13 * 60 * 1000)), status: 'running' }
    ]));
    mockService.updateChatMessage.mockResolvedValue(false);
    mockService.getChatMessages.mockResolvedValue([]);

    await rt.checkPendingTimeout('m1');

    expect(mockService.getChatMessages).toHaveBeenCalledWith('s1');
  });

  it('Update greift nicht (Function hat zwischenzeitlich geclaimt): Status bleibt', async () => {
    const rt = new SkriptEditorRealtime(makeView([pendingMsg(vorMs(60000))]));
    mockService.updateChatMessage.mockResolvedValue(false);
    // Die DB kennt den echten Stand: die Function hat geclaimt
    mockService.getChatMessages.mockResolvedValue([
      { ...pendingMsg(vorMs(60000)), status: 'running' }
    ]);

    await rt.checkPendingTimeout('m1');

    expect(rt.view.messages[0].status).toBe('running');
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

const row = (over = {}) => ({
  id: 'm1', skript_id: 's1', rolle: 'assistant', aktion: 'rueckfrage',
  status: 'pending', inhalt: null, vorschlag_text: null, error_message: null,
  created_at: vorMs(1000), updated_at: vorMs(1000), ...over
});

describe('Realtime-Race: keine doppelten Messages', () => {
  it('Realtime-INSERT kommt vor der Insert-Antwort: genau eine Message', () => {
    const view = makeView([]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate(row(), 'INSERT');          // Realtime zuerst
    const eintrag = upsertById(view.messages, row()); // danach lokaler Push

    expect(view.messages).toHaveLength(1);
    expect(eintrag).toBe(view.messages[0]);
  });

  it('Realtime-Update ist schon neuer als die Insert-Antwort: bleibt erhalten', () => {
    const view = makeView([]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate(row(), 'INSERT');
    rt.applyMessageUpdate(row({ status: 'fertig', inhalt: 'Antwort' }), 'UPDATE');
    upsertById(view.messages, row()); // veraltete pending-Kopie aus der Insert-Antwort

    expect(view.messages).toHaveLength(1);
    expect(view.messages[0].status).toBe('fertig');
  });

  it('lokaler Push zuerst, danach Realtime-INSERT: ebenfalls eine Message', () => {
    const view = makeView([]);
    const rt = new SkriptEditorRealtime(view);

    upsertById(view.messages, row());
    rt.applyMessageUpdate(row(), 'INSERT');

    expect(view.messages).toHaveLength(1);
  });

  it('offene Realtime-Message startet das Polling (z.B. zweiter Tab)', () => {
    const view = makeView([]);
    const rt = new SkriptEditorRealtime(view);

    rt.applyMessageUpdate(row(), 'INSERT');

    expect(view.ensurePolling).toHaveBeenCalled();
  });
});

describe('Resync heilt den lokalen Stand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Geister-Kopie (doppelte id, in der DB fertig) verschwindet', async () => {
    const geist = row({ created_at: vorMs(60000) });
    const view = makeView([
      row({ status: 'fertig', inhalt: 'Danke', created_at: vorMs(60000) }),
      geist
    ]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([
      row({ status: 'fertig', inhalt: 'Danke', created_at: vorMs(60000) })
    ]);

    await rt.resync();

    expect(view.messages).toHaveLength(1);
    expect(view.messages[0].status).toBe('fertig');
    expect(view.renderChat).toHaveBeenCalled();
  });

  it('lokale Row ohne DB-Gegenstueck (aelter als Gnadenfrist) wird entfernt', async () => {
    const view = makeView([row({ id: 'weg', created_at: vorMs(120000) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([]);

    await rt.resync();

    expect(view.messages).toHaveLength(0);
  });

  it('frisch angelegte Row bleibt, auch wenn der Fetch sie noch nicht kennt', async () => {
    const view = makeView([row({ id: 'neu', created_at: vorMs(2000) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([]);

    await rt.resync();

    expect(view.messages).toHaveLength(1);
  });

  it('fehlende Rows aus der DB kommen dazu, Status-Updates werden uebernommen', async () => {
    const view = makeView([row({ status: 'running', updated_at: vorMs(5000) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([
      row({ status: 'fertig', inhalt: 'ok', updated_at: vorMs(1000) }),
      row({ id: 'm2', rolle: 'user', status: 'fertig', inhalt: 'hi' })
    ]);

    await rt.resync();

    expect(view.messages.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect(view.messages.find((m) => m.id === 'm1').status).toBe('fertig');
  });

  it('veraltete DB-Row setzt eine neuere lokale Row nicht zurueck', async () => {
    const view = makeView([row({ status: 'fertig', inhalt: 'ok', updated_at: vorMs(500) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([row({ status: 'running', updated_at: vorMs(5000) })]);

    await rt.resync();

    expect(view.messages[0].status).toBe('fertig');
  });

  it('Fetch-Fehler: lokaler Stand bleibt unveraendert', async () => {
    const view = makeView([row({ created_at: vorMs(120000) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockRejectedValue(new Error('offline'));

    await rt.resync();

    expect(view.messages).toHaveLength(1);
  });

  it('Channel-Status SUBSCRIBED/CHANNEL_ERROR loest Resync aus, CLOSED nicht', () => {
    const rt = new SkriptEditorRealtime(makeView([]));
    mockService.getChatMessages.mockResolvedValue([]);

    rt.onChannelStatus('CLOSED');
    expect(mockService.getChatMessages).not.toHaveBeenCalled();

    rt.onChannelStatus('SUBSCRIBED');
    expect(mockService.getChatMessages).toHaveBeenCalledTimes(1);
  });

  it('Poll-Tick: Resync + Watchdog; ohne offene Messages stoppt das Polling', async () => {
    const view = makeView([row({ status: 'fertig', created_at: vorMs(60000) })]);
    view.pollInterval = setInterval(() => {}, 100000);
    const rt = new SkriptEditorRealtime(view);

    await rt.pollTick();

    expect(view.pollInterval).toBeNull();
    expect(mockService.getChatMessages).not.toHaveBeenCalled();
  });

  it('Poll-Tick: abgelaufene pending Message wird auf error gesetzt', async () => {
    const view = makeView([row({ created_at: vorMs(60000) })]);
    const rt = new SkriptEditorRealtime(view);
    mockService.getChatMessages.mockResolvedValue([row({ created_at: vorMs(60000) })]);
    mockService.updateChatMessage.mockResolvedValue(true);

    await rt.pollTick();

    expect(mockService.updateChatMessage).toHaveBeenCalledWith(
      'm1', expect.objectContaining({ status: 'error' }), { nurWennStatus: 'pending' }
    );
  });

  it('langsame Message wird einmal neu gerendert (Hinweis), nicht bei jedem Tick', () => {
    const view = makeView([row({ status: 'running', created_at: vorMs(90000) })]);
    const rt = new SkriptEditorRealtime(view);

    rt.aktualisiereZeitAnzeigen();
    rt.aktualisiereZeitAnzeigen();

    expect(view.upsertMessageRow).toHaveBeenCalledTimes(1);
  });
});
