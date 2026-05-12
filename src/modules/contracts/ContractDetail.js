// ContractDetail.js
// Detailseite fuer einen Contracting-Auftrag
// Flaches Layout (AuftragsdetailsDetail-Stil): Summary Cards + Eckdaten + Rechnungen

import { loadContractDetail } from './ContractListDataLoader.js';
import { UploaderField } from '../../core/form/fields/UploaderField.js';
import {
  uploadAuftragsbestaetigungen,
  deleteAuftragsbestaetigung,
  loadAuftragsbestaetigungen
} from '../../core/AuftragsbestaetigungUploader.js';
import { getCurrentBenutzerId } from '../auth/CurrentUser.js';

const DOK_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const DOK_MAX_SIZE = 25 * 1024 * 1024;

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
    this.dokUploader = null;
    this._isUploadingDokumente = false;
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
    this.mountDokUploader();
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
    const html = `
      <div class="content-section">
        <div class="detail-section">
          ${this.renderSummaryCards()}
          ${this.renderEckdaten()}

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

    const list = docs.length === 0
      ? '<div class="empty-state"><p>Noch keine Dokumente vorhanden.</p></div>'
      : `
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

    const uploaderUi = isAdmin ? `
      <div class="form-field" style="margin-top: var(--space-lg);">
        <label>Neue Dokumente hochladen</label>
        <div id="contract-dok-uploader" class="uploader uploader--auftragsbestaetigung" data-name="auftragsbestaetigungen"></div>
        <small class="form-hint">PDF, JPG oder PNG (max. 25 MB pro Datei). Mehrfach-Upload möglich.</small>
        <div style="display:flex; justify-content:flex-end; margin-top: var(--space-md);">
          <button type="button" class="primary-btn btn-upload-dokumente" id="contract-dok-upload-btn" disabled>Hochladen</button>
        </div>
      </div>
    ` : '';

    return `${list}${uploaderUi}`;
  }

  renderSummaryCards() {
    const c = this.contract;
    const rechnungen = c.rechnungen || [];

    const rechnungenSummeNetto = rechnungen.reduce((s, r) => s + (parseFloat(r.nettobetrag) || 0), 0);
    const bezahltCount = rechnungen.filter(r => r.status === 'Bezahlt').length;
    const offenCount = rechnungen.filter(r => r.status !== 'Bezahlt').length;

    const rechnungenPct = rechnungen.length > 0
      ? Math.round((bezahltCount / rechnungen.length) * 100)
      : 0;

    const getRechnungenColorClass = (pct) => {
      if (pct >= 100) return 'summary-progress-fill--success';
      if (pct >= 50) return 'summary-progress-fill--warning';
      return '';
    };

    const canViewPricing = window.canSeePricing?.() !== false;

    return `
      <div class="auftragsdetails-summary" style="margin-bottom: var(--space-xl);">
        <div class="summary-cards">
          ${canViewPricing ? `
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(c.nettobetrag)}</div>
            <div class="summary-label">Nettobetrag</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(c.bruttobetrag)}</div>
            <div class="summary-label">Bruttobetrag</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(rechnungenSummeNetto)}</div>
            <div class="summary-label">Rechnungen Summe (Netto)</div>
          </div>
          ` : ''}
          <div class="summary-card">
            <div class="summary-value">${bezahltCount} / ${rechnungen.length}</div>
            <div class="summary-label">Bezahlt / Gesamt</div>
            ${rechnungen.length > 0 ? `
            <div class="summary-progress">
              <div class="summary-progress-fill ${getRechnungenColorClass(rechnungenPct)}"
                   style="width: ${rechnungenPct}%">
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderEckdaten() {
    const c = this.contract;
    const firma = c.unternehmen?.firmenname || '—';
    const marke = c.marke?.markenname || '—';
    const ap = c.ansprechpartner
      ? [c.ansprechpartner.vorname, c.ansprechpartner.nachname].filter(Boolean).join(' ')
      : '—';

    const zeitraum = (c.start || c.ende)
      ? `${formatDate(c.start)} – ${formatDate(c.ende)}`
      : '—';

    const renderItem = (label, value) => {
      const isHtml = typeof value === 'string' && /<[^>]+>/.test(value);
      const display = isHtml ? value : escapeHtml(value || '—');
      return `
        <div class="detail-item">
          <div class="detail-item-label"><label>${escapeHtml(label)}</label></div>
          <span class="detail-item-value">${display}</span>
        </div>
      `;
    };

    return `
      <div class="detail-grid" style="margin-top: var(--space-lg);">
        <div class="detail-card">
          <h3 class="section-title">Contract-Eckdaten</h3>
          ${renderItem('Status', statusBadge(c.status))}
          ${renderItem('Angebotsnummer', c.angebotsnummer)}
          ${renderItem('Interne PO', c.po)}
          ${renderItem('Externe PO', c.externe_po)}
          ${renderItem('Zeitraum', zeitraum)}
          ${renderItem('Erstellt am', formatDate(c.created_at))}
        </div>

        <div class="detail-card">
          <h3 class="section-title">Kunde</h3>
          ${renderItem('Unternehmen',
            c.unternehmen?.id
              ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${c.unternehmen.id}">${escapeHtml(firma)}</a>`
              : firma
          )}
          ${renderItem('Marke',
            c.marke?.id
              ? `<a href="#" class="table-link" data-table="marke" data-id="${c.marke.id}">${escapeHtml(marke)}</a>`
              : marke
          )}
          ${renderItem('Ansprechpartner',
            c.ansprechpartner?.id
              ? `<a href="#" class="table-link" data-table="ansprechpartner" data-id="${c.ansprechpartner.id}">${escapeHtml(ap)}</a>`
              : ap
          )}
        </div>
      </div>
    `;
  }

  renderRechnungenTable() {
    const rechnungen = this.contract.rechnungen || [];
    const isAdmin = window.isAdmin?.();

    const actionBar = isAdmin ? `
      <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-md);">
        <a href="/rechnung/new?type=contracting&contract=${this.contract.id}" class="primary-btn btn-create-rechnung">Rechnung erstellen</a>
      </div>
    ` : '';

    if (rechnungen.length === 0) {
      return `
        ${actionBar}
        <div class="empty-state">
          <p>Noch keine Rechnungen für diesen Contract vorhanden.</p>
        </div>
      `;
    }

    const rows = rechnungen.map(r => {
      const creator = r.creator
        ? [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' ')
        : '—';
      return `
        <tr>
          <td><a href="/rechnung/${r.id}" class="table-link rechnung-link" data-id="${r.id}">${escapeHtml(r.rechnung_nr || '—')}</a></td>
          <td>${escapeHtml(creator)}</td>
          <td>${r.nettobetrag != null ? formatCurrency(r.nettobetrag) : '—'}</td>
          <td>${r.ust_betrag != null ? formatCurrency(r.ust_betrag) : '—'}</td>
          <td>${r.bruttobetrag != null ? formatCurrency(r.bruttobetrag) : '—'}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${formatDate(r.gestellt_am)}</td>
          <td>${formatDate(r.zahlungsziel)}</td>
          <td>${formatDate(r.bezahlt_am)}</td>
        </tr>
      `;
    }).join('');

    return `
      ${actionBar}
      <div class="data-table-container">
        <table class="data-table data-table--nowrap">
          <thead>
            <tr>
              <th>Rechnung-Nr</th>
              <th>Creator</th>
              <th>Netto</th>
              <th>USt</th>
              <th>Brutto</th>
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

      const uploadBtn = e.target.closest('.btn-upload-dokumente');
      if (uploadBtn && uploadBtn.id === 'contract-dok-upload-btn') {
        e.preventDefault();
        this.handleUploadDokumente();
        return;
      }
    }, { signal });
  }

  mountDokUploader() {
    if (!window.isAdmin?.()) {
      this.dokUploader = null;
      return;
    }

    const root = document.getElementById('contract-dok-uploader');
    if (!root) return;

    this.dokUploader = new UploaderField({
      multiple: true,
      accept: DOK_ACCEPT,
      maxFileSize: DOK_MAX_SIZE,
      onFilesChanged: (files) => {
        const btn = document.getElementById('contract-dok-upload-btn');
        if (btn) btn.disabled = !files.length || this._isUploadingDokumente;
      }
    });
    this.dokUploader.mount(root);
  }

  async handleUploadDokumente() {
    if (this._isUploadingDokumente) return;
    if (!this.dokUploader || !this.dokUploader.files.length) return;

    const btn = document.getElementById('contract-dok-upload-btn');
    this._isUploadingDokumente = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Wird hochgeladen...';
    }

    try {
      const benutzerId = await getCurrentBenutzerId();
      const files = [...this.dokUploader.files];

      const { successes, errors } = await uploadAuftragsbestaetigungen(files, {
        auftragId: this.contract.id,
        unternehmen: this.contract.unternehmen?.firmenname || '',
        marke: this.contract.marke?.markenname || '',
        auftragstitel: this.contract.titel || this.contract.auftragsname || '',
        uploadedById: benutzerId
      });

      if (successes.length > 0) {
        window.toastSystem?.show(
          `${successes.length} Datei(en) hochgeladen`,
          'success'
        );
      }
      if (errors.length > 0) {
        const failedNames = errors.map(e => e.fileName).join(', ');
        window.toastSystem?.show(
          `${errors.length} Datei(en) fehlgeschlagen: ${failedNames}`,
          'error'
        );
      }

      await this.loadDokumente();
      this.render();
      this.bindEvents();
      this.mountDokUploader();
    } catch (err) {
      console.error('[ContractDetail] Upload fehlgeschlagen:', err);
      window.toastSystem?.show(err.message || 'Upload fehlgeschlagen', 'error');
    } finally {
      this._isUploadingDokumente = false;
    }
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
      this.mountDokUploader();
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
    this.contract = null;
    this.dokumente = [];
    this.dokUploader = null;
  }
}

export const contractDetail = new ContractDetail();
