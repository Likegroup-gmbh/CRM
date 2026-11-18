// Netlify Function: post-link-abruf
// Zahlen zum Link eines Posts bei Instagram holen (ADR 0078, Link-Weg der Auswertung).
//
// POST { postId } -> { ok: true, post } | { error, hint }
//
// Meta liefert Aufrufe, Likes und Kommentare exakt per Shortcode, deshalb ist der Post danach
// bestätigt (source api). Felder aus einem Screenshot (sie stehen in confidence) bleiben, denn
// bei Konflikten gewinnt der Screenshot; ein Entwurf mit noch ungeprüften KI-Werten bleibt Entwurf.
// Stories und TikTok kennt Business Discovery nicht: der Link bleibt gespeichert, die Antwort
// sagt warum. Den Account nimmt der Abruf vom Post (Collab unter der Marke), sonst vom Creator.
//
// Wer den Post unter RLS sieht, darf abrufen (post-zugriff). Der Meta-Token bleibt serverseitig.

const { normalizeUsername, isValidUsername } = require('./_shared/instagram-graph');
const {
  extractShortcode, findMediaByShortcode, abrufHinweis, kennzahlenAusMedia, plattformAusMedia
} = require('./_shared/instagram-post-abruf');
const {
  TABELLE, POST_SPALTEN, bearer, callerClient, serviceClient, json, postIdAus, liesPostAlsAufrufer
} = require('./_shared/post-zugriff');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

const STORY_HINWEIS = 'Stories liefert die Instagram-API nicht. Bitte einen Screenshot der Story-Insights einfügen.';
const TIKTOK_HINWEIS = 'TikTok ist nicht angebunden. Bitte einen Screenshot der Insights einfügen.';

/** Grund, warum der Link nicht abrufbar ist, sonst null. */
function abrufSperre(post) {
  const link = String(post?.link || '').trim();
  if (!link) return 'Am Post ist noch kein Link hinterlegt.';
  if (post.plattform === 'ig_story' || /instagram\.com\/stories\//i.test(link)) return STORY_HINWEIS;
  if (post.plattform === 'tiktok' || /tiktok\.com/i.test(link)) return TIKTOK_HINWEIS;
  if (!extractShortcode(link)) return 'Kein gültiger Instagram-Link (erwartet /reel/, /p/ oder /tv/).';
  return null;
}

/** Felder aus einem Screenshot: alles, wofür die KI eine Konfidenz hinterlegt hat. */
const screenshotFelder = (post) => Object.keys(post?.confidence || {});

/**
 * Update aus dem Media-Objekt. API-Zahlen ersetzen eigene und manuelle Werte, nie die aus
 * einem Screenshot.
 */
function apiPatch(post, media, { username, shortcode, userId, jetzt = new Date() }) {
  const vomScreenshot = new Set(screenshotFelder(post));
  const metrics = { ...(post.metrics || {}) };
  Object.entries(kennzahlenAusMedia(media)).forEach(([key, wert]) => {
    if (!vomScreenshot.has(key)) metrics[key] = wert;
  });
  const offenVonKi = post.status === 'draft' && vomScreenshot.size > 0;
  const datum = media.timestamp ? String(media.timestamp).slice(0, 10) : null;
  return {
    metrics,
    plattform: plattformAusMedia(media, post.plattform),
    account_handle: username,
    posted_at: datum || post.posted_at || null,
    measured_at: jetzt.toISOString().slice(0, 10),
    api_raw: {
      media_id: media.id,
      media_type: media.media_type || null,
      permalink: media.permalink || null,
      timestamp: media.timestamp || null,
      username,
      shortcode,
      abgerufen_at: jetzt.toISOString()
    },
    source: vomScreenshot.size ? 'ki' : 'api',
    ...(offenVonKi ? {} : { status: 'confirmed', confirmed_by: userId, confirmed_at: jetzt.toISOString() })
  };
}

async function accountFuer(service, post) {
  const eigener = normalizeUsername(post.account_handle);
  if (isValidUsername(eigener)) return eigener;
  const { data: koop } = await service
    .from('kooperationen')
    .select('creator:creator_id(instagram)')
    .eq('id', post.kooperation_id)
    .maybeSingle();
  const creator = normalizeUsername(koop?.creator?.instagram);
  return isValidUsername(creator) ? creator : null;
}

const defaults = { verifyAuth, callerClient, serviceClient, findMedia: findMediaByShortcode };

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const auth = await d.verifyAuth(event);
    if (!auth.user) return json(401, authErrorBody(auth));

    const postId = postIdAus(event);
    if (!postId) return json(400, { error: 'postId fehlt' });

    const caller = d.callerClient(bearer(event));
    const service = d.serviceClient();
    if (!caller || !service) return json(500, { error: 'Serverkonfiguration unvollständig' });

    const gelesen = await liesPostAlsAufrufer(caller, postId);
    if (gelesen.response) return gelesen.response;
    const { post } = gelesen;

    const sperre = abrufSperre(post);
    if (sperre) return json(400, { error: sperre, hint: sperre });

    const username = await accountFuer(service, post);
    if (!username) {
      const hint = 'Beim Creator ist kein Instagram-Profil hinterlegt – Account am Post eintragen oder Screenshot nutzen.';
      return json(400, { error: hint, hint });
    }
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
      return json(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
    }

    const shortcode = extractShortcode(post.link);
    const res = await d.findMedia(username, shortcode);
    if (!res.ok) {
      return json(res.rate_limited ? 429 : 502, {
        error: res.error,
        error_code: res.error_code,
        retryable: Boolean(res.rate_limited),
        hint: abrufHinweis(res, username)
      });
    }

    const patch = apiPatch(post, res.media, { username, shortcode, userId: auth.user.id });
    const { data, error } = await service.from(TABELLE).update(patch).eq('id', postId).select(POST_SPALTEN).single();
    if (error) return json(500, { error: `Speichern fehlgeschlagen: ${error.message}` });
    return json(200, { ok: true, post: data });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.abrufSperre = abrufSperre;
exports.apiPatch = apiPatch;
