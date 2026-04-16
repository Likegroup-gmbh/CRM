export const MAX_VERSIONS = 3;

function sanitizeForFilename(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildVersionedFileName(creator, unternehmen, kampagne, version, ext) {
  const parts = [creator, unternehmen, kampagne]
    .map(sanitizeForFilename)
    .filter(Boolean);

  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

export function getAvailableVersions(existingVersions, maxVersions = MAX_VERSIONS) {
  const all = Array.from({ length: maxVersions }, (_, i) => i + 1);
  return all.filter(v => !existingVersions.includes(v));
}

// ─── Shared Upload Helpers ──────────────────────────────────

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error(`Datei konnte nicht gelesen werden: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function proxyPost(body) {
  const resp = await fetch('/.netlify/functions/dropbox-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let errObj = {};
    try { errObj = JSON.parse(errText); } catch (_) {}
    throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
  }
  return resp.json();
}

export async function uploadLargeFile(file, dropboxPath, token) {
  const CHUNK_SIZE = 2 * 1024 * 1024;
  const totalSize = file.size;

  const readChunk = (start, end) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Chunk konnte nicht gelesen werden'));
      reader.readAsDataURL(file.slice(start, end));
    });
  };

  const firstChunk = await readChunk(0, CHUNK_SIZE);
  const startResp = await proxyPost({ action: 'session-start', chunk: firstChunk, token });
  const sessionId = startResp.session_id;
  const sessionToken = startResp.token || token;
  let offset = CHUNK_SIZE;

  while (offset + CHUNK_SIZE < totalSize) {
    const chunk = await readChunk(offset, offset + CHUNK_SIZE);
    await proxyPost({ action: 'session-append', sessionId, offset, chunk, token: sessionToken });
    offset += CHUNK_SIZE;
  }

  const lastChunk = await readChunk(offset, totalSize);
  await proxyPost({ action: 'session-finish', sessionId, offset, dropboxPath, chunk: lastChunk, token: sessionToken });
}

export async function createFolderSharedLink(token, folderPath) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: folderPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url || null;
  } catch (err) {
    console.warn('Ordner-Link konnte nicht erstellt werden:', err);
    return null;
  }
}

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif|avif|ico)$/i;
export const IMAGE_MIME_PREFIX = 'image/';
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

export const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm)$/i;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
export const MAX_STORY_SIZE = 500 * 1024 * 1024;
