// RechnungListRenderer.js
// All DOM rendering for the Rechnung list page.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { animateNumber } from '../../core/animation/animateNumber.js';
import { ALL_TAB, formatMonthEmptyText } from '../auftrag/logic/InvoiceMonthFilter.js';
import { renderBezahltToggle } from './RechnungBezahltToggle.js';
import { renderVertragCell } from './RechnungVertragColumn.js';
import { summarizeRechnungRows } from './invoiceCardTotals.js';

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const summaryFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateFormatter = new Intl.DateTimeFormat('de-DE');

function formatCurrency(v) { return v == null ? '-' : currencyFormatter.format(v); }
function formatDate(v) { return v ? dateFormatter.format(new Date(v)) : '-'; }
export function formatRechnungSummaryCurrency(value) {
  return summaryFormatter.format(Number(value) || 0);
}

export function getRechnungColumnCount(isAdmin) {
  return isAdmin ? 21 : 20;
}

function getRowClass(rechnung, today) {
  if (rechnung.status === 'Bezahlt') return 'rechnung-row-paid';
  if (rechnung.zahlungsziel) {
    const d = new Date(rechnung.zahlungsziel);
    d.setHours(0, 0, 0, 0);
    if (d < today) return 'rechnung-row-overdue';
  }
  return '';
}

function renderCreatedBy(user) {
  if (!user || !user.name) return '-';
  return avatarBubbles.renderBubbles([{
    name: user.name, type: 'person', id: user.id,
    entityType: 'mitarbeiter', profile_image_url: user.profile_image_url
  }]);
}

// ────────────────────────── Page shell ──────────────────────────

export function renderPageShell({ isAdmin, canEdit, searchQuery, statusTabs, typeTabs, activeStatusTab, activeTypeTab, monthSheetHtml }) {
  const statusTabsHtml = statusTabs.map(t => renderTabButton({
    tab: t.id,
    label: `${t.label}<span class="tab-count" data-status-count="${t.id}">0</span>`,
    isActive: t.id === activeStatusTab,
    skipPermissionCheck: true
  })).join('');

  const typeTabsHtml = typeTabs.map(t => renderTabButton({
    tab: t.id,
    label: `${t.label}<span class="tab-count" data-type-count="${t.id}">0</span>`,
    isActive: t.id === activeTypeTab,
    skipPermissionCheck: true
  })).join('');

  return `
    <div class="rechnungen-page">
    <div class="kr-sticky-head">
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${SearchInput.render('rechnung', { placeholder: 'Rechnung suchen...', currentValue: searchQuery })}
          <div id="filter-dropdown-container"></div>
          <div id="rechnung-unternehmen-filter-container"></div>
          <div id="rechnung-sort-filter-container"></div>
        </div>
      </div>
      <div class="table-actions">
        ${isAdmin ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
        <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
        <span id="selected-count" style="display:none;">0 ausgewählt</span>
        <button id="btn-download-selected" class="mdc-btn mdc-btn--secondary" style="display:none;">
          ${icon('arrow-down-tray')}
          Ausgewählte herunterladen
        </button>
        <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
        ${canEdit ? '<button id="btn-rechnung-new" class="mdc-btn">Neue Rechnung anlegen</button>' : ''}
      </div>
    </div>

    <div class="tab-navigation rechnung-type-tabs">${typeTabsHtml}</div>
    <div class="tab-navigation rechnung-status-tabs">${statusTabsHtml}</div>
    </div>

    <div class="kr-scroll-body">
    ${renderInvoiceSummaryCards()}
    <div class="data-table-container rechnung-table-container">
      <table class="data-table data-table--nowrap data-table--rechnung">
        <thead>
          <tr>
            ${isAdmin ? '<th class="col-checkbox"><input type="checkbox" id="select-all-rechnungen"></th>' : ''}
            <th class="col-name">Rechnungsname</th>
            <th class="col-auftrag">Auftrag</th>
            <th class="col-po">PO-Nummer</th>
            <th class="col-created-at">Erstellt am</th>
            <th class="col-unternehmen">Unternehmen</th>
            <th class="col-land">Land</th>
            <th class="col-creator">Creator</th>
            <th class="col-gestellt-am">Gestellt am</th>
            <th class="col-zahlungsziel">Zahlungsziel</th>
            <th class="col-netto">Nettobetrag</th>
            <th class="col-videos">Videos</th>
            <th class="col-preis-video">Preis/Video</th>
            <th class="col-brutto">Bruttobetrag</th>
            <th class="col-ksk">KSK</th>
            <th class="col-beleg">Beleg</th>
            <th class="col-vertrag">Vertrag</th>
            <th class="col-status">Status</th>
            <th class="col-erstellt-von">Erstellt von</th>
            <th class="table-cell-center col-bezahlt">Bezahlt</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody id="rechnungen-table-body">
          <tr><td colspan="${getRechnungColumnCount(isAdmin)}" class="loading">Lade Rechnungen...</td></tr>
        </tbody>
        ${renderInvoiceSummaryFoot(isAdmin)}
      </table>
    </div>
    </div>

    <div class="kr-sticky-foot">${monthSheetHtml}</div>
    </div>
  `;
}

// ────────────────────────── Summary ──────────────────────────

export function renderInvoiceSummaryCards() {
  const zero = formatRechnungSummaryCurrency(0);
  const cards = [
    { field: 'koop_creator_kosten', label: 'Netto Creator Kosten' },
    { field: 'gestellt_netto', label: 'Netto Creator Kosten gestellt', mwst: true },
    { field: 'bezahlt_netto', label: 'Netto Creator Kosten bezahlt' },
    { field: 'offen_netto', label: 'Netto Creator Kosten unbezahlt', ueberfaellig: true }
  ];
  return `
    <div class="auftragsdetails-summary" id="rechnungen-summary-cards">
      <div class="summary-cards">
        ${cards.map(({ field, label, mwst, ueberfaellig }) => `
          <div class="summary-card" data-summary-card="${field}">
            <div class="summary-value" data-summary-value="${field}">${zero}</div>
            <div class="summary-label">${label}</div>
            ${mwst ? `
              <div class="summary-card-breakdown">
                <div class="summary-card-breakdown-line">
                  <span>abzuführende MwSt</span>
                  <span data-summary-value="gestellt_ust">${zero}</span>
                </div>
              </div>
            ` : ''}
            ${ueberfaellig ? `
              <div class="summary-card-breakdown">
                <div class="summary-card-breakdown-line summary-card-breakdown-line--overdue">
                  <span>davon überfällig</span>
                  <span data-summary-value="ueberfaellig_netto">${zero}</span>
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderInvoiceSummaryFoot(isAdmin) {
  const zero = formatRechnungSummaryCurrency(0);
  const beforeNetto = isAdmin ? 10 : 9;
  return `
    <tfoot id="rechnungen-summary">
      <tr>
        <td colspan="${beforeNetto}" class="col-summary-label">Summe</td>
        <td class="col-netto" data-summary="nettobetrag">${zero}</td>
        <td class="col-videos"></td>
        <td class="col-preis-video"></td>
        <td class="col-brutto" data-summary="bruttobetrag">${zero}</td>
        <td colspan="7"></td>
      </tr>
    </tfoot>
  `;
}

export function updateInvoiceSummary(rows, { animate = false, creatorKosten = 0 } = {}) {
  const summary = summarizeRechnungRows(rows);
  const foot = document.getElementById('rechnungen-summary');
  const cards = document.getElementById('rechnungen-summary-cards');
  const format = formatRechnungSummaryCurrency;
  const entries = {
    nettobetrag: summary.nettobetrag,
    bruttobetrag: summary.bruttobetrag,
    koop_creator_kosten: Number(creatorKosten) || 0,
    gestellt_netto: summary.gestellt_netto,
    gestellt_ust: summary.gestellt_ust,
    bezahlt_netto: summary.bezahlt_netto,
    offen_netto: summary.offen_netto,
    ueberfaellig_netto: summary.ueberfaellig_netto
  };
  Object.entries(entries).forEach(([field, value]) => {
    const targets = [
      foot?.querySelector(`[data-summary="${field}"]`),
      cards?.querySelector(`[data-summary-value="${field}"]`)
    ];
    targets.forEach((el) => {
      if (!el) return;
      if (animate) animateNumber(el, value, { format });
      else el.textContent = format(value);
    });
  });
}

// ────────────────────────── Table rows ──────────────────────────

export async function updateTableRows(rechnungen, { isAdmin, statusOptions, activeStatusTab, activeTypeTab, currentMonth, currentYear, notizMap, hasActiveFilters, animate = false, creatorKosten = 0 }) {
  const tbody = document.getElementById('rechnungen-table-body');
  if (!tbody) return;

  const canToggleBezahlt = isAdmin;
  updateInvoiceSummary(rechnungen, { animate, creatorKosten });

  await TableAnimationHelper.animatedUpdate(tbody, async () => {
    if (!rechnungen || rechnungen.length === 0) {
      const colspan = tbody.closest('table')?.querySelector('thead tr')?.children?.length || getRechnungColumnCount(isAdmin);
      const isContract = activeTypeTab === 'contracting';
      const entityLabel = isContract ? 'Contracts' : 'Rechnungen';
      const hasMonthFilter = currentMonth !== ALL_TAB;
      const html = hasMonthFilter
        ? renderEmptyState({ icon: 'invoice', title: `Keine ${entityLabel} vorhanden`, text: formatMonthEmptyText(currentMonth, currentYear) })
        : resolveEmptyState({
            hasActiveFilters: hasActiveFilters,
            states: {
              alle: { icon: 'invoice', title: `Keine ${entityLabel} vorhanden` },
              Offen: { icon: 'invoice', title: `Keine offenen ${entityLabel}`, text: 'Es gibt aktuell keine offenen Posten.' },
              'Rückfrage': { icon: 'invoice', title: `Keine ${entityLabel} in Rückfrage` },
              Bezahlt: { icon: 'check', title: `Keine bezahlten ${entityLabel}`, text: 'Noch ist nichts bezahlt worden.' },
              'An Qonto gesendet': { icon: 'invoice', title: `Keine ${entityLabel} an Qonto gesendet` },
              'Marc an Qonto gesendet': { icon: 'invoice', title: `Keine ${entityLabel} von Marc an Qonto gesendet` }
            }
          }, activeStatusTab);
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tbody.innerHTML = rechnungen.map(r => `
      <tr data-id="${r.id}" class="${getRowClass(r, today)}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="rechnung-check" data-id="${r.id}"></td>` : ''}
        <td class="col-name"><span class="col-name-inner">${r.rechnung_nr || '-'}${renderNotizIndicator(r.id, activeStatusTab, notizMap)}</span></td>
        <td class="col-auftrag">${r.auftrag_id ? `<a href="#" class="table-link" data-table="${r.rechnungstyp === 'contracting' ? 'contracts' : 'auftragsdetails'}" data-id="${r.rechnungstyp === 'contracting' ? r.auftrag_id : (r.auftrag?.auftrag_details?.[0]?.id || r.auftrag_id)}">${r.auftrag?.auftragsname || '-'}</a>` : '-'}</td>
        <td class="col-po">${r.po_nummer || '-'}</td>
        <td class="col-created-at">${formatDate(r.created_at)}</td>
        <td class="col-unternehmen">${r.unternehmen?.firmenname || '-'}</td>
        <td class="col-land">${r.land || '-'}</td>
        <td class="col-creator">${[r.creator?.vorname, r.creator?.nachname].filter(Boolean).join(' ') || '-'}</td>
        <td class="col-gestellt-am">${formatDate(r.gestellt_am)}</td>
        <td class="col-zahlungsziel">${formatDate(r.zahlungsziel)}</td>
        <td class="col-netto">${formatCurrency(r.nettobetrag)}</td>
        <td class="col-videos">${r.videoanzahl || '-'}</td>
        <td class="col-preis-video">${r.videoanzahl && r.nettobetrag ? formatCurrency(r.nettobetrag / r.videoanzahl) : '-'}</td>
        <td class="col-brutto">${formatCurrency(r.bruttobetrag)}</td>
        <td class="col-ksk">${r.rechnungstyp === 'contracting' ? (r.ksk_pflichtig ? '<span class="status-badge status-erfolg">Ja</span>' : '<span class="status-badge status-inactive">Nein</span>') : ((parseFloat(r.ksk_betrag) || 0) > 0 ? formatCurrency(r.ksk_betrag) : '—')}</td>
        <td class="col-beleg">${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
        <td class="col-vertrag">${renderVertragCell(r)}</td>
        <td class="col-status" data-col="status">${r.status || '-'}</td>
        <td class="col-erstellt-von">${renderCreatedBy(r.created_by)}</td>
        <td class="table-cell-center col-bezahlt">${renderBezahltToggle(r, canToggleBezahlt)}</td>
        <td class="col-actions">
          ${actionBuilder.create('rechnung', r.id, window.currentUser, {
            statusOptions,
            currentStatus: { id: r.status, name: r.status },
            restrictToPaid: (r.status === 'Bezahlt') && !isAdmin
          })}
        </td>
      </tr>
    `).join('');
  });
}

// ────────────────────────── Inline row update ──────────────────────────

export function updateSingleRow(id, newStatus, { rechnungen, statusOptions, activeStatusTab, statusTabs, blattCounts, typeTabs, reloadCallback }) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) { reloadCallback(); return; }

  const rechnung = rechnungen.find(r => r.id === id);
  if (rechnung) rechnung.status = newStatus;

  let statusCell = row.querySelector('td[data-col="status"]');
  if (!statusCell) {
    const table = row.closest('table');
    const headerCells = table ? Array.from(table.querySelectorAll('thead th')) : [];
    const idx = headerCells.findIndex(th => th.textContent?.trim() === 'Status');
    if (idx >= 0) statusCell = row.cells[idx];
  }
  if (!statusCell) { reloadCallback(); return; }
  statusCell.textContent = newStatus || '-';

  row.classList.remove('rechnung-row-paid', 'rechnung-row-overdue');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (newStatus === 'Bezahlt') {
    row.classList.add('rechnung-row-paid');
  } else if (rechnung?.zahlungsziel) {
    const d = new Date(rechnung.zahlungsziel); d.setHours(0, 0, 0, 0);
    if (d < today) row.classList.add('rechnung-row-overdue');
  }

  const toggle = row.querySelector('.rechnung-bezahlt-toggle');
  if (toggle) toggle.checked = (newStatus === 'Bezahlt');

  const actionsCell = row.cells[row.cells.length - 1];
  if (actionsCell && rechnung) {
    const isAdminRow = window.isAdmin();
    actionsCell.innerHTML = actionBuilder.create('rechnung', id, window.currentUser, {
      statusOptions,
      currentStatus: { id: newStatus, name: newStatus },
      restrictToPaid: (newStatus === 'Bezahlt') && !isAdminRow
    });
  }

  updateStatusTabCounts(rechnungen, statusTabs, blattCounts, typeTabs);
  if (activeStatusTab !== 'alle' && newStatus !== activeStatusTab) row.remove();
}

// ────────────────────────── Tab counts ──────────────────────────

export function updateStatusTabCounts(rechnungen, statusTabs, blattCounts, typeTabs) {
  const monthRows = rechnungen || [];
  const counts = { alle: monthRows.length };
  statusTabs.forEach(t => {
    if (t.id !== 'alle') counts[t.id] = monthRows.filter(r => r.status === t.id).length;
  });
  statusTabs.forEach(t => {
    const el = document.querySelector(`[data-status-count="${t.id}"]`);
    if (el) el.textContent = counts[t.id] || 0;
  });
  const typeCounts = blattCounts?.type || { rechnung: 0, contracting: 0 };
  typeTabs.forEach(t => {
    const el = document.querySelector(`[data-type-count="${t.id}"]`);
    if (el) el.textContent = typeCounts[t.id] || 0;
  });
}

// ────────────────────────── PDF cells patch ─────────────────────

export function patchPdfCells(rechnungen) {
  for (const rechnung of rechnungen || []) {
    const cell = document.querySelector(`#rechnungen-table-body tr[data-id="${rechnung.id}"] .col-beleg`);
    if (cell) cell.innerHTML = renderPdfLinks(rechnung.rechnung_pdfs, rechnung.pdf_url);
  }
}

// ────────────────────────── Notiz indicator ─────────────────────

function renderNotizIndicator(rechnungId, activeStatusTab, notizMap) {
  if (activeStatusTab !== 'Rückfrage') return '';
  if (!notizMap.has(rechnungId)) return '';
  return `<button class="notiz-indicator" data-notiz-id="${rechnungId}" title="Rückfrage-Notiz anzeigen">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="14" height="14">
      <path d="M88,96a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,96Zm8,40h64a8,8,0,0,0,0-16H96a8,8,0,0,0,0,16Zm32,16H96a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16ZM224,48V156.69A15.86,15.86,0,0,1,219.31,168L168,219.31A15.86,15.86,0,0,1,156.69,224H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM48,208H152V160a8,8,0,0,1,8-8h48V48H48Zm120-40v28.7L196.69,168Z"></path>
    </svg>
  </button>`;
}
