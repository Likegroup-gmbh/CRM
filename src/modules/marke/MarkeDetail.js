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
import { MarkeService } from './services/MarkeService.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';

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
    this.kickoff = null;
    this.kickoffMarkenwerte = [];
    this.kickoffsByType = { paid: null, organic: null };
    this.kickoffMarkenwerteByType = { paid: [], organic: [] };
    this.activeKickoffType = 'organic';
    this.activeMainTab = 'informationen';
    
    // AbortController für Tab-Daten-Laden (verhindert Race Conditions)
    this._tabAbortControllers = new Map();
    this._currentLoadingTab = null;
    
    // Bound Event Handlers für sauberes Cleanup
    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this._handleEntityUpdated = this._handleEntityUpdated.bind(this);
    this._handleSoftRefresh = this._handleSoftRefresh.bind(this);
    this._eventsBound = false;
  }
  
  // Zentraler Click-Handler für document
  async _handleDocumentClick(e) {
    // KickOff-Type-Switcher VOR generischem Tab-Handler prüfen
    const kickoffTypeBtn = e.target.closest('.kickoff-type-btn');
    if (kickoffTypeBtn) {
      e.preventDefault();
      const nextType = kickoffTypeBtn.dataset.kickoffType;
      if (!['paid', 'organic'].includes(nextType)) return;
      this.activeKickoffType = nextType;
      this.kickoff = this.kickoffsByType[nextType] || null;
      this.kickoffMarkenwerte = this.kickoffMarkenwerteByType[nextType] || [];
      this.updateKickOffTab();
      return;
    }

    // Tab-Button Navigation
    const btn = e.target.closest('.tab-button');
    if (btn) {
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
        if (!['ansprechpartner'].includes(tab)) {
          await this.loadTabData(tab);
        }
      }
      return;
    }
    
    // Marke bearbeiten Button
    if (e.target.closest('#btn-edit-marke')) {
      this.showEditForm();
      return;
    }
    
    // Ansprechpartner hinzufügen Button
    if (e.target.id === 'btn-add-ansprechpartner') {
      const markeId = e.target.dataset.markeId || this.markeId;
      if (window.actionsDropdown) {
        window.actionsDropdown.openAddAnsprechpartnerModal(markeId);
      }
      return;
    }
    
    // Navigation zu verknüpften Entitäten
    if (e.target.classList.contains('table-link')) {
      e.preventDefault();
      const table = e.target.dataset.table;
      const id = e.target.dataset.id;
      window.navigateTo(`/${table}/${id}`);
      return;
    }
  }
  
  // Entity Updated Handler
  _handleEntityUpdated(e) {
    if (e.detail?.entity === 'ansprechpartner' && e.detail?.markeId === this.markeId) {
      console.log('🔄 MARKEDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu');
      this.loadCriticalData().then(() => {
        this.render();
        this.bindEvents();
      });
    }
  }
  
  // Soft-Refresh Handler
  async _handleSoftRefresh(e) {
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
              ),
              kunde_ansprechpartner(kunde_id)
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
        this.ansprechpartner = (ansprechpartnerResult.data || []).map(item => {
          const ap = item.ansprechpartner;
          if (!ap) return null;
          ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
          delete ap.kunde_ansprechpartner;
          return ap;
        }).filter(Boolean);
      } else {
        this.ansprechpartner = [];
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
  
  // Lade Tab-Daten lazy mit Race-Condition-Schutz
  async loadTabData(tabName) {
    // Generiere eindeutige Request-ID für diesen Tab-Load
    const requestId = `${tabName}-${Date.now()}`;
    this._tabAbortControllers.set(tabName, requestId);
    this._currentLoadingTab = tabName;
    
    console.log(`🔄 Lade Tab: ${tabName} (Request: ${requestId})`);
    
    // Hilfsfunktion: Prüft ob dieser Request noch aktuell ist
    const isStillActive = () => this._tabAbortControllers.get(tabName) === requestId;
    
    return await tabDataCache.load('marke', this.markeId, tabName, async () => {
      try {
        switch(tabName) {
          case 'kampagnen':
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('*')
              .eq('marke_id', this.markeId);
            // Race-Condition-Check: Nur aktualisieren wenn Request noch aktuell
            if (!isStillActive()) {
              console.log(`⏭️ Tab ${tabName}: Request veraltet, überspringe Update`);
              return kampagnen;
            }
            this.kampagnen = kampagnen || [];
            this.updateKampagnenTab();
            return kampagnen;
          
          case 'auftraege':
            const { data: auftraege } = await window.supabase
              .from('auftrag')
              .select('*')
              .eq('marke_id', this.markeId);
            if (!isStillActive()) return auftraege;
            this.auftraege = auftraege || [];
            this.updateAuftraegeTab();
            return auftraege;
          
          case 'briefings':
            const { data: briefings } = await window.supabase
              .from('briefings')
              .select('id, product_service_offer, status, deadline, marke_id, kampagne_id, created_at')
              .eq('marke_id', this.markeId)
              .order('created_at', { ascending: false });
            if (!isStillActive()) return briefings;
            this.briefings = briefings || [];
            this.updateBriefingsTab();
            return briefings;
          
          case 'kooperationen':
            // Erst Kampagnen laden (falls noch nicht geladen)
            if (!this.kampagnen || this.kampagnen.length === 0) {
              await this.loadTabData('kampagnen');
            }
            if (!isStillActive()) return this.kooperationen;
            const kampagneIds = (this.kampagnen || []).map(k => k.id).filter(Boolean);
            if (kampagneIds.length > 0) {
              const { data: kooperationen } = await window.supabase
                .from('kooperationen')
                .select(`
                  id, name, status, videoanzahl, einkaufspreis_gesamt, kampagne_id, creator_id, created_at,
                  creator:creator_id (vorname, nachname),
                  kampagne:kampagne_id (kampagnenname, eigener_name)
                `)
                .in('kampagne_id', kampagneIds)
                .order('created_at', { ascending: false });
              if (!isStillActive()) return kooperationen;
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
            if (!isStillActive()) return this.rechnungen;
            const auftragIds = (this.auftraege || []).map(a => a.id).filter(Boolean);
            if (auftragIds.length > 0) {
              const { data: rechnungen } = await window.supabase
                .from('rechnung')
                .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url, auftrag_id')
                .in('auftrag_id', auftragIds);
              if (!isStillActive()) return rechnungen;
              this.rechnungen = rechnungen || [];
            } else {
              this.rechnungen = [];
            }
            this.updateRechnungenTab();
            return this.rechnungen;
          
          case 'strategien':
            const { data: strategien } = await window.supabase
              .from('strategie')
              .select('id, name, beschreibung, teilbereich, created_at, updated_at, created_by_user:created_by(id, name)')
              .eq('marke_id', this.markeId)
              .order('created_at', { ascending: false });
            if (!isStillActive()) return strategien;
            this.strategien = strategien || [];
            this.updateStrategienTab();
            return strategien;
          
          case 'kickoff':
            const { data: kickoffList } = await window.supabase
              .from('marke_kickoff')
              .select('*')
              .eq('marke_id', this.markeId);
            if (!isStillActive()) return kickoffList;

            this.kickoffsByType = { paid: null, organic: null };
            (kickoffList || []).forEach(item => {
              const typeKey = item.kickoff_type || 'organic';
              if (typeKey === 'paid' || typeKey === 'organic') {
                this.kickoffsByType[typeKey] = item;
              }
            });

            if (!this.kickoffsByType[this.activeKickoffType]) {
              this.activeKickoffType = this.kickoffsByType.organic
                ? 'organic'
                : (this.kickoffsByType.paid ? 'paid' : 'organic');
            }

            this.kickoffMarkenwerteByType = { paid: [], organic: [] };
            const kickoffEntries = Object.entries(this.kickoffsByType).filter(([, value]) => value);
            if (kickoffEntries.length > 0) {
              const markenwerteResults = await Promise.all(
                kickoffEntries.map(async ([typeKey, kickoffItem]) => {
                  const { data: markenwerte } = await window.supabase
                    .from('marke_kickoff_markenwerte')
                    .select('markenwert:markenwert_id(id, name)')
                    .eq('kickoff_id', kickoffItem.id);
                  return { typeKey, markenwerte: markenwerte?.map(m => m.markenwert) || [] };
                })
              );

              if (!isStillActive()) return kickoffList;
              markenwerteResults.forEach(({ typeKey, markenwerte }) => {
                this.kickoffMarkenwerteByType[typeKey] = markenwerte;
              });
            }

            this.kickoff = this.kickoffsByType[this.activeKickoffType] || null;
            this.kickoffMarkenwerte = this.kickoffMarkenwerteByType[this.activeKickoffType] || [];

            this.updateKickOffTab();
            return kickoffList;
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
  
  updateKickOffTab() {
    const pane = document.querySelector('#tab-kickoff');
    if (pane) {
      pane.innerHTML = this.renderKickOff();
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
      avatarOnly: false
    };

    // Quick Actions (keine im Header für Marken)
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { icon: 'building', label: 'Unternehmen', value: this.marke?.unternehmen?.firmenname || '-' },
      { icon: 'tag', label: 'Branchen', value: this.getBranchenDisplay() },
      { icon: 'link', label: 'Webseite', rawHtml: this.marke?.webseite ? `<a href="${this.marke.webseite}" target="_blank" rel="noopener">${this.sanitize(this.marke.webseite)}</a>` : '-' },
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.marke?.created_at) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.marke?.updated_at) }
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
      {
        tab: 'kickoff',
        label: 'Kick-Off',
        count: Object.values(this.kickoffsByType).filter(Boolean).length,
        isActive: this.activeMainTab === 'kickoff'
      },
      { tab: 'ansprechpartner', label: 'Ansprechpartner', count: this.ansprechpartner.length, isActive: this.activeMainTab === 'ansprechpartner' },
      { tab: 'auftraege', label: 'Aufträge', count: this.auftraege.length, isActive: this.activeMainTab === 'auftraege' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.kampagnen.length, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'briefings', label: 'Briefings', count: this.briefings.length, isActive: this.activeMainTab === 'briefings' },
      { tab: 'strategien', label: 'Strategien', count: this.strategien.length, isActive: this.activeMainTab === 'strategien' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.kooperationen.length, isActive: this.activeMainTab === 'kooperationen' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen.length, isActive: this.activeMainTab === 'rechnungen' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('')}</div></div>`;
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'kickoff' ? 'active' : ''}" id="tab-kickoff">
          ${this.renderKickOff()}
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
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für diese Marke erstellt.</p>
        </div>
      `;
    }

    const rows = this.kampagnen.map(kampagne => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${this.sanitize(KampagneUtils.getDisplayName(kampagne))}
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
          ${ap.ist_verknuepft ? `<span class="tag tag--verknuepft" title="verknüpft"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tag--verknuepft-icon"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg></span>` : ''}
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
        <td>${this.sanitize(KampagneUtils.getDisplayName(k.kampagne))}</td>
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
        <td class="col-erstellt-von">${this.sanitize(strategie.created_by_user?.name) || '-'}</td>
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
              <th class="col-erstellt-von">Erstellt von</th>
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

  // Rendere Kick-Off
  renderKickOff() {
    const availableCount = Object.values(this.kickoffsByType).filter(Boolean).length;
    const activeKickoff = this.kickoffsByType[this.activeKickoffType];
    const activeMarkenwerte = this.kickoffMarkenwerteByType[this.activeKickoffType] || [];
    const typeLabel = this.activeKickoffType === 'paid' ? 'Paid' : 'Organic';
    const isKunde = window.currentUser?.rolle === 'kunde' || window.currentUser?.rolle === 'kunde_editor';

    if (availableCount === 0) {
      return `
        <div class="empty-state">
          <h3>Kein Kick-Off vorhanden</h3>
          <p>Es wurde noch kein Brand Kick-Off für diese Marke erstellt.</p>
          ${!isKunde ? `<a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">Kick-Off erstellen</a>` : ''}
        </div>
      `;
    }

    const formatValue = (value) => {
      if (!value) return '<span class="text-muted">-</span>';
      return this.sanitize(value).replace(/\n/g, '<br>');
    };

    const markenwerteHtml = activeMarkenwerte.length > 0
      ? activeMarkenwerte.map(mw => `<span class="tag tag--markenwert">${this.sanitize(mw.name)}</span>`).join(' ')
      : '<span class="text-muted">-</span>';

    const typeSwitcher = `
      <div class="tab-navigation kickoff-type-switcher">
        <button type="button" class="tab-button ${this.activeKickoffType === 'organic' ? 'active' : ''} kickoff-type-btn" data-kickoff-type="organic">Organic</button>
        <button type="button" class="tab-button ${this.activeKickoffType === 'paid' ? 'active' : ''} kickoff-type-btn" data-kickoff-type="paid">Paid</button>
      </div>
    `;

    if (!activeKickoff) {
      return `
        <div class="detail-section">
          ${typeSwitcher}
          <div class="empty-state">
            <h3>Kein ${typeLabel} Kick-Off vorhanden</h3>
            <p>Für den Typ ${typeLabel} wurde noch kein Kick-Off erstellt.</p>
            ${!isKunde ? `<a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">${typeLabel} Kick-Off erstellen</a>` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-section">
        ${typeSwitcher}
        <div class="data-table-container">
          <table class="data-table kickoff-table">
            <thead>
              <tr>
                <th style="width: 30%;">Kategorie</th>
                <th>Inhalt</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Brand-Essenz</strong></td>
                <td>${formatValue(activeKickoff.brand_essenz)}</td>
              </tr>
              <tr>
                <td><strong>2. Mission / Zweck</strong></td>
                <td>${formatValue(activeKickoff.mission)}</td>
              </tr>
              <tr>
                <td><strong>3. Markenwerte</strong></td>
                <td>${markenwerteHtml}</td>
              </tr>
              <tr>
                <td><strong>4. Zielgruppe</strong></td>
                <td>${formatValue(activeKickoff.zielgruppe)}</td>
              </tr>
              <tr>
                <td><strong>5. Zielgruppen-Mindset</strong></td>
                <td>${formatValue(activeKickoff.zielgruppen_mindset)}</td>
              </tr>
              <tr>
                <td><strong>6. Marken-USP</strong></td>
                <td>${formatValue(activeKickoff.marken_usp)}</td>
              </tr>
              <tr>
                <td><strong>7. Tonalität & Sprachstil</strong></td>
                <td>${formatValue(activeKickoff.tonalitaet_sprachstil)}</td>
              </tr>
              <tr>
                <td><strong>8. Content-Charakter</strong></td>
                <td>${formatValue(activeKickoff.content_charakter)}</td>
              </tr>
              <tr>
                <td><strong>9. Do's & Don'ts</strong></td>
                <td>${formatValue(activeKickoff.dos_donts)}</td>
              </tr>
              <tr>
                <td><strong>10. Rechtliche Leitplanken</strong></td>
                <td>${formatValue(activeKickoff.rechtliche_leitplanken)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="kickoff-meta">
          <small class="text-muted">
            Typ: ${typeLabel} | Zuletzt aktualisiert: ${this.formatDate(activeKickoff.updated_at)}
          </small>
          ${!isKunde ? `<a href="/kickoff" class="btn btn-sm btn-secondary" onclick="event.preventDefault(); window.navigateTo('/kickoff')" style="margin-left: 1rem;">Bearbeiten</a>` : ''}
        </div>
      </div>
    `;
  }

  // Binde Events
  bindEvents() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();
    
    // Verhindere doppelte Event-Listener
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Zentrale Event-Handler registrieren (mit Referenz für Cleanup)
    document.addEventListener('click', this._handleDocumentClick);
    document.addEventListener('entityUpdated', this._handleEntityUpdated);
    window.addEventListener('softRefresh', this._handleSoftRefresh);
    
    console.log('✅ MARKEDETAIL: Event-Listener registriert');
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
    
    // Logo-Anzeige wenn vorhanden (URL sanitizen gegen XSS)
    const safeLogoUrl = this.marke?.logo_url;
    const isValidLogoUrl = safeLogoUrl && /^https?:\/\//i.test(safeLogoUrl);
    const currentLogoHtml = isValidLogoUrl ? `
      <div class="form-logo-display">
        <label class="form-logo-label">Aktuelles Logo:</label>
        <img src="${safeLogoUrl}" alt="${(this.marke.markenname || '').replace(/"/g, '&quot;')} Logo" class="form-logo-image" />
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
    const form = document.getElementById('marke-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.innerHTML;

    try {
      console.log('🎯 MARKEDETAIL: Verarbeite Formular-Submit');

      if (submitBtn) {
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
        submitBtn.disabled = true;
      }

      const formData = new FormData(form);
      const tagBasedValues = FormSubmitHelper.collectTagBasedSelects(form);
      const allFormData = FormSubmitHelper.formDataToObject(formData, tagBasedValues);
      if (typeof allFormData.markenname === 'string') allFormData.markenname = allFormData.markenname.trim();
      console.log('📤 MARKEDETAIL: Submit-Daten für Update:', allFormData);

      // Validierung
      const validation = window.validatorSystem.validateForm(allFormData, {
        markenname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        if (submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
        return;
      }

      // Marke aktualisieren
      const result = await window.dataService.updateEntity('marke', this.markeId, allFormData);

      if (result.success) {
        // Logo-Upload (falls vorhanden)
        try {
          await MarkeService.uploadLogo(this.markeId, form);
        } catch (logoError) {
          console.warn('⚠️ Logo-Upload fehlgeschlagen, aber Marke wurde aktualisiert:', logoError);
        }
        
        // Mitarbeiter-Zuordnungen speichern
        const unternehmenId = this.marke?.unternehmen_id || allFormData.unternehmen_id;
        try {
          await MarkeService.saveMitarbeiterToMarke(this.markeId, allFormData, unternehmenId, { deleteExisting: true });
        } catch (mitarbeiterErr) {
          console.error('❌ Mitarbeiter-Zuordnungen:', mitarbeiterErr);
          this.showErrorMessage(mitarbeiterErr.message || 'Mitarbeiter-Zuordnungen konnten nicht gespeichert werden.');
          if (submitBtn) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
          return;
        }

        window.toastSystem.success('Marke erfolgreich aktualisiert!');
        
        await this.init(this.markeId);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
      if (submitBtn) {
        submitBtn.innerHTML = originalText || 'Speichern';
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
    console.log('🗑️ MARKEDETAIL: Destroy aufgerufen');
    
    // Event-Listener entfernen
    if (this._eventsBound) {
      document.removeEventListener('click', this._handleDocumentClick);
      document.removeEventListener('entityUpdated', this._handleEntityUpdated);
      window.removeEventListener('softRefresh', this._handleSoftRefresh);
      this._eventsBound = false;
      console.log('✅ MARKEDETAIL: Event-Listener entfernt');
    }
    
    tabDataCache.invalidate('marke', this.markeId);
    window.setContentSafely('');
    console.log('✅ MARKEDETAIL: Destroy abgeschlossen');
  }
}

export const markeDetail = new MarkeDetail();
