// UnternehmenDetail.js (ES6-Modul)
// Unternehmen-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Marken und Aufträge
import { renderCreatorTable } from '../creator/CreatorTable.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class UnternehmenDetail {
  constructor() {
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
    this._creatorMap = {};
  }

  // Initialisiere Unternehmen-Detailseite
  async init(unternehmenId) {
    console.log('🎯 UNTERNEHMENDETAIL: Initialisiere Unternehmen-Detailseite für ID:', unternehmenId);
    
    try {
      this.unternehmenId = unternehmenId;
      await this.loadUnternehmenData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.unternehmen) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Unternehmen', url: '/unternehmen', clickable: true },
          { label: this.unternehmen.firmenname || 'Details', url: `/unternehmen/${this.unternehmenId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ UNTERNEHMENDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'UnternehmenDetail.init');
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

      // Kooperationen und Creator laden (basierend auf Kampagnen)
      try {
        const kampagneIds = (this.kampagnen || []).map(k => k.id).filter(Boolean);
        if (kampagneIds.length > 0) {
          const { data: koops } = await window.supabase
            .from('kooperationen')
            .select('id, name, status, videoanzahl, gesamtkosten, kampagne_id, creator_id, created_at')
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
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-edit-unternehmen" class="secondary-btn">
            <i class="icon-edit"></i>
            Unternehmen bearbeiten
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
          <button class="tab-button" data-tab="marken">
            Marken
            <span class="tab-count">${this.marken.length}</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="auftragsdetails">
            Auftragsdetails
            <span class="tab-count">${this.auftragsdetails.length}</span>
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
          <button class="tab-button" data-tab="creators">
            Creator
            <span class="tab-count">${this.creators.length}</span>
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

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Auftragsdetails Tab -->
          <div class="tab-pane" id="auftragsdetails">
            ${this.renderAuftragsdetails()}
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

          <!-- Creator Tab -->
          <div class="tab-pane" id="creators">
            ${this.renderCreators()}
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
    const logoHtml = this.unternehmen?.logo_url ? `
      <div class="detail-logo">
        <img src="${this.unternehmen.logo_url}" alt="${this.unternehmen.firmenname} Logo" class="logo-image" />
      </div>
    ` : '';
    
    return `
      <div class="detail-section">
        ${logoHtml}
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Unternehmen-Informationen</h3>
            <div class="detail-item">
              <label>Firmenname:</label>
              <span>${this.unternehmen?.firmenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Branche:</label>
              <span>${this.unternehmen?.branchen_names?.join(', ') || this.unternehmen?.branche || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Rechnungsadresse:</label>
              <span>
                ${[
                  [this.unternehmen?.rechnungsadresse_strasse, this.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(' '),
                  [this.unternehmen?.rechnungsadresse_plz, this.unternehmen?.rechnungsadresse_stadt].filter(Boolean).join(' '),
                  this.unternehmen?.rechnungsadresse_land
                ].filter(Boolean).join(', ') || '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.unternehmen?.created_at ? new Date(this.unternehmen.created_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.unternehmen?.updated_at ? new Date(this.unternehmen.updated_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Notizen
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'unternehmen', this.unternehmenId);
    }
    return '<p>Notizen-System nicht verfügbar</p>';
  }

  // Rendere Bewertungen
  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'unternehmen', this.unternehmenId);
    }
    return '<p>Bewertungs-System nicht verfügbar</p>';
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
            ${marke.markenname || 'Unbekannte Marke'}
          </a>
        </td>
        <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" rel="noopener">${marke.webseite}</a>` : '-'}</td>
        <td>${marke.branche || '-'}</td>
        <td>${marke.created_at ? new Date(marke.created_at).toLocaleDateString('de-DE') : '-'}</td>
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
        <td>${auftrag.marke?.markenname || '-'}</td>
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

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const rows = this.auftragsdetails.map(detail => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="auftragsdetails" data-id="${detail.id}">
            ${detail.auftrag?.auftragsname || 'Unbekannter Auftrag'}
          </a>
        </td>
        <td><span class="status-badge status-${detail.auftrag?.status?.toLowerCase() || 'unknown'}">${detail.auftrag?.status || '-'}</span></td>
        <td>${detail.kategorie || '-'}</td>
        <td>${detail.beschreibung || '-'}</td>
        <td>${formatDate(detail.created_at)}</td>
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

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    const rows = this.kampagnen.map(k => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${k.id}">
            ${k.kampagnenname || 'Unbekannte Kampagne'}
          </a>
        </td>
        <td><span class="status-badge status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span></td>
        <td>${k.marke?.markenname || '-'}</td>
        <td>${formatDate(k.start)}</td>
        <td>${formatDate(k.deadline)}</td>
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
        <td>${formatCurrency(k.gesamtkosten)}</td>
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
    const hasAnsprechpartner = this.ansprechpartner && this.ansprechpartner.length > 0;
    
    const addButton = `
      <div class="section-header">
        <h3>Ansprechpartner</h3>
      </div>
    `;

    if (!hasAnsprechpartner) {
      return addButton + `
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
        <td>
          <button class="btn-remove-ansprechpartner" data-ansprechpartner-id="${ap.id}" data-unternehmen-id="${this.unternehmenId}" title="Ansprechpartner entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      </tr>
    `).join('');

    return `
      ${addButton}
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
              <th></th>
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
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td><span class="status-badge status-${(r.status||'unknown').toLowerCase()}">${r.status || '-'}</span></td>
        <td>${fmt(r.nettobetrag)}</td>
        <td>${fmt(r.bruttobetrag)}</td>
        <td>${fDate(r.gestellt_am)}</td>
        <td>${fDate(r.zahlungsziel)}</td>
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

  // Binde Events
  bindEvents() {
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      const tabButton = e.target.closest('.tab-button');
      if (tabButton && tabButton.dataset?.tab) {
        e.preventDefault();
        this.switchTab(tabButton.dataset.tab);
      }
    });

    // Unternehmen bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-unternehmen') {
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

    // Ansprechpartner entfernen Button
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-ansprechpartner')) {
        const ansprechpartnerId = e.target.dataset.ansprechpartnerId;
        const unternehmenId = e.target.dataset.unternehmenId || this.unternehmenId;
        
        if (confirm('Möchten Sie diesen Ansprechpartner wirklich vom Unternehmen entfernen?')) {
          this.removeAnsprechpartner(ansprechpartnerId, unternehmenId);
        }
      }
    });

    // Entity Updates (für Ansprechpartner)
    document.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.unternehmenId === this.unternehmenId) {
        console.log('🔄 UNTERNEHMENDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu');
        this.loadUnternehmenData().then(() => {
          this.render();
          this.bindEvents();
        });
      }
      if (e.detail?.entity === 'unternehmen' && e.detail?.id === this.unternehmenId) {
        console.log('🔄 UNTERNEHMENDETAIL: Unternehmen wurde aktualisiert, lade Daten neu');
        this.loadUnternehmenData().then(() => {
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
        console.log('⏸️ UNTERNEHMENDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      // Nur wenn auf Unternehmen-Detail-Seite
      if (!this.unternehmenId || !location.pathname.includes('/unternehmen/')) {
        return;
      }
      
      console.log('🔄 UNTERNEHMENDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadUnternehmenData();
      this.render();
      this.bindEvents();
    });
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

  // Tab wechseln
  switchTab(tabName) {
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });

    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(tabName);
    if (activePane) {
      activePane.classList.add('active');
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
      
      window.setHeadline(`${this.unternehmen?.firmenname || 'Unternehmen'} bearbeiten`);
      window.content.innerHTML = `
        <div class="form-page">
          ${formHtml}
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

      console.log('✅ UNTERNEHMENDETAIL: Edit-Formular gerendert und Events gebunden');

    } catch (error) {
      console.error('❌ UNTERNEHMENDETAIL: Fehler beim Anzeigen des Edit-Formulars:', error);
      this.showErrorMessage('Fehler beim Laden des Formulars: ' + error.message);
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

      // Unternehmen aktualisieren
      const result = await window.dataService.updateEntity('unternehmen', this.unternehmenId, data);
      
      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Aktualisieren');
      }

      // Branchen speichern
      await this.saveUnternehmenBranchen(this.unternehmenId, data.branche_id, form);
      
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
        submitBtn.innerHTML = originalText;
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
      
      const { data: signed, error: signErr } = await window.supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr) throw signErr;
      
      const logo_url = signed?.signedUrl || '';
      
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
  }
}

export const unternehmenDetail = new UnternehmenDetail();