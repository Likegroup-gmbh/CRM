import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/produktion/ProduktionService.js', () => ({ scopeKoopsByLinie: q => q }));
vi.mock('../modules/kampagne/KampagneUtils.js', () => ({ KampagneUtils: { getDisplayName: () => '' } }));
vi.mock('../core/VideoDeleteHelper.js', () => ({
  syncVideoAssetsAfterDelete: vi.fn(async () => ({}))
}));
vi.mock('../core/stills/stillAssets.js', () => ({ updateStillCurrentFlags: vi.fn(async () => {}) }));
vi.mock('../core/ablage/ablageApi.js', () => ({
  ablageDateiLoeschen: vi.fn(async () => ({ geloescht: true })),
  ablageDateiUmbenennen: vi.fn(async (_typ, _id, name) => ({ file_name: name, file_path: `/Ablage/K/${name}`, etag: 'e2' })),
}));

const { renameAsset, renameAdManagerFile, deleteAsset, loadVideoBrowserData, saveVideoCaption, saveZeitkommentar } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { createFakeSupabase } = await import('./fixtures/fakeSupabase.js');
const { ablageDateiLoeschen, ablageDateiUmbenennen } = await import('../core/ablage/ablageApi.js');
const { titelAusDateiname } = await import('../core/uploadJobs/runVideoUploadJob.js');
const { syncVideoAssetsAfterDelete } = await import('../core/VideoDeleteHelper.js');
const { updateStillCurrentFlags } = await import('../core/stills/stillAssets.js');

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

describe('VideoBrowserAdapter: Autoren von Kunden-Feedback', () => {
  const results = {
    'kooperationen:select': () => ({ data: [{ id: 'k1', name: 'Koop' }], error: null }),
    'kooperation_videos:select': () => ({ data: [{ id: 'v1', kooperation_id: 'k1' }], error: null }),
    'kooperation_video_comment:select': () => ({ data: [
      { id: 'n1', video_id: 'v1', runde: 1, feedback_typ: 'kunde', text: 'Dynamischer', author_name: 'Svenja', author_rolle: 'mitarbeiter' },
      { id: 'n2', video_id: 'v1', runde: 1, feedback_typ: 'cj', text: 'Schneller', author_name: 'Ben', author_rolle: 'mitarbeiter' }
    ], error: null }),
    'kooperation_video_zeitkommentar:select': () => ({ data: [], error: null }),
    'kooperation_still_comment:select': () => ({ data: [], error: null }),
    'ansprechpartner_kampagne:select': () => ({ data: [
      { ansprechpartner: { vorname: 'Laura', nachname: 'Collik' } },
      { ansprechpartner: { vorname: 'Cosima', nachname: 'Kitze' } }
    ], error: null })
  };
  afterEach(() => { delete window.supabase; });

  it.each([true, false])('team=%s: Rolle steht auf der Zeile, Ansprechpartner der Kampagne als kundenName', async (team) => {
    window.supabase = mockSupabase(results);
    const raw = await loadVideoBrowserData({ kampagneId: 'c1', team });
    for (const t of ['kooperation_video_comment', 'kooperation_video_zeitkommentar', 'kooperation_still_comment']) {
      expect(window.supabase.calls.find(q => q.table === t).select).toContain('author_rolle');
    }
    expect(window.supabase.calls.find(q => q.table === 'ansprechpartner_kampagne').filters).toContainEqual(['kampagne_id', 'c1']);
    expect(window.supabase.calls.map(q => q.table)).not.toContain('benutzer');
    expect(raw.kundenName).toBe('Cosima Kitze, Laura Collik');
  });

  it('ohne Kunden-Feedback vom Team keine Abfrage, Fehler heißt gespeicherte Namen', async () => {
    window.supabase = mockSupabase({ ...results, 'kooperation_video_comment:select': () => ({ data: [
      { id: 'n1', video_id: 'v1', runde: 1, feedback_typ: 'kunde', text: 'Eigenes', author_name: 'Kai', author_rolle: 'kunde' }
    ], error: null }) });
    const ohne = await loadVideoBrowserData({ kampagneId: 'c1', team: true });
    expect(window.supabase.calls.map(q => q.table)).not.toContain('ansprechpartner_kampagne');
    expect(ohne.kundenName).toBe('');

    window.supabase = mockSupabase({ ...results, 'ansprechpartner_kampagne:select': () => ({ data: null, error: { message: 'RLS' } }) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await loadVideoBrowserData({ kampagneId: 'c1', team: false })).kundenName).toBe('');
    warn.mockRestore();
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
    ablageDateiLoeschen.mockClear();
    syncVideoAssetsAfterDelete.mockClear();
    updateStillCurrentFlags.mockClear();
  });
  afterEach(() => { delete window.supabase; });

  it('Altbestand (nur Link): Kommentare der Datei und Zeile weg, Video wird abgeglichen', async () => {
    window.supabase = mockSupabase();
    await deleteAsset(video({ ablage: 'dropbox' }));
    expect(window.supabase.calls.map(q => `${q.table}:${q.op}`)).toEqual([
      'kooperation_video_zeitkommentar:update',
      'kooperation_video_asset:delete'
    ]);
    expect(window.supabase.calls[0].payload.deleted_at).toBeTruthy();
    expect(window.supabase.calls[0].filters).toContainEqual(['asset_id', 'a1']);
    expect(ablageDateiLoeschen).not.toHaveBeenCalled();
    expect(syncVideoAssetsAfterDelete).toHaveBeenCalledWith('v1');
  });

  it('ohne gelöschte Zeile: Fehler, kein Abgleich', async () => {
    window.supabase = mockSupabase({ 'kooperation_video_asset:delete': () => ({ data: [], error: null }) });
    await expect(deleteAsset(video())).rejects.toThrow();
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });

  it('Bild: Kommentare der Datei, eigene Tabelle, danach die Kennzeichnung der aktuellen Runde', async () => {
    window.supabase = mockSupabase();
    await deleteAsset({ id: 'b1', type: 'still', asset: { id: 'b1', video_id: 'v1', file_path: '/K/b1.jpg' } });
    expect(window.supabase.calls.map(q => `${q.table}:${q.op}`)).toEqual([
      'kooperation_video_zeitkommentar:update',
      'kooperation_bilder_asset:delete'
    ]);
    expect(window.supabase.calls[0].filters).toContainEqual(['still_asset_id', 'b1']);
    expect(updateStillCurrentFlags).toHaveBeenCalledWith('v1');
    expect(syncVideoAssetsAfterDelete).not.toHaveBeenCalled();
  });

  it('Story: Kommentare hängen an story_asset_id', async () => {
    window.supabase = mockSupabase();
    await deleteAsset({ id: 's1', type: 'story', asset: { id: 's1', video_id: 'v1', file_path: '/K/s1.mp4' } });
    expect(window.supabase.calls[0]).toMatchObject({ table: 'kooperation_video_zeitkommentar', op: 'update' });
    expect(window.supabase.calls[0].filters).toContainEqual(['story_asset_id', 's1']);
  });

  it('Rohmaterial hat keine Kommentare', async () => {
    window.supabase = mockSupabase();
    await deleteAsset({ id: 'r1', type: 'roh', asset: { id: 'r1', file_path: '/K/r1.mov' } });
    expect(window.supabase.calls.map(q => q.table)).not.toContain('kooperation_video_zeitkommentar');
  });

  it('SharePoint: Server löscht die Datei vor der Zeile', async () => {
    const order = [];
    ablageDateiLoeschen.mockImplementationOnce(async () => { order.push('ablage'); return { geloescht: true }; });
    window.supabase = mockSupabase({
      'kooperation_video_asset:delete': () => { order.push('delete'); return { data: [{ id: 'a1' }], error: null }; },
    });
    await deleteAsset(video({ ablage: 'sharepoint', file_path: '/Ablage/K/v1.mp4' }));
    expect(ablageDateiLoeschen).toHaveBeenCalledWith('video', 'a1');
    expect(order).toEqual(['ablage', 'delete']);
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

  it('Altbestand ausserhalb von SharePoint wird nicht umbenannt', async () => {
    window.supabase = mockSupabase();
    await expect(renameAdManagerFile(video(), 'Brand_Spot_final')).rejects.toThrow('Datei liegt nicht in SharePoint');
    expect(ablageDateiUmbenennen).not.toHaveBeenCalled();
    expect(window.supabase.calls).toHaveLength(0);
  });

  const spVideo = () => video({ ablage: 'sharepoint', item_id: 'it1', file_path: '/Ablage/K/v1.mp4' });

  it('SharePoint: benennt über den Server um und zieht die Zeilen derselben Datei per item_id nach', async () => {
    window.supabase = mockSupabase();
    const res = await renameAdManagerFile(spVideo(), 'Brand_Spot');
    expect(ablageDateiUmbenennen).toHaveBeenCalledWith('video', 'a1', 'Brand_Spot.mp4');
    expect(res).toEqual({ path: '/Ablage/K/Brand_Spot.mp4', stem: 'Brand_Spot' });
    const [q] = window.supabase.calls;
    expect(q.payload).toEqual({ file_path: '/Ablage/K/Brand_Spot.mp4', file_name: 'Brand_Spot.mp4', etag: 'e2', ad_manager_name: 'Brand_Spot' });
    expect(q.filters).toEqual([['video_id', 'v1'], ['item_id', 'it1']]);
  });

  it('SharePoint: lehnt einen leeren Namen ab, ohne umzubenennen', async () => {
    window.supabase = mockSupabase();
    await expect(renameAdManagerFile(spVideo(), '  .mp4 ')).rejects.toThrow('Dateiname ist leer');
    expect(ablageDateiUmbenennen).not.toHaveBeenCalled();
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
