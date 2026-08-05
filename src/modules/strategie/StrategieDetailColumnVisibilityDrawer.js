// StrategieDetailColumnVisibilityDrawer.js
// Drawer zur Spalten-Sichtbarkeit der Strategie-Detail-Tabelle.
// Steuert die festen Spalten (Beschreibung, Transkript, Caption, Prio, ...) und
// die eigenen (Custom-) Spalten ueber dieselbe hidden_columns-Liste.

import {
  STRATEGIE_FIXED_COLUMNS,
  isFixedColumnVisible,
  setFixedColumnVisibility
} from './strategieColumns.js';

export class StrategieDetailColumnVisibilityDrawer {
  /**
   * @param {Array} hiddenColumns  Eintraege "custom:{uuid}", "fixed:{key}" und "show:fixed:{key}"
   * @param {(hidden:Array)=>void} onSave
   * @param {Array<{className:string,label:string}>} customColumns
   */
  constructor(hiddenColumns, onSave, customColumns = []) {
    this.hiddenColumns = hiddenColumns || [];
    this.onSave = onSave;
    this.columns = customColumns || [];
    this.drawerId = 'strategie-detail-column-visibility-drawer';
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
    title.textContent = 'Spalten-Sichtbarkeit';
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Deaktivierte Spalten werden für alle Nutzer ausgeblendet';
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

  renderToggleRow(label, dataAttr, isVisible) {
    return `
      <tr>
        <td style="text-align: left;">${label}</td>
        <td style="text-align: right;">
          <label class="toggle-switch">
            <input type="checkbox" class="column-visibility-toggle" ${dataAttr} ${isVisible ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
      </tr>`;
  }

  renderContent() {
    const fixedRows = STRATEGIE_FIXED_COLUMNS.map(col => this.renderToggleRow(
      col.label,
      `data-fixed-column="${col.key}"`,
      isFixedColumnVisible(this.hiddenColumns, col.key)
    )).join('');

    const customRows = this.columns.map(col => this.renderToggleRow(
      col.label,
      `data-column="${col.className}"`,
      !this.hiddenColumns.includes(col.className)
    )).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th style="text-align: left;">Spalte</th><th style="text-align: right;">Sichtbar</th></tr></thead>
          <tbody>${fixedRows}</tbody>
        </table>
      </div>
      ${this.columns.length > 0 ? `
        <div class="data-table-container" style="margin-top: var(--space-lg);">
          <table class="data-table">
            <thead><tr><th style="text-align: left;">Eigene Spalte</th><th style="text-align: right;">Sichtbar</th></tr></thead>
            <tbody>${customRows}</tbody>
          </table>
        </div>
      ` : '<div class="empty-state-small"><p>Noch keine eigenen Spalten angelegt.</p></div>'}
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-strategie-detail-visibility-drawer">Fertig</button>
      </div>`;
  }

  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.handleToggle(e));
    });
  }

  handleToggle(event) {
    const isVisible = event.target.checked;
    const fixedKey = event.target.dataset.fixedColumn;

    if (fixedKey) {
      this.hiddenColumns = setFixedColumnVisibility(this.hiddenColumns, fixedKey, isVisible);
    } else {
      const columnClass = event.target.dataset.column;
      if (isVisible) {
        this.hiddenColumns = this.hiddenColumns.filter(col => col !== columnClass);
      } else if (!this.hiddenColumns.includes(columnClass)) {
        this.hiddenColumns.push(columnClass);
      }
    }

    this.onSave?.(this.hiddenColumns);
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');
    setTimeout(() => this.removeDrawer(), 300);
  }
}
