// UnternehmenDetail.js (ES6-Modul)
// Unternehmen-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Marken und Aufträge
import { renderCreatorTable } from '../creator/CreatorTable.js';

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
            unternehmen:unternehmen_id(firmenname)
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

    const markenHtml = this.marken.map(marke => `
      <div class="marke-card">
        <div class="marke-header">
          <h4>${marke.markenname || 'Unbekannte Marke'}</h4>
        </div>
        <div class="marke-details">
          <p><strong>Webseite:</strong> ${marke.webseite ? `<a href="${marke.webseite}" target="_blank">${marke.webseite}</a>` : '-'}</p>
          <p><strong>Branche:</strong> ${marke.branche || '-'}</p>
          <p><strong>Erstellt am:</strong> ${marke.created_at ? new Date(marke.created_at).toLocaleDateString('de-DE') : '-'}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="marken-container">
        ${markenHtml}
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
    
    const emptyState = !hasAnsprechpartner ? `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
      </div>
    ` : '';

    const addButton = `
      <div class="section-header">
        <h3>Ansprechpartner</h3>
        <button id="btn-add-ansprechpartner-unternehmen" class="primary-btn" data-unternehmen-id="${this.unternehmenId}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          Ansprechpartner hinzufügen
        </button>
      </div>
    `;

    if (!hasAnsprechpartner) {
      return addButton + emptyState;
    }

    const ansprechpartnerHtml = this.ansprechpartner.map(ap => `
      <div class="ansprechpartner-card">
        <div class="ansprechpartner-header">
          <h4>
            <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')" class="ansprechpartner-link">
              ${ap.vorname} ${ap.nachname}
            </a>
          </h4>
          <span class="ansprechpartner-position">${ap.position?.name || '-'}</span>
          <div class="ansprechpartner-actions">
            <button class="btn-remove-ansprechpartner" data-ansprechpartner-id="${ap.id}" data-unternehmen-id="${this.unternehmenId}" title="Ansprechpartner entfernen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="ansprechpartner-details">
          <p><strong>Email:</strong> ${ap.email ? `<a href="mailto:${ap.email}">${ap.email}</a>` : '-'}</p>
          <p><strong>Telefon (privat):</strong> ${ap.telefonnummer ? `<a href="tel:${ap.telefonnummer}">${ap.telefonnummer}</a>` : '-'}</p>
          <p><strong>Telefon (büro):</strong> ${ap.telefonnummer_office ? `<a href="tel:${ap.telefonnummer_office}">${ap.telefonnummer_office}</a>` : '-'}</p>
          <p><strong>Unternehmen:</strong> ${ap.unternehmen?.firmenname || '-'}</p>
          <p><strong>Stadt:</strong> ${ap.stadt || '-'}</p>
        </div>
      </div>
    `).join('');

    return `
      ${addButton}
      <div class="ansprechpartner-container">
        ${ansprechpartnerHtml}
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
      if (e.target.classList.contains('tab-button')) {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      }
    });

    // Unternehmen bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-unternehmen') {
        this.showEditForm();
      }
    });

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadUnternehmenData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadUnternehmenData().then(() => {
        this.render();
        this.bindEvents();
      });
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
    console.log('🎯 UNTERNEHMENDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Unternehmen bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.unternehmen };
    
    // Edit-Mode Flags immer setzen
    formData._isEditMode = true;
    formData._entityId = this.unternehmenId;
    
    // Branchen-Daten für Edit-Modus formatieren
    if (this.unternehmen.branche_id && Array.isArray(this.unternehmen.branche_id)) {
      console.log('🏷️ UNTERNEHMENDETAIL: Formatiere Branchen-Daten für FormSystem:', this.unternehmen.branche_id);
      // Branchen-IDs als Array beibehalten für Multiselect
      formData.branche_id = this.unternehmen.branche_id;
    } else {
      console.log('ℹ️ UNTERNEHMENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus');
      formData.branche_id = [];
    }
    
    console.log('📋 UNTERNEHMENDETAIL: FormData für Rendering:', formData);
    const formHtml = window.formSystem.renderFormOnly('unternehmen', formData);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Unternehmen bearbeiten</h1>
          <p>Bearbeiten Sie die Unternehmen-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen/${this.unternehmenId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden mit formatierten Daten
    window.formSystem.bindFormEvents('unternehmen', formData);
    
    // Entity-ID und Edit-Mode Flags für Form setzen (wichtig für Dynamic Data Loading)
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.dataset.entityId = this.unternehmenId;
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = 'unternehmen';
      console.log('✅ Entity-ID und Edit-Mode für Form gesetzt:', this.unternehmenId);
      
      // Branchen-Daten als Metadaten für DynamicDataLoader verfügbar machen
      if (this.unternehmen.branche_id && Array.isArray(this.unternehmen.branche_id)) {
        form.dataset.existingBranchenIds = JSON.stringify(this.unternehmen.branche_id);
        console.log('📋 Bestehende Branchen-IDs für DynamicDataLoader gesetzt:', this.unternehmen.branche_id);
      }
      
      // Debug: Alle Form-Datasets ausgeben
      console.log('🔍 UNTERNEHMENDETAIL: Form Datasets:', {
        entityId: form.dataset.entityId,
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        existingBranchenIds: form.dataset.existingBranchenIds,
        editModeData: form.dataset.editModeData ? 'Present' : 'Missing'
      });
      
      // Custom Submit Handler
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('unternehmen-form');
      const formData = new FormData(form);
      const submitData = {};

      // Alle Formular-Felder durchgehen (für Multi-Select)
      const allFormData = {};
      for (let [key, value] of formData.entries()) {
        if (allFormData[key]) {
          // Mehrfachwerte zu Array konvertieren
          if (!Array.isArray(allFormData[key])) {
            allFormData[key] = [allFormData[key]];
          }
          allFormData[key].push(value);
        } else {
          allFormData[key] = value;
        }
      }
      
      // Spezielle Behandlung für Tag-basierte Multi-Selects
      // Das versteckte Select wird möglicherweise nicht korrekt von FormData erfasst
      const hiddenBranchenSelect = form.querySelector('select[name="branche_id[]"]');
      if (hiddenBranchenSelect && hiddenBranchenSelect.multiple) {
        const selectedOptions = Array.from(hiddenBranchenSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const branchenIds = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (branchenIds.length > 0) {
            allFormData['branche_id[]'] = branchenIds;
            console.log('🏷️ UNTERNEHMENDETAIL: Verstecktes Branchen-Select manuell verarbeitet:', branchenIds);
          }
        }
      }
      
      // Daten verarbeiten
      for (let [key, value] of Object.entries(allFormData)) {
        submitData[key] = Array.isArray(value) ? value : value;
      }

      // Branchen-IDs für Junction Table beibehalten (nicht zu einzelner UUID konvertieren)
      if (submitData.branche_id && Array.isArray(submitData.branche_id)) {
        console.log('✅ branche_id Array für Junction Table:', submitData.branche_id);
        // Array beibehalten - wird von RelationTables verarbeitet
      }

      // Validierung
      const validation = window.validatorSystem.validateForm(submitData, {
        firmenname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      console.log('📤 Submit-Daten für Update:', submitData);

      // Unternehmen aktualisieren
      const result = await window.dataService.updateEntity('unternehmen', this.unternehmenId, submitData);

      if (result.success) {
        // Junction Table-Verknüpfungen verarbeiten (für branche_id)
        try {
          const { RelationTables } = await import('../../core/form/logic/RelationTables.js');
          const relationTables = new RelationTables();
          await relationTables.handleRelationTables('unternehmen', this.unternehmenId, submitData, form);
          console.log('✅ Junction Table-Verknüpfungen aktualisiert');
        } catch (relationError) {
          console.error('❌ Fehler beim Aktualisieren der Junction Tables:', relationError);
          // Nicht fatal - Hauptentität wurde bereits aktualisiert
        }

        this.showSuccessMessage('Unternehmen erfolgreich aktualisiert!');
        
        // Event für Listen-Update auslösen
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'unternehmen', id: this.unternehmenId, action: 'updated' } 
        }));
        
        // Daten neu laden und zur Detailseite zurückkehren
        setTimeout(async () => {
          await this.loadUnternehmenData();
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

  // Binde Events
  bindEvents() {
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
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

    // Aktiven Tab-Button aktivieren
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Tab-Content anzeigen
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });

    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) {
      activeContent.style.display = 'block';
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