// ImageUploadHelper.js
// Wiederverwendbare Bild-Upload-Logik für alle Entitäten (Logos, Profilbilder, etc.)

import { compressImage } from './ImageCompressor.js';

/**
 * Konfiguration für verschiedene Bildtypen
 */
const IMAGE_CONFIG = {
  logo: {
    bucket: 'logos',
    fieldName: 'logo_file',
    urlField: 'logo_url',
    pathField: 'logo_path',
    maxSize: 200 * 1024, // 200 KB
    fileName: 'logo'
  },
  profile: {
    bucket: 'ansprechpartner-images',
    fieldName: 'profile_image_file',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path',
    maxSize: 500 * 1024, // 500 KB
    fileName: 'profile'
  }
};

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageUploadHelper {
  /**
   * Generische Bild-Upload-Methode
   * @param {Object} options - Upload-Optionen
   * @param {string} options.entityType - Entitätstyp (z.B. 'ansprechpartner', 'unternehmen', 'marke')
   * @param {string} options.entityId - ID der Entität
   * @param {HTMLFormElement} options.form - Form-Element mit Uploader
   * @param {string} options.imageType - Bildtyp ('logo' oder 'profile')
   * @param {string} [options.bucket] - Optional: Custom Bucket-Name
   * @param {string} [options.fieldName] - Optional: Custom Uploader-Feldname
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  static async upload({ entityType, entityId, form, imageType, bucket, fieldName }) {
    const config = IMAGE_CONFIG[imageType];
    if (!config && !bucket) {
      return { success: false, error: `Unbekannter Bildtyp: ${imageType}` };
    }

    const finalBucket = bucket || config.bucket;
    const finalFieldName = fieldName || config.fieldName;
    const maxSize = config?.maxSize || 500 * 1024;
    const fileName = config?.fileName || 'image';
    const urlField = config?.urlField || 'image_url';
    const pathField = config?.pathField || 'image_path';

    try {
      const uploaderRoot = form.querySelector(`.uploader[data-name="${finalFieldName}"]`);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        // Kein Fehler, nur keine Datei zum Hochladen
        return { success: true, skipped: true };
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Bild-Upload übersprungen');
        return { success: false, error: 'Supabase nicht verfügbar' };
      }

      const files = uploaderRoot.__uploaderInstance.files;
      let file = files[0];

      // Validierung: Dateityp (vor Komprimierung)
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { 
          success: false, 
          error: 'Nur PNG, JPG und WebP Dateien sind erlaubt' 
        };
      }

      // WebP-Komprimierung
      try {
        const originalSize = file.size;
        file = await compressImage(file);
        console.log(`🖼️ Bild komprimiert: ${Math.round(originalSize / 1024)}KB → ${Math.round(file.size / 1024)}KB (WebP)`);
      } catch (compressError) {
        console.warn('⚠️ Komprimierung fehlgeschlagen, nutze Original:', compressError);
      }

      // Validierung: Dateigröße (nach Komprimierung)
      if (file.size > maxSize) {
        const maxSizeKB = Math.round(maxSize / 1024);
        return { 
          success: false, 
          error: `Datei zu groß (max. ${maxSizeKB} KB)` 
        };
      }

      const path = `${entityId}/${fileName}.webp`;

      // Alte Dateien löschen
      await this._deleteExistingFiles(finalBucket, entityId);

      // Upload zu Storage
      const { error: uploadError } = await window.supabase.storage
        .from(finalBucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp'
        });

      if (uploadError) {
        console.error(`❌ Upload-Fehler:`, uploadError);
        return { success: false, error: uploadError.message };
      }

      // Öffentliche URL erstellen
      const { data: publicUrlData } = window.supabase.storage
        .from(finalBucket)
        .getPublicUrl(path);

      const imageUrl = publicUrlData?.publicUrl || '';

      // URL in Datenbank speichern
      const updateData = {
        [urlField]: imageUrl,
        [pathField]: path
      };

      const { error: dbError } = await window.supabase
        .from(entityType)
        .update(updateData)
        .eq('id', entityId);

      if (dbError) {
        console.error(`❌ DB-Fehler:`, dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true, url: imageUrl };

    } catch (error) {
      console.error('❌ Fehler beim Bild-Upload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Löscht existierende Dateien im Ordner
   * @private
   */
  static async _deleteExistingFiles(bucket, entityId) {
    try {
      const { data: existingFiles } = await window.supabase.storage
        .from(bucket)
        .list(entityId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${entityId}/${f.name}`);
        await window.supabase.storage
          .from(bucket)
          .remove(filesToDelete);
      }
    } catch (error) {
      console.warn('⚠️ Fehler beim Löschen alter Dateien:', error);
    }
  }

  /**
   * Shortcut für Profilbild-Upload (Ansprechpartner)
   */
  static async uploadProfileImage(ansprechpartnerId, form) {
    const result = await this.upload({
      entityType: 'ansprechpartner',
      entityId: ansprechpartnerId,
      form,
      imageType: 'profile'
    });

    if (!result.success && !result.skipped) {
      alert(`⚠️ Profilbild konnte nicht hochgeladen werden: ${result.error}`);
    }

    return result;
  }

  /**
   * Shortcut für Logo-Upload (Unternehmen/Marken)
   */
  static async uploadLogo(entityType, entityId, form) {
    const result = await this.upload({
      entityType,
      entityId,
      form,
      imageType: 'logo'
    });

    if (!result.success && !result.skipped) {
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${result.error}`);
    }

    return result;
  }
}

export const imageUploadHelper = ImageUploadHelper;
