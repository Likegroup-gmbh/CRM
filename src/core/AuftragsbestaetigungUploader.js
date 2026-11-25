// AuftragsbestaetigungUploader.js
// Wiederverwendbare Hilfsfunktionen fuer den Upload von Auftragsbestaetigungen.
// Ziel (ADR 0068): SharePoint Aufträge/[Marke]/<Auftrag>/[Rechnungen/].
// Anschliessend ein Eintrag in auftrag_dokumente.

import { dokumentHochladen, dokumentLoeschen, dokumentZeileLaden, mitDokumentAblage } from './ablage/dokumentAblage.js';

/**
 * Laedt eine einzelne Datei als Auftragsbestaetigung hoch und legt einen Eintrag in
 * auftrag_dokumente an.
 *
 * @param {object} opts
 * @param {File} opts.file - Hochzuladende Datei
 * @param {string} opts.auftragId - Pflicht: ID des bereits angelegten Auftrags
 * @param {string} [opts.dokumentTyp='auftragsbestaetigung'] - Typ des Dokuments
 * @param {string} [opts.uploadedById] - ID des hochladenden Benutzers
 * @param {function} [opts.onProgress] - Optional: progress callback({ phase, percent })
 * @returns {Promise<{id, fileUrl, filePath, dateiname}>}
 */
export async function uploadAuftragsbestaetigung({
  file,
  auftragId,
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
  const r = await dokumentHochladen({
    typ: 'auftragsdokument',
    bezugId: auftragId,
    file,
    dokumentTyp,
    onProgress: ({ loaded, total }) => notify('uploading', 10 + Math.round((loaded / (total || 1)) * 80)),
    speichern: async (spalten) => {
      const { data: inserted, error } = await window.supabase
        .from('auftrag_dokumente')
        .insert({
          auftrag_id: auftragId,
          dokument_typ: dokumentTyp,
          dateiname: file.name,
          dateigroesse: file.size,
          uploaded_by: uploadedById || null,
          ...spalten,
        })
        .select('id')
        .single();
      if (error) throw error;
      return inserted;
    },
  });

  notify('done', 100);
  return {
    id: r.ergebnis.id,
    fileUrl: r.fileUrl,
    filePath: r.filePath,
    dateiname: r.spalten.dateiname || file.name
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

/** Loescht ein Dokument: Datei (SharePoint → Papierkorb, Storage) + DB-Eintrag. */
export async function deleteAuftragsbestaetigung(dokumentId) {
  const row = await dokumentZeileLaden('auftragsdokument', dokumentId).catch(() => null);
  if (row) await dokumentLoeschen('auftragsdokument', row);

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
    .select(mitDokumentAblage('id, dokument_typ, dateiname, dropbox_file_url, dropbox_file_path, dateigroesse, uploaded_by, created_at', 'auftragsdokument'))
    .eq('auftrag_id', auftragId)
    .order('created_at', { ascending: false });

  if (dokumentTyp) query = query.eq('dokument_typ', dokumentTyp);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
