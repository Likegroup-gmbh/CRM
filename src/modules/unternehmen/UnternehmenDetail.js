// UnternehmenDetail.js (ES6-Modul)
// Unternehmen-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Marken und Aufträge
// Nutzt einheitliches zwei-Spalten-Layout

import { renderCreatorTable } from '../creator/CreatorTable.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

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
    this.activeMainTab = 'informationen';
    this.eventsBound = false;
  }

  // Initialisiere Unternehmen-Detailseite
  async init(unternehmenId) {
    console.log('🎯 UNTERNEHMENDETAIL: Initialisiere Unternehmen-Detailseite für ID:', unternehmenId);
    
    try {
      this.unternehmenId = unternehmenId;
      await this.loadUnternehmenData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.unternehmen) {
        const canEdit = window.currentUser?.permissions?.unternehmen?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Unternehmen', url: '/unternehmen', clickable: true },
          { label: this.unternehmen.firmenname || 'Details', url: `/unternehmen/${this.unternehmenId}`, clickable: false }
        ], {
          id: 'btn-edit-unternehmen',
          canEdit: canEdit
        });
      }
      
      await this.loadActivities();
      this.render();
      
      // Events nur einmal binden
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      console.log('✅ UNTERNEHMENDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
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

  // Lade Unternehmen-Daten
  async loadUnternehmenData() {
    console.log('🔄 UNTERNEHMENDETAIL: Lade Unternehmen-Daten...');
    
    try {
      // Unternehmen-Basisdaten laden
      const { data: unternehmen, error } = await window.supabase
        .from('unternehmen')
        .select('*')
        .eq('id', this.unternehmenId)
        .single();

      if (error) throw error;
      
      this.unternehmen = unternehmen;
      console.log('✅ UNTERNEHMENDETAIL: Unternehmen-Basisdaten geladen:', this.unternehmen);

      // Branchen aus Junction-Table laden
      try {
        const { data: branchenData, error: branchenError } = await window.supabase
          .from('unternehmen_branchen')
          .select(`
            branche_id,
            branchen:branche_id (id, name)
          `)
          .eq('unternehmen_id', this.unternehmenId);

        if (!branchenError && branchenData) {
          // Branchen-IDs als Array für Formular speichern
          this.unternehmen.branche_id = branchenData.map(b => b.branche_id);
          this.unternehmen.branchen_names = branchenData.map(b => b.branchen?.name).filter(Boolean);
          console.log('✅ UNTERNEHMENDETAIL: Branchen geladen:', this.unternehmen.branche_id);
        }
      } catch (branchenErr) {
        console.warn('⚠️ UNTERNEHMENDETAIL: Branchen konnten nicht geladen werden:', branchenErr);
      }

      // Notizen laden
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('unternehmen', this.unternehmenId);
        console.log('✅ UNTERNEHMENDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Bewertungen laden
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('unternehmen', this.unternehmenId);
        console.log('✅ UNTERNEHMENDETAIL: Ratings geladen:', this.ratings.length);
      }

      // Marken laden
      const { data: marken, error: markenError } = await window.supabase
        .from('marke')
        .select('*')
        .eq('unternehmen_id', this.unternehmenId);

      if (!markenError) {
        this.marken = marken || [];
        console.log('✅ UNTERNEHMENDETAIL: Marken geladen:', this.marken.length);
      }

      // Aufträge laden
      const { data: auftraege, error: auftraegeError } = await window.supabase
        .from('auftrag')
        .select('*')
        .eq('unternehmen_id', this.unternehmenId);

      if (!auftraegeError) {
        this.auftraege = auftraege || [];
        console.log('✅ UNTERNEHMENDETAIL: Aufträge geladen:', this.auftraege.length);
        
        // Auftragsdetails für diese Aufträge laden
        const auftragIds = (this.auftraege || []).map(a => a.id).filter(Boolean);
        if (auftragIds.length > 0) {
          const { data: auftragsdetails, error: auftragsdetailsError } = await window.supabase
            .from('auftrag_details')
            .select(`
              *,
              auftrag:auftrag_id (
                id,
                auftragsname,
                status
              )
            `)
            .in('auftrag_id', auftragIds)
            .order('created_at', { ascending: false });
          
          if (!auftragsdetailsError) {
            this.auftragsdetails = auftragsdetails || [];
            console.log('✅ UNTERNEHMENDETAIL: Auftragsdetails geladen:', this.auftragsdetails.length);
          } else {
            console.warn('⚠️ UNTERNEHMENDETAIL: Auftragsdetails konnten nicht geladen werden:', auftragsdetailsError);
            this.auftragsdetails = [];
          }
        } else {
          this.auftragsdetails = [];
        }
      }

      // Briefings laden (direkt über unternehmen_id)
      try {
        const { data: briefings, error: briefingsError } = await window.supabase
          .from('briefings')
          .select('id, product_service_offer, status, deadline, unternehmen_id, marke_id, kampagne_id, created_at')
          .eq('unternehmen_id', this.unternehmenId)
          .order('created_at', { ascending: false });
        
        if (!briefingsError) {
          this.briefings = briefings || [];
          console.log('✅ UNTERNEHMENDETAIL: Briefings geladen:', this.briefings.length);
        } else {
          console.warn('⚠️ UNTERNEHMENDETAIL: Briefings konnten nicht geladen werden:', briefingsError);
          this.briefings = [];
        }
      } catch (errB) {
        console.warn('⚠️ Briefings konnten nicht geladen werden', errB);
        this.briefings = [];
      }

      // Kampagnen laden
      try {
        const { data: kampagnen } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname, status, start, deadline, unternehmen_id')
          .eq('unternehmen_id', this.unternehmenId)
          .order('created_at', { ascending: false });
        this.kampagnen = kampagnen || [];
        console.log('✅ UNTERNEHMENDETAIL: Kampagnen geladen:', this.kampagnen.length);
      } catch (errK) {
        console.warn('⚠️ Kampagnen konnten nicht geladen werden', errK);
        this.kampagnen = [];
      }

      // Rechnungen laden (direkt über unternehmen_id)
      try {
        const { data: rechnungen, error: reErr } = await window.supabase
          .from('rechnung')
          .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url')
          .eq('unternehmen_id', this.unternehmenId)
          .order('gestellt_am', { ascending: false });
        if (reErr) throw reErr;
        this.rechnungen = rechnungen || [];
      } catch (e) {
        console.warn('⚠️ Rechnungen konnten nicht geladen werden', e);
        this.rechnungen = [];
      }

      // Verträge laden (direkt über kunde_unternehmen_id)
      try {
        const { data: vertraege, error: vErr } = await window.supabase
          .from('vertraege')
          .select(`
            id, name, typ, is_draft, datei_url, datei_path, created_at,
            kampagne:kampagne_id(id, kampagnenname),
            creator:creator_id(id, vorname, nachname)
          `)
          .eq('kunde_unternehmen_id', this.unternehmenId)
          .order('created_at', { ascending: false });
        if (vErr) throw vErr;
        this.vertraege = vertraege || [];
        console.log('✅ UNTERNEHMENDETAIL: Verträge geladen:', this.vertraege.length);
      } catch (e) {
        console.warn('⚠️ Verträge konnten nicht geladen werden', e);
        this.vertraege = [];
      }

      // Strategien laden (direkt über unternehmen_id)
      try {
        const { data: strategien } = await window.supabase
          .from('strategie')
          .select('id, name, teilbereich, created_at')
          .eq('unternehmen_id', this.unternehmenId)
          .order('created_at', { ascending: false });
        this.strategien = strategien || [];
        console.log('✅ UNTERNEHMENDETAIL: Strategien geladen:', this.strategien.length);
      } catch (e) {
        console.warn('⚠️ Strategien konnten nicht geladen werden', e);
        this.strategien = [];
      }

      // Creator-Auswahlen laden (direkt über unternehmen_id)
      try {
        const { data: creatorAuswahlen } = await window.supabase
          .from('creator_auswahl')
          .select('id, name, created_at')
          .eq('unternehmen_id', this.unternehmenId)
          .order('created_at', { ascending: false });
        this.creatorAuswahlen = creatorAuswahlen || [];
        console.log('✅ UNTERNEHMENDETAIL: Creator-Auswahlen geladen:', this.creatorAuswahlen.length);
      } catch (e) {
        console.warn('⚠️ Creator-Auswahlen konnten nicht geladen werden', e);
        this.creatorAuswahlen = [];
      }

      // Kooperationen und Creator laden (basierend auf Kampagnen)
      try {
        const kampagneIds = (this.kampagnen || []).map(k => k.id).filter(Boolean);
        if (kampagneIds.length > 0) {
          const { data: koops } = await window.supabase
            .from('kooperationen')
            .select('id, name, status, videoanzahl, einkaufspreis_gesamt, kampagne_id, creator_id, created_at')
            .in('kampagne_id', kampagneIds)
            .order('created_at', { ascending: false });
          this.kooperationen = koops || [];

          const creatorIds = Array.from(new Set((this.kooperationen || []).map(k => k.creator_id).filter(Boolean)));
          if (creatorIds.length > 0) {
            const { data: creators } = await window.supabase
              .from('creator')
              .select('id, vorname, nachname, instagram, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land')
              .in('id', creatorIds);
            this.creators = creators || [];
          } else {
            this.creators = [];
          }
          console.log('✅ UNTERNEHMENDETAIL: Kooperationen geladen:', this.kooperationen.length, 'Creators:', this.creators.length);
        } else {
          this.kooperationen = [];
          this.creators = [];
        }
      } catch (errKoop) {
        console.warn('⚠️ Kooperationen/Creators konnten nicht geladen werden', errKoop);
        this.kooperationen = [];
        this.creators = [];
      }

      // Ansprechpartner laden (über Junction Table - analog zu MarkenDetail)
      const { data: ansprechpartner, error: ansprechpartnerError } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname, logo_url),
            telefonnummer_land:eu_laender!telefonnummer_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            ),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            )
          )
        `)
        .eq('unternehmen_id', this.unternehmenId);

      if (!ansprechpartnerError) {
        this.ansprechpartner = (ansprechpartner || [])
          .filter(item => item.ansprechpartner)
          .map(item => item.ansprechpartner);
        console.log('✅ UNTERNEHMENDETAIL: Ansprechpartner geladen:', this.ansprechpartner.length);
      }

      // Creator zu diesem Unternehmen über Marken/Aufträge/Kooperationen ableiten
      try {
        // Sammle Kampagnen-IDs dieses Unternehmens
        const { data: kampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .eq('unternehmen_id', this.unternehmenId);
        const kampagneIds = (kampagnen || []).map(k => k.id);

        let creatorIds = [];
        if (kampagneIds.length > 0) {
          const { data: koops } = await window.supabase
            .from('kooperationen')
            .select('creator_id')
            .in('kampagne_id', kampagneIds);
          creatorIds = Array.from(new Set((koops || []).map(k => k.creator_id).filter(Boolean)));
        }
        if (creatorIds.length > 0) {
          const { data: creators } = await window.supabase
            .from('creator')
            .select('id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land')
            .in('id', creatorIds);
          this.creators = creators || [];
          this._creatorMap = (creators || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
        } else {
          this.creators = [];
          this._creatorMap = {};
        }
      } catch (errCreators) {
        console.warn('⚠️ Creator für Unternehmen konnten nicht geladen werden', errCreators);
        this.creators = [];
        this._creatorMap = {};
      }

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Laden der Unternehmen-Daten:', error);
      throw error;
    }
  }

  // Rendere Unternehmen-Detailseite
  render() {
    window.setHeadline(`${this.unternehmen?.firmenname || 'Unternehmen'} - Details`);

    // Person-Config für die Sidebar (Unternehmen als "Person" behandeln, nur Logo im Header)
    const personConfig = {
      name: this.unternehmen?.firmenname || 'Unbekannt',
      email: '',
      subtitle: this.unternehmen?.branchen_names?.join(', ') || 'Unternehmen',
      avatarUrl: this.unternehmen?.logo_url,
      avatarOnly: true
    };

    // Quick Actions
    const quickActions = [];
    // Keine Standard-Quick-Actions für Unternehmen

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { label: 'Branchen', value: this.unternehmen?.branchen_names?.join(', ') || '-' },
      { label: 'Rechnungsadresse', value: this.getAdresseDisplay() },
      { label: 'Erstellt', value: this.formatDate(this.unternehmen?.created_at) },
      { label: 'Aktualisiert', value: this.formatDate(this.unternehmen?.updated_at) }
    ]);

    // Tab-Navigation (oben über volle Breite)
    const tabNavigation = this.renderTabNavigation();

    // Main Content (nur Tab-Content, ohne Navigation)
    const mainContent = this.renderMainContent();

    // Layout mit Tabs oben rendern
    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      mainContent,
      tabNavigation
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

  renderTabNavigation() {
    const tabs = [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' },
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

    return tabs.map(t => renderTabButton(t)).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'informationen' ? 'active' : ''}" id="tab-informationen">
          ${this.renderInformationen()}
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
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken vorhanden</h3>
          <p>Es wurden noch keine Marken für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.marken.map(marke => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${this.sanitize(marke.markenname) || 'Unbekannte Marke'}
          </a>
        </td>
        <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" rel="noopener">${this.sanitize(marke.webseite)}</a>` : '-'}</td>
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
              <th>Webseite</th>
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
          <div class="empty-icon">📋</div>
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
          <div class="empty-icon">📄</div>
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
          <div class="empty-icon">📝</div>
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
          <div class="empty-icon">📣</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.kampagnen.map(k => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${k.id}">
            ${this.sanitize(k.kampagnenname) || 'Unbekannte Kampagne'}
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
          <div class="empty-icon">💡</div>
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
          <div class="empty-icon">👥</div>
          <h3>Keine Creator-Auswahlen vorhanden</h3>
          <p>Es wurden noch keine Creator-Auswahlen für dieses Unternehmen erstellt.</p>
        </div>
      `;
    }

    const rows = this.creatorAuswahlen.map(ca => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="creator-auswahl" data-id="${ca.id}">
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
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für die Kampagnen dieses Unternehmens wurden keine Kooperationen gefunden.</p>
        </div>
      `;
    }

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
        <td>${this.formatCurrency(k.einkaufspreis_gesamt)}</td>
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

  // Rendere Creator
  renderCreators() {
    if (!this.creators || this.creators.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
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
          <div class="empty-icon">👥</div>
          <h3>Keine Ansprechpartner vorhanden</h3>
          <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
        </div>
      `;
    }

    const rows = this.ansprechpartner.map(ap => `
      <tr>
        <td>
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
          <div class="empty-icon">💶</div>
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
          <div class="empty-icon">📄</div>
          <h3>Keine Verträge vorhanden</h3>
          <p>Für dieses Unternehmen wurden noch keine Verträge erfasst.</p>
        </div>
      `;
    }

    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

    const rows = this.vertraege.map(v => {
      const creatorName = v.creator ? `${v.creator.vorname || ''} ${v.creator.nachname || ''}`.trim() : '-';
      const kampagneName = v.kampagne?.kampagnenname || '-';
      
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

  // Binde Events
  bindEvents() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Main Tab-Navigation
    document.addEventListener('click', (e) => {
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
    });

    // Unternehmen bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-unternehmen')) {
        this.showEditForm();
      }
    });

    // Ansprechpartner hinzufügen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-ansprechpartner-unternehmen') {
        const unternehmenId = e.target.dataset.unternehmenId || this.unternehmenId;
        if (window.actionsDropdown) {
          window.actionsDropdown.openAddAnsprechpartnerToUnternehmenModal(unternehmenId);
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

    // Entity Updates (für Ansprechpartner) - nur einmal registrieren
    if (!this._entityUpdatedBound) {
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
      this._entityUpdatedBound = true;
    }

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    // Nur einmal registrieren um Render-Loops zu vermeiden
    if (!this._softRefreshBound) {
      this._softRefreshHandler = async (e) => {
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
        this.render();
        // NICHT bindEvents() erneut aufrufen - führt zu Endlosschleife
      };
      window.addEventListener('softRefresh', this._softRefreshHandler);
      this._softRefreshBound = true;
    }
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

  // Branche-Namen aus IDs laden
  async getBranchenNamen(branchenIds) {
    try {
      const { data: branchen, error } = await window.supabase
        .from('branchen')
        .select('id, name')
        .in('id', branchenIds);
      
      if (error) {
        console.error('❌ Fehler beim Laden der Branche-Namen:', error);
        return branchenIds; // Fallback: verwende IDs als Namen
      }
      
      // Namen in der gleichen Reihenfolge wie die IDs zurückgeben
      return branchenIds.map(id => {
        const branche = branchen.find(b => b.id === id);
        return branche ? branche.name : id;
      });
    } catch (error) {
      console.error('❌ Fehler beim Laden der Branche-Namen:', error);
      return branchenIds;
    }
  }

  // Zeige Edit-Formular
  async showEditForm() {
    console.log('🔧 UNTERNEHMENDETAIL: Öffne Edit-Formular für Unternehmen:', this.unternehmenId);
    
    try {
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.unternehmen) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Unternehmen', url: '/unternehmen', clickable: true },
          { label: this.unternehmen.firmenname || 'Details', url: `/unternehmen/${this.unternehmenId}`, clickable: true },
          { label: 'Bearbeiten', url: `/unternehmen/${this.unternehmenId}/edit`, clickable: false }
        ]);
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
      const currentLogoHtml = this.unternehmen?.logo_url ? `
        <div class="form-logo-display">
          <label class="form-logo-label">Aktuelles Logo:</label>
          <img src="${this.unternehmen.logo_url}" alt="${this.unternehmen.firmenname} Logo" class="form-logo-image" />
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
        let hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) hiddenSelect = allSelects[1];
        }
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
          if (selectedValues.length > 0) allFormData[select.name] = selectedValues;
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

      alert('Unternehmen wurde erfolgreich aktualisiert!');
      
      // Zurück zur Detail-Ansicht
      await this.init(this.unternehmenId);

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Aktualisieren:', error);
      alert('Fehler beim Aktualisieren: ' + error.message);
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Speichern';
        submitBtn.disabled = false;
      }
    }
  }
  
  // Logo-Upload (identisch zu UnternehmenCreate)
  async uploadLogo(unternehmenId, form) {
    try {
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0];
      const bucket = 'logos';
      const MAX_FILE_SIZE = 200 * 1024;
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      if (file.size > MAX_FILE_SIZE) {
        alert(`Logo ist zu groß (max. 200 KB)`);
        return;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`Nur PNG und JPG Dateien sind erlaubt`);
        return;
      }

      const ext = file.name.split('.').pop().toLowerCase();
      const path = `unternehmen/${unternehmenId}/logo.${ext}`;
      
      // Altes Logo löschen
      try {
        const { data: existingFiles } = await window.supabase.storage.from(bucket).list(`unternehmen/${unternehmenId}`);
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage.from(bucket).remove([`unternehmen/${unternehmenId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
      }
      
      const { error: upErr } = await window.supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });
      
      if (upErr) throw upErr;
      
      const { data: publicUrlData } = window.supabase.storage.from(bucket).getPublicUrl(path);
      const logo_url = publicUrlData?.publicUrl || '';
      
      const { error: dbErr } = await window.supabase.from('unternehmen').update({
        logo_url,
        logo_path: path
      }).eq('id', unternehmenId);
      
      if (dbErr) throw dbErr;
      
      console.log(`✅ Logo erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      throw error; // Re-throw damit handleEditFormSubmit den Fehler sieht
    }
  }
  
  // Mitarbeiter-Zuordnungen mit Rollen speichern
  async saveMitarbeiterRoles(unternehmenId, data) {
    try {
      if (!unternehmenId || !window.supabase) return;
      
      console.log('🔄 UNTERNEHMENDETAIL: Speichere Mitarbeiter-Rollen für Unternehmen:', unternehmenId);
      
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
            unternehmen_id: unternehmenId,
            mitarbeiter_id: mitarbeiterId,
            role: roleValue
          });
        }
      }
      
      // ERST alle bestehenden Einträge für dieses Unternehmen löschen
      console.log('🗑️ Lösche alle bestehenden Mitarbeiter-Zuordnungen für Unternehmen:', unternehmenId);
      const { error: deleteError } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .delete()
        .eq('unternehmen_id', unternehmenId);
      
      if (deleteError) {
        console.error('❌ Fehler beim Löschen:', deleteError);
      }
      
      // DANN alle neuen Einträge in einem Batch einfügen
      if (allInsertData.length > 0) {
        console.log(`📤 Füge ${allInsertData.length} Mitarbeiter-Zuordnungen ein:`, allInsertData);
        
        const { error: insertError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .insert(allInsertData);
        
        if (insertError) {
          console.error('❌ Fehler beim Batch-Insert:', insertError);
          
          // Fallback: Einzeln einfügen mit upsert
          console.log('🔄 Versuche Einzelinserts mit upsert...');
          for (const row of allInsertData) {
            const { error: upsertError } = await window.supabase
              .from('mitarbeiter_unternehmen')
              .upsert(row, { onConflict: 'mitarbeiter_id,unternehmen_id,role' });
            
            if (upsertError) {
              console.error(`❌ Upsert-Fehler für ${row.mitarbeiter_id}/${row.role}:`, upsertError);
            }
          }
        } else {
          console.log(`✅ ${allInsertData.length} Mitarbeiter-Zuordnungen gespeichert`);
        }
      } else {
        console.log('ℹ️ Keine Mitarbeiter zum Speichern');
      }
      
      console.log('✅ UNTERNEHMENDETAIL: Mitarbeiter-Rollen gespeichert');
    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Speichern der Mitarbeiter-Rollen:', error);
      // Nicht werfen - Unternehmen wurde bereits aktualisiert
    }
  }
  
  // Branchen-Verknüpfungen speichern (aus UnternehmenCreate kopiert)
  async saveUnternehmenBranchen(unternehmenId, brancheIds = null, form = null) {
    try {
      if (!unternehmenId) return;
      let ids = [];
      if (Array.isArray(brancheIds)) {
        ids = brancheIds.filter(Boolean);
      } else if (typeof brancheIds === 'string' && brancheIds) {
        ids = [brancheIds];
      }
      if (ids.length === 0) {
        const context = form || document;
        const hiddenSelect = context.querySelector('select[name="branche_id[]"]');
        if (hiddenSelect) {
          ids = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(Boolean);
        }
      }
      const { error: deleteError } = await window.supabase.from('unternehmen_branchen').delete().eq('unternehmen_id', unternehmenId);
      if (deleteError) throw deleteError;
      if (ids.length === 0) {
        await window.supabase.from('unternehmen').update({ branche_id: null, branche: null }).eq('id', unternehmenId);
        return;
      }
      const insertData = ids.map(id => ({ unternehmen_id: unternehmenId, branche_id: id }));
      const { error: insertError } = await window.supabase.from('unternehmen_branchen').insert(insertData);
      if (insertError) throw insertError;
      const branchNames = await this.getBranchenNamen(ids);
      const brancheNameString = branchNames.filter(Boolean).join(', ') || null;
      await window.supabase.from('unternehmen').update({
        branche_id: ids[0] || null,
        branche: brancheNameString
      }).eq('id', unternehmenId);
    } catch (error) {
      console.error('❌ Fehler beim Speichern der Unternehmen-Branchen:', error);
      alert('Branchen-Zuordnungen konnten nicht vollständig gespeichert werden.');
    }
  }

  // Cleanup
  destroy() {
    console.log('UnternehmenDetail: Cleaning up...');
    
    // Event-Listener entfernen
    if (this._softRefreshHandler) {
      window.removeEventListener('softRefresh', this._softRefreshHandler);
      this._softRefreshBound = false;
    }
    if (this._entityUpdatedHandler) {
      document.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedBound = false;
    }
    this.eventsBound = false;
  }
}

export const unternehmenDetail = new UnternehmenDetail();
