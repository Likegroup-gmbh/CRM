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
    this._eventsBound = false;
    this._docClickHandler = null;
    this._notizenUpdatedHandler = null;
    this._bewertungenUpdatedHandler = null;
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
        const canEdit = window.currentUser?.permissions?.auftragsdetails?.can_edit !== false;
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
            auftragtype,
            kampagnenanzahl,
            status,
            start,
            ende,
            gesamt_budget,
            creator_budget,
            bruttobetrag,
            nettobetrag,
            po,
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
          einkaufspreis_netto,
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
    // Gesamt-Budget aus Auftrag - mehrere Fallbacks (Netto)
    this.budgetSummary.totalBudget = parseFloat(
      this.auftrag?.creator_budget || 
      this.auftrag?.gesamt_budget || 
      this.auftrag?.nettobetrag || 
      0
    );
    
    // Verbrauchtes Budget = Summe aller einkaufspreis_netto
    this.budgetSummary.usedBudget = this.kooperationen.reduce((sum, koop) => {
      return sum + (parseFloat(koop.einkaufspreis_netto) || 0);
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

    this.budgetSummary.avgCostPerCreator = this.budgetSummary.totalCreators > 0
      ? this.budgetSummary.usedBudget / this.budgetSummary.totalCreators
      : 0;

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

    const auftragtype = this.auftrag?.auftragtype || '-';
    const sanitize = (v) => window.validatorSystem?.sanitizeHtml(v) || v || '';
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    return `
      <div class="detail-section">
        <!-- Budget-Kacheln -->
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-label">Art des Auftrages</div>
              <div class="summary-value">${sanitize(auftragtype)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Gebuchte Videos</div>
              <div class="summary-value">${num(this.budgetSummary.totalVideos)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Gebuchte Creator</div>
              <div class="summary-value">${num(this.budgetSummary.totalCreators)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">PO intern</div>
              <div class="summary-value">${sanitize(this.auftrag?.po) || '-'}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Durchschn. Kosten / Creator</div>
              <div class="summary-value">${formatCurrency(this.budgetSummary.avgCostPerCreator)}</div>
            </div>
            ${isAdmin ? `
            <div class="summary-card">
              <div class="summary-label">Budget verbraucht (Netto)</div>
              <div class="summary-value">${formatCurrency(this.budgetSummary.usedBudget)} von ${formatCurrency(this.budgetSummary.totalBudget)}</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getBudgetProgressColorClass()}" 
                     style="width: ${this.getBudgetProgressPercentage()}%">
                </div>
              </div>
            </div>
            ` : ''}
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
    const formatCurrency = (v) => {
      if (v === null || v === undefined || v === '') return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const formatPriceRange = (von, bis) => {
      if (!von && !bis) return '-';
      if (von && bis && von !== bis) {
        return `${formatCurrency(von)} - ${formatCurrency(bis)}`;
      }
      return formatCurrency(von || bis);
    };
    
    // Start und Ende aus Auftrag
    const auftragStart = formatDate(this.auftrag?.start);
    const auftragEnde = formatDate(this.auftrag?.ende);

    const hasValue = (value) => value !== null && value !== undefined && value !== '';
    const hasDataForPrefix = (prefix, hasVideographen = false) => {
      const fields = [
        `${prefix}_video_anzahl`,
        `${prefix}_bilder_anzahl`,
        `${prefix}_creator_anzahl`,
        `${prefix}_budget_info`,
        `${prefix}_einkaufspreis_netto_von`,
        `${prefix}_einkaufspreis_netto_bis`,
        `${prefix}_verkaufspreis_netto_von`,
        `${prefix}_verkaufspreis_netto_bis`
      ];

      if (hasVideographen) fields.push(`${prefix}_videographen_anzahl`);
      return fields.some(field => hasValue(details[field]));
    };

    const newUgcSections = [
      {
        title: 'UGC Pro Paid',
        prefix: 'ugc_pro_paid',
        color: '#28a745',
        hasVideographen: false
      },
      {
        title: 'UGC Pro Organic',
        prefix: 'ugc_pro_organic',
        color: '#17a2b8',
        hasVideographen: false
      },
      {
        title: 'UGC Video Paid',
        prefix: 'ugc_video_paid',
        color: '#6f42c1',
        hasVideographen: false
      },
      {
        title: 'UGC Video Organic',
        prefix: 'ugc_video_organic',
        color: '#fd7e14',
        hasVideographen: false
      }
    ];

    const legacyUgcSections = [
      {
        title: 'UGC',
        prefix: 'ugc',
        color: '#28a745',
        hasVideographen: false
      },
      {
        title: 'IGC',
        prefix: 'igc',
        color: '#17a2b8',
        hasVideographen: false
      }
    ];

    const hasNewUgcData = newUgcSections.some(section => hasDataForPrefix(section.prefix, section.hasVideographen));
    const ugcSections = hasNewUgcData ? newUgcSections : legacyUgcSections;

    // Daten für die Tabelle vorbereiten (hybrid: neue UGC-Kategorien mit Legacy-Fallback)
    const sections = [
      ...ugcSections,
      {
        title: 'Influencer Kampagne',
        prefix: 'influencer',
        color: '#20c997',
        hasVideographen: false
      },
      {
        title: 'Vor-Ort-Produktion',
        prefix: 'vor_ort',
        color: '#007bff',
        hasVideographen: true
      }
    ];

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const videographenAnzahl = section.hasVideographen ? details[`${section.prefix}_videographen_anzahl`] : null;
      const budgetInfo = details[`${section.prefix}_budget_info`];
      const einkaufspreisVon = details[`${section.prefix}_einkaufspreis_netto_von`];
      const einkaufspreisBis = details[`${section.prefix}_einkaufspreis_netto_bis`];
      const verkaufspreisVon = details[`${section.prefix}_verkaufspreis_netto_von`];
      const verkaufspreisBis = details[`${section.prefix}_verkaufspreis_netto_bis`];

      // Zeige nur Zeilen mit Daten
      if (!videoAnzahl && !bilderAnzahl && !creatorAnzahl && !videographenAnzahl && !budgetInfo && !einkaufspreisVon && !einkaufspreisBis && !verkaufspreisVon && !verkaufspreisBis) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info-large">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
          <td class="text-center">${auftragStart}</td>
          <td class="text-center">${auftragEnde}</td>
          <td class="text-right">${formatCurrency(einkaufspreisVon)}</td>
          <td class="text-right">${formatCurrency(einkaufspreisBis)}</td>
          <td class="text-right">${formatCurrency(verkaufspreisVon)}</td>
          <td class="text-right">${formatCurrency(verkaufspreisBis)}</td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${num(bilderAnzahl)}</td>
          <td class="text-center">${num(creatorAnzahl)}</td>
          <td class="text-center">${section.hasVideographen ? num(videographenAnzahl) : '-'}</td>
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
                <th>Budget & Informationen</th>
                <th class="text-center">Start</th>
                <th class="text-center">Ende</th>
                <th class="text-right">EK von</th>
                <th class="text-right">EK bis</th>
                <th class="text-right">VK von</th>
                <th class="text-right">VK bis</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Bilder</th>
                <th class="text-center">Creator</th>
                <th class="text-center">Videographen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="12" class="no-data">
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
              <th>Budget & Informationen</th>
              <th class="text-center">Start</th>
              <th class="text-center">Ende</th>
              <th class="text-right">EK von</th>
              <th class="text-right">EK bis</th>
              <th class="text-right">VK von</th>
              <th class="text-right">VK bis</th>
              <th class="text-center">Videos</th>
              <th class="text-center">Bilder</th>
              <th class="text-center">Creator</th>
              <th class="text-center">Videographen</th>
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
      
      const kampagne = koop.kampagne;

      if (koopVideos.length === 0) {
        videoRows.push({
          creatorName,
          creatorId,
          kategorie: koop.content_art || '-',
          videoTitel: '-',
          videoLink: null,
          kooperationId: koop.id,
          kooperationName: koop.name || 'Kooperation',
          kampagneId: kampagne?.id,
          kampagneName: kampagne?.kampagnenname || '-'
        });
      } else {
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
            videoId: video.id,
            kampagneId: kampagne?.id,
            kampagneName: kampagne?.kampagnenname || '-'
          });
        });
      }
    });

    if (videoRows.length === 0) {
      return `
        <div style="margin-top: var(--space-xl);">
          <h3 style="margin-bottom: var(--space-md);">Creator & Videos Übersicht</h3>
          <div class="empty-state">
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

      const kampagneLinkHtml = row.kampagneId
        ? `<a href="#" class="table-link" data-table="kampagne" data-id="${row.kampagneId}">${window.validatorSystem.sanitizeHtml(row.kampagneName)}</a>`
        : window.validatorSystem.sanitizeHtml(row.kampagneName);

      return `
        <tr>
          <td>${creatorLinkHtml}</td>
          <td>${kampagneLinkHtml}</td>
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
                <th>Kampagne</th>
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
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Edit-Button + Table-Links
    this._docClickHandler = (e) => {
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
    };
    document.addEventListener('click', this._docClickHandler);

    // Notizen und Bewertungen Events
    this._notizenUpdatedHandler = () => {
      this.loadDetailsData().then(() => {
        this.render();
      });
    };
    document.addEventListener('notizenUpdated', this._notizenUpdatedHandler);

    this._bewertungenUpdatedHandler = () => {
      this.loadDetailsData().then(() => {
        this.render();
      });
    };
    document.addEventListener('bewertungenUpdated', this._bewertungenUpdatedHandler);
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Öffne Bearbeitungsformular für Details:', this.detailsId);
    
    // Standard-Route wie bei anderen Entitäten
    window.navigateTo(`/auftragsdetails/${this.detailsId}/edit`);
  }

  // Cleanup
  destroy() {
    console.log('AUFTRAGSDETAILSDETAIL: Cleaning up...');
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    if (this._notizenUpdatedHandler) {
      document.removeEventListener('notizenUpdated', this._notizenUpdatedHandler);
      this._notizenUpdatedHandler = null;
    }
    if (this._bewertungenUpdatedHandler) {
      document.removeEventListener('bewertungenUpdated', this._bewertungenUpdatedHandler);
      this._bewertungenUpdatedHandler = null;
    }
    this._eventsBound = false;
  }
}

export const auftragsdetailsDetail = new AuftragsdetailsDetail();

