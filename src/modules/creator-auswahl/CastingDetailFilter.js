// CastingDetailFilter.js
// Namenssuche, Status-Reiter und Filterspalte der Casting-Liste (Prototype-Mixin).

import { getSourcingTabForItem, SOURCING_TABS } from './sourcingTabs.js';
import { vorschlagToItem } from './CastingVorschlagService.js';
import { castingFilterDefs, castingFilterGroups, createCastingTableFilter } from './castingFilterSpalte.js';

export function kannVorschlaegeSehen() {
  if (this.isKunde) return false;
  if (window.isGastReadonly?.()) return false;
  return true;
}

export function getVorschlagItems() {
  if (!this.kannVorschlaegeSehen()) return [];
  const listeTyp = this.liste?.liste_typ;
  // Streng nach Matching absteigend (ADR 0014); die DB liefert das schon,
  // die Sortierung hier faengt Alt-Daten ohne matching_score ab.
  return (this.vorschlagPanel?.vorschlaege || [])
    .map(v => vorschlagToItem(v, { listeTyp }))
    .sort((a, b) => (b.matching_score ?? -1) - (a.matching_score ?? -1));
}

export function getDisplayItems() {
  return [...this.getVorschlagItems(), ...this.items];
}

export function getSearchFilteredItems() {
  const query = (this.searchQuery || '').trim().toLowerCase();
  const items = this.getDisplayItems();
  if (!query) return items;
  return items.filter(item => (item.name || '').toLowerCase().includes(query));
}

// Namenssuche und Filterspalte greifen reiteruebergreifend – die Reiter-Zahlen
// beziehen sich deshalb auf diese Menge, nicht auf alle Items.
export function getBaseFilteredItems() {
  const items = this.getSearchFilteredItems();
  return this.tableFilter ? this.tableFilter.filter(items) : items;
}

// Vorschläge bleiben oben stehen, sortiert werden nur die Einträge darunter.
export function getFilteredItems() {
  const base = this.getBaseFilteredItems();
  const items = this.activeTab === 'alle'
    ? base
    : base.filter(item => getSourcingTabForItem(item) === this.activeTab);
  if (!this.tableFilter || this.tableFilter.isManualSort()) return items;
  const vorschlaege = items.filter(item => item.isVorschlag);
  const eintraege = items.filter(item => !item.isVorschlag);
  return [...vorschlaege, ...this.tableFilter.sort(eintraege)];
}

export function hasColumnFilters() {
  return !!this.tableFilter?.hasActiveFilters();
}

/** Optionen (Kategorien) und Rollen-Sicht der Filterspalte an den aktuellen Stand angleichen. */
export function syncTableFilter() {
  const ctx = {
    items: this.items,
    teilbereiche: this.getTeilbereiche(),
    isKunde: this.isKunde,
    hiddenColumns: this.hiddenColumns,
    customManager: this.customColumns
  };
  if (!this.tableFilter) {
    this.tableFilter = createCastingTableFilter(ctx);
    return;
  }
  const filters = castingFilterDefs(ctx);
  this.tableFilter.setFilters(filters, castingFilterGroups(filters));
}

export function getTabCounts() {
  const baseItems = this.getBaseFilteredItems();
  const counts = Object.fromEntries(SOURCING_TABS.map(t => [t.key, 0]));
  counts.alle = baseItems.length;
  counts.bewerbung = this.isKunde ? 0 : (this.bewerbungen || []).length;
  baseItems.forEach(item => {
    counts[getSourcingTabForItem(item)]++;
  });
  return counts;
}

export function handleSearch(value) {
  const newQuery = value || '';
  if (newQuery === this.searchQuery) return;
  this.searchQuery = newQuery;
  this.rerenderTable();
}

// Aktive Suche zuruecksetzen (z.B. bevor eine neue leere Zeile angelegt wird,
// die sonst vom Namensfilter ausgeblendet wuerde)
export function clearSearch() {
  if (!this.searchQuery) return;
  this.searchQuery = '';
  const input = this._q('#sourcing-item-search-input');
  if (input) input.value = '';
  const clearBtn = this._q('#sourcing-item-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  this.rerenderTable();
}

export function switchTab(tabName) {
  const known = tabName === 'bewerbung' || SOURCING_TABS.some(t => t.key === tabName);
  if (!known || tabName === this.activeTab) return;
  if (tabName === 'bewerbung' && this.isKunde) return;
  this.activeTab = tabName;

  this._qq('.sourcing-tab-navigation .tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sourcingTab === tabName);
  });

  this.rerenderTable();
}

export function updateTabCounts() {
  const counts = this.getTabCounts();
  this._qq('[data-sourcing-tab-count]').forEach(el => {
    el.textContent = counts[el.dataset.sourcingTabCount] ?? 0;
  });
}

// Nach dem Anlegen eines neuen Items zum "Offen"-Reiter wechseln,
// damit die neue Zeile sichtbar ist
export function ensureNewItemVisible() {
  this.clearSearch();
  if (this.activeTab !== 'offen' && this.activeTab !== 'alle') {
    this.switchTab('offen');
  }
}

export const castingDetailFilterMethods = {
  kannVorschlaegeSehen,
  getVorschlagItems,
  getDisplayItems,
  getSearchFilteredItems,
  getBaseFilteredItems,
  getFilteredItems,
  hasColumnFilters,
  syncTableFilter,
  getTabCounts,
  handleSearch,
  clearSearch,
  switchTab,
  updateTabCounts,
  ensureNewItemVisible
};
