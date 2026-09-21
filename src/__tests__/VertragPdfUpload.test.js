import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadVertragPdf } from '../core/DropboxDocumentUploader.js';
import { uploadGeneratedVertragPdf } from '../modules/vertrag/create/pdf/VertragPdfUpload.js';

vi.mock('../core/DropboxDocumentUploader.js', () => ({
  uploadVertragPdf: vi.fn(async () => ({
    fileUrl: 'https://dropbox.test/vertrag.pdf',
    filePath: '/EHG/Kampagne/Vertraege/Anna_UGC/Vertrag_EHG_Test.pdf'
  }))
}));

function makeCtx() {
  return {
    unternehmen: [{ id: 'u-ehg', firmenname: 'EHG GmbH & Co. KG' }],
    creators: [{ id: 'c-1', vorname: 'Anna', nachname: 'Creator' }],
    kampagnen: [{
      id: 'k-1',
      kampagnenname: 'EF UGC Q3',
      marke: { markenname: 'ernsting\'s family' }
    }]
  };
}

function makeVertrag() {
  return {
    id: 'v-1',
    typ: 'UGC',
    kunde_unternehmen_id: 'u-ehg',
    kampagne_id: 'k-1',
    creator_id: 'c-1'
  };
}

describe('uploadGeneratedVertragPdf', () => {
  let updateEq;

  beforeEach(() => {
    vi.mocked(uploadVertragPdf).mockClear();
    vi.mocked(uploadVertragPdf).mockResolvedValue({
      fileUrl: 'https://dropbox.test/vertrag.pdf',
      filePath: '/EHG/Kampagne/Vertraege/Anna_UGC/Vertrag_EHG_Test.pdf'
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

  it('schreibt datei_url und datei_path am Vertrag', async () => {
    const result = await uploadGeneratedVertragPdf(
      makeCtx(),
      makeVertrag(),
      new Blob(['pdf']),
      'Vertrag_EHG_Test.pdf'
    );

    expect(result.fileUrl).toBe('https://dropbox.test/vertrag.pdf');
    expect(window.supabase.from).toHaveBeenCalledWith('vertraege');
    expect(updateEq).toHaveBeenCalledWith('id', 'v-1');
    const updateArg = window.supabase.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updateArg).toEqual({
      datei_url: 'https://dropbox.test/vertrag.pdf',
      datei_path: '/EHG/Kampagne/Vertraege/Anna_UGC/Vertrag_EHG_Test.pdf'
    });
  });

  it('Update-Error ist kein stiller Erfolg', async () => {
    updateEq.mockResolvedValueOnce({ error: { message: 'rls denied' } });

    await expect(uploadGeneratedVertragPdf(
      makeCtx(),
      makeVertrag(),
      new Blob(['pdf']),
      'Vertrag_EHG_Test.pdf'
    )).rejects.toThrow('rls denied');
  });

  it('wirft wenn Dropbox keinen fileUrl liefert', async () => {
    vi.mocked(uploadVertragPdf).mockResolvedValueOnce({});
    await expect(uploadGeneratedVertragPdf(
      makeCtx(),
      makeVertrag(),
      new Blob(['pdf']),
      'Vertrag_EHG_Test.pdf'
    )).rejects.toThrow('Dropbox-Upload ohne Datei-URL');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('wirft wenn der Vertrag keine id hat', async () => {
    await expect(uploadGeneratedVertragPdf(
      makeCtx(),
      { ...makeVertrag(), id: null },
      new Blob(['pdf']),
      'Vertrag_EHG_Test.pdf'
    )).rejects.toThrow('Vertrag ohne ID');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('wirft den Dropbox-Fehler weiter', async () => {
    vi.mocked(uploadVertragPdf).mockRejectedValueOnce(new Error('token expired'));
    await expect(uploadGeneratedVertragPdf(
      makeCtx(),
      makeVertrag(),
      new Blob(['pdf']),
      'Vertrag_EHG_Test.pdf'
    )).rejects.toThrow('token expired');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });
});
