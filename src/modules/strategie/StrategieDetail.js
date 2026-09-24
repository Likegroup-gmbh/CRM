// StrategieDetail.js
// Fassade: Orchestriert Rendering, Events, Drawers und Item-Aktionen

import { strategieService } from './StrategieService.js';
import { AddItemDrawer } from './AddItemDrawer.js';
import { renderItemsTable, rerenderItemsTable as _rerenderItemsTable, updateItemRow } from './StrategieDetailRenderer.js';
import { bindTableEvents, cleanupTableEvents, destroyDragToScroll } from './StrategieDetailTableEvents.js';
import { showEditItemDrawer as _showEditItemDrawer, removeEditItemDrawer, closeEditItemDrawer as _closeEditItemDrawer } from './StrategieDetailEditDrawer.js';
import { showKategorienModal as _showKategorienModal, removeKategorienDrawer } from './StrategieDetailKategorienDrawer.js';
import { handleDeleteItem as _handleDeleteItem, handleAddToVideo as _handleAddToVideo, handleUnlinkFromVideo as _handleUnlinkFromVideo } from './StrategieDetailItemActions.js';
import { StrategieCreatorDrawer, removeStrategieCreatorDrawer } from './StrategieCreatorDrawer.js';
import { StrategieProduktDrawer, removeStrategieProduktDrawer } from './StrategieProduktDrawer.js';
import { StrategieDetailColumnVisibilityDrawer } from './StrategieDetailColumnVisibilityDrawer.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { makeCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { renderToolbarMenu, renderToolbarMenuItem, renderToolbarListenKopf, bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';
import { VideoideeVorschlagPanel } from './VideoideeVorschlagPanel.js';
import { isVideoideeVorschlag } from './videoideeVorschlag.js';
import { showProduktionLeaf } from '../../core/navHerkunft.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    this.canEdit = false;
    this.canCreate = false;
    this.hiddenColumns = [];
    this.customColumns = new EntityCustomColumnsManager({ parentType: 'strategie', parentTable: 'strategie' });
    this._customHeaderDragCleanup = null;
    this.vorschlagPanel = new VideoideeVorschlagPanel(this);
    this.root = null;
    this.chromeRoot = null;
    this.embedded = false;
  }

  _getRoot() {
    return this.root || window.content;
  }

  _q(selector) {
    return this._getRoot()?.querySelector(selector)
      || this.chromeRoot?.querySelector(selector)
      || null;
  }

  _qq(selector) {
    const root = this._getRoot();
    const fromRoot = root ? [...root.querySelectorAll(selector)] : [];
    if (!this.chromeRoot) return fromRoot;
    return fromRoot.concat([...this.chromeRoot.querySelectorAll(selector)]);
  }

  _getHScrollTarget(fallback) {
    if (this.embedded) return fallback;
    return document.querySelector('.main-wrapper') || fallback;
  }

  async init(strategieId, { root, chromeRoot, embedded } = {}) {
    this.strategieId = strategieId;
    this.root = root || window.content;
    this.chromeRoot = chromeRoot || null;
    this.embedded = !!embedded;
    this.isKunde = window.isKunde();
    // Write-Capabilities einmal aufloesen: Investor/Finanzen ist intern
    // (isKunde=false), aber view-only — Editierbarkeit fragt canEdit, nie die Rolle.
    this.canEdit = window.canEdit?.('strategie') ?? false;
    this.canCreate = window.canCreate?.('strategie') ?? false;

    try {
      this.strategie = await strategieService.getStrategieById(strategieId);
      this.items = await strategieService.getStrategieItems(strategieId);

      this.hiddenColumns = Array.isArray(this.strategie?.hidden_columns) ? this.strategie.hidden_columns : [];
      await this.customColumns.init(strategieId);
      await this.customColumns.loadValues(this.items.map(i => i.id));

      if (!this.embedded && window.breadcrumbSystem && this.strategie) {
        const shown = await showProduktionLeaf(this.strategie.name);
        if (!shown) {
          const crumbs = [
            { label: 'Konzepte', url: '/konzepte', clickable: true }
          ];

          if (this.strategie.unternehmen) {
            const uName = encodeURIComponent(this.strategie.unternehmen.firmenname);
            const uId = this.strategie.unternehmen_id;
            crumbs.push({
              label: this.strategie.unternehmen.firmenname,
              url: `/konzepte?unternehmen=${uId}&unternehmen_name=${uName}`,
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
              url: `/konzepte?unternehmen=${uId}&unternehmen_name=${uName}&marke=${mId}&marke_name=${mName}`,
              clickable: true
            });
          }

          crumbs.push({ label: this.strategie.name, url: '#', clickable: false });
          window.breadcrumbSystem.updateBreadcrumb(crumbs);
        }
      }

      if (!this.embedded) window.setHeadline('');
      await this.render();
      this.bindEvents();
      await this.vorschlagPanel.mount();

    } catch (error) {
      console.error('Fehler beim Laden der Strategie:', error);
      const rootEl = this._getRoot();
      if (rootEl) {
        rootEl.innerHTML = `
          <div class="error-message">
            <p>Fehler beim Laden des Konzepts</p>
          </div>
        `;
      }
    }
  }

  async render() {
    const showActions = this.canEdit || this.canCreate;
    const rootEl = this._getRoot();
    if (!rootEl) return;

    if (this.embedded && this.chromeRoot) {
      this.chromeRoot.innerHTML = showActions ? this.renderAddItemActions() : '';
      rootEl.innerHTML = this.renderItemsTable();
      return;
    }

    rootEl.innerHTML = `
      ${this.renderHeader()}
      ${showActions ? this.renderAddItemSection() : ''}
      ${this.renderItemsTable()}
    `;

    const addSection = rootEl.querySelector('.add-item-section--compact');
    if (addSection) {
      const h = addSection.offsetHeight;
      rootEl.style.setProperty('--sticky-add-section-height', h + 'px');
    }
  }

  renderHeader() {
    return '';
  }

  renderAddItemActions() {
    const shareIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
        <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1-11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
      </svg>`;
    const kategorienIcon = `${icon('tag')}`;
    const sichtbarkeitIcon = `${icon('eye-outline')}`;
    const customColumnsIcon = `${icon('bars-3')}`;

    const primary = this.canEdit ? `
          <button type="button" class="mdc-btn" id="btn-open-add-drawer">
            ${icon('plus-lg', { className: 'icon-16' })}
            Hinzufügen
          </button>
    ` : '';
    const menu = this.canEdit ? renderToolbarMenu({
      toggleId: 'btn-strategie-toolbar-menu',
      itemsHtml: `
              ${renderToolbarMenuItem({ id: 'btn-share-strategie', title: 'Liste per E-Mail teilen', icon: shareIcon, label: 'Teilen' })}
              ${renderToolbarMenuItem({ id: 'btn-strategie-casting-link', title: this.strategie?.creator_auswahl_id ? 'Casting-Verknüpfung lösen' : 'Casting verknüpfen', icon: icon('link'), label: this.strategie?.creator_auswahl_id ? 'Casting lösen' : 'Casting verknüpfen' })}
              ${renderToolbarMenuItem({ id: 'btn-manage-kategorien', title: 'Kategorien verwalten', icon: kategorienIcon, label: 'Kategorien' })}
              ${renderToolbarMenuItem({ id: 'btn-strategie-detail-column-visibility', title: 'Spalten-Sichtbarkeit', icon: sichtbarkeitIcon, label: 'Sichtbarkeit anpassen' })}
              ${renderToolbarMenuItem({ id: 'btn-strategie-custom-columns', title: 'Eigene Spalten verwalten', icon: customColumnsIcon, label: 'Eigene Spalten' })}
            `
    }) : '';

    return `
          ${primary}
          <div id="videoidee-vorschlag-block"></div>
          ${menu}
    `;
  }

  renderAddItemSection() {
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
          ${this.renderAddItemActions()}
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

  async reloadItems() {
    this.items = await strategieService.getStrategieItems(this.strategieId);
    return this.items;
  }

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

  // --- Creator-Verknüpfung ---
  showCreatorDrawer(itemId) {
    const drawer = new StrategieCreatorDrawer(this);
    drawer.open(itemId);
  }

  showProduktDrawer(itemId) {
    const drawer = new StrategieProduktDrawer(this);
    drawer.open(itemId);
  }

  /**
   * Casting verknuepfen oder loesen. Picker zeigt nur unverknuepfte Castings
   * derselben Kampagne mit gleichem Briefing. Loesen blockt, sobald eine
   * Videoidee einen Casting-Eintrag traegt.
   */
  async handleCastingLink() {
    if (this.strategie?.creator_auswahl_id) {
      const result = await window.confirmationModal?.open({
        title: 'Casting-Verknüpfung lösen?',
        message: 'Die Verknüpfung zum Casting wird gelöst. Videoideen behalten ihre Zuordnung nicht.',
        confirmText: 'Lösen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!result?.confirmed) return;

      try {
        await strategieService.unlinkCasting(this.strategieId);
        this.strategie.creator_auswahl_id = null;
        window.toastSystem?.show('Casting-Verknüpfung gelöst', 'success');
        await this.render();
        this.bindEvents();
        await this.vorschlagPanel.mount();
      } catch (error) {
        console.error('Fehler beim Lösen der Casting-Verknüpfung:', error);
        window.toastSystem?.show(error.message || 'Fehler beim Lösen', 'error');
      }
      return;
    }

    await this.showCastingPicker();
  }

  async showCastingPicker() {
    const { data: castings, error } = await window.supabase
      .from('creator_auswahl')
      .select('id, name, kampagne_id, briefing_id, strategie_id')
      .eq('kampagne_id', this.strategie?.kampagne_id)
      .is('strategie_id', null)
      .order('name');

    if (error) {
      window.toastSystem?.show('Fehler beim Laden der Castings', 'error');
      return;
    }

    const passend = (castings || []).filter(c =>
      (c.briefing_id || null) === (this.strategie?.briefing_id || null)
    );

    if (passend.length === 0) {
      window.toastSystem?.show('Kein unverknüpftes Casting mit gleichem Briefing in dieser Kampagne', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'strategie-casting-picker-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'strategie-casting-picker';

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Casting verknüpfen</span>
          <p class="drawer-subtitle">Nur unverknüpfte Castings dieser Kampagne mit gleichem Briefing</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body">
        <div class="form-field">
          <label for="strategie-casting-select">Casting</label>
          <select id="strategie-casting-select" class="form-input">
            <option value="">– Casting wählen –</option>
            ${passend.map(c => `<option value="${c.id}">${escapeHtml(c.name || 'Ohne Namen')}</option>`).join('')}
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-casting-link-confirm" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      </div>
    `;

    const close = () => {
      panel.classList.remove('show');
      overlay.classList.remove('active');
      setTimeout(() => { overlay.remove(); panel.remove(); }, 250);
    };

    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close"]').addEventListener('click', close);

    const select = panel.querySelector('#strategie-casting-select');
    const confirmBtn = panel.querySelector('#btn-casting-link-confirm');
    select.addEventListener('change', () => { confirmBtn.disabled = !select.value; });

    confirmBtn.addEventListener('click', async () => {
      if (!select.value) return;
      confirmBtn.disabled = true;
      try {
        await strategieService.linkCasting(this.strategieId, select.value);
        this.strategie.creator_auswahl_id = select.value;
        window.toastSystem?.show('Casting verknüpft', 'success');
        close();
        await this.render();
        this.bindEvents();
        await this.vorschlagPanel.mount();
      } catch (error) {
        console.error('Fehler beim Verknüpfen:', error);
        window.toastSystem?.show(error.message || 'Fehler beim Verknüpfen', 'error');
        confirmBtn.disabled = false;
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  }

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

    // Toolbar, Teilen, Drawer und Kategorien sind Write-/Config-Aktionen:
    // nur intern UND mit edit-Recht (Investor ist view-only).
    if (!this.isKunde && this.canEdit) {
      const toolbarMenu = this._q('.toolbar-menu');
      if (toolbarMenu) {
        this._boundEventListeners.add(bindToolbarMenu(toolbarMenu));
      }

      const shareBtn = this._q('#btn-share-strategie');
      if (shareBtn) {
        const handler = () => window.shareListDialog?.open({
          entityType: 'strategie',
          entityId: this.strategieId,
          entityName: this.strategie?.name || ''
        });
        shareBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => shareBtn.removeEventListener('click', handler));
      }

      const openDrawerBtn = this._q('#btn-open-add-drawer');
      if (openDrawerBtn) {
        const handler = () => this.openAddItemDrawer();
        openDrawerBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => openDrawerBtn.removeEventListener('click', handler));
      }

      const manageKategorienBtn = this._q('#btn-manage-kategorien');
      if (manageKategorienBtn) {
        const handler = () => this.showKategorienModal();
        manageKategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => manageKategorienBtn.removeEventListener('click', handler));
      }

      const visibilityBtn = this._q('#btn-strategie-detail-column-visibility');
      if (visibilityBtn) {
        const handler = () => this.showColumnVisibilityDrawer();
        visibilityBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => visibilityBtn.removeEventListener('click', handler));
      }

      const customColumnsBtn = this._q('#btn-strategie-custom-columns');
      if (customColumnsBtn) {
        const handler = () => this.customColumns.openManagementDrawer(() => this.rerenderItemsTable());
        customColumnsBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => customColumnsBtn.removeEventListener('click', handler));
      }

      const castingLinkBtn = this._q('#btn-strategie-casting-link');
      if (castingLinkBtn) {
        const handler = () => this.handleCastingLink();
        castingLinkBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => castingLinkBtn.removeEventListener('click', handler));
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'strategie_items',
        filter: `strategie_id=eq.${this.strategieId}`
      }, (payload) => this.handleItemRealtimeInsert(payload.new))
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'strategie_items',
        filter: `strategie_id=eq.${this.strategieId}`
      }, (payload) => this.handleItemRealtimeDelete(payload.old))
      .subscribe();

    this._boundEventListeners.add(() => this.unsubscribeFromItemUpdates());
  }

  unsubscribeFromItemUpdates() {
    if (!this._itemChannel) return;
    window.supabase.removeChannel(this._itemChannel);
    this._itemChannel = null;
  }

  handleItemRealtimeInsert(row) {
    if (!row?.id) return;
    if (this.isKunde && isVideoideeVorschlag(row)) return;
    if (this.items.some((i) => i.id === row.id)) return;
    this.items.push(row);
    this.rerenderItemsTable();
    this.vorschlagPanel?.render?.();
  }

  handleItemRealtimeDelete(row) {
    if (!row?.id) return;
    const next = this.items.filter((i) => i.id !== row.id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.rerenderItemsTable();
    this.vorschlagPanel?.render?.();
  }

  handleItemRealtimeUpdate(row) {
    if (!row?.id) return;
    if (this.isKunde && isVideoideeVorschlag(row)) return;
    const item = this.items.find(i => i.id === row.id);
    if (!item) {
      this.handleItemRealtimeInsert(row);
      return;
    }

    const warVorschlag = !!item.ist_vorschlag;
    Object.assign(item, row);
    if (warVorschlag !== !!item.ist_vorschlag) {
      this.rerenderItemsTable();
      this.vorschlagPanel?.render?.();
      return;
    }
    updateItemRow(this, row.id);
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this._cleanupTableEvents();
    this._destroyDragToScroll();
    this.unsubscribeFromItemUpdates();
    this.vorschlagPanel?.unmount?.();
    this.removeKategorienDrawer();
    this.removeEditItemDrawer();
    removeStrategieCreatorDrawer();
    removeStrategieProduktDrawer();
  }
}

export const strategieDetail = new StrategieDetail();
