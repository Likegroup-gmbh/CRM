// AnsprechpartnerDetail.js (ES6-Modul)
// Detail-Seite für einzelne Ansprechpartner
// Nutzt einheitliches zwei-Spalten-Layout

import { FormConfig } from '../../core/form/FormConfig.js';
import { FormRenderer } from '../../core/form/FormRenderer.js';
import { DynamicDataLoader } from '../../core/form/data/DynamicDataLoader.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class AnsprechpartnerDetail extends PersonDetailBase {
  constructor() {
    super();
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
    this.formConfig = null;
    this.formRenderer = null;
    this.dataLoader = null;
    this.formSystem = null;
    this.notizen = [];
    this.ratings = [];
    this.activeMainTab = 'informationen';
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
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.ansprechpartner) {
        const name = [this.ansprechpartner.vorname, this.ansprechpartner.nachname].filter(Boolean).join(' ') || 'Details';
        const canEdit = window.currentUser?.permissions?.ansprechpartner?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: true },
          { label: name, url: `/ansprechpartner/${this.ansprechpartnerId}`, clickable: false }
        ], {
          id: 'btn-edit',
          canEdit: canEdit
        });
      }
      
      await this.loadActivities();
      await this.render();
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

  // Lade Aktivitäten für Timeline
  async loadActivities() {
    try {
      // Für Ansprechpartner gibt es keine History-Tabelle, daher leere Aktivitäten
      this.activities = [];
    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
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
  async render() {
    if (!this.ansprechpartner) {
      this.showError('Ansprechpartner nicht gefunden.');
      return;
    }

    const fullName = `${this.ansprechpartner.vorname || ''} ${this.ansprechpartner.nachname || ''}`.trim();
    window.setHeadline(`${fullName} - Details`);

    // Person-Config für die Sidebar (nur Avatar im Header)
    const personConfig = {
      name: fullName || 'Unbekannt',
      email: this.ansprechpartner?.email || '',
      subtitle: this.ansprechpartner?.position || 'Ansprechpartner',
      avatarUrl: this.ansprechpartner?.profile_image_url,
      avatarOnly: true
    };

    // Quick Actions (keine im Header für Ansprechpartner)
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { label: 'Position', value: this.ansprechpartner?.position || '-' },
      { label: 'Unternehmen', value: this.ansprechpartner?.unternehmen?.firmenname || '-' },
      { label: 'Stadt', value: this.ansprechpartner?.stadt || '-' },
      { label: 'Sprache', value: this.getSprachenDisplay() },
      { label: 'Geburtsdatum', value: this.ansprechpartner?.geburtsdatum ? this.formatDate(this.ansprechpartner.geburtsdatum) : '-' },
      { label: 'Erstellt', value: this.formatDate(this.ansprechpartner?.created_at) }
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

  getSprachenDisplay() {
    if (this.ansprechpartner?.sprachen && this.ansprechpartner.sprachen.length > 0) {
      return this.ansprechpartner.sprachen.map(s => s.name).join(', ');
    }
    return this.ansprechpartner?.sprache?.name || this.ansprechpartner?.sprache || '-';
  }

  renderTabNavigation() {
    const tabs = [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' },
      { tab: 'unternehmen', label: 'Unternehmen', count: this.ansprechpartner?.ansprechpartner_unternehmen?.length || 0, isActive: this.activeMainTab === 'unternehmen' },
      { tab: 'marken', label: 'Marken', count: this.ansprechpartner?.ansprechpartner_marke?.length || 0, isActive: this.activeMainTab === 'marken' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.ansprechpartner?.ansprechpartner_kampagne?.length || 0, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'notizen', label: 'Notizen', count: this.notizen?.length || 0, isActive: this.activeMainTab === 'notizen' },
      { tab: 'bewertungen', label: 'Bewertungen', count: this.ratings?.length || 0, isActive: this.activeMainTab === 'bewertungen' }
    ];

    return tabs.map(t => renderTabButton(t)).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'informationen' ? 'active' : ''}" id="tab-informationen">
          ${this.renderInformationen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="tab-unternehmen">
          ${this.renderUnternehmen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'marken' ? 'active' : ''}" id="tab-marken">
          ${this.renderMarken()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          ${this.renderKampagnen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'notizen' ? 'active' : ''}" id="tab-notizen">
          ${this.renderNotizen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'bewertungen' ? 'active' : ''}" id="tab-bewertungen">
          ${this.renderBewertungen()}
        </div>
      </div>
    `;
  }

  // Rendere Informationen-Tab
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kontakt</th>
                <th style="text-align: right;">Wert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Telefon (Mobil)</strong></td>
                <td style="text-align: right;">${PhoneDisplay.renderClickable(
                  this.ansprechpartner?.telefonnummer_land?.iso_code,
                  this.ansprechpartner?.telefonnummer_land?.vorwahl,
                  this.ansprechpartner?.telefonnummer
                )}</td>
              </tr>
              <tr>
                <td><strong>Telefon (Büro)</strong></td>
                <td style="text-align: right;">${PhoneDisplay.renderClickable(
                  this.ansprechpartner?.telefonnummer_office_land?.iso_code,
                  this.ansprechpartner?.telefonnummer_office_land?.vorwahl,
                  this.ansprechpartner?.telefonnummer_office
                )}</td>
              </tr>
              <tr>
                <td><strong>E-Mail</strong></td>
                <td style="text-align: right;">${this.ansprechpartner?.email ? `<a href="mailto:${this.ansprechpartner.email}">${this.ansprechpartner.email}</a>` : '-'}</td>
              </tr>
              <tr>
                <td><strong>LinkedIn</strong></td>
                <td style="text-align: right;">${this.ansprechpartner?.linkedin ? `<a href="${this.ansprechpartner.linkedin}" target="_blank" rel="noopener noreferrer">Profil öffnen</a>` : '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      ${this.ansprechpartner?.notiz ? `
      <div class="detail-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Interne Notiz</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${this.sanitize(this.ansprechpartner.notiz)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
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
    if (!this.ansprechpartner?.ansprechpartner_unternehmen || this.ansprechpartner.ansprechpartner_unternehmen.length === 0) {
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
    if (!this.ansprechpartner?.ansprechpartner_marke || this.ansprechpartner.ansprechpartner_marke.length === 0) {
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
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Marke</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rendere Kampagnen-Tab
  renderKampagnen() {
    if (!this.ansprechpartner?.ansprechpartner_kampagne || this.ansprechpartner.ansprechpartner_kampagne.length === 0) {
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
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Events für Detail-Ansicht binden
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
      this.loadCriticalData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadCriticalData().then(() => {
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
      await this.loadCriticalData();
      this.render();
      this.bindEvents();
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

  // Cleanup
  destroy() {
    console.log('AnsprechpartnerDetail: Cleaning up...');
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerDetail = new AnsprechpartnerDetail();
