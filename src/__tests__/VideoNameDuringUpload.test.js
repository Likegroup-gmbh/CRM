import { describe, it, expect, vi, afterEach } from 'vitest';
import { VideoTableDrawerActions } from '../modules/kampagne/VideoTableDrawerActions.js';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';
import { VideoTableFieldHandler } from '../modules/kampagne/VideoTableFieldHandler.js';

const ablage = vi.hoisted(() => ({ ziel: { ziel: 'dropbox' }, calls: [] }));

vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(async () => ({ path_display: '/Kampagne/clip.mp4' })),
}));

vi.mock('../core/AblageUploader.js', () => ({
  uploadToSession: vi.fn(async () => ({ id: 'item1' })),
}));

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    const fn = String(url).split('/').pop();
    if (fn === 'ablage-upload-ziel' || fn === 'ablage-upload-commit') {
      ablage.calls.push({ fn, body: JSON.parse(opts.body) });
      const data = fn === 'ablage-upload-ziel' ? ablage.ziel : {
        ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1', etag: 'e1', ctag: 'c1',
        file_path: '/Herbst/Ada/clip_v1.mp4', file_name: 'clip_v1.mp4', file_size: 1,
        file_url: 'https://sp.example/clip_v1.mp4', folder_url: 'https://sp.example/Ada',
      };
      return { ok: true, json: async () => data };
    }
    if (String(url).includes('dropbox-upload')) {
      return {
        ok: true,
        json: async () => ({ token: 't', dropboxPath: '/Kampagne/clip.mp4', kooperationFolderPath: '/Kampagne' }),
      };
    }
    return { ok: true, json: async () => ({ url: 'https://dropbox.example/file?dl=0' }) };
  }),
}));

vi.mock('../core/VideoUploadUtils.js', async () => {
  const actual = await vi.importActual('../core/VideoUploadUtils.js');
  return {
    ...actual,
    createFolderSharedLink: vi.fn(async () => 'https://dropbox.example/folder'),
  };
});

const { runVideoUploadJob } = await import('../core/uploadJobs/runVideoUploadJob.js');

function supabaseRecording() {
  const updates = [];
  updates.inserts = [];
  window.supabase = {
    from(table) {
      return {
        select() {
          const result = Promise.resolve({ data: [], error: null });
          const chain = {
            eq: () => chain,
            maybeSingle: () => Promise.resolve({
              data: table === 'kooperation_videos' ? { link_content: 'https://db.example/link' } : null,
              error: null,
            }),
            then: result.then.bind(result),
          };
          return chain;
        },
        insert(data) {
          updates.inserts.push({ table, data });
          return Promise.resolve({ error: null });
        },
        update(data) {
          updates.push({ table, data });
          return {
            eq: () => Promise.resolve({ error: null }),
            in: () => Promise.resolve({ error: null }),
          };
        },
      };
    },
  };
  return updates;
}

describe('Video-Name während des Uploads', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    ablage.ziel = { ziel: 'dropbox' };
    ablage.calls = [];
  });

  it('überschreibt den in der Liste gesetzten Namen nicht, wenn der Upload fertig ist', () => {
    const video = { id: 'v1', video_name: 'Hook während Upload', link_content: null };
    const table = {
      videos: { k1: [video] },
      store: {
        updateVideo(_id, patch) {
          Object.assign(video, patch);
        },
      },
      refilter: vi.fn(),
    };

    new VideoTableDrawerActions(table).updateContentCellAfterUpload(
      'v1', 'k1', 'https://dropbox.example/file', 'Alter Name', 'https://dropbox.example/folder'
    );

    expect(video.video_name).toBe('Hook während Upload');
    expect(video.link_content).toBe('https://dropbox.example/file');
    expect(video.folder_url).toBe('https://dropbox.example/folder');
  });

  it('leert den in der Liste gesetzten Namen nicht, wenn beim Start kein Name vorlag', () => {
    const video = { id: 'v1', video_name: 'Hook während Upload' };
    const table = {
      videos: { k1: [video] },
      store: {
        updateVideo(_id, patch) {
          Object.assign(video, patch);
        },
      },
      refilter: vi.fn(),
    };

    new VideoTableDrawerActions(table).updateContentCellAfterUpload(
      'v1', 'k1', 'https://dropbox.example/file', '', null
    );

    expect(video.video_name).toBe('Hook während Upload');
  });

  it('schreibt den Snapshot-Namen beim Abschluss nicht in die Datenbank', async () => {
    const updates = supabaseRecording();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const result = await runVideoUploadJob({
      job: {
        payload: {
          videoId: 'v1',
          videoName: 'Alter Name',
          metadaten: {
            creatorName: 'Ada',
            unternehmen: 'Firma',
            kampagne: 'Herbst',
            videoPosition: 1,
            kooperationName: 'Koop',
          },
          queue: [{ file, variantName: '9:16', versionNumber: 1, isFinal: false }],
        },
        items: [{ id: 'i1', directOk: null }],
      },
      signal: new AbortController().signal,
      updateItem: () => {},
    });

    const videoUpdate = updates.find(u => u.table === 'kooperation_videos');
    // link_content und is_current setzt der DB-Trigger; der Job liest link_content nur zurück
    expect(videoUpdate.data).toEqual({ folder_url: 'https://dropbox.example/folder' });
    expect(updates.filter(u => u.table === 'kooperation_video_asset')).toEqual([]);
    expect(result.linkContent).toBe('https://db.example/link');
  });

  it('lädt mit mode add hoch, damit gleiche Variante derselben Schleife nichts überschreibt', async () => {
    supabaseRecording();
    const { uploadFileDirect } = await import('../core/DropboxDirectUploader.js');
    uploadFileDirect.mockClear();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    await runVideoUploadJob({
      job: {
        payload: {
          videoId: 'v1',
          metadaten: { creatorName: 'Ada', unternehmen: 'Firma', kampagne: 'Herbst', videoPosition: 1, kooperationName: 'Koop' },
          queue: [{ file, variantName: 'A', versionNumber: 1, isFinal: false }],
        },
        items: [{ id: 'i1', directOk: null }],
      },
      signal: new AbortController().signal,
      updateItem: () => {},
    });
    expect(uploadFileDirect).toHaveBeenCalledWith(expect.objectContaining({ mode: 'add' }));
  });

  it('Ziel sharepoint: lädt in die Session und speichert die Ablage-Felder statt Dropbox', async () => {
    ablage.ziel = { ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s', chunk_bytes: 327680 };
    const updates = supabaseRecording();
    const { uploadFileDirect } = await import('../core/DropboxDirectUploader.js');
    uploadFileDirect.mockClear();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    await runVideoUploadJob({
      job: {
        payload: {
          videoId: 'v1',
          metadaten: { creatorName: 'Ada', unternehmen: 'Firma', kampagne: 'Herbst', videoPosition: 1, kooperationId: 'k1' },
          queue: [{ file, variantName: '9:16', versionNumber: 2, isFinal: false }],
        },
        items: [{ id: 'i1', directOk: null }],
      },
      signal: new AbortController().signal,
      updateItem: () => {},
    });

    expect(uploadFileDirect).not.toHaveBeenCalled();
    expect(ablage.calls[0].body).toMatchObject({
      typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', version_number: 2,
      is_final: false, variant_name: '9:16', file_size: 1,
    });
    expect(ablage.calls[1]).toEqual({ fn: 'ablage-upload-commit', body: { upload_id: 'up1', item_id: 'item1' } });
    const row = updates.inserts.find(i => i.table === 'kooperation_video_asset').data;
    expect(row).toMatchObject({
      video_id: 'v1', file_url: 'https://sp.example/clip_v1.mp4', file_path: '/Herbst/Ada/clip_v1.mp4',
      ablage: 'sharepoint', drive_id: 'd1', item_id: 'item1', etag: 'e1', version_number: 2,
    });
    expect(updates.find(u => u.table === 'kooperation_videos').data).toEqual({ folder_url: 'https://sp.example/Ada' });
  });

  it('leert ein gerade bearbeitetes Namensfeld nicht, wenn der Upload die Zeile aktualisiert', () => {
    document.body.innerHTML = `
      <input class="grid-input" data-entity="video" data-id="v1" data-field="video_name" />
    `;
    const input = document.querySelector('input');
    input.value = 'Hook während Upload';
    input.focus();

    const table = {
      videos: { k1: [{ id: 'v1', video_name: null }] },
      _rowHeightSync: null,
    };
    const handler = new VideoTableRealtimeHandler(table);
    handler.updateVideoFieldsInDOM('v1', {
      id: 'v1',
      video_name: null,
      link_content: 'https://dropbox.example/file',
    });

    expect(input.value).toBe('Hook während Upload');
  });

  it('übernimmt einen noch nicht geblurrten Namen in den Store, bevor die Liste neu zeichnet', async () => {
    document.body.innerHTML = `
      <div id="koops">
        <div class="kooperation-video-grid">
          <input class="grid-input" data-entity="video" data-id="v1" data-field="video_name" />
        </div>
      </div>
    `;
    const input = document.querySelector('input');
    input.value = 'Hook während Upload';
    input.dataset.fieldBaseline = '';

    const video = { id: 'v1', video_name: '' };
    const updates = supabaseRecording();
    window.currentUser = { id: 'u1', rolle: 'admin' };

    const table = {
      containerId: 'koops',
      kampagneId: 'c1',
      videos: { k1: [video] },
      store: {
        updateVideo(_id, patch) {
          Object.assign(video, patch);
        },
      },
      _lastUpdateBy: null,
      _lastUpdateTime: 0,
    };

    await new VideoTableFieldHandler(table).flushVideoNameEdits();

    expect(video.video_name).toBe('Hook während Upload');
    expect(updates.some(u => u.table === 'kooperation_videos' && u.data.video_name === 'Hook während Upload')).toBe(true);
    expect(table._videoNameEdits.get('v1').value).toBe('Hook während Upload');
  });

  it('lässt einen gerade gesetzten Namen nicht von einem veralteten Upload-Update leeren', async () => {
    const video = {
      id: 'v1',
      kooperation_id: 'k1',
      video_name: 'Hook während Upload',
      link_content: null,
    };
    document.body.innerHTML = `<input data-entity="video" data-id="v1" data-field="video_name" />`;
    document.querySelector('input').value = 'Hook während Upload';

    const table = {
      videos: { k1: [video] },
      kooperationen: [{ id: 'k1' }],
      store: {
        updateVideo(_id, patch) {
          Object.assign(video, patch);
        },
      },
      _videoNameEdits: new Map([['v1', { value: 'Hook während Upload', at: Date.now() - 3000 }]]),
      _lastUpdateBy: null,
      _lastUpdateTime: 0,
      _rowHeightSync: null,
    };

    await new VideoTableRealtimeHandler(table).handleVideoUpdate({
      new: {
        id: 'v1',
        kooperation_id: 'k1',
        video_name: null,
        link_content: 'https://dropbox.example/file',
      },
    });

    expect(video.video_name).toBe('Hook während Upload');
    expect(video.link_content).toBe('https://dropbox.example/file');
    expect(document.querySelector('input').value).toBe('Hook während Upload');
  });
});
