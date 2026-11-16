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
