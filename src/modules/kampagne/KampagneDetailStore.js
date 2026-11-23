// KampagneDetailStore.js
// Zentraler In-Memory Data Store fuer die Kampagne-Detail-Seite.
// Haelt alle Kooperationen, Videos, Creators, Vertraege, Versand, Kommentare, Assets.
// Bietet gefilterte Views und Event-basierte Benachrichtigungen.

import {
  createEmptyVideoFeedbackComments,
  getVideoFeedbackBucket,
  normalizeVideoFeedbackComments
} from '../../core/VideoFeedbackBuckets.js';
import { sortKooperationen } from './KooperationSortHelper.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { summiereLivePerformance } from './kampagneLivePerformance.js';
import { filterRows } from '../../core/filterColumn/filterRows.js';
import { isActive } from '../../core/filterColumn/filterColumnValues.js';
import { DEFAULT_KOOPERATION_SORT, kooperationFilterDefs } from './kooperationFilterSpalte.js';

// Custom-Column-Typen, die in die Freitextsuche einfliessen.
const SEARCHABLE_CUSTOM_TYPES = new Set(['text', 'comment', 'dropdown']);

export class KampagneDetailStore {
  constructor(kampagneId) {
    this.kampagneId = kampagneId;
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {};
    this.stillComments = {};
    this.zeitkommentare = {};      // { [videoId]: [kommentar, ...] } aus dem Videos-Tab
    this.versandInfos = {};
    this.creators = new Map();
    this.creatorAdressen = {};
    this.kampagneInfo = null;
    this.statusOptions = [];
    this.livePosts = [];           // bestätigte kooperation_post (Kachel Live-Performance)

    this.kooperationSort = DEFAULT_KOOPERATION_SORT;
    this.columnFilters = {};       // Werte der Filterspalte, { [filterId]: value }
    this.searchQuery = '';
    this.rechnungStatusMap = {};

    // Custom Columns
    this.customColumns = [];
    this.customColumnValues = {};  // { [entityId]: { [columnId]: value } }
    this.customColumnAssets = {};  // { [columnId:entityId]: [assetRow, ...] }
    this.columnOrder = null;       // JSONB Array oder null (= Default)

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
    // Neue Video-Objekte tragen keine Assets: sonst ueberspringt das Nachladen sie (leere Finale-Spalte)
    this._loadedAssetVideoIds.clear();
    this.emit('videos-changed', this.videos);
  }

  setVideoComments(comments) {
    this.videoComments = comments || {};
  }

  setStillComments(comments) {
    this.stillComments = comments || {};
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

  getKoopCreatorName(koop) {
    return `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim();
  }

  matchesSearch(koop) {
    const query = (this.searchQuery || '').trim().toLowerCase();
    if (!query) return true;
    if (this._matchesKoopLevel(koop, query)) return true;
    return (this.videos[koop.id] || []).some(v => this._matchesVideoLevel(v, query));
  }

  /**
   * Videos, die die Tabelle fuer diese Kooperation rendert. Matcht die Suche
   * auf Koop-Ebene (Creator/Status/Tags), bleiben alle Videos sichtbar; matcht
   * sie nur einzelne Videos, werden die anderen Zeilen ausgeblendet.
   */
  getVisibleVideos(koop) {
    const videos = this.videos[koop.id] || [];
    const query = (this.searchQuery || '').trim().toLowerCase();
    if (!query) return videos;
    if (this._matchesKoopLevel(koop, query)) return videos;
    return videos.filter(v => this._matchesVideoLevel(v, query));
  }

  /** Koop-Ebene: Creator-Name, Status, Tags, Koop-Custom (text/dropdown). */
  _matchesKoopLevel(koop, query) {
    const parts = [
      this.getKoopCreatorName(koop),
      koop.status_name || koop.status_ref?.name || '',
      ...(koop._tags || []),
    ];
    for (const col of this.customColumns) {
      if (!SEARCHABLE_CUSTOM_TYPES.has(col.field_type)) continue;
      if (col.entity_type === 'video') continue;
      parts.push(this.getCustomColumnValue(koop.id, col.id));
    }
    return this._anyMatch(parts, query);
  }

  /** Video-Ebene: Thema, Video-Name, Caption, Konzept-Beschreibung, Video-Custom. */
  _matchesVideoLevel(video, query) {
    const parts = [
      video.thema, video.video_name, video.caption,
      video.strategie_item?.beschreibung,
    ];
    for (const col of this.customColumns) {
      if (!SEARCHABLE_CUSTOM_TYPES.has(col.field_type)) continue;
      if (col.entity_type !== 'video') continue;
      parts.push(this.getCustomColumnValue(video.id, col.id));
    }
    return this._anyMatch(parts, query);
  }

  _anyMatch(parts, query) {
    return parts
      .filter(p => p != null && p !== '')
      .some(p => String(p).toLowerCase().includes(query));
  }

  getFiltered(tab) {
    let filtered = this.kooperationen;
    if (tab === 'offen') {
      filtered = filtered.filter(k => !this.areAllVideosApproved(k.id));
    } else if (tab === 'abgeschlossen') {
      filtered = filtered.filter(k => this.areAllVideosApproved(k.id));
    }
    if (this.hasColumnFilters()) {
      filtered = filterRows(filtered, kooperationFilterDefs({ store: this }), this.columnFilters);
    }
    if ((this.searchQuery || '').trim()) {
      filtered = filtered.filter(k => this.matchesSearch(k));
    }
    return filtered;
  }

  /** Gewählte Tags der Filterspalte; danach rechnen auch die Summary-Karten. */
  getSelectedTags() {
    const tags = this.columnFilters.tag;
    return Array.isArray(tags) ? tags : [];
  }

  /** Werte der Filterspalte übernehmen. Ändern sich die Tags, ziehen die Karten nach. */
  setColumnFilters(values) {
    const vorher = this.getSelectedTags().join('\u0000');
    this.columnFilters = { ...(values || {}) };
    this.emit('column-filters-changed', this.columnFilters);
    if (this.getSelectedTags().join('\u0000') !== vorher) {
      this.emit('tags-filter-changed', this.getSelectedTags());
    }
  }

  hasColumnFilters() {
    return Object.values(this.columnFilters).some(isActive);
  }

  hasActiveFilters() {
    return this.hasColumnFilters() || (this.searchQuery || '').trim().length > 0;
  }

  setSearchQuery(query) {
    this.searchQuery = query || '';
    this.emit('search-query-changed', this.searchQuery);
  }

  getAvailableStatuses() {
    if (this.statusOptions.length > 0) {
      return this.statusOptions.map(s => s.name);
    }
    const statusSet = new Set();
    for (const k of this.kooperationen) {
      const name = k.status_name || k.status_ref?.name;
      if (name) statusSet.add(name);
    }
    return [...statusSet].sort((a, b) => a.localeCompare(b, 'de'));
  }

  getAvailableTags() {
    const tagSet = new Set();
    for (const k of this.kooperationen) {
      for (const tag of (k._tags || [])) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b, 'de'));
  }

  setKooperationSort(sortValue) {
    this.kooperationSort = sortValue || DEFAULT_KOOPERATION_SORT;
  }

  /**
   * Gefilterte (tab) UND sortierte Kooperationen.
   * Die Sortierung wird clientseitig via KooperationSortHelper.sortKooperationen
   * angewandt und nutzt this.kooperationSort als aktuell aktiven Sort-Wert.
   */
  getFilteredAndSorted(tab) {
    return sortKooperationen(this.getFiltered(tab), this.kooperationSort, this.videos);
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

  setRechnungStatusMap(map) {
    this.rechnungStatusMap = map || {};
  }

  calculateSummary() {
    return this._calculateSummaryFor(this.kooperationen, this.videos);
  }

  /**
   * Summary nur ueber die per Tag-Filter ausgewaehlten Kooperationen.
   * Status/Suche/Tab fliessen hier bewusst nicht ein (Produktentscheidung).
   * kskUmgebucht bleibt global, weil es die Budget-Basis (Soll) bildet.
   */
  calculateFilteredSummary() {
    const tags = this.getSelectedTags();
    if (tags.length === 0) return this.calculateSummary();
    const koops = this.kooperationen.filter(k =>
      (k._tags || []).some(tag => tags.includes(tag))
    );
    const videosByKoopId = {};
    for (const k of koops) {
      if (this.videos[k.id]) videosByKoopId[k.id] = this.videos[k.id];
    }
    return this._calculateSummaryFor(koops, videosByKoopId);
  }

  _calculateSummaryFor(koops, videosByKoopId) {
    const allVideos = Object.values(videosByKoopId).flat();
    const koopBudgetSum = allVideos.reduce((sum, v) => sum + (parseFloat(v.verkaufspreis_netto) || 0), 0);
    const koopVideosUsed = koops.reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
    const extraKostenVkSum = koops.reduce((sum, k) => sum + (parseFloat(k.verkaufspreis_zusatzkosten) || 0), 0);
    const koopCreatorsUsed = koops.filter(k => k.creator_id).length;
    // KSK-Selbstzahler: aus dem KSK-Topf ins Creator-Budget umgebuchter Anteil
    const kskUmgebucht = summeKskSelbstzahler(this.kooperationen);

    return {
      koopBudgetSum,
      koopVideosUsed,
      koopCreatorsUsed,
      extraKostenVkSum,
      kskUmgebucht,
      ekVkMarginSum: 0,
      videoStats: this.calculateVideoStats(koops.map(k => k.id))
    };
  }

  setLivePosts(posts) {
    this.livePosts = posts || [];
    this.emit('posts-changed');
  }

  /** Live-Performance: bestätigte Posts der geladenen (oder der übergebenen) Kooperationen. */
  calculateVideoStats(koopIds = this.kooperationen.map(k => k.id)) {
    return summiereLivePerformance(this.livePosts, koopIds);
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
      delete this.stillComments[vid];
      delete this.zeitkommentare[vid];
      delete this.versandInfos[vid];
      this._loadedAssetVideoIds.delete(vid);
    });

    this.emit('kooperation-removed', { koopId, deletedVideoIds });
  }

  updateVideoComments(videoId, commentsByBucket) {
    this.videoComments[videoId] = normalizeVideoFeedbackComments(commentsByBucket);
    this.emit('comments-updated', { videoId });
  }

  updateStillComments(videoId, commentsByBucket) {
    this.stillComments[videoId] = normalizeVideoFeedbackComments(commentsByBucket);
    this.emit('still-comments-updated', { videoId });
  }

  updateZeitkommentare(videoId, list) {
    this.zeitkommentare[videoId] = list || [];
    this.emit('zeitkommentare-updated', { videoId });
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

  applyFinalAssets(finalsByVideoId) {
    for (const koopVideos of Object.values(this.videos)) {
      for (const video of koopVideos) {
        video.finalAssets = finalsByVideoId[video.id] || video.finalAssets || [];
      }
    }
  }

  applyComments(comments) {
    for (const comment of comments) {
      if (!this.videoComments[comment.video_id]) {
        this.videoComments[comment.video_id] = createEmptyVideoFeedbackComments();
      }
      this.videoComments[comment.video_id][getVideoFeedbackBucket(comment)].push(comment);
    }
  }

  applyStillComments(comments) {
    for (const comment of comments) {
      if (!this.stillComments[comment.video_id]) {
        this.stillComments[comment.video_id] = createEmptyVideoFeedbackComments();
      }
      this.stillComments[comment.video_id][getVideoFeedbackBucket(comment)].push(comment);
    }
  }

  applyZeitkommentare(byVideo) {
    Object.assign(this.zeitkommentare, byVideo || {});
  }

  getVersandForVideo(videoId) {
    return this.versandInfos[videoId] || null;
  }

  // ========================================
  // STORY SLOTS
  // ========================================

  applyStorySlots(slotsByVideoId) {
    for (const koopVideos of Object.values(this.videos)) {
      for (const video of koopVideos) {
        if (slotsByVideoId[video.id]) {
          video.story_slots = slotsByVideoId[video.id];
        } else if (!video.story_slots) {
          video.story_slots = [];
        }
      }
    }
  }

  getStorySlots(videoId) {
    for (const koopVideos of Object.values(this.videos)) {
      const video = koopVideos.find(v => v.id === videoId);
      if (video) return video.story_slots || [];
    }
    return [];
  }

  addStorySlot(videoId, slot) {
    for (const koopVideos of Object.values(this.videos)) {
      const video = koopVideos.find(v => v.id === videoId);
      if (video) {
        if (!video.story_slots) video.story_slots = [];
        video.story_slots.push(slot);
        this.emit('story-slot-added', { videoId, slot });
        return slot;
      }
    }
    return null;
  }

  updateStorySlot(storyId, patch) {
    for (const koopVideos of Object.values(this.videos)) {
      for (const video of koopVideos) {
        const slots = video.story_slots || [];
        const idx = slots.findIndex(s => s.id === storyId);
        if (idx !== -1) {
          slots[idx] = { ...slots[idx], ...patch };
          this.emit('story-slot-updated', { videoId: video.id, storyId, slot: slots[idx] });
          return slots[idx];
        }
      }
    }
    return null;
  }

  removeStorySlot(storyId) {
    for (const koopVideos of Object.values(this.videos)) {
      for (const video of koopVideos) {
        const slots = video.story_slots || [];
        const idx = slots.findIndex(s => s.id === storyId);
        if (idx !== -1) {
          const removed = slots.splice(idx, 1)[0];
          this.emit('story-slot-removed', { videoId: video.id, storyId });
          return removed;
        }
      }
    }
    return null;
  }

  // ========================================
  // CUSTOM COLUMNS
  // ========================================

  setCustomColumns(columns) {
    this.customColumns = columns || [];
    this.emit('custom-columns-changed', this.customColumns);
  }

  setCustomColumnValues(valuesMap) {
    this.customColumnValues = valuesMap || {};
  }

  setColumnOrder(order) {
    this.columnOrder = order;
    this.emit('column-order-changed', this.columnOrder);
  }

  getCustomColumnValue(entityId, columnId) {
    return this.customColumnValues[entityId]?.[columnId] ?? null;
  }

  setCustomColumnValue(entityId, columnId, value) {
    if (!this.customColumnValues[entityId]) {
      this.customColumnValues[entityId] = {};
    }
    this.customColumnValues[entityId][columnId] = value;
    this.emit('custom-value-updated', { entityId, columnId, value });
  }

  updateCustomColumnValue(entityId, columnId, value) {
    this.setCustomColumnValue(entityId, columnId, value);
  }

  setCustomColumnAssets(assetsMap) {
    this.customColumnAssets = assetsMap || {};
  }

  getCustomColumnAssets(columnId, entityId) {
    return this.customColumnAssets[`${columnId}:${entityId}`] || [];
  }

  addCustomColumn(col) {
    this.customColumns.push(col);
    this.emit('custom-columns-changed', this.customColumns);
  }

  removeCustomColumn(colId) {
    this.customColumns = this.customColumns.filter(c => c.id !== colId);
    for (const entityId in this.customColumnValues) {
      delete this.customColumnValues[entityId][colId];
    }
    this.emit('custom-columns-changed', this.customColumns);
  }

  updateCustomColumn(colId, patch) {
    const idx = this.customColumns.findIndex(c => c.id === colId);
    if (idx !== -1) {
      this.customColumns[idx] = { ...this.customColumns[idx], ...patch };
      this.emit('custom-columns-changed', this.customColumns);
    }
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  destroy() {
    this._listeners.clear();
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {};
    this.stillComments = {};
    this.zeitkommentare = {};
    this.versandInfos = {};
    this.creatorAdressen = {};
    this.creators.clear();
    this.statusOptions = [];
    this.customColumns = [];
    this.customColumnValues = {};
    this.customColumnAssets = {};
    this.columnOrder = null;
    this.kooperationSort = DEFAULT_KOOPERATION_SORT;
    this.columnFilters = {};
    this.searchQuery = '';
    this._loadedAssetVideoIds.clear();
  }
}
