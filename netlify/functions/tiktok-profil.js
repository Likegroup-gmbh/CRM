// tiktok-profil.js
// TikTok-Profilabruf (ADR 0083): Follower, Engagement und die Views-Schnitte der letzten 12 bzw.
// 30 Videos eines Profils ueber Apify. Nur Admins und Mitarbeiter, Casting-Zeilen nur, wenn der
// Aufrufer sie per RLS sieht. Ein Lauf dauert laenger als eine Function: der Client startet und
// fragt dann den Stand ab (src/core/tiktok/tiktokProfil.js). Der Aufruf, der den fertigen Lauf
// sieht, schreibt Pool und Ziel.
//
// POST { aktion: 'starten', item_id | link, force? } -> { ok, fertig, runId?, source?, item | fields }
// POST { aktion: 'stand', runId, item_id | link }    -> { ok, fertig, runId?, source?, item | fields }
// Mit item_id ist das Ziel die Casting-Zeile, mit link allein bleibt es beim Pool (Vorschau).

const { serviceClient, parseBody, json } = require('./_shared/ablage/konfig');
const { aufrufer, istStaff, sichtbar } = require('./_shared/ablage/zugriff');
const { storeImagePair } = require('./_shared/instagram-graph');
const apify = require('./_shared/tiktok/apify');
const { ladePool, poolReicht } = require('./_shared/tiktok/pool');
const { starteProfilLauf, profilLaufStand, uebernimmLauf } = require('./_shared/tiktok/profil-abruf');
const { ladeZiel, schreibeZiel, markiereFehler } = require('./_shared/tiktok/profil-ziel');

const HINWEIS_PROFIL = 'Link prüfen: das Profil muss öffentlich sein und Videos haben.';

const apifyFehler = (r) => json(r.status === 404 ? 404 : 502, { error: r.fehler });

async function fertig(ctx, pool, source) {
  return json(200, { ok: true, fertig: true, source, ...(await schreibeZiel(ctx.supabase, ctx.ziel, pool)) });
}

async function weiterOderUebernehmen(ctx, lauf) {
  if (!lauf.fertig) return json(200, { ok: true, fertig: false, runId: lauf.runId, username: ctx.ziel.username });
  const r = await uebernimmLauf({ ...ctx, lauf });
  if (r.ok) return fertig(ctx, r.pool, 'apify');
  if (!r.profilFehler) return json(502, { error: r.fehler });
  await markiereFehler(ctx.supabase, ctx.ziel, r.fehler);
  return json(422, { error: r.fehler, hint: HINWEIS_PROFIL });
}

async function starten(ctx) {
  const r = await starteProfilLauf(ctx.konfig, ctx.ziel.username, ctx.opts);
  if (!r.ok) return apifyFehler(r);
  return weiterOderUebernehmen(ctx, r.lauf);
}

async function stand(ctx, runId) {
  const r = await profilLaufStand(ctx.konfig, runId, ctx.opts);
  if (!r.ok) return apifyFehler(r);
  return weiterOderUebernehmen(ctx, r.lauf);
}

const defaults = {
  serviceClient,
  aufrufer,
  sichtbar,
  storeImagePair,
  env: process.env,
  fetchImpl: undefined,
  now: () => Date.now(),
};

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = parseBody(event);
    if (!body || typeof body !== 'object') return json(400, { error: 'Ungueltiger Request' });
    if (body.aktion !== 'starten' && body.aktion !== 'stand') return json(400, { error: 'Unbekannte Aktion' });
    if (body.aktion === 'stand' && !apify.istRunId(body.runId)) return json(400, { error: 'runId fehlt oder ist ungültig' });
    const supabase = d.serviceClient();
    if (!supabase) return json(500, { error: 'Serverkonfiguration unvollständig' });

    try {
      const wer = await d.aufrufer(event, supabase);
      if (!wer.ok) return wer.antwort;
      if (!istStaff(wer.benutzer)) return json(403, { error: 'Nur für Admins und Mitarbeiter' });

      const darfSehen = async (tabelle, id) => !!(await d.sichtbar(wer.caller, tabelle, id));
      const z = await ladeZiel({ supabase, darfSehen }, body);
      if (!z.ok) return json(z.status, { error: z.fehler });

      const ctx = {
        supabase,
        konfig: apify.apifyKonfig(d.env),
        ziel: z.ziel,
        pool: await ladePool(supabase, z.ziel.username),
        benutzerId: wer.benutzer.id || null,
        storeImagePair: d.storeImagePair,
        opts: { fetchImpl: d.fetchImpl },
        now: d.now(),
      };
      if (body.aktion === 'starten' && poolReicht(ctx.pool, body.force === true)) return await fertig(ctx, ctx.pool, 'pool');
      if (!ctx.konfig.token) return json(500, { error: 'APIFY_TOKEN fehlt in der Netlify-Umgebung' });
      return body.aktion === 'starten' ? await starten(ctx) : await stand(ctx, body.runId);
    } catch (err) {
      console.error('[tiktok-profil]', err?.message || err);
      return json(500, { error: err?.message || 'Interner Fehler' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
