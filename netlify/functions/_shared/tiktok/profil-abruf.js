// _shared/tiktok/profil-abruf.js
// Profil-Lauf fuer den TikTok-Profilabruf (tiktok-profil.js): Lauf starten, Stand abfragen und
// den fertigen Lauf in den Pool uebernehmen. Was danach mit dem Pool passiert (Casting-Zeile
// oder Vorschau), entscheidet profil-ziel.js.

const apify = require('./apify');
const { actorInput } = require('./eingabe');
const { auswerten } = require('./ergebnis');
const { profilKennzahlen } = require('./kennzahlen');
const { bauePoolRecord, speicherePool } = require('./pool');

// 40 statt 30: nach Werbung und zu frischen Videos bleibt so meist ein voller 30er-Schnitt
const PROFIL_VIDEOS = 40;
// Lauf-Abfrage 10 s + Dataset 6 s + Bild und Speichern muessen in die 26 s der Function passen
const WARTEN_S = 10;

const FEHLER_TEXTE = [
  [/private/i, 'Profil ist privat'],
  [/not.?found|not.?exist|unavailable/i, 'Profil nicht gefunden'],
];

function profilInput(username) {
  return actorInput({ videos: [], profile: [username], anzahl: PROFIL_VIDEOS }, { ohneAngepinnte: true });
}

function starteProfilLauf(konfig, username, opts = {}) {
  return apify.laufStarten(konfig, profilInput(username), { ...opts, wartenS: WARTEN_S });
}

function profilLaufStand(konfig, runId, opts = {}) {
  return apify.laufStand(konfig, runId, { ...opts, wartenS: WARTEN_S });
}

function fehlerAusItems(fehler, lauf) {
  const roh = fehler[0] ? `${fehler[0].code} ${fehler[0].text}` : '';
  const treffer = FEHLER_TEXTE.find(([re]) => re.test(roh));
  if (treffer) return treffer[1];
  if (fehler[0]?.text) return `TikTok: ${fehler[0].text}`;
  if (lauf?.status && lauf.status !== 'SUCCEEDED') return `Apify-Lauf endete mit ${lauf.status}`;
  return 'Profil liefert keine Videos (privat, gesperrt oder leer)';
}

/**
 * Profil und Videos des Handles aus den Dataset-Items. Gehoert das Ergebnis zu einem anderen
 * Handle (Link inzwischen geaendert, fremde runId), wird nichts uebernommen.
 * @returns {{ ok: true, profil: object, videos: object[] } | { ok: false, fehler: string }}
 */
function profilAusItems(items, username, lauf) {
  const { videos, profile, fehler } = auswerten(items);
  const profil = profile.find((p) => p.name?.toLowerCase() === username);
  if (profil) {
    return { ok: true, profil, videos: videos.filter((v) => v.autor?.toLowerCase() === username) };
  }
  if (profile.length) return { ok: false, fehler: `Das Ergebnis gehört zu @${profile[0].name}, nicht zu @${username}` };
  return { ok: false, fehler: fehlerAusItems(fehler, lauf) };
}

/**
 * Fertigen Lauf in den Pool uebernehmen: Items lesen, rechnen, Profilbild sichern, Pool upserten.
 * profilFehler heisst: das Profil selbst taugt nicht (privat, falscher Handle), nicht Apify.
 * @returns {Promise<{ ok: true, pool: object } | { ok: false, fehler: string, profilFehler: boolean }>}
 */
async function uebernimmLauf({ supabase, konfig, lauf, ziel, pool, benutzerId, storeImagePair, opts = {}, now = Date.now() }) {
  if (!lauf.datasetId) return { ok: false, fehler: `Apify-Lauf endete mit ${lauf.status || 'unbekannt'}`, profilFehler: false };
  const r = await apify.laufItems(konfig, lauf.datasetId, opts);
  if (!r.ok) return { ok: false, fehler: `Ergebnisse nicht abrufbar: ${r.fehler}`, profilFehler: false };

  const { username, item } = ziel;
  const treffer = profilAusItems(r.items, username, lauf);
  if (!treffer.ok) return { ok: false, fehler: treffer.fehler, profilFehler: true };

  const kennzahlen = profilKennzahlen(treffer.videos, treffer.profil.follower, now);
  const bild = await storeImagePair(supabase, treffer.profil.avatar, `sourcing/pool-tiktok/${username}/profil`);
  if (!bild?.url) console.warn(`⚠️ tiktok-profil: Profilbild @${username} fehlt:`, bild?.error || 'keine Quelle');

  const record = bauePoolRecord({
    username, profil: treffer.profil, kennzahlen, bild, pool, item, jetzt: new Date(now).toISOString(),
  });
  if (!pool && benutzerId) record.created_by = benutzerId;
  return { ok: true, pool: await speicherePool(supabase, record) };
}

module.exports = {
  PROFIL_VIDEOS,
  WARTEN_S,
  profilInput,
  starteProfilLauf,
  profilLaufStand,
  profilAusItems,
  uebernimmLauf,
};
