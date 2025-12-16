// AuftragsdetailsDetail.js (ES6-Modul)
// Auftragsdetails-Detailseite ohne Tabs - direkte Anzeige der Informationen

export class AuftragsdetailsDetail {
  constructor() {
    this.detailsId = null;
    this.details = null;
    this.auftrag = null;
    this.notizen = [];
    this.ratings = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.budgetSummary = {
      totalBudget: 0,
      usedBudget: 0,
      totalVideos: 0,
      totalCreators: 0
    };
  }

  // Initialisiere Auftragsdetails-Detailseite
  async init(detailsId) {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Initialisiere Auftragsdetails-Detailseite für ID:', detailsId);
    
    // Security: Nur Mitarbeiter haben Zugriff (Kunden nicht)
    const isKunde = window.currentUser?.rolle === 'kunde';
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    try {
      this.detailsId = detailsId;
      await this.loadDetailsData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.auftrag) {
        const canEdit = window.currentUser?.permissions?.auftrag?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
          { label: this.auftrag.auftragsname || 'Details', url: `/auftragsdetails/${this.detailsId}`, clickable: false }
        ], {
          id: 'btn-edit-details',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ AUFTRAGSDETAILSDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsDetail.init');
    }
  }

  // Lade Auftragsdetails-Daten
  async loadDetailsData() {
    console.log('🔄 AUFTRAGSDETAILSDETAIL: Lade Auftragsdetails-Daten...');
    
    try {
      // Auftragsdetails mit Auftrag-Daten laden (single query mit Joins für Performance)
      const { data: details, error } = await window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            status,
            start,
            ende,
            gesamt_budget,
            creator_budget,
            bruttobetrag,
            nettobetrag,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            ),
            ansprechpartner:ansprechpartner_id (
              id,
              vorname,
              nachname,
              email
            )
          )
        `)
        .eq('id', this.detailsId)
        .single();

      if (error) throw error;
      
      this.details = details;
      this.auftrag = details.auftrag;
      console.log('✅ AUFTRAGSDETAILSDETAIL: Auftragsdetails geladen:', this.details);

      // Notizen laden (falls Notizen-System verfügbar)
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('auftrag_details', this.detailsId);
        console.log('✅ AUFTRAGSDETAILSDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Bewertungen laden (falls Bewertungs-System verfügbar)
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('auftrag_details', this.detailsId);
        console.log('✅ AUFTRAGSDETAILSDETAIL: Ratings geladen:', this.ratings.length);
      }

      // Lade Kampagnen, Kooperationen und Budget-Informationen
      await this.loadBudgetData();

    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Auftragsdetails-Daten:', error);
      throw error;
    }
  }

  // Lade Budget- und Kooperations-Daten
  async loadBudgetData() {
    try {
      const auftragId = this.auftrag?.id;
      if (!auftragId) return;

      console.log('🔄 AUFTRAGSDETAILSDETAIL: Lade Budget-Daten für Auftrag:', auftragId);

      // Lade alle Kampagnen des Auftrags
      const { data: kampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .eq('auftrag_id', auftragId);

      if (kampagnenError) throw kampagnenError;
      
      this.kampagnen = kampagnen || [];
      const kampagneIds = this.kampagnen.map(k => k.id);

      console.log('✅ AUFTRAGSDETAILSDETAIL: Kampagnen geladen:', kampagneIds.length);

      if (kampagneIds.length === 0) {
        this.kooperationen = [];
        this.videos = [];
        this.calculateBudgetSummary();
        return;
      }

      // Lade alle Kooperationen der Kampagnen mit Creator-Informationen
      const { data: kooperationen, error: koopError } = await window.supabase
        .from('kooperationen')
        .select(`
          id,
          name,
          status,
          videoanzahl,
          einkaufspreis_gesamt,
          content_art,
          kampagne_id,
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .in('kampagne_id', kampagneIds)
        .order('created_at', { ascending: false });

      if (koopError) throw koopError;
      
      this.kooperationen = (kooperationen || []).map(koop => ({
        ...koop,
        kampagne: this.kampagnen.find(k => k.id === koop.kampagne_id)
      }));

      console.log('✅ AUFTRAGSDETAILSDETAIL: Kooperationen geladen:', this.kooperationen.length);

      // Lade Videos für alle Kooperationen mit Link-Informationen
      if (this.kooperationen.length > 0) {
        const koopIds = this.kooperationen.map(k => k.id);
        const { data: videos, error: videoError } = await window.supabase
          .from('kooperation_videos')
          .select('id, titel, thema, content_art, kooperation_id, link_content, asset_url')
          .in('kooperation_id', koopIds);

        if (videoError) throw videoError;
        this.videos = videos || [];
        console.log('✅ AUFTRAGSDETAILSDETAIL: Videos geladen:', this.videos.length);
      }

      // Berechne Budget-Zusammenfassung
      this.calculateBudgetSummary();

    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Budget-Daten:', error);
      this.kooperationen = [];
      this.videos = [];
      this.calculateBudgetSummary();
    }
  }

  // Berechne Budget-Zusammenfassung
  calculateBudgetSummary() {
    // Gesamt-Budget aus Auftrag - mehrere Fallbacks
    this.budgetSummary.totalBudget = parseFloat(
      this.auftrag?.creator_budget || 
      this.auftrag?.gesamt_budget || 
      this.auftrag?.bruttobetrag || 
      0
    );
    
    // Verbrauchtes Budget = Summe aller einkaufspreis_gesamt
    this.budgetSummary.usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_gesamt) || 0);
    }, 0);
    
    // Gesamtanzahl Videos = Summe aller videoanzahl aus Kooperationen
    this.budgetSummary.totalVideos = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseInt(koop.videoanzahl, 10) || 0);
    }, 0);
    
    // Anzahl einzigartiger Creator
    const uniqueCreatorIds = new Set();
    this.kooperationen.forEach(koop => {
      if (koop.creator?.id) {
        uniqueCreatorIds.add(koop.creator.id);
      }
    });
    this.budgetSummary.totalCreators = uniqueCreatorIds.size;

    console.log('✅ AUFTRAGSDETAILSDETAIL: Budget-Zusammenfassung berechnet:', this.budgetSummary);
  }

  // Rendere Auftragsdetails-Detailseite
  render() {
    window.setHeadline(`${this.auftrag?.auftragsname || 'Auftragsdetails'} - Details`);
    
    const html = `
      <div class="content-section">
        ${this.renderInformationen()}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Rendere Informationen
  renderInformationen() {
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    const formatCurrency = (v) => {
      if (v === null || v === undefined) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };

    return `
      <div class="detail-section">
        <!-- Budget-Kacheln -->
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${num(this.budgetSummary.totalVideos)} von ${num(this.details?.gesamt_videos || 0)}</div>
              <div class="summary-label">Aktuell gebuchte Videos</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getProgressColorClass(this.budgetSummary.totalVideos, this.details?.gesamt_videos)}" 
                     style="width: ${this.getProgressPercentage(this.budgetSummary.totalVideos, this.details?.gesamt_videos)}%">
                </div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${num(this.budgetSummary.totalCreators)} von ${num(this.details?.gesamt_creator || 0)}</div>
              <div class="summary-label">Aktuell gebuchte Creator</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getProgressColorClass(this.budgetSummary.totalCreators, this.details?.gesamt_creator)}" 
                     style="width: ${this.getProgressPercentage(this.budgetSummary.totalCreators, this.details?.gesamt_creator)}%">
                </div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(this.budgetSummary.usedBudget)} von ${formatCurrency(this.budgetSummary.totalBudget)}</div>
              <div class="summary-label">Budget verbraucht</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getBudgetProgressColorClass()}" 
                     style="width: ${this.getBudgetProgressPercentage()}%">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Kategorien-Übersicht Tabelle -->
        ${this.renderKategorienTable()}

        <!-- Kooperationen & Videos -->
        <div style="margin-top: 32px;">
          <h3>Kooperationen & Videos</h3>
          ${this.renderCreatorVideosTable()}
        </div>
      </div>
    `;
  }

  // Rendere Kategorien-Übersichtstabelle (UGC, Influencer, Vor Ort, etc.)
  renderKategorienTable() {
    const details = this.details;
    if (!details) return '';

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
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const videographenAnzahl = details[`${section.prefix}_videographen_anzahl`];
      const budgetInfo = details[`${section.prefix}_budget_info`];

      // Zeige nur Zeilen mit Daten
      if (!videoAnzahl && !bilderAnzahl && !creatorAnzahl && !videographenAnzahl && !budgetInfo) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${num(bilderAnzahl)}</td>
          <td class="text-center">${num(creatorAnzahl)}</td>
          <td class="text-center">${num(videographenAnzahl)}</td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info-large">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
        </tr>
      `;
    }).filter(row => row).join('');

    if (!tableRows) {
      return `
        <div class="data-table-container" style="margin-top: var(--space-lg);">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Bilder</th>
                <th class="text-center">Creator</th>
                <th class="text-center">Videographen</th>
                <th>Budget & Informationen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="6" class="no-data">
                  Keine Produktionsdetails vorhanden
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="data-table-container" style="margin-top: var(--space-lg);">
        <table class="data-table auftragsdetails-table">
          <thead>
            <tr>
              <th>Kategorie</th>
              <th class="text-center">Videos</th>
              <th class="text-center">Bilder</th>
              <th class="text-center">Creator</th>
              <th class="text-center">Videographen</th>
              <th>Budget & Informationen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere Creator & Videos Tabelle
  renderCreatorVideosTable() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      return `
        <div style="margin-top: var(--space-xl);">
          <h3 style="margin-bottom: var(--space-md);">Creator & Videos Übersicht</h3>
          <div class="empty-state">
            <div class="empty-icon">📹</div>
            <h3>Keine Kooperationen vorhanden</h3>
            <p>Für diesen Auftrag wurden noch keine Kooperationen mit Creator und Videos angelegt.</p>
          </div>
        </div>
      `;
    }

    // Erstelle eine Liste aller Videos mit Creator-Informationen
    const videoRows = [];
    
    this.kooperationen.forEach(koop => {
      const creator = koop.creator || {};
      const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || 'Unbekannt';
      const creatorId = creator.id;
      
      // Videos für diese Kooperation
      const koopVideos = this.videos.filter(v => v.kooperation_id === koop.id);
      
      if (koopVideos.length === 0) {
        // Wenn keine Videos vorhanden, zeige trotzdem die Kooperation mit Creator
        videoRows.push({
          creatorName,
          creatorId,
          kategorie: koop.content_art || '-',
          videoTitel: '-',
          videoLink: null,
          kooperationId: koop.id,
          kooperationName: koop.name || 'Kooperation'
        });
      } else {
        // Für jedes Video eine Zeile erstellen
        koopVideos.forEach(video => {
          const videoLink = video.link_content || video.asset_url || null;
          videoRows.push({
            creatorName,
            creatorId,
            kategorie: video.content_art || koop.content_art || '-',
            videoTitel: video.titel || video.thema || 'Video',
            videoLink,
            kooperationId: koop.id,
            kooperationName: koop.name || 'Kooperation',
            videoId: video.id
          });
        });
      }
    });

    if (videoRows.length === 0) {
      return `
        <div style="margin-top: var(--space-xl);">
          <h3 style="margin-bottom: var(--space-md);">Creator & Videos Übersicht</h3>
          <div class="empty-state">
            <div class="empty-icon">📹</div>
            <h3>Keine Videos vorhanden</h3>
            <p>Für diesen Auftrag wurden noch keine Videos angelegt.</p>
          </div>
        </div>
      `;
    }

    const rowsHtml = videoRows.map(row => {
      const videoLinkHtml = row.videoLink 
        ? `<a href="${window.validatorSystem.sanitizeHtml(row.videoLink)}" target="_blank" rel="noopener noreferrer" class="table-link">
             ${window.validatorSystem.sanitizeHtml(row.videoLink)}
           </a>`
        : '-';
      
      const creatorLinkHtml = row.creatorId
        ? `<a href="#" class="table-link" data-table="creator" data-id="${row.creatorId}">
             ${window.validatorSystem.sanitizeHtml(row.creatorName)}
           </a>`
        : window.validatorSystem.sanitizeHtml(row.creatorName);

      const videoTitelHtml = row.videoId
        ? `<a href="#" class="table-link" data-table="video" data-id="${row.videoId}">
             ${window.validatorSystem.sanitizeHtml(row.videoTitel)}
           </a>`
        : window.validatorSystem.sanitizeHtml(row.videoTitel);

      return `
        <tr>
          <td>${creatorLinkHtml}</td>
          <td>${window.validatorSystem.sanitizeHtml(row.kategorie)}</td>
          <td>${videoTitelHtml}</td>
          <td>${videoLinkHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-top: var(--space-xl);">
        <h3 style="margin-bottom: var(--space-md);">Creator & Videos Übersicht</h3>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Kategorie</th>
                <th>Video</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }


  // Formatiere Ansprechpartner
  formatAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner) return '-';
    const name = [ansprechpartner.vorname, ansprechpartner.nachname].filter(Boolean).join(' ');
    return ansprechpartner.email ? `${name} (${ansprechpartner.email})` : name;
  }

  // Berechne Progress-Prozentsatz für Videos/Creator
  getProgressPercentage(current, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  }

  // Bestimme Farbe für Progress-Bar basierend auf Prozentsatz (Videos/Creator)
  getProgressColorClass(current, total) {
    if (!total || total <= 0) return '';
    const percentage = this.getProgressPercentage(current, total);
    
    if (percentage >= 100) return 'summary-progress-fill--success';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  }

  // Berechne Budget Progress-Prozentsatz
  getBudgetProgressPercentage() {
    if (this.budgetSummary.totalBudget <= 0) return 0;
    return Math.min(100, Math.round((this.budgetSummary.usedBudget / this.budgetSummary.totalBudget) * 100));
  }

  // Bestimme Farbe für Budget Progress-Bar
  getBudgetProgressColorClass() {
    const percentage = this.getBudgetProgressPercentage();
    
    if (percentage >= 90) return 'summary-progress-fill--danger';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  }

  // Binde Events
  bindEvents() {
    // Edit-Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-details' || e.target.closest('#btn-edit-details')) {
        e.preventDefault();
        this.showEditForm();
      }

      // Table-Links
      const link = e.target.closest('.table-link');
      if (link) {
        e.preventDefault();
        const table = link.dataset.table;
        const id = link.dataset.id;
        if (table && id) {
          window.navigateTo(`/${table}/${id}`);
        }
      }
    });

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadDetailsData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadDetailsData().then(() => {
        this.render();
        this.bindEvents();
      });
    });
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Öffne Bearbeitungsformular via Drawer');
    
    // Verwende den bestehenden AuftragsDetailsManager
    if (window.auftragsDetailsManager) {
      window.auftragsDetailsManager.open(this.auftrag.id);
    } else {
      window.notificationSystem?.show('Bearbeitungsformular nicht verfügbar', 'error');
    }
  }

  // Cleanup
  destroy() {
    console.log('AUFTRAGSDETAILSDETAIL: Cleaning up...');
  }
}

export const auftragsdetailsDetail = new AuftragsdetailsDetail();

