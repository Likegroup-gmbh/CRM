// Netlify Function: Screenshot-Generierung mit Puppeteer
// OPTIMIERT FÜR SOCIAL MEDIA - Element-Screenshots
// MIT STEALTH MODE für YouTube Bot-Umgehung

const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');

// Stealth Plugin mit ALLEN Evasions laut scrapingdog.com/blog/puppeteer-stealth/
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
    'navigator.vendor'  // Extra: Vendor-Fingerprinting
  ])
});
puppeteerExtra.use(stealth);

// Randomisierte User-Agents (laut Scrapingdog Best Practice)
const DESKTOP_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
];

// Zufälligen User-Agent wählen
const getRandomUserAgent = (isMobile) => {
  const agents = isMobile ? MOBILE_USER_AGENTS : DESKTOP_USER_AGENTS;
  return agents[Math.floor(Math.random() * agents.length)];
};

// Random Delay Funktion (menschliches Verhalten)
const randomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

// Plattform-spezifische Selektoren für Content-Bereich
const PLATFORM_SELECTORS = {
  // YouTube Shorts: .short-video-container ist der beste Selektor (554x984)
  youtube: '.short-video-container, #player-container',
  tiktok: '#video-card-normal, [data-e2e="detail-video"], [class*="DivVideoWrapper"]',
  instagram: 'article video, article img, [role="presentation"] video, main article',
  other: 'body'
};

/**
 * Plattform anhand der URL erkennen
 */
function detectPlatform(url) {
  if (!url) return 'other';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return 'other';
}

/**
 * TikTok-spezifisches Popup/Banner Handling
 */
async function handleTikTokPopups(page) {
  console.log('🍪 TikTok: Cookie-Banner & Popups...');
  
  // Reduzierte Wartezeit für serverless
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    // Shadow DOM Cookie-Banner klicken
    const clicked = await page.evaluate(() => {
      const shadowHosts = document.querySelectorAll('*');
      for (const el of shadowHosts) {
        if (el.shadowRoot) {
          const shadowButtons = el.shadowRoot.querySelectorAll('button');
          for (const btn of shadowButtons) {
            const text = btn.textContent || '';
            if (text.includes('ablehnen') || text.includes('Decline') || 
                text.includes('Optionale Cookies ablehnen')) {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    });
    
    if (clicked) {
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.log('Cookie-Banner:', e.message);
  }
  
  // "Watch on TikTok" Modal schließen (Mobile)
  try {
    await new Promise(r => setTimeout(r, 1000));
    
    const modalClosed = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const dataE2e = btn.querySelector('[data-e2e="launch-popup-close"]');
        if (dataE2e || (btn.textContent || '').includes('Jetzt nicht') || 
            (btn.textContent || '').includes('Not now')) {
          btn.click();
          return true;
        }
      }
      
      // Fallback: Modal ausblenden
      document.querySelectorAll('[class*="tux-base-dialog"]').forEach(el => {
        if ((el.textContent || '').includes('Schau dir dieses Video') || 
            (el.textContent || '').includes('Watch this video')) {
          el.style.display = 'none';
        }
      });
      return false;
    });
    
    if (modalClosed) {
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    console.log('Modal:', e.message);
  }
  
  // Popups & Overlays ausblenden
  await page.evaluate(() => {
    // Tastenkombinationen-Popup
    document.querySelectorAll('[class*="XMarkWrapper"], [class*="KeyboardShortcut"], [class*="FixedBottomContainer"]').forEach(el => {
      el.style.display = 'none';
    });
    
    // Captcha/Verify Modals
    document.querySelectorAll('[class*="captcha"], [class*="Captcha"], [class*="verify"], [class*="Verify"]').forEach(el => {
      el.style.display = 'none';
    });
    
    // Modal Overlays
    document.querySelectorAll('[class*="modal"], [class*="Modal"], [role="dialog"]').forEach(el => {
      if (el.textContent?.includes('Puzzle') || el.textContent?.includes('Schieberegler')) {
        el.style.display = 'none';
      }
    });
    
    // App-Banner
    document.querySelectorAll('[class*="DivBrowserModeContainer"]').forEach(el => {
      el.style.display = 'none';
    });
    
    // Top-Banner ausblenden (Mobile)
    document.querySelectorAll('[type="top"], [class*="DivFixedWrapper"], [class*="DivTopBannerAB"]').forEach(el => {
      el.style.display = 'none';
    });
  });
  
  // Minimale Wartezeit für Rendering
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Instagram-spezifisches Popup/Banner Handling
 */
async function handleInstagramPopups(page) {
  console.log('🍪 Instagram: Popups...');
  
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    // "Weiter im Web" Button klicken (deutsch) oder "Continue on web" (englisch)
    const clicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a[role="link"]');
      for (const link of links) {
        const text = link.textContent || '';
        if (text.includes('Weiter im Web') || text.includes('Continue on web') || 
            text.includes('View on web') || text.includes('Continue')) {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      console.log('✅ "Weiter im Web" geklickt');
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // "Not Now" Button für App-Download Popup
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('Not Now') || text.includes('Jetzt nicht') || text.includes('Not now')) {
          btn.click();
          return;
        }
      }
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // App-Banner, Header und Overlays entfernen
    await page.evaluate(() => {
      // Header mit Instagram Logo, Anmelden, App öffnen
      document.querySelectorAll('._ab16, ._ab1a, ._ab18, [class*="x1qjc9v5"]').forEach(el => {
        // Nur Header-Container entfernen, nicht Video-Content
        if (el.querySelector('svg[aria-label="Instagram"]') || 
            el.textContent?.includes('Anmelden') || 
            el.textContent?.includes('App öffnen')) {
          el.remove();
        }
      });
      
      // Direkter Header-Selector
      const header = document.querySelector('div._ab16');
      if (header) header.remove();
      
      // App-Banner entfernen (NICHT [role="dialog"] - darin lebt der Reel-Content!)
      document.querySelectorAll('[class*="HpNGH"], [class*="RnEpo"]').forEach(el => {
        el.remove();
      });
    });
  } catch (e) {
    console.log('Instagram Popups:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * YouTube-spezifisches Popup/Banner Handling
 * Mit detailliertem Debug-Logging für Online-Tests
 */
async function handleYouTubePopups(page) {
  console.log('🍪 YouTube: Start Cookie-Handling...');
  
  // Step 1: Aktuelle URL prüfen
  const currentUrl = page.url();
  console.log(`📍 Step 1 - URL: ${currentUrl}`);
  
  const isConsentPage = currentUrl.includes('consent.youtube.com') || currentUrl.includes('consent.google.com');
  console.log(`📍 Step 1 - Consent-Seite: ${isConsentPage ? 'JA' : 'NEIN'}`);
  
  // Step 2: Warten
  await new Promise(r => setTimeout(r, 2000));
  
  // Step 3: Alle Frames auflisten
  const frames = page.frames();
  console.log(`📍 Step 2 - Frames: ${frames.length}`);
  frames.forEach((f, i) => {
    console.log(`   Frame ${i}: ${f.url().substring(0, 60)}`);
  });
  
  // Step 4: Buttons auf der Hauptseite zählen
  const mainPageInfo = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"]');
    const buttonList = [];
    buttons.forEach((btn, i) => {
      if (i < 10) {
        const text = btn.textContent?.trim().substring(0, 30) || '';
        const aria = btn.getAttribute('aria-label')?.substring(0, 30) || '';
        buttonList.push(`"${text}"|"${aria}"`);
      }
    });
    return {
      buttonCount: buttons.length,
      buttons: buttonList
    };
  });
  console.log(`📍 Step 3 - Main Buttons: ${mainPageInfo.buttonCount}`);
  console.log(`   Erste 10: ${mainPageInfo.buttons.join(' | ')}`);
  
  let clicked = false;
  
  // Step 5: In jedem Frame nach Consent-Button suchen
  console.log('📍 Step 4 - Suche Consent-Button...');
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const frameUrl = frame.url();
    
    try {
      const result = await frame.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        const info = { buttonCount: buttons.length, found: null };
        
        for (const btn of buttons) {
          const text = btn.textContent || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          
          // Suche nach Reject/Ablehnen
          if (text.includes('Alle ablehnen') || text.includes('Reject all') ||
              text.includes('ablehnen') || text.includes('reject') ||
              ariaLabel.includes('Alle ablehnen') || ariaLabel.includes('Reject')) {
            btn.click();
            info.found = text.trim().substring(0, 30);
            return info;
          }
        }
        return info;
      });
      
      console.log(`   Frame ${i}: ${result.buttonCount} buttons, found: ${result.found || 'NEIN'}`);
      
      if (result.found) {
        clicked = true;
        console.log(`✅ Consent-Button geklickt in Frame ${i}: "${result.found}"`);
        break;
      }
    } catch (e) {
      console.log(`   Frame ${i}: Nicht zugänglich (${e.message.substring(0, 30)})`);
    }
  }
  
  if (clicked) {
    // Nach Klick auf Navigation warten
    console.log('📍 Step 5 - Warte auf Navigation...');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
      console.log('✅ Navigation erfolgt');
    } catch (e) {
      console.log('⚠️ Keine Navigation (Timeout)');
    }
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('⚠️ Kein Consent-Button gefunden - wahrscheinlich nicht nötig (USA Server)');
  }
  
  console.log('🍪 YouTube: Cookie-Handling abgeschlossen');
}

/**
 * CORS-Origin anhand von Netlify-Umgebung ermitteln
 */
function getAllowedOrigin(requestOrigin) {
  const siteUrl = process.env.URL || '';
  const deployPrimeUrl = process.env.DEPLOY_PRIME_URL || '';
  const allowed = [siteUrl, deployPrimeUrl].filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  // Fallback: Netlify deploy previews (*.netlify.app)
  if (requestOrigin && /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(requestOrigin)) return requestOrigin;
  return siteUrl || 'null';
}

/**
 * JWT aus Authorization-Header verifizieren
 */
async function verifyAuth(event) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  const requestOrigin = (event.headers || {}).origin || '';
  const origin = getAllowedOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const user = await verifyAuth(event);
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let browser;
  
  try {
    const { url, debug } = JSON.parse(event.body || '{}');
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
    console.log(`📸 Screenshot: ${platform} - ${url}`);

    // Browser starten - TikTok & Instagram mobile, YouTube Desktop
    const isMobile = platform === 'tiktok' || platform === 'instagram';
    const viewport = isMobile 
      ? { width: 430, height: 932 }  // TikTok & Instagram: iPhone 14 Pro Max
      : { width: 1920, height: 1080 };  // YouTube: Desktop

    // Stealth Mode für YouTube Bot-Umgehung
    console.log('🥷 Starte Browser mit Stealth Mode...');
    browser = await puppeteerExtra.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(),
      headless: 'new', // Neuer Headless-Modus (weniger Bot-Detection)
      ignoreDefaultArgs: ['--enable-automation']
    });

    const page = await browser.newPage();
    
    // Randomisierter User-Agent (laut scrapingdog.com Best Practice!)
    const userAgent = getRandomUserAgent(isMobile);
    console.log(`🎭 User-Agent: ${userAgent.substring(0, 50)}...`);
    
    await page.setUserAgent(userAgent);

    // Vollständige Browser-Headers (wie ein echter Browser)
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });

    // Anti-Bot JavaScript Injection (vollständig nach Scrapingdog + Latenode Best Practices)
    await page.evaluateOnNewDocument(() => {
      // Navigator platform (wichtig!)
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      
      // Navigator vendor (wichtig für Fingerprinting!)
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      
      // Navigator plugins (wie ein echter Browser)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ]
      });
      
      // Navigator language
      Object.defineProperty(navigator, 'language', { get: () => 'de-DE' });
      Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
      
      // Hardware Concurrency (typischer Wert)
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      
      // Device Memory
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      
      // WebDriver Flag verstecken
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Timezone-Spoofing (laut Scrapingdog wichtig!)
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locale, options) {
        if (options && options.timeZone === undefined) {
          options = { ...options, timeZone: 'Europe/Berlin' };
        }
        return new originalDateTimeFormat(locale, options);
      };
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
      
      // Date.prototype.getTimezoneOffset spoofen (für Europe/Berlin = -60 oder -120)
      Date.prototype.getTimezoneOffset = function() {
        return -60; // Europe/Berlin Winter
      };
      
      // Chrome runtime (vollständig)
      window.chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {}
      };
      
      // WebGL Vendor/Renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Google Inc. (Intel)'; // UNMASKED_VENDOR_WEBGL
        if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
        return getParameter.call(this, parameter);
      };
      
      // Connection (für Network Information API)
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        })
      });
      
      // Permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // WICHTIG: Media NICHT blockieren für YouTube!
    if (platform !== 'youtube') {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['font', 'websocket'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // Navigation
    console.log('🌐 Navigating...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 25000 
    });

    // Plattform-spezifisches Popup/Banner Handling
    if (platform === 'tiktok') {
      await handleTikTokPopups(page);
    } else if (platform === 'instagram') {
      await handleInstagramPopups(page);
      
      // Warte auf Video/Bild-Content (analog zu YouTube readyState-Waiting)
      console.log('📷 Instagram: Warte auf Video/Bild...');
      try {
        await page.waitForFunction(() => {
          const video = document.querySelector('article video, [role="presentation"] video, video');
          if (video && video.readyState >= 2) return true;
          const img = document.querySelector('article img[src*="instagram"], [role="presentation"] img');
          if (img && img.complete && img.naturalHeight > 0) return true;
          return false;
        }, { timeout: 3000 });
        console.log('✅ Instagram: Video/Bild bereit');
      } catch (e) {
        console.log('⚠️ Instagram: Video/Bild nicht bereit nach 3s');
      }
      
      // Debug-Modus: Fullpage-Screenshot + DOM-Analyse
      if (debug) {
        console.log('🔍 Instagram DEBUG: DOM-Analyse + Fullpage-Screenshot...');
        
        const debugInfo = await page.evaluate(() => ({
          currentUrl: window.location.href,
          title: document.title,
          hasArticle: !!document.querySelector('article'),
          hasVideo: !!document.querySelector('article video'),
          videoReadyState: document.querySelector('video')?.readyState ?? 'no video',
          hasImg: !!document.querySelector('article img'),
          hasPresentation: !!document.querySelector('[role="presentation"]'),
          hasMainArticle: !!document.querySelector('main article'),
          hasLoginWall: !!(document.body?.textContent?.includes('Anmelden') || document.body?.textContent?.includes('Log in')),
          allSelectors: {
            'article video': !!document.querySelector('article video'),
            'article img': !!document.querySelector('article img'),
            '[role="presentation"] video': !!document.querySelector('[role="presentation"] video'),
            'main article': !!document.querySelector('main article'),
            'video': !!document.querySelector('video'),
            '[role="dialog"]': !!document.querySelector('[role="dialog"]')
          },
          bodySnippet: document.body?.innerHTML?.substring(0, 800) || 'NO BODY'
        }));
        
        console.log('🔍 DEBUG Info:', JSON.stringify(debugInfo, null, 2));
        
        const debugScreenshot = await page.screenshot({
          type: 'jpeg',
          quality: 80,
          fullPage: false
        });
        
        const debugFileName = `debug-instagram-${Date.now()}.jpg`;
        const { error: debugUploadError } = await supabase.storage
          .from('strategie-screenshots')
          .upload(`screenshots/${debugFileName}`, debugScreenshot, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        let debugScreenshotUrl = null;
        if (!debugUploadError) {
          debugScreenshotUrl = `${supabaseUrl}/storage/v1/object/public/strategie-screenshots/screenshots/${debugFileName}`;
          console.log('🔍 DEBUG Screenshot:', debugScreenshotUrl);
        }
        
        // Im Debug-Modus: Sofort mit Debug-Infos antworten
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            debug: true,
            debug_screenshot_url: debugScreenshotUrl,
            debug_info: debugInfo,
            platform
          })
        };
      }
    } else if (platform === 'youtube') {
      // YouTube: Menschliches Verhalten simulieren
      console.log('🔍 YouTube: Simuliere menschliches Verhalten...');
      
      // Random Delay (menschlich)
      await new Promise(r => setTimeout(r, randomDelay(4000, 6000)));
      
      // Natural Scrolling (wie ein echter User)
      await page.evaluate(() => {
        window.scrollBy({
          top: Math.random() * 200,
          behavior: 'smooth'
        });
      });
      
      // Kurze Pause nach Scroll
      await new Promise(r => setTimeout(r, randomDelay(500, 1500)));
      
      // Step 1: Klicke Play-Button
      console.log('▶️ Klicke Play-Button...');
      const playClicked = await page.evaluate(() => {
        // Verschiedene Play-Button Selektoren
        const playSelectors = [
          'button[aria-label="Abspielen (k)"]',
          'button[aria-label="Play (k)"]',
          '#play-pause-button-shape button',
          '.ytp-large-play-button',
          'button[title*="Abspielen"]',
          'button[title*="Play"]'
        ];
        
        for (const sel of playSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return { clicked: true, selector: sel };
          }
        }
        return { clicked: false };
      });
      console.log('▶️ Play-Button:', JSON.stringify(playClicked));
      
      // Random Delay nach Play-Klick (menschlich)
      await new Promise(r => setTimeout(r, randomDelay(1500, 3000)));
      
      // Step 2: Check Video-Element mit spezifischen Klassen
      const videoInfo = await page.evaluate(() => {
        // Spezifische YouTube Shorts Video-Selektoren
        const videoSelectors = [
          'video.video-stream.html5-main-video',
          'video.video-stream',
          'video.html5-main-video',
          '.html5-video-container video',
          '#shorts-player video',
          'video'
        ];
        
        let video = null;
        let usedSelector = '';
        
        for (const sel of videoSelectors) {
          video = document.querySelector(sel);
          if (video) {
            usedSelector = sel;
            break;
          }
        }
        
        if (!video) {
          // Debug: Alle video-Elemente zählen
          const allVideos = document.querySelectorAll('video');
          return { found: false, totalVideos: allVideos.length };
        }
        
        // Versuche Video zu starten
        video.muted = true;
        video.play().catch(() => {});
        
        return {
          found: true,
          selector: usedSelector,
          src: video.src ? 'blob:...' : 'keine src',
          readyState: video.readyState,
          paused: video.paused,
          duration: video.duration
        };
      });
      console.log('📹 Video:', JSON.stringify(videoInfo));
      
      // Step 3: Warte auf Video-Frame
      if (videoInfo.found) {
        try {
          await page.waitForFunction(() => {
            const video = document.querySelector('video.video-stream, video');
            return video && video.readyState >= 2;
          }, { timeout: 5000 });
          console.log('✅ Video bereit');
        } catch (e) {
          console.log('⚠️ Video nicht bereit');
        }
      }
      
      // DEBUG: Fullscreen Screenshot für Analyse
      console.log('📸 DEBUG: Mache Fullscreen-Screenshot...');
      const debugScreenshot = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: false
      });
      
      // Upload Debug-Screenshot
      const debugFileName = `debug-youtube-${Date.now()}.jpg`;
      const { data: debugUpload, error: debugError } = await supabase.storage
        .from('strategie-screenshots')
        .upload(`screenshots/${debugFileName}`, debugScreenshot, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (!debugError) {
        const debugUrl = `${supabaseUrl}/storage/v1/object/public/strategie-screenshots/screenshots/${debugFileName}`;
        console.log('🔍 DEBUG Screenshot:', debugUrl);
      }
      
      // Extra Wartezeit
      await new Promise(r => setTimeout(r, 1000));
    }

    // Versuche Element-Screenshot (nur Content, nicht ganze Seite)
    console.log('📸 Taking screenshot...');
    
    // TikTok/YouTube: Modale und Overlays entfernen (Instagram überspringen - Content lebt in [role="dialog"]!)
    if (platform !== 'instagram') {
      await new Promise(r => setTimeout(r, 1500));
      
      await page.evaluate(() => {
        document.querySelectorAll('[role="dialog"], [class*="tux-base-dialog"]').forEach(el => el.remove());
        document.querySelectorAll('[class*="DivModalMask"], [class*="overlay"], [class*="Overlay"], [class*="backdrop"]').forEach(el => el.remove());
        document.querySelectorAll('[type="top"], [class*="DivFixedWrapper"], [class*="DivTopBannerAB"], [class*="TopBanner"], [class*="DivHeaderContainer"]').forEach(el => el.remove());
        document.querySelectorAll('[class*="DivTabContainer"], [class*="TabBar"], footer').forEach(el => el.remove());
        
        const style = document.createElement('style');
        style.textContent = '[role="dialog"],[class*="tux-base-dialog"],[class*="Modal"],[class*="DivModalMask"],[class*="overlay"],[class*="backdrop"],[type="top"],[class*="DivFixedWrapper"],[class*="TopBanner"]{display:none!important;visibility:hidden!important;}';
        document.head.appendChild(style);
      });
    } else {
      // Instagram: Nur den "Registriere dich" Footer und Header-Banner entfernen
      await page.evaluate(() => {
        document.querySelectorAll('[class*="RnEpo"], [class*="HpNGH"]').forEach(el => el.remove());
        const bottomBar = document.querySelector('[class*="x1n2onr6"][class*="x1vjfegm"]');
        if (bottomBar && bottomBar.textContent?.includes('Registriere')) bottomBar.remove();
      });
    }
    
    let screenshotBuffer;
    
    const selector = PLATFORM_SELECTORS[platform];
    const maxHeight = platform === 'instagram' ? 820 : 645;
    
    try {
      // Warte auf Content-Element
      await page.waitForSelector(selector, { timeout: 5000 });
      const element = await page.$(selector);
      
      if (element) {
        // Element-Screenshot mit max Höhe
        const box = await element.boundingBox();
        if (box) {
          screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 85,
            clip: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: Math.min(box.height, maxHeight)
            }
          });
          console.log(`✅ Element screenshot taken (max ${maxHeight}px height)`);
        } else {
          throw new Error('Element bounding box not found');
        }
      } else {
        throw new Error('Element not found');
      }
    } catch (e) {
      // Fallback: Viewport-Screenshot (Desktop für YouTube, Mobile für andere)
      console.log('⚠️ Fallback to viewport screenshot:', e.message);
      const fallbackWidth = platform === 'youtube' ? 1920 : 430;
      const fallbackHeight = platform === 'youtube' ? 1080 : maxHeight;
      screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        clip: {
          x: 0,
          y: 0,
          width: fallbackWidth,
          height: fallbackHeight
        }
      });
    }

    // Zu Supabase hochladen
    const fileName = `screenshot-${platform}-${Date.now()}.jpg`;
    const filePath = `screenshots/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('strategie-screenshots')
      .upload(filePath, screenshotBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('strategie-screenshots')
      .getPublicUrl(filePath);

    console.log(`✅ Done: ${publicUrl}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        screenshot_url: publicUrl,
        platform
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
