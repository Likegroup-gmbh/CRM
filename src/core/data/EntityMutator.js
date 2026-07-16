import { EntityRegistry } from './entities/index.js';

export class EntityMutator {
  constructor({ dataPreparer, relationManager }) {
    this.entities = EntityRegistry;
    this.dataPreparer = dataPreparer;
    this.relationManager = relationManager;
  }

  async createEntity(entityType, data) {
    try {
      console.log(`✅ ${entityType} erstellt:`, data);
      
      if (!window.supabase || !window.supabase.auth) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const newEntity = {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString()
        };
        
        const mockData = JSON.parse(localStorage.getItem('mock_data') || '{}');
        if (!mockData[entityType]) {
          mockData[entityType] = [];
        }
        mockData[entityType].push(newEntity);
        localStorage.setItem('mock_data', JSON.stringify(mockData));
        
        console.log(`✅ ${entityType} Mock-Daten gespeichert:`, newEntity);
        return { success: true, id: newEntity.id, data: newEntity };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const supabaseData = await this.dataPreparer.prepareDataForSupabase(data, entityConfig.fields, entityType);

      const { data: result, error } = await window.supabase
        .from(entityConfig.table)
        .insert([supabaseData])
        .select()
        .single();

      if (error) {
        console.error(`❌ Supabase Fehler beim Erstellen von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich in Supabase erstellt:`, result);
      
      await this.relationManager.handleManyToManyRelations(entityType, result.id, data);
      
      if (entityType === 'creator' && (data.management_ids !== undefined || data.management_id !== undefined)) {
        await this._syncCreatorManagements(result.id, this._normalizeManagementIds(data));
      }
      
      if (entityType === 'creator' && data.firma_ids !== undefined) {
        await this._syncCreatorFirmen(result.id, this._normalizeIdList(data.firma_ids));
      }
      
      return { success: true, id: result.id, data: result };
      
    } catch (error) {
      console.error(`❌ Fehler beim Erstellen von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  async updateEntity(entityType, id, data) {
    try {
      console.log(`✅ ${entityType} aktualisiert:`, id, data);
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, id: id, data: data };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const supabaseData = await this.dataPreparer.prepareDataForSupabase(data, entityConfig.fields, entityType);

      const { data: result, error } = await window.supabase
        .from(entityConfig.table)
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`❌ Supabase Fehler beim Aktualisieren von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich in Supabase aktualisiert:`, result);
      
      await this.relationManager.handleManyToManyRelations(entityType, id, data);
      
      if (entityType === 'creator' && (data.management_ids !== undefined || data.management_id !== undefined)) {
        await this._syncCreatorManagements(id, this._normalizeManagementIds(data));
      }
      
      if (entityType === 'creator' && data.firma_ids !== undefined) {
        await this._syncCreatorFirmen(id, this._normalizeIdList(data.firma_ids));
      }
      
      return { success: true, id: id, data: result };
      
    } catch (error) {
      console.error(`❌ Fehler beim Aktualisieren von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteEntity(entityType, id) {
    try {
      console.log(`🗑️ Lösche ${entityType}:`, id);
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, id: id };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const { error } = await window.supabase
        .from(entityConfig.table)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`❌ Supabase Fehler beim Löschen von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich gelöscht:`, id);
      return { success: true, id: id };
      
    } catch (error) {
      console.error(`❌ Fehler beim Löschen von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteEntities(entityType, ids) {
    try {
      if (!ids || ids.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      console.log(`🗑️ Batch-Lösche ${ids.length} ${entityType}...`);

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, deletedCount: ids.length };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      const { error, count } = await window.supabase
        .from(entityConfig.table)
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) {
        console.error(`❌ Batch-Delete Fehler für ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${count || ids.length} ${entityType} erfolgreich gelöscht`);
      return { success: true, deletedCount: count || ids.length };
      
    } catch (error) {
      console.error(`❌ Fehler beim Batch-Delete von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  _normalizeManagementIds(data) {
    const raw = data.management_ids !== undefined ? data.management_ids : data.management_id;
    return this._normalizeIdList(raw);
  }

  _normalizeIdList(raw) {
    const arr = Array.isArray(raw) ? raw : (raw === null || raw === undefined ? [] : [raw]);
    const cleaned = arr
      .map(id => (typeof id === 'string' ? id.trim() : id))
      .filter(id => id !== '' && id !== null && id !== undefined);
    return [...new Set(cleaned)];
  }

  // n:m Diff-Sync: aktiviert gewünschte Zuordnungen, deaktiviert entfernte.
  async _syncCreatorManagements(creatorId, managementIds) {
    try {
      if (!window.supabase) return;

      const desired = new Set(managementIds);

      const { data: existingRows } = await window.supabase
        .from('creator_management')
        .select('id, management_id, ist_aktiv')
        .eq('creator_id', creatorId);

      const existing = existingRows || [];
      const now = new Date().toISOString();

      for (const row of existing) {
        if (desired.has(row.management_id)) {
          desired.delete(row.management_id);
          if (!row.ist_aktiv) {
            await window.supabase
              .from('creator_management')
              .update({ ist_aktiv: true, updated_at: now })
              .eq('id', row.id);
          }
        } else if (row.ist_aktiv) {
          await window.supabase
            .from('creator_management')
            .update({ ist_aktiv: false, updated_at: now })
            .eq('id', row.id);
        }
      }

      const toInsert = [...desired].map(management_id => ({
        creator_id: creatorId,
        management_id,
        ist_aktiv: true
      }));

      if (toInsert.length > 0) {
        await window.supabase
          .from('creator_management')
          .insert(toInsert);
      }

      console.log(`✅ Creator-Management Zuordnungen synchronisiert: ${creatorId} → [${managementIds.join(', ')}]`);
    } catch (err) {
      console.error('❌ Fehler bei _syncCreatorManagements:', err);
    }
  }

  // n:m Diff-Sync analog zu _syncCreatorManagements, für creator_firma.
  async _syncCreatorFirmen(creatorId, firmaIds) {
    try {
      if (!window.supabase) return;

      const desired = new Set(firmaIds);

      const { data: existingRows } = await window.supabase
        .from('creator_firma')
        .select('id, firma_id, ist_aktiv')
        .eq('creator_id', creatorId);

      const existing = existingRows || [];
      const now = new Date().toISOString();

      for (const row of existing) {
        if (desired.has(row.firma_id)) {
          desired.delete(row.firma_id);
          if (!row.ist_aktiv) {
            await window.supabase
              .from('creator_firma')
              .update({ ist_aktiv: true, updated_at: now })
              .eq('id', row.id);
          }
        } else if (row.ist_aktiv) {
          await window.supabase
            .from('creator_firma')
            .update({ ist_aktiv: false, updated_at: now })
            .eq('id', row.id);
        }
      }

      const toInsert = [...desired].map(firma_id => ({
        creator_id: creatorId,
        firma_id,
        ist_aktiv: true
      }));

      if (toInsert.length > 0) {
        await window.supabase
          .from('creator_firma')
          .insert(toInsert);
      }

      console.log(`✅ Creator-Firma Zuordnungen synchronisiert: ${creatorId} → [${firmaIds.join(', ')}]`);
    } catch (err) {
      console.error('❌ Fehler bei _syncCreatorFirmen:', err);
    }
  }
}
