import { EntityRegistry } from './entities/index.js';

export class RelationManager {
  constructor() {
    this.entities = EntityRegistry;
  }

  // Verarbeite Many-to-Many Beziehungen beim Erstellen/Aktualisieren
  async handleManyToManyRelations(entityType, entityId, data) {
    try {
      const entityConfig = this.entities[entityType];
      if (!entityConfig || !entityConfig.manyToMany) return;

      for (const [relationName, config] of Object.entries(entityConfig.manyToMany)) {
        // Prüfe ob entsprechende _ids Daten vorhanden sind
        let fieldName;
        if (relationName === 'sprachen') {
          fieldName = 'sprachen_ids';
        } else if (relationName === 'branchen') {
          // Für Unternehmen und Marke: branche_id, für Creator: branche_ids
          fieldName = (entityType === 'unternehmen' || entityType === 'marke') ? 'branche_id' : 'branche_ids';
        } else if (relationName === 'creator_types') {
          fieldName = 'creator_type_ids';
        } else if (relationName === 'marken') {
          fieldName = 'marke_ids';
        } else if (relationName === 'unternehmen') {
          // Für Ansprechpartner ist unternehmen eine 1:1 Beziehung, nicht Many-to-Many
          if (entityType === 'ansprechpartner') {
            fieldName = 'unternehmen_id';
          } else {
            fieldName = 'unternehmen_ids';
          }
        } else if (relationName === 'mitarbeiter') {
          fieldName = 'mitarbeiter_ids';
        } else if (relationName === 'cutter') {
          fieldName = 'cutter_ids';
        } else if (relationName === 'copywriter') {
          fieldName = 'copywriter_ids';
        } else if (relationName === 'kampagne_arten') {
          fieldName = 'art_der_kampagne';
        } else {
          fieldName = `${relationName.slice(0, -1)}_ids`;
        }
        // Eingabewerte für M:N robust ermitteln und zu Array normalisieren
        // Bevorzuge explizite Array-Varianten, ansonsten Strings aufsplitten/JSON-parsen
        const bracketValue = data[`${fieldName}[]`];
        const plainValue = data[fieldName];
        
        const parseToArray = (val) => {
          if (val == null) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            const trimmed = val.trim();
            // JSON-Array-String
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
              } catch (err) { /* JSON-Parse fehlgeschlagen, versuche nächstes Format */ }
            }
            // Komma-separierte Liste
            if (trimmed.includes(',')) {
              return trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
            // Einzelner Wert
            return trimmed ? [trimmed] : [];
          }
          // Fallback: einzelner Wert
          return [val];
        };
        
        // Bevorzugung: Arrays gehen vor Strings; plainValue hat Vorrang, wenn es ein Array ist
        let fieldData = null;
        if (Array.isArray(plainValue)) fieldData = plainValue;
        else if (Array.isArray(bracketValue)) fieldData = bracketValue;
        else if (plainValue != null) fieldData = plainValue;
        else fieldData = bracketValue;
        
        // Debug: Zeige verfügbare Daten für dieses Feld
        console.log(`🔍 DATASERVICE: Prüfe ${fieldName} für ${entityType}.${relationName}:`, {
          fieldData,
          'data[fieldName]': data[fieldName],
          'data[fieldName + []]': data[`${fieldName}[]`],
          allDataKeys: Object.keys(data)
        });
        
        // Für Ansprechpartner: Unternehmen braucht spezielle Behandlung
        // - Legacy: unternehmen_id in Haupttabelle (bereits gesetzt)
        // - Modern: Junction Table ansprechpartner_unternehmen
        if (entityType === 'ansprechpartner' && relationName === 'unternehmen') {
          console.log(`🔗 Spezielle Behandlung für ${entityType}.${relationName} (Legacy + Junction Table)`);
          
          // Prüfe ob unternehmen_id gesetzt ist (wird als unternehmen_id übergeben, nicht unternehmen_ids)
          // Kann als Array oder String kommen - normalisiere zu String
          let unternehmenId = data.unternehmen_id;
          if (Array.isArray(unternehmenId)) {
            unternehmenId = unternehmenId[0]; // Nimm erstes Element aus Array
            console.log(`📦 unternehmen_id war Array, extrahiere erstes Element: ${unternehmenId}`);
          }
          
          if (unternehmenId) {
            console.log(`📝 Erstelle Junction Table Eintrag für Unternehmen ${unternehmenId}`);
            
            // Lösche ggf. bestehende Verknüpfungen (bei Update)
            const { error: deleteError } = await window.supabase
              .from('ansprechpartner_unternehmen')
              .delete()
              .eq('ansprechpartner_id', entityId);
            
            if (deleteError) {
              console.error(`❌ Fehler beim Löschen bestehender Unternehmen-Verknüpfungen:`, deleteError);
            }
            
            // Erstelle Junction Table Eintrag
            const { error: insertError } = await window.supabase
              .from('ansprechpartner_unternehmen')
              .insert([{
                ansprechpartner_id: entityId,
                unternehmen_id: unternehmenId
              }]);
            
            if (insertError) {
              console.error(`❌ Fehler beim Erstellen der Unternehmen-Verknüpfung:`, insertError);
            } else {
              console.log(`✅ Unternehmen-Verknüpfung erstellt für Ansprechpartner ${entityId} mit Unternehmen ${unternehmenId}`);
            }
          }
          continue; // Überspringe normale Many-to-Many Logik
        }

        if (!fieldData) continue;

        console.log(`🔗 Verarbeite Many-to-Many Beziehung: ${entityType}.${relationName} für ${fieldName}:`, fieldData);
        
        // Sicherstellen, dass fieldData ein Array ist und Duplikate/Leereinträge entfernen
        const relatedIds = Array.from(new Set(parseToArray(fieldData).filter(Boolean)));
        
        // Bestehende Beziehungen löschen
        const { error: deleteError } = await window.supabase
          .from(config.junctionTable)
          .delete()
          .eq(config.localKey, entityId);
          
        if (deleteError) {
          console.error(`❌ Fehler beim Löschen bestehender ${relationName} Beziehungen:`, deleteError);
          continue;
        }
        
        // Neue Beziehungen erstellen
        if (relatedIds.length > 0 && relatedIds[0]) {
          const insertData = relatedIds
            .filter(id => id) // Leere IDs herausfiltern
            .map(relatedId => ({
              [config.localKey]: entityId,
              [config.foreignKey]: relatedId
            }));
          
          if (insertData.length > 0) {
            const { error: insertError } = await window.supabase
              .from(config.junctionTable)
              .insert(insertData);
              
            if (insertError) {
              console.error(`❌ Fehler beim Erstellen neuer ${relationName} Beziehungen:`, insertError);
            } else {
              console.log(`✅ ${relationName} Beziehungen erstellt: ${insertData.length} Einträge`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Fehler beim Verarbeiten der Many-to-Many Beziehungen:`, error);
    }
  }

  // Lade Many-to-Many Beziehungen für Entitäten (optimiert: parallel)
  async loadManyToManyRelations(entities, entityType, manyToManyConfig) {
    try {
      // Sammle alle Entity-IDs einmal
      const entityIds = entities.map(entity => entity.id).filter(id => id);
      if (entityIds.length === 0) return;
      
      // Bereite alle M:N-Requests vor und führe sie parallel aus
      const relationEntries = Object.entries(manyToManyConfig);
      const promises = relationEntries.map(async ([relationName, config]) => {
        try {
          // Lade Junction-Daten mit JOIN zur Ziel-Tabelle
          const { data: junctionData, error } = await window.supabase
            .from(config.junctionTable)
            .select(`
              ${config.localKey},
              ${config.table}!${config.foreignKey} (
                id,
                ${config.displayField}
              )
            `)
            .in(config.localKey, entityIds);
          
          if (error) {
            console.error(`❌ M:N ${relationName}:`, error.message);
            return { relationName, groupedData: {} };
          }
          
          // Gruppiere Daten nach Entity-ID
          const groupedData = {};
          junctionData?.forEach(item => {
            const entityId = item[config.localKey];
            if (!groupedData[entityId]) {
              groupedData[entityId] = [];
            }
            if (item[config.table]) {
              groupedData[entityId].push(item[config.table]);
            }
          });
          
          return { relationName, groupedData };
        } catch (err) {
          console.error(`❌ M:N ${relationName} Exception:`, err);
          return { relationName, groupedData: {} };
        }
      });
      
      // Warte auf alle parallelen Requests
      const results = await Promise.all(promises);
      
      // Füge Beziehungsdaten zu Entitäten hinzu
      results.forEach(({ relationName, groupedData }) => {
        entities.forEach(entity => {
          entity[relationName] = groupedData[entity.id] || [];
        });
      });
      
      console.log(`✅ M:N für ${entityType}: ${relationEntries.length} Beziehungen parallel geladen`);
    } catch (error) {
      console.error(`❌ Fehler beim Laden der Many-to-Many Beziehungen:`, error);
    }
  }
}
