// Scheitert ein Upload nach dem Anlegen der Zeile, bleibt kein leerer Entwurf liegen.

import { describe, it, expect, vi } from 'vitest';
import { skripteUploadDatenMethoden } from '../modules/skripte/service/skripteUploadDaten.js';

function service({ pdfFehler = null, status = 'fertig' } = {}) {
  const geloescht = [];
  const db = {
    from: vi.fn(() => ({
      delete: () => ({ eq: (_, id) => { geloescht.push(id); return Promise.resolve({ error: null }); } }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { prompt_kontext: { upload_status: status, upload_fehler: 'kaputt' } }, error: null })
        })
      })
    }))
  };
  const s = Object.assign(Object.create(null), skripteUploadDatenMethoden, {
    db,
    _insertUploadSkript: vi.fn(async () => ({ id: 'sk-1' })),
    _ladePdfHoch: vi.fn(async () => { if (pdfFehler) throw new Error(pdfFehler); return 'skript-upload/u/sk-1.pdf'; }),
    triggerFunction: vi.fn(async () => {})
  });
  return { s, geloescht };
}

const pdf = () => new File(['%PDF-1.4'], 'Skript.pdf', { type: 'application/pdf' });

describe('Skript-Upload räumt auf', () => {
  it('PDF lässt sich nicht ablegen: Entwurf wird gelöscht, Fehler bleibt sichtbar', async () => {
    const { s, geloescht } = service({ pdfFehler: 'Upload fehlgeschlagen: RLS' });
    await expect(s.createSkriptAusUpload({ file: pdf(), payload: {} })).rejects.toThrow('RLS');
    expect(geloescht).toEqual(['sk-1']);
    expect(s.triggerFunction).not.toHaveBeenCalled();
  });

  it('Liky meldet einen Fehler: Entwurf wird gelöscht', async () => {
    const { s, geloescht } = service({ status: 'fehler' });
    await expect(s.createSkriptAusUpload({ file: pdf(), payload: {} })).rejects.toThrow('kaputt');
    expect(geloescht).toEqual(['sk-1']);
  });

  it('erfolgreicher Upload löscht nichts', async () => {
    const { s, geloescht } = service();
    await expect(s.createSkriptAusUpload({ file: pdf(), payload: {} })).resolves.toEqual({ id: 'sk-1' });
    expect(geloescht).toEqual([]);
  });
});
