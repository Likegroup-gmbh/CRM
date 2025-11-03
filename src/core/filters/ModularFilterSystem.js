// ModularFilterSystem.js (ES6-Modul)
// Neues modulares Filter-System das entitäts-spezifische Filter lädt

import { renderFilterBar } from '../FilterUI.js';
import { processFilterForm, resetFilterState } from '../FilterLogic.js';
import { getFilterConfig, getFilterLogic, hasFilterConfig, hasFilterLogic } from './FilterConfigRegistry.js';

/**
 * Modulares Filter-System
 * Lädt automatisch entitäts-spezifische Filter-Konfigurationen
 */
class ModularFilterSystem {
  constructor() {
    this.activeFilters = {};
    this.loadedConfigs = new Map();
    this.loadedLogics = new Map();
    this.dynamicFilterData = {};
  }

  /**
   * Lade entitäts-spezifische Filter-Konfiguration
   */
  async loadEntityConfig(entityType) {
    if (this.loadedConfigs.has(entityType)) {
      return this.loadedConfigs.get(entityType);
    }

    try {
      // Verwende die Filter-Registry statt dynamische Imports
      const config = getFilterConfig(entityType);
      this.loadedConfigs.set(entityType, config);
      
      console.log(`✅ Filter-Konfiguration für ${entityType} geladen:`, config);
      return config;

    } catch (error) {
      console.warn(`⚠️ Fehler beim Laden der Filter-Konfiguration für ${entityType}:`, error);
      
      // Fallback zu leerer Konfiguration
      const fallbackConfig = {
        filters: [],
        groups: [],
        presets: [],
        entityType
      };
      
      this.loadedConfigs.set(entityType, fallbackConfig);
      return fallbackConfig;
    }
  }

  /**
   * Lade entitäts-spezifische Filter-Logik
   */
  async loadEntityLogic(entityType) {
    if (this.loadedLogics.has(entityType)) {
      return this.loadedLogics.get(entityType);
    }

    try {
      // Verwende die Filter-Registry statt dynamische Imports
      const logic = getFilterLogic(entityType);
      this.loadedLogics.set(entityType, logic);
      
      if (logic) {
        console.log(`✅ Filter-Logik für ${entityType} geladen`);
      } else {
        console.log(`ℹ️ Keine spezifische Filter-Logik für ${entityType} verfügbar - verwende Standard-Logik`);
      }
      
      return logic;

    } catch (error) {
      console.warn(`⚠️ Fehler beim Laden der Filter-Logik für ${entityType}:`, error);
      return null;
    }
  }

  /**
   * Dynamische Filter-Daten laden und Konfiguration erweitern
   */
  async loadDynamicFilters(entityType) {
    try {
      if (!window.dataService) {
        console.warn('⚠️ DataService nicht verfügbar');
        return;
      }

      // Filter-Daten aus der Datenbank laden
      const filterData = await window.dataService.loadFilterData(entityType);
      this.dynamicFilterData[entityType] = filterData;

      // Entitäts-spezifische Konfiguration laden
      const config = await this.loadEntityConfig(entityType);
      
      // Filter mit dynamischen Daten erweitern
      const enhancedFilters = await this.enhanceFiltersWithDynamicData(config.filters, filterData);
      
      // Aktualisierte Konfiguration speichern
      const enhancedConfig = {
        ...config,
        filters: enhancedFilters
      };
      
      this.loadedConfigs.set(entityType, enhancedConfig);
      
      console.log(`✅ Dynamische Filter für ${entityType} geladen:`, filterData);
      return enhancedConfig;

    } catch (error) {
      console.error(`❌ Fehler beim Laden der dynamischen Filter für ${entityType}:`, error);
      return this.loadedConfigs.get(entityType) || { filters: [], groups: [], presets: [] };
    }
  }

  /**
   * Erweitere Filter mit dynamischen Daten
   */
  async enhanceFiltersWithDynamicData(filters, filterData) {
    return filters.map(filter => {
      // Skip wenn schon Optionen vorhanden oder nicht dynamisch
      if (!filter.dynamic && !filter.table) {
        return filter;
      }

      if (filter.options && filter.options.length > 0) {
        return filter;
      }

      // Suche nach passenden Daten
      const dataKey = filter.id;
      const altKey = dataKey.replace('_id', ''); // z.B. creator_type_id → creator_type
      
      const options = filterData[dataKey] || filterData[altKey] || [];
      
      if (options && options.length > 0) {
        return {
          ...filter,
          options: options
        };
      }

      // Fallback: Stelle sicher dass options Array existiert
      return {
        ...filter,
        options: filter.options || []
      };
    });
  }

  /**
   * Filter-Konfiguration für eine Entität abrufen
   */
  async getConfig(entityType) {
    let config = this.loadedConfigs.get(entityType);
    
    if (!config) {
      config = await this.loadEntityConfig(entityType);
    }

    return config;
  }

  /**
   * Filter für eine Entität anwenden
   */
  async applyFilters(entityType, filterData) {
    // Speichere die Original-Filter (nicht die processed ones)
    // Die Verarbeitung passiert später beim Query-Building
    this.activeFilters[entityType] = filterData;
    
    console.log(`🔍 Filter für ${entityType} angewendet:`, filterData);
  }

  /**
   * Filter für eine Entität zurücksetzen
   */
  resetFilters(entityType) {
    this.activeFilters[entityType] = resetFilterState();
    console.log(`🔄 Filter für ${entityType} zurückgesetzt`);
  }

  /**
   * Aktive Filter für eine Entität abrufen
   */
  getFilters(entityType) {
    return this.activeFilters[entityType] || {};
  }

  /**
   * Filterbar für eine Entität rendern (mit dynamischen Daten)
   */
  async renderFilterBar(entityType, mountNode, onApply, onReset) {
    try {
      // Immer dynamische Filter laden um sicherzustellen dass sie aktuell sind
      const config = await this.loadDynamicFilters(entityType);
      const currentFilters = this.getFilters(entityType);
      
      console.log(`🔍 Rendering Filter für ${entityType} mit Konfiguration:`, config);
      
      // Importiere renderFilterBar dynamisch und verwende async Version
      const { renderFilterBar } = await import('../FilterUI.js');
      await renderFilterBar(config.filters, currentFilters, onApply, onReset, mountNode);

      console.log(`✅ Filter-Bar für ${entityType} gerendert`);

    } catch (error) {
      console.error(`❌ Fehler beim Rendern der Filter-Bar für ${entityType}:`, error);
      
      // Fallback: Leere Filter-Bar
      if (mountNode) {
        mountNode.innerHTML = '<div class="filter-section"><p>Filter nicht verfügbar</p></div>';
      }
    }
  }

  /**
   * Filter aus FormData verarbeiten
   */
  async processFormData(entityType, formData) {
    // Lade entitäts-spezifische Logik falls verfügbar
    const logic = await this.loadEntityLogic(entityType);
    
    if (logic && logic.processFilters) {
      // Verwende entitäts-spezifische Verarbeitung
      const basicFilters = processFilterForm(formData);
      return logic.processFilters(basicFilters);
    } else {
      // Fallback zu Standard-Verarbeitung
      return processFilterForm(formData);
    }
  }

  /**
   * Filter validieren
   */
  async validateFilters(entityType, filters) {
    // Lade entitäts-spezifische Logik falls verfügbar
    const logic = await this.loadEntityLogic(entityType);
    
    if (logic && logic.validateFilters) {
      return logic.validateFilters(filters);
    }

    // Fallback: Keine Validierung
    return { isValid: true, errors: [] };
  }

  /**
   * Dynamische Filter-Daten für eine Entität abrufen
   */
  getDynamicFilterData(entityType) {
    return this.dynamicFilterData[entityType] || {};
  }

  /**
   * Filter-Presets für eine Entität abrufen
   */
  async getFilterPresets(entityType) {
    const config = await this.getConfig(entityType);
    return config.presets || [];
  }

  /**
   * Filter-Gruppen für eine Entität abrufen
   */
  async getFilterGroups(entityType) {
    const config = await this.getConfig(entityType);
    return config.groups || [];
  }

  /**
   * Supabase Query mit entitäts-spezifischen Filtern erstellen
   */
  async buildSupabaseQuery(entityType, baseQuery, filters) {
    const logic = await this.loadEntityLogic(entityType);
    
    if (logic && logic.buildSupabaseQuery) {
      return logic.buildSupabaseQuery(baseQuery, filters);
    }

    // Fallback: Basis-Query zurückgeben
    return baseQuery;
  }

  /**
   * Lokale Daten mit entitäts-spezifischen Filtern filtern
   */
  async filterLocalData(entityType, data, filters) {
    const logic = await this.loadEntityLogic(entityType);
    
    if (logic && logic.filterLocalData) {
      return logic.filterLocalData(data, filters);
    }

    // Fallback: Ungefilterte Daten zurückgeben
    return data;
  }

  /**
   * Hilfsfunktion: String kapitalisieren
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Debug-Information für eine Entität abrufen
   */
  async getDebugInfo(entityType) {
    const config = await this.getConfig(entityType);
    const logic = await this.loadEntityLogic(entityType);
    const dynamicData = this.getDynamicFilterData(entityType);
    const activeFilters = this.getFilters(entityType);

    return {
      entityType,
      hasConfig: !!config,
      hasLogic: !!logic,
      hasDynamicData: Object.keys(dynamicData).length > 0,
      activeFiltersCount: Object.keys(activeFilters).length,
      config,
      dynamicData,
      activeFilters
    };
  }
}

// Exportiere Instanz
export const modularFilterSystem = new ModularFilterSystem();
export default modularFilterSystem;