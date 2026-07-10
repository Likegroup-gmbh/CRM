// EntityCustomColumnsManager.js
// Orchestriert Custom Columns fuer einstufige Detail-Tabellen (Sourcing/Strategie):
// Laden, State, Rendering-Helfer, Verwaltungs-Drawer, Inline-Edit-Routing,
// Header-Drag&Drop und Upload-Drawer. Haelt die Modul-Integration duenn.

import { EntityCustomColumnDataLoader } from './EntityCustomColumnDataLoader.js';
import { EntityCustomColumnsDrawer } from './EntityCustomColumnsDrawer.js';
import { EntityCustomColumnFieldHandler } from './EntityCustomColumnFieldHandler.js';
import { renderCustomHeaders, renderCustomCells } from './EntityCustomColumnRenderer.js';
import { orderCustomColumns, makeCustomColumnId } from './entityColumnUtils.js';

export class EntityCustomColumnsManager {
  /**
   * @param {object} cfg
   * @param {string} cfg.parentType   'sourcing' | 'strategie'
   * @param {string} cfg.parentTable  'creator_auswahl' | 'strategie'
   * @param {string} [cfg.orderColumn='custom_column_order']
   */
  constructor({ parentType, parentTable, orderColumn = 'custom_column_order' }) {
    this.parentType = parentType;
    this.parentTable = parentTable;
    this.orderColumn = orderColumn;
    this.dataLoader = null;
    this.columns = [];
    this.order = [];
    this.values = {};   // { [entityId]: { [columnId]: value } }
    this._uploadDrawer = null;
  }

  async init(parentId) {
    this.parentId = parentId;
    this.dataLoader = new EntityCustomColumnDataLoader({
      parentType: this.parentType,
      parentId,
      parentTable: this.parentTable,
      orderColumn: this.orderColumn
    });
    this.columns = await this.dataLoader.loadColumns();
    this.order = (await this.dataLoader.loadColumnOrder()) || this.columns.map(c => makeCustomColumnId(c.id));
  }

  async loadValues(entityIds) {
    const columnIds = this.columns.map(c => c.id);
    this.values = await this.dataLoader.loadValues(columnIds, entityIds || []);
  }

  get hasColumns() { return this.columns.length > 0; }

  getOrderedColumns() {
    return orderCustomColumns(this.columns, this.order);
  }

  /** Anzahl Custom-Spalten, die fuer die aktuelle Rolle sichtbar sind (fuer colspan). */
  visibleCount(hiddenColumns, isKunde) {
    return this.getOrderedColumns().filter(col => {
      if (isKunde && !col.visible_for_kunden) return false;
      if (Array.isArray(hiddenColumns) && hiddenColumns.includes(makeCustomColumnId(col.id))) return false;
      return true;
    }).length;
  }

  renderHeaders(hiddenColumns, isKunde) {
    return renderCustomHeaders(this.getOrderedColumns(), hiddenColumns, isKunde);
  }

  renderCells(entityId, hiddenColumns, isKunde) {
    return renderCustomCells(
      this.getOrderedColumns(),
      entityId,
      (eId, uuid) => this.getValue(eId, uuid),
      hiddenColumns,
      isKunde
    );
  }

  getValue(entityId, uuid) {
    return this.values?.[entityId]?.[uuid] ?? '';
  }

  setValue(entityId, uuid, value) {
    (this.values[entityId] ||= {})[uuid] = value;
  }

  openManagementDrawer(onChange) {
    const drawer = new EntityCustomColumnsDrawer({
      dataLoader: this.dataLoader,
      columns: this.columns,
      order: this.order,
      onChange: () => onChange?.()
    });
    drawer.open();
  }

  isCustomField(el) {
    return EntityCustomColumnFieldHandler.isCustomColumnField(el);
  }

  async handleFieldUpdate(el, onChange) {
    const ok = await EntityCustomColumnFieldHandler.handleUpdate(el, {
      dataLoader: this.dataLoader,
      columns: this.columns,
      onValueChange: (entityId, columnId, value) => this.setValue(entityId, columnId, value)
    });
    if (ok) onChange?.();
    return ok;
  }

  /**
   * Bindet Drag&Drop fuer die Custom-Spalten-Header. Reordnet nur untereinander.
   * @param {HTMLElement} root  Container mit den <th class="entity-custom-col-header">
   * @param {() => void} onReorder  wird nach gespeicherter Reihenfolge aufgerufen
   * @returns {() => void} cleanup
   */
  bindHeaderDragAndDrop(root, onReorder) {
    if (!root) return () => {};
    const headers = Array.from(root.querySelectorAll('.entity-custom-col-header'));
    const cleanups = [];
    let draggedId = null;

    headers.forEach(th => {
      const onDragStart = (e) => {
        draggedId = th.dataset.customColId;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', draggedId); } catch { /* noop */ }
        th.classList.add('dragging');
      };
      const onDragEnd = () => { th.classList.remove('dragging'); draggedId = null; };
      const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
      const onDrop = async (e) => {
        e.preventDefault();
        const targetId = th.dataset.customColId;
        if (!draggedId || draggedId === targetId) return;
        await this._reorder(draggedId, targetId);
        onReorder?.();
      };
      th.addEventListener('dragstart', onDragStart);
      th.addEventListener('dragend', onDragEnd);
      th.addEventListener('dragover', onDragOver);
      th.addEventListener('drop', onDrop);
      cleanups.push(() => {
        th.removeEventListener('dragstart', onDragStart);
        th.removeEventListener('dragend', onDragEnd);
        th.removeEventListener('dragover', onDragOver);
        th.removeEventListener('drop', onDrop);
      });
    });

    return () => cleanups.forEach(fn => fn());
  }

  async _reorder(draggedId, targetId) {
    // Order auf alle Custom-Spalten normalisieren
    let order = this.getOrderedColumns().map(c => makeCustomColumnId(c.id));
    order = order.filter(id => id !== draggedId);
    const targetIdx = order.indexOf(targetId);
    if (targetIdx < 0) order.push(draggedId);
    else order.splice(targetIdx, 0, draggedId);
    this.order = order;
    try {
      await this.dataLoader.saveColumnOrder(order);
    } catch (error) {
      console.error('❌ Spalten-Reihenfolge speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Speichern der Reihenfolge', 'error');
    }
  }

  /**
   * Oeffnet den (kampagnen-eigenen) VideoUploadDrawer im custom-Tab fuer ein Upload-Feld.
   * Schreibt ueber valueTable/assetTable in die entity_custom_column*-Tabellen.
   */
  async openUploadDrawer(btn, metadaten, onChange) {
    const columnId = btn.dataset.customColumnId;
    const entityId = btn.dataset.entityId;
    const columnName = btn.dataset.columnName || 'Upload';

    if (!this._uploadDrawer) {
      const mod = await import('../../modules/kampagne/VideoUploadDrawer.js');
      this._uploadDrawer = new mod.VideoUploadDrawer();
    }

    this._uploadDrawer.open(null, metadaten || {}, null, null, null, {
      initialTab: 'custom',
      customMeta: {
        columnId,
        entityId,
        columnName,
        folderName: columnName,
        valueTable: this.dataLoader.valueTable,
        assetTable: this.dataLoader.assetTable,
        currentValue: this.getValue(entityId, columnId) || null,
        onSuccess: (folderUrl) => {
          // folderUrl === null: alle Dateien geloescht -> Zelle zeigt wieder Upload-Button
          this.setValue(entityId, columnId, folderUrl || null);
          onChange?.();
        }
      }
    });
  }
}
