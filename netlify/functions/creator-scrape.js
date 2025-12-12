// Netlify Function: Creator-Profile Scraping
// Extrahiert Creator-Daten von TikTok und Instagram Profilen
// MIT STEALTH MODE für Bot-Umgehung

const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');

// Stealth Plugin mit allen Evasions
const stealth = StealthPlugin({
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi',
    'chrome.loadTimes',
    'chrome.runtime',
    'defaultArgs',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override',
    'webgl.vendor',
    'window.outerdimensions',
    'navigator.vendor'
  ])
});
puppeteerExtra.use(stealth);

// Mobile User-Agents
const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
];

const getRandomUserAgent = () => {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
};

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * Plattform anhand der URL erkennen
 */
function detectPlatform(url) {
  if (!url) return 'other';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return 'other';
}

/**
 * E-Mail aus Text extrahieren
 */
function extractEmail(text) {
  if (!text) return null;
  const emailRegex = /[\w.-]+@[\w.-]+\.\w{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

/**
 * Follower-Count parsen (z.B. "1.2M" -> 1200000)
 */
function parseFollowerCount(text) {
  if (!text) return null;
  const cleaned = text.replace(/[,\s]/g, '').toLowerCase();
  const match = cleaned.match(/([\d.]+)([kmb]?)/);
  if (!match) return null;
  
  let num = parseFloat(match[1]);
  const suffix = match[2];
  
  if (suffix === 'k') num *= 1000;
  if (suffix === 'm') num *= 1000000;
  if (suffix === 'b') num *= 1000000000;
  
  return Math.round(num);
}

/**
 * TikTok Profil scrapen
 */
async function scrapeTikTok(page, url) {
  console.log('📱 TikTok: Navigiere zu', url);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await new Promise(r => setTimeout(r, randomDelay(3000, 5000)));
  
  // Cookie-Banner schließen
  try {
    await page.evaluate(() => {
      const shadowHosts = document.querySelectorAll('*');
      for (const el of shadowHosts) {
        if (el.shadowRoot) {
          const shadowButtons = el.shadowRoot.querySelectorAll('button');
          for (const btn of shadowButtons) {
            const text = btn.textContent || '';
            if (text.includes('ablehnen') || text.includes('Decline')) {
              btn.click();
              return;
            }
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('Cookie-Banner:', e.message);
  }
  
  // Popups entfernen
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"]').forEach(el => el.remove());
    document.querySelectorAll('[class*="DivBrowserModeContainer"], [type="top"]').forEach(el => el.remove());
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Profil-Daten extrahieren
  const data = await page.evaluate(() => {
    // Name
    const nameEl = document.querySelector('h1[data-e2e="user-title"], h2[data-e2e="user-subtitle"], [class*="ShareTitle"] h1, [class*="UserTitle"]');
    const name = nameEl?.textContent?.trim() || null;
    
    // Handle
    const handleEl = document.querySelector('h2[data-e2e="user-subtitle"], [class*="ShareSubTitle"], [class*="UserSubTitle"]');
    let handle = handleEl?.textContent?.trim() || null;
    if (handle && !handle.startsWith('@')) handle = '@' + handle;
    
    // Bio
    const bioEl = document.querySelector('[data-e2e="user-bio"], [class*="ShareDesc"], [class*="UserBio"]');
    const bio = bioEl?.textContent?.trim() || null;
    
    // Follower
    const followerEl = document.querySelector('[data-e2e="followers-count"], [class*="FollowerCount"]');
    const followerText = followerEl?.textContent?.trim() || null;
    
    // Likes (durchschnittlich)
    const likesEl = document.querySelector('[data-e2e="likes-count"], [class*="LikesCount"]');
    const likesText = likesEl?.textContent?.trim() || null;
    
    // Profilbild URL
    const avatarEl = document.querySelector('[class*="ImgAvatar"] img, [data-e2e="user-avatar"] img, [class*="UserAvatar"] img');
    const profileImageUrl = avatarEl?.src || null;
    
    return { name, handle, bio, followerText, likesText, profileImageUrl };
  });
  
  console.log('📱 TikTok Rohdaten:', JSON.stringify(data));
  
  return {
    name: data.name,
    creator_handle: data.handle,
    beschreibung: data.bio,
    email: extractEmail(data.bio),
    follower_count: parseFollowerCount(data.followerText),
    likes: parseFollowerCount(data.likesText),
    profile_image_url: data.profileImageUrl,
    plattform: 'tiktok'
  };
}

/**
 * Instagram Profil scrapen
 */
async function scrapeInstagram(page, url) {
  console.log('📷 Instagram: Navigiere zu', url);
  
  // Wichtig: networkidle2 statt networkidle0 (toleranter)
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, randomDelay(3000, 4000)));
  
  // DEBUG: Aktuelle URL und Title loggen
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log('🔍 DEBUG - Aktuelle URL:', currentUrl);
  console.log('🔍 DEBUG - Page Title:', pageTitle);
  
  // Prüfen ob wir auf Login-Seite gelandet sind
  if (currentUrl.includes('/accounts/') || currentUrl.includes('/login')) {
    console.log('⚠️ WARNUNG: Wurde auf Login-Seite umgeleitet!');
    console.log('🔄 Versuche erneut mit anderem User-Agent...');
    
    // Neuer User-Agent und Retry
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const retryUrl = page.url();
    console.log('🔍 DEBUG - URL nach Retry:', retryUrl);
  }
  
  // DEBUG: HTML-Snippet loggen
  const htmlSnippet = await page.evaluate(() => {
    return document.body?.innerHTML?.substring(0, 500) || 'NO BODY';
  });
  console.log('🔍 DEBUG - HTML Snippet:', htmlSnippet.substring(0, 300));
  
  // Login-Popup/Cookie-Banner schließen
  try {
    const popupResult = await page.evaluate(() => {
      // Login-Popup schließen (X Button oder "Nicht jetzt")
      const closeButtons = document.querySelectorAll('button[type="button"], [role="button"]');
      for (const btn of closeButtons) {
        const text = btn.textContent || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (text.includes('Nicht jetzt') || text.includes('Not Now') || 
            text.includes('Ablehnen') || text.includes('Decline') ||
            ariaLabel.includes('Close') || ariaLabel.includes('Schließen')) {
          btn.click();
          return 'clicked: ' + text.substring(0, 30);
        }
      }
      // SVG close button
      const svgClose = document.querySelector('svg[aria-label="Schließen"], svg[aria-label="Close"]');
      if (svgClose) {
        svgClose.closest('button')?.click();
        return 'clicked svg close';
      }
      return 'no popup found';
    });
    console.log('🔍 DEBUG - Popup Result:', popupResult);
    await new Promise(r => setTimeout(r, 1500));
  } catch (e) {
    console.log('Popup schließen:', e.message);
  }
  
  // ESC drücken um Dialoge zu schließen
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  
  // Dialoge entfernen
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [role="presentation"]').forEach(el => el.remove());
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Profil-Daten extrahieren - mit Debug-Ausgaben
  const data = await page.evaluate(() => {
    const debug = {
      url: window.location.href,
      pathname: window.location.pathname,
      title: document.title,
      hasHeader: !!document.querySelector('header'),
      listItemCount: document.querySelectorAll('li').length,
      imgCount: document.querySelectorAll('img').length
    };
    
    // Username aus URL (zuverlässigste Methode)
    const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
    let handle = pathMatch ? pathMatch[1] : null;
    if (handle && !handle.startsWith('@')) handle = '@' + handle;
    const username = handle?.replace('@', '') || '';
    
    debug.extractedHandle = handle;
    debug.extractedUsername = username;
    
    // Name aus Page Title extrahieren
    // Format: "Roxana | Babyschlafberaterin (@sleepymonkeycoaching) • Instagram-Fotos"
    let name = null;
    const titleMatch = document.title.match(/^(.+?)\s*\(@/);
    if (titleMatch) {
      name = titleMatch[1].trim();
    }
    // Fallback: Meta-Tag
    if (!name) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        const content = metaTitle.getAttribute('content') || '';
        debug.ogTitle = content;
        const nameMatch = content.match(/^(.+?)\s*\(@/);
        if (nameMatch) name = nameMatch[1].trim();
      }
    }
    
    debug.extractedName = name;
    
    // Follower aus Accessibility-Liste (sehr zuverlässig)
    let followerText = null;
    const listItems = document.querySelectorAll('li');
    debug.listItemTexts = Array.from(listItems).slice(0, 5).map(li => li.textContent?.substring(0, 50));
    
    for (const li of listItems) {
      const text = li.textContent || '';
      if (text.includes('Follower') || text.includes('follower')) {
        // Extrahiere die Zahl: "1.625 Follower" -> "1.625"
        const match = text.match(/([\d.,]+)\s*Follower/i);
        if (match) {
          followerText = match[1].replace(/\./g, '').replace(/,/g, '.');
          break;
        }
      }
    }
    
    // Bio - den längsten Span im Header finden (der keine Stats enthält)
    let bio = null;
    const header = document.querySelector('header');
    if (header) {
      const spans = header.querySelectorAll('span');
      debug.headerSpanCount = spans.length;
      let longestBio = '';
      
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        // Bio ist typischerweise der längste Text ohne Stats-Wörter
        // und enthält nicht "... mehr" am Ende (das ist der gekürzte Text)
        if (text.length > 30 && 
            !text.includes('Follower') && 
            !text.includes('Beiträge') && 
            !text.includes('Posts') &&
            !text.includes('Gefolgt') &&
            !text.includes('Following') &&
            !text.endsWith('mehr') &&
            text.length > longestBio.length) {
          longestBio = text;
        }
      }
      
      if (longestBio) {
        // "... mehr" am Ende entfernen falls vorhanden
        bio = longestBio.replace(/\.{3}\s*mehr$/, '').trim();
      }
    }
    
    // Fallback: Meta-Description
    if (!bio) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content') || '';
        debug.metaDescription = content.substring(0, 100);
        // Format: "123 Followers, 45 Following, 67 Posts - Bio text here"
        const bioMatch = content.match(/Posts?\s*[-–]\s*(.+?)(?:$|See Instagram)/i);
        if (bioMatch) {
          bio = bioMatch[1].trim();
        }
      }
    }
    
    // Profilbild - basierend auf alt-Text
    let profileImageUrl = null;
    
    // Alle img alt-Texte für Debug sammeln
    const allImgs = document.querySelectorAll('img');
    debug.imgAlts = Array.from(allImgs).slice(0, 10).map(img => img.alt?.substring(0, 30));
    
    // Strategie 1: img mit "Profilbild" im alt-Text (DE)
    const profileImg = document.querySelector('img[alt*="Profilbild"], img[alt*="profile picture"]');
    if (profileImg && profileImg.src) {
      profileImageUrl = profileImg.src;
      debug.profileImgStrategy = 'alt contains Profilbild';
    }
    
    // Strategie 2: img mit Username im alt-Text
    if (!profileImageUrl && username) {
      const imgWithUsername = document.querySelector(`img[alt*="${username}"]`);
      if (imgWithUsername && imgWithUsername.src) {
        profileImageUrl = imgWithUsername.src;
        debug.profileImgStrategy = 'alt contains username';
      }
    }
    
    // Strategie 3: Erstes großes Bild im Header
    if (!profileImageUrl && header) {
      const headerImg = header.querySelector('img');
      if (headerImg && headerImg.src) {
        profileImageUrl = headerImg.src;
        debug.profileImgStrategy = 'first header img';
      }
    }
    
    return { name, handle, bio, followerText, profileImageUrl, debug };
  });
  
  // Debug-Infos loggen
  console.log('🔍 DEBUG - Extraktions-Details:', JSON.stringify(data.debug, null, 2));
  
  console.log('📷 Instagram Rohdaten:', JSON.stringify(data));
  
  return {
    name: data.name,
    creator_handle: data.handle,
    beschreibung: data.bio,
    email: extractEmail(data.bio),
    follower_count: parseFollowerCount(data.followerText),
    likes: null, // Instagram zeigt keine durchschnittlichen Likes
    profile_image_url: data.profileImageUrl,
    plattform: 'instagram'
  };
}

/**
 * Profilbild als Screenshot speichern
 */
async function captureProfileImage(page, platform, supabase, supabaseUrl, username) {
  console.log('📸 Erstelle Profil-Screenshot...');
  
  try {
    // Viewport auf mobil setzen
    await page.setViewport({ width: 430, height: 932 });
    await new Promise(r => setTimeout(r, 500));
    
    let element = null;
    
    if (platform === 'tiktok') {
      // TikTok Selektoren
      element = await page.$('[class*="ImgAvatar"], [data-e2e="user-avatar"], [class*="UserAvatar"]');
    } else {
      // Instagram - basierend auf Browser-Analyse
      const cleanUsername = username?.replace('@', '') || '';
      
      // Strategie 1: img mit "Profilbild" im alt-Text (DE/EN)
      element = await page.$('img[alt*="Profilbild"], img[alt*="profile picture"]');
      
      // Strategie 2: Bild mit Username im alt-Text
      if (!element && cleanUsername) {
        element = await page.$(`img[alt*="${cleanUsername}"]`);
      }
      
      // Strategie 3: Erstes Bild im Header
      if (!element) {
        element = await page.$('header img');
      }
      
      // Strategie 4: Button mit Profilbild-Link
      if (!element) {
        element = await page.$('header button img, header [role="button"] img');
      }
    }
    
    if (!element) {
      console.log('⚠️ Profilbild-Element nicht gefunden, mache Header-Screenshot');
      // Fallback: Screenshot vom oberen Bereich (Profilbereich)
      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 90,
        clip: { x: 0, y: 50, width: 430, height: 350 }
      });
      
      const fileName = `profile-${platform}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('creator-profile-images')
        .upload(`profiles/${fileName}`, screenshotBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });
      
      if (uploadError) throw uploadError;
      return `${supabaseUrl}/storage/v1/object/public/creator-profile-images/profiles/${fileName}`;
    }
    
    // Element-Screenshot mit Padding
    const box = await element.boundingBox();
    if (box) {
      // Etwas größerer Bereich um das Profilbild
      const padding = 5;
      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 90,
        clip: {
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: box.width + (padding * 2),
          height: box.height + (padding * 2)
        }
      });
      
      const fileName = `profile-${platform}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('creator-profile-images')
        .upload(`profiles/${fileName}`, screenshotBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });
      
      if (uploadError) throw uploadError;
      return `${supabaseUrl}/storage/v1/object/public/creator-profile-images/profiles/${fileName}`;
    }
    
    // Fallback: Element-Screenshot
    const screenshotBuffer = await element.screenshot({ type: 'jpeg', quality: 90 });
    
    const fileName = `profile-${platform}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('creator-profile-images')
      .upload(`profiles/${fileName}`, screenshotBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (uploadError) throw uploadError;
    
    return `${supabaseUrl}/storage/v1/object/public/creator-profile-images/profiles/${fileName}`;
  } catch (e) {
    console.error('Screenshot-Fehler:', e.message);
    return null;
  }
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let browser;

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
    }

    // Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase config missing');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const platform = detectPlatform(url);
    if (platform === 'other') {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Unsupported platform. Use TikTok or Instagram URLs.' }) 
      };
    }

    console.log(`🔍 Creator-Scrape: ${platform} - ${url}`);

    // Browser starten
    browser = await puppeteerExtra.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      defaultViewport: { width: 430, height: 932 },
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreDefaultArgs: ['--enable-automation']
    });

    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());

    // Browser-Headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    });

    // Anti-Bot Injection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.' });
      window.chrome = { runtime: {} };
    });

    // Scrapen basierend auf Plattform
    let creatorData;
    if (platform === 'tiktok') {
      creatorData = await scrapeTikTok(page, url);
    } else {
      creatorData = await scrapeInstagram(page, url);
    }

    // Profilbild als Screenshot speichern (falls keine URL verfügbar oder temporäre URL)
    // Instagram URLs sind oft temporär, daher immer Screenshot machen
    if (!creatorData.profile_image_url || platform === 'instagram') {
      const screenshotUrl = await captureProfileImage(page, platform, supabase, supabaseUrl, creatorData.creator_handle);
      if (screenshotUrl) {
        creatorData.profile_image_url = screenshotUrl;
      }
    }

    // Link zur Original-URL setzen
    creatorData.link = url;

    console.log('✅ Scraping erfolgreich:', JSON.stringify(creatorData));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: creatorData
      })
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  } finally {
    if (browser) await browser.close();
  }
};


