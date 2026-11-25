import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dokumentHochladen } from '../core/ablage/dokumentAblage.js';
import { uploadGeneratedVertragPdf } from '../modules/vertrag/create/pdf/VertragPdfUpload.js';

const SPALTEN = {
  datei_ablage: 'sharepoint',
  datei_drive_id: 'd1',
  datei_item_id: 'i1',
  datei_url: 'https://t.sharepoint.com/Vertrag_EHG_Test.pdf',
  datei_path: 'Daten/EHG/Verträge/EF UGC Q3/Vertrag_EHG_Test.pdf',
};

vi.mock('../core/ablage/dokumentAblage.js', () => ({ dokumentHochladen: vi.fn() }));

function makeVertrag() {
  return { id: 'v-1', typ: 'UGC', kunde_unternehmen_id: 'u-ehg', kampagne_id: 'k-1', creator_id: 'c-1' };
}

describe('uploadGeneratedVertragPdf', () => {
  let updateEq;

  beforeEach(() => {
    vi.mocked(dokumentHochladen).mockReset();
    vi.mocked(dokumentHochladen).mockImplementation(async ({ speichern }) => {
      await speichern(SPALTEN);
      return { spalten: SPALTEN, fileUrl: SPALTEN.datei_url, filePath: SPALTEN.datei_path };
    });
    updateEq = vi.fn(async () => ({ error: null }));
    window.supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: updateEq }))
      }))
    };
  });

  afterEach(() => {
    delete window.supabase;
  });

  it('lädt als benannte PDF nach SharePoint und schreibt die Spalten am Vertrag', async () => {
    const result = await uploadGeneratedVertragPdf(makeVertrag(), new Blob(['pdf']), 'Vertrag_EHG_Test.pdf');

    expect(result).toEqual({ fileUrl: SPALTEN.datei_url, filePath: SPALTEN.datei_path });
    const arg = vi.mocked(dokumentHochladen).mock.calls[0][0];
    expect(arg).toMatchObject({ typ: 'vertrag', bezugId: 'v-1' });
    expect(arg.file.name).toBe('Vertrag_EHG_Test.pdf');
    expect(arg.file.type).toBe('application/pdf');
    expect(window.supabase.from).toHaveBeenCalledWith('vertraege');
    expect(updateEq).toHaveBeenCalledWith('id', 'v-1');
    expect(window.supabase.from.mock.results[0].value.update.mock.calls[0][0]).toEqual(SPALTEN);
  });

  it('Update-Error ist kein stiller Erfolg', async () => {
    updateEq.mockResolvedValueOnce({ error: { message: 'rls denied' } });
    await expect(uploadGeneratedVertragPdf(makeVertrag(), new Blob(['pdf']), 'Vertrag_EHG_Test.pdf')).rejects.toThrow('rls denied');
  });

  it('wirft wenn der Vertrag keine id hat', async () => {
    await expect(uploadGeneratedVertragPdf({ ...makeVertrag(), id: null }, new Blob(['pdf']), 'Vertrag_EHG_Test.pdf')).rejects.toThrow('Vertrag ohne ID');
    expect(dokumentHochladen).not.toHaveBeenCalled();
  });

  it('wirft den Upload-Fehler weiter', async () => {
    vi.mocked(dokumentHochladen).mockRejectedValueOnce(new Error('Ablage-Ziel konnte nicht bestimmt werden'));
    await expect(uploadGeneratedVertragPdf(makeVertrag(), new Blob(['pdf']), 'Vertrag_EHG_Test.pdf'))
      .rejects.toThrow('Ablage-Ziel konnte nicht bestimmt werden');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });
});
