// _shared/ablage/schreiben-session.js
// Upload-Session in SharePoint eroeffnen und in ablage_upload festhalten: gemeinsamer
// letzter Schritt von Medien-, Spalten- und Dokument-Upload. Der Client laedt danach in
// Stuecken direkt nach SharePoint und schliesst mit ablage-upload-commit ab.

const { CHUNK_BYTES } = require('./konfig');

/**
 * @param {object} c { supabase, sp, driveId }
 * @param {object} a
 * @param {{ item_id:string, pfad:string }} a.ordner Zielordner
 * @param {string} a.name bereinigter Dateiname
 * @param {object|null} a.altItem beim Ersetzen: neue Version dieses Items
 * @param {string|null} a.ordnerUrl webUrl des Zielordners
 */
async function sessionEroeffnen(c, { benutzer, typ, ordner, name, groesse, kontext, altItem = null, ordnerUrl = null }) {
  const { supabase, sp, driveId } = c;
  const session = altItem
    ? await sp.uploadSessionFuerItem(altItem.id)
    : await sp.uploadSession(ordner.item_id, name, { conflict: 'rename' });

  const { data: up, error } = await supabase
    .from('ablage_upload')
    .insert({
      drive_id: driveId,
      parent_item_id: ordner.item_id,
      name,
      groesse,
      typ,
      kontext,
      item_id: altItem?.id || null,
      erstellt_von: benutzer.id,
    })
    .select('id')
    .single();
  if (error) {
    await sp.sessionVerwerfen(session.uploadUrl).catch(() => {});
    throw error;
  }

  return {
    ziel: 'sharepoint',
    upload_id: up.id,
    upload_url: session.uploadUrl,
    chunk_bytes: CHUNK_BYTES,
    file_name: name,
    ordner: { item_id: ordner.item_id, pfad: ordner.pfad, web_url: ordnerUrl },
  };
}

/** Beim Ersetzen: Zusatz fuer den Upload-Kontext (gleiches Item, ggf. neuer Name). */
function ersetzenKontext(altItem, name) {
  return altItem ? { gleiches_item: true, umbenennen_auf: name !== altItem.name ? name : null } : {};
}

module.exports = { sessionEroeffnen, ersetzenKontext };
