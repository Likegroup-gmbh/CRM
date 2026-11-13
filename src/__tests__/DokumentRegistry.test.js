import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));
vi.mock('../core/AblageUploader.js', () => ({ uploadToSession: vi.fn(async () => ({ id: 'item1' })) }));

import { authorizedFetch } from '../core/auth/getAccessToken.js';
import { uploadToSession } from '../core/AblageUploader.js';
import {
  DOKUMENT, dokumentQuelle, dokumentSpalten, dokumentHochladen, dokumentLinkAttrs, istSharePointDokumentUrl, mitDokumentAblage,
  dokumentLoeschen, vertragDateienLoeschen, _clearDokumentCache,
} from '../core/ablage/dokumentAblage.js';

const require = createRequire(import.meta.url);
const server = require('../../netlify/functions/_shared/ablage/dokument.js');

/** Antworten je Function-Name, Aufrufe in `calls`. */
function antworten(map) {
  const calls = [];
  authorizedFetch.mockImplementation(async (url, opts) => {
    const fn = url.split('/').pop();
    const body = JSON.parse(opts.body || '{}');
    calls.push({ fn, body });
    const r = typeof map[fn] === 'function' ? map[fn](body) : map[fn];
    if (r instanceof Error) return { ok: false, status: 500, json: async () => ({ error: r.message }) };
    return { ok: true, status: 200, json: async () => r ?? {} };
  });
  return calls;
}

beforeEach(() => {
  authorizedFetch.mockReset();
  uploadToSession.mockClear();
  _clearDokumentCache();
});

describe('Registry: Client = Server', () => {
  it('gleiche Typen, Tabellen, Spalten, Buckets', () => {
    expect(Object.keys(DOKUMENT)).toEqual(server.TYPEN);
    for (const typ of server.TYPEN) {
      const s = server.DOKUMENT[typ];
      expect(DOKUMENT[typ]).toMatchObject({ tabelle: s.tabelle, art: s.art, bucket: s.bucket, spalten: s.spalten });
      expect(DOKUMENT[typ].bezugSpalte).toBe(s.bezugSpalte);
      expect(DOKUMENT[typ].alt).toEqual(s.alt);
    }
  });

  it('dokumentQuelle wie quelleVon (ohne SharePoint-Ids)', () => {
    const faelle = [
      ['vertrag', { datei_ablage: 'sharepoint', datei_item_id: 'x', datei_path: '/Firma/Verträge/v.pdf' }],
      ['vertrag', { datei_ablage: 'dropbox', datei_path: '/CRM/v.pdf', datei_url: 'https://dropbox.com/s/v?raw=1' }],
      ['vertrag', { datei_path: 'k/v.pdf', datei_url: 'https://p.supabase.co/storage/v1/object/public/vertraege/k/v.pdf' }],
      ['vertrag_unterschrieben', { unterschriebener_vertrag_path: 'x/s.pdf' }],
      ['auftragsdokument', { dropbox_file_url: 'https://example.com/a.pdf' }],
      ['beleg', {}],
    ];
    for (const [typ, row] of faelle) {
      expect(dokumentQuelle(typ, row)?.quelle ?? null).toBe(server.quelleVon(typ, row)?.quelle ?? null);
    }
  });

  it('ohne Ablage-Spalte im select: SharePoint an der webUrl erkennen, nicht am fuehrenden /', () => {
    expect(dokumentQuelle('rechnung', { file_path: '/Firma/Rechnungen/RE/r.pdf', file_url: 'https://x.sharepoint.com/sites/M/Daten/r.pdf' }).quelle).toBe('sharepoint');
    expect(dokumentQuelle('rechnung', { file_path: '/CRM/Rechnungen/r.pdf', file_url: 'https://dropbox.com/r' }).quelle).toBe('dropbox');
  });
});

describe('Spalten und Links', () => {
  it('SharePoint-Commit -> Registry-Spalten, Dropbox setzt die Ablage zurueck', () => {
    const commit = { drive_id: 'd1', item_id: 'i1', file_url: 'https://x.sharepoint.com/a.pdf', file_path: '/F/a.pdf', file_name: 'a.pdf', file_size: 3, etag: 'e', ctag: 'c' };
    expect(dokumentSpalten('vertrag', { ziel: 'sharepoint', commit })).toEqual({
      datei_ablage: 'sharepoint', datei_drive_id: 'd1', datei_item_id: 'i1', datei_url: commit.file_url, datei_path: '/F/a.pdf',
    });
    expect(dokumentSpalten('beleg', { ziel: 'dropbox', fileUrl: 'u', filePath: '/p', file: { name: 'b.pdf', size: 9 } })).toEqual({
      file_url: 'u', file_path: '/p', file_name: 'b.pdf', size: 9, ablage: 'dropbox', drive_id: null, item_id: null, etag: null, ctag: null,
    });
  });

  it('mitDokumentAblage und Link-Attribute', () => {
    expect(mitDokumentAblage('id, datei_url', 'vertrag', 'vertrag_unterschrieben'))
      .toBe('id, datei_url, datei_ablage, datei_drive_id, datei_item_id, signiert_ablage, signiert_drive_id, signiert_item_id');
    expect(dokumentLinkAttrs('rechnung', { id: 'r1', ablage: 'sharepoint', file_url: 'https://x.sharepoint.com/a.pdf' }))
      .toContain('data-ablage-dokument="rechnung:r1"');
    expect(dokumentLinkAttrs('rechnung', { id: 'r1', file_url: 'https://dropbox.com/a', file_path: '/a' })).not.toContain('data-ablage-dokument');
  });

  it('istSharePointDokumentUrl: Dateien in Dokument-Bereichen, keine Ordner, keine Medien', () => {
    const base = 'https://x.sharepoint.com/sites/Medienablage/Freigegebene%20Dokumente/Daten/Firma';
    expect(istSharePointDokumentUrl(`${base}/Vertr%C3%A4ge/Sommer/v.pdf`)).toBe(true);
    expect(istSharePointDokumentUrl(`${base}/Rechnungen/Sommer/RE-1/r.pdf`)).toBe(true);
    expect(istSharePointDokumentUrl(`${base}/Vertr%C3%A4ge/Sommer`)).toBe(false);
    expect(istSharePointDokumentUrl(`${base}/Medien/Sommer/Lisa/clip.mov`)).toBe(false);
    expect(istSharePointDokumentUrl('https://dropbox.com/Rechnungen/r.pdf')).toBe(false);
  });
});

describe('dokumentHochladen', () => {
  const file = new File(['%PDF'], 'v.pdf', { type: 'application/pdf' });

  it('Weiche dropbox: bisheriger Weg, Spalten fuer die Zeile', async () => {
    antworten({ 'ablage-upload-ziel': { ziel: 'dropbox' } });
    const dropbox = vi.fn(async () => ({ fileUrl: 'https://dropbox.com/v?raw=1', filePath: '/CRM/v.pdf' }));
    const speichern = vi.fn(async (spalten) => spalten);
    const r = await dokumentHochladen({ typ: 'vertrag', bezugId: 'vt1', file, dropbox, speichern });
    expect(r).toMatchObject({ ziel: 'dropbox', filePath: '/CRM/v.pdf' });
    expect(speichern).toHaveBeenCalledWith(expect.objectContaining({ datei_url: 'https://dropbox.com/v?raw=1', datei_ablage: 'dropbox' }), { ziel: 'dropbox' });
    expect(uploadToSession).not.toHaveBeenCalled();
  });

  it('SharePoint: Session, Commit, Speichern; scheitert Speichern, wird der Upload verworfen', async () => {
    const calls = antworten({
      'ablage-upload-ziel': (b) => ({ ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://up', chunk_bytes: 10, echo: b }),
      'ablage-upload-commit': { drive_id: 'd1', item_id: 'item1', file_url: 'https://x.sharepoint.com/v.pdf', file_path: '/F/v.pdf', file_name: 'v.pdf', file_size: 4 },
      'ablage-datei': { ok: true },
    });
    const dropbox = vi.fn();
    const ok = await dokumentHochladen({ typ: 'auftragsdokument', bezugId: 'a1', dokumentTyp: 'rechnung', file, dropbox, speichern: async (s) => s });
    expect(ok.ergebnis).toMatchObject({ ablage: 'sharepoint', item_id: 'item1', dropbox_file_path: '/F/v.pdf', dateiname: 'v.pdf' });
    expect(calls[0].body).toMatchObject({ typ: 'auftragsdokument', bezug_id: 'a1', dokument_typ: 'rechnung', file_name: 'v.pdf', file_size: 4 });
    expect(dropbox).not.toHaveBeenCalled();

    calls.length = 0;
    await expect(dokumentHochladen({ typ: 'beleg', bezugId: 'r1', file, dropbox, speichern: async () => { throw new Error('RLS'); } }))
      .rejects.toThrow('RLS');
    expect(calls.map((c) => c.fn)).toEqual(['ablage-upload-ziel', 'ablage-upload-commit', 'ablage-datei']);
    expect(calls[2].body).toEqual({ aktion: 'upload_verwerfen', upload_id: 'up1' });
  });
});

describe('dokumentLoeschen', () => {
  it('SharePoint ueber ablage-datei, Dropbox ueber dropbox-delete, Fehler nur geloggt', async () => {
    const calls = antworten({ 'ablage-datei': { geloescht: true }, 'dropbox-delete': {} });
    await dokumentLoeschen('rechnung', { id: 'r1', ablage: 'sharepoint', item_id: 'i', file_path: '/F/r.pdf' });
    await dokumentLoeschen('rechnung', { id: 'r2', ablage: 'dropbox', file_path: '/CRM/r.pdf' });
    expect(calls).toEqual([
      { fn: 'ablage-datei', body: { aktion: 'loeschen', typ: 'rechnung', id: 'r1' } },
      { fn: 'dropbox-delete', body: { filePath: '/CRM/r.pdf' } },
    ]);
    antworten({ 'ablage-datei': new Error('weg') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await dokumentLoeschen('beleg', { id: 'b1', ablage: 'sharepoint', item_id: 'i' })).toMatchObject({ quelle: 'sharepoint', fehler: 'weg' });
    warn.mockRestore();
  });

  it('vertragDateienLoeschen: erzeugtes PDF auf SharePoint, unterschriebenes auf Dropbox + Storage-Altbestand', async () => {
    const calls = antworten({ 'ablage-datei': { geloescht: true }, 'dropbox-delete': {} });
    const zeilen = {
      vertrag: { id: 'v1', datei_url: 'https://t.sharepoint.com/x.pdf', datei_path: 'Daten/A/Verträge/x.pdf', datei_ablage: 'sharepoint', datei_item_id: 'i1' },
      vertrag_unterschrieben: {
        id: 'v1', dropbox_file_url: 'https://dropbox/s.pdf', dropbox_file_path: '/CRM/s.pdf', signiert_ablage: 'dropbox',
        unterschriebener_vertrag_url: 'https://sb/alt.pdf', unterschriebener_vertrag_path: 'v1/alt.pdf',
      },
    };
    const remove = vi.fn(async () => ({ error: null }));
    let geladen = 0;
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: Object.values(zeilen)[geladen++], error: null }),
          }),
        }),
      }),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    await vertragDateienLoeschen('v1');
    expect(calls).toEqual([
      { fn: 'ablage-datei', body: { aktion: 'loeschen', typ: 'vertrag', id: 'v1' } },
      { fn: 'dropbox-delete', body: { filePath: '/CRM/s.pdf' } },
    ]);
    expect(window.supabase.storage.from).toHaveBeenCalledWith('unterschriebene-vertraege');
    expect(remove).toHaveBeenCalledWith(['v1/alt.pdf']);
    delete window.supabase;
  });
});

describe('Rechnungen: Upload nach dem Insert, Löschen samt Cascade', () => {
  const file = new File(['%PDF'], 'r.pdf', { type: 'application/pdf' });

  function fakeDb(tabellen) {
    const inserts = [];
    const deletes = [];
    const remove = vi.fn(async () => ({ error: null }));
    window.supabase = {
      from: (t) => ({
        insert: async (row) => { inserts.push({ t, row }); return { error: null }; },
        select: () => {
          const q = {
            eq: (col, v) => ({ ...q, maybeSingle: async () => ({ data: (tabellen[t] || []).find((r) => r[col] === v) || null, error: null }) }),
            in: async (col, ids) => ({ data: (tabellen[t] || []).filter((r) => ids.includes(r[col])), error: null }),
          };
          return q;
        },
        delete: () => ({ eq: async (col, v) => { deletes.push({ t, [col]: v }); return { error: null }; } }),
      }),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    return { inserts, deletes, remove };
  }

  it('SharePoint: Zeile mit Ablage-Spalten, uploaded_by je Tabelle; Pfad-Metadaten nur fuer Dropbox', async () => {
    window.currentUser = { id: 'b1', auth_user_id: 'auth1' };
    const { rechnungDateienHochladen } = await import('../core/ablage/rechnungDokumente.js');
    const { inserts } = fakeDb({});
    antworten({
      'ablage-upload-ziel': { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://up', chunk_bytes: 10 },
      'ablage-upload-commit': { drive_id: 'd1', item_id: 'i9', file_url: 'https://t.sharepoint.com/r.pdf', file_path: 'Daten/A/Rechnungen/R1/r.pdf', file_name: 'r.pdf', file_size: 4 },
    });
    const pathMeta = vi.fn(async () => ({}));
    await rechnungDateienHochladen({ typ: 'rechnung', rechnungId: 'r1', files: [file], pathMeta });
    await rechnungDateienHochladen({ typ: 'beleg', rechnungId: 'r1', files: [file], pathMeta });
    expect(pathMeta).not.toHaveBeenCalled();
    expect(inserts[0]).toMatchObject({ t: 'rechnung_pdfs', row: { rechnung_id: 'r1', uploaded_by: 'auth1', ablage: 'sharepoint', item_id: 'i9', file_path: 'Daten/A/Rechnungen/R1/r.pdf' } });
    expect(inserts[1]).toMatchObject({ t: 'rechnung_belege', row: { uploaded_by: 'b1', ablage: 'sharepoint' } });
    delete window.currentUser;
  });

  it('rechnungDateiLoeschen: Datei raus, dann Zeile', async () => {
    const { rechnungDateiLoeschen } = await import('../core/ablage/rechnungDokumente.js');
    const { deletes, remove } = fakeDb({ rechnung_belege: [{ id: 'b1', file_path: 'r1/alt.pdf', file_url: null, ablage: 'dropbox' }] });
    antworten({});
    await rechnungDateiLoeschen('beleg', 'b1');
    expect(window.supabase.storage.from).toHaveBeenCalledWith('rechnung-belege');
    expect(remove).toHaveBeenCalledWith(['r1/alt.pdf']);
    expect(deletes).toEqual([{ t: 'rechnung_belege', id: 'b1' }]);
  });

  it('dokumenteDerEntitaetLoeschen: Auftrag nimmt Auftragsdokumente und Rechnungs-PDFs/Belege mit', async () => {
    const { dokumenteDerEntitaetLoeschen, hatEntitaetDokumente } = await import('../core/ablage/dokumentAblage.js');
    fakeDb({
      rechnung: [{ id: 'r1', auftrag_id: 'a1' }, { id: 'r2', auftrag_id: 'a2' }],
      auftrag_dokumente: [{ id: 'd1', auftrag_id: 'a1', ablage: 'sharepoint', item_id: 'x', dropbox_file_path: 'Daten/A/Aufträge/AB.pdf' }],
      rechnung_pdfs: [{ id: 'p1', rechnung_id: 'r1', ablage: 'dropbox', file_path: '/CRM/r1.pdf' }, { id: 'p2', rechnung_id: 'r2', file_path: '/CRM/r2.pdf' }],
      rechnung_belege: [{ id: 'b1', rechnung_id: 'r1', ablage: 'sharepoint', item_id: 'y', file_path: 'Daten/A/Rechnungen/b.pdf' }],
    });
    const calls = antworten({ 'ablage-datei': { geloescht: true }, 'dropbox-delete': {} });
    expect(hatEntitaetDokumente('auftrag')).toBe(true);
    expect(hatEntitaetDokumente('kampagne')).toBe(false);
    await dokumenteDerEntitaetLoeschen('auftrag', ['a1']);
    expect(calls).toEqual([
      { fn: 'ablage-datei', body: { aktion: 'loeschen', typ: 'auftragsdokument', id: 'd1' } },
      { fn: 'dropbox-delete', body: { filePath: '/CRM/r1.pdf' } },
      { fn: 'ablage-datei', body: { aktion: 'loeschen', typ: 'beleg', id: 'b1' } },
    ]);
  });
});
