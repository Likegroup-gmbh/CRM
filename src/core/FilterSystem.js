// FilterSystem.js (ES6-Modul)
// Zentrale Filter-Logik für alle Entitäten

import { FILTER_CONFIGS as filterConfigs, enhanceFilterConfig } from './FilterConfig.js';
import { processFilterForm, resetFilterState } from './FilterLogic.js';
import { renderFilterBar } from './FilterUI.js';

class FilterSystem {
  constructor() {
    this.activeFilters = {};
    this.filterConfigs = filterConfigs;
    this.dynamicFilterData = {};
  }

  // Dynamische Filter-Daten laden und Konfiguration erweitern
  async loadDynamicFilters(entity) {
    try {
      if (!window.dataService) {
        console.warn('⚠️ DataService nicht verfügbar');
        return;
      }

      // Filter-Daten aus der Datenbank laden
      const filterData = await window.dataService.loadFilterData(entity);
      this.dynamicFilterData[entity] = filterData;

      // Filter-Konfiguration mit dynamischen Daten erweitern
      const baseConfig = this.getConfig(entity);
      const enhancedConfig = await enhanceFilterConfig(entity, baseConfig);
      this.setConfig(entity, enhancedConfig);

      console.log(`✅ Dynamische Filter für ${entity} geladen:`, filterData);
      return enhancedConfig;

    } catch (error) {
      console.error(`❌ Fehler beim Laden der dynamischen Filter für ${entity}:`, error);
      return this.filterConfigs[entity];
    }
  }

  // Filter-Konfiguration abrufen
  getConfig(entity) {
    return this.filterConfigs[entity] || filterConfigs[entity] || [];
  }

  // Filter-Konfiguration setzen (optional für dynamische Anpassung)
  setConfig(entity, config) {
    this.filterConfigs[entity] = config;
  }

  // Filter für eine Entität anwenden
  applyFilters(entity, filterData) {
    this.activeFilters[entity] = filterData;
  }

  // Filter zurücksetzen
  resetFilters(entity) {
    this.activeFilters[entity] = resetFilterState();
  }

  // Aktive Filter abrufen
  getFilters(entity) {
    return this.activeFilters[entity] || {};
  }

  // Filterbar für eine Entität rendern (mit dynamischen Daten)
  async renderFilterBar(entity, mountNode, onApply, onReset) {
    try {
      // Dynamische Filter laden falls noch nicht geladen
      if (!this.dynamicFilterData[entity]) {
        await this.loadDynamicFilters(entity);
      }

      const config = this.getConfig(entity);
      const currentFilters = this.getFilters(entity);
      await renderFilterBar(config, currentFilters, onApply, onReset, mountNode);

    } catch (error) {
      console.error(`❌ Fehler beim Rendern der Filter-Bar für ${entity}:`, error);
      // Fallback: Basis-Konfiguration verwenden
      const config = this.getConfig(entity);
      const currentFilters = this.getFilters(entity);
      await renderFilterBar(config, currentFilters, onApply, onReset, mountNode);
    }
  }

  // Filter aus FormData verarbeiten (z.B. aus HTML-Formular)
  processFormData(formData) {
    return processFilterForm(formData);
  }

  // Dynamische Filter-Daten für eine Entität abrufen
  getDynamicFilterData(entity) {
    return this.dynamicFilterData[entity] || {};
  }
}

export const filterSystem = new FilterSystem();
