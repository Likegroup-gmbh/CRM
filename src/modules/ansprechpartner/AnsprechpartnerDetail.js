// AnsprechpartnerDetail.js (ES6-Modul)
// Detail-Seite für einzelne Ansprechpartner

import { FormConfig } from '../../core/form/FormConfig.js';
import { FormRenderer } from '../../core/form/FormRenderer.js';
import { DynamicDataLoader } from '../../core/form/data/DynamicDataLoader.js';
import { FormSystem } from '../../core/form/FormSystem.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';

export class AnsprechpartnerDetail {
  constructor() {
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
    this.formConfig = null;
    this.formRenderer = null;
    this.dataLoader = null;
    this.formSystem = null;
    this.notizen = [];
    this.ratings = [];
  }

  // Initialisiere Detail-Seite
  async init(ansprechpartnerId) {
    this.ansprechpartnerId = ansprechpartnerId;
    console.log('🎯 ANSPRECHPARTNERDETAIL: Initialisiere Detail-Seite für:', ansprechpartnerId);
    
    if (ansprechpartnerId === 'new') {
      // Verwende AnsprechpartnerCreate System (wie bei Marken)
      console.log('🎯 ANSPRECHPARTNERDETAIL: Verwende AnsprechpartnerCreate für neuen Ansprechpartner');
      ansprechpartnerCreate.showCreateForm();
      return;
    } else {
      await this.loadAnsprechpartnerData();
      this.render();
      this.bindEvents();
    }
  }

  // Lade Ansprechpartner-Daten
  async loadAnsprechpartnerData() {
    try {
      console.log('🔄 ANSPRECHPARTNERDETAIL: Lade Ansprechpartner-Daten...');
      
      const { data, error } = await window.supabase
        .from('ansprechpartner')
        .select(`
          *,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          ansprechpartner_marke (
            marke:marke_id (
              id,
              markenname
            )
          ),
          ansprechpartner_kampagne (
            kampagne:kampagne_id (
              id,
              kampagnenname
            )
          )
        `)
        .eq('id', this.ansprechpartnerId)
        .single();

      if (error) {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden:', error);
        this.showError('Ansprechpartner konnte nicht geladen werden.');
        return;
      }

      this.ansprechpartner = data;
      console.log('✅ ANSPRECHPARTNERDETAIL: Ansprechpartner geladen:', this.ansprechpartner);

      // Notizen laden
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('ansprechpartner', this.ansprechpartnerId);
        console.log('✅ ANSPRECHPARTNERDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Bewertungen laden
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('ansprechpartner', this.ansprechpartnerId);
        console.log('✅ ANSPRECHPARTNERDETAIL: Ratings geladen:', this.ratings.length);
      }
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:', error);
      this.showError('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Hauptansicht rendern
  render() {
    if (!this.ansprechpartner) {
      this.showError('Ansprechpartner nicht gefunden.');
      return;
    }

    window.setHeadline(`${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details`);
    
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details</h1>
          <p>Detaillierte Informationen zum Ansprechpartner</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-edit">
            <i class="icon-edit"></i>
            Ansprechpartner bearbeiten
          </button>
          <button class="secondary-btn" id="btn-back">
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
            <span class="tab-count">${this.notizen ? this.notizen.length : 0}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings ? this.ratings.length : 0}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Zugeordnete Marken
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_marke ? this.ansprechpartner.ansprechpartner_marke.length : 0}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Zugeordnete Kampagnen
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_kampagne ? this.ansprechpartner.ansprechpartner_kampagne.length : 0}</span>
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
            ${this.renderBewertungen()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Informationen-Tab
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <!-- Kontaktinformationen -->
          <div class="detail-card">
            <h3>Kontaktinformationen</h3>
            <div class="detail-item">
              <label>Name:</label>
              <span>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</span>
            </div>
            <div class="detail-item">
              <label>Position:</label>
              <span>${this.ansprechpartner.position || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Email:</label>
              <span>${this.ansprechpartner.email ? `<a href="mailto:${this.ansprechpartner.email}">${this.ansprechpartner.email}</a>` : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Mobil):</label>
              <span>${this.ansprechpartner.telefonnummer ? `<a href="tel:${this.ansprechpartner.telefonnummer}">${this.ansprechpartner.telefonnummer}</a>` : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Büro):</label>
              <span>${this.ansprechpartner.telefonnummer_office ? `<a href="tel:${this.ansprechpartner.telefonnummer_office}">${this.ansprechpartner.telefonnummer_office}</a>` : '-'}</span>
            </div>
            <div class="detail-item">
              <label>LinkedIn:</label>
              <span>${this.ansprechpartner.linkedin ? `<a href="${this.ansprechpartner.linkedin}" target="_blank" rel="noopener noreferrer">${this.ansprechpartner.linkedin}</a>` : '-'}</span>
            </div>
          </div>

          <!-- Standort & Sprache -->
          <div class="detail-card">
            <h3>Standort & Sprache</h3>
            <div class="detail-item">
              <label>Stadt:</label>
              <span>${this.ansprechpartner.stadt || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Sprache:</label>
              <span>${(this.ansprechpartner.sprachen && this.ansprechpartner.sprachen.length > 0)
                ? this.ansprechpartner.sprachen.map(s => s.name).join(', ')
                : (this.ansprechpartner.sprache?.name || this.ansprechpartner.sprache || '-')}</span>
            </div>
          </div>

          <!-- Unternehmen -->
          <div class="detail-card">
            <h3>Unternehmen</h3>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>
                ${this.ansprechpartner.unternehmen 
                  ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${this.ansprechpartner.unternehmen.id}">${this.ansprechpartner.unternehmen.firmenname}</a>`
                  : '-'
                }
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.ansprechpartner.created_at ? new Date(this.ansprechpartner.created_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.ansprechpartner.updated_at ? new Date(this.ansprechpartner.updated_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>

          <!-- Notizen (falls vorhanden) -->
          ${this.ansprechpartner.notiz ? `
          <div class="detail-card full-width">
            <h3>Notizen</h3>
            <div class="detail-item">
              <p class="notiz-text">${this.ansprechpartner.notiz}</p>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Rendere Notizen-Tab
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'ansprechpartner', this.ansprechpartnerId);
    }
    return '<p>Notizen-System nicht verfügbar</p>';
  }

  // Rendere Bewertungen-Tab
  renderBewertungen() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'ansprechpartner', this.ansprechpartnerId);
    }
    return '<p>Bewertungs-System nicht verfügbar</p>';
  }

  // Rendere Marken-Tab
  renderMarken() {
    if (!this.ansprechpartner.ansprechpartner_marke || this.ansprechpartner.ansprechpartner_marke.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Marken zugeordnet.</p>
        </div>
      `;
    }

    const markenHtml = this.ansprechpartner.ansprechpartner_marke.map(item => {
      const marke = item.marke;
      return `
        <div class="marke-card">
          <div class="marke-header">
            <h4>
              <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
                ${marke.markenname}
              </a>
            </h4>
          </div>
          <div class="marke-details">
            <p><strong>Unternehmen:</strong> ${marke.unternehmen?.firmenname || '-'}</p>
            <p><strong>Webseite:</strong> ${marke.webseite ? `<a href="${marke.webseite}" target="_blank">${marke.webseite}</a>` : '-'}</p>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="marken-container">
        ${markenHtml}
      </div>
    `;
  }

  // Rendere Kampagnen-Tab
  renderKampagnen() {
    if (!this.ansprechpartner.ansprechpartner_kampagne || this.ansprechpartner.ansprechpartner_kampagne.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `;
    }

    const kampagnenHtml = this.ansprechpartner.ansprechpartner_kampagne.map(item => {
      const kampagne = item.kampagne;
      return `
        <div class="kampagne-card">
          <div class="kampagne-header">
            <h4>
              <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
                ${kampagne.kampagnenname}
              </a>
            </h4>
            <span class="kampagne-status status-${kampagne.status?.toLowerCase() || 'unknown'}">
              ${kampagne.status || 'Unbekannt'}
            </span>
          </div>
          <div class="kampagne-details">
            <p><strong>Beschreibung:</strong> ${kampagne.beschreibung || '-'}</p>
            <p><strong>Start:</strong> ${kampagne.start ? new Date(kampagne.start).toLocaleDateString('de-DE') : '-'}</p>
            <p><strong>Deadline:</strong> ${kampagne.deadline ? new Date(kampagne.deadline).toLocaleDateString('de-DE') : '-'}</p>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="kampagnen-container">
        ${kampagnenHtml}
      </div>
    `;
  }

  // Legacy-Methoden für Rückwärtskompatibilität
  renderMarkenList() {
    if (!this.ansprechpartner.ansprechpartner_marke || this.ansprechpartner.ansprechpartner_marke.length === 0) {
      return '<p class="empty-state">Keine Marken zugeordnet.</p>';
    }

    const markenHtml = this.ansprechpartner.ansprechpartner_marke.map(item => {
      const marke = item.marke;
      return `
        <div class="tag-item">
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${marke.markenname}
          </a>
        </div>
      `;
    }).join('');

    return `<div class="tag-list">${markenHtml}</div>`;
  }

  // Render Kampagnen-Liste
  renderKampagnenList() {
    if (!this.ansprechpartner.ansprechpartner_kampagne || this.ansprechpartner.ansprechpartner_kampagne.length === 0) {
      return '<p class="empty-state">Keine Kampagnen zugeordnet.</p>';
    }

    const kampagnenHtml = this.ansprechpartner.ansprechpartner_kampagne.map(item => {
      const kampagne = item.kampagne;
      return `
        <div class="tag-item">
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${kampagne.kampagnenname}
          </a>
        </div>
      `;
    }).join('');

    return `<div class="tag-list">${kampagnenHtml}</div>`;
  }

  // Events für Detail-Ansicht binden
  bindEvents() {
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      }
    });

    // Zurück Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-back' || e.target.closest('#btn-back')) {
        e.preventDefault();
        window.navigateTo('/ansprechpartner');
      }
    });

    // Bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit' || e.target.closest('#btn-edit')) {
        e.preventDefault();
        window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}/edit`);
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

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadAnsprechpartnerData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadAnsprechpartnerData().then(() => {
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

  // Erstellen-Formular rendern
  async renderCreateForm() {
    window.setHeadline('Neuen Ansprechpartner anlegen');
    
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    // Lade FormConfig
    const formConfigInstance = new FormConfig();
    this.formConfig = formConfigInstance.getFormConfig('ansprechpartner');
    
    if (!this.formConfig) {
      console.error('❌ Keine FormConfig für ansprechpartner gefunden');
      this.showError('Formular-Konfiguration nicht gefunden.');
      return;
    }

    // Erstelle FormSystem Instanz (enthält bereits FormRenderer und DynamicDataLoader)
    this.formSystem = new FormSystem();
    this.formRenderer = this.formSystem.renderer;

    console.log('🎯 ANSPRECHPARTNERDETAIL: Rendere Formular...');

    // Basis HTML ohne Header-Buttons
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.formConfig.title}</h1>
          <p>Erfasse die Daten für einen neuen Ansprechpartner</p>
        </div>
      </div>

      <div class="form-container">
        <div id="form-content">Lade Formular...</div>
      </div>
    `;

    try {
      // Rendere das komplette Formular (FormRenderer fügt bereits Buttons hinzu)
      const formHtml = this.formRenderer.renderFormOnly('ansprechpartner');
      document.getElementById('form-content').innerHTML = formHtml;
      
      // Korrigiere die Button-Klassen für besseres Styling
      const cancelBtn = document.querySelector('#ansprechpartner-form .btn-secondary');
      const submitBtn = document.querySelector('#ansprechpartner-form .btn-primary');
      
      if (cancelBtn) {
        cancelBtn.className = 'secondary-btn';
        cancelBtn.id = 'btn-cancel-form';
      }
      if (submitBtn) {
        submitBtn.className = 'action-btn';
        submitBtn.textContent = 'Ansprechpartner erstellen';
      }

      // Lade dynamische Daten mit FormSystem
      const form = document.getElementById('ansprechpartner-form');
      if (form) {
        await this.formSystem.dataLoader.loadDynamicFormData('ansprechpartner', form);
      }
      
      // Initialisiere Searchable Selects mit FormSystem
      this.initializeSearchableSelects();
      
      // Binde Formular-Events
      this.bindFormSubmitEvents();

      console.log('✅ ANSPRECHPARTNERDETAIL: Formular erfolgreich geladen');

    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden des Formulars:', error);
      document.getElementById('form-content').innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden des Formulars: ${error.message}</p>
        </div>
      `;
    }
  }

  // Events für Formular binden
  bindFormEvents() {
    // Der FormRenderer erstellt bereits einen onclick Handler für Abbrechen
    // Kein zusätzlicher Event-Listener nötig
  }

  // Initialisiere Searchable Selects mit FormSystem
  initializeSearchableSelects() {
    console.log('🎯 ANSPRECHPARTNERDETAIL: Initialisiere Searchable Selects...');
    
    // Verwende die FormSystem initializeSearchableSelects Methode
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      this.formSystem.initializeSearchableSelects(form);
    }

    // Marken-Filterung wird jetzt automatisch über das DependentFields-System gehandhabt
    // this.setupMarkenFiltering(); // Entfernt - wird jetzt durch FormSystem.DependentFields gehandhabt
  }

  // Setup für Marken-Filterung nach Unternehmen
  setupMarkenFiltering() {
    const unternehmenSelect = document.querySelector('select[name="unternehmen_id"]');
    const markenSelect = document.querySelector('select[name="marke_ids"]');
    
    if (unternehmenSelect && markenSelect) {
      console.log('🔗 ANSPRECHPARTNERDETAIL: Setup Marken-Filterung');
      
      // Event-Listener für Unternehmen-Änderung
      unternehmenSelect.addEventListener('change', async (e) => {
        const unternehmenId = e.target.value;
        console.log('🏢 ANSPRECHPARTNERDETAIL: Unternehmen geändert:', unternehmenId);
        
        if (unternehmenId) {
          await this.loadMarkenForUnternehmen(unternehmenId, markenSelect);
        } else {
          // Alle Marken laden wenn kein Unternehmen ausgewählt
          await this.loadAllMarken(markenSelect);
        }
      });
    }
  }

  // Lade Marken für spezifisches Unternehmen
  async loadMarkenForUnternehmen(unternehmenId, markenSelect) {
    try {
      console.log('🔄 ANSPRECHPARTNERDETAIL: Lade Marken für Unternehmen:', unternehmenId);
      
      const { data: marken, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('unternehmen_id', unternehmenId)
        .order('markenname');

      if (!error && marken) {
        console.log('✅ ANSPRECHPARTNERDETAIL: Marken geladen:', marken.length);
        this.updateMarkenOptions(markenSelect, marken);
      } else {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden der Marken:', error);
      }
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler beim Laden der Marken:', error);
    }
  }

  // Lade alle Marken
  async loadAllMarken(markenSelect) {
    try {
      console.log('🔄 ANSPRECHPARTNERDETAIL: Lade alle Marken');
      
      const { data: marken, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .order('markenname');

      if (!error && marken) {
        console.log('✅ ANSPRECHPARTNERDETAIL: Alle Marken geladen:', marken.length);
        this.updateMarkenOptions(markenSelect, marken);
      }
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden aller Marken:', error);
    }
  }

  // Update Marken-Optionen
  updateMarkenOptions(markenSelect, marken) {
    // Leere vorhandene Optionen (außer Placeholder)
    while (markenSelect.options.length > 1) {
      markenSelect.removeChild(markenSelect.lastChild);
    }

    // Neue Optionen hinzufügen
    marken.forEach(marke => {
      const option = document.createElement('option');
      option.value = marke.id;
      option.textContent = marke.markenname;
      markenSelect.appendChild(option);
    });

    // Searchable Select neu initialisieren wenn vorhanden
    const wrapper = markenSelect.parentNode.querySelector('.searchable-select-container');
    if (wrapper) {
      wrapper.remove();
      markenSelect.style.display = '';
      
      // Verwende FormSystem zum Neuerstellen
      const options = marken.map(marke => ({
        value: marke.id,
        label: marke.markenname
      }));
      
      this.formSystem.createSearchableSelect(markenSelect, options, {
        placeholder: 'Marken suchen und auswählen...'
      });
    }

    console.log('✅ ANSPRECHPARTNERDETAIL: Marken-Optionen aktualisiert');
  }



  // Formular-Submit Events binden
  bindFormSubmitEvents() {
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('📤 ANSPRECHPARTNERDETAIL: Formular wird abgesendet...');
        
        const formData = new FormData(form);
        const data = {};
        
        // Sammle alle Daten
        for (const [key, value] of formData.entries()) {
          if (value && value.trim() !== '') {
            data[key] = value.trim();
          }
        }

        // Sammle auch Multiselect-Daten (marke_ids)
        const markeSelect = form.querySelector('select[name="marke_ids"]');
        if (markeSelect && markeSelect.multiple) {
          const selectedOptions = Array.from(markeSelect.selectedOptions);
          if (selectedOptions.length > 0) {
            data.marke_ids = selectedOptions.map(option => option.value);
          }
        }

        console.log('📊 ANSPRECHPARTNERDETAIL: Gesammelte Daten:', data);
        
        try {
          await this.handleFormSubmit(data);
        } catch (error) {
          console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Submit:', error);
          alert('Fehler beim Speichern: ' + error.message);
        }
      });
    } else {
      console.warn('⚠️ ANSPRECHPARTNERDETAIL: Formular nicht gefunden');
    }
  }

  // Formular-Submit verarbeiten
  async handleFormSubmit(data) {
    try {
      console.log('📤 ANSPRECHPARTNERDETAIL: Sende Daten:', data);

      // Trenne Marken-IDs von den Hauptdaten
      const markeIds = data.marke_ids || [];
      const ansprechpartnerData = { ...data };
      delete ansprechpartnerData.marke_ids;

      // Bereinige leere UUID-Felder (konvertiere zu null für bessere DB-Kompatibilität)
      if (!ansprechpartnerData.sprache_id) {
        delete ansprechpartnerData.sprache_id;
      }
      if (!ansprechpartnerData.unternehmen_id) {
        delete ansprechpartnerData.unternehmen_id;
      }
      if (!ansprechpartnerData.position_id) {
        delete ansprechpartnerData.position_id;
      }

      // Erstelle Ansprechpartner
      const { data: result, error } = await window.supabase
        .from('ansprechpartner')
        .insert([ansprechpartnerData])
        .select()
        .single();

      if (error) {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Speichern:', error);
        throw new Error('Fehler beim Speichern: ' + error.message);
      }

      console.log('✅ ANSPRECHPARTNERDETAIL: Ansprechpartner erfolgreich erstellt:', result);

      // Marken-Zuordnungen erstellen, falls vorhanden
      if (markeIds.length > 0) {
        const markenZuordnungen = markeIds.map(markeId => ({
          ansprechpartner_id: result.id,
          marke_id: markeId
        }));

        const { error: markenError } = await window.supabase
          .from('ansprechpartner_marke')
          .insert(markenZuordnungen);

        if (markenError) {
          console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Zuordnen der Marken:', markenError);
          // Trotzdem weitermachen, da der Ansprechpartner erstellt wurde
        } else {
          console.log('✅ ANSPRECHPARTNERDETAIL: Marken-Zuordnungen erstellt:', markenZuordnungen);
        }
      }

      // Event auslösen
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'ansprechpartner', action: 'created', id: result.id }
      }));

      // Zur Detail-Seite navigieren
      window.navigateTo(`/ansprechpartner/${result.id}`);

    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:', error);
      throw error; // FormSystem wird den Fehler behandeln
    }
  }

  // Fehler anzeigen
  showError(message) {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h1>Fehler</h1>
        </div>
        <div class="page-actions">
          <button class="secondary-btn" id="btn-back-error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Zurück zur Liste
          </button>
        </div>
      </div>
      <div class="error-message">
        <p>${message}</p>
      </div>
    `;

    // Event für Zurück-Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-back-error' || e.target.closest('#btn-back-error')) {
        e.preventDefault();
        window.navigateTo('/ansprechpartner');
      }
    });
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 ANSPRECHPARTNERDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Ansprechpartner bearbeiten');
    
    // Edit-Form Daten vorbereiten (inkl. Flags und M:N Arrays)
    const formData = { ...this.ansprechpartner };
    try {
      formData._isEditMode = true;
      formData._entityId = this.ansprechpartnerId;
      // Unternehmen direkt als ID befüllen (Renderer nutzt value)
      formData.unternehmen_id = this.ansprechpartner?.unternehmen_id || this.ansprechpartner?.unternehmen?.id || null;
      // Position (einfache FK)
      formData.position_id = this.ansprechpartner?.position_id || null;
    } catch (_) {}
    
    // M:N: marke_ids
    try {
      const marken = (this.ansprechpartner?.ansprechpartner_marke || []).map(m => m?.marke?.id).filter(Boolean);
      if (marken.length > 0) formData.marke_ids = marken;
    } catch (_) {}
    
    // M:N: sprachen_ids (falls separat gepflegt)
    try {
      const sprachen = (this.ansprechpartner?.sprachen || []).map(s => s?.id).filter(Boolean);
      if (sprachen.length > 0) formData.sprachen_ids = sprachen;
    } catch (_) {}
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('ansprechpartner', formData);
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner/${this.ansprechpartnerId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('ansprechpartner', formData);
    
    // Custom Submit Handler für Bearbeitungsformular
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('ansprechpartner-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) submitData[cleanKey] = [];
          submitData[cleanKey].push(value);
        } else if (!submitData.hasOwnProperty(key)) {
          submitData[key] = value;
        }
      }

      // Tag-basierte Multi-Selects korrekt einsammeln (marke_ids, sprachen_ids)
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        // Verstecktes Select suchen (mit [] oder ohne)
        let hidden = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
        if (!hidden) hidden = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        if (hidden) {
          const values = Array.from(hidden.selectedOptions).map(o => o.value).filter(Boolean);
          if (values.length > 0) submitData[select.name] = values;
        }
      });

      console.log('📝 Ansprechpartner Edit Submit-Daten:', submitData);

      // Update Ansprechpartner
      const result = await window.dataService.updateEntity('ansprechpartner', this.ansprechpartnerId, submitData);
      
      if (result.success) {
        this.showSuccessMessage('Ansprechpartner erfolgreich aktualisiert!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'ansprechpartner', action: 'updated', id: this.ansprechpartnerId }
        }));
        
        // Zurück zur Detail-Ansicht
        setTimeout(() => {
          window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}`);
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Aktualisieren: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Ansprechpartners:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Cleanup
  destroy() {
    console.log('AnsprechpartnerDetail: Cleaning up...');
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerDetail = new AnsprechpartnerDetail();