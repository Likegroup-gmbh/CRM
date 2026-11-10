// Neu formulieren mit eigenem Feedback-Text: Auftrag muss mit Text angelegt
// und getriggert werden, der Chat-Zustand danach sauber sein.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createChatMessage = vi.fn();
const starteVonNachricht = vi.fn();

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: { createChatMessage: (...a) => createChatMessage(...a) }
}));
vi.mock('../modules/skripte/SkriptAuftrag.js', () => ({
  skriptAuftrag: { starteVonNachricht: (...a) => starteVonNachricht(...a) }
}));

const { SkriptEditorChatActions } = await import('../modules/skripte/editor/SkriptEditorChatActions.js');

describe('Neu formulieren mit Feedback-Text', () => {
  let view;
  let actions;

  beforeEach(() => {
    document.body.innerHTML = '<textarea id="ed-input"></textarea>';
    document.getElementById('ed-input').value = 'Lockerer, weniger Werbung';
    let n = 0;
    createChatMessage.mockReset().mockImplementation(async (m) => ({ ...m, id: `m${++n}` }));
    starteVonNachricht.mockReset().mockResolvedValue(undefined);
    view = {
      skript: { id: 's1' },
      messages: [],
      selektion: { sektion: 'hook', text: 'Kennst du das?', istVisuell: false },
      pendingAktion: 'neu_schreiben',
      sendLaeuft: false,
      istFragenModus: () => false,
      clearPending: vi.fn(function clear() { this.selektion = null; this.pendingAktion = null; }),
      likyLaeuft: () => false,
      inlineEdit: { flush: vi.fn(async () => {}) },
      upsertMessage: vi.fn((m) => m),
      renderChat: vi.fn(),
      ensurePolling: vi.fn()
    };
    actions = new SkriptEditorChatActions(view);
  });

  it('legt User- und Assistant-Message mit dem Text an und startet den Job', async () => {
    await actions.sendChat();

    expect(createChatMessage).toHaveBeenCalledTimes(2);
    const [user, assistant] = createChatMessage.mock.calls.map((c) => c[0]);
    expect(user).toMatchObject({ rolle: 'user', aktion: 'neu_schreiben', sektion: 'hook', inhalt: 'Lockerer, weniger Werbung', status: 'fertig' });
    expect(assistant).toMatchObject({ rolle: 'assistant', aktion: 'neu_schreiben', inhalt: 'Lockerer, weniger Werbung', status: 'pending' });
    expect(starteVonNachricht).toHaveBeenCalledWith({ art: 'edit', messageId: 'm2' });
    expect(view.sendLaeuft).toBe(false);
    expect(view.ensurePolling).toHaveBeenCalled();
  });
});
