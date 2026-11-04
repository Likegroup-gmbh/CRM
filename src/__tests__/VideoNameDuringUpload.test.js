import { describe, it, expect, vi, afterEach } from 'vitest';
import { VideoTableDrawerActions } from '../modules/kampagne/VideoTableDrawerActions.js';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';
import { VideoTableFieldHandler } from '../modules/kampagne/VideoTableFieldHandler.js';

vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(async () => ({ path_display: '/Kampagne/clip.mp4' })),
}));

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url) => {
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
  window.supabase = {
    from(table) {
      return {
        select() {
          const result = Promise.resolve({ data: [], error: null });
          const chain = {
            eq: () => chain,
            then: result.then.bind(result),
          };
          return chain;
        },
        insert: () => Promise.resolve({ error: null }),
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
    await runVideoUploadJob({
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
    expect(videoUpdate).toBeDefined();
    expect(videoUpdate.data.link_content).toBeTruthy();
    expect(videoUpdate.data).not.toHaveProperty('video_name');
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
