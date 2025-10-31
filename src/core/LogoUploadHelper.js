// LogoUploadHelper.js
// Wiederverwendbare Logo-Upload-Logik für Unternehmen und Marken

export class LogoUploadHelper {
  /**
   * Lädt ein Logo hoch und speichert die URL in der Datenbank
   * @param {string} entityType - 'unternehmen' oder 'marke'
   * @param {string} entityId - ID der Entität
   * @param {HTMLFormElement} form - Form-Element mit Uploader
   * @returns {Promise<void>}
   */
  static async uploadLogo(entityType, entityId, form) {
    try {
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Logo erlaubt
      const bucket = 'logos';
      
      // Security: Max 200 KB
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Logo zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Logo ist zu groß (max. 200 KB)`);
        return;
      }

      // Content-Type prüfen
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.name} (${file.type})`);
        alert(`Nur PNG und JPG Dateien sind erlaubt`);
        return;
      }

      // Dateiendung extrahieren
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${entityType}/${entityId}/logo.${ext}`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(`${entityType}/${entityId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`${entityType}/${entityId}/${existingFile.name}`]);
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
      
      // Signierte URL erstellen (7 Tage gültig)
      const { data: signed, error: signErr } = await window.supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 Tage
      
      if (signErr) {
        console.error(`❌ Fehler beim Erstellen der signierten URL:`, signErr);
        throw signErr;
      }
      
      const logo_url = signed?.signedUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from(entityType)
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', entityId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      throw error; // Re-throw für Caller
    }
  }
  
  /**
   * Rendert HTML für Logo-Anzeige in Detailansicht
   * @param {Object} entity - Entität mit logo_url und name
   * @param {string} entityName - Name-Feld (z.B. 'firmenname' oder 'markenname')
   * @returns {string} HTML-String
   */
  static renderLogoDisplay(entity, entityName) {
    if (!entity?.logo_url) return '';
    
    const name = entity[entityName] || 'Logo';
    return `
      <div class="detail-logo">
        <img src="${entity.logo_url}" alt="${name} Logo" class="logo-image" />
      </div>
    `;
  }
}

export const logoUploadHelper = LogoUploadHelper;

