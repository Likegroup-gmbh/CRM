// Netlify Function: Screenshot-Generierung mit Puppeteer
// OPTIMIERT FÜR SOCIAL MEDIA - Element-Screenshots
// MIT STEALTH MODE für YouTube Bot-Umgehung

const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');

// Stealth Plugin aktivieren (umgeht Bot-Erkennung)
puppeteerExtra.use(StealthPlugin());

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
      
      // App-Banner und Overlays
      document.querySelectorAll('[class*="HpNGH"], [class*="RnEpo"], [role="dialog"], [class*="overlay"]').forEach(el => {
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
        '--disable-blink-features=AutomationControlled', // Versteckt Automation-Flag
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreDefaultArgs: ['--enable-automation'] // Entfernt Automation-Hinweis
    });

    const page = await browser.newPage();
    
    // User-Agent (Mobile für TikTok/Instagram)
    const userAgent = isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    await page.setUserAgent(userAgent);

    // Extra Headers für EU/DE Region (GDPR Cookie-Banner)
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'X-Forwarded-For': '85.214.132.117' // Deutsche IP simulieren
    });

    // Ressourcen blocken für Geschwindigkeit
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'media', 'websocket'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

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
    } else if (platform === 'youtube') {
      // YouTube: Warte auf short-video-container
      console.log('🔍 YouTube: Suche nach .short-video-container...');
      
      // Warte auf Seitenaufbau
      await new Promise(r => setTimeout(r, 5000));
      
      // Prüfe ob Element existiert
      const elementInfo = await page.evaluate(() => {
        const el = document.querySelector('.short-video-container');
        if (el) {
          const rect = el.getBoundingClientRect();
          return {
            found: true,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }
        return { found: false };
      });
      
      if (elementInfo.found) {
        console.log(`✅ .short-video-container gefunden: ${elementInfo.width}x${elementInfo.height}`);
      } else {
        console.log('❌ .short-video-container NICHT gefunden');
      }
    }

    // Versuche Element-Screenshot (nur Content, nicht ganze Seite)
    console.log('📸 Taking screenshot...');
    
    // WICHTIG: Warte bis Modal erscheint, dann ENTFERNEN (nicht nur ausblenden!)
    await new Promise(r => setTimeout(r, 1500));
    
    await page.evaluate(() => {
      // Modal komplett aus DOM ENTFERNEN
      document.querySelectorAll('[role="dialog"], [class*="tux-base-dialog"]').forEach(el => el.remove());
      
      // Overlay/Backdrop entfernen
      document.querySelectorAll('[class*="DivModalMask"], [class*="overlay"], [class*="Overlay"], [class*="backdrop"]').forEach(el => el.remove());
      
      // TOP-BAR entfernen (TikTok Logo, Open app, Unmute)
      document.querySelectorAll('[type="top"], [class*="DivFixedWrapper"], [class*="DivTopBannerAB"], [class*="TopBanner"], [class*="DivHeaderContainer"]').forEach(el => el.remove());
      
      // Bottom-Bar entfernen (Today's top videos)
      document.querySelectorAll('[class*="DivTabContainer"], [class*="TabBar"], footer').forEach(el => el.remove());
      
      // CSS Injection für alles was noch kommt
      const style = document.createElement('style');
      style.textContent = '[role="dialog"],[class*="tux-base-dialog"],[class*="Modal"],[class*="DivModalMask"],[class*="overlay"],[class*="backdrop"],[type="top"],[class*="DivFixedWrapper"],[class*="TopBanner"]{display:none!important;visibility:hidden!important;}';
      document.head.appendChild(style);
    });
    
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
