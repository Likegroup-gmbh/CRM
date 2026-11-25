// sortableHeader.js (ES6-Modul)
// Wiederverwendbare Klick-Sortierung fuer Tabellenkoepfe.
// Ein sortierbarer Kopf zeigt immer zwei gestapelte Chevrons; die aktive Richtung
// steuert allein das Attribut aria-sort (Styles: tabellen.css, .th-sortable).
//
// Einbinden in einer Liste:
//   thead.innerHTML = `<tr>${cols.map(c => renderSortHeaderCell(c, this.currentSort)).join('')}</tr>`;
//   bindSortableHeaders(thead, {
//     signal,
//     getSort: () => this.currentSort,
//     defaultAscending: (field) => field === 'name',
//     onChange: (sort) => { this.onSortChange(sort); syncSortHeaders(thead, sort); }
//   });

import { icon } from '../icons/IconSystem.js';

const HEADER_SELECTOR = 'th[data-sort]';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wert fuer aria-sort: 'ascending' | 'descending' | 'none'. */
export function getAriaSort(currentSort, field) {
  if (!currentSort || currentSort.field !== field) return 'none';
  return currentSort.ascending ? 'ascending' : 'descending';
}

/**
 * Naechste Sortierung nach Klick: neue Spalte startet mit defaultAscending(field),
 * erneuter Klick auf dieselbe Spalte kehrt die Richtung um.
 * @param {{field: string, ascending: boolean}} current
 * @param {string} field
 * @param {(field: string) => boolean} [defaultAscending]
 */
export function nextSort(current, field, defaultAscending = () => true) {
  const ascending = current?.field === field
    ? !current.ascending
    : !!defaultAscending(field);
  return { field, ascending };
}

/**
 * Rendert einen Tabellenkopf. Mit `col.field` sortierbar, sonst ein normaler th.
 * @param {{label: string, field?: string, className?: string}} col
 * @param {{field: string, ascending: boolean}} currentSort
 */
export function renderSortHeaderCell(col, currentSort) {
  const label = escapeHtml(col.label);
  if (!col.field) {
    const classAttr = col.className ? ` class="${col.className}"` : '';
    return `<th${classAttr}>${label}</th>`;
  }

  const classes = [col.className, 'th-sortable'].filter(Boolean).join(' ');
  const indicator = `<span class="th-sort-icons" aria-hidden="true">`
    + `${icon('arrow-chevron-up', { className: 'th-sort-up' })}`
    + `${icon('arrow-chevron-down', { className: 'th-sort-down' })}`
    + `</span>`;

  return `<th class="${classes}" data-sort="${escapeHtml(col.field)}" tabindex="0" aria-sort="${getAriaSort(currentSort, col.field)}">`
    + `<span class="th-sort"><span class="th-sort-label">${label}</span>${indicator}</span>`
    + `</th>`;
}

/** Setzt aria-sort an allen sortierbaren Koepfen in root; die Chevrons folgen per CSS. */
export function syncSortHeaders(root, currentSort) {
  if (!root) return;
  root.querySelectorAll(HEADER_SELECTOR).forEach(th => {
    th.setAttribute('aria-sort', getAriaSort(currentSort, th.dataset.sort));
  });
}

/**
 * Bindet Klick und Enter/Leertaste per Delegation auf alle `th[data-sort]` in root.
 * @param {HTMLElement} root - z.B. das thead
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @param {() => {field: string, ascending: boolean}} options.getSort
 * @param {(sort: {field: string, ascending: boolean}) => void} options.onChange
 * @param {(field: string) => boolean} [options.defaultAscending]
 */
export function bindSortableHeaders(root, { signal, getSort, onChange, defaultAscending } = {}) {
  if (!root) return;

  const activate = (th) => {
    const sort = nextSort(getSort?.(), th.dataset.sort, defaultAscending);
    onChange?.(sort);
  };

  root.addEventListener('click', (e) => {
    const th = e.target.closest(HEADER_SELECTOR);
    if (th && root.contains(th)) activate(th);
  }, { signal });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const th = e.target.closest(HEADER_SELECTOR);
    if (!th || !root.contains(th)) return;
    e.preventDefault();
    activate(th);
  }, { signal });
}
