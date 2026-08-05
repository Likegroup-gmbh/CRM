// Netlify Background Function: Video-Transkription via Cloudflare Workers AI
// Ablauf: Puppeteer -> Video-CDN-URL abfangen -> Video in Memory laden ->
//         Cloudflare Whisper (Transkript) -> Cloudflare Llama (Beschreibung) -> Supabase.
// Background Function (Suffix "-background"): antwortet sofort 202, Ergebnis kommt
// asynchron ueber die transcription_jobs-Tabelle (Realtime in der UI).
// Es werden KEINE Dateien gespeichert - Video-Buffer lebt nur im RAM dieses Aufrufs.
//
// Die eigentliche Pipeline liegt in _shared/video-transcribe.js und wird von
// strategie-item-background.js mitbenutzt.

const { createClient } = require('@supabase/supabase-js');
const { detectPlatform } = require('./screenshot-utils/constants');
const { launchBrowser, setupPage } = require('./screenshot-utils/browser-setup');
const { transcribeVideoOnPage, isTranscribablePlatform } = require('./_shared/video-transcribe');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

/**
 * Job-Updater: schreibt Status/Progress/Logs in die transcription_jobs-Zeile.
 * Logs werden kumulativ gehalten, damit die UI einen Live-Console-Log anzeigen kann.
 *
 * Performance: Zwischenstands-Writes blockieren die Pipeline nicht mehr, laufen aber
 * als serielle Queue (Reihenfolge garantiert, kein Ueberholen). Nur der finale Write
 * (done/error) wird via flush() abgewartet, damit vor dem Lambda-Freeze alles landet.
 */
function createJobUpdater(supabase, jobId) {
  const logs = [];
  let queue = Promise.resolve();

  const enqueue = (patch) => {
    queue = queue
      .then(() => supabase.from('transcription_jobs').update({ ...patch, logs }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Supabase-Write fehlgeschlagen:`, e.message));
  };

  const pushLog = (msg) => {
    logs.push({ ts: new Date().toISOString(), msg });
    console.log(`[${jobId}] ${msg}`);
  };

  return {
    log(msg) {
      pushLog(msg);
      enqueue({});
    },
    // Kombinierter Progress+Log-Write: ein Roundtrip statt zwei
    step(progressStep, msg) {
      if (msg) pushLog(msg);
      enqueue({ progress_step: progressStep });
    },
    update(patch) {
      enqueue(patch);
    },
    // Finaler Write: Queue leeren, dann garantiert schreiben
    async flushAndUpdate(patch) {
      await queue;
      await supabase.from('transcription_jobs').update({ ...patch, logs }).eq('id', jobId);
    }
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const aiToken = process.env.CLOUDFLARE_AI_TOKEN;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase config missing');
    return { statusCode: 500, body: 'Config error' };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authErrorBody(auth))
    };
  }
  const { user } = auth;

  let jobId, url;
  try {
    ({ jobId, url } = JSON.parse(event.body || '{}'));
  } catch (_) { /* unten abgefangen */ }
  if (!jobId || !url) {
    return { statusCode: 400, body: 'jobId und url erforderlich' };
  }

  // Ownership/Konsistenz: Nur der Ersteller darf SEINEN pending Job starten,
  // und nur mit der URL, die beim Insert hinterlegt wurde. Verhindert das
  // Triggern fremder Jobs und das Unterschieben abweichender URLs.
  const { data: jobRow } = await supabase.from('transcription_jobs')
    .select('id, url, status, created_by').eq('id', jobId).single();
  if (!jobRow) {
    return { statusCode: 404, body: 'Job nicht gefunden' };
  }
  if (jobRow.created_by !== user.id) {
    return { statusCode: 403, body: 'Job gehoert einem anderen Benutzer' };
  }
  if (jobRow.url !== url) {
    return { statusCode: 400, body: 'URL passt nicht zum Job' };
  }
  if (jobRow.status !== 'pending') {
    return { statusCode: 409, body: 'Job wurde bereits gestartet' };
  }

  const job = createJobUpdater(supabase, jobId);
  const startTime = Date.now();
  let browser;

  try {
    const platform = detectPlatform(url);
    if (!isTranscribablePlatform(platform)) {
      throw new Error(`Plattform nicht unterstuetzt: ${platform} (nur TikTok/Instagram)`);
    }

    job.update({ status: 'processing', platform });
    job.step('browser', `Start: ${platform} - ${url}`);
    job.log('Browser mit Stealth Mode starten...');

    // Desktop-UA erzwingen ('other'): Instagram zeigt mit Mobile-UA nur eine
    // "Open Instagram"-Wall ohne Video, TikTok liefert mit Desktop das vollere JSON
    browser = await launchBrowser('other');
    const page = await setupPage(browser, 'other');

    const result = await transcribeVideoOnPage({
      page,
      platform,
      url,
      accountId,
      aiToken,
      onStep: (step, msg) => job.step(step, msg),
      onLog: (msg) => job.log(msg),
      onVideoData: (videoData) => {
        if (videoData.durationSeconds) job.update({ duration_seconds: videoData.durationSeconds });
      },
      releaseBrowser: async () => {
        // Nicht awaiten: Whisper braucht den Browser nicht mehr
        browser?.close().catch(() => {});
        browser = null;
      }
    });

    job.update({ transcript: result.transcript, transcript_source: result.transcriptSource });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    job.log(`Fertig in ${elapsed}s`);
    await job.flushAndUpdate({
      status: 'done',
      progress_step: 'done',
      transcript: result.transcript,
      description: result.description,
      caption: result.caption,
      author_name: result.authorName,
      author_url: result.authorUrl,
      posted_at: result.postedAt,
      likes_count: result.likes,
      comments_count: result.comments,
      shares_count: result.shares,
      saves_count: result.saves,
      transcript_source: result.transcriptSource,
      completed_at: new Date().toISOString()
    });

    return { statusCode: 200 };

  } catch (error) {
    console.error(`[${jobId}] Fehler:`, error.message);
    try {
      job.log(`FEHLER: ${error.message}`);
      await job.flushAndUpdate({
        status: 'error',
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
    } catch (_) { /* Job-Update selbst fehlgeschlagen */ }
    return { statusCode: 500 };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
};
