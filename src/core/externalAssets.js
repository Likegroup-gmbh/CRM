// externalAssets.js
// Dateitypen und Größenlimits für Uploads, externe Links (OneDrive, Drive, SharePoint …)
// und wie ein Asset angezeigt bzw. als Vorschau geladen werden kann.

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif|avif|ico)$/i;
export const IMAGE_MIME_PREFIX = 'image/';
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

export const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm)$/i;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
// Dropbox Upload-Sessions können bis 350 GB; 1 GB ist ein praktikabler Browser-Client-Cap.
export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
export const MAX_STORY_SIZE = 1024 * 1024 * 1024;

// ─── External Link Helpers ───────────────────────────────────

export function normalizeExternalUrl(input) {
  if (!input) return '';
  let url = input.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

export function isValidExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeOpaqueShareToken(value) {
  if (!value) return false;
  if (IMAGE_EXTENSIONS.test(value) || VIDEO_EXTENSIONS.test(value)) return false;
  return value.length > 24 && !/\s/.test(value);
}

export function getAssetDisplayLabel(asset) {
  if (!asset) return '?';
  if (asset.variant_name) return asset.variant_name;
  if (asset.file_name && !looksLikeOpaqueShareToken(asset.file_name)) return asset.file_name;
  if (asset.file_path) {
    const last = asset.file_path.split('/').pop();
    if (last && !looksLikeOpaqueShareToken(last)) return last;
  }
  if (asset.file_url) {
    try {
      const parsed = new URL(asset.file_url);
      if (/sharepoint\.com/i.test(parsed.hostname)) return 'Externer Link';
      const segment = parsed.pathname.split('/').filter(Boolean).pop();
      if (segment && !looksLikeOpaqueShareToken(segment)) return segment;
      return parsed.hostname;
    } catch {
      return 'Externer Link';
    }
  }
  return '?';
}

export function isExternalAsset(asset) {
  return !!(asset?.file_url && !asset?.file_path);
}

export function isDirectImageUrl(url) {
  if (!url) return false;
  try {
    return IMAGE_EXTENSIONS.test(new URL(url).pathname);
  } catch {
    return IMAGE_EXTENSIONS.test(url);
  }
}

/**
 * true, wenn sich das Bild-Asset im Browser anzeigen laesst: Dropbox-Assets
 * ueber den Temp-Link zum Pfad, externe Links nur als direkte Bild-URL.
 * Sharing-Links (z. B. SharePoint /:i:/) liefern ohne Sitzung im Tenant eine
 * HTML-Seite bzw. 403 und lassen sich deshalb nicht einbetten.
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @returns {boolean}
 */
export function canPreviewImageAsset(asset) {
  if (!asset) return false;
  if (asset.file_path) return true;
  return isDirectImageUrl(asset.file_url);
}
