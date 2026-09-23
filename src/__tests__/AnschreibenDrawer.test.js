// AnschreibenDrawer: Vorlagen-Filter (Standard + eigene + shared),
// Senden-Gate (Empfaenger + Betreff + Body + PDF), Plus-Save privat.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnschreibenDrawer } from '../core/anschreiben/AnschreibenDrawer.js';
import { authorizedFetch } from '../core/auth/getAccessToken.js';

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(),
}));

function chain(result) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    not: vi.fn(() => c),
    or: vi.fn(() => c),
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
    expect(insertArg).toMatchObject({ name: 'Neu', is_shared: false, created_by: 'ben1', dokument_typ: 'briefing' });
    window.prompt.mockRestore();
    window.confirm.mockRestore();
    drawer.close();
  });

  it('filtert Vorlagen nach dokument_typ', async () => {
    const mixed = [
      ...VORLAGEN,
      { id: 'v-vertrag', name: 'Vertrag', betreff: 'V', body: 'V', empfaenger_typ: null, is_standard: true, is_shared: true, created_by: null, dokument_typ: 'vertrag' },
    ];
    mixed[0] = { ...mixed[0], dokument_typ: 'briefing' };
    const drawer = await openDrawer(mockDb(mixed), { dokumentTyp: 'vertrag' });
    const options = [...document.querySelectorAll('[data-vorlage-select] option')].map((o) => o.value);
    expect(options).toEqual(['v-vertrag']);
    drawer.close();
  });

  it('schliesst ueber Abbrechen', async () => {
    const drawer = await openDrawer(mockDb());
    document.querySelector('.drawer-footer [data-action="close"]').click();
    expect(document.querySelector('.anschreiben-drawer')).toBeNull();
  });

  it('erlaubt Senden wenn PDF vom Server kommt', async () => {
    const drawer = await openDrawer(mockDb(), {
      createPdf: vi.fn(async () => ({ blob: null, dateiname: 'v.pdf', serverFallback: true })),
    });
    drawer.composer.getEmpfaenger = () => [{ typ: 'creator', id: 'c1', email: 'a@b.de' }];
    drawer.composer.isEmpty = () => false;
    drawer.panel.querySelector('[data-betreff]').value = 'Betreff';
    drawer.panel.querySelector('[data-body]').value = 'Body';
    drawer._updateSendState();
    expect(drawer.panel.querySelector('[data-action="send"]').disabled).toBe(false);
    expect(document.querySelector('[data-pdf-status]').textContent).toContain('wird beim Senden geladen');
    drawer.close();
  });

  it('empfaengerFest zeigt Anzeige statt Picker und erlaubt Senden', async () => {
    const drawer = await openDrawer(mockDb(), {
      empfaengerFest: true,
      prefill: [{ typ: 'creator', id: 'c1', email: 'a@b.de', name: 'Anna', vorname: 'Anna' }],
    });
    expect(document.querySelector('.empfaenger-composer__toggle')).toBeNull();
    expect(document.querySelector('.empfaenger-fest__name').textContent).toBe('Anna');
    expect(document.querySelector('[data-action="send"]').disabled).toBe(false);
    drawer.close();
  });

  it('Extras bauen das PDF neu und mehrere PDFs gehen als Liste raus', async () => {
    const createPdf = vi.fn()
      .mockResolvedValueOnce({ blob: new Blob(['%PDF']), dateiname: 'eins.pdf' })
      .mockResolvedValueOnce({
        pdfs: [
          { blob: new Blob(['a']), dateiname: 'a.pdf' },
          { blob: new Blob(['b']), dateiname: 'b.pdf' },
        ],
      });
    let onChange;
    const drawer = await openDrawer(mockDb(), {
      createPdf,
      mountExtras(container, hooks) {
        onChange = hooks.onChange;
        container.innerHTML = '<span data-extras>schalter</span>';
      },
      rewriteMail: (text) => text.replace('{{skript}}', 'Sommer'),
    });
    expect(document.querySelector('[data-extras]')).not.toBeNull();
    expect(createPdf).toHaveBeenCalledTimes(1);
    await onChange();
    expect(createPdf).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-pdf-status]').textContent).toBe('a.pdf, b.pdf');

    drawer.composer.addOne({ id: 'c1', email: 'a@b.de', name: 'A' });
    drawer.panel.querySelector('[data-betreff]').value = 'Skript: {{skript}}';
    authorizedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, failed: 0 }),
    });
    await drawer._send();
    const body = JSON.parse(authorizedFetch.mock.calls.at(-1)[1].body);
    expect(body.betreff).toBe('Skript: Sommer');
    expect(body.pdfs).toHaveLength(2);
    expect(body.pdfs[0].dateiname).toBe('a.pdf');
    expect(body.pdfBase64).toBe('');
    drawer.close();
  });

  it('legt PDFs pro Empfaenger in den Versand', async () => {
    const buildAnhaenge = vi.fn(async (empfaenger) => empfaenger.map((person) => ({
      empfaenger: person,
      pdfs: [{ blob: new Blob([person.id]), dateiname: `${person.id}.pdf` }],
    })));
    const drawer = await openDrawer(mockDb(), { buildAnhaenge });
    drawer.composer.addOne({ id: 'c1', email: 'a@b.de', name: 'Anna' });
    drawer.composer.addOne({ id: 'c2', email: 'b@b.de', name: 'Bea' });
    await drawer._buildPdf();
    drawer.panel.querySelector('[data-betreff]').value = 'Skript';
    drawer.panel.querySelector('[data-body]').value = 'Hallo';
    authorizedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 2, failed: 0 }),
    });
    await drawer._send();
    const body = JSON.parse(authorizedFetch.mock.calls.at(-1)[1].body);
    expect(body.pdfs).toBeUndefined();
    expect(body.pdfBase64).toBe('');
    expect(body.empfaenger.map((e) => e.pdfs[0].dateiname)).toEqual(['c1.pdf', 'c2.pdf']);
    drawer.close();
  });

  it('empfaengerFest ohne Mail haelt Senden disabled', async () => {
    const drawer = await openDrawer(mockDb(), {
      empfaengerFest: true,
      prefill: [{ typ: 'creator', id: 'c1', email: '', name: 'Anna' }],
    });
    expect(document.querySelector('.empfaenger-fest__name').textContent).toBe('Anna');
    expect(document.querySelector('[data-action="send"]').disabled).toBe(true);
    drawer.close();
  });
});
