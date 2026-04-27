// VideoTableColumnVisibilityDrawer.js (ES6-Modul)
// Drawer zur Verwaltung der Spalten-Sichtbarkeit für Kunden in der Video-Tabelle

import { VIDEO_FEEDBACK_FIELDS } from '../../core/VideoFeedbackBuckets.js';

export class VideoTableColumnVisibilityDrawer {
  constructor(kampagneId) {
    this.kampagneId = kampagneId;
    this.hiddenColumns = [];
    this.drawerId = 'video-column-visibility-drawer';
    this._settingsLoaded = false;
    this._openRequestId = 0;
    
    // Alle konfigurierbaren Spalten in exakt derselben Reihenfolge wie im Tabellen-Header
    // (Nr und Creator sind nicht konfigurierbar und daher hier nicht enthalten)
    this.columns = [
      { className: 'col-status', label: 'Status' },
      { className: 'col-tags', label: 'Tags' },
      { className: 'col-extra-kosten', label: 'Extra Kosten' },
      { className: 'col-vertrag', label: 'Vertrag' },
      { className: 'col-nutzungsrechte', label: 'Nutzungsrechte' },
      { className: 'col-start-datum', label: 'Erstellt' },
      { className: 'col-videoanzahl', label: 'Videos' },
      { className: 'col-video-nr', label: 'Video-Nr' },
      { className: 'col-vk-video', label: 'Kosten' },
      { className: 'col-video-script-deadline', label: 'Script Deadline' },
      { className: 'col-video-content-deadline', label: 'Content Deadline' },
      { className: 'col-video-typ', label: 'Typ' },
      { className: 'col-thema', label: 'Thema' },
      { className: 'col-organic-paid', label: 'Content/Art' },
      { className: 'col-produkt', label: 'Produkte' },
      { className: 'col-lieferadresse', label: 'Lieferadresse' },
      { className: 'col-paket-tracking', label: 'Tracking' },
      { className: 'col-drehort', label: 'Drehort' },
      { className: 'col-link-skript', label: 'Link Skript / Briefing' },
      { className: 'col-skript-freigegeben', label: 'Skript freigegeben' },
      { className: 'col-link-content', label: 'Link Content' },
      ...VIDEO_FEEDBACK_FIELDS.map(slot => ({ className: slot.colClass, label: slot.label })),
      { className: 'col-freigabe', label: 'Freigabe' },
      { className: 'col-caption', label: 'Caption' },
      { className: 'col-posting-datum', label: 'Posting Datum' }
    ];
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
    title.textContent = 'Spalten-Sichtbarkeit';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Deaktivierte Spalten werden gemäß Tabellenansicht ausgeblendet';
    
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
    clearTimeout(this._closeTimer);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  // Schließe den Drawer
  close() {
    this._openRequestId += 1;
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    
    if (panel) panel.classList.remove('show');
    
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
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
          <td class="video-visibility-table__cell-left">${col.label}</td>
          <td class="video-visibility-table__cell-right">
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
      <div class="video-visibility-table-wrap">
        <table class="video-visibility-table">
          <thead>
            <tr>
              <th class="video-visibility-table__cell-left">Spalte</th>
              <th class="video-visibility-table__cell-right">Sichtbar</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-visibility-drawer">
          Fertig
        </button>
      </div>
    `;
  }

  // Binde Event-Listener
  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    // Event-Delegation minimiert Listener-Overhead
    body.addEventListener('change', (e) => {
      const toggle = e.target.closest('.column-visibility-toggle');
      if (!toggle) return;
      this.handleToggle(e);
    });
  }

  // Synce Toggle-Zustände im bereits gerenderten DOM (nach async load)
  syncToggleStatesInDom() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const toggles = body.querySelectorAll('.column-visibility-toggle');
    toggles.forEach((toggle) => {
      const columnClass = toggle.dataset.column;
      toggle.checked = !this.hiddenColumns.includes(columnClass);
    });
  }

  // Handle einzelnen Toggle
  async handleToggle(event) {
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

    // Auto-Save
    await this.saveSettings();
  }

  // Toggle alle Spalten
  async toggleAll() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const toggles = body.querySelectorAll('.column-visibility-toggle');
    const allChecked = Array.from(toggles).every(t => t.checked);

    if (allChecked) {
      // Alle verstecken
      this.hiddenColumns = this.columns.map(col => col.className);
      toggles.forEach(t => t.checked = false);
    } else {
      // Alle sichtbar machen
      this.hiddenColumns = [];
      toggles.forEach(t => t.checked = true);
    }

    // Speichern
    await this.saveSettings();
  }
}

