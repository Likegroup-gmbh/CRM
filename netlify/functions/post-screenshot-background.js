// Netlify Background Function: post-screenshot-background
// Insights-Screenshots eines Posts mit Claude lesen (ADR 0078, Screenshot-Weg der Auswertung).
//
// POST { postId } -> 202 (Background). Ergebnis und Fehler stehen am Post:
//   ki_status 'laeuft' setzt der Client beim Upload (der Trigger dazu ki_gestartet_at und
//   ki_schritt 'wartet'), danach fragt er die Zeile ab. Die Function meldet ihre Schritte in
//   ki_schritt (gestartet, bilder, ki, speichern). Fertig heißt ki_status null mit status draft
//   und source ki; ein Fehler bleibt als ki_status 'fehler' mit Grund, ki_schritt sagt wo.
//
// Geschrieben wird nur in den eigenen Lauf (ki_status 'laeuft' und dasselbe ki_gestartet_at).
// Hat das Team abgebrochen oder einen neuen Screenshot eingefügt, trifft das Update nichts:
// die Function hört auf, ein spätes Ergebnis fällt weg.
//
// Das Ergebnis ist immer ein Entwurf, das Team prüft. Gelesene Felder ersetzen vorhandene
// (der Screenshot gewinnt), alle anderen bleiben; confidence hält fest, welche Felder aus einem
// Screenshot stammen. Postdatum und Account bleiben, wenn sie schon da sind (API ist genauer).
//
// Wer den Post unter RLS sieht, darf lesen lassen (post-zugriff). Die Pfade müssen unter
// {kampagne_id}/{post_id}/ liegen, sonst wäre mit service_role jedes erratene Bild lesbar.
// Feature-Key für ki_requests: insights_screenshot.
//
// Kein sharp: der Browser verkleinert vor dem Upload. Native Module brechen die Function, wenn
// sie auf einem anderen System gebaut wurde (lokaler Deploy vom Mac), und zwar schon beim Laden.

const { callClaude, extractJson, MODELS, ClaudeTimeoutError } = require('./_shared/anthropic');
const { starteKiRequest } = require('./_shared/ki-log');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { INSIGHTS_TOOL, SYSTEM, aufgabe, leseAntwort } = require('./_shared/post-insights');
const {
  TABELLE, bearer, callerClient, serviceClient, json, postIdAus, liesPostAlsAufrufer
} = require('./_shared/post-zugriff');

const BUCKET = 'post-screenshots';
const MAX_BILDER = 6;
// Anthropic nimmt höchstens 5 MB je Bild (base64 gut ein Drittel mehr). Neue Uploads sind
// verkleinert, darüber liegt nur Altbestand.
const MAX_BILD_BYTES = 3.5 * 1024 * 1024;
const KI_TIMEOUT_MS = 60000;
const MEDIA_TYPEN = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Der Lauf wurde abgebrochen oder durch einen neuen ersetzt. */
class LaufVorbei extends Error {}

/** Die jüngsten Screenshots im Ordner des Posts. */
function screenshotPfade(post) {
  const prefix = `${post.kampagne_id}/${post.id}/`;
  return (post.screenshot_pfade || [])
    .filter(p => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..'))
    .slice(-MAX_BILDER);
}

async function bildFuerClaude(service, pfad) {
  const { data, error } = await service.storage.from(BUCKET).download(pfad);
  if (error || !data) throw new Error(`Screenshot nicht lesbar: ${error?.message || 'leer'}`);
  const roh = Buffer.from(await data.arrayBuffer());
  if (roh.length > MAX_BILD_BYTES) {
    throw new Error(`Screenshot zu groß für die KI (${(roh.length / 1048576).toFixed(1)} MB). Bitte neu einfügen, dann wird er verkleinert.`);
  }
  const endung = pfad.split('.').pop().toLowerCase();
  const mediaType = MEDIA_TYPEN[endung] || (data.type?.startsWith('image/') ? data.type : 'image/jpeg');
  return { base64: roh.toString('base64'), mediaType, bytes: roh.length };
}

/**
 * Update aus dem Gelesenen. Meta kennt den Typ (Reel oder Post) genauer als die KI; ohne Abruf
 * gilt die Plattform, die die KI sieht.
 */
function screenshotPatch(post, gelesen, { heute = new Date() } = {}) {
  const eintraege = Object.entries(gelesen.felder || {});
  return {
    plattform: post.api_raw ? post.plattform : (gelesen.plattform || post.plattform),
    metrics: { ...(post.metrics || {}), ...Object.fromEntries(eintraege.map(([k, e]) => [k, e.value])) },
    confidence: { ...(post.confidence || {}), ...Object.fromEntries(eintraege.map(([k, e]) => [k, e.confidence])) },
    account_handle: post.account_handle || gelesen.accountHandle || null,
    posted_at: post.posted_at || gelesen.postedAt || null,
    measured_at: gelesen.measuredAt || heute.toISOString().slice(0, 10),
    source: 'ki',
    status: 'draft',
    confirmed_by: null,
    confirmed_at: null,
    ki_status: null,
    ki_fehler: null
  };
}

const defaults = {
  verifyAuth, callerClient, serviceClient, callClaude, starteKiRequest,
  bildLaden: bildFuerClaude,
  heute: () => new Date()
};

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    const t0 = Date.now();
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const auth = await d.verifyAuth(event);
    if (!auth.user) {
      console.warn(`post-screenshot-background: nicht angemeldet (${auth.code || 'unbekannt'})`);
      return json(401, authErrorBody(auth));
    }

    const postId = postIdAus(event);
    if (!postId) {
      console.warn('post-screenshot-background: postId fehlt oder ist keine UUID');
      return json(400, { error: 'postId fehlt' });
    }
    const log = (text) => console.log(`[${postId}] post-screenshot-background: ${text} (+${Date.now() - t0} ms)`);

    const caller = d.callerClient(bearer(event));
    const service = d.serviceClient();
    if (!caller || !service) {
      console.error(`[${postId}] post-screenshot-background: Serverkonfiguration unvollständig`);
      return json(500, { error: 'Serverkonfiguration unvollständig' });
    }

    const gelesen = await liesPostAlsAufrufer(caller, postId);
    if (gelesen.response) {
      log(`Post nicht lesbar (HTTP ${gelesen.response.statusCode})`);
      return gelesen.response;
    }
    const { post } = gelesen;
    if (post.ki_status !== 'laeuft') {
      log(`kein Lauf angefordert (ki_status ${post.ki_status || 'leer'})`);
      return json(409, { error: 'Für diesen Post ist kein KI-Lauf angefordert' });
    }
    const lauf = post.ki_gestartet_at || null;

    /** Nur in den eigenen Lauf schreiben. false: abgebrochen oder ersetzt. */
    const schreibe = async (patch) => {
      let query = service.from(TABELLE).update(patch).eq('id', postId).eq('ki_status', 'laeuft');
      if (lauf) query = query.eq('ki_gestartet_at', lauf);
      const { data, error } = await query.select('id');
      if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
      return Boolean(data?.length);
    };

    const schritt = async (name) => {
      log(`schritt=${name}`);
      if (!(await schreibe({ ki_schritt: name }))) throw new LaufVorbei();
    };

    const scheitern = async (meldung) => {
      try {
        if (!(await schreibe({ ki_status: 'fehler', ki_fehler: String(meldung).slice(0, 500) }))) {
          log('Lauf abgebrochen oder ersetzt, Fehler nicht geschrieben');
        }
      } catch (error) {
        console.error(`[${postId}] post-screenshot-background: Fehler nicht gespeichert`, error.message);
      }
    };

    let ki = null;
    try {
      await schritt('gestartet');
      const pfade = screenshotPfade(post);
      if (!pfade.length) {
        await scheitern('Am Post liegt kein Screenshot.');
        return json(400, { error: 'Kein Screenshot' });
      }

      await schritt('bilder');
      const bilder = await Promise.all(pfade.map(p => d.bildLaden(service, p)));
      const kb = Math.round(bilder.reduce((summe, b) => summe + (b.bytes || 0), 0) / 1024);
      log(`${bilder.length} Bilder geladen (${kb} KB)`);

      await schritt('ki');
      ki = await d.starteKiRequest(service, { userId: auth.user.id, feature: 'insights_screenshot' });
      const result = await d.callClaude({
        model: MODELS.extract_insights,
        systemBlocks: [{ text: SYSTEM, cache: true }],
        userPrompt: aufgabe({ plattform: post.plattform, anzahl: bilder.length }),
        maxTokens: 4096,
        tool: INSIGHTS_TOOL,
        timeoutMs: KI_TIMEOUT_MS,
        images: bilder.map(({ base64, mediaType }) => ({ base64, mediaType }))
      });
      await ki.abschliessen(result);
      log(`Claude fertig (${result.model || '?'}, stop ${result.stop_reason || '?'}, ${result.usage?.input_tokens ?? '?'} in / ${result.usage?.output_tokens ?? '?'} out)`);

      const antwort = result.json || extractJson(result.text || '', { keys: ['screenshots'] });
      const werte = leseAntwort(antwort, { plattform: post.plattform });
      if (!Object.keys(werte.felder).length) throw new Error('Auf dem Screenshot waren keine Kennzahlen lesbar.');

      await schritt('speichern');
      if (!(await schreibe(screenshotPatch(post, werte, { heute: d.heute() })))) throw new LaufVorbei();
      log(`fertig: ${Object.keys(werte.felder).join(', ')}`);
      return json(200, { ok: true });
    } catch (error) {
      if (error instanceof LaufVorbei) {
        log('Lauf abgebrochen oder ersetzt, Ergebnis verworfen');
        return json(409, { error: 'Lauf abgebrochen' });
      }
      console.error(`[${postId}] post-screenshot-background:`, error);
      if (ki) await ki.fehlgeschlagen(error);
      const meldung = error instanceof ClaudeTimeoutError
        ? `Die KI hat nicht innerhalb von ${KI_TIMEOUT_MS / 1000} s geantwortet.`
        : (error.message || 'Die KI konnte den Screenshot nicht lesen.');
      await scheitern(meldung);
      return json(500, { error: meldung });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.screenshotPatch = screenshotPatch;
exports.screenshotPfade = screenshotPfade;
exports.bildFuerClaude = bildFuerClaude;
