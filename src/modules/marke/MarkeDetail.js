// MarkeDetail.js (ES6-Modul)
// Marken-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Kampagnen und Aufträge
// Nutzt einheitliches zwei-Spalten-Layout

import { TableHelper } from '../../core/TableHelper.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class MarkeDetail extends PersonDetailBase {
  constructor() {
    super();
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
    this.strategien = [];
    this.activeMainTab = 'informationen';
  }

  // Initialisiere Marken-Detailseite
  async init(markeId) {
    console.log('🎯 MARKENDETAIL: Initialisiere Marken-Detailseite für ID:', markeId);
    
    try {
      this.markeId = markeId;
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.marke) {
        const canEdit = window.currentUser?.permissions?.marke?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Marke', url: '/marke', clickable: true },
          { label: this.marke.markenname || 'Details', url: `/marke/${this.markeId}`, clickable: false }
        ], {
          id: 'btn-edit-marke',
          canEdit: canEdit
        });
      }
      
      await this.loadActivities();
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
            unternehmen:unternehmen_id(id, firmenname),
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

  // Lade Aktivitäten für Timeline
  async loadActivities() {
    try {
      // Für Marken gibt es keine History-Tabelle, daher leere Aktivitäten
      this.activities = [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
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
          
          case 'strategien':
            const { data: strategien } = await window.supabase
              .from('strategie')
              .select('id, name, beschreibung, teilbereich, created_at, updated_at')
              .eq('marke_id', this.markeId)
              .order('created_at', { ascending: false });
            this.strategien = strategien || [];
            this.updateStrategienTab();
            return strategien;
        }
      } catch (error) {
        console.error(`❌ Fehler beim Laden von Tab ${tabName}:`, error);
        return null;
      }
    });
  }
  
  // Tab-Update-Methoden
  updateKampagnenTab() {
    const container = document.querySelector('#tab-kampagnen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderKampagnen();
    }
  }
  
  updateAuftraegeTab() {
    const container = document.querySelector('#tab-auftraege .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderAuftraege();
    }
  }
  
  updateBriefingsTab() {
    const container = document.querySelector('#tab-briefings .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderBriefings();
    }
  }
  
  updateKooperationenTab() {
    const container = document.querySelector('#tab-kooperationen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderKooperationen();
    }
  }
  
  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderRechnungen();
    }
  }
  
  updateStrategienTab() {
    const container = document.querySelector('#tab-strategien .data-table-container');
    if (container) {
      const parent = container.parentElement;
      parent.innerHTML = this.renderStrategien();
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

    // Person-Config für die Sidebar (Marke als "Person" behandeln, nur Logo im Header)
    const personConfig = {
      name: this.marke?.markenname || 'Unbekannt',
      email: '',
      subtitle: this.marke?.unternehmen?.firmenname || 'Marke',
      avatarUrl: this.marke?.logo_url,
      avatarOnly: true
    };

    // Quick Actions (keine im Header für Marken)
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { label: 'Unternehmen', value: this.marke?.unternehmen?.firmenname || '-' },
      { label: 'Branchen', value: this.getBranchenDisplay() },
      { label: 'Webseite', value: this.marke?.webseite ? 'Vorhanden' : '-' },
      { label: 'Erstellt', value: this.formatDate(this.marke?.created_at) },
      { label: 'Aktualisiert', value: this.formatDate(this.marke?.updated_at) }
    ]);

    // Tab-Navigation (oben über volle Breite)
    const tabNavigation = this.renderTabNavigation();

    // Main Content (nur Tab-Content)
    const mainContent = this.renderMainContent();

    // Layout mit Tabs oben rendern
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

  getBranchenDisplay() {
    if (!this.marke?.branchen || this.marke.branchen.length === 0) return '-';
    return this.marke.branchen.filter(b => b && b.name).map(b => b.name).join(', ');
  }

  getTabsConfig() {
    return [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' },
      { tab: 'ansprechpartner', label: 'Ansprechpartner', count: this.ansprechpartner.length, isActive: this.activeMainTab === 'ansprechpartner' },
      { tab: 'auftraege', label: 'Aufträge', count: this.auftraege.length, isActive: this.activeMainTab === 'auftraege' },
      { tab: 'briefings', label: 'Briefings', count: this.briefings.length, isActive: this.activeMainTab === 'briefings' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.kampagnen.length, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.kooperationen.length, isActive: this.activeMainTab === 'kooperationen' },
      { tab: 'strategien', label: 'Strategien', count: this.strategien.length, isActive: this.activeMainTab === 'strategien' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen.length, isActive: this.activeMainTab === 'rechnungen' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return tabs.map(t => renderTabButton(t)).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'informationen' ? 'active' : ''}" id="tab-informationen">
          ${this.renderInformationen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'ansprechpartner' ? 'active' : ''}" id="tab-ansprechpartner">
          ${this.renderAnsprechpartner()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'auftraege' ? 'active' : ''}" id="tab-auftraege">
          ${this.renderAuftraege()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'briefings' ? 'active' : ''}" id="tab-briefings">
          ${this.renderBriefings()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          ${this.renderKampagnen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
          ${this.renderKooperationen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'strategien' ? 'active' : ''}" id="tab-strategien">
          ${this.renderStrategien()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
          ${this.renderRechnungen()}
        </div>
      </div>
    `;
  }

  // Rendere Informationen
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Information</th>
                <th style="text-align: right;">Wert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Markenname</strong></td>
                <td style="text-align: right;">${this.sanitize(this.marke?.markenname) || '-'}</td>
              </tr>
              <tr>
                <td><strong>Unternehmen</strong></td>
                <td style="text-align: right;">
                  ${this.marke?.unternehmen?.id 
                    ? `<a href="/unternehmen/${this.marke.unternehmen.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${this.marke.unternehmen.id}')">${this.sanitize(this.marke.unternehmen.firmenname)}</a>`
                    : '-'}
                </td>
              </tr>
              <tr>
                <td><strong>Webseite</strong></td>
                <td style="text-align: right;">
                  ${this.marke?.webseite 
                    ? `<a href="${this.marke.webseite}" target="_blank" rel="noopener">${this.sanitize(this.marke.webseite)}</a>` 
                    : '-'}
                </td>
              </tr>
              <tr>
                <td><strong>Branchen</strong></td>
                <td style="text-align: right;">${this.renderBranchenTags()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Rendere Branchen als Tags
  renderBranchenTags() {
    if (!this.marke?.branchen || this.marke.branchen.length === 0) {
      return '-';
    }
    return this.marke.branchen
      .filter(branche => branche && branche.name)
      .map(branche => `<span class="tag tag--branche">${this.sanitize(branche.name)}</span>`)
      .join(' ');
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

    const rows = this.kampagnen.map(kampagne => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${this.sanitize(kampagne.kampagnenname) || 'Unbekannte Kampagne'}
          </a>
        </td>
        <td><span class="status-badge status-${kampagne.status?.toLowerCase() || 'unknown'}">${kampagne.status || 'Unbekannt'}</span></td>
        <td>${this.formatDate(kampagne.start)}</td>
        <td>${this.formatDate(kampagne.deadline)}</td>
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

    const rows = this.auftraege.map(auftrag => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
            ${this.sanitize(auftrag.auftragsname) || 'Unbekannter Auftrag'}
          </a>
        </td>
        <td><span class="status-badge status-${auftrag.status?.toLowerCase() || 'unknown'}">${auftrag.status || 'Unbekannt'}</span></td>
        <td>${auftrag.auftragtype || '-'}</td>
        <td>${this.formatCurrency(auftrag.gesamt_budget)}</td>
        <td>${this.formatDate(auftrag.created_at)}</td>
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
    if (!this.ansprechpartner || this.ansprechpartner.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>Keine Ansprechpartner vorhanden</h3>
          <p>Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.</p>
        </div>
      `;
    }

    const rows = this.ansprechpartner.map(ap => `
      <tr>
        <td class="col-name-with-icon">
          ${ap.profile_image_url 
            ? `<img src="${ap.profile_image_url}" class="table-logo" width="24" height="24" alt="" />` 
            : `<span class="table-avatar">${(ap.vorname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
            ${this.sanitize(ap.vorname)} ${this.sanitize(ap.nachname)}
          </a>
        </td>
        <td>${this.sanitize(ap.position?.name) || '-'}</td>
        <td>${ap.email ? `<a href="mailto:${ap.email}">${this.sanitize(ap.email)}</a>` : '-'}</td>
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
        <td>${this.sanitize(ap.stadt) || '-'}</td>
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

    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${this.sanitize(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${this.formatCurrency(r.nettobetrag)}</td>
        <td>${this.formatCurrency(r.bruttobetrag)}</td>
        <td>${this.formatDate(r.gestellt_am)}</td>
        <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
      </tr>
    `).join('');

    return `
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

    const rows = this.briefings.map(briefing => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="briefing" data-id="${briefing.id}">
            ${this.sanitize(briefing.product_service_offer) || 'Unbekanntes Briefing'}
          </a>
        </td>
        <td><span class="status-badge status-${briefing.status?.toLowerCase() || 'unknown'}">${briefing.status || '-'}</span></td>
        <td>${this.formatDate(briefing.deadline)}</td>
        <td>${this.formatDate(briefing.created_at)}</td>
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

    const isKunde = window.currentUser?.rolle === 'kunde';

    const rows = this.kooperationen.map(k => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kooperation" data-id="${k.id}">
            ${this.sanitize(k.name) || 'Kooperation'}
          </a>
        </td>
        <td><span class="status-badge status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span></td>
        <td>${k.creator ? `${this.sanitize(k.creator.vorname || '')} ${this.sanitize(k.creator.nachname || '')}`.trim() || '-' : '-'}</td>
        <td>${this.sanitize(k.kampagne?.kampagnenname) || '-'}</td>
        <td>${k.videoanzahl || 0}</td>
        ${!isKunde ? `<td>${this.formatCurrency(k.einkaufspreis_gesamt)}</td>` : ''}
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
              ${!isKunde ? '<th>Gesamtkosten</th>' : ''}
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

  // Rendere Strategien
  renderStrategien() {
    if (!this.strategien || this.strategien.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <h3>Keine Strategien vorhanden</h3>
          <p>Es wurden noch keine Strategien für diese Marke erstellt.</p>
        </div>
      `;
    }

    const rows = this.strategien.map(strategie => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="strategie" data-id="${strategie.id}">
            ${this.sanitize(strategie.name) || 'Unbenannte Strategie'}
          </a>
        </td>
        <td>${this.sanitize(strategie.teilbereich) || '-'}</td>
        <td>${strategie.beschreibung ? (strategie.beschreibung.length > 100 ? this.sanitize(strategie.beschreibung.substring(0, 100)) + '...' : this.sanitize(strategie.beschreibung)) : '-'}</td>
        <td>${this.formatDate(strategie.created_at)}</td>
        <td>${this.formatDate(strategie.updated_at)}</td>
        <td>
          ${actionBuilder.create('strategie', strategie.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Teilbereich</th>
              <th>Beschreibung</th>
              <th>Erstellt am</th>
              <th>Aktualisiert am</th>
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
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Main Tab-Navigation mit Lazy Loading
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tab-button');
      if (!btn) return;
      e.preventDefault();
      const tab = btn.dataset.tab;
      if (!tab) return;
      
      this.activeMainTab = tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`tab-${tab}`);
      if (pane) {
        pane.classList.add('active');
        
        // Lazy load Tab-Daten (nur wenn nötig)
        if (!['informationen', 'ansprechpartner'].includes(tab)) {
          await this.loadTabData(tab);
        }
      }
    });

    // Marke bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-marke')) {
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

    // Navigation zu verknüpften Entitäten
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link')) {
        e.preventDefault();
        const table = e.target.dataset.table;
        const id = e.target.dataset.id;
        window.navigateTo(`/${table}/${id}`);
      }
    });

    // Entity Updates (für Ansprechpartner)
    document.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.markeId === this.markeId) {
        console.log('🔄 MARKEDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu');
        this.loadCriticalData().then(() => {
          this.render();
          this.bindEvents();
        });
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      
      if (hasActiveForm) {
        console.log('⏸️ MARKEDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      if (!this.markeId || !location.pathname.includes('/marke/')) {
        return;
      }
      
      console.log('🔄 MARKEDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadCriticalData();
      this.render();
      this.bindEvents();
    });
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

      // Tag-basierte Multi-Selects explizit sammeln
      // WICHTIG: DataService erwartet für Marke "branche_ids[]" (mit s), nicht "branche_id[]"
      const hiddenSelect = form.querySelector('select[name="branche_id[]"]');
      if (hiddenSelect) {
        const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          allFormData['branche_ids[]'] = selectedValues;
          console.log('🏷️ MARKEDETAIL: Alle ausgewählten Branchen gesammelt:', selectedValues);
        }
      }
      
      // Mitarbeiter-Felder explizit sammeln (Management, Lead, Mitarbeiter)
      const mitarbeiterFields = ['management_ids', 'lead_mitarbeiter_ids', 'mitarbeiter_ids'];
      for (const fieldName of mitarbeiterFields) {
        if (!allFormData[fieldName]) {
          // Suche nach verstecktem Select
          const hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
          if (hiddenSelect) {
            const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
            if (selectedValues.length > 0) {
              allFormData[fieldName] = selectedValues;
              console.log(`✅ MARKEDETAIL: ${fieldName} gesammelt:`, selectedValues);
            }
          }
          
          // Falls nicht gefunden, suche nach allen Selects mit diesem Namen
          if (!allFormData[fieldName]) {
            const allSelects = form.querySelectorAll(`select[name="${fieldName}"]`);
            for (const sel of allSelects) {
              if (sel.multiple || sel.hasAttribute('multiple')) {
                const selectedValues = Array.from(sel.selectedOptions).map(option => option.value).filter(val => val !== '');
                if (selectedValues.length > 0) {
                  allFormData[fieldName] = selectedValues;
                  console.log(`✅ MARKEDETAIL: ${fieldName} aus Multi-Select gesammelt:`, selectedValues);
                  break;
                }
              }
            }
          }
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
        
        // Mitarbeiter-Zuordnungen speichern
        await this.saveMitarbeiterToMarke(this.markeId, allFormData);

        window.toastSystem.success('Marke erfolgreich aktualisiert!');
        
        // Zur Markenübersicht navigieren
        setTimeout(() => {
          window.navigateTo('/marke');
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }
  
  // Mitarbeiter-Zuordnungen mit Rollen speichern
  async saveMitarbeiterToMarke(markeId, data) {
    try {
      if (!markeId || !window.supabase) return;
      
      console.log('🔄 MARKEDETAIL: Speichere Mitarbeiter-Rollen für Marke:', markeId);
      
      // Rollen-Mapping
      const roleFields = {
        'management_ids': 'management',
        'lead_mitarbeiter_ids': 'lead_mitarbeiter',
        'mitarbeiter_ids': 'mitarbeiter'
      };
      
      // Alle INSERT-Daten sammeln
      const allInsertData = [];
      
      for (const [fieldName, roleValue] of Object.entries(roleFields)) {
        // Prüfe ob das Feld in den Daten vorhanden ist
        const fieldData = data[fieldName] || data[`${fieldName}[]`];
        
        // Extrahiere IDs als Array und entferne Duplikate
        let mitarbeiterIds = [];
        if (Array.isArray(fieldData)) {
          mitarbeiterIds = [...new Set(fieldData.filter(Boolean))];
        } else if (typeof fieldData === 'string' && fieldData) {
          mitarbeiterIds = [fieldData];
        }
        
        console.log(`📋 ${fieldName} (${roleValue}): ${mitarbeiterIds.length} Mitarbeiter`, mitarbeiterIds);
        
        // Sammle INSERT-Daten
        for (const mitarbeiterId of mitarbeiterIds) {
          allInsertData.push({
            marke_id: markeId,
            mitarbeiter_id: mitarbeiterId,
            role: roleValue
          });
        }
      }
      
      // ERST alle bestehenden Einträge für diese Marke löschen
      console.log('🗑️ Lösche alle bestehenden Mitarbeiter-Zuordnungen für Marke:', markeId);
      const { error: deleteError } = await window.supabase
        .from('marke_mitarbeiter')
        .delete()
        .eq('marke_id', markeId);
      
      if (deleteError) {
        console.error('❌ Fehler beim Löschen:', deleteError);
      }
      
      // DANN alle neuen Einträge in einem Batch einfügen
      if (allInsertData.length > 0) {
        console.log(`📤 Füge ${allInsertData.length} Mitarbeiter-Zuordnungen ein:`, allInsertData);
        
        const { error: insertError } = await window.supabase
          .from('marke_mitarbeiter')
          .insert(allInsertData);
        
        if (insertError) {
          console.error('❌ Fehler beim Batch-Insert:', insertError);
          
          // Fallback: Einzeln einfügen mit upsert
          console.log('🔄 Versuche Einzelinserts mit upsert...');
          for (const row of allInsertData) {
            const { error: upsertError } = await window.supabase
              .from('marke_mitarbeiter')
              .upsert(row, { onConflict: 'marke_id,mitarbeiter_id,role' });
            
            if (upsertError) {
              console.error(`❌ Upsert-Fehler für ${row.mitarbeiter_id}/${row.role}:`, upsertError);
            }
          }
        } else {
          console.log(`✅ ${allInsertData.length} Mitarbeiter-Zuordnungen gespeichert`);
        }
        
        // AUTO-SYNC: mitarbeiter_unternehmen für das Unternehmen der Marke erstellen
        const unternehmenId = this.marke?.unternehmen_id || data.unternehmen_id;
        if (unternehmenId) {
          console.log('🔄 MARKEDETAIL: Sync mitarbeiter_unternehmen für Unternehmen:', unternehmenId);
          const uniqueMitarbeiterIds = [...new Set(allInsertData.map(r => r.mitarbeiter_id))];
          
          for (const mitarbeiterId of uniqueMitarbeiterIds) {
            const { error: syncError } = await window.supabase
              .from('mitarbeiter_unternehmen')
              .upsert({
                mitarbeiter_id: mitarbeiterId,
                unternehmen_id: unternehmenId,
                role: 'mitarbeiter'
              }, { 
                onConflict: 'mitarbeiter_id,unternehmen_id,role',
                ignoreDuplicates: true 
              });
            
            if (syncError && syncError.code !== '23505') {
              console.error(`❌ Sync-Fehler für ${mitarbeiterId}:`, syncError);
            }
          }
          console.log(`✅ mitarbeiter_unternehmen synchronisiert für ${uniqueMitarbeiterIds.length} Mitarbeiter`);
        }
      } else {
        console.log('ℹ️ Keine Mitarbeiter zum Speichern');
      }
      
      console.log('✅ MARKEDETAIL: Mitarbeiter-Rollen gespeichert');
    } catch (error) {
      console.error('❌ MARKEDETAIL: Fehler beim Speichern der Mitarbeiter-Rollen:', error);
      // Nicht werfen - Marke wurde bereits aktualisiert
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
