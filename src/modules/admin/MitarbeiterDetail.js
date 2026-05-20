// MitarbeiterDetail.js (Fassade)
// Dünne Orchestrierungsklasse – delegiert an Loader, Renderer, Events, Modals, Actions

import { PersonDetailBase } from './PersonDetailBase.js';
import { loadMitarbeiterData } from './MitarbeiterDetailLoader.js';
import { renderMitarbeiterDetailPage, getDisplayName } from './MitarbeiterDetailRendererCore.js';
import { bindMitarbeiterDetail } from './MitarbeiterDetailEvents.js';
import { showChangeRolleModal, showAddUnternehmenModal } from './MitarbeiterDetailModals.js';
import { updateUnternehmenRole, removeUnternehmen, saveFirmenhandyFromForm } from './MitarbeiterDetailActions.js';
import { autoSavePermissions } from './MitarbeiterDetailPermissions.js';

export class MitarbeiterDetail extends PersonDetailBase {
  constructor() {
    super();
    this.userId = null;
    this.user = null;
    this.assignments = { kampagnen: [], kooperationen: [], briefings: [], auftragsdetails: [] };
    this.zugeordnet = { unternehmen: [], marken: [] };
    this.budget = { invoicesByKoop: {}, totals: { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 } };
    this.statusOptions = [];
    this.euLaender = [];
    this.activeMainTab = 'informationen';
    this._eventsBound = false;
    this._abortController = null;
  }

  async init(id) {
    this.userId = id;
    await this.load();

    if (window.breadcrumbSystem && this.user) {
      window.breadcrumbSystem.updateDetailLabel(getDisplayName(this));
    }

    await this.render();
    this.bind();
  }

  async load() {
    return loadMitarbeiterData(this);
  }

  getDisplayName() {
    return getDisplayName(this);
  }

  async render() {
    renderMitarbeiterDetailPage(this);
  }

  bind() {
    bindMitarbeiterDetail(this);
  }

  showEditForm() {
    window.setHeadline('Mitarbeiter bearbeiten');
    window.content.innerHTML = `
      <div class="content-section">
        <div class="info-message">
          <h2>Hinweis</h2>
          <p>Die Bearbeitung von Mitarbeitern erfolgt direkt über die Detail-Ansicht mit speziellen Admin-Funktionen.</p>
        </div>
      </div>
    `;
  }

  async showChangeRolleModal() {
    return showChangeRolleModal(this);
  }

  async showAddUnternehmenModal() {
    return showAddUnternehmenModal(this);
  }

  async autoSavePermissions() {
    return autoSavePermissions(this);
  }

  async updateUnternehmenRole(unternehmenId, newRole) {
    return updateUnternehmenRole(this, unternehmenId, newRole);
  }

  async removeUnternehmen(unternehmenId, unternehmenName) {
    return removeUnternehmen(this, unternehmenId);
  }

  async saveFirmenhandyFromForm() {
    return saveFirmenhandyFromForm(this);
  }

  destroy() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._eventsBound = false;
    this._renderedTabs = null;
    window.setContentSafely('');
  }
}

export const mitarbeiterDetail = new MitarbeiterDetail();
