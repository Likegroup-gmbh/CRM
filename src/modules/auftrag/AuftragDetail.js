// AuftragDetail.js (ES6-Modul)
// Auftrags-Detailseite mit Tabs für Informationen, Notizen, Bewertungen und Creator

import { KAMPAGNENARTEN_MAPPING } from './logic/KampagnenartenMapping.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class AuftragDetail extends PersonDetailBase {
  constructor() {
    super();
    this.auftragId = null;
    this.auftrag = null;
    this.notizen = [];
    this.ratings = [];
    this.creator = [];
    this.marke = null;
    this.unternehmen = null;
    this.rechnungen = [];
    this.rechnungSummary = { count: 0, sumNetto: 0, sumBrutto: 0, paidCount: 0, openCount: 0 };
    this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
    this.auftragsDetails = null;
    this.realVideoCount = 0;
    this.realCreatorCount = 0;
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.activeMainTab = 'uebersicht';
    this._eventsBound = false;
    this._isLoading = false;

    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this._handleEntityUpdated = this._handleEntityUpdated.bind(this);
    this._handleSoftRefresh = this._handleSoftRefresh.bind(this);
  }

  // Initialisiere Auftrags-Detailseite
  async init(auftragId) {
    console.log('🎯 AUFTRAGDETAIL: Initialisiere Auftrags-Detailseite für ID:', auftragId);
    
    try {
      this.auftragId = auftragId;
      this.activeMainTab = 'uebersicht';
      this._finanzenLoaded = false;
      tabDataCache.invalidate('auftrag', auftragId);
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.auftrag) {
        const canEdit = window.currentUser?.permissions?.auftrag?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftrag', url: '/auftrag', clickable: true },
          { label: this.auftrag.auftragsname || 'Details', url: `/auftrag/${this.auftragId}`, clickable: false }
        ], {
          id: 'btn-edit-auftrag',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ AUFTRAGDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragDetail.init');
    }
  }

  async _handleDocumentClick(e) {
    const tabBtn = e.target.closest('.tab-button');
    if (tabBtn) {
      e.preventDefault();
      const tabName = tabBtn.dataset.tab;
      if (!tabName) return;
      this.switchTab(tabName);
      return;
    }

    if (e.target.closest('#btn-edit-auftrag')) {
      this.showEditForm();
      return;
    }

    const link = e.target.closest('.table-link');
    if (link && link.dataset.table && link.dataset.id) {
      e.preventDefault();
      window.navigateTo(`/${link.dataset.table}/${link.dataset.id}`);
    }
  }

  async _refreshDetailView() {
    if (this._isLoading || !this.auftragId) return;
    this._isLoading = true;

    try {
      await this.loadCriticalData();
      this.render();
      await this.loadTabData(this.activeMainTab);
    } finally {
      this._isLoading = false;
    }
  }

  _handleEntityUpdated(e) {
    if (e.type === 'notizenUpdated' || e.type === 'bewertungenUpdated') {
      this._refreshDetailView();
      return;
    }

    const entity = e.detail?.entity;
    const isRelevantAuftrag = entity === 'auftrag' && e.detail?.id === this.auftragId;
    const isRelevantDetails = entity === 'auftrag_details' && e.detail?.auftrag_id === this.auftragId;

    if (!isRelevantAuftrag && !isRelevantDetails) return;

    console.log('🔄 AUFTRAGDETAIL: Entity updated - invalidiere Cache');
    tabDataCache.invalidate('auftrag', this.auftragId);
    this._refreshDetailView();
  }

  async _handleSoftRefresh() {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) {
      console.log('⏸️ AUFTRAGDETAIL: Formular aktiv - Soft-Refresh übersprungen');
      return;
    }

    if (!this.auftragId || !location.pathname.includes('/auftrag/')) {
      return;
    }

    console.log('🔄 AUFTRAGDETAIL: Soft-Refresh - lade Daten neu');
    await this._refreshDetailView();
  }

  // Lade kritische Daten parallel
  async loadCriticalData() {
    console.log('🔄 AUFTRAGDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        auftragResult,
        notizenResult,
        ratingsResult,
        creatorResult,
        mitarbeiterResult,
        cutterResult,
        copywriterResult,
        auftragsDetailsResult,
        artDerKampagneResult
      ] = await parallelLoad([
        // 1. Auftrags-Basisdaten mit Relations
        () => window.supabase
          .from('auftrag')
          .select(`
            *,
            marke:marke_id(markenname),
            unternehmen:unternehmen_id(firmenname)
          `)
          .eq('id', this.auftragId)
          .single(),
        
        // 2. Notizen
        () => window.notizenSystem ? 
          window.notizenSystem.loadNotizen('auftrag', this.auftragId) : 
          Promise.resolve([]),
        
        // 3. Ratings
        () => window.bewertungsSystem ? 
          window.bewertungsSystem.loadBewertungen('auftrag', this.auftragId) : 
          Promise.resolve([]),
        
        // 4. Creator
        () => window.supabase
          .from('creator_auftrag')
          .select(`creator:creator_id(*)`)
          .eq('auftrag_id', this.auftragId),
        
        // 5. Mitarbeiter
        () => window.supabase
          .from('auftrag_mitarbeiter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 6. Cutter
        () => window.supabase
          .from('auftrag_cutter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 7. Copywriter
        () => window.supabase
          .from('auftrag_copywriter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 8. Auftragsdetails
        () => window.supabase
          .from('auftrag_details')
          .select('*')
          .eq('auftrag_id', this.auftragId)
          .maybeSingle(),
        
        // 9. Art der Kampagne aus Junction-Table
        () => window.supabase
          .from('auftrag_kampagne_art')
          .select('kampagne_art_id')
          .eq('auftrag_id', this.auftragId)
      ]);
      
      // Daten verarbeiten
      if (auftragResult.error) throw auftragResult.error;
      this.auftrag = auftragResult.data;
      
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];
      
      // Creator verarbeiten
      if (!creatorResult.error) {
        this.creator = creatorResult.data?.map(item => item.creator) || [];
      }
      
      // Mitarbeiter-IDs sammeln und parallel laden
      const mitarbeiterIds = mitarbeiterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      const cutterIds = cutterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      const copywriterIds = copywriterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      
      // Alle Benutzer-IDs sammeln (unique)
      const allIds = [...new Set([...mitarbeiterIds, ...cutterIds, ...copywriterIds])];
      
      // Benutzer parallel laden
      if (allIds.length > 0) {
        const { data: benutzerData } = await window.supabase
          .from('benutzer')
          .select('id, name')
          .in('id', allIds);
        
        const benutzerMap = (benutzerData || []).reduce((acc, b) => { acc[b.id] = b; return acc; }, {});
        
        this.auftrag.mitarbeiter = mitarbeiterIds.map(id => benutzerMap[id]).filter(Boolean);
        this.auftrag.cutter = cutterIds.map(id => benutzerMap[id]).filter(Boolean);
        this.auftrag.copywriter = copywriterIds.map(id => benutzerMap[id]).filter(Boolean);
      } else {
        this.auftrag.mitarbeiter = [];
        this.auftrag.cutter = [];
        this.auftrag.copywriter = [];
      }
      
      // Ansprechpartner laden (falls vorhanden)
      if (this.auftrag.ansprechpartner_id) {
        try {
          const { data: ansprechpartnerData } = await window.supabase
            .from('ansprechpartner')
            .select('id, vorname, nachname, email')
            .eq('id', this.auftrag.ansprechpartner_id)
            .single();
          
          if (ansprechpartnerData) {
            this.auftrag.ansprechpartner = ansprechpartnerData;
          }
        } catch (e) {
          console.warn('⚠️ AUFTRAGDETAIL: Fehler beim Laden des Ansprechpartners:', e);
        }
      }
      
      // Auftragsdetails verarbeiten
      if (!auftragsDetailsResult.error) {
        this.auftragsDetails = auftragsDetailsResult.data;
      } else {
        this.auftragsDetails = null;
      }
      
      // Art der Kampagne verarbeiten (aus Junction-Table) und Namen laden
      if (!artDerKampagneResult.error && artDerKampagneResult.data) {
        const kampagneArtIds = artDerKampagneResult.data.map(item => item.kampagne_art_id).filter(Boolean);
        this.auftrag.art_der_kampagne = kampagneArtIds;
        
        // Namen der Kampagnenarten laden
        if (kampagneArtIds.length > 0) {
          const { data: kampagneArtTypen } = await window.supabase
            .from('kampagne_art_typen')
            .select('id, name')
            .in('id', kampagneArtIds);
          
          this.auftrag.art_der_kampagne_namen = (kampagneArtTypen || []).map(t => t.name);
          console.log('🎨 AUFTRAGDETAIL: art_der_kampagne_namen geladen:', this.auftrag.art_der_kampagne_namen);
        } else {
          this.auftrag.art_der_kampagne_namen = [];
        }
        
        console.log('🎨 AUFTRAGDETAIL: art_der_kampagne IDs geladen:', this.auftrag.art_der_kampagne);
      } else {
        this.auftrag.art_der_kampagne = [];
        this.auftrag.art_der_kampagne_namen = [];
      }
      
      // Lade Kooperationen und Videos für Budget-Anzeige
      await this.loadKooperationenVideos();
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ AUFTRAGDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }
  
  // Lade Kooperationen und Videos für Budget-Anzeige
  async loadKooperationenVideos() {
    try {
      // Lade alle Kampagnen des Auftrags
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .eq('auftrag_id', this.auftragId);
      
      this.kampagnen = kampagnen || [];
      const kampagneIds = this.kampagnen.map(k => k.id);
      
      if (kampagneIds.length === 0) {
        this.kooperationen = [];
        this.videos = [];
        this.realVideoCount = 0;
        this.realCreatorCount = 0;
        return;
      }
      
      // Lade alle Kooperationen der Kampagnen
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select(`
          id,
          name,
          status,
          typ,
          videoanzahl,
          einkaufspreis_netto,
          einkaufspreis_gesamt,
          kampagne_id,
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .in('kampagne_id', kampagneIds)
        .order('created_at', { ascending: false });
      
      this.kooperationen = (kooperationen || []).map(koop => ({
        ...koop,
        kampagne: this.kampagnen.find(k => k.id === koop.kampagne_id)
      }));
      
      // Lade Videos für alle Kooperationen
      if (this.kooperationen.length > 0) {
        const koopIds = this.kooperationen.map(k => k.id);
        const { data: videos } = await window.supabase
          .from('kooperation_videos')
          .select('id, titel, thema, content_art, kooperation_id, asset_url, link_content')
          .in('kooperation_id', koopIds);
        
        this.videos = videos || [];
      } else {
        this.videos = [];
      }
      
      // Berechne realVideoCount und realCreatorCount
      this.realVideoCount = this.videos.length;
      
      // Anzahl einzigartiger Creator
      const uniqueCreatorIds = new Set();
      this.kooperationen.forEach(koop => {
        if (koop.creator?.id) {
          uniqueCreatorIds.add(koop.creator.id);
        }
      });
      this.realCreatorCount = uniqueCreatorIds.size;
      
      console.log(`✅ AUFTRAGDETAIL: ${this.kooperationen.length} Kooperationen, ${this.realCreatorCount} Creator und ${this.realVideoCount} Videos geladen`);
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden von Kooperationen/Videos:', error);
      this.kooperationen = [];
      this.videos = [];
      this.realVideoCount = 0;
      this.realCreatorCount = 0;
    }
  }
  
  // Lade Tab-Daten lazy (Rechnungen & Kooperationen-Summaries)
  async loadTabData(tabName) {
    if (!tabName || tabName === 'informationen') return null;

    const cacheKey = tabName === 'finanzen' ? 'rechnungen' : tabName;
    return await tabDataCache.load('auftrag', this.auftragId, cacheKey, async () => {
      console.log(`🔄 Lade Tab: ${cacheKey}`);
      
      try {
        switch(cacheKey) {
          case 'rechnungen':
            const { data: rechnungen } = await window.supabase
              .from('rechnung')
              .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url')
              .eq('auftrag_id', this.auftragId)
              .order('gestellt_am', { ascending: false });
            this.rechnungen = rechnungen || [];
            
            // Summaries bilden
            const sumNetto = (this.rechnungen || []).reduce((s, r) => s + (parseFloat(r.nettobetrag) || 0), 0);
            const sumBrutto = (this.rechnungen || []).reduce((s, r) => s + (parseFloat(r.bruttobetrag) || 0), 0);
            const paidCount = (this.rechnungen || []).filter(r => r.status === 'Bezahlt').length;
            const openCount = (this.rechnungen || []).filter(r => r.status !== 'Bezahlt').length;
            this.rechnungSummary = { count: (this.rechnungen || []).length, sumNetto, sumBrutto, paidCount, openCount };
            
            // Auch Kooperationen-Summary laden (für Budget-Vergleich)
            await this.calculateKoopSummary();
            await this.calculateRealCounts();
            
            this.updateRechnungenTab();
            this._finanzenLoaded = true;
            return rechnungen;
          default:
            return null;
        }
      } catch (error) {
        console.error(`❌ Fehler beim Laden von Tab ${cacheKey}:`, error);
        return null;
      }
    });
  }
  
  // Kooperationen-Summary berechnen
  async calculateKoopSummary() {
    try {
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .eq('auftrag_id', this.auftragId);
      const kampagneIds = (kampagnen || []).map(k => k.id);
      if (kampagneIds.length > 0) {
        const { data: koops } = await window.supabase
          .from('kooperationen')
          .select('einkaufspreis_netto, einkaufspreis_gesamt')
          .in('kampagne_id', kampagneIds);
        const sumNetto = (koops || []).reduce((s, k) => s + (parseFloat(k.einkaufspreis_netto) || 0), 0);
        const sumGesamt = (koops || []).reduce((s, k) => s + (parseFloat(k.einkaufspreis_gesamt) || 0), 0);
        this.koopSummary = { count: (koops || []).length, sumNetto, sumGesamt };
      } else {
        this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
      }
    } catch (_) {
      this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
    }
  }
  
  // Tab-Update-Methoden
  updateRechnungenTab() {
    const container = document.querySelector('#tab-finanzen');
    if (container) {
      container.innerHTML = this.renderFinanzenTab();
    }
  }
  
  // Setup Cache-Invalidierung bei Updates
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'auftrag' && e.detail?.id === this.auftragId) {
        console.log('🔄 AUFTRAGDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('auftrag', this.auftragId);
        
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => this.render());
        }
      }
    });
  }

  // Berechne echte Video- und Creator-Anzahl aus Kampagnen/Kooperationen
  async calculateRealCounts() {
    try {
      console.log('🔄 AUFTRAGDETAIL: Berechne echte Video- und Creator-Anzahl');
      
      // Alle Kampagnen für diesen Auftrag laden
      const { data: kampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id, videoanzahl, creatoranzahl')
        .eq('auftrag_id', this.auftragId);

      if (kampagnenError) {
        console.warn('⚠️ Fehler beim Laden der Kampagnen:', kampagnenError);
        return;
      }

      let totalVideos = 0;
      let totalCreators = 0;

      if (kampagnen && kampagnen.length > 0) {
        // Summe aus Kampagnen
        totalVideos = kampagnen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
        totalCreators = kampagnen.reduce((sum, k) => sum + (k.creatoranzahl || 0), 0);

        // Zusätzlich Kooperationen für diese Kampagnen prüfen
        const kampagneIds = kampagnen.map(k => k.id);
        
        const { data: kooperationen, error: koopError } = await window.supabase
          .from('kooperationen')
          .select('videoanzahl, creator_id')
          .in('kampagne_id', kampagneIds);

        if (!koopError && kooperationen) {
          // Videos aus Kooperationen (falls nicht schon in Kampagnen erfasst)
          const koopVideos = kooperationen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
          
          // Unique Creator aus Kooperationen
          const uniqueCreators = new Set(kooperationen.map(k => k.creator_id).filter(Boolean));
          
          // Verwende die höhere Zahl (entweder aus Kampagnen oder aus Kooperationen)
          totalVideos = Math.max(totalVideos, koopVideos);
          totalCreators = Math.max(totalCreators, uniqueCreators.size);
        }
      }

      this.realVideoCount = totalVideos;
      this.realCreatorCount = totalCreators;

      console.log('✅ AUFTRAGDETAIL: Echte Zahlen berechnet - Videos:', totalVideos, 'Creator:', totalCreators);
      
    } catch (error) {
      console.warn('⚠️ Fehler bei der Berechnung der echten Zahlen:', error);
      this.realVideoCount = 0;
      this.realCreatorCount = 0;
    }
  }

  // Rendere Auftrags-Detailseite
  render() {
    window.setHeadline(`${this.auftrag?.auftragsname || 'Auftrag'} - Details`);

    const html = this.renderTwoColumnLayout({
      person: this.getPersonConfig(),
      stats: [],
      quickActions: [],
      sidebarInfo: this.getSidebarInfo(),
      tabNavigation: this.renderTabNavigation(),
      mainContent: this.renderMainContent()
    });

    window.setContentSafely(window.content, html);
  }

  getPersonConfig() {
    return {
      name: this.auftrag?.auftragsname || 'Auftrag',
      subtitle: this.auftrag?.unternehmen?.firmenname || 'Auftrag',
      avatarOnly: false
    };
  }

  getSidebarInfo() {
    const status = this.auftrag?.status || '-';
    return this.renderInfoItems([
      { icon: 'tag', label: 'Status', value: status },
      { icon: 'building', label: 'Unternehmen', value: this.auftrag?.unternehmen?.firmenname || '-' },
      { icon: 'marken', label: 'Marke', value: this.auftrag?.marke?.markenname || '-' },
      { icon: 'currency', label: 'Nettobetrag', value: this.formatCurrency(this.auftrag?.nettobetrag) },
      { icon: 'calendar', label: 'Start', value: this.formatDate(this.auftrag?.start) },
      { icon: 'calendar', label: 'Ende', value: this.formatDate(this.auftrag?.ende) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.auftrag?.updated_at) }
    ]);
  }

  getTabsConfig() {
    return [
      { tab: 'uebersicht', label: 'Übersicht', isActive: this.activeMainTab === 'uebersicht' },
      { tab: 'finanzen', label: 'Finanzen', isActive: this.activeMainTab === 'finanzen' },
      { tab: 'auftragsdetails', label: 'Auftragsdetails', isActive: this.activeMainTab === 'auftragsdetails' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabs.map((tab) => renderTabButton({ ...tab, showIcon: true })).join('')}</div></div>`;
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'uebersicht' ? 'active' : ''}" id="tab-uebersicht">
          ${this.renderUebersicht()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'finanzen' ? 'active' : ''}" id="tab-finanzen">
          ${this.renderFinanzenTab()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'auftragsdetails' ? 'active' : ''}" id="tab-auftragsdetails">
          ${this.renderAuftragsdetails()}
        </div>
      </div>
    `;
  }

  formatDate(dateValue) {
    return dateValue ? new Date(dateValue).toLocaleDateString('de-DE') : '-';
  }

  formatCurrency(value) {
    return value || value === 0
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
      : '-';
  }

  renderDetailItem({ icon = 'info', label, value }) {
    const hasValue = value !== null && value !== undefined && value !== '';
    const resolvedValue = hasValue ? value : '-';
    const isHtmlValue = typeof resolvedValue === 'string' && /<[^>]+>/.test(resolvedValue);
    const valueHtml = isHtmlValue ? resolvedValue : this.sanitize(String(resolvedValue));
    const iconHtml = this.getInfoIcon(icon) || this.getInfoIcon('info');

    return `
      <div class="detail-item">
        <div class="detail-item-label">
          <span class="detail-item-icon">${iconHtml}</span>
          <label>${this.sanitize(label)}</label>
        </div>
        <span class="detail-item-value">${valueHtml}</span>
      </div>
    `;
  }

  // Rendere Budget-Tab
  renderBudget() {
    const fmt = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    const a = this.auftrag || {};
    const ustProzent = a.ust_prozent != null ? a.ust_prozent : 19;
    const ustBetrag = a.ust_betrag != null ? a.ust_betrag : (parseFloat(a.nettobetrag || 0) * (parseFloat(ustProzent) / 100));
    const dbProzent = a.deckungsbeitrag_prozent != null ? a.deckungsbeitrag_prozent : 0;
    const dbBetrag = a.deckungsbeitrag_betrag != null ? a.deckungsbeitrag_betrag : (parseFloat(a.nettobetrag || 0) * (parseFloat(dbProzent) / 100));
    const itemsNetto = (parseFloat(a.influencer || 0) * parseFloat(a.influencer_preis || 0)) +
      (parseFloat(a.ugc || 0) * parseFloat(a.ugc_preis || 0)) +
      (parseFloat(a.vor_ort_produktion || 0) * parseFloat(a.vor_ort_preis || 0));
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Einnahmen (Auftrag)</h3>
            ${this.renderDetailItem({ icon: 'currency', label: 'Netto:', value: fmt(a.nettobetrag) })}
            ${this.renderDetailItem({ icon: 'info', label: 'USt (%):', value: num(ustProzent) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'USt Betrag:', value: fmt(ustBetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Brutto Gesamtbudget:', value: fmt(a.bruttobetrag) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Planwerte</h3>
            ${this.renderDetailItem({ icon: 'info', label: 'Geplanter Deckungsbeitrag (%):', value: num(dbProzent) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Geplanter Deckungsbeitrag (Betrag):', value: fmt(dbBetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'KSK (5% von Netto):', value: fmt(a.ksk_betrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Creator Budget:', value: fmt(a.creator_budget) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Preisaufbau (Netto)</h3>
            ${this.renderDetailItem({ icon: 'user', label: 'Influencer:', value: `${num(a.influencer)} × ${fmt(a.influencer_preis)}` })}
            ${this.renderDetailItem({ icon: 'video', label: 'UGC Video:', value: `${num(a.ugc)} × ${fmt(a.ugc_preis)}` })}
            ${this.renderDetailItem({ icon: 'video', label: 'Vor Ort Produktion:', value: `${num(a.vor_ort_produktion)} × ${fmt(a.vor_ort_preis)}` })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Positionen (Netto):', value: fmt(itemsNetto) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Rechnungen</h3>
            ${this.renderDetailItem({ icon: 'info', label: 'Anzahl:', value: num(this.rechnungSummary.count) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Netto:', value: fmt(this.rechnungSummary.sumNetto) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Brutto:', value: fmt(this.rechnungSummary.sumBrutto) })}
            ${this.renderDetailItem({ icon: 'check', label: 'Bezahlt / Offen:', value: `${num(this.rechnungSummary.paidCount)} / ${num(this.rechnungSummary.openCount)}` })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Ausgaben (Kooperationen)</h3>
            ${this.renderDetailItem({ icon: 'kooperation', label: 'Anzahl Kooperationen:', value: num(this.koopSummary.count) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Nettokosten:', value: fmt(this.koopSummary.sumNetto) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Gesamtkosten:', value: fmt(this.koopSummary.sumGesamt) })}
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Übersicht-Tab mit allen wichtigen Auftragsinformationen
  renderUebersicht() {
    const a = this.auftrag || {};
    const fmt = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    
    // Mitarbeiter-Namen sammeln
    const mitarbeiterNamen = (a.mitarbeiter || []).map(m => m.name).filter(Boolean).join(', ') || '-';
    const cutterNamen = (a.cutter || []).map(c => c.name).filter(Boolean).join(', ') || '-';
    const copywriterNamen = (a.copywriter || []).map(c => c.name).filter(Boolean).join(', ') || '-';
    
    // Ansprechpartner formatieren
    const ansprechpartner = a.ansprechpartner 
      ? `${a.ansprechpartner.vorname || ''} ${a.ansprechpartner.nachname || ''}`.trim() || '-'
      : '-';
    const ansprechpartnerEmail = a.ansprechpartner?.email || '-';
    
    // Kampagnenarten formatieren
    const kampagnenarten = (a.art_der_kampagne_namen || []).join(', ') || '-';

    return `
      <div class="detail-section">
        <div class="detail-grid">
          <!-- Auftrags-Eckdaten -->
          <div class="detail-card">
            <h3 class="section-title">Auftrags-Eckdaten</h3>
            ${this.renderDetailItem({
              icon: 'tag',
              label: 'Status:',
              value: `<span class="status-badge status-${(a.status?.toLowerCase() || 'unknown').replace(/\s+/g, '-')}">${a.status || 'Unbekannt'}</span>`
            })}
            ${this.renderDetailItem({ icon: 'info', label: 'PO-Nummer:', value: a.po || '-' })}
            ${this.renderDetailItem({ icon: 'info', label: 'RE-Nummer:', value: a.re_nr || '-' })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'RE-Fälligkeit:', value: formatDate(a.re_faelligkeit) })}
            ${this.renderDetailItem({ icon: 'clock', label: 'Zahlungsziel:', value: a.zahlungsziel_tage != null ? `${a.zahlungsziel_tage} Tage` : '-' })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'Start:', value: formatDate(a.start) })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'Ende:', value: formatDate(a.ende) })}
            ${this.renderDetailItem({ icon: 'tag', label: 'Kampagnenarten:', value: kampagnenarten })}
          </div>
          
          <!-- Unternehmen & Marke -->
          <div class="detail-card">
            <h3 class="section-title">Kunde</h3>
            ${this.renderDetailItem({
              icon: 'building',
              label: 'Unternehmen:',
              value: a.unternehmen?.firmenname
                ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${a.unternehmen_id}">${a.unternehmen.firmenname}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'marken',
              label: 'Marke:',
              value: a.marke?.markenname
                ? `<a href="#" class="table-link" data-table="marke" data-id="${a.marke_id}">${a.marke.markenname}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'user',
              label: 'Ansprechpartner:',
              value: a.ansprechpartner_id
                ? `<a href="#" class="table-link" data-table="ansprechpartner" data-id="${a.ansprechpartner_id}">${ansprechpartner}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'mail',
              label: 'E-Mail:',
              value: ansprechpartnerEmail !== '-' ? `<a href="mailto:${ansprechpartnerEmail}">${ansprechpartnerEmail}</a>` : '-'
            })}
          </div>
          
          <!-- Team -->
          <div class="detail-card">
            <h3 class="section-title">Team</h3>
            ${this.renderDetailItem({ icon: 'user', label: 'Projektleitung:', value: mitarbeiterNamen })}
            ${this.renderDetailItem({ icon: 'user', label: 'Cutter:', value: cutterNamen })}
            ${this.renderDetailItem({ icon: 'user', label: 'Copywriter:', value: copywriterNamen })}
          </div>
          
          <!-- Quick-Finanzen -->
          <div class="detail-card">
            <h3 class="section-title">Budget (Übersicht)</h3>
            ${this.renderDetailItem({ icon: 'currency', label: 'Nettobetrag:', value: fmt(a.nettobetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Bruttobetrag:', value: fmt(a.bruttobetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Creator-Budget:', value: fmt(a.creator_budget) })}
            ${this.renderDetailItem({
              icon: 'check',
              label: 'Rechnung gestellt:',
              value: a.rechnung_gestellt
                ? '<span class="status-badge status-erfolg">Ja</span>'
                : '<span class="status-badge status-offen">Nein</span>'
            })}
            ${this.renderDetailItem({
              icon: 'check',
              label: 'Überwiesen:',
              value: a.ueberwiesen
                ? '<span class="status-badge status-erfolg">Ja</span>'
                : '<span class="status-badge status-offen">Nein</span>'
            })}
            ${a.ueberwiesen_am ? this.renderDetailItem({ icon: 'calendar', label: 'Überwiesen am:', value: formatDate(a.ueberwiesen_am) }) : ''}
          </div>
          
          <!-- Zeitstempel -->
          <div class="detail-card">
            <h3 class="section-title">Protokoll</h3>
            ${this.renderDetailItem({ icon: 'clock', label: 'Erstellt am:', value: formatDate(a.created_at) })}
            ${this.renderDetailItem({ icon: 'clock', label: 'Aktualisiert am:', value: formatDate(a.updated_at) })}
          </div>
        </div>
      </div>
    `;
  }
  
  // Rendere Finanzen-Tab (Budget + Rechnungen)
  renderFinanzenTab() {
    return `
      <div class="detail-section">
        ${this.renderBudget()}
        
        <div class="auftrag-section-spacer">
          <h3>Rechnungen</h3>
          ${this.renderRechnungen()}
        </div>
      </div>
    `;
  }
  
  // Rendere Rechnungen-Tabelle
  renderRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen');
    if (container) {
      container.innerHTML = this.renderRechnungen();
    }
  }

  /**
   * Sammelt die Kampagnenarten
   * PRIMÄR: Aus dem Auftrag selbst (art_der_kampagne_namen)
   * FALLBACK: Aus den geladenen Kampagnen
   * @returns {string[]} - Array der eindeutigen Kampagnenarten-Namen
   */
  collectKampagnenartenFromKampagnen() {
    const artenSet = new Set();
    
    // PRIMÄR: Kampagnenarten direkt vom Auftrag
    if (this.auftrag?.art_der_kampagne_namen?.length > 0) {
      this.auftrag.art_der_kampagne_namen.forEach(name => {
        if (name) artenSet.add(name);
      });
      console.log('📋 AUFTRAGDETAIL: Kampagnenarten aus Auftrag verwendet:', Array.from(artenSet));
      return Array.from(artenSet);
    }
    
    // FALLBACK: Aus den Kampagnen (für Abwärtskompatibilität)
    (this.kampagnen || []).forEach(kampagne => {
      // Kampagnenarten können in verschiedenen Formaten kommen
      const arten = kampagne.kampagne_art_typen || kampagne.art_der_kampagne;
      if (Array.isArray(arten)) {
        arten.forEach(art => {
          if (typeof art === 'string') {
            artenSet.add(art);
          } else if (art?.name) {
            artenSet.add(art.name);
          }
        });
      } else if (arten?.name) {
        artenSet.add(arten.name);
      }
    });
    
    console.log('📋 AUFTRAGDETAIL: Kampagnenarten aus Kampagnen verwendet:', Array.from(artenSet));
    return Array.from(artenSet);
  }

  // Rendere Auftragsdetails-Tab
  renderAuftragsdetails() {
    if (!this.auftragsDetails) {
      return `
        <div class="empty-state">
          <h3>Keine Auftragsdetails vorhanden</h3>
          <p>Es wurden noch keine detaillierten Produktionsinformationen für diesen Auftrag hinterlegt.</p>
          <button onclick="window.navigateTo('/auftragsdetails/new')" class="primary-btn">
            Auftragsdetails anlegen
          </button>
        </div>
      `;
    }

    const details = this.auftragsDetails;
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';

    // Sammle Kampagnenarten aus den Kampagnen
    const kampagnenarten = this.collectKampagnenartenFromKampagnen();
    
    // Daten für die Tabelle dynamisch aus Kampagnenarten generieren
    const colorPalette = ['#28a745', '#6f42c1', '#fd7e14', '#20c997', '#007bff', '#dc3545'];
    const sections = kampagnenarten.map((artName, index) => {
      const config = KAMPAGNENARTEN_MAPPING[artName];
      if (!config) return null;
      return {
        title: config.displayName || artName,
        prefix: config.prefix,
        color: colorPalette[index % colorPalette.length],
        hasCreator: config.hasCreator,
        hasBilder: config.hasBilder,
        hasVideographen: config.hasVideographen
      };
    }).filter(s => s !== null);
    
    // Fallback auf alle Sections wenn keine Kampagnenarten gefunden wurden
    // (für Abwärtskompatibilität mit bestehenden Daten)
    if (sections.length === 0) {
      sections.push(
        { title: 'UGC Pro Paid', prefix: 'ugc_pro_paid', color: '#28a745', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'UGC Pro Organic', prefix: 'ugc_pro_organic', color: '#6f42c1', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'UGC Video Paid', prefix: 'ugc_video_paid', color: '#fd7e14', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'UGC Video Organic', prefix: 'ugc_video_organic', color: '#20c997', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Influencer Kampagne', prefix: 'influencer', color: '#007bff', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Vor Ort Produktion', prefix: 'vor_ort', color: '#dc3545', hasCreator: true, hasBilder: false, hasVideographen: true }
      );
    }

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const budgetInfo = details[`${section.prefix}_budget_info`];

      // Zeige nur Zeilen mit Daten
      if (!videoAnzahl && !bilderAnzahl && !creatorAnzahl && !budgetInfo) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info-large">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${section.hasBilder ? num(bilderAnzahl) : '-'}</td>
          <td class="text-center">${section.hasCreator ? num(creatorAnzahl) : '-'}</td>
        </tr>
      `;
    }).filter(row => row).join('');

    return `
      <div class="detail-section">
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${num(this.realVideoCount)}</div>
              <div class="summary-label">Videos erstellt</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${num(this.realCreatorCount)}</div>
              <div class="summary-label">Creator gebucht</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${this.formatBudgetUsage()}</div>
              <div class="summary-label">Budget verbraucht</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getBudgetProgressColorClass()}" 
                     style="width: ${Math.min(100, this.getBudgetPercentage())}%">
                </div>
              </div>
              ${(this.auftrag?.creator_budget || this.auftrag?.gesamt_budget || this.auftrag?.nettobetrag) ? `<div class="summary-planned">${this.getBudgetPercentage()}%</div>` : ''}
            </div>
            ${this.renderAuftragsbestaetigungCard()}
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Budget & Informationen</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Bilder</th>
                <th class="text-center">Creator</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || `
                <tr>
                  <td colspan="5" class="no-data">
                    Keine Produktionsdetails vorhanden
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Kooperationen & Videos Tabelle -->
        <div class="auftrag-section-spacer">
          <h3>Kooperationen & Videos</h3>
          ${this.renderKooperationenVideosTable()}
        </div>
      </div>
    `;
  }

  // Rendere Auftragsbestätigung Card
  renderAuftragsbestaetigungCard() {
    const hasBestaetigung = this.auftrag?.auftragsbestaetigung_url;
    
    if (hasBestaetigung) {
      return `
        <div class="summary-card summary-card--document">
          <div class="summary-icon">📄</div>
          <div class="summary-label">Auftragsbestätigung</div>
          <a href="${this.auftrag.auftragsbestaetigung_url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="mdc-btn mdc-btn--secondary mdc-btn--sm" 
             style="margin-top: 8px;">
            <span class="mdc-btn__label">Öffnen</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-left: 4px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      `;
    }
    
    return `
      <div class="summary-card summary-card--document summary-card--empty">
        <div class="summary-icon" style="opacity: 0.5;">📄</div>
        <div class="summary-label" style="color: var(--gray-500);">Keine Auftragsbestätigung</div>
      </div>
    `;
  }

  // Rendere Informationen
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Auftrags-Informationen</h3>
            <div class="detail-item">
              <label>Auftragsname:</label>
              <span>${this.auftrag?.auftragsname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Marke:</label>
              <span>${this.auftrag?.marke?.markenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.auftrag?.unternehmen?.firmenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-${this.auftrag?.status?.toLowerCase() || 'unknown'}">
                ${this.auftrag?.status || 'Unbekannt'}
              </span>
            </div>
            <div class="detail-item">
              <label>Typ:</label>
              <span>${this.auftrag?.auftragtype || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Kurzbeschreibung:</label>
              <span>${this.auftrag?.kurzbeschreibung || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Budget:</label>
              <span>${this.auftrag?.gesamt_budget ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(this.auftrag.gesamt_budget) : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Start:</label>
              <span>${this.auftrag?.start ? new Date(this.auftrag.start).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Ende:</label>
              <span>${this.auftrag?.ende ? new Date(this.auftrag.ende).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.auftrag?.created_at ? new Date(this.auftrag.created_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.auftrag?.updated_at ? new Date(this.auftrag.updated_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Notizen
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'auftrag', this.auftragId);
    }
    return '<p>Notizen-System nicht verfügbar</p>';
  }

  // Rendere Bewertungen
  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'auftrag', this.auftragId);
    }
    return '<p>Bewertungs-System nicht verfügbar</p>';
  }

  // Rendere Creator
  renderCreator() {
    if (!this.creator || this.creator.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Creator zugewiesen</h3>
          <p>Es wurden noch keine Creator diesem Auftrag zugewiesen.</p>
        </div>
      `;
    }

    const creatorHtml = this.creator.map(creator => `
      <div class="creator-card">
        <div class="creator-header">
          <h4>${creator.vorname} ${creator.nachname}</h4>
          <span class="creator-status status-${creator.status?.toLowerCase() || 'unknown'}">
            ${creator.status || 'Unbekannt'}
          </span>
        </div>
        <div class="creator-details">
          <p><strong>Email:</strong> ${creator.email ? `<a href="mailto:${creator.email}">${creator.email}</a>` : '-'}</p>
          <p><strong>Telefon:</strong> ${creator.telefonnummer ? `<a href="tel:${creator.telefonnummer}">${creator.telefonnummer}</a>` : '-'}</p>
          <p><strong>Kategorie:</strong> ${creator.kategorie || '-'}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="creator-container">
        ${creatorHtml}
      </div>
    `;
  }

  // Rendere Rechnungen
  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Rechnungen vorhanden</h3>
        </div>
      `;
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

  // Binde Events
  bindEvents() {
    if (this._eventsBound) return;

    document.addEventListener('click', this._handleDocumentClick);
    document.addEventListener('entityUpdated', this._handleEntityUpdated);
    document.addEventListener('notizenUpdated', this._handleEntityUpdated);
    document.addEventListener('bewertungenUpdated', this._handleEntityUpdated);
    window.addEventListener('softRefresh', this._handleSoftRefresh);

    this._eventsBound = true;
  }

  // Tab wechseln
  switchTab(tabName) {
    this.activeMainTab = tabName;

    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });

    // Alle Tab-Panes ausblenden
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    // Gewählten Tab aktivieren
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPane = document.getElementById(`tab-${tabName}`);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedPane) selectedPane.classList.add('active');
    
    this.loadTabData(tabName);
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 AUFTRAGDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Auftrag bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.auftrag };
    
    // Edit-Mode Flags setzen
    formData._isEditMode = true;
    formData._entityId = this.auftragId;
    
    // Verknüpfte IDs für das Formular setzen
    if (this.auftrag.unternehmen_id) {
      formData.unternehmen_id = this.auftrag.unternehmen_id;
      console.log('🏢 AUFTRAGDETAIL: Unternehmen-ID für Edit-Mode:', this.auftrag.unternehmen_id);
    }
    if (this.auftrag.marke_id) {
      formData.marke_id = this.auftrag.marke_id;
      console.log('🏷️ AUFTRAGDETAIL: Marke-ID für Edit-Mode:', this.auftrag.marke_id);
    }
    if (this.auftrag.ansprechpartner_id) {
      formData.ansprechpartner_id = this.auftrag.ansprechpartner_id;
      console.log('👤 AUFTRAGDETAIL: Ansprechpartner-ID für Edit-Mode:', this.auftrag.ansprechpartner_id);
    }
    
    // Multi-Select IDs extrahieren für Edit-Mode
    // Nach dem Kampagne-Vorbild: Daten sind jetzt direkt als Array von {id, name, email}
    formData.mitarbeiter_ids = this.auftrag.mitarbeiter 
      ? this.auftrag.mitarbeiter.map(m => m.id).filter(Boolean)
      : [];
    
    formData.cutter_ids = this.auftrag.cutter 
      ? this.auftrag.cutter.map(c => c.id).filter(Boolean)
      : [];
    
    formData.copywriter_ids = this.auftrag.copywriter 
      ? this.auftrag.copywriter.map(c => c.id).filter(Boolean)
      : [];
    
    // Array-Felder korrekt formatieren
    if (this.auftrag.art_der_kampagne && Array.isArray(this.auftrag.art_der_kampagne)) {
      formData.art_der_kampagne = this.auftrag.art_der_kampagne;
      console.log('🎨 AUFTRAGDETAIL: art_der_kampagne gesetzt:', this.auftrag.art_der_kampagne);
    } else {
      console.log('⚠️ AUFTRAGDETAIL: art_der_kampagne NICHT gesetzt oder nicht Array:', this.auftrag.art_der_kampagne);
    }
    
    console.log('📋 AUFTRAGDETAIL: Multi-Select IDs extrahiert:', {
      mitarbeiter_ids: formData.mitarbeiter_ids,
      cutter_ids: formData.cutter_ids,
      copywriter_ids: formData.copywriter_ids,
      art_der_kampagne: formData.art_der_kampagne
    });
    
    console.log('🔍 AUFTRAGDETAIL: Rohdaten für Debugging:', {
      'this.auftrag.mitarbeiter': this.auftrag.mitarbeiter,
      'this.auftrag.cutter': this.auftrag.cutter,
      'this.auftrag.copywriter': this.auftrag.copywriter
    });
    
    console.log('📋 AUFTRAGDETAIL: FormData für Rendering:', formData);
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('auftrag', formData);
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Form-Datasets für DynamicDataLoader setzen - WICHTIG: VOR bindFormEvents!
    const form = document.getElementById('auftrag-form');
    if (form) {
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = 'auftrag';
      form.dataset.entityId = this.auftragId;
      
      // Edit-Mode Daten als JSON für DynamicDataLoader - WICHTIGE REIHENFOLGE beachten!
      const editModeData = {
        // Single-Select Felder zuerst - in Abhängigkeits-Reihenfolge
        unternehmen_id: formData.unternehmen_id,
        marke_id: formData.marke_id,
        ansprechpartner_id: formData.ansprechpartner_id,
        status: formData.status,
        // Multi-Select Felder
        art_der_kampagne: formData.art_der_kampagne,
        mitarbeiter_ids: formData.mitarbeiter_ids,
        cutter_ids: formData.cutter_ids,
        copywriter_ids: formData.copywriter_ids
      };
      
      form.dataset.editModeData = JSON.stringify(editModeData);
      
      // Bestehende Werte für Auto-Suggestion verfügbar machen
      if (formData.unternehmen_id) {
        form.dataset.existingUnternehmenId = formData.unternehmen_id;
      }
      if (formData.marke_id) {
        form.dataset.existingMarkeId = formData.marke_id;
      }
      if (formData.ansprechpartner_id) {
        form.dataset.existingAnsprechpartnerId = formData.ansprechpartner_id;
      }
      
      console.log('📋 AUFTRAGDETAIL: EditModeData gesetzt VOR bindFormEvents:', editModeData);
      console.log('🎨 AUFTRAGDETAIL: art_der_kampagne in editModeData:', editModeData.art_der_kampagne);
    }

    // Formular-Events binden mit vorbereiteten Daten - NACH dem Setzen der editModeData!
    window.formSystem.bindFormEvents('auftrag', formData);
    
    // Custom Submit Handler für Bearbeitungsformular
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    const submitBtn = document.querySelector('#auftrag-form button[type="submit"]');
    
    try {
      // Loading State aktivieren
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }
      
      const form = document.getElementById('auftrag-form');
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln (wie bei Kampagne)
      const hiddenSelects = form.querySelectorAll('select[style*="display: none"], select[style*="display:none"]');
      hiddenSelects.forEach(select => {
        // Verarbeite alle Multi-Selects (inklusive art_der_kampagne)
        if (select.name && (select.name.includes('_ids') || select.name.includes('art_der_kampagne'))) {
          const fieldName = select.name.replace('[]', '');
          const selectedValues = Array.from(select.selectedOptions).map(option => option.value).filter(val => val !== '');
          if (selectedValues.length > 0) {
            submitData[fieldName] = selectedValues;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, selectedValues);
          }
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          if (!submitData[cleanKey].includes(value)) {
            submitData[cleanKey].push(value);
          }
        } else {
          // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          }
        }
      }

      // Checkboxen explizit erfassen (unchecked erscheinen nicht in FormData)
      const checkboxes = form.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        if (checkbox.name) {
          submitData[checkbox.name] = checkbox.checked;
        }
      });

      // Bei ueberwiesen=false: ueberwiesen_am auf null setzen
      if (submitData.ueberwiesen === false) {
        submitData.ueberwiesen_am = null;
      }
      if (submitData.rechnung_gestellt === false) {
        submitData.rechnung_gestellt_am = null;
      }

      console.log('📋 AUFTRAGDETAIL: Submit-Daten gesammelt:', submitData);

      // Validierung
      const validation = window.validatorSystem.validateForm(submitData, {
        auftragsname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Auftrag aktualisieren
      const result = await window.dataService.updateEntity('auftrag', this.auftragId, submitData);

      if (result.success) {
        // Auftragsbestätigung Upload (falls vorhanden)
        try {
          await this.handleAuftragsbestaetigungUpload(form);
        } catch (e) {
          console.warn('⚠️ Auftragsbestätigung Upload fehlgeschlagen', e);
        }

        // Success State
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.classList.add('is-success');
        }
        
        this.showSuccessMessage('Auftrag erfolgreich aktualisiert!');
        
        // Daten neu laden und zur Detailseite zurückkehren
        setTimeout(async () => {
          tabDataCache.invalidate('auftrag', this.auftragId);
          await this._refreshDetailView();
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
      
      // Loading State entfernen bei Fehler
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    }
  }

  // Show Validation Errors
  showValidationErrors(errors) {
    console.log('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.keys(errors).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errors[fieldName];
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#dc3545';
      }
    });
  }

  // Show Success Message
  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(successDiv, formPage.firstChild);
    }
  }

  // Show Error Message
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(errorDiv, formPage.firstChild);
    }
  }

  // Formatiere Budget-Verbrauch (Netto-Beträge)
  formatBudgetUsage() {
    // Fallback-Kette: creator_budget -> gesamt_budget -> nettobetrag
    const totalBudget = parseFloat(
      this.auftrag?.creator_budget || 
      this.auftrag?.gesamt_budget || 
      this.auftrag?.nettobetrag || 
      0
    );
    
    // Netto-Beträge aus Kooperationen summieren
    const usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_netto) || 0);
    }, 0);
    
    console.log('💰 Budget Debug (Netto):', {
      creator_budget: this.auftrag?.creator_budget,
      gesamt_budget: this.auftrag?.gesamt_budget,
      nettobetrag: this.auftrag?.nettobetrag,
      totalBudget,
      usedBudget,
      kooperationenCount: this.kooperationen.length
    });
    
    const formatCurrency = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '0,00 €';
    return `${formatCurrency(usedBudget)} von ${formatCurrency(totalBudget)}`;
  }

  // Berechne Budget-Prozentsatz (Netto-Beträge)
  getBudgetPercentage() {
    // Fallback-Kette: creator_budget -> gesamt_budget -> nettobetrag
    const totalBudget = parseFloat(
      this.auftrag?.creator_budget || 
      this.auftrag?.gesamt_budget || 
      this.auftrag?.nettobetrag || 
      0
    );
    
    // Netto-Beträge aus Kooperationen summieren
    const usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_netto) || 0);
    }, 0);
    
    if (totalBudget <= 0) return 0;
    return Math.round((usedBudget / totalBudget) * 100);
  }

  // Bestimme Farbe für Progress-Bar basierend auf Prozentsatz (Videos/Creator)
  getProgressColorClass(current, total) {
    if (!total || total <= 0) return '';
    const percentage = (current / total) * 100;
    
    if (percentage >= 100) return 'summary-progress-fill--success';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  }

  // Bestimme Farbe für Budget Progress-Bar
  getBudgetProgressColorClass() {
    const percentage = this.getBudgetPercentage();
    
    if (percentage >= 90) return 'summary-progress-fill--danger';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  }

  // Rendere Kooperationen & Videos Tabelle
  renderKooperationenVideosTable() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für diesen Auftrag wurden noch keine Kooperationen angelegt.</p>
        </div>
      `;
    }

    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    const isKunde = window.currentUser?.rolle === 'kunde';

    const rows = this.kooperationen.map(koop => {
      const creator = koop.creator || {};
      const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || '-';
      
      // Videos für diese Kooperation
      const koopVideos = this.videos.filter(v => v.kooperation_id === koop.id);
      
      // Budget-Info aus den Auftragsdetails holen (basierend auf Typ)
      let budgetInfo = '-';
      if (this.auftragsDetails && koop.typ) {
        const typ = koop.typ.toLowerCase().replace(/\s+/g, '_');
        budgetInfo = this.auftragsDetails[`${typ}_budget_info`] || '-';
      }
      
      // Video-Links rendern (wie in KampagneKooperationenVideoTable)
      const renderVideoLinks = (videos) => {
        if (!videos || videos.length === 0) {
          return '<span class="text-muted">-</span>';
        }
        
        return `<div class="video-fields-stack">${videos.map(video => {
          const videoUrl = video.asset_url || video.link_content;
          if (videoUrl) {
            return `
              <div class="video-field-wrapper">
                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Link in neuem Tab öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            `;
          } else {
            return '<div class="video-field-wrapper"><span class="text-muted">-</span></div>';
          }
        }).join('')}</div>`;
      };
      
      // Video-Titel rendern
      const renderVideoTitles = (videos) => {
        if (!videos || videos.length === 0) {
          return '<span class="text-muted">-</span>';
        }
        
        return `<div class="video-fields-stack">${videos.map(video => `
          <div class="video-field-wrapper">
            ${window.validatorSystem.sanitizeHtml(video.titel || video.thema || 'Video')}
            ${video.content_art ? `<span style="color: #666; font-size: 0.9em;"> (${video.content_art})</span>` : ''}
          </div>
        `).join('')}</div>`;
      };
      
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="creator" data-id="${creator.id || ''}">
              ${window.validatorSystem.sanitizeHtml(creatorName)}
            </a>
          </td>
          <td class="text-center">${koop.videoanzahl || 0}</td>
          <td>
            <span class="status-badge status-${koop.status?.toLowerCase() || 'unknown'}">
              ${koop.status || '-'}
            </span>
          </td>
          <td class="budget-cell">
            ${budgetInfo !== '-' ? `<div class="budget-info">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}
          </td>
          ${!isKunde ? `<td class="text-right">${formatCurrency(koop.einkaufspreis_gesamt)}</td>` : ''}
          <td class="video-stack-cell">${renderVideoTitles(koopVideos)}</td>
          <td class="video-stack-cell text-center">${renderVideoLinks(koopVideos)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th class="text-center">Anzahl Videos</th>
              <th>Status</th>
              <th>Budget & Informationen</th>
              ${!isKunde ? '<th class="text-right">Kosten (Einkauf)</th>' : ''}
              <th>Video Titel</th>
              <th class="text-center">Video Link</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Cleanup
  destroy() {
    console.log('AuftragDetail: Cleaning up...');
    document.removeEventListener('click', this._handleDocumentClick);
    document.removeEventListener('entityUpdated', this._handleEntityUpdated);
    document.removeEventListener('notizenUpdated', this._handleEntityUpdated);
    document.removeEventListener('bewertungenUpdated', this._handleEntityUpdated);
    window.removeEventListener('softRefresh', this._handleSoftRefresh);
    this._eventsBound = false;
    tabDataCache.invalidate('auftrag', this.auftragId);
  }

  showDetailsForm(auftragId) {
    // Navigiere zur Auftragsdetails-Erstellungsseite
    window.navigateTo('/auftragsdetails/new');
  }

  /**
   * Auftragsbestätigung Upload Handling
   * @param {HTMLFormElement} form - Das Formular
   */
  async handleAuftragsbestaetigungUpload(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="auftragsbestaetigung_file"]');
    
    if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
      console.log('📁 Keine Auftragsbestätigung zum Hochladen');
      return;
    }

    if (!window.supabase) {
      console.warn('⚠️ Supabase nicht verfügbar');
      return;
    }

    const file = uploaderRoot.__uploaderInstance.files[0];
    const bucket = 'auftragsbestaetigung';
    
    // Altes Dokument löschen (falls vorhanden)
    if (this.auftrag?.auftragsbestaetigung_path) {
      try {
        await window.supabase.storage
          .from(bucket)
          .remove([this.auftrag.auftragsbestaetigung_path]);
        console.log('🗑️ Altes Dokument gelöscht');
      } catch (e) {
        console.warn('⚠️ Fehler beim Löschen des alten Dokuments:', e);
      }
    }
    
    // Sicherer Dateiname
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .substring(0, 200);
    
    const path = `${this.auftragId}/${Date.now()}_${sanitizedName}`;

    console.log(`📤 Uploading Auftragsbestätigung: ${file.name} -> ${path}`);

    // Upload zu Storage
    const { error: upErr } = await window.supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (upErr) {
      console.error('❌ Upload-Fehler:', upErr);
      throw upErr;
    }

    // Permanente Public URL generieren
    const { data: urlData } = window.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    // URL in DB speichern
    const { error: dbErr } = await window.supabase
      .from('auftrag')
      .update({
        auftragsbestaetigung_url: urlData?.publicUrl || '',
        auftragsbestaetigung_path: path
      })
      .eq('id', this.auftragId);

    if (dbErr) {
      console.error('❌ DB-Fehler beim Speichern der URL:', dbErr);
      throw dbErr;
    }

    console.log('✅ Auftragsbestätigung erfolgreich hochgeladen');
  }
}

export const auftragDetail = new AuftragDetail();