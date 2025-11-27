// Netlify Function: Screenshot-Generierung mit Puppeteer
// OPTIMIERT FÜR SOCIAL MEDIA - Element-Screenshots

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

// Plattform-spezifische Selektoren für Content-Bereich
const PLATFORM_SELECTORS = {
  youtube: 'video, #movie_player, ytd-player',
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
 */
async function handleYouTubePopups(page) {
  console.log('🍪 YouTube: Cookie-Banner...');
  
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    // Cookie-Banner akzeptieren
    await page.click('[data-testid="cookie-banner-accept"]').catch(() => {});
    await page.click('button[aria-label*="Accept"]').catch(() => {});
    
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.log('YouTube Banner:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
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

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // User-Agent (Mobile für TikTok/Instagram)
    const userAgent = isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    await page.setUserAgent(userAgent);

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
      await handleYouTubePopups(page);
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
      // Fallback: Viewport-Screenshot
      console.log('⚠️ Fallback to viewport screenshot');
      screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        clip: {
          x: 0,
          y: 0,
          width: 430,
          height: maxHeight
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
