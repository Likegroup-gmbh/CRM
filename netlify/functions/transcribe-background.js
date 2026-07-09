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
 */
function createJobUpdater(supabase, jobId) {
  const logs = [];
  return {
    async log(msg) {
      const entry = { ts: new Date().toISOString(), msg };
      logs.push(entry);
      console.log(`[${jobId}] ${msg}`);
      await supabase.from('transcription_jobs').update({ logs }).eq('id', jobId);
    },
    async update(patch) {
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

  try {
    if (!accountId || !aiToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN nicht gesetzt (Netlify Env-Vars)');
    }

    const platform = detectPlatform(url);
    if (platform !== 'tiktok' && platform !== 'instagram') {
      throw new Error(`Plattform nicht unterstuetzt: ${platform} (nur TikTok/Instagram)`);
    }

    await job.update({ status: 'processing', platform, progress_step: 'browser' });
    await job.log(`Start: ${platform} - ${url}`);
    await job.log('Browser mit Stealth Mode starten...');

    // Desktop-UA erzwingen ('other'): Instagram zeigt mit Mobile-UA nur eine
    // "Open Instagram"-Wall ohne Video, TikTok liefert mit Desktop das vollere JSON
    browser = await launchBrowser('other');
    const page = await setupPage(browser, 'other');
    const mediaUrls = createMediaUrlCollector(page);

    // Instagram /p/ -> /reels/ (wie in screenshot.js)
    let navigateUrl = url;
    if (platform === 'instagram' && url.includes('/p/')) {
      navigateUrl = url.replace(/\/p\//, '/reels/').split('?')[0];
      await job.log(`Instagram /p/ -> /reels/: ${navigateUrl}`);
    }

    await job.update({ progress_step: 'navigation' });
    await job.log('Seite laden...');
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let videoData;
    if (platform === 'tiktok') {
      await handleTikTokPopups(page);
      videoData = await extractTikTokVideoData(page);
    } else {
      await handleInstagramPopups(page, navigateUrl);
      // Video anspielen, damit die CDN-Requests im Netzwerk auftauchen
      await page.evaluate(() => document.querySelector('video')?.play()?.catch(() => {}));
      await new Promise(r => setTimeout(r, 4000));
      videoData = await extractInstagramVideoData(page, mediaUrls);
    }

    if (videoData.error) throw new Error(videoData.error);
    if (videoData.durationSeconds) {
      await job.update({ duration_seconds: videoData.durationSeconds });
    }

    let transcript = null;
    let transcriptSource = 'whisper';

    // TikTok-Shortcut: native Auto-Captions vorhanden -> Whisper ueberspringen
    if (videoData.subtitle?.url) {
      await job.update({ progress_step: 'captions' });
      await job.log(`Native TikTok-Captions gefunden (${videoData.subtitle.lang || 'unbekannt'}), lade Untertitel...`);
      try {
        transcript = await downloadSubtitleText(page, videoData.subtitle.url);
        transcriptSource = 'native_captions';
        await job.log(`Captions geladen: ${transcript.length} Zeichen`);
      } catch (e) {
        await job.log(`Caption-Download fehlgeschlagen (${e.message}), Fallback auf Whisper`);
        transcript = null;
      }
    }

    if (!transcript) {
      if (!videoData.videoUrl) {
        throw new Error('Keine Video-CDN-URL gefunden (Login-Wall oder Block?)');
      }
      await job.update({ progress_step: 'download' });
      await job.log('Video von CDN laden (nur in Memory, keine Datei)...');
      const videoBuffer = await downloadVideoBuffer(page, videoData.videoUrl, navigateUrl);
      await job.log(`Video geladen: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

      // Browser frueh schliessen - ab hier nur noch API-Calls
      await browser.close();
      browser = null;

      await job.update({ progress_step: 'whisper' });
      await job.log('Whisper-Transkription (Cloudflare Workers AI)...');
      transcript = await runWhisper(videoBuffer, accountId, aiToken);
      await job.log(`Transkript: ${transcript.length} Zeichen`);
    } else if (browser) {
      await browser.close();
      browser = null;
    }

    if (!transcript) {
      throw new Error('Transkript ist leer (Video ohne Sprache?)');
    }

    await job.update({ progress_step: 'description', transcript, transcript_source: transcriptSource });
    await job.log('Beschreibung generieren (Llama 3.1)...');
    const description = await runDescription(transcript, videoData.caption, accountId, aiToken);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    await job.log(`Fertig in ${elapsed}s`);
    await job.update({
      status: 'done',
      progress_step: 'done',
      transcript,
      description,
      caption: videoData.caption || null,
      transcript_source: transcriptSource,
      completed_at: new Date().toISOString()
    });

    return { statusCode: 200 };

  } catch (error) {
    console.error(`[${jobId}] Fehler:`, error.message);
    try {
      await job.log(`FEHLER: ${error.message}`);
      await job.update({
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
