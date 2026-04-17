// DataService.js (ES6-Modul)
// Zentrale Datenverwaltung für alle Entitäten — Facade

import { EntityRegistry } from './data/entities/index.js';
import { getMockData, getMockFilterData } from './data/MockProvider.js';
import { EntityMutator } from './data/EntityMutator.js';
import { RelationManager } from './data/RelationManager.js';
import { DataPreparer } from './data/DataPreparer.js';
import { FilterApplier } from './data/FilterApplier.js';
import { EntityLoader } from './data/EntityLoader.js';

export class DataService {
  constructor() {
    this.entities = EntityRegistry;

    // Horizontale Module instanziieren
    this._relationManager = new RelationManager();
    this._dataPreparer = new DataPreparer();
    this._filterApplier = new FilterApplier();
    this._mutator = new EntityMutator({
      dataPreparer: this._dataPreparer,
      relationManager: this._relationManager,
    });
    this._loader = new EntityLoader({
      filterApplier: this._filterApplier,
      relationManager: this._relationManager,
    });
  }

  // --- CRUD (delegiert an EntityMutator) ---
  async createEntity(entityType, data) {
    return this._mutator.createEntity(entityType, data);
  }

  async updateEntity(entityType, id, data) {
    return this._mutator.updateEntity(entityType, id, data);
  }

  async deleteEntity(entityType, id) {
    return this._mutator.deleteEntity(entityType, id);
  }

  async deleteEntities(entityType, ids) {
    return this._mutator.deleteEntities(entityType, ids);
  }

  // --- Laden (delegiert an EntityLoader) ---
  async loadEntities(entityType, filters = {}) {
    return this._loader.loadEntities(entityType, filters);
  }

  async loadFilterData(entityType) {
    return this._loader.loadFilterData(entityType);
  }

  async loadEntitiesWithPagination(entityType, filters = {}, page = 1, limit = 25) {
    return this._loader.loadEntitiesWithPagination(entityType, filters, page, limit);
  }

  async executeQuery(query, params = []) {
    return this._loader.executeQuery(query, params);
  }

  // --- Relationen (delegiert an RelationManager) ---
  async handleManyToManyRelations(entityType, entityId, data) {
    return this._relationManager.handleManyToManyRelations(entityType, entityId, data);
  }

  async handleCreatorAgentur(creatorId, data) {
    return this._relationManager.handleCreatorAgentur(creatorId, data);
  }

  async loadManyToManyRelations(entities, entityType, manyToManyConfig) {
    return this._relationManager.loadManyToManyRelations(entities, entityType, manyToManyConfig);
  }

  // --- Datenaufbereitung (delegiert an DataPreparer) ---
  async prepareDataForSupabase(data, fieldConfig, entityType) {
    return this._dataPreparer.prepareDataForSupabase(data, fieldConfig, entityType);
  }

  // --- Filter (delegiert an FilterApplier) ---
  applyFilters(query, filters, fieldConfig, entityType) {
    return this._filterApplier.applyFilters(query, filters, fieldConfig, entityType);
  }

  async extractFilterOptions(data, entityType) {
    return this._filterApplier.extractFilterOptions(data, entityType);
  }

  // --- Mock-Delegates (Backward-Kompatibilität) ---
  getMockData(entityType) {
    return getMockData(entityType);
  }

  getMockFilterData(entityType) {
    return getMockFilterData(entityType);
  }
}

// Exportiere Instanz
export const dataService = new DataService();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.DataService = dataService;
  
  // Alte Service-Namen für Kompatibilität
  window.CreatorService = {
    loadFilterData: () => dataService.loadFilterData('creator'),
    loadCreators: (filters) => dataService.loadEntities('creator', filters),
    createEntity: (data) => dataService.createEntity('creator', data),
    updateEntity: (id, data) => dataService.updateEntity('creator', id, data),
    deleteEntity: (id) => dataService.deleteEntity('creator', id)
  };
}
