// Rechnungs-PDFs und Belege hochladen/löschen, egal ob SharePoint oder Dropbox (ADR 0068).
// SharePoint legt die Datei unter Rechnungen/[Marke]/<Kampagne>|Contracting/<Auftrag>/<Rechnungs-Nr>/
// ab und braucht dafür die Rechnung als Bezug: erst Rechnung anlegen, dann hochladen.

import { uploadRechnungBeleg, uploadRechnungPdf } from '../DropboxDocumentUploader.js';
import { dokumentHochladen, dokumentLoeschen, dokumentZeileLaden } from './dokumentAblage.js';

const WEGE = {
  // rechnung_pdfs.uploaded_by referenziert auth.users, rechnung_belege.uploaded_by benutzer(id)
  rechnung: { tabelle: 'rechnung_pdfs', dropbox: uploadRechnungPdf, uploadedBy: () => window.currentUser?.auth_user_id || null },
  beleg: { tabelle: 'rechnung_belege', dropbox: uploadRechnungBeleg, uploadedBy: () => window.currentUser?.id || null },
};

/**
 * Eine Datei hochladen und die Zeile in rechnung_pdfs/rechnung_belege anlegen.
 * @param {object} o
 * @param {'rechnung'|'beleg'} o.typ
 * @param {string} o.rechnungId
 * @param {File} o.file
 * @param {object|(() => Promise<object>)} o.pathMeta Dropbox-Pfad-Metadaten, nur auf dem Dropbox-Weg gebraucht
 */
export async function rechnungDateiHochladen({ typ, rechnungId, file, pathMeta }) {
  const weg = WEGE[typ];
  return dokumentHochladen({
    typ,
    bezugId: rechnungId,
    file,
    dropbox: async () => weg.dropbox({ metadata: typeof pathMeta === 'function' ? await pathMeta() : pathMeta, file }),
    speichern: async (spalten) => {
      const { error } = await window.supabase.from(weg.tabelle).insert({
        rechnung_id: rechnungId,
        file_name: file.name,
        content_type: file.type,
        size: file.size,
        uploaded_by: weg.uploadedBy(),
        ...spalten,
      });
      if (error) throw new Error(`"${file.name}" konnte nicht gespeichert werden: ${error.message}`);
    },
  });
}

export async function rechnungDateienHochladen({ typ, rechnungId, files, pathMeta }) {
  let meta = null;
  const lazyMeta = typeof pathMeta === 'function' ? async () => (meta ??= await pathMeta()) : pathMeta;
  for (const file of Array.from(files || [])) {
    await rechnungDateiHochladen({ typ, rechnungId, file, pathMeta: lazyMeta });
  }
}

/** Datei entfernen (SharePoint → Papierkorb) und Zeile löschen. */
export async function rechnungDateiLoeschen(typ, id) {
  const row = await dokumentZeileLaden(typ, id);
  if (!row) return;
  await dokumentLoeschen(typ, row);
  const { error } = await window.supabase.from(WEGE[typ].tabelle).delete().eq('id', id);
  if (error) throw new Error(`Datei konnte nicht gelöscht werden (${id}): ${error.message}`);
}
