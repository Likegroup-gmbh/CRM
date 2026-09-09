// ColumnDragHandler.js
// HTML5 Drag & Drop fuer Spalten-Reihenfolge im Tabellen-Header.
// Speichert die Reihenfolge in kampagne.column_order via Supabase.
//
// Feedback Excel-Style: die native Browser-Ghost (nur der <th>) wird durch ein
// 1x1-Pixel ersetzt; stattdessen wird die ganze Quellspalte gedimmt
// (.column-dragging auf th + alle td mit gleichem data-col-id) und eine
// Drop-Linie in voller Tabellenhoehe gezeigt.
//
// Fixiert: col-nr / col-creator bleiben vorne, col-actions hinten.
// Drag nur fuer interne Nutzer (!isKunde).

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';
import { getOrderedColumns, getDefaultColumnIds, isCustomColumnId, getBuiltinColumn } from './ColumnRegistry.js';

/** Randzone in px, in der beim Spalten-Ziehen auto-gescrollt wird */
const DRAG_SCROLL_EDGE = 64;
const DRAG_SCROLL_STEP = 22;

// Fixierte Spalten: nicht verschiebbar, bleiben an ihren Enden.
const LOCKED_COLUMN_IDS = new Set(['col-nr', 'col-creator', 'col-actions']);

let _dragGhost = null;
/**
 * 1x1 leeres Element als Ersatz fuer die native Header-Ghost.
 * Muss im DOM haengen (ausserhalb des Viewports): Chrome "fotografiert"
 * losgeloeste Elemente (z.B. ein Canvas ohne DOM-Anbindung) am
 * Dokument-Ursprung und animiert die Drag-Vorschau von dort zur Maus -
 * sichtbar als Icon/Ball, das von links oben reinfliegt. Ein leeres div
 * hat nichts Sichtbares zu rendern, das Drag-Image ist damit unsichtbar.
 */
function getTransparentDragGhost() {
  if (_dragGhost && _dragGhost.isConnected) return _dragGhost;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;overflow:hidden;pointer-events:none;';
  document.body.appendChild(el);
  _dragGhost = el;
  return el;
}

export class ColumnDragHandler {
  constructor(table) {
    this.table = table;
    this._dragCol = null;
    this._dragOverCol = null;
    this._indicator = null;
    this._container = null;
  }

  bind(container, signal) {
    if (!container) return;
    this._container = container;

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

    const colId = this._getColId(th);
    if (!colId || this._isLocked(colId) || this.table.isKundeRole?.()) {
      e.preventDefault();
      return;
    }

    this._dragCol = colId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
    // Native Ghost killen - sonst fliegt weiter nur der <th> durch die Gegend.
    if (typeof e.dataTransfer.setDragImage === 'function') {
      e.dataTransfer.setDragImage(getTransparentDragGhost(), 0, 0);
    }
    this._setColumnHighlight(colId, true);
  }

  _onDragOver(e) {
    if (!this._dragCol) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const th = e.target.closest('th');
    if (!th) return;

    this._autoScroll(th, e.clientX);

    const targetId = this._getColId(th);
    if (!targetId || targetId === this._dragCol) {
      this._removeIndicator();
      return;
    }

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
    const targetId = th ? this._getColId(th) : null;

    if (targetId && this._dragCol && targetId !== this._dragCol) {
      this._reorderColumns(this._dragCol, targetId, e, th);
    }
    this._cleanup();
  }

  _onDragEnd() {
    this._cleanup();
  }

  _getColId(th) {
    if (th.dataset?.colId) return th.dataset.colId;
    // Fallback: CSS-Klassen der th durchsuchen um col-* oder custom:* zu finden
    for (const cls of th.classList) {
      if (cls.startsWith('col-') && cls !== 'col-header') return cls;
      if (cls.startsWith('custom:')) return cls;
    }
    return null;
  }

  /** Fixierte Spalten (Nr/Creator/Aktionen) sind nicht verschiebbar. */
  _isLocked(colId) {
    const builtin = getBuiltinColumn(colId);
    if (builtin) return builtin.configurable === false;
    return !isCustomColumnId(colId);
  }

  /** Dimmung der kompletten Quellspalte: Header + alle Body-Zellen. */
  _setColumnHighlight(colId, on) {
    const scope = this._container || document;
    const escaped = window.CSS?.escape ? CSS.escape(colId) : colId;
    scope.querySelectorAll(`[data-col-id="${escaped}"]`).forEach(el => {
      el.classList.toggle('column-dragging', on);
    });
  }

  /** Horizontales Auto-Scrollen am Rand von .grid-wrapper. */
  _autoScroll(th, clientX) {
    const wrapper = th.closest('.grid-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (clientX < rect.left + DRAG_SCROLL_EDGE) {
      wrapper.scrollLeft -= DRAG_SCROLL_STEP;
    } else if (clientX > rect.right - DRAG_SCROLL_EDGE) {
      wrapper.scrollLeft += DRAG_SCROLL_STEP;
    }
  }

  _showIndicator(th, e) {
    const thRect = th.getBoundingClientRect();
    // Volle Tabellenhoehe statt nur Header-Hoehe
    const table = th.closest('table');
    const tableRect = table ? table.getBoundingClientRect() : thRect;
    const isLeft = (e.clientX - thRect.left) < thRect.width / 2;

    if (!this._indicator) {
      this._indicator = document.createElement('div');
      this._indicator.className = 'column-drop-indicator';
      document.body.appendChild(this._indicator);
    }

    this._indicator.style.top = `${tableRect.top}px`;
    this._indicator.style.height = `${tableRect.height}px`;
    this._indicator.style.left = isLeft ? `${thRect.left - 1}px` : `${thRect.right - 1}px`;
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

    // Fixierte Spalten herausloesen: Nr/Creator bleiben vorne, Aktionen hinten.
    // Gerechnet wird nur im verschiebbaren Teil.
    const fixedHead = ['col-nr', 'col-creator'].filter(id => order.includes(id));
    const fixedTail = order.includes('col-actions') ? ['col-actions'] : [];
    const movable = order.filter(id => !LOCKED_COLUMN_IDS.has(id));

    const dragIdx = movable.indexOf(dragId);
    if (dragIdx === -1) return;
    movable.splice(dragIdx, 1);

    let targetIdx = movable.indexOf(targetId);
    if (targetIdx === -1) {
      // Drop auf eine fixierte Spalte: Creator = erste bewegliche Position,
      // Aktionen = letzte Position vor den Aktionen.
      targetIdx = targetId === 'col-actions' ? movable.length : 0;
    } else {
      const rect = targetTh.getBoundingClientRect();
      const isAfter = (event.clientX - rect.left) >= rect.width / 2;
      if (isAfter) targetIdx++;
    }

    movable.splice(targetIdx, 0, dragId);
    const newOrder = [...fixedHead, ...movable, ...fixedTail];

    store.setColumnOrder(newOrder);
    this.table.refilter();

    try {
      await CustomColumnDataLoader.saveColumnOrder(this.table.kampagneId, newOrder);
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
    this._container = null;
  }
}
