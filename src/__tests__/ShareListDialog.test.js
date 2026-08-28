import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDialog } from '../core/components/ShareListDialog.js';

function createListChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    or: vi.fn(() => chain),
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

function mockFrom({ shares = { data: [], error: null }, partners = [] } = {}) {
  const shareChain = createListChain(shares);
  const partnerChain = createPartnerChain(partners);
  window.supabase.from = vi.fn((table) => (
    table === 'ansprechpartner' ? partnerChain : shareChain
  ));
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

describe('ShareListDialog Zugänge', () => {
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

  it('zeigt Standard-Header, Subtitle mit Listenname und Footer', () => {
    mockFrom();
    const dialog = new ShareListDialog();
    dialog.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Kampagne 2026' });

    expect(document.querySelector('.modal-header h3')?.textContent).toBe('Liste teilen');
    expect(document.querySelector('.share-list-modal-header')).toBeNull();
    expect(document.querySelector('.modal-description')?.textContent).toBe('Erstelle einen Zugang für: Kampagne 2026');
    expect(document.querySelector('.form-label.required')?.textContent).toContain('Name des Zugangs');
    expect(document.querySelector('.modal-footer .mdc-btn--secondary')?.textContent).toContain('Abbrechen');
    expect(document.querySelector('#share-submit-btn')?.classList.contains('mdc-btn--create')).toBe(true);
    expect(document.querySelector('#share-submit-btn')?.textContent).toContain('Zugang erstellen');
    expect(document.querySelector('#share-submit-btn')?.closest('.modal-footer')).not.toBeNull();
  });

  it('schließt das Modal über Abbrechen', () => {
    mockFrom();
    const dialog = new ShareListDialog();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    expect(document.querySelector('.share-list-modal')).not.toBeNull();

    document.querySelector('.modal-footer [data-action="cancel"]').click();
    expect(document.querySelector('.share-list-modal')).toBeNull();
  });

  it('legt ohne Namen keinen Zugang an', async () => {
    mockFrom();
    const dialog = new ShareListDialog();
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

    const dialog = new ShareListDialog();
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
    expect(document.querySelector('.share-code-value').textContent).toBe('654321');
  });

  it('legt E-Mail per Enter als Tag an und sendet sie beim Anlegen', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 1 },
      error: null,
    });

    const dialog = new ShareListDialog();
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
    const dialog = new ShareListDialog();
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

    const dialog = new ShareListDialog();
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

    const dialog = new ShareListDialog();
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

    const dialog = new ShareListDialog();
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
});
