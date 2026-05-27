// ColumnDragHandler.js
// HTML5 Drag & Drop fuer Spalten-Reihenfolge im Tabellen-Header.
// Speichert die Reihenfolge in kampagne.column_order via Supabase.

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';
import { getOrderedColumns, getDefaultColumnIds, isCustomColumnId, makeCustomColumnId } from './ColumnRegistry.js';

export class ColumnDragHandler {
  constructor(table) {
    this.table = table;
    this._dragCol = null;
    this._dragOverCol = null;
    this._indicator = null;
  }

  bind(container, signal) {
    if (!container) return;

    const thead = container.querySelector('thead');
    if (!thead) return;

    thead.addEventListener('dragstart', (e) => this._onDragStart(e), { signal });
    thead.addEventListener('dragover', (e) => this._onDragOver(e), { signal });
    thead.addEventListener('dragleave', (e) => this._onDragLeave(e), { signal });
    thead.addEventListener('drop', (e) => this._onDrop(e), { signal });
    thead.addEventListener('dragend', (e) => this._onDragEnd(e), { signal });
  }

  _onDragStart(e) {
    const th = e.target.closest('th');
    if (!th || e.target.classList.contains('resize-handle')) {
      e.preventDefault();
      return;
    }

    this._dragCol = this._getColId(th);
    if (!this._dragCol) {
      e.preventDefault();
      return;
    }

    th.classList.add('column-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this._dragCol);
  }

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const th = e.target.closest('th');
    if (!th) return;

    const targetId = this._getColId(th);
    if (!targetId || targetId === this._dragCol) return;

    this._dragOverCol = targetId;
    this._showIndicator(th, e);
  }

  _onDragLeave(e) {
    const th = e.target.closest('th');
    if (th) th.classList.remove('column-drag-over');
    this._removeIndicator();
  }

  _onDrop(e) {
    e.preventDefault();
    const th = e.target.closest('th');
    if (!th) return;

    const targetId = this._getColId(th);
    if (!targetId || !this._dragCol || targetId === this._dragCol) return;

    this._reorderColumns(this._dragCol, targetId, e, th);
    this._cleanup();
  }

  _onDragEnd() {
    this._cleanup();
  }

  _getColId(th) {
    // CSS-Klassen der th durchsuchen um col-* oder custom:* zu finden
    for (const cls of th.classList) {
      if (cls.startsWith('col-') && cls !== 'col-header') return cls;
      if (cls.startsWith('custom:')) return cls;
    }
    return null;
  }

  _showIndicator(th, e) {
    this._removeIndicator();
    const rect = th.getBoundingClientRect();
    const isLeft = (e.clientX - rect.left) < rect.width / 2;

    if (!this._indicator) {
      this._indicator = document.createElement('div');
      this._indicator.className = 'column-drop-indicator';
      document.body.appendChild(this._indicator);
    }

    this._indicator.style.top = `${rect.top}px`;
    this._indicator.style.height = `${rect.height}px`;
    this._indicator.style.left = isLeft ? `${rect.left - 1}px` : `${rect.right - 1}px`;
    this._indicator.dataset.side = isLeft ? 'left' : 'right';
  }

  _removeIndicator() {
    if (this._indicator) {
      this._indicator.remove();
      this._indicator = null;
    }
  }

  async _reorderColumns(dragId, targetId, event, targetTh) {
    const store = this.table.store;
    if (!store) return;

    const currentOrder = store.columnOrder || getDefaultColumnIds();
    const order = [...currentOrder];

    // Custom Columns die noch nicht im Order sind, einfuegen
    const columns = getOrderedColumns(store);
    for (const col of columns) {
      if (!order.includes(col.id)) order.push(col.id);
    }

    const dragIdx = order.indexOf(dragId);
    if (dragIdx === -1) return;

    order.splice(dragIdx, 1);

    let targetIdx = order.indexOf(targetId);
    if (targetIdx === -1) return;

    const rect = targetTh.getBoundingClientRect();
    const isAfter = (event.clientX - rect.left) >= rect.width / 2;
    if (isAfter) targetIdx++;

    order.splice(targetIdx, 0, dragId);

    store.setColumnOrder(order);
    this.table.refilter();

    try {
      await CustomColumnDataLoader.saveColumnOrder(this.table.kampagneId, order);
    } catch (error) {
      console.error('❌ Column Order speichern fehlgeschlagen:', error);
    }
  }

  _cleanup() {
    this._removeIndicator();
    document.querySelectorAll('.column-dragging').forEach(el => el.classList.remove('column-dragging'));
    document.querySelectorAll('.column-drag-over').forEach(el => el.classList.remove('column-drag-over'));
    this._dragCol = null;
    this._dragOverCol = null;
  }

  destroy() {
    this._cleanup();
  }
}
