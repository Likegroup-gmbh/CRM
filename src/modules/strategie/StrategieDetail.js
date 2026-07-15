// StrategieDetail.js
// Fassade: Orchestriert Rendering, Events, Drawers und Item-Aktionen

import { strategieService } from './StrategieService.js';
import { AddItemDrawer } from './AddItemDrawer.js';
import { renderItemsTable, rerenderItemsTable as _rerenderItemsTable } from './StrategieDetailRenderer.js';
import { bindTableEvents, cleanupTableEvents, destroyDragToScroll } from './StrategieDetailTableEvents.js';
import { showEditItemDrawer as _showEditItemDrawer, removeEditItemDrawer, closeEditItemDrawer as _closeEditItemDrawer } from './StrategieDetailEditDrawer.js';
import { showKategorienModal as _showKategorienModal, removeKategorienDrawer } from './StrategieDetailKategorienDrawer.js';
import { handleDeleteItem as _handleDeleteItem, handleAddToVideo as _handleAddToVideo, handleUnlinkFromVideo as _handleUnlinkFromVideo } from './StrategieDetailItemActions.js';
import { StrategieDetailColumnVisibilityDrawer } from './StrategieDetailColumnVisibilityDrawer.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';

export class StrategieDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this._tableEventListeners = new Set();
    this._dragScrollAbort = null;
    this.strategie = null;
    this.items = [];
    this.draggedItem = null;
    this.isKunde = false;
    this.hiddenColumns = [];
    this.customColumns = new EntityCustomColumnsManager({ parentType: 'strategie', parentTable: 'strategie' });
    this._customHeaderDragCleanup = null;
  }

  async init(strategieId) {
    this.strategieId = strategieId;
    this.isKunde = window.isKunde();

    try {
      this.strategie = await strategieService.getStrategieById(strategieId);
      this.items = await strategieService.getStrategieItems(strategieId);

      this.hiddenColumns = Array.isArray(this.strategie?.hidden_columns) ? this.strategie.hidden_columns : [];
      await this.customColumns.init(strategieId);
      await this.customColumns.loadValues(this.items.map(i => i.id));

      if (window.breadcrumbSystem && this.strategie) {
        const crumbs = [
          { label: 'Strategien', url: '/strategie', clickable: true }
        ];

        if (this.strategie.unternehmen) {
          const uName = encodeURIComponent(this.strategie.unternehmen.firmenname);
          const uId = this.strategie.unternehmen_id;
          crumbs.push({
            label: this.strategie.unternehmen.firmenname,
            url: `/strategie?unternehmen=${uId}&unternehmen_name=${uName}`,
            clickable: true
          });
        }

        if (this.strategie.marke) {
          const uName = encodeURIComponent(this.strategie.unternehmen?.firmenname || '');
          const uId = this.strategie.unternehmen_id;
          const mName = encodeURIComponent(this.strategie.marke.markenname);
          const mId = this.strategie.marke_id;
          crumbs.push({
            label: this.strategie.marke.markenname,
            url: `/strategie?unternehmen=${uId}&unternehmen_name=${uName}&marke=${mId}&marke_name=${mName}`,
            clickable: true
          });
        }

        crumbs.push({ label: this.strategie.name, url: '#', clickable: false });
        window.breadcrumbSystem.updateBreadcrumb(crumbs);
      }

      window.setHeadline('');
      await this.render();
      this.bindEvents();

    } catch (error) {
      console.error('Fehler beim Laden der Strategie:', error);
      window.content.innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden der Strategie</p>
        </div>
      `;
    }
  }

  async render() {
    const canEdit = !this.isKunde;

    const html = `
      ${this.renderHeader()}
      ${canEdit ? this.renderAddItemSection() : ''}
      ${this.renderItemsTable()}
    `;

    window.content.innerHTML = html;

    const addSection = window.content.querySelector('.add-item-section--compact');
    if (addSection) {
      const h = addSection.offsetHeight;
      window.content.style.setProperty('--sticky-add-section-height', h + 'px');
    }
  }

  renderHeader() {
    return '';
  }

  renderAddItemSection() {
    return `
      <div class="add-item-section add-item-section--compact">
        <div class="add-item-actions-right">
          <button type="button" class="secondary-btn" id="btn-share-strategie" title="Liste per E-Mail teilen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" style="width: 16px; height: 16px;">
              <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
            </svg>
            Teilen
          </button>
          <button type="button" class="primary-btn" id="btn-open-add-drawer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Hinzufügen
          </button>
          <button type="button" class="secondary-btn" id="btn-manage-kategorien" title="Kategorien verwalten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
            Kategorien
          </button>
          <button type="button" class="secondary-btn" id="btn-strategie-detail-column-visibility" title="Spalten-Sichtbarkeit">
            Sichtbarkeit anpassen
          </button>
          <button type="button" class="secondary-btn" id="btn-strategie-custom-columns" title="Eigene Spalten verwalten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            Eigene Spalten
          </button>
        </div>
      </div>
    `;
  }

  async saveColumnVisibilitySettings() {
    try {
      await strategieService.updateStrategie(this.strategieId, { hidden_columns: this.hiddenColumns });
      if (this.strategie) this.strategie.hidden_columns = this.hiddenColumns;
    } catch (error) {
      console.error('Fehler beim Speichern der Spalten-Sichtbarkeit:', error);
    }
  }

  showColumnVisibilityDrawer() {
    const customColumns = this.customColumns.getOrderedColumns().map(c => ({
      className: makeCustomColumnId(c.id),
      label: c.name
    }));
    const drawer = new StrategieDetailColumnVisibilityDrawer(
      this.hiddenColumns,
      async (newHidden) => {
        this.hiddenColumns = newHidden;
        await this.saveColumnVisibilitySettings();
        this.rerenderItemsTable();
      },
      customColumns
    );
    drawer.open();
  }

  getTeilbereicheFromStrategie() {
    if (!this.strategie?.teilbereich) return [];
    return this.strategie.teilbereich.split(',').map(tb => tb.trim()).filter(tb => tb);
  }

  // --- Delegations-Methoden (Renderer) ---
  renderItemsTable() { return renderItemsTable(this); }
  rerenderItemsTable() { _rerenderItemsTable(this); }

  // --- Delegations-Methoden (Table Events) ---
  _cleanupTableEvents() { cleanupTableEvents(this); }
  _bindTableEvents() { bindTableEvents(this); }
  _destroyDragToScroll() { destroyDragToScroll(this); }

  // --- Delegations-Methoden (Edit Drawer) ---
  showEditItemDrawer(itemId) { _showEditItemDrawer(this, itemId); }
  closeEditItemDrawer() { _closeEditItemDrawer(); }
  removeEditItemDrawer() { removeEditItemDrawer(); }

  // --- Delegations-Methoden (Kategorien Drawer) ---
  showKategorienModal() { _showKategorienModal(this); }
  removeKategorienDrawer() { removeKategorienDrawer(); }

  // --- Delegations-Methoden (Item Actions) ---
  handleDeleteItem(itemId) { return _handleDeleteItem(this, itemId); }
  handleAddToVideo(itemId) { return _handleAddToVideo(this, itemId); }
  handleUnlinkFromVideo(itemId, videoId) { return _handleUnlinkFromVideo(this, itemId, videoId); }

  openAddItemDrawer() {
    const teilbereiche = this.getTeilbereicheFromStrategie();
    const drawer = new AddItemDrawer();
    drawer.open(this.strategie, teilbereiche);
  }

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this._cleanupTableEvents();

    const linkHandler = async (event) => {
      const { itemId } = event.detail;
      this.items = await strategieService.getStrategieItems(this.strategieId);
      this.rerenderItemsTable();
    };
    window.addEventListener('strategieItemLinked', linkHandler);
    this._boundEventListeners.add(() => window.removeEventListener('strategieItemLinked', linkHandler));

    const itemCreatedHandler = async (event) => {
      if (event.detail?.strategieId === this.strategieId) {
        this.items = await strategieService.getStrategieItems(this.strategieId);
        this.rerenderItemsTable();
      }
    };
    window.addEventListener('strategieItemCreated', itemCreatedHandler);
    this._boundEventListeners.add(() => window.removeEventListener('strategieItemCreated', itemCreatedHandler));

    if (!this.isKunde) {
      const shareBtn = document.getElementById('btn-share-strategie');
      if (shareBtn) {
        const handler = () => window.shareListDialog?.open({
          entityType: 'strategie',
          entityId: this.strategieId,
          entityName: this.strategie?.name || ''
        });
        shareBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => shareBtn.removeEventListener('click', handler));
      }

      const openDrawerBtn = document.getElementById('btn-open-add-drawer');
      if (openDrawerBtn) {
        const handler = () => this.openAddItemDrawer();
        openDrawerBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => openDrawerBtn.removeEventListener('click', handler));
      }

      const manageKategorienBtn = document.getElementById('btn-manage-kategorien');
      if (manageKategorienBtn) {
        const handler = () => this.showKategorienModal();
        manageKategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => manageKategorienBtn.removeEventListener('click', handler));
      }

      const visibilityBtn = document.getElementById('btn-strategie-detail-column-visibility');
      if (visibilityBtn) {
        const handler = () => this.showColumnVisibilityDrawer();
        visibilityBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => visibilityBtn.removeEventListener('click', handler));
      }

      const customColumnsBtn = document.getElementById('btn-strategie-custom-columns');
      if (customColumnsBtn) {
        const handler = () => this.customColumns.openManagementDrawer(() => this.rerenderItemsTable());
        customColumnsBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => customColumnsBtn.removeEventListener('click', handler));
      }
    }

    this._bindTableEvents();
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this._cleanupTableEvents();
    this._destroyDragToScroll();
    this.removeKategorienDrawer();
    this.removeEditItemDrawer();
  }
}

export const strategieDetail = new StrategieDetail();
