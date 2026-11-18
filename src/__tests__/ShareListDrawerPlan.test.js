import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDrawer } from '../core/components/ShareListDrawer.js';
import { shareApi } from '../modules/share/shareApi.js';
import { mockFrom, typeEmail, pressEnter, mockSharePlan } from './shareListDrawerTestKit.js';

vi.mock('../modules/share/shareApi.js', async () => {
  const actual = await vi.importActual('../modules/share/shareApi.js');
  return { ...actual, shareApi: { ...actual.shareApi, plan: vi.fn() } };
});

describe('ShareListDrawer Kundenkonto und Empfänger-Vorschau', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    window.supabase = {
      functions: { invoke: vi.fn() },
      from: vi.fn(),
    };
    mockSharePlan(shareApi.plan);
    vi.spyOn(window, 'prompt').mockReturnValue(null);
  });

  afterEach(() => {
    window.prompt?.mockRestore?.();
  });

  it('zeigt das Rechte-Feld als TableSelect, ohne Skript-Umfang', () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'k1' });
    expect(document.querySelector('input[name="share-skript-scope"]')).toBeNull();
    expect(document.querySelector('[data-field="share-rechte"]')).not.toBeNull();
    expect(document.querySelector('select#share-rechte-select')).toBeNull();
    expect(document.getElementById('share-rechte-select')?.value).toBe('ansehen');
  });

  it('fragt die Aufteilung beim Server an', async () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'strategie', entityId: 'st1' });
    pressEnter(typeEmail('kunde@telekom.de'));
    await vi.waitFor(() => {
      expect(document.querySelector('.share-plan-row')?.textContent).toContain('Gast-Zugang');
    });
    expect(shareApi.plan).toHaveBeenLastCalledWith({
      emails: ['kunde@telekom.de'],
      entityType: 'strategie',
      entityId: 'st1',
    });
  });

  it('schickt ein Kundenkonto den Listen-Link und legt keinen Gast-Zugang an', async () => {
    mockFrom();
    mockSharePlan(shareApi.plan, { listLink: ['kunde@telekom.de'], guest: [], blocked: [] });
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, mailed: 1, plan: { listLink: ['kunde@telekom.de'], guest: [], blocked: [] } },
      error: null,
    });

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Telekom' });
    pressEnter(typeEmail('kunde@telekom.de'));
    await vi.waitFor(() => {
      expect(document.querySelector('.share-plan-row')?.textContent).toContain('Link ins Konto');
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
    expect(window.toastSystem.success).toHaveBeenCalledWith('Listen-Link versendet.');
    expect(document.getElementById('share-copy-list-link')).not.toBeNull();
  });

  it('versendet an ein Kundenkonto ohne Zuordnung keine Mail', async () => {
    mockFrom();
    mockSharePlan(shareApi.plan, {
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

  it('füllt den Namen aus der Firmen-Domain und überschreibt Eingetipptes nicht', async () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    const name = document.getElementById('share-label-input');

    pressEnter(typeEmail('lisa@telekom.de'));
    await vi.waitFor(() => expect(name.value).toBe('Telekom'));

    name.value = 'Marketing-Team';
    pressEnter(typeEmail('max@vodafone.de'));
    await vi.waitFor(() => expect(document.querySelector('.share-plan-row')?.textContent).toContain('max@vodafone.de'));
    expect(name.value).toBe('Marketing-Team');
  });

  it('blendet Name und Rechte aus, wenn nur Kundenkonten den Listen-Link bekommen', async () => {
    mockFrom();
    mockSharePlan(shareApi.plan, { listLink: ['kunde@telekom.de'], guest: [], blocked: [] });
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    expect(document.getElementById('share-gast-optionen').hidden).toBe(false);

    pressEnter(typeEmail('kunde@telekom.de'));
    await vi.waitFor(() => expect(document.getElementById('share-gast-optionen').hidden).toBe(true));
    expect(document.getElementById('share-nur-konten').hidden).toBe(false);
    expect(document.getElementById('share-submit-btn').textContent).toBe('Listen-Link senden');
  });

  it('beschriftet die Hauptaktion nach Empfängern und sperrt sie ohne zustellbare Adresse', async () => {
    mockFrom();
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    const btn = document.getElementById('share-submit-btn');

    pressEnter(typeEmail('a@agentur.de'));
    pressEnter(typeEmail('b@agentur.de'));
    await vi.waitFor(() => expect(btn.textContent).toBe('An 2 Empfänger senden'));

    mockSharePlan(shareApi.plan, { listLink: [], guest: [], blocked: [{ email: 'c@telekom.de', reason: 'scope' }] });
    dialog.setEmails(['c@telekom.de']);
    await vi.waitFor(() => expect(btn.textContent).toBe('Keine Mail möglich'));
    expect(btn.disabled).toBe(true);
    expect(document.querySelector('.share-plan-row--gesperrt').textContent).toContain('c@telekom.de');
  });

  it('kopiert Link und Code direkt nach dem Anlegen ohne Mail', async () => {
    mockFrom();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '123456', shareId: 's1', mailed: 0 },
      error: null,
    });
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Telekom' });
    await dialog.submit();

    expect(writeText).toHaveBeenCalledWith('Telekom\nLink: https://app/share/tok\nCode: 123456');
    expect(window.toastSystem.success).toHaveBeenCalledWith('Zugang angelegt, Link und Code kopiert.');

    writeText.mockClear();
    document.getElementById('share-copy-list-link').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/kampagne/e1`));
    delete navigator.clipboard;
  });

  it('bricht ab, wenn die Empfänger nicht geprüft werden konnten', async () => {
    mockFrom();
    shareApi.plan.mockResolvedValue(null);

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    document.getElementById('share-label-input').value = 'Marketing';
    pressEnter(typeEmail('kunde@telekom.de'));
    await dialog.submit();

    expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(window.toastSystem.error).toHaveBeenCalledWith('Empfänger konnten nicht geprüft werden.');
  });
});
