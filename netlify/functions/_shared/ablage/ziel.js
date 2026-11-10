// _shared/ablage/ziel.js
// Weiche pro Unternehmen + zwei Notschalter:
//   ablage_einstellung.notschalter (DB, wirkt sofort) und ABLAGE_ZIEL=dropbox (Env, wirkt nach Deploy).
// Ohne vollstaendige SharePoint-Konfiguration bleibt alles bei Dropbox.

const { istKonfiguriert } = require('./konfig');

const CACHE_MS = 15 * 1000;
let _notschalter = { wert: false, bis: 0 };

async function notschalterAn(supabase, { jetzt = Date.now() } = {}) {
  if (_notschalter.bis > jetzt) return _notschalter.wert;
  let wert = false;
  try {
    const { data } = await supabase
      .from('ablage_einstellung')
      .select('wert')
      .eq('schluessel', 'notschalter')
      .maybeSingle();
    wert = data?.wert === true;
  } catch {
    // DB nicht lesbar: lieber Dropbox als ein halber SharePoint-Upload
    wert = true;
  }
  _notschalter = { wert, bis: jetzt + CACHE_MS };
  return wert;
}

function ablageZiel(unternehmen, { notschalter = false, konfiguriert = istKonfiguriert() } = {}) {
  if (process.env.ABLAGE_ZIEL === 'dropbox' || notschalter || !konfiguriert) return 'dropbox';
  return unternehmen?.ablage_ziel === 'sharepoint' ? 'sharepoint' : 'dropbox';
}

const KOOP_SELECT = `id, name, kampagne_id, creator_id,
  kampagne:kampagne_id(id, kampagnenname, eigener_name, unternehmen_id, marke_id,
    unternehmen:unternehmen_id(id, firmenname, ablage_ziel, ist_test),
    marke:marke_id(id, markenname))`;

/** Kooperation inkl. Kampagne/Unternehmen/Marke fuer Weiche und Pfad. */
async function ladeKooperation(supabase, kooperationId) {
  const { data, error } = await supabase
    .from('kooperationen')
    .select(KOOP_SELECT)
    .eq('id', kooperationId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function zielFuerKooperation(supabase, kooperationId) {
  const koop = await ladeKooperation(supabase, kooperationId);
  if (!koop) return { ziel: null, koop: null };
  const notschalter = await notschalterAn(supabase);
  return { ziel: ablageZiel(koop.kampagne?.unternehmen, { notschalter }), koop };
}

function _reset() {
  _notschalter = { wert: false, bis: 0 };
}

module.exports = { ablageZiel, notschalterAn, ladeKooperation, zielFuerKooperation, KOOP_SELECT, _reset };
