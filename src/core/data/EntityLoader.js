import { EntityRegistry, EntityModules } from './entities/index.js';
import { getMockData, getMockFilterData } from './MockProvider.js';

export class EntityLoader {
  constructor({ filterApplier, relationManager }) {
    this.entities = EntityRegistry;
    this.filterApplier = filterApplier;
    this.relationManager = relationManager;
  }

  async _load(entityType, filters, pagination) {
    const isPaginated = pagination !== null;
    const context = isPaginated ? 'pagination' : 'list';

    const entityConfig = this.entities[entityType];
    if (!entityConfig) {
      throw new Error(`Unbekannte Entität: ${entityType}`);
    }

    const mod = EntityModules[entityType];

    // Query aufbauen
    const selectClause = mod?.buildSelectClause?.(context) || '*';
    let query = isPaginated
      ? window.supabase.from(entityConfig.table).select(selectClause, { count: 'exact' })
      : window.supabase.from(entityConfig.table).select(selectClause);

    // Sortierung (nur für loadEntities — Pagination sortiert nach Filter-Phase)
    if (!isPaginated) {
      if (mod?.customOrder) {
        query = mod.customOrder(query);
      } else {
        query = query.order('created_at', { ascending: false });
      }
    }

    // _allowedIds generisch behandeln
    if (filters._allowedIds && Array.isArray(filters._allowedIds)) {
      query = query.in('id', filters._allowedIds);
      delete filters._allowedIds;
    }

    // Junction-Filter aus Entity-Modul
    if (mod?.applyJunctionFilters) {
      const result = await mod.applyJunctionFilters(query, filters, window.supabase, context);
      query = result.query;
      filters = result.filters;
      if (result.shortCircuit) {
        return isPaginated ? { data: [], total: 0, page: pagination.page, limit: pagination.limit } : [];
      }
    }

    // Generische Filter anwenden
    let filtersToApply = filters;
    if (isPaginated) {
      filtersToApply = {...filters};
      delete filtersToApply.branche_id;
      delete filtersToApply.branche;
      delete filtersToApply.sprache_id;
      delete filtersToApply.creator_type_id;
      delete filtersToApply._sortBy;
      delete filtersToApply._sortOrder;
      delete filtersToApply._allowedIds;
    }

    if (window.filterSystem) {
      const logic = await window.filterSystem.loadEntityLogic(entityType);
      if (logic?.buildSupabaseQuery) {
        const suffix = isPaginated ? ' (Pagination)' : '';
        console.log(`🔧 Nutze spezifische FilterLogic für ${entityType}${suffix}`);
        query = logic.buildSupabaseQuery(query, filtersToApply);
      } else {
        query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
      }
    } else {
      query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
    }

    // Pagination: Sortierung + Range
    if (isPaginated) {
      const sortBy = filters._sortBy || entityConfig.sortBy;
      const sortOrder = filters._sortOrder !== undefined ? filters._sortOrder : entityConfig.sortOrder;
      if (sortBy) {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }
      query = query.range(pagination.from, pagination.to);
    }

    // Query ausführen
    const { data, error, count } = await query;

    if (error) {
      console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
      if (isPaginated) throw error;
      return [];
    }

    if (isPaginated) {
      console.log(`✅ ${entityType} geladen:`, {
        items: data?.length || 0,
        total: count,
        page: pagination.page,
        limit: pagination.limit,
        from: pagination.from,
        to: pagination.to
      });
    } else {
      console.log(`✅ ${entityType} aus Supabase geladen:`, data?.length || 0);
    }

    // Vor-M:N-Transformation (nur loadEntities)
    if (!isPaginated && data && mod?.transformResult) {
      mod.transformResult(data);
    }

    // M:N-Beziehungen laden
    const shouldLoadM2M = isPaginated
      ? (data && data.length > 0 && entityConfig.manyToMany)
      : (data && entityConfig.manyToMany);

    if (shouldLoadM2M) {
      const prefix = isPaginated ? 'DATASERVICE PAGINATION' : 'DATASERVICE';
      console.log(`🔗 ${prefix}: Lade Many-to-Many für ${entityType}, Config:`, Object.keys(entityConfig.manyToMany));
      await this.relationManager.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
    }

    // Nach-M:N-Transformation
    if (!isPaginated && data && mod?.finalizeResult) {
      mod.finalizeResult(data);
    }
    if (isPaginated && data && mod?.transformPaginationResult) {
      mod.transformPaginationResult(data);
    }

    return isPaginated
      ? { data: data || [], total: count || 0, page: pagination.page, limit: pagination.limit }
      : (data || []);
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

      return await this._load(entityType, filters, null);
      
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

      const mod = EntityModules[entityType];

      // Wenn das Modul eine eigene loadFilterData hat, diese nutzen (RPC-basiert)
      if (mod?.loadFilterDataOverride) {
        const filterOptions = await mod.loadFilterDataOverride(window.supabase);
        if (mod?.loadExtraFilterData) {
          await mod.loadExtraFilterData(filterOptions, window.supabase);
        }
        console.log(`✅ Filter-Daten für ${entityType} geladen (optimiert):`, filterOptions);
        return filterOptions;
      }

      let query = window.supabase.from(entityConfig.table).select('*');
      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden der Filter-Daten für ${entityType}:`, error);
        return getMockFilterData(entityType);
      }

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

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      return await this._load(entityType, filters, { page, limit, from, to });

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
