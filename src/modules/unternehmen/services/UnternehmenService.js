// UnternehmenService.js
// Gemeinsame Business-Logic für Unternehmen-Module
// Vermeidet Code-Duplizierung zwischen UnternehmenDetail, UnternehmenList und UnternehmenCreate

export class UnternehmenService {
  
  /**
   * Einheitliches Error-Handling für Unternehmen-Module
   * @param {Error} error - Der aufgetretene Fehler
   * @param {string} context - Kontext-String für Logging (z.B. 'UnternehmenDetail.init')
   * @param {Object} options - { showAlert: false, showToast: true, rethrow: false }
   */
  static handleError(error, context, options = {}) {
    const { showAlert = false, showToast = true, rethrow = false } = options;
    
    // Einheitliches Logging-Format
    console.error(`❌ [${context}]`, error);
    
    // User-Feedback
    const message = error?.message || 'Ein unbekannter Fehler ist aufgetreten';
    
    if (showToast && window.toast?.error) {
      window.toast.error(message);
    } else if (showAlert) {
      alert(message);
    }
    
    // Global Error Handler (falls vorhanden)
    if (window.ErrorHandler?.handle) {
      window.ErrorHandler.handle(error, context);
    }
    
    // Optional: Fehler weiterwerfen
    if (rethrow) {
      throw error;
    }
  }

  /**
   * Speichert Mitarbeiter-Zuordnungen mit Rollen für ein Unternehmen
   * @param {string} unternehmenId - UUID des Unternehmens
   * @param {Object} data - Formulardaten mit management_ids, lead_mitarbeiter_ids, mitarbeiter_ids
   * @param {Object} options - Optional: { deleteExisting: true }
   */
  static async saveMitarbeiterRoles(unternehmenId, data, options = { deleteExisting: true }) {
    try {
      if (!unternehmenId || !window.supabase) return;
      
      console.log('🔄 UnternehmenService: Speichere Mitarbeiter-Rollen für Unternehmen:', unternehmenId);
      
      // Rollen-Mapping
      const roleFields = {
        'management_ids': 'management',
        'lead_mitarbeiter_ids': 'lead_mitarbeiter',
        'mitarbeiter_ids': 'mitarbeiter'
      };
      
      // Alle INSERT-Daten sammeln
      const allInsertData = [];
      
      for (const [fieldName, roleValue] of Object.entries(roleFields)) {
        // Prüfe ob das Feld in den Daten vorhanden ist
        const fieldData = data[fieldName] || data[`${fieldName}[]`];
        
        // Extrahiere IDs als Array und entferne Duplikate
        let mitarbeiterIds = [];
        if (Array.isArray(fieldData)) {
          mitarbeiterIds = [...new Set(fieldData.filter(Boolean))];
        } else if (typeof fieldData === 'string' && fieldData) {
          mitarbeiterIds = [fieldData];
        }
        
        console.log(`📋 ${fieldName} (${roleValue}): ${mitarbeiterIds.length} Mitarbeiter`, mitarbeiterIds);
        
        // Sammle INSERT-Daten
        for (const mitarbeiterId of mitarbeiterIds) {
          allInsertData.push({
            unternehmen_id: unternehmenId,
            mitarbeiter_id: mitarbeiterId,
            role: roleValue
          });
        }
      }
      
      // Bestehende Einträge löschen (wenn gewünscht)
      if (options.deleteExisting) {
        console.log('🗑️ Lösche alle bestehenden Mitarbeiter-Zuordnungen für Unternehmen:', unternehmenId);
        const { error: deleteError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .delete()
          .eq('unternehmen_id', unternehmenId);
        
        if (deleteError) {
          console.error('❌ Fehler beim Löschen:', deleteError);
        }
      }
      
      // Neue Einträge in einem Batch einfügen
      if (allInsertData.length > 0) {
        console.log(`📤 Füge ${allInsertData.length} Mitarbeiter-Zuordnungen ein:`, allInsertData);
        
        const { error: insertError } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .insert(allInsertData);
        
        if (insertError) {
          console.error('❌ Fehler beim Batch-Insert:', insertError);
          
          // Fallback: Einzeln einfügen mit upsert
          console.log('🔄 Versuche Einzelinserts mit upsert...');
          for (const row of allInsertData) {
            const { error: upsertError } = await window.supabase
              .from('mitarbeiter_unternehmen')
              .upsert(row, { onConflict: 'mitarbeiter_id,unternehmen_id,role' });
            
            if (upsertError) {
              console.error(`❌ Upsert-Fehler für ${row.mitarbeiter_id}/${row.role}:`, upsertError);
            }
          }
        } else {
          console.log(`✅ ${allInsertData.length} Mitarbeiter-Zuordnungen gespeichert`);
        }
      } else {
        console.log('ℹ️ Keine Mitarbeiter zum Speichern');
      }
      
      console.log('✅ UnternehmenService: Mitarbeiter-Rollen gespeichert');
    } catch (error) {
      console.error('❌ UnternehmenService: Fehler beim Speichern der Mitarbeiter-Rollen:', error);
      // Nicht werfen - Unternehmen wurde bereits erstellt/aktualisiert
    }
  }

  /**
   * Lädt Logo hoch und speichert URL in der Datenbank
   * @param {string} unternehmenId - UUID des Unternehmens
   * @param {HTMLFormElement} form - Formular mit Uploader-Element
   * @param {Object} options - Optional: { throwOnError: false }
   */
  static async uploadLogo(unternehmenId, form, options = { throwOnError: false }) {
    try {
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen');
        return null;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return null;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0];
      const bucket = 'logos';
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Validierung
      if (file.size > MAX_FILE_SIZE) {
        const error = new Error(`Logo ist zu groß (max. 200 KB)`);
        alert(error.message);
        if (options.throwOnError) throw error;
        return null;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        const error = new Error(`Nur PNG und JPG Dateien sind erlaubt`);
        alert(error.message);
        if (options.throwOnError) throw error;
        return null;
      }

      const ext = file.name.split('.').pop().toLowerCase();
      const path = `unternehmen/${unternehmenId}/logo.${ext}`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(`unternehmen/${unternehmenId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`unternehmen/${unternehmenId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
      }
      
      // Upload zu Storage
      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (upErr) {
        console.error(`❌ Logo-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Public URL erstellen (Bucket ist public)
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const logo_url = publicUrlData?.publicUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('unternehmen')
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', unternehmenId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen: ${logo_url}`);
      return logo_url;
      
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      if (options.throwOnError) throw error;
      return null;
    }
  }

  /**
   * Lädt Branchen-Namen für gegebene IDs
   * @param {string[]} branchenIds - Array von Branchen-UUIDs
   * @returns {Promise<string[]>} - Array von Branchen-Namen
   */
  static async getBranchenNamen(branchenIds) {
    try {
      if (!branchenIds || branchenIds.length === 0) return [];
      
      const { data: branchen, error } = await window.supabase
        .from('branchen')
        .select('id, name')
        .in('id', branchenIds);
      
      if (error) {
        console.error('❌ Fehler beim Laden der Branche-Namen:', error);
        return branchenIds; // Fallback: verwende IDs als Namen
      }
      
      // Namen in der gleichen Reihenfolge wie die IDs zurückgeben
      return branchenIds.map(id => {
        const branche = branchen.find(b => b.id === id);
        return branche ? branche.name : id;
      });
    } catch (error) {
      console.error('❌ Fehler beim Laden der Branche-Namen:', error);
      return branchenIds;
    }
  }

  /**
   * Speichert Branchen-Verknüpfungen für ein Unternehmen
   * HINWEIS: Diese Funktion sollte NICHT manuell aufgerufen werden, wenn DataService verwendet wird!
   * DataService.handleManyToManyRelations() verwaltet Branchen automatisch.
   * @param {string} unternehmenId - UUID des Unternehmens
   * @param {string[]|string|null} brancheIds - Branchen-IDs oder null
   * @param {HTMLElement|null} form - Optional: Formular-Context für Fallback-Selektion
   */
  static async saveUnternehmenBranchen(unternehmenId, brancheIds = null, form = null) {
    try {
      if (!unternehmenId) return;

      let ids = [];

      if (Array.isArray(brancheIds)) {
        ids = brancheIds.filter(Boolean);
      } else if (typeof brancheIds === 'string' && brancheIds) {
        ids = [brancheIds];
      }

      // Fallback: Hidden Select (FormSystem Tag-basiert)
      if (ids.length === 0 && form) {
        const hiddenSelect = form.querySelector('select[name="branche_id[]"]');
        if (hiddenSelect) {
          ids = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(Boolean);
        }
      }

      // Duplikate entfernen
      ids = [...new Set(ids)];
      
      console.log(`🔄 Speichere Branchen für Unternehmen ${unternehmenId}:`, ids);

      // Bestehende Zuordnungen löschen
      const { error: deleteError } = await window.supabase
        .from('unternehmen_branchen')
        .delete()
        .eq('unternehmen_id', unternehmenId);

      if (deleteError) {
        console.error('❌ Fehler beim Löschen bestehender Branchen-Zuordnungen:', deleteError);
        throw deleteError;
      }

      if (ids.length === 0) {
        // Primäre Branche auf null setzen
        await window.supabase
          .from('unternehmen')
          .update({ branche_id: null, branche: null })
          .eq('id', unternehmenId);
        console.log('ℹ️ Keine Branchen ausgewählt – Primärbranche zurückgesetzt');
        return;
      }

      const insertData = ids.map(id => ({
        unternehmen_id: unternehmenId,
        branche_id: id
      }));

      const { error: insertError } = await window.supabase
        .from('unternehmen_branchen')
        .insert(insertData);

      if (insertError) {
        console.error('❌ Fehler beim Speichern der Branchen-Zuordnungen:', insertError);
        throw insertError;
      }

      // Primäre Branche + Legacy-String aktualisieren
      const branchNames = await UnternehmenService.getBranchenNamen(ids);
      const brancheNameString = branchNames.filter(Boolean).join(', ') || null;

      const { error: updateError } = await window.supabase
        .from('unternehmen')
        .update({
          branche_id: ids[0] || null,
          branche: brancheNameString
        })
        .eq('id', unternehmenId);

      if (updateError) {
        console.error('❌ Fehler beim Aktualisieren der Primärbranche:', updateError);
      } else {
        console.log(`✅ Primärbranche aktualisiert (${ids[0]}) und Legacy-String gesetzt: ${brancheNameString}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Speichern der Unternehmen-Branchen:', error);
      throw error;
    }
  }

  /**
   * Sanitized eine URL für sichere Verwendung in href-Attributen
   * Verhindert javascript: und andere gefährliche Protokolle
   * @param {string} url - Die zu prüfende URL
   * @returns {string} - Sichere URL oder '#' bei ungültiger URL
   */
  static sanitizeUrl(url) {
    if (!url) return '#';
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn('⚠️ Unsichere URL blockiert:', url);
        return '#';
      }
      return url;
    } catch {
      // Keine gültige URL
      return '#';
    }
  }
}

export default UnternehmenService;
