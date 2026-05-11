// AuftragsbestaetigungUploader.js
// Wiederverwendbare Hilfsfunktionen fuer den Upload von Auftragsbestaetigungen.
// Nutzt /.netlify/functions/dropbox-upload-auftragsbestaetigung + dropbox-proxy
// und legt anschliessend einen Eintrag in der Tabelle auftrag_dokumente an.

import { proxyPost, uploadLargeFile, readFileAsBase64 } from './VideoUploadUtils.js';

const SMALL_FILE_THRESHOLD = 2 * 1024 * 1024; // 2 MB

/**
 * Laedt eine einzelne Datei als Auftragsbestaetigung nach Dropbox hoch
 * und legt einen Eintrag in auftrag_dokumente an.
 *
 * @param {object} opts
 * @param {File} opts.file - Hochzuladende Datei
 * @param {string} opts.auftragId - Pflicht: ID des bereits angelegten Auftrags
 * @param {string} [opts.unternehmen] - Firmenname fuer Dropbox-Pfad
 * @param {string} [opts.marke] - Markenname fuer Dropbox-Pfad
 * @param {string} [opts.auftragstitel] - Titel/Name des Auftrags fuer Dropbox-Pfad
 * @param {string} [opts.dokumentTyp='auftragsbestaetigung'] - Typ des Dokuments
 * @param {string} [opts.uploadedById] - ID des hochladenden Benutzers
 * @param {function} [opts.onProgress] - Optional: progress callback({ phase, percent })
 * @returns {Promise<{id, fileUrl, filePath, dateiname}>}
 */
export async function uploadAuftragsbestaetigung({
  file,
  auftragId,
  unternehmen = '',
  marke = '',
  auftragstitel = '',
  dokumentTyp = 'auftragsbestaetigung',
  uploadedById = null,
  onProgress = null
}) {
  if (!file) throw new Error('Keine Datei angegeben');
  if (!auftragId) throw new Error('auftragId fehlt');

  const notify = (phase, percent = null) => {
    if (typeof onProgress === 'function') {
      try { onProgress({ phase, percent, fileName: file.name }); } catch (_) { /* noop */ }
    }
  };

  notify('preparing', 0);
  const tokenResp = await fetch('/.netlify/functions/dropbox-upload-auftragsbestaetigung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unternehmen,
      marke,
      auftragstitel,
      fileName: file.name
    })
  });

  if (!tokenResp.ok) {
    const errData = await tokenResp.json().catch(() => ({}));
    throw new Error(errData.error || `Token-Abruf fehlgeschlagen (${tokenResp.status})`);
  }

  const { token, dropboxPath } = await tokenResp.json();

  notify('uploading', 10);
  let actualPath = dropboxPath;
  let sessionToken = token;

  if (file.size <= SMALL_FILE_THRESHOLD) {
    const chunk = await readFileAsBase64(file);
    const result = await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
    actualPath = result.path_display || dropboxPath;
  } else {
    // uploadLargeFile nutzt session-start/append/finish; Token wird intern verwaltet
    await uploadLargeFile(file, dropboxPath, token);
    // path_display kennen wir hier nicht, dropboxPath reicht
  }

  notify('linking', 80);
  const sharedLinkResp = await fetch('/.netlify/functions/dropbox-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'shared-link', path: actualPath, token: sessionToken }),
  });

  let fileUrl = actualPath;
  if (sharedLinkResp.ok) {
    const { url } = await sharedLinkResp.json();
    if (url) fileUrl = url.replace('?dl=0', '?raw=1');
  }

  notify('saving', 90);
  const insertPayload = {
    auftrag_id: auftragId,
    dokument_typ: dokumentTyp,
    dateiname: file.name,
    dropbox_file_url: fileUrl,
    dropbox_file_path: actualPath,
    dateigroesse: file.size,
    uploaded_by: uploadedById || null
  };

  const { data: inserted, error } = await window.supabase
    .from('auftrag_dokumente')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) throw error;

  notify('done', 100);
  return {
    id: inserted.id,
    fileUrl,
    filePath: actualPath,
    dateiname: file.name
  };
}

/**
 * Laedt mehrere Dateien sequentiell hoch.
 * Fehler bei einzelnen Dateien werden gesammelt, der Rest wird trotzdem hochgeladen.
 *
 * @returns {Promise<{successes: Array, errors: Array}>}
 */
export async function uploadAuftragsbestaetigungen(files, opts) {
  const successes = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await uploadAuftragsbestaetigung({
        ...opts,
        file,
        onProgress: opts.onProgress
          ? (p) => opts.onProgress({ ...p, fileIndex: i, totalFiles: files.length })
          : null
      });
      successes.push(result);
    } catch (err) {
      console.error(`[AuftragsbestaetigungUploader] Upload fehlgeschlagen fuer ${file.name}:`, err);
      errors.push({ fileName: file.name, error: err.message || String(err) });
    }
  }

  return { successes, errors };
}

/**
 * Loescht ein Dokument: Dropbox-Datei + DB-Eintrag.
 */
export async function deleteAuftragsbestaetigung(dokumentId, dropboxFilePath) {
  if (dropboxFilePath) {
    try {
      await fetch('/.netlify/functions/dropbox-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: dropboxFilePath }),
      });
    } catch (err) {
      console.warn('[AuftragsbestaetigungUploader] Dropbox-Loeschung fehlgeschlagen (nicht kritisch):', err);
    }
  }

  const { error } = await window.supabase
    .from('auftrag_dokumente')
    .delete()
    .eq('id', dokumentId);

  if (error) throw error;
}

/**
 * Laedt alle Dokumente eines Auftrags.
 */
export async function loadAuftragsbestaetigungen(auftragId, dokumentTyp = null) {
  let query = window.supabase
    .from('auftrag_dokumente')
    .select('id, dokument_typ, dateiname, dropbox_file_url, dropbox_file_path, dateigroesse, uploaded_by, created_at')
    .eq('auftrag_id', auftragId)
    .order('created_at', { ascending: false });

  if (dokumentTyp) query = query.eq('dokument_typ', dokumentTyp);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
