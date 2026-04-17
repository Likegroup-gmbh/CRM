import { EntityRegistry, EntityModules } from './entities/index.js';
import { getMockData, getMockFilterData } from './MockProvider.js';

export class EntityLoader {
  constructor({ filterApplier, relationManager }) {
    this.entities = EntityRegistry;
    this.filterApplier = filterApplier;
    this.relationManager = relationManager;
  }

  async loadEntities(entityType, filters = {}) {
    try {
      if (!window.supabase || !window.supabase.auth) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        
        const mockData = JSON.parse(localStorage.getItem('mock_data') || '{}');
        if (mockData[entityType] && mockData[entityType].length > 0) {
          console.log(`✅ Mock-Daten für ${entityType} geladen:`, mockData[entityType]);
          return mockData[entityType];
        }
        
        return getMockData(entityType);
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const mod = EntityModules[entityType];

      const selectClause = mod?.buildSelectClause?.('list') || '*';
      let query = window.supabase.from(entityConfig.table).select(selectClause);

      if (mod?.customOrder) {
        query = mod.customOrder(query);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (mod?.applyJunctionFilters) {
        const result = await mod.applyJunctionFilters(query, filters, window.supabase, 'list');
        query = result.query;
        filters = result.filters;
        if (result.shortCircuit) return [];
      }

      // Filter anwenden (priorisiere FilterLogic wenn vorhanden)
      if (window.filterSystem) {
        const logic = await window.filterSystem.loadEntityLogic(entityType);
        if (logic && logic.buildSupabaseQuery) {
          console.log(`🔧 Nutze spezifische FilterLogic für ${entityType}`);
          query = logic.buildSupabaseQuery(query, filters);
        } else {
          query = this.filterApplier.applyFilters(query, filters, entityConfig.fields, entityType);
        }
      } else {
        query = this.filterApplier.applyFilters(query, filters, entityConfig.fields, entityType);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
        return [];
      }

      console.log(`✅ ${entityType} aus Supabase geladen:`, data?.length || 0);

      if (data && mod?.transformResult) {
        mod.transformResult(data);
      }

      if (data && entityConfig.manyToMany) {
        console.log(`🔗 DATASERVICE: Lade Many-to-Many für ${entityType}, Config:`, Object.keys(entityConfig.manyToMany));
        await this.relationManager.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
      }

      if (data && mod?.finalizeResult) {
        mod.finalizeResult(data);
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Fehler beim Laden von ${entityType}:`, error);
      return [];
    }
  }

  async loadFilterData(entityType) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return getMockFilterData(entityType);
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      let query = window.supabase.from(entityConfig.table).select('*');
      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden der Filter-Daten für ${entityType}:`, error);
        return getMockFilterData(entityType);
      }

      const mod = EntityModules[entityType];

      let filterOptions;
      if (mod?.extractFilterOptions) {
        filterOptions = await mod.extractFilterOptions(data, window.supabase);
      } else {
        filterOptions = await this.filterApplier.extractFilterOptions(data, entityType);
      }

      if (mod?.loadExtraFilterData) {
        await mod.loadExtraFilterData(filterOptions, window.supabase);
      }
      
      console.log(`✅ Filter-Daten für ${entityType} geladen:`, filterOptions);
      return filterOptions;

    } catch (error) {
      console.error(`❌ Fehler beim Laden der Filter-Daten für ${entityType}:`, error);
      return getMockFilterData(entityType);
    }
  }

  async loadEntitiesWithPagination(entityType, filters = {}, page = 1, limit = 25) {
    try {
      console.log(`📄 Lade ${entityType} mit Pagination:`, { filters, page, limit });
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const mockData = getMockData(entityType);
        const start = (page - 1) * limit;
        const end = start + limit;
        return {
          data: mockData.slice(start, end),
          total: mockData.length,
          page,
          limit
        };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const mod = EntityModules[entityType];

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const selectClause = mod?.buildSelectClause?.('pagination') || '*';
      let query = window.supabase.from(entityConfig.table).select(selectClause, { count: 'exact' });

      if (filters._allowedIds && Array.isArray(filters._allowedIds)) {
        query = query.in('id', filters._allowedIds);
        delete filters._allowedIds;
      }

      if (mod?.applyJunctionFilters) {
        const result = await mod.applyJunctionFilters(query, filters, window.supabase, 'pagination');
        query = result.query;
        filters = result.filters;
        if (result.shortCircuit) return { data: [], total: 0, page, limit };
      }

      const filtersToApply = {...filters};
      delete filtersToApply.branche_id;
      delete filtersToApply.branche;
      delete filtersToApply.sprache_id;
      delete filtersToApply.creator_type_id;
      delete filtersToApply._sortBy;
      delete filtersToApply._sortOrder;
      delete filtersToApply._allowedIds;
      
      if (window.filterSystem) {
        const logic = await window.filterSystem.loadEntityLogic(entityType);
        if (logic && logic.buildSupabaseQuery) {
          console.log(`🔧 Nutze spezifische FilterLogic für ${entityType} (Pagination)`);
          query = logic.buildSupabaseQuery(query, filtersToApply);
        } else {
          query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
        }
      } else {
        query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
      }

      const sortBy = filters._sortBy || entityConfig.sortBy;
      const sortOrder = filters._sortOrder !== undefined ? filters._sortOrder : entityConfig.sortOrder;
      if (sortBy) {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
        throw error;
      }

      console.log(`✅ ${entityType} geladen:`, {
        items: data?.length || 0,
        total: count,
        page,
        limit,
        from,
        to
      });

      if (data && data.length > 0 && entityConfig.manyToMany) {
        console.log(`🔗 DATASERVICE PAGINATION: Lade Many-to-Many für ${entityType}, Config:`, Object.keys(entityConfig.manyToMany));
        await this.relationManager.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
      }

      if (data && mod?.transformPaginationResult) {
        mod.transformPaginationResult(data);
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        limit
      };

    } catch (error) {
      console.error(`❌ Fehler beim Laden von ${entityType} mit Pagination:`, error);
      throw error;
    }
  }

  async executeQuery(query, params = []) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - kann SQL-Abfrage nicht ausführen');
        return [];
      }

      const { data: result, error } = await window.supabase
        .rpc('execute_sql', { 
          sql_query: query, 
          sql_params: params 
        });

      if (error) {
        console.error('❌ Fehler bei der SQL-Abfrage:', error);
        return [];
      }

      return result || [];
    } catch (error) {
      console.error('❌ Fehler beim Ausführen der SQL-Abfrage:', error);
      return [];
    }
  }

  async extractFilterOptions(data, entityType) {
    return this.filterApplier.extractFilterOptions(data, entityType);
  }
}
