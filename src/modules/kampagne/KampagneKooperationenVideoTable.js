// KampagneKooperationenVideoTable.js (ES6-Modul)
// Kombinierte Kooperations-Video-Tabelle für Kampagnendetails
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { VideoTableRealtimeHandler } from './VideoTableRealtimeHandler.js';
import { VideoTableUIHelpers } from './VideoTableUIHelpers.js';
import { VideoUploadDrawer } from './VideoUploadDrawer.js';

export class KampagneKooperationenVideoTable {
  constructor(kampagneId) {
    this.kampagneId = kampagneId;
    this.containerId = null; // Für refresh() Methode
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {}; // { video_id: { r1: [], r2: [] } }
    this.versandInfos = {};
    this.creators = new Map(); // Creator-Cache für Performance
    this.columnWidths = new Map();
    this.isResizing = false;
    this.resizeCol = null;
    this.resizeStartX = 0;
    this.resizeStartWidth = 0;
    this.storageKey = `kampagne_koops_videos_column_widths_v3_${kampagneId}`;
    this.hiddenColumns = []; // Spalten die für Kunden versteckt sind
    this._visibilityEventBound = false; // Verhindere mehrfache Event-Registrierung
    
    // Filter-State
    this.hideApprovedKooperationen = false; // Filter für freigegebene Kooperationen
    
    // Loading State (verhindert doppeltes Laden)
    this._isLoading = false;
    this._dataLoaded = false;
    
    // Performance-Tracking
    this.performanceMetrics = {
      startTime: null,
      stages: {},
      errors: []
    };
    
    // Drag-to-Scroll State
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
    this._entityUpdatedHandler = null;

    this.realtimeHandler = new VideoTableRealtimeHandler(this);
    this.uiHelpers = new VideoTableUIHelpers(this);
    this._uploadDrawer = new VideoUploadDrawer();
  }

  getCurrentUserRole() {
    return String(window.currentUser?.rolle || '').trim().toLowerCase();
  }

  isKundeRole() {
    const role = this.getCurrentUserRole();
    return role === 'kunde' || role === 'kunde_editor';
  }

  canDeleteKooperation() {
    if (this.isKundeRole()) return false;

    const canDelete = window.currentUser?.permissions?.kooperation?.can_delete;
    if (typeof canDelete === 'boolean') {
      return canDelete;
    }

    const role = this.getCurrentUserRole();
    return role === 'admin' || role === 'mitarbeiter';
  }

  // Prüfe ob ein Feld für den aktuellen Benutzer editierbar ist
  isFieldEditableForUser(entity, field) {
    const userRole = this.getCurrentUserRole();
    
    // Admins und Mitarbeiter können alles bearbeiten
    if (userRole === 'admin' || userRole === 'mitarbeiter') {
      return true;
    }
    
    // Kunden dürfen folgende Felder NICHT bearbeiten:
    if (this.isKundeRole()) {
      const readOnlyFieldsForKunden = {
        'kooperation': ['vertrag_unterschrieben', 'typ', 'nutzungsrechte'],
        'versand': ['versendet', 'tracking_nummer', 'produkt_name', 'produkt_link'],
        'video': ['thema', 'link_produkte', 'link_skript', 'skript_freigegeben', 'feedback_creatorjobs', 'caption', 'posting_datum', 'drehort', 'content_art']
      };
      
      return !readOnlyFieldsForKunden[entity]?.includes(field);
    }
    
    return false;
  }

  // Prüfe ob ALLE Videos einer Kooperation freigegeben sind
  areAllVideosApproved(kooperationId) {
    const videos = this.videos[kooperationId] || [];
    
    // Keine Videos = nicht als "komplett freigegeben" zählen
    if (videos.length === 0) {
      return false;
    }
    
    // Alle Videos müssen freigegeben sein
    return videos.every(video => video.freigabe === true);
  }

  // Toggle Filter für freigegebene Kooperationen
  toggleApprovedFilter() {
    this.hideApprovedKooperationen = !this.hideApprovedKooperationen;
    
    // Speichere Filter-State in localStorage (v2 = neuer Key)
    try {
      const key = `kampagne_${this.kampagneId}_hide_approved_v2`;
      localStorage.setItem(key, JSON.stringify(this.hideApprovedKooperationen));
    } catch (e) {
      // localStorage nicht verfügbar
    }
    
    // Render Tabelle neu
    this.refresh();
    
    console.log(`🔄 Filter "Freigegebene ausblenden": ${this.hideApprovedKooperationen ? 'AN ✅' : 'AUS (alle anzeigen)'}`);
  }

  // Lade Filter-State aus localStorage (Standard: false = alle anzeigen)
  loadApprovedFilterState() {
    try {
      const key = `kampagne_${this.kampagneId}_hide_approved_v2`;
      const saved = localStorage.getItem(key);
      // Nur wenn explizit gespeichert, sonst default false (alle anzeigen)
      this.hideApprovedKooperationen = saved !== null ? JSON.parse(saved) : false;
      console.log(`📋 Filter-State geladen: ${this.hideApprovedKooperationen ? 'Freigegebene AUSBLENDEN' : 'ALLE ANZEIGEN (Standard)'}`);
    } catch (e) {
      this.hideApprovedKooperationen = false;
      console.log('📋 Filter-State: ALLE ANZEIGEN (Standard/Fehler)');
    }
  }

  // ========================================
  // PERFORMANCE-MONITORING SYSTEM
  // ========================================

  // Performance-Tracking für eine Stage starten
  // Delegiert an uiHelpers
  _startPerformanceTracking(stageName) { return this.uiHelpers.startPerformanceTracking(stageName); }
  _endPerformanceTracking(stageName, success, error) { return this.uiHelpers.endPerformanceTracking(stageName, success, error); }
  _logPerformanceSummary() { this.uiHelpers.logPerformanceSummary(); }
  _updateLoadingProgress(message, percent) { this.uiHelpers.updateLoadingProgress(message, percent); }
  _removeLoadingProgress() { this.uiHelpers.removeLoadingProgress(); }

  // ========================================
  // DATEN-LOADING
  // ========================================

  // Lade alle Daten für die Tabelle
  async loadData() {
    // Verhindere doppeltes Laden (Fix 3)
    if (this._isLoading || this._dataLoaded) {
      console.log('⚠️ LoadData bereits in Arbeit oder abgeschlossen, überspringe...');
      return;
    }

    this._isLoading = true;
    this.performanceMetrics.startTime = performance.now();
    this.performanceMetrics.stages = {};
    this.performanceMetrics.errors = [];

    try {
      // UI-Progress anzeigen
      this._updateLoadingProgress('Lade Kooperationen...', 10);

      // ========================================
      // STUFE 1: Kooperationen laden (ohne Creator-Join)
      // Kunden: einkaufspreis_* nicht laden (Datenschutz)
      // ========================================
      this._startPerformanceTracking('Query: kooperationen');
      const isKunde = this.isKundeRole();
      const kampagneJoin = 'kampagne:kampagne_id (id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname))';
      const koopSelect = isKunde
        ? `id, name, status, content_art, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, ${kampagneJoin}`
        : `id, name, status, einkaufspreis_netto, einkaufspreis_gesamt, content_art, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, ${kampagneJoin}`;

      const kooperationenResult = await window.supabase
        .from('kooperationen')
        .select(koopSelect)
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });

      this._endPerformanceTracking('Query: kooperationen', !kooperationenResult.error, kooperationenResult.error);

      if (kooperationenResult.error) throw kooperationenResult.error;
      
      this.kooperationen = kooperationenResult.data || [];

      // Kampagne-Info fuer Dropbox-Pfad ableiten (aus erster Kooperation mit kampagne-Join)
      const firstKamp = this.kooperationen.find(k => k.kampagne)?.kampagne;
      if (firstKamp) {
        this.kampagneInfo = {
          id: firstKamp.id,
          name: firstKamp.kampagnenname || firstKamp.eigener_name || '',
          unternehmen: firstKamp.unternehmen?.firmenname || '',
          marke: firstKamp.marke?.markenname || ''
        };
      }
      
      // Leeres Ergebnis: Early Return
      if (this.kooperationen.length === 0) {
        this.videos = {};
        this.videoComments = {};
        this.versandInfos = {};
        this._dataLoaded = true;
        this._logPerformanceSummary();
        this._removeLoadingProgress();
        return;
      }

      const koopIds = this.kooperationen.map(k => k.id);
      const creatorIds = [...new Set(this.kooperationen.map(k => k.creator_id).filter(Boolean))];

      this._updateLoadingProgress('Lade Videos & Creator...', 30);

      // ========================================
      // STUFE 2: Videos + Creator parallel laden
      // ========================================
      this._startPerformanceTracking('Query: kooperation_videos');
      this._startPerformanceTracking('Query: creator');

      const [videosResult, creatorsResult] = await Promise.allSettled([
        window.supabase
          .from('kooperation_videos')
          .select('id, kooperation_id, position, asset_url, content_art, caption, feedback_creatorjobs, feedback_ritzenhoff, freigabe, link_content, link_produkte, thema, link_skript, skript_freigegeben, drehort, posting_datum, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, strategie_item_id, strategie_item:strategie_item_id(id, screenshot_url, beschreibung, strategie_id)')
          .in('kooperation_id', koopIds)
          .order('position', { ascending: true }),
        
        window.supabase
          .from('creator')
          .select('id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt')
          .in('id', creatorIds)
      ]);

      this._endPerformanceTracking('Query: kooperation_videos', videosResult.status === 'fulfilled', videosResult.reason);
      this._endPerformanceTracking('Query: creator', creatorsResult.status === 'fulfilled', creatorsResult.reason);

      const allVideos = videosResult.status === 'fulfilled' ? (videosResult.value.data || []) : [];
      const creators = creatorsResult.status === 'fulfilled' ? (creatorsResult.value.data || []) : [];

      // Creator-Cache aufbauen
      this.creators.clear();
      creators.forEach(c => this.creators.set(c.id, c));

      // Creator-Daten an Kooperationen anhängen (client-side)
      this.kooperationen.forEach(koop => {
        if (koop.creator_id) {
          koop.creator = this.creators.get(koop.creator_id) || null;
        }
      });

      const videoIds = allVideos.map(v => v.id);

      this._updateLoadingProgress('Lade Zusatzdaten...', 60);

      // ========================================
      // STUFE 3: Versand, Assets, Comments parallel mit Timeout (Fix 1)
      // ========================================
      let versandInfos = [];
      let assets = [];
      let comments = [];
      
      if (videoIds.length > 0) {
        this._startPerformanceTracking('Query: kooperation_versand');
        this._startPerformanceTracking('Query: kooperation_video_asset');
        this._startPerformanceTracking('Query: kooperation_video_comment');

        const [versandResult, assetsResult, commentsResult] = await Promise.allSettled([
          window.supabase
            .from('kooperation_versand')
            .select('id, kooperation_id, video_id, versendet, tracking_nummer, produkt_name, produkt_link, strasse, hausnummer, plz, stadt')
            .in('kooperation_id', koopIds),
          
          // Timeout für Assets (500-Error-Workaround)
          Promise.race([
            window.supabase
              .from('kooperation_video_asset')
              .select('id, video_id, file_url, file_path, is_current')
              .in('video_id', videoIds)
              .eq('is_current', true),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Assets-Query Timeout nach 3s')), 3000)
            )
          ]),
          
          // Timeout für Comments (500-Error-Workaround)
          Promise.race([
            window.supabase
              .from('kooperation_video_comment')
              .select('id, video_id, text, runde, author_name, created_at')
              .in('video_id', videoIds)
              .is('deleted_at', null)
              .order('created_at', { ascending: true }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Comments-Query Timeout nach 3s')), 3000)
            )
          ])
        ]);

        this._endPerformanceTracking('Query: kooperation_versand', versandResult.status === 'fulfilled', versandResult.reason);
        this._endPerformanceTracking('Query: kooperation_video_asset', assetsResult.status === 'fulfilled', assetsResult.reason);
        this._endPerformanceTracking('Query: kooperation_video_comment', commentsResult.status === 'fulfilled', commentsResult.reason);

        versandInfos = versandResult.status === 'fulfilled' ? (versandResult.value.data || []) : [];
        assets = assetsResult.status === 'fulfilled' ? (assetsResult.value.data || []) : [];
        comments = commentsResult.status === 'fulfilled' ? (commentsResult.value.data || []) : [];

        // User-Feedback bei fehlgeschlagenen Daten-Loads
        const failedLoads = [];
        if (assetsResult.status === 'rejected') {
          console.warn('⚠️ Assets konnten nicht geladen werden:', assetsResult.reason);
          failedLoads.push('Assets');
        }
        if (commentsResult.status === 'rejected') {
          console.warn('⚠️ Comments konnten nicht geladen werden:', commentsResult.reason);
          failedLoads.push('Kommentare');
        }
        if (versandResult.status === 'rejected') {
          console.warn('⚠️ Versand-Infos konnten nicht geladen werden:', versandResult.reason);
          failedLoads.push('Versand-Infos');
        }
        
        // Zeige User-Benachrichtigung bei Fehlern
        if (failedLoads.length > 0 && window.notificationSystem?.warning) {
          window.notificationSystem.warning(`Einige Daten (${failedLoads.join(', ')}) konnten nicht vollständig geladen werden.`);
        }
      }

      this._updateLoadingProgress('Verarbeite Daten...', 80);

      // ========================================
      // STUFE 4: Client-Side Mapping (Fix 2: Map statt find)
      // ========================================
      this._startPerformanceTracking('Client-Side: Mapping');

      // Map für O(1) Lookups erstellen
      const assetsByVideoId = new Map(assets.map(a => [a.video_id, a]));

      // Videos mit Assets anreichern und nach Kooperation gruppieren
      this.videos = {};
      allVideos.forEach(video => {
        const currentAsset = assetsByVideoId.get(video.id);
        const enrichedVideo = {
          ...video,
          currentAsset,
          file_url: currentAsset?.file_url || video.asset_url || null
        };
        
        if (!this.videos[video.kooperation_id]) {
          this.videos[video.kooperation_id] = [];
        }
        this.videos[video.kooperation_id].push(enrichedVideo);
      });

      // Kommentare nach Video und Runde gruppieren
      this.videoComments = {};
      comments.forEach(comment => {
        if (!this.videoComments[comment.video_id]) {
          this.videoComments[comment.video_id] = { r1: [], r2: [] };
        }
        if (comment.runde === 1) {
          this.videoComments[comment.video_id].r1.push(comment);
        } else if (comment.runde === 2) {
          this.videoComments[comment.video_id].r2.push(comment);
        }
      });

      // Versand-Infos nach Video gruppieren
      this.versandInfos = {};
      versandInfos.forEach(info => {
        if (info.video_id) {
          this.versandInfos[info.video_id] = info;
        }
      });

      this._endPerformanceTracking('Client-Side: Mapping');

      this._updateLoadingProgress('Fertig!', 100);

      // ========================================
      // Performance-Summary ausgeben
      // ========================================
      this._logPerformanceSummary();
      
      // Daten erfolgreich geladen
      this._dataLoaded = true;

      // UI-Progress entfernen
      setTimeout(() => this._removeLoadingProgress(), 500);

    } catch (error) {
      console.error('❌ Kritischer Fehler beim Laden:', error);
      this._endPerformanceTracking('CRITICAL_ERROR', false, error);
      this._logPerformanceSummary();
      this._removeLoadingProgress();
      window.ErrorHandler.handle(error, 'KampagneKooperationenVideoTable.loadData');
    } finally {
      this._isLoading = false;
    }
  }

  // Helper: Hole Versand-Info für ein spezifisches Video
  getVersandForVideo(videoId) {
    if (!this.versandInfos) return null;
    // Direkter Zugriff via video_id (da versandInfos jetzt nach video_id gruppiert ist)
    return this.versandInfos[videoId] || null;
  }

  // Lade Spalten-Sichtbarkeits-Einstellungen
  async loadColumnVisibilitySettings() {
    try {
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('video_table_hidden_columns')
        .eq('id', this.kampagneId)
        .single();

      if (error) throw error;

      this.hiddenColumns = data?.video_table_hidden_columns || [];
    } catch (error) {
      this.hiddenColumns = [];
    }
  }

  // Prüfe ob eine Spalte sichtbar ist (rollenabhängig)
  isColumnVisibleForCustomer(columnClass) {
    // Nr und Creator sind IMMER sichtbar für alle (essentiell)
    if (columnClass === 'col-nr' || columnClass === 'col-creator') {
      return true;
    }
    
    // EK-Spalten nur für Kunden IMMER ausblenden (Einkaufspreise!)
    if ((columnClass === 'col-kosten' || columnClass === 'col-ek-video') && this.isKundeRole()) {
      return false;
    }

    // Kunden sehen kein Aktionsmenü in der Kooperations-/Video-Tabelle
    if (columnClass === 'col-actions' && this.isKundeRole()) {
      return false;
    }
    
    // Für alle Rollen gilt die konfigurierte Sichtbarkeit
    const isVisible = !this.hiddenColumns.includes(columnClass);
    
    return isVisible;
  }

  // Render Skeleton Loading (für initialen Lade-Zustand)
  renderSkeletonLoading() {
    const rows = [];
    
    // Generiere 4 Skeleton-Zeilen mit der Tabellenstruktur
    for (let i = 0; i < 4; i++) {
      rows.push(`
        <div class="skeleton-video-table-row">
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text" style="width: 30px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--medium"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text" style="width: 40px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-badge"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--short"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--short"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--medium"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--medium"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--short"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-text skeleton-text--long"></div></div>
        </div>
      `);
    }
    
    return `
      <div class="skeleton-wrapper skeleton-video-table">
        <div class="skeleton-video-table-row" style="background: var(--gray-100); margin-bottom: var(--space-sm);">
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 30px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 120px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 50px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 80px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 60px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 60px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 100px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 100px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 60px;"></div></div>
          <div class="skeleton-video-cell"><div class="skeleton skeleton-header-cell" style="width: 150px;"></div></div>
        </div>
        ${rows.join('')}
      </div>
    `;
  }

  // Rendere die Tabelle
  render() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      const isKunde = this.isKundeRole();
      return `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Keine Kooperationen vorhanden</h3>
          ${!isKunde ? `
            <p>Erstelle eine Kooperation, um sie hier mit Videos zu verwalten.</p>
            <button class="primary-btn" onclick="window.navigateTo('/kooperation/new?kampagne_id=${this.kampagneId}')">
              Kooperation anlegen
            </button>
          ` : '<p>Es wurden noch keine Kooperationen für diese Kampagne angelegt.</p>'}
        </div>
      `;
    }

    // Filter anwenden: Verstecke Kooperationen mit allen freigegebenen Videos
    const filteredKooperationen = this.hideApprovedKooperationen
      ? this.kooperationen.filter(koop => !this.areAllVideosApproved(koop.id))
      : this.kooperationen;

    // Wenn nach Filter keine Kooperationen übrig sind
    if (filteredKooperationen.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <h3>Alle Kooperationen freigegeben</h3>
          <p>Es gibt keine offenen Kooperationen mehr. Alle Videos wurden freigegeben.</p>
        </div>
      `;
    }

    const rows = filteredKooperationen.map((koop, idx) => 
      this.renderKooperationWithVideos(koop, idx + 1)
    ).join('');

    return `
      <div class="grid-wrapper">
        <table class="grid-table kooperation-video-grid">
          <thead>
            <tr>
              <th class="col-header col-nr" data-col="0">
                Nr
                <div class="resize-handle resize-handle-col" data-col="0"></div>
              </th>
              <th class="col-header col-creator" data-col="1">
                Creator
                <div class="resize-handle resize-handle-col" data-col="1"></div>
              </th>
              <!-- col-kosten entfernt (EK-Spalte nicht mehr nötig) -->
              <th class="col-header col-vertrag" ${!this.isColumnVisibleForCustomer('col-vertrag') ? 'style="display:none;"' : ''} data-col="4">
                Vertrag
                <div class="resize-handle resize-handle-col" data-col="4"></div>
              </th>
              <th class="col-header col-nutzungsrechte" ${!this.isColumnVisibleForCustomer('col-nutzungsrechte') ? 'style="display:none;"' : ''} data-col="5">
                Nutzungsrechte
                <div class="resize-handle resize-handle-col" data-col="5"></div>
              </th>
              <th class="col-header col-start-datum" ${!this.isColumnVisibleForCustomer('col-start-datum') ? 'style="display:none;"' : ''} data-col="6">
                Erstellt
                <div class="resize-handle resize-handle-col" data-col="6"></div>
              </th>
              <th class="col-header col-script-deadline" ${!this.isColumnVisibleForCustomer('col-script-deadline') ? 'style="display:none;"' : ''} data-col="7">
                Script Deadline
                <div class="resize-handle resize-handle-col" data-col="7"></div>
              </th>
              <th class="col-header col-end-datum" ${!this.isColumnVisibleForCustomer('col-end-datum') ? 'style="display:none;"' : ''} data-col="8">
                Content Deadline
                <div class="resize-handle resize-handle-col" data-col="8"></div>
              </th>
              <th class="col-header col-videoanzahl" ${!this.isColumnVisibleForCustomer('col-videoanzahl') ? 'style="display:none;"' : ''} data-col="9">
                Videos
                <div class="resize-handle resize-handle-col" data-col="9"></div>
              </th>
              <th class="col-header col-video-nr" ${!this.isColumnVisibleForCustomer('col-video-nr') ? 'style="display:none;"' : ''} data-col="10">
                Video-Nr
                <div class="resize-handle resize-handle-col" data-col="10"></div>
              </th>
              <th class="col-header col-vk-video" ${!this.isColumnVisibleForCustomer('col-vk-video') ? 'style="display:none;"' : ''} data-col="10b">
                Kosten
                <div class="resize-handle resize-handle-col" data-col="10b"></div>
              </th>
              <th class="col-header col-video-typ" ${!this.isColumnVisibleForCustomer('col-video-typ') ? 'style="display:none;"' : ''} data-col="10c">
                Typ
                <div class="resize-handle resize-handle-col" data-col="10c"></div>
              </th>
              <th class="col-header col-thema" ${!this.isColumnVisibleForCustomer('col-thema') ? 'style="display:none;"' : ''} data-col="11">
                Thema
                <div class="resize-handle resize-handle-col" data-col="11"></div>
              </th>
              <th class="col-header col-organic-paid" ${!this.isColumnVisibleForCustomer('col-organic-paid') ? 'style="display:none;"' : ''} data-col="12">
                Content/Art
                <div class="resize-handle resize-handle-col" data-col="12"></div>
              </th>
              <th class="col-header col-produkt" ${!this.isColumnVisibleForCustomer('col-produkt') ? 'style="display:none;"' : ''} data-col="13">
                Produkte
                <div class="resize-handle resize-handle-col" data-col="13"></div>
              </th>
              <th class="col-header col-lieferadresse" ${!this.isColumnVisibleForCustomer('col-lieferadresse') ? 'style="display:none;"' : ''} data-col="14">
                Lieferadresse
                <div class="resize-handle resize-handle-col" data-col="14"></div>
              </th>
              <th class="col-header col-paket-tracking" ${!this.isColumnVisibleForCustomer('col-paket-tracking') ? 'style="display:none;"' : ''} data-col="15">
                Tracking
                <div class="resize-handle resize-handle-col" data-col="15"></div>
              </th>
              <th class="col-header col-drehort" ${!this.isColumnVisibleForCustomer('col-drehort') ? 'style="display:none;"' : ''} data-col="16">
                Drehort
                <div class="resize-handle resize-handle-col" data-col="16"></div>
              </th>
              <th class="col-header col-link-skript" ${!this.isColumnVisibleForCustomer('col-link-skript') ? 'style="display:none;"' : ''} data-col="17">
                Link Skript / Briefing
                <div class="resize-handle resize-handle-col" data-col="17"></div>
              </th>
              <th class="col-header col-skript-freigegeben" ${!this.isColumnVisibleForCustomer('col-skript-freigegeben') ? 'style="display:none;"' : ''} data-col="18">
                Skript freigegeben
                <div class="resize-handle resize-handle-col" data-col="18"></div>
              </th>
              <th class="col-header col-link-content" ${!this.isColumnVisibleForCustomer('col-link-content') ? 'style="display:none;"' : ''} data-col="19">
                Content
                <div class="resize-handle resize-handle-col" data-col="19"></div>
              </th>
              <th class="col-header col-feedback-cj" ${!this.isColumnVisibleForCustomer('col-feedback-cj') ? 'style="display:none;"' : ''} data-col="20">
                Feedback CJ
                <div class="resize-handle resize-handle-col" data-col="20"></div>
              </th>
              <th class="col-header col-feedback-kunde" ${!this.isColumnVisibleForCustomer('col-feedback-kunde') ? 'style="display:none;"' : ''} data-col="21">
                Feedback Kunde
                <div class="resize-handle resize-handle-col" data-col="21"></div>
              </th>
              <th class="col-header col-freigabe" ${!this.isColumnVisibleForCustomer('col-freigabe') ? 'style="display:none;"' : ''} data-col="22">
                Freigabe
                <div class="resize-handle resize-handle-col" data-col="22"></div>
              </th>
              <th class="col-header col-caption" ${!this.isColumnVisibleForCustomer('col-caption') ? 'style="display:none;"' : ''} data-col="23">
                Caption
                <div class="resize-handle resize-handle-col" data-col="23"></div>
              </th>
              <th class="col-header col-posting-datum" ${!this.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''} data-col="24">
                Posting Datum
                <div class="resize-handle resize-handle-col" data-col="24"></div>
              </th>
              <th class="col-header col-actions" ${!this.isColumnVisibleForCustomer('col-actions') ? 'style="display:none;"' : ''} data-col="25">
                Aktionen
                <div class="resize-handle resize-handle-col" data-col="25"></div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere eine Kooperation mit ihren Videos (Videos als gestapelte Inputs)
  renderKooperationWithVideos(koop, rowNumber) {
    const videos = this.videos[koop.id] || [];
    const versand = this.versandInfos[koop.id] || null;
    const creator = koop.creator || {};
    const canViewViaPage = window.canViewPage?.('creator');
    const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
    const canViewCreator = !this.isKundeRole() && canViewViaPage !== false && canViewViaPerm !== false;
    
    const formatCurrency = (v) => v ? new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(v) : '-';
    
    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('de-DE') : '-';
    };

    // Lieferadresse formatieren
    const lieferadresse = creator.lieferadresse_strasse 
      ? `${creator.lieferadresse_strasse} ${creator.lieferadresse_hausnummer || ''}\n${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}`
      : '-';

    // Eine Zeile pro Kooperation - Videos als gestapelte Inputs in den Video-Spalten
    return `
      <tr class="kooperation-row" data-kooperation-id="${koop.id}">
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-nr') ? 'style="display:none;"' : ''}>${rowNumber}</td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-creator') ? 'style="display:none;"' : ''}>
          ${canViewCreator && creator.id
            ? `<a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" class="table-link">
            ${this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
          </a>`
            : this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
        </td>
        <!-- col-kosten entfernt -->
        <td class="grid-cell cell-centered" ${!this.isColumnVisibleForCustomer('col-vertrag') ? 'style="display:none;"' : ''}>
          <input 
            type="checkbox" 
            class="grid-checkbox" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="vertrag_unterschrieben"
            ${!this.isFieldEditableForUser('kooperation', 'vertrag_unterschrieben') ? 'disabled' : ''}
            ${koop.vertrag_unterschrieben ? 'checked' : ''}
          />
        </td>
        <td class="grid-cell" ${!this.isColumnVisibleForCustomer('col-nutzungsrechte') ? 'style="display:none;"' : ''}>
          <input 
            type="text" 
            class="grid-input" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="nutzungsrechte"
            ${!this.isFieldEditableForUser('kooperation', 'nutzungsrechte') ? 'readonly' : ''}
            value="${koop.nutzungsrechte || ''}"
            placeholder="Nutzungsrechte"
          />
        </td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-start-datum') ? 'style="display:none;"' : ''}>${formatDate(koop.created_at)}</td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-script-deadline') ? 'style="display:none;"' : ''}>${formatDate(koop.skript_deadline)}</td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-end-datum') ? 'style="display:none;"' : ''}>${formatDate(koop.content_deadline)}</td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-videoanzahl') ? 'style="display:none;"' : ''}>${koop.videoanzahl || 0}</td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-video-nr') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video, index, total) => {
            const videoNr = index + 1;
            return `<div class="video-nr-text">${videoNr}/${total}</div>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-vk-video') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const vk = video.verkaufspreis_netto != null ? parseFloat(video.verkaufspreis_netto) : null;
            return vk != null ? `<div class="video-vk-text">${vk.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>` : '<div class="video-vk-text">—</div>';
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-video-typ') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            return `<div class="video-typ-text">${this.escapeHtml(video.kampagnenart || '—')}</div>`;
          })}
        </td>
        <!-- Video-Spalten: Jedes Video als eigene Zeile über alle Spalten -->
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-thema') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            // Wenn Strategie-Item verknüpft: Thumbnail mit Link zur Strategie
            if (video.strategie_item && video.strategie_item.screenshot_url) {
              const strategieId = video.strategie_item.strategie_id;
              const screenshotUrl = video.strategie_item.screenshot_url;
              const beschreibung = video.strategie_item.beschreibung || 'Strategie-Idee';
              return `
                <a href="/strategie/${strategieId}" class="thema-thumbnail-link" title="${this.escapeHtml(beschreibung)}">
                  <img src="${screenshotUrl}" alt="Thema" class="thema-thumbnail" />
                </a>
              `;
            }
            // Sonst: Hinweistext (kein Input-Feld, da Strategie verknüpft werden soll)
            return `<span class="no-strategie-hint">Noch kein Thema/Strategie verknüpft</span>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-organic-paid') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <select class="grid-select stacked-video-select" 
              data-entity="video" data-id="${video.id}" data-field="content_art"
              ${!this.isFieldEditableForUser('video', 'content_art') ? 'disabled' : ''}>
              <option value="">– bitte wählen –</option>
              <option value="Paid" ${video.content_art === 'Paid' ? 'selected' : ''}>Paid</option>
              <option value="Organisch" ${video.content_art === 'Organisch' ? 'selected' : ''}>Organisch</option>
              <option value="Influencer" ${video.content_art === 'Influencer' ? 'selected' : ''}>Influencer</option>
              <option value="Videograph" ${video.content_art === 'Videograph' ? 'selected' : ''}>Videograph</option>
              <option value="Whitelisting" ${video.content_art === 'Whitelisting' ? 'selected' : ''}>Whitelisting</option>
              <option value="Spark-Ad" ${video.content_art === 'Spark-Ad' ? 'selected' : ''}>Spark-Ad</option>
            </select>
          `)}
        </td>
        <td class="grid-cell video-stack-cell col-produkt" ${!this.isColumnVisibleForCustomer('col-produkt') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = this.getVersandForVideo(video.id);
            return `
              <input type="text" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="produkt_name"
                ${!this.isFieldEditableForUser('versand', 'produkt_name') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.produkt_name || '')}" 
                placeholder="Produktname"/>
              <input type="url" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="produkt_link"
                ${!this.isFieldEditableForUser('versand', 'produkt_link') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.produkt_link || '')}" 
                placeholder="Produktlink (optional)"/>
            `;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-lieferadresse') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = this.getVersandForVideo(video.id);
            const adresse = versandForVideo ? 
              [versandForVideo.strasse, versandForVideo.hausnummer, versandForVideo.plz, versandForVideo.stadt]
                .filter(Boolean).join(', ') : '';
            return `<div class="small-text address-text">${this.escapeHtml(adresse || '-')}</div>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-paket-tracking') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = this.getVersandForVideo(video.id);
            return `
              <input type="text" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="tracking_nummer"
                ${!this.isFieldEditableForUser('versand', 'tracking_nummer') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.tracking_nummer || '')}" 
                placeholder="Tracking Nr."/>
            `;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-drehort') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="drehort"
              ${!this.isFieldEditableForUser('video', 'drehort') ? 'readonly' : ''}
              value="${this.escapeHtml(video.drehort || '')}" placeholder="Drehort"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-link-skript') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="link_skript"
              ${!this.isFieldEditableForUser('video', 'link_skript') ? 'readonly' : ''}
              value="${this.escapeHtml(video.link_skript || '')}" placeholder="Link"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell checkbox-stack" ${!this.isColumnVisibleForCustomer('col-skript-freigegeben') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox" 
                data-entity="video" data-id="${video.id}" data-field="skript_freigegeben"
                ${!this.isFieldEditableForUser('video', 'skript_freigegeben') ? 'disabled' : ''}
                ${video.skript_freigegeben ? 'checked' : ''}/>
            </div>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-link-content') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const videoUrl = video.file_url || video.link_content || video.asset_url;
            if (videoUrl) {
              return `<div class="content-cell-actions">
                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Video in neuem Tab öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
                <button type="button" class="video-reupload-btn video-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Neues Video hochladen">↑</button>
                <button type="button" class="video-delete-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="${video.currentAsset?.file_path || ''}" title="Video löschen">✕</button>
              </div>`;
            } else {
              return `<button type="button" class="video-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video hochladen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>
                Upload
              </button>`;
            }
          })}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!this.isColumnVisibleForCustomer('col-feedback-cj') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const comments = this.videoComments[video.id];
            const relevantComments = comments?.r1 || [];
            const value = relevantComments.length > 0 
              ? relevantComments.map(c => c.text).join('\n\n---\n\n')
              : '';
            return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="feedback_creatorjobs"
              ${!this.isFieldEditableForUser('video', 'feedback_creatorjobs') ? 'readonly' : ''}
              placeholder="Feedback Runde 1" rows="1">${this.escapeHtml(value)}</textarea>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!this.isColumnVisibleForCustomer('col-feedback-kunde') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const comments = this.videoComments[video.id];
            const relevantComments = comments?.r2 || [];
            const value = relevantComments.length > 0 
              ? relevantComments.map(c => c.text).join('\n\n---\n\n')
              : '';
            return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="feedback_ritzenhoff"
              placeholder="Feedback Runde 2" rows="1">${this.escapeHtml(value)}</textarea>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell checkbox-stack" ${!this.isColumnVisibleForCustomer('col-freigabe') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox" 
                data-entity="video" data-id="${video.id}" data-field="freigabe"
                ${video.freigabe ? 'checked' : ''}/>
            </div>
          `)}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!this.isColumnVisibleForCustomer('col-caption') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="caption"
              ${!this.isFieldEditableForUser('video', 'caption') ? 'readonly' : ''}
              placeholder="Caption" rows="1">${this.escapeHtml(video.caption || '')}</textarea>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="date" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="posting_datum"
              ${!this.isFieldEditableForUser('video', 'posting_datum') ? 'readonly' : ''}
              value="${video.posting_datum || ''}"
              placeholder="TT.MM.JJJJ"/>
          `)}
        </td>
        <td class="grid-cell col-actions" ${!this.isColumnVisibleForCustomer('col-actions') ? 'style="display:none;"' : ''}>
          <div class="actions-dropdown-container" data-entity-type="kooperation">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="edit" data-id="${koop.id}" data-return-to="/kampagne/${this.kampagneId}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                Bearbeiten
              </a>
              ${this.canDeleteKooperation() ? `
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${koop.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.327L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916A2.25 2.25 0 0 0 13.5 2.25h-3a2.25 2.25 0 0 0-2.25 2.25v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Löschen
                </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  // Generische Funktion zum Rendern von Video-Feldern mit einem Callback
  renderVideoFieldStack(videos, fieldRenderer) {
    if (!videos || videos.length === 0) {
      return '<span class="text-muted">-</span>';
    }
    
    const total = videos.length;
    // Wrapping-Container für einheitliche Höhe aller Felder in dieser Spalte
    // fieldRenderer kann jetzt auch (video, index, total) als Parameter erhalten
    return `<div class="video-fields-stack">${videos.map((video, index) => {
      const result = fieldRenderer(video, index, total);
      // Füge CSS-Klasse hinzu wenn Video freigegeben ist
      const approvedClass = video.freigabe ? 'video-field-wrapper--approved' : '';
      return `<div class="video-field-wrapper ${approvedClass}" data-video-id="${video.id}">${result}</div>`;
    }).join('')}</div>`;
  }

  // Hilfsfunktion
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Binde Event-Listener für Inline-Editing
  bindEvents() {
    const container = document.querySelector('.kooperation-video-grid');
    if (!container) return;

    // Text/Date/Textarea Inputs - Auto-Save bei blur
    container.addEventListener('blur', async (e) => {
      if (e.target.classList.contains('grid-input') || e.target.classList.contains('grid-textarea')) {
        await this.handleFieldUpdate(e.target);
      }
    }, true);

    // Checkboxes - Auto-Save bei change
    container.addEventListener('change', async (e) => {
      if (e.target.classList.contains('grid-checkbox') || e.target.classList.contains('grid-select')) {
        // Optimistisches UI-Update für Freigabe-Checkbox
        if (e.target.classList.contains('grid-checkbox') && e.target.dataset.field === 'freigabe') {
          const videoId = e.target.dataset.id;
          const isApproved = e.target.checked;
          
          // Sofort visuelles Feedback (optimistisch)
          this.toggleVideoRowApproval(videoId, isApproved);
        }
        
        await this.handleFieldUpdate(e.target);
      }
    });
    
    // Auto-resize Textareas
    this.initAutoResizeTextareas();

    // Video-Upload-Button Click
    container.addEventListener('click', (e) => {
      const uploadBtn = e.target.closest('.video-upload-btn');
      if (uploadBtn) {
        e.preventDefault();
        const videoId = uploadBtn.dataset.videoId;
        const koopId = uploadBtn.dataset.kooperationId;
        this._openUploadDrawer(videoId, koopId);
      }
    });

    // Video-Delete-Button Click
    container.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.video-delete-btn');
      if (deleteBtn) {
        e.preventDefault();
        this._handleVideoDelete(deleteBtn);
      }
    });

    // Spaltenbreite-Anpassung
    this.bindResizeEvents();
    
    // Drag-to-Scroll
    this.bindDragToScroll();
  }

  _openUploadDrawer(videoId, kooperationId) {
    const koop = this.kooperationen.find(k => k.id === kooperationId);
    const videos = this.videos[kooperationId] || [];
    const video = videos.find(v => v.id === videoId);

    const metadaten = {
      kooperationId,
      kooperationName: koop?.name || 'Kooperation',
      videoTitel: video?.thema || 'Video',
      unternehmen: this.kampagneInfo?.unternehmen || '',
      marke: this.kampagneInfo?.marke || '',
      kampagne: this.kampagneInfo?.name || ''
    };

    console.log('[Dropbox] kampagneInfo:', this.kampagneInfo);
    console.log('[Dropbox] koop.name:', koop?.name);
    console.log('[Dropbox] metadaten:', metadaten);

    this._uploadDrawer.open(videoId, metadaten, (fileUrl) => {
      this._updateContentCellAfterUpload(videoId, kooperationId, fileUrl);
    });
  }

  _updateContentCellAfterUpload(videoId, kooperationId, fileUrl) {
    const videos = this.videos[kooperationId];
    if (videos) {
      const v = videos.find(vid => vid.id === videoId);
      if (v) {
        v.file_url = fileUrl;
        v.link_content = fileUrl;
      }
    }
    this.refresh();
  }

  async _handleVideoDelete(btn) {
    const videoId = btn.dataset.videoId;
    const kooperationId = btn.dataset.kooperationId;
    const filePath = btn.dataset.filePath;

    if (!confirm('Video wirklich löschen? Die Datei wird aus Dropbox und der Datenbank entfernt.')) return;

    btn.disabled = true;
    btn.textContent = '…';

    try {
      // 1. Dropbox-Datei löschen (über Netlify Function)
      if (filePath) {
        const resp = await fetch('/.netlify/functions/dropbox-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `Dropbox delete failed (${resp.status})`);
        }
        console.log('✅ Dropbox-Datei gelöscht:', filePath);
      }

      // 2. Asset-Eintrag in Supabase löschen (is_current = true)
      const { error: assetErr } = await window.supabase
        .from('kooperation_video_asset')
        .delete()
        .eq('video_id', videoId)
        .eq('is_current', true);
      if (assetErr) console.warn('Asset-Delete fehlgeschlagen:', assetErr);

      // 3. file_url und link_content im Video auf null setzen
      const { error: videoErr } = await window.supabase
        .from('kooperation_videos')
        .update({ file_url: null, link_content: null })
        .eq('id', videoId);
      if (videoErr) throw videoErr;

      console.log('✅ Video-Eintrag bereinigt:', videoId);

      // 4. Lokalen State updaten + Tabelle neu rendern
      const videos = this.videos[kooperationId];
      if (videos) {
        const v = videos.find(vid => vid.id === videoId);
        if (v) {
          v.file_url = null;
          v.link_content = null;
          v.currentAsset = null;
        }
      }
      this.refresh();

    } catch (err) {
      console.error('Video-Delete fehlgeschlagen:', err);
      alert('Löschen fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
      btn.disabled = false;
      btn.textContent = '✕';
    }
  }

  // Auto-resize für Textareas initialisieren
  initAutoResizeTextareas() {
    // Feste Höhe wird über CSS geregelt (.video-field-wrapper)
    // Keine dynamische Höhenanpassung mehr nötig
  }

  // Delegiert an uiHelpers
  bindResizeEvents() { this.uiHelpers.bindResizeEvents(); }
  bindDragToScroll() { this.uiHelpers.bindDragToScroll(); }
  loadColumnWidths() { this.uiHelpers.loadColumnWidths(); }

  // Handle Field Update
  async handleFieldUpdate(field) {
    const entity = field.getAttribute('data-entity');
    const id = field.getAttribute('data-id');
    const fieldName = field.getAttribute('data-field');
    const kooperationId = field.getAttribute('data-kooperation-id');
    
    let value;
    if (field.type === 'checkbox') {
      value = field.checked;
    } else {
      value = field.value;
    }

    console.log(`💾 Update ${entity}.${fieldName}:`, { id, value });

    try {
      // Versand-Tabelle besonders behandeln (ggf. neue Zeile erstellen)
      if (entity === 'versand') {
        const videoId = field.getAttribute('data-video-id');
        
        if (id === 'new') {
          // Neue Versand-Info erstellen
          const { data, error } = await window.supabase
            .from('kooperation_versand')
            .insert({
              kooperation_id: kooperationId,
              video_id: videoId,
              [fieldName]: value
            })
            .select('id')
            .single();

          if (error) throw error;
          
          // ID in ALLEN Versand-Feldern dieses Videos aktualisieren
          const versandFields = document.querySelectorAll(
            `[data-entity="versand"][data-video-id="${videoId}"][data-id="new"]`
          );
          versandFields.forEach(f => f.setAttribute('data-id', data.id));
          
          // Speichere in lokaler Map für zukünftige Renders (nach video_id gruppiert)
          this.versandInfos[videoId] = { id: data.id, [fieldName]: value };
          
          console.log('✅ Versand-Info erstellt:', data.id);
        } else {
          // Bestehende Versand-Info aktualisieren
          const { error } = await window.supabase
            .from('kooperation_versand')
            .update({ 
              [fieldName]: value,
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          if (error) throw error;
          console.log('✅ Versand-Info aktualisiert');
        }
      } 
      // Feedback-Felder: Speichere als Kommentar in kooperation_video_comment
      else if (entity === 'video' && (fieldName === 'feedback_creatorjobs' || fieldName === 'feedback_ritzenhoff')) {
        const runde = fieldName === 'feedback_creatorjobs' ? 1 : 2;
        const videoId = id;
        
        // Lösche alte Kommentare dieser Runde für dieses Video (da wir den Text komplett ersetzen)
        const existingComments = this.videoComments[videoId]?.[runde === 1 ? 'r1' : 'r2'] || [];
        if (existingComments.length > 0) {
          const commentIds = existingComments.map(c => c.id);
          await window.supabase
            .from('kooperation_video_comment')
            .delete()
            .in('id', commentIds);
        }
        
        // Erstelle neuen Kommentar nur wenn Text vorhanden
        if (value && value.trim()) {
          // Hole aktuellen User
          const currentUser = window.currentUser;
          const authorName = currentUser?.name || 'Unbekannt';
          
          const { data, error } = await window.supabase
            .from('kooperation_video_comment')
            .insert({
              video_id: videoId,
              runde: runde,
              text: value.trim(),
              author_benutzer_id: currentUser?.id || null,
              author_name: authorName,
              is_public: true
            })
            .select('id, video_id, text, runde, author_name, created_at')
            .single();

          if (error) throw error;
          
          // Aktualisiere lokale Kommentar-Map
          if (!this.videoComments[videoId]) {
            this.videoComments[videoId] = { r1: [], r2: [] };
          }
          if (runde === 1) {
            this.videoComments[videoId].r1 = [data];
          } else {
            this.videoComments[videoId].r2 = [data];
          }
          
          console.log(`✅ Feedback Runde ${runde} gespeichert als Kommentar von ${authorName}`);
        } else {
          // Wenn Text leer, dann nur löschen (bereits oben gemacht)
          if (!this.videoComments[videoId]) {
            this.videoComments[videoId] = { r1: [], r2: [] };
          }
          if (runde === 1) {
            this.videoComments[videoId].r1 = [];
          } else {
            this.videoComments[videoId].r2 = [];
          }
          console.log(`✅ Feedback Runde ${runde} gelöscht`);
        }
      } 
      else {
        // Kooperation oder Video aktualisieren (für andere Felder)
        const tableName = entity === 'kooperation' ? 'kooperationen' : 'kooperation_videos';
        
        const { error } = await window.supabase
          .from(tableName)
          .update({ 
            [fieldName]: value,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        console.log(`✅ ${entity} aktualisiert`);
      }

      // Markiere als eigenes Update (für Realtime-Deduplizierung)
      this._lastUpdateBy = window.currentUser?.id;
      this._lastUpdateTime = Date.now();

      // Visuelles Feedback
      field.classList.add('save-success');
      setTimeout(() => field.classList.remove('save-success'), 1000);

    } catch (error) {
      console.error(`❌ Fehler beim Speichern von ${entity}.${fieldName}:`, error);
      field.classList.add('save-error');
      setTimeout(() => field.classList.remove('save-error'), 2000);
      
      window.ErrorHandler.handle(error, 'KampagneKooperationenVideoTable.handleFieldUpdate');
    }
  }

  // Initialisiere und rendere die Tabelle
  async init(containerId) {
    // Verhindere nur paralleles Init für den GLEICHEN Container
    if (this._isLoading && this.containerId === containerId) {
      console.log('⚠️ Init bereits in Arbeit für diesen Container, überspringe...');
      return;
    }

    // Bei wiederholtem Init für den gleichen Container: nur refresh
    if (this._dataLoaded && this.containerId === containerId) {
      console.log('⚠️ Tabelle bereits initialisiert für diesen Container, refreshe stattdessen...');
      await this.refresh();
      return;
    }

    // Bei neuem Container: Reset der Flags (z.B. Kampagnenwechsel)
    if (this.containerId !== containerId) {
      console.log('🔄 Neuer Container erkannt, reset Loading-State');
      this._isLoading = false;
      this._dataLoaded = false;
    }

    this.containerId = containerId; // Für refresh() Methode speichern
    console.log('🎬 KampagneKooperationenVideoTable.init() - Container ID:', containerId);
    let container = document.getElementById(containerId);
    console.log('🎬 Container gefunden:', !!container, container);
    
    if (container) {
      // Prüfe Sichtbarkeit des Containers
      const styles = window.getComputedStyle(container);
      console.log('🎬 Container computed styles:', {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        width: styles.width,
        height: styles.height
      });
      
      // Prüfe Parent-Element
      const parent = container.parentElement;
      if (parent) {
        const parentStyles = window.getComputedStyle(parent);
        console.log('🎬 Parent (.detail-section) computed styles:', {
          display: parentStyles.display,
          visibility: parentStyles.visibility,
          className: parent.className
        });
        
        // Prüfe Grandparent (tab-pane)
        const grandparent = parent.parentElement;
        if (grandparent) {
          const grandparentStyles = window.getComputedStyle(grandparent);
          console.log('🎬 Grandparent (tab-pane) computed styles:', {
            id: grandparent.id,
            display: grandparentStyles.display,
            visibility: grandparentStyles.visibility,
            hasActiveClass: grandparent.classList.contains('active')
          });
        }
      }
    }
    
    // Skeleton Loading anzeigen (statt Spinner)
    if (container) {
      container.innerHTML = this.renderSkeletonLoading();
    } else {
      console.error('❌ Container nicht gefunden:', containerId);
      return;
    }
    
    // Lade Spalten-Sichtbarkeit, Filter-State UND Daten parallel
    await Promise.all([
      this.loadData(),
      this.loadColumnVisibilitySettings(),
      this.loadApprovedFilterState()
    ]);
    
    console.log('🎬 Daten geladen, rendere Tabelle...');
    const html = this.render();
    console.log('🎬 HTML generiert, Länge:', html.length);
    console.log('🎬 HTML Preview (erste 500 Zeichen):', html.substring(0, 500));
    
    // Container nochmal per ID holen (DOM-Referenz könnte veraltet sein nach async)
    const currentContainer = document.getElementById(containerId);
    if (currentContainer) {
      currentContainer.innerHTML = html;
      // Update container-Referenz für nachfolgende Operationen
      container = currentContainer;
      console.log('🎬 HTML in Container gesetzt');
      console.log('🎬 Container hat jetzt innerHTML mit Länge:', container.innerHTML.length);
      console.log('🎬 Container children count:', container.children.length);
      
      // Prüfe nochmal Sichtbarkeit NACH dem Setzen
      const stylesAfter = window.getComputedStyle(container);
      console.log('🎬 Container styles NACH Setzen:', {
        display: stylesAfter.display,
        visibility: stylesAfter.visibility,
        width: stylesAfter.width,
        height: stylesAfter.height
      });
      
      // Prüfe ob tab-pane noch active ist
      const tabPane = container.closest('.tab-pane');
      if (tabPane) {
        const tabPaneStyles = window.getComputedStyle(tabPane);
        console.log('🎬 Tab-Pane FINAL check:', {
          id: tabPane.id,
          hasActiveClass: tabPane.classList.contains('active'),
          display: tabPaneStyles.display,
          classList: Array.from(tabPane.classList)
        });
      }
      
      this.bindEvents();
      console.log('🎬 Events gebunden');
      
      // Event-Listener für Spalten-Sichtbarkeits-Änderungen
      if (!this._visibilityEventBound) {
        window.addEventListener('video-column-visibility-changed', (e) => {
          if (e.detail.kampagneId === this.kampagneId) {
            this.hiddenColumns = e.detail.hiddenColumns;
            // Für alle Rollen direkt neu rendern
            this.refresh();
          }
        });
        this._visibilityEventBound = true;
      }

      // Fallback: Sofortiges UI-Update nach erfolgreicher Löschung aus ActionsDropdown
      if (!this._entityUpdatedHandler) {
        this._entityUpdatedHandler = async (e) => {
          const detail = e.detail || {};
          if (detail.entity === 'kooperation' && detail.action === 'deleted' && detail.id) {
            await this.handleKooperationDeletedById(detail.id, 'entityUpdated');
          }
        };
        window.addEventListener('entityUpdated', this._entityUpdatedHandler);
      }
      
      // Floating Scrollbar initialisieren
      this.initFloatingScrollbar();
      console.log('🎬 Floating Scrollbar initialisiert');
      
      // Starte Realtime-Subscription für Live-Updates
      this.initRealtimeSubscription();
      console.log('🎬 Realtime-Subscription initialisiert');
      
      // Gespeicherte Spaltenbreiten wiederherstellen
      this.loadColumnWidths();
    } else {
      console.error('❌ Container nicht mehr im DOM nach async Laden:', containerId);
    }
  }

  initFloatingScrollbar() { this.uiHelpers.initFloatingScrollbar(); }

  // Initialisiere Realtime-Subscription für Live-Updates
  // Delegiert an realtimeHandler
  initRealtimeSubscription() { this.realtimeHandler.initRealtimeSubscription(); }
  cleanupRealtimeSubscription() { this.realtimeHandler.cleanup(); }
  toggleVideoRowApproval(videoId, isApproved) { this.realtimeHandler.toggleVideoRowApproval(videoId, isApproved); }
  async handleKooperationDeletedById(id, source) { await this.realtimeHandler.handleKooperationDeletedById(id, source); }

  // Refresh-Methode: Lädt Daten neu und rendert Tabelle ohne Seitenneuladung
  async refresh() {
    console.log('🔄 KampagneKooperationenVideoTable.refresh() - Lade Daten neu und rendere Tabelle');
    
    // Container finden
    const container = this.containerId ? document.getElementById(this.containerId) : null;
    if (!container) {
      console.error('❌ Container nicht gefunden für refresh, containerId:', this.containerId);
      return;
    }
    
    this._dataLoaded = false;
    await this.loadData();
    
    // Tabelle neu rendern
    const html = this.render();
    container.innerHTML = html;
    
    // Events neu binden
    this.bindEvents();
    
    // Floating Scrollbar neu initialisieren
    this.initFloatingScrollbar();
    
    // Gespeicherte Spaltenbreiten wiederherstellen
    this.loadColumnWidths();
    
    console.log('✅ Tabelle erfolgreich refreshed');
  }

  // Cleanup-Methode für Modul-Wechsel
  destroy() {
    console.log('🗑️ KOOPERATIONENVIDEOTABLE: Cleanup aufgerufen');
    
    // Cleanup Drag-to-Scroll
    if (this.dragScrollContainer) {
      this.dragScrollContainer.style.cursor = '';
      this.isDragging = false;
      this.dragScrollContainer = null;
    }
    
    // Cleanup der Floating-Scrollbar (Event-Listener entfernen)
    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }
    
    // Cleanup Realtime-Subscription
    this.cleanupRealtimeSubscription();

    // Cleanup entityUpdated-Fallback-Listener
    if (this._entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    
    // Floating-Scrollbar aus DOM entfernen
    const floatingScrollbar = document.getElementById('floating-scrollbar-kampagne');
    if (floatingScrollbar && floatingScrollbar.parentNode) {
      floatingScrollbar.parentNode.removeChild(floatingScrollbar);
      console.log('✅ KOOPERATIONENVIDEOTABLE: Floating-Scrollbar aus DOM entfernt');
    }
    
    console.log('✅ KOOPERATIONENVIDEOTABLE: Cleanup abgeschlossen');
  }
}

// Export für direkten Gebrauch
export async function renderKooperationenVideoTable(kampagneId, containerId) {
  const table = new KampagneKooperationenVideoTable(kampagneId);
  await table.init(containerId);
  return table;
}
























