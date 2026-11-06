// SourcingTabelleAnpassenDrawer.js (ES6-Modul)
// Drawer "Tabelle anpassen" der Sourcing-Detailseite.
// Spalten-Sichtbarkeit und Reihenfolge. Art der Liste, Plattform, Format
// und TKP leben am Briefing und werden von dort fortgeschrieben.
// Die Reihenfolge speichert sofort. Name und Aktionen bleiben fest.

import {
  DEAKTIVIERTE_SPALTEN,
  SOURCING_SPALTEN,
  SOURCING_SPALTEN_LABELS
} from './sourcingSpaltenKatalog.js';
import { baueBeweglicheSpalten } from './sourcingSpaltenfolge.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { icon } from '../../core/icons/IconSystem.js';

const SPALTEN_LABELS = new Map(
  SOURCING_SPALTEN
    .filter(c => SOURCING_SPALTEN_LABELS[c])
    .map(c => [c, SOURCING_SPALTEN_LABELS[c]])
);

function eigeneSpaltenFuerFolge(customColumns) {
  return (customColumns || []).flatMap(col => {
    const className = col.className || '';
    if (!className.startsWith('custom:')) return [];
    return [{
      id: className.slice('custom:'.length),
      _anchor: col.anchor ?? col._anchor ?? null,
      name: col.label
    }];
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SourcingTabelleAnpassenDrawer {
  /**
   * @param {object} config
   * @param {object} config.liste geladene Sourcing-Liste
   * @param {string[]} config.hiddenColumns
   * @param {Array<{className: string, label: string, anchor?: string|null}>} [config.customColumns]
   * @param {(hiddenColumns: string[]) => Promise<void>|void} config.onHiddenColumnsChange
   * @param {(updates: object) => Promise<void>|void} config.onListeChange
   * @param {(columnOrder: string[]) => Promise<void>|void} config.onColumnOrderChange
   */
  constructor({ liste, hiddenColumns, customColumns = [], onHiddenColumnsChange, onListeChange, onColumnOrderChange }) {
    this.liste = liste || {};
    this.hiddenColumns = hiddenColumns || [];
    this.onHiddenColumnsChange = onHiddenColumnsChange;
    this.onListeChange = onListeChange;
    this.onColumnOrderChange = onColumnOrderChange;
    this.drawerId = 'sourcing-tabelle-anpassen-drawer';
    this._reorderUnbind = [];
    this._draggedRow = null;

    const labels = new Map(SPALTEN_LABELS);
    for (const col of customColumns || []) {
      if (col.className && col.label) labels.set(col.className, col.label);
    }

    this.columns = baueBeweglicheSpalten({
      columnOrder: this.liste.column_order,
      customColumns: eigeneSpaltenFuerFolge(customColumns)
    })
      .filter(id => !DEAKTIVIERTE_SPALTEN.includes(id) && labels.has(id))
      .map(id => ({ className: id, label: labels.get(id) }));
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
    closeBtn.setAttribute('type', 'button');
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
    body.querySelector('#btn-close-sourcing-tabelle-anpassen-drawer')
      .addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindEvents();
  }

  removeDrawer() {
    this.unbindReorder();
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  close() {
    this.unbindReorder();
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, DRAWER_EXIT_MS);
  }

  renderContent() {
    // Div-Liste statt <tr>: HTML5-Drag an Tabellenzeilen startet in Chrome
    // oft nicht, obwohl der Griff den Grab-Cursor zeigt.
    const rows = this.columns.map(col => {
      const isVisible = !this.hiddenColumns.includes(col.className);
      return `
        <div class="sourcing-spalten-item" data-column="${escapeHtml(col.className)}" draggable="false">
          <span class="sourcing-spalten-griff" data-action="drag-spalte" role="button" tabindex="0" title="Reihenfolge ändern" aria-label="Reihenfolge von ${escapeHtml(col.label)} ändern">
            ${icon('bars-3', { className: 'icon-16' })}
          </span>
          <span class="sourcing-spalten-name">${escapeHtml(col.label)}</span>
          <label class="toggle-switch">
            <input
              type="checkbox"
              class="column-visibility-toggle"
              data-column="${escapeHtml(col.className)}"
              ${isVisible ? 'checked' : ''}
            >
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    }).join('');

    return `
      <h4 class="drawer-section-title">Spalten</h4>
      <div class="sourcing-spalten-kopf">
        <span class="sourcing-spalten-kopf-griff" aria-hidden="true"></span>
        <span>Spalte</span>
        <span class="sourcing-spalten-kopf-sichtbar">Sichtbar</span>
      </div>
      <div class="sourcing-spalten-liste" id="sourcing-tabelle-anpassen-spalten">
        ${rows}
      </div>
      <p class="drawer-info-text">
        <strong>Hinweis:</strong> Die Reihenfolge ändern Sie am Griff. „Name“ und „Aktionen“ bleiben fest und können nicht ausgeblendet werden.
      </p>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-sourcing-tabelle-anpassen-drawer">
          Fertig
        </button>
      </div>
    `;
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
    const list = document.getElementById('sourcing-tabelle-anpassen-spalten');
    if (!list) return;

    const rows = () => list.querySelectorAll('.sourcing-spalten-item');

    // Wie bei den Kategorien: nur der Griff macht die Zeile ziehbar.
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
    const list = document.getElementById('sourcing-tabelle-anpassen-spalten');
    if (!list) return this.columns.map(col => col.className);
    return Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => row.dataset.column);
  }

  async commitReihenfolge() {
    const next = this.aktuelleReihenfolge();
    const vorher = this.columns.map(col => col.className);
    if (next.join('|') === vorher.join('|')) return;

    const nachSpalte = new Map(this.columns.map(col => [col.className, col]));
    const neu = next.map(id => nachSpalte.get(id)).filter(Boolean);
    if (neu.length !== this.columns.length) return;

    this.columns = neu;
    try {
      await this.onColumnOrderChange?.(next);
      if (this.liste) this.liste.column_order = next;
    } catch (error) {
      this.columns = vorher.map(id => nachSpalte.get(id)).filter(Boolean);
      const list = document.getElementById('sourcing-tabelle-anpassen-spalten');
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
    const columnClass = event.target.dataset.column;
    const isVisible = event.target.checked;

    if (isVisible) {
      this.hiddenColumns = this.hiddenColumns.filter(col => col !== columnClass);
    } else if (!this.hiddenColumns.includes(columnClass)) {
      this.hiddenColumns.push(columnClass);
    }

    this.onHiddenColumnsChange?.(this.hiddenColumns);
  }
}
