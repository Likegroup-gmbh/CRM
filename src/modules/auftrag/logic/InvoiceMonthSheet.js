// InvoiceMonthSheet.js
// Shared month-tab rendering + UI-update for RechnungList and AusgangsrechnungenList.

import { ALL_TAB, MONTH_LABELS, UNDATED_TAB, parseMonthTab } from './InvoiceMonthFilter.js';
import { renderTabButton } from '../../../core/TabUtils.js';

const YEAR_RANGE = 5;

/**
 * @param {Object} opts
 * @param {string} opts.rootId          – container id, e.g. 'rechnung-month-tabs'
 * @param {string} opts.yearSelectId    – <select> id, e.g. 'rechnung-year-select'
 * @param {number} opts.year            – selected year
 * @param {number|string} opts.month    – selected month index, ALL_TAB, or UNDATED_TAB
 * @param {Array<{tab:string,label:string}>} [opts.extraTabs] – e.g. [{tab:'no-renr',label:'Ohne Rechnungsnummer'}]
 * @returns {string} HTML
 */
export function renderInvoiceMonthSheet({ rootId, yearSelectId, year, month, extraTabs }) {
  const nowYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = nowYear - YEAR_RANGE; y <= nowYear + YEAR_RANGE; y += 1) {
    yearOptions.push(`<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`);
  }

  const allTab = renderTabButton({
    tab: ALL_TAB,
    label: `Alle<span class="tab-count" data-month-count="${ALL_TAB}">0</span>`,
    isActive: month === ALL_TAB,
    skipPermissionCheck: true
  });

  const monthTabs = MONTH_LABELS.map((label, index) => renderTabButton({
    tab: String(index),
    label: `${label}<span class="tab-count" data-month-count="${index}">0</span>`,
    isActive: month === index,
    skipPermissionCheck: true
  })).join('');

  const undatedTab = renderTabButton({
    tab: UNDATED_TAB,
    label: `Ohne Datum<span class="tab-count" data-month-count="${UNDATED_TAB}">0</span>`,
    isActive: month === UNDATED_TAB,
    skipPermissionCheck: true
  });

  const extra = (extraTabs || []).map(({ tab, label }) => renderTabButton({
    tab,
    label: `${label}<span class="tab-count" data-month-count="${tab}">0</span>`,
    isActive: month === tab,
    skipPermissionCheck: true
  })).join('');

  return `
    <div class="tab-navigation ${rootId.replace(/-/g, '-')}" id="${rootId}">
      <select id="${yearSelectId}" class="form-select" aria-label="Jahr">
        ${yearOptions.join('')}
      </select>
      ${allTab}
      ${monthTabs}
      ${undatedTab}
      ${extra}
    </div>
  `;
}

/**
 * @param {Object} opts
 * @param {string} opts.rootId
 * @param {string} opts.yearSelectId
 * @param {number} opts.year
 * @param {number|string} opts.month
 * @param {Object} opts.counts – { months: number[], undated: number, alle: number, [key]: number }
 */
export function updateInvoiceMonthTabUI({ rootId, yearSelectId, year, month, counts }) {
  const root = document.getElementById(rootId);
  if (!root) return;

  MONTH_LABELS.forEach((_, index) => {
    const el = root.querySelector(`[data-month-count="${index}"]`);
    if (el) el.textContent = counts.months[index] || 0;
  });

  const undatedEl = root.querySelector(`[data-month-count="${UNDATED_TAB}"]`);
  if (undatedEl) undatedEl.textContent = counts[UNDATED_TAB] || 0;

  const allEl = root.querySelector(`[data-month-count="${ALL_TAB}"]`);
  if (allEl) allEl.textContent = counts[ALL_TAB] || 0;

  const yearSelect = document.getElementById(yearSelectId);
  if (yearSelect && String(yearSelect.value) !== String(year)) {
    yearSelect.value = String(year);
  }

  root.querySelectorAll('.tab-button[data-tab]').forEach(btn => {
    const tab = parseMonthTab(btn.dataset.tab);
    btn.classList.toggle('active', tab === month);
  });
}
