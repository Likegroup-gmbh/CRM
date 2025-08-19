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
        entityField = 'kampagne_id';
      } else if (field.name === 'plattform_ids') {
        entityField = 'kampagne_id';
      } else if (field.name === 'format_ids') {
        entityField = 'kampagne_id';
      } else {
        entityField = `${field.name.replace('_ids', '_id')}`;
      }
      
      // Bestehende Verknüpfungen löschen
      const deleteQuery = `DELETE FROM ${relationTable} WHERE ${entityField} = $1`;
      await window.dataService.executeQuery(deleteQuery, [entityId]);
      
      // Neue Verknüpfungen hinzufügen
      if (Array.isArray(fieldValue)) {
        for (const value of fieldValue) {
          const insertQuery = `INSERT INTO ${relationTable} (${entityField}, ${relationField}) VALUES ($1, $2)`;
          await window.dataService.executeQuery(insertQuery, [entityId, value]);
        }
      } else if (typeof fieldValue === 'string' && fieldValue.includes(',')) {
        // Komma-getrennte Werte
        const values = fieldValue.split(',').map(v => v.trim());
        for (const value of values) {
          const insertQuery = `INSERT INTO ${relationTable} (${entityField}, ${relationField}) VALUES ($1, $2)`;
          await window.dataService.executeQuery(insertQuery, [entityId, value]);
        }
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