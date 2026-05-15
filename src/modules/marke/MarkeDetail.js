// MarkeDetail.js (Fassade)
// Dünne Orchestrierungsklasse — delegiert an Loader, Renderer, Events, Edit

import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { loadCriticalData, loadMarkeTabData } from './MarkeDetailLoader.js';
import { renderMarkeDetailPage } from './MarkeDetailRendererCore.js';
import { bindMarkeDetailEvents, setupCacheInvalidation } from './MarkeDetailEvents.js';
import { showEditForm } from './MarkeDetailEdit.js';

export class MarkeDetail extends PersonDetailBase {
  constructor() {
    super();
    this.markeId = null;
    this.marke = null;
    this._cacheAbortController = null;
    this.kampagnen = [];
    this.auftraege = [];
    this.briefings = [];
    this.kooperationen = [];
    this.ansprechpartner = [];
    this.rechnungen = [];
    this.strategien = [];
    this.kickoff = null;
    this.kickoffMarkenwerte = [];
    this.kickoffsByType = { paid: null, organic: null };
    this.kickoffMarkenwerteByType = { paid: [], organic: [] };
    this.activeKickoffType = 'organic';
    this._kickoffLoaded = false;
    this.activeMainTab = 'informationen';

    this._tabAbortControllers = new Map();
    this._currentLoadingTab = null;
    this._eventsBound = false;
  }

  async init(markeId) {
    const canView = window.currentUser?.permissions?.marke?.can_view;
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

    try {
      this.markeId = markeId;
      this.kickoffsByType = { paid: null, organic: null };
      this.kickoffMarkenwerteByType = { paid: [], organic: [] };
      this._kickoffLoaded = false;
      tabDataCache.invalidate('marke', markeId);
      await this.loadCriticalData();

      if (window.breadcrumbSystem && this.marke) {
        const canEdit = window.currentUser?.permissions?.marke?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(this.marke.markenname || 'Details', {
          id: 'btn-edit-marke',
          canEdit: canEdit
        });
      }

      this.render();
      this.bindEvents();
      this.setupCacheInvalidation();

      if (this.activeMainTab && !['informationen', 'ansprechpartner'].includes(this.activeMainTab)) {
        this.loadTabData(this.activeMainTab);
      }
    } catch (error) {
      console.error('Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'MarkeDetail.init');
    }
  }

  async loadCriticalData() {
    return loadCriticalData(this);
  }

  async loadTabData(tabName) {
    return loadMarkeTabData(this, tabName);
  }

  render() {
    renderMarkeDetailPage(this);
  }

  bindEvents() {
    bindMarkeDetailEvents(this);
  }

  setupCacheInvalidation() {
    setupCacheInvalidation(this);
  }

  async showEditForm() {
    return showEditForm(this);
  }

  destroy() {
    this._cacheAbortController?.abort();
    this._cacheAbortController = null;

    this._eventsAbort?.abort();
    this._eventsAbort = null;
    this._eventsBound = false;

    tabDataCache.invalidate('marke', this.markeId);
    window.setContentSafely('');
  }
}

export const markeDetail = new MarkeDetail();
