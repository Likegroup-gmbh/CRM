// videoUploadSteps.js
// Gemeinsame Schritte der Video-Jobs (neu hochladen, ersetzen): Token + Zielpfad holen,
// Freigabelink erzeugen, Fortschritt melden.

import { authorizedFetch } from '../auth/getAccessToken.js';

export async function fetchTokenAndPath({ metadaten, versionNumber, variantName, fileName, isFinal = false }) {
  const resp = await authorizedFetch('/.netlify/functions/dropbox-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unternehmen: metadaten.unternehmen || '',
      marke: metadaten.marke || '',
      kampagne: metadaten.kampagne || '',
      kooperation: metadaten.kooperationName || '',
      videoPosition: metadaten.videoPosition || 1,
      videoThema: metadaten.videoThema || '',
      videoTitel: metadaten.videoTitel || 'Video',
      versionNumber: String(versionNumber),
      variantName,
      fileName,
      isFinal: !!isFinal,
    }),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${resp.status})`);
  }
  return resp.json();
}

export async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  } catch {
    return null;
  }
}

/** onProgress für uploadFileDirect: Bytes melden, Wechsel auf den Proxy einmal anzeigen. */
export function trackUploadProgress(item, updateItem) {
  return ({ loaded, total, phase, error }) => {
    const patch = { loaded, total };
    if (phase === 'direct-failed') {
      patch.directOk = false;
      patch.directError = error || 'Unbekannter Fehler';
      patch.transport = 'proxy';
      if (!item.directErrorNotified) {
        item.directErrorNotified = true;
        window.toastSystem?.warning?.(
          `Direct-Upload fehlgeschlagen (${patch.directError}). Upload laeuft ueber Proxy weiter (langsamer).`
        );
      }
    }
    if (phase === 'proxy-fallback') patch.transport = 'proxy';
    updateItem(item.id, patch);
  };
}

/** Dropbox-Pfade sind case-insensitiv: gleicher Pfad in anderer Schreibweise ist dieselbe Datei. */
export function sameDropboxPath(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}
