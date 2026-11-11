// Tag-Filter des Budget-Tabs: Mehrfachauswahl rechts neben der Überschrift
// (data-budget-filter), Chips darunter. Jede Änderung schreibt den Tab über
// updateBudgetTab neu, die Zahlen zählen per GSAP mit.
// Die Auswahl gilt pro Produktion und überlebt Tab- und Linienwechsel.

import {
  bindFilterSelects,
  readFilterSelectValues,
  renderFilterSelect,
  syncFilterSelect
} from '../../core/filters/FilterSelect.js';
import { updateBudgetTab, verfuegbareTags } from './budgetTab.js';

const FILTER_ID = 'budget-tags';
const WRAPPER_ID = `filter-select-${FILTER_ID}`;

const FILTER_CONFIG = {
  id: FILTER_ID,
  label: 'Tags',
  type: 'multiSelect',
  emptyLabel: 'Alle Tags',
  placeholder: 'Tags suchen...',
  portal: true
};

function budgetPane() {
  return document.getElementById('workflow-pane-budget');
}

/** Gewählte Tag-IDs der aktuellen Produktion. Wechselt die Produktion, ist die Auswahl leer. */
export function aktuelleBudgetTags(detail) {
  if (!detail) return [];
  if (detail._budgetTagProduktion !== detail.produktionId) {
    detail._budgetTagProduktion = detail.produktionId;
    detail.budgetTagIds = [];
  }
  return detail.budgetTagIds || [];
}

// Das Panel hängt im offenen Zustand am body (portal), sonst im Wrapper.
function checkboxen(wrapper) {
  const portaled = document.querySelector(`.filter-select__panel[data-filter-owner="${WRAPPER_ID}"]`);
  return [...(portaled || wrapper).querySelectorAll('input[type="checkbox"]')];
}

function neuZeichnen(detail) {
  const state = detail?._budgetFilter;
  if (!state) return;
  updateBudgetTab(budgetPane(), state.daten, state.optionen(), { animate: true });
}

/**
 * Auswahl von außen setzen (Chip entfernen): Checkboxen, Trigger-Text und Tab nachziehen.
 */
export function setBudgetTags(detail, ids) {
  if (!detail?._budgetFilter) return;
  detail.budgetTagIds = [...new Set((ids || []).map(String))];
  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    checkboxen(wrapper).forEach((box) => { box.checked = detail.budgetTagIds.includes(box.value); });
    syncFilterSelect(wrapper);
  }
  neuZeichnen(detail);
}

export function unmountBudgetFilter(detail) {
  const state = detail?._budgetFilter;
  if (!state) return;
  state.abort.abort();
  document.querySelector(`.filter-select__panel[data-filter-owner="${WRAPPER_ID}"]`)?.remove();
  if (state.slot.isConnected) state.slot.innerHTML = '';
  detail._budgetFilter = null;
}

/**
 * Dropdown neben die Überschrift hängen. Ohne Tags an den Kooperationen bleibt der Platz leer.
 * @param {object} detail - KampagneDetail
 * @param {object} params
 * @param {object} params.daten - Ergebnis von ladeBudgetDaten
 * @param {() => object} params.optionen - aktuelle Optionen für renderBudgetTab (inkl. tagIds)
 */
export function mountBudgetFilter(detail, { daten, optionen }) {
  unmountBudgetFilter(detail);
  const slot = budgetPane()?.querySelector('[data-budget-filter]');
  if (!slot || !detail) return;

  const tags = verfuegbareTags(daten?.koops);
  const bekannt = new Set(tags.map((t) => t.value));
  detail.budgetTagIds = aktuelleBudgetTags(detail).filter((id) => bekannt.has(id));
  if (!tags.length) {
    slot.innerHTML = '';
    return;
  }

  const abort = new AbortController();
  detail._budgetFilter = { abort, slot, daten, optionen };
  slot.innerHTML = renderFilterSelect(FILTER_CONFIG, detail.budgetTagIds, tags);
  bindFilterSelects(slot, { signal: abort.signal });

  slot.addEventListener('change', (event) => {
    if (event.target.closest?.('[data-select-search]')) return;
    const wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) return;
    detail.budgetTagIds = readFilterSelectValues(wrapper);
    neuZeichnen(detail);
  }, { signal: abort.signal });
}
