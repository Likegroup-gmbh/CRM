// ContractDetail.js
// Detailseite fuer einen Contracting-Auftrag
// Nutzt PersonDetailBase fuer einheitliches Layout (Secondary-Nav + Sidebar)

import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { loadContractDetail } from './ContractListDataLoader.js';
import { getTabIcon } from '../../core/TabUtils.js';

function statusBadge(status) {
  if (!status) return '<span class="status-badge status-inactive">—</span>';
  const slug = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-${slug}">${status}</span>`;
}

export class ContractDetail extends PersonDetailBase {
  constructor() {
    super();
    this._abortController = null;
    this._isMounted = false;
    this.contract = null;
    this.activeMainTab = 'informationen';
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

    this.render();
    this.bindEvents();
  }

  render() {
    const c = this.contract;
    const firma = c.unternehmen?.firmenname || '—';
    const marke = c.marke?.markenname || '—';
    const rechnungen = c.rechnungen || [];

    const personConfig = {
      name: c.titel || c.auftragsname || 'Contract',
      subtitle: firma,
      avatarOnly: true,
      avatarUrl: c.unternehmen?.logo_thumb_url || null
    };

    const sidebarInfo = this.renderInfoItems([
      { icon: 'building', label: 'Unternehmen', value: firma },
      { icon: 'marke', label: 'Marke', value: marke },
      { icon: 'user', label: 'Ansprechpartner', value: c.ansprechpartner ? [c.ansprechpartner.vorname, c.ansprechpartner.nachname].filter(Boolean).join(' ') : null },
      { icon: 'shield', label: 'Status', rawHtml: statusBadge(c.status) },
      { icon: 'calendar', label: 'Zeitraum', value: c.start || c.ende ? `${this.formatDate(c.start)} – ${this.formatDate(c.ende)}` : null },
      { icon: 'currency', label: 'Nettobetrag', value: c.nettobetrag != null ? this.formatCurrency(c.nettobetrag) : null },
      { icon: 'currency', label: 'Bruttobetrag', value: c.bruttobetrag != null ? this.formatCurrency(c.bruttobetrag) : null },
      { icon: 'info', label: 'Angebotsnummer', value: c.angebotsnummer },
      { icon: 'info', label: 'Interne PO', value: c.po },
      { icon: 'info', label: 'Externe PO', value: c.externe_po },
      { icon: 'clock', label: 'Erstellt am', value: this.formatDate(c.created_at) }
    ]);

    const tabNavigation = this.renderTabNavigation(rechnungen);
    const mainContent = this.renderMainContent(rechnungen);

    const html = this.renderTwoColumnLayout({
      person: personConfig,
      quickActions: [],
      sidebarInfo,
      tabNavigation,
      mainContent,
      layoutClass: 'contract-detail-layout'
    });

    window.setContentSafely(window.content, html);
  }

  renderTabNavigation(rechnungen) {
    const tabs = [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' },
      { tab: 'rechnungen', label: 'Rechnungen', isActive: this.activeMainTab === 'rechnungen' }
    ];

    return tabs.map(t => `
      <button class="tab-button ${t.isActive ? 'active' : ''}" data-main-tab="${t.tab}">
        <span class="tab-icon">${getTabIcon(t.tab)}</span>
        ${t.label}${t.count != null ? ` <span class="tab-count">(${t.count})</span>` : ''}
      </button>
    `).join('');
  }

  renderMainContent(rechnungen) {
    const isAdmin = window.isAdmin?.();

    return `
      <div class="tab-content secondary-tab-content">
        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="main-rechnungen">
          <div class="detail-section">
            ${isAdmin ? `
              <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-md);">
                <a href="/rechnung/new?type=contracting&contract=${this.contract.id}" class="primary-btn btn-create-rechnung">Rechnung erstellen</a>
              </div>
            ` : ''}

            ${rechnungen.length > 0 ? `
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
                  <tbody>
                    ${rechnungen.map(r => {
                      const creator = r.creator
                        ? [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' ')
                        : '—';
                      return `
                        <tr>
                          <td><a href="/rechnung/${r.id}" class="table-link rechnung-link" data-id="${r.id}">${this.sanitize(r.rechnung_nr || '—')}</a></td>
                          <td>${this.sanitize(creator)}</td>
                          <td>${r.nettobetrag != null ? this.formatCurrency(r.nettobetrag) : '—'}</td>
                          <td>${r.ust_betrag != null ? this.formatCurrency(r.ust_betrag) : '—'}</td>
                          <td>${r.bruttobetrag != null ? this.formatCurrency(r.bruttobetrag) : '—'}</td>
                          <td>${statusBadge(r.status)}</td>
                          <td>${this.formatDate(r.gestellt_am)}</td>
                          <td>${this.formatDate(r.zahlungsziel)}</td>
                          <td>${this.formatDate(r.bezahlt_am)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="empty-state"><p>Noch keine Rechnungen für diesen Contract vorhanden.</p></div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-button[data-main-tab]');
      if (tabBtn) {
        e.preventDefault();
        this.switchMainTab(tabBtn.dataset.mainTab);
        return;
      }

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
    }, { signal });
  }

  switchMainTab(tab) {
    this.activeMainTab = tab;
    document.querySelectorAll('.tab-button[data-main-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mainTab === tab);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      const paneTab = pane.id.replace('main-', '');
      pane.classList.toggle('active', paneTab === tab);
    });
  }

  destroy() {
    this._isMounted = false;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this.contract = null;
  }
}

export const contractDetail = new ContractDetail();
