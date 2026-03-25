// UnternehmenDetail.js (ES6-Modul)
// Unternehmen-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Marken und Aufträge
// Nutzt einheitliches zwei-Spalten-Layout

import { renderCreatorTable } from '../creator/CreatorTable.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { UnternehmenService } from './services/UnternehmenService.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class UnternehmenDetail extends PersonDetailBase {
  constructor() {
    super();
    this.unternehmenId = null;
    this.unternehmen = null;
    this.notizen = [];
    this.ratings = [];
    this.marken = [];
    this.auftraege = [];
    this.auftragsdetails = [];
    this.ansprechpartner = [];
    this.kampagnen = [];
    this.briefings = [];
    this.kooperationen = [];
    this.creators = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.strategien = [];
    this.creatorAuswahlen = [];
    this._creatorMap = {};
    this.kickoff = null;
    this.kickoffMarkenwerte = [];
    this.kickoffsByType = { paid: null, organic: null };
    this.kickoffMarkenwerteByType = { paid: [], organic: [] };
    this.activeKickoffType = 'organic';
    this.activeMainTab = null;
    this.eventsBound = false;
    this._isLoading = false;
    this._lastRenderTime = 0;
    this._renderDebounceMs = 500; // Mindestens 500ms zwischen Renders
  }

  // Initialisiere Unternehmen-Detailseite
  async init(unternehmenId) {
    console.log('🎯 UNTERNEHMENDETAIL: Initialisiere Unternehmen-Detailseite für ID:', unternehmenId);
    
    // Cleanup alle alten Event-Listener (wichtig bei wiederholter Navigation)
    this._removeAllEventListeners();
    
    try {
      this._isLoading = true;
      this.unternehmenId = unternehmenId;
      await this.loadUnternehmenData();
      
      if (window.breadcrumbSystem && this.unternehmen) {
        const canEdit = window.currentUser?.permissions?.unternehmen?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(this.unternehmen.firmenname || 'Details', {
          id: 'btn-edit-unternehmen',
          canEdit: canEdit
        });
      }
      
      await this.loadActivities();
      this.render(true); // force=true für initiales Render
      
      // Events nur einmal binden
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      this._isLoading = false;
      console.log('✅ UNTERNEHMENDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      this._isLoading = false;
      console.error('❌ UNTERNEHMENDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'UnternehmenDetail.init');
    }
  }

  // Lade Aktivitäten für Timeline
  async loadActivities() {
    try {
      // Für Unternehmen gibt es keine History-Tabelle, daher leere Aktivitäten
      this.activities = [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
    }
  }

  // Lade Unternehmen-Daten - optimiert mit parallelen Abfragen
  async loadUnternehmenData() {
    console.log('🔄 UNTERNEHMENDETAIL: Lade Unternehmen-Daten (parallelisiert)...');
    const startTime = Date.now();
    
    try {
      // ========== BATCH 1: Alle unabhängigen Abfragen parallel ==========
      const [
        unternehmenResult,
        branchenResult,
        markenResult,
        auftraegeResult,
        briefingsResult,
        kampagnenResult,
        rechnungenResult,
        vertraegeResult,
        strategienResult,
        creatorAuswahlenResult,
        kickoffResult,
        ansprechpartnerResult,
        notizenResult,
        ratingsResult
      ] = await Promise.all([
        // Unternehmen-Basisdaten
        window.supabase.from('unternehmen').select('*').eq('id', this.unternehmenId).single(),
        // Branchen
        window.supabase.from('unternehmen_branchen').select('branche_id, branchen:branche_id (id, name)').eq('unternehmen_id', this.unternehmenId),
        // Marken
        window.supabase.from('marke').select('*').eq('unternehmen_id', this.unternehmenId),
        // Aufträge
        window.supabase.from('auftrag').select('*').eq('unternehmen_id', this.unternehmenId),
        // Briefings
        window.supabase.from('briefings').select('id, product_service_offer, status, deadline, unternehmen_id, marke_id, kampagne_id, created_at').eq('unternehmen_id', this.unternehmenId).order('created_at', { ascending: false }),
        // Kampagnen
        window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, status, start, deadline, unternehmen_id').eq('unternehmen_id', this.unternehmenId).order('created_at', { ascending: false }),
        // Rechnungen
        window.supabase.from('rechnung').select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url').eq('unternehmen_id', this.unternehmenId).order('gestellt_am', { ascending: false }),
        // Verträge
        window.supabase.from('vertraege').select('id, name, typ, is_draft, datei_url, datei_path, created_at, kampagne:kampagne_id(id, kampagnenname, eigener_name), creator:creator_id(id, vorname, nachname)').eq('kunde_unternehmen_id', this.unternehmenId).order('created_at', { ascending: false }),
        // Strategien
        window.supabase.from('strategie').select('id, name, teilbereich, created_at, created_by_user:created_by(id, name)').eq('unternehmen_id', this.unternehmenId).order('created_at', { ascending: false }),
        // Creator-Auswahlen
        window.supabase.from('creator_auswahl').select('id, name, created_at').eq('unternehmen_id', this.unternehmenId).order('created_at', { ascending: false }),
        // Kick-Offs (für Unternehmen ohne Marke)
        window.supabase.from('marke_kickoff').select('*').eq('unternehmen_id', this.unternehmenId).is('marke_id', null),
        // Ansprechpartner
        window.supabase.from('ansprechpartner_unternehmen').select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname, logo_url),
            telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl),
            kunde_ansprechpartner(kunde_id)
          )
        `).eq('unternehmen_id', this.unternehmenId),
        // Notizen (falls System verfügbar)
        window.notizenSystem ? window.notizenSystem.loadNotizen('unternehmen', this.unternehmenId) : Promise.resolve([]),
        // Bewertungen (falls System verfügbar)
        window.bewertungsSystem ? window.bewertungsSystem.loadBewertungen('unternehmen', this.unternehmenId) : Promise.resolve([])
      ]);

      // Batch 1 Ergebnisse verarbeiten
      if (unternehmenResult.error) throw unternehmenResult.error;
      this.unternehmen = unternehmenResult.data;

      // Branchen zuweisen
      if (!branchenResult.error && branchenResult.data) {
        this.unternehmen.branche_id = branchenResult.data.map(b => b.branche_id);
        this.unternehmen.branchen_names = branchenResult.data.map(b => b.branchen?.name).filter(Boolean);
      }

      this.marken = markenResult.data || [];
      this.auftraege = auftraegeResult.data || [];
      this.briefings = briefingsResult.data || [];
      this.kampagnen = kampagnenResult.data || [];
      this.rechnungen = rechnungenResult.data || [];
      this.vertraege = vertraegeResult.data || [];
      this.strategien = strategienResult.data || [];
      this.creatorAuswahlen = creatorAuswahlenResult.data || [];
      this.kickoffsByType = { paid: null, organic: null };
      (kickoffResult.data || []).forEach(item => {
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
      this.kickoff = this.kickoffsByType[this.activeKickoffType] || null;
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];

      // Lade Kick-Off Markenwerte je Typ
      this.kickoffMarkenwerteByType = { paid: [], organic: [] };
      const kickoffEntries = Object.entries(this.kickoffsByType).filter(([, value]) => value);
      if (kickoffEntries.length > 0) {
        try {
          const markenwerteResults = await Promise.all(
            kickoffEntries.map(async ([typeKey, kickoffItem]) => {
              const { data: markenwerte } = await window.supabase
                .from('marke_kickoff_markenwerte')
                .select('markenwert:markenwert_id(id, name)')
                .eq('kickoff_id', kickoffItem.id);
              return { typeKey, markenwerte: markenwerte?.map(m => m.markenwert) || [] };
            })
          );

          markenwerteResults.forEach(({ typeKey, markenwerte }) => {
            this.kickoffMarkenwerteByType[typeKey] = markenwerte;
          });
          this.kickoffMarkenwerte = this.kickoffMarkenwerteByType[this.activeKickoffType] || [];
        } catch (e) {
          console.warn('⚠️ Kick-Off Markenwerte konnten nicht geladen werden:', e);
          this.kickoffMarkenwerteByType = { paid: [], organic: [] };
          this.kickoffMarkenwerte = [];
        }
      } else {
        this.kickoff = null;
        this.kickoffMarkenwerteByType = { paid: [], organic: [] };
        this.kickoffMarkenwerte = [];
      }

      // Ansprechpartner verarbeiten
      if (!ansprechpartnerResult.error) {
        this.ansprechpartner = (ansprechpartnerResult.data || [])
          .filter(item => item.ansprechpartner)
          .map(item => {
            const ap = item.ansprechpartner;
            ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
            delete ap.kunde_ansprechpartner;
            return ap;
          });
      } else {
        this.ansprechpartner = [];
      }

      console.log(`✅ UNTERNEHMENDETAIL: Batch 1 geladen in ${Date.now() - startTime}ms`);

      // ========== BATCH 2: Abhängige Abfragen parallel ==========
      const auftragIds = this.auftraege.map(a => a.id).filter(Boolean);
      const kampagneIds = this.kampagnen.map(k => k.id).filter(Boolean);

      const batch2Promises = [];

      // Auftragsdetails (falls Aufträge vorhanden)
      if (auftragIds.length > 0) {
        batch2Promises.push(
          window.supabase.from('auftrag_details')
            .select('*, auftrag:auftrag_id (id, auftragsname, status)')
            .in('auftrag_id', auftragIds)
            .order('created_at', { ascending: false })
        );
      } else {
        batch2Promises.push(Promise.resolve({ data: [] }));
      }

      // Kooperationen (falls Kampagnen vorhanden)
      if (kampagneIds.length > 0) {
        batch2Promises.push(
          window.supabase.from('kooperationen')
            .select('id, name, status, videoanzahl, einkaufspreis_gesamt, kampagne_id, creator_id, created_at, kampagne:kampagne_id(kampagnenname, eigener_name)')
            .in('kampagne_id', kampagneIds)
            .order('created_at', { ascending: false })
        );
      } else {
        batch2Promises.push(Promise.resolve({ data: [] }));
      }

      const [auftragsdetailsResult, kooperationenResult] = await Promise.all(batch2Promises);

      this.auftragsdetails = auftragsdetailsResult.data || [];
      this.kooperationen = kooperationenResult.data || [];

      console.log(`✅ UNTERNEHMENDETAIL: Batch 2 geladen in ${Date.now() - startTime}ms`);

      // ========== BATCH 3: Creator laden (falls Kooperationen vorhanden) ==========
      const creatorIds = Array.from(new Set(this.kooperationen.map(k => k.creator_id).filter(Boolean)));
      
      if (creatorIds.length > 0) {
        const { data: creators } = await window.supabase
          .from('creator')
          .select('id, vorname, nachname, instagram, instagram_follower, tiktok_follower, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land')
          .in('id', creatorIds);
        this.creators = creators || [];
        this._creatorMap = this.creators.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
      } else {
        this.creators = [];
        this._creatorMap = {};
      }

      console.log(`✅ UNTERNEHMENDETAIL: Alle Daten geladen in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Laden der Unternehmen-Daten:', error);
      throw error;
    }
  }

  // Rendere Unternehmen-Detailseite
  render(force = false) {
    
    // Debounce: Verhindere mehrfaches Rendern innerhalb kurzer Zeit
    const now = Date.now();
    if (!force && (now - this._lastRenderTime) < this._renderDebounceMs) {
      console.log('⏸️ UNTERNEHMENDETAIL: Render übersprungen (Debounce)');
      return;
    }
    this._lastRenderTime = now;
    
    if (!this.activeMainTab) {
      this.activeMainTab = 'informationen';
    }

    window.setHeadline(`${this.unternehmen?.firmenname || 'Unternehmen'} - Details`);

    // Person-Config für die Sidebar (Unternehmen als "Person" behandeln, nur Logo im Header)
    const personConfig = {
      name: this.unternehmen?.firmenname || 'Unbekannt',
      email: '',
      subtitle: this.unternehmen?.branchen_names?.join(', ') || 'Unternehmen',
      avatarUrl: this.unternehmen?.logo_url,
      avatarOnly: false
    };

    // Quick Actions
    const quickActions = [];
    // Keine Standard-Quick-Actions für Unternehmen

    // Info-Items für Sidebar
    const webseiteLinkHtml = this.unternehmen?.webseite
      ? `<a href="${UnternehmenService.sanitizeUrl(this.unternehmen.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${this.sanitize(this.unternehmen.webseite)}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>`
      : null;

    const sidebarInfo = this.renderInfoItems([
      ...(this.unternehmen?.internes_kuerzel ? [{ icon: 'info', label: 'Internes Kürzel', value: this.unternehmen.internes_kuerzel }] : []),
      { icon: 'tag', label: 'Branchen', value: this.unternehmen?.branchen_names?.join(', ') || '-' },
      ...(webseiteLinkHtml ? [{ icon: 'link', label: 'Webseite', rawHtml: webseiteLinkHtml }] : []),
      { icon: 'mail', label: 'E-Mail', value: this.unternehmen?.mail, mailto: true },
      { icon: 'mail', label: 'Rechnungs-E-Mail', value: this.unternehmen?.invoice_email, mailto: true },
      { icon: 'home', label: 'Rechnungsadresse', rawHtml: this.renderAdresseBlock('rechnungsadresse') },
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.unternehmen?.created_at) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.unternehmen?.updated_at) }
    ]);

    const tabNavigation = this.renderTabNavigation();
    const mainContent = this.renderMainContent();

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

  getAdresseDisplay() {
    const parts = [
      [this.unternehmen?.rechnungsadresse_strasse, this.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(' '),
      [this.unternehmen?.rechnungsadresse_plz, this.unternehmen?.rechnungsadresse_stadt].filter(Boolean).join(' '),
      this.unternehmen?.rechnungsadresse_land
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  renderAdresseBlock(prefix) {
    const strasse = this.unternehmen?.[`${prefix}_strasse`];
    const hausnr = this.unternehmen?.[`${prefix}_hausnummer`];
    const plz = this.unternehmen?.[`${prefix}_plz`];
    const stadt = this.unternehmen?.[`${prefix}_stadt`];
    const land = this.unternehmen?.[`${prefix}_land`];

    const line1 = [strasse, hausnr].filter(Boolean).join(' ');
    const line2 = [plz, stadt].filter(Boolean).join(' ');
    const line3 = land || '';

    const lines = [line1, line2, line3].filter(Boolean);
    if (lines.length === 0) return '-';

    return `<span class="info-address">${lines.map(l => this.sanitize(l)).join('<br>')}</span>`;
  }

  renderTabNavigation() {
    // Kick-Off Tab nur anzeigen wenn KEINE Marken vorhanden (Kick-Off auf Unternehmensebene)
    const showKickOffTab = this.marken.length === 0;
    
    const tabs = [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' },
      ...(showKickOffTab ? [{
        tab: 'kickoff',
        label: 'Kick-Off',
        count: Object.values(this.kickoffsByType).filter(Boolean).length,
        isActive: this.activeMainTab === 'kickoff'
      }] : []),
      { tab: 'marken', label: 'Marken', count: this.marken.length, isActive: this.activeMainTab === 'marken' },
      { tab: 'ansprechpartner', label: 'Ansprechpartner', count: this.ansprechpartner.length, isActive: this.activeMainTab === 'ansprechpartner' },
      { tab: 'auftraege', label: 'Aufträge', count: this.auftraege.length, isActive: this.activeMainTab === 'auftraege' },
      { tab: 'auftragsdetails', label: 'Auftragsdetails', count: this.auftragsdetails.length, isActive: this.activeMainTab === 'auftragsdetails' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.kampagnen.length, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'briefings', label: 'Briefings', count: this.briefings.length, isActive: this.activeMainTab === 'briefings' },
      { tab: 'strategien', label: 'Strategien', count: this.strategien.length, isActive: this.activeMainTab === 'strategien' },
      { tab: 'creatorauswahl', label: 'Creator-Auswahl', count: this.creatorAuswahlen.length, isActive: this.activeMainTab === 'creatorauswahl' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.kooperationen.length, isActive: this.activeMainTab === 'kooperationen' },
      { tab: 'creators', label: 'Creator', count: this.creators.length, isActive: this.activeMainTab === 'creators' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen.length, isActive: this.activeMainTab === 'rechnungen' },
      { tab: 'vertraege', label: 'Verträge', count: this.vertraege.length, isActive: this.activeMainTab === 'vertraege' }
    ];

    return tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content secondary-tab-content">
        <div class="tab-pane ${this.activeMainTab === 'kickoff' ? 'active' : ''}" id="tab-kickoff">
          ${this.renderKickOff()}
        </div>

          <div class="tab-pane ${this.activeMainTab === 'marken' ? 'active' : ''}" id="tab-marken">
            ${this.renderMarken()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'ansprechpartner' ? 'active' : ''}" id="tab-ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'auftraege' ? 'active' : ''}" id="tab-auftraege">
            ${this.renderAuftraege()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'auftragsdetails' ? 'active' : ''}" id="tab-auftragsdetails">
            ${this.renderAuftragsdetails()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
            ${this.renderKampagnen()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'briefings' ? 'active' : ''}" id="tab-briefings">
            ${this.renderBriefings()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'strategien' ? 'active' : ''}" id="tab-strategien">
            ${this.renderStrategien()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'creatorauswahl' ? 'active' : ''}" id="tab-creatorauswahl">
            ${this.renderCreatorAuswahl()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
            ${this.renderKooperationen()}
          </div>

          <div class="tab-pane ${this.activeMainTab === 'creators' ? 'active' : ''}" id="tab-creators">
            ${this.renderCreators()}
          </div>
          
          <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
            ${this.renderRechnungen()}
          </div>

        <div class="tab-pane ${this.activeMainTab === 'vertraege' ? 'active' : ''}" id="tab-vertraege">
          ${this.renderVertraege()}
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
                <td><strong>Firmenname</strong></td>
                <td style="text-align: right;">${this.sanitize(this.unternehmen?.firmenname) || '-'}</td>
              </tr>
              ${this.unternehmen?.internes_kuerzel ? `
              <tr>
                <td><strong>Internes Kürzel</strong></td>
                <td style="text-align: right;">${this.sanitize(this.unternehmen.internes_kuerzel)}</td>
              </tr>
              ` : ''}
              <tr>
                <td><strong>Branchen</strong></td>
                <td style="text-align: right;">${this.unternehmen?.branchen_names?.map(b => `<span class="tag tag--branche">${this.sanitize(b)}</span>`).join(' ') || '-'}</td>
              </tr>
              <tr>
                <td><strong>Rechnungsadresse</strong></td>
                <td style="text-align: right;">${this.sanitize(this.getAdresseDisplay())}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Rendere Marken
  renderMarken() {
    if (!this.marken || this.marken.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Marken vorhanden</h3>
          <p>Es wurden noch keine Marken für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.marken.map(marke => `
      <tr>
        <td class="col-name-with-icon">
          ${marke.logo_url 
            ? `<img src="${marke.logo_url}" class="table-logo" width="24" height="24" alt="" />` 
            : `<span class="table-avatar">${(marke.markenname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${this.sanitize(marke.markenname) || 'Unbekannte Marke'}
          </a>
        </td>
        <td class="col-webseite">${marke.webseite ? `<a href="${UnternehmenService.sanitizeUrl(marke.webseite)}" target="_blank" rel="noopener">${this.sanitize(marke.webseite)}</a>` : '-'}</td>
        <td>${this.sanitize(marke.branche) || '-'}</td>
        <td>${this.formatDate(marke.created_at)}</td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Marke</th>
              <th class="col-webseite">Webseite</th>
              <th>Branche</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
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
          <p>Es wurden noch keine Aufträge für dieses Unternehmen erstellt.</p>
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
        <td>${this.sanitize(auftrag.auftragtype) || '-'}</td>
        <td>${this.sanitize(auftrag.marke?.markenname) || '-'}</td>
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

  // Rendere Auftragsdetails
  renderAuftragsdetails() {
    if (!this.auftragsdetails || this.auftragsdetails.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Auftragsdetails vorhanden</h3>
          <p>Es wurden noch keine Auftragsdetails für die Aufträge dieses Unternehmens erstellt.</p>
        </div>
      `;
    }

    const rows = this.auftragsdetails.map(detail => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="auftragsdetails" data-id="${detail.id}">
            ${this.sanitize(detail.auftrag?.auftragsname) || 'Unbekannter Auftrag'}
          </a>
        </td>
        <td><span class="status-badge status-${detail.auftrag?.status?.toLowerCase() || 'unknown'}">${detail.auftrag?.status || '-'}</span></td>
        <td>${this.sanitize(detail.kategorie) || '-'}</td>
        <td>${this.sanitize(detail.beschreibung) || '-'}</td>
        <td>${this.formatDate(detail.created_at)}</td>
        <td>
          ${actionBuilder.create('auftragsdetails', detail.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Auftrag</th>
              <th>Status</th>
              <th>Kategorie</th>
              <th>Beschreibung</th>
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

  // Rendere Briefings
  renderBriefings() {
    if (!this.briefings || this.briefings.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Briefings vorhanden</h3>
          <p>Es wurden noch keine Briefings für dieses Unternehmen erstellt.</p>
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

  // Rendere Kampagnen
  renderKampagnen() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.kampagnen.map(k => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${k.id}">
            ${this.sanitize(KampagneUtils.getDisplayName(k))}
          </a>
        </td>
        <td><span class="status-badge status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span></td>
        <td>${this.sanitize(k.marke?.markenname) || '-'}</td>
        <td>${this.formatDate(k.start)}</td>
        <td>${this.formatDate(k.deadline)}</td>
        <td>${k.creatoranzahl || 0}</td>
        <td>${k.videoanzahl || 0}</td>
        <td>
          ${actionBuilder.create('kampagne', k.id)}
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

  // Rendere Strategien
  renderStrategien() {
    if (!this.strategien || this.strategien.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Strategien vorhanden</h3>
          <p>Es wurden noch keine Strategien für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.strategien.map(s => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="strategie" data-id="${s.id}">
            ${this.sanitize(s.name) || 'Unbekannte Strategie'}
          </a>
        </td>
        <td>${this.sanitize(s.teilbereich) || '-'}</td>
        <td class="col-erstellt-von">${this.sanitize(s.created_by_user?.name) || '-'}</td>
        <td>${this.formatDate(s.created_at)}</td>
        <td>
          ${actionBuilder.create('strategie', s.id)}
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
              <th class="col-erstellt-von">Erstellt von</th>
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

  // Rendere Creator-Auswahl
  renderCreatorAuswahl() {
    if (!this.creatorAuswahlen || this.creatorAuswahlen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Creator-Auswahlen vorhanden</h3>
          <p>Es wurden noch keine Creator-Auswahlen für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.creatorAuswahlen.map(ca => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="sourcing" data-id="${ca.id}">
            ${this.sanitize(ca.name) || 'Unbekannte Creator-Auswahl'}
          </a>
        </td>
        <td>${this.formatDate(ca.created_at)}</td>
        <td>
          ${actionBuilder.create('creator_auswahl', ca.id)}
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
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
          <p>Für die Kampagnen dieses Unternehmens wurden keine Kooperationen gefunden.</p>
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

  // Rendere Creator
  renderCreators() {
    if (!this.creators || this.creators.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Creator vorhanden</h3>
          <p>Es gibt keine Creator in Kooperationen für dieses Unternehmen.</p>
        </div>
      `;
    }

    // Detail-Tabelle wiederverwenden (statischer Import)
    return renderCreatorTable(this.creators);
  }

  // Rendere Ansprechpartner (moderne Tabellen-Darstellung wie bei Marken)
  renderAnsprechpartner() {
    if (!this.ansprechpartner || this.ansprechpartner.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Ansprechpartner vorhanden</h3>
          <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
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
        <td>
          ${actionBuilder.create('ansprechpartner_unternehmen', ap.id)}
        </td>
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
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rendere Rechnungen
  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Rechnungen vorhanden</h3>
          <p>Für dieses Unternehmen wurden noch keine Rechnungen erfasst.</p>
        </div>
      `;
    }

    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${this.sanitize(r.rechnung_nr || '—')}</a></td>
        <td><span class="status-badge status-${(r.status||'unknown').toLowerCase()}">${r.status || '-'}</span></td>
        <td>${this.formatCurrency(r.nettobetrag)}</td>
        <td>${this.formatCurrency(r.bruttobetrag)}</td>
        <td>${this.formatDate(r.gestellt_am)}</td>
        <td>${this.formatDate(r.zahlungsziel)}</td>
        <td>${this.formatDate(r.bezahlt_am)}</td>
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
              <th>Fällig</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rendere Verträge
  renderVertraege() {
    if (!this.vertraege || this.vertraege.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Verträge vorhanden</h3>
          <p>Für dieses Unternehmen wurden noch keine Verträge erfasst.</p>
        </div>
      `;
    }

    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

    const rows = this.vertraege.map(v => {
      const creatorName = v.creator ? `${v.creator.vorname || ''} ${v.creator.nachname || ''}`.trim() : '-';
      const kampagneName = KampagneUtils.getDisplayName(v.kampagne);
      
      return `
        <tr>
          <td><a href="/vertraege/${v.id}" onclick="event.preventDefault(); window.navigateTo('/vertraege/${v.id}')">${this.sanitize(v.name || '—')}</a></td>
          <td>${this.sanitize(v.typ || '-')}</td>
          <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
          <td>${v.kampagne ? `<a href="/kampagnen/${v.kampagne.id}" onclick="event.preventDefault(); window.navigateTo('/kampagnen/${v.kampagne.id}')">${this.sanitize(kampagneName)}</a>` : '-'}</td>
          <td>${v.creator ? `<a href="/creator/${v.creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${v.creator.id}')">${this.sanitize(creatorName)}</a>` : '-'}</td>
          <td>${v.datei_url ? `<a href="${v.datei_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
          <td>${this.formatDate(v.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table vertraege-detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Datei</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rendere Kick-Off (nur für Unternehmen ohne Marken)
  renderKickOff() {
    const availableCount = Object.values(this.kickoffsByType).filter(Boolean).length;
    const activeKickoff = this.kickoffsByType[this.activeKickoffType];
    const activeMarkenwerte = this.kickoffMarkenwerteByType[this.activeKickoffType] || [];
    const typeLabel = this.activeKickoffType === 'paid' ? 'Paid' : 'Organic';

    if (availableCount === 0) {
      return `
        <div class="empty-state">
          <h3>Kein Kick-Off vorhanden</h3>
          <p>Es wurde noch kein Brand Kick-Off für dieses Unternehmen erstellt.</p>
          <a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">
            Kick-Off erstellen
          </a>
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
            <a href="/kickoff" class="btn btn-primary" onclick="event.preventDefault(); window.navigateTo('/kickoff')">
              ${typeLabel} Kick-Off erstellen
            </a>
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
          <a href="/kickoff" class="btn btn-sm btn-secondary" onclick="event.preventDefault(); window.navigateTo('/kickoff')" style="margin-left: 1rem;">
            Bearbeiten
          </a>
        </div>
      </div>
    `;
  }

  // Binde Events
  bindEvents() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Main Tab-Navigation - als benannter Handler speichern
    this._tabClickHandler = (e) => {
      const kickoffTypeBtn = e.target.closest('.kickoff-type-btn');
      if (kickoffTypeBtn) {
        e.preventDefault();
        const nextType = kickoffTypeBtn.dataset.kickoffType;
        if (!['paid', 'organic'].includes(nextType)) return;
        this.activeKickoffType = nextType;
        this.kickoff = this.kickoffsByType[nextType] || null;
        this.kickoffMarkenwerte = this.kickoffMarkenwerteByType[nextType] || [];
        const pane = document.getElementById('tab-kickoff');
        if (pane) pane.innerHTML = this.renderKickOff();
        return;
      }

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
      if (pane) pane.classList.add('active');
    };
    document.addEventListener('click', this._tabClickHandler);

    // Unternehmen bearbeiten Button - als benannter Handler speichern
    this._editClickHandler = (e) => {
      if (e.target.closest('#btn-edit-unternehmen')) {
        this.showEditForm();
      }
    };
    document.addEventListener('click', this._editClickHandler);

    // Ansprechpartner hinzufügen Button - als benannter Handler speichern
    this._ansprechpartnerClickHandler = (e) => {
      if (e.target.id === 'btn-add-ansprechpartner-unternehmen') {
        const unternehmenId = e.target.dataset.unternehmenId || this.unternehmenId;
        if (window.actionsDropdown) {
          window.actionsDropdown.openAddAnsprechpartnerToUnternehmenModal(unternehmenId);
        }
      }
    };
    document.addEventListener('click', this._ansprechpartnerClickHandler);

    // Navigation zu verknüpften Entitäten - als benannter Handler speichern
    this._tableLinkClickHandler = (e) => {
      if (e.target.classList.contains('table-link')) {
        e.preventDefault();
        const table = e.target.dataset.table;
        const id = e.target.dataset.id;
        window.navigateTo(`/${table}/${id}`);
      }
    };
    document.addEventListener('click', this._tableLinkClickHandler);

    // Entity Updates (für Ansprechpartner)
    this._entityUpdatedHandler = (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.unternehmenId === this.unternehmenId) {
        console.log('🔄 UNTERNEHMENDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu');
        this.loadUnternehmenData().then(() => {
          this.render();
        });
      }
      if (e.detail?.entity === 'unternehmen' && e.detail?.id === this.unternehmenId) {
        console.log('🔄 UNTERNEHMENDETAIL: Unternehmen wurde aktualisiert, lade Daten neu');
        this.loadUnternehmenData().then(() => {
          this.render();
        });
      }
    };
    document.addEventListener('entityUpdated', this._entityUpdatedHandler);

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    this._softRefreshHandler = async (e) => {
      // Blockiere wenn gerade geladen wird
      if (this._isLoading) {
        console.log('⏸️ UNTERNEHMENDETAIL: Bereits am Laden - Soft-Refresh übersprungen');
        return;
      }
      
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      
      if (hasActiveForm) {
        console.log('⏸️ UNTERNEHMENDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      if (!this.unternehmenId || !location.pathname.includes('/unternehmen/')) {
        return;
      }
      
      console.log('🔄 UNTERNEHMENDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadUnternehmenData();
      this.render(); // Debounce schützt bereits
      // NICHT bindEvents() erneut aufrufen - führt zu Endlosschleife
    };
    window.addEventListener('softRefresh', this._softRefreshHandler);
  }

  // Ansprechpartner entfernen
  async removeAnsprechpartner(ansprechpartnerId, unternehmenId) {
    try {
      const { error } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .delete()
        .eq('ansprechpartner_id', ansprechpartnerId)
        .eq('unternehmen_id', unternehmenId);

      if (error) throw error;

      // UI aktualisieren
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId: unternehmenId } 
      }));

      console.log('✅ UNTERNEHMENDETAIL: Ansprechpartner erfolgreich entfernt');

    } catch (error) {
      console.error('❌ Fehler beim Entfernen des Ansprechpartners:', error);
      alert('Fehler beim Entfernen: ' + (error.message || 'Unbekannter Fehler'));
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

  // Branche-Namen aus IDs laden - delegiert an UnternehmenService
  async getBranchenNamen(branchenIds) {
    return UnternehmenService.getBranchenNamen(branchenIds);
  }

  // Zeige Edit-Formular
  async showEditForm() {
    console.log('🔧 UNTERNEHMENDETAIL: Öffne Edit-Formular für Unternehmen:', this.unternehmenId);
    
    try {
      if (window.breadcrumbSystem && this.unternehmen) {
        window.breadcrumbSystem.updateDetailLabel('Bearbeiten');
      }

      // Formular-Daten vorbereiten
      const formData = { ...this.unternehmen };
      formData._isEditMode = true;
      formData._entityId = this.unternehmenId;

      // Branchen-IDs für Edit-Modus sicherstellen
      if (this.unternehmen.branche_id && Array.isArray(this.unternehmen.branche_id)) {
        formData.branche_id = this.unternehmen.branche_id;
        console.log('🏷️ UNTERNEHMENDETAIL: Branchen-IDs für Edit-Mode:', formData.branche_id);
      } else if (!this.unternehmen.branche_id || this.unternehmen.branche_id.length === 0) {
        // Wenn keine Branchen vorhanden sind, setze ein leeres Array
        formData.branche_id = [];
        console.log('ℹ️ UNTERNEHMENDETAIL: Keine Branchen vorhanden, setze leeres Array');
      }

      console.log('📋 UNTERNEHMENDETAIL: Vollständige FormData für Edit-Mode:', {
        entityId: formData._entityId,
        brancheIds: formData.branche_id,
        firmenname: formData.firmenname,
        isEditMode: formData._isEditMode
      });

      // Formular rendern
      const formHtml = window.formSystem.renderFormOnly('unternehmen', formData);
      
      // Logo-Anzeige wenn vorhanden
      const safeLogoUrl = UnternehmenService.sanitizeUrl(this.unternehmen?.logo_url);
      const currentLogoHtml = (safeLogoUrl && safeLogoUrl !== '#') ? `
        <div class="form-logo-display">
          <label class="form-logo-label">Aktuelles Logo:</label>
          <img src="${safeLogoUrl}" alt="${(this.unternehmen.firmenname || '').replace(/"/g, '&quot;')} Logo" class="form-logo-image" />
        </div>
      ` : '';
      
      window.setHeadline(`${this.unternehmen?.firmenname || 'Unternehmen'} bearbeiten`);
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

      // Formular-Events binden mit korrekten Daten
      await window.formSystem.bindFormEvents('unternehmen', formData);
      
      // Custom Submit Handler für Logo-Upload
      const form = document.getElementById('unternehmen-form');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          await this.handleEditFormSubmit(form);
        };
      }

      // Logo-Preview-Funktion für Uploader
      this.setupLogoPreview(form);

      console.log('✅ UNTERNEHMENDETAIL: Edit-Formular gerendert und Events gebunden');

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Anzeigen des Edit-Formulars:', error);
      this.showErrorMessage('Fehler beim Laden des Formulars: ' + error.message);
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
  async handleEditFormSubmit(form) {
    try {
      console.log('🎯 UNTERNEHMENDETAIL: Verarbeite Edit-Formular-Submit');
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
      submitBtn.disabled = true;

      // Formular-Daten sammeln (wie in UnternehmenCreate)
      const formData = new FormData(form);
      const data = {};
      const allFormData = {};
      
      // Tag-basierte Multi-Selects
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        // Zuerst mit [], dann ohne (wie in FormSubmitHelper.js) - Hidden Select wird mit [] erstellt
        let hiddenSelect = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        }
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) hiddenSelect = allSelects[1];
        }
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions)
            .map(option => option.value)
            .filter(val => val !== '');
          // WICHTIG: Auch leere Arrays setzen, damit "alle Tags entfernt" korrekt als Clear verarbeitet wird.
          allFormData[select.name] = selectedValues;
        }
      });
      
      // Mitarbeiter-Felder explizit sammeln (falls nicht über tagBasedSelects gefunden)
      const mitarbeiterFields = ['management_ids', 'lead_mitarbeiter_ids', 'mitarbeiter_ids'];
      for (const fieldName of mitarbeiterFields) {
        if (!allFormData[fieldName]) {
          // Suche nach verstecktem Select
          const hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
          if (hiddenSelect) {
            const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
            if (selectedValues.length > 0) {
              allFormData[fieldName] = selectedValues;
              console.log(`✅ Manuell gesammelt: ${fieldName} =`, selectedValues);
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
                  console.log(`✅ Aus Multi-Select gesammelt: ${fieldName} =`, selectedValues);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Standard FormData sammeln
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            const cleanKey = key.replace('[]', '');
            if (!allFormData[cleanKey]) allFormData[cleanKey] = [];
            allFormData[cleanKey].push(value);
          } else {
            if (allFormData[key]) {
              if (!Array.isArray(allFormData[key])) allFormData[key] = [allFormData[key]];
              allFormData[key].push(value);
            } else {
              allFormData[key] = value;
            }
          }
        }
      }
      
      for (let [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : value.trim();
      }
      
      // Debug: Zeige alle gesammelten Daten
      console.log('📋 UNTERNEHMENDETAIL: Alle gesammelten Formular-Daten:', data);
      console.log('📋 UNTERNEHMENDETAIL: Mitarbeiter-Felder:', {
        management_ids: data.management_ids,
        lead_mitarbeiter_ids: data.lead_mitarbeiter_ids,
        mitarbeiter_ids: data.mitarbeiter_ids
      });

      // Unternehmen aktualisieren
      const result = await window.dataService.updateEntity('unternehmen', this.unternehmenId, data);
      
      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Aktualisieren');
      }

      // HINWEIS: Branchen werden automatisch durch DataService.handleManyToManyRelations() verwaltet
      // Daher NICHT manuell saveUnternehmenBranchen() aufrufen - das führt zu Race Conditions!
      
      // Mitarbeiter-Zuordnungen mit Rollen speichern
      await this.saveMitarbeiterRoles(this.unternehmenId, data);
      
      // Logo-Upload (falls vorhanden) - nach Branchen, damit Fehler nicht Branchen blockieren
      try {
        await this.uploadLogo(this.unternehmenId, form);
      } catch (logoError) {
        console.warn('⚠️ Logo-Upload fehlgeschlagen, aber Unternehmen wurde aktualisiert:', logoError);
        // Weiter machen, auch wenn Logo-Upload fehlschlägt
      }

      if (window.toastSystem) {
        window.toastSystem.success('Unternehmen erfolgreich aktualisiert!');
      }
      
      // Zurück zur Detail-Ansicht
      await this.init(this.unternehmenId);

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Aktualisieren:', error);
      if (window.toastSystem) {
        window.toastSystem.show('Fehler beim Aktualisieren: ' + error.message, 'error');
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Speichern';
        submitBtn.disabled = false;
      }
    }
  }
  
  // Logo-Upload - delegiert an UnternehmenService
  async uploadLogo(unternehmenId, form) {
    return UnternehmenService.uploadLogo(unternehmenId, form, { throwOnError: true });
  }
  
  // Mitarbeiter-Zuordnungen mit Rollen speichern - delegiert an UnternehmenService
  async saveMitarbeiterRoles(unternehmenId, data) {
    return UnternehmenService.saveMitarbeiterRoles(unternehmenId, data);
  }
  
  // Branchen-Verknüpfungen speichern - delegiert an UnternehmenService
  // HINWEIS: Sollte NICHT manuell aufgerufen werden wenn DataService verwendet wird!
  async saveUnternehmenBranchen(unternehmenId, brancheIds = null, form = null) {
    return UnternehmenService.saveUnternehmenBranchen(unternehmenId, brancheIds, form);
  }

  // Cleanup - entfernt alle Event-Listener
  _removeAllEventListeners() {
    // Click-Handler entfernen
    if (this._tabClickHandler) {
      document.removeEventListener('click', this._tabClickHandler);
      this._tabClickHandler = null;
    }
    if (this._editClickHandler) {
      document.removeEventListener('click', this._editClickHandler);
      this._editClickHandler = null;
    }
    if (this._ansprechpartnerClickHandler) {
      document.removeEventListener('click', this._ansprechpartnerClickHandler);
      this._ansprechpartnerClickHandler = null;
    }
    if (this._tableLinkClickHandler) {
      document.removeEventListener('click', this._tableLinkClickHandler);
      this._tableLinkClickHandler = null;
    }
    // Custom Event-Handler entfernen
    if (this._softRefreshHandler) {
      window.removeEventListener('softRefresh', this._softRefreshHandler);
      this._softRefreshHandler = null;
    }
    if (this._entityUpdatedHandler) {
      document.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    this._sidebarTabsBound = false;
    this.eventsBound = false;
  }

  // Cleanup
  destroy() {
    console.log('UnternehmenDetail: Cleaning up...');
    
    this._removeAllEventListeners();
    this._isLoading = false;
    this._lastRenderTime = 0;
  }
}

export const unternehmenDetail = new UnternehmenDetail();
