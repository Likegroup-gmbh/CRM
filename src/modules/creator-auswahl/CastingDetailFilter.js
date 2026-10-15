// CastingDetailFilter.js
// Namenssuche und Status-Reiter der Casting-Liste (Prototype-Mixin).

import { getSourcingTabForItem, SOURCING_TABS } from './sourcingTabs.js';
import { matchesStatusFilter } from './sourcingStatusOptions.js';
import { vorschlagToItem } from './CastingVorschlagService.js';

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

// Namenssuche und Statusfilter greifen reiteruebergreifend – die Reiter-Zahlen
// beziehen sich deshalb auf diese Menge, nicht auf alle Items.
export function getBaseFilteredItems() {
  return this.getSearchFilteredItems().filter(item => matchesStatusFilter(item, this.statusFilter));
}

export function getFilteredItems() {
  const items = this.getBaseFilteredItems();
  if (this.activeTab === 'alle') return items;
  return items.filter(item => getSourcingTabForItem(item) === this.activeTab);
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
  getTabCounts,
  handleSearch,
  clearSearch,
  switchTab,
  updateTabCounts,
  ensureNewItemVisible
};
