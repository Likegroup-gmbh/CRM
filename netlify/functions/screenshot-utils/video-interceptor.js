/**
 * Video-Interceptor: Extrahiert Video-CDN-URLs (+ Metadaten) aus TikTok/Instagram-Seiten.
 * Wird von transcribe-background.js genutzt, kann später auch screenshot.js erweitern.
 *
 * Strategie:
 * - TikTok: __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON parsen (playAddr, subtitleInfos, duration)
 * - Instagram: Netzwerk-Responses beobachten (.mp4-CDN-URLs) + DOM-Fallback
 * - Download läuft node-seitig mit den Session-Cookies aus Puppeteer (CDNs verlangen sie teils)
 */

const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // 80MB Schutz gegen Riesen-Dateien

/**
 * Muss VOR page.goto() aufgerufen werden.
 * Sammelt Media-CDN-URLs aus Netzwerk-Responses (v.a. für Instagram nötig).
 * Instagram (DASH): getrennte Video-/Audio-Spuren; der efg-Query-Param (Base64-JSON)
 * verrät Track-Typ (vencode_tag), Bitrate und Dauer.
 */
function createMediaUrlCollector(page) {
  const mediaUrls = [];
  page.on('response', (response) => {
    try {
      const url = response.url();
      const contentType = (response.headers()['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('video/') && !contentType.startsWith('audio/')) return;
      if (url.startsWith('blob:')) return;

      let tag = null, bitrate = null, durationSeconds = null;
      try {
        const efg = new URL(url).searchParams.get('efg');
        if (efg) {
          const meta = JSON.parse(Buffer.from(efg, 'base64').toString('utf8'));
          tag = meta.vencode_tag || null;
          bitrate = meta.bitrate || null;
          durationSeconds = meta.duration_s || null;
        }
      } catch (_) { /* kein/kaputtes efg -> egal */ }

      mediaUrls.push({ url, contentType, tag, bitrate, durationSeconds, ts: Date.now() });
    } catch (_) { /* Response evtl. schon disposed */ }
  });
  return mediaUrls;
}

/**
 * TikTok: Video-Daten aus dem Rehydration-JSON der Seite ziehen.
 * Liefert playAddr, Dauer, Caption und (falls vorhanden) native Untertitel-Infos.
 */
async function extractTikTokVideoData(page) {
  return await page.evaluate(() => {
    try {
      const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!script) return { error: 'Rehydration-Script nicht gefunden' };

      const data = JSON.parse(script.textContent);
      const scope = data['__DEFAULT_SCOPE__'] || {};
      // Desktop-UA: webapp.video-detail | Mobile-UA: webapp.reflow.video.detail
      const detail = scope['webapp.video-detail'] || scope['webapp.reflow.video.detail'];
      const item = detail?.itemInfo?.itemStruct;
      if (!item) return { error: 'itemStruct nicht gefunden (Login-Wall oder Region-Block?)' };

      const video = item.video || {};

      // Native Auto-Captions: ASR = Originalsprache (kein MT/Übersetzung)
      let subtitle = null;
      const subs = video.subtitleInfos || [];
      const asr = subs.find(s => (s.Source || s.source) === 'ASR' && (s.Url || s.url));
      if (asr) {
        subtitle = {
          url: asr.Url || asr.url,
          lang: asr.LanguageCodeName || asr.languageCodeName || null,
          format: asr.Format || asr.format || 'webvtt'
        };
      }

      return {
        videoUrl: video.playAddr || video.downloadAddr || null,
        durationSeconds: video.duration || null,
        caption: item.desc || null,
        author: item.author?.uniqueId || null,
        subtitle
      };
    } catch (e) {
      return { error: `TikTok-Parsing fehlgeschlagen: ${e.message}` };
    }
  });
}

/**
 * Entfernt Range-Parameter (bytestart/byteend), damit der Fetch die komplette Datei liefert.
 */
function stripRangeParams(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('bytestart');
    parsed.searchParams.delete('byteend');
    return parsed.toString();
  } catch (_) { return url; }
}

/**
 * Instagram og:description enthaelt oft Boilerplate wie
 * '123 likes, 4 comments - user on July 1, 2026: "eigentliche Caption"'.
 * Extrahiert den reinen Caption-Teil, Fallback auf den Rohtext.
 */
function cleanInstagramCaption(raw) {
  if (!raw) return null;
  const text = raw.trim();
  const hasBoilerplate = /likes|comments|gef[aä]llt|kommentare/i.test(text.split(':')[0] || '');
  if (hasBoilerplate) {
    const match = text.match(/:\s*["\u201E\u201C](.+)["\u201C\u201D]\s*$/s);
    if (match) return match[1].trim();
  }
  return text;
}

/**
 * Instagram: Media-URL aus gesammelten Netzwerk-Responses + DOM.
 *
 * WICHTIG: Instagram streamt Reels als DASH mit GETRENNTEN Video-/Audio-Spuren.
 * Die Video-Spuren enthalten keinen Ton! Fuer Whisper nehmen wir daher gezielt
 * die Audio-Spur (vencode_tag enthaelt "audio") - die ist zudem winzig (~50kbit/s).
 */
async function extractInstagramVideoData(page, mediaUrls) {
  const domData = await page.evaluate(() => {
    let caption = null;
    const meta = document.querySelector('meta[property="og:description"]') ||
                 document.querySelector('meta[name="description"]');
    if (meta) caption = meta.getAttribute('content');

    let durationSeconds = null;
    const video = document.querySelector('video');
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      durationSeconds = video.duration;
    }
    // Progressive MP4 (mit Ton) nur falls keine blob:-URL
    let domVideoUrl = null;
    if (video?.src && !video.src.startsWith('blob:')) domVideoUrl = video.src;

    return { caption, durationSeconds, domVideoUrl };
  });

  // 1. Wahl: DASH-Audio-Spur (klein + enthaelt die Sprache)
  const audioTrack = mediaUrls.find(m =>
    (m.tag && m.tag.includes('audio')) || m.contentType.startsWith('audio/')
  );

  // 2. Wahl: progressive MP4 aus dem DOM (enthaelt Ton)
  // 3. Wahl: Video-Spur mit niedrigster Bitrate (kann tonlos sein - letzter Strohhalm)
  let videoUrl = null;
  if (audioTrack) {
    videoUrl = stripRangeParams(audioTrack.url);
  } else if (domData.domVideoUrl) {
    videoUrl = stripRangeParams(domData.domVideoUrl);
  } else {
    const videoTracks = mediaUrls
      .filter(m => m.contentType.startsWith('video/'))
      .sort((a, b) => (a.bitrate || Infinity) - (b.bitrate || Infinity));
    if (videoTracks.length > 0) videoUrl = stripRangeParams(videoTracks[0].url);
  }

  const durationSeconds = domData.durationSeconds ||
    audioTrack?.durationSeconds ||
    mediaUrls.find(m => m.durationSeconds)?.durationSeconds ||
    null;

  return {
    videoUrl,
    isAudioOnly: !!audioTrack,
    durationSeconds,
    caption: cleanInstagramCaption(domData.caption),
    subtitle: null // Instagram hat keine abrufbaren Untertitel-Streams (Hardsubs)
  };
}

/**
 * Lädt das Video node-seitig herunter – mit Cookies + User-Agent aus der Puppeteer-Session,
 * weil TikTok/IG-CDNs Requests ohne Session-Kontext teils mit 403 beantworten.
 * Es wird NICHTS auf Platte geschrieben – Buffer bleibt im Speicher und wird danach verworfen.
 */
async function downloadVideoBuffer(page, videoUrl, referer) {
  const cookies = await page.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const userAgent = await page.evaluate(() => navigator.userAgent);

  const res = await fetch(videoUrl, {
    headers: {
      'User-Agent': userAgent,
      'Cookie': cookieHeader,
      'Referer': referer || videoUrl,
      'Accept': '*/*',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  });

  if (!res.ok) {
    throw new Error(`Video-Download fehlgeschlagen: HTTP ${res.status}`);
  }

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_VIDEO_BYTES) {
    throw new Error(`Video zu groß (${Math.round(contentLength / 1024 / 1024)}MB > 80MB)`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`Video zu groß (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB > 80MB)`);
  }
  if (arrayBuffer.byteLength < 10 * 1024) {
    throw new Error(`Video-Response verdächtig klein (${arrayBuffer.byteLength} Bytes) – vermutlich geblockt`);
  }

  return Buffer.from(arrayBuffer);
}

/**
 * Lädt eine TikTok-Untertitel-Datei (WebVTT) und wandelt sie in Klartext um.
 */
async function downloadSubtitleText(page, subtitleUrl) {
  const cookies = await page.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const userAgent = await page.evaluate(() => navigator.userAgent);

  const res = await fetch(subtitleUrl, {
    headers: { 'User-Agent': userAgent, 'Cookie': cookieHeader, 'Accept': '*/*' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`Untertitel-Download fehlgeschlagen: HTTP ${res.status}`);

  const vtt = await res.text();
  return vttToPlainText(vtt);
}

/**
 * WebVTT -> Klartext: Header, Timestamps und Duplikate entfernen.
 */
function vttToPlainText(vtt) {
  const lines = vtt.split(/\r?\n/);
  const textLines = [];
  let lastLine = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) continue;
    if (/-->/.test(trimmed)) continue;           // Timestamp-Zeile
    if (/^\d+$/.test(trimmed)) continue;          // Cue-Nummer
    if (trimmed === lastLine) continue;           // Rolling-Caption-Duplikate
    textLines.push(trimmed);
    lastLine = trimmed;
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  createMediaUrlCollector,
  extractTikTokVideoData,
  extractInstagramVideoData,
  downloadVideoBuffer,
  downloadSubtitleText,
  vttToPlainText,
  MAX_VIDEO_BYTES
};
