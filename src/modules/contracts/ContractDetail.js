// ContractDetail.js
// Detailseite fuer einen Contracting-Auftrag
// Flaches Layout (AuftragsdetailsDetail-Stil): Summary Cards + Eckdaten + Rechnungen

import { loadContractDetail, loadContractVertraege } from './ContractListDataLoader.js';
import {
  deleteAuftragsbestaetigung,
  loadAuftragsbestaetigungen
} from '../../core/AuftragsbestaetigungUploader.js';
import { ContractDokumentDrawer } from './ContractDokumentDrawer.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { VertragUtils } from '../vertrag/VertragUtils.js';

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
    this.vertraege = [];
    this.dokumentDrawer = null;
  }

  async init(id) {
    this._isMounted = true;
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    window.setHeadline('Contract Details');
    window.content.innerHTML = `
      <div class="table-loading-container table-loading-container--minh">
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

    await this.loadVertraege();
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

  async loadVertraege() {
    try {
      this.vertraege = await loadContractVertraege(this.contract.id);
    } catch (e) {
      console.warn('[ContractDetail] Verträge laden fehlgeschlagen:', e);
      this.vertraege = [];
    }
  }

  canCreateVertrag() {
    return window.isAdmin?.() || window.currentUser?.permissions?.vertraege?.can_edit === true;
  }

  render() {
    const isAdmin = window.isAdmin?.();
    const unternehmenId = this.contract.unternehmen?.id || this.contract.unternehmen_id || '';
    const createVertragUrl = `/vertraege/new?typ=Contracting&unternehmen=${unternehmenId}&auftrag=${this.contract.id}`;

    const headerActions = `
      ${this.canCreateVertrag() ? `<a href="${createVertragUrl}" class="mdc-btn mdc-btn--secondary btn-create-vertrag">Vertrag erstellen</a>` : ''}
      ${isAdmin ? `
      <a href="/rechnung/new?type=contracting&contract=${this.contract.id}" class="mdc-btn mdc-btn--secondary btn-create-rechnung">Rechnung erstellen</a>
      <button type="button" class="mdc-btn" id="btn-add-dokument">Neues Dokument hochladen</button>
      ` : ''}
    `;

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

          <div class="detail-section u-mt-lg">
            <h3 class="section-title section-title--spaced">Auftragsbestätigungen</h3>
            ${this.renderDokumenteSection()}
          </div>

          <div class="detail-section u-mt-lg">
            <h3 class="section-title section-title--spaced">Verträge</h3>
            ${this.renderVertraegeTable()}
          </div>

          <div class="detail-section u-mt-lg">
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
      return renderEmptyState({ icon: 'document', title: 'Noch keine Dokumente vorhanden' });
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
                <td class="u-text-right">
                  ${isAdmin ? `
                    <button type="button" class="btn-icon btn-delete-dokument" data-id="${d.id}" data-path="${escapeHtml(d.dropbox_file_path || '')}" title="Löschen">
                      ${icon('trash-alt')}
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

    // Gesamtbudget: creator_budget (Netto abzüglich Agentur Fee/KSK), Fallback gesamt_budget/nettobetrag
    const totalBudget = parseFloat(
      c.creator_budget ||
      c.gesamt_budget ||
      c.nettobetrag ||
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

    return `
      <div class="summary-card summary-card--kunde summary-card--stack">
        <div class="kv-row">
          <span class="kv-row__label">Unternehmen</span>
          <span class="kv-row__value">${unternehmenHtml}</span>
        </div>
        <div class="kv-row">
          <span class="kv-row__label">Marke</span>
          <span class="kv-row__value">${markeHtml}</span>
        </div>
        <div class="kv-row">
          <span class="kv-row__label">Ansprechpartner</span>
          <span class="kv-row__value">${ansprechpartnerHtml}</span>
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
        <div class="auftragsdetails-summary u-mb-xl">
          <div class="summary-cards">
            ${this.renderKundeTile()}
          </div>
        </div>
      `;
    }

    return `
      <div class="auftragsdetails-summary u-mb-xl">
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
            <div class="summary-value">${formatCurrency(totalBudget)}</div>
            <div class="summary-label">Creatorbudget</div>
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

  renderVertraegeTable() {
    const vertraege = this.vertraege || [];
    if (vertraege.length === 0) {
      return renderEmptyState({ icon: 'document', title: 'Noch keine Verträge für diesen Contract vorhanden' });
    }

    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

    const rows = vertraege.map(v => {
      const creatorName = v.creator
        ? [v.creator.vorname, v.creator.nachname].filter(Boolean).join(' ')
        : '—';
      return `
        <tr>
          <td>${VertragUtils.renderVertragNameHtml(v, escapeHtml)}</td>
          <td>${v.creator?.id
            ? `<a href="/creator/${v.creator.id}" class="table-link" data-table="creator" data-id="${v.creator.id}">${escapeHtml(creatorName)}</a>`
            : escapeHtml(creatorName)}</td>
          <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
          <td>${v.datei_url
            ? `<a href="${escapeHtml(v.datei_url)}" target="_blank" rel="noopener noreferrer" class="table-link datei-link">${icon('pdf')}</a>`
            : '—'}</td>
          <td>${formatDate(v.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table data-table--nowrap">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Status</th>
              <th>PDF</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderRechnungenTable() {
    const rechnungen = this.contract.rechnungen || [];

    if (rechnungen.length === 0) {
      return renderEmptyState({ icon: 'file-text', title: 'Noch keine Rechnungen für diesen Contract vorhanden' });
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

      const createVertragBtn = e.target.closest('.btn-create-vertrag');
      if (createVertragBtn) {
        e.preventDefault();
        window.navigateTo(createVertragBtn.getAttribute('href'));
        return;
      }

      const createBtn = e.target.closest('.btn-create-rechnung');
      if (createBtn) {
        e.preventDefault();
        window.navigateTo(createBtn.getAttribute('href'));
        return;
      }

      const editVertragLink = e.target.closest('[data-vertrag-open="edit"]');
      if (editVertragLink) {
        e.preventDefault();
        window.navigateTo(`/vertraege/${editVertragLink.dataset.id}/edit`);
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
    this.vertraege = [];
  }
}

export const contractDetail = new ContractDetail();
