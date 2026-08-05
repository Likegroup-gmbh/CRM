// Gemeinsame Transkriptions-Pipeline fuer TikTok/Instagram-Videos.
//
// Genutzt von:
//   transcribe-background.js       (Testseite /transcribe + Skript-Generator)
//   strategie-item-background.js   (Strategie-Items, dort zusammen mit dem Screenshot)
//
// Ablauf: Seite laden -> Video-CDN-URL bzw. native Captions abgreifen ->
// Whisper (nur wenn noetig) -> Llama-Beschreibung. Es wird nichts auf Platte
// geschrieben, der Video-Buffer lebt ausschliesslich im RAM des Aufrufs.

const { handleInstagramPopups } = require('../screenshot-utils/platform-instagram');
const { handleTikTokPopups } = require('../screenshot-utils/platform-tiktok');
const {
  createMediaUrlCollector,
  extractTikTokVideoData,
  extractInstagramVideoData,
  downloadVideoBuffer,
  downloadSubtitleText
} = require('../screenshot-utils/video-interceptor');

const CF_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/** Plattformen, fuer die eine Tonspur bzw. Untertitel erreichbar sind. */
const TRANSCRIBABLE_PLATFORMS = Object.freeze(['tiktok', 'instagram']);

function isTranscribablePlatform(platform) {
  return TRANSCRIBABLE_PLATFORMS.includes(platform);
}

/**
 * Instagram blockiert /p/ fuer nicht eingeloggte Besucher, /reels/ nicht.
 */
function buildNavigateUrl(platform, url) {
  if (platform === 'instagram' && url.includes('/p/')) {
    return url.replace(/\/p\//, '/reels/').split('?')[0];
  }
  return url;
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

/**
 * Seite laden und Video-Metadaten einsammeln. Der Media-Collector wird an genau
 * diese Page gehaengt und muss vor der Navigation stehen - bei einem Browser mit
 * mehreren Pages (Screenshot + Transkript) faengt er sonst fremde Requests mit ab.
 *
 * @returns {Promise<Object>} videoData inkl. videoUrl, caption, subtitle, Metriken
 */
async function collectVideoData({ page, platform, navigateUrl, onStep = () => {}, onLog = () => {} }) {
  const mediaUrls = createMediaUrlCollector(page);

  onStep('navigation', 'Seite laden...');
  await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (platform === 'tiktok') {
    await handleTikTokPopups(page);
    return await extractTikTokVideoData(page);
  }

  await handleInstagramPopups(page, navigateUrl);
  // Video anspielen, damit die CDN-Requests im Netzwerk auftauchen. Adaptiv statt
  // fixer 4s: sobald eine Audio-Spur da ist, geht es weiter (4s bleiben Maximum).
  await page.evaluate(() => document.querySelector('video')?.play()?.catch(() => {}));
  const waitStart = Date.now();
  while (Date.now() - waitStart < 4000) {
    const hasAudio = mediaUrls.some(m =>
      (m.tag && m.tag.includes('audio')) || m.contentType.startsWith('audio/')
    );
    if (hasAudio) break;
    await new Promise(r => setTimeout(r, 300));
  }
  onLog(`Media-Spuren gefunden: ${mediaUrls.length}`);
  return await extractInstagramVideoData(page, mediaUrls);
}

/**
 * Kompletter Lauf auf einer bereits eingerichteten Puppeteer-Page.
 *
 * @param {Object}   opts
 * @param {Object}   opts.page             Page mit Desktop-User-Agent
 * @param {string}   opts.platform         'tiktok' | 'instagram'
 * @param {string}   opts.url              Original-URL des Videos
 * @param {string}   opts.accountId        Cloudflare Account
 * @param {string}   opts.aiToken          Cloudflare AI Token
 * @param {Function} [opts.onStep]         (step, message) fuer den Fortschritt
 * @param {Function} [opts.onLog]          (message) fuer reine Log-Zeilen
 * @param {Function} [opts.onVideoData]    (videoData) sobald die Metadaten stehen
 * @param {Function} [opts.releaseBrowser] Wird aufgerufen, sobald der Browser nicht
 *                                         mehr gebraucht wird (Whisper laeuft remote)
 */
async function transcribeVideoOnPage({
  page,
  platform,
  url,
  accountId,
  aiToken,
  onStep = () => {},
  onLog = () => {},
  onVideoData = () => {},
  releaseBrowser = null
}) {
  if (!accountId || !aiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN nicht gesetzt (Netlify Env-Vars)');
  }
  if (!isTranscribablePlatform(platform)) {
    throw new Error(`Plattform nicht unterstuetzt: ${platform} (nur TikTok/Instagram)`);
  }

  const navigateUrl = buildNavigateUrl(platform, url);
  if (navigateUrl !== url) onLog(`Instagram /p/ -> /reels/: ${navigateUrl}`);

  const videoData = await collectVideoData({ page, platform, navigateUrl, onStep, onLog });
  if (videoData.error) throw new Error(videoData.error);
  onVideoData(videoData);

  let transcript = null;
  let transcriptSource = 'whisper';

  // TikTok-Shortcut: native Auto-Captions vorhanden -> Whisper ueberspringen
  if (videoData.subtitle?.url) {
    onStep('captions', `Native TikTok-Captions gefunden (${videoData.subtitle.lang || 'unbekannt'}), lade Untertitel...`);
    try {
      transcript = await downloadSubtitleText(page, videoData.subtitle.url);
      transcriptSource = 'native_captions';
      onLog(`Captions geladen: ${transcript.length} Zeichen`);
    } catch (e) {
      onLog(`Caption-Download fehlgeschlagen (${e.message}), Fallback auf Whisper`);
      transcript = null;
    }
  }

  if (!transcript) {
    if (!videoData.videoUrl) {
      throw new Error('Keine Video-CDN-URL gefunden (Login-Wall oder Block?)');
    }
    onStep('download', 'Video von CDN laden (nur in Memory, keine Datei)...');
    const videoBuffer = await downloadVideoBuffer(page, videoData.videoUrl, navigateUrl);
    onLog(`Video geladen: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    // Ab hier arbeitet nur noch Cloudflare - der Browser darf weg
    if (releaseBrowser) await releaseBrowser();

    onStep('whisper', 'Whisper-Transkription (Cloudflare Workers AI)...');
    transcript = await runWhisper(videoBuffer, accountId, aiToken);
    onLog(`Transkript: ${transcript.length} Zeichen`);
  } else if (releaseBrowser) {
    await releaseBrowser();
  }

  if (!transcript) {
    throw new Error('Transkript ist leer (Video ohne Sprache?)');
  }

  onStep('description', 'Beschreibung generieren (Llama 3.1)...');
  const description = await runDescription(transcript, videoData.caption, accountId, aiToken);

  return {
    transcript,
    transcriptSource,
    description,
    caption: videoData.caption || null,
    authorName: videoData.authorName || null,
    authorUrl: videoData.authorUrl || null,
    postedAt: videoData.postedAt || null,
    likes: videoData.likes ?? null,
    comments: videoData.comments ?? null,
    shares: videoData.shares ?? null,
    saves: videoData.saves ?? null,
    durationSeconds: videoData.durationSeconds ?? null
  };
}

module.exports = {
  TRANSCRIBABLE_PLATFORMS,
  isTranscribablePlatform,
  buildNavigateUrl,
  collectVideoData,
  transcribeVideoOnPage,
  runWhisper,
  runDescription
};
