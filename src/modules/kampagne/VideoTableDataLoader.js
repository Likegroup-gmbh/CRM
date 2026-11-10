import { CustomColumnDataLoader } from './columns/CustomColumnDataLoader.js';
import { vertraegeProKooperation, VERTRAG_ZELLE_COLS } from '../vertrag/deckung/vertragDeckung.js';
import { loadKonzeptInhalte, zuordnenKonzeptInhalte } from './konzeptInhalte.js';
import {
  batchInQuery,
  koopSelect,
  VIDEO_SELECT,
  CREATOR_SELECT,
  VERSAND_SELECT,
  loadVideoFeedbackComments,
  loadStillFeedbackComments
} from './videoTableQueries.js';
import {
  loadAssetsAndComments,
  loadStorySlots,
  loadBilderForVisible,
  loadBilder,
  patchRenderedAssetsAndComments,
  patchRenderedBilderCells
} from './videoTableAssetsLoader.js';

// ─── loadData-Schritte (`t` = KampagneKooperationenVideoTable) ─────

async function loadKooperationen(t) {
  t._startPerformanceTracking('Query: kooperationen');
  const kooperationenResult = await window.supabase
    .from('kooperationen')
    .select(koopSelect(t.isKundeRole()))
    .eq('kampagne_id', t.kampagneId)
    .order('created_at', { ascending: false });

  t._endPerformanceTracking('Query: kooperationen', !kooperationenResult.error, kooperationenResult.error);

  if (kooperationenResult.error) throw kooperationenResult.error;

  t.kooperationen = kooperationenResult.data || [];
}

function applyKampagneInfo(t) {
  const firstKamp = t.kooperationen.find(k => k.kampagne)?.kampagne;
  if (!firstKamp) return;
  t.kampagneInfo = {
    id: firstKamp.id,
    name: firstKamp.kampagnenname || firstKamp.eigener_name || '',
    unternehmen: firstKamp.unternehmen?.firmenname || '',
    unternehmenId: firstKamp.unternehmen?.id || null,
    keinDropbox: firstKamp.unternehmen?.kein_dropbox || false,
    marke: firstKamp.marke?.markenname || ''
  };
}

/** Videos, Creator, Verträge, Versand, Status und Tags parallel laden. */
async function loadBaseQueries(t, koopIds, creatorIds) {
  t._startPerformanceTracking('Query: kooperation_videos');
  t._startPerformanceTracking('Query: creator');
  t._startPerformanceTracking('Query: kooperation_versand');

  const sb = window.supabase;
  const [videosResult, creatorsResult, vertraegeResult, versandResult, statusResult, tagsResult] = await Promise.allSettled([
    batchInQuery(sb.from('kooperation_videos'), VIDEO_SELECT, 'kooperation_id', koopIds,
      q => q.order('position', { ascending: true })),
    batchInQuery(sb.from('creator'), CREATOR_SELECT, 'id', creatorIds),
    batchInQuery(sb.from('vertraege'), VERTRAG_ZELLE_COLS, 'kooperation_id', koopIds),
    batchInQuery(sb.from('kooperation_versand'), VERSAND_SELECT, 'kooperation_id', koopIds),
    sb.from('kampagne_status')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),
    batchInQuery(sb.from('kooperation_tags'), 'kooperation_id, tag_id, kooperation_tag_typen(id, name)', 'kooperation_id', koopIds)
  ]);

  t._endPerformanceTracking('Query: kooperation_videos', videosResult.status === 'fulfilled', videosResult.reason);
  t._endPerformanceTracking('Query: creator', creatorsResult.status === 'fulfilled', creatorsResult.reason);
  t._endPerformanceTracking('Query: kooperation_versand', versandResult.status === 'fulfilled', versandResult.reason);

  const dataOf = (result) => result.status === 'fulfilled' ? (result.value.data || []) : [];
  t.statusOptions = dataOf(statusResult);
  return {
    allVideos: dataOf(videosResult),
    creators: dataOf(creatorsResult),
    vertraege: dataOf(vertraegeResult),
    versandInfos: dataOf(versandResult),
    allTags: dataOf(tagsResult)
  };
}

async function enrichKooperationen(t, koopIds, { creators, vertraege, allTags }) {
  t.creators.clear();
  creators.forEach(c => t.creators.set(c.id, c));

  const vertraegeNachKoop = await vertraegeProKooperation(vertraege, koopIds, { columns: VERTRAG_ZELLE_COLS });

  t.kooperationen.forEach(koop => {
    if (koop.creator_id) {
      koop.creator = t.creators.get(koop.creator_id) || null;
    }
    koop._vertraege = vertraegeNachKoop.get(koop.id) || [];
    koop.status_name = koop.status_ref?.name || koop.status || null;
    koop._tags = allTags
      .filter(tag => tag.kooperation_id === koop.id)
      .map(tag => tag.kooperation_tag_typen?.name || '');
  });
}

async function buildVideos(t, allVideos) {
  t.videos = {};
  allVideos.forEach(video => {
    const enrichedVideo = {
      ...video,
      currentAsset: null,
      file_url: video.asset_url || null
    };
    if (!t.videos[video.kooperation_id]) {
      t.videos[video.kooperation_id] = [];
    }
    t.videos[video.kooperation_id].push(enrichedVideo);
  });

  try {
    const { ideen, skripte } = await loadKonzeptInhalte(window.supabase, {
      kampagneId: t.kampagneId,
      produktionId: t.produktionId || null,
      briefingId: t.briefingId || null
    });
    t.videos = zuordnenKonzeptInhalte(t.kooperationen, t.videos, ideen, skripte);
  } catch (e) {
    console.warn('⚠️ Konzept-Inhalte konnten nicht zugeordnet werden:', e);
  }
}

async function applyVersand(t, versandInfos) {
  t.videoComments = {};
  t.versandInfos = {};
  versandInfos.forEach(info => {
    if (info.video_id) {
      t.versandInfos[info.video_id] = info;
    }
  });

  const adresseIds = [...new Set(versandInfos.map(v => v.creator_adresse_id).filter(Boolean))];
  t.creatorAdressen = {};
  if (adresseIds.length === 0) return;
  try {
    const adressenResult = await batchInQuery(
      window.supabase.from('creator_adressen'),
      'id, strasse, hausnummer, plz, stadt, land, adressname',
      'id', adresseIds
    );
    (adressenResult.data || []).forEach(a => { t.creatorAdressen[a.id] = a; });
  } catch (e) {
    console.warn('⚠️ Creator-Adressen konnten nicht geladen werden:', e);
  }
}

export class VideoTableDataLoader {
  constructor(table) {
    this.table = table;
  }

  static batchInQuery(supabaseFrom, selectStr, column, ids, extraFilters) {
    return batchInQuery(supabaseFrom, selectStr, column, ids, extraFilters);
  }

  async loadVideoFeedbackComments(videoIds) { return loadVideoFeedbackComments(videoIds); }
  async loadStillFeedbackComments(videoIds) { return loadStillFeedbackComments(videoIds); }

  async loadData() {
    const t = this.table;

    if (t._isLoading || t._dataLoaded) {
      console.log('⚠️ LoadData bereits in Arbeit oder abgeschlossen, überspringe...');
      return;
    }

    t._isLoading = true;
    t.performanceMetrics.startTime = performance.now();
    t.performanceMetrics.stages = {};
    t.performanceMetrics.errors = [];

    try {
      t._updateLoadingProgress('Lade Kooperationen...', 10);
      if (t.kooperationen.length === 0) await loadKooperationen(t);
      applyKampagneInfo(t);

      if (t.kooperationen.length === 0) {
        t.videos = {};
        t.videoComments = {};
        t.versandInfos = {};
        t._dataLoaded = true;
        t._logPerformanceSummary();
        t._removeLoadingProgress();
        return;
      }

      const koopIds = t.kooperationen.map(k => k.id);
      const creatorIds = [...new Set(t.kooperationen.map(k => k.creator_id).filter(Boolean))];

      t._updateLoadingProgress('Lade Videos & Creator...', 30);
      const base = await loadBaseQueries(t, koopIds, creatorIds);
      await enrichKooperationen(t, koopIds, base);
      await buildVideos(t, base.allVideos);
      await applyVersand(t, base.versandInfos);

      t._dataLoaded = true;
      t._logPerformanceSummary();
      t._updateLoadingProgress('Fertig!', 100);
      clearTimeout(t._loadingProgressTimer);
      t._loadingProgressTimer = setTimeout(() => t._removeLoadingProgress(), 300);

      await this._loadDeferred(koopIds, base.allVideos.map(v => v.id));
    } catch (error) {
      console.error('❌ Kritischer Fehler beim Laden:', error);
      t._endPerformanceTracking('CRITICAL_ERROR', false, error);
      t._logPerformanceSummary();
      t._removeLoadingProgress();
      window.ErrorHandler?.handle(error, 'KampagneKooperationenVideoTable.loadData');
    } finally {
      t._isLoading = false;
    }
  }

  /** Nach dem ersten Render: Spalten, Medien, Creator-Upload-Status, Stills. */
  async _loadDeferred(koopIds, videoIds) {
    const t = this.table;
    const parallelTasks = [this.loadCustomColumnsAndValues(koopIds, videoIds)];
    if (videoIds.length > 0) {
      parallelTasks.push(this.loadAssetsAndComments(videoIds));
      parallelTasks.push(this.loadStorySlots(videoIds));
    }
    // Creator-Upload-Zugaenge (nur intern, nur wenn Dropbox genutzt wird)
    if (typeof window.isInternal === 'function' && window.isInternal() && !t.kampagneInfo?.keinDropbox) {
      parallelTasks.push(
        import('./CreatorUploadActions.js')
          .then(m => m.loadCreatorUploadStatus(t.kampagneId))
          .catch(err => console.warn('[creator-upload] Status-Preload:', err))
      );
    }
    if (koopIds.length > 0) {
      parallelTasks.push(this.loadBilder(koopIds));
    }
    await Promise.all(parallelTasks);
  }

  loadAssetsAndComments(videoIds) { return loadAssetsAndComments(this, videoIds); }
  loadStorySlots(videoIds) { return loadStorySlots(this, videoIds); }
  loadBilderForVisible() { return loadBilderForVisible(this); }
  loadBilder(koopIds) { return loadBilder(this, koopIds); }
  patchRenderedAssetsAndComments(assetsByVideoId) { patchRenderedAssetsAndComments(this, assetsByVideoId); }
  patchRenderedBilderCells() { patchRenderedBilderCells(this); }

  getVersandForVideo(videoId) {
    if (!this.table.versandInfos) return null;
    return this.table.versandInfos[videoId] || null;
  }

  async loadCustomColumnsAndValues(koopIds, videoIds) {
    const t = this.table;
    const store = t.store;
    if (!store) return;

    try {
      const [columns, columnOrder] = await Promise.all([
        CustomColumnDataLoader.loadCustomColumns(t.kampagneId),
        CustomColumnDataLoader.loadColumnOrder(t.kampagneId)
      ]);

      store.setCustomColumns(columns);
      store.setColumnOrder(columnOrder);

      if (columns.length > 0) {
        const columnIds = columns.map(c => c.id);
        const entityIds = [...koopIds, ...videoIds];
        const values = await CustomColumnDataLoader.loadCustomColumnValues(columnIds, entityIds);
        store.setCustomColumnValues(values);
      }
    } catch (error) {
      console.warn('⚠️ Custom Columns konnten nicht geladen werden:', error);
    }
  }

  async loadColumnVisibilitySettings() {
    const t = this.table;
    try {
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('video_table_hidden_columns')
        .eq('id', t.kampagneId)
        .single();

      if (error) throw error;

      t.hiddenColumns = data?.video_table_hidden_columns || [];
    } catch (error) {
      t.hiddenColumns = [];
    }
  }
}
