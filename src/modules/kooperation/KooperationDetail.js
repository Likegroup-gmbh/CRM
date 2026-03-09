// KooperationDetail.js (ES6-Modul)
// Kooperations-Detailseite – migriert auf PersonDetailBase (Standard-Layout)
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { kooperationVersandManager } from './VersandManager.js';
import { TaskKanbanBoard } from '../tasks/TaskKanbanBoard.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class KooperationDetail extends PersonDetailBase {
  constructor() {
    super();
    this.kooperationId = null;
    this.kooperation = null;
    this.returnToRoute = null;
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
    this.activeMainTab = 'informationen';

    // Bound Event Handlers für sauberes Cleanup
    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this._handleNotizenUpdated = this._handleNotizenUpdated.bind(this);
    this._handleEntityUpdated = this._handleEntityUpdated.bind(this);
    this._handleSoftRefresh = this._handleSoftRefresh.bind(this);
    this._handleVideoEntityUpdated = this._handleVideoEntityUpdated.bind(this);
    this._eventsBound = false;
  }

  // ============================================
  // INIT
  // ============================================

  async init(kooperationId) {
    console.log('🎯 KOOPERATIONDETAIL: Initialisiere für ID:', kooperationId);

    const currentUrl = new URL(window.location.href);
    this.returnToRoute = currentUrl.searchParams.get('returnTo') || null;
    this.kooperationId = kooperationId;

    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ KOOPERATIONDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }

    try {
      await this.loadCriticalData();

      if (window.breadcrumbSystem && this.kooperation) {
        const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || false;
        const breadcrumbItems = [];

        if (this.kampagne) {
          breadcrumbItems.push({ label: 'Kampagnen', url: '/kampagne', clickable: true });
          breadcrumbItems.push({
            label: this.kampagne.eigener_name || this.kampagne.kampagnenname || 'Kampagne',
            url: `/kampagne/${this.kampagne.id}`,
            clickable: true
          });
        }

        breadcrumbItems.push({ label: 'Kooperation', url: null, clickable: false });
        breadcrumbItems.push({ label: this.kooperation.name || 'Details', url: `/kooperation/${this.kooperationId}`, clickable: false });

        window.breadcrumbSystem.updateBreadcrumb(breadcrumbItems, {
          id: 'btn-edit-kooperation',
          canEdit: canEdit
        });
      }

      this.render();
      await this.loadTasksCount();
      this.bindEvents();
      this.setupCacheInvalidation();

      console.log('✅ KOOPERATIONDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ KOOPERATIONDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KooperationDetail.init');
    }
  }

  // ============================================
  // DATA LOADING
  // ============================================

  async loadCriticalData() {
    console.log('🔄 KOOPERATIONDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();

    const [
      kooperationResult,
      notizenResult,
      ratingsResult,
      versandResult
    ] = await parallelLoad([
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
            id, kampagnenname, eigener_name, status, deadline, start, creatoranzahl, videoanzahl,
            unternehmen:unternehmen_id ( id, firmenname ),
            marke:marke_id ( id, markenname )
          ),
          unternehmen:unternehmen_id ( id, firmenname )
        `)
        .eq('id', this.kooperationId)
        .single(),
      () => window.notizenSystem.loadNotizen('kooperation', this.kooperationId),
      () => window.bewertungsSystem?.loadBewertungen('kooperation', this.kooperationId).catch(() => []),
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

    if (kooperationResult.error) {
      throw new Error(`Fehler beim Laden der Kooperations-Daten: ${kooperationResult.error.message}`);
    }

    this.kooperation = kooperationResult.data;
    this.creator = kooperationResult.data.creator || null;
    this.kampagne = kooperationResult.data.kampagne || null;
    this.notizen = notizenResult || [];
    this.ratings = ratingsResult || [];
    this.versandDaten = versandResult.data || [];

    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ KOOPERATIONDETAIL: Kritische Daten geladen in ${loadTime}ms`);
  }

  async loadTabData(tabName) {
    return await tabDataCache.load('kooperation', this.kooperationId, tabName, async () => {
      console.log(`🔄 KOOPERATIONDETAIL: Lade Tab-Daten für "${tabName}"`);
      const startTime = performance.now();

      try {
        switch (tabName) {
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

  async loadVideos() {
    try {
      const { data: videos } = await window.supabase
        .from('kooperation_videos')
        .select('id, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, titel, asset_url, kommentar, status, position, created_at')
        .eq('kooperation_id', this.kooperationId)
        .order('position', { ascending: true });

      this.videos = videos || [];

      if (this.videos.length > 0) {
        const videoIds = this.videos.map(v => v.id);
        const { data: assets } = await window.supabase
          .from('kooperation_video_asset')
          .select('id, video_id, file_url, version_number, is_current, created_at')
          .in('video_id', videoIds)
          .eq('is_current', true);

        this.videos = this.videos.map(v => ({
          ...v,
          currentAsset: (assets || []).find(a => a.video_id === v.id) || null
        }));
      }

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
      } catch (err) {
        console.warn('⚠️ Fehler beim Laden der Video-Kommentare:', err?.message);
      }
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Videos:', err?.message);
      this.videos = [];
    }
  }

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

  async loadTasksCount() {
    try {
      const { count, error } = await window.supabase
        .from('kooperation_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'kooperation')
        .eq('entity_id', this.kooperationId);

      if (!error) {
        this.tasksCount = count || 0;
      }
    } catch (err) {
      console.error('Fehler beim Laden der Tasks-Anzahl:', err);
    }
  }

  // ============================================
  // TAB UPDATE HELPERS
  // ============================================

  updateVideosTab() {
    const container = document.querySelector('#tab-videos .detail-section');
    if (container) {
      container.innerHTML = this.renderVideos();
    }
  }

  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen .detail-section');
    if (container) {
      container.innerHTML = this.renderRechnungen();
    }
  }

  updateHistoryTab() {
    const container = document.querySelector('#tab-history .detail-section');
    if (container) {
      container.innerHTML = this.renderHistory();
    }
  }

  // ============================================
  // RENDER – Standard-Layout via PersonDetailBase
  // ============================================

  render() {
    if (!this.kooperation) {
      this.showNotFound();
      return;
    }

    const isKundeRole = window.currentUser?.rolle === 'kunde' || window.currentUser?.rolle === 'kunde_editor';
    const title = this.kooperation.name || 'Kooperation';
    if (window.setHeadline) {
      window.setHeadline(`Kooperation: ${this.sanitize(title)}`);
    }

    const personConfig = this._getPersonConfig();
    const quickActions = this._getQuickActions();
    const sidebarInfo = this._getSidebarInfo();
    const tabNavigation = this.renderTabNavigation(isKundeRole);
    const mainContent = this.renderMainContent(isKundeRole);

    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      tabNavigation,
      mainContent
    });

    window.setContentSafely(window.content, html);
  }

  // ============================================
  // CONFIG HELPERS (shared between render + renderMainContent)
  // ============================================

  _getPersonConfig() {
    const title = this.kooperation?.name || 'Kooperation';
    const creatorName = this.creator
      ? `${this.creator.vorname || ''} ${this.creator.nachname || ''}`.trim()
      : null;

    return {
      name: title,
      email: '',
      subtitle: creatorName ? `Creator: ${creatorName}` : 'Kooperation',
      avatarUrl: null,
      avatarOnly: false
    };
  }

  _getQuickActions() {
    return [];
  }

  _getSidebarInfo() {
    return this.renderInfoItems([
      { icon: 'tag', label: 'Status', value: this.kooperation?.status || '-', badge: true, badgeType: (this.kooperation?.status || 'unknown').toLowerCase() },
      { icon: 'currency', label: 'EK Gesamt', value: this.formatCurrency(this.kooperation?.einkaufspreis_gesamt) },
      { icon: 'currency', label: 'VK Gesamt', value: this.formatCurrency(this.kooperation?.verkaufspreis_gesamt) },
      { icon: 'calendar', label: 'Skript-Deadline', value: this.formatDate(this.kooperation?.skript_deadline) },
      { icon: 'calendar', label: 'Content-Deadline', value: this.formatDate(this.kooperation?.content_deadline) },
      { icon: 'info', label: 'Videoanzahl', value: this.kooperation?.videoanzahl || '-' },
      { icon: 'info', label: 'Content Art', value: this.kooperation?.content_art || '-' },
      { icon: 'building', label: 'Unternehmen', value: this.kooperation?.unternehmen?.firmenname || this.kampagne?.unternehmen?.firmenname || '-' },
      { icon: 'tag', label: 'Marke', value: this.kampagne?.marke?.markenname || '-' },
      { icon: 'info', label: 'Kampagne', value: this.kampagne ? KampagneUtils.getDisplayName(this.kampagne) : '-' }
    ]);
  }

  // ============================================
  // TAB NAVIGATION + MAIN CONTENT
  // ============================================

  getTabsConfig(isKundeRole) {
    const tabs = [
      { tab: 'videos', label: 'Videos', isActive: this.activeMainTab === 'videos' },
      { tab: 'rechnungen', label: 'Rechnungen', isActive: this.activeMainTab === 'rechnungen' },
      { tab: 'versand', label: 'Versand', isActive: this.activeMainTab === 'versand' }
    ];

    if (!isKundeRole) {
      tabs.push({ tab: 'notizen', label: 'Notizen', isActive: this.activeMainTab === 'notizen' });
      tabs.push({ tab: 'ratings', label: 'Bewertungen', isActive: this.activeMainTab === 'ratings' });
      tabs.push({ tab: 'history', label: 'History', isActive: this.activeMainTab === 'history' });
      tabs.push({ tab: 'tasks', label: 'Aufgaben', isActive: this.activeMainTab === 'tasks' });
    }

    return tabs;
  }

  renderTabNavigation(isKundeRole) {
    const tabs = this.getTabsConfig(isKundeRole);
    return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('')}</div></div>`;
  }

  renderMainContent(isKundeRole) {
    const personConfig = this._getPersonConfig();
    const quickActions = this._getQuickActions();
    const sidebarInfo = this._getSidebarInfo();
    const sidebarHtml = this.renderSidebar(personConfig, quickActions, sidebarInfo);

    return `
      <div class="tab-content secondary-tab-content">
        <div class="tab-pane ${this.activeMainTab === 'informationen' ? 'active' : ''}" id="tab-informationen">
          ${sidebarHtml}
          ${this.renderInfoDetails()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'videos' ? 'active' : ''}" id="tab-videos">
          <div class="detail-section">
            ${this.renderVideos()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
          <div class="detail-section">
            ${this.renderRechnungen()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'versand' ? 'active' : ''}" id="tab-versand">
          <div class="detail-section">
            ${this.renderVersand()}
          </div>
        </div>

        ${!isKundeRole ? `
        <div class="tab-pane ${this.activeMainTab === 'notizen' ? 'active' : ''}" id="tab-notizen">
          <div class="detail-section">
            ${this.renderNotizen()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'ratings' ? 'active' : ''}" id="tab-ratings">
          <div class="detail-section">
            ${this.renderRatings()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'history' ? 'active' : ''}" id="tab-history">
          <div class="detail-section">
            ${this.renderHistory()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'tasks' ? 'active' : ''}" id="tab-tasks">
          <div class="detail-section">
            <div id="tasks-kanban-container"></div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  // ============================================
  // INFO TAB (rendered into Sidebar via PersonDetailBase)
  // ============================================

  renderInfoDetails() {
    const allgemeinItems = this.renderInfoItems([
      { icon: 'tag', label: 'Status', value: this.kooperation.status || '-', badge: true, badgeType: (this.kooperation.status || 'unknown').toLowerCase() },
      { icon: 'currency', label: 'Einkaufspreis', value: this.formatCurrency(this.kooperation.einkaufspreis_gesamt) },
      { icon: 'currency', label: 'Verkaufspreis', value: this.formatCurrency(this.kooperation.verkaufspreis_gesamt) },
      { icon: 'calendar', label: 'Skript-Deadline', value: this.formatDate(this.kooperation.skript_deadline) },
      { icon: 'calendar', label: 'Content-Deadline', value: this.formatDate(this.kooperation.content_deadline) }
    ]);

    const creatorHtml = this.creator ? `
      <div class="detail-card">
        <h3 class="section-title">Creator</h3>
        ${this.renderInfoItems([
          { icon: 'user', label: 'Name', value: `${this.creator.vorname || ''} ${this.creator.nachname || ''}`.trim() || '-' },
          { icon: 'mail', label: 'E-Mail', value: this.creator.mail || '-', mailto: !!this.creator.mail },
          { icon: 'instagram', label: 'Instagram', value: this.creator.instagram ? `@${this.creator.instagram}` : '-' },
          { icon: 'info', label: 'Instagram Follower', value: this.creator.instagram_follower ? this.formatNumber(this.creator.instagram_follower) : '-' },
          { icon: 'tiktok', label: 'TikTok', value: this.creator.tiktok ? `@${this.creator.tiktok}` : '-' },
          { icon: 'info', label: 'TikTok Follower', value: this.creator.tiktok_follower ? this.formatNumber(this.creator.tiktok_follower) : '-' }
        ])}
        <div class="detail-actions">
          <button onclick="window.navigateTo('/creator/${this.creator.id}')" class="secondary-btn">Creator Details anzeigen</button>
        </div>
      </div>
    ` : '';

    const kampagneHtml = this.kampagne ? `
      <div class="detail-card">
        <h3 class="section-title">Kampagne</h3>
        ${this.renderInfoItems([
          { icon: 'info', label: 'Name', value: KampagneUtils.getDisplayName(this.kampagne) },
          { icon: 'tag', label: 'Status', value: this.kampagne.status || '-', badge: true, badgeType: (this.kampagne.status || 'unknown').toLowerCase() },
          { icon: 'building', label: 'Unternehmen', value: this.kampagne.unternehmen?.firmenname || '-' },
          { icon: 'tag', label: 'Marke', value: this.kampagne.marke?.markenname || '-' }
        ])}
        <div class="detail-actions">
          <button onclick="window.navigateTo('/kampagne/${this.kampagne.id}')" class="secondary-btn">Kampagne Details anzeigen</button>
        </div>
      </div>
    ` : '';

    return `
      <div class="detail-section">
        <h2>Kooperations-Informationen</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Allgemein</h3>
            ${allgemeinItems}
          </div>
          ${creatorHtml}
          ${kampagneHtml}
        </div>
      </div>
    `;
  }

  // ============================================
  // TAB CONTENT RENDERERS
  // ============================================

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

  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'kooperation', this.kooperationId);
    }
    if (!this.notizen || this.notizen.length === 0) {
      return '<div class="empty-state"><p>Keine Notizen vorhanden</p></div>';
    }
    const inner = this.notizen.map(n => `
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${n.user_name || 'Unbekannt'}</span>
          <span>${new Date(n.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="notiz-content"><p>${this.sanitize(n.text)}</p></div>
      </div>
    `).join('');
    return `<div class="notizen-container">${inner}</div>`;
  }

  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'kooperation', this.kooperationId);
    }
    if (!this.ratings || this.ratings.length === 0) {
      return '<div class="empty-state"><p>Keine Bewertungen vorhanden.</p></div>';
    }
    return '';
  }

  renderHistory() {
    if (!this.history || this.history.length === 0) {
      return '<div class="empty-state"><p>Keine Historie vorhanden</p></div>';
    }
    const fDateTime = (d) => d ? new Date(d).toLocaleString('de-DE') : '-';
    const rows = this.history.map(h => `
      <tr>
        <td>${fDateTime(h.created_at)}</td>
        <td>${this.sanitize(h.user_name || '-')}</td>
        <td>${this.sanitize(h.old_status || '-')}</td>
        <td>${this.sanitize(h.new_status || '-')}</td>
        <td>${this.sanitize(h.comment || '')}</td>
      </tr>
    `).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Zeitpunkt</th><th>User</th><th>Alt</th><th>Neu</th><th>Kommentar</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return '<p class="empty-state">Keine Rechnungen zu dieser Kooperation.</p>';
    }
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${this.sanitize(r.rechnung_nr || '—')}</a></td>
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
          <thead><tr><th>Rechnungs-Nr</th><th>Status</th><th>Netto</th><th>Brutto</th><th>Gestellt</th><th>Bezahlt</th><th>Beleg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

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
      return `${actionsHtml}<p class="empty-state">Keine Videos angelegt.</p>`;
    }

    const isKundeRole = window.currentUser?.rolle === 'kunde' || window.currentUser?.rolle === 'kunde_editor';

    const rows = this.videos.map(v => {
      const formatList = (arr) => {
        if (!arr || arr.length === 0) return '-';
        return arr.map(c => {
          const date = c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '';
          const author = c.author_name || '';
          const text = this.sanitize(c.text || '');
          return `<div class="fb-line"><span class="fb-meta">${author}${date ? ' • ' + date : ''}</span><div class="fb-text">${text}</div></div>`;
        }).join('');
      };

      const userRole = window.currentUser?.rolle;
      const isKunde = userRole === 'kunde';
      const isAdmin = userRole === 'admin';

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
                  ${(v.status || 'produktion') === 'produktion' ? '<span class="submenu-check">✓</span>' : ''}
                </a>
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="abgeschlossen" data-id="${v.id}">
                  ${actionsDropdown.getHeroIcon('check')}
                  <span>Abgeschlossen</span>
                  ${v.status === 'abgeschlossen' ? '<span class="submenu-check">✓</span>' : ''}
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

      const vkFormatted = v.verkaufspreis_netto != null ? parseFloat(v.verkaufspreis_netto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-';
      const ekFormatted = v.einkaufspreis_netto != null ? parseFloat(v.einkaufspreis_netto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-';

      return `
        <tr>
          <td>${v.position || '-'}</td>
          <td>${this.sanitize(v.kampagnenart || '-')}</td>
          <td>${this.sanitize(v.content_art || '-')}</td>
          <td class="text-right">${vkFormatted}</td>
          ${!isKundeRole ? `<td class="text-right">${ekFormatted}</td>` : ''}
          <td>
            ${v.titel ? `<a href="/video/${v.id}" class="table-link" data-table="video" data-id="${v.id}">${this.sanitize(v.titel)}</a>`
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
              <th>Kampagnenart</th>
              <th>Content Art</th>
              <th class="text-right">VK Netto</th>
              ${!isKundeRole ? '<th class="text-right">EK Netto</th>' : ''}
              <th>URL</th>
              <th>Feedback K1</th>
              <th>Feedback K2</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:right; font-weight:600;">Gesamt VK Netto:</td>
              <td class="text-right" style="font-weight:600;">${(this.videos || []).reduce((s, v) => s + (parseFloat(v.verkaufspreis_netto) || 0), 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
              <td colspan="${!isKundeRole ? '6' : '5'}"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  renderVersand() {
    const isKunde = window.currentUser?.rolle === 'kunde' || window.currentUser?.rolle === 'kunde_editor';

    if (!this.versandDaten || this.versandDaten.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Versand-Daten vorhanden</h3>
          <p>Es wurden noch keine Produkte für diese Kooperation versendet.</p>
          ${!isKunde ? `<button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="primary-btn">Erstes Produkt versenden</button>` : ''}
        </div>
      `;
    }

    const creator = this.kooperation?.creator || this.creator;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    const formatAddress = (versand, cr) => {
      if (versand.creator_adresse) {
        const addr = versand.creator_adresse;
        return `<strong>${addr.adressname}:</strong><br>${addr.strasse || ''} ${addr.hausnummer || ''}, ${addr.plz || ''} ${addr.stadt || ''}, ${addr.land || 'Deutschland'}`;
      }
      if (!cr?.lieferadresse_strasse) return 'Keine Adresse hinterlegt';
      return `<strong>Hauptadresse:</strong><br>${cr.lieferadresse_strasse} ${cr.lieferadresse_hausnummer || ''}, ${cr.lieferadresse_plz || ''} ${cr.lieferadresse_stadt || ''}, ${cr.lieferadresse_land || 'Deutschland'}`;
    };

    const tableRows = this.versandDaten.map(versand => {
      const versandCreator = versand.kooperation?.creator || creator;
      return `
        <tr>
          <td>
            <div class="product-info">
              <div class="product-name">${this.sanitize(versand.produkt_name)}</div>
              ${versand.beschreibung ? `<div class="product-desc">${this.sanitize(versand.beschreibung)}</div>` : ''}
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
          ${!isKunde ? `<button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="secondary-btn">Neues Produkt versenden</button>` : ''}
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
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============================================
  // EVENT BINDING (robust, mit .closest())
  // ============================================

  async _handleDocumentClick(e) {
    // Tab-Button (robust via closest)
    const tabBtn = e.target.closest('.tab-button');
    if (tabBtn) {
      e.preventDefault();
      const tab = tabBtn.dataset.tab;
      if (tab) {
        this.activeMainTab = tab;
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`tab-${tab}`);
        if (pane) {
          pane.classList.add('active');
          if (!['notizen', 'ratings', 'versand'].includes(tab) && tab !== 'tasks') {
            await this.loadTabData(tab);
          }
          if (tab === 'tasks' && !this.taskKanbanBoard) {
            await this.initTasksBoard();
          }
        }
      }
      return;
    }

    // Video table-link
    const tableLink = e.target.closest('.table-link');
    if (tableLink && tableLink.dataset.table === 'video' && tableLink.dataset.id) {
      e.preventDefault();
      window.navigateTo(`/video/${tableLink.dataset.id}`);
      return;
    }

    // Edit button
    if (e.target.closest('#btn-edit-kooperation')) {
      e.preventDefault();
      this.showEditForm();
      return;
    }

    // Video create
    if (e.target.closest('#btn-goto-video-create')) {
      e.preventDefault();
      window.navigateTo(`/video/new?kooperation=${this.kooperationId}`);
      return;
    }

    // Video Actions: view, edit, delete
    const actionItem = e.target.closest('.action-item');
    if (actionItem) {
      const action = actionItem.dataset.action;
      const videoId = actionItem.dataset.id;

      if (action === 'video-view' && videoId) {
        e.preventDefault();
        window.navigateTo(`/video/${videoId}`);
      } else if (action === 'video-edit' && videoId) {
        e.preventDefault();
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
          tabDataCache.invalidate('kooperation', this.kooperationId);
          await this.loadVideos();
          this.updateVideosTab();
        } catch (err) {
          console.error('Video löschen fehlgeschlagen', err);
          alert('Video konnte nicht gelöscht werden.');
        }
      }
    }
  }

  async _handleNotizenUpdated(e) {
    if (e.detail.entityType === 'kooperation' && e.detail.entityId === this.kooperationId) {
      this.notizen = await window.notizenSystem.loadNotizen('kooperation', this.kooperationId);
      const pane = document.querySelector('#tab-notizen .detail-section');
      if (pane) pane.innerHTML = this.renderNotizen();
    }
  }

  _handleEntityUpdated(e) {
    if (e.detail.entity === 'kooperation_versand' && e.detail.kooperation_id == this.kooperationId) {
      tabDataCache.invalidate('kooperation', this.kooperationId);
      this.loadCriticalData().then(() => {
        this.render();
        this.bindEvents();
      });
    }

    if (e.detail?.entity === 'kooperation' && e.detail?.id === this.kooperationId) {
      console.log('🔄 KOOPERATIONDETAIL: Entity updated - invalidiere Cache');
      tabDataCache.invalidate('kooperation', this.kooperationId);
      if (e.detail.action === 'updated') {
        this.loadCriticalData().then(() => {
          const infoTab = document.querySelector('#tab-informationen');
          if (infoTab && infoTab.classList.contains('active')) {
            infoTab.innerHTML = this.renderInfoDetails();
          }
        });
      }
    }
  }

  async _handleVideoEntityUpdated(e) {
    if (e.detail?.entity === 'kooperation_videos') {
      tabDataCache.invalidate('kooperation', this.kooperationId);
      await this.loadVideos();
      this.updateVideosTab();
    }
  }

  async _handleSoftRefresh() {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) return;
    if (!this.kooperationId || !location.pathname.includes('/kooperation/')) return;

    console.log('🔄 KOOPERATIONDETAIL: Soft-Refresh');
    tabDataCache.invalidate('kooperation', this.kooperationId);
    await this.loadCriticalData();
    this.render();
    this.bindEvents();
  }

  bindEvents() {
    this.bindSidebarTabs();

    if (this._eventsBound) return;
    this._eventsBound = true;

    document.addEventListener('click', this._handleDocumentClick);
    window.addEventListener('notizenUpdated', this._handleNotizenUpdated);
    window.addEventListener('entityUpdated', this._handleEntityUpdated);
    window.addEventListener('entityUpdated', this._handleVideoEntityUpdated);
    window.addEventListener('softRefresh', this._handleSoftRefresh);

    console.log('✅ KOOPERATIONDETAIL: Event-Listener registriert');
  }

  // ============================================
  // TASKS
  // ============================================

  async initTasksBoard() {
    const container = document.getElementById('tasks-kanban-container');
    if (!container) return;

    console.log('🎯 initTasksBoard: Erstelle Board für Kooperation:', this.kooperationId);
    this.taskKanbanBoard = new TaskKanbanBoard('kooperation', this.kooperationId);
    await this.taskKanbanBoard.init(container);

    window.addEventListener('taskCreated', () => this.loadTasksCount());
    window.addEventListener('taskUpdated', () => this.loadTasksCount());
    window.addEventListener('taskDeleted', () => this.loadTasksCount());
  }

  // ============================================
  // EDIT FORM
  // ============================================

  showEditForm() {
    console.log('🎯 KOOPERATIONDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Kooperation bearbeiten');

    if (window.breadcrumbSystem && this.kooperation) {
      const breadcrumbItems = [];
      if (this.kampagne) {
        breadcrumbItems.push({ label: 'Kampagnen', url: '/kampagne', clickable: true });
        breadcrumbItems.push({
          label: this.kampagne.eigener_name || this.kampagne.kampagnenname || 'Kampagne',
          url: `/kampagne/${this.kampagne.id}`,
          clickable: true
        });
      }
      breadcrumbItems.push({ label: 'Kooperation', url: null, clickable: false });
      breadcrumbItems.push({ label: this.kooperation.name || 'Details', url: `/kooperation/${this.kooperationId}`, clickable: true });
      breadcrumbItems.push({ label: 'Bearbeiten', url: null, clickable: false });
      window.breadcrumbSystem.updateBreadcrumb(breadcrumbItems, { canEdit: false });
    }

    const formData = { ...this.kooperation };
    formData._isEditMode = true;
    formData._entityId = this.kooperationId;

    if (this.kooperation.unternehmen_id) formData.unternehmen_id = this.kooperation.unternehmen_id;
    if (this.kooperation.kampagne_id) formData.kampagne_id = this.kooperation.kampagne_id;
    if (this.kooperation.kampagne?.marke?.id) formData.marke_id = this.kooperation.kampagne.marke.id;
    if (this.kooperation.briefing_id) formData.briefing_id = this.kooperation.briefing_id;
    if (this.kooperation.creator_id) formData.creator_id = this.kooperation.creator_id;
    if (this.kooperation.content_art) formData.content_art = this.kooperation.content_art;
    if (this.kooperation.skript_autor) formData.skript_autor = this.kooperation.skript_autor;

    const formHtml = window.formSystem.renderFormOnly('kooperation', formData);
    window.content.innerHTML = `<div class="form-page">${formHtml}</div>`;
    window.formSystem.bindFormEvents('kooperation', formData);

    const form = document.getElementById('kooperation-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('kooperation-form');
      const formData = new FormData(form);
      const submitData = {};

      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) submitData[cleanKey] = [];
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      const validationResult = window.validatorSystem.validateForm(submitData, 'kooperation');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      if (window.formSystem) {
        const videoLimitValidation = await window.formSystem.validateKooperationVideoLimit(form, submitData, this.kooperationId);
        if (!videoLimitValidation.isValid) {
          this.showErrorMessage(videoLimitValidation.message);
          return;
        }
      }

      const result = await window.dataService.updateEntity('kooperation', this.kooperationId, submitData);

      if (result.success) {
        if (window.formSystem) {
          await window.formSystem.handleKooperationVideos(this.kooperationId, form);
        }

        this.showSuccessMessage('Kooperation erfolgreich aktualisiert!');
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kooperation', action: 'updated', id: this.kooperationId }
        }));

        setTimeout(() => {
          window.navigateTo(this.returnToRoute || `/kooperation/${this.kooperationId}`);
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Aktualisieren: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Kooperation:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  showNotFound() {
    window.setHeadline('Kooperation nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Kooperation nicht gefunden</h2>
        <p>Die angeforderte Kooperation konnte nicht gefunden werden.</p>
      </div>
    `;
  }

  showValidationErrors(errors) {
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
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

  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      setTimeout(() => alertDiv.remove(), 5000);
    }
  }

  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    const form = document.getElementById('kooperation-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      setTimeout(() => alertDiv.remove(), 5000);
    }
  }

  showAddNotizModal() {
    window.notizenSystem.showAddNotizModal('kooperation', this.kooperationId, () => {
      this.loadCriticalData().then(() => {
        this.render();
      });
    });
  }

  formatNumber(num) {
    if (!num) return '-';
    return new Intl.NumberFormat('de-DE').format(num);
  }

  setupCacheInvalidation() {
    // Handled in _handleEntityUpdated
  }

  // ============================================
  // CLEANUP (single consolidated destroy)
  // ============================================

  destroy() {
    console.log('🗑️ KOOPERATIONDETAIL: Destroy aufgerufen - räume auf');

    if (this._eventsBound) {
      document.removeEventListener('click', this._handleDocumentClick);
      window.removeEventListener('notizenUpdated', this._handleNotizenUpdated);
      window.removeEventListener('entityUpdated', this._handleEntityUpdated);
      window.removeEventListener('entityUpdated', this._handleVideoEntityUpdated);
      window.removeEventListener('softRefresh', this._handleSoftRefresh);
      this._eventsBound = false;
      console.log('✅ KOOPERATIONDETAIL: Event-Listener entfernt');
    }

    if (this.taskKanbanBoard) {
      this.taskKanbanBoard.destroy?.();
      this.taskKanbanBoard = null;
    }

    tabDataCache.invalidate('kooperation', this.kooperationId);
    window.setContentSafely('');
    console.log('✅ KOOPERATIONDETAIL: Destroy abgeschlossen');
  }
}

export const kooperationDetail = new KooperationDetail();
