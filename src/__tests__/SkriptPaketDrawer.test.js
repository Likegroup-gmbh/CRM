import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkriptPaketDrawer } from '../modules/skripte/SkriptPaketDrawer.js';
import {
  loadKampagneSkripteFuerPaket, loadKampagneAnsprechpartner, loadSkriptPaket, ensureSkriptPaket, setPaketSkripte
} from '../modules/skripte/skriptPaketApi.js';

vi.mock('../modules/skripte/skriptPaketApi.js', () => ({
  loadKampagneSkripteFuerPaket: vi.fn(),
  loadKampagneAnsprechpartner: vi.fn(),
  loadSkriptPaket: vi.fn(),
  ensureSkriptPaket: vi.fn(),
  setPaketSkripte: vi.fn(),
}));

vi.mock('../modules/share/shareRecipientPlan.js', async () => {
  const actual = await vi.importActual('../modules/share/shareRecipientPlan.js');
  return {
    ...actual,
    classifyShareEmails: vi.fn(async (_supabase, { emails } = {}) => ({
      listLink: [],
      guest: (emails || []).filter((email) => !email.startsWith('konto@')),
      blocked: (emails || []).filter((email) => email.startsWith('konto@')).map((email) => ({ email, reason: 'paket' })),
    })),
  };
});

const linda = { id: 'linda', vorname: 'Linda', nachname: 'L', mail: 'linda@creator.de' };
const max = { id: 'max', vorname: 'Max', nachname: 'M', mail: 'max@creator.de' };

const SKRIPTE = [
  { id: 's1', titel: 'Eins', status: 'freigegeben', nr: 1, creator: linda, creatorId: 'linda' },
  { id: 's2', titel: 'Zwei', status: 'entwurf', nr: 2, creator: linda, creatorId: 'linda' },
  { id: 's3', titel: 'Drei', status: 'freigegeben', nr: 3, creator: max, creatorId: 'max' },
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function paste(input, text) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  input.dispatchEvent(event);
}

function submitLabel() {
  return document.querySelector('#skript-paket-submit').textContent.trim();
}

describe('SkriptPaketDrawer ohne Creator', () => {
  let invoke;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    invoke = vi.fn(async (_name, { body }) => {
      if (body.action === 'create') return { data: { shareId: 'share-1', link: 'https://x/share/tok', code: '123456' } };
      if (body.action === 'rotate_code') return { data: { code: '654321' } };
      return { data: { success: true } };
    });
    window.supabase = { functions: { invoke } };
    loadKampagneSkripteFuerPaket.mockResolvedValue(SKRIPTE);
    loadKampagneAnsprechpartner.mockResolvedValue([
      { id: 'ap1', name: 'Kim Kunde', email: 'kim@kunde.de' },
      { id: 'ap2', name: 'Ole Kunde', email: 'ole@kunde.de' },
      { id: 'ap3', name: 'Konto Kunde', email: 'konto@kunde.de' },
    ]);
    loadSkriptPaket.mockResolvedValue({ paket: null, share: null, skriptIds: [] });
    ensureSkriptPaket.mockResolvedValue({ id: 'paket-1' });
    setPaketSkripte.mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('startet ohne Creator-Mail mit allen Skripten in jedem Status', async () => {
    const drawer = new SkriptPaketDrawer();
    await drawer.open({ kampagneId: 'k1', kampagneName: 'Sommer', creatorId: 'linda' });

    expect(loadSkriptPaket).toHaveBeenCalledWith('k1', 'linda');
    expect(drawer.emails).toEqual([]);

    await drawer.applyCreator(null);
    expect(loadSkriptPaket).toHaveBeenLastCalledWith('k1', null);
    expect([...drawer.checked].sort()).toEqual(['s1', 's2', 's3']);
    expect(document.querySelector('[data-skript-id="s2"]').closest('label').textContent).toContain('Entwurf');
    expect(drawer.emails).toEqual([]);
    expect(submitLabel()).toBe('Zugang anlegen');
    drawer.close();
  });

  it('übernimmt eingefügte Adressen und Ansprechpartner per Klick, ohne Kundenkonten', async () => {
    const drawer = new SkriptPaketDrawer();
    await drawer.open({ kampagneId: 'k1', kampagneName: 'Sommer' });

    const input = document.querySelector('#skript-paket-email');
    paste(input, 'Anna <anna@kunde.de>; ben@kunde.de\nquatsch');
    expect(drawer.emails).toEqual(['anna@kunde.de', 'ben@kunde.de']);
    expect(submitLabel()).toBe('An 2 Empfänger senden');

    const chips = [...document.querySelectorAll('.skript-paket-vorschlag[data-email]')].map((b) => b.dataset.email);
    expect(chips).toEqual(['kim@kunde.de', 'ole@kunde.de']);
    document.querySelector('[data-alle-vorschlaege]').click();
    expect(drawer.emails).toEqual(['anna@kunde.de', 'ben@kunde.de', 'kim@kunde.de', 'ole@kunde.de']);
    expect(document.querySelector('#skript-paket-vorschlaege').hidden).toBe(true);
    drawer.close();
  });

  it('legt das Kampagnen-Paket mit Feedback-Rechten an und schreibt alle Adressen an', async () => {
    const drawer = new SkriptPaketDrawer();
    await drawer.open({ kampagneId: 'k1', kampagneName: 'Sommer' });
    const input = document.querySelector('#skript-paket-email');
    paste(input, 'anna@kunde.de, ben@kunde.de');

    await drawer.submit();

    expect(ensureSkriptPaket).toHaveBeenCalledWith('k1', null);
    expect(setPaketSkripte).toHaveBeenCalledWith('paket-1', ['s1', 's2', 's3']);
    const create = invoke.mock.calls.find(([, { body }]) => body.action === 'create')[1].body;
    expect(create).toMatchObject({
      entityType: 'skript_paket',
      entityId: 'paket-1',
      label: 'Sommer',
      rechte: 'feedback',
      emails: ['anna@kunde.de', 'ben@kunde.de'],
    });
    expect(submitLabel()).toBe('Speichern');
    drawer.close();
  });

  it('lädt neue Adressen am bestehenden Zugang nach Rückfrage mit neuem Code ein', async () => {
    loadSkriptPaket.mockResolvedValue({
      paket: { id: 'paket-1' },
      share: { id: 'share-1', token: 'tok', label: 'Sommer', rechte: 'feedback', empfaenger_emails: ['anna@kunde.de'] },
      skriptIds: ['s1'],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const drawer = new SkriptPaketDrawer();
    await drawer.open({ kampagneId: 'k1', kampagneName: 'Sommer' });
    expect(drawer.emails).toEqual(['anna@kunde.de']);

    paste(document.querySelector('#skript-paket-email'), 'ben@kunde.de');
    await drawer.submit();
    await flush();

    expect(confirm).toHaveBeenCalled();
    const actions = invoke.mock.calls.map(([, { body }]) => body.action);
    expect(actions).toEqual(['update', 'rotate_code', 'resend']);
    const resend = invoke.mock.calls.find(([, { body }]) => body.action === 'resend')[1].body;
    expect(resend).toMatchObject({ code: '654321', emails: ['anna@kunde.de', 'ben@kunde.de'] });
    confirm.mockRestore();
    drawer.close();
  });
});
