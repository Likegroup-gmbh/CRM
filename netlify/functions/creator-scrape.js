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
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await new Promise(r => setTimeout(r, randomDelay(3000, 5000)));
  
  // "Weiter im Web" klicken
  try {
    await page.evaluate(() => {
      const links = document.querySelectorAll('a[role="link"], button');
      for (const link of links) {
        const text = link.textContent || '';
        if (text.includes('Weiter im Web') || text.includes('Continue on web') || text.includes('View on web')) {
          link.click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log('Weiter im Web:', e.message);
  }
  
  // Header und Overlays entfernen
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [class*="overlay"]').forEach(el => el.remove());
    document.querySelectorAll('header, nav').forEach(el => el.remove());
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Profil-Daten extrahieren
  const data = await page.evaluate(() => {
    // Name (Display Name)
    const nameEl = document.querySelector('header section span[class*="x1lliihq"], header h2, [class*="_aa_c"] span');
    const name = nameEl?.textContent?.trim() || null;
    
    // Handle (Username)
    const handleEl = document.querySelector('header h2, [class*="x1lliihq"][dir="auto"]');
    let handle = handleEl?.textContent?.trim() || null;
    
    // Fallback: aus URL extrahieren
    if (!handle) {
      const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
      handle = pathMatch ? pathMatch[1] : null;
    }
    if (handle && !handle.startsWith('@')) handle = '@' + handle;
    
    // Bio
    const bioEl = document.querySelector('header section > div > span, [class*="_aa_c"] span:not([class*="x1lliihq"])');
    const bio = bioEl?.textContent?.trim() || null;
    
    // Follower - suche nach "Follower" Text
    let followerText = null;
    const statEls = document.querySelectorAll('header section ul li, [class*="_aa_c"] a span');
    statEls.forEach(el => {
      const text = el.textContent || '';
      if (text.toLowerCase().includes('follower')) {
        const match = text.match(/([\d,.]+[kmb]?)/i);
        if (match) followerText = match[1];
      }
    });
    
    // Profilbild
    const avatarEl = document.querySelector('header img[alt*="Profilbild"], header img[alt*="profile picture"], header section img');
    const profileImageUrl = avatarEl?.src || null;
    
    return { name, handle, bio, followerText, profileImageUrl };
  });
  
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
async function captureProfileImage(page, platform, supabase, supabaseUrl) {
  console.log('📸 Erstelle Profil-Screenshot...');
  
  try {
    // Viewport auf mobil setzen
    await page.setViewport({ width: 430, height: 932 });
    await new Promise(r => setTimeout(r, 500));
    
    // Profilbild-Element finden
    let selector;
    if (platform === 'tiktok') {
      selector = '[class*="ImgAvatar"], [data-e2e="user-avatar"], [class*="UserAvatar"]';
    } else {
      selector = 'header img[alt*="Profilbild"], header img[alt*="profile picture"], header section img';
    }
    
    const element = await page.$(selector);
    if (!element) {
      console.log('⚠️ Profilbild-Element nicht gefunden, mache Header-Screenshot');
      // Fallback: Screenshot vom oberen Bereich
      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        clip: { x: 0, y: 0, width: 430, height: 300 }
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
    
    // Element-Screenshot
    const screenshotBuffer = await element.screenshot({ type: 'jpeg', quality: 85 });
    
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

    // Profilbild als Screenshot speichern (falls keine URL verfügbar)
    if (!creatorData.profile_image_url) {
      creatorData.profile_image_url = await captureProfileImage(page, platform, supabase, supabaseUrl);
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

