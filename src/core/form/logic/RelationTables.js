export class RelationTables {
  // Verknüpfungstabellen verarbeiten
  async handleRelationTables(entity, entityId, submitData, form) {
    try {
      const config = this.getFormConfig(entity);
      if (!config) return;

      // Alle Felder durchgehen
      let allFields = [];
      if (config.sections) {
        config.sections.forEach(section => {
          allFields = allFields.concat(section.fields);
        });
      } else {
        allFields = config.fields;
      }

      for (const field of allFields) {
        if (field.relationTable && field.relationField) {
          const fieldValue = submitData[field.name];
          if (fieldValue) {
            await this.handleRelationTable(entityId, field, fieldValue);
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Verarbeiten der Verknüpfungstabellen:', error);
    }
  }

  // Einzelne Verknüpfungstabelle verarbeiten
  async handleRelationTable(entityId, field, fieldValue) {
    try {
      const relationTable = field.relationTable;
      const relationField = field.relationField;
      
      // Korrekte Entity-Feld-Namen für verschiedene Verknüpfungstabellen
      let entityField;
      if (field.name === 'mitarbeiter_ids') {
        entityField = relationTable === 'auftrag_mitarbeiter' ? 'auftrag_id' : 'kampagne_id';
      } else if (field.name === 'cutter_ids' && relationTable === 'auftrag_cutter') {
        entityField = 'auftrag_id';
      } else if (field.name === 'copywriter_ids' && relationTable === 'auftrag_copywriter') {
        entityField = 'auftrag_id';
      } else if (field.name === 'mitarbeiter_ids' && relationTable === 'auftrag_mitarbeiter') {
        entityField = 'auftrag_id';
      } else if (field.name === 'plattform_ids') {
        entityField = 'kampagne_id';
      } else if (field.name === 'format_ids') {
        entityField = 'kampagne_id';
      } else if (field.name === 'branche_id' && field.relationTable === 'unternehmen_branchen') {
        entityField = 'unternehmen_id';
      } else if (field.name === 'marke_ids') {
        entityField = 'ansprechpartner_id';
      } else if (field.name === 'sprachen_ids') {
        entityField = 'ansprechpartner_id';
      } else {
        entityField = `${field.name.replace('_ids', '_id')}`;
      }
      
      // Bestehende Verknüpfungen löschen (Supabase)
      const { error: deleteError } = await window.supabase
        .from(relationTable)
        .delete()
        .eq(entityField, entityId);
      
      if (deleteError) {
        console.error(`❌ Fehler beim Löschen bestehender Verknüpfungen:`, deleteError);
        throw deleteError;
      }
      
      // Neue Verknüpfungen hinzufügen
      let valuesToInsert = [];
      
      if (Array.isArray(fieldValue)) {
        valuesToInsert = fieldValue;
      } else if (typeof fieldValue === 'string' && fieldValue.includes(',')) {
        // Komma-getrennte Werte
        valuesToInsert = fieldValue.split(',').map(v => v.trim()).filter(Boolean);
      } else if (fieldValue) {
        valuesToInsert = [fieldValue];
      }
      
      // Batch-Insert für bessere Performance
      if (valuesToInsert.length > 0) {
        let foreignField = relationField;
        if (field.name === 'sprachen_ids') {
          foreignField = 'sprache_id';
        } else if (field.name === 'marke_ids') {
          foreignField = 'marke_id';
        } else if (field.name === 'mitarbeiter_ids' && relationTable === 'auftrag_mitarbeiter') {
          foreignField = 'mitarbeiter_id';
        } else if (field.name === 'cutter_ids' && relationTable === 'auftrag_cutter') {
          foreignField = 'mitarbeiter_id';
        } else if (field.name === 'copywriter_ids' && relationTable === 'auftrag_copywriter') {
          foreignField = 'mitarbeiter_id';
        }

        const insertData = valuesToInsert.map(value => ({
          [entityField]: entityId,
          [foreignField]: value
        }));

        try {
          const { error: insertError } = await window.supabase
            .from(relationTable)
            .insert(insertData);

          if (insertError) {
            if (String(insertError.code) === '42P01') {
              console.warn(`⚠️ Relationstabelle ${relationTable} existiert nicht. Überspringe Inserts.`);
              return;
            }
            console.error(`❌ Fehler beim Einfügen neuer Verknüpfungen:`, insertError);
            throw insertError;
          }
        } catch (insertEx) {
          if (String(insertEx.code) === '42P01') {
            console.warn(`⚠️ Relationstabelle ${relationTable} existiert nicht. Überspringe Inserts.`);
            return;
          }
          throw insertEx;
        }

        console.log(`✅ ${valuesToInsert.length} Verknüpfungen in ${relationTable} erstellt`);
      }
      
      console.log(`✅ Verknüpfungstabelle ${relationTable} aktualisiert für ${entityId}`);
    } catch (error) {
      console.error(`❌ Fehler beim Verarbeiten der Verknüpfungstabelle ${field.relationTable}:`, error);
    }
  }

  // Konfiguration abrufen (wird von außen injiziert)
  getFormConfig(entity) {
    // Diese Methode wird von außen überschrieben
    return null;
  }
} 