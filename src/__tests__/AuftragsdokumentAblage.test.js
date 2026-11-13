import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));
vi.mock('../core/AblageUploader.js', () => ({ uploadToSession: vi.fn(async () => ({ id: 'item1' })) }));
vi.mock('../core/VideoUploadUtils.js', () => ({
  proxyPost: vi.fn(async () => ({ path_display: '/CRM/Acme/AB.pdf' })),
  uploadLargeFile: vi.fn(),
  readFileAsBase64: vi.fn(async () => 'QUJD'),
}));

import { authorizedFetch } from '../core/auth/getAccessToken.js';
import { _clearDokumentCache } from '../core/ablage/dokumentAblage.js';
import { deleteAuftragsbestaetigung, uploadAuftragsbestaetigung } from '../core/AuftragsbestaetigungUploader.js';

function antworten(map) {
  const calls = [];
  authorizedFetch.mockImplementation(async (url, opts) => {
    const fn = url.split('/').pop();
    const body = JSON.parse(opts.body || '{}');
    calls.push({ fn, body });
    const r = typeof map[fn] === 'function' ? map[fn](body) : map[fn];
    return { ok: true, status: 200, json: async () => r ?? {} };
  });
  return calls;
}

function fakeDb(zeilen = {}) {
  const inserts = [];
  const deletes = [];
  window.supabase = {
    from: (t) => ({
      insert: (row) => {
        inserts.push({ t, row });
        return { select: () => ({ single: async () => ({ data: { id: 'neu1' }, error: null }) }) };
      },
      select: () => ({ eq: (c, v) => ({ maybeSingle: async () => ({ data: (zeilen[t] || []).find((r) => r[c] === v) || null, error: null }) }) }),
      delete: () => ({ eq: async (c, v) => { deletes.push({ t, [c]: v }); return { error: null }; } }),
    }),
  };
  return { inserts, deletes };
}

const file = new File(['%PDF'], 'AB.pdf', { type: 'application/pdf' });

beforeEach(() => {
  authorizedFetch.mockReset();
  _clearDokumentCache();
});

describe('Auftragsdokumente (ADR 0068)', () => {
  it('SharePoint: Rechnung zum Auftrag landet mit Ablage-Spalten in auftrag_dokumente', async () => {
    const { inserts } = fakeDb();
    const calls = antworten({
      'ablage-upload-ziel': { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://up', chunk_bytes: 10 },
      'ablage-upload-commit': {
        drive_id: 'd1', item_id: 'i1', file_url: 'https://t.sharepoint.com/AB.pdf',
        file_path: 'Daten/Acme/Aufträge/Auftrag X/Rechnungen/AB (2).pdf', file_name: 'AB (2).pdf', file_size: 4,
      },
    });
    const r = await uploadAuftragsbestaetigung({ file, auftragId: 'a1', dokumentTyp: 'rechnung', uploadedById: 'b1' });
    expect(calls[0].body).toMatchObject({ typ: 'auftragsdokument', bezug_id: 'a1', dokument_typ: 'rechnung' });
    expect(calls.map((c) => c.fn)).not.toContain('dropbox-upload-auftragsbestaetigung');
    expect(inserts[0].row).toMatchObject({
      auftrag_id: 'a1', dokument_typ: 'rechnung', uploaded_by: 'b1',
      ablage: 'sharepoint', item_id: 'i1', dateiname: 'AB (2).pdf', dropbox_file_path: 'Daten/Acme/Aufträge/Auftrag X/Rechnungen/AB (2).pdf',
    });
    expect(r).toMatchObject({ id: 'neu1', dateiname: 'AB (2).pdf' });
  });

  it('Weiche dropbox: bisheriger Dropbox-Weg', async () => {
    const { inserts } = fakeDb();
    antworten({
      'ablage-upload-ziel': { ziel: 'dropbox' },
      'dropbox-upload-auftragsbestaetigung': { token: 't', dropboxPath: '/CRM/Acme/AB.pdf' },
      'dropbox-proxy': { url: 'https://dropbox.com/s/AB.pdf?dl=0' },
    });
    await uploadAuftragsbestaetigung({ file, auftragId: 'a1', unternehmen: 'Acme' });
    expect(inserts[0].row).toMatchObject({
      dokument_typ: 'auftragsbestaetigung', dropbox_file_url: 'https://dropbox.com/s/AB.pdf?raw=1', dropbox_file_path: '/CRM/Acme/AB.pdf', ablage: 'dropbox',
    });
  });

  it('Loeschen: SharePoint ueber ablage-datei, dann Zeile', async () => {
    const { deletes } = fakeDb({ auftrag_dokumente: [{ id: 'd1', ablage: 'sharepoint', item_id: 'i1', dropbox_file_path: 'Daten/Acme/Aufträge/AB.pdf' }] });
    const calls = antworten({ 'ablage-datei': { geloescht: true } });
    await deleteAuftragsbestaetigung('d1', 'Daten/Acme/Aufträge/AB.pdf');
    expect(calls).toEqual([{ fn: 'ablage-datei', body: { aktion: 'loeschen', typ: 'auftragsdokument', id: 'd1' } }]);
    expect(deletes).toEqual([{ t: 'auftrag_dokumente', id: 'd1' }]);
  });
});
