// ProfileImageService.js
// Profilbild-Upload (WebP-Komprimierung, Storage, benutzer.profile_image_url)

import { compressImage } from '../../core/ImageCompressor.js';

const BUCKET = 'profile-images';

export const PROFILE_IMAGE_MAX_INPUT_SIZE = 2 * 1024 * 1024; // 2 MB vor Komprimierung
export const PROFILE_IMAGE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/**
 * Grobe Validierung vor der Komprimierung.
 * @returns {string|null} Fehlermeldung oder null wenn gültig
 */
export function validateProfileImage(file) {
  if (file.size > PROFILE_IMAGE_MAX_INPUT_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return `Bild ist zu groß (max. 2 MB). Dein Bild: ${sizeMB} MB`;
  }
  if (!PROFILE_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return 'Nur PNG, JPG und WebP Dateien sind erlaubt';
  }
  return null;
}

async function compressOrKeep(file) {
  try {
    return await compressImage(file);
  } catch (compressError) {
    console.warn('⚠️ Komprimierung fehlgeschlagen, nutze Original:', compressError);
    return file;
  }
}

async function removeOldImages(authUserId) {
  try {
    const { data: existingFiles } = await window.supabase.storage.from(BUCKET).list(authUserId);
    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${authUserId}/${f.name}`);
      await window.supabase.storage.from(BUCKET).remove(filesToDelete);
    }
  } catch (error) {
    console.warn('⚠️ Fehler beim Löschen alter Bilder:', error);
  }
}

/**
 * Lädt das Profilbild hoch und aktualisiert detail.user sowie window.currentUser.
 */
export async function uploadProfileImage(detail, file) {
  if (!window.supabase) {
    throw new Error('Supabase nicht verfügbar');
  }

  // auth_user_id für Storage (Policies basieren auf auth.uid())
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) {
    throw new Error('Nicht eingeloggt');
  }
  const authUserId = user.id;

  const compressed = await compressOrKeep(file);
  const path = `${authUserId}/profile.webp`;

  await removeOldImages(authUserId);

  const { error: uploadError } = await window.supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/webp'
    });

  if (uploadError) {
    console.error('❌ Upload-Fehler:', uploadError);
    throw uploadError;
  }

  const { data: urlData } = window.supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: dbError } = await window.supabase
    .from('benutzer')
    .update({
      profile_image_url: publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', detail.userId);

  if (dbError) {
    console.error('❌ DB-Update-Fehler:', dbError);
    throw dbError;
  }

  detail.user.profile_image_url = publicUrl;
  if (window.currentUser && window.currentUser.id === detail.userId) {
    window.currentUser.profile_image_url = publicUrl;
  }
}
