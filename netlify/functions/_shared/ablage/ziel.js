// _shared/ablage/ziel.js
// Weiche pro Unternehmen + zwei Notschalter:
//   ablage_einstellung.notschalter (DB, wirkt sofort) und ABLAGE_ZIEL=dropbox (Env, wirkt nach Deploy).
// Dokumente (ADR 0068) haben eine eigene Weiche (dokument_ablage_ziel) und einen eigenen
// DB-Notschalter (notschalter_dokumente); ABLAGE_ZIEL=dropbox gilt fuer beide.
// Ohne vollstaendige SharePoint-Konfiguration bleibt alles bei Dropbox.

const { istKonfiguriert } = require('./konfig');

const CACHE_MS = 15 * 1000;
const NOTSCHALTER = { medien: 'notschalter', dokumente: 'notschalter_dokumente' };
let _notschalter = new Map();

async function notschalterAn(supabase, { jetzt = Date.now(), schluessel = NOTSCHALTER.medien } = {}) {
  const hit = _notschalter.get(schluessel);
  if (hit && hit.bis > jetzt) return hit.wert;
  let wert = false;
  try {
    const { data } = await supabase
      .from('ablage_einstellung')
      .select('wert')
      .eq('schluessel', schluessel)
      .maybeSingle();
    wert = data?.wert === true;
  } catch {
    // DB nicht lesbar: lieber Dropbox als ein halber SharePoint-Upload
    wert = true;
  }
  _notschalter.set(schluessel, { wert, bis: jetzt + CACHE_MS });
  return wert;
}

const dokumenteNotschalterAn = (supabase, opts = {}) => notschalterAn(supabase, { ...opts, schluessel: NOTSCHALTER.dokumente });

function ablageZiel(unternehmen, { notschalter = false, konfiguriert = istKonfiguriert(), spalte = 'ablage_ziel' } = {}) {
  if (process.env.ABLAGE_ZIEL === 'dropbox' || notschalter || !konfiguriert) return 'dropbox';
  return unternehmen?.[spalte] === 'sharepoint' ? 'sharepoint' : 'dropbox';
}

const dokumentZielVon = (unternehmen, opts = {}) => ablageZiel(unternehmen, { ...opts, spalte: 'dokument_ablage_ziel' });

const KOOP_SELECT = `id, name, kampagne_id, creator_id, produktion_id,
  produktion:produktion_id(id, name, kampagne_id),
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
  _notschalter = new Map();
}

module.exports = {
  ablageZiel,
  dokumentZielVon,
  notschalterAn,
  dokumenteNotschalterAn,
  NOTSCHALTER,
  ladeKooperation,
  zielFuerKooperation,
  KOOP_SELECT,
  _reset,
};
