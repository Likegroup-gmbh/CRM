// VideoTableColumnVisibilityDrawer.js
// Drawer "Tabelle anpassen" der Kooperationstabelle.
// Sichtbarkeit und Reihenfolge. Nr, Creator und Aktionen bleiben fest.
// Die Reihenfolge speichert sofort in kampagne.column_order.

import { getConfigurableColumns, isColumnPreferredVisible, setColumnPreferredVisible, orderWithMovableSequence } from './columns/ColumnRegistry.js';
import { CustomColumnDataLoader } from './columns/CustomColumnDataLoader.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { icon } from '../../core/icons/IconSystem.js';
import { bindGripReorder } from '../../core/list/gripReorder.js';
import { renderSpalteHinzufuegen, renderSpaltenName } from '../../core/customColumns/tabelleSpaltenPflege.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class VideoTableColumnVisibilityDrawer {
  constructor(kampagneId, store, { onTableRefresh, onPflege } = {}) {
    this.kampagneId = kampagneId;
    this.store = store || null;
    this.onTableRefresh = onTableRefresh || null;
    this.onPflege = onPflege || null;
    this.hiddenColumns = [];
    this.drawerId = 'video-column-visibility-drawer';
    this._settingsLoaded = false;
    this._openRequestId = 0;
    this._reorderUnbind = [];
    this._draggedRow = null;
    this._movableIds = [];
    this._pflegeBound = false;
    this._changeBound = false;
  }

  get columns() {
    return getConfigurableColumns(this.store).map(col => ({
      className: col.id,
      label: col.label
    }));
  }

  // Lade die aktuellen Sichtbarkeits-Einstellungen
  async loadSettings(forceReload = false) {
    if (this._settingsLoaded && !forceReload) return;

    try {
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('video_table_hidden_columns')
        .eq('id', this.kampagneId)
        .single();

      if (error) throw error;

      this.hiddenColumns = data?.video_table_hidden_columns || [];
      this._settingsLoaded = true;
    } catch (error) {
      this.hiddenColumns = [];
      this._settingsLoaded = false;
    }
  }

  // Speichere die Sichtbarkeits-Einstellungen
  async saveSettings() {
    try {
      const { error } = await window.supabase
        .from('kampagne')
        .update({ video_table_hidden_columns: this.hiddenColumns })
        .eq('id', this.kampagneId);

      if (error) throw error;
      
      // Event auslösen, damit die Tabelle sich aktualisiert
      window.dispatchEvent(new CustomEvent('video-column-visibility-changed', {
        detail: { kampagneId: this.kampagneId, hiddenColumns: this.hiddenColumns }
      }));
      
    } catch (error) {
      alert('Fehler beim Speichern der Einstellungen');
    }
  }

  // Öffne den Drawer
  async open() {
    const openRequestId = ++this._openRequestId;

    // Entferne existierenden Drawer
    this.removeDrawer();

    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Erstelle Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    // Header
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

    // Body (mit Footer drin)
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = this.renderContent();

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    body.querySelector('#btn-close-visibility-drawer').addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });

    this.bindEvents();

    // Settings im Hintergrund laden, damit der Drawer sofort sichtbar ist
    this.loadSettings()
      .then(() => {
        // Nur aktualisieren, wenn dieser Drawer-Open noch aktuell ist
        if (openRequestId !== this._openRequestId) return;
        if (!document.getElementById(this.drawerId)) return;
        this.syncToggleStatesInDom();
      })
      .catch(() => {
        // stiller Fallback: Drawer bleibt bedienbar mit aktuellem State
      });
  }

  // Entferne Drawer
  removeDrawer() {
    this.unbindReorder();
    this._pflegeBound = false;
    this._changeBound = false;
    clearTimeout(this._closeTimer);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  // Schließe den Drawer
  close() {
    this.unbindReorder();
    this._openRequestId += 1;
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    
    if (panel) panel.classList.remove('show');
    
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, DRAWER_EXIT_MS);
  }

  destroy() {
    this._openRequestId += 1;
    clearTimeout(this._closeTimer);
    this.removeDrawer();
    this._settingsLoaded = false;
    this.hiddenColumns = [];
  }

  // Rendere den Inhalt des Drawers
  renderContent() {
    const columns = this.columns;
    this._movableIds = columns.map(col => col.className);
    const rows = columns.map(col => {
      const isVisible = isColumnPreferredVisible(col.className, this.hiddenColumns);
      return `
        <div class="sourcing-spalten-item" data-column="${escapeHtml(col.className)}" draggable="false">
          <span class="sourcing-spalten-griff" data-action="drag-spalte" role="button" tabindex="0" title="Reihenfolge ändern" aria-label="Reihenfolge von ${escapeHtml(col.label)} ändern">
            ${icon('bars-3', { className: 'icon-16' })}
          </span>
          ${renderSpaltenName(col.label, col.className)}
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
      <div class="sourcing-spalten-liste" id="video-tabelle-anpassen-spalten">
        ${rows}
      </div>
      ${renderSpalteHinzufuegen()}
      <p class="drawer-info-text">
        <strong>Hinweis:</strong> Die Reihenfolge ändern Sie am Griff. „Nr“, „Creator“ und „Aktionen“ bleiben fest.
      </p>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-visibility-drawer">
          Fertig
        </button>
      </div>
    `;
  }

  // Binde Event-Listener
  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    if (!this._changeBound) {
      this._changeBound = true;
      body.addEventListener('change', (e) => {
        const toggle = e.target.closest('.column-visibility-toggle');
        if (!toggle || !body.contains(toggle)) return;
        this.handleToggle(e);
      });
    }
    this.bindReorder();
    this._bindPflegeOnce();
  }

  restoreList() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = this.renderContent();
    this.bindEvents();
  }

  openPflege(columnId) {
    if (!this.onPflege) return;
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    this.unbindReorder();
    this.onPflege(body, {
      columnId,
      onBack: () => this.restoreList()
    });
  }

  _bindPflegeOnce() {
    if (this._pflegeBound) return;
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    this._pflegeBound = true;
    body.addEventListener('click', (event) => {
      const add = event.target.closest('[data-action="spalte-hinzufuegen"]');
      const edit = event.target.closest('[data-action="spalte-bearbeiten"]');
      if ((!add && !edit) || !body.contains(event.target)) return;
      event.preventDefault();
      this.openPflege(edit ? edit.dataset.column : null);
    });
  }

  unbindReorder() {
    this._reorderUnbind.forEach(fn => fn());
    this._reorderUnbind = [];
    this._draggedRow = null;
  }

  bindReorder() {
    this.unbindReorder();
    const list = document.getElementById('video-tabelle-anpassen-spalten');
    if (!list) return;
    this._reorderUnbind.push(bindGripReorder(list, {
      rowSelector: '.sourcing-spalten-item',
      handleSelector: '[data-action="drag-spalte"]',
      onCommit: () => this.commitReihenfolge()
    }));
  }

  aktuelleReihenfolge() {
    const list = document.getElementById('video-tabelle-anpassen-spalten');
    if (!list) return this._movableIds;
    return Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => row.dataset.column);
  }

  restoreReihenfolge(ids) {
    const list = document.getElementById('video-tabelle-anpassen-spalten');
    if (!list) return;
    const zeilen = new Map(
      Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => [row.dataset.column, row])
    );
    for (const id of ids) {
      const row = zeilen.get(id);
      if (row) list.appendChild(row);
    }
  }

  async commitReihenfolge() {
    const nextMovable = this.aktuelleReihenfolge();
    const vorherMovable = this._movableIds;
    if (nextMovable.join('|') === vorherMovable.join('|')) return;

    const vorherFull = this.store?.columnOrder ?? null;
    const nextFull = orderWithMovableSequence(this.store, nextMovable);
    this._movableIds = nextMovable;
    this.store?.setColumnOrder(nextFull);

    try {
      await CustomColumnDataLoader.saveColumnOrder(this.kampagneId, nextFull);
      this.onTableRefresh?.();
    } catch (error) {
      this._movableIds = vorherMovable;
      this.store?.setColumnOrder(vorherFull);
      this.restoreReihenfolge(vorherMovable);
      this.onTableRefresh?.();
      console.error('Spalten-Reihenfolge speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Reihenfolge konnte nicht gespeichert werden', 'error');
    }
  }

  // Synce Toggle-Zustände im bereits gerenderten DOM (nach async load)
  syncToggleStatesInDom() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const toggles = body.querySelectorAll('.column-visibility-toggle');
    toggles.forEach((toggle) => {
      const columnClass = toggle.dataset.column;
      toggle.checked = isColumnPreferredVisible(columnClass, this.hiddenColumns);
    });
  }

  // Handle einzelnen Toggle
  async handleToggle(event) {
    const columnClass = event.target.dataset.column;
    const isVisible = event.target.checked;

    this.hiddenColumns = setColumnPreferredVisible(this.hiddenColumns, columnClass, isVisible);

    // Auto-Save
    await this.saveSettings();
  }

  // Toggle alle Spalten
  async toggleAll() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const toggles = body.querySelectorAll('.column-visibility-toggle');
    const allChecked = Array.from(toggles).every(t => t.checked);

    const columnIds = this.columns.map(col => col.className);
    this.hiddenColumns = columnIds.reduce(
      (list, colId) => setColumnPreferredVisible(list, colId, !allChecked),
      []
    );
    toggles.forEach(t => { t.checked = !allChecked; });

    // Speichern
    await this.saveSettings();
  }
}
