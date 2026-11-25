// strategie-idee/verbindlich.js
// Verbindliche Umsetzungsideen des Briefings werden vor dem KI-Lauf 1:1 zu
// Videoidee-Vorschlaegen (ADR 0073), zusaetzlich zur gewuenschten Anzahl.
// Text wird eine Idee mit Kurzbeschreibung, ein Link eine Videoreferenz mit dem
// uebrigen Text als Umsetzungsvorgabe. Einmalig: nicht, wenn die Idee schon im
// Konzept steht, und nicht, wenn ein frueherer Lauf sie schon angelegt hat
// (verworfene Vorschlaege kommen nicht wieder). Die Schluessel stehen dafuer im
// Job-Ergebnis (strategie_idee_jobs.result.verbindlich), auch bei gescheiterten Laeufen.

const { ideenEintraege } = require('../skript-context/briefing-felder');
const { detectPlatform } = require('../../screenshot-utils/constants');
const { erstzeile } = require('./validierung');

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

function textSchluessel(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Teilen-Parameter der Plattformen; YouTubes ?v= bleibt, sonst waeren alle Videos gleich.
const TRACKING_RE = /^(utm_|is_from_webapp$|sender_device$|igsh$|igshid$|si$|_r$|_t$|share_|feature$)/;

function linkSchluessel(url) {
  const roh = String(url || '').trim();
  let ohneTracking = roh;
  try {
    const u = new URL(roh);
    for (const key of [...u.searchParams.keys()]) if (TRACKING_RE.test(key)) u.searchParams.delete(key);
    ohneTracking = u.toString();
  } catch (_) { /* kein absoluter Link: Rohtext */ }
  return ohneTracking.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/#.*$/, '')
    .replace(/[/?]+$/, '');
}

/** Verbindliche Ideen des Briefings mit Link, Resttext und Schluessel. */
function verbindlicheIdeen(briefing) {
  return ideenEintraege(briefing)
    .filter((e) => e.verbindlich)
    .map(({ text }) => {
      const url = text.match(URL_RE)?.[0] || null;
      const rest = url ? text.replace(url, ' ').replace(/\s+/g, ' ').trim() : text;
      const schluessel = url ? `link:${linkSchluessel(url)}` : `text:${textSchluessel(text)}`;
      return { text, url, rest: rest || null, schluessel };
    });
}

function konzeptSchluessel(items) {
  const keys = new Set();
  for (const item of items || []) {
    if (item?.video_link) keys.add(`link:${linkSchluessel(item.video_link)}`);
    for (const wert of [item?.beschreibung, item?.kurzbeschreibung]) {
      if (!wert) continue;
      keys.add(`text:${textSchluessel(wert)}`);
      keys.add(`text:${textSchluessel(erstzeile(wert))}`);
    }
  }
  return keys;
}

/** Verbindliche Ideen, die weder im Konzept stehen noch schon einmal angelegt wurden. */
function offeneVerbindlicheIdeen({ briefing, items = [], frueher = [] } = {}) {
  const belegt = konzeptSchluessel(items);
  for (const key of frueher || []) belegt.add(key);
  const offen = [];
  for (const idee of verbindlicheIdeen(briefing)) {
    if (belegt.has(idee.schluessel)) continue;
    belegt.add(idee.schluessel);
    offen.push(idee);
  }
  return offen;
}

/** Schluessel, die fruehere Laeufe dieses Konzepts angelegt haben (jeder Status). */
async function frueherAngelegt(supabase, strategieId) {
  const { data } = await supabase.from('strategie_idee_jobs')
    .select('result')
    .eq('strategie_id', strategieId);
  return (data || []).flatMap((row) => (Array.isArray(row?.result?.verbindlich) ? row.result.verbindlich : []));
}

/** createdBy ist benutzer.id (FK), nicht auth.users.id. */
function buildVerbindlichInsert({ strategieId, idee, sortierung, createdBy, produktId = null }) {
  const basis = {
    ...(produktId ? { produkt_id: produktId } : {}),
    strategie_id: strategieId,
    sortierung,
    teilbereich: null,
    ist_vorschlag: true,
    created_by: createdBy
  };
  if (idee.url) {
    return {
      ...basis,
      video_link: idee.url,
      plattform: detectPlatform(idee.url),
      kurzbeschreibung: idee.rest,
      umsetzungsvorgabe: idee.rest,
      verarbeitung_status: 'pending'
    };
  }
  return {
    ...basis,
    video_link: null,
    plattform: null,
    kurzbeschreibung: idee.text,
    beschreibung: idee.text,
    beschreibung_quelle: 'user'
  };
}

/**
 * Screenshot und Transkript der ersten neuen Videoreferenz anstossen; die
 * Kette in strategie-item-background zieht die uebrigen pending Items nach.
 */
async function starteReferenzVerarbeitung(event, itemId) {
  const fromEnv = process.env.DEPLOY_PRIME_URL || process.env.URL;
  const host = (event?.headers || {}).host;
  const siteUrl = fromEnv ? fromEnv.replace(/\/$/, '') : (host ? `https://${host}` : null);
  const authHeader = (event?.headers || {}).authorization || (event?.headers || {}).Authorization;
  if (!siteUrl || !authHeader || !itemId) return;
  try {
    await fetch(`${siteUrl}/.netlify/functions/strategie-item-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ itemId })
    });
  } catch (e) {
    console.error(`Verarbeitung der Videoreferenz ${itemId} nicht gestartet:`, e.message);
  }
}

module.exports = {
  verbindlicheIdeen, offeneVerbindlicheIdeen, frueherAngelegt, buildVerbindlichInsert, starteReferenzVerarbeitung
};
