// Netlify Function: Screenshot-Generierung mit Puppeteer
// STARK OPTIMIERT für Netlify Timeout (max 26s)

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

function detectPlatform(url) {
  if (!url) return 'other';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return 'other';
}

exports.handler = async (event, context) => {
  // Timeout-Warnung für Netlify
  context.callbackWaitsForEmptyEventLoop = false;
  
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

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase config missing');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const platform = detectPlatform(url);
    console.log(`📸 ${platform}: ${url}`);

    // MINIMAL Browser-Config für Speed
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );

    // SCHNELLE Navigation - nicht auf alles warten
    console.log('🌐 Navigate...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',  // Schneller als networkidle
      timeout: 15000 
    });

    // NUR 2 Sekunden warten
    await new Promise(r => setTimeout(r, 2000));

    // TikTok: Cookie + Popups schließen (SCHNELL)
    if (platform === 'tiktok') {
      await page.evaluate(() => {
        // Shadow DOM Cookie-Banner
        document.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            el.shadowRoot.querySelectorAll('button').forEach(btn => {
              if (btn.textContent?.includes('ablehnen') || btn.textContent?.includes('erlauben')) {
                btn.click();
              }
            });
          }
        });
        // Popups ausblenden
        document.querySelectorAll('[class*="XMarkWrapper"], [class*="e1jppm6i4"]').forEach(el => el.click());
        document.querySelectorAll('[class*="KeyboardShortcut"], [class*="FixedBottomContainer"], [class*="captcha"], [class*="Captcha"], [role="dialog"]').forEach(el => {
          el.style.display = 'none';
        });
      }).catch(() => {});
      
      await new Promise(r => setTimeout(r, 500));
    }

    // Screenshot
    console.log('📸 Screenshot...');
    let screenshotBuffer;
    
    const selectors = {
      tiktok: '[data-e2e="detail-video"]',
      instagram: 'article',
      youtube: '#movie_player',
      other: 'body'
    };
    
    try {
      const element = await page.$(selectors[platform]);
      if (element) {
        screenshotBuffer = await element.screenshot({ type: 'jpeg', quality: 80 });
      } else {
        throw new Error('Element not found');
      }
    } catch (e) {
      screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
    }

    // Upload
    const fileName = `screenshot-${platform}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('strategie-screenshots')
      .upload(`screenshots/${fileName}`, screenshotBuffer, {
        contentType: 'image/jpeg'
      });

    if (uploadError) throw new Error(`Upload: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('strategie-screenshots')
      .getPublicUrl(`screenshots/${fileName}`);

    console.log(`✅ ${publicUrl}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, screenshot_url: publicUrl, platform })
    };

  } catch (error) {
    console.error('❌', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  } finally {
    if (browser) await browser.close();
  }
};
