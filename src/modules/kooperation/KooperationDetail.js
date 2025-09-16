// KooperationDetail.js (ES6-Modul)
// Kooperations-Detailseite mit allen relevanten Informationen
import { actionsDropdown } from '../../core/ActionsDropdown.js';

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
      // Lade alle Kooperations-Daten
      await this.loadKooperationData();
      
      // Rendere die Seite
      await this.render();
      
      // Binde Events
      this.bindEvents();
      
      console.log('✅ KOOPERATIONDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ KOOPERATIONDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KooperationDetail.init');
    }
  }

  // Lade alle Kooperations-Daten
  async loadKooperationData() {
    console.log('🔄 KOOPERATIONDETAIL: Lade Kooperations-Daten...');
    
    // Kooperations-Basisdaten laden (inkl. Relationen)
    const { data: kooperation, error } = await window.supabase
      .from('kooperationen')
      .select(`
        id, name, status, nettobetrag, zusatzkosten, gesamtkosten, skript_deadline, content_deadline, videoanzahl,
        creator_id, kampagne_id, unternehmen_id,
        creator:creator_id ( id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, mail ),
        kampagne:kampagne_id (
          id, kampagnenname, status, deadline, start, creatoranzahl, videoanzahl,
          unternehmen:unternehmen_id ( id, firmenname ),
          marke:marke_id ( id, markenname )
        ),
        unternehmen:unternehmen_id ( id, firmenname )
      `)
      .eq('id', this.kooperationId)
      .single();

    if (error) {
      throw new Error(`Fehler beim Laden der Kooperations-Daten: ${error.message}`);
    }

    this.kooperation = kooperation;
    console.log('✅ KOOPERATIONDETAIL: Kooperations-Basisdaten geladen:', kooperation);

    // Notizen über NotizenSystem laden
    this.notizen = await window.notizenSystem.loadNotizen('kooperation', this.kooperationId);
    console.log('✅ KOOPERATIONDETAIL: Notizen geladen:', this.notizen.length);

    // Bewertungen über BewertungsSystem laden (Kooperation speichert Rating direkt)
    if (window.bewertungsSystem) {
      try {
        this.ratings = await window.bewertungsSystem.loadBewertungen('kooperation', this.kooperationId);
      } catch (_) {
        this.ratings = [];
      }
    } else {
      this.ratings = [];
    }

    // Creator-Daten aus Relation
    this.creator = kooperation.creator || null;

    // Kampagnen-Daten aus Relation
    this.kampagne = kooperation.kampagne || null;

    // Rechnungen zur Kooperation laden
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

    // Videos laden
    try {
      const { data: videos } = await window.supabase
        .from('kooperation_videos')
        .select('id, content_art, titel, asset_url, kommentar, status, position, created_at')
        .eq('kooperation_id', this.kooperationId)
        .order('position', { ascending: true });
      this.videos = videos || [];
      // Kampagnen-Kontingent (geplante Videos) aggregieren
      try {
        const kampId = kooperation?.kampagne?.id || kooperation?.kampagne_id;
        if (kampId) {
          const { data: koopCounts } = await window.supabase
            .from('kooperationen')
            .select('videoanzahl')
            .eq('kampagne_id', kampId);
          const used = (koopCounts || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
          const total = parseInt(kooperation?.kampagne?.videoanzahl, 10) || null;
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
            .select('id, video_id, runde, text, created_at, author_name')
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

    // History (Statuswechsel) laden
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

  // Rendere Kooperations-Detailseite mit Tabs
  async render() {
    if (!this.kooperation) {
      this.showNotFound();
      return;
    }

    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || false;
    const title = this.kooperation.name || 'Kooperation';
    if (window.setHeadline) {
      window.setHeadline(`Kooperation: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);
    }

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(title)}</h1>
          <p>Kooperations-Details und Aktivitäten</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
          ${canEdit ? '<button id="btn-edit-kooperation" class="primary-btn">Bearbeiten</button>' : ''}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="videos">
            <i class="icon-film"></i>
            Videos <span class="tab-count">${this.videos.length}</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="history">
            
            History <span class="tab-count">${this.historyCount}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen <span class="tab-count">${this.rechnungen.length}</span>
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
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
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
        <h3>Creator</h3>
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
    ` : '<div class="detail-card"><h3>Creator</h3><p>Keine Creator-Daten</p></div>';

    const kampagneHtml = this.kampagne ? `
      <div class="detail-card">
        <h3>Kampagne</h3>
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
    ` : '<div class="detail-card"><h3>Kampagne</h3><p>Keine Kampagnen-Daten</p></div>';

    return `
      <div class="detail-section">
        <h2>Kooperations-Informationen</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kooperation.status?.toLowerCase() || 'unknown'}">${this.kooperation.status || '-'}</span></div>
              <div class="detail-item"><label>Budget</label><span>${formatCurrency(this.kooperation.gesamtkosten ?? ((this.kooperation.nettobetrag||0) + (this.kooperation.zusatzkosten||0)))}</span></div>
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
    const plannedForKoop = parseInt(this.kooperation?.videoanzahl, 10) || 0;
    const uploadedForKoop = (this.videos || []).length;
    const canAddMore = plannedForKoop === 0 || uploadedForKoop < plannedForKoop;

    const actionsHtml = canEdit ? `
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
      const menu = `
        <div class="actions-dropdown-container" data-entity-type="kooperation_videos">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="actions-dropdown">
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
            <a href="#" class="action-item" data-action="video-view" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Details ansehen
            </a>
            <a href="#" class="action-item" data-action="video-edit" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Bearbeiten
            </a>
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger" data-action="video-delete" data-id="${v.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
          </div>
        </div>`;
      return `
        <tr>
          <td>${v.position || '-'}</td>
          <td>${window.validatorSystem.sanitizeHtml(v.content_art || '-')}</td>
          <td>
            ${v.titel ? `<a href="/video/${v.id}" class="table-link" data-table="video" data-id="${v.id}">${window.validatorSystem.sanitizeHtml(v.titel)}</a>`
            : (v.asset_url ? `<a href="${v.asset_url}" target="_blank" rel="noopener">Link</a>` : '-')}
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

    // Refresh bei Video-Status-Änderung
    window.addEventListener('entityUpdated', async (e) => {
      if (e.detail?.entity === 'kooperation_videos') {
        await this.loadKooperationData();
        const pane = document.querySelector('#tab-videos .detail-section');
        if (pane) pane.innerHTML = `<h2>Videos</h2>${this.renderVideos()}`;
        // Wenn der Nutzer aktuell die Video-Detailseite offen hat, dort auch neu laden
        if (window.location.pathname.startsWith('/video/')) {
          try {
            const vid = window.location.pathname.split('/').pop();
            if (vid) window.navigateTo(`/video/${vid}`);
          } catch(_) {}
        }
      }
    });

    // Navigation: Neues Video Formular
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-goto-video-create') {
        e.preventDefault();
        window.navigateTo(`/video/new?kooperation=${this.kooperationId}`);
      }
    });

    // (kein Inline-Video-Add – separate Implementierung folgt, falls gewünscht)
  }

  // Zeige Bearbeitungsformular
  showEditForm() {
    console.log('🎯 Zeige Kooperations-Bearbeitungsformular');
    window.setHeadline('Kooperation bearbeiten');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kooperation', this.kooperation);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperation bearbeiten</h1>
          <p>Bearbeiten Sie die Kooperations-Details</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation/${this.kooperationId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('kooperation', this.kooperationId);
    
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
  switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
    }
  }

  showNotFound() {
    window.setHeadline('Kooperation nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Kooperation nicht gefunden</h2>
        <p>Die angeforderte Kooperation konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/kooperation')" class="primary-btn">Zurück zur Übersicht</button>
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

  // Cleanup
  destroy() {
    console.log('KooperationDetail: Cleaning up...');
  }
}

// Exportiere Instanz für globale Nutzung
export const kooperationDetail = new KooperationDetail(); 