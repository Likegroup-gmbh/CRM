import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShareListDrawer } from '../core/components/ShareListDrawer.js';
import { DRAWER_EXIT_MS } from '../core/animation/drawer.js';
import { shareApi } from '../modules/share/shareApi.js';
import { mockFrom, typeEmail, pressEnter, mockSharePlan, httpFehler } from './shareListDrawerTestKit.js';

vi.mock('../modules/share/shareApi.js', async () => {
  const actual = await vi.importActual('../modules/share/shareApi.js');
  return { ...actual, shareApi: { ...actual.shareApi, plan: vi.fn() } };
});

describe('ShareListDrawer Zugänge', () => {
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

  it('zeigt Drawer-Header, Subtitle mit Listenname und Footer', () => {
    mockFrom();
    const drawer = new ShareListDrawer();
    drawer.open({ entityType: 'kampagne', entityId: 'e1', entityName: 'Kampagne 2026' });

    expect(document.querySelector('.drawer-panel.share-list-drawer .drawer-title')?.textContent).toBe('Liste teilen');
    expect(document.querySelector('.drawer-subtitle')?.textContent).toBe('Kampagne 2026');
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('label[for="share-label-input"]')?.textContent).toContain('Name des Zugangs');
    expect(document.getElementById('share-label-input').value).toMatch(/^Gast-Zugang \d\d\.\d\d\.$/);
    expect(document.querySelector('.drawer-footer #share-copy-list-link')?.textContent).toContain('Listen-Link kopieren');
    expect(document.querySelector('.drawer-footer [data-action="close"]')).toBeNull();
    expect(document.querySelector('#share-submit-btn')?.classList.contains('mdc-btn--create')).toBe(true);
    expect(document.querySelector('#share-submit-btn')?.textContent).toContain('Zugang erstellen');
    expect(document.querySelector('#share-submit-btn')?.closest('.drawer-footer')).not.toBeNull();
    expect(document.activeElement?.id).toBe('share-email-tag-input');
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

    it('Escape bei offenem Menü oder offener Bestätigung lässt den Drawer offen', () => {
      offen();
      for (const klasse of ['actions-dropdown-portal', 'modal overlay-modal']) {
        const offenesElement = document.createElement('div');
        offenesElement.className = klasse;
        document.body.appendChild(offenesElement);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        vi.advanceTimersByTime(DRAWER_EXIT_MS + 10);
        expect(document.querySelector('.share-list-drawer')).not.toBeNull();
        offenesElement.remove();
      }
    });

    it('erneutes open räumt das alte Panel ab', () => {
      const drawer = offen();
      drawer.open({ entityType: 'strategie', entityId: 'e2' });
      expect(document.querySelectorAll('.share-list-drawer')).toHaveLength(1);
      expect(document.querySelectorAll('.drawer-overlay')).toHaveLength(1);
    });
  });

  it('legt mit geleertem Namen einen Zugang mit Standardnamen an', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok', code: '654321', shareId: 's1', mailed: 0 },
      error: null,
    });
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    document.getElementById('share-label-input').value = '  ';
    await dialog.submit();

    const body = window.supabase.functions.invoke.mock.calls[0][1].body;
    expect(body.action).toBe('create');
    expect(body.label).toMatch(/^Gast-Zugang \d\d\.\d\d\.$/);
    expect(window.toastSystem.warning).not.toHaveBeenCalled();
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

  it('zeigt den frischen Code in der neuen Zeile, auch wenn die Liste sie noch nicht liefert', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({
      data: { success: true, link: 'https://app/share/tok123', code: '445566', shareId: 's7', mailed: 0 },
      error: null,
    });
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1', entityName: 'Liste A' });
    document.getElementById('share-label-input').value = 'Agentur';
    await dialog.submit();

    const zeile = document.querySelector('[data-share-id="s7"]');
    expect(zeile.querySelector('.share-recipient-email').textContent).toBe('Agentur');
    expect(zeile.querySelector('.share-code-value').textContent).toBe('445566');
    expect(zeile.querySelector('[data-copy-link]').dataset.copyLink).toBe(`${window.location.origin}/share/tok123`);
    expect(document.querySelectorAll('.share-code-value')).toHaveLength(1);
    expect(document.getElementById('share-zugaenge-anzahl').textContent).toBe('1');
    expect(document.getElementById('share-label-input').value).toMatch(/^Gast-Zugang/);
  });

  it('zeigt den Code auch, wenn der Zugang angelegt wurde, die Mail aber scheiterte (502)', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue(httpFehler(502, {
      error: 'Zugang angelegt, aber E-Mail-Versand fehlgeschlagen.',
      link: 'https://app/share/tok',
      code: '112233',
      shareId: 's9',
    }));

    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'sourcing', entityId: 'e1' });
    document.getElementById('share-label-input').value = 'Marketing';
    pressEnter(typeEmail('gast@beispiel.de'));
    await dialog.submit();

    expect(document.querySelector('.share-code-value').textContent).toBe('112233');
    expect(dialog.codes.s9).toBe('112233');
    expect(window.toastSystem.warning).toHaveBeenCalledWith('Zugang angelegt, aber E-Mail-Versand fehlgeschlagen.');
    expect(window.toastSystem.error).not.toHaveBeenCalled();
  });

  it('widerruft und ändert Rechte über die Edge Function, nicht direkt in list_shares', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });

    await dialog.revoke('s1');
    await dialog.updateRechte('s1', 'feedback');

    const bodies = window.supabase.functions.invoke.mock.calls.map((call) => call[1].body);
    expect(bodies).toEqual([
      { action: 'revoke', shareId: 's1' },
      { action: 'update', shareId: 's1', rechte: 'feedback' },
    ]);
    const shareChain = window.supabase.from('list_shares');
    expect(shareChain.update).not.toHaveBeenCalled();
  });

  it('meldet die Server-Fehlermeldung beim Code-Erneuern', async () => {
    mockFrom();
    window.supabase.functions.invoke.mockResolvedValue(httpFehler(403, { error: 'Nur Mitarbeiter können Listen teilen.' }));
    const dialog = new ShareListDrawer();
    dialog.open({ entityType: 'kampagne', entityId: 'e1' });
    await dialog.rotate('s1');
    expect(window.toastSystem.error).toHaveBeenCalledWith('Nur Mitarbeiter können Listen teilen.');
  });
});
