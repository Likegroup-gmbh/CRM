// StakeholderOverviewPage.js
// Fassade der Stakeholder-Gesamtübersicht (/admin, Accounting-Dashboard).
// Zeitraum-Filter + Leistungsbereich-Auswahl, Budget-Karten, Kundenliste
// und Monatsauswertung. Rechenquelle: stakeholderDashboard.js (Server).

import { escapeHtml, formatEuro } from '../../../core/format.js';
import { ViewModeToggle } from '../../../core/components/ViewModeToggle.js';
import { navMark } from '../../../core/dev/navTrace.js';
import { aggregate as aggregateOverview, kartenSummen as berechneKartenSummen, loadData as loadStakeholderData } from '../daten/stakeholderOverviewData.js';
import { renderKalkulationBody } from '../ansichten/stakeholderKalkulationView.js';
import { TAB_GESAMT_OHNE, availableYears, effektivesMonatsJahr, monatsYears, tabCounts, visibleTabs } from './stakeholderOverviewLogic.js';
import { aktiveMonatsauswertung, oeffneBerichtsstand, renderMonatsauswertung, sichereBerichtsstand } from '../ansichten/stakeholderMonatsView.js';

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
    // Gerechnete Auftragszeilen (stakeholderDashboard.js); Jahr und
    // Leistungsbereich filtern sie nur noch im Browser.
    this.auftraege = [];
    this.contractingOhneAuftrag = null;
    this.unternehmenById = new Map();
    this.selectedYear = String(new Date().getFullYear());
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
    // Abbruch-Token: init() und destroy() zaehlen hoch, ein laufender Load
    // rendert nur, solange sein Token noch gilt.
    this._ladeId = 0;
    this._aktualisierenLaeuft = false;
    this.geladenAm = null;
    // Promise des laufenden Initial-Loads; Tests und Aufrufer, die auf das
    // gerenderte Dashboard warten wollen, awaiten dieses.
    this.ready = Promise.resolve();
  }

  // Kehrt nach dem Skeleton zurueck, nicht nach dem Load: ModuleRegistry
  // haelt waehrend init() die Navigationssperre, Klicks wuerden sonst
  // sekundenlang verworfen.
  async init() {
    this._ladeId += 1;
    this.ready = Promise.resolve();

    if (!(window.canViewAccounting?.() || window.isAdmin?.())) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – diese Seite ist nur für den Accounting-Bereich.</p>
        </div>
      `);
      return;
    }

    window.setHeadline('Investor-Dashboard');
    window.setContentSafely(window.content, this.renderSkeleton());
    navMark('skeleton:shown');

    this.ready = this.ladeInitial(this._ladeId);
  }

  async ladeInitial(ladeId) {
    try {
      await this.loadData();
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Investor-Dashboard: Daten konnten nicht geladen werden', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${this.escape(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }

    navMark('daten:geladen');
    if (ladeId !== this._ladeId) return;
    this.render();
    this.bindEvents();
    navMark('render:done');
  }

  renderSkeleton() {
    const karte = '<div class="stakeholder-card stakeholder-skeleton-card"></div>';
    return `
      <div class="stakeholder-page" aria-busy="true" aria-label="Lade Daten">
        <div class="stakeholder-skeleton-bar"></div>
        <div class="stakeholder-cards stakeholder-cards--kalkulation">${karte}${karte}</div>
        <div class="stakeholder-cards stakeholder-cards--breakdown">${karte}${karte}${karte}</div>
        <div class="stakeholder-list-card stakeholder-skeleton-list"></div>
      </div>
    `;
  }

  // Live neu laden und an Ort und Stelle neu rendern. Filter, Sicht und ein
  // geoeffneter Berichtsstand bleiben erhalten.
  async aktualisieren() {
    if (this._aktualisierenLaeuft) return;
    const ladeId = this._ladeId;
    this._aktualisierenLaeuft = true;
    this.setAktualisierenBusy(true);
    try {
      await this.loadData();
    } catch (e) {
      console.error('❌ Investor-Dashboard: Aktualisieren fehlgeschlagen', e);
      window.toastSystem?.show('Aktualisieren fehlgeschlagen. Die angezeigten Zahlen sind unverändert.', 'error');
      this._aktualisierenLaeuft = false;
      if (ladeId === this._ladeId) this.setAktualisierenBusy(false);
      return;
    }
    this._aktualisierenLaeuft = false;
    if (ladeId !== this._ladeId) return;
    // Ein Tab ohne Auftraege verschwindet aus dem Select; dann zurueck auf Gesamt.
    if (!visibleTabs(this).some(t => t.key === this.activeTab)) {
      this.activeTab = TAB_GESAMT_OHNE;
    }
    this.render();
  }

  setAktualisierenBusy(busy) {
    const btn = document.getElementById('stakeholder-aktualisieren');
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? 'Aktualisiere …' : 'Aktualisieren';
  }

  fmtStand() {
    if (!this.geladenAm) return '';
    return new Date(this.geladenAm).toLocaleTimeString('de-DE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
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

  kartenSummen() {
    return berechneKartenSummen(this);
  }

  render() {
    const years = availableYears(this);
    const counts = tabCounts(this);
    const tabs = visibleTabs(this);
    const isMonate = this.activeView === 'monate';
    // Zeitraum gilt in beiden Ansichten; die Jahresoptionen kommen in der
    // Monatsauswertung aus den Rechnungsmonaten statt aus den Auftraegen.
    const monatsMonate = isMonate ? aktiveMonatsauswertung(this).months : null;
    const yearOptions = isMonate ? monatsYears(monatsMonate) : years;
    const effektivesJahr = isMonate ? effektivesMonatsJahr(this, monatsMonate) : this.selectedYear;

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
          <div class="stakeholder-toolbar-filters">
            ${!isMonate ? `
            <div class="form-field form-field--inline">
              <label for="stakeholder-tab-select">Leistungsbereich</label>
              <select id="stakeholder-tab-select" class="form-select">
                ${tabOptions}
              </select>
            </div>` : ''}
            <div class="form-field form-field--inline stakeholder-year-field">
              <label for="stakeholder-year-select">Zeitraum</label>
              <select id="stakeholder-year-select" class="form-select">
                <option value="all"${effektivesJahr === 'all' ? ' selected' : ''}>Alle Jahre</option>
                ${yearOptions.map(y => `<option value="${y}"${String(effektivesJahr) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
            <div class="stakeholder-stand">
              <span id="stakeholder-stand">Stand ${this.escape(this.fmtStand())}</span>
              <button type="button" id="stakeholder-aktualisieren" class="mdc-btn">Aktualisieren</button>
            </div>
          </div>
        </div>

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
        // Kalkulation gilt wieder die Live-Rechnung.
        if (this.activeView !== 'monate') {
          this.aktiverBerichtsstand = null;
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

      if (e.target.closest('#stakeholder-aktualisieren')) {
        this.aktualisieren();
        return;
      }
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
    // Ein noch laufender Load darf nicht mehr in die naechste Seite rendern.
    this._ladeId += 1;
    this._aktualisierenLaeuft = false;
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
