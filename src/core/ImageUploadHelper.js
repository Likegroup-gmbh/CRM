// ImageUploadHelper.js
// Wiederverwendbare Bild-Upload-Logik für alle Entitäten (Logos, Profilbilder, etc.)

import { compressImage, createThumbnail } from './ImageCompressor.js';

/**
 * Konfiguration für verschiedene Bildtypen
 */
const IMAGE_CONFIG = {
  logo: {
    bucket: 'logos',
    fieldName: 'logo_file',
    urlField: 'logo_url',
    pathField: 'logo_path',
    thumbUrlField: 'logo_thumb_url',
    thumbPathField: 'logo_thumb_path',
    maxSize: 200 * 1024, // 200 KB
    fileName: 'logo'
  },
  profile: {
    bucket: 'ansprechpartner-images',
    fieldName: 'profile_image_file',
    urlField: 'profile_image_url',
    pathField: 'profile_image_path',
    thumbUrlField: 'profile_image_thumb_url',
    thumbPathField: 'profile_image_thumb_path',
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
    const thumbUrlField = config?.thumbUrlField || null;
    const thumbPathField = config?.thumbPathField || null;

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
      const originalUpload = files[0];

      // Validierung: Dateityp (vor Komprimierung)
      if (!ALLOWED_TYPES.includes(originalUpload.type)) {
        return {
          success: false,
          error: 'Nur PNG, JPG und WebP Dateien sind erlaubt'
        };
      }

      // WebP-Komprimierung des Originals
      let file = originalUpload;
      try {
        const originalSize = file.size;
        file = await compressImage(originalUpload);
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
      const thumbPath = `${entityId}/${fileName}_thumb.webp`;

      // Alte Dateien löschen (Original + Thumb)
      await this._deleteExistingFiles(finalBucket, entityId);

      // 1. Upload Original
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

      // 2. Thumb generieren und hochladen (parallel zum DB-Update optimiert)
      let thumbUrl = null;
      if (thumbUrlField && thumbPathField) {
        try {
          const thumbFile = await createThumbnail(originalUpload, { size: 128 });
          const { error: thumbError } = await window.supabase.storage
            .from(finalBucket)
            .upload(thumbPath, thumbFile, {
              cacheControl: '31536000', // 1 Jahr - Thumbs ändern sich nicht
              upsert: true,
              contentType: 'image/webp'
            });

          if (thumbError) {
            console.warn('⚠️ Thumb-Upload fehlgeschlagen:', thumbError);
          } else {
            const { data: thumbUrlData } = window.supabase.storage
              .from(finalBucket)
              .getPublicUrl(thumbPath);
            thumbUrl = thumbUrlData?.publicUrl || null;
            console.log(`🖼️ Thumb erzeugt: ${Math.round(thumbFile.size / 1024)}KB`);
          }
        } catch (thumbErr) {
          console.warn('⚠️ Thumb-Generierung fehlgeschlagen:', thumbErr);
        }
      }

      // Öffentliche URL für Original
      const { data: publicUrlData } = window.supabase.storage
        .from(finalBucket)
        .getPublicUrl(path);

      const imageUrl = publicUrlData?.publicUrl || '';

      // URL in Datenbank speichern (inkl. Thumb falls vorhanden)
      const updateData = {
        [urlField]: imageUrl,
        [pathField]: path
      };
      if (thumbUrlField && thumbPathField && thumbUrl) {
        updateData[thumbUrlField] = thumbUrl;
        updateData[thumbPathField] = thumbPath;
      }

      const { error: dbError } = await window.supabase
        .from(entityType)
        .update(updateData)
        .eq('id', entityId);

      if (dbError) {
        console.error(`❌ DB-Fehler:`, dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true, url: imageUrl, thumbUrl };

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
