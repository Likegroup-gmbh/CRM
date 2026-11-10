import { describe, it, expect, vi, afterEach } from 'vitest';
import { VideoTableDrawerActions } from '../modules/kampagne/VideoTableDrawerActions.js';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';
import { VideoTableFieldHandler } from '../modules/kampagne/VideoTableFieldHandler.js';

vi.mock('../core/DropboxDirectUploader.js', () => ({
  uploadFileDirect: vi.fn(async () => ({ path_display: '/Kampagne/clip.mp4' })),
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
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('dropbox-upload')) {
        return { ok: true, json: async () => ({ token: 't', dropboxPath: '/Kampagne/clip.mp4', kooperationFolderPath: '/Kampagne' }) };
      }
      return { ok: true, json: async () => ({ url: 'https://dropbox.example/file?dl=0' }) };
    }));

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

describe('Caption und Feedback überleben ein Zeilen-Update', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lässt eine gerade gesetzte Caption nicht von einem veralteten Upload-Update leeren', async () => {
    const video = {
      id: 'v1',
      kooperation_id: 'k1',
      caption: 'Jetzt shoppen #ad',
      link_content: null,
    };
    document.body.innerHTML = `<textarea data-entity="video" data-id="v1" data-field="caption"></textarea>`;
    document.querySelector('textarea').value = 'Jetzt shoppen #ad';

    const table = {
      videos: { k1: [video] },
      kooperationen: [{ id: 'k1' }],
      videoComments: {},
      store: {
        updateVideo(_id, patch) {
          Object.assign(video, patch);
        },
      },
      _captionEdits: new Map([['v1', { value: 'Jetzt shoppen #ad', at: Date.now() - 3000 }]]),
      _lastUpdateBy: null,
      _lastUpdateTime: 0,
      _rowHeightSync: null,
    };

    await new VideoTableRealtimeHandler(table).handleVideoUpdate({
      new: {
        id: 'v1',
        kooperation_id: 'k1',
        caption: null,
        link_content: 'https://dropbox.example/file',
      },
    });

    expect(video.caption).toBe('Jetzt shoppen #ad');
    expect(document.querySelector('textarea').value).toBe('Jetzt shoppen #ad');
  });

  it('leert Kunden- und eigenes Feedback nicht, solange die Kommentare noch nicht geladen sind', () => {
    document.body.innerHTML = `
      <textarea data-entity="video" data-id="v1" data-field="feedback_kunde_r1"></textarea>
      <textarea data-entity="video" data-id="v1" data-field="feedback_cj_r1"></textarea>
    `;
    const [kunde, eigen] = document.querySelectorAll('textarea');
    kunde.value = 'Passt so';
    eigen.value = 'Bitte den Hook kürzer';

    const table = {
      videos: { k1: [{ id: 'v1', caption: 'Text' }] },
      videoComments: {},
      _rowHeightSync: null,
    };

    new VideoTableRealtimeHandler(table).updateVideoFieldsInDOM('v1', {
      id: 'v1',
      caption: 'Text',
      link_content: 'https://dropbox.example/file',
    });

    expect(kunde.value).toBe('Passt so');
    expect(eigen.value).toBe('Bitte den Hook kürzer');
  });

  it('übernimmt eine noch nicht geblurrte Caption in den Store, bevor die Liste neu zeichnet', async () => {
    document.body.innerHTML = `
      <div id="koops">
        <textarea class="grid-textarea" data-entity="video" data-id="v1" data-field="caption"></textarea>
      </div>
    `;
    const captionField = document.querySelector('textarea');
    captionField.value = 'Jetzt shoppen #ad';
    captionField.dataset.fieldBaseline = '';

    const video = { id: 'v1', caption: '' };
    const updates = [];
    window.supabase = {
      from(table) {
        return {
          update(data) {
            updates.push({ table, data });
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    };
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

    await new VideoTableFieldHandler(table).flushCaptionEdits();

    expect(video.caption).toBe('Jetzt shoppen #ad');
    expect(updates.some(u => u.table === 'kooperation_videos' && u.data.caption === 'Jetzt shoppen #ad')).toBe(true);
  });

  it('schreibt eine leer gezeichnete Caption ohne Fokus nicht über den gespeicherten Text', async () => {
    document.body.innerHTML = `
      <div id="koops">
        <textarea class="grid-textarea" data-entity="video" data-id="v1" data-field="caption"></textarea>
      </div>
    `;

    const video = { id: 'v1', caption: 'Jetzt shoppen #ad' };
    const updates = [];
    window.supabase = {
      from(table) {
        return {
          update(data) {
            updates.push({ table, data });
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    };

    const table = {
      containerId: 'koops',
      videos: { k1: [video] },
      store: { updateVideo(_id, patch) { Object.assign(video, patch); } },
    };

    await new VideoTableFieldHandler(table).flushCaptionEdits();

    expect(video.caption).toBe('Jetzt shoppen #ad');
    expect(updates).toEqual([]);
  });

  it('leert Thema und Views nicht, wenn ein Zeilen-Update die Werte leer schickt', () => {
    document.body.innerHTML = `
      <input data-entity="video" data-id="v1" data-field="thema" />
      <input data-entity="video" data-id="v1" data-field="stats_views" />
    `;
    const [thema, views] = document.querySelectorAll('input');
    thema.value = 'Sommer';
    views.value = '120';

    const video = { id: 'v1', thema: 'Sommer', stats_views: 120 };
    const table = {
      videos: { k1: [video] },
      videoComments: {},
      _rowHeightSync: null,
    };

    new VideoTableRealtimeHandler(table).updateVideoFieldsInDOM('v1', {
      id: 'v1',
      thema: null,
      stats_views: 0,
    });

    expect(thema.value).toBe('Sommer');
    expect(views.value).toBe('0');
  });

  it('übernimmt ein geändertes Thema vor dem Neuzeichnen und lässt eine unberührte Zelle stehen', async () => {
    document.body.innerHTML = `
      <div id="koops">
        <input data-entity="video" data-id="v1" data-field="thema" />
        <input data-entity="video" data-id="v1" data-field="drehort" />
      </div>
    `;
    const [thema, ort] = document.querySelectorAll('input');
    thema.value = 'Sommer';
    thema.dataset.fieldBaseline = '';
    ort.value = '';

    const video = { id: 'v1', thema: '', drehort: 'Berlin' };
    const updates = [];
    window.supabase = {
      from(table) {
        return {
          update(data) {
            updates.push({ table, data });
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    };
    window.currentUser = { id: 'u1', rolle: 'admin' };

    const table = {
      containerId: 'koops',
      videos: { k1: [video] },
      store: { updateVideo(_id, patch) { Object.assign(video, patch); } },
    };

    await new VideoTableFieldHandler(table).flushEditedTextFields();

    expect(video.thema).toBe('Sommer');
    expect(video.drehort).toBe('Berlin');
    expect(updates).toEqual([{ table: 'kooperation_videos', data: { thema: 'Sommer' } }]);
  });

  it('übernimmt eine geänderte eigene Spalte und lässt eine unberührte eigene Spalte stehen', async () => {
    document.body.innerHTML = `
      <div id="koops">
        <input class="custom-col-input" data-custom-column-id="c1" data-entity-id="v1" />
        <input class="custom-col-input" data-custom-column-id="c2" data-entity-id="v1" />
      </div>
    `;
    const [edited, untouched] = document.querySelectorAll('input');
    edited.value = 'Sommer';
    edited.dataset.fieldBaseline = '';

    const values = { v1: { c1: '', c2: 'bleibt' } };
    const upserts = [];
    window.supabase = {
      from() {
        return {
          upsert(data) {
            upserts.push(data);
            return Promise.resolve({ error: null });
          }
        };
      }
    };

    const table = {
      containerId: 'koops',
      videos: {},
      store: {
        getCustomColumnValue: (entityId, columnId) => values[entityId]?.[columnId] ?? null,
        updateCustomColumnValue: (entityId, columnId, value) => {
          (values[entityId] ||= {})[columnId] = value;
        }
      }
    };

    await new VideoTableFieldHandler(table).flushEditedTextFields();

    expect(values.v1.c1).toBe('Sommer');
    expect(values.v1.c2).toBe('bleibt');
    expect(upserts).toEqual([
      expect.objectContaining({ custom_column_id: 'c1', entity_id: 'v1', value: 'Sommer' })
    ]);
  });
});
