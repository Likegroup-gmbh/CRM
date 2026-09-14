// AnschreibenDrawer: Vorlagen-Filter (Standard + eigene + shared),
// Senden-Gate (Empfaenger + Betreff + Body + PDF), Plus-Save privat.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnschreibenDrawer } from '../core/anschreiben/AnschreibenDrawer.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

function chain(result) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    order: vi.fn(() => c),
    insert: vi.fn(() => c),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return c;
}

const VORLAGEN = [
  { id: 'v-std', name: 'Standard', betreff: 'Briefing: {{briefing}}', body: 'Hallo {{vorname}}', empfaenger_typ: null, is_standard: true, is_shared: true, created_by: null },
  { id: 'v-mgmt', name: 'Mgmt', betreff: 'M', body: 'Nur Mgmt', empfaenger_typ: 'management', is_standard: false, is_shared: false, created_by: 'ben1' },
  { id: 'v-own', name: 'Meine', betreff: 'Eigene', body: 'Privat', empfaenger_typ: 'creator', is_standard: false, is_shared: false, created_by: 'ben1' },
];

function mockDb(vorlagen = VORLAGEN) {
  const mailvorlage = chain({ data: vorlagen, error: null });
  return { from: vi.fn((t) => (t === 'mailvorlage' ? mailvorlage : chain({ data: [], error: null }))) };
}

async function openDrawer(db, opts = {}) {
  const drawer = new AnschreibenDrawer({
    dokumentTyp: 'briefing',
    dokumentId: 'b1',
    dokumentName: 'Glow Up',
    unternehmenId: 'u1',
    db,
    createPdf: vi.fn(async () => ({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), dateiname: 'glow.pdf' })),
    ...opts,
  });
  await drawer.open();
  return drawer;
}

describe('AnschreibenDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.toastSystem = { show: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    window.currentUser = { id: 'ben1' };
  });

  it('rendert Drawer mit Composer, Vorlage, Betreff, Body, Anhang', async () => {
    const drawer = await openDrawer(mockDb());
    expect(document.querySelector('.anschreiben-drawer')).not.toBeNull();
    expect(document.querySelector('.drawer-title').textContent).toBe('Anschreiben');
    expect(document.querySelector('.drawer-subtitle').textContent).toBe('Glow Up');
    expect(document.querySelector('[data-composer] .empfaenger-composer')).not.toBeNull();
    expect(document.querySelector('[data-vorlage-select]')).not.toBeNull();
    expect(document.querySelector('[data-betreff]')).not.toBeNull();
    expect(document.querySelector('[data-body]')).not.toBeNull();
    expect(document.querySelector('[data-pdf-status]').textContent).toBe('glow.pdf');
    const sendBtn = document.querySelector('.drawer-footer [data-action="send"]');
    expect(sendBtn).not.toBeNull();
    expect(sendBtn.textContent).toBe('Senden');
    expect(document.querySelector('.drawer-body [data-action="send"]')).toBeNull();
    drawer.close();
  });

  it('fuellt Betreff/Body aus der Standard-Vorlage', async () => {
    const drawer = await openDrawer(mockDb());
    expect(document.querySelector('[data-betreff]').value).toBe('Briefing: {{briefing}}');
    expect(document.querySelector('[data-body]').value).toBe('Hallo {{vorname}}');
    drawer.close();
  });

  it('filtert Vorlagen nach Empfaenger-Typ (Creator sieht kein Management-Template)', async () => {
    const drawer = await openDrawer(mockDb());
    // Composer startet als creator
    const options = [...document.querySelectorAll('[data-vorlage-select] option')].map((o) => o.value);
    expect(options).toContain('v-std');
    expect(options).toContain('v-own');
    expect(options).not.toContain('v-mgmt');
    drawer.close();
  });

  it('Senden ist ohne Empfaenger deaktiviert', async () => {
    const drawer = await openDrawer(mockDb());
    expect(document.querySelector('[data-action="send"]').disabled).toBe(true);
    drawer.close();
  });

  it('Senden wird mit Empfaenger + Betreff + Body + PDF aktiv', async () => {
    const drawer = await openDrawer(mockDb());
    drawer.composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' });
    expect(document.querySelector('[data-action="send"]').disabled).toBe(false);
    drawer.close();
  });

  it('speichert eine neue Vorlage privat per Plus', async () => {
    const db = mockDb();
    const neueVorlage = { id: 'v-neu', name: 'Neu', betreff: 'B', body: 'T', empfaenger_typ: 'creator', is_standard: false, is_shared: false, created_by: 'ben1' };
    db.from.mockImplementation((t) => {
      if (t === 'mailvorlage') {
        const c = chain({ data: VORLAGEN, error: null });
        c.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: neueVorlage, error: null })) })) }));
        return c;
      }
      return chain({ data: [], error: null });
    });
    vi.spyOn(window, 'prompt').mockReturnValue('Neu');
    vi.spyOn(window, 'confirm').mockReturnValue(false); // nicht shared

    const drawer = await openDrawer(db);
    document.querySelector('[data-action="vorlage-save"]').click();
    await vi.waitFor(() => {
      expect(window.toastSystem.show).toHaveBeenCalledWith('Vorlage gespeichert', 'success');
    });

    const insertArg = db.from.mock.results
      .map((r) => r.value)
      .find((v) => v?.insert?.mock?.calls?.length)?.insert.mock.calls[0][0];
    expect(insertArg).toMatchObject({ name: 'Neu', is_shared: false, created_by: 'ben1' });
    window.prompt.mockRestore();
    window.confirm.mockRestore();
    drawer.close();
  });

  it('schliesst ueber Abbrechen', async () => {
    const drawer = await openDrawer(mockDb());
    document.querySelector('.drawer-footer [data-action="close"]').click();
    expect(document.querySelector('.anschreiben-drawer')).toBeNull();
  });
});
