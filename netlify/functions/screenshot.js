// Netlify Function: Screenshot-Generierung mit Puppeteer
// OPTIMIERT FÜR SOCIAL MEDIA - Element-Screenshots

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

// Plattform-spezifische Selektoren für Content-Bereich
const PLATFORM_SELECTORS = {
  youtube: 'video, #movie_player, ytd-player',
  tiktok: '[data-e2e="browse-video"], [class*="DivVideoContainer"], video',
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

    // Browser starten - Mobile Viewport für TikTok/Instagram
    const isMobile = platform === 'tiktok' || platform === 'instagram';
    const viewport = isMobile 
      ? { width: 430, height: 932 }  // iPhone 14 Pro Max
      : { width: 1280, height: 720 };

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

    // Plattform-spezifische Wartezeit
    const waitTime = platform === 'tiktok' ? 5000 : 3000;
    await new Promise(r => setTimeout(r, waitTime));

    // Cookie-Banner schließen
    try {
      await Promise.race([
        page.click('[data-testid="cookie-banner-accept"]').catch(() => {}),
        page.click('button[class*="accept"]').catch(() => {}),
        new Promise(r => setTimeout(r, 500))
      ]);
    } catch (e) {}

    // Versuche Element-Screenshot (nur Content, nicht ganze Seite)
    console.log('📸 Taking screenshot...');
    let screenshotBuffer;
    
    const selector = PLATFORM_SELECTORS[platform];
    try {
      // Warte auf Content-Element
      await page.waitForSelector(selector, { timeout: 5000 });
      const element = await page.$(selector);
      
      if (element) {
        // Element-Screenshot
        screenshotBuffer = await element.screenshot({
          type: 'jpeg',
          quality: 85
        });
        console.log('✅ Element screenshot taken');
      } else {
        throw new Error('Element not found');
      }
    } catch (e) {
      // Fallback: Volle Seite
      console.log('⚠️ Fallback to full page screenshot');
      screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        fullPage: false
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
