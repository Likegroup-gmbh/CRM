// Netlify Background Function: Video-Transkription via Cloudflare Workers AI
// Ablauf: Puppeteer -> Video-CDN-URL abfangen -> Video in Memory laden ->
//         Cloudflare Whisper (Transkript) -> Cloudflare Llama (Beschreibung) -> Supabase.
// Background Function (Suffix "-background"): antwortet sofort 202, Ergebnis kommt
// asynchron ueber die transcription_jobs-Tabelle (Realtime in der UI).
// Es werden KEINE Dateien gespeichert - Video-Buffer lebt nur im RAM dieses Aufrufs.

const { createClient } = require('@supabase/supabase-js');
const { detectPlatform } = require('./screenshot-utils/constants');
const { launchBrowser, setupPage } = require('./screenshot-utils/browser-setup');
const { handleInstagramPopups } = require('./screenshot-utils/platform-instagram');
const { handleTikTokPopups } = require('./screenshot-utils/platform-tiktok');
const {
  createMediaUrlCollector,
  extractTikTokVideoData,
  extractInstagramVideoData,
  downloadVideoBuffer,
  downloadSubtitleText
} = require('./screenshot-utils/video-interceptor');

const CF_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

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

async function runWhisper(videoBuffer, accountId, aiToken) {
  const base64Audio = videoBuffer.toString('base64');
  const res = await fetch(`${CF_API_BASE}/${accountId}/ai/run/${WHISPER_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ audio: base64Audio })
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    const errMsg = (json.errors || []).map(e => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Whisper fehlgeschlagen: ${errMsg}`);
  }
  return (json.result?.text || '').trim();
}

async function runDescription(transcript, caption, accountId, aiToken) {
  const contextParts = [];
  if (caption) contextParts.push(`Video-Caption: "${caption}"`);
  contextParts.push(`Transkript:\n${transcript}`);

  const res = await fetch(`${CF_API_BASE}/${accountId}/ai/run/${LLM_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Assistent einer Influencer-Marketing-Agentur. Erstelle eine praegnante deutsche Beschreibung (2-4 Saetze) des Videoinhalts basierend auf Transkript und Caption. Beschreibe Thema, Kernaussage und Stil des Videos. Antworte NUR mit der Beschreibung, ohne Einleitung.'
        },
        { role: 'user', content: contextParts.join('\n\n') }
      ],
      max_tokens: 512
    })
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    const errMsg = (json.errors || []).map(e => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Beschreibung fehlgeschlagen: ${errMsg}`);
  }
  return (json.result?.response || '').trim();
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

  const user = await verifyAuth(event, supabase);
  if (!user) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let jobId, url;
  try {
    ({ jobId, url } = JSON.parse(event.body || '{}'));
  } catch (_) { /* unten abgefangen */ }
  if (!jobId || !url) {
    return { statusCode: 400, body: 'jobId und url erforderlich' };
  }

  const job = createJobUpdater(supabase, jobId);
  const startTime = Date.now();
  let browser;

  // Step-Timing fuer Bottleneck-Diagnose (Breakdown landet im finalen Log)
  const stepTimings = [];
  let lastStepName = null;
  let lastStepStart = startTime;
  const markStep = (name) => {
    const now = Date.now();
    if (lastStepName) {
      stepTimings.push(`${lastStepName} ${((now - lastStepStart) / 1000).toFixed(1)}s`);
    }
    lastStepName = name;
    lastStepStart = now;
  };

  try {
    if (!accountId || !aiToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN nicht gesetzt (Netlify Env-Vars)');
    }

    const platform = detectPlatform(url);
    if (platform !== 'tiktok' && platform !== 'instagram') {
      throw new Error(`Plattform nicht unterstuetzt: ${platform} (nur TikTok/Instagram)`);
    }

    job.update({ status: 'processing', platform });
    job.step('browser', `Start: ${platform} - ${url}`);
    job.log('Browser mit Stealth Mode starten...');
    markStep('browser');

    // Desktop-UA erzwingen ('other'): Instagram zeigt mit Mobile-UA nur eine
    // "Open Instagram"-Wall ohne Video, TikTok liefert mit Desktop das vollere JSON
    browser = await launchBrowser('other');
    const page = await setupPage(browser, 'other');
    const mediaUrls = createMediaUrlCollector(page);

    // Instagram /p/ -> /reels/ (wie in screenshot.js)
    let navigateUrl = url;
    if (platform === 'instagram' && url.includes('/p/')) {
      navigateUrl = url.replace(/\/p\//, '/reels/').split('?')[0];
      job.log(`Instagram /p/ -> /reels/: ${navigateUrl}`);
    }

    job.step('navigation', 'Seite laden...');
    markStep('navigation');
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let videoData;
    if (platform === 'tiktok') {
      await handleTikTokPopups(page);
      videoData = await extractTikTokVideoData(page);
    } else {
      await handleInstagramPopups(page, navigateUrl);
      // Video anspielen, damit die CDN-Requests im Netzwerk auftauchen.
      // Adaptiv statt fixer 4s: sobald eine Audio-Spur im Netzwerk auftaucht,
      // geht es sofort weiter (4s bleiben als Maximum - worst case wie vorher).
      await page.evaluate(() => document.querySelector('video')?.play()?.catch(() => {}));
      const waitStart = Date.now();
      while (Date.now() - waitStart < 4000) {
        const hasAudio = mediaUrls.some(m =>
          (m.tag && m.tag.includes('audio')) || m.contentType.startsWith('audio/')
        );
        if (hasAudio) break;
        await new Promise(r => setTimeout(r, 300));
      }
      videoData = await extractInstagramVideoData(page, mediaUrls);
    }

    if (videoData.error) throw new Error(videoData.error);
    if (videoData.durationSeconds) {
      job.update({ duration_seconds: videoData.durationSeconds });
    }

    let transcript = null;
    let transcriptSource = 'whisper';

    // TikTok-Shortcut: native Auto-Captions vorhanden -> Whisper ueberspringen
    if (videoData.subtitle?.url) {
      job.step('captions', `Native TikTok-Captions gefunden (${videoData.subtitle.lang || 'unbekannt'}), lade Untertitel...`);
      markStep('captions');
      try {
        transcript = await downloadSubtitleText(page, videoData.subtitle.url);
        transcriptSource = 'native_captions';
        job.log(`Captions geladen: ${transcript.length} Zeichen`);
      } catch (e) {
        job.log(`Caption-Download fehlgeschlagen (${e.message}), Fallback auf Whisper`);
        transcript = null;
      }
    }

    if (!transcript) {
      if (!videoData.videoUrl) {
        throw new Error('Keine Video-CDN-URL gefunden (Login-Wall oder Block?)');
      }
      job.step('download', 'Video von CDN laden (nur in Memory, keine Datei)...');
      markStep('download');
      const videoBuffer = await downloadVideoBuffer(page, videoData.videoUrl, navigateUrl);
      job.log(`Video geladen: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

      // Browser frueh schliessen - nicht awaiten, Whisper braucht ihn nicht mehr
      browser.close().catch(() => {});
      browser = null;

      job.step('whisper', 'Whisper-Transkription (Cloudflare Workers AI)...');
      markStep('whisper');
      transcript = await runWhisper(videoBuffer, accountId, aiToken);
      job.log(`Transkript: ${transcript.length} Zeichen`);
    } else if (browser) {
      browser.close().catch(() => {});
      browser = null;
    }

    if (!transcript) {
      throw new Error('Transkript ist leer (Video ohne Sprache?)');
    }

    job.update({ transcript, transcript_source: transcriptSource });
    job.step('description', 'Beschreibung generieren (Llama 3.1)...');
    markStep('description');
    const description = await runDescription(transcript, videoData.caption, accountId, aiToken);
    markStep(null);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    job.log(`Fertig in ${elapsed}s (${stepTimings.join(', ')})`);
    await job.flushAndUpdate({
      status: 'done',
      progress_step: 'done',
      transcript,
      description,
      caption: videoData.caption || null,
      author_name: videoData.authorName || null,
      author_url: videoData.authorUrl || null,
      posted_at: videoData.postedAt || null,
      likes_count: videoData.likes ?? null,
      comments_count: videoData.comments ?? null,
      shares_count: videoData.shares ?? null,
      saves_count: videoData.saves ?? null,
      transcript_source: transcriptSource,
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
