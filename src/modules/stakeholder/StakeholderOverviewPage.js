// StakeholderOverviewPage.js
// Fassade der Stakeholder-Gesamtübersicht (/admin, Accounting-Dashboard).
// Zeitraum-Filter + Leistungsbereich-Auswahl, Budget-Karten, Kundenliste,
// Zahlungsstand und Monatsauswertung. Rechenquelle: calculateBudgetOverview.

import { escapeHtml, formatEuro } from '../../core/format.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { aggregate as aggregateOverview, loadData as loadStakeholderData, rechnungsstatus as berechneRechnungsstatus } from './stakeholderOverviewData.js';
import { renderKalkulationBody } from './stakeholderKalkulationView.js';
import { TAB_GESAMT_OHNE, availableYears, tabCounts, visibleTabs } from './stakeholderOverviewLogic.js';
import { oeffneBerichtsstand, renderMonatsauswertung, sichereBerichtsstand } from './stakeholderMonatsView.js';
import { onZahlungsstandClick, renderRechnungsstatus } from './stakeholderZahlungsstandView.js';

export {
  elapsedRatio,
  groupRowsByKundeMarke,
  groupTypBadges,
  groupZeitraum,
  mergeFeeSource,
  resolvePercentageFee,
  resolveVolumen,
} from './stakeholderOverviewLogic.js';

export class StakeholderOverviewPage {
  constructor() {
    this.auftraege = [];
    this.blocks = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.rechnungen = [];
    this.teilrechnungen = [];
    this.detailsByAuftrag = new Map();
    this.unternehmenById = new Map();
    this.selectedYear = 'all';
    this.activeTab = TAB_GESAMT_OHNE;
    // Monatsauswertung (ADR 0006): eigene Ansicht neben der Kalkulation.
    this.activeView = 'kalkulation'; // 'kalkulation' | 'monate'
    this.monatsSicht = 'marge'; // 'marge' | 'buchhaltung'
    this.monatsMetrik = 'differenz'; // 'umsatz' | 'fremdkosten' | 'differenz'
    this._monats = null;
    this._status = null;
    // Berichtsstände (PRD Schritt 7): eingefrorene Stände der Auswertung.
    // aktiverBerichtsstand === null bedeutet Live-Ansicht.
    this.berichtsstaende = [];
    this.aktiverBerichtsstand = null;
    this._eventsBound = false;
    this._docClickHandler = null;
    this._docChangeHandler = null;
    this._berichtWahl = 'live';
    this.zahlungsstandBelegeOffen = null;
  }

  async init() {
    if (!(window.canViewAccounting?.() || window.isAdmin?.())) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – diese Seite ist nur für den Accounting-Bereich.</p>
        </div>
      `);
      return;
    }

    window.setHeadline('Investor-Dashboard');
    window.setContentSafely(window.content, '<div class="stakeholder-loading">Lade Daten...</div>');

    try {
      await this.loadData();
    } catch (e) {
      console.error('❌ Investor-Dashboard: Daten konnten nicht geladen werden', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${this.escape(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }

    this.render();
    this.bindEvents();
  }

  loadData() {
    return loadStakeholderData(this);
  }

  escape(v) {
    return escapeHtml(v);
  }

  fmtEuro(n) {
    return formatEuro(n);
  }

  fmtPct(n) {
    return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  }

  aggregate() {
    return aggregateOverview(this);
  }

  rechnungsstatus() {
    return berechneRechnungsstatus(this);
  }

  render() {
    const years = availableYears(this);
    const counts = tabCounts(this);
    const tabs = visibleTabs(this);
    const isMonate = this.activeView === 'monate';

    const tabOptions = tabs.map(t => `
      <option value="${t.key}"${this.activeTab === t.key ? ' selected' : ''}>${this.escape(t.label)} (${counts.get(t.key) || 0})</option>
    `).join('');

    const html = `
      <div class="stakeholder-page">
        <div class="stakeholder-toolbar">
          ${ViewModeToggle.render([
            { buttonId: 'btn-view-kalkulation', label: 'Kalkulation', active: !isMonate },
            { buttonId: 'btn-view-monate', label: 'Monatsauswertung', active: isMonate },
          ])}
          ${!isMonate ? `
          <div class="stakeholder-toolbar-filters">
            <div class="form-field form-field--inline">
              <label for="stakeholder-tab-select">Leistungsbereich</label>
              <select id="stakeholder-tab-select" class="form-select">
                ${tabOptions}
              </select>
            </div>
            <div class="form-field form-field--inline stakeholder-year-field">
              <label for="stakeholder-year-select">Zeitraum</label>
              <select id="stakeholder-year-select" class="form-select">
                <option value="all"${this.selectedYear === 'all' ? ' selected' : ''}>Alle Jahre</option>
                ${years.map(y => `<option value="${y}"${String(this.selectedYear) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>` : ''}
        </div>
        ${renderRechnungsstatus(this)}

        ${isMonate ? renderMonatsauswertung(this) : renderKalkulationBody(this)}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this._docClickHandler = (e) => {
      const dqLink = e.target.closest('[data-stakeholder-dq-link]');
      if (dqLink) {
        window.navigateTo('/admin/datenqualitaet');
        return;
      }

      const viewBtn = e.target.closest('#btn-view-kalkulation, #btn-view-monate');
      if (viewBtn) {
        this.activeView = viewBtn.id === 'btn-view-monate' ? 'monate' : 'kalkulation';
        // Berichtsstände gehören zur Monatsauswertung: beim Wechsel in die
        // Kalkulation gilt wieder die Live-Rechnung, sonst stuende dort ein
        // eingefrorener Zahlungsstand ohne Weg zurueck.
        if (this.activeView !== 'monate') {
          this.aktiverBerichtsstand = null;
          this.zahlungsstandBelegeOffen = null;
        }
        this.render();
        return;
      }

      const sichtBtn = e.target.closest('#btn-view-marge, #btn-view-buchhaltung');
      if (sichtBtn) {
        this.monatsSicht = sichtBtn.id === 'btn-view-buchhaltung' ? 'buchhaltung' : 'marge';
        this.render();
        return;
      }

      const metrikBtn = e.target.closest('#btn-view-umsatz, #btn-view-fremdkosten, #btn-view-differenz');
      if (metrikBtn) {
        this.monatsMetrik = metrikBtn.id === 'btn-view-fremdkosten' ? 'fremdkosten'
          : metrikBtn.id === 'btn-view-differenz' ? 'differenz'
          : 'umsatz';
        this.render();
        return;
      }

      if (e.target.closest('#stakeholder-bericht-sichern')) {
        sichereBerichtsstand(this);
        return;
      }

      if (onZahlungsstandClick(this, e)) return;
    };
    document.addEventListener('click', this._docClickHandler);

    this._docChangeHandler = (e) => {
      if (e.target?.id === 'stakeholder-tab-select') {
        this.activeTab = e.target.value;
        this.render();
        return;
      }
      if (e.target?.id === 'stakeholder-bericht-select') {
        oeffneBerichtsstand(this, e.target.value);
        return;
      }
      if (e.target?.id !== 'stakeholder-year-select') return;
      this.selectedYear = e.target.value;
      this.render();
    };
    document.addEventListener('change', this._docChangeHandler);
  }

  destroy() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    if (this._docChangeHandler) {
      document.removeEventListener('change', this._docChangeHandler);
      this._docChangeHandler = null;
    }
    this._eventsBound = false;
  }
}

export const stakeholderOverviewPage = new StakeholderOverviewPage();
