import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDrawer } from '../core/components/ShareListDrawer.js';
import { confirmationModal } from '../core/ConfirmationModal.js';
import { shareApi } from '../modules/share/shareApi.js';
import {
  mockFrom, mockSharePlan, shareRow, klickMenue, mockActions, actionsAufgerufen,
} from './shareListDrawerTestKit.js';

vi.mock('../modules/share/shareApi.js', async () => {
  const actual = await vi.importActual('../modules/share/shareApi.js');
  return { ...actual, shareApi: { ...actual.shareApi, plan: vi.fn() } };
});

async function offenMit(rows) {
  mockFrom({ shares: { data: rows, error: null } });
  const drawer = new ShareListDrawer();
  drawer.open({ entityType: 'kampagne', entityId: 'k1', entityName: 'Telekom Sommer' });
  await vi.waitFor(() => {
    expect(document.querySelector('.share-access-row')).not.toBeNull();
  });
  return drawer;
}

function zeileMailEingeben(shareId, email) {
  const input = document.getElementById(`share-resend-${shareId}-input`);
  input.value = email;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

describe('ShareListDrawer Zeilen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.toastSystem = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    window.supabase = { functions: { invoke: vi.fn() }, from: vi.fn() };
    mockSharePlan(shareApi.plan);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt Avatar, Meta, Rechte-Auswahl, Link-Button und Menü statt Text-Buttons', async () => {
    await offenMit([shareRow('s1', {
      label: 'Desig-Team',
      last_access_at: '2026-11-12T10:00:00Z',
      share_participants: [{ id: 'p1', name: 'Pat' }, { id: 'p2', name: 'Lisa' }],
    })]);
    const zeile = document.querySelector('[data-share-id="s1"]');
    expect(zeile.querySelector('.share-recipient-avatar').textContent).toBe('DT');
    expect(zeile.querySelector('.share-recipient-meta').textContent).toBe('Zuletzt 12.11.2026 · Endet mit Kampagne · Pat, Lisa');
    expect(zeile.querySelector('[data-field="share-row-rechte"] .table-select__label').textContent).toBe('Nur ansehen');
    expect(zeile.querySelector('select')).toBeNull();
    expect(zeile.querySelector('[data-copy-link]').dataset.copyLink).toBe(`${window.location.origin}/share/tok-s1`);
    expect([...zeile.querySelectorAll('.action-item')].map((a) => a.dataset.action))
      .toEqual(['share-mail', 'share-rotate', 'share-revoke']);
    expect(zeile.querySelector('.share-code-value')).toBeNull();
  });

  it('erzeugt über das Menü einen neuen Code und zeigt ihn in der Zeile', async () => {
    await offenMit([shareRow('s1')]);
    mockActions({ rotate_code: { code: '778899' } });

    klickMenue('s1', 'share-rotate');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-share-id="s1"] .share-code-value')?.textContent).toBe('778899');
    });
    expect(actionsAufgerufen()).toEqual(['rotate_code']);
    const kopierText = document.querySelector('[data-share-id="s1"] .share-access-code .mdc-btn').dataset.copy;
    expect(kopierText).toBe(`Telekom Sommer\nLink: ${window.location.origin}/share/tok-s1\nCode: 778899`);
  });

  it('widerruft erst nach Bestätigung', async () => {
    await offenMit([shareRow('s1', { label: 'Agentur' })]);
    mockActions({});
    const open = vi.spyOn(confirmationModal, 'open').mockResolvedValueOnce({ confirmed: false });

    klickMenue('s1', 'share-revoke');
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open.mock.calls[0][0].message).toContain('Agentur');
    expect(actionsAufgerufen()).toEqual([]);

    open.mockResolvedValueOnce({ confirmed: true });
    klickMenue('s1', 'share-revoke');
    await vi.waitFor(() => expect(actionsAufgerufen()).toEqual(['revoke']));
  });

  it('ändert Rechte über die Auswahl in der Zeile', async () => {
    await offenMit([shareRow('s1')]);
    mockActions({});
    const element = document.querySelector('[data-share-id="s1"] [data-field="share-row-rechte"]');
    document.dispatchEvent(new CustomEvent('table-select-change', {
      detail: { field: 'share-row-rechte', itemId: 's1', value: 'feedback', element },
    }));
    await vi.waitFor(() => expect(window.toastSystem.success).toHaveBeenCalledWith('Rechte aktualisiert.'));
    expect(window.supabase.functions.invoke.mock.calls[0][1].body).toEqual({ action: 'update', shareId: 's1', rechte: 'feedback' });
  });

  describe('Per Mail senden', () => {
    it('rotiert ohne bekannten Code erst und sendet dann mit dem neuen Code', async () => {
      const drawer = await offenMit([shareRow('s1')]);
      mockActions({ rotate_code: { code: '101010' }, resend: { mailed: 1 } });

      klickMenue('s1', 'share-mail');
      expect(document.querySelector('[data-row-mail="s1"]').hidden).toBe(false);
      expect(document.querySelector('[data-row-mail="s1"] .share-plan-note').textContent).toContain('neuer Code');
      zeileMailEingeben('s1', 'gast@agentur.de');
      await drawer.sendRowMail();

      expect(actionsAufgerufen()).toEqual(['rotate_code', 'resend']);
      expect(window.supabase.functions.invoke.mock.calls[1][1].body).toEqual(expect.objectContaining({
        action: 'resend', shareId: 's1', emails: ['gast@agentur.de'], code: '101010',
      }));
      expect(window.toastSystem.success).toHaveBeenCalledWith('Einladung versendet.');
      expect(document.querySelector('[data-row-mail="s1"]').hidden).toBe(true);
      expect(document.querySelector('[data-share-id="s1"] .share-code-value').textContent).toBe('101010');
    });

    it('nutzt einen frischen Code ohne erneut zu rotieren', async () => {
      const drawer = await offenMit([shareRow('s1')]);
      drawer.codes.s1 = '202020';
      mockActions({ resend: { mailed: 1 } });

      klickMenue('s1', 'share-mail');
      expect(document.querySelector('[data-row-mail="s1"] .share-plan-note')).toBeNull();
      zeileMailEingeben('s1', 'gast@agentur.de');
      await drawer.sendRowMail();

      expect(actionsAufgerufen()).toEqual(['resend']);
      expect(window.supabase.functions.invoke.mock.calls[0][1].body.code).toBe('202020');
    });

    it('rotiert nicht, wenn nur Kundenkonten den Listen-Link bekommen', async () => {
      const drawer = await offenMit([shareRow('s1')]);
      mockSharePlan(shareApi.plan, { listLink: ['kunde@telekom.de'], guest: [], blocked: [] });
      mockActions({ resend: { mailed: 1 } });

      klickMenue('s1', 'share-mail');
      zeileMailEingeben('s1', 'kunde@telekom.de');
      await drawer.sendRowMail();

      expect(actionsAufgerufen()).toEqual(['resend']);
      expect(window.supabase.functions.invoke.mock.calls[0][1].body.code).toBe('');
    });

    it('verlangt eine Adresse', async () => {
      const drawer = await offenMit([shareRow('s1')]);
      klickMenue('s1', 'share-mail');
      await drawer.sendRowMail();
      expect(window.toastSystem.warning).toHaveBeenCalledWith('Bitte mindestens eine E-Mail eintragen.');
      expect(window.supabase.functions.invoke).not.toHaveBeenCalled();
    });
  });
});
