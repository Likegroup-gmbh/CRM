// MarkeDetail.js (ES6-Modul)
// Marken-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Kampagnen und Aufträge

import { TableHelper } from '../../core/TableHelper.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

export class MarkeDetail {
  constructor() {
    this.markeId = null;
    this.marke = null;
    this.notizen = [];
    this.ratings = [];
    this.kampagnen = [];
    this.auftraege = [];
    this.briefings = [];
    this.kooperationen = [];
    this.ansprechpartner = [];
    this.rechnungen = [];
  }

  // Initialisiere Marken-Detailseite
  async init(markeId) {
    console.log('🎯 MARKENDETAIL: Initialisiere Marken-Detailseite für ID:', markeId);
    
    try {
      this.markeId = markeId;
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.marke) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Marke', url: '/marke', clickable: true },
          { label: this.marke.markenname || 'Details', url: `/marke/${this.markeId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
      this.setupCacheInvalidation();
      console.log('✅ MARKENDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ MARKENDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'MarkeDetail.init');
    }
  }

  // Lade kritische Daten parallel
  async loadCriticalData() {
    console.log('🔄 MARKENDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        markeResult,
        branchenResult,
        notizenResult,
        ratingsResult,
        ansprechpartnerResult
      ] = await parallelLoad([
        // 1. Marken-Basisdaten mit Relations
        () => window.supabase
          .from('marke')
          .select(`
            *,
            unternehmen:unternehmen_id(firmenname),
            branche:branche_id(name)
          `)
          .eq('id', this.markeId)
          .single(),
        
        // 2. Branchen aus Junction Table
        () => window.supabase
          .from('marke_branchen')
          .select(`
            branche_id,
            branche:branche_id(name)
          `)
          .eq('marke_id', this.markeId),
        
        // 3. Notizen
        () => window.notizenSystem ? 
          window.notizenSystem.loadNotizen('marke', this.markeId) : 
          Promise.resolve([]),
        
        // 4. Ratings
        () => window.bewertungsSystem ? 
          window.bewertungsSystem.loadBewertungen('marke', this.markeId) : 
          Promise.resolve([]),
        
        // 5. Ansprechpartner
        () => window.supabase
          .from('ansprechpartner_marke')
          .select(`
            ansprechpartner_id,
            ansprechpartner:ansprechpartner_id (
              *,
              position:position_id(name),
              unternehmen:unternehmen_id(firmenname),
              telefonnummer_land:eu_laender!telefonnummer_land_id (
                id, name, name_de, iso_code, vorwahl
              ),
              telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
                id, name, name_de, iso_code, vorwahl
              )
            )
          `)
          .eq('marke_id', this.markeId)
      ]);
      
      // Daten verarbeiten
      if (markeResult.error) throw markeResult.error;
      this.marke = markeResult.data;
      
      // Branchen verarbeiten
      if (!branchenResult.error && branchenResult.data && branchenResult.data.length > 0) {
        this.marke.branchen = branchenResult.data.map(item => item.branche);
      } else {
        this.marke.branchen = [];
      }
      
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];
      
      // Ansprechpartner verarbeiten
      if (!ansprechpartnerResult.error) {
        this.ansprechpartner = ansprechpartnerResult.data?.map(item => item.ansprechpartner) || [];
      }
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ MARKENDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ MARKENDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }
  
  // Lade Tab-Daten lazy
  async loadTabData(tabName) {
    return await tabDataCache.load('marke', this.markeId, tabName, async () => {
      console.log(`🔄 Lade Tab: ${tabName}`);
      
      try {
        switch(tabName) {
          case 'kampagnen':
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('*')
              .eq('marke_id', this.markeId);
            this.kampagnen = kampagnen || [];
            this.updateKampagnenTab();
            return kampagnen;
          
          case 'auftraege':
            const { data: auftraege } = await window.supabase
              .from('auftrag')
              .select('*')
              .eq('marke_id', this.markeId);
            this.auftraege = auftraege || [];
            this.updateAuftraegeTab();
            return auftraege;
          
          case 'briefings':
            const { data: briefings } = await window.supabase
              .from('briefings')
              .select('id, product_service_offer, status, deadline, marke_id, kampagne_id, created_at')
              .eq('marke_id', this.markeId)
              .order('created_at', { ascending: false });
            this.briefings = briefings || [];
            this.updateBriefingsTab();
            return briefings;
          
          case 'kooperationen':
            // Erst Kampagnen laden (falls noch nicht geladen)
            if (!this.kampagnen || this.kampagnen.length === 0) {
              await this.loadTabData('kampagnen');
            }
            const kampagneIds = (this.kampagnen || []).map(k => k.id).filter(Boolean);
            if (kampagneIds.length > 0) {
              const { data: kooperationen } = await window.supabase
                .from('kooperationen')
                .select(`
                  id, name, status, videoanzahl, einkaufspreis_gesamt, kampagne_id, creator_id, created_at,
                  creator:creator_id (vorname, nachname),
                  kampagne:kampagne_id (kampagnenname)
                `)
                .in('kampagne_id', kampagneIds)
                .order('created_at', { ascending: false });
              this.kooperationen = kooperationen || [];
            } else {
              this.kooperationen = [];
            }
            this.updateKooperationenTab();
            return this.kooperationen;
          
          case 'rechnungen':
            // Erst Aufträge laden (falls noch nicht geladen)
            if (!this.auftraege || this.auftraege.length === 0) {
              await this.loadTabData('auftraege');
            }
            const auftragIds = (this.auftraege || []).map(a => a.id).filter(Boolean);
            if (auftragIds.length > 0) {
              const { data: rechnungen } = await window.supabase
                .from('rechnung')
                .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url, auftrag_id')
                .in('auftrag_id', auftragIds);
              this.rechnungen = rechnungen || [];
            } else {
              this.rechnungen = [];
            }
            this.updateRechnungenTab();
            return this.rechnungen;
        }
      } catch (error) {
        console.error(`❌ Fehler beim Laden von Tab ${tabName}:`, error);
        return null;
      }
    });
  }
  
  // Tab-Update-Methoden
  updateKampagnenTab() {
    const container = document.querySelector('#kampagnen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderKampagnen();
    }
  }
  
  updateAuftraegeTab() {
    const container = document.querySelector('#auftraege .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderAuftraege();
    }
  }
  
  updateBriefingsTab() {
    const container = document.querySelector('#briefings .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderBriefings();
    }
  }
  
  updateKooperationenTab() {
    const container = document.querySelector('#kooperationen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderKooperationen();
    }
  }
  
  updateRechnungenTab() {
    const container = document.querySelector('#rechnungen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderRechnungen();
    }
  }
  
  // Setup Cache-Invalidierung bei Updates
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'marke' && e.detail?.id === this.markeId) {
        console.log('🔄 MARKENDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('marke', this.markeId);
        
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => this.render());
        }
      }
    });
  }

  // Rendere Marken-Detailseite
  render() {
    window.setHeadline(`${this.marke?.markenname || 'Marke'} - Details`);
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-edit-marke" class="secondary-btn">
            <i class="icon-edit"></i>
            Marke bearbeiten
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="briefings">
            Briefings
            <span class="tab-count">${this.briefings.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Briefings Tab -->
          <div class="tab-pane" id="briefings">
            ${this.renderBriefings()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="kooperationen">
            ${this.renderKooperationen()}
          </div>

          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Rendere Informationen
  renderInformationen() {
    // Logo-Anzeige
    const logoHtml = this.marke?.logo_url ? `
      <div class="form-logo-display">
        <img src="${this.marke.logo_url}" alt="${this.marke.markenname} Logo" class="form-logo-image" />
      </div>
    ` : '';
    
    return `
      <div class="detail-section">
        ${logoHtml}
        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-item">
              <label>Markenname:</label>
              <span>${this.marke?.markenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.marke?.unternehmen?.firmenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.marke?.webseite ? `<a href="${this.marke.webseite}" target="_blank">${this.marke.webseite}</a>` : '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Branchen:</label>
              <span>${this.renderBranchen()}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.marke?.created_at ? new Date(this.marke.created_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.marke?.updated_at ? new Date(this.marke.updated_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Branchen
  renderBranchen() {
    if (!this.marke?.branchen || this.marke.branchen.length === 0) {
      return '-';
    }

    // Branchen als Tags mit vorhandenen CSS-Klassen
    const branchenTags = this.marke.branchen
      .filter(branche => branche && branche.name) // Nur gültige Branchen
      .map(branche => `<span class="tag tag--branche">${branche.name}</span>`)
      .join('');

    return `<div class="tags">${branchenTags}</div>`;
  }

  // Rendere Notizen
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'marke', this.markeId);
    }
    return '<p>Notizen-System nicht verfügbar</p>';
  }

  // Rendere Bewertungen
  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'marke', this.markeId);
    }
    return '<p>Bewertungs-System nicht verfügbar</p>';
  }

  // Rendere Kampagnen
  renderKampagnen() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für diese Marke erstellt.</p>
        </div>
      `;
    }

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const rows = this.kampagnen.map(kampagne => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${kampagne.kampagnenname || 'Unbekannte Kampagne'}
          </a>
        </td>
        <td><span class="status-badge status-${kampagne.status?.toLowerCase() || 'unknown'}">${kampagne.status || 'Unbekannt'}</span></td>
        <td>${this.marke?.markenname || '-'}</td>
        <td>${formatDate(kampagne.start)}</td>
        <td>${formatDate(kampagne.deadline)}</td>
        <td>${kampagne.creatoranzahl || 0}</td>
        <td>${kampagne.videoanzahl || 0}</td>
        <td>
          ${actionBuilder.create('kampagne', kampagne.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagnenname</th>
              <th>Status</th>
              <th>Marke</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere Aufträge
  renderAuftraege() {
    if (!this.auftraege || this.auftraege.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Aufträge vorhanden</h3>
          <p>Es wurden noch keine Aufträge für diese Marke erstellt.</p>
        </div>
      `;
    }

    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const rows = this.auftraege.map(auftrag => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
            ${auftrag.auftragsname || 'Unbekannter Auftrag'}
          </a>
        </td>
        <td><span class="status-badge status-${auftrag.status?.toLowerCase() || 'unknown'}">${auftrag.status || 'Unbekannt'}</span></td>
        <td>${auftrag.auftragtype || '-'}</td>
        <td>${this.marke?.markenname || '-'}</td>
        <td>${formatCurrency(auftrag.gesamt_budget)}</td>
        <td>${formatDate(auftrag.created_at)}</td>
        <td>
          ${actionBuilder.create('auftrag', auftrag.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Auftragsname</th>
              <th>Status</th>
              <th>Typ</th>
              <th>Marke</th>
              <th>Budget</th>
              <th>Erstellt am</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere Ansprechpartner
  renderAnsprechpartner() {
    const hasAnsprechpartner = this.ansprechpartner && this.ansprechpartner.length > 0;
    
    const emptyState = !hasAnsprechpartner ? `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.</p>
      </div>
    ` : '';

    if (!hasAnsprechpartner) {
      return emptyState;
    }

    const rows = this.ansprechpartner.map(ap => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
            ${ap.vorname} ${ap.nachname}
          </a>
        </td>
        <td>${ap.position?.name || '-'}</td>
        <td>${ap.email ? `<a href="mailto:${ap.email}">${ap.email}</a>` : '-'}</td>
        <td>${PhoneDisplay.render(
          ap.telefonnummer_land?.iso_code,
          ap.telefonnummer_land?.vorwahl,
          ap.telefonnummer
        )}</td>
        <td>${PhoneDisplay.render(
          ap.telefonnummer_office_land?.iso_code,
          ap.telefonnummer_office_land?.vorwahl,
          ap.telefonnummer_office
        )}</td>
        <td>${ap.unternehmen?.firmenname || '-'}</td>
        <td>${ap.stadt || '-'}</td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Email</th>
              <th>Telefon (Privat)</th>
              <th>Telefon (Büro)</th>
              <th>Unternehmen</th>
              <th>Stadt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

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
        <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
      </tr>
    `).join('');
    const tableHtml = `
      <div class="data-table-container">
        <table class="data-table" id="marke-rechnungen-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    
    // Tabelle nach dem Rendern optimieren
    setTimeout(() => {
      TableHelper.autoOptimizeTable('#marke-rechnungen-table', {
        columnConfig: {
          0: { cssClass: 'id-col' }, // Rechnungs-Nr
          1: { cssClass: 'status-col' }, // Status
          2: { cssClass: 'number-col' }, // Netto
          3: { cssClass: 'number-col' }, // Brutto
          4: { cssClass: 'date-col' }, // Gestellt
          5: { cssClass: 'contact-col' } // Beleg
        }
      });
    }, 100);
    
    return tableHtml;
  }

  // Rendere Briefings
  renderBriefings() {
    if (!this.briefings || this.briefings.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Keine Briefings vorhanden</h3>
          <p>Es wurden noch keine Briefings für diese Marke erstellt.</p>
        </div>
      `;
    }

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const rows = this.briefings.map(briefing => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="briefing" data-id="${briefing.id}">
            ${briefing.product_service_offer || 'Unbekanntes Briefing'}
          </a>
        </td>
        <td><span class="status-badge status-${briefing.status?.toLowerCase() || 'unknown'}">${briefing.status || '-'}</span></td>
        <td>${formatDate(briefing.deadline)}</td>
        <td>${formatDate(briefing.created_at)}</td>
        <td>
          ${actionBuilder.create('briefing', briefing.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produkt/Angebot</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Erstellt am</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere Kooperationen
  renderKooperationen() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für die Kampagnen dieser Marke wurden keine Kooperationen gefunden.</p>
        </div>
      `;
    }

    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';

    const rows = this.kooperationen.map(k => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kooperation" data-id="${k.id}">
            ${k.name || 'Kooperation'}
          </a>
        </td>
        <td><span class="status-badge status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span></td>
        <td>${k.creator ? `${k.creator.vorname || ''} ${k.creator.nachname || ''}`.trim() || '-' : '-'}</td>
        <td>${k.kampagne?.kampagnenname || '-'}</td>
        <td>${k.videoanzahl || 0}</td>
        <td>${formatCurrency(k.einkaufspreis_gesamt)}</td>
        <td>
          ${actionBuilder.create('kooperation', k.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Creator</th>
              <th>Kampagne</th>
              <th>Videos</th>
              <th>Gesamtkosten</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
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

    // Marke bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-marke') {
        this.showEditForm();
      }
    });

    // Ansprechpartner hinzufügen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-ansprechpartner') {
        const markeId = e.target.dataset.markeId || this.markeId;
        if (window.actionsDropdown) {
          window.actionsDropdown.openAddAnsprechpartnerModal(markeId);
        }
      }
    });

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadMarkeData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadMarkeData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    // Entity Updates (für Ansprechpartner)
    document.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.markeId === this.markeId) {
        console.log('🔄 MARKEDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu');
        this.loadMarkeData().then(() => {
          this.render();
          this.bindEvents();
        });
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      // Prüfe ob ein Formular aktiv ist (Edit-Form oder Create-Drawer)
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      
      if (hasActiveForm) {
        console.log('⏸️ MARKEDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      // Nur wenn auf Marke-Detail-Seite
      if (!this.markeId || !location.pathname.includes('/marke/')) {
        return;
      }
      
      console.log('🔄 MARKEDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadMarkeData();
      this.render();
      this.bindEvents();
    });
  }

  // Tab wechseln mit Lazy Loading
  async switchTab(tabName) {
    // UI sofort updaten
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPane = document.getElementById(tabName);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedPane) {
      selectedPane.classList.add('active');
      
      // Lazy load Tab-Daten (nur wenn nötig)
      if (!['informationen', 'ansprechpartner'].includes(tabName)) {
        await this.loadTabData(tabName);
      }
    }
  }

  // Bearbeitungsformular anzeigen
  async showEditForm() {
    console.log('🎯 MARKENDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Marke bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.marke };
    
    // Edit-Mode Flags immer setzen
    formData._isEditMode = true;
    formData._entityId = this.markeId;
    
    // Unternehmen-ID für Edit-Modus sicherstellen
    if (this.marke.unternehmen_id) {
      console.log('🏢 MARKENDETAIL: Formatiere Unternehmen-Daten für FormSystem:', this.marke.unternehmen_id);
      formData.unternehmen_id = this.marke.unternehmen_id;
    } else {
      console.log('ℹ️ MARKENDETAIL: Keine Unternehmen-Daten vorhanden für Edit-Modus');
      formData.unternehmen_id = null;
    }
    
    // Branchen-IDs für Edit-Modus laden (Many-to-Many über Junction Table)
    try {
      const { data: branchenData, error } = await window.supabase
        .from('marke_branchen')
        .select('branche_id')
        .eq('marke_id', this.markeId);
      
      if (!error && branchenData && branchenData.length > 0) {
        const branchenIds = branchenData.map(b => b.branche_id);
        console.log('🏷️ MARKENDETAIL: Formatiere Branchen-Daten für FormSystem:', branchenIds);
        formData.branche_id = branchenIds;
      } else {
        console.log('ℹ️ MARKENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus');
        formData.branche_id = [];
      }
    } catch (branchenError) {
      console.warn('⚠️ MARKENDETAIL: Fehler beim Laden der Branchen-Daten:', branchenError);
      formData.branche_id = [];
    }
    
    console.log('📋 MARKENDETAIL: FormData für Rendering:', formData);
    
    const formHtml = window.formSystem.renderFormOnly('marke', formData);
    
    // Logo-Anzeige wenn vorhanden
    const currentLogoHtml = this.marke?.logo_url ? `
      <div class="form-logo-display">
        <label class="form-logo-label">Aktuelles Logo:</label>
        <img src="${this.marke.logo_url}" alt="${this.marke.markenname} Logo" class="form-logo-image" />
      </div>
    ` : '';
    
    window.content.innerHTML = `
      <div class="form-page">
        ${currentLogoHtml}
        ${formHtml}
        <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
          <label class="form-logo-label">Neues Logo Vorschau:</label>
          <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
        </div>
      </div>
    `;

    // Formular-Events mit vorbereiteten Daten binden
    window.formSystem.bindFormEvents('marke', formData);
    
    // Form-Datasets für DynamicDataLoader setzen
    const form = document.getElementById('marke-form');
    if (form) {
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = 'marke';
      form.dataset.entityId = this.markeId;
      
      // Bestehende Werte für Auto-Suggestion verfügbar machen
      if (formData.unternehmen_id) {
        form.dataset.existingUnternehmenId = formData.unternehmen_id;
      }
      if (formData.branche_id && Array.isArray(formData.branche_id) && formData.branche_id.length > 0) {
        form.dataset.existingBranchenIds = JSON.stringify(formData.branche_id);
      }
      
      console.log('📋 MARKENDETAIL: Form-Datasets gesetzt:', {
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        entityId: form.dataset.entityId,
        existingUnternehmenId: form.dataset.existingUnternehmenId,
        existingBrancheId: form.dataset.existingBrancheId
      });
      
      // Custom Submit Handler
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
      
      // Logo-Preview-Funktion für Uploader
      this.setupLogoPreview(form);
    }
  }

  // Setup Logo Preview für Upload
  setupLogoPreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
    if (!uploaderRoot) return;

    // Event für File-Input (falls vorhanden)
    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('logo-preview-container');
            const previewImage = document.getElementById('logo-preview-image');
            if (previewContainer && previewImage) {
              previewImage.src = event.target.result;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      console.log('🎯 MARKEDETAIL: Verarbeite Formular-Submit');
      
      const form = document.getElementById('marke-form');
      const formData = new FormData(form);
      const allFormData = {};

      // Standard FormData-Einträge sammeln
      for (const [key, value] of formData.entries()) {
        allFormData[key] = value;
      }

      // Tag-basierte Multi-Selects explizit sammeln (wie bei UnternehmenDetail)
      const hiddenSelect = form.querySelector('select[name="branche_id[]"]');
      if (hiddenSelect) {
        const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          allFormData['branche_id[]'] = selectedValues;
          console.log('🏷️ MARKEDETAIL: Alle ausgewählten Branchen gesammelt:', selectedValues);
        }
      }

      console.log('📤 MARKEDETAIL: Submit-Daten für Update:', allFormData);

      // Validierung
      const validation = window.validatorSystem.validateForm(allFormData, {
        markenname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Marke aktualisieren
      const result = await window.dataService.updateEntity('marke', this.markeId, allFormData);

      if (result.success) {
        // Logo-Upload (falls vorhanden)
        try {
          console.log('🔵 START: Logo-Upload für Marke', this.markeId);
          await this.uploadLogo(this.markeId, form);
          console.log('✅ Logo-Upload abgeschlossen');
        } catch (logoErr) {
          console.error('❌ Logo-Upload fehlgeschlagen:', logoErr);
          if (logoErr && logoErr.message && !logoErr.message.includes('Kein Logo')) {
            alert('Logo konnte nicht hochgeladen werden: ' + logoErr.message);
          }
        }

        this.showSuccessMessage('Marke erfolgreich aktualisiert!');
        
        // Daten neu laden und zur Detailseite zurückkehren
        setTimeout(async () => {
          await this.loadMarkeData();
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

  // Logo-Upload
  async uploadLogo(markeId, form) {
    try {
      console.log('📋 uploadLogo() aufgerufen für Marke:', markeId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen (kein Uploader/keine Files)');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Logo erlaubt
      const bucket = 'logos';
      
      // Security: Max 200 KB
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Logo zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Logo ist zu groß (max. 200 KB)`);
        return;
      }

      // Content-Type prüfen
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.name} (${file.type})`);
        alert(`Nur PNG und JPG Dateien sind erlaubt`);
        return;
      }

      // Dateiendung extrahieren
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `marke/${markeId}/logo.${ext}`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(`marke/${markeId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`marke/${markeId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
      }
      
      // Upload zu Storage
      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (upErr) {
        console.error(`❌ Logo-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL erstellen (permanent verfügbar)
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const logo_url = publicUrlData?.publicUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('marke')
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', markeId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      // Nicht werfen - Marke wurde bereits erstellt
    }
  }

  // Cleanup
  destroy() {
    console.log('🗑️ MARKENDETAIL: Destroy aufgerufen');
    tabDataCache.invalidate('marke', this.markeId);
    window.setContentSafely('');
  }
}

export const markeDetail = new MarkeDetail(); 