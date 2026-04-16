/**
 * CashFlowDetailsDrawer - Zeigt Details zu Aufträgen eines bestimmten Monats
 * Wird geöffnet beim Klick auf eine Zelle im Cash Flow Kalender
 */
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';

export class CashFlowDetailsDrawer {
  constructor() {
    this.drawer = null;
    this.auftraege = [];
  }

  /**
   * Öffnet den Drawer mit den Aufträgen für eine bestimmte Zelle
   * @param {Array} auftraege - Array von Auftrag-Objekten
   * @param {string} unternehmenName - Name des Unternehmens
   * @param {string} markeName - Name der Marke (optional)
   * @param {string} monatName - Name des Monats (z.B. "Januar")
   * @param {number} year - Jahr
   */
  async open(auftraege, unternehmenName, markeName, monatName, year) {
    this.auftraege = auftraege;
    this.unternehmenName = unternehmenName;
    this.markeName = markeName;
    this.monatName = monatName;
    this.year = year;

    this.createDrawer();
    this.bindEvents();

    // Animation
    requestAnimationFrame(() => {
      this.drawer.classList.add('active');
    });
  }

  /**
   * Erstellt die Drawer-DOM-Struktur
   */
  createDrawer() {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = `
      <div class="drawer-panel drawer-panel-wide">
        ${this.renderHeader()}
        ${this.renderBody()}
        ${this.renderFooter()}
      </div>
    `;

    document.body.appendChild(overlay);
    this.drawer = overlay;
  }

  /**
   * Rendert den Drawer-Header
   */
  renderHeader() {
    const markeInfo = this.markeName ? ` - ${this.markeName}` : '';
    return `
      <div class="drawer-header">
        <div>
          <h2 class="drawer-title">Aufträge im ${this.monatName} ${this.year}</h2>
          <p class="drawer-subtitle">${this.escapeHtml(this.unternehmenName)}${markeInfo}</p>
        </div>
        <button class="drawer-close-btn" data-action="close">&times;</button>
      </div>
    `;
  }

  /**
   * Rendert den Drawer-Body mit der Auftrags-Tabelle
   */
  renderBody() {
    if (this.auftraege.length === 0) {
      return `
        <div class="drawer-body">
          <div class="empty-state">
            <p>Keine Aufträge gefunden.</p>
          </div>
        </div>
      `;
    }

    // Berechne Gesamtsumme
    const gesamtNetto = this.auftraege.reduce((sum, a) => sum + (parseFloat(a.nettobetrag) || 0), 0);

    return `
      <div class="drawer-body">
        <div class="table-container">
          <table class="data-table cash-flow-details-table">
            <thead>
              <tr>
                <th style="width: 40%;">Auftragsname</th>
                <th style="width: 15%;">Status</th>
                <th style="width: 15%;">Nettobetrag</th>
                <th style="width: 15%;">Rechnung gestellt</th>
                <th style="width: 15%;">Überwiesen</th>
              </tr>
            </thead>
            <tbody>
              ${this.auftraege.map(auftrag => this.renderAuftragRow(auftrag)).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td style="text-align: left; font-weight: 600;">Gesamt:</td>
                <td></td>
                <td style="font-weight: 600;">${this.formatCurrency(gesamtNetto)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Rendert eine einzelne Auftrags-Zeile
   */
  renderAuftragRow(auftrag) {
    const statusBadge = renderAuftragAmpel(auftrag.status);
    const rechnungGestellt = auftrag.rechnung_gestellt 
      ? `<span class="status-badge status-success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </span>` 
      : `<span class="status-badge status-inactive">—</span>`;
    const ueberwiesen = auftrag.ueberwiesen 
      ? `<span class="status-badge status-success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </span>` 
      : `<span class="status-badge status-inactive">—</span>`;
    
    const rechnungDatum = auftrag.rechnung_gestellt_am 
      ? `<br><small style="color: var(--text-secondary);">${this.formatDate(auftrag.rechnung_gestellt_am)}</small>` 
      : '';
    const ueberwiesenDatum = auftrag.ueberwiesen_am 
      ? `<br><small style="color: var(--text-secondary);">${this.formatDate(auftrag.ueberwiesen_am)}</small>` 
      : '';

    return `
      <tr>
        <td style="text-align: left;">${this.escapeHtml(auftrag.auftragsname || 'Unbenannt')}</td>
        <td>${statusBadge}</td>
        <td style="font-weight: 500;">${this.formatCurrency(auftrag.nettobetrag)}</td>
        <td>${rechnungGestellt}${rechnungDatum}</td>
        <td>${ueberwiesen}${ueberwiesenDatum}</td>
      </tr>
    `;
  }

  /**
   * Gibt ein Status-Badge zurück
   */
  getStatusBadge(status) {
    const statusMap = {
      'offen': { label: 'Offen', class: 'status-warning' },
      'in_bearbeitung': { label: 'In Bearbeitung', class: 'status-info' },
      'abgeschlossen': { label: 'Abgeschlossen', class: 'status-success' },
      'storniert': { label: 'Storniert', class: 'status-error' }
    };

    const statusInfo = statusMap[status] || { label: status || 'Unbekannt', class: 'status-inactive' };
    return `<span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>`;
  }

  /**
   * Rendert den Drawer-Footer
   */
  renderFooter() {
    return `
      <div class="drawer-footer">
        <button class="primary-btn" data-action="close">Schließen</button>
      </div>
    `;
  }

  /**
   * Bindet Event-Listener
   */
  bindEvents() {
    // Close-Buttons
    this.drawer.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Overlay-Click
    this.drawer.addEventListener('click', (e) => {
      if (e.target === this.drawer) {
        this.close();
      }
    });

    // ESC-Taste
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  /**
   * Schließt den Drawer
   */
  close() {
    this.drawer.classList.remove('active');
    
    setTimeout(() => {
      document.removeEventListener('keydown', this.escapeHandler);
      this.drawer.remove();
      this.drawer = null;
    }, 300);
  }

  /**
   * Formatiert einen Währungsbetrag
   */
  formatCurrency(value) {
    if (!value || isNaN(value)) return '0,00 €';
    const formatted = parseFloat(value).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${formatted} €`;
  }

  /**
   * Formatiert ein Datum
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Escaped HTML zur Vermeidung von XSS
   */
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

