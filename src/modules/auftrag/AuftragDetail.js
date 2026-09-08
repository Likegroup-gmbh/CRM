// AuftragDetail.js (ES6-Modul)
// Auftrags-Detailseite mit Tabs für Informationen und Creator

import { getKampagnenartConfig } from './logic/KampagnenartenMapping.js';
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderSecondaryNav, activateSecondaryNavTab, getSecondaryNavTabFromEvent, getTabQueryParam } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { berechneVerfuegbaresBudget } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';

export class AuftragDetail extends PersonDetailBase {
  constructor() {
    super();
    this.auftragId = null;
    this.auftrag = null;
    this.creator = [];
    this.marke = null;
    this.unternehmen = null;
    this.rechnungen = [];
    this.rechnungSummary = { count: 0, sumNetto: 0, sumBrutto: 0, paidCount: 0, openCount: 0 };
    this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
    this.auftragsDetails = null;
    this.realVideoCount = 0;
    this.realCreatorCount = 0;
    this.usedBudget = 0;
    this.usedVideoCount = 0;
    this.targetVideoCount = 0;
    this.targetCreatorCount = 0;
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
      this.activeMainTab = getTabQueryParam() || 'uebersicht';
      this._finanzenLoaded = false;
      tabDataCache.invalidate('auftrag', auftragId);
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.auftrag) {
        const canEdit = window.currentUser?.permissions?.auftrag?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(this.auftrag.auftragsname || 'Details', {
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
    const tabName = getSecondaryNavTabFromEvent(e);
    if (tabName) {
      e.preventDefault();
      this.switchTab(tabName);
      return;
    }

    if (e.target.closest('#btn-edit-auftrag')) {
      // Edit laeuft seit dem Projekt-Erstellen-Wizard-Refactor ueber den Wizard,
      // damit Anlegen und Bearbeiten denselben Datenpfad nutzen (z.B. creator_budget
      // wird konsistent neu berechnet wenn der Nettobetrag geaendert wird).
      window.navigateTo(`/projekt-erstellen/edit/${this.auftragId}`);
      return;
    }

    if (e.target.closest('#btn-auftrag-stornieren')) {
      this._handleStornieren();
      return;
    }

    if (e.target.closest('#btn-auftrag-reaktivieren')) {
      this._handleReaktivieren();
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
        
        // 2. Creator
        () => window.supabase
          .from('creator_auftrag')
          .select(`creator:creator_id(*)`)
          .eq('auftrag_id', this.auftragId),
        
        // 3. Mitarbeiter
        () => window.supabase
          .from('auftrag_mitarbeiter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 4. Cutter
        () => window.supabase
          .from('auftrag_cutter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 5. Copywriter
        () => window.supabase
          .from('auftrag_copywriter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 6. Auftragsdetails
        () => window.supabase
          .from('auftrag_details')
          .select('*')
          .eq('auftrag_id', this.auftragId)
          .maybeSingle(),
        
        // 7. Art der Kampagne aus Junction-Table
        () => window.supabase
          .from('auftrag_kampagne_art')
          .select('kampagne_art_id')
          .eq('auftrag_id', this.auftragId)
      ]);
      
      // Daten verarbeiten
      if (auftragResult.error) throw auftragResult.error;
      this.auftrag = auftragResult.data;
      
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
        .select('id, kampagnenname, videoanzahl, creatoranzahl')
        .eq('auftrag_id', this.auftragId);
      
      this.kampagnen = kampagnen || [];
      this.targetVideoCount = this.kampagnen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
      this.targetCreatorCount = this.kampagnen.reduce((sum, k) => sum + (k.creatoranzahl || 0), 0);
      const kampagneIds = this.kampagnen.map(k => k.id);
      
      if (kampagneIds.length === 0) {
        this.kooperationen = [];
        this.videos = [];
        this.realVideoCount = 0;
        this.realCreatorCount = 0;
        this.usedBudget = 0;
        this.usedVideoCount = 0;
        return;
      }
      
      // Lade alle Kooperationen der Kampagnen
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select(`
          id,
          name,
          typ,
          videoanzahl,
          einkaufspreis_netto,
          verkaufspreis_netto,
          einkaufspreis_gesamt,
          ksk_selbstzahler,
          ksk_betrag,
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
      
      // Lade Videos + Rechnungsstatus für alle Kooperationen
      if (this.kooperationen.length > 0) {
        const koopIds = this.kooperationen.map(k => k.id);
        const { data: videoData } = await window.supabase
          .from('kooperation_videos')
          .select('id, titel, thema, content_art, kooperation_id, asset_url, link_content, einkaufspreis_netto, verkaufspreis_netto')
          .in('kooperation_id', koopIds);
        
        this.videos = videoData || [];
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
      
      // EK-Verbrauch inkl. KSK-Selbstzahler-Aufschlaege
      this.usedBudget = this.kooperationen.reduce((sum, koop) => sum + (parseFloat(koop.einkaufspreis_netto) || 0), 0)
        + summeKskSelbstzahler(this.kooperationen);
      this.usedVideoCount = this.kooperationen.reduce((sum, koop) => sum + (parseInt(koop.videoanzahl, 10) || 0), 0);
      
      console.log(`✅ AUFTRAGDETAIL: ${this.kooperationen.length} Kooperationen, ${this.realCreatorCount} Creator und ${this.realVideoCount} Videos geladen`);
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden von Kooperationen/Videos:', error);
      this.kooperationen = [];
      this.videos = [];
      this.realVideoCount = 0;
      this.realCreatorCount = 0;
      this.usedBudget = 0;
      this.usedVideoCount = 0;
      this.targetVideoCount = 0;
      this.targetCreatorCount = 0;
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
              .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, rechnung_pdfs(id, file_name, file_path, file_url)')
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
          .select('einkaufspreis_netto, einkaufspreis_gesamt, ksk_selbstzahler, ksk_betrag')
          .in('kampagne_id', kampagneIds);
        // Netto inkl. KSK-Selbstzahler-Aufschlag; einkaufspreis_gesamt enthaelt die KSK bereits
        const sumNetto = (koops || []).reduce((s, k) => s + (parseFloat(k.einkaufspreis_netto) || 0), 0)
          + summeKskSelbstzahler(koops || []);
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
    const status = this.auftrag?.status;
    const stornierButton = status !== 'Storniert'
      ? `<button class="btn-stornieren" id="btn-auftrag-stornieren">Auftrag stornieren</button>`
      : `<button class="btn-stornieren btn-stornieren--success" id="btn-auftrag-reaktivieren">Stornierung aufheben</button>`;

    return this.renderInfoItems([
      { icon: 'tag', label: 'Status', value: renderAuftragAmpel(status) },
      { icon: 'building', label: 'Unternehmen', value: this.auftrag?.unternehmen?.firmenname || '-' },
      { icon: 'marken', label: 'Marke', value: this.auftrag?.marke?.markenname || '-' },
      { icon: 'currency', label: 'Nettobetrag', value: this.formatCurrency(this.auftrag?.nettobetrag) },
      { icon: 'calendar', label: 'Start', value: this.formatDate(this.auftrag?.start) },
      { icon: 'calendar', label: 'Ende', value: this.formatDate(this.auftrag?.ende) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.auftrag?.updated_at) }
    ]) + stornierButton;
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
    return renderSecondaryNav(tabs.map((tab) => ({ ...tab, showIcon: true })));
  }

  renderMainContent() {
    return `
      ${this.renderAuftragSummaryCards()}
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

  renderAuftragSummaryCards() {
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    const usedBudget = this.usedBudget || 0;
    const openBudget = Math.max(0, totalBudget - usedBudget);

    const fmt = (v) => v || v === 0
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const num = (v) => v || v === 0
      ? new Intl.NumberFormat('de-DE').format(v) : '-';

    const budgetPct = totalBudget > 0 ? Math.min(100, Math.round((usedBudget / totalBudget) * 100)) : 0;
    const openPct = totalBudget > 0 ? Math.max(0, 100 - budgetPct) : 0;

    const getBudgetColorClass = (pct) => {
      if (pct >= 90) return 'summary-progress-fill--danger';
      if (pct >= 75) return 'summary-progress-fill--warning';
      return '';
    };
    const getOpenBudgetColorClass = (pct) => {
      if (pct <= 10) return 'summary-progress-fill--danger';
      if (pct <= 25) return 'summary-progress-fill--warning';
      return 'summary-progress-fill--success';
    };

    const canViewInternalBudget = window.canSeePricing();

    return `
      <div class="auftragsdetails-summary u-mb-xl">
        <div class="summary-cards">
          ${canViewInternalBudget ? `
          <div class="summary-card" data-summary-card="total-budget">
            <div class="summary-value">${fmt(totalBudget)}</div>
            <div class="summary-label">Gesamtbudget (netto)</div>
          </div>
          <div class="summary-card" data-summary-card="spent-budget">
            <div class="summary-value">${fmt(usedBudget)}</div>
            <div class="summary-label">Verbrauchtes Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}"
                   style="width: ${budgetPct}%">
              </div>
            </div>
          </div>
          <div class="summary-card" data-summary-card="open-budget">
            <div class="summary-value">${fmt(openBudget)}</div>
            <div class="summary-label">Offenes Creator Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}"
                   style="width: ${openPct}%">
              </div>
            </div>
          </div>` : ''}
          <div class="summary-card" data-summary-card="creators">
            <div class="summary-value">${num(this.realCreatorCount)} von ${num(this.targetCreatorCount)}</div>
            <div class="summary-label">Gebuchte Creator</div>
          </div>
          <div class="summary-card" data-summary-card="videos">
            <div class="summary-value">${num(this.usedVideoCount)} von ${num(this.targetVideoCount)}</div>
            <div class="summary-label">Gebuchte Videos</div>
          </div>
        </div>
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
              value: renderAuftragAmpel(a.status)
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
      const isMitarbeiter = window.isMitarbeiter();
      return renderEmptyState({
        icon: 'document',
        title: 'Keine Auftragsdetails vorhanden',
        text: 'Es wurden noch keine detaillierten Produktionsinformationen für diesen Auftrag hinterlegt.',
        actionsHtml: !isMitarbeiter
          ? `<button onclick="window.navigateTo('/projekt-erstellen/edit/${this.auftragId}')" class="mdc-btn">Auftragsdetails anlegen</button>`
          : ''
      });
    }

    const details = this.auftragsDetails;
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';

    // Sammle Kampagnenarten aus den Kampagnen
    const kampagnenarten = this.collectKampagnenartenFromKampagnen();
    
    // Daten für die Tabelle dynamisch aus Kampagnenarten generieren
    const colorPalette = ['#28a745', '#6f42c1', '#fd7e14', '#20c997', '#007bff', '#dc3545'];
    const sections = kampagnenarten.map((artName, index) => {
      const config = getKampagnenartConfig(artName);
      if (!config) return null;
      return {
        title: config.displayName || artName,
        prefix: config.prefix,
        color: colorPalette[index % colorPalette.length],
        hasCreator: config.hasCreator,
        hasBilder: config.hasBilder,
        hasVideographen: config.hasVideographen
      };
    }).filter(s => s !== null)
      // Dedupe nach Prefix: Legacy-Namen können auf dieselbe kanonische Art zeigen
      .filter((s, i, arr) => arr.findIndex(x => x.prefix === s.prefix) === i);
    
    // Fallback auf alle Sections wenn keine Kampagnenarten gefunden wurden
    // (für Abwärtskompatibilität mit bestehenden Daten)
    let usingFallbackSections = false;
    if (sections.length === 0) {
      usingFallbackSections = true;
      sections.push(
        { title: 'UGC Paid', prefix: 'ugc_paid', color: '#28a745', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'UGC Organic', prefix: 'ugc_organic', color: '#6f42c1', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Influencer Kampagne', prefix: 'influencer', color: '#007bff', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Influencer Story', prefix: 'story', color: '#e83e8c', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Vor-Ort-Produktion', prefix: 'vor_ort', color: '#dc3545', hasCreator: true, hasBilder: false, hasVideographen: true }
      );
    }

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const budgetInfo = details[`${section.prefix}_budget_info`];

      // Gewählte Kampagnenarten immer zeigen; nur im Fallback (keine Arten
      // bekannt) auf Zeilen mit Daten begrenzen
      if (usingFallbackSections && !videoAnzahl && !bilderAnzahl && !creatorAnzahl && !budgetInfo) {
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
              ${tableRows || renderEmptyStateRow({ icon: 'cube', title: 'Keine Produktionsdetails vorhanden' }, 5)}
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
             class="mdc-btn mdc-btn--secondary mdc-btn--sm u-mt-xs">
            <span class="mdc-btn__label">Öffnen</span>
            ${icon('external-link', { className: 'icon-16' })}
          </a>
        </div>
      `;
    }
    
    return `
      <div class="summary-card summary-card--document summary-card--empty">
        <div class="summary-icon u-opacity-50">📄</div>
        <div class="summary-label u-text-tertiary">Keine Auftragsbestätigung</div>
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
              ${renderAuftragAmpel(this.auftrag?.status)}
            </div>
            <div class="detail-item">
              <label>Typ:</label>
              <span>${this.auftrag?.auftragtype || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Titel:</label>
              <span>${this.auftrag?.titel || '-'}</span>
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

  // Rendere Creator
  renderCreator() {
    if (!this.creator || this.creator.length === 0) {
      return renderEmptyState({
        icon: 'creator',
        title: 'Keine Creator zugewiesen',
        text: 'Es wurden noch keine Creator diesem Auftrag zugewiesen.'
      });
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
      return renderEmptyState({
        icon: 'invoice',
        title: 'Keine Rechnungen vorhanden',
        text: 'Für diesen Auftrag wurden noch keine Rechnungen erstellt.'
      });
    }
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${fmt(r.nettobetrag)}</td>
        <td>${fmt(r.bruttobetrag)}</td>
        <td>${fDate(r.gestellt_am)}</td>
        <td>${fDate(r.bezahlt_am)}</td>
        <td>${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
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
    window.addEventListener('softRefresh', this._handleSoftRefresh);

    this._eventsBound = true;
  }

  // Tab wechseln
  switchTab(tabName) {
    this.activeMainTab = tabName;
    activateSecondaryNavTab(tabName);
    this.loadTabData(tabName);
  }

  // Bearbeiten laeuft ausschliesslich ueber den Wizard. Das FormSystem-Formular
  // kannte auftrag_teilrechnung nicht und liess die Rechnungsbetraege stehen.
  showEditForm() {
    window.navigateTo(`/projekt-erstellen/edit/${this.auftragId}`);
  }

  // Formatiere Budget-Verbrauch (Netto-Beträge)
  formatBudgetUsage() {
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    
    // Netto-Beträge aus Kooperationen summieren (inkl. KSK-Aufschlaege)
    const usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_netto) || 0);
    }, 0) + summeKskSelbstzahler(this.kooperationen);
    
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
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    
    // Netto-Beträge aus Kooperationen summieren (inkl. KSK-Aufschlaege)
    const usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_netto) || 0);
    }, 0) + summeKskSelbstzahler(this.kooperationen);
    
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
      return renderEmptyState({
        icon: 'handshake',
        title: 'Keine Kooperationen vorhanden',
        text: 'Für diesen Auftrag wurden noch keine Kooperationen angelegt.'
      });
    }

    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    const isKunde = window.isKunde();

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
                  ${icon('external-link', { className: 'icon-20' })}
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
            ${video.content_art ? `<span class="content-art-hint"> (${video.content_art})</span>` : ''}
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

  async _handleStornieren() {
    if (!confirm('Auftrag wirklich stornieren? Der Auftrag wird als inaktiv markiert.')) return;
    try {
      const { error } = await window.supabase
        .from('auftrag')
        .update({ status: 'Storniert' })
        .eq('id', this.auftragId);
      if (error) throw error;
      this.auftrag.status = 'Storniert';
      this.render();
      this.bindEvents();
      window.toastSystem?.show('Auftrag wurde storniert', 'success');
    } catch (err) {
      console.error('❌ Stornierung fehlgeschlagen:', err);
      window.toastSystem?.show('Stornierung fehlgeschlagen', 'error');
    }
  }

  async _handleReaktivieren() {
    if (!confirm('Stornierung aufheben und Auftrag wieder aktivieren?')) return;
    try {
      const { error } = await window.supabase
        .from('auftrag')
        .update({ status: 'Beauftragt' })
        .eq('id', this.auftragId);
      if (error) throw error;
      this.auftrag.status = 'Beauftragt';
      this.render();
      this.bindEvents();
      window.toastSystem?.show('Auftrag wurde reaktiviert', 'success');
    } catch (err) {
      console.error('❌ Reaktivierung fehlgeschlagen:', err);
      window.toastSystem?.show('Reaktivierung fehlgeschlagen', 'error');
    }
  }

  // Cleanup
  destroy() {
    console.log('AuftragDetail: Cleaning up...');
    document.removeEventListener('click', this._handleDocumentClick);
    document.removeEventListener('entityUpdated', this._handleEntityUpdated);
    window.removeEventListener('softRefresh', this._handleSoftRefresh);
    this._eventsBound = false;
    tabDataCache.invalidate('auftrag', this.auftragId);
  }

  showDetailsForm(auftragId) {
    window.navigateTo(`/projekt-erstellen/edit/${this.auftragId}`);
  }

}

export const auftragDetail = new AuftragDetail();