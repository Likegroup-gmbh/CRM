// MarkeDetail.js (Fassade)
// Dünne Orchestrierungsklasse — delegiert an Loader, Renderer, Events, Edit

import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { getTabQueryParam } from '../../core/TabUtils.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { loadCriticalData, loadMarkeTabData } from './MarkeDetailLoader.js';
import { renderMarkeDetailPage } from './MarkeDetailRendererCore.js';
import { bindMarkeDetailEvents, setupCacheInvalidation } from './MarkeDetailEvents.js';
import { showEditForm } from './MarkeDetailEdit.js';
import { bindNotizDokument } from '../../core/components/NotizDokument.js';

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
    this.sourcingListen = [];
    this.personas = [];
    this.produkte = [];
    this.activeMainTab = 'informationen';
    this.strategieDokument = null;
    this._notizDokument = null;

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

      // ?tab=... macht einzelne Tabs deeplink-faehig und laesst die Rueckkehr
      // von Unterseiten (z.B. Persona-Formular) auf dem richtigen Tab landen.
      const tabParam = getTabQueryParam();
      if (tabParam) this.activeMainTab = tabParam;

      tabDataCache.invalidate('marke', markeId);
      await this.loadCriticalData();

      if (window.breadcrumbSystem && this.marke) {
        const canEdit = window.currentUser?.permissions?.marke?.can_edit !== false;
        const breadcrumbOpts = {
          id: 'btn-edit-marke',
          canEdit
        };
        if (!window.isKunde?.()) {
          breadcrumbOpts.actionsHtml = actionBuilder.create('marke', this.markeId, null, {
            onlyActions: ['add_ansprechpartner', 'add_produkt', 'add_persona']
          });
        }
        window.breadcrumbSystem.updateDetailLabel(this.marke.markenname || 'Details', breadcrumbOpts);
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
    this._bindNotizDokument();
  }

  _bindNotizDokument() {
    this._notizDokument?.destroy();
    const root = document.getElementById('notiz-dokument');
    this._notizDokument = root
      ? bindNotizDokument(root, {
          entityType: 'marke',
          entityId: this.markeId
        })
      : null;
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
    this._notizDokument?.destroy();
    this._notizDokument = null;
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
