// FilterDropdown.js (ES6-Modul)
// Fassade — delegiert an FilterDropdownRender, FilterDropdownEvents, FilterDropdownFormatApply

import { modularFilterSystem } from './ModularFilterSystem.js';

import {
  renderDropdown as _renderDropdown,
  renderActiveFilters as _renderActiveFilters,
  renderActiveFiltersAsync as _renderActiveFiltersAsync,
  renderFilterSubmenu as _renderFilterSubmenu,
} from './FilterDropdownRender.js';

import {
  bindGlobalEvents as _bindGlobalEvents,
  closeAllDropdowns as _closeAllDropdowns,
} from './FilterDropdownEvents.js';

import {
  getActiveFilterCount as _getActiveFilterCount,
  getEntityTypeForFilter as _getEntityTypeForFilter,
  formatFilterValue as _formatFilterValue,
  formatFilterValueSync as _formatFilterValueSync,
  loadFilterLabelAsync as _loadFilterLabelAsync,
  applyFilterFromSubmenu as _applyFilterFromSubmenu,
  removeFilter as _removeFilter,
  resetAllFilters as _resetAllFilters,
  updateUI as _updateUI,
  executeFilterCallback as _executeFilterCallback,
  getActiveFilters as _getActiveFilters,
  setFilters as _setFilters,
} from './FilterDropdownFormatApply.js';

export class FilterDropdown {
  constructor() {
    this.instances = new Map();
    this.filterConfigs = new Map();
    this.optionsCache = new Map();
    this.callbacks = new Map();
    this._eventsBound = false;
  }

  // --- Cache API ---

  getOptionsCacheKey(entityType, filterId) {
    return `${entityType}:${filterId}`;
  }

  getCachedOptions(entityType, filterId) {
    return this.optionsCache.get(this.getOptionsCacheKey(entityType, filterId)) || null;
  }

  setCachedOptions(entityType, filterId, options) {
    this.optionsCache.set(this.getOptionsCacheKey(entityType, filterId), options);
  }

  invalidateOptionsCache(entityType = null) {
    if (entityType) {
      for (const key of this.optionsCache.keys()) {
        if (key.startsWith(`${entityType}:`)) this.optionsCache.delete(key);
      }
    } else {
      this.optionsCache.clear();
    }
  }

  // --- Lifecycle ---

  async init(entityType, containerElement, callbacks = {}) {
    if (!containerElement) return;

    this.callbacks.set(entityType, {
      onFilterApply: callbacks.onFilterApply || (() => {}),
      onFilterReset: callbacks.onFilterReset || (() => {}),
    });

    const config = await this.loadFilterConfig(entityType);
    if (!config?.filters?.length) {
      containerElement.innerHTML = '<p class="text-muted">Keine Filter verfügbar</p>';
      return;
    }

    containerElement.innerHTML = this.renderDropdown(entityType, config);

    this.instances.set(entityType, {
      containerElement,
      config,
      activeFilters: new Map(),
    });

    const existingFilters = modularFilterSystem.getFilters(entityType);
    if (existingFilters && Object.keys(existingFilters).length > 0) {
      const instance = this.instances.get(entityType);
      Object.entries(existingFilters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          instance.activeFilters.set(key, value);
        }
      });
      await this.updateUI(entityType);
    }

    if (!this._eventsBound) {
      this.bindGlobalEvents();
    }
  }

  async loadFilterConfig(entityType) {
    if (this.filterConfigs.has(entityType)) return this.filterConfigs.get(entityType);

    try {
      const config = await modularFilterSystem.loadDynamicFilters(entityType);
      this.filterConfigs.set(entityType, config);
      return config;
    } catch (error) {
      console.error(`Fehler beim Laden der Filter-Config für ${entityType}:`, error);
      return { filters: [], groups: [], presets: [] };
    }
  }

  destroy() {
    if (this._clickHandler) {
      document.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }
    this._eventsBound = false;
    this.instances.clear();
    this.filterConfigs.clear();
    this.optionsCache.clear();
    this.callbacks.clear();
  }

  // --- Render-Delegation ---

  renderDropdown(entityType, config) { return _renderDropdown(this, entityType, config); }
  renderActiveFilters(entityType) { return _renderActiveFilters(this, entityType); }
  async renderActiveFiltersAsync(entityType) { return _renderActiveFiltersAsync(this, entityType); }
  async renderFilterSubmenu(filterConfig, entityType) { return _renderFilterSubmenu(this, filterConfig, entityType); }

  // --- Events-Delegation ---

  bindGlobalEvents() { _bindGlobalEvents(this); }
  closeAllDropdowns() { _closeAllDropdowns(); }

  // --- FormatApply-Delegation ---

  getActiveFilterCount(entityType) { return _getActiveFilterCount(this, entityType); }
  getEntityTypeForFilter(filterId) { return _getEntityTypeForFilter(this, filterId); }
  async formatFilterValue(filterConfig, value) { return _formatFilterValue(filterConfig, value); }
  formatFilterValueSync(filterConfig, value) { return _formatFilterValueSync(this, filterConfig, value); }
  async loadFilterLabelAsync(filterConfig, value) { return _loadFilterLabelAsync(this, filterConfig, value); }
  async applyFilterFromSubmenu(entityType, filterId, submenu) { return _applyFilterFromSubmenu(this, entityType, filterId, submenu); }
  async removeFilter(entityType, filterId) { return _removeFilter(this, entityType, filterId); }
  async resetAllFilters(entityType) { return _resetAllFilters(this, entityType); }
  async updateUI(entityType) { return _updateUI(this, entityType); }
  async executeFilterCallback(entityType) { return _executeFilterCallback(this, entityType); }
  getActiveFilters(entityType) { return _getActiveFilters(this, entityType); }
  async setFilters(entityType, filters) { return _setFilters(this, entityType, filters); }
}

// Singleton-Instanz exportieren
export const filterDropdown = new FilterDropdown();
export default filterDropdown;
