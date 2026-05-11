// Wiederverwendbarer Helper, der PDF-/Dokumenten-Uploads nach Dropbox abwickelt.
// Genutzt von:
//   - Rechnungs-PDFs (RechnungDetail, RechnungContractingCreate, FormRelationsHandler)
//   - Rechnungs-Belegen (gleiche Stellen, mit kind="beleg")
//   - Generierten Vertrag-PDFs (UgcPdf, InfluencerPdf, VideografPdf, ModelPdf)
//
// Verantwortlich für:
//   1. Token + Zielpfad von der Netlify Prepare-Function holen
//   2. Datei nach Dropbox uploaden (small / chunked je nach Größe)
//   3. Shared Link erzeugen (?dl=0 → ?raw=1 für direkten Zugriff)
//   4. Rückgabe { fileUrl, filePath } für DB-Insert
//
// Die Auflösung der IDs zu Namen passiert in den jeweiligen Aufrufstellen,
// nicht hier.

import { proxyPost, uploadLargeFile, readFileAsBase64 } from './VideoUploadUtils.js';

const SMALL_UPLOAD_LIMIT = 2 * 1024 * 1024; // 2 MB

async function prepare(endpoint, body) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Prepare fehlgeschlagen (${resp.status})`);
  }
  return resp.json();
}

async function uploadToDropbox(token, dropboxPath, file) {
  if (file.size <= SMALL_UPLOAD_LIMIT) {
    const chunk = await readFileAsBase64(file);
    return proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
  }
  await uploadLargeFile(file, dropboxPath, token);
  return { path_display: dropboxPath };
}

async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  } catch (err) {
    console.warn('Shared Link konnte nicht erstellt werden:', err);
    return null;
  }
}

// Generischer Document Upload.
// @param endpoint - z.B. '/.netlify/functions/dropbox-upload-rechnung'
// @param metadata - Pfad-Metadaten für die Prepare-Function
// @param file - File oder Blob (Blob braucht .name + .type Workaround → bevorzugt File-Objekt)
// @returns Promise<{ fileUrl, filePath, folderPath }>
export async function uploadDocumentToDropbox({ endpoint, metadata, file }) {
  if (!file) throw new Error('uploadDocumentToDropbox: file fehlt');
  if (!endpoint) throw new Error('uploadDocumentToDropbox: endpoint fehlt');

  const fileName = file.name || metadata.fileName || `dokument_${Date.now()}.pdf`;

  const prepResp = await prepare(endpoint, { ...metadata, fileName });
  const { token, dropboxPath, folderPath } = prepResp;
  if (!token || !dropboxPath) {
    throw new Error('Prepare-Antwort ohne token/dropboxPath');
  }

  const uploadResult = await uploadToDropbox(token, dropboxPath, file);
  const actualPath = uploadResult?.path_display || dropboxPath;
  const sharedLink = await createSharedLink(token, actualPath);

  return {
    fileUrl: sharedLink || actualPath,
    filePath: actualPath,
    folderPath: folderPath || null,
  };
}

// Convenience-Wrapper für Rechnungs-PDFs.
export function uploadRechnungPdf({ metadata, file }) {
  return uploadDocumentToDropbox({
    endpoint: '/.netlify/functions/dropbox-upload-rechnung',
    metadata: { ...metadata, kind: 'pdf' },
    file,
  });
}

// Convenience-Wrapper für Rechnungs-Belege.
export function uploadRechnungBeleg({ metadata, file }) {
  return uploadDocumentToDropbox({
    endpoint: '/.netlify/functions/dropbox-upload-rechnung',
    metadata: { ...metadata, kind: 'beleg' },
    file,
  });
}

// Convenience-Wrapper für (generierte oder unterschriebene) Vertrag-PDFs.
export function uploadVertragPdf({ metadata, file }) {
  return uploadDocumentToDropbox({
    endpoint: '/.netlify/functions/dropbox-upload-vertrag',
    metadata,
    file,
  });
}
