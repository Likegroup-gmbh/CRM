import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDrawer } from '../core/components/ShareListDrawer.js';
import { classifyShareEmails } from '../modules/share/shareRecipientPlan.js';
import { mockFrom, typeEmail, pressEnter } from './shareListDrawerTestKit.js';

vi.mock('../modules/share/shareRecipientPlan.js', async () => {
  const actual = await vi.importActual('../modules/share/shareRecipientPlan.js');
  return {
    ...actual,
    classifyShareEmails: vi.fn(async (_supabase, { emails } = {}) => ({
      listLink: [],
      guest: [...(emails || [])],
      blocked: [],
    })),
  };
});

describe('ShareListDrawer Kundenkonto und Skript-Umfang', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    window.supabase = {
      functions: { invoke: vi.fn() },
      from: vi.fn(),
    };
    classifyShareEmails.mockImplementation(async (_supabase, { emails } = {}) => ({
      listLink: [],
      guest: [...(emails || [])],
      blocked: [],
    }));
    vi.spyOn(window, 'prompt').mockReturnValue(null);
  });

  afterEach(() => {
    window.prompt?.mockRestore?.();
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

  it('schickt ein Kundenkonto den Listen-Link und legt keinen Gast-Zugang an', async () => {
    mockFrom();
    classifyShareEmails.mockResolvedValue({
      listLink: ['kunde@telekom.de'],
      guest: [],
      blocked: [],
    });
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, mailed: 1, plan: { listLink: ['kunde@telekom.de'], guest: [], blocked: [] } },
      error: null,
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Telekom' });
    pressEnter(typeEmail('kunde@telekom.de'));
    await vi.waitFor(() => {
      expect(document.querySelector('.share-plan-row')?.textContent).toContain('Listen-Link');
    });

    await dialog.submit();

    const actions = window.supabase.functions.invoke.mock.calls.map((call) => call[1].body.action);
    expect(actions).toEqual(['send_account_links']);
    expect(window.supabase.functions.invoke).toHaveBeenCalledWith('share-list', {
      body: expect.objectContaining({
        action: 'send_account_links',
        emails: ['kunde@telekom.de'],
        entityType: 'kampagne',
        entityId: 'e1',
      }),
    });
    expect(document.getElementById('share-copy-list-link')).not.toBeNull();
  });

  it('versendet an ein Kundenkonto ohne Zuordnung keine Mail', async () => {
    mockFrom();
    classifyShareEmails.mockResolvedValue({
      listLink: [],
      guest: [],
      blocked: [{ email: 'kunde@telekom.de', reason: 'scope' }],
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    document.getElementById('share-label-input').value = 'Marketing';
    pressEnter(typeEmail('kunde@telekom.de'));
    await dialog.submit();

    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(window.toastSystem.warning).toHaveBeenCalledWith('Keine Mail. Zuerst Unternehmen oder Marke zuordnen.');
  });
});
