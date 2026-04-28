// AnsprechpartnerDetail.js (ES6-Modul)
// Detail-Seite für einzelne Ansprechpartner
// Nutzt einheitliches zwei-Spalten-Layout

import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { CountryDisplay } from '../../core/components/CountryDisplay.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { ImageUploadHelper } from '../../core/ImageUploadHelper.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { magicLinkService } from '../auth/MagicLinkService.js';

export class AnsprechpartnerDetail extends PersonDetailBase {
  constructor() {
    super();
    this.ansprechpartner = null;
    this.ansprechpartnerId = null;
    this.kundeVerknuepfung = null; // Verknüpfter Kunde via Magic Link
    this.activeMainTab = 'informationen';
    this.eventsBound = false;
    this._cacheInvalidationBound = false;
    this._abortController = null;
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
      if (window.moduleRegistry?.currentModule !== this) return;

      // Breadcrumb aktualisieren mit Edit-Button
      this.updateBreadcrumb();

      // Debug: Permission-Check für Edit-Button
      const canEdit = window.currentUser?.permissions?.ansprechpartner?.can_edit !== false;
      console.debug('🔐 ANSPRECHPARTNERDETAIL: Permission-Check:', {
        rolle: window.currentUser?.rolle,
        permissions: window.currentUser?.permissions?.ansprechpartner,
        canEdit: canEdit,
        ansprechpartnerId: this.ansprechpartnerId
      });

      await this.loadIndirectKampagnen();
      if (window.moduleRegistry?.currentModule !== this) return;

      await this.render();
      if (window.moduleRegistry?.currentModule !== this) return;

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
        kundeResult
      ] = await parallelLoad([
        // 1. Ansprechpartner mit Relations
        () => window.supabase
          .from('ansprechpartner')
          .select(`
            *,
            unternehmen:unternehmen_id (id, firmenname),
            ansprechpartner_marke (marke:marke_id (id, markenname, logo_url)),
            ansprechpartner_kampagne (kampagne:kampagne_id (id, kampagnenname, eigener_name)),
            ansprechpartner_unternehmen (unternehmen:unternehmen_id (id, firmenname, logo_url)),
            ansprechpartner_sprache (sprache:sprache_id (id, name)),
            telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl),
            land:eu_laender!land_id (id, name_de, iso_code)
          `)
          .eq('id', this.ansprechpartnerId)
          .single(),
        
        // 2. Kunden-Verknüpfung (via Magic Link)
        () => window.supabase
          .from('kunde_ansprechpartner')
          .select('kunde:kunde_id(id, name, email)')
          .eq('ansprechpartner_id', this.ansprechpartnerId)
          .maybeSingle()
      ]);
      
      // Daten verarbeiten
      if (ansprechpartnerResult.error) {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden:', ansprechpartnerResult.error);
        this.showError('Ansprechpartner konnte nicht geladen werden.');
        return;
      }
      
      this.ansprechpartner = ansprechpartnerResult.data;

      // Sprachen aus Junction-Tabelle in flaches Array mappen
      if (this.ansprechpartner?.ansprechpartner_sprache) {
        this.ansprechpartner.sprachen = this.ansprechpartner.ansprechpartner_sprache
          .map(s => s.sprache)
          .filter(Boolean);
      }

      this.kundeVerknuepfung = kundeResult?.data?.kunde || null;
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ ANSPRECHPARTNERDETAIL: Kritische Daten geladen in ${loadTime}ms`, {
        kundeVerknuepfung: this.kundeVerknuepfung ? this.kundeVerknuepfung.name : 'keine'
      });
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:', error);
      this.showError('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Lade Kampagnen, die indirekt über Unternehmen/Marken-Zugehörigkeit erreichbar sind
  async loadIndirectKampagnen() {
    try {
      const unternehmenIds = (this.ansprechpartner?.ansprechpartner_unternehmen || [])
        .map(u => u.unternehmen?.id).filter(Boolean);
      const markenIds = (this.ansprechpartner?.ansprechpartner_marke || [])
        .map(m => m.marke?.id).filter(Boolean);

      if (unternehmenIds.length === 0 && markenIds.length === 0) {
        this.indirectKampagnen = [];
        return;
      }

      const queries = [];

      if (unternehmenIds.length > 0) {
        queries.push(
          window.supabase
            .from('kampagne')
            .select('id, kampagnenname, eigener_name, unternehmen_id, marke_id')
            .in('unternehmen_id', unternehmenIds)
        );
      }

      if (markenIds.length > 0) {
        queries.push(
          window.supabase
            .from('kampagne')
            .select('id, kampagnenname, eigener_name, unternehmen_id, marke_id')
            .in('marke_id', markenIds)
        );
      }

      const results = await Promise.all(queries);
      const allKampagnen = results.flatMap(r => r.data || []);

      // Deduplizieren per ID
      const seen = new Set();
      this.indirectKampagnen = allKampagnen.filter(k => {
        if (seen.has(k.id)) return false;
        seen.add(k.id);
        return true;
      });
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden indirekter Kampagnen:', error);
      this.indirectKampagnen = [];
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
      
      window.breadcrumbSystem.updateDetailLabel(name, {
        id: 'btn-edit-ansprechpartner',
        canEdit: canEdit
      });
    }
  }

  // Setup Cache-Invalidierung bei Updates - nur einmal binden
  setupCacheInvalidation() {
    if (this._cacheInvalidationBound) return;
    this._cacheInvalidationBound = true;
    
    const signal = this._abortController?.signal;
    
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'ansprechpartner' && e.detail?.id === this.ansprechpartnerId) {
        console.log('🔄 ANSPRECHPARTNERDETAIL: Entity updated - lade neu');
        this.loadCriticalData().then(() => {
          this.loadIndirectKampagnen().then(() => {
            this.render();
            this.updateBreadcrumb();
          });
        });
      }
    }, signal ? { signal } : undefined);
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
      subtitle: '',
      avatarUrl: this.ansprechpartner?.profile_image_url,
      avatarOnly: false
    };

    // Quick Actions - keine mehr in der Sidebar (Magic Link ist jetzt im Tab-Header)
    const quickActions = [];

    // Kunden-Verknüpfung ganz oben, oder Magic-Link-Button wenn keine besteht
    const canEdit = window.permissionSystem?.checkPermission('ansprechpartner', 'edit') !== false;
    let kundeItem;
    if (this.kundeVerknuepfung) {
      const kundeLink = `<a href="/admin/kunden/${this.kundeVerknuepfung.id}" onclick="event.preventDefault(); window.navigateTo('/admin/kunden/${this.kundeVerknuepfung.id}')" class="table-link" style="font-weight: 500;">${this.sanitize(this.kundeVerknuepfung.name || this.kundeVerknuepfung.email || 'Unbekannt')}</a>`;
      kundeItem = { icon: 'user', label: 'Verknüpfter Kunde', rawHtml: kundeLink };
    } else {
      const btnHtml = `<button class="btn-inline-action" data-action="generate-magic-link" ${!canEdit ? 'disabled' : ''}>Kunden einladen</button>`;
      kundeItem = { icon: 'user', label: 'Kunden-Verknüpfung', rawHtml: btnHtml };
    }

    // Info-Items für Sidebar
    const sidebarInfoItems = this.renderInfoItems([
      kundeItem,
      { icon: 'position', label: 'Position', value: this.ansprechpartner?.position || '-' },
      { icon: 'building', label: 'Unternehmen', value: this.ansprechpartner?.unternehmen?.firmenname || '-' },
      { icon: 'city', label: 'Stadt', value: this.ansprechpartner?.stadt || '-' },
      { icon: 'globe', label: 'Land', rawHtml: this.ansprechpartner?.land ? CountryDisplay.render(this.ansprechpartner.land.iso_code, this.ansprechpartner.land.name_de) : '-' },
      { icon: 'language', label: 'Sprache', value: this.getSprachenDisplay() },
      { icon: 'calendar', label: 'Geburtsdatum', value: this.ansprechpartner?.geburtsdatum ? this.formatDate(this.ansprechpartner.geburtsdatum) : '-' },
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.ansprechpartner?.created_at) }
    ]);

    const sidebarInfo = sidebarInfoItems + this.renderInformationen();

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
      tabNavigation,
      
      sidebarHeader: 'Information'
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
      return '<span class="status-badge success">✓</span>';
    }
    return '<span class="status-badge danger">✗</span>';
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
      { tab: 'unternehmen', label: 'Unternehmen', count: this.ansprechpartner?.ansprechpartner_unternehmen?.length || 0, isActive: this.activeMainTab === 'unternehmen' },
      { tab: 'marken', label: 'Marken', count: this.ansprechpartner?.ansprechpartner_marke?.length || 0, isActive: this.activeMainTab === 'marken' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.ansprechpartner?.ansprechpartner_kampagne?.length || 0, isActive: this.activeMainTab === 'kampagnen' },
    ];

    const tabsHtml = tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('');

    return `
      <div class="tabs-header-container" style="--tab-count: ${tabs.length}">
        <div class="tabs-left">
          ${tabsHtml}
        </div>
      </div>
    `;
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="tab-unternehmen">
          ${this.renderUnternehmen()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'marken' ? 'active' : ''}" id="tab-marken">
          ${this.renderMarken()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          ${this.renderKampagnen()}
        </div>
      </div>
    `;
  }

  // Rendere Informationen-Tab
  renderInformationen() {
    const kontaktItems = [
      { icon: 'phone', label: 'Telefon (Mobil)', rawHtml: PhoneDisplay.renderClickable(
        this.ansprechpartner?.telefonnummer_land?.iso_code,
        this.ansprechpartner?.telefonnummer_land?.vorwahl,
        this.ansprechpartner?.telefonnummer
      ) || '-' },
      { icon: 'phone', label: 'Telefon (Büro)', rawHtml: PhoneDisplay.renderClickable(
        this.ansprechpartner?.telefonnummer_office_land?.iso_code,
        this.ansprechpartner?.telefonnummer_office_land?.vorwahl,
        this.ansprechpartner?.telefonnummer_office
      ) || '-' },
      { icon: 'mail', label: 'E-Mail', value: this.ansprechpartner?.email || '-', mailto: true },
      { icon: 'link', label: 'LinkedIn', rawHtml: this.renderLinkedInLink(this.ansprechpartner?.linkedin) },
      { icon: 'tag', label: 'Newsletter (1x/Monat)', rawHtml: this.renderEinwilligungBadge(this.ansprechpartner?.erlaubt_newsletter) },
    ].filter(Boolean);

    let html = this.renderInfoItems(kontaktItems);

    if (this.ansprechpartner?.notiz) {
      html += this.renderInfoItems([
        { icon: 'info', label: 'Interne Notiz', value: this.ansprechpartner.notiz }
      ]);
    }

    return html;
  }

  // Rendere Unternehmen-Tab
  renderUnternehmen() {
    if (!this.ansprechpartner?.ansprechpartner_unternehmen || this.ansprechpartner.ansprechpartner_unternehmen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Unternehmen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Unternehmen zugeordnet.</p>
        </div>
      `;
    }

    const items = this.ansprechpartner.ansprechpartner_unternehmen.map(item => {
      const u = item.unternehmen;
      const logoHtml = u.logo_url
        ? `<img src="${u.logo_url}" class="table-logo" width="24" height="24" alt="" />`
        : `<span class="table-avatar">${(u.firmenname || '?')[0].toUpperCase()}</span>`;
      return `
        <a href="#" class="entity-list-item" data-table="unternehmen" data-id="${u.id}">
          ${logoHtml}
          <span class="entity-list-name">${this.sanitize(u.firmenname || 'Unbekannt')}</span>
        </a>
      `;
    }).join('');

    return `<div class="entity-list">${items}</div>`;
  }

  // Rendere Marken-Tab
  renderMarken() {
    if (!this.ansprechpartner?.ansprechpartner_marke || this.ansprechpartner.ansprechpartner_marke.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Marken zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Marken zugeordnet.</p>
        </div>
      `;
    }

    const items = this.ansprechpartner.ansprechpartner_marke.map(item => {
      const m = item.marke;
      const logoHtml = m.logo_url
        ? `<img src="${m.logo_url}" class="table-logo" width="24" height="24" alt="" />`
        : `<span class="table-avatar">${(m.markenname || '?')[0].toUpperCase()}</span>`;
      return `
        <a href="#" class="entity-list-item" data-table="marke" data-id="${m.id}">
          ${logoHtml}
          <span class="entity-list-name">${this.sanitize(m.markenname || 'Unbekannt')}</span>
        </a>
      `;
    }).join('');

    return `<div class="entity-list">${items}</div>`;
  }

  // Rendere Kampagnen-Tab (explizit zugeordnete + indirekt über Unternehmen/Marke)
  renderKampagnen() {
    const explicitIds = new Set();
    const explicitKampagnen = (this.ansprechpartner?.ansprechpartner_kampagne || [])
      .map(item => item.kampagne)
      .filter(Boolean);
    explicitKampagnen.forEach(k => explicitIds.add(k.id));

    // Unternehmen/Marken-Lookup für Herkunft-Badge
    const unternehmenMap = new Map();
    (this.ansprechpartner?.ansprechpartner_unternehmen || []).forEach(u => {
      if (u.unternehmen) unternehmenMap.set(u.unternehmen.id, u.unternehmen.firmenname);
    });
    const markenMap = new Map();
    (this.ansprechpartner?.ansprechpartner_marke || []).forEach(m => {
      if (m.marke) markenMap.set(m.marke.id, m.marke.markenname);
    });

    const indirectOnly = (this.indirectKampagnen || [])
      .filter(k => !explicitIds.has(k.id));

    if (explicitKampagnen.length === 0 && indirectOnly.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `;
    }

    const renderZuordnungTag = (label) => `<span class="tag tag--branche">${this.sanitize(label)}</span>`;

    const renderRow = (kampagne, source) => `
      <tr>
        <td>
          <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
            ${KampagneUtils.getDisplayName(kampagne)}
          </a>
        </td>
        <td>${source}</td>
      </tr>
    `;

    const rows = [];

    explicitKampagnen.forEach(k => {
      rows.push(renderRow(k, renderZuordnungTag('Direkt zugeordnet')));
    });

    indirectOnly.forEach(k => {
      const sources = [];
      if (k.unternehmen_id && unternehmenMap.has(k.unternehmen_id)) {
        sources.push(renderZuordnungTag(`via ${unternehmenMap.get(k.unternehmen_id)}`));
      }
      if (k.marke_id && markenMap.has(k.marke_id)) {
        sources.push(renderZuordnungTag(`via ${markenMap.get(k.marke_id)}`));
      }
      rows.push(renderRow(k, sources.join(' ') || renderZuordnungTag('via Unternehmen/Marke')));
    });

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Zuordnung</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    `;
  }

  // Events für Detail-Ansicht binden (benannte Handler für sauberes Cleanup in destroy())
  bindEvents() {
    if (this.eventsBound) return;

    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    this._onDocumentClick = (e) => {
      const btn = e.target.closest('.tab-button');
      if (btn) {
        e.preventDefault();
        const tab = btn.dataset.tab;
        if (tab) {
          this.activeMainTab = tab;
          document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          const pane = document.getElementById(`tab-${tab}`);
          if (pane) pane.classList.add('active');
        }
        return;
      }
      if (e.target.id === 'btn-back' || e.target.closest('#btn-back') || e.target.id === 'btn-back-error' || e.target.closest('#btn-back-error')) {
        e.preventDefault();
        window.navigateTo('/ansprechpartner');
        return;
      }
      if (e.target.classList.contains('table-link')) {
        e.preventDefault();
        const table = e.target.dataset.table;
        const id = e.target.dataset.id;
        if (table && id) window.navigateTo(`/${table}/${id}`);
        return;
      }
      const actionBtn = e.target.closest('[data-action="generate-magic-link"]');
      if (actionBtn && !actionBtn.classList.contains('disabled') && !actionBtn.disabled) {
        e.preventDefault();
        this.showMagicLinkModal();
      }
    };
    document.addEventListener('click', this._onDocumentClick, { signal });

    this._onSoftRefresh = async () => {
      if (!this.ansprechpartnerId || !location.pathname.startsWith('/ansprechpartner/')) return;
      if (document.querySelector('form.edit-form, .drawer.show, .modal.show')) {
        console.log('⏸️ ANSPRECHPARTNERDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      console.log('🔄 ANSPRECHPARTNERDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadCriticalData();
      this.render();
    };
    window.addEventListener('softRefresh', this._onSoftRefresh, { signal });

    this.eventsBound = true;
  }

  // Magic Link Modal anzeigen (Link wird erst beim Kopieren generiert!)
  showMagicLinkModal() {
    console.log('🔗 ANSPRECHPARTNERDETAIL: Zeige Magic Link Modal für:', this.ansprechpartnerId);
    
    // Prüfe Berechtigung
    const canEdit = window.permissionSystem?.checkPermission('ansprechpartner', 'edit') !== false;
    if (!canEdit) {
      window.toastSystem?.show('Keine Berechtigung für diese Aktion', 'error');
      return;
    }

    const modalId = 'magic-link-modal';
    const fullName = `${this.ansprechpartner?.vorname || ''} ${this.ansprechpartner?.nachname || ''}`.trim();
    
    // Bestätigungs-Modal (Link wird noch NICHT generiert)
    const confirmHtml = `
      <div id="${modalId}" class="modal show">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content modal-sm">
          <div class="modal-header">
            <h3>Kunden einladen</h3>
            <button class="modal-close" data-close-modal>&times;</button>
          </div>
          <div class="modal-body">
            <div class="info-card">
              <span class="info-card-label">Einladung für</span>
              <span class="info-card-value">${this.sanitize(fullName || 'Ansprechpartner')}</span>
            </div>
            
            <p class="modal-description">
              Du kannst einen einmaligen Einladungs-Link erstellen, mit dem sich dieser Ansprechpartner als Kunde registrieren kann.
            </p>
            
            <div class="notice-box notice-info">
              <strong>Wichtig:</strong>
              Der Countdown für die Gültigkeit des Links startet erst, wenn du auf "Link erstellen & kopieren" klickst. 
              Der Link ist dann <strong>48 Stunden</strong> gültig und kann <strong>nur einmal</strong> verwendet werden.
            </div>
            
            <div id="magic-link-result" class="magic-link-result">
              <div class="form-group">
                <label class="form-label">Registrierungs-Link</label>
                <input type="text" id="magic-link-input" class="input input-mono" readonly />
              </div>
              <div id="magic-link-expiry" class="notice-box notice-warning"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="secondary-btn" data-close-modal>Abbrechen</button>
            <button id="create-magic-link" class="primary-btn">
              Link erstellen & kopieren
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', confirmHtml);
    
    // "Link erstellen & kopieren" Handler
    document.getElementById('create-magic-link')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-small"></span> Wird erstellt...';
      
      try {
        // JETZT wird der Link generiert (Countdown startet)
        const result = await magicLinkService.createMagicLink(this.ansprechpartnerId);
        
        if (!result.success) {
          window.toastSystem?.show(result.error || 'Fehler beim Erstellen des Links', 'error');
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }
        
        // Link in Zwischenablage kopieren
        try {
          await navigator.clipboard.writeText(result.link);
          window.toastSystem?.show('Link erstellt und in Zwischenablage kopiert!', 'success');
        } catch (err) {
          // Fallback
          const input = document.getElementById('magic-link-input');
          if (input) {
            input.value = result.link;
            input.select();
            document.execCommand('copy');
          }
          window.toastSystem?.show('Link erstellt und kopiert!', 'success');
        }
        
        // Ergebnis anzeigen
        const resultDiv = document.getElementById('magic-link-result');
        const linkInput = document.getElementById('magic-link-input');
        const expiryDiv = document.getElementById('magic-link-expiry');
        
        if (resultDiv && linkInput && expiryDiv) {
          linkInput.value = result.link;
          
          const expiresDate = new Date(result.expiresAt).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          expiryDiv.innerHTML = `<strong>Gültig bis:</strong> ${expiresDate} (einmalig verwendbar)`;
          
          resultDiv.classList.add('show');
        }
        
        // Button ändern zu "Erneut kopieren"
        btn.disabled = false;
        btn.textContent = 'Erneut kopieren';
        btn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(result.link);
            window.toastSystem?.show('Link erneut kopiert!', 'success');
          } catch (err) {
            linkInput?.select();
            document.execCommand('copy');
            window.toastSystem?.show('Link kopiert!', 'success');
          }
        };
        
        console.log('✅ ANSPRECHPARTNERDETAIL: Magic Link erstellt und kopiert');
        
      } catch (error) {
        console.error('❌ ANSPRECHPARTNERDETAIL: Fehler beim Generieren des Magic Links:', error);
        window.toastSystem?.show('Fehler beim Erstellen des Links', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
    
    // Modal schließen Handler
    document.querySelectorAll(`#${modalId} [data-close-modal]`).forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById(modalId)?.remove();
      });
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
    console.debug('🎯 ANSPRECHPARTNERDETAIL: showEditForm() aufgerufen', {
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
      // Land (für Country-Field im Edit-Modus)
      formData.land_id = this.ansprechpartner?.land_id || this.ansprechpartner?.land?.id || null;
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

  // Fehler anzeigen (bindEvents aufrufen, damit btn-back-error vom gemeinsamen Handler bedient wird)
  showError(message) {
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    if (!this.eventsBound) this.bindEvents();

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
  }

  // Cleanup
  destroy() {
    console.log('AnsprechpartnerDetail: Cleaning up...');

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

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
