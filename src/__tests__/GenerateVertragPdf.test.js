import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loadStammdaten = vi.fn(async () => {});
const loadDraftFromDB = vi.fn(async () => {});
const generatePDF = vi.fn(async () => ({ fileUrl: 'https://dropbox.test/v.pdf' }));

vi.mock('../modules/vertrag/create/VertraegeCreate.js', () => ({
  VertraegeCreate: class {
    constructor() { this.formData = { typ: 'UGC', vertrag_template: 'legacy' }; }
    loadStammdaten = loadStammdaten;
    loadDraftFromDB = loadDraftFromDB;
    generatePDF = generatePDF;
  }
}));

import { generateVertragPdf } from '../modules/vertrag/generateVertragPdf.js';

describe('generateVertragPdf', () => {
  beforeEach(() => {
    loadStammdaten.mockClear();
    loadDraftFromDB.mockClear();
    generatePDF.mockClear();
    generatePDF.mockResolvedValue({ fileUrl: 'https://dropbox.test/v.pdf' });
    window.toastSystem = { show: vi.fn() };
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'v1', typ: 'UGC', name: 'UGC Test' }, error: null })
          })
        })
      })
    };
  });

  afterEach(() => {
    delete window.toastSystem;
    delete window.supabase;
  });

  const ohneDatei = { id: 'v1', typ: 'UGC', is_draft: false, datei_url: null };

  it('erzeugt PDF und laedt die Liste neu', async () => {
    const list = {
      vertraege: [ohneDatei],
      getVertragPermissions: () => ({ canEdit: true }),
      reloadData: vi.fn(async () => {})
    };

    const result = await generateVertragPdf(list, 'v1');

    expect(loadStammdaten).toHaveBeenCalled();
    expect(loadDraftFromDB).toHaveBeenCalledWith('v1');
    expect(generatePDF).toHaveBeenCalled();
    expect(result.fileUrl).toBe('https://dropbox.test/v.pdf');
    expect(list.reloadData).toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('PDF erzeugt', 'success');
  });

  it('bricht ohne canEdit ab', async () => {
    const list = {
      vertraege: [ohneDatei],
      getVertragPermissions: () => ({ canEdit: false }),
      reloadData: vi.fn(async () => {})
    };

    const result = await generateVertragPdf(list, 'v1');

    expect(result).toBeNull();
    expect(generatePDF).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Sie haben keine Berechtigung, Verträge zu bearbeiten.',
      'warning'
    );
  });

  it('wirft wenn generatePDF keine URL liefert', async () => {
    generatePDF.mockResolvedValueOnce(undefined);
    const list = {
      vertraege: [ohneDatei],
      getVertragPermissions: () => ({ canEdit: true }),
      reloadData: vi.fn(async () => {})
    };

    await expect(generateVertragPdf(list, 'v1')).rejects.toThrow('PDF konnte nicht gespeichert werden');
    expect(list.reloadData).not.toHaveBeenCalled();
  });
});
