// AuftragDetail.js (ES6-Modul)
// Auftrags-Detailseite mit Tabs für Informationen, Notizen, Bewertungen und Creator

import { AuftragsDetailsManager, auftragsDetailsManager } from './logic/AuftragsDetailsManager.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

export class AuftragDetail {
  constructor() {
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
  }

  // Initialisiere Auftrags-Detailseite
  async init(auftragId) {
    console.log('🎯 AUFTRAGDETAIL: Initialisiere Auftrags-Detailseite für ID:', auftragId);
    
    try {
      this.auftragId = auftragId;
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.auftrag) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftrag', url: '/auftrag', clickable: true },
          { label: this.auftrag.auftragsname || 'Details', url: `/auftrag/${this.auftragId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
      this.setupCacheInvalidation();
      console.log('✅ AUFTRAGDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragDetail.init');
    }
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
        auftragsDetailsResult
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
          .maybeSingle()
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
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ AUFTRAGDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }
  
  // Lade Tab-Daten lazy (Rechnungen & Kooperationen-Summaries)
  async loadTabData(tabName) {
    return await tabDataCache.load('auftrag', this.auftragId, tabName, async () => {
      console.log(`🔄 Lade Tab: ${tabName}`);
      
      try {
        switch(tabName) {
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
            return rechnungen;
        }
      } catch (error) {
        console.error(`❌ Fehler beim Laden von Tab ${tabName}:`, error);
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
    const container = document.querySelector('#tab-rechnungen');
    if (container) {
      container.innerHTML = this.renderRechnungenTab();
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
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-edit-auftrag" class="secondary-btn">
            <i class="icon-edit"></i>
            Auftrag bearbeiten
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation (nur Auftragsdetails) -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="auftragsdetails">
            Auftragsdetails
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Auftragsdetails Tab -->
          <div class="tab-pane active" id="auftragsdetails">
            ${this.renderAuftragsdetails()}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
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
            <h3>Einnahmen (Auftrag)</h3>
            <div class="detail-item"><label>Netto:</label><span>${fmt(a.nettobetrag)}</span></div>
            <div class="detail-item"><label>USt (%):</label><span>${num(ustProzent)}</span></div>
            <div class="detail-item"><label>USt Betrag:</label><span>${fmt(ustBetrag)}</span></div>
            <div class="detail-item"><label>Brutto Gesamtbudget:</label><span>${fmt(a.bruttobetrag)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Planwerte</h3>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (%):</label><span>${num(dbProzent)}</span></div>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (Betrag):</label><span>${fmt(dbBetrag)}</span></div>
            <div class="detail-item"><label>KSK (5% von Netto):</label><span>${fmt(a.ksk_betrag)}</span></div>
            <div class="detail-item"><label>Creator Budget:</label><span>${fmt(a.creator_budget)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Preisaufbau (Netto)</h3>
            <div class="detail-item"><label>Influencer:</label><span>${num(a.influencer)} × ${fmt(a.influencer_preis)}</span></div>
            <div class="detail-item"><label>UGC:</label><span>${num(a.ugc)} × ${fmt(a.ugc_preis)}</span></div>
            <div class="detail-item"><label>Vor Ort Produktion:</label><span>${num(a.vor_ort_produktion)} × ${fmt(a.vor_ort_preis)}</span></div>
            <div class="detail-item"><label>Summe Positionen (Netto):</label><span>${fmt(itemsNetto)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Rechnungen</h3>
            <div class="detail-item"><label>Anzahl:</label><span>${num(this.rechnungSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Netto:</label><span>${fmt(this.rechnungSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Brutto:</label><span>${fmt(this.rechnungSummary.sumBrutto)}</span></div>
            <div class="detail-item"><label>Bezahlt / Offen:</label><span>${num(this.rechnungSummary.paidCount)} / ${num(this.rechnungSummary.openCount)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Ausgaben (Kooperationen)</h3>
            <div class="detail-item"><label>Anzahl Kooperationen:</label><span>${num(this.koopSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Nettokosten:</label><span>${fmt(this.koopSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Gesamtkosten:</label><span>${fmt(this.koopSummary.sumGesamt)}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Auftragsdetails-Tab
  renderAuftragsdetails() {
    if (!this.auftragsDetails) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Auftragsdetails vorhanden</h3>
          <p>Es wurden noch keine detaillierten Produktionsinformationen für diesen Auftrag hinterlegt.</p>
          <button onclick="window.auftragsDetailsManager?.open('${this.auftragId}')" class="primary-btn">
            Auftragsdetails anlegen
          </button>
        </div>
      `;
    }

    const details = this.auftragsDetails;
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';

    // Daten für die Tabelle vorbereiten
    const sections = [
      {
        title: 'UGC (User Generated Content)',
        prefix: 'ugc',
        color: '#28a745'
      },
      {
        title: 'Influencer',
        prefix: 'influencer', 
        color: '#6f42c1'
      },
      {
        title: 'Vor Ort Dreh',
        prefix: 'vor_ort',
        color: '#fd7e14'
      },
      {
        title: 'Vor Ort Dreh Mitarbeiter',
        prefix: 'vor_ort_mitarbeiter',
        color: '#20c997'
      }
    ];

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const videographenAnzahl = details[`${section.prefix}_videographen_anzahl`];
      const budgetInfo = details[`${section.prefix}_budget_info`];

      // Zeige nur Zeilen mit Daten
      if (!videoAnzahl && !creatorAnzahl && !videographenAnzahl && !budgetInfo) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${num(creatorAnzahl)}</td>
          <td class="text-center">${num(videographenAnzahl)}</td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
        </tr>
      `;
    }).filter(row => row).join('');

    return `
      <div class="detail-section">
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${num(this.realVideoCount)}</div>
              <div class="summary-label">Aktuell gebuchte Videos</div>
              ${details?.gesamt_videos ? `<div class="summary-planned">Geplant: ${num(details.gesamt_videos)}</div>` : ''}
            </div>
            <div class="summary-card">
              <div class="summary-value">${num(this.realCreatorCount)}</div>
              <div class="summary-label">Aktuell gebuchte Creator</div>
              ${details?.gesamt_creator ? `<div class="summary-planned">Geplant: ${num(details.gesamt_creator)}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Creator</th>
                <th class="text-center">Videographen</th>
                <th>Budget & Informationen</th>
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
      </div>
    `;
  }

  // Rendere Informationen
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Auftrags-Informationen</h3>
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
          <div class="empty-icon">👤</div>
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
          <div class="empty-icon">💶</div>
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
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      }
    });

    // Auftrag bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-auftrag') {
        this.showEditForm();
      }
    });

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadAuftragData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadAuftragData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    // Auftragsdetails Updated Event
    document.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'auftrag_details' && e.detail.auftrag_id == this.auftragId) {
        this.loadAuftragData().then(() => {
          this.render();
          this.bindEvents();
        });
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ AUFTRAGDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      if (!this.auftragId || !location.pathname.includes('/auftrag/')) {
        return;
      }
      console.log('🔄 AUFTRAGDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadAuftragData();
      this.render();
      this.bindEvents();
    });
  }

  // Tab wechseln
  switchTab(tabName) {
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
    const selectedPane = document.getElementById(tabName);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedPane) selectedPane.classList.add('active');
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

    // Formular-Events binden mit vorbereiteten Daten
    window.formSystem.bindFormEvents('auftrag', formData);
    
    // Form-Datasets für DynamicDataLoader setzen
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
      
      console.log('📋 AUFTRAGDETAIL: EditModeData gesetzt:', editModeData);
      console.log('🎨 AUFTRAGDETAIL: art_der_kampagne in editModeData:', editModeData.art_der_kampagne);
      
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
      
      console.log('📋 AUFTRAGDETAIL: Form-Datasets gesetzt:', {
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        entityId: form.dataset.entityId,
        existingUnternehmenId: form.dataset.existingUnternehmenId,
        existingMarkeId: form.dataset.existingMarkeId,
        existingAnsprechpartnerId: form.dataset.existingAnsprechpartnerId,
        editModeData: 'Set'
      });
      
      // Custom Submit Handler für Bearbeitungsformular
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
      
      console.log('🔍 AUFTRAGDETAIL: Form Datasets gesetzt:', {
        entityId: form.dataset.entityId,
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        existingUnternehmenId: form.dataset.existingUnternehmenId,
        existingMarkeId: form.dataset.existingMarkeId,
        existingAnsprechpartnerId: form.dataset.existingAnsprechpartnerId
      });
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('auftrag-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        submitData[key] = value;
      }

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
        this.showSuccessMessage('Auftrag erfolgreich aktualisiert!');
        
        // Daten neu laden und zur Detailseite zurückkehren
        setTimeout(async () => {
          await this.loadAuftragData();
          this.render();
          this.bindEvents();
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
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

  // Cleanup
  destroy() {
    console.log('AuftragDetail: Cleaning up...');
  }

  showDetailsForm(auftragId) {
    auftragsDetailsManager.open(auftragId);
  }
}

export const auftragDetail = new AuftragDetail();