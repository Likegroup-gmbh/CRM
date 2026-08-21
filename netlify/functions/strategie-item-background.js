// Netlify Background Function: Screenshot + Transkription eines Strategie-Items.
//
// Loest die frueher getrennten Laeufe ab (screenshot.js synchron, Transkription nur
// auf der Testseite). Beides passiert jetzt in EINEM Chromium-Start:
//
//   Page A (Mobile-UA/Viewport) -> Screenshot, sofort gespeichert
//   Page B (Desktop-UA)         -> Video-CDN/Captions -> Whisper -> Llama
//
// Der UA-Konflikt zwingt zu zwei Pages: Instagram zeigt mit Mobile-UA nur die
// "Open Instagram"-Wall ohne Video, die Screenshots sind aber auf das
// Mobile-Layout zugeschnitten.
//
// Fortschritt und Ergebnis landen in strategie_items (Realtime -> Tabelle),
// das Protokoll mit Logs und Engagement-Zahlen in transcription_jobs.

const { detectPlatform, isMobilePlatform, VIEWPORTS } = require('./screenshot-utils/constants');
const { launchBrowser, setupPage } = require('./screenshot-utils/browser-setup');
const { handleInstagramPopups, takeInstagramScreenshot } = require('./screenshot-utils/platform-instagram');
const { handleTikTokPopups, takeTikTokScreenshot } = require('./screenshot-utils/platform-tiktok');
const { handleYouTubeInteraction, takeYouTubeScreenshot } = require('./screenshot-utils/platform-youtube');
const { transcribeVideoOnPage, isTranscribablePlatform, buildNavigateUrl } = require('./_shared/video-transcribe');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { starteKiRequest } = require('./_shared/ki-log');
const { shouldApplyKiBeschreibung } = require('./_shared/ki-beschreibung');

const SCREENSHOT_BUCKET = 'strategie-screenshots';

/**
 * Schreibt Fortschritt auf das Item und sammelt parallel das Log fuer den Job.
 * Zwischenstands-Writes laufen als serielle Queue und blockieren die Pipeline
 * nicht; nur der finale Write wird abgewartet.
 */
function createItemUpdater(supabase, itemId) {
  const logs = [];
  let jobId = null;
  let queue = Promise.resolve();

  const enqueue = (patch) => {
    queue = queue
      .then(() => supabase.from('strategie_items').update(patch).eq('id', itemId))
      .catch((e) => console.error(`[${itemId}] Item-Write fehlgeschlagen:`, e.message));
  };

  const enqueueJob = (patch) => {
    if (!jobId) return;
    const id = jobId;
    queue = queue
      .then(() => supabase.from('transcription_jobs').update({ ...patch, logs }).eq('id', id))
      .catch((e) => console.error(`[${itemId}] Job-Write fehlgeschlagen:`, e.message));
  };

  return {
    get jobId() { return jobId; },
    attachJob(id) { jobId = id; },
    log(msg) {
      logs.push({ ts: new Date().toISOString(), msg });
      console.log(`[${itemId}] ${msg}`);
      enqueueJob({});
    },
    step(verarbeitungStep, msg) {
      if (msg) {
        logs.push({ ts: new Date().toISOString(), msg });
        console.log(`[${itemId}] ${msg}`);
      }
      enqueue({ verarbeitung_step: verarbeitungStep });
      enqueueJob({ progress_step: verarbeitungStep });
    },
    updateItem(patch) {
      enqueue(patch);
    },
    updateJob(patch) {
      enqueueJob(patch);
    },
    async flushItem(patch) {
      await queue;
      await supabase.from('strategie_items').update(patch).eq('id', itemId);
    },
    async flushJob(patch) {
      if (!jobId) { await queue; return; }
      await queue;
      await supabase.from('transcription_jobs').update({ ...patch, logs }).eq('id', jobId);
    }
  };
}

/** Screenshot auf einer eigenen Page mit dem plattformgerechten Viewport. */
async function captureScreenshot(browser, platform, navigateUrl) {
  const page = await setupPage(browser, platform);
  if (isMobilePlatform(platform)) {
    await page.setViewport(VIEWPORTS.mobile);
  }

  try {
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    if (platform === 'instagram') {
      await handleInstagramPopups(page, navigateUrl);
      return (await takeInstagramScreenshot(page)).screenshotBuffer;
    }
    if (platform === 'tiktok') {
      await handleTikTokPopups(page);
      return (await takeTikTokScreenshot(page)).screenshotBuffer;
    }
    if (platform === 'youtube') {
      await handleYouTubeInteraction(page);
      return (await takeYouTubeScreenshot(page)).screenshotBuffer;
    }
    return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
  } finally {
    await page.close().catch(() => {});
  }
}

async function uploadScreenshot(supabase, buffer, platform) {
  const filePath = `screenshots/screenshot-${platform}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(filePath, buffer, { contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);

  const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/** Basis-URL der eigenen Deployment-Umgebung fuer das Self-Chaining. */
function getSiteUrl(event) {
  const fromEnv = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = (event.headers || {}).host;
  return host ? `https://${host}` : null;
}

/**
 * Naechstes offenes Item derselben Strategie anstossen. Begrenzt die Zahl
 * gleichzeitiger Chromium-Instanzen: der Client startet nur die ersten paar
 * Jobs, danach reicht jeder Lauf an den naechsten weiter. Doppelstarts faengt
 * der pending-Guard oben ab.
 */
async function triggerNextPending(supabase, event, strategieId, currentItemId) {
  const siteUrl = getSiteUrl(event);
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization;
  if (!siteUrl || !authHeader) return;

  const { data: next } = await supabase
    .from('strategie_items')
    .select('id')
    .eq('strategie_id', strategieId)
    .eq('verarbeitung_status', 'pending')
    .neq('id', currentItemId)
    .order('sortierung', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return;

  console.log(`[${currentItemId}] Kette weiter zu Item ${next.id}`);
  try {
    await fetch(`${siteUrl}/.netlify/functions/strategie-item-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ itemId: next.id })
    });
  } catch (e) {
    console.error(`[${currentItemId}] Chaining fehlgeschlagen:`, e.message);
  }
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload, event }) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const aiToken = process.env.CLOUDFLARE_AI_TOKEN;

  const { itemId } = payload;
  if (!itemId) {
    return { statusCode: 400, body: 'itemId erforderlich' };
  }

  const { data: item } = await supabase
    .from('strategie_items')
    .select('id, strategie_id, video_link, beschreibung, verarbeitung_status')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) {
    return { statusCode: 404, body: 'Item nicht gefunden' };
  }
  if (!item.video_link) {
    return { statusCode: 400, body: 'Item ohne Video-Link (reine Idee)' };
  }
  if (item.verarbeitung_status !== 'pending') {
    return { statusCode: 409, body: 'Item wird bereits verarbeitet' };
  }

  const url = item.video_link;
  const platform = detectPlatform(url);
  const navigateUrl = buildNavigateUrl(platform, url);
  const tracker = createItemUpdater(supabase, itemId);
  const startTime = Date.now();
  let browser;
  let screenshotError = null;
  let transcriptError = null;

  await supabase.from('strategie_items')
    .update({
      verarbeitung_status: 'processing',
      verarbeitung_step: 'browser',
      verarbeitung_fehler: null,
      plattform: platform
    })
    .eq('id', itemId);

  try {
    tracker.log(`Start: ${platform} - ${url}`);

    // Desktop-Default; die Screenshot-Page bekommt ihren Mobile-Viewport selbst
    browser = await launchBrowser('other');

    // --- Screenshot ---------------------------------------------------------
    tracker.step('screenshot', 'Screenshot aufnehmen...');
    try {
      const buffer = await captureScreenshot(browser, platform, navigateUrl);
      const screenshotUrl = await uploadScreenshot(supabase, buffer, platform);
      tracker.updateItem({ screenshot_url: screenshotUrl });
      tracker.log(`Screenshot gespeichert: ${screenshotUrl}`);
    } catch (e) {
      screenshotError = e.message;
      tracker.log(`Screenshot fehlgeschlagen: ${e.message}`);
    }

    // --- Transkription ------------------------------------------------------
    if (!isTranscribablePlatform(platform)) {
      tracker.log(`Keine Transkription fuer ${platform} - nur Screenshot`);
      await tracker.flushItem({
        verarbeitung_status: screenshotError ? 'error' : 'done',
        verarbeitung_step: 'done',
        verarbeitung_fehler: screenshotError
      });
      await triggerNextPending(supabase, event, item.strategie_id, itemId);
      return { statusCode: 200 };
    }

    const { data: job } = await supabase
      .from('transcription_jobs')
      .insert({
        url,
        platform,
        status: 'processing',
        strategie_item_id: itemId,
        created_by: user.id
      })
      .select('id')
      .single();
    if (job) {
      tracker.attachJob(job.id);
      tracker.updateItem({ transcription_job_id: job.id });
    }

    // KI-Aufrufe (Whisper/Llama) zaehlen: Frequenz-Limit + Protokoll-Zeile.
    // Bei Limit das Item offen lassen und die Kette stoppen - spaeter
    // erneut startbar, statt jedes Glied ins Limit laufen zu lassen.
    let ki = null;
    try {
      ki = await starteKiRequest(supabase, { userId: user.id, feature: 'strategie_item' });
    } catch (e) {
      if (e.name === 'KiLimitError') {
        tracker.log(`Frequenz-Limit: ${e.message}`);
        await tracker.flushItem({
          verarbeitung_status: 'pending',
          verarbeitung_step: null,
          verarbeitung_fehler: e.message
        });
        return { statusCode: 429, body: e.message };
      }
      throw e;
    }

    try {
      const result = await transcribeVideoOnPage({
        page: await setupPage(browser, 'other'),
        platform,
        url,
        accountId,
        aiToken,
        onStep: (step, msg) => tracker.step(step, msg),
        onLog: (msg) => tracker.log(msg),
        onVideoData: (videoData) => {
          if (videoData.durationSeconds) tracker.updateJob({ duration_seconds: videoData.durationSeconds });
        },
        releaseBrowser: async () => {
          browser?.close().catch(() => {});
          browser = null;
        }
      });
      await ki.abschliessen({ model: 'cloudflare-whisper-llama' });

      tracker.updateItem({
        transkript: result.transcript,
        transkript_quelle: result.transcriptSource,
        caption: result.caption
      });

      // Vorhandene Beschreibungen bleiben unangetastet - die KI-Fassung steht
      // weiterhin im Job. Frischer Read, falls zwischendurch jemand getippt hat.
      if (result.description) {
        const { data: current } = await supabase
          .from('strategie_items')
          .select('beschreibung')
          .eq('id', itemId)
          .maybeSingle();
        if (shouldApplyKiBeschreibung(current?.beschreibung)) {
          const { error: descError } = await supabase
            .from('strategie_items')
            .update({ beschreibung: result.description, beschreibung_quelle: 'ki' })
            .eq('id', itemId);
          if (descError) tracker.log(`Beschreibung nicht uebernommen: ${descError.message}`);
        }
      }

      await tracker.flushJob({
        status: 'done',
        progress_step: 'done',
        transcript: result.transcript,
        transcript_source: result.transcriptSource,
        description: result.description,
        caption: result.caption,
        author_name: result.authorName,
        author_url: result.authorUrl,
        posted_at: result.postedAt,
        likes_count: result.likes,
        comments_count: result.comments,
        shares_count: result.shares,
        saves_count: result.saves,
        duration_seconds: result.durationSeconds,
        completed_at: new Date().toISOString()
      });
    } catch (e) {
      transcriptError = e.message;
      tracker.log(`FEHLER Transkription: ${e.message}`);
      await ki.fehlgeschlagen(e);
      await tracker.flushJob({
        status: 'error',
        error_message: e.message,
        completed_at: new Date().toISOString()
      });
    }

    const fehler = [
      screenshotError ? `Screenshot: ${screenshotError}` : null,
      transcriptError ? `Transkript: ${transcriptError}` : null
    ].filter(Boolean).join(' | ') || null;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${itemId}] Fertig in ${elapsed}s${fehler ? ` (${fehler})` : ''}`);

    await tracker.flushItem({
      verarbeitung_status: fehler ? 'error' : 'done',
      verarbeitung_step: 'done',
      verarbeitung_fehler: fehler
    });

    await triggerNextPending(supabase, event, item.strategie_id, itemId);
    return { statusCode: 200 };

  } catch (error) {
    console.error(`[${itemId}] Fehler:`, error.message);
    try {
      await tracker.flushItem({
        verarbeitung_status: 'error',
        verarbeitung_step: 'done',
        verarbeitung_fehler: error.message
      });
      await tracker.flushJob({
        status: 'error',
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
    } catch (_) { /* Fehler-Update selbst fehlgeschlagen */ }
    await triggerNextPending(supabase, event, item.strategie_id, itemId);
    return { statusCode: 500 };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
});
