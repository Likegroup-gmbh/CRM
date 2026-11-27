// tiktok-scraper.js
// Admin-Seite TikTok-API (nur Admins). Startet den Apify-Actor clockworks/tiktok-scraper und
// liefert Stand und Ergebnisse eines Laufs. Gespeichert wird nichts, der Apify-Token bleibt hier.
//
// POST { aktion: 'starten', videos, profile, anzahl } -> { ok, lauf, ergebnis? }
// POST { aktion: 'stand', runId }                     -> { ok, lauf, ergebnis? }
// POST { aktion: 'abbrechen', runId }                 -> { ok, lauf }
// ergebnis kommt, sobald der Lauf fertig ist: { videos, profile, fehler, roh }

const { serviceClient, parseBody, json } = require('./_shared/ablage/konfig');
const { aufrufer, istAdmin } = require('./_shared/ablage/zugriff');
const apify = require('./_shared/tiktok/apify');
const { pruefeEingabe } = require('./_shared/tiktok/eingabe');
const { auswerten } = require('./_shared/tiktok/ergebnis');

const apifyFehler = (r) => json(r.status === 404 ? 404 : 502, { error: r.fehler });

// Auch fehlgeschlagene Laeufe haben oft Items: Teilergebnisse und Fehler-Items mit errorCode
async function mitErgebnis(konfig, lauf, opts) {
  if (!lauf.fertig || !lauf.datasetId) return json(200, { ok: true, lauf });
  const r = await apify.laufItems(konfig, lauf.datasetId, opts);
  if (!r.ok) return json(502, { error: `Ergebnisse nicht abrufbar: ${r.fehler}`, lauf });
  return json(200, { ok: true, lauf, ergebnis: { ...auswerten(r.items), roh: r.items } });
}

async function starten(konfig, body, opts) {
  const eingabe = pruefeEingabe(body);
  if (!eingabe.ok) return json(400, { error: eingabe.fehler });
  const r = await apify.laufStarten(konfig, eingabe.input, opts);
  if (!r.ok) return apifyFehler(r);
  return mitErgebnis(konfig, r.lauf, opts);
}

async function stand(konfig, runId, opts) {
  const r = await apify.laufStand(konfig, runId, opts);
  if (!r.ok) return apifyFehler(r);
  return mitErgebnis(konfig, r.lauf, opts);
}

async function abbrechen(konfig, runId, opts) {
  const r = await apify.laufAbbrechen(konfig, runId, opts);
  if (!r.ok) return apifyFehler(r);
  return json(200, { ok: true, lauf: r.lauf });
}

const defaults = { serviceClient, aufrufer, env: process.env, fetchImpl: undefined };

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = parseBody(event);
    if (!body || typeof body !== 'object') return json(400, { error: 'Ungueltiger Request' });
    const supabase = d.serviceClient();
    if (!supabase) return json(500, { error: 'Serverkonfiguration unvollständig' });

    try {
      const wer = await d.aufrufer(event, supabase);
      if (!wer.ok) return wer.antwort;
      if (!istAdmin(wer.benutzer)) return json(403, { error: 'Nur für Admins' });

      const konfig = apify.apifyKonfig(d.env);
      if (!konfig.token) return json(500, { error: 'APIFY_TOKEN fehlt in der Netlify-Umgebung' });
      const opts = { fetchImpl: d.fetchImpl };

      if (body.aktion === 'starten') return await starten(konfig, body, opts);
      if (body.aktion !== 'stand' && body.aktion !== 'abbrechen') return json(400, { error: 'Unbekannte Aktion' });
      if (!apify.istRunId(body.runId)) return json(400, { error: 'runId fehlt oder ist ungültig' });
      return body.aktion === 'stand'
        ? await stand(konfig, body.runId, opts)
        : await abbrechen(konfig, body.runId, opts);
    } catch (err) {
      console.error('[tiktok-scraper]', err?.message || err);
      return json(500, { error: 'Interner Fehler' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
