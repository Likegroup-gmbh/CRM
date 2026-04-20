export class VideoTableDataLoader {
  constructor(table) {
    this.table = table;
  }

  static batchInQuery(supabaseFrom, selectStr, column, ids, extraFilters) {
    const BATCH_SIZE = 200;
    if (ids.length <= BATCH_SIZE) {
      let q = supabaseFrom.select(selectStr).in(column, ids);
      if (extraFilters) q = extraFilters(q);
      return q.then(r => r);
    }
    const batches = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      let q = supabaseFrom.select(selectStr).in(column, ids.slice(i, i + BATCH_SIZE));
      if (extraFilters) q = extraFilters(q);
      batches.push(q);
    }
    return Promise.all(batches).then(results => {
      const merged = { data: [], error: null };
      for (const r of results) {
        if (r.error) { merged.error = r.error; break; }
        if (r.data) merged.data.push(...r.data);
      }
      return merged;
    });
  }

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

      if (t.kooperationen.length === 0) {
        t._startPerformanceTracking('Query: kooperationen');
        const isKunde = t.isKundeRole();
        const kampagneJoin = 'kampagne:kampagne_id (id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname))';
        const statusJoin = 'status_ref:status_id(id, name)';
        const koopSelect = isKunde
          ? `id, name, status_id, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, bilder_folder_url, ${statusJoin}, ${kampagneJoin}`
          : `id, name, status_id, einkaufspreis_netto, einkaufspreis_gesamt, verkaufspreis_zusatzkosten, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, bilder_folder_url, ${statusJoin}, ${kampagneJoin}`;

        const kooperationenResult = await window.supabase
          .from('kooperationen')
          .select(koopSelect)
          .eq('kampagne_id', t.kampagneId)
          .order('created_at', { ascending: false });

        t._endPerformanceTracking('Query: kooperationen', !kooperationenResult.error, kooperationenResult.error);

        if (kooperationenResult.error) throw kooperationenResult.error;
        
        t.kooperationen = kooperationenResult.data || [];
      }

      const firstKamp = t.kooperationen.find(k => k.kampagne)?.kampagne;
      if (firstKamp) {
        t.kampagneInfo = {
          id: firstKamp.id,
          name: firstKamp.kampagnenname || firstKamp.eigener_name || '',
          unternehmen: firstKamp.unternehmen?.firmenname || '',
          marke: firstKamp.marke?.markenname || ''
        };
      }
      
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

      t._startPerformanceTracking('Query: kooperation_videos');
      t._startPerformanceTracking('Query: creator');
      t._startPerformanceTracking('Query: kooperation_versand');

      const batchIn = VideoTableDataLoader.batchInQuery;
      const sb = window.supabase;

      const [videosResult, creatorsResult, vertraegeResult, versandResult, statusResult, tagsResult] = await Promise.allSettled([
        batchIn(
          sb.from('kooperation_videos'),
          'id, kooperation_id, position, asset_url, content_art, caption, feedback_creatorjobs, feedback_ritzenhoff, freigabe, link_content, folder_url, story_folder_url, link_produkte, thema, link_skript, skript_freigegeben, drehort, video_name, posting_datum, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, strategie_item_id, strategie_item:strategie_item_id(id, screenshot_url, beschreibung, strategie_id, video_link)',
          'kooperation_id', koopIds,
          q => q.order('position', { ascending: true })
        ),
        
        batchIn(
          sb.from('creator'),
          'id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt',
          'id', creatorIds
        ),

        batchIn(
          sb.from('vertraege'),
          'id, name, typ, kooperation_id, datei_url, dropbox_file_url, unterschriebener_vertrag_url, is_draft',
          'kooperation_id', koopIds
        ),

        batchIn(
          sb.from('kooperation_versand'),
          'id, kooperation_id, video_id, versendet, tracking_nummer, produkt_name, produkt_link, strasse, hausnummer, plz, stadt, creator_adresse_id',
          'kooperation_id', koopIds
        ),

        sb.from('kampagne_status')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true }),

        batchIn(
          sb.from('kooperation_tags'),
          'kooperation_id, tag_id, kooperation_tag_typen(id, name)',
          'kooperation_id', koopIds
        )
      ]);

      t._endPerformanceTracking('Query: kooperation_videos', videosResult.status === 'fulfilled', videosResult.reason);
      t._endPerformanceTracking('Query: creator', creatorsResult.status === 'fulfilled', creatorsResult.reason);
      t._endPerformanceTracking('Query: kooperation_versand', versandResult.status === 'fulfilled', versandResult.reason);

      const allVideos = videosResult.status === 'fulfilled' ? (videosResult.value.data || []) : [];
      const creators = creatorsResult.status === 'fulfilled' ? (creatorsResult.value.data || []) : [];
      const vertraege = vertraegeResult.status === 'fulfilled' ? (vertraegeResult.value.data || []) : [];
      const versandInfos = versandResult.status === 'fulfilled' ? (versandResult.value.data || []) : [];
      t.statusOptions = statusResult.status === 'fulfilled' ? (statusResult.value.data || []) : [];
      const allTags = tagsResult.status === 'fulfilled' ? (tagsResult.value.data || []) : [];

      t.creators.clear();
      creators.forEach(c => t.creators.set(c.id, c));

      t.kooperationen.forEach(koop => {
        if (koop.creator_id) {
          koop.creator = t.creators.get(koop.creator_id) || null;
        }
        koop._vertraege = vertraege.filter(v => v.kooperation_id === koop.id);
        koop.status_name = koop.status_ref?.name || koop.status || null;
        koop._tags = allTags
          .filter(tag => tag.kooperation_id === koop.id)
          .map(tag => tag.kooperation_tag_typen?.name || '');
      });

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

      t.videoComments = {};
      t.versandInfos = {};
      versandInfos.forEach(info => {
        if (info.video_id) {
          t.versandInfos[info.video_id] = info;
        }
      });

      const adresseIds = [...new Set(versandInfos.map(v => v.creator_adresse_id).filter(Boolean))];
      t.creatorAdressen = {};
      if (adresseIds.length > 0) {
        try {
          const adressenResult = await batchIn(
            sb.from('creator_adressen'),
            'id, strasse, hausnummer, plz, stadt, adressname',
            'id', adresseIds
          );
          (adressenResult.data || []).forEach(a => { t.creatorAdressen[a.id] = a; });
        } catch (e) {
          console.warn('⚠️ Creator-Adressen konnten nicht geladen werden:', e);
        }
      }

      t._dataLoaded = true;
      t._logPerformanceSummary();
      t._updateLoadingProgress('Fertig!', 100);
      setTimeout(() => t._removeLoadingProgress(), 300);

      const videoIds = allVideos.map(v => v.id);
      if (videoIds.length > 0) {
        await this.loadAssetsAndComments(videoIds);
      }

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

  async loadAssetsAndComments(videoIds) {
    const t = this.table;
    if (!videoIds || videoIds.length === 0) return;

    try {
      const batchIn = VideoTableDataLoader.batchInQuery;
      const sb = window.supabase;

      const [assetsResult, commentsResult] = await Promise.allSettled([
        batchIn(
          sb.from('kooperation_video_asset'),
          'id, video_id, file_url, file_path, is_current',
          'video_id', videoIds,
          q => q.eq('is_current', true)
        ),
        batchIn(
          sb.from('kooperation_video_comment'),
          'id, video_id, text, runde, author_name, created_at',
          'video_id', videoIds,
          q => q.is('deleted_at', null).order('created_at', { ascending: true })
        )
      ]);

      const assets = assetsResult.status === 'fulfilled' ? (assetsResult.value.data || []) : [];
      const comments = commentsResult.status === 'fulfilled' ? (commentsResult.value.data || []) : [];

      if (assetsResult.status === 'rejected') {
        console.warn('⚠️ Assets konnten nicht geladen werden:', assetsResult.reason);
      }
      if (commentsResult.status === 'rejected') {
        console.warn('⚠️ Comments konnten nicht geladen werden:', commentsResult.reason);
      }

      const assetsByVideoId = new Map(assets.map(a => [a.video_id, a]));

      if (t.store) {
        t.store.applyAssets(assetsByVideoId);
        t.store.applyComments(comments);
      } else {
        for (const koopVideos of Object.values(t.videos)) {
          for (const video of koopVideos) {
            const asset = assetsByVideoId.get(video.id);
            if (asset) {
              video.currentAsset = asset;
              video.file_url = asset.file_url || video.asset_url || null;
            }
          }
        }

        comments.forEach(comment => {
          if (!t.videoComments[comment.video_id]) {
            t.videoComments[comment.video_id] = { r1: [], r2: [] };
          }
          if (comment.runde === 1) {
            t.videoComments[comment.video_id].r1.push(comment);
          } else if (comment.runde === 2) {
            t.videoComments[comment.video_id].r2.push(comment);
          }
        });
      }

      if (assets.length > 0 || comments.length > 0) {
        this.patchRenderedAssetsAndComments(assetsByVideoId);
      }

      console.log(`✅ Assets (${assets.length}) + Comments (${comments.length}) nachgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Nachladen von Assets/Comments:', error);
    }
  }

  patchRenderedAssetsAndComments(assetsByVideoId) {
    const container = this.table.containerId ? document.getElementById(this.table.containerId) : null;
    if (!container) return;

    for (const [videoId, asset] of assetsByVideoId) {
      const thumbnail = container.querySelector(`[data-video-id="${videoId}"] .video-thumbnail-img`);
      if (thumbnail && asset.file_url) {
        thumbnail.src = asset.file_url;
        thumbnail.closest('.video-thumbnail')?.classList.remove('no-asset');
      }
    }

    const commentsSource = this.table.store?.videoComments || this.table.videoComments || {};
    for (const [videoId, comments] of Object.entries(commentsSource)) {
      const r1Value = (comments.r1 || []).map(c => c.text).join('\n\n---\n\n');
      const r2Value = (comments.r2 || []).map(c => c.text).join('\n\n---\n\n');

      const feedbackCJ = container.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_creatorjobs"]`);
      if (feedbackCJ && !feedbackCJ.value) feedbackCJ.value = r1Value;

      const feedbackKunde = container.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_ritzenhoff"]`);
      if (feedbackKunde && !feedbackKunde.value) feedbackKunde.value = r2Value;
    }
  }

  getVersandForVideo(videoId) {
    if (!this.table.versandInfos) return null;
    return this.table.versandInfos[videoId] || null;
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
