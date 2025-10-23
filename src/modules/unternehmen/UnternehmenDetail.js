// UnternehmenDetail.js (ES6-Modul)
// Unternehmen-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Marken und Aufträge
import { renderCreatorTable } from '../creator/CreatorTable.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';

export class UnternehmenDetail {
  constructor() {
    this.unternehmenId = null;
    this.unternehmen = null;
    this.notizen = [];
    this.ratings = [];
    this.marken = [];
    this.auftraege = [];
    this.ansprechpartner = [];
    this.kampagnen = [];
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
            unternehmen:unternehmen_id(firmenname),
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
        <div class="page-header-left">
          <h1>${this.unternehmen?.firmenname || 'Unternehmen'} - Details</h1>
          <p>Detaillierte Informationen zum Unternehmen</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-unternehmen" class="secondary-btn">
            <i class="icon-edit"></i>
            Unternehmen bearbeiten
          </button>
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">
            Zurück zur Übersicht
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
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Marken
            <span class="tab-count">${this.marken.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
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
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
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

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
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

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
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
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Unternehmen-Informationen</h3>
            <div class="detail-item">
              <label>Firmenname:</label>
              <span>${this.unternehmen?.firmenname || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.unternehmen?.webseite ? `<a href="${this.unternehmen.webseite}" target="_blank">${this.unternehmen.webseite}</a>` : '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Branche:</label>
              <span>${this.unternehmen?.branche || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Rechnungsadresse:</label>
              <span>${[this.unternehmen?.rechnungsadresse_strasse, this.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(' ') || '-'}</span>
            </div>
            <div class="detail-item">
              <label>PLZ:</label>
              <span>${this.unternehmen?.rechnungsadresse_plz || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Ort:</label>
              <span>${this.unternehmen?.rechnungsadresse_stadt || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Land:</label>
              <span>${this.unternehmen?.rechnungsadresse_land || '-'}</span>
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

    const auftraegeHtml = this.auftraege.map(auftrag => `
      <div class="auftrag-card">
        <div class="auftrag-header">
          <h4>${auftrag.auftragsname || 'Unbekannter Auftrag'}</h4>
          <span class="auftrag-status status-${auftrag.status?.toLowerCase() || 'unknown'}">
            ${auftrag.status || 'Unbekannt'}
          </span>
        </div>
        <div class="auftrag-details">
          <p><strong>Typ:</strong> ${auftrag.auftragtype || '-'}</p>
          <p><strong>Budget:</strong> ${auftrag.gesamt_budget ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(auftrag.gesamt_budget) : '-'}</p>
          <p><strong>Start:</strong> ${auftrag.start ? new Date(auftrag.start).toLocaleDateString('de-DE') : '-'}</p>
          <p><strong>Ende:</strong> ${auftrag.ende ? new Date(auftrag.ende).toLocaleDateString('de-DE') : '-'}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="auftraege-container">
        ${auftraegeHtml}
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

    const kampagnenHtml = this.kampagnen.map(k => `
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${k.kampagnenname || 'Unbekannte Kampagne'}</h4>
          <span class="kampagne-status status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span>
        </div>
        <div class="kampagne-details">
          <p><strong>Start:</strong> ${k.start ? new Date(k.start).toLocaleDateString('de-DE') : '-'}</p>
          <p><strong>Deadline:</strong> ${k.deadline ? new Date(k.deadline).toLocaleDateString('de-DE') : '-'}</p>
        </div>
      </div>
    `).join('');

    return `<div class="kampagnen-container">${kampagnenHtml}</div>`;
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

    const koopsHtml = this.kooperationen.map(k => `
      <div class="kooperation-card">
        <div class="kooperation-header">
          <h4>${k.name || 'Kooperation'}</h4>
          <span class="kooperation-status status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span>
        </div>
        <div class="kooperation-details">
          <p><strong>Videos:</strong> ${k.videoanzahl || 0}</p>
          <p><strong>Gesamtkosten:</strong> ${k.gesamtkosten ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(k.gesamtkosten) : '-'}</p>
        </div>
      </div>
    `).join('');

    return `<div class="kooperationen-container">${koopsHtml}</div>`;
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

  // Cleanup
  destroy() {
    console.log('UnternehmenDetail: Cleaning up...');
  }
}

export const unternehmenDetail = new UnternehmenDetail();