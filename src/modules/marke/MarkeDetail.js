// MarkeDetail.js (ES6-Modul)
// Marken-Detailseite mit Tabs für Informationen, Notizen, Bewertungen, Kampagnen und Aufträge

import { TableHelper } from '../../core/TableHelper.js';

export class MarkeDetail {
  constructor() {
    this.markeId = null;
    this.marke = null;
    this.notizen = [];
    this.ratings = [];
    this.kampagnen = [];
    this.auftraege = [];
    this.ansprechpartner = [];
    this.rechnungen = [];
  }

  // Initialisiere Marken-Detailseite
  async init(markeId) {
    console.log('🎯 MARKENDETAIL: Initialisiere Marken-Detailseite für ID:', markeId);
    
    try {
      this.markeId = markeId;
      await this.loadMarkeData();
      this.render();
      this.bindEvents();
      console.log('✅ MARKENDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ MARKENDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'MarkeDetail.init');
    }
  }

  // Lade Marken-Daten
  async loadMarkeData() {
    console.log('🔄 MARKENDETAIL: Lade Marken-Daten...');
    
    try {
      // Marken-Basisdaten laden
      const { data: marke, error } = await window.supabase
        .from('marke')
        .select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          branche:branche_id(name)
        `)
        .eq('id', this.markeId)
        .single();

      if (error) throw error;
      
      this.marke = marke;
      console.log('✅ MARKENDETAIL: Marken-Basisdaten geladen:', this.marke);

      // Branchen aus Junction Table laden
      try {
        const { data: branchenData, error: branchenError } = await window.supabase
          .from('marke_branchen')
          .select(`
            branche_id,
            branche:branche_id(name)
          `)
          .eq('marke_id', this.markeId);
        
        if (!branchenError && branchenData && branchenData.length > 0) {
          this.marke.branchen = branchenData.map(item => item.branche);
          console.log('✅ MARKENDETAIL: Branchen aus Junction Table geladen:', this.marke.branchen);
        } else {
          this.marke.branchen = [];
          console.log('ℹ️ MARKENDETAIL: Keine Branchen in Junction Table gefunden');
        }
      } catch (branchenError) {
        console.warn('⚠️ MARKENDETAIL: Fehler beim Laden der Branchen:', branchenError);
        this.marke.branchen = [];
      }

      // Notizen laden
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('marke', this.markeId);
        console.log('✅ MARKENDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Bewertungen laden
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('marke', this.markeId);
        console.log('✅ MARKENDETAIL: Ratings geladen:', this.ratings.length);
      }

      // Kampagnen laden (die mit dieser Marke verknüpft sind)
      const { data: kampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('*')
        .eq('marke_id', this.markeId);

      if (!kampagnenError) {
        this.kampagnen = kampagnen || [];
        console.log('✅ MARKENDETAIL: Kampagnen geladen:', this.kampagnen.length);
      }

      // Aufträge laden (die mit dieser Marke verknüpft sind)
      const { data: auftraege, error: auftraegeError } = await window.supabase
        .from('auftrag')
        .select('*')
        .eq('marke_id', this.markeId);

      if (!auftraegeError) {
        this.auftraege = auftraege || [];
        console.log('✅ MARKENDETAIL: Aufträge geladen:', this.auftraege.length);
      }

      // Rechnungen über Aufträge (falls rechnung.auftrag_id gesetzt ist)
      try {
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
      } catch (_) {
        this.rechnungen = [];
      }

      // Ansprechpartner laden
      const { data: ansprechpartner, error: ansprechpartnerError } = await window.supabase
        .from('ansprechpartner_marke')
        .select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner(*)
        `)
        .eq('marke_id', this.markeId);

      if (!ansprechpartnerError) {
        this.ansprechpartner = ansprechpartner?.map(item => item.ansprechpartner) || [];
        console.log('✅ MARKENDETAIL: Ansprechpartner geladen:', this.ansprechpartner.length);
      }

    } catch (error) {
      console.error('❌ MARKENDETAIL: Fehler beim Laden der Marken-Daten:', error);
      throw error;
    }
  }

  // Rendere Marken-Detailseite
  render() {
    window.setHeadline(`${this.marke?.markenname || 'Marke'} - Details`);
    
    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.marke?.markenname || 'Marke'} - Details</h1>
          <p>Detaillierte Informationen zur Marke</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-marke" class="secondary-btn">
            <i class="icon-edit"></i>
            Marke bearbeiten
          </button>
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">
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
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
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

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>
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
            <h3>Marken-Informationen</h3>
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

    const kampagnenHtml = this.kampagnen.map(kampagne => `
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${kampagne.kampagnenname || 'Unbekannte Kampagne'}</h4>
          <span class="kampagne-status status-${kampagne.status?.toLowerCase() || 'unknown'}">
            ${kampagne.status || 'Unbekannt'}
          </span>
        </div>
        <div class="kampagne-details">
          <p><strong>Beschreibung:</strong> ${kampagne.beschreibung || '-'}</p>
          <p><strong>Budget:</strong> ${kampagne.budget ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(kampagne.budget) : '-'}</p>
          <p><strong>Start:</strong> ${kampagne.start ? new Date(kampagne.start).toLocaleDateString('de-DE') : '-'}</p>
          <p><strong>Ende:</strong> ${kampagne.ende ? new Date(kampagne.ende).toLocaleDateString('de-DE') : '-'}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="kampagnen-container">
        ${kampagnenHtml}
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

    const header = `
      <div class="section-header">
        <h3>Ansprechpartner</h3>
      </div>
    `;

    if (!hasAnsprechpartner) {
      return header + emptyState;
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
        <td>${ap.telefonnummer ? `<a href="tel:${ap.telefonnummer}">${ap.telefonnummer}</a>` : '-'}</td>
        <td>${ap.telefonnummer_office ? `<a href="tel:${ap.telefonnummer_office}">${ap.telefonnummer_office}</a>` : '-'}</td>
        <td>${ap.unternehmen?.firmenname || '-'}</td>
        <td>${ap.stadt || '-'}</td>
      </tr>
    `).join('');

    return `
      ${header}
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
        formData.branche_ids = branchenIds;
      } else {
        console.log('ℹ️ MARKENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus');
        formData.branche_ids = [];
      }
    } catch (branchenError) {
      console.warn('⚠️ MARKENDETAIL: Fehler beim Laden der Branchen-Daten:', branchenError);
      formData.branche_ids = [];
    }
    
    console.log('📋 MARKENDETAIL: FormData für Rendering:', formData);
    
    const formHtml = window.formSystem.renderFormOnly('marke', formData);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marke bearbeiten</h1>
          <p>Bearbeiten Sie die Marken-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke/${this.markeId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
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

  // Cleanup
  destroy() {
    console.log('MarkeDetail: Cleaning up...');
  }
}

export const markeDetail = new MarkeDetail(); 