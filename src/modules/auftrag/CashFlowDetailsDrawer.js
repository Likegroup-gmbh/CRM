/**
 * CashFlowDetailsDrawer - Zeigt Details zu Teilrechnungen eines bestimmten Monats
 * Wird geöffnet beim Klick auf eine Zelle im Cash Flow Kalender
 */

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export class CashFlowDetailsDrawer {
  constructor() {
    this.drawer = null;
    this.entries = [];
  }

  /**
   * Öffnet den Drawer mit den Teilrechnungs-Einträgen für eine bestimmte Zelle
   * @param {Array} entries - Array von TR-Einträgen (entryId, auftragsname, betrag, status, reNr, position, ...)
   * @param {string} unternehmenName - Name des Unternehmens
   * @param {string} markeName - Name der Marke (optional)
   * @param {string} monatName - Name des Monats (z.B. "Jan")
   * @param {number} year - Jahr
   */
  async open(entries, unternehmenName, markeName, monatName, year) {
    this.entries = entries;
    this.unternehmenName = unternehmenName;
    this.markeName = markeName;
    this.monatName = monatName;
    this.year = year;

    this.createDrawer();
    this.bindEvents();

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
      <div class="drawer-panel drawer-panel--xwide">
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
          <h2 class="drawer-title">Kundenrechnungen im ${this.monatName} ${this.year}</h2>
          <p class="drawer-subtitle">${this.escapeHtml(this.unternehmenName)}${markeInfo}</p>
        </div>
        <button class="drawer-close-btn" data-action="close">&times;</button>
      </div>
    `;
  }

  /**
   * Rendert den Drawer-Body mit der Teilrechnungs-Tabelle
   */
  renderBody() {
    if (this.entries.length === 0) {
      return `
        <div class="drawer-body">
          ${renderEmptyState({ icon: 'invoice', title: 'Keine Rechnungen gefunden' })}
        </div>
      `;
    }

    const gesamtNetto = this.entries.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);

    return `
      <div class="drawer-body">
        <div class="table-container">
          <table class="data-table cash-flow-details-table">
            <thead>
              <tr>
                <th class="w-pct-30">Auftragsname</th>
                <th class="w-pct-15">RE-Nr</th>
                <th class="w-pct-15">Nettobetrag</th>
                <th class="w-pct-12">Status</th>
                <th class="w-pct-14">Rechnung gestellt</th>
                <th class="w-pct-14">Überwiesen</th>
              </tr>
            </thead>
            <tbody>
              ${this.entries.map(entry => this.renderEntryRow(entry)).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td class="u-text-left fw-600">Gesamt:</td>
                <td></td>
                <td class="fw-600">${this.formatCurrency(gesamtNetto)}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Rendert eine einzelne Teilrechnungs-Zeile
   */
  renderEntryRow(entry) {
    const checkIcon = `<span class="status-badge status-success">
      ${icon('check-bold')}
    </span>`;
    const dashIcon = `<span class="status-badge status-inactive">—</span>`;

    const rechnungGestellt = entry.rechnung_gestellt ? checkIcon : dashIcon;
    const ueberwiesen = entry.ueberwiesen ? checkIcon : dashIcon;

    const rechnungDatum = entry.rechnung_gestellt_am
      ? `<br><small class="u-text-secondary">${this.formatDate(entry.rechnung_gestellt_am)}</small>`
      : '';
    const ueberwiesenDatum = entry.ueberwiesen_am
      ? `<br><small class="u-text-secondary">${this.formatDate(entry.ueberwiesen_am)}</small>`
      : '';

    const statusMap = { paid: 'Bezahlt', invoiced: 'Gestellt', pending: 'Offen' };
    const statusClass = { paid: 'status-success', invoiced: 'status-warning', pending: 'status-inactive' };
    const statusLabel = statusMap[entry.status] || 'Offen';
    const statusCls = statusClass[entry.status] || 'status-inactive';

    return `
      <tr>
        <td class="u-text-left">${this.escapeHtml(entry.auftragsname || 'Unbenannt')}</td>
        <td>${this.escapeHtml(entry.reNr || '—')}</td>
        <td class="fw-500">${this.formatCurrency(entry.betrag)}</td>
        <td><span class="status-badge ${statusCls}">${statusLabel}</span></td>
        <td>${rechnungGestellt}${rechnungDatum}</td>
        <td>${ueberwiesen}${ueberwiesenDatum}</td>
      </tr>
    `;
  }


  /**
   * Rendert den Drawer-Footer
   */
  renderFooter() {
    return `
      <div class="drawer-footer">
        <button class="mdc-btn" data-action="close">Schließen</button>
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

