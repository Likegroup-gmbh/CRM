// KampagneDetailStore.js
// Zentraler In-Memory Data Store fuer die Kampagne-Detail-Seite.
// Haelt alle Kooperationen, Videos, Creators, Vertraege, Versand, Kommentare, Assets.
// Bietet gefilterte Views und Event-basierte Benachrichtigungen.

export class KampagneDetailStore {
  constructor(kampagneId) {
    this.kampagneId = kampagneId;
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {};
    this.versandInfos = {};
    this.creators = new Map();
    this.creatorAdressen = {};
    this.kampagneInfo = null;
    this.statusOptions = [];

    this._loadedAssetVideoIds = new Set();
    this._listeners = new Map();
  }

  // ========================================
  // EVENT EMITTER
  // ========================================

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this._listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const cb of listeners) {
      try { cb(data); } catch (e) { console.error(`Store event error (${event}):`, e); }
    }
  }

  // ========================================
  // DATA POPULATION
  // ========================================

  setKooperationen(kooperationen) {
    this.kooperationen = kooperationen || [];
    this.emit('kooperationen-changed', this.kooperationen);
  }

  setVideos(videosByKoopId) {
    this.videos = videosByKoopId || {};
    this.emit('videos-changed', this.videos);
  }

  setVideoComments(comments) {
    this.videoComments = comments || {};
  }

  setVersandInfos(infos) {
    this.versandInfos = infos || {};
  }

  setCreators(creatorsMap) {
    this.creators = creatorsMap instanceof Map ? creatorsMap : new Map();
  }

  setCreatorAdressen(map) {
    this.creatorAdressen = map || {};
  }

  getCreatorAdresse(id) {
    return this.creatorAdressen[id] || null;
  }

  setKampagneInfo(info) {
    this.kampagneInfo = info;
  }

  setStatusOptions(options) {
    this.statusOptions = options || [];
  }

  // ========================================
  // FILTERED VIEWS
  // ========================================

  areAllVideosApproved(kooperationId) {
    const videos = this.videos[kooperationId] || [];
    if (videos.length === 0) return false;
    return videos.every(v => v.freigabe === true);
  }

  getFiltered(tab) {
    if (tab === 'offen') {
      return this.kooperationen.filter(k => !this.areAllVideosApproved(k.id));
    }
    if (tab === 'abgeschlossen') {
      return this.kooperationen.filter(k => this.areAllVideosApproved(k.id));
    }
    return this.kooperationen;
  }

  getOpenCount() {
    return this.kooperationen.filter(k => !this.areAllVideosApproved(k.id)).length;
  }

  getClosedCount() {
    return this.kooperationen.filter(k => this.areAllVideosApproved(k.id)).length;
  }

  getAllCount() {
    return this.kooperationen.length;
  }

  // ========================================
  // SUMMARY CALCULATION
  // ========================================

  calculateSummary() {
    const allVideos = Object.values(this.videos).flat();
    const koopBudgetSum = allVideos.reduce((sum, v) => sum + (parseFloat(v.verkaufspreis_netto) || 0), 0);
    const koopVideosUsed = this.kooperationen.reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
    const extraKostenVkSum = this.kooperationen.reduce((sum, k) => sum + (parseFloat(k.verkaufspreis_zusatzkosten) || 0), 0);
    const uniqueCreatorIds = new Set();
    this.kooperationen.forEach(k => { if (k.creator_id) uniqueCreatorIds.add(k.creator_id); });
    return { koopBudgetSum, koopVideosUsed, koopCreatorsUsed: uniqueCreatorIds.size, extraKostenVkSum };
  }

  // ========================================
  // GRANULAR UPDATES (for Realtime + Inline Edit)
  // ========================================

  updateVideo(videoId, patch) {
    for (const koopId in this.videos) {
      const idx = this.videos[koopId].findIndex(v => v.id === videoId);
      if (idx !== -1) {
        this.videos[koopId][idx] = { ...this.videos[koopId][idx], ...patch };
        this.emit('video-updated', { videoId, koopId, video: this.videos[koopId][idx] });
        return this.videos[koopId][idx];
      }
    }
    return null;
  }

  addVideo(koopId, video) {
    if (!this.videos[koopId]) this.videos[koopId] = [];
    this.videos[koopId].push(video);
    this.emit('video-added', { koopId, video });
  }

  updateKooperation(koopId, patch) {
    const idx = this.kooperationen.findIndex(k => k.id === koopId);
    if (idx !== -1) {
      this.kooperationen[idx] = { ...this.kooperationen[idx], ...patch };
      this.emit('kooperation-updated', { koopId, kooperation: this.kooperationen[idx] });
      return this.kooperationen[idx];
    }
    return null;
  }

  addKooperation(koop) {
    this.kooperationen.unshift(koop);
    this.emit('kooperation-added', { kooperation: koop });
  }

  removeKooperation(koopId) {
    const deletedVideos = this.videos[koopId] || [];
    const deletedVideoIds = deletedVideos.map(v => v.id);

    this.kooperationen = this.kooperationen.filter(k => k.id !== koopId);
    delete this.videos[koopId];
    deletedVideoIds.forEach(vid => {
      delete this.videoComments[vid];
      delete this.versandInfos[vid];
      this._loadedAssetVideoIds.delete(vid);
    });

    this.emit('kooperation-removed', { koopId, deletedVideoIds });
  }

  updateVideoComments(videoId, r1, r2) {
    this.videoComments[videoId] = { r1: r1 || [], r2: r2 || [] };
    this.emit('comments-updated', { videoId });
  }

  // ========================================
  // ASSET/COMMENT TRACKING
  // ========================================

  getUnloadedVideoIds(videoIds) {
    return videoIds.filter(id => !this._loadedAssetVideoIds.has(id));
  }

  markAssetsLoaded(videoIds) {
    videoIds.forEach(id => this._loadedAssetVideoIds.add(id));
  }

  applyAssets(assetsByVideoId) {
    for (const [videoId, asset] of assetsByVideoId) {
      for (const koopVideos of Object.values(this.videos)) {
        const video = koopVideos.find(v => v.id === videoId);
        if (video) {
          video.currentAsset = asset;
          video.file_url = asset.file_url || video.asset_url || null;
          break;
        }
      }
    }
  }

  applyComments(comments) {
    for (const comment of comments) {
      if (!this.videoComments[comment.video_id]) {
        this.videoComments[comment.video_id] = { r1: [], r2: [] };
      }
      if (comment.runde === 1) {
        this.videoComments[comment.video_id].r1.push(comment);
      } else if (comment.runde === 2) {
        this.videoComments[comment.video_id].r2.push(comment);
      }
    }
  }

  getVersandForVideo(videoId) {
    return this.versandInfos[videoId] || null;
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  destroy() {
    this._listeners.clear();
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {};
    this.versandInfos = {};
    this.creatorAdressen = {};
    this.creators.clear();
    this.statusOptions = [];
    this._loadedAssetVideoIds.clear();
  }
}
