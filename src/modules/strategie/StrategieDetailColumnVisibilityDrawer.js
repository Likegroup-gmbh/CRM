// StrategieDetailColumnVisibilityDrawer.js
// Drawer "Tabelle anpassen" der Konzept-Tabelle.
// Sichtbarkeit und Reihenfolge der festen und eigenen Spalten.
// #, Griff, Bild, Plattform und Aktionen bleiben fest.
// Die Reihenfolge speichert sofort.

import {
  STRATEGIE_FIXED_COLUMNS,
  isFixedColumnVisible,
  setFixedColumnVisibility
} from './strategieColumns.js';
import {
  baueStrategieSpaltenfolge,
  fixedKeyAusId,
  fixedSpaltenId
} from './strategieSpaltenfolge.js';
import { isCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { icon } from '../../core/icons/IconSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class StrategieDetailColumnVisibilityDrawer {
  /**
   * @param {Array} hiddenColumns  Eintraege "custom:{uuid}", "fixed:{key}" und "show:fixed:{key}"
   * @param {(hidden:Array)=>void} onSave
   * @param {Array<{className:string,label:string}>} customColumns
   * @param {{funnelStandardSichtbar:boolean}|null} columnContext
   * @param {string[]|null} columnOrder
   * @param {(order:string[])=>void} onColumnOrderChange
   */
  constructor(hiddenColumns, onSave, customColumns = [], columnContext = null, columnOrder = null, onColumnOrderChange = null) {
    this.hiddenColumns = hiddenColumns || [];
    this.onSave = onSave;
    this.columnContext = columnContext;
    this.onColumnOrderChange = onColumnOrderChange;
    this.drawerId = 'strategie-detail-column-visibility-drawer';
    this._reorderUnbind = [];
    this._draggedRow = null;

    const labels = new Map(STRATEGIE_FIXED_COLUMNS.map(col => [fixedSpaltenId(col.key), col.label]));
    for (const col of customColumns || []) {
      if (col.className && col.label) labels.set(col.className, col.label);
    }
    const ids = baueStrategieSpaltenfolge({
      columnOrder,
      customColumnIds: (customColumns || []).map(col => col.className).filter(id => isCustomColumnId(id))
    });
    this.columns = ids
      .filter(id => labels.has(id))
      .map(id => ({ id, label: labels.get(id) }));
  }

  open() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Tabelle anpassen';
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Reihenfolge und Sichtbarkeit der Spalten';
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = this.renderContent();

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    body.querySelector('#btn-close-strategie-detail-visibility-drawer')?.addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => { overlay.classList.add('active'); panel.classList.add('show'); });

    this.bindEvents();
  }

  istSichtbar(columnId) {
    const fixedKey = fixedKeyAusId(columnId);
    if (fixedKey) return isFixedColumnVisible(this.hiddenColumns, fixedKey, this.columnContext);
    return !this.hiddenColumns.includes(columnId);
  }

  renderContent() {
    const rows = this.columns.map(col => `
      <div class="sourcing-spalten-item" data-column="${escapeHtml(col.id)}" draggable="false">
        <span class="sourcing-spalten-griff" data-action="drag-spalte" role="button" tabindex="0" title="Reihenfolge ändern" aria-label="Reihenfolge von ${escapeHtml(col.label)} ändern">
          ${icon('bars-3', { className: 'icon-16' })}
        </span>
        <span class="sourcing-spalten-name">${escapeHtml(col.label)}</span>
        <label class="toggle-switch">
          <input type="checkbox" class="column-visibility-toggle" data-column="${escapeHtml(col.id)}" ${this.istSichtbar(col.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');

    const creatorFest = `
      <div class="sourcing-spalten-item" data-column="col-creator">
        <span class="sourcing-spalten-kopf-griff" aria-hidden="true"></span>
        <span class="sourcing-spalten-name">Creator</span>
        <label class="toggle-switch">
          <input type="checkbox" class="column-visibility-toggle" data-column="col-creator" ${this.istSichtbar('col-creator') ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`;

    return `
      <h4 class="drawer-section-title">Spalten</h4>
      <div class="sourcing-spalten-kopf">
        <span class="sourcing-spalten-kopf-griff" aria-hidden="true"></span>
        <span>Spalte</span>
        <span class="sourcing-spalten-kopf-sichtbar">Sichtbar</span>
      </div>
      ${creatorFest}
      <div class="sourcing-spalten-liste" id="strategie-tabelle-anpassen-spalten">
        ${rows}
      </div>
      <p class="drawer-info-text">
        <strong>Hinweis:</strong> Die Reihenfolge ändern Sie am Griff. „#“, „Profil“, „Creator“, „Bild“, „Plattform“ und „Aktionen“ bleiben fest.
      </p>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-strategie-detail-visibility-drawer">Fertig</button>
      </div>`;
  }

  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.handleToggle(e));
    });
    this.bindReorder();
  }

  unbindReorder() {
    this._reorderUnbind.forEach(fn => fn());
    this._reorderUnbind = [];
    this._draggedRow = null;
  }

  bindReorder() {
    this.unbindReorder();
    const list = document.getElementById('strategie-tabelle-anpassen-spalten');
    if (!list) return;

    const rows = () => list.querySelectorAll('.sourcing-spalten-item');

    list.querySelectorAll('[data-action="drag-spalte"]').forEach(handle => {
      const onMouseDown = () => {
        handle.closest('.sourcing-spalten-item')?.setAttribute('draggable', 'true');
      };
      handle.addEventListener('mousedown', onMouseDown);
      this._reorderUnbind.push(() => handle.removeEventListener('mousedown', onMouseDown));
    });

    const onMouseUp = () => {
      rows().forEach(row => row.setAttribute('draggable', 'false'));
    };
    document.addEventListener('mouseup', onMouseUp);
    this._reorderUnbind.push(() => document.removeEventListener('mouseup', onMouseUp));

    rows().forEach(row => {
      const onDragStart = (e) => {
        this._draggedRow = row;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', row.dataset.column); } catch { /* jsdom */ }
      };
      const onDragEnd = async () => {
        row.classList.remove('is-dragging');
        row.setAttribute('draggable', 'false');
        this._draggedRow = null;
        list.querySelectorAll('.sourcing-spalten-item.drag-over')
          .forEach(el => el.classList.remove('drag-over'));
        await this.commitReihenfolge();
      };
      const onDragOver = (e) => {
        e.preventDefault();
        const dragged = this._draggedRow;
        if (!dragged || dragged === row) return;
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const siblings = Array.from(list.children);
        const from = siblings.indexOf(dragged);
        const to = siblings.indexOf(row);
        if (from < 0 || to < 0) return;
        list.insertBefore(dragged, from < to ? row.nextSibling : row);
      };
      const onDrop = (e) => e.preventDefault();

      row.addEventListener('dragstart', onDragStart);
      row.addEventListener('dragend', onDragEnd);
      row.addEventListener('dragover', onDragOver);
      row.addEventListener('drop', onDrop);
      this._reorderUnbind.push(() => {
        row.removeEventListener('dragstart', onDragStart);
        row.removeEventListener('dragend', onDragEnd);
        row.removeEventListener('dragover', onDragOver);
        row.removeEventListener('drop', onDrop);
      });
    });
  }

  aktuelleReihenfolge() {
    const list = document.getElementById('strategie-tabelle-anpassen-spalten');
    if (!list) return this.columns.map(col => col.id);
    return Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => row.dataset.column);
  }

  async commitReihenfolge() {
    const next = this.aktuelleReihenfolge();
    const vorher = this.columns.map(col => col.id);
    if (next.join('|') === vorher.join('|')) return;

    const nachSpalte = new Map(this.columns.map(col => [col.id, col]));
    const neu = next.map(id => nachSpalte.get(id)).filter(Boolean);
    if (neu.length !== this.columns.length) return;

    this.columns = neu;
    try {
      await this.onColumnOrderChange?.(next);
    } catch (error) {
      this.columns = vorher.map(id => nachSpalte.get(id)).filter(Boolean);
      const list = document.getElementById('strategie-tabelle-anpassen-spalten');
      if (list) {
        const zeilen = new Map(
          Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => [row.dataset.column, row])
        );
        for (const id of vorher) {
          const row = zeilen.get(id);
          if (row) list.appendChild(row);
        }
      }
      console.error('Spalten-Reihenfolge speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Reihenfolge konnte nicht gespeichert werden', 'error');
    }
  }

  handleToggle(event) {
    const isVisible = event.target.checked;
    const columnId = event.target.dataset.column;
    const fixedKey = fixedKeyAusId(columnId);

    if (fixedKey) {
      this.hiddenColumns = setFixedColumnVisibility(this.hiddenColumns, fixedKey, isVisible, this.columnContext);
    } else if (isVisible) {
      this.hiddenColumns = this.hiddenColumns.filter(col => col !== columnId);
    } else if (!this.hiddenColumns.includes(columnId)) {
      this.hiddenColumns = [...this.hiddenColumns, columnId];
    }

    this.onSave?.(this.hiddenColumns);
  }

  removeDrawer() {
    this.unbindReorder();
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    this.unbindReorder();
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, DRAWER_EXIT_MS);
  }
}
