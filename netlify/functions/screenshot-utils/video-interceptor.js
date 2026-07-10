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

      // statsV2 liefert Strings, stats Zahlen - beide via Number() normalisieren
      const toCount = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const stats = item.statsV2 || item.stats || {};
      const uniqueId = item.author?.uniqueId || null;
      const createTime = Number(item.createTime);

      return {
        videoUrl: video.playAddr || video.downloadAddr || null,
        durationSeconds: video.duration || null,
        caption: item.desc || null,
        author: uniqueId,
        authorName: item.author?.nickname || uniqueId,
        authorUrl: uniqueId ? `https://www.tiktok.com/@${uniqueId}` : null,
        postedAt: Number.isFinite(createTime) && createTime > 0
          ? new Date(createTime * 1000).toISOString()
          : null,
        likes: toCount(stats.diggCount),
        comments: toCount(stats.commentCount),
        shares: toCount(stats.shareCount),
        saves: toCount(stats.collectCount),
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
 * "1,071" / "1.071" / "10.5K" / "1,2 Mio." -> Zahl (oder null).
 */
function parseCount(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const match = text.match(/^([\d.,\s]+)\s*(K|M|Mio\.?|Mrd\.?|B)?$/i);
  if (!match) return null;

  let numPart = match[1].replace(/\s/g, '');
  const suffix = (match[2] || '').toLowerCase();

  if (suffix) {
    // Bei Suffix ist der Punkt/Komma ein Dezimaltrenner: "10.5K" / "1,2 Mio."
    numPart = numPart.replace(',', '.');
  } else {
    // Ohne Suffix sind Punkt/Komma Tausendertrenner: "1,071" / "1.071"
    numPart = numPart.replace(/[.,]/g, '');
  }

  const num = parseFloat(numPart);
  if (!Number.isFinite(num)) return null;

  const factor =
    suffix === 'k' ? 1e3 :
    (suffix === 'm' || suffix.startsWith('mio')) ? 1e6 :
    (suffix === 'b' || suffix.startsWith('mrd')) ? 1e9 : 1;

  return Math.round(num * factor);
}

const MONTHS = {
  'januar': 0, 'februar': 1, 'märz': 2, 'maerz': 2, 'mai': 4, 'juni': 5,
  'juli': 6, 'oktober': 9, 'dezember': 11,
  'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
  'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
};

/**
 * "June 28, 2026" (EN) oder "28. Juni 2026" (DE) -> ISO-String in UTC (oder null).
 */
function parseInstagramDate(raw) {
  if (!raw) return null;
  const text = raw.trim();

  // Deutsch: "28. Juni 2026" | Englisch: "June 28, 2026"
  const de = text.match(/^(\d{1,2})\.?\s+([A-Za-zÄäÖöÜüß]+)\s+(\d{4})$/);
  const en = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  const parts = de
    ? { day: de[1], monthName: de[2], year: de[3] }
    : en ? { day: en[2], monthName: en[1], year: en[3] } : null;

  if (parts) {
    const month = MONTHS[parts.monthName.toLowerCase()];
    if (month !== undefined) {
      const date = new Date(Date.UTC(parseInt(parts.year, 10), month, parseInt(parts.day, 10)));
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  // Letzter Versuch: nativ parsebar
  const fallback = new Date(text);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

const EMPTY_IG_META = {
  caption: null, likes: null, comments: null,
  authorName: null, authorUrl: null, postedAt: null
};

/**
 * Zerlegt die Instagram og:description in strukturierte Teile.
 * Abgedeckte Formate (EN + DE, da Accept-Language de-DE gesetzt wird):
 *   '1,071 likes, 4 comments - user on June 28, 2026: "Caption"'
 *   '1.071 „Gefällt mir"-Angaben, 4 Kommentare - user am 28. Juni 2026: ...'
 *   'user on June 28, 2026: "Caption"' (Counts versteckt)
 * Fallback: bestehender cleanInstagramCaption (Caption nie schlechter als vorher).
 */
function parseInstagramMeta(raw) {
  if (!raw) return { ...EMPTY_IG_META };
  const text = raw.trim();

  // Variante mit Counts (EN/DE)
  const full = text.match(
    /^([\d.,\s]+[KMkm]?)\s*(?:likes?|[„"]?Gef[aä]llt mir["“]?-Angaben?)\s*,\s*([\d.,\s]+[KMkm]?)\s*(?:comments?|Kommentare?)\s*[-–—]\s*(\S+)\s+(?:on|am)\s+(.+?):\s*(?:["\u201E\u201C](.*?)["\u201C\u201D]|(.*?))\s*$/is
  );
  if (full) {
    const caption = (full[5] !== undefined ? full[5] : full[6] || '').trim();
    return {
      likes: parseCount(full[1]),
      comments: parseCount(full[2]),
      authorName: full[3],
      authorUrl: `https://www.instagram.com/${encodeURIComponent(full[3])}/`,
      postedAt: parseInstagramDate(full[4]),
      caption: caption || null
    };
  }

  // Variante ohne Counts: 'user on June 28, 2026: "Caption"'
  const noCounts = text.match(
    /^(\S+)\s+(?:on|am)\s+([A-Za-zÄäÖöÜüß]+\s+\d{1,2},\s*\d{4}|\d{1,2}\.?\s+[A-Za-zÄäÖöÜüß]+\s+\d{4}):\s*(?:["\u201E\u201C](.*?)["\u201C\u201D]|(.*?))\s*$/is
  );
  if (noCounts) {
    const caption = (noCounts[3] !== undefined ? noCounts[3] : noCounts[4] || '').trim();
    return {
      ...EMPTY_IG_META,
      authorName: noCounts[1],
      authorUrl: `https://www.instagram.com/${encodeURIComponent(noCounts[1])}/`,
      postedAt: parseInstagramDate(noCounts[2]),
      caption: caption || null
    };
  }

  return { ...EMPTY_IG_META, caption: cleanInstagramCaption(text) };
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

  const meta = parseInstagramMeta(domData.caption);

  return {
    videoUrl,
    isAudioOnly: !!audioTrack,
    durationSeconds,
    caption: meta.caption,
    authorName: meta.authorName,
    authorUrl: meta.authorUrl,
    postedAt: meta.postedAt,
    likes: meta.likes,
    comments: meta.comments,
    shares: null, // Instagram gibt Shares/Saves nicht oeffentlich preis
    saves: null,
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
  parseInstagramMeta,
  parseCount,
  parseInstagramDate,
  MAX_VIDEO_BYTES
};
