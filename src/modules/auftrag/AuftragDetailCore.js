// AuftragDetailCore.js
// Kern-Klasse der Auftrags-Detailseite: State, Lifecycle, Events, Storno/Reaktivierung
// Weitere Methoden werden via Prototype-Mixins aus DataLoader, Renderer, Finanzen und Produktion angehaengt

import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { activateSecondaryNavTab, getSecondaryNavTabFromEvent, getTabQueryParam } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class AuftragDetail extends PersonDetailBase {
  constructor() {
    super();
    this.auftragId = null;
    this.auftrag = null;
    this.creator = [];
    this.marke = null;
    this.unternehmen = null;
    this.rechnungen = [];
    this.rechnungSummary = { count: 0, sumNetto: 0, sumBrutto: 0, paidCount: 0, openCount: 0 };
    this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
    this.auftragsDetails = null;
    this.realVideoCount = 0;
    this.realCreatorCount = 0;
    this.usedBudget = 0;
    this.usedVideoCount = 0;
    this.targetVideoCount = 0;
    this.targetCreatorCount = 0;
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.activeMainTab = 'uebersicht';
    this._eventsBound = false;
    this._isLoading = false;

    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this._handleEntityUpdated = this._handleEntityUpdated.bind(this);
    this._handleSoftRefresh = this._handleSoftRefresh.bind(this);
  }

  // Initialisiere Auftrags-Detailseite
  async init(auftragId) {
    console.log('🎯 AUFTRAGDETAIL: Initialisiere Auftrags-Detailseite für ID:', auftragId);
    
    try {
      this.auftragId = auftragId;
      this.activeMainTab = getTabQueryParam() || 'uebersicht';
      this._finanzenLoaded = false;
      tabDataCache.invalidate('auftrag', auftragId);
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.auftrag) {
        const canEdit = window.canEdit?.('auftrag') ?? false;
        window.breadcrumbSystem.updateDetailLabel(this.auftrag.auftragsname || 'Details', {
          id: 'btn-edit-auftrag',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ AUFTRAGDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragDetail.init');
    }
  }

  async _handleDocumentClick(e) {
    const tabName = getSecondaryNavTabFromEvent(e);
    if (tabName) {
      e.preventDefault();
      this.switchTab(tabName);
      return;
    }

    if (e.target.closest('#btn-edit-auftrag')) {
      // Edit laeuft seit dem Projekt-Erstellen-Wizard-Refactor ueber den Wizard,
      // damit Anlegen und Bearbeiten denselben Datenpfad nutzen (z.B. creator_budget
      // wird konsistent neu berechnet wenn der Nettobetrag geaendert wird).
      window.navigateTo(`/projekt-erstellen/edit/${this.auftragId}`);
      return;
    }

    if (e.target.closest('#btn-auftrag-stornieren')) {
      this._handleStornieren();
      return;
    }

    if (e.target.closest('#btn-auftrag-reaktivieren')) {
      this._handleReaktivieren();
      return;
    }

    const link = e.target.closest('.table-link');
    if (link && link.dataset.table && link.dataset.id) {
      e.preventDefault();
      window.navigateTo(`/${link.dataset.table}/${link.dataset.id}`);
    }
  }

  async _refreshDetailView() {
    if (this._isLoading || !this.auftragId) return;
    this._isLoading = true;

    try {
      await this.loadCriticalData();
      this.render();
      await this.loadTabData(this.activeMainTab);
    } finally {
      this._isLoading = false;
    }
  }

  _handleEntityUpdated(e) {
    const entity = e.detail?.entity;
    const isRelevantAuftrag = entity === 'auftrag' && e.detail?.id === this.auftragId;
    const isRelevantDetails = entity === 'auftrag_details' && e.detail?.auftrag_id === this.auftragId;

    if (!isRelevantAuftrag && !isRelevantDetails) return;

    console.log('🔄 AUFTRAGDETAIL: Entity updated - invalidiere Cache');
    tabDataCache.invalidate('auftrag', this.auftragId);
    this._refreshDetailView();
  }

  async _handleSoftRefresh() {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) {
      console.log('⏸️ AUFTRAGDETAIL: Formular aktiv - Soft-Refresh übersprungen');
      return;
    }

    if (!this.auftragId || !location.pathname.includes('/auftrag/')) {
      return;
    }

    console.log('🔄 AUFTRAGDETAIL: Soft-Refresh - lade Daten neu');
    await this._refreshDetailView();
  }

  // Binde Events
  bindEvents() {
    if (this._eventsBound) return;

    document.addEventListener('click', this._handleDocumentClick);
    document.addEventListener('entityUpdated', this._handleEntityUpdated);
    window.addEventListener('softRefresh', this._handleSoftRefresh);

    this._eventsBound = true;
  }

  // Tab wechseln
  switchTab(tabName) {
    this.activeMainTab = tabName;
    activateSecondaryNavTab(tabName);
    this.loadTabData(tabName);
  }

  // Bearbeiten laeuft ausschliesslich ueber den Wizard. Das FormSystem-Formular
  // kannte auftrag_teilrechnung nicht und liess die Rechnungsbetraege stehen.
  showEditForm() {
    window.navigateTo(`/projekt-erstellen/edit/${this.auftragId}`);
  }

  async _handleStornieren() {
    if (!confirm('Auftrag wirklich stornieren? Der Auftrag wird als inaktiv markiert.')) return;
    try {
      const { error } = await window.supabase
        .from('auftrag')
        .update({ status: 'Storniert' })
        .eq('id', this.auftragId);
      if (error) throw error;
      this.auftrag.status = 'Storniert';
      this.render();
      this.bindEvents();
      window.toastSystem?.show('Auftrag wurde storniert', 'success');
    } catch (err) {
      console.error('❌ Stornierung fehlgeschlagen:', err);
      window.toastSystem?.show('Stornierung fehlgeschlagen', 'error');
    }
  }

  async _handleReaktivieren() {
    if (!confirm('Stornierung aufheben und Auftrag wieder aktivieren?')) return;
    try {
      const { error } = await window.supabase
        .from('auftrag')
        .update({ status: 'Beauftragt' })
        .eq('id', this.auftragId);
      if (error) throw error;
      this.auftrag.status = 'Beauftragt';
      this.render();
      this.bindEvents();
      window.toastSystem?.show('Auftrag wurde reaktiviert', 'success');
    } catch (err) {
      console.error('❌ Reaktivierung fehlgeschlagen:', err);
      window.toastSystem?.show('Reaktivierung fehlgeschlagen', 'error');
    }
  }

  // Cleanup
  destroy() {
    console.log('AuftragDetail: Cleaning up...');
    document.removeEventListener('click', this._handleDocumentClick);
    document.removeEventListener('entityUpdated', this._handleEntityUpdated);
    window.removeEventListener('softRefresh', this._handleSoftRefresh);
    this._eventsBound = false;
    tabDataCache.invalidate('auftrag', this.auftragId);
  }
}
