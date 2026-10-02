// AuftragDetailRenderer.js
// Seiten-Rahmen, Sidebar, Tabs, Summary-Cards und Uebersicht-Tab
// (Prototype-Mixin von AuftragDetail)

import { AuftragDetail } from './AuftragDetailCore.js';
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';
import { renderSecondaryNav } from '../../core/TabUtils.js';
import { berechneVerfuegbaresBudget } from '../../core/budget/EkVkAgencyFeeHelper.js';

export const fmtNum = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';

Object.assign(AuftragDetail.prototype, {
  // Rendere Auftrags-Detailseite
  render() {
    window.setHeadline(`${this.auftrag?.auftragsname || 'Auftrag'} - Details`);

    const html = this.renderTwoColumnLayout({
      person: this.getPersonConfig(),
      stats: [],
      quickActions: [],
      sidebarInfo: this.getSidebarInfo(),
      tabNavigation: this.renderTabNavigation(),
      mainContent: this.renderMainContent()
    });

    window.setContentSafely(window.content, html);
  },

  getPersonConfig() {
    return {
      name: this.auftrag?.auftragsname || 'Auftrag',
      subtitle: this.auftrag?.unternehmen?.firmenname || 'Auftrag',
      avatarOnly: false
    };
  },

  getSidebarInfo() {
    const status = this.auftrag?.status;
    const stornierButton = status !== 'Storniert'
      ? `<button class="btn-stornieren" id="btn-auftrag-stornieren">Auftrag stornieren</button>`
      : `<button class="btn-stornieren btn-stornieren--success" id="btn-auftrag-reaktivieren">Stornierung aufheben</button>`;

    return this.renderInfoItems([
      { icon: 'tag', label: 'Status', value: renderAuftragAmpel(status) },
      { icon: 'building', label: 'Unternehmen', value: this.auftrag?.unternehmen?.firmenname || '-' },
      { icon: 'marken', label: 'Marke', value: this.auftrag?.marke?.markenname || '-' },
      { icon: 'currency', label: 'Nettobetrag', value: this.formatCurrency(this.auftrag?.nettobetrag) },
      { icon: 'calendar', label: 'Start', value: this.formatDate(this.auftrag?.start) },
      { icon: 'calendar', label: 'Ende', value: this.formatDate(this.auftrag?.ende) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.auftrag?.updated_at) }
    ]) + stornierButton;
  },

  getTabsConfig() {
    return [
      { tab: 'uebersicht', label: 'Übersicht', isActive: this.activeMainTab === 'uebersicht' },
      { tab: 'finanzen', label: 'Finanzen', isActive: this.activeMainTab === 'finanzen' },
      { tab: 'auftragsdetails', label: 'Auftragsdetails', isActive: this.activeMainTab === 'auftragsdetails' }
    ];
  },

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return renderSecondaryNav(tabs.map((tab) => ({ ...tab, showIcon: true })));
  },

  renderMainContent() {
    return `
      ${this.renderAuftragSummaryCards()}
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'uebersicht' ? 'active' : ''}" id="tab-uebersicht">
          ${this.renderUebersicht()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'finanzen' ? 'active' : ''}" id="tab-finanzen">
          ${this.renderFinanzenTab()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'auftragsdetails' ? 'active' : ''}" id="tab-auftragsdetails">
          ${this.renderAuftragsdetails()}
        </div>
      </div>
    `;
  },

  formatDate(dateValue) {
    return dateValue ? new Date(dateValue).toLocaleDateString('de-DE') : '-';
  },

  formatCurrency(value) {
    return value || value === 0
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
      : '-';
  },

  renderDetailItem({ icon = 'info', label, value }) {
    const hasValue = value !== null && value !== undefined && value !== '';
    const resolvedValue = hasValue ? value : '-';
    const isHtmlValue = typeof resolvedValue === 'string' && /<[^>]+>/.test(resolvedValue);
    const valueHtml = isHtmlValue ? resolvedValue : this.sanitize(String(resolvedValue));
    const iconHtml = this.getInfoIcon(icon) || this.getInfoIcon('info');

    return `
      <div class="detail-item">
        <div class="detail-item-label">
          <span class="detail-item-icon">${iconHtml}</span>
          <label>${this.sanitize(label)}</label>
        </div>
        <span class="detail-item-value">${valueHtml}</span>
      </div>
    `;
  },

  renderAuftragSummaryCards() {
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    const usedBudget = this.usedBudget || 0;
    // Negativ = Ueberschreitung, wird ausgewiesen statt geklemmt (ADR 0007).
    const openBudget = totalBudget - usedBudget;

    const fmt = (v) => this.formatCurrency(v);
    const num = fmtNum;

    const budgetPct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;
    const openPct = totalBudget > 0 ? 100 - budgetPct : 0;
    // Nur die Balkengeometrie wird begrenzt, nicht der angezeigte Wert.
    const barWidth = (pct) => Math.min(100, Math.max(0, pct));

    const getBudgetColorClass = (pct) => {
      if (pct >= 90) return 'summary-progress-fill--danger';
      if (pct >= 75) return 'summary-progress-fill--warning';
      return '';
    };
    const getOpenBudgetColorClass = (pct) => {
      if (pct <= 10) return 'summary-progress-fill--danger';
      if (pct <= 25) return 'summary-progress-fill--warning';
      return 'summary-progress-fill--success';
    };

    const canViewInternalBudget = window.canSeePricing();

    return `
      <div class="auftragsdetails-summary u-mb-xl">
        <div class="summary-cards">
          ${canViewInternalBudget ? `
          <div class="summary-card" data-summary-card="total-budget">
            <div class="summary-value">${fmt(totalBudget)}</div>
            <div class="summary-label">Gesamtbudget (netto)</div>
          </div>
          <div class="summary-card" data-summary-card="spent-budget">
            <div class="summary-value">${fmt(usedBudget)}</div>
            <div class="summary-label">Verbrauchtes Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}"
                   style="width: ${barWidth(budgetPct)}%">
              </div>
            </div>
          </div>
          <div class="summary-card" data-summary-card="open-budget">
            <div class="summary-value">${fmt(openBudget)}</div>
            <div class="summary-label">Offenes Creator Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}"
                   style="width: ${barWidth(openPct)}%">
              </div>
            </div>
          </div>` : ''}
          <div class="summary-card" data-summary-card="creators">
            <div class="summary-value">${num(this.realCreatorCount)} von ${num(this.targetCreatorCount)}</div>
            <div class="summary-label">Gebuchte Creator</div>
          </div>
          <div class="summary-card" data-summary-card="videos">
            <div class="summary-value">${num(this.usedVideoCount)} von ${num(this.targetVideoCount)}</div>
            <div class="summary-label">Gebuchte Videos</div>
          </div>
        </div>
      </div>
    `;
  },

  // Rendere Übersicht-Tab mit allen wichtigen Auftragsinformationen
  renderUebersicht() {
    const a = this.auftrag || {};
    const fmt = (v) => this.formatCurrency(v);
    const formatDate = (d) => this.formatDate(d);
    
    // Mitarbeiter-Namen sammeln
    const mitarbeiterNamen = (a.mitarbeiter || []).map(m => m.name).filter(Boolean).join(', ') || '-';
    const cutterNamen = (a.cutter || []).map(c => c.name).filter(Boolean).join(', ') || '-';
    const copywriterNamen = (a.copywriter || []).map(c => c.name).filter(Boolean).join(', ') || '-';
    
    // Ansprechpartner formatieren
    const ansprechpartner = a.ansprechpartner 
      ? `${a.ansprechpartner.vorname || ''} ${a.ansprechpartner.nachname || ''}`.trim() || '-'
      : '-';
    const ansprechpartnerEmail = a.ansprechpartner?.email || '-';
    
    // Kampagnenarten formatieren
    const kampagnenarten = (a.art_der_kampagne_namen || []).join(', ') || '-';

    return `
      <div class="detail-section">
        <div class="detail-grid">
          <!-- Auftrags-Eckdaten -->
          <div class="detail-card">
            <h3 class="section-title">Auftrags-Eckdaten</h3>
            ${this.renderDetailItem({
              icon: 'tag',
              label: 'Status:',
              value: renderAuftragAmpel(a.status)
            })}
            ${this.renderDetailItem({ icon: 'info', label: 'PO-Nummer:', value: a.po || '-' })}
            ${this.renderDetailItem({ icon: 'info', label: 'RE-Nummer:', value: a.re_nr || '-' })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'RE-Fälligkeit:', value: formatDate(a.re_faelligkeit) })}
            ${this.renderDetailItem({ icon: 'clock', label: 'Zahlungsziel:', value: a.zahlungsziel_tage != null ? `${a.zahlungsziel_tage} Tage` : '-' })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'Start:', value: formatDate(a.start) })}
            ${this.renderDetailItem({ icon: 'calendar', label: 'Ende:', value: formatDate(a.ende) })}
            ${this.renderDetailItem({ icon: 'tag', label: 'Kampagnenarten:', value: kampagnenarten })}
          </div>
          
          <!-- Unternehmen & Marke -->
          <div class="detail-card">
            <h3 class="section-title">Kunde</h3>
            ${this.renderDetailItem({
              icon: 'building',
              label: 'Unternehmen:',
              value: a.unternehmen?.firmenname
                ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${a.unternehmen_id}">${a.unternehmen.firmenname}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'marken',
              label: 'Marke:',
              value: a.marke?.markenname
                ? `<a href="#" class="table-link" data-table="marke" data-id="${a.marke_id}">${a.marke.markenname}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'user',
              label: 'Ansprechpartner:',
              value: a.ansprechpartner_id
                ? `<a href="#" class="table-link" data-table="ansprechpartner" data-id="${a.ansprechpartner_id}">${ansprechpartner}</a>`
                : '-'
            })}
            ${this.renderDetailItem({
              icon: 'mail',
              label: 'E-Mail:',
              value: ansprechpartnerEmail !== '-' ? `<a href="mailto:${ansprechpartnerEmail}">${ansprechpartnerEmail}</a>` : '-'
            })}
          </div>
          
          <!-- Team -->
          <div class="detail-card">
            <h3 class="section-title">Team</h3>
            ${this.renderDetailItem({ icon: 'user', label: 'Projektleitung:', value: mitarbeiterNamen })}
            ${this.renderDetailItem({ icon: 'user', label: 'Cutter:', value: cutterNamen })}
            ${this.renderDetailItem({ icon: 'user', label: 'Copywriter:', value: copywriterNamen })}
          </div>
          
          <!-- Quick-Finanzen -->
          <div class="detail-card">
            <h3 class="section-title">Budget (Übersicht)</h3>
            ${this.renderDetailItem({ icon: 'currency', label: 'Nettobetrag:', value: fmt(a.nettobetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Bruttobetrag:', value: fmt(a.bruttobetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Creator-Budget:', value: fmt(a.creator_budget) })}
            ${this.renderDetailItem({
              icon: 'check',
              label: 'Rechnung gestellt:',
              value: a.rechnung_gestellt
                ? '<span class="status-badge status-erfolg">Ja</span>'
                : '<span class="status-badge status-offen">Nein</span>'
            })}
            ${this.renderUeberwiesenItems(a)}
          </div>
          
          <!-- Zeitstempel -->
          <div class="detail-card">
            <h3 class="section-title">Protokoll</h3>
            ${this.renderDetailItem({ icon: 'clock', label: 'Erstellt am:', value: formatDate(a.created_at) })}
            ${this.renderDetailItem({ icon: 'clock', label: 'Aktualisiert am:', value: formatDate(a.updated_at) })}
          </div>
        </div>
      </div>
    `;
  },

  // Überwiesen-Items der Budget-Karte. Bei Teilrechnungen je Position das
  // Datum der Teilrechnung; ohne Teilrechnungen der Auftragskopf.
  renderUeberwiesenItems(a) {
    const trs = this.teilrechnungen || [];
    if (!trs.length) {
      return `
        ${this.renderDetailItem({
          icon: 'check',
          label: 'Überwiesen:',
          value: a.ueberwiesen
            ? '<span class="status-badge status-erfolg">Ja</span>'
            : '<span class="status-badge status-offen">Nein</span>'
        })}
        ${a.ueberwiesen_am ? this.renderDetailItem({ icon: 'calendar', label: 'Überwiesen am:', value: this.formatDate(a.ueberwiesen_am) }) : ''}
      `;
    }
    return trs.map(tr => `
      ${this.renderDetailItem({
        icon: 'check',
        label: `Überwiesen (Teilrechnung ${tr.position}):`,
        value: tr.ueberwiesen_am
          ? `<span class="status-badge status-erfolg">${this.formatDate(tr.ueberwiesen_am)}</span>`
          : '<span class="status-badge status-offen">Offen</span>'
      })}
    `).join('');
  },
});
