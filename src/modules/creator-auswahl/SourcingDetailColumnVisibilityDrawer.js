// SourcingDetailColumnVisibilityDrawer.js (ES6-Modul)
// Drawer zur Verwaltung der Spalten-Sichtbarkeit für Kunden in der Sourcing Detail-Tabelle

export class SourcingDetailColumnVisibilityDrawer {
  constructor(hiddenColumns, onSave) {
    this.hiddenColumns = hiddenColumns || [];
    this.onSave = onSave; // Callback wenn gespeichert wird
    this.drawerId = 'sourcing-detail-column-visibility-drawer';
    
    // Alle verfügbaren Spalten mit benutzerfreundlichen Namen
    // Name und Aktionen sind immer sichtbar und können nicht deaktiviert werden
    this.columns = [
      { className: 'cp-col-typ', label: 'Creator Art' },
      { className: 'cp-col-link-ig', label: 'Link Instagram' },
      { className: 'cp-col-follower-ig', label: 'Follower Instagram' },
      { className: 'cp-col-link-tt', label: 'Link TikTok' },
      { className: 'cp-col-follower-tt', label: 'Follower TikTok' },
      { className: 'cp-col-location', label: 'Location' },
      { className: 'cp-col-notiz', label: 'Kurzbeschreibung' },
      { className: 'cp-col-angefragt', label: 'Angefragt' },
      { className: 'cp-col-feedback', label: 'Rückmeldung Kunde' },
      { className: 'cp-col-prio1', label: 'Buchen' },
      { className: 'cp-col-prio2', label: 'Prio 2' },
      { className: 'cp-col-nicht', label: 'Nicht buchen' },
      { className: 'cp-col-check', label: 'Rückmeldung' },
      { className: 'cp-col-pricing', label: 'Pricing' }
    ];
  }

  // Öffne den Drawer
  open() {
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
    title.textContent = 'Spalten-Sichtbarkeit für Kunden';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Deaktivierte Spalten werden nur für Kunden ausgeblendet';
    
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
    body.querySelector('#btn-close-sourcing-detail-visibility-drawer').addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindEvents();
  }

  // Entferne Drawer
  removeDrawer() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  // Schließe den Drawer
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

  // Rendere den Inhalt des Drawers
  renderContent() {
    const rows = this.columns.map(col => {
      const isVisible = !this.hiddenColumns.includes(col.className);
      return `
        <tr>
          <td style="text-align: left;">${col.label}</td>
          <td style="text-align: right;">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                class="column-visibility-toggle" 
                data-column="${col.className}" 
                ${isVisible ? 'checked' : ''}
              >
              <span class="toggle-slider"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left;">Spalte</th>
              <th style="text-align: right;">Sichtbar für Kunden</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <p class="drawer-info-text" style="margin: 16px 0; color: var(--text-secondary); font-size: 13px;">
        <strong>Hinweis:</strong> Die Spalten "Name" und "Aktionen" sind immer sichtbar und können nicht ausgeblendet werden.
      </p>
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-sourcing-detail-visibility-drawer">
          Fertig
        </button>
      </div>
    `;
  }

  // Binde Event-Listener
  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    // Spalten-Toggles
    const toggles = body.querySelectorAll('.column-visibility-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => this.handleToggle(e));
    });
  }

  // Handle einzelnen Toggle
  handleToggle(event) {
    const columnClass = event.target.dataset.column;
    const isVisible = event.target.checked;

    if (isVisible) {
      // Spalte sichtbar machen (aus hiddenColumns entfernen)
      this.hiddenColumns = this.hiddenColumns.filter(col => col !== columnClass);
    } else {
      // Spalte verstecken (zu hiddenColumns hinzufügen)
      if (!this.hiddenColumns.includes(columnClass)) {
        this.hiddenColumns.push(columnClass);
      }
    }

    // Auto-Save via Callback
    if (this.onSave) {
      this.onSave(this.hiddenColumns);
    }
  }
}
