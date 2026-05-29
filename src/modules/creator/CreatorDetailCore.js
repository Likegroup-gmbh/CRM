// CreatorDetailCore.js
// Kern-Klasse fuer die Creator-Detailseite
// Methoden werden via Prototype-Mixins aus DataLoader, Renderers und Events hinzugefuegt

import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { renderTabButton } from '../../core/TabUtils.js';

export class CreatorDetail extends PersonDetailBase {
  constructor() {
    super();
    this.creatorId = null;
    this.creator = null;
    this.kampagnen = [];
    this.lists = [];
    this.kooperationen = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.unternehmen = [];
    this.creatorAdressen = [];
    this.managements = [];
    this.profileCounts = {
      kooperationen: 0,
      videos: 0
    };
    this.eventsBound = false;
    this._cacheInvalidationBound = false;
    this.activeMainTab = 'informationen';
    this._abortController = null;
    this._destroyed = false;
  }

  async init(creatorId) {
    console.log('🎯 CREATORDETAIL: Initialisiere Creator-Detailseite für ID:', creatorId);
    
    const canView = window.currentUser?.permissions?.creator?.can_view;
    if (canView === false) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    this.creatorId = creatorId;
    
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ CREATORDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      await this.loadCriticalData();
      await this.loadKooperationen();
      await this.loadProfileCounts();
      
      if (window.breadcrumbSystem && this.creator) {
        const creatorName = [this.creator.vorname, this.creator.nachname].filter(Boolean).join(' ') || 'Details';
        const canEdit = window.currentUser?.permissions?.creator?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(creatorName, {
          id: 'btn-edit-creator',
          canEdit: canEdit
        });
      }
      
      await this.render();
      
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      this.setupCacheInvalidation();
      
      console.log('✅ CREATORDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ CREATORDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'CreatorDetail.init');
    }
  }

  async render() {
    if (!this.creator) {
      window.setHeadline('Creator nicht gefunden');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Der angeforderte Creator wurde nicht gefunden.</p>
        </div>
      `;
      return;
    }

    window.setHeadline(`${this.creator.vorname} ${this.creator.nachname}`);

    const creatorName = [this.creator.vorname, this.creator.nachname].filter(Boolean).join(' ') || 'Unbekannt';
    const personConfig = {
      name: creatorName,
      email: this.creator.mail || '',
      subtitle: '',
      avatarUrl: this.creator.profilbild_url,
      lastActivity: this.creator.updated_at,
      avatarOnly: false
    };

    const quickActions = [];
    const sidebarInfo = this.renderSidebarInfo();
    const tabNavigation = this.renderTabNavigation();
    const mainContent = this.renderMainContent();

    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      tabNavigation,
      mainContent
    });

    window.setContentSafely(window.content, html);
  }

  renderSidebarInfo() {
    const sanitizeUrl = (url) => window.validatorSystem?.sanitizeUrl(url);

    const instagramHandle = this.creator.instagram;
    const instagramUrl = instagramHandle
      ? sanitizeUrl(instagramHandle.startsWith('http') ? instagramHandle : `https://instagram.com/${instagramHandle.replace('@', '')}`)
      : null;
    const tiktokHandle = this.creator.tiktok;
    const tiktokUrl = tiktokHandle
      ? sanitizeUrl(tiktokHandle.startsWith('http') ? tiktokHandle : `https://tiktok.com/@${tiktokHandle.replace('@', '')}`)
      : null;

    const kpiItems = [];
    const detailItems = [];
    const kooperationenCount = this.profileCounts?.kooperationen || 0;
    const videosCount = this.profileCounts?.videos || 0;

    kpiItems.push(
      { icon: 'kooperation', label: 'Kooperationen', value: kooperationenCount.toLocaleString('de-DE') },
      { icon: 'video', label: 'Videos', value: videosCount.toLocaleString('de-DE') }
    );

    if (instagramUrl) {
      detailItems.push({ icon: 'instagram', label: 'Instagram', rawHtml: `<a href="${instagramUrl}" target="_blank" rel="noopener noreferrer">@${this.sanitize(instagramHandle.replace('@', ''))}</a>` });
      if (this.creator.instagram_follower) {
        detailItems.push({ icon: 'instagram', label: 'IG Follower', value: this.formatNumber(this.creator.instagram_follower) });
      }
    }
    if (tiktokUrl) {
      detailItems.push({ icon: 'tiktok', label: 'TikTok', rawHtml: `<a href="${tiktokUrl}" target="_blank" rel="noopener noreferrer">@${this.sanitize(tiktokHandle.replace('@', ''))}</a>` });
      if (this.creator.tiktok_follower) {
        detailItems.push({ icon: 'tiktok', label: 'TT Follower', value: this.formatNumber(this.creator.tiktok_follower) });
      }
    }

    detailItems.push(
      { icon: 'mail', label: 'E-Mail', value: this.creator.mail || '-', mailto: true },
      { icon: 'phone', label: 'Telefon', value: this.creator.telefonnummer || '-' },
      { icon: 'city', label: 'Stadt', value: this.creator.lieferadresse_stadt || '-' },
      { icon: 'globe', label: 'Land', value: this.creator.lieferadresse_land || '-' },
    );

    if (this.creator.sprachen && this.creator.sprachen.length > 0) {
      detailItems.push({ icon: 'language', label: 'Sprachen', value: this.creator.sprachen.map(s => s.name), tags: true });
    }
    if (this.creator.branchen && this.creator.branchen.length > 0) {
      detailItems.push({ icon: 'tag', label: 'Branchen', value: this.creator.branchen.map(b => b.name), tags: true });
    }
    if (this.creator.creator_types && this.creator.creator_types.length > 0) {
      const types = this.creator.creator_types.map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
      if (types.length > 0) detailItems.push({ icon: 'user', label: 'Typen', value: types, tags: true });
    }
    if (this.creator.geschlecht) {
      detailItems.push({ icon: 'user', label: 'Geschlecht', value: this.creator.geschlecht });
    }
    if (this.creator.alter_min || this.creator.alter_max || this.creator.alter_jahre) {
      detailItems.push({ icon: 'calendar', label: 'Alter', value: this.formatAgeRange(this.creator.alter_min, this.creator.alter_max, this.creator.alter_jahre) });
    }
    if (this.creator.portfolio_link) {
      detailItems.push({ icon: 'link', label: 'Portfolio', rawHtml: `<a href="${this.creator.portfolio_link}" target="_blank" rel="noopener">Link</a>` });
    }
    if (this.creator.hat_haustier) {
      detailItems.push({ icon: 'info', label: 'Haustier', value: this.creator.haustier_beschreibung || 'Ja' });
    }
    if (this.creator.hat_kinder) {
      detailItems.push({ icon: 'info', label: 'Kinder', value: this.creator.kinder_beschreibung || 'Ja' });
    }
    if (this.creator.budget_letzte_buchung) {
      detailItems.push({ icon: 'currency', label: 'Letztes Budget', value: this.formatCurrency(this.creator.budget_letzte_buchung) });
    }
    detailItems.push({ icon: 'check', label: 'USt-pflichtig', value: this.creator.umsatzsteuerpflichtig ? 'Ja' : 'Nein' });
    detailItems.push({ icon: 'clock', label: 'Erstellt', value: this.formatDate(this.creator.created_at) });

    return `
      <div class="detail-card">
        <h3 class="section-title">Kennzahlen</h3>
        ${this.renderInfoItems(kpiItems)}
      </div>
      <div class="detail-card">
        <h3 class="section-title">Kontakt & Profil</h3>
        ${this.renderInfoItems(detailItems)}
      </div>
    `;
  }

  getTabsConfig() {
    return [
      { tab: 'unternehmen', label: 'Unternehmen', count: this.unternehmen?.length || 0, isActive: this.activeMainTab === 'unternehmen' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.kampagnen?.length || 0, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.kooperationen?.length || 0, isActive: this.activeMainTab === 'kooperationen' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen?.length || 0, isActive: this.activeMainTab === 'rechnungen' },
      { tab: 'vertraege', label: 'Verträge', count: this.vertraege?.length || 0, isActive: this.activeMainTab === 'vertraege' },
      { tab: 'listen', label: 'Listen', count: this.lists?.length || 0, isActive: this.activeMainTab === 'listen' },
      { tab: 'management', label: 'Management', count: this.managements?.length || 0, isActive: this.activeMainTab === 'management' },
      { tab: 'adresse', label: 'Adresse', isActive: this.activeMainTab === 'adresse' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('')}</div></div>`;
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          ${this.renderKampagnenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
          ${this.renderKooperationenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'listen' ? 'active' : ''}" id="tab-listen">
          ${this.renderListenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="tab-unternehmen">
          ${this.renderUnternehmenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
          ${this.renderRechnungenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'vertraege' ? 'active' : ''}" id="tab-vertraege">
          ${this.renderVertraegeContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'management' ? 'active' : ''}" id="tab-management">
          ${this.renderManagementContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'adresse' ? 'active' : ''}" id="tab-adresse">
          ${this.renderAdresseContent()}
        </div>
      </div>
    `;
  }
}
