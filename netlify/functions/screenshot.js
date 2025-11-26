// Netlify Function: Screenshot-Generierung mit Puppeteer
// Nimmt Video-URLs entgegen und generiert Screenshots

const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

// Chromium Binary URL (gehostet auf GitHub, ~48MB)
const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.0/chromium-v123.0.0-pack.tar';

// Platform-spezifische Konfiguration
const PLATFORM_CONFIG = {
  youtube: {
    waitFor: '#movie_player video',
    viewport: { width: 1280, height: 720 },
    delay: 2000,
    timeout: 15000
  },
  tiktok: {
    waitFor: 'video',
    viewport: { width: 414, height: 896 },
    delay: 3000,
    timeout: 15000
  },
  instagram: {
    waitFor: 'video, article img',
    viewport: { width: 414, height: 896 },
    delay: 2000,
    timeout: 15000
  },
  other: {
    waitFor: 'body',
    viewport: { width: 1280, height: 720 },
    delay: 1500,
    timeout: 10000
  }
};

/**
 * Plattform anhand der URL erkennen
 */
function detectPlatform(url) {
  if (!url) return 'other';
  
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube';
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (urlLower.includes('instagram.com')) {
    return 'instagram';
  }
  
  return 'other';
}

/**
 * Screenshot erstellen und zu Supabase Storage hochladen
 */
async function createAndUploadScreenshot(url, platform, config, supabase) {
  let browser;
  
  try {
    console.log(`🚀 Starte Browser für ${platform}...`);
    
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setViewport(config.viewport);
    
    console.log(`🌐 Navigiere zu URL: ${url}`);
    
    // Zu URL navigieren
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Warte auf Haupt-Element
    try {
      await page.waitForSelector(config.waitFor, { timeout: config.timeout });
      console.log(`✅ Element gefunden: ${config.waitFor}`);
    } catch (err) {
      console.warn(`⚠️ Element nicht gefunden, fahre trotzdem fort: ${config.waitFor}`);
    }
    
    // Zusätzliche Wartezeit für Content-Laden
    await new Promise(resolve => setTimeout(resolve, config.delay));

    console.log('📸 Erstelle Screenshot...');
    
    // Screenshot als Buffer
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      fullPage: false
    });

    // Dateiname generieren
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `screenshot-${platform}-${timestamp}-${randomStr}.jpg`;
    const filePath = `screenshots/${fileName}`;

    console.log(`☁️ Lade hoch zu Supabase Storage: ${filePath}`);

    // Upload zu Supabase Storage
    const { data, error } = await supabase.storage
      .from('strategie-screenshots')
      .upload(filePath, screenshotBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase Upload Error:', error);
      throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    }

    // Public URL generieren
    const { data: { publicUrl } } = supabase.storage
      .from('strategie-screenshots')
      .getPublicUrl(filePath);

    console.log(`✅ Screenshot erfolgreich hochgeladen: ${publicUrl}`);

    return {
      success: true,
      screenshot_url: publicUrl,
      platform,
      url,
      fileName
    };

  } catch (error) {
    console.error('❌ Fehler bei Screenshot-Erstellung:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser geschlossen');
    }
  }
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS (CORS Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Nur POST erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Method Not Allowed. Use POST.' 
      })
    };
  }

  try {
    // Request Body parsen
    const { url } = JSON.parse(event.body || '{}');

    // Validierung
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'URL ist erforderlich' 
        })
      };
    }

    // URL validieren
    try {
      new URL(url);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Ungültige URL' 
        })
      };
    }

    // Supabase Client initialisieren
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase Konfiguration fehlt');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Plattform erkennen
    const platform = detectPlatform(url);
    const config = PLATFORM_CONFIG[platform];

    console.log(`🎯 Erkannte Plattform: ${platform}`);

    // Screenshot erstellen und hochladen
    const result = await createAndUploadScreenshot(url, platform, config, supabase);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Function Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Interner Serverfehler'
      })
    };
  }
};

