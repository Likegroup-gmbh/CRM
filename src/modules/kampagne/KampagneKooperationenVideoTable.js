// KampagneKooperationenVideoTable.js (ES6-Modul)
// Kombinierte Kooperations-Video-Tabelle für Kampagnendetails

export class KampagneKooperationenVideoTable {
  constructor(kampagneId) {
    this.kampagneId = kampagneId;
    this.kooperationen = [];
    this.videos = {};
    this.videoComments = {}; // { video_id: { r1: [], r2: [] } }
    this.versandInfos = {};
    this.columnWidths = new Map();
    this.isResizing = false;
    this.resizeCol = null;
    this.resizeStartX = 0;
    this.resizeStartWidth = 0;
    this.storageKey = `kampagne_koops_videos_column_widths_${kampagneId}`;
  }

  // Lade alle Daten für die Tabelle
  async loadData() {
    try {
      console.log('🔄 Lade Kooperationen, Videos und Feedback...');
      const startTime = performance.now();

      // 1. Kooperationen laden (muss zuerst, da wir die IDs brauchen)
      const { data: kooperationen, error: koopError } = await window.supabase
        .from('kooperationen')
        .select(`
          id, name, status, nettobetrag, gesamtkosten, content_art,
          posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ,
          creator:creator_id (
            id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower,
            lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt
          ),
          kampagne:kampagne_id (
            id, kampagnenname
          )
        `)
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });

      if (koopError) throw koopError;
      this.kooperationen = kooperationen || [];
      
      if (this.kooperationen.length === 0) {
        console.log('ℹ️ Keine Kooperationen gefunden');
        return;
      }

      const koopIds = this.kooperationen.map(k => k.id);

      // 2. Videos UND Versand parallel laden
      const [videosResult, versandResult] = await Promise.all([
        window.supabase
          .from('kooperation_videos')
          .select(`
            id, kooperation_id, position, asset_url,
            caption, feedback_creatorjobs, feedback_ritzenhoff, freigabe,
            link_content, link_story, link_produkte, thema, link_skript
          `)
          .in('kooperation_id', koopIds)
          .order('position', { ascending: true}),
        
        window.supabase
          .from('kooperation_versand')
          .select('id, kooperation_id, versendet, tracking_nummer')
          .in('kooperation_id', koopIds)
      ]);

      const { data: videos, error: videoError} = videosResult;
      const { data: versandInfos, error: versandError } = versandResult;

      if (videoError) throw videoError;
      if (versandError) {
        console.warn('⚠️ Versand-Infos konnten nicht geladen werden:', versandError);
      }

      // Videos verarbeiten
      if (videos && videos.length > 0) {
        const videoIds = videos.map(v => v.id);

        // 3. Assets UND Kommentare parallel laden
        const [assetsResult, commentsResult] = await Promise.all([
          window.supabase
            .from('kooperation_video_asset')
            .select('id, video_id, file_url, is_current')
            .in('video_id', videoIds)
            .eq('is_current', true),
          
          window.supabase
            .from('kooperation_video_comment')
            .select('id, video_id, text, runde, author_name, created_at')
            .in('video_id', videoIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
        ]);

        const { data: assets } = assetsResult;
        const { data: comments } = commentsResult;

        // Assets den Videos zuordnen
        const enrichedVideos = videos.map(v => ({
          ...v,
          currentAsset: assets?.find(a => a.video_id === v.id),
          file_url: assets?.find(a => a.video_id === v.id)?.file_url || v.asset_url || null
        }));

        // Videos nach Kooperation gruppieren
        this.videos = {};
        enrichedVideos.forEach(video => {
          if (!this.videos[video.kooperation_id]) {
            this.videos[video.kooperation_id] = [];
          }
          this.videos[video.kooperation_id].push(video);
        });

        // Kommentare nach Video und Runde gruppieren
        this.videoComments = {};
        (comments || []).forEach(comment => {
          if (!this.videoComments[comment.video_id]) {
            this.videoComments[comment.video_id] = { r1: [], r2: [] };
          }
          if (comment.runde === 1) {
            this.videoComments[comment.video_id].r1.push(comment);
          } else if (comment.runde === 2) {
            this.videoComments[comment.video_id].r2.push(comment);
          }
        });
      } else {
        this.videos = {};
        this.videoComments = {};
      }

      // Versand-Infos nach Kooperation gruppieren
      this.versandInfos = {};
      (versandInfos || []).forEach(info => {
        this.versandInfos[info.kooperation_id] = info;
      });

      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ Daten geladen in ${loadTime}ms:`, {
        kooperationen: this.kooperationen.length,
        videos: Object.keys(this.videos).length,
        comments: Object.keys(this.videoComments).length
      });

    } catch (error) {
      console.error('❌ Fehler beim Laden der Daten:', error);
      window.ErrorHandler.handle(error, 'KampagneKooperationenVideoTable.loadData');
    }
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

    const rows = this.kooperationen.map((koop, idx) => 
      this.renderKooperationWithVideos(koop, idx + 1)
    ).join('');

    return `
      <div class="grid-wrapper">
        <table class="grid-table kooperation-video-grid">
          <thead>
            <tr>
              <th class="col-header" style="width: 50px; min-width: 50px;">
                Nr
                <div class="resize-handle resize-handle-col" data-col="0"></div>
              </th>
              <th class="col-header" style="width: 150px; min-width: 150px;">
                Creator
                <div class="resize-handle resize-handle-col" data-col="1"></div>
              </th>
              <th class="col-header" style="width: 180px; min-width: 180px;">
                Info zum Creator
                <div class="resize-handle resize-handle-col" data-col="2"></div>
              </th>
              <th class="col-header" style="width: 120px; min-width: 120px;">
                Typ
                <div class="resize-handle resize-handle-col" data-col="3"></div>
              </th>
              <th class="col-header" style="width: 120px; min-width: 120px;">
                Organic/Paid
                <div class="resize-handle resize-handle-col" data-col="4"></div>
              </th>
              <th class="col-header" style="width: 100px; min-width: 100px;">
                Kosten
                <div class="resize-handle resize-handle-col" data-col="5"></div>
              </th>
              <th class="col-header" style="width: 150px; min-width: 150px;">
                Kampagne
                <div class="resize-handle resize-handle-col" data-col="6"></div>
              </th>
              <th class="col-header" style="width: 130px; min-width: 130px;">
                Posting Datum
                <div class="resize-handle resize-handle-col" data-col="7"></div>
              </th>
              <th class="col-header" style="width: 80px; min-width: 80px;">
                Vertrag
                <div class="resize-handle resize-handle-col" data-col="8"></div>
              </th>
              <th class="col-header" style="width: 150px; min-width: 150px;">
                Nutzungsrechte
                <div class="resize-handle resize-handle-col" data-col="9"></div>
              </th>
              <th class="col-header" style="width: 200px; min-width: 200px;">
                Lieferadresse
                <div class="resize-handle resize-handle-col" data-col="10"></div>
              </th>
              <th class="col-header" style="width: 200px; min-width: 200px;">
                Paket/Tracking
                <div class="resize-handle resize-handle-col" data-col="11"></div>
              </th>
              <th class="col-header" style="width: 80px; min-width: 80px;">
                Gläser
                <div class="resize-handle resize-handle-col" data-col="12"></div>
              </th>
              <th class="col-header" style="width: 150px; min-width: 150px;">
                Tracking Link
                <div class="resize-handle resize-handle-col" data-col="13"></div>
              </th>
              <th class="col-header" style="width: 150px; min-width: 150px;">
                Thema
                <div class="resize-handle resize-handle-col" data-col="14"></div>
              </th>
              <th class="col-header" style="width: 130px; min-width: 130px;">
                Link Produkte
                <div class="resize-handle resize-handle-col" data-col="15"></div>
              </th>
              <th class="col-header" style="width: 130px; min-width: 130px;">
                Link Skript
                <div class="resize-handle resize-handle-col" data-col="16"></div>
              </th>
              <th class="col-header" style="width: 130px; min-width: 130px;">
                Link Content
                <div class="resize-handle resize-handle-col" data-col="17"></div>
              </th>
              <th class="col-header" style="width: 130px; min-width: 130px;">
                Link Story
                <div class="resize-handle resize-handle-col" data-col="18"></div>
              </th>
              <th class="col-header" style="width: 200px; min-width: 200px;">
                Caption
                <div class="resize-handle resize-handle-col" data-col="19"></div>
              </th>
              <th class="col-header" style="width: 180px; min-width: 180px;">
                Feedback CJ
                <div class="resize-handle resize-handle-col" data-col="20"></div>
              </th>
              <th class="col-header" style="width: 180px; min-width: 180px;">
                Feedback Kunde
                <div class="resize-handle resize-handle-col" data-col="21"></div>
              </th>
              <th class="col-header" style="width: 80px; min-width: 80px;">
                Freigabe
                <div class="resize-handle resize-handle-col" data-col="22"></div>
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

    // Creator-Info formatieren
    const creatorInfo = [
      creator.instagram ? `IG: @${creator.instagram} (${(creator.instagram_follower || 0).toLocaleString()})` : null,
      creator.tiktok ? `TT: @${creator.tiktok} (${(creator.tiktok_follower || 0).toLocaleString()})` : null
    ].filter(Boolean).join('\n') || '-';

    // Lieferadresse formatieren
    const lieferadresse = creator.lieferadresse_strasse 
      ? `${creator.lieferadresse_strasse} ${creator.lieferadresse_hausnummer || ''}\n${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}`
      : '-';

    // Eine Zeile pro Kooperation - Videos als gestapelte Inputs in den Video-Spalten
    return `
      <tr class="kooperation-row" data-kooperation-id="${koop.id}">
        <td class="grid-cell read-only">${rowNumber}</td>
        <td class="grid-cell read-only">
          <a href="/kooperation/${koop.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${koop.id}')" class="table-link">
            ${this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
          </a>
        </td>
        <td class="grid-cell read-only small-text" style="white-space: pre-line;">${this.escapeHtml(creatorInfo)}</td>
        <td class="grid-cell">
          <input 
            type="text" 
            class="grid-input" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="typ"
            value="${koop.typ || ''}"
            placeholder="UGC/Influencer"
          />
        </td>
        <td class="grid-cell read-only">${this.escapeHtml(koop.content_art || '-')}</td>
        <td class="grid-cell read-only">${formatCurrency(koop.gesamtkosten)}</td>
        <td class="grid-cell read-only">
          <a href="/kampagne/${koop.kampagne?.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${koop.kampagne?.id}')" class="table-link">
            ${this.escapeHtml(koop.kampagne?.kampagnenname || '-')}
          </a>
        </td>
        <td class="grid-cell">
          <input 
            type="date" 
            class="grid-input" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="posting_datum"
            value="${koop.posting_datum || ''}"
          />
        </td>
        <td class="grid-cell" style="text-align: center;">
          <input 
            type="checkbox" 
            class="grid-checkbox" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="vertrag_unterschrieben"
            ${koop.vertrag_unterschrieben ? 'checked' : ''}
          />
        </td>
        <td class="grid-cell">
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
        <td class="grid-cell read-only small-text" style="white-space: pre-line;">${this.escapeHtml(lieferadresse)}</td>
        <td class="grid-cell">
          <div class="versand-fields">
            <label class="checkbox-label-grid">
              <input 
                type="checkbox" 
                class="grid-checkbox" 
                data-entity="versand" 
                data-id="${versand?.id || 'new'}"
                data-kooperation-id="${koop.id}"
                data-field="versendet"
                ${versand?.versendet ? 'checked' : ''}
              />
              <span>Versendet</span>
            </label>
            <input 
              type="text" 
              class="grid-input" 
              data-entity="versand" 
              data-id="${versand?.id || 'new'}"
              data-kooperation-id="${koop.id}"
              data-field="tracking_nummer"
              value="${versand?.tracking_nummer || ''}"
              placeholder="Tracking Nr."
              style="margin-top: 4px;"
            />
          </div>
        </td>
        <td class="grid-cell" style="text-align: center;">
          <span class="text-muted">-</span>
        </td>
        <td class="grid-cell">
          <input 
            type="text" 
            class="grid-input" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="tracking_link"
            value="${koop.tracking_link || ''}"
            placeholder="Tracking Link"
          />
        </td>
        <!-- Video-Spalten: Jedes Video als eigene Zeile über alle Spalten -->
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="thema"
              value="${this.escapeHtml(video.thema || '')}" placeholder="Thema"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="link_produkte"
              value="${this.escapeHtml(video.link_produkte || '')}" placeholder="Link"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="link_skript"
              value="${this.escapeHtml(video.link_skript || '')}" placeholder="Link"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => {
            const videoUrl = video.file_url || video.link_content || video.asset_url;
            if (videoUrl) {
              return `<a href="${videoUrl}" target="_blank" class="table-link stacked-video-link">📹 Video ansehen</a>`;
            } else {
              return `<input type="text" class="grid-input stacked-video-input" 
                data-entity="video" data-id="${video.id}" data-field="link_content"
                value="" placeholder="Link"/>`;
            }
          })}
        </td>
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="link_story"
              value="${this.escapeHtml(video.link_story || '')}" placeholder="Link"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell">
          ${this.renderVideoFieldStack(videos, (video) => `
            <textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="caption"
              placeholder="Caption" rows="1">${this.escapeHtml(video.caption || '')}</textarea>
          `)}
        </td>
        <td class="grid-cell video-stack-cell">
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
        <td class="grid-cell video-stack-cell">
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
        <td class="grid-cell video-stack-cell checkbox-stack">
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox" 
                data-entity="video" data-id="${video.id}" data-field="freigabe"
                ${video.freigabe ? 'checked' : ''}/>
            </div>
          `)}
        </td>
      </tr>
    `;
  }

  // Generische Funktion zum Rendern von Video-Feldern mit einem Callback
  renderVideoFieldStack(videos, fieldRenderer) {
    if (!videos || videos.length === 0) {
      return '<span class="text-muted">-</span>';
    }
    
    return videos.map(video => fieldRenderer(video)).join('');
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
      if (e.target.classList.contains('grid-checkbox')) {
        await this.handleFieldUpdate(e.target);
      }
    });
    
    // Auto-resize Textareas
    this.initAutoResizeTextareas();

    // Spaltenbreite-Anpassung
    this.bindResizeEvents();
  }
  
  // Auto-resize für Textareas initialisieren
  initAutoResizeTextareas() {
    const autoResizeTextareas = document.querySelectorAll('.auto-resize-textarea');
    
    const adjustHeight = (textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px';
    };
    
    autoResizeTextareas.forEach(textarea => {
      // Initial-Höhe setzen
      adjustHeight(textarea);
      
      // Bei Input Event Höhe anpassen
      textarea.addEventListener('input', () => adjustHeight(textarea));
      
      // Bei Focus auch prüfen
      textarea.addEventListener('focus', () => adjustHeight(textarea));
    });
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
        if (id === 'new') {
          // Neue Versand-Info erstellen
          const { data, error } = await window.supabase
            .from('kooperation_versand')
            .insert({
              kooperation_id: kooperationId,
              [fieldName]: value
            })
            .select('id')
            .single();

          if (error) throw error;
          
          // ID in ALLEN Versand-Feldern dieser Kooperation aktualisieren
          const versandFields = document.querySelectorAll(
            `[data-entity="versand"][data-kooperation-id="${kooperationId}"][data-id="new"]`
          );
          versandFields.forEach(f => f.setAttribute('data-id', data.id));
          
          // Speichere in lokaler Map für zukünftige Renders
          this.versandInfos[kooperationId] = { id: data.id, [fieldName]: value };
          
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
          const { data, error } = await window.supabase
            .from('kooperation_video_comment')
            .insert({
              video_id: videoId,
              runde: runde,
              text: value.trim(),
              author_benutzer_id: window.currentUser?.id || null,
              author_name: window.currentUser ? `${window.currentUser.vorname} ${window.currentUser.nachname}` : 'Unbekannt',
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
          
          console.log(`✅ Feedback Runde ${runde} gespeichert als Kommentar`);
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
    console.log('🎬 KampagneKooperationenVideoTable.init() - Container ID:', containerId);
    const container = document.getElementById(containerId);
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
    
    // Loading-Spinner anzeigen
    if (container) {
      container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; padding: 60px 20px; color: var(--gray-600);">
          <div style="text-align: center;">
            <div class="spinner" style="margin: 0 auto 16px; border: 3px solid var(--gray-200); border-top-color: var(--primary-600); border-radius: 50%; width: 40px; height: 40px; animation: spin 0.8s linear infinite;"></div>
            <p style="font-size: var(--text-base); font-weight: 500;">Lädt Kooperationen & Videos...</p>
          </div>
        </div>
      `;
    } else {
      console.error('❌ Container nicht gefunden:', containerId);
      return;
    }
    
    await this.loadData();
    
    console.log('🎬 Daten geladen, rendere Tabelle...');
    const html = this.render();
    console.log('🎬 HTML generiert, Länge:', html.length);
    console.log('🎬 HTML Preview (erste 500 Zeichen):', html.substring(0, 500));
    
    if (container) {
      container.innerHTML = html;
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
      
      // Gespeicherte Spaltenbreiten wiederherstellen
      this.loadColumnWidths();
    }
  }
}

// Export für direkten Gebrauch
export async function renderKooperationenVideoTable(kampagneId, containerId) {
  const table = new KampagneKooperationenVideoTable(kampagneId);
  await table.init(containerId);
  return table;
}

