// AnsprechpartnerDetail.js (ES6-Modul)
// Detail-Seite für einzelne Ansprechpartner

import { FormConfig } from '../../core/form/FormConfig.js';
import { FormRenderer } from '../../core/form/FormRenderer.js';
import { DynamicDataLoader } from '../../core/form/data/DynamicDataLoader.js';
import { FormSystem } from '../../core/form/FormSystem.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton } from '../../core/TabUtils.js';

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
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.ansprechpartner) {
        const name = [this.ansprechpartner.vorname, this.ansprechpartner.nachname].filter(Boolean).join(' ') || 'Details';
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: true },
          { label: name, url: `/ansprechpartner/${this.ansprechpartnerId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
      this.setupCacheInvalidation();
    }
  }

  // Lade kritische Daten parallel
  async loadCriticalData() {
    console.log('🔄 ANSPRECHPARTNERDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        ansprechpartnerResult,
        notizenResult,
        ratingsResult
      ] = await parallelLoad([
        // 1. Ansprechpartner mit Relations
        () => window.supabase
          .from('ansprechpartner')
          .select(`
            *,
            unternehmen:unternehmen_id (id, firmenname),
            ansprechpartner_marke (marke:marke_id (id, markenname)),
            ansprechpartner_kampagne (kampagne:kampagne_id (id, kampagnenname)),
            ansprechpartner_unternehmen (unternehmen:unternehmen_id (id, firmenname, logo_url)),
            telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl)
          `)
          .eq('id', this.ansprechpartnerId)
          .single(),
        
        // 2. Notizen
        () => window.notizenSystem ? 
          window.notizenSystem.loadNotizen('ansprechpartner', this.ansprechpartnerId) : 
          Promise.resolve([]),
        
        // 3. Ratings
        () => window.bewertungsSystem ? 
          window.bewertungsSystem.loadBewertungen('ansprechpartner', this.ansprechpartnerId) : 
          Promise.resolve([])
      ]);
      
      // Daten verarbeiten
      if (ansprechpartnerResult.error) {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden:', ansprechpartnerResult.error);
        this.showError('Ansprechpartner konnte nicht geladen werden.');
        return;
      }
      
      this.ansprechpartner = ansprechpartnerResult.data;
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ ANSPRECHPARTNERDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:', error);
      this.showError('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }
  
  // Setup Cache-Invalidierung bei Updates
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.id === this.ansprechpartnerId) {
        console.log('🔄 ANSPRECHPARTNERDETAIL: Entity updated - lade neu');
        this.loadCriticalData().then(() => this.render());
      }
    });
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
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-edit">
            <i class="icon-edit"></i>
            Ansprechpartner bearbeiten
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          ${renderTabButton({ tab: 'informationen', label: 'Informationen', isActive: true })}
          ${renderTabButton({ tab: 'unternehmen', label: 'Unternehmen', count: this.ansprechpartner.ansprechpartner_unternehmen ? this.ansprechpartner.ansprechpartner_unternehmen.length : 0 })}
          ${renderTabButton({ tab: 'marken', label: 'Marken', count: this.ansprechpartner.ansprechpartner_marke ? this.ansprechpartner.ansprechpartner_marke.length : 0 })}
          ${renderTabButton({ tab: 'kampagnen', label: 'Kampagnen', count: this.ansprechpartner.ansprechpartner_kampagne ? this.ansprechpartner.ansprechpartner_kampagne.length : 0 })}
          ${renderTabButton({ tab: 'notizen', label: 'Notizen', count: this.notizen ? this.notizen.length : 0 })}
          ${renderTabButton({ tab: 'bewertungen', label: 'Bewertungen', count: this.ratings ? this.ratings.length : 0 })}
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Unternehmen Tab -->
          <div class="tab-pane" id="unternehmen">
            ${this.renderUnternehmen()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderBewertungen()}
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Informationen-Tab
  renderInformationen() {
    // Profilbild HTML generieren
    const profileImageHtml = this.ansprechpartner?.profile_image_url ? `
      <div class="detail-card profile-image-card">
        <h3>Profilbild</h3>
        <div class="profile-image-container">
          <img src="${this.ansprechpartner.profile_image_url}" alt="${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}" class="profile-image-large" />
        </div>
      </div>
    ` : '';

    return `
      <div class="detail-section">
        <div class="detail-grid">
          ${profileImageHtml}
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
              <span>${PhoneDisplay.renderClickable(
                this.ansprechpartner.telefonnummer_land?.iso_code,
                this.ansprechpartner.telefonnummer_land?.vorwahl,
                this.ansprechpartner.telefonnummer
              )}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Büro):</label>
              <span>${PhoneDisplay.renderClickable(
                this.ansprechpartner.telefonnummer_office_land?.iso_code,
                this.ansprechpartner.telefonnummer_office_land?.vorwahl,
                this.ansprechpartner.telefonnummer_office
              )}</span>
            </div>
            <div class="detail-item">
              <label>LinkedIn:</label>
              <span>${this.ansprechpartner.linkedin ? `<a href="${this.ansprechpartner.linkedin}" target="_blank" rel="noopener noreferrer">${this.ansprechpartner.linkedin}</a>` : '-'}</span>
            </div>
            ${this.ansprechpartner.geburtsdatum ? `
            <div class="detail-item">
              <label>Geburtsdatum:</label>
              <span style="display: flex; align-items: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Zm-3 0a.375.375 0 1 1-.53 0L9 2.845l.265.265Zm6 0a.375.375 0 1 1-.53 0L15 2.845l.265.265Z" />
                </svg>
                ${new Date(this.ansprechpartner.geburtsdatum).toLocaleDateString('de-DE')}
              </span>
            </div>
            ` : ''}
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

  // Rendere Unternehmen-Tab
  renderUnternehmen() {
    if (!this.ansprechpartner.ansprechpartner_unternehmen || this.ansprechpartner.ansprechpartner_unternehmen.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <h3>Keine Unternehmen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Unternehmen zugeordnet.</p>
        </div>
      `;
    }

    const rows = this.ansprechpartner.ansprechpartner_unternehmen.map(item => {
      const unternehmen = item.unternehmen;
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="unternehmen" data-id="${unternehmen.id}">
              ${unternehmen.firmenname || 'Unbekanntes Unternehmen'}
            </a>
          </td>
          <td>${unternehmen.logo_url ? `<img src="${unternehmen.logo_url}" alt="${unternehmen.firmenname}" style="max-width: 50px; max-height: 50px;">` : '-'}</td>
          <td>${item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
              <th>Logo</th>
              <th>Zugeordnet am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
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

    const rows = this.ansprechpartner.ansprechpartner_marke.map(item => {
      const marke = item.marke;
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
              ${marke.markenname || 'Unbekannte Marke'}
            </a>
          </td>
          <td>${marke.unternehmen?.firmenname ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${marke.unternehmen.id}">${marke.unternehmen.firmenname}</a>` : '-'}</td>
          <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" rel="noopener">${marke.webseite}</a>` : '-'}</td>
          <td>${marke.created_at ? new Date(marke.created_at).toLocaleDateString('de-DE') : '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Marke</th>
              <th>Unternehmen</th>
              <th>Webseite</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
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

    const rows = this.ansprechpartner.ansprechpartner_kampagne.map(item => {
      const kampagne = item.kampagne;
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${kampagne.kampagnenname || 'Unbekannte Kampagne'}
            </a>
          </td>
          <td>${kampagne.unternehmen?.firmenname ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${kampagne.unternehmen.id}">${kampagne.unternehmen.firmenname}</a>` : '-'}</td>
          <td>${kampagne.start ? new Date(kampagne.start).toLocaleDateString('de-DE') : '-'}</td>
          <td>${kampagne.deadline ? new Date(kampagne.deadline).toLocaleDateString('de-DE') : '-'}</td>
          <td>${kampagne.status || '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
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

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ ANSPRECHPARTNERDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      if (!this.ansprechpartnerId || !location.pathname.includes('/ansprechpartner/')) {
        return;
      }
      console.log('🔄 ANSPRECHPARTNERDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadAnsprechpartnerData();
      this.render();
      this.bindEvents();
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
        
        // ENTFERNT: Submit wird jetzt vom FormSystem übernommen
        console.log('⚠️ ANSPRECHPARTNERDETAIL: Submit wird jetzt vom FormSystem übernommen');
      });
    } else {
      console.warn('⚠️ ANSPRECHPARTNERDETAIL: Formular nicht gefunden');
    }
  }

  // ENTFERNT: Formular-Submit wird jetzt vom FormSystem übernommen
  // Diese Methode wird nicht mehr verwendet - das FormSystem.handleFormSubmit() übernimmt
  async handleFormSubmit(data) {
    console.log('⚠️ ANSPRECHPARTNERDETAIL: handleFormSubmit wird nicht mehr verwendet - FormSystem übernimmt');
    throw new Error('Diese Methode wird nicht mehr verwendet');
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
      // Telefonnummer-Länder (für Phone-Fields im Edit-Modus)
      formData.telefonnummer_land_id = this.ansprechpartner?.telefonnummer_land_id || this.ansprechpartner?.telefonnummer_land?.id || null;
      formData.telefonnummer_office_land_id = this.ansprechpartner?.telefonnummer_office_land_id || this.ansprechpartner?.telefonnummer_office_land?.id || null;
      console.log('📱 ANSPRECHPARTNERDETAIL: Telefonnummer-Länder:', {
        mobil: formData.telefonnummer_land_id,
        buero: formData.telefonnummer_office_land_id
      });
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
    
    // Aktuelles Profilbild anzeigen wenn vorhanden
    const currentProfileImageHtml = this.ansprechpartner?.profile_image_url ? `
      <div class="form-logo-display">
        <label class="form-logo-label">Aktuelles Profilbild:</label>
        <img src="${this.ansprechpartner.profile_image_url}" alt="${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}" class="form-logo-image" />
      </div>
    ` : '';
    
    window.content.innerHTML = `
      <div class="form-page">
        ${currentProfileImageHtml}
        ${formHtml}
        <div id="profile-image-preview-container" class="form-logo-preview" style="display: none;">
          <label class="form-logo-label">Neues Profilbild Vorschau:</label>
          <img id="profile-image-preview-image" class="form-logo-image" alt="Profilbild Vorschau" />
        </div>
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('ansprechpartner', formData);
    
    // Profilbild-Preview Setup
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      this.setupProfileImagePreview(form);
    }
    
    console.log('✅ ANSPRECHPARTNERDETAIL: Edit-Form mit Profilbild-Upload initialisiert');
  }

  // Setup Profilbild Preview für Upload
  setupProfileImagePreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="profile_image_file"]');
    if (!uploaderRoot) return;

    // Event für File-Input (falls vorhanden)
    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('profile-image-preview-container');
            const previewImage = document.getElementById('profile-image-preview-image');
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

  // Profilbild-Upload
  async uploadProfileImage(ansprechpartnerId, form) {
    try {
      console.log('📋 uploadProfileImage() aufgerufen für Ansprechpartner:', ansprechpartnerId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="profile_image_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Profilbild zum Hochladen (kein Uploader/keine Files)');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Profilbild-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Bild erlaubt
      const bucket = 'ansprechpartner-images';
      
      // Security: Max 500 KB
      const MAX_FILE_SIZE = 500 * 1024; // 500 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Profilbild zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Profilbild ist zu groß (max. 500 KB)`);
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
      const path = `${ansprechpartnerId}/profile.${ext}`;
      
      console.log(`📤 Uploading Profilbild: ${file.name} -> ${path}`);
      
      // Altes Bild löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(ansprechpartnerId);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`${ansprechpartnerId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Profilbilder:', deleteErr);
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
        console.error(`❌ Profilbild-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL erstellen
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const profile_image_url = publicUrlData?.publicUrl || '';
      
      // Profilbild-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('ansprechpartner')
        .update({
          profile_image_url,
          profile_image_path: path
        })
        .eq('id', ansprechpartnerId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Profilbild-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Profilbild erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Profilbild-Upload:', error);
      alert(`⚠️ Profilbild konnte nicht hochgeladen werden: ${error.message}`);
      // Nicht werfen - Ansprechpartner wurde bereits aktualisiert
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
        // Profilbild-Upload (falls vorhanden)
        try {
          console.log('🔵 START: Profilbild-Upload für Ansprechpartner', this.ansprechpartnerId);
          await this.uploadProfileImage(this.ansprechpartnerId, form);
        } catch (uploadError) {
          console.error('⚠️ Profilbild-Upload fehlgeschlagen:', uploadError);
          // Upload-Fehler blockiert nicht den Update-Erfolg
        }
        
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