// InvoiceMonthFilter.js
// Clientseitige Tab-Filterung fuer die Kundenrechnungen-Liste.
// Exklusiv: kein re_nr → Ohne Rechnungsnummer; sonst kein Datum → Ohne Datum; sonst Monat.

import { getInvoiceMonthKey } from './InvoiceDisplayDate.js';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONTH_FULL_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
export const UNDATED_TAB = 'undated';
export const NO_RENR_TAB = 'no-renr';
export const ALL_TAB = 'alle';

export function hasInvoiceNumber(row) {
  return Boolean(String(row?.re_nr ?? '').trim());
}

export function getInvoiceTabKey(row) {
  if (!hasInvoiceNumber(row)) return NO_RENR_TAB;
  return getInvoiceMonthKey(row) || UNDATED_TAB;
}

export function parseMonthTab(tab) {
  if (tab === UNDATED_TAB || tab === NO_RENR_TAB || tab === ALL_TAB) return tab;
  return parseInt(tab, 10);
}

export function getCurrentMonthSelection(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() };
}

function isYearKey(key, year) {
  return Boolean(key && typeof key === 'object' && key.year === year);
}

export function filterRowsByMonthYear(rows, { year, month }, getTabKey = getInvoiceTabKey) {
  const list = rows || [];
  if (month === ALL_TAB) return list.filter(row => isYearKey(getTabKey(row), year));
  if (month === NO_RENR_TAB || month === UNDATED_TAB) {
    return list.filter(row => getTabKey(row) === month);
  }
  const monthIndex = Number(month);
  return list.filter(row => {
    const key = getTabKey(row);
    return isYearKey(key, year) && key.month === monthIndex;
  });
}

export function countRowsByMonth(rows, year, getTabKey = getInvoiceTabKey) {
  const list = rows || [];
  const counts = { [UNDATED_TAB]: 0, [NO_RENR_TAB]: 0, [ALL_TAB]: 0, months: Array(12).fill(0) };
  for (const row of list) {
    const key = getTabKey(row);
    if (key === NO_RENR_TAB) counts[NO_RENR_TAB] += 1;
    else if (key === UNDATED_TAB) counts[UNDATED_TAB] += 1;
    else if (isYearKey(key, year)) {
      counts.months[key.month] += 1;
      counts[ALL_TAB] += 1;
    }
  }
  return counts;
}

export function formatMonthEmptyText(month, year) {
  if (month === ALL_TAB) return `Keine Rechnungen in ${year}.`;
  if (month === NO_RENR_TAB) return 'Keine Rechnungen ohne Rechnungsnummer.';
  if (month === UNDATED_TAB) return 'Keine Rechnungen ohne Datum.';
  return `Keine Rechnungen im ${MONTH_FULL_NAMES[month]} ${year}.`;
}

export function findInvoiceCacheRow(rows, id) {
  return (rows || []).find(row => (row.teilrechnung_id || row.id) === id) || null;
}
