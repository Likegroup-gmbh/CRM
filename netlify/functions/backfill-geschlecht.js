/**
 * Netlify Function: backfill-geschlecht
 *
 * Fuellt das leere Feld creator.geschlecht fuer den Bestand nach. Grundlage ist
 * die Ableitung aus Vorname + Instagram-Profil (_shared/geschlecht-erkennen.js).
 *
 * Fasst nur Datensaetze mit geschlecht IS NULL an und schreibt
 * geschlecht_quelle = 'ki' mit, damit haendisch Gepflegtes unangetastet bleibt
 * und spaeter erkennbar ist, was geraten wurde.
 *
 * Aufruf: POST /.netlify/functions/backfill-geschlecht  (Bearer-Token noetig)
 * Optional: ?dryRun=true   nur einschaetzen, nichts schreiben (Ergebnisliste)
 *           ?limit=50      maximal so viele Creator pro Lauf (Default 200)
 */

const { createClient } = require('@supabase/supabase-js');
const { erkenneGeschlecht } = require('./_shared/geschlecht-erkennen');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_LIMIT = 200;
// Harte Grenze pro Claude-Call, damit ein haengender Batch nicht das
// Function-Timeout reisst
const BATCH_TIMEOUT_MS = 25000;
const UPDATE_PARALLEL = 20;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2)
  };
}

/** Updates in kleinen Wellen fahren statt 200 Roundtrips nacheinander */
async function schreibeErgebnisse(supabase, treffer) {
  let geschrieben = 0;
  const fehler = [];

  for (let i = 0; i < treffer.length; i += UPDATE_PARALLEL) {
    const welle = treffer.slice(i, i + UPDATE_PARALLEL);
    const ergebnisse = await Promise.all(welle.map(async (t) => {
      // is('geschlecht', null) schuetzt gegen den Fall, dass jemand den Wert
      // waehrend des Laufs von Hand gesetzt hat
      const { error } = await supabase
        .from('creator')
        .update({
          geschlecht: t.geschlecht,
          geschlecht_quelle: 'ki',
          geschlecht_konfidenz: t.konfidenz
        })
        .eq('id', t.id)
        .is('geschlecht', null);
      return error ? { id: t.id, message: error.message } : null;
    }));

    for (const fehlschlag of ergebnisse) {
      if (fehlschlag) fehler.push(fehlschlag);
      else geschrieben++;
    }
  }

  return { geschrieben, fehler };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(500, { error: 'Supabase-Env fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse(500, { error: 'ANTHROPIC_API_KEY nicht gesetzt' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    return jsonResponse(401, authErrorBody(auth));
  }

  const params = event.queryStringParameters || {};
  const dryRun = params.dryRun === 'true';
  const limit = Math.max(1, Number(params.limit) || DEFAULT_LIMIT);

  const { data: offen, error: loadError } = await supabase
    .from('creator')
    .select('id, vorname, nachname, ig_username, ig_biography')
    .is('geschlecht', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (loadError) {
    return jsonResponse(500, { error: `Laden fehlgeschlagen: ${loadError.message}` });
  }
  if (!offen?.length) {
    return jsonResponse(200, { ok: true, dryRun, offen: 0, hinweis: 'Kein Creator ohne Geschlecht gefunden' });
  }

  console.log(`🚀 backfill-geschlecht: ${offen.length} Creator ohne Geschlecht (dryRun=${dryRun})`);

  const { treffer, fehler } = await erkenneGeschlecht(offen, {
    supabase,
    userId: auth.user.id,
    feature: 'geschlecht_backfill',
    timeoutMs: BATCH_TIMEOUT_MS
  });

  const sicher = treffer.filter((t) => t.geschlecht);
  const unsicher = treffer.filter((t) => !t.geschlecht);

  const verteilung = {};
  for (const t of sicher) {
    verteilung[t.geschlecht] = (verteilung[t.geschlecht] || 0) + 1;
  }

  const namen = new Map(offen.map((c) => [c.id, [c.vorname, c.nachname].filter(Boolean).join(' ')]));
  const details = treffer.map((t) => ({
    name: namen.get(t.id) || t.id,
    geschlecht: t.geschlecht,
    vorschlag: t.geschlecht ? undefined : t.vorschlag,
    konfidenz: t.konfidenz
  }));

  if (dryRun) {
    return jsonResponse(200, {
      ok: true,
      dryRun: true,
      geprueft: offen.length,
      sicher: sicher.length,
      unsicher: unsicher.length,
      verteilung,
      batchFehler: fehler,
      details
    });
  }

  const { geschrieben, fehler: schreibFehler } = await schreibeErgebnisse(supabase, sicher);

  const { count: verbleibend } = await supabase
    .from('creator')
    .select('id', { count: 'exact', head: true })
    .is('geschlecht', null);

  console.log(`✅ backfill-geschlecht: ${geschrieben} gesetzt, ${unsicher.length} unsicher, ${verbleibend} offen`);

  return jsonResponse(200, {
    ok: true,
    dryRun: false,
    geprueft: offen.length,
    geschrieben,
    unsicher: unsicher.length,
    verbleibend: verbleibend ?? null,
    verteilung,
    batchFehler: fehler,
    schreibFehler
  });
};
