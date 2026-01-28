// AnsprechpartnerDetail.js (ES6-Modul)
// Detail-Seite für einzelne Ansprechpartner
// Nutzt einheitliches zwei-Spalten-Layout

import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { ImageUploadHelper } from '../../core/ImageUploadHelper.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class AnsprechpartnerDetail extends PersonDetailBase {
  constructor() {
    super();
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
    this.notizen = [];
    this.ratings = [];
    this.activeMainTab = 'informationen';
    this.eventsBound = false;
    this._cacheInvalidationBound = false;
    this._breadcrumbEditHandler = null;
    this._breadcrumbEditHandlerBound = false;
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
      this.updateBreadcrumb();
      
      // Debug: Permission-Check für Edit-Button
      const canEdit = window.currentUser?.permissions?.ansprechpartner?.can_edit !== false;
      console.log('🔐 ANSPRECHPARTNERDETAIL: Permission-Check:', {
        rolle: window.currentUser?.rolle,
        permissions: window.currentUser?.permissions?.ansprechpartner,
        canEdit: canEdit,
        ansprechpartnerId: this.ansprechpartnerId
      });
      
      await this.loadActivities();
      await this.render();
      
      // Events nur einmal binden
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      // Breadcrumb Edit Handler - nur einmal binden (wie ProfileDetailV2)
      this.bindBreadcrumbEditHandler();
      
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
            ansprechpartner_kampagne (kampagne:kampagne_id (id, kampagnenname, eigener_name)),
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
  
  // Breadcrumb aktualisieren (wiederverwendbar)
  updateBreadcrumb() {
    console.log('🔄 ANSPRECHPARTNERDETAIL: updateBreadcrumb() aufgerufen', {
      hasBreadcrumbSystem: !!window.breadcrumbSystem,
      hasAnsprechpartner: !!this.ansprechpartner
    });
    
    if (window.breadcrumbSystem && this.ansprechpartner) {
      const name = [this.ansprechpartner.vorname, this.ansprechpartner.nachname].filter(Boolean).join(' ') || 'Details';
      const canEdit = window.currentUser?.permissions?.ansprechpartner?.can_edit !== false;
      
      console.log('🔄 ANSPRECHPARTNERDETAIL: Breadcrumb wird gesetzt', { name, canEdit, id: this.ansprechpartnerId });
      
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: true },
        { label: name, url: `/ansprechpartner/${this.ansprechpartnerId}`, clickable: false }
      ], {
        id: 'btn-edit-ansprechpartner',
        canEdit: canEdit
      });
    }
  }

  // Setup Cache-Invalidierung bei Updates - nur einmal binden
  setupCacheInvalidation() {
    if (this._cacheInvalidationBound) return;
    this._cacheInvalidationBound = true;
    
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.id === this.ansprechpartnerId) {
        console.log('🔄 ANSPRECHPARTNERDETAIL: Entity updated - lade neu');
        this.loadCriticalData().then(() => {
          this.render();
          // WICHTIG: Breadcrumb auch nach Update aktualisieren!
          this.updateBreadcrumb();
        });
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
      { label: 'Land', value: this.ansprechpartner?.land || '-' },
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

  // Rendert Badge für Marketing-Einwilligung
  renderEinwilligungBadge(erlaubt) {
    if (erlaubt) {
      return '<span class="status-badge success">✓ Erlaubt</span>';
    }
    return '<span class="status-badge inactive">Nicht erlaubt</span>';
  }

  // Sichere Render-Methode für LinkedIn-URLs (XSS-Schutz)
  renderLinkedInLink(url) {
    if (!url) return '-';
    
    try {
      const parsed = new URL(url);
      
      // Nur http/https URLs erlauben (blockiert javascript:, data:, etc.)
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return '-';
      }
      
      // URL sanitisieren
      const safeUrl = this.sanitize(url);
      
      // LinkedIn-Domain prüfen für besseres Labeling
      const isLinkedIn = parsed.hostname.includes('linkedin.com');
      const linkText = isLinkedIn ? 'Profil öffnen' : 'Link öffnen';
      
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    } catch {
      // Ungültige URL
      return '-';
    }
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
                <td style="text-align: right;">${this.renderLinkedInLink(this.ansprechpartner?.linkedin)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="detail-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Marketing-Einwilligung</th>
                <th style="text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Updates zu unserem Unternehmen</strong></td>
                <td style="text-align: right;">${this.renderEinwilligungBadge(this.ansprechpartner?.erlaubt_updates)}</td>
              </tr>
              <tr>
                <td><strong>Newsletter (1x/Monat)</strong></td>
                <td style="text-align: right;">${this.renderEinwilligungBadge(this.ansprechpartner?.erlaubt_newsletter)}</td>
              </tr>
              <tr>
                <td><strong>Webinar-Einladungen</strong></td>
                <td style="text-align: right;">${this.renderEinwilligungBadge(this.ansprechpartner?.erlaubt_webinare)}</td>
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
              ${KampagneUtils.getDisplayName(kampagne)}
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

    // Bearbeiten Button - wird jetzt über bindBreadcrumbEditHandler() gebunden

    // Navigation zu verknüpften Entitäten
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link')) {
        e.preventDefault();
        const table = e.target.dataset.table;
        const id = e.target.dataset.id;
        window.navigateTo(`/${table}/${id}`);
      }
    });

    // Notizen Events - NUR für diesen Ansprechpartner reagieren!
    document.addEventListener('notizenUpdated', (e) => {
      // Ignoriere Events für andere Entitäten
      if (e.detail?.entityType !== 'ansprechpartner' || e.detail?.entityId !== this.ansprechpartnerId) {
        return;
      }
      this.loadCriticalData().then(() => {
        this.render();
      });
    });

    // Bewertungen Events - NUR für diesen Ansprechpartner reagieren!
    document.addEventListener('bewertungenUpdated', (e) => {
      // Ignoriere Events für andere Entitäten
      if (e.detail?.entityType !== 'ansprechpartner' || e.detail?.entityId !== this.ansprechpartnerId) {
        return;
      }
      this.loadCriticalData().then(() => {
        this.render();
      });
    });

    // Soft-Refresh bei Realtime-Updates - NUR wenn auf Ansprechpartner-Detail-Seite!
    window.addEventListener('softRefresh', async (e) => {
      // Prüfe ob wir überhaupt auf einer Ansprechpartner-Detail-Seite sind
      if (!this.ansprechpartnerId) return;
      if (!location.pathname.startsWith('/ansprechpartner/')) return;
      
      // Prüfe ob Formular aktiv ist
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ ANSPRECHPARTNERDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      console.log('🔄 ANSPRECHPARTNERDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadCriticalData();
      this.render();
    });
  }

  // Breadcrumb Edit Handler binden (wie ProfileDetailV2 - sauberes Cleanup)
  bindBreadcrumbEditHandler() {
    // Alten Handler entfernen falls vorhanden
    if (this._breadcrumbEditHandler) {
      window.removeEventListener('breadcrumbEditClick', this._breadcrumbEditHandler);
      console.log('🗑️ ANSPRECHPARTNERDETAIL: Alter Breadcrumb Edit Handler entfernt');
    }
    
    // Neuen Handler erstellen und binden
    this._breadcrumbEditHandler = (e) => {
      console.log('📩 ANSPRECHPARTNERDETAIL: breadcrumbEditClick Event empfangen', e.detail);
      if (e.detail?.buttonId === 'btn-edit-ansprechpartner') {
        console.log('✅ ANSPRECHPARTNERDETAIL: Button-ID stimmt, rufe showEditForm() auf');
        this.showEditForm();
      } else {
        console.log('⏭️ ANSPRECHPARTNERDETAIL: Button-ID stimmt nicht, ignoriere Event');
      }
    };
    window.addEventListener('breadcrumbEditClick', this._breadcrumbEditHandler);
    this._breadcrumbEditHandlerBound = true;
    console.log('✅ ANSPRECHPARTNERDETAIL: Breadcrumb Edit Handler gebunden');
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    const canEdit = window.currentUser?.permissions?.ansprechpartner?.can_edit !== false;
    console.log('🎯 ANSPRECHPARTNERDETAIL: showEditForm() aufgerufen', {
      canEdit,
      rolle: window.currentUser?.rolle,
      permissions: window.currentUser?.permissions?.ansprechpartner,
      ansprechpartnerId: this.ansprechpartnerId,
      ansprechpartner: this.ansprechpartner?.vorname + ' ' + this.ansprechpartner?.nachname
    });
    
    if (!canEdit) {
      console.warn('⛔ ANSPRECHPARTNERDETAIL: Keine Berechtigung zum Bearbeiten!');
      window.toast?.show('Keine Berechtigung zum Bearbeiten', 'error');
      return;
    }
    
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
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Telefonnummer-Länder:', err?.message);
    }
    
    // M:N: marke_ids
    try {
      const marken = (this.ansprechpartner?.ansprechpartner_marke || []).map(m => m?.marke?.id).filter(Boolean);
      if (marken.length > 0) formData.marke_ids = marken;
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Marken-IDs:', err?.message);
    }
    
    // M:N: sprachen_ids (falls separat gepflegt)
    try {
      const sprachen = (this.ansprechpartner?.sprachen || []).map(s => s?.id).filter(Boolean);
      if (sprachen.length > 0) formData.sprachen_ids = sprachen;
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Sprachen-IDs:', err?.message);
    }
    
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

  // Profilbild-Upload - delegiert an ImageUploadHelper
  async uploadProfileImage(ansprechpartnerId, form) {
    return ImageUploadHelper.uploadProfileImage(ansprechpartnerId, form);
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
    
    // Breadcrumb Edit Handler entfernen
    if (this._breadcrumbEditHandler) {
      window.removeEventListener('breadcrumbEditClick', this._breadcrumbEditHandler);
      this._breadcrumbEditHandler = null;
      this._breadcrumbEditHandlerBound = false;
    }
    
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
    this.eventsBound = false;
    this._cacheInvalidationBound = false;
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerDetail = new AnsprechpartnerDetail();
