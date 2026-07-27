// cleanup-temp-produktbilder.js
// Scheduled Function (siehe netlify.toml): raeumt Produktbilder auf, die die
// KI-Extraktion nach produkte/_temp/{extractId}/ gelegt hat, die aber nie in
// ein Produkt uebernommen wurden - weil der Nutzer das Formular abgebrochen
// oder die Bilder verworfen hat.
//
// Uebernommene Bilder sind zu diesem Zeitpunkt schon per move() aus _temp/
// verschwunden, hier landet also ausschliesslich Muell.

const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'produkte';
const TEMP_PREFIX = '_temp';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

/** Ein Storage-Objekt gilt als alt, wenn sein jüngster Zeitstempel alt ist. */
function isExpired(entry, now) {
  const stamp = entry.updated_at || entry.created_at || entry.last_accessed_at;
  if (!stamp) return false;
  return now - new Date(stamp).getTime() > MAX_AGE_MS;
}

exports.handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ cleanup-temp-produktbilder: Supabase-Konfiguration fehlt');
    return { statusCode: 500, body: 'Supabase-Konfiguration fehlt' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = Date.now();

  try {
    const { data: ordner, error } = await supabase.storage
      .from(BUCKET)
      .list(TEMP_PREFIX, { limit: 1000 });
    if (error) throw new Error(error.message);

    let geprueft = 0;
    let entfernt = 0;

    for (const eintrag of ordner || []) {
      // list() liefert Ordner als Pseudo-Eintraege ohne id
      if (eintrag.id) continue;

      const prefix = `${TEMP_PREFIX}/${eintrag.name}`;
      const zuLoeschen = [];

      // Paginieren, damit ein grosser Ordner nicht stillschweigend abgeschnitten wird
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: dateien, error: listError } = await supabase.storage
          .from(BUCKET)
          .list(prefix, { limit: PAGE_SIZE, offset });
        if (listError) throw new Error(listError.message);
        if (!dateien?.length) break;

        for (const datei of dateien) {
          geprueft++;
          if (isExpired(datei, now)) zuLoeschen.push(`${prefix}/${datei.name}`);
        }
        if (dateien.length < PAGE_SIZE) break;
      }

      if (!zuLoeschen.length) continue;

      const { error: removeError } = await supabase.storage.from(BUCKET).remove(zuLoeschen);
      if (removeError) {
        console.warn(`⚠️ cleanup-temp-produktbilder: ${prefix} nicht raeumbar: ${removeError.message}`);
        continue;
      }
      entfernt += zuLoeschen.length;
    }

    console.log(`🧹 cleanup-temp-produktbilder: ${entfernt} von ${geprueft} Temp-Bildern entfernt`);
    return { statusCode: 200, body: JSON.stringify({ geprueft, entfernt }) };
  } catch (err) {
    console.error('❌ cleanup-temp-produktbilder:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
