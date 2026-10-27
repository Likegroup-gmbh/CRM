import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDrawer } from '../core/components/ShareListDrawer.js';
import { DRAWER_EXIT_MS } from '../core/animation/drawer.js';

function createListChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    or: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function createPartnerChain(partners) {
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: partners, error: null })),
  };
  return chain;
}

function mockFrom({ shares = { data: [], error: null }, partners = [], skripte = { data: [], error: null } } = {}) {
  const shareChain = createListChain(shares);
  const partnerChain = createPartnerChain(partners);
  const skriptChain = createListChain(skripte);
  window.supabase.from = vi.fn((table) => {
    if (table === 'ansprechpartner') return partnerChain;
    if (table === 'skripte') return skriptChain;
    return shareChain;
  });
}

function typeEmail(value) {
  const input = document.getElementById('share-email-tag-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

function pressEnter(el) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

describe('ShareListDrawer Zugänge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    window.supabase = {
      functions: { invoke: vi.fn() },
      from: vi.fn(),
    };
    vi.spyOn(window, 'prompt').mockReturnValue(null);
  });

  afterEach(() => {
    window.prompt?.mockRestore?.();
  });

  it('zeigt Drawer-Header, Subtitle mit Listenname und Footer', () => {
    mockFrom();
    const drawer = new ShareListDrawer();
    drawer.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Kampagne 2026' });

    expect(document.querySelector('.drawer-panel.share-list-drawer .drawer-title')?.textContent).toBe('Liste teilen');
    expect(document.querySelector('.drawer-subtitle')?.textContent).toBe('Kampagne 2026');
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.form-label.required')?.textContent).toContain('Name des Zugangs');
    expect(document.querySelector('.drawer-footer .mdc-btn--secondary')?.textContent).toContain('Schließen');
    expect(document.querySelector('#share-submit-btn')?.classList.contains('mdc-btn--create')).toBe(true);
    expect(document.querySelector('#share-submit-btn')?.textContent).toContain('Zugang erstellen');
    expect(document.querySelector('#share-submit-btn')?.closest('.drawer-footer')).not.toBeNull();
  });

  it('nennt den Skript-Drawer "Skript teilen"', () => {
    mockFrom();
    new ShareListDrawer().open({ entityType: 'skript', entityId: 's1' });
    expect(document.querySelector('.drawer-title')?.textContent).toBe('Skript teilen');
  });

  describe('Schließen', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function offen() {
      mockFrom();
      const drawer = new ShareListDrawer();
      drawer.open({ entityType: 'sourcing', entityId: 'e1' });
      expect(document.querySelector('.share-list-drawer')).not.toBeNull();
      return drawer;
    }

    function istWeg() {
      vi.advanceTimersByTime(DRAWER_EXIT_MS + 10);
      return document.querySelector('.share-list-drawer') === null
        && document.querySelector('.drawer-overlay') === null;
    }

    it('über den Schließen-Button im Footer', () => {
      offen();
      document.querySelector('.drawer-footer [data-action="close"]').click();
      expect(istWeg()).toBe(true);
    });

    it('über das X im Header', () => {
      offen();
      document.querySelector('.drawer-header [data-action="close"]').click();
      expect(istWeg()).toBe(true);
    });

    it('über Klick auf den Backdrop', () => {
      offen();
      document.querySelector('.drawer-overlay').click();
      expect(istWeg()).toBe(true);
    });

    it('über Escape', () => {
      offen();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(istWeg()).toBe(true);
    });

    it('Escape im E-Mail-Feld schließt nur die Vorschläge, nicht den Drawer', () => {
      offen();
      const input = document.getElementById('share-email-tag-input');
      document.getElementById('share-email-suggestions').style.display = 'block';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(DRAWER_EXIT_MS + 10);
      expect(document.querySelector('.share-list-drawer')).not.toBeNull();
      expect(document.getElementById('share-email-suggestions').style.display).toBe('none');
    });

    it('erneutes open räumt das alte Panel ab', () => {
      const drawer = offen();
      drawer.open({ entityType: 'strategie', entityId: 'e2' });
      expect(document.querySelectorAll('.share-list-drawer')).toHaveLength(1);
      expect(document.querySelectorAll('.drawer-overlay')).toHaveLength(1);
    });
  });

  it('legt ohne Namen keinen Zugang an', async () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    await dialog.submit();

    expect(window.toastSystem.warning).toHaveBeenCalledWith('Bitte einen Namen für den Zugang vergeben.');
    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('legt Zugang per create an (Label/Rechte, kein E-Mail-Pflichtfeld)', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 0 },
      error: null,
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1', entityName: 'Liste A' });

    expect(document.getElementById('share-label-input')).not.toBeNull();
    expect(document.getElementById('share-email-input')).toBeNull();
    expect(document.getElementById('share-message-input')).toBeNull();
    expect(document.getElementById('share-expires-input')).toBeNull();
    expect(document.getElementById('share-ends-kampagne')).toBeNull();
    expect(document.getElementById('share-email-tag-input')).not.toBeNull();

    document.getElementById('share-label-input').value = 'Marketing';
    document.getElementById('share-rechte-select').value = 'feedback';
    await dialog.submit();

    expect(window.supabase.functions.invoke).toHaveBeenCalledWith('share-list', {
      body: expect.objectContaining({
        action: 'create',
        entityType: 'sourcing',
        entityId: 'e1',
        label: 'Marketing',
        rechte: 'feedback',
        emails: [],
        endsWithKampagne: true,
      }),
    });
    const body = window.supabase.functions.invoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('message');
    expect(body).not.toHaveProperty('expiresAt');
    expect(body).not.toHaveProperty('skriptScope');
    expect(document.querySelector('.share-code-value').textContent).toBe('654321');
  });

  it('legt E-Mail per Enter als Tag an und sendet sie beim Anlegen', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 1 },
      error: null,
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    document.getElementById('share-label-input').value = 'Marketing';

    pressEnter(typeEmail('a@b.de'));
    expect(document.querySelector('.tag-item').textContent).toContain('a@b.de');

    await dialog.submit();

    expect(window.supabase.functions.invoke).toHaveBeenCalledWith('share-list', {
      body: expect.objectContaining({
        action: 'create',
        emails: ['a@b.de'],
        endsWithKampagne: true,
      }),
    });
  });

  it('legt bei ungültiger E-Mail keinen Tag an', () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });

    pressEnter(typeEmail('keine-mail'));
    expect(document.querySelector('.tag-item')).toBeNull();
    expect(window.toastSystem.warning).toHaveBeenCalled();
  });

  it('legt per Klick auf Ansprechpartner-Vorschlag ein Mail-Tag an', async () => {
    mockFrom({
      partners: [{
        id: 'ap1',
        vorname: 'Lisa',
        nachname: 'Berger',
        email: 'lisa@kunde.de',
        unternehmen: { firmenname: 'VHV' },
      }],
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });

    typeEmail('lisa');
    await vi.waitFor(() => {
      expect(document.querySelector('.suggestion-item')?.textContent).toContain('Lisa Berger');
    });
    expect(document.querySelector('.suggestion-item').textContent).toContain('lisa@kunde.de');

    document.querySelector('.suggestion-item').click();
    expect(document.querySelector('.tag-item').textContent).toContain('lisa@kunde.de');
  });

  it('lädt Zugänge mit Label und Teilnehmern statt E-Mail', async () => {
    mockFrom({
      shares: {
        data: [{
          id: 's1',
          token: 't'.repeat(32),
          label: 'Agentur',
          rechte: 'ansehen',
          created_at: new Date().toISOString(),
          last_access_at: null,
          expires_at: null,
          ends_with_kampagne: false,
          share_participants: [{ id: 'p1', name: 'Pat', last_seen_at: null }],
        }],
        error: null,
      },
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'strategie', entityId: 'e2' });
    await vi.waitFor(() => {
      expect(document.querySelector('.share-recipient-email')?.textContent).toContain('Agentur');
    });
    expect(document.body.textContent).toContain('Pat');
    expect(document.querySelector('.share-recipient-email').textContent).not.toContain('@');
  });

  it('versendet Mail an die Tags, ohne Prompt', async () => {
    const shares = { data: [], error: null };
    mockFrom({ shares });
    window.supabase.functions.invoke.mockImplementation(async (_name, { body }) => {
      if (body.action === 'create') {
        shares.data = [{
          id: 's1',
          token: 't'.repeat(32),
          label: 'Marketing',
          rechte: 'ansehen',
          created_at: new Date().toISOString(),
          last_access_at: null,
          expires_at: null,
          ends_with_kampagne: true,
          share_participants: [],
        }];
        return { data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 0 }, error: null };
      }
      return { data: { success: true, mailed: 1 }, error: null };
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    document.getElementById('share-label-input').value = 'Marketing';
    await dialog.submit();

    await vi.waitFor(() => {
      expect(document.querySelector('[data-mail]')).not.toBeNull();
    });

    document.querySelector('[data-mail]').click();
    expect(window.toastSystem.warning).toHaveBeenCalled();
    expect(window.prompt).not.toHaveBeenCalled();
    expect(window.supabase.functions.invoke).toHaveBeenCalledTimes(1);

    pressEnter(typeEmail('team@kunde.de'));
    await dialog.resend('s1');

    expect(window.prompt).not.toHaveBeenCalled();
    expect(window.supabase.functions.invoke).toHaveBeenCalledWith('share-list', {
      body: expect.objectContaining({
        action: 'resend',
        shareId: 's1',
        emails: ['team@kunde.de'],
        code: '654321',
      }),
    });
  });

  it('zeigt keine Radio-Auswahl für den Skript-Umfang', () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'skript', entityId: 'skript-1', kampagneId: 'k1' });
    expect(document.querySelector('input[name="share-skript-scope"]')).toBeNull();
    expect(document.querySelector('[data-field="share-rechte"]')).not.toBeNull();
    expect(document.querySelector('select#share-rechte-select')).toBeNull();
    expect(document.getElementById('share-rechte-select')?.value).toBe('ansehen');
  });

  it('schickt beim Skript nur den einzelnen Umfang', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 0 },
      error: null,
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'skript', entityId: 'skript-1', kampagneId: 'k1', entityName: 'Hook A' });
    document.getElementById('share-label-input').value = 'Kunde';
    await dialog.submit();

    expect(window.supabase.functions.invoke).toHaveBeenCalledWith('share-list', {
      body: expect.objectContaining({
        action: 'create',
        entityType: 'skript',
        entityId: 'skript-1',
        skriptScope: 'einzeln',
      }),
    });
  });

  it('listet Kampagnen-Zugänge der Geschwister, nicht deren Einzel-Zugänge', async () => {
    mockFrom({
      skripte: { data: [{ id: 'skript-1' }, { id: 'skript-2' }], error: null },
      shares: {
        data: [
          {
            id: 's-all',
            token: 'a'.repeat(32),
            label: 'Produktion',
            rechte: 'ansehen',
            entity_id: 'skript-2',
            skript_scope: 'kampagne',
            created_at: new Date().toISOString(),
            last_access_at: null,
            expires_at: null,
            ends_with_kampagne: true,
            share_participants: [],
          },
          {
            id: 's-one',
            token: 'b'.repeat(32),
            label: 'Nur Zwei',
            rechte: 'ansehen',
            entity_id: 'skript-2',
            skript_scope: 'einzeln',
            created_at: new Date().toISOString(),
            last_access_at: null,
            expires_at: null,
            ends_with_kampagne: true,
            share_participants: [],
          },
        ],
        error: null,
      },
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'skript', entityId: 'skript-1', kampagneId: 'k1' });

    await vi.waitFor(() => {
      expect(document.querySelector('.share-recipient-email')?.textContent).toContain('Produktion');
    });
    expect(document.body.textContent).toContain('alle Skripte');
    expect(document.body.textContent).not.toContain('Nur Zwei');
  });
});
