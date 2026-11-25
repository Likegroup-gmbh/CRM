// Gemeinsamer Client für share-list: Body auch bei Status ≠ 2xx, einheitliches ok/fehler/status.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { call, shareApi } from '../modules/share/shareApi.js';

function fehler(status, body) {
  return {
    data: null,
    error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } },
  };
}

describe('shareApi', () => {
  let invoke;
  beforeEach(() => {
    invoke = vi.fn();
    window.supabase = { functions: { invoke } };
  });

  it('behält shareId und code einer 502-Antwort (Zugang angelegt, Mail gescheitert)', async () => {
    invoke.mockResolvedValue(fehler(502, {
      error: 'Zugang angelegt, aber E-Mail-Versand fehlgeschlagen.',
      shareId: 's1',
      code: '123456',
      link: 'https://app/share/tok',
    }));
    const res = await shareApi.create({ entityType: 'kampagne', entityId: 'k1', label: 'A', rechte: 'ansehen', emails: ['a@b.de'] });
    expect(res).toMatchObject({
      ok: false,
      status: 502,
      shareId: 's1',
      code: '123456',
      fehler: 'Zugang angelegt, aber E-Mail-Versand fehlgeschlagen.',
    });
    expect(invoke).toHaveBeenCalledWith('share-list', {
      body: {
        action: 'create', entityType: 'kampagne', entityId: 'k1', label: 'A', rechte: 'ansehen', emails: ['a@b.de'], endsWithKampagne: true,
      },
    });
  });

  it('liefert bei Erfolg ok und Status 200', async () => {
    invoke.mockResolvedValue({ data: { success: true, code: '654321' }, error: null });
    expect(await shareApi.rotateCode('s1')).toEqual({ success: true, code: '654321', ok: true, fehler: null, status: 200 });
    expect(invoke).toHaveBeenCalledWith('share-list', { body: { action: 'rotate_code', shareId: 's1' } });
  });

  it('meldet einen Netzwerkfehler ohne Body als nicht ok, ohne Text', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch', context: {} } });
    expect(await call('revoke', { shareId: 's1' })).toEqual({ ok: false, fehler: null, status: 0 });
  });

  it('wertet error im 200-Body als Fehler', async () => {
    invoke.mockResolvedValue({ data: { error: 'Keine Änderungen.' }, error: null });
    expect(await shareApi.update('s1', {})).toMatchObject({ ok: false, fehler: 'Keine Änderungen.' });
  });

  it('fragt die Aufteilung nur mit Adressen an und gibt bei Fehler null zurück', async () => {
    expect(await shareApi.plan({ emails: [], entityType: 'kampagne', entityId: 'k1' }))
      .toEqual({ listLink: [], guest: [], blocked: [] });
    expect(invoke).not.toHaveBeenCalled();

    invoke.mockResolvedValueOnce({ data: { plan: { guest: ['a@b.de'] } }, error: null });
    expect(await shareApi.plan({ emails: ['a@b.de'], entityType: 'kampagne', entityId: 'k1' }))
      .toEqual({ listLink: [], guest: ['a@b.de'], blocked: [] });

    invoke.mockResolvedValueOnce(fehler(500, { error: 'Empfänger konnten nicht geprüft werden.' }));
    expect(await shareApi.plan({ emails: ['a@b.de'], entityType: 'kampagne', entityId: 'k1' })).toBeNull();
  });

  it('schickt Listen-Links nur, wenn es Adressen gibt', async () => {
    expect(await shareApi.sendAccountLinks({ entityType: 'kampagne', entityId: 'k1', emails: [] }))
      .toMatchObject({ ok: true, fehler: null });
    expect(invoke).not.toHaveBeenCalled();
  });
});
