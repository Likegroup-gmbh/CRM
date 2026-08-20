// StrategieDetail.js
// Fassade: Orchestriert Rendering, Events, Drawers und Item-Aktionen

import { strategieService } from './StrategieService.js';
import { AddItemDrawer } from './AddItemDrawer.js';
import { renderItemsTable, rerenderItemsTable as _rerenderItemsTable, updateItemRow } from './StrategieDetailRenderer.js';
import { bindTableEvents, cleanupTableEvents, destroyDragToScroll } from './StrategieDetailTableEvents.js';
import { showEditItemDrawer as _showEditItemDrawer, removeEditItemDrawer, closeEditItemDrawer as _closeEditItemDrawer } from './StrategieDetailEditDrawer.js';
import { showKategorienModal as _showKategorienModal, removeKategorienDrawer } from './StrategieDetailKategorienDrawer.js';
import { handleDeleteItem as _handleDeleteItem, handleAddToVideo as _handleAddToVideo, handleUnlinkFromVideo as _handleUnlinkFromVideo } from './StrategieDetailItemActions.js';
import { StrategieDetailColumnVisibilityDrawer } from './StrategieDetailColumnVisibilityDrawer.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { renderToolbarMenu, renderToolbarMenuItem, renderToolbarListenKopf, bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';

export class StrategieDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this._tableEventListeners = new Set();
    this._dragScrollAbort = null;
    this._itemChannel = null;
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
    const shareIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
        <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
      </svg>`;
    const kategorienIcon = `
      ${icon('tag')}`;
    const sichtbarkeitIcon = `
      ${icon('eye-outline')}`;
    const customColumnsIcon = `
      ${icon('bars-3')}`;

    const marke = this.strategie?.marke;
    const unternehmen = this.strategie?.unternehmen;
    // Marke hat Vorrang, wenn die Strategie einer Marke haengt – sonst Unternehmen.
    const logoUrl = marke?.logo_url || unternehmen?.logo_url || '';
    const logoAlt = marke?.markenname || unternehmen?.firmenname || 'Logo';

    return `
      <div class="add-item-section add-item-section--compact">
        <div class="add-item-actions-left">
          ${renderToolbarListenKopf({
            name: this.strategie?.name || '',
            logoUrl,
            logoAlt
          })}
        </div>
        <div class="add-item-actions-right">
          <button type="button" class="mdc-btn" id="btn-open-add-drawer">
            ${icon('plus-lg', { className: 'icon-16' })}
            Hinzufügen
          </button>
          ${renderToolbarMenu({
            toggleId: 'btn-strategie-toolbar-menu',
            itemsHtml: `
              ${renderToolbarMenuItem({ id: 'btn-share-strategie', title: 'Liste per E-Mail teilen', icon: shareIcon, label: 'Teilen' })}
              ${renderToolbarMenuItem({ id: 'btn-manage-kategorien', title: 'Kategorien verwalten', icon: kategorienIcon, label: 'Kategorien' })}
              ${renderToolbarMenuItem({ id: 'btn-strategie-detail-column-visibility', title: 'Spalten-Sichtbarkeit', icon: sichtbarkeitIcon, label: 'Sichtbarkeit anpassen' })}
              ${renderToolbarMenuItem({ id: 'btn-strategie-custom-columns', title: 'Eigene Spalten verwalten', icon: customColumnsIcon, label: 'Eigene Spalten' })}
            `
          })}
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
      const toolbarMenu = window.content.querySelector('.toolbar-menu');
      if (toolbarMenu) {
        this._boundEventListeners.add(bindToolbarMenu(toolbarMenu));
      }

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
    this.subscribeToItemUpdates();
  }

  /**
   * Screenshot, Transkript und KI-Beschreibung kommen aus einer Background
   * Function und treffen Sekunden bis Minuten nach dem Anlegen ein. Statt zu
   * pollen lauscht die Tabelle auf die UPDATEs ihrer eigenen Items.
   */
  subscribeToItemUpdates() {
    this.unsubscribeFromItemUpdates();
    if (!this.strategieId) return;

    this._itemChannel = window.supabase
      .channel(`strategie-items-${this.strategieId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'strategie_items',
        filter: `strategie_id=eq.${this.strategieId}`
      }, (payload) => this.handleItemRealtimeUpdate(payload.new))
      .subscribe();

    this._boundEventListeners.add(() => this.unsubscribeFromItemUpdates());
  }

  unsubscribeFromItemUpdates() {
    if (!this._itemChannel) return;
    window.supabase.removeChannel(this._itemChannel);
    this._itemChannel = null;
  }

  handleItemRealtimeUpdate(row) {
    if (!row?.id) return;
    const item = this.items.find(i => i.id === row.id);
    if (!item) return;

    // linked_video und andere angereicherte Felder haengen nicht an der Zeile
    Object.assign(item, row);
    updateItemRow(this, row.id);
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this._cleanupTableEvents();
    this._destroyDragToScroll();
    this.unsubscribeFromItemUpdates();
    this.removeKategorienDrawer();
    this.removeEditItemDrawer();
  }
}

export const strategieDetail = new StrategieDetail();
