/**
 * Extrahiert den Storage-Pfad aus einer Screenshot-URL
 */
export function extractStoragePath(url) {
  if (!url) return null;
  // URL-Format: https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/filename.jpg
  const match = url.match(/strategie-screenshots\/(.+)$/);
  const path = match ? match[1] : null;
  console.log('📸 Screenshot-URL:', url);
  console.log('📸 Extrahierter Pfad:', path);
  return path;
}

/**
 * Screenshot aus dem Bucket entfernen. Storage-Fehler blockieren den Caller nicht.
 */
export async function deleteScreenshot(screenshotUrl) {
  if (!screenshotUrl) return;

  const storagePath = extractStoragePath(screenshotUrl);
  if (!storagePath) return;

  console.log('🗑️ Lösche Screenshot aus Bucket:', storagePath);
  const { error: storageError, data: storageData } = await window.supabase.storage
    .from('strategie-screenshots')
    .remove([storagePath]);

  if (storageError) {
    console.warn('❌ Fehler beim Löschen des Screenshots:', storageError);
  } else {
    console.log('✅ Screenshot gelöscht:', storageData);
  }
}
