// KampagneKooperationenVideoTable.js (ES6-Modul)
// Kombinierte Kooperations-Video-Tabelle für Kampagnendetails
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';

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
    this.storageKey = `kampagne_koops_videos_column_widths_v2_${kampagneId}`;
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
  }

  // Prüfe ob ein Feld für den aktuellen Benutzer editierbar ist
  isFieldEditableForUser(entity, field) {
    const userRole = window.currentUser?.rolle;
    
    // Admins und Mitarbeiter können alles bearbeiten
    if (userRole === 'admin' || userRole === 'mitarbeiter') {
      return true;
    }
    
    // Kunden dürfen folgende Felder NICHT bearbeiten:
    if (userRole === 'kunde') {
      const readOnlyFieldsForKunden = {
        'kooperation': ['vertrag_unterschrieben', 'typ'],
        'versand': ['versendet', 'tracking_nummer'],
        'video': ['thema', 'link_produkte', 'link_skript', 'skript_freigegeben']
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
  _startPerformanceTracking(stageName) {
    const timestamp = performance.now();
    this.performanceMetrics.stages[stageName] = {
      start: timestamp,
      end: null,
      duration: null,
      status: 'running'
    };
    return timestamp;
  }

  // Performance-Tracking für eine Stage beenden
  _endPerformanceTracking(stageName, success = true, error = null) {
    const timestamp = performance.now();
    const stage = this.performanceMetrics.stages[stageName];
    if (stage) {
      stage.end = timestamp;
      stage.duration = timestamp - stage.start;
      stage.status = success ? 'success' : 'failed';
      if (error) {
        stage.error = error;
        this.performanceMetrics.errors.push({ stage: stageName, error });
      }
    }
    return timestamp;
  }

  // Vorherige Performance-Daten abrufen
  _getPreviousPerformance() {
    try {
      const key = `perf_koops_videos_${this.kampagneId}`;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      return history.length > 0 ? history[history.length - 1] : null;
    } catch (e) {
      return null;
    }
  }

  // Speichere Metriken für Verlaufs-Analyse
  _savePerformanceMetrics(totalTime) {
    try {
      const key = `perf_koops_videos_${this.kampagneId}`;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      
      history.push({
        timestamp: new Date().toISOString(),
        totalTime,
        stages: this.performanceMetrics.stages,
        errorCount: this.performanceMetrics.errors.length,
        dataSize: {
          kooperationen: this.kooperationen.length,
          videos: Object.values(this.videos).flat().length,
          creators: this.creators.size
        }
      });
      
      // Nur letzte 20 Messungen behalten
      if (history.length > 20) history.shift();
      
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      // localStorage voll oder deaktiviert
    }
  }

  // Detailliertes Performance-Log ausgeben
  _logPerformanceSummary() {
    const totalTime = performance.now() - this.performanceMetrics.startTime;
    
    console.group(
      `%c⚡ Performance-Report: Kooperationen-Video-Tabelle (${totalTime.toFixed(0)}ms)`,
      'background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    );
    
    // Stages sortiert nach Dauer
    const stageEntries = Object.entries(this.performanceMetrics.stages)
      .sort((a, b) => (b[1].duration || 0) - (a[1].duration || 0));
    
    stageEntries.forEach(([name, metrics]) => {
      const icon = metrics.status === 'success' ? '✅' : 
                   metrics.status === 'failed' ? '❌' : '⏳';
      const percent = ((metrics.duration / totalTime) * 100).toFixed(1);
      const color = metrics.status === 'failed' ? '#ef4444' : 
                    metrics.duration > 1000 ? '#f59e0b' : '#10b981';
      
      console.log(
        `${icon} %c${name}%c ${metrics.duration?.toFixed(0)}ms %c(${percent}%)`,
        `color: ${color}; font-weight: bold;`,
        'color: inherit;',
        'color: #6b7280; font-size: 0.9em;'
      );
      
      if (metrics.error) {
        console.error('  └─ Error:', metrics.error);
      }
    });
    
    // Fehler-Zusammenfassung
    if (this.performanceMetrics.errors.length > 0) {
      console.group('%c⚠️ Fehler-Details', 'color: #ef4444; font-weight: bold;');
      this.performanceMetrics.errors.forEach(({ stage, error }) => {
        console.error(`${stage}:`, error);
      });
      console.groupEnd();
    }
    
    // Daten-Zusammenfassung
    console.group('%c📊 Geladene Daten', 'color: #6366f1; font-weight: bold;');
    console.log('Kooperationen:', this.kooperationen.length);
    console.log('Videos:', Object.values(this.videos).flat().length);
    console.log('Creators:', this.creators.size);
    console.log('Comments:', Object.keys(this.videoComments).length);
    console.log('Versand-Infos:', Object.keys(this.versandInfos).length);
    console.groupEnd();
    
    // Performance-Vergleich mit letztem Load
    const previousLoad = this._getPreviousPerformance();
    if (previousLoad) {
      const diff = totalTime - previousLoad.totalTime;
      const diffPercent = ((diff / previousLoad.totalTime) * 100).toFixed(1);
      const icon = diff > 0 ? '🔴' : '🟢';
      console.log(
        `${icon} Vergleich zu letztem Load: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}ms (${diffPercent}%)`
      );
    }
    
    // Speichern für nächsten Vergleich
    this._savePerformanceMetrics(totalTime);
    
    console.groupEnd();
  }

  // UI-Loading-Indicator aktualisieren
  _updateLoadingProgress(message, percent) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    let progressBar = container.querySelector('.koops-videos-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'koops-videos-progress';
      progressBar.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
        transition: width 0.3s ease;
        z-index: 100;
      `;
      container.style.position = 'relative';
      container.appendChild(progressBar);
    }
    
    progressBar.style.width = `${percent}%`;
    
    // Message-Overlay
    let messageEl = container.querySelector('.koops-videos-loading-msg');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'koops-videos-loading-msg';
      messageEl.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 101;
        font-size: 14px;
        color: #374151;
      `;
      container.appendChild(messageEl);
    }
    
    messageEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div>
          <div style="font-weight: 600;">${message}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${percent}%</div>
        </div>
      </div>
    `;
  }

  // Loading-Indicator entfernen
  _removeLoadingProgress() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    container.querySelector('.koops-videos-progress')?.remove();
    container.querySelector('.koops-videos-loading-msg')?.remove();
  }

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
      // ========================================
      this._startPerformanceTracking('Query: kooperationen');
      
      const kooperationenResult = await window.supabase
        .from('kooperationen')
        .select(`
          id, name, status, einkaufspreis_netto, einkaufspreis_gesamt, content_art,
          posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ,
          videoanzahl, skript_deadline, content_deadline, created_at, creator_id,
          kampagne:kampagne_id (id, kampagnenname)
        `)
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });

      this._endPerformanceTracking('Query: kooperationen', !kooperationenResult.error, kooperationenResult.error);

      if (kooperationenResult.error) throw kooperationenResult.error;
      
      this.kooperationen = kooperationenResult.data || [];
      
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
          .select('id, kooperation_id, position, asset_url, content_art, caption, feedback_creatorjobs, feedback_ritzenhoff, freigabe, link_content, link_produkte, thema, link_skript, skript_freigegeben, drehort, posting_datum, strategie_item_id, strategie_item:strategie_item_id(id, screenshot_url, beschreibung, strategie_id)')
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
              .select('id, video_id, file_url, is_current')
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

        // Warnungen bei Fehlern
        if (assetsResult.status === 'rejected') {
          console.warn('⚠️ Assets konnten nicht geladen werden:', assetsResult.reason);
        }
        if (commentsResult.status === 'rejected') {
          console.warn('⚠️ Comments konnten nicht geladen werden:', commentsResult.reason);
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

  // Prüfe ob eine Spalte für Kunden sichtbar ist
  isColumnVisibleForCustomer(columnClass) {
    const userRole = window.currentUser?.rolle;
    
    // Admin/Mitarbeiter sehen immer alles
    if (userRole === 'admin' || userRole === 'mitarbeiter') {
      return true;
    }
    
    // Nr und Creator sind IMMER sichtbar für alle (essentiell)
    if (columnClass === 'col-nr' || columnClass === 'col-creator') {
      return true;
    }
    
    // Kunden sehen nur nicht-versteckte Spalten
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
      return `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Erstelle eine Kooperation, um sie hier mit Videos zu verwalten.</p>
          <button class="primary-btn" onclick="window.navigateTo('/kooperation/new?kampagne_id=${this.kampagneId}')">
            Kooperation anlegen
          </button>
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
              <th class="col-header col-typ" ${!this.isColumnVisibleForCustomer('col-typ') ? 'style="display:none;"' : ''} data-col="2">
                Typ
                <div class="resize-handle resize-handle-col" data-col="2"></div>
              </th>
              <th class="col-header col-vertrag" ${!this.isColumnVisibleForCustomer('col-vertrag') ? 'style="display:none;"' : ''} data-col="3">
                Vertrag
                <div class="resize-handle resize-handle-col" data-col="3"></div>
              </th>
              <th class="col-header col-nutzungsrechte" ${!this.isColumnVisibleForCustomer('col-nutzungsrechte') ? 'style="display:none;"' : ''} data-col="4">
                Nutzungsrechte
                <div class="resize-handle resize-handle-col" data-col="4"></div>
              </th>
              <th class="col-header col-start-datum" ${!this.isColumnVisibleForCustomer('col-start-datum') ? 'style="display:none;"' : ''} data-col="5">
                Erstellt
                <div class="resize-handle resize-handle-col" data-col="5"></div>
              </th>
              <th class="col-header col-script-deadline" ${!this.isColumnVisibleForCustomer('col-script-deadline') ? 'style="display:none;"' : ''} data-col="6">
                Script Deadline
                <div class="resize-handle resize-handle-col" data-col="6"></div>
              </th>
              <th class="col-header col-end-datum" ${!this.isColumnVisibleForCustomer('col-end-datum') ? 'style="display:none;"' : ''} data-col="7">
                Content Deadline
                <div class="resize-handle resize-handle-col" data-col="7"></div>
              </th>
              <th class="col-header col-videoanzahl" ${!this.isColumnVisibleForCustomer('col-videoanzahl') ? 'style="display:none;"' : ''} data-col="8">
                Videos
                <div class="resize-handle resize-handle-col" data-col="8"></div>
              </th>
              <th class="col-header col-video-nr" ${!this.isColumnVisibleForCustomer('col-video-nr') ? 'style="display:none;"' : ''} data-col="9">
                Video-Nr
                <div class="resize-handle resize-handle-col" data-col="9"></div>
              </th>
              <th class="col-header col-thema" ${!this.isColumnVisibleForCustomer('col-thema') ? 'style="display:none;"' : ''} data-col="10">
                Thema
                <div class="resize-handle resize-handle-col" data-col="10"></div>
              </th>
              <th class="col-header col-organic-paid" ${!this.isColumnVisibleForCustomer('col-organic-paid') ? 'style="display:none;"' : ''} data-col="11">
                Content/Art
                <div class="resize-handle resize-handle-col" data-col="11"></div>
              </th>
              <th class="col-header col-produkt" ${!this.isColumnVisibleForCustomer('col-produkt') ? 'style="display:none;"' : ''} data-col="12">
                Produkte
                <div class="resize-handle resize-handle-col" data-col="12"></div>
              </th>
              <th class="col-header col-lieferadresse" ${!this.isColumnVisibleForCustomer('col-lieferadresse') ? 'style="display:none;"' : ''} data-col="13">
                Lieferadresse
                <div class="resize-handle resize-handle-col" data-col="13"></div>
              </th>
              <th class="col-header col-paket-tracking" ${!this.isColumnVisibleForCustomer('col-paket-tracking') ? 'style="display:none;"' : ''} data-col="14">
                Tracking
                <div class="resize-handle resize-handle-col" data-col="14"></div>
              </th>
              <th class="col-header col-drehort" ${!this.isColumnVisibleForCustomer('col-drehort') ? 'style="display:none;"' : ''} data-col="15">
                Drehort
                <div class="resize-handle resize-handle-col" data-col="15"></div>
              </th>
              <th class="col-header col-link-skript" ${!this.isColumnVisibleForCustomer('col-link-skript') ? 'style="display:none;"' : ''} data-col="16">
                Link Skript / Briefing
                <div class="resize-handle resize-handle-col" data-col="16"></div>
              </th>
              <th class="col-header col-skript-freigegeben" ${!this.isColumnVisibleForCustomer('col-skript-freigegeben') ? 'style="display:none;"' : ''} data-col="17">
                Skript freigegeben
                <div class="resize-handle resize-handle-col" data-col="17"></div>
              </th>
              <th class="col-header col-link-content" ${!this.isColumnVisibleForCustomer('col-link-content') ? 'style="display:none;"' : ''} data-col="18">
                Link Content
                <div class="resize-handle resize-handle-col" data-col="18"></div>
              </th>
              <th class="col-header col-feedback-cj" ${!this.isColumnVisibleForCustomer('col-feedback-cj') ? 'style="display:none;"' : ''} data-col="19">
                Feedback CJ
                <div class="resize-handle resize-handle-col" data-col="19"></div>
              </th>
              <th class="col-header col-feedback-kunde" ${!this.isColumnVisibleForCustomer('col-feedback-kunde') ? 'style="display:none;"' : ''} data-col="20">
                Feedback Kunde
                <div class="resize-handle resize-handle-col" data-col="20"></div>
              </th>
              <th class="col-header col-freigabe" ${!this.isColumnVisibleForCustomer('col-freigabe') ? 'style="display:none;"' : ''} data-col="21">
                Freigabe
                <div class="resize-handle resize-handle-col" data-col="21"></div>
              </th>
              <th class="col-header col-caption" ${!this.isColumnVisibleForCustomer('col-caption') ? 'style="display:none;"' : ''} data-col="22">
                Caption
                <div class="resize-handle resize-handle-col" data-col="22"></div>
              </th>
              <th class="col-header col-posting-datum" ${!this.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''} data-col="23">
                Posting Datum
                <div class="resize-handle resize-handle-col" data-col="23"></div>
              </th>
              <th class="col-header col-kosten" ${!this.isColumnVisibleForCustomer('col-kosten') ? 'style="display:none;"' : ''} data-col="24">
                Kosten
                <div class="resize-handle resize-handle-col" data-col="24"></div>
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
          <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" class="table-link">
            ${this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
          </a>
        </td>
        <td class="grid-cell" ${!this.isColumnVisibleForCustomer('col-typ') ? 'style="display:none;"' : ''}>
          <select 
            class="grid-select" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="typ"
            ${!this.isFieldEditableForUser('kooperation', 'typ') ? 'disabled' : ''}
          >
            <option value="">-- Bitte wählen --</option>
            <option value="UGC" ${koop.typ === 'UGC' ? 'selected' : ''}>UGC</option>
            <option value="IGC" ${koop.typ === 'IGC' ? 'selected' : ''}>IGC</option>
            <option value="Influencer" ${koop.typ === 'Influencer' ? 'selected' : ''}>Influencer</option>
            <option value="Videograph" ${koop.typ === 'Videograph' ? 'selected' : ''}>Videograph</option>
            <option value="Fotograph" ${koop.typ === 'Fotograph' ? 'selected' : ''}>Fotograph</option>
          </select>
        </td>
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
              data-entity="video" data-id="${video.id}" data-field="content_art">
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
                value="${this.escapeHtml(versandForVideo?.produkt_name || '')}" 
                placeholder="Produktname"/>
              <input type="url" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="produkt_link"
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
              return `
                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Link in neuem Tab öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              `;
            } else {
              return `<input type="text" class="grid-input stacked-video-input" 
                data-entity="video" data-id="${video.id}" data-field="link_content"
                ${!this.isFieldEditableForUser('video', 'link_content') ? 'readonly' : ''}
                value="" placeholder="Link"/>`;
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
              placeholder="Caption" rows="1">${this.escapeHtml(video.caption || '')}</textarea>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!this.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="date" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="posting_datum"
              value="${video.posting_datum || ''}"
              placeholder="TT.MM.JJJJ"/>
          `)}
        </td>
        <td class="grid-cell read-only" ${!this.isColumnVisibleForCustomer('col-kosten') ? 'style="display:none;"' : ''}>${formatCurrency(koop.einkaufspreis_gesamt)}</td>
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

    // Spaltenbreite-Anpassung
    this.bindResizeEvents();
    
    // Drag-to-Scroll
    this.bindDragToScroll();
  }
  
  // Auto-resize für Textareas initialisieren
  initAutoResizeTextareas() {
    // Feste Höhe wird über CSS geregelt (.video-field-wrapper)
    // Keine dynamische Höhenanpassung mehr nötig
  }

  // Resize-Events für Spaltenbreite
  bindResizeEvents() {
    const container = document.querySelector('.grid-wrapper');
    if (!container) return;

    // Mousedown auf Resize-Handles
    container.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.resize-handle-col');
      if (handle) {
        this.startResize(parseInt(handle.dataset.col), e.pageX);
        e.preventDefault();
      }
    });

    // Mousemove
    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;

      const delta = e.pageX - this.resizeStartX;
      const newWidth = Math.max(50, this.resizeStartWidth + delta);

      this.setColumnWidth(this.resizeCol, newWidth);
    });

    // Mouseup
    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.endResize();
      }
    });
  }

  startResize(col, pageX) {
    this.isResizing = true;
    this.resizeCol = col;
    this.resizeStartX = pageX;
    
    // Aktuelle Breite ermitteln
    const header = document.querySelector(`.col-header .resize-handle-col[data-col="${col}"]`)?.closest('.col-header');
    this.resizeStartWidth = header ? header.offsetWidth : 120;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  setColumnWidth(col, width) {
    this.columnWidths.set(col, width);

    // Update Header
    const headers = document.querySelectorAll(`th.col-header:nth-child(${col + 1})`);
    headers.forEach(header => {
      header.style.width = `${width}px`;
      header.style.minWidth = `${width}px`;
    });

    // Update alle Zellen in dieser Spalte
    const cells = document.querySelectorAll(`.kooperation-video-grid tbody td:nth-child(${col + 1})`);
    cells.forEach(cell => {
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
    });
    
    // Wenn Spalte 0 (Nr) resized wird, aktualisiere die left-Position von Spalte 1 (Creator)
    if (col === 0) {
      const col2Headers = document.querySelectorAll('.kooperation-video-grid thead th:nth-child(2)');
      const col2Cells = document.querySelectorAll('.kooperation-video-grid tbody td:nth-child(2)');
      
      col2Headers.forEach(header => {
        header.style.left = `${width}px`;
      });
      
      col2Cells.forEach(cell => {
        cell.style.left = `${width}px`;
      });
    }
  }

  endResize() {
    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Spaltenbreiten im localStorage speichern
    this.saveColumnWidths();
  }
  
  // Drag-to-Scroll für horizontales Scrollen der Tabelle
  bindDragToScroll() {
    const container = document.querySelector('.grid-wrapper');
    if (!container) return;
    
    this.dragScrollContainer = container;
    
    // Mousedown - Prüfe ob auf nicht-editierbarem Bereich
    container.addEventListener('mousedown', (e) => {
      // Ignoriere wenn auf Input, Textarea, Select, Button oder Resize-Handle geklickt wird
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('resize-handle-col') ||
        e.target.closest('.resize-handle-col') ||
        this.isResizing
      ) {
        return;
      }
      
      // Prüfe ob auf Link geklickt wurde
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        return;
      }
      
      this.isDragging = true;
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;
      
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      
      e.preventDefault();
    });
    
    // Mousemove - Scrolle wenn dragging aktiv ist
    container.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      e.preventDefault();
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5; // Multiplikator für Scroll-Geschwindigkeit
      container.scrollLeft = this.scrollLeft - walk;
    });
    
    // Mouseup - Beende Dragging
    const stopDragging = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    
    container.addEventListener('mouseup', stopDragging);
    container.addEventListener('mouseleave', stopDragging);
    
    // Setze initialen Cursor
    container.style.cursor = 'grab';
  }
  
  // Spaltenbreiten im localStorage speichern
  saveColumnWidths() {
    try {
      const widthsObj = {};
      this.columnWidths.forEach((width, col) => {
        widthsObj[col] = width;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(widthsObj));
      console.log('💾 Spaltenbreiten gespeichert:', widthsObj);
    } catch (error) {
      console.warn('⚠️ Konnte Spaltenbreiten nicht speichern:', error);
    }
  }
  
  // Gespeicherte Spaltenbreiten laden
  loadColumnWidths() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const widthsObj = JSON.parse(saved);
        Object.entries(widthsObj).forEach(([col, width]) => {
          this.setColumnWidth(parseInt(col), width);
        });
        console.log('✅ Spaltenbreiten geladen:', widthsObj);
      }
    } catch (error) {
      console.warn('⚠️ Konnte Spaltenbreiten nicht laden:', error);
    }
  }

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
      
      // Event-Listener für Spalten-Sichtbarkeits-Änderungen (nur für Kunden refreshen)
      if (!this._visibilityEventBound) {
        window.addEventListener('video-column-visibility-changed', (e) => {
          if (e.detail.kampagneId === this.kampagneId) {
            this.hiddenColumns = e.detail.hiddenColumns;
            // Nur refreshen wenn der User ein Kunde ist
            if (window.currentUser?.rolle === 'kunde') {
              this.refresh();
            }
          }
        });
        this._visibilityEventBound = true;
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

  // Floating Scrollbar initialisieren (klebt am unteren Bildschirmrand, nur für diese Tabelle)
  initFloatingScrollbar() {
    // Prüfe ob Floating-Scrollbar bereits existiert
    let floatingScrollbar = document.getElementById('floating-scrollbar-kampagne');
    if (!floatingScrollbar) {
      // Erstelle Floating-Scrollbar Container
      floatingScrollbar = document.createElement('div');
      floatingScrollbar.id = 'floating-scrollbar-kampagne';
      floatingScrollbar.className = 'floating-scrollbar-kampagne';
      
      // Inner div für die Breite (muss breiter sein als viewport für Scrollbar)
      const inner = document.createElement('div');
      inner.className = 'floating-scrollbar-inner';
      floatingScrollbar.appendChild(inner);
      
      document.body.appendChild(floatingScrollbar);
    }
    
    // Finde die echte Tabelle und main-wrapper
    const gridWrapper = document.querySelector('.grid-wrapper');
    const table = document.querySelector('.kooperation-video-grid');
    const mainWrapper = document.querySelector('.main-wrapper');
    
    if (!gridWrapper || !table || !mainWrapper) return;
    
    // Setze die Breite des Inner-Divs auf die Tabellenbreite
    const inner = floatingScrollbar.querySelector('.floating-scrollbar-inner');
    const updateScrollbarWidth = () => {
      inner.style.width = table.scrollWidth + 'px';
    };
    
    // Positioniere die Scrollbar basierend auf grid-wrapper (nicht main-wrapper)
    const updateScrollbarPosition = () => {
      const wrapperRect = gridWrapper.getBoundingClientRect();
      floatingScrollbar.style.left = wrapperRect.left + 'px';
      floatingScrollbar.style.width = wrapperRect.width + 'px';
    };
    
    // Initial setzen
    updateScrollbarWidth();
    updateScrollbarPosition();
    
    // Bei Resize aktualisieren
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidth();
      updateScrollbarPosition();
    });
    resizeObserver.observe(table);
    resizeObserver.observe(mainWrapper);
    
    // Synchronisiere Scrolling zwischen Floating-Scrollbar und Tabelle
    let isSyncingFromFloating = false;
    let isSyncingFromTable = false;
    
    // Floating -> Table
    const handleFloatingScroll = () => {
      if (isSyncingFromTable) return;
      isSyncingFromFloating = true;
      gridWrapper.scrollLeft = floatingScrollbar.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromFloating = false;
      });
    };
    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);
    
    // Table -> Floating
    const handleTableScroll = () => {
      if (isSyncingFromFloating) return;
      isSyncingFromTable = true;
      floatingScrollbar.scrollLeft = gridWrapper.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromTable = false;
      });
    };
    gridWrapper.addEventListener('scroll', handleTableScroll);
    
    // Zeige/Verstecke Floating-Scrollbar basierend auf Sichtbarkeit der Tabelle
    const toggleFloatingScrollbar = () => {
      const tableRect = gridWrapper.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Zeige Floating-Scrollbar nur wenn:
      // 1. Wir auf der Kampagnen-Detailseite sind
      // 2. Tabelle breiter als Viewport ist (horizontales Scrollen nötig)
      // 3. Tabelle teilweise oder ganz sichtbar ist
      const isOnKampagnePage = window.location.pathname.includes('/kampagne/');
      const needsHorizontalScroll = table.scrollWidth > gridWrapper.clientWidth;
      const tableIsVisible = tableRect.top < viewportHeight && tableRect.bottom > 0;
      
      if (isOnKampagnePage && needsHorizontalScroll && tableIsVisible) {
        updateScrollbarPosition(); // Position nochmal aktualisieren
        floatingScrollbar.classList.add('visible');
      } else {
        floatingScrollbar.classList.remove('visible');
      }
    };
    
    // Initial check
    toggleFloatingScrollbar();
    
    // Bei Scroll und Resize prüfen
    const handleWindowScroll = () => toggleFloatingScrollbar();
    const handleWindowResize = () => {
      updateScrollbarPosition();
      toggleFloatingScrollbar();
    };
    
    window.addEventListener('scroll', handleWindowScroll);
    window.addEventListener('resize', handleWindowResize);
    
    // Cleanup bei Tab-Wechsel oder Navigation
    const cleanup = () => {
      floatingScrollbar.classList.remove('visible');
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowResize);
      floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
      gridWrapper.removeEventListener('scroll', handleTableScroll);
    };
    
    // Event für Tab-Wechsel und Navigation
    document.addEventListener('tab-changed', cleanup);
    
    // Cleanup bei Navigation
    const navigationCleanup = () => {
      if (!window.location.pathname.includes('/kampagne/')) {
        cleanup();
        if (floatingScrollbar && floatingScrollbar.parentNode) {
          floatingScrollbar.parentNode.removeChild(floatingScrollbar);
        }
      }
    };
    window.addEventListener('popstate', navigationCleanup);
    
    // Speichere cleanup-Funktion für später
    this.cleanupFloatingScrollbar = cleanup;
  }

  // Initialisiere Realtime-Subscription für Live-Updates
  initRealtimeSubscription() {
    // Verhindere mehrfache Subscriptions
    if (this._realtimeChannel) {
      return;
    }

    // Prüfe ob wir Kooperationen haben (sonst können wir keinen Filter erstellen)
    if (!this.kooperationen || this.kooperationen.length === 0) {
      console.log('⏭️ REALTIME: Keine Kooperationen vorhanden, überspringe Subscription');
      return;
    }

    console.log('🔴 REALTIME: Initialisiere Live-Updates für Kampagne', this.kampagneId);
    console.log('📊 REALTIME: Kooperationen gefunden:', this.kooperationen.length);

    // Erstelle einen einzigen Channel für diese Kampagne
    // WICHTIG: Wir subscriben auf ALLE Videos und filtern client-seitig
    this._realtimeChannel = window.supabase
      .channel(`kampagne-koops-videos-${this.kampagneId}`, {
        config: {
          broadcast: { self: false }
        }
      })
      
      // 1. Überwache ALLE Video-Updates (RLS filtert automatisch)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kooperation_videos'
      }, (payload) => {
        console.log('🔄 REALTIME: Video UPDATE Event empfangen', payload.new);
        // Prüfe ob Video zu dieser Kampagne gehört
        const belongsToThisKampagne = this.kooperationen.some(k => k.id === payload.new.kooperation_id);
        if (belongsToThisKampagne) {
          console.log('✅ REALTIME: Video gehört zu dieser Kampagne, verarbeite Update');
          this.handleVideoUpdate(payload);
        } else {
          console.log('⏭️ REALTIME: Video gehört nicht zu dieser Kampagne, überspringe');
        }
      })
      
      // 2. Überwache neue Videos
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kooperation_videos'
      }, (payload) => {
        console.log('🔄 REALTIME: Video INSERT Event empfangen', payload.new);
        const belongsToThisKampagne = this.kooperationen.some(k => k.id === payload.new.kooperation_id);
        if (belongsToThisKampagne) {
          console.log('✅ REALTIME: Video gehört zu dieser Kampagne, verarbeite INSERT');
          this.handleNewVideo(payload);
        }
      })
      
      // 3. Überwache neue Kooperationen für diese Kampagne
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kooperationen'
      }, (payload) => {
        console.log('🔄 REALTIME: Kooperation INSERT Event empfangen', payload.new);
        if (payload.new.kampagne_id === this.kampagneId) {
          console.log('✅ REALTIME: Kooperation gehört zu dieser Kampagne');
          this.handleNewKooperation(payload);
        }
      })
      
      // 3b. Überwache Kooperations-Updates
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kooperationen'
      }, (payload) => {
        console.log('🔄 REALTIME: Kooperation UPDATE Event empfangen', payload.new);
        if (payload.new.kampagne_id === this.kampagneId) {
          console.log('✅ REALTIME: Kooperation gehört zu dieser Kampagne');
          this.handleKooperationUpdate(payload);
        }
      })
      
      // 4. Überwache Video-Kommentare (für Feedback-Änderungen)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kooperation_video_comment'
      }, (payload) => {
        console.log('🔄 REALTIME: Kommentar INSERT Event empfangen', payload);
        this.handleCommentChange(payload);
      })
      
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'kooperation_video_comment'
      }, (payload) => {
        console.log('🔄 REALTIME: Kommentar DELETE Event empfangen', payload);
        this.handleCommentChange(payload);
      })
      
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kooperation_video_comment'
      }, (payload) => {
        console.log('🔄 REALTIME: Kommentar UPDATE Event empfangen', payload);
        this.handleCommentChange(payload);
      })
      
      .subscribe((status, err) => {
        console.log('📡 REALTIME: Subscription Status Update:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ REALTIME: Live-Updates ERFOLGREICH aktiviert für Kampagne', this.kampagneId);
          console.log('🎯 REALTIME: Listening for changes on kooperation_videos, kooperationen, kooperation_video_comment');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ REALTIME: Channel Error:', err);
          console.error('📋 REALTIME: Error Details:', JSON.stringify(err));
          // Versuche Reconnect nach 5 Sekunden
          setTimeout(() => {
            console.log('🔄 REALTIME: Versuche Reconnect...');
            this.cleanupRealtimeSubscription();
            this.initRealtimeSubscription();
          }, 5000);
        } else if (status === 'TIMED_OUT') {
          console.error('❌ REALTIME: Subscription Timeout');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ REALTIME: Channel wurde geschlossen');
        } else {
          console.log('📡 REALTIME: Status:', status);
        }
      });
  }

  async handleVideoUpdate(payload) {
    const updatedVideo = payload.new;
    
    // Prüfe ob das Update vom aktuellen User stammt (dann nicht refreshen)
    if (this._lastUpdateBy === window.currentUser?.id && 
        Date.now() - this._lastUpdateTime < 2000) {
      console.log('⏭️ REALTIME: Überspringe eigenes Update');
      return;
    }
    
    // Finde das Video in unseren Daten und aktualisiere es
    for (const koopId in this.videos) {
      const videoIndex = this.videos[koopId].findIndex(v => v.id === updatedVideo.id);
      if (videoIndex !== -1) {
        this.videos[koopId][videoIndex] = {
          ...this.videos[koopId][videoIndex],
          ...updatedVideo
        };
        
        // Nur die betroffene Zeile neu rendern
        await this.updateVideoRow(updatedVideo.id);
        break;
      }
    }
  }

  async handleNewVideo(payload) {
    const newVideo = payload.new;
    
    // Prüfe ob eigenes Update
    if (this._lastUpdateBy === window.currentUser?.id && 
        Date.now() - this._lastUpdateTime < 2000) {
      return;
    }
    
    // Füge das neue Video zu den lokalen Daten hinzu
    const koopId = newVideo.kooperation_id;
    if (!this.videos[koopId]) {
      this.videos[koopId] = [];
    }
    this.videos[koopId].push(newVideo);
    
    // Komplette Tabelle neu rendern
    await this.refresh();
  }

  async handleNewKooperation(payload) {
    // Prüfe ob eigenes Update
    if (this._lastUpdateBy === window.currentUser?.id && 
        Date.now() - this._lastUpdateTime < 2000) {
      return;
    }
    
    // Komplette Tabelle neu rendern (neue Kooperation = neuer Row-Span-Block)
    await this.refresh();
  }

  async handleKooperationUpdate(payload) {
    const updatedKooperation = payload.new;
    
    // Prüfe ob eigenes Update - wenn ja, überspringe komplett
    if (this._lastUpdateBy === window.currentUser?.id && 
        Date.now() - this._lastUpdateTime < 2000) {
      console.log('⏭️ REALTIME: Überspringe eigenes Kooperations-Update');
      return;
    }
    
    console.log('🔄 REALTIME: Kooperation Update von anderem User:', updatedKooperation.id);
    
    // Aktualisiere nur die lokalen Daten, KEIN DOM-Update
    const koopIndex = this.kooperationen.findIndex(k => k.id === updatedKooperation.id);
    if (koopIndex !== -1) {
      this.kooperationen[koopIndex] = {
        ...this.kooperationen[koopIndex],
        ...updatedKooperation,
        creator: this.kooperationen[koopIndex].creator,
        kampagne: this.kooperationen[koopIndex].kampagne
      };
      console.log('✅ REALTIME: Lokale Daten aktualisiert (kein DOM-Update)');
    }
  }

  async handleCommentChange(payload) {
    const comment = payload.new || payload.old;
    if (!comment || !comment.video_id) return;
    
    const videoId = comment.video_id;
    
    // Prüfe ob eigenes Update
    if (this._lastUpdateBy === window.currentUser?.id && 
        Date.now() - this._lastUpdateTime < 2000) {
      return;
    }
    
    // Lade Kommentare für dieses Video neu
    const { data: comments } = await window.supabase
      .from('kooperation_video_comment')
      .select('id, video_id, text, runde, author_name, created_at')
      .eq('video_id', videoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    
    // Aktualisiere lokale Kommentar-Map
    if (!this.videoComments[videoId]) {
      this.videoComments[videoId] = { r1: [], r2: [] };
    }
    
    this.videoComments[videoId].r1 = (comments || []).filter(c => c.runde === 1);
    this.videoComments[videoId].r2 = (comments || []).filter(c => c.runde === 2);
    
    console.log('✅ REALTIME: Kommentare für Video neu geladen:', videoId);
    
    // Aktualisiere nur die Feedback-Felder (nicht alle!)
    this.updateVideoFeedbackFields(videoId);
  }
  
  updateVideoFeedbackFields(videoId) {
    console.log('🔄 REALTIME: Aktualisiere nur Feedback-Felder für Video:', videoId);
    
    // Feedback CreatorJobs (Runde 1)
    const feedbackCJ = document.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_creatorjobs"]`);
    if (feedbackCJ) {
      const commentsR1 = this.videoComments[videoId]?.r1 || [];
      const valueR1 = commentsR1.length > 0 
        ? commentsR1.map(c => c.text).join('\n\n---\n\n')
        : '';
      feedbackCJ.value = valueR1;
      feedbackCJ.classList.add('field-updated');
      setTimeout(() => feedbackCJ.classList.remove('field-updated'), 2000);
      console.log('✅ REALTIME: Feedback R1 aktualisiert');
    }
    
    // Feedback Ritzenhoff (Runde 2)
    const feedbackRH = document.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_ritzenhoff"]`);
    if (feedbackRH) {
      const commentsR2 = this.videoComments[videoId]?.r2 || [];
      const valueR2 = commentsR2.length > 0 
        ? commentsR2.map(c => c.text).join('\n\n---\n\n')
        : '';
      feedbackRH.value = valueR2;
      feedbackRH.classList.add('field-updated');
      setTimeout(() => feedbackRH.classList.remove('field-updated'), 2000);
      console.log('✅ REALTIME: Feedback R2 aktualisiert');
    }
  }

  async updateVideoRow(videoId) {
    console.log('🔄 REALTIME: updateVideoRow für Video-ID:', videoId);
    
    // Finde das Video in den Daten
    let video = null;
    let kooperation = null;
    
    for (const koopId in this.videos) {
      video = this.videos[koopId].find(v => v.id === videoId);
      if (video) {
        kooperation = this.kooperationen.find(k => k.id === koopId);
        break;
      }
    }
    
    if (!video) {
      console.warn('⚠️ REALTIME: Video nicht in lokalen Daten gefunden:', videoId);
      return;
    }
    
    // Aktualisiere die Felder direkt über data-id Selektoren
    this.updateVideoFieldsInDOM(videoId, video);
  }

  updateVideoFieldsInDOM(videoId, video) {
    console.log('🔄 REALTIME: Aktualisiere Felder für Video:', videoId, video);
    
    // Suche alle Felder mit dieser Video-ID
    const fieldsToUpdate = document.querySelectorAll(`[data-entity="video"][data-id="${videoId}"]`);
    console.log('📝 REALTIME: Gefundene Felder:', fieldsToUpdate.length);
    
    let anyUpdated = false;
    
    fieldsToUpdate.forEach(field => {
      const fieldName = field.getAttribute('data-field');
      let shouldUpdate = false;
      let newValue = null;
      
      // Prüfe ob sich der Wert tatsächlich geändert hat
      switch(fieldName) {
        case 'feedback_creatorjobs':
          const commentsR1 = this.videoComments[videoId]?.r1 || [];
          const valueR1 = commentsR1.length > 0 
            ? commentsR1.map(c => c.text).join('\n\n---\n\n')
            : '';
          if (field.value !== valueR1) {
            field.value = valueR1;
            shouldUpdate = true;
            console.log('✅ REALTIME: Feedback R1 aktualisiert');
          }
          break;
          
        case 'feedback_ritzenhoff':
          const commentsR2 = this.videoComments[videoId]?.r2 || [];
          const valueR2 = commentsR2.length > 0 
            ? commentsR2.map(c => c.text).join('\n\n---\n\n')
            : '';
          if (field.value !== valueR2) {
            field.value = valueR2;
            shouldUpdate = true;
            console.log('✅ REALTIME: Feedback R2 aktualisiert');
          }
          break;
          
        case 'freigabe':
          newValue = video.freigabe || false;
          if (field.checked !== newValue) {
            field.checked = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Freigabe Checkbox aktualisiert:', newValue);
            
            // Aktualisiere visuelles Feedback (grüner Hintergrund)
            this.toggleVideoRowApproval(videoId, newValue);
          }
          break;
          
        case 'caption':
          newValue = video.caption || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Caption aktualisiert');
          }
          break;
          
        case 'link_content':
          newValue = video.link_content || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Link Content aktualisiert');
          }
          break;
          
        case 'thema':
          newValue = video.thema || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Thema aktualisiert');
          }
          break;
          
        case 'titel':
          newValue = video.titel || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Titel aktualisiert');
          }
          break;
          
        case 'status':
          newValue = video.status || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Status aktualisiert');
          }
          break;
          
        case 'content_art':
          newValue = video.content_art || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Content Art aktualisiert');
          }
          break;
          
        case 'link_produkte':
          newValue = video.link_produkte || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
          }
          break;
          
        case 'link_skript':
          newValue = video.link_skript || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
          }
          break;
          
        case 'skript_freigegeben':
          newValue = video.skript_freigegeben || false;
          if (field.checked !== newValue) {
            field.checked = newValue;
            shouldUpdate = true;
          }
          break;
          
        case 'kommentar':
          newValue = video.kommentar || '';
          if (field.value !== newValue) {
            field.value = newValue;
            shouldUpdate = true;
            console.log('✅ REALTIME: Kommentar aktualisiert');
          }
          break;
      }
      
      // Visueller Hinweis nur bei tatsächlicher Änderung
      if (shouldUpdate) {
        field.classList.add('field-updated');
        setTimeout(() => field.classList.remove('field-updated'), 2000);
        anyUpdated = true;
      }
    });
    
    // Finde die Zeile und füge visuellen Hinweis hinzu (nur wenn Update stattfand)
    if (anyUpdated) {
      const row = document.querySelector(`tr:has([data-id="${videoId}"])`);
      if (row) {
        row.classList.add('realtime-updated');
        setTimeout(() => row.classList.remove('realtime-updated'), 2000);
        console.log('✅ REALTIME: Zeile visuell markiert');
      }
    }
  }

  // Toggle visuelles Feedback für freigegebene Video-Zeilen
  toggleVideoRowApproval(videoId, isApproved) {
    // Finde alle video-field-wrapper für dieses Video über alle Spalten hinweg
    const videoRows = document.querySelectorAll(`.video-field-wrapper[data-video-id="${videoId}"]`);
    
    videoRows.forEach(row => {
      if (isApproved) {
        row.classList.add('video-field-wrapper--approved');
      } else {
        row.classList.remove('video-field-wrapper--approved');
      }
    });
    
    console.log(`✅ VIDEO APPROVAL: ${videoRows.length} Zeilen aktualisiert für Video ${videoId}, approved=${isApproved}`);
  }

  cleanupRealtimeSubscription() {
    if (this._realtimeChannel) {
      console.log('🗑️ REALTIME: Entferne Live-Update Subscription');
      window.supabase.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  // Refresh-Methode: Lädt Daten neu und rendert Tabelle ohne Seitenneuladung
  async refresh() {
    console.log('🔄 KampagneKooperationenVideoTable.refresh() - Lade Daten neu und rendere Tabelle');
    
    // Container finden
    const container = this.containerId ? document.getElementById(this.containerId) : null;
    if (!container) {
      console.error('❌ Container nicht gefunden für refresh, containerId:', this.containerId);
      return;
    }
    
    // Daten neu laden
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
























