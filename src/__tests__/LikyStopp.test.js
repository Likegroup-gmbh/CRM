// LikyStopp.test.js
// Stopp-Button: busy zeigt Stopp-Icon statt Spinner, bleibt klickbar.
// Skript-Editor: Enter sendet nicht erneut, Klick auf #ed-send bricht ab.
// Persona/Briefing: AbortSignal stoppt den Poll, Ergebnis wird nicht angewendet.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    loadSkript: vi.fn(),
    loadSkripte: vi.fn(),
    getChatMessages: vi.fn(),
    getVersionen: vi.fn(),
    subscribeToChat: vi.fn(() => null),
    pollChatMessage: vi.fn(),
    updateSkript: vi.fn(),
    updateChatMessage: vi.fn(),
    createChatMessage: vi.fn(),
    createVersion: vi.fn(),
    wechsleVersion: vi.fn(),
    triggerFunction: vi.fn(),
    personaLabel: vi.fn((p) => p?.name || ''),
    versionLabel: vi.fn((v) => `v${v?.version_nr || 1}`),
    loadAktiveModi: vi.fn(async () => []),
    loadSkriptVerknuepfungen: vi.fn(async () => [])
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: mockService,
  FUNNEL_STUFEN: {},
  VIDEO_LAENGEN: {},
  SKRIPT_BEREICHE: {
    owned_social: 'Owned Social',
    paid_creator_ads: 'Paid Creator Ads',
    influencer_marketing: 'Influencer Marketing'
  }
}));

vi.mock('../modules/skripte/SkriptList.js', () => ({
  matchesKampagne: (item, kampagneId) => {
    if (kampagneId == null) return !item.kampagne_id;
    return item.kampagne_id === kampagneId;
  }
}));

vi.mock('../modules/skripte/SkripteUtils.js', () => ({
  escapeHtml: (v) => String(v ?? ''),
  formatDate: () => '',
  badge: (text, variant = 'neutral') => `<span class="skripte-badge skripte-badge--${variant}">${text}</span>`,
  formatUsageCost: () => null,
  replaceSkriptUrl: () => {},
  skriptEditorPath: (id) => (!id || id === 'neu' || id === 'new') ? '/skripte' : `/skripte/${id}`,
  relativeZeit: () => 'Vor 4 Stunden',
  initialen: (name) => String(name || '?')[0].toUpperCase()
}));

vi.mock('../core/icons/IconSystem.js', () => ({
  icon: () => '<svg></svg>'
}));

import { setLikySendBusy } from '../core/chat/likyComposer.js';
import { SkriptEditorView } from '../modules/skripte/SkriptEditorView.js';
import { PersonaLikyPanel } from '../modules/persona/PersonaLikyPanel.js';

function ensureLocalStorage() {
  if (typeof globalThis.localStorage?.clear === 'function') return;
  const store = Object.create(null);
  const api = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; }
  };
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true, writable: true });
}

function setupWindow() {
  ensureLocalStorage();
  window.isKunde = vi.fn(() => false);
  window.isAdmin = vi.fn(() => true);
  window.isInternal = vi.fn(() => true);
  window.canEdit = vi.fn(() => true);
  window.currentUser = { id: 'user-1', rolle: 'admin' };
  window.setHeadline = vi.fn();
  window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
  window.supabase = {
    removeChannel: vi.fn(),
    channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) })),
    from: vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null })
      };
      return chain;
    })
  };
}

describe('setLikySendBusy', () => {
  it('busy zeigt Stopp-Icon, ist nicht disabled, idle zeigt Pfeil', () => {
    const btn = document.createElement('button');
    btn.className = 'doc-chat__send';
    btn.title = 'Senden';
    btn.setAttribute('aria-label', 'Senden');
    document.body.appendChild(btn);

    setLikySendBusy(btn, true);
    expect(btn.classList.contains('is-stop')).toBe(true);
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('Antwort stoppen');
    expect(btn.getAttribute('aria-label')).toBe('Antwort stoppen');

    setLikySendBusy(btn, false);
    expect(btn.classList.contains('is-stop')).toBe(false);
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('Senden');
    expect(btn.getAttribute('aria-label')).toBe('Senden');

    btn.remove();
  });

  it('null-Button ist kein Fehler', () => {
    expect(() => setLikySendBusy(null, true)).not.toThrow();
  });
});

describe('SkriptEditorView Stopp-Button', () => {
  let view;
  let container;

  const skript = {
    id: 's1',
    titel: 'Test-Skript',
    kampagne_id: 'k1',
    hook: 'Hook-Text',
    hauptteil: 'Hauptteil-Text',
    cta: 'CTA-Text',
    created_at: '2026-08-20',
    unternehmen: { firmenname: 'Muster GmbH', internes_kuerzel: 'MUS' },
    marke: null
  };

  beforeEach(() => {
    setupWindow();
    localStorage.clear();
    view = new SkriptEditorView({ _merkeKontext: () => {} });
    container = document.createElement('div');
    document.body.appendChild(container);

    mockService.loadSkript.mockResolvedValue({ ...skript });
    mockService.loadSkripte.mockResolvedValue([{ ...skript }]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);
  });

  afterEach(() => {
    view._likyShell?.destroy();
    container.remove();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('Enter bei laufender Assistant-Message sendet nicht erneut', async () => {
    mockService.getChatMessages.mockResolvedValue([{
      id: 'a1',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'chat',
      status: 'pending',
      inhalt: 'hi'
    }]);
    await view.render(container, 's1');

    const spy = vi.spyOn(view, 'sendChat').mockResolvedValue(null);
    const input = document.getElementById('ed-input');
    input.value = 'zweite Nachricht';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('Klick auf #ed-send bei pending Message ruft handleMessageAction cancel', async () => {
    mockService.getChatMessages.mockResolvedValue([{
      id: 'a1',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'chat',
      status: 'pending',
      inhalt: 'hi'
    }]);
    await view.render(container, 's1');

    const spy = vi.spyOn(view, 'handleMessageAction').mockResolvedValue(null);
    const sendBtn = document.getElementById('ed-send');
    sendBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).toHaveBeenCalledWith('cancel', 'a1');
  });

  it('Klick auf #ed-send bei laufender Generation ruft brichGenerationAb', async () => {
    await view.render(container, 's1');
    view.genStatus = { laeuft: true };

    const spy = vi.spyOn(view, 'brichGenerationAb').mockResolvedValue(null);
    const sendBtn = document.getElementById('ed-send');
    sendBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).toHaveBeenCalled();
  });

  it('sendChat bei laufendem Lauf macht nichts', async () => {
    mockService.getChatMessages.mockResolvedValue([{
      id: 'a1',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'chat',
      status: 'running',
      inhalt: 'hi'
    }]);
    await view.render(container, 's1');

    const spy = vi.spyOn(view, 'sendMessagePair').mockResolvedValue(null);
    await view.sendChat('test');

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('PersonaLikyPanel Abort', () => {
  let form;
  let panel;

  beforeEach(() => {
    setupWindow();
    form = document.createElement('form');
    form.innerHTML = `
      <div id="persona-liky-feed"></div>
      <input id="persona-liky-input" value="https://shop.example/p">
      <button type="button" id="persona-liky-send"></button>
      <input name="unternehmen_id" value="u1">
      <input name="name" value="">
    `;
    document.body.appendChild(form);
    panel = new PersonaLikyPanel();
    panel.mount(form);
  });

  afterEach(() => {
    panel.destroy();
    form.remove();
    vi.clearAllMocks();
  });

  it('Abort waehrend des Polls wendet das Ergebnis nicht an', async () => {
    // Simuliere einen laufenden Job
    panel.setRunning(true);
    expect(panel.running).toBe(true);
    expect(panel._laufAbort).not.toBeNull();

    // Abort ausloesen
    panel.abortLauf();
    expect(panel._laufAbort.signal.aborted).toBe(true);

    // pollChatJob wirft AbortError
    await expect(panel.pollChatJob('job-1')).rejects.toMatchObject({
      name: 'AbortError'
    });

    // Kein Ergebnis wurde angewendet
    expect(form.querySelector('[name="name"]').value).toBe('');
  });

  it('onSend bei running ruft abortLauf statt neuen Lauf', async () => {
    panel.setRunning(true);
    const spy = vi.spyOn(panel, 'abortLauf').mockImplementation(() => {});
    const runSpy = vi.spyOn(panel, 'runExtract').mockResolvedValue(null);

    await panel.onSend();

    expect(spy).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
  });
});
