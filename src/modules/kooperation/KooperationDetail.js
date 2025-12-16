// KooperationDetail.js (ES6-Modul)
// Kooperations-Detailseite mit allen relevanten Informationen
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { kooperationVersandManager } from './VersandManager.js';
import { TaskKanbanBoard } from '../tasks/TaskKanbanBoard.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton, getTabIcon } from '../../core/TabUtils.js';

export class KooperationDetail {
  constructor() {
    this.kooperationId = null;
    this.kooperation = null;
    this.notizen = [];
    this.ratings = [];
    this.creator = null;
    this.kampagne = null;
    this.rechnungen = [];
    this.videos = [];
    this.history = [];
    this.historyCount = 0;
    this.versandDaten = null;
    this.taskKanbanBoard = null;
    this.tasksCount = 0;
  }

  // Initialisiere Kooperations-Detailseite
  async init(kooperationId) {
    console.log('🎯 KOOPERATIONDETAIL: Initialisiere Kooperations-Detailseite für ID:', kooperationId);
    
    this.kooperationId = kooperationId;
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ KOOPERATIONDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      // Lade kritische Kooperations-Daten parallel (optimiert!)
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.kooperation) {
        const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Kooperation', url: '/kooperation', clickable: true },
          { label: this.kooperation.name || 'Details', url: `/kooperation/${this.kooperationId}`, clickable: false }
        ], {
          id: 'btn-edit-kooperation',
          canEdit: canEdit
        });
      }
      
      // Rendere die Seite
      await this.render();
      
      // Lade Tasks-Count
      await this.loadTasksCount();
      
      // Binde Events
      this.bindEvents();
      
      // Event-Listener für automatische Cache-Invalidierung
      this.setupCacheInvalidation();
      
      console.log('✅ KOOPERATIONDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ KOOPERATIONDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KooperationDetail.init');
    }
  }

  // Lade kritische Kooperations-Daten PARALLEL (Performance-Optimiert!)
  async loadCriticalData() {
    console.log('🔄 KOOPERATIONDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    // Alle kritischen Daten PARALLEL laden
    const [
      kooperationResult,
      notizenResult,
      ratingsResult,
      versandResult
    ] = await parallelLoad([
      // 1. Kooperation mit allen Relations
      () => window.supabase
        .from('kooperationen')
        .select(`
          id, name, status, einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_ust, einkaufspreis_gesamt,
          verkaufspreis_netto, verkaufspreis_zusatzkosten, verkaufspreis_ust, verkaufspreis_gesamt,
          skript_deadline, content_deadline, videoanzahl, content_art, skript_autor,
          creator_id, kampagne_id, unternehmen_id, briefing_id,
          creator:creator_id ( 
            id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, mail,
            lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
          ),
          kampagne:kampagne_id (
            id, kampagnenname, status, deadline, start, creatoranzahl, videoanzahl,
            unternehmen:unternehmen_id ( id, firmenname ),
            marke:marke_id ( id, markenname )
          ),
          unternehmen:unternehmen_id ( id, firmenname )
        `)
        .eq('id', this.kooperationId)
        .single(),
      
      // 2. Notizen
      () => window.notizenSystem.loadNotizen('kooperation', this.kooperationId),
      
      // 3. Ratings
      () => window.bewertungsSystem?.loadBewertungen('kooperation', this.kooperationId).catch(() => []),
      
      // 4. Versand-Daten
      () => window.supabase
        .from('kooperation_versand')
        .select(`
          *,
          creator_adresse:creator_adresse_id(*),
          kooperation:kooperation_id(
            creator:creator_id(
              id, vorname, nachname,
              lieferadresse_strasse, lieferadresse_hausnummer, 
              lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
            )
          )
        `)
        .eq('kooperation_id', this.kooperationId)
        .order('created_at', { ascending: false })
    ]);
    
    // Error-Handling für Kooperation
    if (kooperationResult.error) {
      throw new Error(`Fehler beim Laden der Kooperations-Daten: ${kooperationResult.error.message}`);
    }
    
    // Daten verarbeiten
    this.kooperation = kooperationResult.data;
    this.creator = kooperationResult.data.creator || null;
    this.kampagne = kooperationResult.data.kampagne || null;
    this.notizen = notizenResult || [];
    this.ratings = ratingsResult || [];
    this.versandDaten = versandResult.data || [];
    
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ KOOPERATIONDETAIL: Kritische Daten geladen in ${loadTime}ms`);
  }
  
  // Lazy-Load Tab-spezifische Daten
  async loadTabData(tabName) {
    return await tabDataCache.load('kooperation', this.kooperationId, tabName, async () => {
      console.log(`🔄 KOOPERATIONDETAIL: Lade Tab-Daten für "${tabName}"`);
      const startTime = performance.now();
      
      try {
        switch(tabName) {
          case 'videos':
            await this.loadVideos();
            this.updateVideosTab();
            break;
            
          case 'rechnungen':
            await this.loadRechnungen();
            this.updateRechnungenTab();
            break;
            
          case 'history':
            await this.loadHistory();
            this.updateHistoryTab();
            break;
        }
        
        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ KOOPERATIONDETAIL: Tab "${tabName}" geladen in ${loadTime}ms`);
        
      } catch (error) {
        console.error(`❌ KOOPERATIONDETAIL: Fehler beim Laden von Tab "${tabName}":`, error);
      }
    });
  }
  
  // Lade Videos mit allen Relationen
  async loadVideos() {
    try {
      const { data: videos } = await window.supabase
        .from('kooperation_videos')
        .select('id, content_art, titel, asset_url, kommentar, status, position, created_at')
        .eq('kooperation_id', this.kooperationId)
        .order('position', { ascending: true });
      
      this.videos = videos || [];
      
      // Für jedes Video die aktuelle Asset-Version laden
      if (this.videos.length > 0) {
        const videoIds = this.videos.map(v => v.id);
        const { data: assets } = await window.supabase
          .from('kooperation_video_asset')
          .select('id, video_id, file_url, version_number, is_current, created_at')
          .in('video_id', videoIds)
          .eq('is_current', true);
        
        // Assets den Videos zuordnen
        this.videos = this.videos.map(v => ({
          ...v,
          currentAsset: (assets || []).find(a => a.video_id === v.id) || null
        }));
      }
      
      // Kampagnen-Kontingent (geplante Videos) aggregieren
      try {
        const kampId = this.kooperation?.kampagne?.id || this.kooperation?.kampagne_id;
        if (kampId) {
          const { data: koopCounts } = await window.supabase
            .from('kooperationen')
            .select('videoanzahl')
            .eq('kampagne_id', kampId);
          const used = (koopCounts || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
          const total = parseInt(this.kooperation?.kampagne?.videoanzahl, 10) || null;
          this.campaignVideoTotals = { total, used, remaining: total != null ? Math.max(0, total - used) : null };
        } else {
          this.campaignVideoTotals = null;
        }
      } catch (_) {
        this.campaignVideoTotals = null;
      }
      
      // Kommentar-Zusammenfassung je Runde laden (1/2)
      try {
        const videoIds = (this.videos || []).map(v => v.id);
        if (videoIds.length > 0) {
          const { data: comments } = await window.supabase
            .from('kooperation_video_comment')
            .select('id, video_id, runde, text, created_at, author_name, deleted_at')
            .in('video_id', videoIds)
            .order('created_at', { ascending: true });
          const byVideo = {};
          (comments || []).forEach(c => {
            if (!byVideo[c.video_id]) byVideo[c.video_id] = { r1: [], r2: [] };
            const r = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
            byVideo[c.video_id][r].push(c);
          });
          this.videos = (this.videos || []).map(v => ({
            ...v,
            feedback1: byVideo[v.id]?.r1 || [],
            feedback2: byVideo[v.id]?.r2 || []
          }));
        }
      } catch (_) {}
    } catch (_) {
      this.videos = [];
    }
  }
  
  // Lade Rechnungen
  async loadRechnungen() {
    try {
      const { data: rechnungen } = await window.supabase
        .from('rechnung')
        .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url')
        .eq('kooperation_id', this.kooperationId)
        .order('gestellt_am', { ascending: false });
      this.rechnungen = rechnungen || [];
    } catch (_) {
      this.rechnungen = [];
    }
  }
  
  // Lade History
  async loadHistory() {
    try {
      const { data: hist } = await window.supabase
        .from('kooperation_history')
        .select('id, old_status, new_status, comment, created_at, benutzer:changed_by(name)')
        .eq('kooperation_id', this.kooperationId)
        .order('created_at', { ascending: false });
      this.history = (hist || []).map(h => ({
        id: h.id,
        old_status: h.old_status || null,
        new_status: h.new_status || null,
        comment: h.comment || '',
        created_at: h.created_at,
        user_name: h.benutzer?.name || '-'
      }));
      this.historyCount = this.history.length;
    } catch (_) {
      this.history = [];
      this.historyCount = 0;
    }
  }
  
  // Tab-Update-Methoden
  updateVideosTab() {
    const container = document.querySelector('#tab-videos .detail-section');
    if (container) {
      container.innerHTML = `<h2>Videos ${this.renderVideoCounters()}</h2>${this.renderVideos()}`;
      const btn = document.querySelector('.tab-button[data-tab="videos"] .tab-count');
      if (btn) btn.textContent = String(this.videos.length);
    }
  }
  
  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen .detail-section');
    if (container) {
      container.innerHTML = `<h2>Rechnungen</h2>${this.renderRechnungen()}`;
      const btn = document.querySelector('.tab-button[data-tab="rechnungen"] .tab-count');
      if (btn) btn.textContent = String(this.rechnungen.length);
    }
  }
  
  updateHistoryTab() {
    const container = document.querySelector('#tab-history .detail-section');
    if (container) {
      container.innerHTML = `<h2>History</h2>${this.renderHistory()}`;
      const btn = document.querySelector('.tab-button[data-tab="history"] .tab-count');
      if (btn) btn.textContent = String(this.historyCount);
    }
  }

  // Rendere Kooperations-Detailseite mit Tabs
  async render() {
    if (!this.kooperation) {
      this.showNotFound();
      return;
    }

    const title = this.kooperation.name || 'Kooperation';
    if (window.setHeadline) {
      window.setHeadline(`Kooperation: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);
    }

    const html = `
      <div class="content-section">
        <div class="tab-navigation">
          ${renderTabButton({ tab: 'info', label: 'Informationen', isActive: true })}
          ${renderTabButton({ tab: 'videos', label: 'Videos', count: this.videos?.length || 0 })}
          ${renderTabButton({ tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen?.length || 0 })}
          ${renderTabButton({ tab: 'versand', label: 'Versand', count: this.versandDaten?.length || 0 })}
          ${renderTabButton({ tab: 'notizen', label: 'Notizen', count: this.notizen.length })}
          ${renderTabButton({ tab: 'ratings', label: 'Bewertungen', count: this.ratings.length })}
          ${renderTabButton({ tab: 'history', label: 'History', count: this.historyCount || 0 })}
          <button class="tab-button" data-tab="tasks">
            <span class="tab-icon">${getTabIcon('tasks')}</span>
            Aufgaben<span class="tab-count" id="tasks-count">...</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            ${this.renderInfo()}
          </div>
          <div class="tab-pane" id="tab-videos">
            <div class="detail-section">
              <h2>Videos ${this.renderVideoCounters()}</h2>
              ${this.renderVideos()}
            </div>
          </div>
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>
          <div class="tab-pane" id="tab-versand">
            <div class="detail-section">
              <h2>Versand</h2>
              ${this.renderVersand()}
            </div>
          </div>
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
          <div class="tab-pane" id="tab-tasks">
            <div class="detail-section">
              <div id="tasks-kanban-container"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderVideoCounters() {
    try {
      const plannedForKoop = parseInt(this.kooperation?.videoanzahl, 10) || 0;
      const uploadedForKoop = (this.videos || []).length;
      const coopPart = `<span class="tag tag--type" title="Kooperation: hochgeladen/geplant">Koop: ${uploadedForKoop}/${plannedForKoop}</span>`;
      const totals = this.campaignVideoTotals;
      if (totals && totals.total != null) {
        const kampPart = `<span class="tag tag--type" title="Kampagne: genutzt/gesamt (offen)">Kampagne: ${totals.used}/${totals.total} (${Math.max(0, totals.remaining)} offen)</span>`;
        return `${coopPart} ${kampPart}`;
      }
      return coopPart;
    } catch (_) {
      return '';
    }
  }

  // Info-Tab Inhalt
  renderInfo() {
    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    const formatDate = (date) => (date ? new Date(date).toLocaleDateString('de-DE') : '-');

    const creatorHtml = this.creator ? `
      <div class="detail-card">
        <h3 class="section-title">Creator</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.creator.vorname} ${this.creator.nachname}</span></div>
          <div class="detail-item"><label>E-Mail</label><span>${this.creator.mail || '-'}</span></div>
          <div class="detail-item"><label>Instagram</label><span>${this.creator.instagram ? `@${this.creator.instagram}` : '-'}</span></div>
          <div class="detail-item"><label>Instagram Follower</label><span>${this.creator.instagram_follower ? this.formatNumber(this.creator.instagram_follower) : '-'}</span></div>
          <div class="detail-item"><label>TikTok</label><span>${this.creator.tiktok ? `@${this.creator.tiktok}` : '-'}</span></div>
          <div class="detail-item"><label>TikTok Follower</label><span>${this.creator.tiktok_follower ? this.formatNumber(this.creator.tiktok_follower) : '-'}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/creator/${this.creator.id}')" class="secondary-btn">Creator Details anzeigen</button>
        </div>
      </div>
    ` : '<div class="detail-card"><h3 class="section-title">Creator</h3><p>Keine Creator-Daten</p></div>';

    const kampagneHtml = this.kampagne ? `
      <div class="detail-card">
        <h3 class="section-title">Kampagne</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.kampagne.kampagnenname}</span></div>
          <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kampagne.status?.toLowerCase() || 'unknown'}">${this.kampagne.status || '-'}</span></div>
          <div class="detail-item"><label>Unternehmen</label><span>${this.kampagne.unternehmen?.firmenname || '-'}</span></div>
          <div class="detail-item"><label>Marke</label><span>${this.kampagne.marke?.markenname || '-'}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/kampagne/${this.kampagne.id}')" class="secondary-btn">Kampagne Details anzeigen</button>
        </div>
      </div>
    ` : '<div class="detail-card"><h3 class="section-title">Kampagne</h3><p>Keine Kampagnen-Daten</p></div>';

    return `
      <div class="detail-section">
        <h2>Kooperations-Informationen</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Allgemein</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kooperation.status?.toLowerCase() || 'unknown'}">${this.kooperation.status || '-'}</span></div>
              <div class="detail-item"><label>Einkaufspreis</label><span>${formatCurrency(this.kooperation.einkaufspreis_gesamt)}</span></div>
              <div class="detail-item"><label>Verkaufspreis</label><span>${formatCurrency(this.kooperation.verkaufspreis_gesamt)}</span></div>
              <div class="detail-item"><label>Skript-Deadline</label><span>${formatDate(this.kooperation.skript_deadline)}</span></div>
              <div class="detail-item"><label>Content-Deadline</label><span>${formatDate(this.kooperation.content_deadline)}</span></div>
            </div>
          </div>

          ${creatorHtml}
          ${kampagneHtml}
        </div>
      </div>
    `;
  }

  // Rendere Notizen (einheitlich über NotizenSystem)
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'kooperation', this.kooperationId);
    }
    if (!this.notizen || this.notizen.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `;
    }
    const inner = this.notizen.map(n => `
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${n.user_name || 'Unbekannt'}</span>
          <span>${new Date(n.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="notiz-content"><p>${window.validatorSystem?.sanitizeHtml?.(n.text) || n.text}</p></div>
      </div>
    `).join('');
    return `<div class="notizen-container">${inner}</div>`;
  }

  // Rendere Bewertungen
  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'kooperation', this.kooperationId);
    }
    if (!this.ratings || this.ratings.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden.</p>
        </div>
      `;
    }
    return '';
  }

  // Rendere History (Status-Änderungen)
  renderHistory() {
    if (!this.history || this.history.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;
    }
    const fDateTime = (d) => d ? new Date(d).toLocaleString('de-DE') : '-';
    const rows = this.history.map(h => `
      <tr>
        <td>${fDateTime(h.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.user_name || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.old_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.new_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.comment || '')}</td>
      </tr>
    `).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rechnungen rendern
  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return '<p class="empty-state">Keine Rechnungen zu dieser Kooperation.</p>';
    }
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${fmt(r.nettobetrag)}</td>
        <td>${fmt(r.bruttobetrag)}</td>
        <td>${fDate(r.gestellt_am)}</td>
        <td>${fDate(r.bezahlt_am)}</td>
        <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
      </tr>
    `).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Videos rendern
  renderVideos() {
    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';
    const canUpload = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle === 'mitarbeiter';
    const plannedForKoop = parseInt(this.kooperation?.videoanzahl, 10) || 0;
    const uploadedForKoop = (this.videos || []).length;
    const canAddMore = plannedForKoop === 0 || uploadedForKoop < plannedForKoop;

    const actionsHtml = canEdit && canUpload ? `
      <div class="table-actions" style="margin-bottom: 8px;">
        <div class="table-actions-left"></div>
        <div class="table-actions-right">
          ${canAddMore ? `<button id="btn-goto-video-create" class="primary-btn">Video hinzufügen</button>` : `<button class="secondary-btn" disabled title="Limit erreicht">Limit erreicht</button>`}
        </div>
      </div>` : '';
    if (!this.videos || this.videos.length === 0) {
      return `${actionsHtml}<p class=\"empty-state\">Keine Videos angelegt.</p>`;
    }
    const rows = this.videos.map(v => {
      const formatList = (arr) => {
        if (!arr || arr.length === 0) return '-';
        return arr.map(c => {
          const date = c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '';
          const author = c.author_name || '';
          const text = window.validatorSystem.sanitizeHtml(c.text || '');
          return `<div class="fb-line"><span class="fb-meta">${author}${date ? ' • ' + date : ''}</span><div class="fb-text">${text}</div></div>`;
        }).join('');
      };
      
      // Rollen-Prüfung für Action-Menü
      const userRole = window.currentUser?.rolle;
      const isKunde = userRole === 'kunde';
      const isAdmin = userRole === 'admin';
      const isMitarbeiter = userRole === 'mitarbeiter';
      
      const menu = `
        <div class="actions-dropdown-container" data-entity-type="kooperation_videos">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="actions-dropdown">
            ${!isKunde ? `
            <div class="action-submenu">
              <a href="#" class="action-item has-submenu" data-submenu="status">
                ${actionsDropdown.getHeroIcon('invoice')}
                <span>Status ändern</span>
              </a>
              <div class="submenu" data-submenu="status">
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="produktion" data-id="${v.id}">
                  ${actionsDropdown.getStatusIcon('Kick-Off')}
                  <span>Produktion</span>
                  ${(v.status||'produktion')==='produktion' ? '<span class="submenu-check">✓</span>' : ''}
                </a>
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="abgeschlossen" data-id="${v.id}">
                  ${actionsDropdown.getHeroIcon('check')}
                  <span>Abgeschlossen</span>
                  ${v.status==='abgeschlossen' ? '<span class="submenu-check">✓</span>' : ''}
                </a>
              </div>
            </div>
            ` : ''}
            <a href="#" class="action-item" data-action="video-view" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Details ansehen
            </a>
            ${!isKunde ? `
            <a href="#" class="action-item" data-action="video-edit" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Bearbeiten
            </a>
            ` : ''}
            ${isAdmin ? `
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger" data-action="video-delete" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
            ` : ''}
          </div>
        </div>`;
      return `
        <tr>
          <td>${v.position || '-'}</td>
          <td>${window.validatorSystem.sanitizeHtml(v.content_art || '-')}</td>
          <td>
            ${v.titel ? `<a href="/video/${v.id}" class="table-link" data-table="video" data-id="${v.id}">${window.validatorSystem.sanitizeHtml(v.titel)}</a>`
            : (v.asset_url ? `<a href="${v.asset_url}" target="_blank" rel="noopener">Link</a>` : '-')}
            ${v.currentAsset ? `<span class="version-badge" style="margin-left:8px;">V${v.currentAsset.version_number || 1}</span>` : ''}
          </td>
          <td class="feedback-cell">${formatList(v.feedback1)}</td>
          <td class="feedback-cell">${formatList(v.feedback2)}</td>
          <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
          <td>${menu}</td>
        </tr>`;
    }).join('');
    return `
      ${actionsHtml}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Content Art</th>
              <th>URL</th>
              <th>Feedback K1</th>
              <th>Feedback K2</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Binde Events
  bindEvents() {
    // Tabs
    document.addEventListener('click', (e) => {
      if (e.target.classList?.contains('tab-button')) {
        e.preventDefault();
        this.switchTab(e.target.dataset.tab);
      }
    });

    // Video Tabellen-Link → Detailseite
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.table-link');
      if (!link) return;
      if (link.dataset.table === 'video' && link.dataset.id) {
        e.preventDefault();
        window.navigateTo(`/video/${link.dataset.id}`);
      }
    });

    // Bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-kooperation') {
        e.preventDefault();
        this.showEditForm();
      }
    });

    // Notizen aktualisiert
    window.addEventListener('notizenUpdated', async (e) => {
      if (e.detail.entityType === 'kooperation' && e.detail.entityId === this.kooperationId) {
        this.notizen = await window.notizenSystem.loadNotizen('kooperation', this.kooperationId);
        const pane = document.querySelector('#tab-notizen .detail-section');
        if (pane) pane.innerHTML = `<h2>Notizen</h2>${this.renderNotizen()}`;
        const btn = document.querySelector('.tab-button[data-tab="notizen"] .tab-count');
        if (btn) btn.textContent = String(this.notizen.length);
      }
    });

    // Versand Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'kooperation_versand' && e.detail.kooperation_id == this.kooperationId) {
        // Invalidiere Cache und lade neu
        tabDataCache.invalidate('kooperation', this.kooperationId);
        this.loadCriticalData().then(() => {
          this.render();
          this.bindEvents();
        });
      }
    });

    // Refresh bei Video-Status-Änderung
    window.addEventListener('entityUpdated', async (e) => {
      if (e.detail?.entity === 'kooperation_videos') {
        // Invalidiere Cache und lade Videos neu
        tabDataCache.invalidate('kooperation', this.kooperationId);
        await this.loadVideos();
        this.updateVideosTab();
        // Wenn der Nutzer aktuell die Video-Detailseite offen hat, dort auch neu laden
        if (window.location.pathname.startsWith('/video/')) {
          try {
            const vid = window.location.pathname.split('/').pop();
            if (vid) window.navigateTo(`/video/${vid}`);
          } catch(_) {}
        }
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      // Prüfe ob ein Formular aktiv ist (Edit-Form oder Create-Drawer)
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      
      if (hasActiveForm) {
        console.log('⏸️ KOOPERATIONDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      // Nur wenn auf Kooperation-Detail-Seite
      if (!this.kooperationId || !location.pathname.includes('/kooperation/')) {
        return;
      }
      
      console.log('🔄 KOOPERATIONDETAIL: Soft-Refresh - lade Daten neu');
      tabDataCache.invalidate('kooperation', this.kooperationId);
      await this.loadCriticalData();
      this.render();
      this.bindEvents();
    });

    // Navigation: Neues Video Formular
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-goto-video-create') {
        e.preventDefault();
        window.navigateTo(`/video/new?kooperation=${this.kooperationId}`);
      }
    });

    // Video Actions: view, edit, delete
    document.addEventListener('click', async (e) => {
      const actionItem = e.target.closest('.action-item');
      if (!actionItem) return;
      
      const action = actionItem.dataset.action;
      const videoId = actionItem.dataset.id;
      
      if (action === 'video-view' && videoId) {
        e.preventDefault();
        window.navigateTo(`/video/${videoId}`);
      } else if (action === 'video-edit' && videoId) {
        e.preventDefault();
        // TODO: Video-Edit Formular implementieren
        alert('Video-Bearbeitung noch nicht implementiert');
      } else if (action === 'video-delete' && videoId) {
        e.preventDefault();
        if (!confirm('Video wirklich löschen?')) return;
        try {
          const { error } = await window.supabase
            .from('kooperation_videos')
            .delete()
            .eq('id', videoId);
          if (error) throw error;
          
          // Invalidiere Cache und lade Videos neu
          tabDataCache.invalidate('kooperation', this.kooperationId);
          await this.loadVideos();
          this.updateVideosTab();
        } catch (err) {
          console.error('Video löschen fehlgeschlagen', err);
          alert('Video konnte nicht gelöscht werden.');
        }
      }
    });

    // (kein Inline-Video-Add – separate Implementierung folgt, falls gewünscht)
  }
  
  // Setup automatische Cache-Invalidierung bei Entity-Updates
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'kooperation' && e.detail.id === this.kooperationId) {
        console.log('🔄 KOOPERATIONDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('kooperation', this.kooperationId);
        
        // Optional: Reload kritische Daten bei Updates
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => {
            // Aktualisiere nur die Info-Sektion ohne vollständiges Neu-Rendering
            const infoTab = document.querySelector('#tab-info');
            if (infoTab && infoTab.classList.contains('active')) {
              infoTab.innerHTML = this.renderInfo();
            }
          });
        }
      }
    });
  }

  // Zeige Bearbeitungsformular
  showEditForm() {
    console.log('🎯 KOOPERATIONDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Kooperation bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.kooperation };
    
    // Edit-Mode Flags setzen
    formData._isEditMode = true;
    formData._entityId = this.kooperationId;
    
    // Verknüpfte IDs für das Formular setzen
    if (this.kooperation.unternehmen_id) {
      formData.unternehmen_id = this.kooperation.unternehmen_id;
      console.log('🏢 KOOPERATIONDETAIL: Unternehmen-ID für Edit-Mode:', this.kooperation.unternehmen_id);
    }
    if (this.kooperation.kampagne_id) {
      formData.kampagne_id = this.kooperation.kampagne_id;
      console.log('📋 KOOPERATIONDETAIL: Kampagne-ID für Edit-Mode:', this.kooperation.kampagne_id);
    }
    // Marke-ID aus Kampagne extrahieren (falls vorhanden)
    if (this.kooperation.kampagne && this.kooperation.kampagne.marke && this.kooperation.kampagne.marke.id) {
      formData.marke_id = this.kooperation.kampagne.marke.id;
      console.log('🏷️ KOOPERATIONDETAIL: Marke-ID für Edit-Mode:', this.kooperation.kampagne.marke.id);
    }
    if (this.kooperation.briefing_id) {
      formData.briefing_id = this.kooperation.briefing_id;
      console.log('📄 KOOPERATIONDETAIL: Briefing-ID für Edit-Mode:', this.kooperation.briefing_id);
    }
    if (this.kooperation.creator_id) {
      formData.creator_id = this.kooperation.creator_id;
      console.log('👤 KOOPERATIONDETAIL: Creator-ID für Edit-Mode:', this.kooperation.creator_id);
    }
    
    // Weitere Felder
    if (this.kooperation.content_art) {
      formData.content_art = this.kooperation.content_art;
    }
    if (this.kooperation.skript_autor) {
      formData.skript_autor = this.kooperation.skript_autor;
    }
    
    console.log('📋 KOOPERATIONDETAIL: FormData vorbereitet:', {
      unternehmen_id: formData.unternehmen_id,
      marke_id: formData.marke_id,
      kampagne_id: formData.kampagne_id,
      briefing_id: formData.briefing_id,
      creator_id: formData.creator_id
    });
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kooperation', formData);
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('kooperation', formData);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('kooperation-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      console.log('📝 Kooperation Edit Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kooperation');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Update Kooperation
      const result = await window.dataService.updateEntity('kooperation', this.kooperationId, submitData);
      
      if (result.success) {
        this.showSuccessMessage('Kooperation erfolgreich aktualisiert!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kooperation', action: 'updated', id: this.kooperationId }
        }));
        
        // Zurück zu Details
        setTimeout(() => {
          window.navigateTo(`/kooperation/${this.kooperationId}`);
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Aktualisieren: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Kooperation:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Zeige Notiz Modal
  showAddNotizModal() {
    window.notizenSystem.showAddNotizModal('kooperation', this.kooperationId, () => {
      // Callback nach erfolgreichem Hinzufügen
      this.loadKooperationData().then(() => {
        this.render();
      });
    });
  }

  // Tab wechseln
  async switchTab(tabName) {
    // UI sofort updaten
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
      
      // Lazy load Tab-Daten (außer für bereits geladene Tabs)
      if (!['info', 'notizen', 'ratings', 'versand'].includes(tabName) && tabName !== 'tasks') {
        await this.loadTabData(tabName);
      }
      
      // Initialisiere Kanban Board wenn Tasks-Tab geöffnet wird
      if (tabName === 'tasks' && !this.taskKanbanBoard) {
        await this.initTasksBoard();
      }
    }
  }

  async loadTasksCount() {
    try {
      const { count, error } = await window.supabase
        .from('kooperation_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'kooperation')
        .eq('entity_id', this.kooperationId);
      
      if (!error) {
        this.tasksCount = count || 0;
        const countEl = document.getElementById('tasks-count');
        if (countEl) countEl.textContent = this.tasksCount;
      }
    } catch (err) {
      console.error('Fehler beim Laden der Tasks-Anzahl:', err);
    }
  }

  async initTasksBoard() {
    const container = document.getElementById('tasks-kanban-container');
    if (!container) return;

    console.log('🎯 initTasksBoard: Container gefunden, erstelle Board für Kooperation:', this.kooperationId);

    // Erstelle Board immer neu, um sicherzustellen dass die Entity-Daten korrekt sind
    this.taskKanbanBoard = new TaskKanbanBoard('kooperation', this.kooperationId);
    await this.taskKanbanBoard.init(container);
    
    // Event-Listener für Task-Updates
    window.addEventListener('taskCreated', () => this.loadTasksCount());
    window.addEventListener('taskUpdated', () => this.loadTasksCount());
    window.addEventListener('taskDeleted', () => this.loadTasksCount());
  }

  showNotFound() {
    window.setHeadline('Kooperation nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Kooperation nicht gefunden</h2>
        <p>Die angeforderte Kooperation konnte nicht gefunden werden.</p>
      </div>
    `;
  }

  // Zeige Validierungsfehler
  showValidationErrors(errors) {
    console.error('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        fieldElement.parentNode.appendChild(errorDiv);
      }
    });
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Hilfsfunktionen für Formatierung
  formatNumber(num) {
    if (!num) return '-';
    return new Intl.NumberFormat('de-DE').format(num);
  }

  formatCurrency(amount) {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  }

  // Rendere Versand-Tab
  renderVersand() {
    if (!this.versandDaten || this.versandDaten.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Keine Versand-Daten vorhanden</h3>
          <p>Es wurden noch keine Produkte für diese Kooperation versendet.</p>
          <button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="primary-btn">
            Erstes Produkt versenden
          </button>
        </div>
      `;
    }

    const versandListe = this.versandDaten;
    const creator = this.kooperation?.creator || this.creator; // Verwende Creator aus Kooperation
    
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    const formatAddress = (versand, creator) => {
      // Verwende creator_adresse falls vorhanden, sonst Hauptadresse
      if (versand.creator_adresse) {
        const addr = versand.creator_adresse;
        return `<strong>${addr.adressname}:</strong><br>${addr.strasse || ''} ${addr.hausnummer || ''}, ${addr.plz || ''} ${addr.stadt || ''}, ${addr.land || 'Deutschland'}`;
      } else {
        if (!creator?.lieferadresse_strasse) {
          return 'Keine Adresse hinterlegt';
        }
        return `<strong>Hauptadresse:</strong><br>${creator.lieferadresse_strasse} ${creator.lieferadresse_hausnummer || ''}, ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}, ${creator.lieferadresse_land || 'Deutschland'}`;
      }
    };

    const tableRows = versandListe.map(versand => {
      // Creator-Daten aus Versand-Eintrag oder Fallback auf this.creator
      const versandCreator = versand.kooperation?.creator || creator;
      
      return `
        <tr>
          <td>
            <div class="product-info">
              <div class="product-name">${window.validatorSystem.sanitizeHtml(versand.produkt_name)}</div>
              ${versand.beschreibung ? `<div class="product-desc">${window.validatorSystem.sanitizeHtml(versand.beschreibung)}</div>` : ''}
            </div>
          </td>
          <td class="address-cell">
            <div class="address-compact">
              <div class="address-name">${versandCreator?.vorname || ''} ${versandCreator?.nachname || ''}</div>
              <div class="address-text">${formatAddress(versand, versandCreator)}</div>
            </div>
          </td>
          <td class="text-center">
            <span class="status-badge ${versand.versendet ? 'status-versendet' : 'status-offen'}">
              ${versand.versendet ? 'Versendet' : 'Offen'}
            </span>
          </td>
          <td class="text-center">
            ${versand.tracking_nummer ? `<span class="tracking-number">${versand.tracking_nummer}</span>` : '-'}
          </td>
          <td class="text-center">${formatDate(versand.versand_datum)}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div class="versand-container">
        <div class="section-header">
          <h3>Versand-Übersicht</h3>
          <button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="secondary-btn">
            Neues Produkt versenden
          </button>
        </div>

        <div class="data-table-container">
          <table class="data-table versand-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Lieferadresse</th>
                <th class="text-center">Status</th>
                <th class="text-center">Tracking-Nr</th>
                <th class="text-center">Versand-Datum</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Cleanup
  destroy() {
    console.log('🗑️ KOOPERATIONDETAIL: Destroy aufgerufen - räume auf');
    
    // Invalidiere Tab-Cache für diese Kooperation
    tabDataCache.invalidate('kooperation', this.kooperationId);
    
    // Bestehende Cleanup-Logik
    window.setContentSafely('');
  }
}

// Exportiere Instanz für globale Nutzung
export const kooperationDetail = new KooperationDetail(); 