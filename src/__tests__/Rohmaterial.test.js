import { describe, it, expect, beforeEach, vi } from 'vitest';

// uploadLargeFile importiert den Direct-Uploader dynamisch und wuerde echte
// XHRs gegen Dropbox fahren.
vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(({ dropboxPath }) => Promise.resolve({ path_display: dropboxPath })),
}));

import {
  buildRohmaterialFolderPath,
  buildRohmaterialFilePath,
} from '../../netlify/functions/dropbox-upload-rohmaterial.js';
import creatorUpload from '../../netlify/functions/_shared/creator-upload.js';
import {
  sanitizeRohmaterialFileName,
  resolveRohmaterialName,
  RohmaterialService,
} from '../modules/video/RohmaterialService.js';
import { VideoRohmaterialRenderer } from '../modules/video/VideoRohmaterialRenderer.js';
import { toDownloadDropboxUrl } from '../core/VideoUploadUtils.js';

const {
  buildTargetPath, validateFile, resolveTarget, loadMembership,
  SIZE_CAPS,
} = creatorUpload;

// Minimaler Service-Client fuer loadMembership: liefert pro Tabelle ein
// festes Ergebnis und ist in jeder Kette (select/eq/in/order) awaitbar.
function serviceClient(byTable) {
  return {
    from: (table) => {
      const result = { data: byTable[table] || [], error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve) => resolve(result),
      };
      return chain;
    },
  };
}

// ────────────────────────────────────────────────────────────
// Dropbox-Pfade
// ────────────────────────────────────────────────────────────

describe('Rohmaterial-Pfad (Staff-Upload)', () => {
  it('liegt als Geschwister von Videos/Storys/Bilder unter der Kooperation', () => {
    const p = buildRohmaterialFolderPath({
      unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C',
    });
    expect(p).toBe('/U/M/K/C/Rohmaterial');
  });

  it('behaelt den Originalnamen der Datei', () => {
    const p = buildRohmaterialFilePath({
      unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C',
      fileName: 'IMG_4711 Take 2.MOV',
    });
    expect(p).toBe('/U/M/K/C/Rohmaterial/IMG_4711 Take 2.MOV');
  });

  it('ersetzt nur Dropbox-verbotene Zeichen', () => {
    const p = buildRohmaterialFilePath({
      unternehmen: 'U', kampagne: 'K', kooperation: 'C',
      fileName: 'clip:01?.mp4',
    });
    expect(p).toBe('/U/K/C/Rohmaterial/clip-01-.mp4');
  });

  it('funktioniert ohne Marke (Unternehmen ohne Marken-Ebene)', () => {
    const p = buildRohmaterialFolderPath({ unternehmen: 'U', kampagne: 'K', kooperation: 'C' });
    expect(p).toBe('/U/K/C/Rohmaterial');
  });
});

describe('Rohmaterial-Pfad (Creator-Upload)', () => {
  const ctx = { unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C', creatorName: 'Max Muster' };

  it('baut denselben Pfad wie der Staff-Upload — sonst laufen die Abgaben auseinander', () => {
    const { filePath, folderPath } = buildTargetPath(
      ctx,
      { target_type: 'rohmaterial', file_name: 'clip.mov', _ext: 'mov' },
      {}
    );
    expect(filePath).toBe('/U/M/K/C/Rohmaterial/clip.mov');
    expect(folderPath).toBe('/U/M/K/C/Rohmaterial');
    expect(filePath).toBe(buildRohmaterialFilePath({ ...ctx, fileName: 'clip.mov' }));
  });

  it('nutzt keine Feedbackschleife und keinen Video-Unterordner', () => {
    const { filePath } = buildTargetPath(
      ctx,
      { target_type: 'rohmaterial', file_name: 'clip.mov', _ext: 'mov', version_number: 2 },
      { video: { position: 3, thema: 'Unboxing' } }
    );
    expect(filePath).not.toMatch(/Feedbackschleife/);
    expect(filePath).not.toMatch(/Video_/);
  });

  it('faellt auf rohmaterial.{ext} zurueck wenn der Name leer ist', () => {
    const { filePath } = buildTargetPath(
      ctx, { target_type: 'rohmaterial', file_name: '', _ext: 'zip' }, {}
    );
    expect(filePath).toBe('/U/M/K/C/Rohmaterial/rohmaterial.zip');
  });

  it('laesst den Videopfad unveraendert', () => {
    const { filePath } = buildTargetPath(
      ctx,
      { target_type: 'video', file_name: 'v.mp4', _ext: 'mp4', version_number: 1 },
      { video: { position: 1, thema: 'Test' } }
    );
    expect(filePath).toBe('/U/M/K/C/Videos/Video_1_Test/Feedbackschleife_1/max_muster_u_k_v1.mp4');
  });
});

// ────────────────────────────────────────────────────────────
// Versions-unabhaengige Dump-Logik
// ────────────────────────────────────────────────────────────

describe('Rohmaterial ist versionslos', () => {
  it('haengt an der Kooperation, nicht an einem Video-Slot', async () => {
    const supabase = serviceClient({
      kooperationen: [{ id: 'koop-1', name: 'C', kampagne: { id: 'k1', kampagnenname: 'K' } }],
    });
    const tokenRow = { id: 't1', kampagne_id: 'k1', creator_id: 'c1' };

    const hit = await resolveTarget(supabase, tokenRow, 'rohmaterial', 'koop-1');
    expect(hit).toMatchObject({ kind: 'rohmaterial' });
    expect(hit.koop.id).toBe('koop-1');

    // Fremde Kooperation gehoert nicht zum Token
    expect(await resolveTarget(supabase, tokenRow, 'rohmaterial', 'koop-2')).toBeNull();
  });

  it('loadMembership meldet die bereits abgelegten Dateien pro Kooperation', async () => {
    const supabase = serviceClient({
      kooperationen: [{ id: 'koop-1', name: 'C', kampagne: { id: 'k1', kampagnenname: 'K' } }],
      kooperation_rohmaterial_asset: [
        { kooperation_id: 'koop-1', file_name: 'clip.mov', file_size: 2048, created_at: '2026-08-30' },
      ],
    });

    const membership = await loadMembership(supabase, { id: 't1', kampagne_id: 'k1', creator_id: 'c1' });

    expect(membership.kooperationen[0].rohmaterial).toEqual([{ name: 'clip.mov', size: 2048 }]);
  });

  it('erlaubt Video-Formate und zip bis 10 GB', () => {
    expect(SIZE_CAPS.rohmaterial).toBe(10 * 1024 * 1024 * 1024);

    expect(validateFile('rohmaterial', 'clip.mov', 5_000_000_000).ok).toBe(true);
    expect(validateFile('rohmaterial', 'takes.zip', 1_000).ok).toBe(true);

    expect(validateFile('rohmaterial', 'takes.zip', 1_000).contentType).toBe('application/zip');

    const tooBig = validateFile('rohmaterial', 'clip.mov', 11 * 1024 * 1024 * 1024);
    expect(tooBig).toMatchObject({ ok: false, code: 'too_large' });

    const badType = validateFile('rohmaterial', 'foto.jpg', 1_000);
    expect(badType).toMatchObject({ ok: false, code: 'bad_type' });

    expect(validateFile('rohmaterial', 'clip.mov', 0)).toMatchObject({ ok: false, code: 'empty' });
  });

  it('laesst zip in den anderen Zieltypen weiterhin nicht zu', () => {
    expect(validateFile('video', 'takes.zip', 1_000)).toMatchObject({ ok: false, code: 'bad_type' });
    expect(validateFile('bilder', 'takes.zip', 1_000)).toMatchObject({ ok: false, code: 'bad_type' });
  });
});

// ────────────────────────────────────────────────────────────
// Namenskollision
// ────────────────────────────────────────────────────────────

describe('Namenskollision im Rohmaterial-Ordner', () => {
  it('haengt _2, _3 vor der Extension an', () => {
    const taken = new Set(['clip.mov']);
    expect(resolveRohmaterialName('clip.mov', taken)).toBe('clip_2.mov');
    taken.add('clip_2.mov');
    expect(resolveRohmaterialName('clip.mov', taken)).toBe('clip_3.mov');
  });

  it('laesst freie Namen unveraendert', () => {
    expect(resolveRohmaterialName('clip.mov', new Set())).toBe('clip.mov');
  });

  it('kommt mit Namen ohne Extension klar', () => {
    expect(resolveRohmaterialName('README', new Set(['README']))).toBe('README_2');
  });

  it('sanitized wie sanitizePath auf dem Server (idempotent)', () => {
    const once = sanitizeRohmaterialFileName('a<b>c|d.mov');
    expect(once).toBe('a-b-c-d.mov');
    expect(sanitizeRohmaterialFileName(once)).toBe(once);
  });
});

// ────────────────────────────────────────────────────────────
// Staff-Upload / Loeschen
// ────────────────────────────────────────────────────────────

function chainable(result) {
  const mock = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    order: vi.fn(() => mock),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => mock),
    then: (resolve) => resolve(result),
  };
  return mock;
}

describe('RohmaterialService.uploadFiles', () => {
  let inserted;
  let preparedNames;

  beforeEach(() => {
    inserted = [];
    preparedNames = [];
    window.currentUser = { id: 'u1', rolle: 'admin' };

    window.supabase = {
      from: vi.fn(() => {
        const mock = chainable({ data: [{ file_name: 'clip.mov' }], error: null });
        mock.insert = vi.fn((row) => {
          inserted.push(row);
          return Promise.resolve({ error: null });
        });
        return mock;
      }),
    };

    global.fetch = vi.fn((url, opts) => {
      const body = JSON.parse(opts.body);
      if (String(url).includes('dropbox-upload-rohmaterial')) {
        preparedNames.push(body.fileName);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            token: 'tok',
            dropboxPath: `/U/K/C/Rohmaterial/${body.fileName}`,
            folderPath: '/U/K/C/Rohmaterial',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://dropbox.com/x?dl=0' }) });
    });
  });

  const group = {
    id: 'koop-1',
    pathContext: { unternehmen: 'U', marke: '', kampagne: 'K', kooperation: 'C' },
  };

  it('weicht einem in der DB belegten Dateinamen aus', async () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const { uploaded, errors } = await RohmaterialService.uploadFiles(group, [file]);

    expect(errors).toEqual([]);
    expect(uploaded).toBe(1);
    expect(preparedNames).toEqual(['clip_2.mov']);
    expect(inserted[0]).toMatchObject({
      kooperation_id: 'koop-1',
      file_name: 'clip_2.mov',
      file_path: '/U/K/C/Rohmaterial/clip_2.mov',
      uploaded_by: 'u1',
    });
  });

  it('vergibt innerhalb einer Auswahl unterschiedliche Namen', async () => {
    const mk = (name) => {
      const f = new File(['x'], name, { type: 'video/quicktime' });
      Object.defineProperty(f, 'size', { value: 1024 });
      return f;
    };

    await RohmaterialService.uploadFiles(group, [mk('neu.mov'), mk('neu.mov')]);
    expect(preparedNames).toEqual(['neu.mov', 'neu_2.mov']);
  });

  it('meldet ungueltige Dateien statt sie hochzuladen', async () => {
    const bad = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bad, 'size', { value: 1024 });

    const { uploaded, errors } = await RohmaterialService.uploadFiles(group, [bad]);

    expect(uploaded).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/nur Video-Dateien oder ZIP/);
    expect(preparedNames).toEqual([]);
  });

  it('validiert gegen denselben 10-GB-Cap wie der Creator-Upload', () => {
    const big = new File(['x'], 'clip.mov');
    Object.defineProperty(big, 'size', { value: SIZE_CAPS.rohmaterial + 1 });
    expect(RohmaterialService.validateFile(big)).toMatchObject({ ok: false });
  });
});

describe('RohmaterialService.deleteAsset', () => {
  it('loescht in Dropbox und in der Datenbank', async () => {
    const deleted = { dropbox: null, dbId: null };

    global.fetch = vi.fn((url, opts) => {
      deleted.dropbox = JSON.parse(opts.body).filePath;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    window.supabase = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => {
            deleted.dbId = id;
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    };

    await RohmaterialService.deleteAsset({ id: 'a1', file_path: '/U/K/C/Rohmaterial/clip.mov' });

    expect(deleted.dropbox).toBe('/U/K/C/Rohmaterial/clip.mov');
    expect(deleted.dbId).toBe('a1');
  });

  it('entfernt die DB-Zeile auch wenn Dropbox scheitert — sonst bleibt ein Geist in der Liste', async () => {
    let dbId = null;
    global.fetch = vi.fn(() => Promise.reject(new Error('Dropbox down')));
    window.supabase = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => { dbId = id; return Promise.resolve({ error: null }); }),
        })),
      })),
    };

    await RohmaterialService.deleteAsset({ id: 'a1', file_path: '/x/clip.mov' });
    expect(dbId).toBe('a1');
  });
});

// ────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────

describe('VideoRohmaterialRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="rohmaterial-groups"></div>';
  });

  const group = (over = {}) => ({
    id: 'koop-1',
    name: 'Koop A',
    creatorName: 'Max Muster',
    folderUrl: 'https://dropbox.com/folder?raw=1',
    files: [],
    ...over,
  });

  it('zeigt auch Kooperationen ohne Abgabe, damit fehlendes Material auffaellt', () => {
    VideoRohmaterialRenderer.updateGroups([group()]);
    const host = document.getElementById('rohmaterial-groups');
    expect(host.textContent).toContain('Max Muster');
    expect(host.textContent).toContain('Noch kein Rohmaterial hochgeladen');
  });

  it('rendert Datei-Zeilen mit Download- und Loeschen-Aktion', () => {
    VideoRohmaterialRenderer.updateGroups([group({
      files: [{
        id: 'a1',
        file_name: 'clip.mov',
        file_size: 2 * 1024 * 1024,
        file_url: 'https://dropbox.com/s/abc/clip.mov?raw=1',
        created_at: '2026-08-30T10:00:00Z',
      }],
    })]);

    const host = document.getElementById('rohmaterial-groups');
    expect(host.querySelector('tr[data-asset-id="a1"]')).toBeTruthy();
    expect(host.textContent).toContain('clip.mov');
    expect(host.textContent).toContain('2 MB');
    expect(host.querySelector('.rohmaterial-delete-btn')?.dataset.assetId).toBe('a1');
    expect(host.querySelector('.rohmaterial-upload-btn')?.dataset.koopId).toBe('koop-1');
    // Download statt Dropbox-Viewer
    expect(host.querySelector('a[href*="dl=1"]')).toBeTruthy();
  });

  // .rohmaterial-group clippt fuer den Radius (overflow: hidden). Ohne eigenen
  // Scroll-Wrapper ist die Aktionsspalte auf schmalen Viewports abgeschnitten,
  // und Download/Loeschen sind nicht mehr erreichbar.
  it('legt die Tabelle in einen scrollbaren Wrapper', () => {
    VideoRohmaterialRenderer.updateGroups([group({
      files: [{ id: 'a1', file_name: 'clip.mov', file_size: 1024, created_at: '2026-08-30T10:00:00Z' }],
    })]);

    const table = document.querySelector('#rohmaterial-groups .data-table');
    expect(table.parentElement.classList.contains('rohmaterial-table-wrap')).toBe(true);
  });

  it('rendert keinen Ordner-Link solange es keinen gibt', () => {
    VideoRohmaterialRenderer.updateGroups([group({ folderUrl: null })]);
    const host = document.getElementById('rohmaterial-groups');
    expect(host.textContent).not.toContain('Ordner öffnen');
  });

  it('zeigt einen Empty-State wenn die Kampagne keine Kooperationen hat', () => {
    VideoRohmaterialRenderer.updateGroups([]);
    expect(document.getElementById('rohmaterial-groups').textContent).toContain('Keine Kooperationen');
  });
});

describe('toDownloadDropboxUrl', () => {
  it('tauscht raw=1 gegen dl=1', () => {
    expect(toDownloadDropboxUrl('https://www.dropbox.com/s/x/clip.mov?raw=1'))
      .toBe('https://www.dropbox.com/s/x/clip.mov?dl=1');
  });

  it('behaelt rlkey-Parameter', () => {
    const url = toDownloadDropboxUrl('https://www.dropbox.com/scl/fi/x/clip.mov?rlkey=abc&raw=1');
    expect(url).toContain('rlkey=abc');
    expect(url).toContain('dl=1');
    expect(url).not.toContain('raw=1');
  });

  it('gibt null zurueck fuer Fremd-URLs', () => {
    expect(toDownloadDropboxUrl('https://example.com/clip.mov')).toBeNull();
    expect(toDownloadDropboxUrl(null)).toBeNull();
  });
});
