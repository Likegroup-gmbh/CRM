import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/produktion/ProduktionService.js', () => ({ scopeKoopsByLinie: q => q }));
vi.mock('../modules/kampagne/KampagneUtils.js', () => ({ KampagneUtils: { getDisplayName: () => '' } }));
vi.mock('../core/VideoDeleteHelper.js', () => ({
  deleteSingleDropboxFile: vi.fn(async () => {}),
  syncVideoAssetsAfterDelete: vi.fn(async () => ({}))
}));
vi.mock('../core/dropboxLinks.js', () => ({ proxyPost: vi.fn(async (b) => ({ path: b.toPath })) }));
vi.mock('../core/stills/stillAssets.js', () => ({ updateStillCurrentFlags: vi.fn(async () => {}) }));
vi.mock('../core/ablage/ablageApi.js', () => ({
  ablageDateiLoeschen: vi.fn(async () => ({ geloescht: true })),
  ablageDateiUmbenennen: vi.fn(async (_typ, _id, name) => ({ file_name: name, file_path: `/Ablage/K/${name}`, etag: 'e2' })),
}));

const { renameAsset, renameAdManagerFile, deleteAsset, loadVideoBrowserData, saveVideoCaption, saveZeitkommentar } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { createFakeSupabase } = await import('./fixtures/fakeSupabase.js');
const { ablageDateiLoeschen, ablageDateiUmbenennen } = await import('../core/ablage/ablageApi.js');
const { titelAusDateiname } = await import('../core/uploadJobs/runVideoUploadJob.js');
const { deleteSingleDropboxFile, syncVideoAssetsAfterDelete } = await import('../core/VideoDeleteHelper.js');
const { updateStillCurrentFlags } = await import('../core/stills/stillAssets.js');
const { proxyPost } = await import('../core/dropboxLinks.js');

/** Supabase-Attrappe: zeichnet jede Abfrage auf, Ergebnis je "tabelle:op". */
function mockSupabase(results = {}) {
  const calls = [];
  const from = (table) => {
    const q = { table, op: null, payload: null, filters: [] };
    calls.push(q);
    const builder = {
      select(cols) { if (!q.op) { q.op = 'select'; q.select = cols; } return builder; },
      update(payload) { q.op = 'update'; q.payload = payload; return builder; },
      delete() { q.op = 'delete'; return builder; },
      eq(col, val) { q.filters.push([col, val]); return builder; },
      is(col, val) { q.filters.push([col, val]); return builder; },
      in(col, val) { q.filters.push([col, val]); return builder; },
      or() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      then(resolve, reject) {
        const fn = results[`${table}:${q.op}`];
        return Promise.resolve(fn ? fn(q) : { data: [{ id: 'x' }], error: null }).then(resolve, reject);
      }
    };
    return builder;
  };
  return { from, calls };
}

const video = (asset = {}) => ({
  id: 'a1',
  type: 'video',
  asset: { id: 'a1', video_id: 'v1', file_path: '/K/v1.mp4', version_number: 1, is_final: false, ...asset }
});

describe('VideoBrowserAdapter: Produkte der Videoideen', () => {
  const results = {
    'kooperationen:select': () => ({ data: [{ id: 'k1', name: 'Koop', briefing_id: 'b1' }], error: null }),
    'kooperation_videos:select': () => ({ data: [{ id: 'v1', kooperation_id: 'k1', strategie_item_id: 'i1' }], error: null }),
    'strategie_items:select': () => ({ data: [{ id: 'i1', produkt_id: 'p1' }], error: null }),
    'produkt:select': () => ({ data: [{ id: 'p1', name: 'Serum' }], error: null })
  };
  afterEach(() => { delete window.supabase; });

  it('Team: liest Videoidee und Produkt zu den Videos', async () => {
    window.supabase = mockSupabase(results);
    const raw = await loadVideoBrowserData({ kampagneId: 'c1', team: true });
    const videos = window.supabase.calls.find(q => q.table === 'kooperation_videos');
    expect(videos.select).toContain('strategie_item_id');
    expect(videos.select).toContain('caption');
    expect(window.supabase.calls.find(q => q.table === 'strategie_items').filters).toContainEqual(['id', ['i1']]);
    expect(window.supabase.calls.find(q => q.table === 'produkt').filters).toContainEqual(['id', ['p1']]);
    expect(raw.ideen).toEqual([{ id: 'i1', produkt_id: 'p1' }]);
    expect(raw.produkte).toEqual([{ id: 'p1', name: 'Serum' }]);
  });

  it('Kunde: weder Videoidee noch Produkt (RLS lässt kunde_editor nicht lesen)', async () => {
    window.supabase = mockSupabase(results);
    const raw = await loadVideoBrowserData({ kampagneId: 'c1', team: false });
    const tables = window.supabase.calls.map(q => q.table);
    expect(tables).not.toContain('strategie_items');
    expect(tables).not.toContain('produkt');
    expect(window.supabase.calls.find(q => q.table === 'kooperation_videos').select).not.toContain('strategie_item_id');
    expect(raw.produkte).toEqual([]);
  });
});

describe('VideoBrowserAdapter: Dateititel', () => {
  afterEach(() => { delete window.supabase; });

  it('schreibt den getrimmten Titel in die Tabelle der Dateiart', async () => {
    window.supabase = mockSupabase();
    await expect(renameAsset({ id: 'r1', type: 'roh' }, '  Rohschnitt  ')).resolves.toBe('Rohschnitt');
    const [q] = window.supabase.calls;
    expect(q).toMatchObject({ table: 'kooperation_rohmaterial_asset', op: 'update', payload: { titel: 'Rohschnitt' } });
    expect(q.filters).toEqual([['id', 'r1']]);
  });

  it('meldet einen Fehler, wenn RLS keine Zeile schreiben lässt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:update': () => ({ data: [], error: null }) });
    await expect(renameAsset(video(), 'Neu')).rejects.toThrow();
  });

  it('leerer Titel wird nicht gespeichert', async () => {
    window.supabase = mockSupabase();
    await expect(renameAsset(video(), '   ')).rejects.toThrow();
    expect(window.supabase.calls).toHaveLength(0);
  });

  it('Titel aus dem Dateinamen ohne Endung', () => {
    expect(titelAusDateiname('Interview Kudamm.MOV')).toBe('Interview Kudamm');
    expect(titelAusDateiname('clip.final.mp4')).toBe('clip.final');
    expect(titelAusDateiname('')).toBeNull();
  });
});

describe('VideoBrowserAdapter: Caption', () => {
  afterEach(() => { delete window.supabase; });

  it('schreibt die Caption ans Video, leer wird null', async () => {
    window.supabase = mockSupabase();
    await expect(saveVideoCaption('v1', '  Jetzt shoppen  ')).resolves.toBe('Jetzt shoppen');
    const [q] = window.supabase.calls;
    expect(q).toMatchObject({ table: 'kooperation_videos', op: 'update', payload: { caption: 'Jetzt shoppen' } });
    expect(q.filters).toEqual([['id', 'v1']]);

    await expect(saveVideoCaption('v1', '   ')).resolves.toBeNull();
    expect(window.supabase.calls.at(-1).payload).toEqual({ caption: null });
  });

  it('meldet einen Fehler, wenn RLS keine Zeile schreiben lässt', async () => {
    window.supabase = mockSupabase({ 'kooperation_videos:update': () => ({ data: [], error: null }) });
    await expect(saveVideoCaption('v1', 'Text')).rejects.toThrow();
  });
});

describe('VideoBrowserAdapter: Datei löschen', () => {
  beforeEach(() => {
    deleteSingleDropboxFile.mockClear();
    syncVideoAssetsAfterDelete.mockClear();
    updateStillCurrentFlags.mockClear();
  });
  afterEach(() => { delete window.supabase; });

  it('Video: Kommentare der Datei, Zeile und Dropbox-Datei weg, Video wird abgeglichen', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:select': () => ({ data: [], error: null }) });
    const item = video();
    await deleteAsset(item);
    const ops = window.supabase.calls.map(q => `${q.table}:${q.op}`);
    expect(ops).toEqual([
      'kooperation_video_zeitkommentar:update',
      'kooperation_video_asset:delete',
      'kooperation_video_asset:select'
    ]);
    expect(window.supabase.calls[0].payload.deleted_at).toBeTruthy();
    expect(window.supabase.calls[0].filters).toContainEqual(['asset_id', 'a1']);
    expect(deleteSingleDropboxFile).toHaveBeenCalledWith('/K/v1.mp4');
    expect(syncVideoAssetsAfterDelete).toHaveBeenCalledWith('v1');
  });

  it('Datei bleibt in Dropbox, solange eine andere Zeile denselben Pfad nutzt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:select': () => ({ data: [{ id: 'f1' }], error: null }) });
    await deleteAsset(video());
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
  });

  it('ohne gelöschte Zeile bleibt Dropbox unberührt', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:delete': () => ({ data: [], error: null }) });
    await expect(deleteAsset(video())).rejects.toThrow();
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });

  it('Bild: Kommentare der Datei, eigene Tabelle, danach die Kennzeichnung der aktuellen Runde', async () => {
    window.supabase = mockSupabase({ 'kooperation_bilder_asset:select': () => ({ data: [], error: null }) });
    await deleteAsset({ id: 'b1', type: 'still', asset: { id: 'b1', video_id: 'v1', file_path: '/K/b1.jpg' } });
    expect(window.supabase.calls.map(q => `${q.table}:${q.op}`)).toEqual([
      'kooperation_video_zeitkommentar:update',
      'kooperation_bilder_asset:delete',
      'kooperation_bilder_asset:select'
    ]);
    expect(window.supabase.calls[0].filters).toContainEqual(['still_asset_id', 'b1']);
    expect(updateStillCurrentFlags).toHaveBeenCalledWith('v1');
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });

  it('Story: Kommentare hängen an story_asset_id', async () => {
    window.supabase = mockSupabase({ 'kooperation_story_asset:select': () => ({ data: [], error: null }) });
    await deleteAsset({ id: 's1', type: 'story', asset: { id: 's1', video_id: 'v1', file_path: '/K/s1.mp4' } });
    expect(window.supabase.calls[0]).toMatchObject({ table: 'kooperation_video_zeitkommentar', op: 'update' });
    expect(window.supabase.calls[0].filters).toContainEqual(['story_asset_id', 's1']);
  });

  it('Rohmaterial hat keine Kommentare', async () => {
    window.supabase = mockSupabase({ 'kooperation_rohmaterial_asset:select': () => ({ data: [], error: null }) });
    await deleteAsset({ id: 'r1', type: 'roh', asset: { id: 'r1', file_path: '/K/r1.mov' } });
    expect(window.supabase.calls.map(q => q.table)).not.toContain('kooperation_video_zeitkommentar');
  });

  it('SharePoint: Server löscht die Datei vor der Zeile, Dropbox bleibt unberührt', async () => {
    ablageDateiLoeschen.mockClear();
    const order = [];
    ablageDateiLoeschen.mockImplementationOnce(async () => { order.push('ablage'); return { geloescht: true }; });
    window.supabase = mockSupabase({
      'kooperation_video_asset:delete': () => { order.push('delete'); return { data: [{ id: 'a1' }], error: null }; },
    });
    await deleteAsset(video({ ablage: 'sharepoint', file_path: '/Ablage/K/v1.mp4' }));
    expect(ablageDateiLoeschen).toHaveBeenCalledWith('video', 'a1');
    expect(order).toEqual(['ablage', 'delete']);
    expect(deleteSingleDropboxFile).not.toHaveBeenCalled();
    expect(window.supabase.calls.map(q => `${q.table}:${q.op}`)).not.toContain('kooperation_video_asset:select');
    expect(syncVideoAssetsAfterDelete).toHaveBeenCalledWith('v1');
  });

  it('SharePoint: scheitert der Server, bleibt die Zeile', async () => {
    ablageDateiLoeschen.mockRejectedValueOnce(new Error('Graph down'));
    window.supabase = mockSupabase();
    await expect(deleteAsset(video({ ablage: 'sharepoint' }))).rejects.toThrow('Graph down');
    expect(window.supabase.calls).toHaveLength(0);
  });
});

describe('VideoBrowserAdapter: Ad-Manager-Dateiname', () => {
  afterEach(() => { delete window.supabase; vi.clearAllMocks(); });

  it('benennt die Datei in Dropbox um und zieht alle Zeilen mit dem Pfad nach', async () => {
    window.supabase = mockSupabase();
    const res = await renameAdManagerFile(video(), 'Brand_Spot_final');
    expect(proxyPost).toHaveBeenCalledWith({ action: 'move', fromPath: '/K/v1.mp4', toPath: '/K/Brand_Spot_final.mp4' });
    expect(res).toEqual({ path: '/K/Brand_Spot_final.mp4', stem: 'Brand_Spot_final' });
    const [q] = window.supabase.calls;
    expect(q).toMatchObject({
      table: 'kooperation_video_asset', op: 'update',
      payload: { file_path: '/K/Brand_Spot_final.mp4', ad_manager_name: 'Brand_Spot_final' }
    });
    expect(q.filters).toEqual([['video_id', 'v1'], ['file_path', '/K/v1.mp4']]);
  });

  it('übernimmt den Namen, den Dropbox bei Kollision vergibt', async () => {
    proxyPost.mockResolvedValueOnce({ path: '/K/Spot (1).mp4' });
    window.supabase = mockSupabase();
    const res = await renameAdManagerFile(video(), 'Spot');
    expect(res.stem).toBe('Spot (1)');
  });

  it('benennt zurück, wenn der Eintrag in der Datenbank scheitert', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:update': () => ({ data: [], error: null }) });
    await expect(renameAdManagerFile(video(), 'Neu')).rejects.toThrow();
    expect(proxyPost).toHaveBeenLastCalledWith({ action: 'move', fromPath: '/K/Neu.mp4', toPath: '/K/v1.mp4' });
  });

  it('lehnt einen leeren Namen ab, ohne Dropbox anzufassen', async () => {
    window.supabase = mockSupabase();
    await expect(renameAdManagerFile(video(), '  .mp4 ')).rejects.toThrow();
    expect(proxyPost).not.toHaveBeenCalled();
  });

  const spVideo = () => video({ ablage: 'sharepoint', item_id: 'it1', file_path: '/Ablage/K/v1.mp4' });

  it('SharePoint: benennt über den Server um und zieht die Zeilen derselben Datei per item_id nach', async () => {
    window.supabase = mockSupabase();
    const res = await renameAdManagerFile(spVideo(), 'Brand_Spot');
    expect(ablageDateiUmbenennen).toHaveBeenCalledWith('video', 'a1', 'Brand_Spot.mp4');
    expect(proxyPost).not.toHaveBeenCalled();
    expect(res).toEqual({ path: '/Ablage/K/Brand_Spot.mp4', stem: 'Brand_Spot' });
    const [q] = window.supabase.calls;
    expect(q.payload).toEqual({ file_path: '/Ablage/K/Brand_Spot.mp4', file_name: 'Brand_Spot.mp4', etag: 'e2', ad_manager_name: 'Brand_Spot' });
    expect(q.filters).toEqual([['video_id', 'v1'], ['item_id', 'it1']]);
  });

  it('SharePoint: benennt zurück, wenn der Eintrag scheitert', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:update': () => ({ data: [], error: null }) });
    await expect(renameAdManagerFile(spVideo(), 'Neu')).rejects.toThrow();
    expect(ablageDateiUmbenennen).toHaveBeenLastCalledWith('video', 'a1', 'v1.mp4');
  });
});

describe('VideoBrowserAdapter: Video-Kommentar stößt die Teams-Meldung an', () => {
  let fetchSpy;
  beforeEach(() => {
    window.supabase = createFakeSupabase();
    window.currentUser = { id: 'b1', name: 'Kim Kunde', permissions: {} };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 202 });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    delete window.supabase;
  });

  it('Kundenseite: nach dem Speichern teams-meldung-senden', async () => {
    await saveZeitkommentar({ videoId: 'v1', runde: 1, text: 'Bitte kürzen', isKunde: true });
    expect(window.supabase.db.kooperation_video_zeitkommentar[0]).toMatchObject({ feedback_typ: 'kunde', author_benutzer_id: 'b1' });
    expect(fetchSpy).toHaveBeenCalledWith('/.netlify/functions/teams-meldung-senden', { method: 'POST', keepalive: true });
  });

  it('Team: kein Anstoß', async () => {
    await saveZeitkommentar({ videoId: 'v1', runde: 1, text: 'Intern', isKunde: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ein scheiternder Anstoß stört das Speichern nicht', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const row = await saveZeitkommentar({ videoId: 'v1', runde: 1, text: 'Trotzdem', isKunde: true });
    expect(row).toMatchObject({ text: 'Trotzdem' });
  });
});

describe('VideoBrowserAdapter: Kommentar an Video, Story oder Bild', () => {
  beforeEach(() => {
    window.supabase = createFakeSupabase();
    window.currentUser = { id: 'b1', name: 'Tom Team', permissions: {} };
  });
  afterEach(() => { delete window.supabase; });

  const gespeichert = () => window.supabase.db.kooperation_video_zeitkommentar[0];

  it('Video: asset_id mit Timecode', async () => {
    await saveZeitkommentar({ videoId: 'v1', runde: 1, assetId: 'a1', text: 'Hook', timecodeSec: 3.456, isKunde: false });
    expect(gespeichert()).toMatchObject({ asset_id: 'a1', timecode_sec: 3.46 });
    expect(gespeichert().story_asset_id).toBeUndefined();
  });

  it('Story: story_asset_id, Timecode bleibt', async () => {
    await saveZeitkommentar({ videoId: 'v1', runde: 1, assetId: 's1', assetType: 'story', text: 'Text früher', timecodeSec: 2, isKunde: false });
    expect(gespeichert()).toMatchObject({ story_asset_id: 's1', timecode_sec: 2 });
    expect(gespeichert().asset_id).toBeUndefined();
  });

  it('Bild: still_asset_id, nie ein Timecode', async () => {
    await saveZeitkommentar({ videoId: 'v1', runde: 1, assetId: 'b1', assetType: 'still', text: 'Logo größer', timecodeSec: 5, isKunde: false });
    expect(gespeichert()).toMatchObject({ still_asset_id: 'b1', timecode_sec: null });
    expect(gespeichert().asset_id).toBeUndefined();
  });

  it('Rohmaterial wird abgelehnt', async () => {
    await expect(saveZeitkommentar({ videoId: 'v1', runde: 1, assetId: 'r1', assetType: 'roh', text: 'x', isKunde: false }))
      .rejects.toThrow('Unbekannte Datei');
  });
});
