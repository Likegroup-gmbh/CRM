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
      
      // Unternehmen-Mitarbeiter mit Rollen
      if (relationTable === 'mitarbeiter_unternehmen') {
        entityField = 'unternehmen_id';
      } else if (relationTable === 'marke_mitarbeiter') {
        entityField = 'marke_id';
      } else if (field.name === 'mitarbeiter_ids' && relationTable === 'kampagne_mitarbeiter') {
        entityField = 'kampagne_id';
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
      } else if (field.name === 'art_der_kampagne' && field.relationTable === 'auftrag_kampagne_art') {
        entityField = 'auftrag_id';
      } else {
        entityField = `${field.name.replace('_ids', '_id')}`;
      }
      
      // Für mitarbeiter_unternehmen nur die Einträge mit der entsprechenden Rolle löschen
      if (relationTable === 'mitarbeiter_unternehmen' && field.roleValue) {
        const { error: deleteError } = await window.supabase
          .from(relationTable)
          .delete()
          .eq(entityField, entityId)
          .eq('role', field.roleValue);
        
        if (deleteError) {
          console.error(`❌ Fehler beim Löschen bestehender Verknüpfungen mit Rolle ${field.roleValue}:`, deleteError);
          throw deleteError;
        }
      } else {
        // Bestehende Verknüpfungen löschen (Supabase)
        const { error: deleteError } = await window.supabase
          .from(relationTable)
          .delete()
          .eq(entityField, entityId);
        
        if (deleteError) {
          console.error(`❌ Fehler beim Löschen bestehender Verknüpfungen:`, deleteError);
          throw deleteError;
        }
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
        } else if (relationTable === 'mitarbeiter_unternehmen') {
          foreignField = 'mitarbeiter_id';
        } else if (relationTable === 'marke_mitarbeiter') {
          foreignField = 'mitarbeiter_id';
        }

        // Insert-Daten erstellen, mit role wenn vorhanden
        const insertData = valuesToInsert.map(value => {
          const row = {
            [entityField]: entityId,
            [foreignField]: value
          };
          // Role hinzufügen für mitarbeiter_unternehmen
          if (relationTable === 'mitarbeiter_unternehmen' && field.roleValue) {
            row.role = field.roleValue;
          }
          return row;
        });

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
        
        // Spezialbehandlung: Bei auftrag_mitarbeiter auch mitarbeiter_unternehmen synchronisieren
        // Wenn ein Lead-Mitarbeiter einem Auftrag zugewiesen wird, soll das Unternehmen
        // des Auftrags automatisch dem Mitarbeiter zugeordnet werden
        if (relationTable === 'auftrag_mitarbeiter') {
          await this.syncMitarbeiterUnternehmen(entityId, valuesToInsert);
        }
      }
      
      console.log(`✅ Verknüpfungstabelle ${relationTable} aktualisiert für ${entityId}`);
    } catch (error) {
      console.error(`❌ Fehler beim Verarbeiten der Verknüpfungstabelle ${field.relationTable}:`, error);
    }
  }

  // Synchronisiert mitarbeiter_unternehmen wenn Lead-Mitarbeiter einem Auftrag zugewiesen werden
  async syncMitarbeiterUnternehmen(auftragId, mitarbeiterIds) {
    try {
      // Auftrag laden um unternehmen_id zu erhalten
      const { data: auftrag, error: auftragError } = await window.supabase
        .from('auftrag')
        .select('unternehmen_id')
        .eq('id', auftragId)
        .single();
      
      if (auftragError) {
        console.error('❌ Fehler beim Laden des Auftrags für Mitarbeiter-Sync:', auftragError);
        return;
      }
      
      if (!auftrag?.unternehmen_id) {
        console.log('ℹ️ Auftrag hat kein Unternehmen zugeordnet, überspringe Mitarbeiter-Sync');
        return;
      }
      
      // Für jeden Mitarbeiter die Unternehmen-Zuordnung erstellen (falls nicht vorhanden)
      for (const mitarbeiterId of mitarbeiterIds) {
        const { error: upsertError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .upsert({
            mitarbeiter_id: mitarbeiterId,
            unternehmen_id: auftrag.unternehmen_id
          }, { 
            onConflict: 'mitarbeiter_id,unternehmen_id',
            ignoreDuplicates: true 
          });
        
        if (upsertError && upsertError.code !== '23505') {
          // 23505 = unique violation (bereits vorhanden) - das ist OK
          console.error(`❌ Fehler beim Sync mitarbeiter_unternehmen für ${mitarbeiterId}:`, upsertError);
        }
      }
      
      console.log(`✅ Mitarbeiter-Unternehmen-Zuordnung synchronisiert für Auftrag ${auftragId}`);
    } catch (error) {
      console.error('❌ Fehler beim Synchronisieren von mitarbeiter_unternehmen:', error);
    }
  }

  // Konfiguration abrufen (wird von außen injiziert)
  getFormConfig(entity) {
    // Diese Methode wird von außen überschrieben
    return null;
  }
} 