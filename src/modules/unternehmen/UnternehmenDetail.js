// UnternehmenDetail.js (Fassade)
// Dünne Orchestrierungsklasse – delegiert an Loader, Renderer, Events und Edit-Module

import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { loadUnternehmenData } from './UnternehmenDetailLoader.js';
import { renderUnternehmenDetailPage } from './UnternehmenDetailRendererCore.js';
import { bindUnternehmenDetailEvents, bindUnternehmenDetailDragScroll } from './UnternehmenDetailEvents.js';
import { showEditForm, removeAnsprechpartner, getBranchenNamen, uploadLogo, saveUnternehmenBranchen } from './UnternehmenDetailEdit.js';
import { UnternehmenService } from './services/UnternehmenService.js';

export class UnternehmenDetail extends PersonDetailBase {
  constructor() {
    super();
    this.unternehmenId = null;
    this.unternehmen = null;
    this.marken = [];
    this.auftraege = [];
    this.auftragsdetails = [];
    this.ansprechpartner = [];
    this.kampagnen = [];
    this.briefings = [];
    this.kooperationen = [];
    this.creators = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.strategien = [];
    this.creatorAuswahlen = [];
    this._creatorMap = {};
    this._kampagneArtMap = new Map();
    this.kickoff = null;
    this.kickoffMarkenwerte = [];
    this.kickoffsByType = { paid: null, organic: null };
    this.kickoffMarkenwerteByType = { paid: [], organic: [] };
    this.activeKickoffType = 'organic';
    this.activeMainTab = null;
    this.eventsBound = false;
    this._isLoading = false;
    this._lastRenderTime = 0;
    this._renderDebounceMs = 500;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this._dragCleanup = null;
  }

  async init(unternehmenId) {
    this._removeAllEventListeners();

    try {
      this._isLoading = true;
      this.unternehmenId = unternehmenId;
      await this.loadUnternehmenData();

      if (window.breadcrumbSystem && this.unternehmen) {
        const canEdit = window.currentUser?.permissions?.unternehmen?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(this.unternehmen.firmenname || 'Details', {
          id: 'btn-edit-unternehmen',
          canEdit: canEdit
        });
      }

      this.render(true);
      this.bindDragToScroll();

      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }

      this._isLoading = false;
    } catch (error) {
      this._isLoading = false;
      console.error('Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'UnternehmenDetail.init');
    }
  }

  async loadUnternehmenData() {
    return loadUnternehmenData(this);
  }

  render(force = false) {
    const now = Date.now();
    if (!force && (now - this._lastRenderTime) < this._renderDebounceMs) {
      return;
    }
    this._lastRenderTime = now;
    renderUnternehmenDetailPage(this);
  }

  bindEvents() {
    bindUnternehmenDetailEvents(this);
  }

  bindDragToScroll() {
    bindUnternehmenDetailDragScroll(this);
  }

  showEditForm() {
    return showEditForm(this);
  }

  async removeAnsprechpartner(ansprechpartnerId, unternehmenId) {
    return removeAnsprechpartner(this, ansprechpartnerId, unternehmenId);
  }

  async getBranchenNamen(branchenIds) {
    return getBranchenNamen(branchenIds);
  }

  async uploadLogo(unternehmenId, form) {
    return uploadLogo(this, unternehmenId, form);
  }

  async saveMitarbeiterRoles(unternehmenId, data) {
    return UnternehmenService.saveMitarbeiterRoles(unternehmenId, data);
  }

  async saveUnternehmenBranchen(unternehmenId, brancheIds = null, form = null) {
    return saveUnternehmenBranchen(this, unternehmenId, brancheIds, form);
  }

  _removeAllEventListeners() {
    this._dragCleanup?.();
    this._dragCleanup = null;
    this._eventsAbort?.abort();
    this._eventsAbort = null;
    this._tabClickHandler = null;
    this._editClickHandler = null;
    this._ansprechpartnerClickHandler = null;
    this._tableLinkClickHandler = null;
    this._softRefreshHandler = null;
    this._entityUpdatedHandler = null;
    this._sidebarTabsBound = false;
    this.eventsBound = false;
  }

  destroy() {
    this._removeAllEventListeners();
    this._isLoading = false;
    this._lastRenderTime = 0;
  }
}

export const unternehmenDetail = new UnternehmenDetail();
