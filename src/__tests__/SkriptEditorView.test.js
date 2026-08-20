// SkriptEditorView.test.js
// Getrennte Zustaende im Editor: Query-Fehler != "Kein Zugriff".
// Frueher wurde ein PostgREST-Fehler (z.B. PGRST200) als "Kein Zugriff"
// gerendert, weil der Service den Fehler verschluckt hat.

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
    versionLabel: vi.fn((v) => `v${v?.version_nr || 1}`)
  }
}));

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: mockService,
  FUNNEL_STUFEN: {},
  VIDEO_LAENGEN: {}
}));

vi.mock('../modules/skripte/SkriptGeneratorForm.js', () => ({
  SkriptGeneratorForm: class {}
}));

vi.mock('../modules/skripte/SkriptFeedbackDrawer.js', () => ({
  SkriptFeedbackDrawer: class {
    close() {}
  }
}));

vi.mock('../modules/skripte/SkripteUtils.js', () => ({
  escapeHtml: (v) => String(v ?? ''),
  formatDate: () => '',
  badge: (text, variant = 'neutral') => `<span class="skripte-badge skripte-badge--${variant}">${text}</span>`,
  formatUsageCost: () => null,
  replaceSkriptUrl: () => {},
  skriptEditorPath: (id) => (!id || id === 'neu' || id === 'new') ? '/skripte/new' : `/skripte/${id}`
}));

vi.mock('../core/icons/IconSystem.js', () => ({
  icon: () => '<svg></svg>'
}));

import { SkriptEditorView } from '../modules/skripte/SkriptEditorView.js';

function setupWindow() {
  window.isKunde = vi.fn(() => false);
  window.isAdmin = vi.fn(() => true);
  window.currentUser = { id: 'user-1', rolle: 'admin' };
  window.setHeadline = vi.fn();
  window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
  window.supabase = {
    removeChannel: vi.fn(),
    channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) }))
  };
}

describe('SkriptEditorView Fehlerzustaende', () => {
  let view;
  let container;

  beforeEach(() => {
    setupWindow();
    view = new SkriptEditorView({ _merkeKontext: () => {} });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('Query-Fehler -> Fehlerzustand mit Meldung und Retry, nicht "Kein Zugriff"', async () => {
    mockService.loadSkript.mockRejectedValue(new Error('PGRST200 boom'));
    mockService.loadSkripte.mockResolvedValue([]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);

    await view.render(container, 's1');

    expect(container.textContent).toContain('Skript konnte nicht geladen werden');
    expect(container.textContent).toContain('PGRST200 boom');
    expect(container.textContent).not.toContain('Kein Zugriff');
    expect(container.querySelector('[data-retry]')).not.toBeNull();
  });

  it('Retry-Button rendert erneut', async () => {
    mockService.loadSkript.mockRejectedValue(new Error('boom'));
    mockService.loadSkripte.mockResolvedValue([]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);

    await view.render(container, 's1');
    const spy = vi.spyOn(view, 'render');
    container.querySelector('[data-retry]').click();
    expect(spy).toHaveBeenCalledWith(container, 's1');
  });

  it('nicht sichtbar (null) -> "Kein Zugriff", kein Fehlertext', async () => {
    mockService.loadSkript.mockResolvedValue(null);
    mockService.loadSkripte.mockResolvedValue([]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);

    await view.render(container, 's1');

    expect(container.textContent).toContain('Kein Zugriff auf dieses Skript');
    expect(container.textContent).not.toContain('konnte nicht geladen werden');
    expect(container.querySelector('[data-retry]')).toBeNull();
  });
});

describe('SkriptEditorView Layout', () => {
  let view;
  let container;

  const skript = {
    id: 's1',
    titel: 'Test-Skript',
    hook: 'Hook-Text',
    hauptteil: 'Hauptteil-Text',
    cta: 'CTA-Text',
    hook_visuell: null,
    hauptteil_visuell: 'Visual-Text',
    cta_visuell: null,
    created_at: '2026-08-20',
    unternehmen: { firmenname: 'Muster GmbH', internes_kuerzel: 'MUS' },
    marke: null
  };

  beforeEach(() => {
    setupWindow();
    view = new SkriptEditorView({ _merkeKontext: () => {} });
    container = document.createElement('div');
    document.body.appendChild(container);

    mockService.loadSkript.mockResolvedValue({ ...skript });
    mockService.loadSkripte.mockResolvedValue([{ ...skript }]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('Mitte rendert 2-Spalten-Tabelle mit 3 Sektionszeilen', async () => {
    await view.render(container, 's1');

    const table = container.querySelector('table.skripte-editor-tabelle');
    expect(table).not.toBeNull();
    const headers = table.querySelectorAll('thead th');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe('');
    expect(headers[1].textContent).toBe('Was gesagt wird');
    expect(headers[2].textContent).toBe('Was zu sehen ist');

    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].dataset.sektion).toBe('hook');
    expect(rows[1].dataset.sektion).toBe('hauptteil');
    expect(rows[2].dataset.sektion).toBe('cta');

    const labels = table.querySelectorAll('tbody th[scope="row"]');
    expect(labels.length).toBe(3);
    expect(labels[0].textContent).toBe('Hook');
    expect(labels[1].textContent).toBe('Hauptteil');
    expect(labels[2].textContent).toBe('CTA');

    // Linke Zelle selektierbar, rechte nicht
    const textZellen = container.querySelectorAll('.skripte-editor-sektion-text');
    expect(textZellen.length).toBe(3);
    const visualZellen = container.querySelectorAll('.skripte-editor-sektion-visual');
    expect(visualZellen.length).toBe(3);
    expect(visualZellen[0].classList.contains('skripte-editor-sektion-text')).toBe(false);

    // Visual-Text steht in der rechten Zelle
    expect(visualZellen[1].textContent).toBe('Visual-Text');

    // Wand-Button in jeder rechten Zelle
    const visualBtns = container.querySelectorAll('.skripte-editor-visual-btn');
    expect(visualBtns.length).toBe(3);
  });

  it('Composer sitzt im Chat-DOM, nicht in der Mitte', async () => {
    await view.render(container, 's1');

    const chat = container.querySelector('#ed-chat');
    expect(chat).not.toBeNull();
    expect(chat.querySelector('#ed-chat-log')).not.toBeNull();
    expect(chat.querySelector('.skripte-editor-inputwrap')).not.toBeNull();
    expect(chat.querySelector('#ed-input')).not.toBeNull();
    expect(chat.querySelector('#ed-send')).not.toBeNull();
    expect(chat.querySelector('#ed-cost')).not.toBeNull();
    expect(chat.querySelector('#ed-meta')).toBeNull();
    expect(chat.querySelector('#ed-version-wrap')).toBeNull();

    const main = container.querySelector('.skripte-editor-main');
    expect(main.querySelector('.skripte-editor-inputwrap')).toBeNull();
    expect(main.querySelector('#ed-input')).toBeNull();
  });

  it('Doc-Kopf: Tags links, Feedback, Version rechts', async () => {
    mockService.loadSkript.mockResolvedValue({
      ...skript,
      marke: { markenname: 'Acme' },
      personas: { name: 'Lisa' },
      mit_dna: true
    });
    mockService.getVersionen.mockResolvedValue([
      { version_nr: 1, sub_nr: 0 }
    ]);
    mockService.personaLabel.mockImplementation((p) => p?.name || '');

    await view.render(container, 's1');

    const head = container.querySelector('.skripte-editor-doc-head');
    expect(head).not.toBeNull();
    const meta = head.querySelector('#ed-meta');
    const feedback = head.querySelector('#ed-feedback');
    const version = head.querySelector('#ed-version-wrap');
    expect(meta).not.toBeNull();
    expect(feedback).not.toBeNull();
    expect(version).not.toBeNull();

    const kids = [...head.children];
    expect(kids.indexOf(meta)).toBeLessThan(kids.indexOf(feedback));
    expect(kids.indexOf(feedback)).toBeLessThan(kids.indexOf(version));

    expect(meta.textContent).toContain('Muster GmbH');
    expect(meta.textContent).toContain('Acme');
    expect(meta.textContent).toContain('Lisa');
    expect(meta.textContent).toContain('mit DNA');
    expect(version.querySelector('#ed-version')).not.toBeNull();
  });

  it('Liste rendert Mini-Cards mit pinker Badge und Datum', async () => {
    await view.render(container, 's1');

    const nav = container.querySelector('nav.skripte-editor-liste');
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Skripte');

    const item = container.querySelector('.skripte-editor-liste-item');
    expect(item).not.toBeNull();
    expect(item.tagName).toBe('A');
    expect(item.getAttribute('href')).toBe('/skripte/s1');
    expect(item.getAttribute('aria-current')).toBe('page');
    const badge = item.querySelector('.skripte-badge--pink');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('MUS');
    expect(item.querySelector('.skripte-editor-liste-datum')).not.toBeNull();
    expect(item.querySelector('.skripte-editor-liste-titel').textContent).toBe('Test-Skript');

    const neuBtn = container.querySelector('#ed-neu');
    expect(neuBtn).not.toBeNull();
    expect(neuBtn.tagName).toBe('A');
    expect(neuBtn.getAttribute('href')).toBe('/skripte/new');
    expect(neuBtn.classList.contains('mdc-btn')).toBe(true);
    expect(neuBtn.classList.contains('mdc-btn--secondary')).toBe(true);
    expect(neuBtn.querySelector('.mdc-btn__icon')).not.toBeNull();
  });

  it('Visual-Button triggert sendMessagePair mit aktion visuell', async () => {
    await view.render(container, 's1');
    const spy = vi.spyOn(view, 'sendMessagePair').mockResolvedValue(null);

    const btn = container.querySelector('.skripte-editor-visual-btn[data-sektion="hook"]');
    btn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).toHaveBeenCalledWith({
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Hook-Text',
      inhalt: 'Visual zu Hook'
    });
  });

  it('offener visuell-Vorschlag beim Laden wird auto-applied', async () => {
    mockService.getChatMessages.mockResolvedValue([{
      id: 'm-open',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Hook-Text',
      vorschlag_text: 'Reload-Visual',
      status: 'vorschlag'
    }]);
    mockService.updateSkript.mockResolvedValue({});
    mockService.createVersion.mockResolvedValue({ version_nr: 2, sub_nr: 0 });
    mockService.updateChatMessage.mockResolvedValue({});
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

    await view.render(container, 's1');
    await new Promise((r) => setTimeout(r, 0));

    expect(mockService.updateSkript).toHaveBeenCalledWith('s1', { hook_visuell: 'Reload-Visual' });
    expect(view.skript.hook_visuell).toBe('Reload-Visual');
    expect(view.skript.hook).toBe('Hook-Text');
  });

  it('applyMessageUpdate auto-applied Visual-Vorschlag und legt Version an', async () => {
    mockService.updateSkript = vi.fn().mockResolvedValue({});
    mockService.createVersion = vi.fn().mockResolvedValue({ version_nr: 2, sub_nr: 0 });
    mockService.updateChatMessage = vi.fn().mockResolvedValue({});
    mockService.getVersionen.mockResolvedValue([]);

    await view.render(container, 's1');
    window.toastSystem = { success: vi.fn(), error: vi.fn() };

    const msg = {
      id: 'm1',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Hook-Text',
      inhalt: 'Visual zu Hook',
      vorschlag_text: 'Neuer Visual-Text',
      status: 'vorschlag'
    };

    view.applyMessageUpdate(msg, 'UPDATE');
    await new Promise((r) => setTimeout(r, 0));

    expect(mockService.updateSkript).toHaveBeenCalledWith('s1', { hook_visuell: 'Neuer Visual-Text' });
    expect(mockService.createVersion).toHaveBeenCalled();
    expect(mockService.updateChatMessage).toHaveBeenCalledWith('m1', { status: 'angenommen' });
    expect(view.skript.hook_visuell).toBe('Neuer Visual-Text');
  });

  it('Hauptteil-Button disabled ohne Hook-Visual, enabled sobald gefuellt', async () => {
    await view.render(container, 's1');
    const haupt = container.querySelector('.skripte-editor-visual-btn[data-sektion="hauptteil"]');
    expect(haupt.disabled).toBe(true);
    expect(haupt.title).toContain('Hook');

    view.skript.hook_visuell = '[0–3 Sek] Close-up';
    view.renderDoc();
    const hauptNach = container.querySelector('.skripte-editor-visual-btn[data-sektion="hauptteil"]');
    expect(hauptNach.disabled).toBe(false);
    expect(hauptNach.title).toBe('Was zu sehen ist per KI generieren');
  });

  it('CTA-Button disabled ohne Hauptteil-Visual, enabled sobald gefuellt', async () => {
    mockService.loadSkript.mockResolvedValue({
      ...skript,
      hook_visuell: '[0–3 Sek]',
      hauptteil_visuell: null
    });
    await view.render(container, 's1');
    const cta = container.querySelector('.skripte-editor-visual-btn[data-sektion="cta"]');
    expect(cta.disabled).toBe(true);
    expect(cta.title).toContain('Hauptteil');

    view.skript.hauptteil_visuell = '[3–8 Sek] B-Roll';
    view.renderDoc();
    const ctaNach = container.querySelector('.skripte-editor-visual-btn[data-sektion="cta"]');
    expect(ctaNach.disabled).toBe(false);
  });

  it('startVisuell(hauptteil) ohne Hook-Visual: Warning, kein sendMessagePair', async () => {
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    await view.render(container, 's1');
    const spy = vi.spyOn(view, 'sendMessagePair').mockResolvedValue(null);

    await view.startVisuell('hauptteil');

    expect(spy).not.toHaveBeenCalled();
    expect(window.toastSystem.warning).toHaveBeenCalledWith(
      expect.stringContaining('Hook')
    );
  });
});

function selectText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  if (typeof range.getBoundingClientRect !== 'function') {
    range.getBoundingClientRect = () => ({ top: 10, bottom: 30, left: 10, right: 80, width: 70, height: 20 });
  }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('SkriptEditorView Inline-Edit', () => {
  let view;
  let container;

  const skript = {
    id: 's1',
    titel: 'Test-Skript',
    hook: 'Hook-Text',
    hauptteil: 'Hauptteil-Text',
    cta: 'CTA-Text',
    hook_visuell: null,
    hauptteil_visuell: 'Visual-Text',
    cta_visuell: null,
    created_at: '2026-08-20',
    unternehmen: { firmenname: 'Muster GmbH', internes_kuerzel: 'MUS' },
    marke: null
  };

  beforeEach(() => {
    setupWindow();
    view = new SkriptEditorView({ _merkeKontext: () => {} });
    container = document.createElement('div');
    document.body.appendChild(container);

    mockService.loadSkript.mockResolvedValue({ ...skript });
    mockService.loadSkripte.mockResolvedValue([{ ...skript }]);
    mockService.getChatMessages.mockResolvedValue([]);
    mockService.getVersionen.mockResolvedValue([]);
    mockService.updateSkript.mockResolvedValue({});
    mockService.createVersion.mockResolvedValue({ version_nr: 2, sub_nr: 0 });
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('Nicht-Kunde: 6 Zellen editable, leerer Hook ohne Gedankenstrich', async () => {
    mockService.loadSkript.mockResolvedValue({ ...skript, hook: '' });
    await view.render(container, 's1');

    const zellen = container.querySelectorAll('[data-feld]');
    expect(zellen.length).toBe(6);
    zellen.forEach((el) => {
      expect(el.getAttribute('contenteditable')).toBe('plaintext-only');
    });
    const hook = container.querySelector('[data-feld="hook"]');
    expect(hook.textContent).toBe('');
    expect(hook.textContent).not.toContain('–');
  });

  it('Kunde: Zellen nicht contenteditable', async () => {
    window.isKunde = vi.fn(() => true);
    await view.render(container, 's1');

    const zellen = container.querySelectorAll('[data-feld]');
    expect(zellen.length).toBe(6);
    zellen.forEach((el) => {
      expect(el.getAttribute('contenteditable')).toBeNull();
    });
  });

  it('Markierung in Spoken und Visual zeigt Aktionsmenue', async () => {
    await view.render(container, 's1');
    const spoken = container.querySelector('.skripte-editor-sektion-text[data-sektion="hook"]');
    const visual = container.querySelector('.skripte-editor-sektion-visual[data-sektion="hauptteil"]');
    const menu = container.querySelector('#ed-selmenu');

    selectText(spoken);
    view.checkSelection();
    expect(menu.hidden).toBe(false);
    expect(menu.querySelector('[data-aktion="neu_schreiben"]')).not.toBeNull();
    expect(view.selektion).toEqual({ sektion: 'hook', text: 'Hook-Text', istVisuell: false });

    selectText(visual);
    view.checkSelection();
    expect(menu.hidden).toBe(false);
    expect(menu.querySelector('[data-aktion="kuerzen"]')).not.toBeNull();
    expect(view.selektion).toEqual({ sektion: 'hauptteil', text: 'Visual-Text', istVisuell: true });
  });

  it('acceptVorschlag auf visuell-Message schreibt ins Visual-Feld, nicht ins Spoken-Feld', async () => {
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    await view.render(container, 's1');
    mockService.updateSkript.mockClear();
    mockService.createVersion.mockClear();

    await view.acceptVorschlag({
      id: 'm-vis',
      sektion: 'hauptteil',
      ist_visuell: false,
      aktion: 'visuell',
      status: 'vorschlag',
      selektion_text: 'Hauptteil-Text',
      vorschlag_text: 'Close-up Pfanne'
    });

    expect(mockService.updateSkript).toHaveBeenCalledWith('s1', { hauptteil_visuell: 'Close-up Pfanne' });
    expect(mockService.updateSkript).not.toHaveBeenCalledWith('s1', expect.objectContaining({ hauptteil: expect.anything() }));
    expect(view.skript.hauptteil_visuell).toBe('Close-up Pfanne');
    expect(view.skript.hauptteil).toBe('Hauptteil-Text');
  });

  it('acceptVorschlag mit ist_visuell schreibt ins Visual-Feld', async () => {
    window.toastSystem = { success: vi.fn(), error: vi.fn() };
    await view.render(container, 's1');
    view.skript.hook_visuell = 'Alter Shot';

    await view.acceptVorschlag({
      id: 'm2',
      sektion: 'hook',
      ist_visuell: true,
      aktion: 'kuerzen',
      selektion_text: 'Alter Shot',
      vorschlag_text: 'Neuer Shot'
    });

    expect(mockService.updateSkript).toHaveBeenCalledWith('s1', { hook_visuell: 'Neuer Shot' });
    expect(view.skript.hook_visuell).toBe('Neuer Shot');
    expect(view.skript.hook).toBe('Hook-Text');
    expect(mockService.createVersion.mock.calls[0][1]).toBe('Kürzen · Hook Visual');
  });

  it('Tippen in Zelle loescht pending Selektion', async () => {
    await view.render(container, 's1');
    view.selektion = { sektion: 'hook', text: 'Hook-Text' };
    view.pendingAktion = 'kuerzen';
    view.updateChip();

    const hook = container.querySelector('[data-feld="hook"]');
    hook.textContent = 'Hook geaendert';
    hook.dispatchEvent(new Event('input', { bubbles: true }));

    expect(view.selektion).toBeNull();
    expect(view.pendingAktion).toBeNull();
  });

  it('Blur speichert manuelle Aenderung als Version', async () => {
    await view.render(container, 's1');
    const hook = container.querySelector('[data-feld="hook"]');
    hook.textContent = 'Neuer Hook';
    hook.dispatchEvent(new Event('input', { bubbles: true }));
    hook.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockService.updateSkript).toHaveBeenCalledWith('s1', { hook: 'Neuer Hook' });
    expect(mockService.createVersion).toHaveBeenCalled();
    expect(mockService.createVersion.mock.calls[0][1]).toBe('Manuell · Hook');
  });

  it('applyVisuellVorschlag waehrend Hook-Focus laesst Hook-DOM stehen', async () => {
    window.toastSystem = { success: vi.fn(), error: vi.fn() };
    await view.render(container, 's1');

    const hook = container.querySelector('[data-feld="hook"]');
    hook.focus();

    view.applyMessageUpdate({
      id: 'm1',
      skript_id: 's1',
      rolle: 'assistant',
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Hook-Text',
      inhalt: 'Visual zu Hook',
      vorschlag_text: 'Neuer Visual-Text',
      status: 'vorschlag'
    }, 'UPDATE');
    await new Promise((r) => setTimeout(r, 0));

    expect(container.querySelector('[data-feld="hook"]')).toBe(hook);
    expect(container.querySelector('[data-feld="hook_visuell"]').textContent).toBe('Neuer Visual-Text');
    expect(view.skript.hook_visuell).toBe('Neuer Visual-Text');
  });
});
