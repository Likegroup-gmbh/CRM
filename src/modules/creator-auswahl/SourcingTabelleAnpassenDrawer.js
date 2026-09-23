// SourcingTabelleAnpassenDrawer.js (ES6-Modul)
// Drawer "Tabelle anpassen" der Sourcing-Detailseite.
// Nur die Spalten-Sichtbarkeit. Art der Liste, Plattform, Format und TKP
// leben am Briefing und werden von dort fortgeschrieben.

import {
  DEAKTIVIERTE_SPALTEN,
  SOURCING_SPALTEN,
  SOURCING_SPALTEN_LABELS
} from './CreatorAuswahlTemplates.js';

/** Spaltenreihenfolge im Drawer, abgeleitet aus SOURCING_SPALTEN */
const SPALTEN_LABELS = SOURCING_SPALTEN
  .filter(c => SOURCING_SPALTEN_LABELS[c])
  .map(c => ({ className: c, label: SOURCING_SPALTEN_LABELS[c] }));

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
   * @param {object} config.liste geladene Sourcing-Liste (tkp, liste_typ, ...)
   * @param {string[]} config.hiddenColumns
   * @param {Array<{className: string, label: string}>} [config.customColumns]
   * @param {(hiddenColumns: string[]) => Promise<void>|void} config.onHiddenColumnsChange
   * @param {(updates: object) => Promise<void>|void} config.onListeChange
   */
  constructor({ liste, hiddenColumns, customColumns = [], onHiddenColumnsChange, onListeChange }) {
    this.liste = liste || {};
    this.hiddenColumns = hiddenColumns || [];
    this.onHiddenColumnsChange = onHiddenColumnsChange;
    this.onListeChange = onListeChange;
    this.drawerId = 'sourcing-tabelle-anpassen-drawer';

    // Name und Aktionen sind immer sichtbar und tauchen deshalb nicht auf
    this.columns = [
      ...SPALTEN_LABELS,
      // Eigene Spalten (className = "custom:{uuid}")
      ...(customColumns || []).map(c => ({ className: c.className, label: c.label }))
    ].filter(c => !DEAKTIVIERTE_SPALTEN.includes(c.className));
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
    subtitle.textContent = 'Einstellungen der Liste und Sichtbarkeit der Spalten';

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
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, 300);
  }

  renderContent() {
    const rows = this.columns.map(col => {
      const isVisible = !this.hiddenColumns.includes(col.className);
      return `
        <tr>
          <td class="u-text-left">${escapeHtml(col.label)}</td>
          <td class="u-text-right">
            <label class="toggle-switch">
              <input
                type="checkbox"
                class="column-visibility-toggle"
                data-column="${escapeHtml(col.className)}"
                ${isVisible ? 'checked' : ''}
              >
              <span class="toggle-slider"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <h4 class="drawer-section-title">Spalten</h4>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="u-text-left">Spalte</th>
              <th class="u-text-right">Sichtbar</th>
            </tr>
          </thead>
          <tbody id="sourcing-tabelle-anpassen-spalten">
            ${rows}
          </tbody>
        </table>
      </div>
      <p class="drawer-info-text">
        <strong>Hinweis:</strong> Die Spalten "Name" und "Aktionen" sind immer sichtbar und können nicht ausgeblendet werden.
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
