// MarkeService.js
// Gemeinsame Business-Logic für Marke-Module
// Vermeidet Code-Duplizierung zwischen MarkeDetail, MarkeList und MarkeCreate

import { compressImage } from '../../../core/ImageCompressor.js';

/**
 * Logo-Konfiguration
 */
export const LOGO_CONFIG = {
  MAX_SIZE_KB: 200,
  MAX_SIZE_BYTES: 200 * 1024,
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/webp'],
  ALLOWED_EXTENSIONS: ['png', 'jpg', 'jpeg', 'webp'],
  BUCKET: 'logos'
};

export class MarkeService {
  
  /**
   * Einheitliches Error-Handling für Marke-Module
   * @param {Error} error - Der aufgetretene Fehler
   * @param {string} context - Kontext-String für Logging (z.B. 'MarkeDetail.init')
   * @param {Object} options - { showToast: true, rethrow: false }
   */
  static handleError(error, context, options = {}) {
    const { showToast = true, rethrow = false } = options;
    
    // Einheitliches Logging-Format
    console.error(`❌ [${context}]`, error);
    
    // User-Feedback über Toast-System
    const message = error?.message || 'Ein unbekannter Fehler ist aufgetreten';
    
    if (showToast && window.toastSystem) {
      window.toastSystem.show(message, 'error');
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
   * Speichert Mitarbeiter-Zuordnungen mit Rollen für eine Marke.
   * Deduplizierung auf (marke_id, mitarbeiter_id, role). Bei Fehlern wird geworfen.
   * @param {string} markeId - UUID der Marke
   * @param {Object} data - Formulardaten mit management_ids, lead_mitarbeiter_ids, mitarbeiter_ids
   * @param {string|null} unternehmenId - Optional: Unternehmen-ID für Auto-Sync
   * @param {Object} options - Optional: { deleteExisting: true }
   * @throws {Error} bei Lösch- oder Insert-Fehlern (nach Fallback)
   */
  static async saveMitarbeiterToMarke(markeId, data, unternehmenId = null, options = { deleteExisting: true }) {
    if (!markeId || !window.supabase) return;
    
    const roleFields = {
      'management_ids': 'management',
      'lead_mitarbeiter_ids': 'lead_mitarbeiter',
      'mitarbeiter_ids': 'mitarbeiter'
    };
    
    const rawInsertData = [];
    for (const [fieldName, roleValue] of Object.entries(roleFields)) {
      const fieldData = data[fieldName] || data[`${fieldName}[]`];
      let mitarbeiterIds = [];
      if (Array.isArray(fieldData)) {
        mitarbeiterIds = [...new Set(fieldData.filter(Boolean))];
      } else if (typeof fieldData === 'string' && fieldData) {
        mitarbeiterIds = [fieldData];
      }
      for (const mitarbeiterId of mitarbeiterIds) {
        rawInsertData.push({ marke_id: markeId, mitarbeiter_id: mitarbeiterId, role: roleValue });
      }
    }
    
    // Globale Deduplizierung nach (marke_id, mitarbeiter_id, role)
    const seen = new Set();
    const allInsertData = rawInsertData.filter(row => {
      const key = `${row.marke_id}|${row.mitarbeiter_id}|${row.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`🔄 MarkeService: Speichere ${allInsertData.length} Mitarbeiter-Zuordnungen für Marke:`, markeId);
    
    if (options.deleteExisting) {
      const { error: deleteError } = await window.supabase
        .from('marke_mitarbeiter')
        .delete()
        .eq('marke_id', markeId);
      if (deleteError) {
        console.error('❌ Fehler beim Löschen marke_mitarbeiter:', deleteError);
        throw new Error(`Mitarbeiter-Zuordnungen konnten nicht zurückgesetzt werden: ${deleteError.message}`);
      }
    }
    
    if (allInsertData.length > 0) {
      const { error: insertError } = await window.supabase
        .from('marke_mitarbeiter')
        .insert(allInsertData);
      
      if (insertError) {
        console.warn('⚠️ Batch-Insert fehlgeschlagen, Fallback Einzel-Insert:', insertError);
        const failed = [];
        for (const row of allInsertData) {
          const { error: singleError } = await window.supabase
            .from('marke_mitarbeiter')
            .insert(row);
          if (singleError) {
            const isDuplicate = singleError.code === '23505' || singleError.status === 409 ||
              (singleError.message && (String(singleError.message).includes('duplicate') || String(singleError.message).includes('unique') || String(singleError.message).includes('conflict')));
            if (isDuplicate) {
              console.log('ℹ️ Zeile bereits vorhanden, überspringe:', row.mitarbeiter_id, row.role);
            } else {
              failed.push({ row, error: singleError });
            }
          }
        }
        if (failed.length > 0) {
          console.error('❌ Einzel-Insert-Fehler:', failed);
          throw new Error(`Mitarbeiter-Zuordnungen teilweise fehlgeschlagen: ${failed.length} Fehler`);
        }
      }
      
      // Auto-Sync: Nur Existenz in mitarbeiter_unternehmen sicherstellen, ohne bestehende Rollen zu überschreiben
      if (unternehmenId) {
        const uniqueMitarbeiterIds = [...new Set(allInsertData.map(r => r.mitarbeiter_id))];
        const { data: existing } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('mitarbeiter_id')
          .eq('unternehmen_id', unternehmenId)
          .in('mitarbeiter_id', uniqueMitarbeiterIds);
        const existingIds = new Set((existing || []).map(r => r.mitarbeiter_id));
        const toSync = uniqueMitarbeiterIds.filter(id => !existingIds.has(id));
        for (const mitarbeiterId of toSync) {
          const { error: syncError } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .insert({
              mitarbeiter_id: mitarbeiterId,
              unternehmen_id: unternehmenId,
              role: 'mitarbeiter'
            });
          if (syncError && syncError.code !== '23505') {
            console.warn(`⚠️ Sync mitarbeiter_unternehmen für ${mitarbeiterId}:`, syncError);
          }
        }
        if (toSync.length > 0) {
          console.log(`✅ mitarbeiter_unternehmen: ${toSync.length} neue Zuordnung(en), bestehende unverändert`);
        }
      }
    }
  }

  /**
   * Lädt Logo hoch und speichert URL in der Datenbank
   * @param {string} markeId - UUID der Marke
   * @param {HTMLFormElement} form - Formular mit Uploader-Element
   * @returns {Promise<string|null>} - Logo-URL oder null
   */
  static async uploadLogo(markeId, form) {
    try {
      console.log('📋 MarkeService.uploadLogo() aufgerufen für Marke:', markeId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen (kein Uploader/keine Files)');
        return null;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return null;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      let file = files[0];
      
      // Validierung: Content-Type (vor Komprimierung)
      if (!LOGO_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
        const message = 'Nur PNG, JPG und WebP Dateien sind erlaubt';
        console.warn(`⚠️ ${message}: ${file.name} (${file.type})`);
        if (window.toastSystem) {
          window.toastSystem.show(message, 'error');
        }
        return null;
      }

      // WebP-Komprimierung
      try {
        const originalSize = file.size;
        file = await compressImage(file);
        console.log(`🖼️ Logo komprimiert: ${Math.round(originalSize / 1024)}KB → ${Math.round(file.size / 1024)}KB (WebP)`);
      } catch (compressError) {
        console.warn('⚠️ Komprimierung fehlgeschlagen, nutze Original:', compressError);
      }

      // Validierung: Dateigröße (nach Komprimierung)
      if (file.size > LOGO_CONFIG.MAX_SIZE_BYTES) {
        const message = `Logo ist zu groß (max. ${LOGO_CONFIG.MAX_SIZE_KB} KB)`;
        console.warn(`⚠️ ${message}: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        if (window.toastSystem) {
          window.toastSystem.show(message, 'error');
        }
        return null;
      }

      const path = `marke/${markeId}/logo.webp`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(LOGO_CONFIG.BUCKET)
          .list(`marke/${markeId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(LOGO_CONFIG.BUCKET)
              .remove([`marke/${markeId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
      }
      
      // Upload zu Storage
      const { error: upErr } = await window.supabase.storage
        .from(LOGO_CONFIG.BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp'
        });
      
      if (upErr) {
        console.error(`❌ Logo-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL erstellen (permanent verfügbar)
      const { data: publicUrlData } = window.supabase.storage
        .from(LOGO_CONFIG.BUCKET)
        .getPublicUrl(path);
      
      const logo_url = publicUrlData?.publicUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('marke')
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', markeId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen: ${logo_url}`);
      return logo_url;
      
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      if (window.toastSystem) {
        window.toastSystem.show(`Logo konnte nicht hochgeladen werden: ${error.message}`, 'error');
      }
      // Nicht werfen - Marke wurde bereits erstellt
      return null;
    }
  }

  /**
   * Ermittelt die erlaubten Marken-IDs für einen Nicht-Admin-Benutzer
   * Logik:
   * - Direkt zugeordnete Marken (marke_mitarbeiter) werden immer erlaubt
   * - Für zugeordnete Unternehmen ohne explizite Marken-Zuordnung: ALLE Marken des Unternehmens
   * - Für zugeordnete Unternehmen MIT expliziter Marken-Zuordnung: NUR diese Marken
   * 
   * @param {string} userId - UUID des Benutzers
   * @returns {Promise<string[]>} - Array von erlaubten Marken-IDs
   */
  static async getAllowedMarkeIdsForUser(userId) {
    if (!userId || !window.supabase) {
      console.warn('⚠️ MarkeService.getAllowedMarkeIdsForUser: userId oder supabase fehlt');
      return [];
    }
    
    console.log('🔍 MarkeService: Ermittle erlaubte Marken für User:', userId);
    
    let allowedMarkeIds = [];
    
    try {
      // 1. Direkt zugeordnete Marken laden
      const directAssignments = await this._getDirectMarkeAssignments(userId);
      console.log('📋 Direkte Marken-Zuordnungen:', directAssignments.length);
      
      // 2. Marken-Details laden (für Unternehmen-Mapping)
      let markenMitUnternehmen = [];
      if (directAssignments.length > 0) {
        const { data: markenData } = await window.supabase
          .from('marke')
          .select('id, unternehmen_id')
          .in('id', directAssignments);
        
        markenMitUnternehmen = (markenData || []).map(m => ({
          marke_id: m.id,
          unternehmen_id: m.unternehmen_id
        }));
      }
      
      // 3. Zugeordnete Unternehmen laden
      const companyAssignments = await this._getCompanyAssignments(userId);
      console.log('🏢 Unternehmen-Zuordnungen:', companyAssignments.length);
      
      // 4. Map erstellen: Unternehmen-ID → zugeordnete Marken-IDs
      const unternehmenMarkenMap = new Map();
      markenMitUnternehmen.forEach(r => {
        if (r.unternehmen_id) {
          if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
            unternehmenMarkenMap.set(r.unternehmen_id, []);
          }
          unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
        }
      });
      
      // 5. Für jedes Unternehmen erlaubte Marken ermitteln
      for (const unternehmenId of companyAssignments) {
        const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
        
        if (explicitMarkenIds && explicitMarkenIds.length > 0) {
          // Explizite Marken-Zuordnung → Nur diese Marken
          allowedMarkeIds.push(...explicitMarkenIds);
        } else {
          // Keine explizite Zuordnung → ALLE Marken des Unternehmens
          const companyMarken = await this._getMarkenForCompany(unternehmenId);
          allowedMarkeIds.push(...companyMarken);
        }
      }
      
      // 6. Direkt zugeordnete Marken hinzufügen (auch ohne Unternehmen-Zuordnung)
      allowedMarkeIds.push(...directAssignments);
      
      // 7. Duplikate entfernen
      allowedMarkeIds = [...new Set(allowedMarkeIds)];
      
      console.log('✅ MarkeService: Erlaubte Marken ermittelt:', allowedMarkeIds.length);
      
      return allowedMarkeIds;
      
    } catch (error) {
      console.error('❌ MarkeService.getAllowedMarkeIdsForUser: Fehler:', error);
      return [];
    }
  }
  
  /**
   * Lädt direkt zugeordnete Marken-IDs für einen Benutzer
   * @private
   */
  static async _getDirectMarkeAssignments(userId) {
    const { data, error } = await window.supabase
      .from('marke_mitarbeiter')
      .select('marke_id')
      .eq('mitarbeiter_id', userId);
    
    if (error) {
      console.error('❌ Fehler beim Laden der marke_mitarbeiter:', error);
      return [];
    }
    
    return (data || []).map(r => r.marke_id).filter(Boolean);
  }
  
  /**
   * Lädt zugeordnete Unternehmen-IDs für einen Benutzer
   * @private
   */
  static async _getCompanyAssignments(userId) {
    const { data, error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('unternehmen_id')
      .eq('mitarbeiter_id', userId);
    
    if (error) {
      console.error('❌ Fehler beim Laden der mitarbeiter_unternehmen:', error);
      return [];
    }
    
    return (data || []).map(r => r.unternehmen_id).filter(Boolean);
  }
  
  /**
   * Lädt alle Marken-IDs für ein Unternehmen
   * @private
   */
  static async _getMarkenForCompany(unternehmenId) {
    const { data, error } = await window.supabase
      .from('marke')
      .select('id')
      .eq('unternehmen_id', unternehmenId);
    
    if (error) {
      console.error('❌ Fehler beim Laden der Marken für Unternehmen:', error);
      return [];
    }
    
    return (data || []).map(m => m.id);
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
        console.error('❌ Fehler beim Laden der Branchen-Namen:', error);
        return branchenIds; // Fallback: verwende IDs als Namen
      }
      
      // Namen in der gleichen Reihenfolge wie die IDs zurückgeben
      return branchenIds.map(id => {
        const branche = branchen.find(b => b.id === id);
        return branche ? branche.name : id;
      });
    } catch (error) {
      console.error('❌ Fehler beim Laden der Branchen-Namen:', error);
      return branchenIds;
    }
  }
}

export default MarkeService;
