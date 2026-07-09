// ContractDetail.js
// Detailseite fuer einen Contracting-Auftrag
// Flaches Layout (AuftragsdetailsDetail-Stil): Summary Cards + Eckdaten + Rechnungen

import { loadContractDetail } from './ContractListDataLoader.js';
import {
  deleteAuftragsbestaetigung,
  loadAuftragsbestaetigungen
} from '../../core/AuftragsbestaetigungUploader.js';
import { ContractDokumentDrawer } from './ContractDokumentDrawer.js';

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function statusBadge(status) {
  if (!status) return '<span class="status-badge status-inactive">—</span>';
  const slug = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-${slug}">${status}</span>`;
}

function escapeHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('de-DE') : '—';
}

function formatCurrency(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

export class ContractDetail {
  constructor() {
    this._abortController = null;
    this._isMounted = false;
    this.contract = null;
    this.dokumente = [];
    this.dokumentDrawer = null;
  }

  async init(id) {
    this._isMounted = true;
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    window.setHeadline('Contract Details');
    window.content.innerHTML = `
      <div class="table-loading-container" style="min-height: 300px;">
        <div class="table-loading-spinner"></div>
      </div>
    `;

    this.contract = await loadContractDetail(id);
    if (!this._isMounted) return;

    if (!this.contract) {
      window.setHeadline('Contract nicht gefunden');
      window.content.innerHTML = `
        <div class="error-message">
          <h2>Contract nicht gefunden</h2>
          <p>Der angeforderte Contract konnte nicht gefunden werden.</p>
        </div>
      `;
      return;
    }

    const titel = this.contract.titel || this.contract.auftragsname || 'Contract';
    window.setHeadline(titel);

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel(titel);
    }

    await this.loadDokumente();
    if (!this._isMounted) return;

    this.render();
    this.bindEvents();
  }

  async loadDokumente() {
    try {
      this.dokumente = await loadAuftragsbestaetigungen(this.contract.id);
    } catch (e) {
      console.warn('[ContractDetail] Dokumente laden fehlgeschlagen:', e);
      this.dokumente = [];
    }
  }

  render() {
    const isAdmin = window.isAdmin?.();

    const headerActions = isAdmin ? `
      <a href="/rechnung/new?type=contracting&contract=${this.contract.id}" class="secondary-btn btn-create-rechnung">Rechnung erstellen</a>
      <button type="button" class="primary-btn" id="btn-add-dokument">Neues Dokument hochladen</button>
    ` : '';

    const pageHeader = `
      <div class="page-header">
        <div class="page-header-right">
          ${headerActions}
        </div>
      </div>
    `;

    const html = `
      <div class="content-section">
        ${pageHeader}
        <div class="detail-section">
          ${this.renderSummaryCards()}

          <div class="detail-section" style="margin-top: var(--space-lg);">
            <h3 class="section-title section-title--spaced">Auftragsbestätigungen</h3>
            ${this.renderDokumenteSection()}
          </div>

          <div class="detail-section" style="margin-top: var(--space-lg);">
            <h3 class="section-title section-title--spaced">Rechnungen</h3>
            ${this.renderRechnungenTable()}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderDokumenteSection() {
    const isAdmin = window.isAdmin?.();
    const docs = this.dokumente || [];

    if (docs.length === 0) {
      return '<div class="empty-state"><p>Noch keine Dokumente vorhanden.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table data-table--nowrap">
          <thead>
            <tr>
              <th>Dateiname</th>
              <th>Größe</th>
              <th>Hochgeladen am</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(d => `
              <tr>
                <td>
                  ${d.dropbox_file_url
                    ? `<a href="${escapeHtml(d.dropbox_file_url)}" target="_blank" rel="noopener noreferrer" class="table-link">${escapeHtml(d.dateiname || '—')}</a>`
                    : escapeHtml(d.dateiname || '—')}
                </td>
                <td>${formatFileSize(d.dateigroesse)}</td>
                <td>${formatDate(d.created_at)}</td>
                <td style="text-align:right;">
                  ${isAdmin ? `
                    <button type="button" class="btn-icon btn-delete-dokument" data-id="${d.id}" data-path="${escapeHtml(d.dropbox_file_path || '')}" title="Löschen">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
                      </svg>
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  calculateBudgetSummary() {
    const c = this.contract || {};
    const rechnungen = c.rechnungen || [];

    // Gesamtbudget: nettobetrag des Contracting-Auftrags (Fallback creator_budget/gesamt_budget)
    const totalBudget = parseFloat(
      c.nettobetrag ||
      c.creator_budget ||
      c.gesamt_budget ||
      0
    ) || 0;

    // Verbrauchtes Budget = Summe aller bereits gestellten Rechnungen (netto)
    const usedBudget = rechnungen.reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
    const openBudget = Math.max(0, totalBudget - usedBudget);

    return { totalBudget, usedBudget, openBudget };
  }

  renderKundeTile() {
    const c = this.contract;
    const firma = c.unternehmen?.firmenname || '—';
    const marke = c.marke?.markenname || '—';
    const ap = c.ansprechpartner
      ? [c.ansprechpartner.vorname, c.ansprechpartner.nachname].filter(Boolean).join(' ') || '—'
      : '—';

    const unternehmenHtml = c.unternehmen?.id
      ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${c.unternehmen.id}">${escapeHtml(firma)}</a>`
      : escapeHtml(firma);
    const markeHtml = c.marke?.id
      ? `<a href="#" class="table-link" data-table="marke" data-id="${c.marke.id}">${escapeHtml(marke)}</a>`
      : escapeHtml(marke);
    const ansprechpartnerHtml = c.ansprechpartner?.id
      ? `<a href="#" class="table-link" data-table="ansprechpartner" data-id="${c.ansprechpartner.id}">${escapeHtml(ap)}</a>`
      : escapeHtml(ap);

    const rowStyle = 'display:flex; justify-content:space-between; gap:var(--space-sm); align-items:baseline; font-size:0.875rem; line-height:1.4;';
    const labelStyle = 'color:var(--gray-500); flex-shrink:0;';
    const valueStyle = 'font-weight:500; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;';

    return `
      <div class="summary-card summary-card--kunde" style="display:flex; flex-direction:column; gap:var(--space-xs); justify-content:center;">
        <div style="${rowStyle}">
          <span style="${labelStyle}">Unternehmen</span>
          <span style="${valueStyle}">${unternehmenHtml}</span>
        </div>
        <div style="${rowStyle}">
          <span style="${labelStyle}">Marke</span>
          <span style="${valueStyle}">${markeHtml}</span>
        </div>
        <div style="${rowStyle}">
          <span style="${labelStyle}">Ansprechpartner</span>
          <span style="${valueStyle}">${ansprechpartnerHtml}</span>
        </div>
      </div>
    `;
  }

  renderSummaryCards() {
    const c = this.contract;
    const d = c.auftragsDetails || c;

    const { totalBudget, usedBudget, openBudget } = this.calculateBudgetSummary();

    const budgetPct = totalBudget > 0 ? Math.min(100, Math.round((usedBudget / totalBudget) * 100)) : 0;
    const openPct = totalBudget > 0 ? Math.max(0, 100 - budgetPct) : 0;

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

    const kskValue = parseFloat(d?.ksk_value) || 0;
    const agencyFeeValue = parseFloat(d?.percentage_fee_value) || 0;

    const canViewPricing = window.canSeePricing?.() !== false;

    if (!canViewPricing) {
      return `
        <div class="auftragsdetails-summary" style="margin-bottom: var(--space-xl);">
          <div class="summary-cards">
            ${this.renderKundeTile()}
          </div>
        </div>
      `;
    }

    return `
      <div class="auftragsdetails-summary" style="margin-bottom: var(--space-xl);">
        <div class="summary-cards">
          ${this.renderKundeTile()}
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(c.nettobetrag)}</div>
            <div class="summary-label">Nettobetrag</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(c.bruttobetrag)}</div>
            <div class="summary-label">Bruttobetrag</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(usedBudget)}</div>
            <div class="summary-label">Verbrauchtes Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}"
                   style="width: ${budgetPct}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(openBudget)}</div>
            <div class="summary-label">Offenes Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}"
                   style="width: ${openPct}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(kskValue)}</div>
            <div class="summary-label">KSK</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(agencyFeeValue)}</div>
            <div class="summary-label">Agentur Fee</div>
          </div>
        </div>
      </div>
    `;
  }

  renderRechnungenTable() {
    const rechnungen = this.contract.rechnungen || [];

    if (rechnungen.length === 0) {
      return `
        <div class="empty-state">
          <p>Noch keine Rechnungen für diesen Contract vorhanden.</p>
        </div>
      `;
    }

    const rows = rechnungen.map(r => {
      const creator = r.creator
        ? [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' ')
        : '—';
      const kskBadge = r.ksk_pflichtig
        ? '<span class="status-badge status-erfolg">Ja</span>'
        : '<span class="status-badge status-inactive">Nein</span>';
      return `
        <tr>
          <td><a href="/rechnung/${r.id}" class="table-link rechnung-link" data-id="${r.id}">${escapeHtml(r.rechnung_nr || '—')}</a></td>
          <td>${escapeHtml(creator)}</td>
          <td>${r.nettobetrag != null ? formatCurrency(r.nettobetrag) : '—'}</td>
          <td>${r.ust_betrag != null ? formatCurrency(r.ust_betrag) : '—'}</td>
          <td>${r.bruttobetrag != null ? formatCurrency(r.bruttobetrag) : '—'}</td>
          <td>${kskBadge}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${formatDate(r.gestellt_am)}</td>
          <td>${formatDate(r.zahlungsziel)}</td>
          <td>${formatDate(r.bezahlt_am)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table data-table--nowrap">
          <thead>
            <tr>
              <th>Rechnung-Nr</th>
              <th>Creator</th>
              <th>Netto</th>
              <th>USt</th>
              <th>Brutto</th>
              <th>KSK</th>
              <th>Status</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Bezahlt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  bindEvents() {
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const rechnungLink = e.target.closest('.rechnung-link');
      if (rechnungLink) {
        e.preventDefault();
        window.navigateTo(`/rechnung/${rechnungLink.dataset.id}`);
        return;
      }

      const createBtn = e.target.closest('.btn-create-rechnung');
      if (createBtn) {
        e.preventDefault();
        window.navigateTo(createBtn.getAttribute('href'));
        return;
      }

      const tableLink = e.target.closest('.table-link[data-table][data-id]');
      if (tableLink) {
        e.preventDefault();
        window.navigateTo(`/${tableLink.dataset.table}/${tableLink.dataset.id}`);
        return;
      }

      const deleteDokBtn = e.target.closest('.btn-delete-dokument');
      if (deleteDokBtn) {
        e.preventDefault();
        const dokId = deleteDokBtn.dataset.id;
        const path = deleteDokBtn.dataset.path || null;
        this.handleDeleteDokument(dokId, path);
        return;
      }

      const addDokBtn = e.target.closest('#btn-add-dokument');
      if (addDokBtn) {
        e.preventDefault();
        this.openDokumentDrawer();
        return;
      }
    }, { signal });
  }

  openDokumentDrawer() {
    if (!window.isAdmin?.()) return;
    if (!this.contract) return;

    if (!this.dokumentDrawer) {
      this.dokumentDrawer = new ContractDokumentDrawer();
    }

    this.dokumentDrawer.open(this.contract, async () => {
      await this.loadDokumente();
      if (!this._isMounted) return;
      this.render();
      this.bindEvents();
    });
  }

  async handleDeleteDokument(dokId, dropboxPath) {
    if (!dokId) return;
    const ok = window.confirm('Dokument wirklich löschen?');
    if (!ok) return;

    try {
      await deleteAuftragsbestaetigung(dokId, dropboxPath);
      window.toastSystem?.show('Dokument gelöscht', 'success');

      await this.loadDokumente();
      this.render();
      this.bindEvents();
    } catch (err) {
      console.error('[ContractDetail] Loeschen fehlgeschlagen:', err);
      window.toastSystem?.show(err.message || 'Löschen fehlgeschlagen', 'error');
    }
  }

  destroy() {
    this._isMounted = false;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this.dokumentDrawer) {
      this.dokumentDrawer.removeDrawer();
      this.dokumentDrawer = null;
    }
    this.contract = null;
    this.dokumente = [];
  }
}

export const contractDetail = new ContractDetail();
